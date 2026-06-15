import { AuditSession, AuditScanItem, SyncQueueItem, EnqueueScanInput } from '../domain/AuditSession';

export interface AuditRepository {
    // Session management
    createSession(session: Omit<AuditSession, 'id' | 'total_items' | 'total_quantity'>): AuditSession;
    getSession(sessionId: string): AuditSession | undefined;
    getActiveSessions(): AuditSession[];
    updateSessionStatus(sessionId: string, status: AuditSession['status']): void;
    completeSession(sessionId: string): void;
    
    // Scan items
    addScanItem(item: Omit<AuditScanItem, 'id'>): AuditScanItem;
    getSessionItems(sessionId: string): AuditScanItem[];
    updateItemQuantity(itemId: number, quantity: number): void;
    deleteItem(itemId: number): void;
    
    // Get last item for quick undo
    getLastItem(sessionId: string): AuditScanItem | undefined;
    
    // Aggregations
    getSessionSummary(sessionId: string): {
        total_items: number;
        total_quantity: number;
        unique_products: number;
        unknown_items: number;
    };

    // Offline-First: cola de escaneos pendientes de subir al cloud
    enqueueScan(item: EnqueueScanInput): SyncQueueItem;
    getPendingScans(limit?: number): SyncQueueItem[];
    countPendingScans(): number;
    markScansSynced(ids: number[]): void;
    markScanFailed(id: number, error: string): void;
    resetStaleScans(): void;
}
