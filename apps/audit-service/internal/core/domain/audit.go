package domain

import "time"

// Store represents a physical store location
type Store struct {
	ID        int       `json:"id"`
	Name      string    `json:"name"`
	Status    bool      `json:"status"`
	CreatedAt time.Time `json:"created_at"`
}

// AuditSession represents an audit session for a store
type AuditSession struct {
	ID            int        `json:"id"`
	StoreID       int        `json:"store_id"`
	CreatedBy     *string    `json:"created_by,omitempty"`
	Status        string     `json:"status"` // UPLOADING, REVIEW_PENDING, IN_PROGRESS, COMPLETED, ERROR
	ReferenceDate *time.Time `json:"reference_date,omitempty"`
	PDFURL        *string    `json:"pdf_url,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	ClosedAt      *time.Time `json:"closed_at,omitempty"`
}

// AuditItem represents a theoretical inventory item from PDF
type AuditItem struct {
	ID           int       `json:"id"`
	AuditID      int       `json:"audit_id"`
	ProductCode  string    `json:"product_code"`
	ProductName  string    `json:"product_name"`
	UnitCost     float64   `json:"unit_cost"`
	LastPurchase *string   `json:"last_purchase,omitempty"`
	ExpectedQty  float64   `json:"expected_qty"`
	CreatedAt    time.Time `json:"created_at"`
}

// NewAuditSession creates a new session with UPLOADING status
func NewAuditSession(storeID int, createdBy *string) *AuditSession {
	return &AuditSession{
		StoreID:   storeID,
		CreatedBy: createdBy,
		Status:    "UPLOADING",
		CreatedAt: time.Now(),
	}
}

// AuditDTO is the response DTO for CreateAudit
type AuditDTO struct {
	Session AuditSession `json:"session"`
	Items   []AuditItem  `json:"items"`
}

// AuditListDTO is for the dashboard list view
type AuditListDTO struct {
	Session         AuditSession `json:"session"`
	StoreName       string       `json:"store_name"`
	TheoreticalSKUs int          `json:"theoretical_skus"`
	ScannedSKUs     int          `json:"scanned_skus"`
	TotalLoss       float64      `json:"total_loss"`
}

// CreateAuditRequest is the request payload for creating an audit
type CreateAuditRequest struct {
	StoreID int `form:"store_id" binding:"required"`
	// File is handled separately via FormFile
}

// ErrorResponse represents an API error
type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}

// PhysicalScan represents a physical scan item from the POS app
type PhysicalScan struct {
	ID          int       `json:"id"`
	AuditID     int       `json:"audit_id"`
	Barcode     string    `json:"barcode"`
	SKU         *string   `json:"sku,omitempty"`
	ProductName *string   `json:"product_name,omitempty"`
	Quantity    float64   `json:"quantity"`
	ScannedBy   *string   `json:"scanned_by,omitempty"`
	DeviceID    *string   `json:"device_id,omitempty"`
	ScannedAt   time.Time `json:"scanned_at"`
	IsUnknown   bool      `json:"is_unknown"`
}

// AddScanRequest is the request from POS app to add a scan
type AddScanRequest struct {
	AuditID     int     `json:"audit_id"`
	Barcode     string  `json:"barcode" binding:"required"`
	SKU         string  `json:"sku,omitempty"`
	ProductName string  `json:"product_name,omitempty"`
	Quantity    float64 `json:"quantity"`
	ScannedBy   string  `json:"scanned_by,omitempty"`
	DeviceID    string  `json:"device_id,omitempty"`
	IsUnknown   bool    `json:"is_unknown"`
}

// AuditPhysicalSummary is the summary of physical scans
type AuditPhysicalSummary struct {
	TotalScans     int        `json:"total_scans"`
	TotalQuantity  float64    `json:"total_quantity"`
	UniqueProducts int        `json:"unique_products"`
	UnknownItems   int        `json:"unknown_items"`
	LastScanAt     *time.Time `json:"last_scan_at"`
}

// AuditEvent represents an entry in the audit log
type AuditEvent struct {
	ID        int                    `json:"id"`
	AuditID   int                    `json:"audit_id"`
	UserID    *string                `json:"user_id,omitempty"`
	UserName  string                 `json:"user_name,omitempty"` // Added for UI display
	EventType string                 `json:"event_type"`
	Details   map[string]interface{} `json:"details,omitempty"`
	CreatedAt time.Time              `json:"created_at"`
}

// ConnectedDevice represents a POS device connected to an audit
type ConnectedDevice struct {
	DeviceID       string    `json:"device_id"`
	UserName       string    `json:"user_name"`
	ConnectedAt    time.Time `json:"connected_at"`
	LastActivityAt time.Time `json:"last_activity_at"`
}
