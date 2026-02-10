package services

import (
	"audit-service/internal/core/domain"
	"context"
	"math"
	"time"
)

// CatalogRepository interface for catalog operations
type CatalogRepository interface {
	UpsertProducts(ctx context.Context, products []domain.Product, source string) (*domain.CatalogImportResult, error)
	GetAllProducts(ctx context.Context) ([]domain.Product, error)
	GetProductsPaginated(ctx context.Context, page, limit int, search string) ([]domain.Product, int, error)
	FindProductByBarcode(ctx context.Context, barcode string) (*domain.Product, error)
	FindProductBySKU(ctx context.Context, sku string) (*domain.Product, error)
	GetProductByID(ctx context.Context, id int) (*domain.Product, error)
	GetCatalogStats(ctx context.Context) (int, float64, error)
	CreateProduct(ctx context.Context, product *domain.Product) (int, error)
	UpdateProduct(ctx context.Context, id int, name string, barcode string, unit string, price float64) error
	DeleteProduct(ctx context.Context, id int) error
	// Product changes history
	SaveProductChange(ctx context.Context, change *domain.ProductChange) error
	GetProductChanges(ctx context.Context, limit int) ([]domain.ProductChange, error)
	// Import history
	SaveCatalogImport(ctx context.Context, imp *domain.CatalogImport) (int, error)
	SaveCatalogImportItems(ctx context.Context, importID int, items []domain.CatalogDiffItem) error
	GetCatalogImportHistory(ctx context.Context, limit int) ([]domain.CatalogImportHistory, error)
	GetCatalogImportByID(ctx context.Context, id int) (*domain.CatalogImport, error)
	GetCatalogImportItems(ctx context.Context, importID int) ([]domain.CatalogImportItem, error)
	GetLatestPendingImport(ctx context.Context) (*domain.CatalogImport, []domain.CatalogImportItem, error)
	ApplyCatalogImport(ctx context.Context, importID int, selectedSKUs []string) error
	RevertCatalogImport(ctx context.Context, importID int) error
	DiscardCatalogImport(ctx context.Context, importID int) error
	RestoreCatalogImport(ctx context.Context, importID int) error
	ClearCatalog(ctx context.Context) (int64, error)
}

// CatalogService handles catalog business logic
type CatalogService struct {
	repo CatalogRepository
}

// NewCatalogService creates a new catalog service
func NewCatalogService(repo CatalogRepository) *CatalogService {
	return &CatalogService{repo: repo}
}

// ImportProducts imports products to the catalog
func (s *CatalogService) ImportProducts(ctx context.Context, products []domain.Product, source string) (*domain.CatalogImportResult, error) {
	return s.repo.UpsertProducts(ctx, products, source)
}

// GetAllProducts returns all catalog products
func (s *CatalogService) GetAllProducts(ctx context.Context) ([]domain.Product, error) {
	return s.repo.GetAllProducts(ctx)
}

// GetProductsPaginated returns paginated products with optional search
func (s *CatalogService) GetProductsPaginated(ctx context.Context, page, limit int, search string) ([]domain.Product, int, error) {
	return s.repo.GetProductsPaginated(ctx, page, limit, search)
}

// FindByBarcode finds a product by barcode
func (s *CatalogService) FindByBarcode(ctx context.Context, barcode string) (*domain.Product, error) {
	return s.repo.FindProductByBarcode(ctx, barcode)
}

// GetProductByID finds a product by ID
func (s *CatalogService) GetProductByID(ctx context.Context, id int) (*domain.Product, error) {
	return s.repo.GetProductByID(ctx, id)
}

// GetCatalogStats returns catalog statistics
func (s *CatalogService) GetCatalogStats(ctx context.Context) (int, float64, error) {
	return s.repo.GetCatalogStats(ctx)
}

