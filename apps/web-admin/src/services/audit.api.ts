/**
 * Audit API Client
 * Connects frontend to audit-service (port 8081)
 */

const API_BASE = import.meta.env.VITE_AUDIT_API_URL || 'http://localhost:8081';

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
     * POST /api/audits - Create audit session with PDF
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
     * POST /api/audits/:id/confirm - Confirm audit (status → IN_PROGRESS)
     */
    confirmAudit: async (sessionId: number): Promise<void> => {
        const res = await fetch(`${API_BASE}/api/audits/${sessionId}/confirm`, {
            method: 'POST',
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Failed to confirm audit');
        }
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
