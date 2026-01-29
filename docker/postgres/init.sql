-- Crear tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'admin',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Crear índice para búsquedas por email
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- =====================================================
-- USUARIOS DE PRUEBA
-- =====================================================
-- Salt: qontrolsalt12345 (16 bytes)
-- Hashes generados con Argon2id: m=65536, t=3, p=4, keyLen=32
-- Usuario Admin: jose.admin@gmail.com / Admin123!
INSERT INTO
    users (email, password_hash, role, is_active)
VALUES
    (
        'jose.admin@gmail.com',
        '$argon2id$v=19$m=65536,t=3,p=4$cW9udHJvbHNhbHQxMjM0NQ$nbTtxV/jtxikvwgKIVDxWIIszfPPL/ZBvtNU5AiaTH4',
        'admin',
        true
    ) ON CONFLICT (email) DO NOTHING;

-- Usuario Regular: test.user@hotmail.com / Test1234!
INSERT INTO
    users (email, password_hash, role, is_active)
VALUES
    (
        'test.user@hotmail.com',
        '$argon2id$v=19$m=65536,t=3,p=4$cW9udHJvbHNhbHQxMjM0NQ$8OKPOMEHMpMjbT0ADTgZ9i23sxdvLJLZYGV0X5kj08Y',
        'user',
        true
    ) ON CONFLICT (email) DO NOTHING;

-- Usuario Inactivo: inactive@gmail.com / Inactive123!
INSERT INTO
    users (email, password_hash, role, is_active)
VALUES
    (
        'inactive@gmail.com',
        '$argon2id$v=19$m=65536,t=3,p=4$cW9udHJvbHNhbHQxMjM0NQ$DPGehdPjWaWK2+lR2HAbQ7wp/GoRwh/caZQrbTtxV/g',
        'admin',
        false
    ) ON CONFLICT (email) DO NOTHING;

-- =====================================================
-- STORES (Tiendas)
-- =====================================================
CREATE TABLE IF NOT EXISTS stores (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    status BOOLEAN DEFAULT true,
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO
    stores (name, status)
VALUES
    ('Celaya Centro', true),
    ('Dolores Hidalgo', true),
    ('San Miguel de Allende', true),
    ('Salamanca', true),
    ('Salvatierra', false),
    ('Irapuato Norte', true),
    ('León Centro', true) ON CONFLICT DO NOTHING;

-- =====================================================
-- AUDIT SESSIONS (Sesiones de Auditoría)
-- =====================================================
CREATE TABLE IF NOT EXISTS audit_sessions (
    id SERIAL PRIMARY KEY,
    store_id INT NOT NULL REFERENCES stores (id),
    created_by UUID REFERENCES users (id),
    status VARCHAR(20) DEFAULT 'UPLOADING',
    reference_date DATE,
    pdf_url VARCHAR(500),
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        closed_at TIMESTAMP
    WITH
        TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_audit_sessions_store ON audit_sessions (store_id);

CREATE INDEX IF NOT EXISTS idx_audit_sessions_status ON audit_sessions (status);

-- =====================================================
-- AUDIT THEORETICAL (Items del PDF)
-- =====================================================
CREATE TABLE IF NOT EXISTS audit_theoretical (
    id SERIAL PRIMARY KEY,
    audit_id INT NOT NULL REFERENCES audit_sessions (id) ON DELETE CASCADE,
    product_code VARCHAR(50) NOT NULL,
    product_name VARCHAR(255),
    unit_cost DECIMAL(10, 2),
    last_purchase DATE,
    expected_qty DECIMAL(10, 3) NOT NULL,
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_theoretical_audit ON audit_theoretical (audit_id);

CREATE INDEX IF NOT EXISTS idx_audit_theoretical_code ON audit_theoretical (product_code);

-- =====================================================
-- AUDIT PHYSICAL (Escaneos desde App - para futuro)
-- =====================================================
CREATE TABLE IF NOT EXISTS audit_physical (
    id SERIAL PRIMARY KEY,
    audit_id INT NOT NULL REFERENCES audit_sessions (id) ON DELETE CASCADE,
    barcode VARCHAR(50) NOT NULL,
    quantity DECIMAL(10, 3) DEFAULT 1,
    scanned_by UUID REFERENCES users (id),
    device_id VARCHAR(100),
    scanned_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_physical_audit ON audit_physical (audit_id);