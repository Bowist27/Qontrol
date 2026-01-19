import { CloudAuthAdapter } from '../adapters/api/CloudAuthAdapter';
import { UserRepository } from '../ports/UserRepository';

export interface SyncResult {
    success: boolean;
    added: number;
    total: number;
    error?: string;
}

export class SyncUsersUseCase {
    constructor(
        private cloudAdapter: CloudAuthAdapter,
        private userRepo: UserRepository
    ) { }

    async execute(): Promise<SyncResult> {
        try {
            // 1. Fetch from cloud
            const users = await this.cloudAdapter.getUsersFromCloud();

            if (users.length === 0) {
                // Maybe success but 0 users?
                return { success: true, added: 0, total: this.userRepo.count() };
            }

            // 2. Save locally
            const stats = this.userRepo.saveBatch(users);

            return {
                success: true,
                added: stats.added,
                total: stats.total
            };

        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            console.error('Sync execution failed:', errorMessage);
            return {
                success: false,
                added: 0,
                total: this.userRepo.count(),
                error: errorMessage === 'NETWORK_ERROR' ? 'Error de conexión' : 'Error al sincronizar'
            };
        }
    }
}
