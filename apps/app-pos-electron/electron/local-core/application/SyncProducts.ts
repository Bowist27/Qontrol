import { CloudProductAdapter } from '../adapters/api/CloudProductAdapter';
import { ProductRepository } from '../ports/ProductRepository';

interface SyncResult {
    success: boolean;
    added: number;
    total: number;
    error?: string;
}

export class SyncProductsUseCase {
    constructor(
        private cloudAdapter: CloudProductAdapter,
        private productRepo: ProductRepository
    ) {}

    async execute(): Promise<SyncResult> {
        try {
            const cloudProducts = await this.cloudAdapter.getProductsFromCloud();
            
            if (cloudProducts.length === 0) {
                return {
                    success: true,
                    added: 0,
                    total: this.productRepo.count()
                };
            }

            const stats = this.productRepo.saveBatch(cloudProducts);
            
            return {
                success: true,
                added: stats.added,
                total: stats.total
            };
        } catch (error: any) {
            console.error('Sync execution failed:', error.message);
            return {
                success: false,
                added: 0,
                total: this.productRepo.count(),
                error: error.message === 'NETWORK_ERROR' 
                    ? 'Error de conexión' 
                    : 'Error desconocido'
            };
        }
    }
}
