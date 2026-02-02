package repositories

import (
	"context"
	"database/sql"
	"time"

	"github.com/comex/auth-service/internal/core/domain"
	"github.com/google/uuid"
	"github.com/lib/pq"
)

// PostgresUserRepo implements UserRepository interface
type PostgresUserRepo struct {
	db *sql.DB
}

// NewPostgresUserRepo creates a new PostgreSQL user repository
func NewPostgresUserRepo(db *sql.DB) *PostgresUserRepo {
	return &PostgresUserRepo{db: db}
}

// =====================================================
// ROLE OPERATIONS
// =====================================================

// GetAllRoles retrieves all roles
func (r *PostgresUserRepo) GetAllRoles(ctx context.Context) ([]*domain.Role, error) {
	query := `
		SELECT id, name, description, permissions, is_system, created_at, updated_at
		FROM roles
		ORDER BY id
	`

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var roles []*domain.Role
	for rows.Next() {
		var role domain.Role
		var desc sql.NullString
		var perms pq.StringArray

		err := rows.Scan(&role.ID, &role.Name, &desc, &perms, &role.IsSystem, &role.CreatedAt, &role.UpdatedAt)
		if err != nil {
			return nil, err
		}

		if desc.Valid {
			role.Description = desc.String
		}
		role.Permissions = []string(perms)

		roles = append(roles, &role)
	}

	return roles, rows.Err()
}

// GetRoleByID retrieves a role by ID
func (r *PostgresUserRepo) GetRoleByID(ctx context.Context, id int) (*domain.Role, error) {
	var role domain.Role
	var desc sql.NullString
	var perms pq.StringArray

	query := `SELECT id, name, description, permissions, is_system, created_at, updated_at FROM roles WHERE id = $1`
	err := r.db.QueryRowContext(ctx, query, id).Scan(&role.ID, &role.Name, &desc, &perms, &role.IsSystem, &role.CreatedAt, &role.UpdatedAt)
	if err != nil {
		return nil, err
	}

	if desc.Valid {
		role.Description = desc.String
	}
	role.Permissions = []string(perms)

	return &role, nil
}

// CreateRole creates a new role
func (r *PostgresUserRepo) CreateRole(ctx context.Context, role *domain.Role) error {
	query := `
		INSERT INTO roles (name, description, permissions, is_system, created_at, updated_at)
		VALUES ($1, $2, $3, false, NOW(), NOW())
		RETURNING id
	`
	return r.db.QueryRowContext(ctx, query, role.Name, role.Description, pq.Array(role.Permissions)).Scan(&role.ID)
}

