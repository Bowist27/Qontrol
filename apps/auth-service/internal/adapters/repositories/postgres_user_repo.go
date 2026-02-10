package repositories

import (
	"context"
	"database/sql"
	"fmt"
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

// GetAllStores retrieves all stores with zone information
func (r *PostgresUserRepo) GetAllStores(ctx context.Context) ([]domain.Store, error) {
	query := `
		SELECT s.id, s.name, s.status, s.zone_id, COALESCE(z.name, '') as zone_name
		FROM stores s
		LEFT JOIN zones z ON s.zone_id = z.id
		ORDER BY s.name
	`

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stores []domain.Store
	for rows.Next() {
		var store domain.Store
		if err := rows.Scan(&store.ID, &store.Name, &store.Status, &store.ZoneID, &store.ZoneName); err != nil {
			return nil, err
		}
		stores = append(stores, store)
	}

	return stores, rows.Err()
}

// GetStoreByID retrieves a store by ID
func (r *PostgresUserRepo) GetStoreByID(ctx context.Context, id int) (*domain.Store, error) {
	query := `
		SELECT s.id, s.name, s.status, s.zone_id, COALESCE(z.name, '') as zone_name
		FROM stores s
		LEFT JOIN zones z ON s.zone_id = z.id
		WHERE s.id = $1
	`
	
	var store domain.Store
	err := r.db.QueryRowContext(ctx, query, id).Scan(&store.ID, &store.Name, &store.Status, &store.ZoneID, &store.ZoneName)
	if err != nil {
		return nil, err
	}
	return &store, nil
}

// CreateStore creates a new store
func (r *PostgresUserRepo) CreateStore(ctx context.Context, name string, zoneID *int) (*domain.Store, error) {
	query := `INSERT INTO stores (name, status, zone_id) VALUES ($1, true, $2) RETURNING id, name, status, zone_id`
	
	var store domain.Store
	err := r.db.QueryRowContext(ctx, query, name, zoneID).Scan(&store.ID, &store.Name, &store.Status, &store.ZoneID)
	if err != nil {
		return nil, err
	}
	return &store, nil
}

// UpdateStore updates an existing store
func (r *PostgresUserRepo) UpdateStore(ctx context.Context, id int, name string, status bool, zoneID *int) (*domain.Store, error) {
	query := `UPDATE stores SET name = $1, status = $2, zone_id = $3 WHERE id = $4 RETURNING id, name, status, zone_id`
	
	var store domain.Store
	err := r.db.QueryRowContext(ctx, query, name, status, zoneID, id).Scan(&store.ID, &store.Name, &store.Status, &store.ZoneID)
	if err != nil {
		return nil, err
	}
	return &store, nil
}

// DeleteStore deletes a store by ID
func (r *PostgresUserRepo) DeleteStore(ctx context.Context, id int) error {
	// First check if the store is assigned to any user
	var count int
	err := r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM user_stores WHERE store_id = $1`, id).Scan(&count)
	if err != nil {
		return err
	}
	if count > 0 {
		return fmt.Errorf("store is assigned to %d user(s)", count)
	}
	
	// Check if store is used in any audit
	err = r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM audit_sessions WHERE store_id = $1`, id).Scan(&count)
	if err != nil {
		return err
	}
	if count > 0 {
		return fmt.Errorf("store is used in %d audit(s)", count)
	}
	
	_, err = r.db.ExecContext(ctx, `DELETE FROM stores WHERE id = $1`, id)
	return err
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

// =====================================================
// ZONES AND PRICE LISTS
// =====================================================

// GetAllPriceLists retrieves all price lists
func (r *PostgresUserRepo) GetAllPriceLists(ctx context.Context) ([]domain.PriceList, error) {
	query := `SELECT id, name, adjustment_percent, COALESCE(description, '') FROM price_lists ORDER BY name`

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var priceLists []domain.PriceList
	for rows.Next() {
		var pl domain.PriceList
		if err := rows.Scan(&pl.ID, &pl.Name, &pl.AdjustmentPercent, &pl.Description); err != nil {
			return nil, err
		}
		priceLists = append(priceLists, pl)
	}

	return priceLists, rows.Err()
}

// GetAllZones retrieves all zones with supervisors and price list info
func (r *PostgresUserRepo) GetAllZones(ctx context.Context) ([]domain.Zone, error) {
	query := `
		SELECT 
			z.id, z.name,
			z.price_list_id,
			COALESCE(pl.name, '') as price_list_name,
			z.status,
			(SELECT COUNT(*) FROM stores s WHERE s.zone_id = z.id) as store_count
		FROM zones z
		LEFT JOIN price_lists pl ON z.price_list_id = pl.id
		ORDER BY z.name
	`

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var zones []domain.Zone
	for rows.Next() {
		var zone domain.Zone
		if err := rows.Scan(&zone.ID, &zone.Name, &zone.PriceListID, &zone.PriceListName, &zone.Status, &zone.StoreCount); err != nil {
			return nil, err
		}
		zone.Supervisors = []domain.ZoneSupervisor{}
		zones = append(zones, zone)
	}
	
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Load supervisors for each zone
	for i := range zones {
		supervisors, err := r.getZoneSupervisors(ctx, zones[i].ID)
		if err != nil {
			return nil, err
		}
		zones[i].Supervisors = supervisors
	}

	return zones, nil
}

// getZoneSupervisors retrieves all supervisors for a zone
func (r *PostgresUserRepo) getZoneSupervisors(ctx context.Context, zoneID int) ([]domain.ZoneSupervisor, error) {
	query := `
		SELECT zs.user_id, u.first_name || ' ' || u.last_name as full_name
		FROM zone_supervisors zs
		JOIN users u ON zs.user_id = u.id
		WHERE zs.zone_id = $1
		ORDER BY u.first_name, u.last_name
	`
	
	rows, err := r.db.QueryContext(ctx, query, zoneID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	var supervisors []domain.ZoneSupervisor
	for rows.Next() {
		var s domain.ZoneSupervisor
		if err := rows.Scan(&s.UserID, &s.FullName); err != nil {
			return nil, err
		}
		supervisors = append(supervisors, s)
	}
	
	if supervisors == nil {
		supervisors = []domain.ZoneSupervisor{}
	}
	
	return supervisors, rows.Err()
}

// GetZoneByID retrieves a zone by ID
func (r *PostgresUserRepo) GetZoneByID(ctx context.Context, id int) (*domain.Zone, error) {
	query := `
		SELECT 
			z.id, z.name,
			z.price_list_id,
			COALESCE(pl.name, '') as price_list_name,
			z.status,
			(SELECT COUNT(*) FROM stores s WHERE s.zone_id = z.id) as store_count
		FROM zones z
		LEFT JOIN price_lists pl ON z.price_list_id = pl.id
		WHERE z.id = $1
	`
	
	var zone domain.Zone
	err := r.db.QueryRowContext(ctx, query, id).Scan(&zone.ID, &zone.Name, &zone.PriceListID, &zone.PriceListName, &zone.Status, &zone.StoreCount)
	if err != nil {
		return nil, err
	}
	
	// Load supervisors
	supervisors, err := r.getZoneSupervisors(ctx, id)
	if err != nil {
		return nil, err
	}
	zone.Supervisors = supervisors
	
	return &zone, nil
}

// CreateZone creates a new zone with multiple supervisors
func (r *PostgresUserRepo) CreateZone(ctx context.Context, name string, supervisorIDs []string, priceListID *int) (*domain.Zone, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	
	// Create zone
	var zone domain.Zone
	err = tx.QueryRowContext(ctx, `INSERT INTO zones (name, price_list_id, status) VALUES ($1, $2, true) RETURNING id, name, status`, name, priceListID).Scan(&zone.ID, &zone.Name, &zone.Status)
	if err != nil {
		return nil, err
	}
	zone.PriceListID = priceListID
	
	// Add supervisors
	for _, supervisorID := range supervisorIDs {
		_, err = tx.ExecContext(ctx, `INSERT INTO zone_supervisors (zone_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, zone.ID, supervisorID)
		if err != nil {
			return nil, err
		}
	}
	
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	
	// Load supervisors for response
	zone.Supervisors, _ = r.getZoneSupervisors(ctx, zone.ID)
	if zone.Supervisors == nil {
		zone.Supervisors = []domain.ZoneSupervisor{}
	}
	
	return &zone, nil
}

// UpdateZone updates an existing zone with multiple supervisors
func (r *PostgresUserRepo) UpdateZone(ctx context.Context, id int, name string, supervisorIDs []string, priceListID *int, status bool) (*domain.Zone, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	
	// Update zone
	var zone domain.Zone
	err = tx.QueryRowContext(ctx, `UPDATE zones SET name = $1, price_list_id = $2, status = $3 WHERE id = $4 RETURNING id, name, status`, name, priceListID, status, id).Scan(&zone.ID, &zone.Name, &zone.Status)
	if err != nil {
		return nil, err
	}
	zone.PriceListID = priceListID
	
	// Remove existing supervisors
	_, err = tx.ExecContext(ctx, `DELETE FROM zone_supervisors WHERE zone_id = $1`, id)
	if err != nil {
		return nil, err
	}
	
	// Add new supervisors
	for _, supervisorID := range supervisorIDs {
		_, err = tx.ExecContext(ctx, `INSERT INTO zone_supervisors (zone_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, id, supervisorID)
		if err != nil {
			return nil, err
		}
	}
	
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	
	// Load supervisors for response
	zone.Supervisors, _ = r.getZoneSupervisors(ctx, id)
	if zone.Supervisors == nil {
		zone.Supervisors = []domain.ZoneSupervisor{}
	}
	
	return &zone, nil
}

// DeleteZone deletes a zone by ID
func (r *PostgresUserRepo) DeleteZone(ctx context.Context, id int) error {
	// Check if zone has stores assigned
	var count int
	err := r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM stores WHERE zone_id = $1`, id).Scan(&count)
	if err != nil {
		return err
	}
	if count > 0 {
		return fmt.Errorf("zone has %d store(s) assigned", count)
	}
	
	_, err = r.db.ExecContext(ctx, `DELETE FROM zones WHERE id = $1`, id)
	return err
}