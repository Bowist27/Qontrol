package repositories

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"audit-service/internal/core/domain"
)

// AuditRepository defines the interface for audit data access
type AuditRepository interface {
	FindAllStores(ctx context.Context) ([]domain.Store, error)
	InsertSession(ctx context.Context, session *domain.AuditSession) (int, error)
	DeleteSession(ctx context.Context, id int) error
	UpdateSessionStatus(ctx context.Context, id int, status string) error
	UpdateSessionPDF(ctx context.Context, id int, pdfURL string, status string) error
	SaveAuditBatch(ctx context.Context, auditID int, items []domain.AuditItem, pdfURL string) error
	SaveAuditBatchWithStatus(ctx context.Context, auditID int, items []domain.AuditItem, pdfURL string, status string) error
	GetSessionByID(ctx context.Context, id int) (*domain.AuditSession, error)
	GetItemsByAuditID(ctx context.Context, auditID int) ([]domain.AuditItem, error)
	FindAllSessions(ctx context.Context) ([]domain.AuditListDTO, error)
	// Physical Scan methods for POS
	InsertPhysicalScan(ctx context.Context, req *domain.AddScanRequest) (*domain.PhysicalScan, error)
	GetPhysicalScans(ctx context.Context, auditID int) ([]domain.PhysicalScan, error)
	GetPhysicalScanSummary(ctx context.Context, auditID int) (*domain.AuditPhysicalSummary, error)
	DeleteLastPhysicalScan(ctx context.Context, auditID int) error
	GetActiveAuditsForPOS(ctx context.Context) ([]domain.AuditListDTO, error)

	// Dashboard specific (HU10)
	GetDashboardAudits(ctx context.Context) ([]domain.AuditListDTO, error)

	// Audit Logs (HU12)
	LogEvent(ctx context.Context, auditID int, userID *string, eventType string, details map[string]interface{}) error
	GetAuditEvents(ctx context.Context, auditID int) ([]domain.AuditEvent, error)

	// Update Existing Audit (PDF Replacement)
	UpdateAuditTheoretical(ctx context.Context, auditID int, items []domain.AuditItem, pdfURL string) error

	// Close and Reopen Audits
	CloseAudit(ctx context.Context, auditID int, userID string) error
	ReopenAudit(ctx context.Context, auditID int, userID string) error
	Delete(ctx context.Context, auditID int) error
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

// DeleteSession removes a session and its related items (cascade)
func (r *PostgresRepository) DeleteSession(ctx context.Context, id int) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Delete items first (foreign key constraint)
	_, err = tx.ExecContext(ctx, `DELETE FROM audit_theoretical WHERE audit_id = $1`, id)
	if err != nil {
		return err
	}

	// Delete session
	_, err = tx.ExecContext(ctx, `DELETE FROM audit_sessions WHERE id = $1`, id)
	if err != nil {
		return err
	}

	return tx.Commit()
}

// SaveAuditBatchWithStatus inserts all items and updates session with custom status in a single transaction
func (r *PostgresRepository) SaveAuditBatchWithStatus(ctx context.Context, auditID int, items []domain.AuditItem, pdfURL string, status string) error {
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

	// Update session with PDF URL and custom status
	_, err = tx.ExecContext(ctx, `UPDATE audit_sessions SET pdf_url = $2, status = $3 WHERE id = $1`, auditID, pdfURL, status)
	if err != nil {
		return err
	}

	return tx.Commit()
}

// FindAllSessions retrieves all sessions with store names
func (r *PostgresRepository) FindAllSessions(ctx context.Context) ([]domain.AuditListDTO, error) {
	query := `
		SELECT s.id, s.store_id, st.name, s.created_by, s.status, s.reference_date, s.pdf_url, s.created_at, s.closed_at,
		       (SELECT COUNT(DISTINCT product_code) FROM audit_theoretical WHERE audit_id = s.id) as theoretical_skus,
		       (SELECT COUNT(DISTINCT p.sku) FROM audit_physical ap JOIN products p ON (ap.barcode = p.barcode OR ap.barcode = p.sku) WHERE ap.audit_id = s.id) as scanned_skus,
		       COALESCE((
		           SELECT SUM((COALESCE(ph.qty, 0) - t.expected_qty) * t.unit_cost)
		           FROM audit_theoretical t
		           LEFT JOIN (
		               SELECT ap2.audit_id, p2.sku, SUM(ap2.quantity) as qty
		               FROM audit_physical ap2
		               JOIN products p2 ON (ap2.barcode = p2.barcode OR ap2.barcode = p2.sku)
		               GROUP BY ap2.audit_id, p2.sku
		           ) ph ON ph.audit_id = t.audit_id AND ph.sku = t.product_code
		           WHERE t.audit_id = s.id
		       ), 0) as total_loss
		FROM audit_sessions s
		JOIN stores st ON s.store_id = st.id
		ORDER BY s.created_at DESC
	`
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessions []domain.AuditListDTO
	for rows.Next() {
		var dto domain.AuditListDTO
		var s domain.AuditSession
		var storeName string

		err := rows.Scan(
			&s.ID, &s.StoreID, &storeName, &s.CreatedBy, &s.Status,
			&s.ReferenceDate, &s.PDFURL, &s.CreatedAt, &s.ClosedAt,
			&dto.TheoreticalSKUs, &dto.ScannedSKUs,
		)
		if err != nil {
			return nil, err
		}

		dto.Session = s
		dto.StoreName = storeName
		sessions = append(sessions, dto)
	}
	return sessions, nil
}

