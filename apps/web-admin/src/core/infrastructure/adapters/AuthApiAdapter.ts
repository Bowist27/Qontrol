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
        // In production, use the current origin (EC2 IP)
        // In development, use localhost
        if (import.meta.env.VITE_API_URL) {
            return import.meta.env.VITE_API_URL;
        }
        return window.location.origin;
    }

    /**
     * POST /api/auth/login
     * Sends credentials to Nginx -> auth-service
     * 
     * @throws AuthError with backend error details
     */
    async login(credentials: LoginCredentials): Promise<LoginResponse> {
        try {
            const response = await this.api.post<LoginResponse>(
                '/api/auth/login',
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
     * POST /api/auth/logout
     * Invalidates the session in Redis
     */
    async logout(token: string): Promise<void> {
        try {
            await this.api.post('/api/auth/logout', null, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
        } catch (error) {
            console.error('Logout error:', error);
        }
    }
}

// Singleton instance
export const authApi = new AuthApiAdapter();
