import { contextBridge, ipcRenderer } from 'electron';

// Expose auth API to renderer
contextBridge.exposeInMainWorld('auth', {
    login: (credentials: { email: string; password: string }) => 
        ipcRenderer.invoke('auth:login', credentials),
    logout: () => ipcRenderer.invoke('auth:logout'),
    sync: () => ipcRenderer.invoke('auth:sync'),
    getCurrentUser: () => ipcRenderer.invoke('auth:getCurrentUser'),
});

// Expose products API to renderer
contextBridge.exposeInMainWorld('products', {
    sync: () => ipcRenderer.invoke('products:sync'),
    search: (query: string) => ipcRenderer.invoke('products:search', query),
    count: () => ipcRenderer.invoke('products:count'),
});

// Expose audit API to renderer
contextBridge.exposeInMainWorld('audit', {
    createSession: (storeId: number, storeName: string) => 
        ipcRenderer.invoke('audit:createSession', { storeId, storeName }),
    getActiveSessions: () => ipcRenderer.invoke('audit:getActiveSessions'),
    getSession: (sessionId: string) => ipcRenderer.invoke('audit:getSession', sessionId),
    scan: (sessionId: string, barcode: string, quantity?: number) => 
        ipcRenderer.invoke('audit:scan', { sessionId, barcode, quantity }),
    getItems: (sessionId: string) => ipcRenderer.invoke('audit:getItems', sessionId),
    getSummary: (sessionId: string) => ipcRenderer.invoke('audit:getSummary', sessionId),
    undo: (sessionId: string) => ipcRenderer.invoke('audit:undo', sessionId),
    updateQuantity: (sessionId: string, quantity: number) => 
        ipcRenderer.invoke('audit:updateQuantity', { sessionId, quantity }),
    complete: (sessionId: string) => ipcRenderer.invoke('audit:complete', sessionId),
});

// Type declarations for TypeScript
declare global {
    interface Window {
        auth: {
            login: (credentials: { email: string; password: string }) => Promise<{
                success: boolean;
                user?: {
                    id: string;
                    email: string;
                    first_name: string;
                    last_name: string;
                    role_id: number;
                    role_name: string;
                    is_active: number;
                    permissions: string[];
                    store_ids: number[];
                };
                error?: string;
            }>;
            logout: () => Promise<{ success: boolean }>;
            sync: () => Promise<{ success: boolean; added: number; total: number; error?: string }>;
            getCurrentUser: () => Promise<{
                id: string;
                email: string;
                first_name: string;
                last_name: string;
                role_id: number;
                role_name: string;
                is_active: number;
                permissions: string[];
                store_ids: number[];
            } | null>;
        };
        products: {
            sync: () => Promise<{ success: boolean; added: number; total: number; error?: string }>;
            search: (query: string) => Promise<Array<{
                id: number;
                sku: string;
                barcode: string | null;
                name: string;
                unit: string;
                last_price: number | null;
            }>>;
            count: () => Promise<number>;
        };
        audit: {
            createSession: (storeId: number, storeName: string) => Promise<{
                success: boolean;
                session?: {
                    id: string;
                    store_id: number;
                    store_name: string;
                    created_by: string;
                    created_by_name: string;
                    status: string;
                    started_at: string;
                    total_items: number;
                    total_quantity: number;
                };
                error?: string;
            }>;
            getActiveSessions: () => Promise<Array<{
                id: string;
                store_id: number;
                store_name: string;
                created_by_name: string;
                status: string;
                started_at: string;
                total_items: number;
                total_quantity: number;
            }>>;
            getSession: (sessionId: string) => Promise<any>;
            scan: (sessionId: string, barcode: string, quantity?: number) => Promise<{
                success: boolean;
                item?: {
                    id: number;
                    barcode: string;
                    sku: string | null;
                    product_name: string | null;
                    quantity: number;
                    scanned_at: string;
                    is_unknown: number;
                };
                product?: {
                    sku: string;
                    name: string;
                    unit: string;
                };
                isUnknown?: boolean;
                error?: string;
            }>;
            getItems: (sessionId: string) => Promise<Array<{
                id: number;
                barcode: string;
                sku: string | null;
                product_name: string | null;
                quantity: number;
                scanned_at: string;
                is_unknown: number;
            }>>;
            getSummary: (sessionId: string) => Promise<{
                total_items: number;
                total_quantity: number;
                unique_products: number;
                unknown_items: number;
            }>;
            undo: (sessionId: string) => Promise<boolean>;
            updateQuantity: (sessionId: string, quantity: number) => Promise<any>;
            complete: (sessionId: string) => Promise<{ success: boolean }>;
        };
    }
}
