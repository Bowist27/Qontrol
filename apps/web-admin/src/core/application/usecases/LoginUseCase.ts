/**
 * LoginUseCase - Application Layer
 * Implements: Page ->> UseCase: execute(credentials: LoginCredentials)
 * 
 * Orchestrates the login flow:
 * 1. Validate email format
 * 2. Call AuthApiAdapter
 * 3. Store token and user in localStorage
 * 4. Return success/error
 */

import type { LoginCredentials, LoginResponse, AuthError, User } from '../../domain/entities/User';
import { AuthApiAdapter, authApi } from '../../infrastructure/adapters/AuthApiAdapter';

export type LoginResult =
    | { success: true; user: User }
    | { success: false; error: AuthError };

export class LoginUseCase {
    private gateway: AuthApiAdapter;

    constructor(gateway: AuthApiAdapter = authApi) {
        this.gateway = gateway;
    }

    /**
     * Execute login flow - Main entry point from Login.tsx
     * 
     * Flow from diagram:
     * 1. UseCase -> UseCase: validateEmail(email) → bool
     * 2. UseCase ->> Gateway: login(credentials)
     * 3. Gateway -->> UseCase: LoginResponse {token, user}
     * 4. UseCase -> UseCase: localStorage.setItem(...)
     * 5. UseCase -->> Page: Success
     */
    async execute(credentials: LoginCredentials): Promise<LoginResult> {
        // Step 1: Validate email format
        if (!this.validateEmail(credentials.email)) {
            return {
                success: false,
                error: {
                    error: 'validation_error',
                    message: 'El formato del correo electrónico no es válido.',
                },
            };
        }

        try {
            // Step 2 & 3: Call gateway and get response
            const response: LoginResponse = await this.gateway.login(credentials);

            // Step 4: Store in localStorage
            this.storeSession(response);

            // Step 5: Return success with user data
            return {
                success: true,
                user: response.user,
            };
        } catch (error) {
            // Error handling - maps backend errors to user-friendly messages
            return {
                success: false,
                error: this.mapError(error as AuthError),
            };
        }
    }

    /**
     * Validate email format
     * Implements: UseCase -> UseCase: validateEmail(email) → bool
     */
    private validateEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Store session data in localStorage
     * Implements: localStorage.setItem("token", token)
     *             localStorage.setItem("user", JSON.stringify(user))
     */
    private storeSession(response: LoginResponse): void {
        localStorage.setItem('token', response.token);
        localStorage.setItem('user', JSON.stringify(response.user));
    }

    /**
     * Map backend errors to user-friendly messages
     * Used for Toast notifications
     */
    private mapError(error: AuthError): AuthError {
        const errorMessages: Record<string, string> = {
            'invalid_credentials': 'Email o contraseña incorrectos.',
            'user_inactive': 'Su cuenta está desactivada. Contacte al administrador.',
            'too_many_requests': 'Demasiados intentos fallidos. Intente en 15 minutos.',
            'network_error': 'No se pudo conectar al servidor.',
        };

        return {
            error: error.error,
            message: errorMessages[error.error] || error.message || 'Error desconocido.',
        };
    }

    /**
     * Check if user is currently authenticated
     */
    static isAuthenticated(): boolean {
        return !!localStorage.getItem('token');
    }

    /**
     * Get current user from localStorage
     */
    static getCurrentUser(): User | null {
        const userJson = localStorage.getItem('user');
        if (!userJson) return null;

        try {
            return JSON.parse(userJson) as User;
        } catch {
            return null;
        }
    }

    /**
     * Clear session data (logout)
     */
    static clearSession(): void {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    }
}

// Export singleton for convenience
export const loginUseCase = new LoginUseCase();
