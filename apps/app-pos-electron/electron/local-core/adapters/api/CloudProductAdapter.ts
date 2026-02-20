import axios from 'axios';
import { Product } from '../../domain/Product';

export class CloudProductAdapter {
    private apiUrl: string;
    private syncKey: string;

    constructor(apiUrl: string, syncKey: string) {
        this.apiUrl = apiUrl;
        this.syncKey = syncKey;
    }

    async getProductsFromCloud(): Promise<Product[]> {
        try {
            const url = `${this.apiUrl}/products/sync`;
            console.log(`Syncing products from ${url}...`);
            const response = await axios.get(url, {
                headers: {
                    'X-Sync-Key': this.syncKey,
                },
                timeout: 10000 // 10 seconds for larger data
            });

            if (response.data && response.data.products) {
                return response.data.products;
            }
            return [];
        } catch (error) {
            console.error('Product Cloud Sync Error:', error);
            throw new Error('NETWORK_ERROR');
        }
    }
}
