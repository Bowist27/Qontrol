package middleware

import (
	"net/http"
	"strings"

	"github.com/comex/auth-service/internal/core/services"
	"github.com/comex/auth-service/internal/infrastructure/jwt"
	"github.com/gin-gonic/gin"
)

// AuthMiddleware handles authentication verification
type AuthMiddleware struct {
	authService *services.AuthService
	jwtManager  *jwt.JWTManager
}

// NewAuthMiddleware creates a new auth middleware
func NewAuthMiddleware(authService *services.AuthService, jwtManager *jwt.JWTManager) *AuthMiddleware {
	return &AuthMiddleware{
		authService: authService,
		jwtManager:  jwtManager,
	}
}

// RequireAuth middleware protects routes requiring authentication
func (m *AuthMiddleware) RequireAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 1. Get token from header
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error":   "missing_token",
				"message": "Token de autenticación requerido",
			})
			return
		}

		// Check Bearer format
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error":   "invalid_token_format",
				"message": "Formato de token inválido (Bearer <token>)",
			})
			return
		}
		tokenString := parts[1]

		// 2. Validate token signature and expiry (Stateless)
		claims, err := m.jwtManager.Validate(tokenString)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error":   "token_invalid",
				"message": "Token inválido o expirado",
			})
			return
		}

		// 3. Check Blacklist (Stateful - Redis)
		// This ensures that logged-out tokens cannot be reused even if they are still valid by date
		isBlacklisted, err := m.authService.IsTokenBlacklisted(c.Request.Context(), tokenString)
		if err != nil {
			// If Redis is down, we should probably fail open or closed depending on policy.
			// Ideally fail closed for security.
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"error":   "internal_error",
				"message": "Error verificando estado de sesión",
			})
			return
		}

		if isBlacklisted {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error":   "token_revoked",
				"message": "La sesión ha sido cerrada",
			})
			return
		}

		// 4. Set user info in context
		if sub, ok := claims["sub"].(string); ok {
			c.Set("userID", sub)
		}
		if role, ok := claims["role"].(string); ok {
			c.Set("role", role)
		}

		c.Next()
	}
}
