package main

import (
	"log"
	"os"

	"audit-service/internal/adapters/handlers"
	"audit-service/internal/adapters/middleware"
	"audit-service/internal/adapters/repositories"
	"audit-service/internal/adapters/storage"
	"audit-service/internal/core/services"
	"audit-service/internal/infrastructure/database"
	"audit-service/internal/parser"

	"github.com/gin-gonic/gin"
)

func main() {
	log.Println("REBUILD VERIFICATION: SKU JOIN ADDED - Starting Audit Service 2.0")
	// Database connection
	db, err := database.NewPostgresConnection()
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Repositories
	repo := repositories.NewPostgresRepository(db)

	// S3 Client (use mock in development)
	var s3Client storage.S3Client
	if os.Getenv("AWS_S3_BUCKET") != "" {
		s3Client, err = storage.NewAWSS3Client(
			os.Getenv("AWS_S3_BUCKET"),
			os.Getenv("AWS_REGION"),
		)
		if err != nil {
			log.Printf("Warning: Failed to create S3 client, using mock: %v", err)
			s3Client = storage.NewMockS3Client()
		}
	} else {
		log.Println("Using mock S3 client for development")
		s3Client = storage.NewMockS3Client()
	}

	// PDF Parser (use mock for now until we have real PDFs)
	var pdfParser parser.PDFParser
	if os.Getenv("USE_MOCK_PARSER") == "true" {
		log.Println("Using mock PDF parser")
		pdfParser = parser.NewMockPDFParser()
	} else {
		pdfParser = parser.NewComexPDFParser()
	}

	// Service
	auditService := services.NewAuditService(repo, s3Client, pdfParser)
	catalogService := services.NewCatalogService(repo)

	// Handlers
	auditHandler := handlers.NewAuditHandler(auditService)
	catalogHandler := handlers.NewCatalogHandler(catalogService, pdfParser)

	// Gin router
	router := gin.Default()

	// Middleware
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		log.Fatal("JWT_SECRET not set")
	}
	authMiddleware := middleware.NewAuthMiddleware(jwtSecret)

	// CORS Middleware
	router.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE, PATCH")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	// Health check (public)
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	// Protected API routes (require authentication)
	api := router.Group("/api")
	api.Use(authMiddleware.RequireAuth())
	{
		// HU10 Dashboard endpoint
		api.GET("/audits", auditHandler.GetAudits)
	}

	// Register all routes with auth middleware
	auditHandler.RegisterRoutesWithAuth(router, authMiddleware)
	catalogHandler.RegisterRoutesWithAuth(router, authMiddleware)

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}
	log.Printf("Audit service starting on port %s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
