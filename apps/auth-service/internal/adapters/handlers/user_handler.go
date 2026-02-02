package handlers

import (
	"fmt"
	"log"
	"net/http"

	"github.com/comex/auth-service/internal/adapters/repositories"
	"github.com/comex/auth-service/internal/core/domain"
	"github.com/comex/auth-service/internal/infrastructure/crypto"
	"github.com/gin-gonic/gin"
)

// UserHandler handles HTTP requests for user management
type UserHandler struct {
	repo *repositories.PostgresUserRepo
}

// NewUserHandler creates a new user handler
func NewUserHandler(repo *repositories.PostgresUserRepo) *UserHandler {
	return &UserHandler{repo: repo}
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

	// Hash the password
	hashedPassword, err := crypto.HashPassword(req.Password)
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

	// Build user object
	user := &domain.User{
		ID:          id,
		Email:       req.Email,
		FirstName:   req.FirstName,
		LastName:    req.LastName,
		RoleID:      req.RoleID,
		IsActive:    req.IsActive,
		Permissions: req.Permissions,
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
