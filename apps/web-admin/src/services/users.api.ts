/**
 * Users & Roles API Client
 * Connects frontend to auth-service user/role management endpoints
 */

import { httpClient } from './httpClient';

/**
 * Determines the auth-service API base URL.
 * - Direct connection (dev with port): http://localhost:8080 → paths: /users, /stores, etc.
 * - Via Nginx proxy (production): https://api.qontroll.uk/api → paths: /api/users, /api/stores, etc.
 */
function getAuthApiBase(): string {
    // Explicit auth URL (e.g. dev: http://localhost:8080)
    if (import.meta.env.VITE_AUTH_API_URL) {
        try {
            const url = new URL(import.meta.env.VITE_AUTH_API_URL);
            // Non-standard port = direct connection to auth-service
            if (url.port && url.port !== '80' && url.port !== '443') {
                return import.meta.env.VITE_AUTH_API_URL;
            }
        } catch { /* fall through */ }
        // Production domain without port → route through nginx /api prefix
        return `${import.meta.env.VITE_AUTH_API_URL}/api`;
    }
    // Use general API URL (production via nginx)
    if (import.meta.env.VITE_API_URL) {
        return `${import.meta.env.VITE_API_URL}/api`;
    }
    // Local dev fallback: direct to auth-service
    return 'http://localhost:8080';
}

const API_BASE = getAuthApiBase();

// =====================================================
// TYPES
// =====================================================

export interface Store {
    id: number;
    name: string;
    status: boolean;
    zone_id?: number;
    zone_name?: string;
}

export interface ZoneSupervisor {
    user_id: string;
    full_name: string;
}

export interface Zone {
    id: number;
    name: string;
    supervisors: ZoneSupervisor[];
    price_list_id?: number;
    price_list_name?: string;
    status: boolean;
    store_count: number;
}

export interface PriceList {
    id: number;
    name: string;
    adjustment_percent: number;
    description?: string;
}

export interface Role {
    id: number;
    name: string;
    description: string;
    permissions: string[];
    is_system: boolean;
    created_at: string;
    updated_at: string;
}

export interface User {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role_id: number;
    role?: Role;
    is_active: boolean;
    banned_at?: string;
    banned_reason?: string;
    created_at: string;
    updated_at: string;
    stores: Store[];
    permissions: string[]; // Additional permissions beyond role
}

export interface CreateUserRequest {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    role_id: number;
    store_ids: number[];
    permissions: string[];
}

export interface UpdateUserRequest {
    email: string;
    password?: string;
    first_name: string;
    last_name: string;
    role_id: number;
    is_active: boolean;
    store_ids: number[];
    permissions: string[];
}

export interface CreateRoleRequest {
    name: string;
    description: string;
    permissions: string[];
}

export interface UpdateRoleRequest {
    name: string;
    description: string;
    permissions: string[];
}

export interface CreateStoreRequest {
    name: string;
    zone_id?: number;
}

export interface UpdateStoreRequest {
    name: string;
    status: boolean;
    zone_id?: number;
}

export interface CreateZoneRequest {
    name: string;
    supervisor_ids?: string[];
    price_list_id?: number;
}

export interface UpdateZoneRequest {
    name: string;
    supervisor_ids?: string[];
    price_list_id?: number;
    status: boolean;
}

// Available permissions
export const AVAILABLE_PERMISSIONS = {
    web: [
        { key: 'web:dashboard', label: 'Dashboard', description: 'Ver dashboard y KPIs' },
        { key: 'web:inventories', label: 'Inventarios', description: 'Gestionar inventarios' },
        { key: 'web:audits', label: 'Auditorías', description: 'Crear y ver auditorías' },
        { key: 'web:catalog', label: 'Catálogo Maestro', description: 'Gestionar catálogo de productos' },
        { key: 'web:users', label: 'Usuarios (IAM)', description: 'Gestionar usuarios y permisos' },
    ],
    pos: [
        { key: 'pos:sales', label: 'Ventas', description: 'Realizar ventas en POS' },
        { key: 'pos:inventory', label: 'Inventario', description: 'Ver inventario en POS' },
        { key: 'pos:reports', label: 'Reportes', description: 'Ver reportes en POS' },
    ],
};