// UpdateRole updates an existing role
func (r *PostgresUserRepo) UpdateRole(ctx context.Context, role *domain.Role) error {
	query := `
		UPDATE roles SET name = $2, description = $3, permissions = $4, updated_at = NOW()
		WHERE id = $1 AND is_system = false
	`
	result, err := r.db.ExecContext(ctx, query, role.ID, role.Name, role.Description, pq.Array(role.Permissions))
	if err != nil {
		return err
	}
	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// DeleteRole deletes a role (only non-system roles)
func (r *PostgresUserRepo) DeleteRole(ctx context.Context, id int) error {
	result, err := r.db.ExecContext(ctx, `DELETE FROM roles WHERE id = $1 AND is_system = false`, id)
	if err != nil {
		return err
	}
	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// =====================================================
// USER OPERATIONS
// =====================================================

// GetByEmail retrieves a user by email
func (r *PostgresUserRepo) GetByEmail(ctx context.Context, email string) (*domain.User, error) {
	var user domain.User
	var bannedAt sql.NullTime
	var bannedReason sql.NullString
	var firstName, lastName sql.NullString
	var roleID sql.NullInt64

	query := `
		SELECT id, email, password_hash, first_name, last_name, role_id, is_active, 
		       banned_at, banned_reason, created_at, updated_at 
		FROM users 
		WHERE email = $1
	`

	err := r.db.QueryRowContext(ctx, query, email).Scan(
		&user.ID,
		&user.Email,
		&user.PasswordHash,
		&firstName,
		&lastName,
		&roleID,
		&user.IsActive,
		&bannedAt,
		&bannedReason,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}

	if firstName.Valid {
		user.FirstName = firstName.String
	}
	if lastName.Valid {
		user.LastName = lastName.String
	}
	if roleID.Valid {
		user.RoleID = int(roleID.Int64)
	}
	if bannedAt.Valid {
		user.BannedAt = &bannedAt.Time
	}
	if bannedReason.Valid {
		user.BannedReason = bannedReason.String
	}

	// Load role
	if user.RoleID > 0 {
		user.Role, _ = r.GetRoleByID(ctx, user.RoleID)
	}

	return &user, nil
}

// GetByID retrieves a user by ID with stores, permissions and role
func (r *PostgresUserRepo) GetByID(ctx context.Context, id string) (*domain.User, error) {
	var user domain.User
	var bannedAt sql.NullTime
	var bannedReason sql.NullString
	var firstName, lastName sql.NullString
	var roleID sql.NullInt64

	query := `
		SELECT id, email, password_hash, first_name, last_name, role_id, is_active, 
		       banned_at, banned_reason, created_at, updated_at 
		FROM users 
		WHERE id = $1
	`

	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&user.ID,
		&user.Email,
		&user.PasswordHash,
		&firstName,
		&lastName,
		&roleID,
		&user.IsActive,
		&bannedAt,
		&bannedReason,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}

	if firstName.Valid {
		user.FirstName = firstName.String
	}
	if lastName.Valid {
		user.LastName = lastName.String
	}
	if roleID.Valid {
		user.RoleID = int(roleID.Int64)
	}
	if bannedAt.Valid {
		user.BannedAt = &bannedAt.Time
	}
	if bannedReason.Valid {
		user.BannedReason = bannedReason.String
	}

	// Load role
	if user.RoleID > 0 {
		user.Role, _ = r.GetRoleByID(ctx, user.RoleID)
	}
	// Load stores
	user.Stores, _ = r.GetUserStores(ctx, id)
	// Load additional permissions (override)
	user.Permissions, _ = r.GetUserPermissions(ctx, id)

	return &user, nil
}

// GetAll retrieves all users with their stores, permissions, and roles
func (r *PostgresUserRepo) GetAll(ctx context.Context) ([]*domain.User, error) {
	query := `
		SELECT u.id, u.email, u.password_hash, u.first_name, u.last_name, u.role_id, u.is_active, 
		       u.banned_at, u.banned_reason, u.created_at, u.updated_at,
		       r.id, r.name, r.description, r.permissions, r.is_system
		FROM users u
		LEFT JOIN roles r ON u.role_id = r.id
		ORDER BY u.created_at DESC
	`

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []*domain.User
	for rows.Next() {
		var user domain.User
		var bannedAt sql.NullTime
		var bannedReason sql.NullString
		var firstName, lastName sql.NullString
		var roleID sql.NullInt64
		// Role fields
		var rID sql.NullInt64
		var rName, rDesc sql.NullString
		var rPerms pq.StringArray
		var rIsSystem sql.NullBool

		err := rows.Scan(
			&user.ID,
			&user.Email,
			&user.PasswordHash,
			&firstName,
			&lastName,
			&roleID,
			&user.IsActive,
			&bannedAt,
			&bannedReason,
			&user.CreatedAt,
			&user.UpdatedAt,
			&rID,
			&rName,
			&rDesc,
			&rPerms,
			&rIsSystem,
		)
		if err != nil {
			return nil, err
		}

		if firstName.Valid {
			user.FirstName = firstName.String
		}
		if lastName.Valid {
			user.LastName = lastName.String
		}
		if roleID.Valid {
			user.RoleID = int(roleID.Int64)
		}
		if bannedAt.Valid {
			user.BannedAt = &bannedAt.Time
		}
		if bannedReason.Valid {
			user.BannedReason = bannedReason.String
		}

		// Build role object
		if rID.Valid {
			user.Role = &domain.Role{
				ID:       int(rID.Int64),
				Name:     rName.String,
				IsSystem: rIsSystem.Bool,
			}
			if rDesc.Valid {
				user.Role.Description = rDesc.String
			}
			user.Role.Permissions = []string(rPerms)
		}

		// Load stores and additional permissions for each user
		user.Stores, _ = r.GetUserStores(ctx, user.ID)
		user.Permissions, _ = r.GetUserPermissions(ctx, user.ID)

		users = append(users, &user)
	}

	return users, rows.Err()
}

// GetAllActive retrieves all active users (for sync)
func (r *PostgresUserRepo) GetAllActive(ctx context.Context) ([]*domain.User, error) {
	query := `
		SELECT u.id, u.email, u.password_hash, u.first_name, u.last_name, u.role_id, u.is_active, u.created_at,
		       r.name, r.permissions
		FROM users u
		LEFT JOIN roles r ON u.role_id = r.id
		WHERE u.is_active = true
	`

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []*domain.User
	for rows.Next() {
		var user domain.User
		var firstName, lastName sql.NullString
		var roleID sql.NullInt64
		var roleName sql.NullString
		var rolePerms pq.StringArray

		err := rows.Scan(
			&user.ID,
			&user.Email,
			&user.PasswordHash,
			&firstName,
			&lastName,
			&roleID,
			&user.IsActive,
			&user.CreatedAt,
			&roleName,
			&rolePerms,
		)
		if err != nil {
			return nil, err
		}

		if firstName.Valid {
			user.FirstName = firstName.String
		}
		if lastName.Valid {
			user.LastName = lastName.String
		}
		if roleID.Valid {
			user.RoleID = int(roleID.Int64)
			if roleName.Valid {
				user.Role = &domain.Role{
					ID:          user.RoleID,
					Name:        roleName.String,
					Permissions: []string(rolePerms),
				}
			}
		}

		users = append(users, &user)
	}

	return users, rows.Err()
}

// Create creates a new user
func (r *PostgresUserRepo) Create(ctx context.Context, user *domain.User) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Generate UUID if not provided
	if user.ID == "" {
		user.ID = uuid.New().String()
	}

	query := `
		INSERT INTO users (id, email, password_hash, first_name, last_name, role_id, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
	`
	_, err = tx.ExecContext(ctx, query,
		user.ID, user.Email, user.PasswordHash, user.FirstName, user.LastName, user.RoleID, user.IsActive,
	)
	if err != nil {
		return err
	}

	// Insert stores
	for _, store := range user.Stores {
		_, err = tx.ExecContext(ctx, `INSERT INTO user_stores (user_id, store_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, user.ID, store.ID)
		if err != nil {
			return err
		}
	}

	// Insert additional permissions (override)
	for _, perm := range user.Permissions {
		_, err = tx.ExecContext(ctx, `INSERT INTO user_permissions (user_id, permission) VALUES ($1, $2) ON CONFLICT DO NOTHING`, user.ID, perm)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

// Update updates an existing user
func (r *PostgresUserRepo) Update(ctx context.Context, user *domain.User) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Update user - password_hash only if provided
	if user.PasswordHash != "" {
		_, err = tx.ExecContext(ctx, `
			UPDATE users SET 
				email = $2, password_hash = $3, first_name = $4, last_name = $5, 
				role_id = $6, is_active = $7, updated_at = NOW()
			WHERE id = $1`,
			user.ID, user.Email, user.PasswordHash, user.FirstName, user.LastName, user.RoleID, user.IsActive,
		)
	} else {
		_, err = tx.ExecContext(ctx, `
			UPDATE users SET 
				email = $2, first_name = $3, last_name = $4, 
				role_id = $5, is_active = $6, updated_at = NOW()
			WHERE id = $1`,
			user.ID, user.Email, user.FirstName, user.LastName, user.RoleID, user.IsActive,
		)
	}
	if err != nil {
		return err
	}

	// Replace stores
	_, err = tx.ExecContext(ctx, `DELETE FROM user_stores WHERE user_id = $1`, user.ID)
	if err != nil {
		return err
	}
	for _, store := range user.Stores {
		_, err = tx.ExecContext(ctx, `INSERT INTO user_stores (user_id, store_id) VALUES ($1, $2)`, user.ID, store.ID)
		if err != nil {
			return err
		}
	}

	// Replace additional permissions
	_, err = tx.ExecContext(ctx, `DELETE FROM user_permissions WHERE user_id = $1`, user.ID)
	if err != nil {
		return err
	}
	for _, perm := range user.Permissions {
		_, err = tx.ExecContext(ctx, `INSERT INTO user_permissions (user_id, permission) VALUES ($1, $2)`, user.ID, perm)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

// Delete deletes a user
func (r *PostgresUserRepo) Delete(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM users WHERE id = $1`, id)
	return err
}

// Ban bans a user
func (r *PostgresUserRepo) Ban(ctx context.Context, id string, reason string) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE users SET is_active = false, banned_at = NOW(), banned_reason = $2, updated_at = NOW()
		WHERE id = $1`,
		id, reason,
	)
	return err
}

// Unban unbans a user
func (r *PostgresUserRepo) Unban(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE users SET is_active = true, banned_at = NULL, banned_reason = NULL, updated_at = NOW()
		WHERE id = $1`,
		id,
	)
	return err
}

