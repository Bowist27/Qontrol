package services

import (
	"context"
	"fmt"
	"time"

	"audit-service/internal/adapters/repositories"
	"audit-service/internal/adapters/storage"
	"audit-service/internal/core/domain"
	"audit-service/internal/parser"
)

// AuditService handles audit business logic
type AuditService struct {
	repo      repositories.AuditRepository
	s3Client  storage.S3Client
	pdfParser parser.PDFParser
}

// NewAuditService creates a new service instance
func NewAuditService(repo repositories.AuditRepository, s3Client storage.S3Client, pdfParser parser.PDFParser) *AuditService {
	return &AuditService{
		repo:      repo,
		s3Client:  s3Client,
		pdfParser: pdfParser,
	}
}

// ListStores returns all active stores
func (s *AuditService) ListStores(ctx context.Context) ([]domain.Store, error) {
	return s.repo.FindAllStores(ctx)
}

// ParseResult contains the parsed PDF data for preview (no DB save yet)
type ParseResult struct {
	Items      []domain.AuditItem `json:"items"`
	TotalItems int                `json:"total_items"`
	TotalUnits float64            `json:"total_units"`
	TotalValue float64            `json:"total_value"`
}

// ParsePDF parses a PDF and returns items for preview WITHOUT saving to DB
// This implements FASE 3 of the new sequence diagram
func (s *AuditService) ParsePDF(ctx context.Context, pdfData []byte) (*ParseResult, error) {
	// Parse PDF in memory - no database operations
	items, err := s.pdfParser.Parse(pdfData)
	if err != nil {
		return nil, fmt.Errorf("failed to parse PDF: %w", err)
	}

	// Calculate summary stats
	totalUnits := 0.0
	totalValue := 0.0
	for _, item := range items {
		totalUnits += item.ExpectedQty
		totalValue += item.UnitCost * item.ExpectedQty
	}

	return &ParseResult{
		Items:      items,
		TotalItems: len(items),
		TotalUnits: totalUnits,
		TotalValue: totalValue,
	}, nil
}

// CreateAudit is called AFTER user confirms the preview
// This implements FASE 5 of the new sequence diagram
// It saves: Session → S3 → Items (all in transaction)
func (s *AuditService) CreateAudit(ctx context.Context, storeID int, pdfData []byte, createdBy *string) (*domain.AuditDTO, error) {
	// 1. session := NewAuditSession(storeID)
	session := domain.NewAuditSession(storeID, createdBy)

	// 2. repo.InsertSession(session) → session_id
	sessionID, err := s.repo.InsertSession(ctx, session)
	if err != nil {
		return nil, fmt.Errorf("failed to insert session: %w", err)
	}
	session.ID = sessionID

	// 3. s3.PutObject(pdf, key) → s3_key (Private)
	key := fmt.Sprintf("audits/%d/%d.pdf", storeID, time.Now().Unix())
	s3Key, err := s.s3Client.PutObject(ctx, key, pdfData, "application/pdf")
	if err != nil {
		// Rollback: delete the session we just created
		_ = s.repo.DeleteSession(ctx, sessionID)
		return nil, fmt.Errorf("failed to upload PDF: %w", err)
	}

	// 4. items := parser.Parse(pdf)
	items, err := s.pdfParser.Parse(pdfData)
	if err != nil {
		_ = s.repo.DeleteSession(ctx, sessionID)
		return nil, fmt.Errorf("failed to parse PDF: %w", err)
	}

	// 5. repo.SaveAuditBatch(session_id, items, s3_key) with status = IN_PROGRESS
	err = s.repo.SaveAuditBatchWithStatus(ctx, sessionID, items, s3Key, "IN_PROGRESS")
	if err != nil {
		_ = s.repo.DeleteSession(ctx, sessionID)
		return nil, fmt.Errorf("failed to save audit batch: %w", err)
	}

	// Generate Presigned URL for the response
	presignedURL, err := s.s3Client.PresignURL(ctx, s3Key)
	if err != nil {
		// Log error but don't fail, user can refresh
		fmt.Printf("Failed to presign URL: %v\n", err)
		presignedURL = ""
	}

	// 6. Log Event (Audit Trail)
	details := map[string]interface{}{
		"s3_key":      s3Key,
		"items_count": len(items),
		"store_id":    storeID,
	}
	_ = s.repo.LogEvent(ctx, sessionID, createdBy, "AUDIT_CREATED", details)

	// Update session with new data (Response only, DB has key)
	session.Status = "IN_PROGRESS"
	session.PDFURL = &presignedURL // Return valid URL to frontend

	return &domain.AuditDTO{
		Session: *session,
		Items:   items,
	}, nil
}

// ListAudits returns all audit sessions
func (s *AuditService) ListAudits(ctx context.Context) ([]domain.AuditListDTO, error) {
	audits, err := s.repo.FindAllSessions(ctx)
	if err != nil {
		return nil, err
	}

	for i := range audits {
		if audits[i].Session.PDFURL != nil && *audits[i].Session.PDFURL != "" {
			presigned, err := s.s3Client.PresignURL(ctx, *audits[i].Session.PDFURL)
			if err == nil {
				audits[i].Session.PDFURL = &presigned
			}
		}
	}
	return audits, nil
}

