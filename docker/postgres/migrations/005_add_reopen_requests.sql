-- Add reopen_requests table for POS reopen request workflow
CREATE TABLE IF NOT EXISTS reopen_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    audit_id INT REFERENCES audit_sessions (id) ON DELETE CASCADE,
    requested_by VARCHAR(255) NOT NULL,
    device_id VARCHAR(100),
    reason TEXT,
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected
    created_at TIMESTAMP DEFAULT NOW (),
    resolved_at TIMESTAMP,
    resolved_by VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_reopen_requests_audit_id ON reopen_requests (audit_id);

CREATE INDEX IF NOT EXISTS idx_reopen_requests_status ON reopen_requests (status);