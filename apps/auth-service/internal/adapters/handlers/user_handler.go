package handlers

import (
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/comex/auth-service/internal/adapters/repositories"
	"github.com/comex/auth-service/internal/core/domain"
	"github.com/comex/auth-service/internal/infrastructure/crypto"
	"github.com/comex/auth-service/internal/infrastructure/email"
	"github.com/gin-gonic/gin"
)

// UserHandler handles HTTP requests for user management
type UserHandler struct {
	repo         *repositories.PostgresUserRepo
	emailService *email.EmailService
}

// NewUserHandler creates a new user handler
func NewUserHandler(repo *repositories.PostgresUserRepo, emailService *email.EmailService) *UserHandler {
	return &UserHandler{repo: repo, emailService: emailService}
}

// ListUsers handles GET /users
func (h *UserHandler) ListUsers(c *gin.Context) {
	users, err := h.repo.GetAll(c.Request.Context())
	if err != nil {
		log.Printf("Error fetching users: %v", err)
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "internal_error",
			Message: "Error al obtener usuarios",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"users": users})
}

// GetUser handles GET /users/:id
func (h *UserHandler) GetUser(c *gin.Context) {
	id := c.Param("id")

	user, err := h.repo.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, domain.ErrorResponse{
			Error:   "not_found",
			Message: "Usuario no encontrado",
		})
		return
	}

	c.JSON(http.StatusOK, user)
}

// CreateUser handles POST /users
func (h *UserHandler) CreateUser(c *gin.Context) {
	var req domain.CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "invalid_request",
			Message: "Datos inválidos: " + err.Error(),
		})
		return
	}

	// Always use default password Test123!
	defaultPassword := "Test123!"
	if req.Password != "" {
		defaultPassword = req.Password
	}

	// Hash the password
	hashedPassword, err := crypto.HashPassword(defaultPassword)
	if err != nil {
		log.Printf("Error hashing password: %v", err)
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "internal_error",
			Message: "Error al crear usuario",
		})
		return
	}

	// Build user object
	user := &domain.User{
		Email:        req.Email,
		PasswordHash: hashedPassword,
		FirstName:    req.FirstName,
		LastName:     req.LastName,
		RoleID:       req.RoleID,
		IsActive:     true,
		Permissions:  req.Permissions,
	}

	// Convert store IDs to Store objects
	for _, storeID := range req.StoreIDs {
		user.Stores = append(user.Stores, domain.Store{ID: storeID})
	}

	// Create user
	if err := h.repo.Create(c.Request.Context(), user); err != nil {
		log.Printf("Error creating user: %v", err)
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "internal_error",
			Message: "Error al crear usuario. Es posible que el email ya exista.",
		})
		return
	}

	// Generate password reset token and send welcome email
	resetToken, err := crypto.GenerateSecureToken(32)
	if err != nil {
		log.Printf("Error generating reset token: %v", err)
		// User was created but token failed — not fatal
	} else {
		// Store reset token in database
		if err := h.repo.SetPasswordResetToken(c.Request.Context(), user.ID, resetToken, true); err != nil {
			log.Printf("Error storing reset token: %v", err)
		} else {
			// Send welcome email (async-safe, won't block)
			go func() {
				if err := h.emailService.SendWelcomeEmail(req.Email, req.FirstName, resetToken); err != nil {
					log.Printf("Error sending welcome email to %s: %v", req.Email, err)
				}
			}()
		}
	}

	// Fetch the created user with full data
	createdUser, _ := h.repo.GetByID(c.Request.Context(), user.ID)

	c.JSON(http.StatusCreated, createdUser)
}

// UpdateUser handles PUT /users/:id
func (h *UserHandler) UpdateUser(c *gin.Context) {
	id := c.Param("id")

	var req domain.UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "invalid_request",
			Message: "Datos inválidos: " + err.Error(),
		})
		return
	}

	// Fetch existing user to merge partial updates
	existingUser, err := h.repo.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, domain.ErrorResponse{
			Error:   "not_found",
			Message: "Usuario no encontrado",
		})
		return
	}

	// Merge: only overwrite fields that are provided (non-zero)
	user := &domain.User{
		ID:       id,
		Email:    existingUser.Email,
		FirstName: existingUser.FirstName,
		LastName:  existingUser.LastName,
		RoleID:   existingUser.RoleID,
		IsActive: existingUser.IsActive,
	}
	if req.Email != "" {
		user.Email = req.Email
	}
	if req.FirstName != "" {
		user.FirstName = req.FirstName
	}
	if req.LastName != "" {
		user.LastName = req.LastName
	}
	if req.RoleID != 0 {
		user.RoleID = req.RoleID
	}
	if req.IsActive != nil {
		user.IsActive = *req.IsActive
	}
	if req.Permissions != nil {
		user.Permissions = req.Permissions
	}

	// Hash password if provided
	if req.Password != "" {
		hashedPassword, err := crypto.HashPassword(req.Password)
		if err != nil {
			log.Printf("Error hashing password: %v", err)
			c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
				Error:   "internal_error",
				Message: "Error al actualizar usuario",
			})
			return
		}
		user.PasswordHash = hashedPassword
	}

	// Convert store IDs to Store objects
	for _, storeID := range req.StoreIDs {
		user.Stores = append(user.Stores, domain.Store{ID: storeID})
	}

	// Update user
	if err := h.repo.Update(c.Request.Context(), user); err != nil {
		log.Printf("Error updating user: %v", err)
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "internal_error",
			Message: "Error al actualizar usuario",
		})
		return
	}

	// Fetch the updated user with full data
	updatedUser, _ := h.repo.GetByID(c.Request.Context(), id)

	c.JSON(http.StatusOK, updatedUser)
}

