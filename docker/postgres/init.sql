-- =====================================================
-- QONTROL DATABASE SCHEMA
-- Version 2.1 - With IAM + Custom Roles
-- =====================================================

-- =====================================================
-- ROLES (Roles Personalizables) - Must be created first
-- =====================================================
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description VARCHAR(255),
    permissions TEXT[] DEFAULT '{}',
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- USERS (Usuarios)
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role_id INT REFERENCES roles(id),
    is_active BOOLEAN DEFAULT true,
    banned_at TIMESTAMP WITH TIME ZONE,
    banned_reason VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);

-- =====================================================
-- STORES (Tiendas)
-- =====================================================
CREATE TABLE IF NOT EXISTS stores (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    status BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- USER STORES (Asignación de Tiendas a Usuarios)
-- =====================================================
CREATE TABLE IF NOT EXISTS user_stores (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    store_id INT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, store_id)
);

CREATE INDEX IF NOT EXISTS idx_user_stores_user ON user_stores(user_id);
CREATE INDEX IF NOT EXISTS idx_user_stores_store ON user_stores(store_id);

-- =====================================================
-- USER PERMISSIONS (Permisos de Módulos/Servicios)
-- Override de permisos individuales (adicionales al rol)
-- Permisos disponibles:
--   Web: 'web:dashboard', 'web:inventories', 'web:audits', 'web:catalog', 'web:users'
--   POS: 'pos:sales', 'pos:inventory', 'pos:reports'
-- =====================================================
CREATE TABLE IF NOT EXISTS user_permissions (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, permission)
);

CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id);

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

CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);

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

CREATE INDEX IF NOT EXISTS idx_catalog_imports_store ON catalog_imports(store_id);
CREATE INDEX IF NOT EXISTS idx_catalog_imports_date ON catalog_imports(created_at DESC);

