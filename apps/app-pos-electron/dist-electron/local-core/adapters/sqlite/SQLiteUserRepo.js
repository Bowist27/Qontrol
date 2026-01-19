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
    findByEmail(email) {
        const stmt = this.db.prepare('SELECT * FROM users WHERE email = ?');
        const user = stmt.get(email);
        return user;
    }
    count() {
        const stmt = this.db.prepare('SELECT COUNT(*) as count FROM users');
        const result = stmt.get();
        return result.count;
    }
    saveBatch(users) {
        const insert = this.db.prepare(`
      INSERT OR REPLACE INTO users (id, email, password_hash, role, is_active, created_at)
      VALUES (@id, @email, @password_hash, @role, @is_active, @created_at)
    `);
        const insertMany = this.db.transaction((users) => {
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
exports.SQLiteUserRepo = SQLiteUserRepo;
//# sourceMappingURL=SQLiteUserRepo.js.map