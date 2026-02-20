package repositories

import (
	"context"
	"fmt"
	"strings"
	"time"

	"audit-service/internal/core/domain"
)

// InsertReopenRequest creates a new reopen request from POS
func (r *PostgresRepository) InsertReopenRequest(ctx context.Context, auditID int, requestedBy, deviceID, reason string) (*domain.ReopenRequest, error) {
	var req domain.ReopenRequest
	err := r.db.QueryRowContext(ctx, `
		INSERT INTO reopen_requests (audit_id, requested_by, device_id, reason)
		VALUES ($1, $2, $3, $4)
		RETURNING id, audit_id, requested_by, device_id, reason, status, created_at
	`, auditID, requestedBy, deviceID, reason).Scan(
		&req.ID, &req.AuditID, &req.RequestedBy, &req.DeviceID,
		&req.Reason, &req.Status, &req.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to insert reopen request: %w", err)
	}
	return &req, nil
}

// GetPendingReopenRequests returns all pending reopen requests (for web-admin)
func (r *PostgresRepository) GetPendingReopenRequests(ctx context.Context) ([]domain.ReopenRequest, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT rr.id, rr.audit_id, rr.requested_by, rr.device_id, rr.reason, rr.status, rr.created_at,
			   COALESCE(s.name, 'Desconocida') as store_name
		FROM reopen_requests rr
		JOIN audit_sessions a ON a.id = rr.audit_id
		LEFT JOIN stores s ON s.id = a.store_id
		WHERE rr.status = 'pending'
		ORDER BY rr.created_at DESC
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to get pending reopen requests: %w", err)
	}
	defer rows.Close()

	var requests []domain.ReopenRequest
	for rows.Next() {
		var req domain.ReopenRequest
		err := rows.Scan(&req.ID, &req.AuditID, &req.RequestedBy, &req.DeviceID,
			&req.Reason, &req.Status, &req.CreatedAt, &req.StoreName)
		if err != nil {
			return nil, fmt.Errorf("failed to scan reopen request: %w", err)
		}
		requests = append(requests, req)
	}
	return requests, nil
}

// GetPendingReopenRequestsForAudit returns pending reopen requests for a specific audit
func (r *PostgresRepository) GetPendingReopenRequestsForAudit(ctx context.Context, auditID int) ([]domain.ReopenRequest, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT rr.id, rr.audit_id, rr.requested_by, rr.device_id, rr.reason, rr.status, rr.created_at,
			   COALESCE(s.name, 'Desconocida') as store_name
		FROM reopen_requests rr
		JOIN audit_sessions a ON a.id = rr.audit_id
		LEFT JOIN stores s ON s.id = a.store_id
		WHERE rr.audit_id = $1 AND rr.status = 'pending'
		ORDER BY rr.created_at DESC
	`, auditID)
	if err != nil {
		return nil, fmt.Errorf("failed to get reopen requests for audit: %w", err)
	}
	defer rows.Close()

	var requests []domain.ReopenRequest
	for rows.Next() {
		var req domain.ReopenRequest
		err := rows.Scan(&req.ID, &req.AuditID, &req.RequestedBy, &req.DeviceID,
			&req.Reason, &req.Status, &req.CreatedAt, &req.StoreName)
		if err != nil {
			return nil, fmt.Errorf("failed to scan reopen request: %w", err)
		}
		requests = append(requests, req)
	}
	return requests, nil
}

// GetPendingReopenRequestsByStores returns pending reopen requests filtered by store IDs
func (r *PostgresRepository) GetPendingReopenRequestsByStores(ctx context.Context, storeIDs []int) ([]domain.ReopenRequest, error) {
	if len(storeIDs) == 0 {
		return []domain.ReopenRequest{}, nil
	}
	placeholders := make([]string, len(storeIDs))
	args := make([]interface{}, len(storeIDs))
	for i, id := range storeIDs {
		placeholders[i] = fmt.Sprintf("$%d", i+1)
		args[i] = id
	}
	query := fmt.Sprintf(`
		SELECT rr.id, rr.audit_id, rr.requested_by, rr.device_id, rr.reason, rr.status, rr.created_at,
			   COALESCE(s.name, 'Desconocida') as store_name
		FROM reopen_requests rr
		JOIN audit_sessions a ON a.id = rr.audit_id
		LEFT JOIN stores s ON s.id = a.store_id
		WHERE rr.status = 'pending' AND a.store_id IN (%s)
		ORDER BY rr.created_at DESC
	`, strings.Join(placeholders, ", "))
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to get pending reopen requests by stores: %w", err)
	}
	defer rows.Close()
	var requests []domain.ReopenRequest
	for rows.Next() {
		var req domain.ReopenRequest
		err := rows.Scan(&req.ID, &req.AuditID, &req.RequestedBy, &req.DeviceID,
			&req.Reason, &req.Status, &req.CreatedAt, &req.StoreName)
		if err != nil {
			return nil, fmt.Errorf("failed to scan reopen request: %w", err)
		}
		requests = append(requests, req)
	}
	return requests, nil
}

// ResolveReopenRequest marks a reopen request as approved or rejected
func (r *PostgresRepository) ResolveReopenRequest(ctx context.Context, requestID string, resolvedBy string, status string) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE reopen_requests 
		SET status = $1, resolved_by = $2, resolved_at = $3
		WHERE id = $4 AND status = 'pending'
	`, status, resolvedBy, time.Now(), requestID)
	if err != nil {
		return fmt.Errorf("failed to resolve reopen request: %w", err)
	}
	return nil
}

// CreateEmptyAuditSession creates an audit session from POS without PDF/items
func (r *PostgresRepository) CreateEmptyAuditSession(ctx context.Context, storeID int, createdBy string) (*domain.AuditSession, error) {
	var session domain.AuditSession
	err := r.db.QueryRowContext(ctx, `
		INSERT INTO audit_sessions (store_id, created_by, status, created_at)
		VALUES ($1, $2, 'IN_PROGRESS', NOW())
		RETURNING id, store_id, created_by, status, created_at
	`, storeID, createdBy).Scan(
		&session.ID, &session.StoreID, &session.CreatedBy,
		&session.Status, &session.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create empty audit session: %w", err)
	}
	return &session, nil
}
