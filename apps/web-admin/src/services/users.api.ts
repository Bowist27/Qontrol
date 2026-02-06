/**
 * Users & Roles API Client
 * Connects frontend to auth-service user/role management endpoints
 */

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

// Helper to get auth headers
const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
    };
};

export const usersApi = {
    // =====================================================
    // USERS
    // =====================================================

    async getUsers(): Promise<User[]> {
        const response = await fetch(`${API_BASE}/users`, {
            headers: getAuthHeaders(),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Error al obtener usuarios');
        }
        const data = await response.json();
        return data.users || [];
    },

    async getUser(id: string): Promise<User> {
        const response = await fetch(`${API_BASE}/users/${id}`, {
            headers: getAuthHeaders(),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Usuario no encontrado');
        }
        return response.json();
    },

    async createUser(data: CreateUserRequest): Promise<User> {
        const response = await fetch(`${API_BASE}/users`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Error al crear usuario');
        }
        return response.json();
    },

    async updateUser(id: string, data: UpdateUserRequest): Promise<User> {
        const response = await fetch(`${API_BASE}/users/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Error al actualizar usuario');
        }
        return response.json();
    },

    async deleteUser(id: string): Promise<void> {
        const response = await fetch(`${API_BASE}/users/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Error al eliminar usuario');
        }
    },

    async banUser(id: string, reason: string): Promise<void> {
        const response = await fetch(`${API_BASE}/users/${id}/ban`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ reason }),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Error al banear usuario');
        }
    },

    async unbanUser(id: string): Promise<void> {
        const response = await fetch(`${API_BASE}/users/${id}/unban`, {
            method: 'POST',
            headers: getAuthHeaders(),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Error al desbanear usuario');
        }
    },

    // =====================================================
    // STORES
    // =====================================================

    async getStores(): Promise<Store[]> {
        const response = await fetch(`${API_BASE}/stores`, {
            headers: getAuthHeaders(),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Error al obtener tiendas');
        }
        const data = await response.json();
        return data.stores || [];
    },

    // =====================================================
    // ROLES
    // =====================================================

    async getRoles(): Promise<Role[]> {
        const response = await fetch(`${API_BASE}/roles`, {
            headers: getAuthHeaders(),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Error al obtener roles');
        }
        const data = await response.json();
        return data.roles || [];
    },

    async getRole(id: number): Promise<Role> {
        const response = await fetch(`${API_BASE}/roles/${id}`, {
            headers: getAuthHeaders(),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Rol no encontrado');
        }
        return response.json();
    },

    async createRole(data: CreateRoleRequest): Promise<Role> {
        const response = await fetch(`${API_BASE}/roles`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Error al crear rol');
        }
        return response.json();
    },

    async updateRole(id: number, data: UpdateRoleRequest): Promise<Role> {
        const response = await fetch(`${API_BASE}/roles/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Error al actualizar rol');
        }
        return response.json();
    },

    async deleteRole(id: number): Promise<void> {
        const response = await fetch(`${API_BASE}/roles/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Error al eliminar rol');
        }
    },
};

export default usersApi;