// ============ CATALOG METHODS ============

// UpsertProducts inserts or updates products in bulk
func (r *PostgresRepository) UpsertProducts(ctx context.Context, products []domain.Product, source string) (*domain.CatalogImportResult, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	result := &domain.CatalogImportResult{TotalProducts: len(products)}

	for _, p := range products {
		var exists bool
		err := tx.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM products WHERE sku = $1)`, p.SKU).Scan(&exists)
		if err != nil {
			return nil, err
		}

		if exists {
			_, err = tx.ExecContext(ctx, `
				UPDATE products SET name = $2, barcode = $3, unit = $4, last_price = $5, last_updated = NOW(), source = $6
				WHERE sku = $1`,
				p.SKU, p.Name, p.Barcode, p.Unit, p.LastPrice, source)
			result.UpdatedProducts++
		} else {
			_, err = tx.ExecContext(ctx, `
				INSERT INTO products (sku, name, barcode, unit, last_price, source)
				VALUES ($1, $2, $3, $4, $5, $6)`,
				p.SKU, p.Name, p.Barcode, p.Unit, p.LastPrice, source)
			result.NewProducts++
		}
		if err != nil {
			return nil, err
		}
	}

	return result, tx.Commit()
}

// GetAllProducts returns all products from the catalog
func (r *PostgresRepository) GetAllProducts(ctx context.Context) ([]domain.Product, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, sku, COALESCE(barcode, ''), name, unit, COALESCE(last_price, 0), last_updated, COALESCE(source, ''), created_at
		FROM products ORDER BY sku`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var products []domain.Product
	for rows.Next() {
		var p domain.Product
		if err := rows.Scan(&p.ID, &p.SKU, &p.Barcode, &p.Name, &p.Unit, &p.LastPrice, &p.LastUpdated, &p.Source, &p.CreatedAt); err != nil {
			return nil, err
		}
		products = append(products, p)
	}
	return products, nil
}

