export interface AuthAPI {
    login: (credentials: any) => Promise<any>;
    sync: () => Promise<any>;
}

export interface ProductsAPI {
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
    create: (product: { sku: string; barcode: string | null; name: string; unit: string; last_price: number | null }) =>
        Promise<{ success: boolean; product?: any; error?: string }>;
}

declare global {
    interface Window {
        auth: AuthAPI;
        products: ProductsAPI;
    }
}
