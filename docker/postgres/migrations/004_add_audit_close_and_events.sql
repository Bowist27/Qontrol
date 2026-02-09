-- Add closed_at column to audits table
ALTER TABLE audit_sessions
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_sessions_closed_at ON audit_sessions (closed_at);

-- Create audit_events table for logging close/reopen actions
CREATE TABLE IF NOT EXISTS audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    audit_id INT REFERENCES audit_sessions (id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'cerrar', 'reabrir'
    previous_status VARCHAR(50),
    new_status VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW ()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_audit_id ON audit_events (audit_id);

CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events (created_at);

COMMENT ON TABLE audit_events IS 'Log of audit status changes (close/reopen actions)';

COMMENT ON COLUMN audit_events.action IS 'Type of action: cerrar or reabrir';

COMMENT ON COLUMN audit_events.previous_status IS 'Status before the action';

COMMENT ON COLUMN audit_events.new_status IS 'Status after the action';