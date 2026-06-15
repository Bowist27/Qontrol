import { Product, ProductSyncStats } from '../domain/Product';

export interface ProductRepository {
    findByBarcode(barcode: string): Product | undefined;
    findBySku(sku: string): Product | undefined;
    search(query: string): Product[];
    count(): number;
    saveBatch(products: Product[]): ProductSyncStats;
    saveOne(product: Omit<Product, 'id' | 'created_at'>): Product;
    getAll(): Product[];

    // Offline-First: metadata de la última sincronización del catálogo
    getLastSyncedAt(): string | null;
    setLastSyncedAt(iso: string): void;
}
