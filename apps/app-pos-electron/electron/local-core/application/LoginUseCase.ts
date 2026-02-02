import argon2 from 'argon2';
import { UserRepository } from '../ports/UserRepository';
import { SafeUser } from '../domain/User';

export interface LoginResult {
    success: boolean;
    user?: SafeUser;
    error?: string;
    isOfflineLogin: boolean;
}

export class LoginUseCase {
    constructor(private userRepo: UserRepository) { }

    async execute(email: string, password: string): Promise<LoginResult> {
        // 1. Find user locally
        const user = this.userRepo.findByEmail(email);

        // 2. If no user found
        // Specialized logic: If DB is empty, guide user to sync
        if (!user) {
            const count = this.userRepo.count();
            if (count === 0) {
                return { success: false, error: 'DB_EMPTY', isOfflineLogin: true };
            }
            return { success: false, error: 'Credenciales inválidas.', isOfflineLogin: true };
        }

        // 3. Check if user is active
        if (!user.is_active) {
            return { success: false, error: 'Usuario desactivado. Contacte al administrador.', isOfflineLogin: true };
        }

        // 4. Verify Password Hash
        try {
            const valid = await argon2.verify(user.password_hash, password);
            if (!valid) {
                return { success: false, error: 'Credenciales inválidas.', isOfflineLogin: true };
            }

            // 5. Return success with safe user data (no password_hash)
            const safeUser: SafeUser = {
                id: user.id,
                email: user.email,
                first_name: user.first_name,
                last_name: user.last_name,
                role_id: user.role_id,
                role_name: user.role_name,
                is_active: user.is_active,
                permissions: user.permissions || [],
                store_ids: user.store_ids || [],
            };

            return { success: true, user: safeUser, isOfflineLogin: true };

        } catch (err) {
            console.error('Argon2 verify error:', err);
            return { success: false, error: 'Error interno de autenticación.', isOfflineLogin: true };
        }
    }
}
