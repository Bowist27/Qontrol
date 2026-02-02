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
