/**
 * User Entity - Domain Layer
 * Matches the backend response structure
 */

export interface User {
    id: string;
    email: string;
    role: string;
    is_active: boolean;
    created_at: string;
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