// DeleteUser handles DELETE /users/:id
func (h *UserHandler) DeleteUser(c *gin.Context) {
	id := c.Param("id")

	if err := h.repo.Delete(c.Request.Context(), id); err != nil {
		log.Printf("Error deleting user: %v", err)
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "internal_error",
			Message: "Error al eliminar usuario",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Usuario eliminado exitosamente"})
}

// BanUser handles POST /users/:id/ban
func (h *UserHandler) BanUser(c *gin.Context) {
	id := c.Param("id")

	var req domain.BanUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "invalid_request",
			Message: "Debe proporcionar una razón para el baneo",
		})
		return
	}

	if err := h.repo.Ban(c.Request.Context(), id, req.Reason); err != nil {
		log.Printf("Error banning user: %v", err)
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "internal_error",
			Message: "Error al banear usuario",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Usuario baneado exitosamente"})
}

// UnbanUser handles POST /users/:id/unban
func (h *UserHandler) UnbanUser(c *gin.Context) {
	id := c.Param("id")

	if err := h.repo.Unban(c.Request.Context(), id); err != nil {
		log.Printf("Error unbanning user: %v", err)
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "internal_error",
			Message: "Error al desbanear usuario",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Usuario desbaneado exitosamente"})
}

// ListStores handles GET /stores
func (h *UserHandler) ListStores(c *gin.Context) {
	stores, err := h.repo.GetAllStores(c.Request.Context())
	if err != nil {
		log.Printf("Error fetching stores: %v", err)
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "internal_error",
			Message: "Error al obtener tiendas",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"stores": stores})
}

// GetStore handles GET /stores/:id
func (h *UserHandler) GetStore(c *gin.Context) {
	idStr := c.Param("id")
	var id int
	if _, err := fmt.Sscanf(idStr, "%d", &id); err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "invalid_request",
			Message: "ID de tienda inválido",
		})
		return
	}

	store, err := h.repo.GetStoreByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, domain.ErrorResponse{
			Error:   "not_found",
			Message: "Tienda no encontrada",
		})
		return
	}

	c.JSON(http.StatusOK, store)
}

// CreateStore handles POST /stores
func (h *UserHandler) CreateStore(c *gin.Context) {
	var req domain.CreateStoreRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "invalid_request",
			Message: "Nombre de tienda es requerido",
		})
		return
	}

	store, err := h.repo.CreateStore(c.Request.Context(), req.Name, req.ZoneID)
	if err != nil {
		log.Printf("Error creating store: %v", err)
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "internal_error",
			Message: "Error al crear tienda",
		})
		return
	}

	c.JSON(http.StatusCreated, store)
}

// UpdateStore handles PUT /stores/:id
func (h *UserHandler) UpdateStore(c *gin.Context) {
	idStr := c.Param("id")
	var id int
	if _, err := fmt.Sscanf(idStr, "%d", &id); err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "invalid_request",
			Message: "ID de tienda inválido",
		})
		return
	}

	var req domain.UpdateStoreRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "invalid_request",
			Message: "Datos de tienda inválidos",
		})
		return
	}

	store, err := h.repo.UpdateStore(c.Request.Context(), id, req.Name, req.Status, req.ZoneID)
	if err != nil {
		log.Printf("Error updating store: %v", err)
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "internal_error",
			Message: "Error al actualizar tienda",
		})
		return
	}

	c.JSON(http.StatusOK, store)
}