// =====================================================
// API FUNCTIONS
// =====================================================

// Helper to get auth headers (deprecated, kept for reference if needed elsewhere, but unused here)
// const getAuthHeaders = ... 

export const usersApi = {
    // =====================================================
    // USERS
    // =====================================================

    async getUsers(): Promise<User[]> {
        const data = await httpClient.get<{ users: User[] }>(`${API_BASE}/users`);
        return data.users || [];
    },

    async getUser(id: string): Promise<User> {
        return httpClient.get<User>(`${API_BASE}/users/${id}`);
    },

    async createUser(data: CreateUserRequest): Promise<User> {
        return httpClient.post<User>(`${API_BASE}/users`, data);
    },

    async updateUser(id: string, data: UpdateUserRequest): Promise<User> {
        return httpClient.put<User>(`${API_BASE}/users/${id}`, data);
    },

    async deleteUser(id: string): Promise<void> {
        return httpClient.delete<void>(`${API_BASE}/users/${id}`);
    },

    async banUser(id: string, reason: string): Promise<void> {
        return httpClient.post<void>(`${API_BASE}/users/${id}/ban`, { reason });
    },

    async unbanUser(id: string): Promise<void> {
        return httpClient.post<void>(`${API_BASE}/users/${id}/unban`);
    },

    // =====================================================
    // STORES
    // =====================================================

    async getStores(): Promise<Store[]> {
        const data = await httpClient.get<{ stores: Store[] }>(`${API_BASE}/stores`);
        return data.stores || [];
    },

    async getStore(id: number): Promise<Store> {
        return httpClient.get<Store>(`${API_BASE}/stores/${id}`);
    },

    async createStore(data: CreateStoreRequest): Promise<Store> {
        return httpClient.post<Store>(`${API_BASE}/stores`, data);
    },

    async updateStore(id: number, data: UpdateStoreRequest): Promise<Store> {
        return httpClient.put<Store>(`${API_BASE}/stores/${id}`, data);
    },

    async deleteStore(id: number): Promise<void> {
        return httpClient.delete<void>(`${API_BASE}/stores/${id}`);
    },

    // =====================================================
    // ROLES
    // =====================================================

    async getRoles(): Promise<Role[]> {
        const data = await httpClient.get<{ roles: Role[] }>(`${API_BASE}/roles`);
        return data.roles || [];
    },

    async getRole(id: number): Promise<Role> {
        return httpClient.get<Role>(`${API_BASE}/roles/${id}`);
    },

    async createRole(data: CreateRoleRequest): Promise<Role> {
        return httpClient.post<Role>(`${API_BASE}/roles`, data);
    },

    async updateRole(id: number, data: UpdateRoleRequest): Promise<Role> {
        return httpClient.put<Role>(`${API_BASE}/roles/${id}`, data);
    },

    async deleteRole(id: number): Promise<void> {
        return httpClient.delete<void>(`${API_BASE}/roles/${id}`);
    },

    // =====================================================
    // ZONES
    // =====================================================

    async getZones(): Promise<Zone[]> {
        const data = await httpClient.get<{ zones: Zone[] }>(`${API_BASE}/zones`);
        return data.zones || [];
    },

    async getZone(id: number): Promise<Zone> {
        return httpClient.get<Zone>(`${API_BASE}/zones/${id}`);
    },

    async createZone(data: CreateZoneRequest): Promise<Zone> {
        return httpClient.post<Zone>(`${API_BASE}/zones`, data);
    },

    async updateZone(id: number, data: UpdateZoneRequest): Promise<Zone> {
        return httpClient.put<Zone>(`${API_BASE}/zones/${id}`, data);
    },

    async deleteZone(id: number): Promise<void> {
        return httpClient.delete<void>(`${API_BASE}/zones/${id}`);
    },

    // =====================================================
    // PRICE LISTS
    // =====================================================

    async getPriceLists(): Promise<PriceList[]> {
        const data = await httpClient.get<{ price_lists: PriceList[] }>(`${API_BASE}/price-lists`);
        return data.price_lists || [];
    },
};

export default usersApi;
