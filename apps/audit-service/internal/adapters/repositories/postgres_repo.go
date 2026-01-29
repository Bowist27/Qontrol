package repositories

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"audit-service/internal/core/domain"
)

// AuditRepository defines the interface for audit data access
type AuditRepository interface {
	FindAllStores(ctx context.Context) ([]domain.Store, error)
	InsertSession(ctx context.Context, session *domain.AuditSession) (int, error)
	UpdateSessionStatus(ctx context.Context, id int, status string) error
	UpdateSessionPDF(ctx context.Context, id int, pdfURL string, status string) error
	SaveAuditBatch(ctx context.Context, auditID int, items []domain.AuditItem, pdfURL string) error
	GetSessionByID(ctx context.Context, id int) (*domain.AuditSession, error)
	GetItemsByAuditID(ctx context.Context, auditID int) ([]domain.AuditItem, error)
}

// PostgresRepository implements AuditRepository
type PostgresRepository struct {
	db *sql.DB
}

// NewPostgresRepository creates a new repository instance
func NewPostgresRepository(db *sql.DB) *PostgresRepository {
	return &PostgresRepository{db: db}
}

// FindAllStores returns all active stores
func (r *PostgresRepository) FindAllStores(ctx context.Context) ([]domain.Store, error) {
	query := `SELECT id, name, status, created_at FROM stores WHERE status = true ORDER BY name`
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stores []domain.Store
	for rows.Next() {
		var s domain.Store
		if err := rows.Scan(&s.ID, &s.Name, &s.Status, &s.CreatedAt); err != nil {
			return nil, err
		}
		stores = append(stores, s)
	}
	return stores, nil
}

// InsertSession creates a new audit session and returns its ID
func (r *PostgresRepository) InsertSession(ctx context.Context, session *domain.AuditSession) (int, error) {
	query := `INSERT INTO audit_sessions (store_id, created_by, status) VALUES ($1, $2, $3) RETURNING id`
	var id int
	err := r.db.QueryRowContext(ctx, query, session.StoreID, session.CreatedBy, session.Status).Scan(&id)
	return id, err
}

// UpdateSessionStatus updates the session status
func (r *PostgresRepository) UpdateSessionStatus(ctx context.Context, id int, status string) error {
	query := `UPDATE audit_sessions SET status = $2 WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id, status)
	return err
}

// UpdateSessionPDF updates PDF URL and status
func (r *PostgresRepository) UpdateSessionPDF(ctx context.Context, id int, pdfURL string, status string) error {
	query := `UPDATE audit_sessions SET pdf_url = $2, status = $3 WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id, pdfURL, status)
	return err
}

// SaveAuditBatch inserts all items and updates session in a single transaction
func (r *PostgresRepository) SaveAuditBatch(ctx context.Context, auditID int, items []domain.AuditItem, pdfURL string) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Batch insert items
	if len(items) > 0 {
		valueStrings := make([]string, 0, len(items))
		valueArgs := make([]interface{}, 0, len(items)*5)
		for i, item := range items {
			valueStrings = append(valueStrings, fmt.Sprintf("($%d, $%d, $%d, $%d, $%d)",
				i*5+1, i*5+2, i*5+3, i*5+4, i*5+5))
			valueArgs = append(valueArgs, auditID, item.ProductCode, item.ProductName, item.UnitCost, item.ExpectedQty)
		}
		query := fmt.Sprintf(`INSERT INTO audit_theoretical (audit_id, product_code, product_name, unit_cost, expected_qty) VALUES %s`,
			strings.Join(valueStrings, ","))
		_, err = tx.ExecContext(ctx, query, valueArgs...)
		if err != nil {
			return err
		}
	}

	// Update session status
	_, err = tx.ExecContext(ctx, `UPDATE audit_sessions SET pdf_url = $2, status = 'REVIEW_PENDING' WHERE id = $1`, auditID, pdfURL)
	if err != nil {
		return err
	}

	return tx.Commit()
}

// GetSessionByID retrieves a session by ID
func (r *PostgresRepository) GetSessionByID(ctx context.Context, id int) (*domain.AuditSession, error) {
	query := `SELECT id, store_id, created_by, status, reference_date, pdf_url, created_at, closed_at FROM audit_sessions WHERE id = $1`
	var s domain.AuditSession
	err := r.db.QueryRowContext(ctx, query, id).Scan(&s.ID, &s.StoreID, &s.CreatedBy, &s.Status, &s.ReferenceDate, &s.PDFURL, &s.CreatedAt, &s.ClosedAt)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

// GetItemsByAuditID retrieves all items for an audit
func (r *PostgresRepository) GetItemsByAuditID(ctx context.Context, auditID int) ([]domain.AuditItem, error) {
	query := `SELECT id, audit_id, product_code, product_name, unit_cost, expected_qty FROM audit_theoretical WHERE audit_id = $1`
	rows, err := r.db.QueryContext(ctx, query, auditID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []domain.AuditItem
	for rows.Next() {
		var item domain.AuditItem
		if err := rows.Scan(&item.ID, &item.AuditID, &item.ProductCode, &item.ProductName, &item.UnitCost, &item.ExpectedQty); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, nil
}
