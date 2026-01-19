import argon2 from 'argon2';
import { UserRepository } from '../ports/UserRepository';
import { User } from '../domain/User';

export interface LoginResult {
    success: boolean;
    user?: Omit<User, 'password_hash'>;
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

        // 3. Verify Password Hash
        try {
            const valid = await argon2.verify(user.password_hash, password);
            if (!valid) {
                return { success: false, error: 'Credenciales inválidas.', isOfflineLogin: true };
            }

            // 4. Return success (without hash)
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { password_hash: _ph, ...safeUser } = user;
            return { success: true, user: safeUser, isOfflineLogin: true };

        } catch (err) {
            console.error('Argon2 verify error:', err);
            return { success: false, error: 'Error interno de autenticación.', isOfflineLogin: true };
        }
    }
}
