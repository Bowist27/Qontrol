import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs-extra';
import { app } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { AuditSession, AuditScanItem, SyncQueueItem, EnqueueScanInput } from '../../domain/AuditSession';
import { AuditRepository } from '../../ports/AuditRepository';

// Reintentos máximos antes de marcar un escaneo como FAILED
const MAX_SYNC_ATTEMPTS = 3;
// Tiempo tras el cual un escaneo en estado SYNCING se considera "atascado"
const STALE_SYNCING_MS = 2 * 60 * 1000; // 2 minutos

export class SQLiteAuditRepo implements AuditRepository {
    private db: Database.Database;

    constructor() {
        const userDataPath = app.getPath('userData');
        const dbPath = path.join(userDataPath, 'user_data.db');
        fs.ensureDirSync(userDataPath);
        this.db = new Database(dbPath);
        this.initializeSchema();
    }

    private initializeSchema() {
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

        // Offline-First: cola de escaneos pendientes de subir al servidor cloud.
        // Persistente en disco: si el usuario apaga la laptop, los escaneos NO se pierden.
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS sync_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                audit_id INTEGER NOT NULL,
                barcode TEXT NOT NULL,
                quantity REAL NOT NULL DEFAULT 1,
                scanned_by TEXT,
                device_id TEXT,
                scanned_at TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'PENDING',
                attempts INTEGER NOT NULL DEFAULT 0,
                last_error TEXT,
                created_at TEXT NOT NULL
            )
        `);

        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status, created_at)
        `);
    }

    createSession(session: Omit<AuditSession, 'id' | 'total_items' | 'total_quantity'>): AuditSession {
        const id = uuidv4();
        const stmt = this.db.prepare(`
            INSERT INTO audit_sessions (
                id, store_id, store_name, created_by, created_by_name, 
                status, started_at, completed_at, total_items, total_quantity
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
        `);
        
        stmt.run(
            id,
            session.store_id,
            session.store_name,
            session.created_by,
            session.created_by_name,
            session.status,
            session.started_at,
            session.completed_at
        );

        return {
            id,
            ...session,
            total_items: 0,
            total_quantity: 0
        };
    }

    getSession(sessionId: string): AuditSession | undefined {
        const stmt = this.db.prepare('SELECT * FROM audit_sessions WHERE id = ?');
        return stmt.get(sessionId) as AuditSession | undefined;
    }

    getActiveSessions(): AuditSession[] {
        const stmt = this.db.prepare(`
            SELECT * FROM audit_sessions 
            WHERE status = 'IN_PROGRESS' 
            ORDER BY started_at DESC
        `);
        return stmt.all() as AuditSession[];
    }

    updateSessionStatus(sessionId: string, status: AuditSession['status']): void {
        const stmt = this.db.prepare('UPDATE audit_sessions SET status = ? WHERE id = ?');
        stmt.run(status, sessionId);
    }

    completeSession(sessionId: string): void {
        const summary = this.getSessionSummary(sessionId);
        const stmt = this.db.prepare(`
            UPDATE audit_sessions 
            SET status = 'COMPLETED', 
                completed_at = ?,
                total_items = ?,
                total_quantity = ?
            WHERE id = ?
        `);
        stmt.run(
            new Date().toISOString(),
            summary.total_items,
            summary.total_quantity,
            sessionId
        );
    }

    addScanItem(item: Omit<AuditScanItem, 'id'>): AuditScanItem {
        const stmt = this.db.prepare(`
            INSERT INTO audit_scan_items (
                session_id, barcode, sku, product_name, quantity, scanned_at, is_unknown
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        
        const result = stmt.run(
            item.session_id,
            item.barcode,
            item.sku,
            item.product_name,
            item.quantity,
            item.scanned_at,
            item.is_unknown
        );

        return {
            id: result.lastInsertRowid as number,
            ...item
        };
    }

    getSessionItems(sessionId: string): AuditScanItem[] {
        const stmt = this.db.prepare(`
            SELECT * FROM audit_scan_items 
            WHERE session_id = ? 
            ORDER BY scanned_at DESC
        `);
        return stmt.all(sessionId) as AuditScanItem[];
    }

    updateItemQuantity(itemId: number, quantity: number): void {
        const stmt = this.db.prepare('UPDATE audit_scan_items SET quantity = ? WHERE id = ?');
        stmt.run(quantity, itemId);
    }

    deleteItem(itemId: number): void {
        const stmt = this.db.prepare('DELETE FROM audit_scan_items WHERE id = ?');
        stmt.run(itemId);
    }

    getLastItem(sessionId: string): AuditScanItem | undefined {
        const stmt = this.db.prepare(`
            SELECT * FROM audit_scan_items 
            WHERE session_id = ? 
            ORDER BY id DESC 
            LIMIT 1
        `);
        return stmt.get(sessionId) as AuditScanItem | undefined;
    }

    getSessionSummary(sessionId: string): { 
        total_items: number; 
        total_quantity: number;
        unique_products: number;
        unknown_items: number;
    } {
        const stmt = this.db.prepare(`
            SELECT 
                COUNT(*) as total_items,
                COALESCE(SUM(quantity), 0) as total_quantity,
                COUNT(DISTINCT CASE WHEN sku IS NOT NULL THEN sku END) as unique_products,
                COUNT(CASE WHEN is_unknown = 1 THEN 1 END) as unknown_items
            FROM audit_scan_items 
            WHERE session_id = ?
        `);
        const result = stmt.get(sessionId) as any;
        return {
            total_items: result.total_items || 0,
            total_quantity: result.total_quantity || 0,
            unique_products: result.unique_products || 0,
            unknown_items: result.unknown_items || 0
        };
    }

    // ─────────────────────────────────────────────────────────────
    // Offline-First: cola de sincronización de escaneos (Store & Forward)
    // ─────────────────────────────────────────────────────────────

    enqueueScan(item: EnqueueScanInput): SyncQueueItem {
        const created_at = new Date().toISOString();
        const stmt = this.db.prepare(`
            INSERT INTO sync_queue (
                audit_id, barcode, quantity, scanned_by, device_id,
                scanned_at, status, attempts, last_error, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', 0, NULL, ?)
        `);
        const result = stmt.run(
            item.audit_id,
            item.barcode,
            item.quantity,
            item.scanned_by ?? null,
            item.device_id ?? null,
            item.scanned_at,
            created_at
        );
        return {
            id: result.lastInsertRowid as number,
            audit_id: item.audit_id,
            barcode: item.barcode,
            quantity: item.quantity,
            scanned_by: item.scanned_by ?? null,
            device_id: item.device_id ?? null,
            scanned_at: item.scanned_at,
            status: 'PENDING',
            attempts: 0,
            last_error: null,
            created_at
        };
    }

    getPendingScans(limit: number = 50): SyncQueueItem[] {
        // Toma PENDING y los marca como SYNCING de forma atómica para evitar
        // que dos ciclos del worker procesen el mismo registro.
        const select = this.db.prepare(`
            SELECT * FROM sync_queue
            WHERE status = 'PENDING'
            ORDER BY created_at ASC
            LIMIT ?
        `);
        const markSyncing = this.db.prepare(`
            UPDATE sync_queue SET status = 'SYNCING' WHERE id = ?
        `);
        const claim = this.db.transaction((max: number) => {
            const rows = select.all(max) as SyncQueueItem[];
            for (const row of rows) markSyncing.run(row.id);
            return rows;
        });
        return claim(limit);
    }

    countPendingScans(): number {
        // Cuenta todo lo que aún no se ha subido (incluye reintentos en curso).
        const stmt = this.db.prepare(`
            SELECT COUNT(*) as count FROM sync_queue
            WHERE status IN ('PENDING', 'SYNCING')
        `);
        return (stmt.get() as { count: number }).count;
    }

    markScansSynced(ids: number[]): void {
        if (ids.length === 0) return;
        const placeholders = ids.map(() => '?').join(',');
        const stmt = this.db.prepare(`DELETE FROM sync_queue WHERE id IN (${placeholders})`);
        stmt.run(...ids);
    }

    markScanFailed(id: number, error: string): void {
        const stmt = this.db.prepare(`
            UPDATE sync_queue
            SET attempts = attempts + 1,
                last_error = ?,
                status = CASE WHEN attempts + 1 >= ? THEN 'FAILED' ELSE 'PENDING' END
            WHERE id = ?
        `);
        stmt.run(error, MAX_SYNC_ATTEMPTS, id);
    }

    resetStaleScans(): void {
        // Si un ciclo anterior murió a mitad (crash/cierre), regresa a PENDING
        // los registros SYNCING antiguos para que se reintenten.
        const cutoff = new Date(Date.now() - STALE_SYNCING_MS).toISOString();
        const stmt = this.db.prepare(`
            UPDATE sync_queue
            SET status = 'PENDING'
            WHERE status = 'SYNCING' AND created_at < ?
        `);
        stmt.run(cutoff);
    }
}
