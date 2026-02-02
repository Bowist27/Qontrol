/**
 * Product Domain - Catálogo maestro de productos
 * Sincronizado desde el backend (originado de LISTADF.xlsx)
 */

export interface Product {
    id: number;
    sku: string;
    barcode: string | null;
    name: string;
    unit: string;
    last_price: number | null;
    created_at: string;
}

export interface ProductSyncStats {
    added: number;
    updated: number;
    total: number;
}
