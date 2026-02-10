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
}

declare global {
    interface Window {
        auth: AuthAPI;
        products: ProductsAPI;
    }
}