// DeleteStore handles DELETE /stores/:id
func (h *UserHandler) DeleteStore(c *gin.Context) {
	idStr := c.Param("id")
	var id int
	if _, err := fmt.Sscanf(idStr, "%d", &id); err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "invalid_request",
			Message: "ID de tienda inválido",
		})
		return
	}

	if err := h.repo.DeleteStore(c.Request.Context(), id); err != nil {
		log.Printf("Error deleting store: %v", err)
		// Check if store is in use (has audits)
		if strings.Contains(err.Error(), "audit") {
			c.JSON(http.StatusConflict, domain.ErrorResponse{
				Error:   "store_in_use",
				Message: "No se puede eliminar la tienda porque tiene auditorías asociadas",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "internal_error",
			Message: "Error al eliminar tienda",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Tienda eliminada exitosamente"})
}

// =====================================================
// ROLE HANDLERS
// =====================================================

// ListRoles handles GET /roles
func (h *UserHandler) ListRoles(c *gin.Context) {
	roles, err := h.repo.GetAllRoles(c.Request.Context())
	if err != nil {
		log.Printf("Error fetching roles: %v", err)
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "internal_error",
			Message: "Error al obtener roles",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"roles": roles})
}

// GetRole handles GET /roles/:id
func (h *UserHandler) GetRole(c *gin.Context) {
	idStr := c.Param("id")
	var id int
	if _, err := fmt.Sscanf(idStr, "%d", &id); err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "invalid_request",
			Message: "ID de rol inválido",
		})
		return
	}

	role, err := h.repo.GetRoleByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, domain.ErrorResponse{
			Error:   "not_found",
			Message: "Rol no encontrado",
		})
		return
	}

	c.JSON(http.StatusOK, role)
}

// CreateRole handles POST /roles
func (h *UserHandler) CreateRole(c *gin.Context) {
	var req domain.CreateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "invalid_request",
			Message: "Datos inválidos: " + err.Error(),
		})
		return
	}

	role := &domain.Role{
		Name:        req.Name,
		Description: req.Description,
		Permissions: req.Permissions,
	}

	if err := h.repo.CreateRole(c.Request.Context(), role); err != nil {
		log.Printf("Error creating role: %v", err)
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "internal_error",
			Message: "Error al crear rol. Es posible que el nombre ya exista.",
		})
		return
	}

	c.JSON(http.StatusCreated, role)
}

// UpdateRole handles PUT /roles/:id
func (h *UserHandler) UpdateRole(c *gin.Context) {
	idStr := c.Param("id")
	var id int
	if _, err := fmt.Sscanf(idStr, "%d", &id); err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "invalid_request",
			Message: "ID de rol inválido",
		})
		return
	}

	var req domain.UpdateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "invalid_request",
			Message: "Datos inválidos: " + err.Error(),
		})
		return
	}

	role := &domain.Role{
		ID:          id,
		Name:        req.Name,
		Description: req.Description,
		Permissions: req.Permissions,
	}

	if err := h.repo.UpdateRole(c.Request.Context(), role); err != nil {
		log.Printf("Error updating role: %v", err)
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "internal_error",
			Message: "Error al actualizar rol. Los roles del sistema no pueden ser modificados.",
		})
		return
	}

	// Fetch updated role
	updatedRole, _ := h.repo.GetRoleByID(c.Request.Context(), id)
	c.JSON(http.StatusOK, updatedRole)
}

// DeleteRole handles DELETE /roles/:id
func (h *UserHandler) DeleteRole(c *gin.Context) {
	idStr := c.Param("id")
	var id int
	if _, err := fmt.Sscanf(idStr, "%d", &id); err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "invalid_request",
			Message: "ID de rol inválido",
		})
		return
	}

	if err := h.repo.DeleteRole(c.Request.Context(), id); err != nil {
		log.Printf("Error deleting role: %v", err)
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "internal_error",
			Message: "Error al eliminar rol. Los roles del sistema no pueden ser eliminados.",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Rol eliminado exitosamente"})
}

// =====================================================
// ZONES & PRICE LISTS HANDLERS
// =====================================================

// ListPriceLists handles GET /price-lists
func (h *UserHandler) ListPriceLists(c *gin.Context) {
	priceLists, err := h.repo.GetAllPriceLists(c.Request.Context())
	if err != nil {
		log.Printf("Error listing price lists: %v", err)
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "internal_error",
			Message: "Error al obtener listas de precios",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"price_lists": priceLists})
}

// ListZones handles GET /zones
func (h *UserHandler) ListZones(c *gin.Context) {
	zones, err := h.repo.GetAllZones(c.Request.Context())
	if err != nil {
		log.Printf("Error listing zones: %v", err)
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "internal_error",
			Message: "Error al obtener zonas",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"zones": zones})
}

