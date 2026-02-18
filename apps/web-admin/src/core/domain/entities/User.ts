/**
 * User Entity - Domain Layer
 * Matches the backend response structure
 */

export interface UserRole {
    id: number;
    name: string;
    description?: string;
    permissions?: string[];
}

export interface User {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
    role_id?: number;
    role?: UserRole;
    is_active: boolean;
    created_at: string;
    stores?: { id: string; name: string }[];
}

export interface LoginCredentials {
    email: string;
    password: string;
}

export interface LoginResponse {
    token: string;
    user: User;
}

export interface AuthError {
    error: string;
    message: string;
}
