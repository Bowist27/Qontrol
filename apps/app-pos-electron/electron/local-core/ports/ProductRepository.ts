import { Product, ProductSyncStats } from '../domain/Product';

export interface ProductRepository {
    findByBarcode(barcode: string): Product | undefined;
    findBySku(sku: string): Product | undefined;
    search(query: string): Product[];
    count(): number;
    saveBatch(products: Product[]): ProductSyncStats;
    getAll(): Product[];
}