// GetZone handles GET /zones/:id
func (h *UserHandler) GetZone(c *gin.Context) {
	idStr := c.Param("id")
	var id int
	if _, err := fmt.Sscanf(idStr, "%d", &id); err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "invalid_request",
			Message: "ID de zona inválido",
		})
		return
	}

	zone, err := h.repo.GetZoneByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, domain.ErrorResponse{
			Error:   "not_found",
			Message: "Zona no encontrada",
		})
		return
	}

	c.JSON(http.StatusOK, zone)
}

// CreateZone handles POST /zones
func (h *UserHandler) CreateZone(c *gin.Context) {
	var req domain.CreateZoneRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "invalid_request",
			Message: "Nombre de zona es requerido",
		})
		return
	}

	zone, err := h.repo.CreateZone(c.Request.Context(), req.Name, req.SupervisorIDs, req.PriceListID)
	if err != nil {
		log.Printf("Error creating zone: %v", err)
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "internal_error",
			Message: "Error al crear zona",
		})
		return
	}

	c.JSON(http.StatusCreated, zone)
}

// UpdateZone handles PUT /zones/:id
func (h *UserHandler) UpdateZone(c *gin.Context) {
	idStr := c.Param("id")
	var id int
	if _, err := fmt.Sscanf(idStr, "%d", &id); err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "invalid_request",
			Message: "ID de zona inválido",
		})
		return
	}

	var req domain.UpdateZoneRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "invalid_request",
			Message: "Datos de zona inválidos",
		})
		return
	}

	zone, err := h.repo.UpdateZone(c.Request.Context(), id, req.Name, req.SupervisorIDs, req.PriceListID, req.Status)
	if err != nil {
		log.Printf("Error updating zone: %v", err)
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "internal_error",
			Message: "Error al actualizar zona",
		})
		return
	}

	c.JSON(http.StatusOK, zone)
}

// DeleteZone handles DELETE /zones/:id
func (h *UserHandler) DeleteZone(c *gin.Context) {
	idStr := c.Param("id")
	var id int
	if _, err := fmt.Sscanf(idStr, "%d", &id); err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "invalid_request",
			Message: "ID de zona inválido",
		})
		return
	}

	if err := h.repo.DeleteZone(c.Request.Context(), id); err != nil {
		log.Printf("Error deleting zone: %v", err)
		// Check if zone has stores
		if err.Error() != "" && len(err.Error()) > 4 && err.Error()[:4] == "zone" {
			c.JSON(http.StatusConflict, domain.ErrorResponse{
				Error:   "zone_in_use",
				Message: "No se puede eliminar la zona porque tiene sucursales asignadas",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "internal_error",
			Message: "Error al eliminar zona",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Zona eliminada exitosamente"})
}

// =====================================================
// PASSWORD RESET (Public routes)
// =====================================================

// ValidateResetToken handles GET /reset-password/validate?token=xxx
func (h *UserHandler) ValidateResetToken(c *gin.Context) {
	token := c.Query("token")
	if token == "" {
		c.JSON(http.StatusBadRequest, domain.ValidateTokenResponse{Valid: false})
		return
	}

	user, err := h.repo.GetUserByResetToken(c.Request.Context(), token)
	if err != nil {
		c.JSON(http.StatusOK, domain.ValidateTokenResponse{Valid: false})
		return
	}

	c.JSON(http.StatusOK, domain.ValidateTokenResponse{
		Valid:     true,
		Email:     user.Email,
		FirstName: user.FirstName,
	})
}

// ResetPassword handles POST /reset-password
func (h *UserHandler) ResetPassword(c *gin.Context) {
	var req domain.ResetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "invalid_request",
			Message: "Token y nueva contraseña son requeridos (mínimo 6 caracteres)",
		})
		return
	}

	// Validate token and get user
	user, err := h.repo.GetUserByResetToken(c.Request.Context(), req.Token)
	if err != nil {
		c.JSON(http.StatusUnauthorized, domain.ErrorResponse{
			Error:   "invalid_token",
			Message: "El enlace ha expirado o es inválido. Contacta al administrador.",
		})
		return
	}

	// Hash new password
	hashedPassword, err := crypto.HashPassword(req.NewPassword)
	if err != nil {
		log.Printf("Error hashing new password: %v", err)
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "internal_error",
			Message: "Error al actualizar contraseña",
		})
		return
	}

	// Update password and clear token
	if err := h.repo.ResetPassword(c.Request.Context(), user.ID, hashedPassword); err != nil {
		log.Printf("Error resetting password for user %s: %v", user.ID, err)
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "internal_error",
			Message: "Error al actualizar contraseña",
		})
		return
	}

	log.Printf("✅ Password reset successful for user %s (%s)", user.Email, user.ID)
	c.JSON(http.StatusOK, gin.H{
		"message": "Contraseña actualizada exitosamente. Ya puedes iniciar sesión.",
	})
}