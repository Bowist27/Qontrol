-- Migration 007: Change zones from single supervisor to multiple supervisors
-- Allows multiple supervisors per zone (many-to-many relationship)

-- Create zone_supervisors junction table
CREATE TABLE IF NOT EXISTS zone_supervisors (
    id SERIAL PRIMARY KEY,
    zone_id INTEGER NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(zone_id, user_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_zone_supervisors_zone_id ON zone_supervisors(zone_id);
CREATE INDEX IF NOT EXISTS idx_zone_supervisors_user_id ON zone_supervisors(user_id);

-- Migrate existing supervisor_id data to the new table
INSERT INTO zone_supervisors (zone_id, user_id)
SELECT id, supervisor_id FROM zones WHERE supervisor_id IS NOT NULL
ON CONFLICT (zone_id, user_id) DO NOTHING;

-- Remove the old supervisor_id column from zones
ALTER TABLE zones DROP COLUMN IF EXISTS supervisor_id;

COMMENT ON TABLE zone_supervisors IS 'Junction table for many-to-many relationship between zones and supervisors';
