import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs-extra';
import { app } from 'electron';
import { User, SyncStats } from '../../domain/User';
import { UserRepository } from '../../ports/UserRepository';

export class SQLiteUserRepo implements UserRepository {
    private db: Database.Database;

    constructor() {
        // Ensure userdata directory exists
        const userDataPath = app.getPath('userData');
        const dbPath = path.join(userDataPath, 'user_data.db');

        // Ensure directory exists
        fs.ensureDirSync(userDataPath);

        console.log('Database path:', dbPath);
        this.db = new Database(dbPath);
        this.initializeSchema();
    }

    private initializeSchema() {
        // Drop old table if schema is outdated (for development)
        // In production, you'd use migrations
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                first_name TEXT DEFAULT '',
                last_name TEXT DEFAULT '',
                role_id INTEGER DEFAULT 1,
                role_name TEXT DEFAULT 'Usuario',
                is_active INTEGER DEFAULT 1,
                permissions TEXT DEFAULT '[]',
                store_ids TEXT DEFAULT '[]',
                created_at TEXT
            )
        `);
        
        // Check if we need to migrate old schema
        this.migrateSchema();
    }

    private migrateSchema() {
        try {
            // Check if old 'role' column exists (old schema)
            const tableInfo = this.db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
            const columns = tableInfo.map((col) => col.name);
            
            // If old schema (has 'role' but not 'role_id'), drop and recreate
            if (columns.includes('role') && !columns.includes('role_id')) {
                console.log('Migrating old schema to new schema...');
                this.db.exec('DROP TABLE users');
                this.db.exec(`
                    CREATE TABLE users (
                        id TEXT PRIMARY KEY,
                        email TEXT UNIQUE NOT NULL,
                        password_hash TEXT NOT NULL,
                        first_name TEXT DEFAULT '',
                        last_name TEXT DEFAULT '',
                        role_id INTEGER DEFAULT 1,
                        role_name TEXT DEFAULT 'Usuario',
                        is_active INTEGER DEFAULT 1,
                        permissions TEXT DEFAULT '[]',
                        store_ids TEXT DEFAULT '[]',
                        created_at TEXT
                    )
                `);
                console.log('Schema migration completed.');
            }
        } catch (err) {
            console.error('Migration check error:', err);
        }
    }

    findByEmail(email: string): User | undefined {
        const stmt = this.db.prepare('SELECT * FROM users WHERE email = ?');
        const row = stmt.get(email) as any;
        if (!row) return undefined;
        
        return {
            ...row,
            permissions: JSON.parse(row.permissions || '[]'),
            store_ids: JSON.parse(row.store_ids || '[]'),
        };
    }

    count(): number {
        const stmt = this.db.prepare('SELECT COUNT(*) as count FROM users');
        const result = stmt.get() as { count: number };
        return result.count;
    }

    saveBatch(users: User[]): SyncStats {
        const insert = this.db.prepare(`
            INSERT OR REPLACE INTO users (
                id, email, password_hash, first_name, last_name, 
                role_id, role_name, is_active, permissions, store_ids, created_at
            )
            VALUES (
                @id, @email, @password_hash, @first_name, @last_name,
                @role_id, @role_name, @is_active, @permissions, @store_ids, @created_at
            )
        `);

        const insertMany = this.db.transaction((users: User[]) => {
            let added = 0;
            for (const user of users) {
                insert.run({
                    id: user.id,
                    email: user.email,
                    password_hash: user.password_hash,
                    first_name: user.first_name || '',
                    last_name: user.last_name || '',
                    role_id: user.role_id || 1,
                    role_name: user.role_name || 'Usuario',
                    is_active: user.is_active ? 1 : 0,
                    permissions: JSON.stringify(user.permissions || []),
                    store_ids: JSON.stringify(user.store_ids || []),
                    created_at: user.created_at || new Date().toISOString()
                });
                added++;
            }
            return added;
        });

        const count = insertMany(users);

        return {
            added: count,
            updated: 0,
            total: this.count()
        };
    }
}
