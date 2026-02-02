/**
 * Catalog API Client
 * Connects frontend to audit-service catalog endpoints
 * 
 * Endpoints:
 * - GET /api/catalog - List all products
 * - POST /api/catalog/analyze - Analyze valuation report (PDF/Excel)
 * - POST /api/catalog/analyze/save - Save analysis for later commit
 * - GET /api/catalog/imports - Get import history
 * - POST /api/catalog/imports/:id/commit - Apply selected changes
 * - POST /api/catalog/imports/:id/revert - Revert an applied import
 */

const API_BASE = import.meta.env.VITE_AUDIT_API_URL || 'http://localhost:8085';

// Types matching backend domain

export interface Product {
    id: number;
    sku: string;
    barcode?: string;
    name: string;
    unit: string;
    last_price: number;
    last_updated: string;
    source?: string;
}

export interface CatalogDiffItem {
    sku: string;
    name: string;
    type: 'new' | 'price_up' | 'price_down';
    old_price?: number;
    new_price: number;
    difference: number;
    percent_change?: number;
    selected: boolean;
}

export interface CatalogDiffResult {
    file_name: string;
    store_name: string;
    detected_store?: string;
    date: string;
    new_products: number;
    price_up: number;
    price_down: number;
    unchanged: number;
    total_value: number;
    previous_value: number;
    economic_impact_up: number;
    economic_impact_down: number;
    details: CatalogDiffItem[];
}

export interface ImportHistoryItem {
    id: number;
    date: string;
    time_ago: string;
    user: string;
    file_name: string;
    new_products: number;
    price_changes: number;
    total_value: number;
    previous_value: number;
    status: 'pending' | 'applied' | 'reverted';
}

export interface CatalogListResponse {
    products: Product[];
    total_count: number;
    total_value: number;
}

export interface ImportHistoryResponse {
    imports: ImportHistoryItem[];
}

// Types for valuation view
export interface ValuationSummary {
    id: number;
    file_name: string;
    store_name: string;
    imported_by: string;
    new_products: number;
    price_up: number;
    price_down: number;
    unchanged: number;
    total_value: number;
    previous_value: number;
    economic_impact_up: number;
    economic_impact_down: number;
    status: string;
    created_at: string;
}

export interface ValuationProduct {
    sku: string;
    name: string;
    changeType: 'new' | 'price_up' | 'price_down' | 'unchanged';
    oldPrice?: number;
    newPrice: number;
    difference: number;
    percentChange?: number;
    selected: boolean;
}

interface LatestValuationResponse {
    summary: ValuationSummary;
    products: Array<{
        sku: string;
        name: string;
        change_type: string;
        old_price?: number;
        new_price: number;
        difference: number;
        percent_change?: number;
        selected: boolean;
    }>;
}

