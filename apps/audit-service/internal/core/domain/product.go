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

// ProductChange represents a manual change to a product
type ProductChange struct {
	ID          int                    `json:"id"`
	ProductID   int                    `json:"product_id,omitempty"`
	ProductSKU  string                 `json:"product_sku"`
	ProductName string                 `json:"product_name"`
	Action      string                 `json:"action"` // create, update, delete
	OldValues   map[string]interface{} `json:"old_values,omitempty"`
	NewValues   map[string]interface{} `json:"new_values,omitempty"`
	UserEmail   string                 `json:"user_email"`
	UserName    string                 `json:"user_name"`
	CreatedAt   time.Time              `json:"created_at"`
	TimeAgo     string                 `json:"time_ago,omitempty"`
}
