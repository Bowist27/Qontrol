package repositories

import (
	"context"
	"fmt"
	"regexp"
)

var uuidRegex = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// CloseAudit closes an audit and logs the event in a transaction
func (r *PostgresRepository) CloseAudit(ctx context.Context, auditID int, userID string) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Get current status before updating
	var previousStatus string
	err = tx.QueryRowContext(ctx, `
		SELECT status FROM audit_sessions WHERE id = $1
	`, auditID).Scan(&previousStatus)
	if err != nil {
		return fmt.Errorf("failed to get current status: %w", err)
	}

	// Update audit status to 'finalizado' and set closed_at
	_, err = tx.ExecContext(ctx, `
		UPDATE audit_sessions 
		SET status = 'finalizado', 
			closed_at = NOW()
		WHERE id = $1
	`, auditID)
	if err != nil {
		return fmt.Errorf("failed to close audit: %w", err)
	}

	// Log the close event — user_id is UUID; if it's not a valid UUID (POS device), store as NULL with details
	var parsedUID interface{}
	var details interface{}
	if uuidRegex.MatchString(userID) {
		parsedUID = userID
		details = nil
	} else {
		parsedUID = nil
		details = fmt.Sprintf(`{"closed_by":"%s"}`, userID)
	}

	_, err = tx.ExecContext(ctx, `
		INSERT INTO audit_events (audit_id, user_id, action, previous_status, new_status, details)
		VALUES ($1, $2, 'cerrar', $3, 'finalizado', $4)
	`, auditID, parsedUID, previousStatus, details)
	if err != nil {
		return fmt.Errorf("failed to log close event: %w", err)
	}

	return tx.Commit()
}

// ReopenAudit reopens a closed audit and logs the event in a transaction
func (r *PostgresRepository) ReopenAudit(ctx context.Context, auditID int, userID string) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Get current status before updating
	var previousStatus string
	err = tx.QueryRowContext(ctx, `
		SELECT status FROM audit_sessions WHERE id = $1
	`, auditID).Scan(&previousStatus)
	if err != nil {
		return fmt.Errorf("failed to get current status: %w", err)
	}

	// Check if there are existing physical scans — if so, set COUNTING instead of IN_PROGRESS
	var scanCount int
	err = tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM audit_physical WHERE audit_id = $1`, auditID).Scan(&scanCount)
	if err != nil {
		return fmt.Errorf("failed to check scan count: %w", err)
	}
	newStatus := "IN_PROGRESS"
	if scanCount > 0 {
		newStatus = "COUNTING"
	}

	// Update audit status and clear closed_at
	_, err = tx.ExecContext(ctx, `
		UPDATE audit_sessions 
		SET status = $2, 
			closed_at = NULL
		WHERE id = $1
	`, auditID, newStatus)
	if err != nil {
		return fmt.Errorf("failed to reopen audit: %w", err)
	}

	// Resolve any pending reopen requests for this audit
	_, _ = tx.ExecContext(ctx, `
		UPDATE reopen_requests 
		SET status = 'approved', resolved_by = $2, resolved_at = NOW()
		WHERE audit_id = $1 AND status = 'pending'
	`, auditID, userID)

	// Log the reopen event
	_, err = tx.ExecContext(ctx, `
		INSERT INTO audit_events (audit_id, user_id, action, previous_status, new_status)
		VALUES ($1, $2, 'reabrir', $3, $4)
	`, auditID, userID, previousStatus, newStatus)
	if err != nil {
		return fmt.Errorf("failed to log reopen event: %w", err)
	}

	return tx.Commit()
}

// Delete is an alias for DeleteSession for consistency with service layer
func (r *PostgresRepository) Delete(ctx context.Context, auditID int) error {
	return r.DeleteSession(ctx, auditID)
}