// API Client
export const catalogApi = {
    /**
     * GET /api/catalog - List all products
     */
    getProducts: async (): Promise<CatalogListResponse> => {
        const res = await fetch(`${API_BASE}/api/catalog`);
        if (!res.ok) throw new Error('Failed to fetch catalog');
        return res.json();
    },

    /**
     * POST /api/catalog/analyze - Analyze a valuation report
     * Parses PDF/Excel and compares against current catalog
     */
    analyzeReport: async (file: File, storeName?: string): Promise<CatalogDiffResult> => {
        const formData = new FormData();
        formData.append('file', file);
        if (storeName) {
            formData.append('store_name', storeName);
        }

        const res = await fetch(`${API_BASE}/api/catalog/analyze`, {
            method: 'POST',
            body: formData,
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Failed to analyze report');
        }
        return res.json();
    },

    /**
     * POST /api/catalog/analyze/save - Save analysis for later
     */
    saveAnalysis: async (result: CatalogDiffResult, userName: string): Promise<{ import_id: number }> => {
        const res = await fetch(`${API_BASE}/api/catalog/analyze/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ result, user_name: userName }),
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Failed to save analysis');
        }
        return res.json();
    },

    /**
     * GET /api/catalog/imports - Get import history
     */
    getImportHistory: async (limit?: number): Promise<ImportHistoryItem[]> => {
        const url = limit 
            ? `${API_BASE}/api/catalog/imports?limit=${limit}`
            : `${API_BASE}/api/catalog/imports`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch import history');
        const data: ImportHistoryResponse = await res.json();
        return data.imports || [];
    },

    /**
     * POST /api/catalog/imports/:id/commit - Apply selected changes
     */
    commitImport: async (importId: number, selectedSKUs: string[]): Promise<void> => {
        const res = await fetch(`${API_BASE}/api/catalog/imports/${importId}/commit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ selected_skus: selectedSKUs }),
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Failed to commit import');
        }
    },

    /**
     * POST /api/catalog/imports/:id/revert - Revert an applied import
     */
    revertImport: async (importId: number): Promise<void> => {
        const res = await fetch(`${API_BASE}/api/catalog/imports/${importId}/revert`, {
            method: 'POST',
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Failed to revert import');
        }
    },

    /**
     * DELETE /api/catalog/imports/:id - Discard/delete a pending import
     */
    discardImport: async (importId: number): Promise<void> => {
        const res = await fetch(`${API_BASE}/api/catalog/imports/${importId}`, {
            method: 'DELETE',
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Failed to discard import');
        }
    },

    /**
     * GET /api/catalog/valuation/latest - Get latest pending valuation
     */
    getLatestValuationSummary: async (): Promise<ValuationSummary> => {
        const res = await fetch(`${API_BASE}/api/catalog/valuation/latest`);
        if (!res.ok) {
            if (res.status === 404) {
                throw new Error('No hay valuación pendiente');
            }
            throw new Error('Failed to fetch latest valuation');
        }
        const data: LatestValuationResponse = await res.json();
        return data.summary;
    },

    /**
     * GET /api/catalog/valuation/latest - Get latest pending valuation products
     */
    getLatestValuationProducts: async (): Promise<ValuationProduct[]> => {
        const res = await fetch(`${API_BASE}/api/catalog/valuation/latest`);
        if (!res.ok) {
            if (res.status === 404) {
                throw new Error('No hay valuación pendiente');
            }
            throw new Error('Failed to fetch latest valuation products');
        }
        const data: LatestValuationResponse = await res.json();
        return data.products.map(p => ({
            sku: p.sku,
            name: p.name,
            changeType: p.change_type as ValuationProduct['changeType'],
            oldPrice: p.old_price,
            newPrice: p.new_price,
            difference: p.difference,
            percentChange: p.percent_change,
            selected: p.selected,
        }));
    },
};

// Helper functions to transform API data to component format

export const transformDiffResult = (apiResult: CatalogDiffResult) => ({
    fileName: apiResult.file_name,
    storeName: apiResult.store_name,
    detectedStore: apiResult.detected_store,
    date: apiResult.date,
    newProducts: apiResult.new_products,
    priceUp: apiResult.price_up,
    priceDown: apiResult.price_down,
    unchanged: apiResult.unchanged,
    totalValue: apiResult.total_value,
    previousValue: apiResult.previous_value,
    economicImpactUp: apiResult.economic_impact_up,
    economicImpactDown: apiResult.economic_impact_down,
    details: apiResult.details.map(d => ({
        sku: d.sku,
        name: d.name,
        type: d.type,
        oldPrice: d.old_price,
        newPrice: d.new_price,
        difference: d.difference,
        percentChange: d.percent_change,
        selected: d.selected,
    })),
});

export const transformImportHistory = (apiItems: ImportHistoryItem[]) => 
    apiItems.map(item => ({
        id: `IMP-${String(item.id).padStart(3, '0')}`,
        numericId: item.id,
        date: item.date,
        timeAgo: item.time_ago,
        user: item.user,
        fileName: item.file_name,
        newProducts: item.new_products,
        priceChanges: item.price_changes,
        totalValue: item.total_value,
        previousValue: item.previous_value,
        status: item.status,
    }));

export type TransformedDiffResult = ReturnType<typeof transformDiffResult>;
export type TransformedImportHistory = ReturnType<typeof transformImportHistory>[0];