// CreateProduct creates a new product and logs the change
func (s *CatalogService) CreateProduct(ctx context.Context, product *domain.Product, userEmail, userName string) (int, error) {
	id, err := s.repo.CreateProduct(ctx, product)
	if err != nil {
		return 0, err
	}

	// Log the change
	change := &domain.ProductChange{
		ProductID:   id,
		ProductSKU:  product.SKU,
		ProductName: product.Name,
		Action:      "create",
		NewValues: map[string]interface{}{
			"sku":     product.SKU,
			"name":    product.Name,
			"barcode": product.Barcode,
			"unit":    product.Unit,
			"price":   product.LastPrice,
		},
		UserEmail: userEmail,
		UserName:  userName,
	}
	_ = s.repo.SaveProductChange(ctx, change)

	return id, nil
}

// UpdateProduct updates a product's fields and logs the change
func (s *CatalogService) UpdateProduct(ctx context.Context, id int, name string, barcode string, unit string, price float64, userEmail, userName string) error {
	// Get current values before update
	oldProduct, err := s.repo.GetProductByID(ctx, id)
	if err != nil {
		return err
	}

	err = s.repo.UpdateProduct(ctx, id, name, barcode, unit, price)
	if err != nil {
		return err
	}

	// Log the change
	change := &domain.ProductChange{
		ProductID:   id,
		ProductSKU:  oldProduct.SKU,
		ProductName: name,
		Action:      "update",
		OldValues: map[string]interface{}{
			"name":    oldProduct.Name,
			"barcode": oldProduct.Barcode,
			"unit":    oldProduct.Unit,
			"price":   oldProduct.LastPrice,
		},
		NewValues: map[string]interface{}{
			"name":    name,
			"barcode": barcode,
			"unit":    unit,
			"price":   price,
		},
		UserEmail: userEmail,
		UserName:  userName,
	}
	_ = s.repo.SaveProductChange(ctx, change)

	return nil
}

// DeleteProduct deletes a product by ID and logs the change
func (s *CatalogService) DeleteProduct(ctx context.Context, id int, userEmail, userName string) error {
	// Get current values before delete
	oldProduct, err := s.repo.GetProductByID(ctx, id)
	if err != nil {
		return err
	}

	err = s.repo.DeleteProduct(ctx, id)
	if err != nil {
		return err
	}

	// Log the change
	change := &domain.ProductChange{
		ProductID:   id,
		ProductSKU:  oldProduct.SKU,
		ProductName: oldProduct.Name,
		Action:      "delete",
		OldValues: map[string]interface{}{
			"sku":     oldProduct.SKU,
			"name":    oldProduct.Name,
			"barcode": oldProduct.Barcode,
			"unit":    oldProduct.Unit,
			"price":   oldProduct.LastPrice,
		},
		UserEmail: userEmail,
		UserName:  userName,
	}
	_ = s.repo.SaveProductChange(ctx, change)

	return nil
}

// GetProductChanges returns the history of manual product changes
func (s *CatalogService) GetProductChanges(ctx context.Context, limit int) ([]domain.ProductChange, error) {
	return s.repo.GetProductChanges(ctx, limit)
}

