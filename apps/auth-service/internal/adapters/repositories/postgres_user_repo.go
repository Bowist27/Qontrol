package repositories

import (
	"context"
	"database/sql"

	"github.com/comex/auth-service/internal/core/domain"
)

// PostgresUserRepo implements UserRepository interface
type PostgresUserRepo struct {
	db *sql.DB
}

// NewPostgresUserRepo creates a new PostgreSQL user repository
func NewPostgresUserRepo(db *sql.DB) *PostgresUserRepo {
	return &PostgresUserRepo{db: db}
}

// GetByEmail retrieves a user by email
// Implements: SELECT * FROM users WHERE email = ?
func (r *PostgresUserRepo) GetByEmail(ctx context.Context, email string) (*domain.User, error) {
	var user domain.User

	query := `
		SELECT id, email, password_hash, role, is_active, created_at 
		FROM users 
		WHERE email = $1
	`

	err := r.db.QueryRowContext(ctx, query, email).Scan(
		&user.ID,
		&user.Email,
		&user.PasswordHash,
		&user.Role,
		&user.IsActive,
		&user.CreatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, err
		}
		return nil, err
	}

	return &user, nil
}

// GetAllActive retrieves all active users
// Implements: SELECT * FROM users WHERE is_active = true
func (r *PostgresUserRepo) GetAllActive(ctx context.Context) ([]*domain.User, error) {
	query := `
		SELECT id, email, password_hash, role, is_active, created_at 
		FROM users 
		WHERE is_active = true
	`

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []*domain.User
	for rows.Next() {
		var user domain.User
		err := rows.Scan(
			&user.ID,
			&user.Email,
			&user.PasswordHash,
			&user.Role,
			&user.IsActive,
			&user.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		users = append(users, &user)
	}

	if err = rows.Err(); err != nil {
		return nil, err
	}

	return users, nil
}

// Save creates or updates a user
// Required by AuthService interface
func (r *PostgresUserRepo) Save(ctx context.Context, user *domain.User) error {
	// Simple stub or implementation if needed.
	// For now, minimal implementation to satisfy interface since we are primarily doing reads for auth.
	// But if registration happens, we need this.
	// Assuming UPSERT logic for simplicity or just INSERT.
	query := `
		INSERT INTO users (id, email, password_hash, role, is_active, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (id) DO UPDATE SET
			email = EXCLUDED.email,
			password_hash = EXCLUDED.password_hash,
			role = EXCLUDED.role,
			is_active = EXCLUDED.is_active
	`
	_, err := r.db.ExecContext(ctx, query,
		user.ID, user.Email, user.PasswordHash, user.Role, user.IsActive, user.CreatedAt,
	)
	return err
}
