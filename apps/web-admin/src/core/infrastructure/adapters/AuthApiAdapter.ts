/**
 * AuthApiAdapter - Infrastructure Layer
 * Implements: Gateway ->> Nginx: POST /api/auth/login
 * 
 * This adapter handles HTTP communication with the auth service via Nginx.
 */

import axios from 'axios';
import type { AxiosInstance, AxiosError } from 'axios';
import type { LoginCredentials, LoginResponse, AuthError } from '../../domain/entities/User';

export class AuthApiAdapter {
    private api: AxiosInstance;

    constructor(baseURL: string = '') {
        this.api = axios.create({
            baseURL: baseURL || this.getBaseUrl(),
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    /**
     * Determine the API base URL based on environment
     */
    private getBaseUrl(): string {
        const envUrl = import.meta.env.VITE_AUTH_API_URL || import.meta.env.VITE_API_URL;
        if (envUrl) {
            return envUrl;
        }
        return window.location.origin;
    }

    /**
     * Determines if connecting directly to auth-service (dev) or via Nginx (prod)
     * Direct (dev): non-standard port (e.g. localhost:8080) → routes: /login, /logout
     * Via Nginx (prod): standard port (e.g. api.qontroll.uk) → routes: /api/auth/login, /api/auth/logout
     */
    private isDirectConnection(): boolean {
        const envUrl = import.meta.env.VITE_AUTH_API_URL;
        if (!envUrl) return false;
        try {
            const url = new URL(envUrl);
            return !!url.port && url.port !== '80' && url.port !== '443';
        } catch {
            return false;
        }
    }

    /**
     * POST /login (direct) or /api/auth/login (via Nginx)
     * Sends credentials to auth-service
     * 
     * @throws AuthError with backend error details
     */
    async login(credentials: LoginCredentials): Promise<LoginResponse> {
        const path = this.isDirectConnection() ? '/login' : '/api/auth/login';
        try {
            const response = await this.api.post<LoginResponse>(
                path,
                credentials
            );
            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const axiosError = error as AxiosError<AuthError>;

                // Backend returns structured errors
                if (axiosError.response?.data) {
                    throw axiosError.response.data;
                }

                // Network or other errors
                throw {
                    error: 'network_error',
                    message: 'No se pudo conectar al servidor. Verifica tu conexión.',
                } as AuthError;
            }

            throw {
                error: 'unknown_error',
                message: 'Ocurrió un error inesperado.',
            } as AuthError;
        }
    }

    /**
     * POST /logout (direct) or /api/auth/logout (via Nginx)
     * Invalidates the session in Redis
     */
    async logout(token: string): Promise<void> {
        const path = this.isDirectConnection() ? '/logout' : '/api/auth/logout';
        try {
            await this.api.post(path, null, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
        } catch (error) {
            console.error('Logout error:', error);
        }
    }

    /**
     * GET /me (direct) or /api/auth/me (via Nginx)
     * Returns the current authenticated user's full profile
     */
    async getMe(token: string): Promise<LoginResponse['user']> {
        const path = this.isDirectConnection() ? '/me' : '/api/auth/me';
        const response = await this.api.get(path, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        return response.data;
    }
}

// Singleton instance
export const authApi = new AuthApiAdapter();