// GetAuditByID retrieves an audit with its items
func (s *AuditService) GetAuditByID(ctx context.Context, sessionID int) (*domain.AuditDTO, error) {
	session, err := s.repo.GetSessionByID(ctx, sessionID)
	if err != nil {
		return nil, err
	}

	items, err := s.repo.GetItemsByAuditID(ctx, sessionID)
	if err != nil {
		return nil, err
	}

	// Generate Presigned URL
	if session.PDFURL != nil && *session.PDFURL != "" {
		presigned, err := s.s3Client.PresignURL(ctx, *session.PDFURL)
		if err == nil {
			session.PDFURL = &presigned
		}
	}

	return &domain.AuditDTO{
		Session: *session,
		Items:   items,
	}, nil
}

// DeleteAudit removes an audit session and its items
func (s *AuditService) DeleteAudit(ctx context.Context, sessionID int) error {
	return s.repo.DeleteSession(ctx, sessionID)
}

// ===== Physical Scan Methods for POS App =====

// ListActiveAuditsForPOS returns audits that the POS app can connect to
func (s *AuditService) ListActiveAuditsForPOS(ctx context.Context) ([]domain.AuditListDTO, error) {
	return s.repo.GetActiveAuditsForPOS(ctx)
}

// AddPhysicalScan adds a scan from the POS app
func (s *AuditService) AddPhysicalScan(ctx context.Context, req *domain.AddScanRequest) (*domain.PhysicalScan, error) {
	return s.repo.InsertPhysicalScan(ctx, req)
}

// GetPhysicalScans returns all scans for an audit
func (s *AuditService) GetPhysicalScans(ctx context.Context, auditID int) ([]domain.PhysicalScan, error) {
	return s.repo.GetPhysicalScans(ctx, auditID)
}

// GetPhysicalScanSummary returns summary stats for physical scans
func (s *AuditService) GetPhysicalScanSummary(ctx context.Context, auditID int) (*domain.AuditPhysicalSummary, error) {
	return s.repo.GetPhysicalScanSummary(ctx, auditID)
}

// UndoLastScan deletes the last scan for an audit
func (s *AuditService) UndoLastScan(ctx context.Context, auditID int) error {
	return s.repo.DeleteLastPhysicalScan(ctx, auditID)
}

// GetAudits returns audits for the dashboard following business rules:
// - Scope: Global (all stores)
// - Status: 'waiting_count', 'waiting_valuation' OR 'closed' within last 24 hours
func (s *AuditService) GetAudits(ctx context.Context) ([]domain.AuditListDTO, error) {
	audits, err := s.repo.GetDashboardAudits(ctx)
	if err != nil {
		return nil, err
	}

	for i := range audits {
		if audits[i].Session.PDFURL != nil && *audits[i].Session.PDFURL != "" {
			presigned, err := s.s3Client.PresignURL(ctx, *audits[i].Session.PDFURL)
			if err == nil {
				audits[i].Session.PDFURL = &presigned
			}
		}
	}
	return audits, nil
}

// UpdateAudit handles FASE 6: Updating existing audit (PDF replacement)
func (s *AuditService) UpdateAudit(ctx context.Context, auditID int, pdfData []byte, userID *string) error {
	// 1. Get Session to know StoreID (for S3 key)
	session, err := s.repo.GetSessionByID(ctx, auditID)
	if err != nil {
		return fmt.Errorf("failed to get session: %w", err)
	}

	// 2. Upload new PDF
	// Use _v2 or timestamp to avoid cache issues? Timestamp is safer.
	key := fmt.Sprintf("audits/%d/%d_%d.pdf", session.StoreID, auditID, time.Now().Unix())
	s3Key, err := s.s3Client.PutObject(ctx, key, pdfData, "application/pdf")
	if err != nil {
		return fmt.Errorf("failed to upload PDF: %w", err)
	}

	// 3. Parse PDF
	items, err := s.pdfParser.Parse(pdfData)
	if err != nil {
		return fmt.Errorf("failed to parse PDF: %w", err)
	}

	// 4. Update DB (Transactional: Delete scans, Delete items, Insert items, Update session)
	// We pass s3Key (private) instead of s3URL
	err = s.repo.UpdateAuditTheoretical(ctx, auditID, items, s3Key)
	if err != nil {
		return fmt.Errorf("failed to update audit: %w", err)
	}

	// 5. Log Event
	details := map[string]interface{}{
		"s3_key":      s3Key,
		"items_count": len(items),
		"action":      "PDF_REPLACEMENT",
		"reset_scans": true,
	}
	_ = s.repo.LogEvent(ctx, auditID, userID, "AUDIT_UPDATED", details)

	return nil
}

// GetAuditEvents returns the audit trail with presigned URLs
func (s *AuditService) GetAuditEvents(ctx context.Context, auditID int) ([]domain.AuditEvent, error) {
	events, err := s.repo.GetAuditEvents(ctx, auditID)
	if err != nil {
		return nil, err
	}

	// Enrich events with Presigned URLs if s3_key is present in details
	for i := range events {
		if events[i].Details != nil {
			if key, ok := events[i].Details["s3_key"].(string); ok && key != "" {
				presigned, err := s.s3Client.PresignURL(ctx, key)
				if err == nil {
					// Inject valid URL for frontend to use
					events[i].Details["s3_url"] = presigned
				}
			}
		}
	}

	return events, nil
}
