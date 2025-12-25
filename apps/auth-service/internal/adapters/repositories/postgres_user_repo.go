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
