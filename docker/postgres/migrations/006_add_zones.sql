-- Migration 006: Add zones (regiones) for store management
-- Zones are like "roles" for stores - they define supervisor and pricing rules

-- Create price_lists table for different pricing strategies
CREATE TABLE IF NOT EXISTS price_lists (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    adjustment_percent DECIMAL(5,2) DEFAULT 0.00, -- e.g., +5%, -2%
    description VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Insert default price lists
INSERT INTO price_lists (name, adjustment_percent, description) VALUES
    ('Estándar', 0.00, 'Precios base sin ajuste'),
    ('Frontera (+5%)', 5.00, 'Precios para zonas fronterizas'),
    ('Turística (+15%)', 15.00, 'Precios para zonas turísticas'),
    ('Bajío (-2%)', -2.00, 'Precios competitivos para el Bajío')
ON CONFLICT DO NOTHING;

-- Create zones table
CREATE TABLE IF NOT EXISTS zones (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    supervisor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    price_list_id INTEGER REFERENCES price_lists(id) ON DELETE SET NULL,
    status BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Add zone_id to stores table
ALTER TABLE stores ADD COLUMN IF NOT EXISTS zone_id INTEGER REFERENCES zones(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_stores_zone_id ON stores(zone_id);

-- Insert some default zones based on existing data patterns
INSERT INTO zones (name, price_list_id, status) VALUES
    ('Ciudad Hidalgo', 1, true),
    ('Moroleón', 1, true),
    ('San Miguel de Allende', 3, true),
    ('La Piedad', 4, true)
ON CONFLICT (name) DO NOTHING;
