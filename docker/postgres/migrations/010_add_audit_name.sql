-- Migration 010: Add custom name field to audit_sessions
-- Allows users to give audits a custom name instead of just the store name

ALTER TABLE audit_sessions ADD COLUMN IF NOT EXISTS name VARCHAR(200) DEFAULT NULL;

-- Add a comment for documentation
COMMENT ON COLUMN audit_sessions.name IS 'Optional custom name for the audit, set by user during creation';
