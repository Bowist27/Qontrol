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

// CreateAudit implements the full audit creation flow from the sequence diagram
func (s *AuditService) CreateAudit(ctx context.Context, storeID int, pdfData []byte, createdBy *string) (*domain.AuditDTO, error) {
	// 1. session := NewAuditSession(storeID)
	session := domain.NewAuditSession(storeID, createdBy)

	// 2. repo.InsertSession(session) → session_id
	sessionID, err := s.repo.InsertSession(ctx, session)
	if err != nil {
		return nil, fmt.Errorf("failed to insert session: %w", err)
	}
	session.ID = sessionID

	// 3. s3.PutObject(pdf, key) → s3_url (or ERROR)
	key := fmt.Sprintf("audits/%d/%d.pdf", storeID, time.Now().Unix())
	s3URL, err := s.s3Client.PutObject(ctx, key, pdfData, "application/pdf")
	if err != nil {
		// Update status to ERROR
		_ = s.repo.UpdateSessionStatus(ctx, sessionID, "ERROR")
		return nil, fmt.Errorf("failed to upload PDF: %w", err)
	}

	// 4. items := parser.Parse(pdf)
	items, err := s.pdfParser.Parse(pdfData)
	if err != nil {
		_ = s.repo.UpdateSessionStatus(ctx, sessionID, "ERROR")
		return nil, fmt.Errorf("failed to parse PDF: %w", err)
	}

	// 5. repo.SaveAuditBatch(session_id, items, s3_url) ← TRANSACTION
	err = s.repo.SaveAuditBatch(ctx, sessionID, items, s3URL)
	if err != nil {
		_ = s.repo.UpdateSessionStatus(ctx, sessionID, "ERROR")
		return nil, fmt.Errorf("failed to save audit batch: %w", err)
	}

	// Update session with new data
	session.Status = "REVIEW_PENDING"
	session.PDFURL = &s3URL

	return &domain.AuditDTO{
		Session: *session,
		Items:   items,
	}, nil
}

// ConfirmAudit changes status to IN_PROGRESS
func (s *AuditService) ConfirmAudit(ctx context.Context, sessionID int) error {
	// Verify session exists and is in REVIEW_PENDING status
	session, err := s.repo.GetSessionByID(ctx, sessionID)
	if err != nil {
		return fmt.Errorf("session not found: %w", err)
	}

	if session.Status != "REVIEW_PENDING" {
		return fmt.Errorf("session is not in REVIEW_PENDING status, current: %s", session.Status)
	}

	return s.repo.UpdateSessionStatus(ctx, sessionID, "IN_PROGRESS")
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
