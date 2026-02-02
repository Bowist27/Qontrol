package repositories

import (
	"context"
	"database/sql"
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
		SELECT s.id, s.store_id, st.name, s.created_by, s.status, s.reference_date, s.pdf_url, s.created_at, s.closed_at
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

// DiscardCatalogImport deletes a pending catalog import and its items
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

	// Delete import
	_, err = tx.ExecContext(ctx, `DELETE FROM catalog_imports WHERE id = $1 AND status = 'pending'`, importID)
	if err != nil {
		return err
	}

	return tx.Commit()
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
