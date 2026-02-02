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

-- =====================================================
-- PRODUCTS (Catálogo Maestro de Productos)
-- =====================================================
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(50) UNIQUE NOT NULL,
    barcode VARCHAR(50),
    name VARCHAR(255) NOT NULL,
    unit VARCHAR(20) DEFAULT 'pz',
    last_price DECIMAL(10, 2),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    source VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_sku ON products (sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products (barcode);

-- =====================================================
-- CATALOG IMPORTS (Historial de Importaciones)
-- =====================================================
CREATE TABLE IF NOT EXISTS catalog_imports (
    id SERIAL PRIMARY KEY,
    file_name VARCHAR(255) NOT NULL,
    store_id INT REFERENCES stores(id),
    store_name VARCHAR(100),
    imported_by UUID REFERENCES users(id),
    imported_by_name VARCHAR(100),
    import_date DATE DEFAULT CURRENT_DATE,
    new_products INT DEFAULT 0,
    price_up_count INT DEFAULT 0,
    price_down_count INT DEFAULT 0,
    unchanged_count INT DEFAULT 0,
    total_value DECIMAL(14, 2) DEFAULT 0,
    previous_value DECIMAL(14, 2) DEFAULT 0,
    economic_impact_up DECIMAL(14, 2) DEFAULT 0,
    economic_impact_down DECIMAL(14, 2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    applied_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_catalog_imports_store ON catalog_imports (store_id);
CREATE INDEX IF NOT EXISTS idx_catalog_imports_date ON catalog_imports (created_at DESC);

-- =====================================================
-- CATALOG IMPORT ITEMS (Detalle de Cambios)
-- =====================================================
CREATE TABLE IF NOT EXISTS catalog_import_items (
    id SERIAL PRIMARY KEY,
    import_id INT NOT NULL REFERENCES catalog_imports(id) ON DELETE CASCADE,
    sku VARCHAR(50) NOT NULL,
    product_name VARCHAR(255),
    change_type VARCHAR(20) NOT NULL, -- 'new', 'price_up', 'price_down'
    old_price DECIMAL(10, 2),
    new_price DECIMAL(10, 2) NOT NULL,
    difference DECIMAL(10, 2) NOT NULL,
    percent_change DECIMAL(5, 2),
    selected BOOLEAN DEFAULT true,
    applied BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_catalog_import_items_import ON catalog_import_items (import_id);
CREATE INDEX IF NOT EXISTS idx_catalog_import_items_sku ON catalog_import_items (sku);

-- =====================================================
-- INITIAL CATALOG DATA (Datos Base del Catálogo)
-- =====================================================
-- Productos iniciales del catálogo maestro (simulando LISTADF inicial)
INSERT INTO products (sku, barcode, name, unit, last_price, source) VALUES
    ('001', '7501234567890', 'ACEITE VEGETAL 1L', 'pz', 45.50, 'LISTADF_INICIAL'),
    ('002', '7501234567891', 'ARROZ GRANO LARGO 1KG', 'kg', 28.00, 'LISTADF_INICIAL'),
    ('003', '7501234567892', 'AZUCAR ESTANDAR 1KG', 'kg', 32.50, 'LISTADF_INICIAL'),
    ('004', '7501234567893', 'FRIJOL NEGRO 1KG', 'kg', 38.00, 'LISTADF_INICIAL'),
    ('005', '7501234567894', 'HARINA DE TRIGO 1KG', 'kg', 22.00, 'LISTADF_INICIAL'),
    ('006', '7501234567895', 'LECHE ENTERA 1L', 'pz', 26.50, 'LISTADF_INICIAL'),
    ('007', '7501234567896', 'SAL DE MESA 1KG', 'kg', 15.00, 'LISTADF_INICIAL'),
    ('008', '7501234567897', 'CAFE SOLUBLE 200G', 'pz', 89.00, 'LISTADF_INICIAL'),
    ('009', '7501234567898', 'GALLETAS MARIAS 500G', 'pz', 35.00, 'LISTADF_INICIAL'),
    ('010', '7501234567899', 'ATUN EN AGUA 140G', 'pz', 24.50, 'LISTADF_INICIAL'),
    ('011', '7501234567900', 'MAYONESA 400G', 'pz', 52.00, 'LISTADF_INICIAL'),
    ('012', '7501234567901', 'PASTA SPAGHETTI 500G', 'pz', 18.50, 'LISTADF_INICIAL'),
    ('013', '7501234567902', 'SALSA DE TOMATE 400G', 'pz', 28.00, 'LISTADF_INICIAL'),
    ('014', '7501234567903', 'CREMA ACIDA 200G', 'pz', 22.00, 'LISTADF_INICIAL'),
    ('015', '7501234567904', 'QUESO PANELA 400G', 'pz', 78.00, 'LISTADF_INICIAL'),
    ('016', '7501234567905', 'JAMON DE PAVO 250G', 'pz', 65.00, 'LISTADF_INICIAL'),
    ('017', '7501234567906', 'PAN BLANCO 680G', 'pz', 42.00, 'LISTADF_INICIAL'),
    ('018', '7501234567907', 'MANTEQUILLA 90G', 'pz', 35.50, 'LISTADF_INICIAL'),
    ('019', '7501234567908', 'HUEVO 30PZ', 'cja', 98.00, 'LISTADF_INICIAL'),
    ('020', '7501234567909', 'CEREAL HOJUELAS 500G', 'pz', 68.00, 'LISTADF_INICIAL')
ON CONFLICT (sku) DO NOTHING;

-- Registro de la importación inicial
INSERT INTO catalog_imports (
    file_name, 
    store_name, 
    imported_by_name, 
    import_date, 
    new_products, 
    price_up_count, 
    price_down_count, 
    unchanged_count,
    total_value,
    previous_value,
    status,
    applied_at
) VALUES (
    'LISTADF_INICIAL.xlsx',
    'Sistema',
    'Administrador',
    '2026-01-15',
    20,
    0,
    0,
    0,
    937.00,
    0,
    'applied',
    '2026-01-15 10:00:00'
) ON CONFLICT DO NOTHING;