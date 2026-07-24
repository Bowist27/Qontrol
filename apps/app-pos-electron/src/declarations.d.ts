export interface AuthAPI {
    login: (credentials: any) => Promise<any>;
    getCurrentUser: () => Promise<any>;
    logout: () => Promise<void>;
    sync: () => Promise<any>;
}

export interface LocalProductRecord {
    id: number;
    sku: string;
    barcode: string | null;
    name: string;
    unit: string;
    last_price: number | null;
}

export interface ProductsAPI {
    sync: () => Promise<{ success: boolean; added: number; total: number; error?: string }>;
    search: (query: string) => Promise<LocalProductRecord[]>;
    findByBarcode: (barcode: string) => Promise<LocalProductRecord | null>;
    count: () => Promise<number>;
    create: (product: { sku: string; barcode: string | null; name: string; unit: string; last_price: number | null }) =>
        Promise<{ success: boolean; product?: any; error?: string }>;
}

export interface SyncQueueAPI {
    enqueue: (item: {
        auditId: number;
        barcode: string;
        quantity: number;
        scannedBy?: string | null;
        deviceId?: string | null;
        scannedAt: string;
    }) => Promise<{ success: boolean; item?: unknown; error?: string }>;
    getPendingCount: () => Promise<number>;
}

export interface CatalogAPI {
    getLastSyncedAt: () => Promise<string | null>;
}

declare global {
    interface Window {
        auth: AuthAPI;
        products: ProductsAPI;
        syncQueue: SyncQueueAPI;
        catalog: CatalogAPI;
    }
}
