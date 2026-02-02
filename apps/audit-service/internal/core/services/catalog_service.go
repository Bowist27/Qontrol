package services

import (
	"audit-service/internal/core/domain"
	"context"
)

// CatalogRepository interface for catalog operations
type CatalogRepository interface {
	UpsertProducts(ctx context.Context, products []domain.Product, source string) (*domain.CatalogImportResult, error)
	GetAllProducts(ctx context.Context) ([]domain.Product, error)
	FindProductByBarcode(ctx context.Context, barcode string) (*domain.Product, error)
	GetCatalogStats(ctx context.Context) (int, float64, error)
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

// FindByBarcode finds a product by barcode
func (s *CatalogService) FindByBarcode(ctx context.Context, barcode string) (*domain.Product, error) {
	return s.repo.FindProductByBarcode(ctx, barcode)
}

// GetCatalogStats returns catalog statistics
func (s *CatalogService) GetCatalogStats(ctx context.Context) (int, float64, error) {
	return s.repo.GetCatalogStats(ctx)
}
