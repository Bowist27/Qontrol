"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SQLiteUserRepo = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const electron_1 = require("electron");
class SQLiteUserRepo {
    constructor() {
        // Ensure userdata directory exists
        const userDataPath = electron_1.app.getPath('userData');
        const dbPath = path_1.default.join(userDataPath, 'user_data.db');
        // Ensure directory exists
        fs_extra_1.default.ensureDirSync(userDataPath);
        console.log('Database path:', dbPath);
        this.db = new better_sqlite3_1.default(dbPath);
        this.initializeSchema();
    }
    initializeSchema() {
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
    migrateSchema() {
        try {
            // Check if old 'role' column exists (old schema)
            const tableInfo = this.db.prepare("PRAGMA table_info(users)").all();
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
        }
        catch (err) {
            console.error('Migration check error:', err);
        }
    }
    findByEmail(email) {
        const stmt = this.db.prepare('SELECT * FROM users WHERE email = ?');
        const row = stmt.get(email);
        if (!row)
            return undefined;
        return Object.assign(Object.assign({}, row), { permissions: JSON.parse(row.permissions || '[]'), store_ids: JSON.parse(row.store_ids || '[]') });
    }
    count() {
        const stmt = this.db.prepare('SELECT COUNT(*) as count FROM users');
        const result = stmt.get();
        return result.count;
    }
    saveBatch(users) {
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
        const insertMany = this.db.transaction((users) => {
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
exports.SQLiteUserRepo = SQLiteUserRepo;
//# sourceMappingURL=SQLiteUserRepo.js.map