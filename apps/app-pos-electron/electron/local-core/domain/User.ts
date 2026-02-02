export interface User {
    id: string;
    email: string;
    password_hash: string;
    first_name: string;
    last_name: string;
    role_id: number;
    role_name: string;
    is_active: number; // SQLite uses 0/1 for booleans
    permissions: string[]; // e.g., ["web:catalogo", "pos:ventas", "pos:corte_caja"]
    store_ids: number[];   // Tiendas a las que tiene acceso
    created_at: string;
}

// User data safe to expose to the renderer (no password_hash)
export interface SafeUser {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role_id: number;
    role_name: string;
    is_active: number;
    permissions: string[];
    store_ids: number[];
}

export interface SyncStats {
    added: number;
    updated: number;
    total: number;
}
