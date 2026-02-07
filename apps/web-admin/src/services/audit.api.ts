/**
 * Audit API Client
 * Connects frontend to audit-service (port 8081)
 * 
 * Flow (Approach B):
 * 1. parsePDF() - Parse for preview, no save
 * 2. User reviews preview
 * 3. createAudit() - Save after user confirms
 */

import { httpClient } from './httpClient';



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

// Helper to get headers with Auth (deprecated)
// const getHeaders = ...
// const getMultipartHeaders = ...

// API Client
export const auditApi = {
    /**
     * GET /api/stores - List all active stores
     */
    getStores: async (): Promise<Store[]> => {
        const data = await httpClient.get<{ stores: Store[] }>(`${API_BASE}/api/stores`);
        return data.stores;
    },

    /**
     * POST /api/audits/parse - Parse PDF for preview (FASE 3)
     * Does NOT save to database - only returns parsed items for user review
     */
    parsePDF: async (file: File): Promise<ParseResult> => {
        const formData = new FormData();
        formData.append('file', file);
        return httpClient.postMultipart<ParseResult>(`${API_BASE}/api/audits/parse`, formData);
    },

    /**
     * POST /api/audits - Create audit session (FASE 5)
     * Called AFTER user confirms the preview - saves everything
     */
    createAudit: async (storeId: number, file: File): Promise<AuditDTO> => {
        const formData = new FormData();
        formData.append('store_id', storeId.toString());
        formData.append('file', file);
        return httpClient.postMultipart<AuditDTO>(`${API_BASE}/api/audits`, formData);
    },

    /**
     * GET /api/audits/:id - Get audit with items
     */
    getAudit: async (sessionId: number): Promise<AuditDTO> => {
        return httpClient.get<AuditDTO>(`${API_BASE}/api/audits/${sessionId}`);
    },

    /**
     * GET /api/audits - List all audits for dashboard
     */
    getSessions: async (): Promise<AuditListDTO[]> => {
        const data = await httpClient.get<{ audits: AuditListDTO[] }>(`${API_BASE}/api/audits`);
        return data.audits;
    },

    /**
     * DELETE /api/audits/:id - Cancel/Delete an audit
     */
    deleteAudit: async (sessionId: number): Promise<void> => {
        return httpClient.delete<void>(`${API_BASE}/api/audits/${sessionId}`);
    },

    // ============ CATALOG APIs ============

    /**
     * GET /api/catalog - Get all catalog products
     */
    getCatalogProducts: async () => {
        return httpClient.get<any>(`${API_BASE}/api/catalog`);
    },

    /**
     * POST /api/catalog/analyze - Analyze a valuation report against catalog
     */
    analyzeValuation: async (file: File, storeName: string) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('store_name', storeName);
        return httpClient.postMultipart<any>(`${API_BASE}/api/catalog/analyze`, formData);
    },

    /**
     * GET /api/catalog/valuation/latest - Get latest pending valuation
     */
    getLatestValuation: async () => {
        try {
            return await httpClient.get<any>(`${API_BASE}/api/catalog/valuation/latest`);
        } catch (error: any) {
            if (error.message?.includes('404')) return null;
            throw error;
        }
    },

    /**
     * POST /api/catalog/analyze/save - Save analysis for later commit
     */
    saveAnalysis: async (result: any, userName: string) => {
        return httpClient.post<any>(`${API_BASE}/api/catalog/analyze/save`, { result, user_name: userName });
    },

    /**
     * POST /api/catalog/imports/:id/commit - Apply selected changes
     */
    commitCatalogImport: async (importId: number, selectedSKUs: string[]) => {
        return httpClient.post<any>(`${API_BASE}/api/catalog/imports/${importId}/commit`, { selected_skus: selectedSKUs });
    },

    /**
     * POST /api/catalog/imports/:id/revert - Revert import
     */
    revertCatalogImport: async (importId: number) => {
        return httpClient.post<any>(`${API_BASE}/api/catalog/imports/${importId}/revert`);
    },

    /**
     * GET /api/catalog/imports - Get import history
     */
    getCatalogHistory: async (limit = 20) => {
        return httpClient.get<any>(`${API_BASE}/api/catalog/imports?limit=${limit}`);
    },

    // ============ PHYSICAL SCAN APIs (POS Integration) ============

    /**
     * GET /api/audits/:id/scans - Get physical scans for an audit
     */
    getPhysicalScans: async (auditId: number): Promise<PhysicalScan[]> => {
        const data = await httpClient.get<{ scans: PhysicalScan[] }>(`${API_BASE}/api/audits/${auditId}/scans`);
        return data.scans || [];
    },

    /**
     * GET /api/audits/:id/scans/summary - Get summary stats for physical scans
     */
    getPhysicalScanSummary: async (auditId: number): Promise<PhysicalScanSummary> => {
        return httpClient.get<PhysicalScanSummary>(`${API_BASE}/api/audits/${auditId}/scans/summary`);
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