// GetUserStores retrieves stores assigned to a user
func (r *PostgresUserRepo) GetUserStores(ctx context.Context, userID string) ([]domain.Store, error) {
	query := `
		SELECT s.id, s.name, s.status
		FROM stores s
		INNER JOIN user_stores us ON s.id = us.store_id
		WHERE us.user_id = $1
		ORDER BY s.name
	`

	rows, err := r.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stores []domain.Store
	for rows.Next() {
		var store domain.Store
		if err := rows.Scan(&store.ID, &store.Name, &store.Status); err != nil {
			return nil, err
		}
		stores = append(stores, store)
	}

	return stores, rows.Err()
}

// GetUserPermissions retrieves additional permissions for a user (beyond role)
func (r *PostgresUserRepo) GetUserPermissions(ctx context.Context, userID string) ([]string, error) {
	query := `SELECT permission FROM user_permissions WHERE user_id = $1 ORDER BY permission`

	rows, err := r.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var permissions []string
	for rows.Next() {
		var perm string
		if err := rows.Scan(&perm); err != nil {
			return nil, err
		}
		permissions = append(permissions, perm)
	}

	return permissions, rows.Err()
}

// GetAllStores retrieves all stores
func (r *PostgresUserRepo) GetAllStores(ctx context.Context) ([]domain.Store, error) {
	query := `SELECT id, name, status FROM stores ORDER BY name`

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stores []domain.Store
	for rows.Next() {
		var store domain.Store
		if err := rows.Scan(&store.ID, &store.Name, &store.Status); err != nil {
			return nil, err
		}
		stores = append(stores, store)
	}

	return stores, rows.Err()
}

// Save creates or updates a user (legacy method for interface compatibility)
func (r *PostgresUserRepo) Save(ctx context.Context, user *domain.User) error {
	query := `
		INSERT INTO users (id, email, password_hash, first_name, last_name, role_id, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
		ON CONFLICT (id) DO UPDATE SET
			email = EXCLUDED.email,
			password_hash = EXCLUDED.password_hash,
			first_name = EXCLUDED.first_name,
			last_name = EXCLUDED.last_name,
			role_id = EXCLUDED.role_id,
			is_active = EXCLUDED.is_active,
			updated_at = NOW()
	`
	_, err := r.db.ExecContext(ctx, query,
		user.ID, user.Email, user.PasswordHash, user.FirstName, user.LastName, user.RoleID, user.IsActive, time.Now(),
	)
	return err
}
