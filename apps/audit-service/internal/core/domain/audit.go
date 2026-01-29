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
