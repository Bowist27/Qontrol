-- Migration 009: Add user_zones table for zone-based access control
-- Users can be assigned zones (which grant access to all stores in that zone)
-- AND/OR individual stores via user_stores

CREATE TABLE IF NOT EXISTS user_zones (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    zone_id INTEGER NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, zone_id)
);

CREATE INDEX IF NOT EXISTS idx_user_zones_user_id ON user_zones(user_id);
CREATE INDEX IF NOT EXISTS idx_user_zones_zone_id ON user_zones(zone_id);
