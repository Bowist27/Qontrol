package domain

import "time"

// Product represents a catalog product
type Product struct {
	ID          int       `json:"id"`
	SKU         string    `json:"sku"`
	Barcode     string    `json:"barcode,omitempty"`
	Name        string    `json:"name"`
	Unit        string    `json:"unit"`
	LastPrice   float64   `json:"last_price,omitempty"`
	LastUpdated time.Time `json:"last_updated"`
	Source      string    `json:"source,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

// CatalogImportResult is the response after importing products
type CatalogImportResult struct {
	TotalProducts   int `json:"total_products"`
	NewProducts     int `json:"new_products"`
	UpdatedProducts int `json:"updated_products"`
}
