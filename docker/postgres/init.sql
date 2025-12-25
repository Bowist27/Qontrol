-- Crear tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'admin',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Crear índice para búsquedas por email
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- =====================================================
-- USUARIOS DE PRUEBA
-- =====================================================
-- Salt: qontrolsalt12345 (16 bytes)
-- Hashes generados con Argon2id: m=65536, t=3, p=4, keyLen=32
-- NOTA: Usamos $hash$ como delimitador para evitar problemas con $ en el hash

-- Usuario Admin: jose.admin@gmail.com / Admin123!
INSERT INTO users (email, password_hash, role, is_active) VALUES (
    'jose.admin@gmail.com',
    $hash$$argon2id$v=19$m=65536,t=3,p=4$cW9udHJvbHNhbHQxMjM0NQ$nbTtxV/jtxikvwgKIVDxWIIszfPPL/ZBvtNU5AiaTH4$hash$,
    'admin',
    true
) ON CONFLICT (email) DO NOTHING;

-- Usuario Regular: test.user@hotmail.com / Test1234!
INSERT INTO users (email, password_hash, role, is_active) VALUES (
    'test.user@hotmail.com',
    $hash$$argon2id$v=19$m=65536,t=3,p=4$cW9udHJvbHNhbHQxMjM0NQ$8OKPOMEHMpMjbT0ADTgZ9i23sxdvLJLZYGV0X5kj08Y$hash$,
    'user',
    true
) ON CONFLICT (email) DO NOTHING;

-- Usuario Inactivo: inactive@gmail.com / Inactive123!
INSERT INTO users (email, password_hash, role, is_active) VALUES (
    'inactive@gmail.com',
    $hash$$argon2id$v=19$m=65536,t=3,p=4$cW9udHJvbHNhbHQxMjM0NQ$DPGehdPjWaWK2+lR2HAbQ7wp/GoRwh/caZQrbTtxV/g$hash$,
    'admin',
    false
) ON CONFLICT (email) DO NOTHING;