-- Migration 005: Add manual product changes tracking
-- This table tracks individual product changes (create, update, delete) made manually

CREATE TABLE IF NOT EXISTS product_changes (
    id SERIAL PRIMARY KEY,
    product_id INTEGER,
    product_sku VARCHAR(50) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('create', 'update', 'delete')),
    old_values JSONB,
    new_values JSONB,
    user_email VARCHAR(255) NOT NULL DEFAULT 'Sistema',
    user_name VARCHAR(255) NOT NULL DEFAULT 'Sistema',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_product_changes_created_at ON product_changes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_changes_action ON product_changes(action);
CREATE INDEX IF NOT EXISTS idx_product_changes_product_sku ON product_changes(product_sku);
