package main

import (
	"database/sql"
	"log"
	"os"

	"github.com/comex/auth-service/internal/adapters/handlers"
	"github.com/comex/auth-service/internal/adapters/repositories"
	"github.com/comex/auth-service/internal/core/services"
	"github.com/comex/auth-service/internal/infrastructure/cache"
	"github.com/comex/auth-service/internal/infrastructure/crypto"
	jwtPkg "github.com/comex/auth-service/internal/infrastructure/jwt"
	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
)

func main() {
	// Database connection string
	dbConnStr := "host=" + getEnv("DB_HOST", "localhost") +
		" port=" + getEnv("DB_PORT", "5432") +
		" user=" + getEnv("DB_USER", "admin") +
		" password=" + getEnv("DB_PASSWORD", "secret123") +
		" dbname=" + getEnv("DB_NAME", "qontrol") +
		" sslmode=disable"

	db, err := sql.Open("postgres", dbConnStr)
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}
	defer db.Close()

	// Test database connection
	if err := db.Ping(); err != nil {
		log.Fatal("Failed to ping database:", err)
	}
	log.Println("✅ Connected to PostgreSQL")

	// Initialize infrastructure components
	redisClient := cache.NewRedisClient(getEnv("REDIS_HOST", "localhost:6379"))
	log.Println("✅ Connected to Redis")

	argon2Hasher := crypto.NewArgon2Hasher()
	jwtManager := jwtPkg.NewJWTManager(
		getEnv("JWT_SECRET", "default-secret-change-me"),
		getEnv("JWT_EXPIRY", "24h"),
	)

	// Initialize repositories
	userRepo := repositories.NewPostgresUserRepo(db)

	// Initialize services
	authService := services.NewAuthService(userRepo, redisClient, argon2Hasher, jwtManager)

	// Initialize handlers
	authHandler := handlers.NewAuthHandler(authService)

	// Setup Gin router
	r := gin.Default()

	// CORS middleware
	r.Use(corsMiddleware())

	// Health check endpoint
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok", "service": "auth-service"})
	})

	// Auth routes
	r.POST("/login", authHandler.Login)
	r.POST("/logout", authHandler.Logout)

	log.Println("🚀 Auth service starting on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		if origin == "" {
			origin = "*"
		}

		c.Header("Access-Control-Allow-Origin", origin)
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type")
		c.Header("Access-Control-Allow-Credentials", "true")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}