-- =====================================================
-- CATALOG IMPORT ITEMS (Detalle de Cambios)
-- =====================================================
CREATE TABLE IF NOT EXISTS catalog_import_items (
    id SERIAL PRIMARY KEY,
    import_id INT NOT NULL REFERENCES catalog_imports(id) ON DELETE CASCADE,
    sku VARCHAR(50) NOT NULL,
    product_name VARCHAR(255),
    change_type VARCHAR(20) NOT NULL,
    old_price DECIMAL(10, 2),
    new_price DECIMAL(10, 2) NOT NULL,
    difference DECIMAL(10, 2) NOT NULL,
    percent_change DECIMAL(5, 2),
    selected BOOLEAN DEFAULT true,
    applied BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_catalog_import_items_import ON catalog_import_items(import_id);
CREATE INDEX IF NOT EXISTS idx_catalog_import_items_sku ON catalog_import_items(sku);

-- =====================================================
-- AUDIT SESSIONS (Sesiones de Auditoría)
-- =====================================================
CREATE TABLE IF NOT EXISTS audit_sessions (
    id SERIAL PRIMARY KEY,
    store_id INT NOT NULL REFERENCES stores(id),
    created_by UUID REFERENCES users(id),
    name VARCHAR(200) DEFAULT NULL,
    status VARCHAR(20) DEFAULT 'UPLOADING',
    reference_date DATE,
    pdf_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_audit_sessions_store ON audit_sessions(store_id);
CREATE INDEX IF NOT EXISTS idx_audit_sessions_status ON audit_sessions(status);

-- =====================================================
-- AUDIT THEORETICAL (Items del PDF)
-- =====================================================
CREATE TABLE IF NOT EXISTS audit_theoretical (
    id SERIAL PRIMARY KEY,
    audit_id INT NOT NULL REFERENCES audit_sessions(id) ON DELETE CASCADE,
    product_code VARCHAR(50) NOT NULL,
    product_name VARCHAR(255),
    unit_cost DECIMAL(10, 2),
    last_purchase DATE,
    expected_qty DECIMAL(10, 3) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_theoretical_audit ON audit_theoretical(audit_id);
CREATE INDEX IF NOT EXISTS idx_audit_theoretical_code ON audit_theoretical(product_code);

-- =====================================================
-- AUDIT PHYSICAL (Escaneos desde App)
-- =====================================================
CREATE TABLE IF NOT EXISTS audit_physical (
    id SERIAL PRIMARY KEY,
    audit_id INT NOT NULL REFERENCES audit_sessions(id) ON DELETE CASCADE,
    barcode VARCHAR(50) NOT NULL,
    quantity DECIMAL(10, 3) DEFAULT 1,
    scanned_by UUID REFERENCES users(id),
    device_id VARCHAR(100),
    scanned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_physical_audit ON audit_physical(audit_id);

-- =====================================================
-- AUDIT EVENTS (Bitácora de cierre/reapertura)
-- =====================================================
CREATE TABLE IF NOT EXISTS audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_id INT NOT NULL REFERENCES audit_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    previous_status VARCHAR(50),
    new_status VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_events_audit_id ON audit_events(audit_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events(created_at);

-- =====================================================
-- SEED DATA: STORES
-- =====================================================
INSERT INTO stores (name, status) VALUES
    ('Celaya Centro', true),
    ('Dolores Hidalgo', true),
    ('San Miguel de Allende', true),
    ('Salamanca', true),
    ('Salvatierra', false),
    ('Irapuato Norte', true),
    ('León Centro', true)
ON CONFLICT DO NOTHING;

-- =====================================================
-- SEED DATA: ROLES
-- =====================================================
INSERT INTO roles (name, description, permissions, is_system) VALUES
    ('Administrador', 'Acceso total al sistema', ARRAY['web:dashboard', 'web:inventories', 'web:audits', 'web:catalog', 'web:users', 'pos:sales', 'pos:inventory', 'pos:reports'], true),
    ('Gerente', 'Gestión de tiendas y reportes', ARRAY['web:dashboard', 'web:inventories', 'web:audits', 'web:catalog', 'pos:sales', 'pos:inventory', 'pos:reports'], true),
    ('Vendedor', 'Operaciones de venta en POS', ARRAY['pos:sales', 'pos:inventory'], true),
    ('Auditor', 'Auditorías e inventarios', ARRAY['web:dashboard', 'web:inventories', 'web:audits'], true),
    ('Solo Lectura', 'Solo visualización de dashboard', ARRAY['web:dashboard'], false),
    ('Sin Acceso', 'Acceso denegado temporalmente', ARRAY[]::TEXT[], false)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- SEED DATA: USERS
-- Salt: qontrolsalt12345 (16 bytes)
-- Hashes generados con Argon2id: m=65536, t=3, p=4, keyLen=32
-- role_id: 1=Administrador, 2=Gerente, 3=Vendedor, 4=Auditor, 5=Solo Lectura, 6=Sin Acceso
-- =====================================================

-- Admin: admin@qontrol.com / Admin123!
INSERT INTO users (id, email, password_hash, first_name, last_name, role_id, is_active)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'admin@qontrol.com',
    '$argon2id$v=19$m=65536,t=3,p=4$cW9udHJvbHNhbHQxMjM0NQ$nbTtxV/jtxikvwgKIVDxWIIszfPPL/ZBvtNU5AiaTH4',
    'Administrador',
    'Global',
    1,
    true
) ON CONFLICT (email) DO NOTHING;

-- Gerente: gerente@qontrol.com / Test1234!
INSERT INTO users (id, email, password_hash, first_name, last_name, role_id, is_active)
VALUES (
    'a0000000-0000-0000-0000-000000000002',
    'gerente@qontrol.com',
    '$argon2id$v=19$m=65536,t=3,p=4$cW9udHJvbHNhbHQxMjM0NQ$8O+ZiLzwYGLvNOuUE6gVJ3vn1Ymr2wyGcLCnxOzdCcI',
    'Juan',
    'García',
    2,
    true
) ON CONFLICT (email) DO NOTHING;

-- Vendedor: vendedor@qontrol.com / Test1234!
INSERT INTO users (id, email, password_hash, first_name, last_name, role_id, is_active)
VALUES (
    'a0000000-0000-0000-0000-000000000003',
    'vendedor@qontrol.com',
    '$argon2id$v=19$m=65536,t=3,p=4$cW9udHJvbHNhbHQxMjM0NQ$8O+ZiLzwYGLvNOuUE6gVJ3vn1Ymr2wyGcLCnxOzdCcI',
    'María',
    'López',
    3,
    true
) ON CONFLICT (email) DO NOTHING;

-- Usuario Baneado: baneado@qontrol.com / Inactive123!
INSERT INTO users (id, email, password_hash, first_name, last_name, role_id, is_active, banned_at, banned_reason)
VALUES (
    'a0000000-0000-0000-0000-000000000004',
    'baneado@qontrol.com',
    '$argon2id$v=19$m=65536,t=3,p=4$cW9udHJvbHNhbHQxMjM0NQ$kFKRWHy2PPGehdPjWaWK2+lR2HAbQ7wp/GoRwh/caZQ',
    'Pedro',
    'Martínez',
    3,
    false,
    '2026-01-20 10:00:00',
    'Violación de políticas de la empresa'
) ON CONFLICT (email) DO NOTHING;

-- =====================================================
-- SEED DATA: USER STORES
-- =====================================================
-- Gerente tiene acceso a Celaya y Dolores
INSERT INTO user_stores (user_id, store_id) VALUES 
    ('a0000000-0000-0000-0000-000000000002', 1),
    ('a0000000-0000-0000-0000-000000000002', 2)
ON CONFLICT DO NOTHING;

-- Vendedor solo tiene acceso a Celaya
INSERT INTO user_stores (user_id, store_id) VALUES 
    ('a0000000-0000-0000-0000-000000000003', 1)
ON CONFLICT DO NOTHING;

-- =====================================================
-- SEED DATA: USER PERMISSIONS
-- =====================================================
-- Gerente: web completo excepto usuarios, POS completo
INSERT INTO user_permissions (user_id, permission) VALUES 
    ('a0000000-0000-0000-0000-000000000002', 'web:dashboard'),
    ('a0000000-0000-0000-0000-000000000002', 'web:inventories'),
    ('a0000000-0000-0000-0000-000000000002', 'web:audits'),
    ('a0000000-0000-0000-0000-000000000002', 'web:catalog'),
    ('a0000000-0000-0000-0000-000000000002', 'pos:sales'),
    ('a0000000-0000-0000-0000-000000000002', 'pos:inventory'),
    ('a0000000-0000-0000-0000-000000000002', 'pos:reports')
ON CONFLICT DO NOTHING;

-- Vendedor: solo POS ventas e inventario
INSERT INTO user_permissions (user_id, permission) VALUES 
    ('a0000000-0000-0000-0000-000000000003', 'pos:sales'),
    ('a0000000-0000-0000-0000-000000000003', 'pos:inventory')
ON CONFLICT DO NOTHING;

-- =====================================================
-- SEED DATA: PRODUCTS (Catálogo Inicial)
-- =====================================================
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

-- =====================================================
-- SEED DATA: Initial Catalog Import Record
-- =====================================================
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
