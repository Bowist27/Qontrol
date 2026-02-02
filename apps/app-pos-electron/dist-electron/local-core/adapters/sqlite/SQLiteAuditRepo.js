"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SQLiteAuditRepo = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const electron_1 = require("electron");
const uuid_1 = require("uuid");
class SQLiteAuditRepo {
    constructor() {
        const userDataPath = electron_1.app.getPath('userData');
        const dbPath = path_1.default.join(userDataPath, 'user_data.db');
        fs_extra_1.default.ensureDirSync(userDataPath);
        this.db = new better_sqlite3_1.default(dbPath);
        this.initializeSchema();
    }
    initializeSchema() {
        // Audit sessions table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS audit_sessions (
                id TEXT PRIMARY KEY,
                store_id INTEGER NOT NULL,
                store_name TEXT NOT NULL,
                created_by TEXT NOT NULL,
                created_by_name TEXT NOT NULL,
                status TEXT DEFAULT 'IN_PROGRESS',
                started_at TEXT NOT NULL,
                completed_at TEXT,
                total_items INTEGER DEFAULT 0,
                total_quantity REAL DEFAULT 0
            )
        `);
        // Scan items table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS audit_scan_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                barcode TEXT NOT NULL,
                sku TEXT,
                product_name TEXT,
                quantity REAL DEFAULT 1,
                scanned_at TEXT NOT NULL,
                is_unknown INTEGER DEFAULT 0,
                FOREIGN KEY (session_id) REFERENCES audit_sessions(id)
            )
        `);
        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_scan_items_session ON audit_scan_items(session_id)
        `);
    }
    createSession(session) {
        const id = (0, uuid_1.v4)();
        const stmt = this.db.prepare(`
            INSERT INTO audit_sessions (
                id, store_id, store_name, created_by, created_by_name, 
                status, started_at, completed_at, total_items, total_quantity
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
        `);
        stmt.run(id, session.store_id, session.store_name, session.created_by, session.created_by_name, session.status, session.started_at, session.completed_at);
        return Object.assign(Object.assign({ id }, session), { total_items: 0, total_quantity: 0 });
    }
    getSession(sessionId) {
        const stmt = this.db.prepare('SELECT * FROM audit_sessions WHERE id = ?');
        return stmt.get(sessionId);
    }
    getActiveSessions() {
        const stmt = this.db.prepare(`
            SELECT * FROM audit_sessions 
            WHERE status = 'IN_PROGRESS' 
            ORDER BY started_at DESC
        `);
        return stmt.all();
    }
    updateSessionStatus(sessionId, status) {
        const stmt = this.db.prepare('UPDATE audit_sessions SET status = ? WHERE id = ?');
        stmt.run(status, sessionId);
    }
    completeSession(sessionId) {
        const summary = this.getSessionSummary(sessionId);
        const stmt = this.db.prepare(`
            UPDATE audit_sessions 
            SET status = 'COMPLETED', 
                completed_at = ?,
                total_items = ?,
                total_quantity = ?
            WHERE id = ?
        `);
        stmt.run(new Date().toISOString(), summary.total_items, summary.total_quantity, sessionId);
    }
    addScanItem(item) {
        const stmt = this.db.prepare(`
            INSERT INTO audit_scan_items (
                session_id, barcode, sku, product_name, quantity, scanned_at, is_unknown
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(item.session_id, item.barcode, item.sku, item.product_name, item.quantity, item.scanned_at, item.is_unknown);
        return Object.assign({ id: result.lastInsertRowid }, item);
    }
    getSessionItems(sessionId) {
        const stmt = this.db.prepare(`
            SELECT * FROM audit_scan_items 
            WHERE session_id = ? 
            ORDER BY scanned_at DESC
        `);
        return stmt.all(sessionId);
    }
    updateItemQuantity(itemId, quantity) {
        const stmt = this.db.prepare('UPDATE audit_scan_items SET quantity = ? WHERE id = ?');
        stmt.run(quantity, itemId);
    }
    deleteItem(itemId) {
        const stmt = this.db.prepare('DELETE FROM audit_scan_items WHERE id = ?');
        stmt.run(itemId);
    }
    getLastItem(sessionId) {
        const stmt = this.db.prepare(`
            SELECT * FROM audit_scan_items 
            WHERE session_id = ? 
            ORDER BY id DESC 
            LIMIT 1
        `);
        return stmt.get(sessionId);
    }
    getSessionSummary(sessionId) {
        const stmt = this.db.prepare(`
            SELECT 
                COUNT(*) as total_items,
                COALESCE(SUM(quantity), 0) as total_quantity,
                COUNT(DISTINCT CASE WHEN sku IS NOT NULL THEN sku END) as unique_products,
                COUNT(CASE WHEN is_unknown = 1 THEN 1 END) as unknown_items
            FROM audit_scan_items 
            WHERE session_id = ?
        `);
        const result = stmt.get(sessionId);
        return {
            total_items: result.total_items || 0,
            total_quantity: result.total_quantity || 0,
            unique_products: result.unique_products || 0,
            unknown_items: result.unknown_items || 0
        };
    }
}
exports.SQLiteAuditRepo = SQLiteAuditRepo;
//# sourceMappingURL=SQLiteAuditRepo.js.map