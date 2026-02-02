/**
 * Audit API Client
 * Connects frontend to audit-service (port 8081)
 * 
 * Flow (Approach B):
 * 1. parsePDF() - Parse for preview, no save
 * 2. User reviews preview
 * 3. createAudit() - Save after user confirms
 */

const API_BASE = import.meta.env.VITE_AUDIT_API_URL || 'http://localhost:8085';

// Types matching backend domain
export interface Store {
    id: number;
    name: string;
    status: boolean;
    created_at?: string;
}

export interface AuditSession {
    id: number;
    store_id: number;
    status: string;
    pdf_url?: string;
    created_at: string;
}

export interface AuditItem {
    id: number;
    audit_id: number;
    product_code: string;
    product_name: string;
    unit_cost: number;
    expected_qty: number;
}

export interface AuditDTO {
    session: AuditSession;
    items: AuditItem[];
}

export interface AuditListDTO {
    session: AuditSession;
    store_name: string;
}

// Response from parsePDF (preview only, no DB save)
export interface ParseResult {
    items: AuditItem[];
    total_items: number;
    total_units: number;
    total_value: number;
}

// API Client
export const auditApi = {
    /**
     * GET /api/stores - List all active stores
     */
    getStores: async (): Promise<Store[]> => {
        const res = await fetch(`${API_BASE}/api/stores`);
        if (!res.ok) throw new Error('Failed to fetch stores');
        const data = await res.json();
        return data.stores;
    },

    /**
     * POST /api/audits/parse - Parse PDF for preview (FASE 3)
     * Does NOT save to database - only returns parsed items for user review
     */
    parsePDF: async (file: File): Promise<ParseResult> => {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch(`${API_BASE}/api/audits/parse`, {
            method: 'POST',
            body: formData,
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Failed to parse PDF');
        }
        return res.json();
    },

    /**
     * POST /api/audits - Create audit session (FASE 5)
     * Called AFTER user confirms the preview - saves everything
     */
    createAudit: async (storeId: number, file: File): Promise<AuditDTO> => {
        const formData = new FormData();
        formData.append('store_id', storeId.toString());
        formData.append('file', file);

        const res = await fetch(`${API_BASE}/api/audits`, {
            method: 'POST',
            body: formData,
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Failed to create audit');
        }
        return res.json();
    },

    /**
     * GET /api/audits/:id - Get audit with items
     */
    getAudit: async (sessionId: number): Promise<AuditDTO> => {
        const res = await fetch(`${API_BASE}/api/audits/${sessionId}`);
        if (!res.ok) throw new Error('Failed to fetch audit');
        return res.json();
    },

    /**
     * GET /api/audits - List all audits for dashboard
     */
    getSessions: async (): Promise<AuditListDTO[]> => {
        const res = await fetch(`${API_BASE}/api/audits`);
        if (!res.ok) throw new Error('Failed to fetch sessions');
        const data = await res.json();
        return data.audits;
    },

    /**
     * DELETE /api/audits/:id - Cancel/Delete an audit
     */
    deleteAudit: async (sessionId: number): Promise<void> => {
        const res = await fetch(`${API_BASE}/api/audits/${sessionId}`, {
            method: 'DELETE',
        });
        if (!res.ok) throw new Error('Failed to delete audit');
    },

    // ============ CATALOG APIs ============

    /**
     * GET /api/catalog - Get all catalog products
     */
    getCatalogProducts: async () => {
        const res = await fetch(`${API_BASE}/api/catalog`);
        if (!res.ok) throw new Error('Failed to fetch catalog');
        return res.json();
    },

    /**
     * POST /api/catalog/analyze - Analyze a valuation report against catalog
     */
    analyzeValuation: async (file: File, storeName: string) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('store_name', storeName);

        const res = await fetch(`${API_BASE}/api/catalog/analyze`, {
            method: 'POST',
            body: formData,
        });
        if (!res.ok) throw new Error('Failed to analyze valuation');
        return res.json();
    },

    /**
     * GET /api/catalog/valuation/latest - Get latest pending valuation
     */
    getLatestValuation: async () => {
        const res = await fetch(`${API_BASE}/api/catalog/valuation/latest`);
        if (!res.ok) {
            if (res.status === 404) return null;
            throw new Error('Failed to fetch latest valuation');
        }
        return res.json();
    },

    /**
     * POST /api/catalog/analyze/save - Save analysis for later commit
     */
    saveAnalysis: async (result: any, userName: string) => {
        const res = await fetch(`${API_BASE}/api/catalog/analyze/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ result, user_name: userName }),
        });
        if (!res.ok) throw new Error('Failed to save analysis');
        return res.json();
    },

    /**
     * POST /api/catalog/imports/:id/commit - Apply selected changes
     */
    commitCatalogImport: async (importId: number, selectedSKUs: string[]) => {
        const res = await fetch(`${API_BASE}/api/catalog/imports/${importId}/commit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ selected_skus: selectedSKUs }),
        });
        if (!res.ok) throw new Error('Failed to commit import');
        return res.json();
    },

    /**
     * POST /api/catalog/imports/:id/revert - Revert import
     */
    revertCatalogImport: async (importId: number) => {
        const res = await fetch(`${API_BASE}/api/catalog/imports/${importId}/revert`, {
            method: 'POST',
        });
        if (!res.ok) throw new Error('Failed to revert import');
        return res.json();
    },

    /**
     * GET /api/catalog/imports - Get import history
     */
    getCatalogHistory: async (limit = 20) => {
        const res = await fetch(`${API_BASE}/api/catalog/imports?limit=${limit}`);
        if (!res.ok) throw new Error('Failed to fetch history');
        return res.json();
    },

    // ============ PHYSICAL SCAN APIs (POS Integration) ============

    /**
     * GET /api/audits/:id/scans - Get physical scans for an audit
     */
    getPhysicalScans: async (auditId: number): Promise<PhysicalScan[]> => {
        const res = await fetch(`${API_BASE}/api/audits/${auditId}/scans`);
        if (!res.ok) throw new Error('Failed to fetch scans');
        const data = await res.json();
        return data.scans || [];
    },

    /**
     * GET /api/audits/:id/scans/summary - Get summary stats for physical scans
     */
    getPhysicalScanSummary: async (auditId: number): Promise<PhysicalScanSummary> => {
        const res = await fetch(`${API_BASE}/api/audits/${auditId}/scans/summary`);
        if (!res.ok) throw new Error('Failed to fetch scan summary');
        return res.json();
    },
};

// Physical Scan Types
export interface PhysicalScan {
    id: number;
    audit_id: number;
    barcode: string;
    sku?: string;
    product_name?: string;
    quantity: number;
    scanned_by?: string;
    device_id?: string;
    scanned_at: string;
    is_unknown: boolean;
}

export interface PhysicalScanSummary {
    total_scans: number;
    total_quantity: number;
    unique_products: number;
    unknown_items: number;
    last_scan_at?: string;
}
