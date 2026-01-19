import { User, SyncStats } from '../domain/User';

export interface UserRepository {
    /**
     * Find a user by email
     */
    findByEmail(email: string): User | undefined;

    /**
     * Save a batch of users (from sync)
     * Uses UPSERT logic (insert or replace)
     */
    saveBatch(users: User[]): SyncStats;

    /**
     * Count total users
     */
    count(): number;
}
