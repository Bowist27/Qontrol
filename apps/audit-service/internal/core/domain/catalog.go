package domain

import "time"

// CatalogImport represents a catalog import session
type CatalogImport struct {
	ID               int        `json:"id"`
	FileName         string     `json:"file_name"`
	StoreID          *int       `json:"store_id,omitempty"`
	StoreName        string     `json:"store_name,omitempty"`
	ImportedBy       *string    `json:"imported_by,omitempty"`
	ImportedByName   string     `json:"imported_by_name,omitempty"`
	ImportDate       time.Time  `json:"import_date"`
	NewProducts      int        `json:"new_products"`
	PriceUpCount     int        `json:"price_up_count"`
	PriceDownCount   int        `json:"price_down_count"`
	UnchangedCount   int        `json:"unchanged_count"`
	TotalValue       float64    `json:"total_value"`
	PreviousValue    float64    `json:"previous_value"`
	EconomicImpactUp   float64  `json:"economic_impact_up"`
	EconomicImpactDown float64  `json:"economic_impact_down"`
	Status           string     `json:"status"` // pending, applied, reverted
	CreatedAt        time.Time  `json:"created_at"`
	AppliedAt        *time.Time `json:"applied_at,omitempty"`
}

// CatalogImportItem represents a single change in a catalog import
type CatalogImportItem struct {
	ID            int       `json:"id"`
	ImportID      int       `json:"import_id"`
	SKU           string    `json:"sku"`
	ProductName   string    `json:"product_name"`
	ChangeType    string    `json:"change_type"` // new, price_up, price_down
	OldPrice      *float64  `json:"old_price,omitempty"`
	NewPrice      float64   `json:"new_price"`
	Difference    float64   `json:"difference"`
	PercentChange *float64  `json:"percent_change,omitempty"`
	Selected      bool      `json:"selected"`
	Applied       bool      `json:"applied"`
	CreatedAt     time.Time `json:"created_at"`
}

// CatalogDiffRequest is the request for analyzing a valuation report
type CatalogDiffRequest struct {
	StoreID   int    `json:"store_id,omitempty"`
	StoreName string `json:"store_name,omitempty"`
}

// CatalogDiffResult is the result of analyzing a valuation report
type CatalogDiffResult struct {
	FileName           string              `json:"file_name"`
	StoreName          string              `json:"store_name"`
	DetectedStore      string              `json:"detected_store,omitempty"`
	Date               string              `json:"date"`
	NewProducts        int                 `json:"new_products"`
	PriceUp            int                 `json:"price_up"`
	PriceDown          int                 `json:"price_down"`
	Unchanged          int                 `json:"unchanged"`
	TotalValue         float64             `json:"total_value"`
	PreviousValue      float64             `json:"previous_value"`
	EconomicImpactUp   float64             `json:"economic_impact_up"`
	EconomicImpactDown float64             `json:"economic_impact_down"`
	Details            []CatalogDiffItem   `json:"details"`
}

// CatalogDiffItem is a single item in the diff result
type CatalogDiffItem struct {
	SKU           string   `json:"sku"`
	Name          string   `json:"name"`
	Type          string   `json:"type"` // new, price_up, price_down
	OldPrice      *float64 `json:"old_price,omitempty"`
	NewPrice      float64  `json:"new_price"`
	Difference    float64  `json:"difference"`
	PercentChange *float64 `json:"percent_change,omitempty"`
	Selected      bool     `json:"selected"`
}

// CommitImportRequest is the request for committing import changes
type CommitImportRequest struct {
	ImportID      int      `json:"import_id"`
	SelectedSKUs  []string `json:"selected_skus"`
	UserID        string   `json:"user_id,omitempty"`
	UserName      string   `json:"user_name,omitempty"`
}

// ImportHistoryResponse is the response for import history
type ImportHistoryResponse struct {
	Imports []CatalogImportHistory `json:"imports"`
}

// CatalogImportHistory is a simplified import for the timeline
type CatalogImportHistory struct {
	ID           int       `json:"id"`
	Date         string    `json:"date"`
	TimeAgo      string    `json:"time_ago"`
	User         string    `json:"user"`
	FileName     string    `json:"file_name"`
	NewProducts  int       `json:"new_products"`
	PriceChanges int       `json:"price_changes"`
	TotalValue   float64   `json:"total_value"`
	PreviousValue float64  `json:"previous_value"`
	Status       string    `json:"status"`
}
