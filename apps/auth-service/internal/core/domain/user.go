package domain

import "time"

// Role represents a customizable role with permissions
type Role struct {
	ID          int       `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Permissions []string  `json:"permissions"`
	IsSystem    bool      `json:"is_system"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// CreateRoleRequest represents the request to create a new role
type CreateRoleRequest struct {
	Name        string   `json:"name" binding:"required"`
	Description string   `json:"description"`
	Permissions []string `json:"permissions"`
}

// UpdateRoleRequest represents the request to update a role
type UpdateRoleRequest struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Permissions []string `json:"permissions"`
}

// User represents a user entity in the system
type User struct {
	ID           string     `json:"id"`
	Email        string     `json:"email"`
	PasswordHash string     `json:"-"` // Never expose in JSON
	FirstName    string     `json:"first_name"`
	LastName     string     `json:"last_name"`
	RoleID       int        `json:"role_id"`
	Role         *Role      `json:"role,omitempty"`
	IsActive     bool       `json:"is_active"`
	BannedAt     *time.Time `json:"banned_at,omitempty"`
	BannedReason string     `json:"banned_reason,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
	// Relationships
	Stores      []Store  `json:"stores,omitempty"`
	Permissions []string `json:"permissions,omitempty"` // Override permissions (additional to role)
}

// Store represents a store entity (sucursal)
type Store struct {
	ID       int    `json:"id"`
	Name     string `json:"name"`
	Status   bool   `json:"status"`
	ZoneID   *int   `json:"zone_id,omitempty"`
	ZoneName string `json:"zone_name,omitempty"`
}

// PriceList represents a pricing strategy
type PriceList struct {
	ID                int     `json:"id"`
	Name              string  `json:"name"`
	AdjustmentPercent float64 `json:"adjustment_percent"`
	Description       string  `json:"description"`
}

// ZoneSupervisor represents a supervisor assigned to a zone
type ZoneSupervisor struct {
	UserID   string `json:"user_id"`
	FullName string `json:"full_name"`
}

// Zone represents a geographical zone (like a role for stores)
type Zone struct {
	ID            int              `json:"id"`
	Name          string           `json:"name"`
	Supervisors   []ZoneSupervisor `json:"supervisors"`
	PriceListID   *int             `json:"price_list_id,omitempty"`
	PriceListName string           `json:"price_list_name,omitempty"`
	Status        bool             `json:"status"`
	StoreCount    int              `json:"store_count,omitempty"`
}

// UserSyncDTO is used for offline synchronization
// It exposes the PasswordHash so the local app can verify credentials offline.
type UserSyncDTO struct {
	ID           string   `json:"id"`
	Email        string   `json:"email"`
	PasswordHash string   `json:"password_hash"`
	FirstName    string   `json:"first_name"`
	LastName     string   `json:"last_name"`
	RoleID       int      `json:"role_id"`
	RoleName     string   `json:"role_name"`
	IsActive     bool     `json:"is_active"`
	StoreIDs     []int    `json:"store_ids"`
	Permissions  []string `json:"permissions"` // Combined: role permissions + user overrides
}

// CreateUserRequest represents the request to create a new user
// Password is no longer required - the system assigns Test123! and sends a reset email
type CreateUserRequest struct {
	Email       string   `json:"email" binding:"required,email"`
	Password    string   `json:"password"`               // Optional - defaults to Test123!
	FirstName   string   `json:"first_name" binding:"required"`
	LastName    string   `json:"last_name" binding:"required"`
	RoleID      int      `json:"role_id" binding:"required"`
	StoreIDs    []int    `json:"store_ids"`
	Permissions []string `json:"permissions"` // Additional permissions beyond role
}

// UpdateUserRequest represents the request to update a user
type UpdateUserRequest struct {
	Email       string   `json:"email"`
	Password    string   `json:"password"` // Optional - only update if provided
	FirstName   string   `json:"first_name"`
	LastName    string   `json:"last_name"`
	RoleID      int      `json:"role_id"`
	IsActive    *bool    `json:"is_active"`
	StoreIDs    []int    `json:"store_ids"`
	Permissions []string `json:"permissions"`
}

// BanUserRequest represents the request to ban a user
type BanUserRequest struct {
	Reason string `json:"reason" binding:"required"`
}

// LoginRequest represents the login request payload
type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
}

// LoginResponse represents the successful login response
type LoginResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

// ErrorResponse represents an error response
type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}

// CreateStoreRequest represents the request to create a store
type CreateStoreRequest struct {
	Name   string `json:"name" binding:"required"`
	ZoneID *int   `json:"zone_id"`
}

// UpdateStoreRequest represents the request to update a store
type UpdateStoreRequest struct {
	Name   string `json:"name" binding:"required"`
	Status bool   `json:"status"`
	ZoneID *int   `json:"zone_id"`
}

// CreateZoneRequest represents the request to create a zone
type CreateZoneRequest struct {
	Name          string   `json:"name" binding:"required"`
	SupervisorIDs []string `json:"supervisor_ids"`
	PriceListID   *int     `json:"price_list_id"`
}

// UpdateZoneRequest represents the request to update a zone
type UpdateZoneRequest struct {
	Name          string   `json:"name" binding:"required"`
	SupervisorIDs []string `json:"supervisor_ids"`
	PriceListID   *int     `json:"price_list_id"`
	Status        bool     `json:"status"`
}

// ResetPasswordRequest represents the request to reset a password via token
type ResetPasswordRequest struct {
	Token       string `json:"token" binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min=6"`
}

// ValidateTokenRequest represents the request to validate a reset token
type ValidateTokenResponse struct {
	Valid     bool   `json:"valid"`
	Email     string `json:"email,omitempty"`
	FirstName string `json:"first_name,omitempty"`
}
