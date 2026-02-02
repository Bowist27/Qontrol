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

	// 3. s3.PutObject(pdf, key) → s3_url
	key := fmt.Sprintf("audits/%d/%d.pdf", storeID, time.Now().Unix())
	s3URL, err := s.s3Client.PutObject(ctx, key, pdfData, "application/pdf")
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

	// 5. repo.SaveAuditBatch(session_id, items, s3_url) with status = IN_PROGRESS
	err = s.repo.SaveAuditBatchWithStatus(ctx, sessionID, items, s3URL, "IN_PROGRESS")
	if err != nil {
		_ = s.repo.DeleteSession(ctx, sessionID)
		return nil, fmt.Errorf("failed to save audit batch: %w", err)
	}

	// Update session with new data
	session.Status = "IN_PROGRESS"
	session.PDFURL = &s3URL

	return &domain.AuditDTO{
		Session: *session,
		Items:   items,
	}, nil
}

// ListAudits returns all audit sessions
func (s *AuditService) ListAudits(ctx context.Context) ([]domain.AuditListDTO, error) {
	return s.repo.FindAllSessions(ctx)
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
