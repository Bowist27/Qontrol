/**
 * Audit Session Domain - Sesiones de auditoría física
 */

export interface AuditSession {
    id: string; // UUID local
    store_id: number;
    store_name: string;
    created_by: string; // user_id
    created_by_name: string;
    status: 'IN_PROGRESS' | 'COMPLETED' | 'SYNCED';
    started_at: string;
    completed_at: string | null;
    total_items: number;
    total_quantity: number;
}

export interface AuditScanItem {
    id: number;
    session_id: string;
    barcode: string;
    sku: string | null;
    product_name: string | null;
    quantity: number;
    scanned_at: string;
    is_unknown: number; // 1 if barcode not found in catalog
}

export interface ScanResult {
    success: boolean;
    item?: AuditScanItem;
    product?: {
        sku: string;
        name: string;
        unit: string;
    };
    error?: string;
    isUnknown?: boolean;
}

/**
 * Offline-First: escaneo en cola pendiente de subir al servidor cloud.
 * Se persiste en SQLite (tabla sync_queue) cuando no hay red, y un worker
 * en segundo plano lo sube cuando el internet regresa.
 */
export interface SyncQueueItem {
    id: number;
    audit_id: number;        // id remoto (cloud) de la auditoría
    barcode: string;
    quantity: number;
    scanned_by: string | null;
    device_id: string | null;
    scanned_at: string;      // ISO timestamp
    status: 'PENDING' | 'SYNCING' | 'FAILED';
    attempts: number;
    last_error: string | null;
    created_at: string;
}

export interface EnqueueScanInput {
    audit_id: number;
    barcode: string;
    quantity: number;
    scanned_by?: string | null;
    device_id?: string | null;
    scanned_at: string;
}