// AnalyzeValuationReport compares a valuation report against the current catalog
func (s *CatalogService) AnalyzeValuationReport(ctx context.Context, items []domain.AuditItem, fileName, storeName string) (*domain.CatalogDiffResult, error) {
	result := &domain.CatalogDiffResult{
		FileName:  fileName,
		StoreName: storeName,
		Date:      time.Now().Format("02-ENE-2006"),
		Details:   make([]domain.CatalogDiffItem, 0),
	}

	var totalValue, previousValue, impactUp, impactDown float64

	for _, item := range items {
		// Look up existing product
		existing, err := s.repo.FindProductBySKU(ctx, item.ProductCode)
		
		diffItem := domain.CatalogDiffItem{
			SKU:      item.ProductCode,
			Name:     item.ProductName,
			NewPrice: item.UnitCost,
			Selected: true,
		}

		if err != nil || existing == nil {
			// New product - doesn't exist in catalog
			diffItem.Type = "new"
			diffItem.Difference = item.UnitCost
			result.NewProducts++
		} else {
			oldPrice := existing.LastPrice
			diffItem.OldPrice = &oldPrice
			previousValue += oldPrice

			if item.UnitCost > oldPrice {
				// Price went up (includes from $0 to any price)
				diffItem.Type = "price_up"
				diffItem.Difference = item.UnitCost - oldPrice
				if oldPrice > 0 {
					pctChange := ((item.UnitCost - oldPrice) / oldPrice) * 100
					diffItem.PercentChange = &pctChange
				}
				impactUp += diffItem.Difference
				result.PriceUp++
			} else if item.UnitCost < oldPrice {
				// Price went down
				diffItem.Type = "price_down"
				diffItem.Difference = item.UnitCost - oldPrice
				if oldPrice > 0 {
					pctChange := ((item.UnitCost - oldPrice) / oldPrice) * 100
					diffItem.PercentChange = &pctChange
				}
				impactDown += diffItem.Difference
				result.PriceDown++
			} else {
				// No change - don't add to details
				result.Unchanged++
				continue
			}
		}

		totalValue += item.UnitCost
		result.Details = append(result.Details, diffItem)
	}

	// Round values
	result.TotalValue = math.Round(totalValue*100) / 100
	result.PreviousValue = math.Round(previousValue*100) / 100
	result.EconomicImpactUp = math.Round(impactUp*100) / 100
	result.EconomicImpactDown = math.Round(impactDown*100) / 100

	return result, nil
}

// SaveImport saves an import session and its items
func (s *CatalogService) SaveImport(ctx context.Context, result *domain.CatalogDiffResult, userName string) (int, error) {
	imp := &domain.CatalogImport{
		FileName:           result.FileName,
		StoreName:          result.StoreName,
		ImportedByName:     userName,
		ImportDate:         time.Now(),
		NewProducts:        result.NewProducts,
		PriceUpCount:       result.PriceUp,
		PriceDownCount:     result.PriceDown,
		UnchangedCount:     result.Unchanged,
		TotalValue:         result.TotalValue,
		PreviousValue:      result.PreviousValue,
		EconomicImpactUp:   result.EconomicImpactUp,
		EconomicImpactDown: result.EconomicImpactDown,
		Status:             "pending",
	}

	importID, err := s.repo.SaveCatalogImport(ctx, imp)
	if err != nil {
		return 0, err
	}

	err = s.repo.SaveCatalogImportItems(ctx, importID, result.Details)
	return importID, err
}

// GetImportHistory returns the import history
func (s *CatalogService) GetImportHistory(ctx context.Context, limit int) ([]domain.CatalogImportHistory, error) {
	return s.repo.GetCatalogImportHistory(ctx, limit)
}

// CommitImport applies selected changes to the catalog
func (s *CatalogService) CommitImport(ctx context.Context, importID int, selectedSKUs []string) error {
	return s.repo.ApplyCatalogImport(ctx, importID, selectedSKUs)
}

// RevertImport reverts an applied import
func (s *CatalogService) RevertImport(ctx context.Context, importID int) error {
	return s.repo.RevertCatalogImport(ctx, importID)
}

// DiscardImport deletes a pending import without applying it
func (s *CatalogService) DiscardImport(ctx context.Context, importID int) error {
	return s.repo.DiscardCatalogImport(ctx, importID)
}

// RestoreImport restores a previous version as the current active version
func (s *CatalogService) RestoreImport(ctx context.Context, importID int) error {
	return s.repo.RestoreCatalogImport(ctx, importID)
}

// GetLatestPendingValuation returns the latest pending import with its items
func (s *CatalogService) GetLatestPendingValuation(ctx context.Context) (*domain.CatalogImport, []domain.CatalogImportItem, error) {
	return s.repo.GetLatestPendingImport(ctx)
}

// ClearCatalog deletes all products and import history from the catalog
func (s *CatalogService) ClearCatalog(ctx context.Context) (int64, error) {
	return s.repo.ClearCatalog(ctx)
}
