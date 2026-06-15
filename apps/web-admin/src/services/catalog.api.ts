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

import { httpClient } from './httpClient';

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
    page: number;
    limit: number;
}

export interface ImportHistoryResponse {
    imports: ImportHistoryItem[];
}

export interface ProductChange {
    id: number;
    product_id: number;
    product_sku: string;
    product_name: string;
    action: 'create' | 'update' | 'delete';
    old_values?: Record<string, any>;
    new_values?: Record<string, any>;
    user_email: string;
    user_name: string;
    created_at: string;
    time_ago: string;
}

export interface ProductChangesResponse {
    changes: ProductChange[];
    total_count: number;
}

export interface CreateProductRequest {
    sku: string;
    name: string;
    barcode?: string;
    unit: string;
    price: number;
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
     * GET /api/catalog - List products with pagination
     */
    getProducts: async (page: number = 1, limit: number = 25, search: string = '', sortBy: string = '', hideZero: boolean = false): Promise<CatalogListResponse> => {
        const params = new URLSearchParams();
        params.append('page', page.toString());
        params.append('limit', limit.toString());
        if (search) {
            params.append('search', search);
        }
        if (sortBy) {
            params.append('sort_by', sortBy);
        }
        if (hideZero) {
            params.append('hide_zero', 'true');
        }
        return httpClient.get<CatalogListResponse>(`${API_BASE}/api/catalog?${params.toString()}`);
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

        return httpClient.postMultipart<CatalogDiffResult>(`${API_BASE}/api/catalog/analyze`, formData);
    },

    /**
     * POST /api/catalog/analyze/save - Save analysis for later
     */
    saveAnalysis: async (result: CatalogDiffResult, userName: string): Promise<{ import_id: number }> => {
        return httpClient.post<{ import_id: number }>(`${API_BASE}/api/catalog/analyze/save`, { result, user_name: userName });
    },

    /**
     * GET /api/catalog/imports - Get import history
     */
    getImportHistory: async (limit?: number): Promise<ImportHistoryItem[]> => {
        const url = limit
            ? `${API_BASE}/api/catalog/imports?limit=${limit}`
            : `${API_BASE}/api/catalog/imports`;
        const data = await httpClient.get<ImportHistoryResponse>(url);
        return data.imports || [];
    },

    /**
     * POST /api/catalog/imports/:id/commit - Apply selected changes
     */
    commitImport: async (importId: number, selectedSKUs: string[]): Promise<void> => {
        return httpClient.post<void>(`${API_BASE}/api/catalog/imports/${importId}/commit`, { selected_skus: selectedSKUs });
    },

    /**
     * POST /api/catalog/imports/:id/revert - Revert an applied import
     */
    revertImport: async (importId: number): Promise<void> => {
        return httpClient.post<void>(`${API_BASE}/api/catalog/imports/${importId}/revert`);
    },

    /**
     * DELETE /api/catalog/imports/:id - Discard/delete a pending import
     */
    discardImport: async (importId: number): Promise<void> => {
        return httpClient.delete<void>(`${API_BASE}/api/catalog/imports/${importId}`);
    },

    /**
     * POST /api/catalog/imports/:id/restore - Restore a previous version
     */
    restoreImport: async (importId: number): Promise<void> => {
        return httpClient.post<void>(`${API_BASE}/api/catalog/imports/${importId}/restore`);
    },

    /**
     * DELETE /api/catalog/clear - Clear entire catalog (products + history)
     */
    clearCatalog: async (): Promise<{ message: string; deleted_products: number }> => {
        return httpClient.delete<{ message: string; deleted_products: number }>(`${API_BASE}/api/catalog/clear`);
    },

    /**
     * PUT /api/catalog/products/:id - Update a product
     */
    updateProduct: async (id: number, data: { sku: string; name: string; barcode: string; unit: string; price: number }): Promise<{ message: string }> => {
        return httpClient.put<{ message: string }>(`${API_BASE}/api/catalog/products/${id}`, data);
    },

    /**
     * DELETE /api/catalog/products/:id - Delete a product
     */
    deleteProduct: async (id: number): Promise<{ message: string }> => {
        return httpClient.delete<{ message: string }>(`${API_BASE}/api/catalog/products/${id}`);
    },

    /**
     * POST /api/catalog/products - Create a new product
     */
    createProduct: async (data: CreateProductRequest): Promise<{ message: string; product_id: number }> => {
        return httpClient.post<{ message: string; product_id: number }>(`${API_BASE}/api/catalog/products`, data);
    },

    /**
     * GET /api/catalog/changes - Get manual product changes history
     */
    getProductChanges: async (page: number = 1, limit: number = 50): Promise<ProductChangesResponse> => {
        const params = new URLSearchParams();
        params.append('page', page.toString());
        params.append('limit', limit.toString());
        return httpClient.get<ProductChangesResponse>(`${API_BASE}/api/catalog/changes?${params.toString()}`);
    },

    /**
     * GET /api/catalog/valuation/latest - Get latest pending valuation
     */
    getLatestValuationSummary: async (): Promise<ValuationSummary> => {
        try {
            const data = await httpClient.get<LatestValuationResponse>(`${API_BASE}/api/catalog/valuation/latest`);
            return data.summary;
        } catch (error: any) {
            if (error.message?.includes('404') || error.message?.includes('No hay valuación')) {
                throw new Error('No hay valuación pendiente');
            }
            throw error;
        }
    },

    /**
     * GET /api/catalog/valuation/latest - Get latest pending valuation products
     */
    getLatestValuationProducts: async (): Promise<ValuationProduct[]> => {
        try {
            const data = await httpClient.get<LatestValuationResponse>(`${API_BASE}/api/catalog/valuation/latest`);
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
        } catch (error: any) {
            if (error.message?.includes('404') || error.message?.includes('No hay valuación')) {
                throw new Error('No hay valuación pendiente');
            }
            throw error;
        }
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
