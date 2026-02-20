package services

import (
	"context"
	"fmt"

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

// ListStores returns stores filtered by user's assignments
// Admins see all active stores; other roles see only assigned stores
func (s *AuditService) ListStores(ctx context.Context, userID string, role string) ([]domain.Store, error) {
	if role == "Administrador" {
		return s.repo.FindAllStores(ctx)
	}
	storeIDs, err := s.repo.GetUserStoreIDs(ctx, userID)
	if err != nil {
		return nil, err
	}
	if len(storeIDs) == 0 {
		return []domain.Store{}, nil
	}
	return s.repo.FindStoresByIDs(ctx, storeIDs)
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
func (s *AuditService) CreateAudit(ctx context.Context, storeID int, pdfData []byte, createdBy *string, originalFilename string, name *string) (*domain.AuditDTO, error) {
	// 1. session := NewAuditSession(storeID)
	session := domain.NewAuditSession(storeID, createdBy, name)

	// 2. repo.InsertSession(session) → session_id
	sessionID, err := s.repo.InsertSession(ctx, session)
	if err != nil {
		return nil, fmt.Errorf("failed to insert session: %w", err)
	}
	session.ID = sessionID

	// 3. s3.PutObject(pdf, key) → s3_key (Private)
	// STRICT PRESERVATION: Use a folder per audit to safely keep original filename
	// Key format: audits/{store_id}/{audit_id}/{original_filename}
	// We only sanitize '/' to avoid creating extra subfolders/traversal
	cleanName := sanitizeFilenameStrict(originalFilename)
	if cleanName == "" {
		cleanName = "audit_file.pdf"
	}
	key := fmt.Sprintf("audits/%d/%d/%s", storeID, sessionID, cleanName)

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

// DeleteAudit deletes an audit by ID
func (s *AuditService) DeleteAudit(ctx context.Context, id int) error {
	return s.repo.Delete(ctx, id)
}

// CloseAudit closes an audit and logs the event
func (s *AuditService) CloseAudit(ctx context.Context, auditID int, userID string) error {
	return s.repo.CloseAudit(ctx, auditID, userID)
}

// ReopenAudit reopens a closed audit and logs the event
func (s *AuditService) ReopenAudit(ctx context.Context, auditID int, userID string) error {
	return s.repo.ReopenAudit(ctx, auditID, userID)
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

// ModifyProductQuantity updates the total quantity for a product in an audit
func (s *AuditService) ModifyProductQuantity(ctx context.Context, auditID int, barcode string, newQuantity float64) error {
	return s.repo.ModifyProductQuantity(ctx, auditID, barcode, newQuantity)
}

// GetAudits returns audits for the dashboard following business rules:
// - Admins see all audits (global scope)
// - Other roles see only audits from their assigned stores
func (s *AuditService) GetAudits(ctx context.Context, userID string, role string) ([]domain.AuditListDTO, error) {
	var audits []domain.AuditListDTO
	var err error

	// Admins see everything
	if role == "Administrador" {
		audits, err = s.repo.GetDashboardAudits(ctx)
	} else {
		// Get the user's assigned store IDs
		storeIDs, storeErr := s.repo.GetUserStoreIDs(ctx, userID)
		if storeErr != nil {
			return nil, storeErr
		}
		if len(storeIDs) == 0 {
			return []domain.AuditListDTO{}, nil
		}
		audits, err = s.repo.GetDashboardAuditsByStores(ctx, storeIDs)
	}
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
func (s *AuditService) UpdateAudit(ctx context.Context, auditID int, pdfData []byte, userID *string, originalFilename string) error {
	// 1. Get Session to know StoreID (for S3 key)
	session, err := s.repo.GetSessionByID(ctx, auditID)
	if err != nil {
		return fmt.Errorf("failed to get session: %w", err)
	}

	// 2. Upload new PDF
	// STRICT PRESERVATION: Use folder per audit
	cleanName := sanitizeFilenameStrict(originalFilename)
	if cleanName == "" {
		cleanName = "audit_update.pdf"
	}
	// To avoid caching if updating same file, we could append timestamp, but user requested exact name.
	// We rely on S3 overwriting the file if it exists.
	// But to be safe and allow "History" of uploads in same audit if we wanted,
	// we will stick to the folder structure: audits/{store_id}/{audit_id}/{filename}
	// If user uploads exact same name, it overwrites. This is expected behavior for "Preserve name".
	key := fmt.Sprintf("audits/%d/%d/%s", session.StoreID, auditID, cleanName)

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

// sanitizeFilenameStrict only replaces forward slashes to prevent directory traversal.
// It allows spaces, special chars, etc. as requested by user.
func sanitizeFilenameStrict(filename string) string {
	// Just replace path separators
	var result []rune
	for _, r := range filename {
		if r == '/' || r == '\\' {
			result = append(result, '_')
		} else {
			result = append(result, r)
		}
	}
	return string(result)
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

// CreateAuditFromPOS creates an empty audit session from the POS app (no PDF required)
func (s *AuditService) CreateAuditFromPOS(ctx context.Context, storeID int, createdBy *string, name *string) (*domain.AuditSession, error) {
	session, err := s.repo.CreateEmptyAuditSession(ctx, storeID, createdBy, name)
	if err != nil {
		return nil, fmt.Errorf("failed to create audit from POS: %w", err)
	}

	// Log the event
	details := map[string]interface{}{
		"store_id":   storeID,
		"created_by": createdBy,
		"source":     "POS",
	}
	_ = s.repo.LogEvent(ctx, session.ID, createdBy, "AUDIT_CREATED_FROM_POS", details)

	return session, nil
}

// RequestReopenAudit creates a reopen request from the POS app
func (s *AuditService) RequestReopenAudit(ctx context.Context, auditID int, requestedBy, deviceID, reason string) (*domain.ReopenRequest, error) {
	// Verify audit exists and is finalized
	session, err := s.repo.GetSessionByID(ctx, auditID)
	if err != nil {
		return nil, fmt.Errorf("audit not found: %w", err)
	}
	if session.Status != "finalizado" {
		return nil, fmt.Errorf("audit is not finalized, current status: %s", session.Status)
	}

	req, err := s.repo.InsertReopenRequest(ctx, auditID, requestedBy, deviceID, reason)
	if err != nil {
		return nil, err
	}

	// Log the event
	details := map[string]interface{}{
		"request_id":   req.ID,
		"requested_by": requestedBy,
		"device_id":    deviceID,
		"reason":       reason,
	}
	_ = s.repo.LogEvent(ctx, auditID, &requestedBy, "REOPEN_REQUESTED", details)

	return req, nil
}

// GetPendingReopenRequests returns pending reopen requests filtered by user's stores
func (s *AuditService) GetPendingReopenRequests(ctx context.Context, userID string, role string) ([]domain.ReopenRequest, error) {
	if role == "Administrador" {
		return s.repo.GetPendingReopenRequests(ctx)
	}
	storeIDs, err := s.repo.GetUserStoreIDs(ctx, userID)
	if err != nil {
		return nil, err
	}
	if len(storeIDs) == 0 {
		return []domain.ReopenRequest{}, nil
	}
	return s.repo.GetPendingReopenRequestsByStores(ctx, storeIDs)
}

// GetPendingReopenRequestsForAudit returns pending reopen requests for a specific audit
func (s *AuditService) GetPendingReopenRequestsForAudit(ctx context.Context, auditID int) ([]domain.ReopenRequest, error) {
	return s.repo.GetPendingReopenRequestsForAudit(ctx, auditID)
}
