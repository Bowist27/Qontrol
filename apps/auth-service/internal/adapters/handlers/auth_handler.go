package handlers

import (
	"net/http"

	"github.com/comex/auth-service/internal/core/domain"
	"github.com/comex/auth-service/internal/core/services"
	"github.com/gin-gonic/gin"
)

// AuthHandler handles HTTP requests for authentication
type AuthHandler struct {
	authService *services.AuthService
}

// NewAuthHandler creates a new auth handler
func NewAuthHandler(authService *services.AuthService) *AuthHandler {
	return &AuthHandler{authService: authService}
}

// Login handles POST /login requests
// Implements the AuthHandler.Login(Context) from sequence diagram
func (h *AuthHandler) Login(c *gin.Context) {
	// Step 1: Parse JSON Body
	var req domain.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "invalid_request",
			Message: "Email y contraseña son requeridos",
		})
		return
	}

	// Get client IP for rate limiting
	clientIP := c.ClientIP()

	// Step 2: Call Service.Authenticate(email, password)
	response, err := h.authService.Authenticate(c.Request.Context(), req.Email, req.Password, clientIP)

	if err != nil {
		switch err {
		case services.ErrTooManyRequests:
			// HTTP 429 - Too Many Requests
			c.JSON(http.StatusTooManyRequests, domain.ErrorResponse{
				Error:   "too_many_requests",
				Message: "Demasiados intentos fallidos. Intente nuevamente en 15 minutos.",
			})
		case services.ErrInvalidCredentials:
			// HTTP 401 - Unauthorized
			c.JSON(http.StatusUnauthorized, domain.ErrorResponse{
				Error:   "invalid_credentials",
				Message: "Email o contraseña incorrectos.",
			})
		case services.ErrUserNotActive:
			// HTTP 403 - Forbidden
			c.JSON(http.StatusForbidden, domain.ErrorResponse{
				Error:   "user_inactive",
				Message: "Su cuenta está desactivada. Contacte al administrador.",
			})
		default:
			// HTTP 500 - Internal Server Error
			c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
				Error:   "internal_error",
				Message: "Error interno del servidor.",
			})
		}
		return
	}

	// HTTP 200 - Success with { token, user, role }
	c.JSON(http.StatusOK, response)
}

// Logout handles POST /logout requests
func (h *AuthHandler) Logout(c *gin.Context) {
	// For now, just acknowledge logout
	// In production, you'd extract email from JWT and invalidate session
	c.JSON(http.StatusOK, gin.H{
		"message": "Sesión cerrada exitosamente",
	})
}
