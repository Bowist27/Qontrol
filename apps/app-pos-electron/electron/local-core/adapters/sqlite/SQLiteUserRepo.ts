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
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at TEXT
      )
    `);
    }

    findByEmail(email: string): User | undefined {
        const stmt = this.db.prepare('SELECT * FROM users WHERE email = ?');
        const user = stmt.get(email) as User | undefined;
        return user;
    }

    count(): number {
        const stmt = this.db.prepare('SELECT COUNT(*) as count FROM users');
        const result = stmt.get() as { count: number };
        return result.count;
    }

    saveBatch(users: User[]): SyncStats {
        const insert = this.db.prepare(`
      INSERT OR REPLACE INTO users (id, email, password_hash, role, is_active, created_at)
      VALUES (@id, @email, @password_hash, @role, @is_active, @created_at)
    `);

        const insertMany = this.db.transaction((users: User[]) => {
            let added = 0;
            for (const user of users) {
                insert.run({
                    id: user.id,
                    email: user.email,
                    password_hash: user.password_hash,
                    role: user.role,
                    is_active: user.is_active ? 1 : 0,
                    created_at: user.created_at || new Date().toISOString()
                });
                added++;
            }
            return added;
        });

        const count = insertMany(users);

        return {
            added: count,
            updated: 0, // SQLite Replace doesn't easily distinguish upsert types without more logic
            total: this.count()
        };
    }
}
