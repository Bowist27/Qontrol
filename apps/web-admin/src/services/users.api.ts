/**
 * Users & Roles API Client
 * Connects frontend to auth-service user/role management endpoints
 */

import { httpClient } from './httpClient';



const API_BASE = import.meta.env.VITE_AUTH_API_URL || 'http://localhost:8080';

// =====================================================
// TYPES
// =====================================================

export interface Store {
    id: number;
    name: string;
    status: boolean;
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
};

export default usersApi;
