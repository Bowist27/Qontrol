package repositories

import (
	"context"
	"fmt"
)

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

	// Log the close event
	_, err = tx.ExecContext(ctx, `
		INSERT INTO audit_events (audit_id, user_id, action, previous_status, new_status)
		VALUES ($1, $2, 'cerrar', $3, 'finalizado')
	`, auditID, userID, previousStatus)
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

	// Update audit status to 'activa' and clear closed_at
	_, err = tx.ExecContext(ctx, `
		UPDATE audit_sessions 
		SET status = 'IN_PROGRESS', 
			closed_at = NULL
		WHERE id = $1
	`, auditID)
	if err != nil {
		return fmt.Errorf("failed to reopen audit: %w", err)
	}

	// Log the reopen event
	_, err = tx.ExecContext(ctx, `
		INSERT INTO audit_events (audit_id, user_id, action, previous_status, new_status)
		VALUES ($1, $2, 'reabrir', $3, 'IN_PROGRESS')
	`, auditID, userID, previousStatus)
	if err != nil {
		return fmt.Errorf("failed to log reopen event: %w", err)
	}

	return tx.Commit()
}

// Delete is an alias for DeleteSession for consistency with service layer
func (r *PostgresRepository) Delete(ctx context.Context, auditID int) error {
	return r.DeleteSession(ctx, auditID)
}
