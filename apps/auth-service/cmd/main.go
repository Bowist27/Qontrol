package main

import (
	"database/sql"
	"log"
	"os"

	"github.com/comex/auth-service/internal/adapters/handlers"
	"github.com/comex/auth-service/internal/adapters/middleware"
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
	authMiddleware := middleware.NewAuthMiddleware(authService, jwtManager)
	userHandler := handlers.NewUserHandler(userRepo)
	productHandler := handlers.NewProductHandler(db)

	// Setup Gin router
	r := gin.Default()

	// CORS middleware
	r.Use(corsMiddleware())

	// Health check endpoint
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok", "service": "auth-service"})
	})

	// Auth routes (Public)
	r.POST("/login", authHandler.Login)
	r.POST("/logout", authHandler.Logout) // Logout requires token but handles it inside

	// Protected Routes
	protected := r.Group("/")
	protected.Use(authMiddleware.RequireAuth())
	{
		r.GET("/users/sync", authHandler.SyncUsers)

		// User management routes (IAM)
		protected.GET("/users", userHandler.ListUsers)
		protected.GET("/users/:id", userHandler.GetUser)
		protected.POST("/users", userHandler.CreateUser)
		protected.PUT("/users/:id", userHandler.UpdateUser)
		protected.DELETE("/users/:id", userHandler.DeleteUser)
		protected.POST("/users/:id/ban", userHandler.BanUser)
		protected.POST("/users/:id/unban", userHandler.UnbanUser)

		// Stores management routes
		protected.GET("/stores", userHandler.ListStores)
		protected.GET("/stores/:id", userHandler.GetStore)
		protected.POST("/stores", userHandler.CreateStore)
		protected.PUT("/stores/:id", userHandler.UpdateStore)
		protected.DELETE("/stores/:id", userHandler.DeleteStore)

		// Products routes (for POS sync)
		protected.GET("/products/sync", productHandler.SyncProducts)
		protected.GET("/products", productHandler.ListProducts)

		// Roles management routes
		protected.GET("/roles", userHandler.ListRoles)
		protected.GET("/roles/:id", userHandler.GetRole)
		protected.POST("/roles", userHandler.CreateRole)
		protected.PUT("/roles/:id", userHandler.UpdateRole)
		protected.DELETE("/roles/:id", userHandler.DeleteRole)

		// Zones & Price Lists management routes
		protected.GET("/price-lists", userHandler.ListPriceLists)
		protected.GET("/zones", userHandler.ListZones)
		protected.GET("/zones/:id", userHandler.GetZone)
		protected.POST("/zones", userHandler.CreateZone)
		protected.PUT("/zones/:id", userHandler.UpdateZone)
		protected.DELETE("/zones/:id", userHandler.DeleteZone)
	}

	port := getEnv("PORT", "8080")
	log.Println("🚀 Auth service starting on :" + port)
	if err := r.Run(":" + port); err != nil {
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
