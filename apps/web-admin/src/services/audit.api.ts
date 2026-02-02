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
};