// FindProductByBarcode finds a product by its barcode
func (r *PostgresRepository) FindProductByBarcode(ctx context.Context, barcode string) (*domain.Product, error) {
	var p domain.Product
	err := r.db.QueryRowContext(ctx, `
		SELECT id, sku, COALESCE(barcode, ''), name, unit, COALESCE(last_price, 0), last_updated, COALESCE(source, ''), created_at
		FROM products WHERE barcode = $1`, barcode).
		Scan(&p.ID, &p.SKU, &p.Barcode, &p.Name, &p.Unit, &p.LastPrice, &p.LastUpdated, &p.Source, &p.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// GetCatalogStats returns total count and total value
func (r *PostgresRepository) GetCatalogStats(ctx context.Context) (int, float64, error) {
	var count int
	var value float64
	err := r.db.QueryRowContext(ctx, `SELECT COUNT(*), COALESCE(SUM(last_price), 0) FROM products`).Scan(&count, &value)
	return count, value, err
}

// normalizeSKU removes the "19A" prefix from valuation SKUs to match catalog SKUs
// Example: 19AWA02007 -> WA02007, 19AH963116 -> H963116, 19A3524744 -> 3524744
func normalizeSKU(sku string) []string {
	variants := []string{sku}

	// If SKU starts with "19A", also try without the prefix
	if strings.HasPrefix(sku, "19A") && len(sku) > 3 {
		// Remove "19A" prefix
		withoutPrefix := sku[3:]
		variants = append(variants, withoutPrefix)
	}

	// Also try adding "19A" prefix in case the input doesn't have it
	if !strings.HasPrefix(sku, "19A") {
		withPrefix := "19A" + sku
		variants = append(variants, withPrefix)
	}

	return variants
}

// FindProductBySKU finds a product by its SKU, trying multiple variants
func (r *PostgresRepository) FindProductBySKU(ctx context.Context, sku string) (*domain.Product, error) {
	variants := normalizeSKU(sku)

	for _, variant := range variants {
		var p domain.Product
		err := r.db.QueryRowContext(ctx, `
			SELECT id, sku, COALESCE(barcode, ''), name, unit, COALESCE(last_price, 0), last_updated, COALESCE(source, ''), created_at
			FROM products WHERE sku = $1`, variant).
			Scan(&p.ID, &p.SKU, &p.Barcode, &p.Name, &p.Unit, &p.LastPrice, &p.LastUpdated, &p.Source, &p.CreatedAt)
		if err == nil {
			return &p, nil
		}
	}

	// None found
	return nil, fmt.Errorf("product not found for SKU: %s", sku)
}

// ============ CATALOG IMPORT METHODS ============

// SaveCatalogImport saves a catalog import session
func (r *PostgresRepository) SaveCatalogImport(ctx context.Context, imp *domain.CatalogImport) (int, error) {
	var id int
	err := r.db.QueryRowContext(ctx, `
		INSERT INTO catalog_imports (file_name, store_name, imported_by_name, new_products, price_up_count, price_down_count, unchanged_count, total_value, previous_value, economic_impact_up, economic_impact_down, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING id`,
		imp.FileName, imp.StoreName, imp.ImportedByName, imp.NewProducts, imp.PriceUpCount, imp.PriceDownCount, imp.UnchangedCount, imp.TotalValue, imp.PreviousValue, imp.EconomicImpactUp, imp.EconomicImpactDown, imp.Status).
		Scan(&id)
	return id, err
}

// SaveCatalogImportItems saves the items for a catalog import
func (r *PostgresRepository) SaveCatalogImportItems(ctx context.Context, importID int, items []domain.CatalogDiffItem) error {
	if len(items) == 0 {
		return nil
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	for _, item := range items {
		var oldPrice interface{}
		if item.OldPrice != nil {
			oldPrice = *item.OldPrice
		}
		var pctChange interface{}
		if item.PercentChange != nil {
			pctChange = *item.PercentChange
		}

		_, err = tx.ExecContext(ctx, `
			INSERT INTO catalog_import_items (import_id, sku, product_name, change_type, old_price, new_price, difference, percent_change, selected)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
			importID, item.SKU, item.Name, item.Type, oldPrice, item.NewPrice, item.Difference, pctChange, item.Selected)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

// GetCatalogImportHistory returns the recent import history
func (r *PostgresRepository) GetCatalogImportHistory(ctx context.Context, limit int) ([]domain.CatalogImportHistory, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, file_name, COALESCE(imported_by_name, 'Sistema'), new_products, price_up_count + price_down_count, total_value, previous_value, status, created_at
		FROM catalog_imports
		ORDER BY created_at DESC
		LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var history []domain.CatalogImportHistory
	now := time.Now()
	for rows.Next() {
		var h domain.CatalogImportHistory
		var createdAt time.Time
		err := rows.Scan(&h.ID, &h.FileName, &h.User, &h.NewProducts, &h.PriceChanges, &h.TotalValue, &h.PreviousValue, &h.Status, &createdAt)
		if err != nil {
			return nil, err
		}
		h.Date = formatDateSpanish(createdAt)
		h.TimeAgo = formatTimeAgo(now, createdAt)
		history = append(history, h)
	}
	return history, nil
}

// GetCatalogImportByID retrieves a catalog import by ID
func (r *PostgresRepository) GetCatalogImportByID(ctx context.Context, id int) (*domain.CatalogImport, error) {
	var imp domain.CatalogImport
	err := r.db.QueryRowContext(ctx, `
		SELECT id, file_name, store_id, store_name, imported_by, imported_by_name, import_date, new_products, price_up_count, price_down_count, unchanged_count, total_value, previous_value, economic_impact_up, economic_impact_down, status, created_at, applied_at
		FROM catalog_imports WHERE id = $1`, id).
		Scan(&imp.ID, &imp.FileName, &imp.StoreID, &imp.StoreName, &imp.ImportedBy, &imp.ImportedByName, &imp.ImportDate, &imp.NewProducts, &imp.PriceUpCount, &imp.PriceDownCount, &imp.UnchangedCount, &imp.TotalValue, &imp.PreviousValue, &imp.EconomicImpactUp, &imp.EconomicImpactDown, &imp.Status, &imp.CreatedAt, &imp.AppliedAt)
	if err != nil {
		return nil, err
	}
	return &imp, nil
}

// GetCatalogImportItems retrieves items for a catalog import
func (r *PostgresRepository) GetCatalogImportItems(ctx context.Context, importID int) ([]domain.CatalogImportItem, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, import_id, sku, product_name, change_type, old_price, new_price, difference, percent_change, selected, applied
		FROM catalog_import_items WHERE import_id = $1`, importID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []domain.CatalogImportItem
	for rows.Next() {
		var item domain.CatalogImportItem
		err := rows.Scan(&item.ID, &item.ImportID, &item.SKU, &item.ProductName, &item.ChangeType, &item.OldPrice, &item.NewPrice, &item.Difference, &item.PercentChange, &item.Selected, &item.Applied)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, nil
}

// ApplyCatalogImport applies selected changes from an import to the catalog
func (r *PostgresRepository) ApplyCatalogImport(ctx context.Context, importID int, selectedSKUs []string) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Process each SKU individually to avoid pq.Array issues
	for _, sku := range selectedSKUs {
		var name string
		var price float64

		err := tx.QueryRowContext(ctx, `
			SELECT product_name, new_price FROM catalog_import_items 
			WHERE import_id = $1 AND sku = $2`, importID, sku).Scan(&name, &price)
		if err != nil {
			continue // Skip if not found
		}

		// Upsert product
		_, err = tx.ExecContext(ctx, `
			INSERT INTO products (sku, name, last_price, last_updated, source)
			VALUES ($1, $2, $3, NOW(), 'catalog_import')
			ON CONFLICT (sku) DO UPDATE SET
				name = EXCLUDED.name,
				last_price = EXCLUDED.last_price,
				last_updated = NOW(),
				source = 'catalog_import'`,
			sku, name, price)
		if err != nil {
			return err
		}

		// Mark item as applied
		_, err = tx.ExecContext(ctx, `UPDATE catalog_import_items SET applied = true WHERE import_id = $1 AND sku = $2`, importID, sku)
		if err != nil {
			return err
		}
	}

	// Update import status
	_, err = tx.ExecContext(ctx, `UPDATE catalog_imports SET status = 'applied', applied_at = NOW() WHERE id = $1`, importID)
	if err != nil {
		return err
	}

	return tx.Commit()
}

// RevertCatalogImport reverts an applied catalog import
func (r *PostgresRepository) RevertCatalogImport(ctx context.Context, importID int) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Get applied items and restore old prices
	rows, err := tx.QueryContext(ctx, `
		SELECT sku, old_price FROM catalog_import_items 
		WHERE import_id = $1 AND applied = true AND old_price IS NOT NULL`, importID)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var sku string
		var oldPrice float64
		if err := rows.Scan(&sku, &oldPrice); err != nil {
			return err
		}

		// Restore old price
		_, err = tx.ExecContext(ctx, `UPDATE products SET last_price = $2, last_updated = NOW() WHERE sku = $1`, sku, oldPrice)
		if err != nil {
			return err
		}
	}

	// Remove new products that were added
	_, err = tx.ExecContext(ctx, `
		DELETE FROM products WHERE sku IN (
			SELECT sku FROM catalog_import_items WHERE import_id = $1 AND applied = true AND old_price IS NULL
		)`, importID)
	if err != nil {
		return err
	}

	// Mark items as not applied
	_, err = tx.ExecContext(ctx, `UPDATE catalog_import_items SET applied = false WHERE import_id = $1`, importID)
	if err != nil {
		return err
	}

	// Update import status
	_, err = tx.ExecContext(ctx, `UPDATE catalog_imports SET status = 'reverted', applied_at = NULL WHERE id = $1`, importID)
	if err != nil {
		return err
	}

	return tx.Commit()
}

// RestoreCatalogImport restores a previous version by reverting current and applying selected
func (r *PostgresRepository) RestoreCatalogImport(ctx context.Context, importID int) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// 1. Find and revert the current "applied" import (if any)
	var currentAppliedID int
	err = tx.QueryRowContext(ctx, `
		SELECT id FROM catalog_imports 
		WHERE status = 'applied' 
		ORDER BY applied_at DESC 
		LIMIT 1`).Scan(&currentAppliedID)

	if err == nil && currentAppliedID != importID {
		// Collect items to revert first
		type revertItem struct {
			sku      string
			oldPrice *float64
		}
		var revertItems []revertItem

		rows, err := tx.QueryContext(ctx, `
			SELECT sku, old_price FROM catalog_import_items 
			WHERE import_id = $1 AND applied = true`, currentAppliedID)
		if err != nil {
			return err
		}
		for rows.Next() {
			var item revertItem
			if err := rows.Scan(&item.sku, &item.oldPrice); err != nil {
				rows.Close()
				return err
			}
			revertItems = append(revertItems, item)
		}
		rows.Close()

		// Now process collected items
		for _, item := range revertItems {
			if item.oldPrice != nil {
				_, err = tx.ExecContext(ctx, `UPDATE products SET last_price = $2, last_updated = NOW() WHERE sku = $1`, item.sku, *item.oldPrice)
				if err != nil {
					return err
				}
			} else {
				_, err = tx.ExecContext(ctx, `DELETE FROM products WHERE sku = $1`, item.sku)
				if err != nil {
					return err
				}
			}
		}

		// Mark current as reverted
		_, err = tx.ExecContext(ctx, `UPDATE catalog_import_items SET applied = false WHERE import_id = $1`, currentAppliedID)
		if err != nil {
			return err
		}
		_, err = tx.ExecContext(ctx, `UPDATE catalog_imports SET status = 'reverted', applied_at = NULL WHERE id = $1`, currentAppliedID)
		if err != nil {
			return err
		}
	}

	// 2. Collect all items to apply first
	type applyItem struct {
		sku   string
		name  string
		price float64
	}
	var applyItems []applyItem

	rows2, err := tx.QueryContext(ctx, `
		SELECT sku, product_name, new_price FROM catalog_import_items 
		WHERE import_id = $1`, importID)
	if err != nil {
		return err
	}
	for rows2.Next() {
		var item applyItem
		if err := rows2.Scan(&item.sku, &item.name, &item.price); err != nil {
			rows2.Close()
			return err
		}
		applyItems = append(applyItems, item)
	}
	rows2.Close()

	// Now apply collected items
	for _, item := range applyItems {
		_, err = tx.ExecContext(ctx, `
			INSERT INTO products (sku, name, last_price, last_updated, source)
			VALUES ($1, $2, $3, NOW(), 'catalog_restore')
			ON CONFLICT (sku) DO UPDATE SET
				name = EXCLUDED.name,
				last_price = EXCLUDED.last_price,
				last_updated = NOW(),
				source = 'catalog_restore'`,
			item.sku, item.name, item.price)
		if err != nil {
			return err
		}

		_, err = tx.ExecContext(ctx, `UPDATE catalog_import_items SET applied = true WHERE import_id = $1 AND sku = $2`, importID, item.sku)
		if err != nil {
			return err
		}
	}

	// 3. Mark the restored import as applied
	_, err = tx.ExecContext(ctx, `UPDATE catalog_imports SET status = 'applied', applied_at = NOW() WHERE id = $1`, importID)
	if err != nil {
		return err
	}

	return tx.Commit()
}

// DiscardCatalogImport deletes a pending or reverted catalog import and its items
func (r *PostgresRepository) DiscardCatalogImport(ctx context.Context, importID int) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Delete import items first
	_, err = tx.ExecContext(ctx, `DELETE FROM catalog_import_items WHERE import_id = $1`, importID)
	if err != nil {
		return err
	}

	// Delete import (allow pending or reverted status)
	_, err = tx.ExecContext(ctx, `DELETE FROM catalog_imports WHERE id = $1 AND status IN ('pending', 'reverted')`, importID)
	if err != nil {
		return err
	}

	return tx.Commit()
}

// ClearCatalog deletes all products and import history
func (r *PostgresRepository) ClearCatalog(ctx context.Context) (int64, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	// Delete all import items
	_, err = tx.ExecContext(ctx, `DELETE FROM catalog_import_items`)
	if err != nil {
		return 0, err
	}

	// Delete all imports
	_, err = tx.ExecContext(ctx, `DELETE FROM catalog_imports`)
	if err != nil {
		return 0, err
	}

	// Delete all products
	result, err := tx.ExecContext(ctx, `DELETE FROM products`)
	if err != nil {
		return 0, err
	}

	deleted, _ := result.RowsAffected()

	if err := tx.Commit(); err != nil {
		return 0, err
	}

	return deleted, nil
}

// GetLatestPendingImport returns the most recent pending import with its items
func (r *PostgresRepository) GetLatestPendingImport(ctx context.Context) (*domain.CatalogImport, []domain.CatalogImportItem, error) {
	// Get latest pending import
	var imp domain.CatalogImport
	err := r.db.QueryRowContext(ctx, `
		SELECT id, file_name, COALESCE(store_name, ''), COALESCE(imported_by_name, 'Sistema'), 
		       new_products, price_up_count, price_down_count, unchanged_count, 
		       total_value, previous_value, economic_impact_up, economic_impact_down, 
		       status, created_at
		FROM catalog_imports 
		WHERE status = 'pending'
		ORDER BY created_at DESC
		LIMIT 1`).
		Scan(&imp.ID, &imp.FileName, &imp.StoreName, &imp.ImportedByName,
			&imp.NewProducts, &imp.PriceUpCount, &imp.PriceDownCount, &imp.UnchangedCount,
			&imp.TotalValue, &imp.PreviousValue, &imp.EconomicImpactUp, &imp.EconomicImpactDown,
			&imp.Status, &imp.CreatedAt)
	if err != nil {
		return nil, nil, err
	}

	// Get items for this import
	items, err := r.GetCatalogImportItems(ctx, imp.ID)
	if err != nil {
		return nil, nil, err
	}

	return &imp, items, nil
}

// formatTimeAgo formats the time difference in human-readable Spanish
func formatTimeAgo(now, then time.Time) string {
	diff := now.Sub(then)
	hours := int(diff.Hours())
	days := hours / 24

	if days > 0 {
		if days == 1 {
			return "Hace 1 día"
		}
		return fmt.Sprintf("Hace %d días", days)
	}
	if hours > 0 {
		if hours == 1 {
			return "Hace 1 hora"
		}
		return fmt.Sprintf("Hace %d horas", hours)
	}
	minutes := int(diff.Minutes())
	if minutes > 0 {
		if minutes == 1 {
			return "Hace 1 minuto"
		}
		return fmt.Sprintf("Hace %d minutos", minutes)
	}
	return "Hace unos segundos"
}

// formatDateSpanish formats a date with Spanish month names
func formatDateSpanish(t time.Time) string {
	months := []string{"", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"}
	day := t.Day()
	month := months[t.Month()]
	hour := t.Hour()
	minute := t.Minute()
	ampm := "AM"
	if hour >= 12 {
		ampm = "PM"
		if hour > 12 {
			hour -= 12
		}
	}
	if hour == 0 {
		hour = 12
	}
	return fmt.Sprintf("%02d %s, %d:%02d %s", day, month, hour, minute, ampm)
}

// GetDashboardAudits returns audits for the dashboard based on HU10 business rules:
// - ALL active audits (status != 'closed') OR ('closed' AND closed_at > NOW() - 24 hours)
// - Ordered by creation date DESC
func (r *PostgresRepository) GetDashboardAudits(ctx context.Context) ([]domain.AuditListDTO, error) {
	query := `
		SELECT s.id, s.store_id, st.name, s.created_by, s.status, s.reference_date, s.pdf_url, s.created_at, s.closed_at,
		       (SELECT COUNT(DISTINCT product_code) FROM audit_theoretical WHERE audit_id = s.id) as theoretical_skus,
		       (SELECT COUNT(DISTINCT p.sku) FROM audit_physical ap JOIN products p ON (ap.barcode = p.barcode OR ap.barcode = p.sku) WHERE ap.audit_id = s.id) as scanned_skus,
		       COALESCE((
		           SELECT SUM((COALESCE(ph.qty, 0) - t.expected_qty) * t.unit_cost)
		           FROM audit_theoretical t
		           LEFT JOIN (
		               SELECT ap2.audit_id, p2.sku, SUM(ap2.quantity) as qty
		               FROM audit_physical ap2
		               JOIN products p2 ON (ap2.barcode = p2.barcode OR ap2.barcode = p2.sku)
		               GROUP BY ap2.audit_id, p2.sku
		           ) ph ON ph.audit_id = t.audit_id AND ph.sku = t.product_code
		           WHERE t.audit_id = s.id
		       ), 0) as total_loss
		FROM audit_sessions s
		JOIN stores st ON s.store_id = st.id
		ORDER BY s.created_at DESC
	`

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessions []domain.AuditListDTO
	for rows.Next() {
		var dto domain.AuditListDTO
		var s domain.AuditSession
		var storeName string

		err := rows.Scan(
			&s.ID, &s.StoreID, &storeName, &s.CreatedBy, &s.Status,
			&s.ReferenceDate, &s.PDFURL, &s.CreatedAt, &s.ClosedAt,
			&dto.TheoreticalSKUs, &dto.ScannedSKUs, &dto.TotalLoss,
		)
		if err != nil {
			return nil, err
		}

		dto.Session = s
		dto.StoreName = storeName
		sessions = append(sessions, dto)
	}
	return sessions, nil
}

// ============ PHYSICAL SCAN METHODS (POS APP) ============

// InsertPhysicalScan adds a new scan from the POS app
func (r *PostgresRepository) InsertPhysicalScan(ctx context.Context, req *domain.AddScanRequest) (*domain.PhysicalScan, error) {
	scannedAt := time.Now()
	query := `
		INSERT INTO audit_physical (audit_id, barcode, quantity, scanned_by, device_id, scanned_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id
	`

	// Handle empty scanned_by (it's a UUID in DB, pass NULL if empty)
	var scannedByParam interface{}
	if req.ScannedBy == "" {
		scannedByParam = nil
	} else {
		scannedByParam = req.ScannedBy
	}

	// Handle empty device_id
	var deviceIDParam interface{}
	if req.DeviceID == "" {
		deviceIDParam = nil
	} else {
		deviceIDParam = req.DeviceID
	}

	var id int
	err := r.db.QueryRowContext(ctx, query,
		req.AuditID, req.Barcode, req.Quantity, scannedByParam, deviceIDParam, scannedAt,
	).Scan(&id)
	if err != nil {
		return nil, err
	}

	// Lookup product info from catalog (search by barcode first, then by SKU)
	var sku, productName sql.NullString
	productQuery := `SELECT sku, name FROM products WHERE barcode = $1 LIMIT 1`
	err = r.db.QueryRowContext(ctx, productQuery, req.Barcode).Scan(&sku, &productName)

	// If not found by barcode, try searching by SKU
	if err == sql.ErrNoRows || !sku.Valid {
		productQuery = `SELECT sku, name FROM products WHERE sku = $1 LIMIT 1`
		_ = r.db.QueryRowContext(ctx, productQuery, req.Barcode).Scan(&sku, &productName)
	}

	scan := &domain.PhysicalScan{
		ID:        id,
		AuditID:   req.AuditID,
		Barcode:   req.Barcode,
		Quantity:  req.Quantity,
		ScannedBy: stringPtr(req.ScannedBy),
		DeviceID:  stringPtr(req.DeviceID),
		ScannedAt: scannedAt,
		IsUnknown: !sku.Valid,
	}
	if sku.Valid {
		scan.SKU = &sku.String
	}
	if productName.Valid {
		scan.ProductName = &productName.String
	}
	return scan, nil
}

// stringPtr returns a pointer to the string if not empty, otherwise nil
func stringPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// GetPhysicalScans retrieves all scans for an audit (with product info from catalog)
func (r *PostgresRepository) GetPhysicalScans(ctx context.Context, auditID int) ([]domain.PhysicalScan, error) {
	query := `
		SELECT 
			ap.id, ap.audit_id, ap.barcode, 
			COALESCE(p.sku, p2.sku) as sku, 
			COALESCE(p.name, p2.name) as name, 
			ap.quantity, 
			ap.scanned_by, ap.device_id, ap.scanned_at,
			CASE WHEN p.id IS NULL AND p2.id IS NULL THEN true ELSE false END as is_unknown
		FROM audit_physical ap
		LEFT JOIN products p ON ap.barcode = p.barcode
		LEFT JOIN products p2 ON ap.barcode = p2.sku AND p.id IS NULL
		WHERE ap.audit_id = $1
		ORDER BY ap.scanned_at DESC
	`
	rows, err := r.db.QueryContext(ctx, query, auditID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var scans []domain.PhysicalScan
	for rows.Next() {
		var s domain.PhysicalScan
		var sku, productName, scannedBy, deviceID sql.NullString
		err := rows.Scan(&s.ID, &s.AuditID, &s.Barcode, &sku, &productName, &s.Quantity,
			&scannedBy, &deviceID, &s.ScannedAt, &s.IsUnknown)
		if err != nil {
			return nil, err
		}
		if sku.Valid {
			s.SKU = &sku.String
		}
		if productName.Valid {
			s.ProductName = &productName.String
		}
		if scannedBy.Valid {
			s.ScannedBy = &scannedBy.String
		}
		if deviceID.Valid {
			s.DeviceID = &deviceID.String
		}
		scans = append(scans, s)
	}
	return scans, nil
}

// GetPhysicalScanSummary returns summary stats for physical scans
func (r *PostgresRepository) GetPhysicalScanSummary(ctx context.Context, auditID int) (*domain.AuditPhysicalSummary, error) {
	query := `
		SELECT 
			COUNT(*) as total_scans,
			COALESCE(SUM(ap.quantity), 0) as total_quantity,
			COUNT(DISTINCT COALESCE(p.sku, p2.sku)) as unique_products,
			COUNT(CASE WHEN p.id IS NULL AND p2.id IS NULL THEN 1 END) as unknown_items,
			MAX(ap.scanned_at) as last_scan_at
		FROM audit_physical ap
		LEFT JOIN products p ON ap.barcode = p.barcode
		LEFT JOIN products p2 ON ap.barcode = p2.sku AND p.id IS NULL
		WHERE ap.audit_id = $1
	`
	var s domain.AuditPhysicalSummary
	var lastScan sql.NullTime
	err := r.db.QueryRowContext(ctx, query, auditID).Scan(
		&s.TotalScans, &s.TotalQuantity, &s.UniqueProducts, &s.UnknownItems, &lastScan,
	)
	if err != nil {
		return nil, err
	}
	if lastScan.Valid {
		s.LastScanAt = &lastScan.Time
	}
	return &s, nil
}

// DeleteLastPhysicalScan removes the last scan for an audit (undo)
func (r *PostgresRepository) DeleteLastPhysicalScan(ctx context.Context, auditID int) error {
	query := `
		DELETE FROM audit_physical 
		WHERE id = (
			SELECT id FROM audit_physical 
			WHERE audit_id = $1 
			ORDER BY scanned_at DESC 
			LIMIT 1
		)
	`
	_, err := r.db.ExecContext(ctx, query, auditID)
	return err
}

// LogEvent logs an audit event
func (r *PostgresRepository) LogEvent(ctx context.Context, auditID int, userID *string, eventType string, details map[string]interface{}) error {
	var detailsJSON []byte
	var err error
	if details != nil {
		detailsJSON, err = json.Marshal(details)
		if err != nil {
			return err
		}
	}

	query := `INSERT INTO audit_events (audit_id, user_id, event_type, details, created_at) VALUES ($1, $2, $3, $4, NOW())`

	var d interface{} = nil
	if len(detailsJSON) > 0 {
		d = string(detailsJSON)
	}

	_, err = r.db.ExecContext(ctx, query, auditID, userID, eventType, d)
	return err
}

// GetAuditEvents retrieves all events for an audit
// GetAuditEvents retrieves all events for an audit with user names
func (r *PostgresRepository) GetAuditEvents(ctx context.Context, auditID int) ([]domain.AuditEvent, error) {
	// Order by DESC to show newest first
	// JOIN with users table to get real names. defaults to 'SISTEMA' if user_id is null or not found
	query := `
		SELECT ae.id, ae.audit_id, ae.user_id, 
		       COALESCE(ae.action, ae.event_type) as event_type, 
		       ae.details, ae.created_at,
		       COALESCE(u.first_name || ' ' || u.last_name, 'SISTEMA') as user_name
		FROM audit_events ae
		LEFT JOIN users u ON ae.user_id::text = u.id::text
		WHERE ae.audit_id = $1
		ORDER BY ae.created_at DESC
	`
	rows, err := r.db.QueryContext(ctx, query, auditID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []domain.AuditEvent
	for rows.Next() {
		var e domain.AuditEvent
		// details can be null
		var detailsRaw sql.NullString
		// We scan user_name into the new field
		var userName string

		if err := rows.Scan(&e.ID, &e.AuditID, &e.UserID, &e.EventType, &detailsRaw, &e.CreatedAt, &userName); err != nil {
			return nil, err
		}

		e.UserName = userName

		if detailsRaw.Valid {
			if err := json.Unmarshal([]byte(detailsRaw.String), &e.Details); err != nil {
				e.Details = make(map[string]interface{})
			}
		}
		events = append(events, e)
	}
	return events, nil
}

// GetActiveAuditsForPOS returns audits available for the POS app to connect
func (r *PostgresRepository) GetActiveAuditsForPOS(ctx context.Context) ([]domain.AuditListDTO, error) {
	query := `
		SELECT s.id, s.store_id, st.name, s.created_by, s.status, s.reference_date, s.pdf_url, s.created_at, s.closed_at
		FROM audit_sessions s
		JOIN stores st ON s.store_id = st.id
		WHERE s.status IN ('IN_PROGRESS', 'REVIEW_PENDING', 'COUNTING')
		ORDER BY s.created_at DESC
	`
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessions []domain.AuditListDTO
	for rows.Next() {
		var dto domain.AuditListDTO
		var s domain.AuditSession
		var storeName string
		err := rows.Scan(&s.ID, &s.StoreID, &storeName, &s.CreatedBy, &s.Status, &s.ReferenceDate, &s.PDFURL, &s.CreatedAt, &s.ClosedAt)
		if err != nil {
			return nil, err
		}
		dto.Session = s
		dto.StoreName = storeName
		sessions = append(sessions, dto)
	}
	return sessions, nil
}

// UpdateAuditTheoretical updates the theoretical inventory and RESETS physical scans
func (r *PostgresRepository) UpdateAuditTheoretical(ctx context.Context, auditID int, items []domain.AuditItem, pdfURL string) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// 1. Physical scans are PRESERVED (User Request)
	// _, err = tx.ExecContext(ctx, `DELETE FROM audit_physical WHERE audit_id = $1`, auditID)

	// 2. Delete existing theoretical items
	_, err = tx.ExecContext(ctx, `DELETE FROM audit_theoretical WHERE audit_id = $1`, auditID)
	if err != nil {
		return err
	}

	// 3. Insert new theoretical items
	if len(items) > 0 {
		valueStrings := make([]string, 0, len(items))
		valueArgs := make([]interface{}, 0, len(items)*5)
		for i, item := range items {
			// ($1, $2, $3, $4, $5)
			valueStrings = append(valueStrings, fmt.Sprintf("($1, $%d, $%d, $%d, $%d)", i*4+2, i*4+3, i*4+4, i*4+5))
			valueArgs = append(valueArgs, item.ProductCode, item.ProductName, item.UnitCost, item.ExpectedQty)
		}
		stmt := fmt.Sprintf("INSERT INTO audit_theoretical (audit_id, product_code, product_name, unit_cost, expected_qty) VALUES %s", strings.Join(valueStrings, ","))

		args := append([]interface{}{auditID}, valueArgs...)
		_, err = tx.ExecContext(ctx, stmt, args...)
		if err != nil {
			return err
		}
	}

	// 4. Update session status and PDF URL
	_, err = tx.ExecContext(ctx, `UPDATE audit_sessions SET pdf_url = $1, status = 'IN_PROGRESS', closed_at = NULL WHERE id = $2`, pdfURL, auditID)
	if err != nil {
		return err
	}

	return tx.Commit()
}
