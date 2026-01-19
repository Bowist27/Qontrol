export interface User {
    id: string;
    email: string;
    password_hash: string;
    role: string;
    is_active: number; // SQLite uses 0/1 for booleans
    created_at: string;
}

export interface SyncStats {
    added: number;
    updated: number;
    total: number;
}
