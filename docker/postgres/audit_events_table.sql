-- Tabla para Bitácora de Eventos de Auditoría (Audit Log)
-- Ejecutar en la base de datos PostgreSQL
CREATE TABLE IF NOT EXISTS audit_events (
    id SERIAL PRIMARY KEY,
    audit_id INT NOT NULL REFERENCES audit_sessions (id) ON DELETE CASCADE,
    user_id UUID REFERENCES users (id), -- Nullable en caso de usuario sistema o borrado
    event_type VARCHAR(50) NOT NULL, -- Ej: 'CREATED', 'UPDATED_PDF', 'CLOSED', 'POS_CONNECTED'
    details JSONB, -- Detalles adicionales (ej. nombre de archivo, URL, IP)
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_events_audit ON audit_events (audit_id);