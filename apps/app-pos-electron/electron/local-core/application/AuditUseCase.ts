import { ProductRepository } from '../ports/ProductRepository';
import { AuditRepository } from '../ports/AuditRepository';
import { AuditSession, AuditScanItem, ScanResult } from '../domain/AuditSession';

export class AuditUseCase {
    constructor(
        private auditRepo: AuditRepository,
        private productRepo: ProductRepository
    ) {}

    /**
     * Create a new audit session
     */
    createSession(
        storeId: number,
        storeName: string,
        userId: string,
        userName: string
    ): AuditSession {
        return this.auditRepo.createSession({
            store_id: storeId,
            store_name: storeName,
            created_by: userId,
            created_by_name: userName,
            status: 'IN_PROGRESS',
            started_at: new Date().toISOString(),
            completed_at: null
        });
    }

    /**
     * Get active sessions
     */
    getActiveSessions(): AuditSession[] {
        return this.auditRepo.getActiveSessions();
    }

    /**
     * Get session by ID
     */
    getSession(sessionId: string): AuditSession | undefined {
        return this.auditRepo.getSession(sessionId);
    }

    /**
     * Scan a barcode - the core operation
     * @param sessionId - Current session
     * @param barcode - Scanned barcode
     * @param quantity - Quantity (default 1, or set via F2)
     */
    scanBarcode(sessionId: string, barcode: string, quantity: number = 1): ScanResult {
        // Clean barcode (remove whitespace, newlines from scanner)
        const cleanBarcode = barcode.trim().replace(/[\r\n]/g, '');
        
        if (!cleanBarcode) {
            return { success: false, error: 'Código de barras vacío' };
        }

        // Look up product in catalog
        const product = this.productRepo.findByBarcode(cleanBarcode);
        
        // Create scan item
        const item = this.auditRepo.addScanItem({
            session_id: sessionId,
            barcode: cleanBarcode,
            sku: product?.sku || null,
            product_name: product?.name || null,
            quantity: quantity,
            scanned_at: new Date().toISOString(),
            is_unknown: product ? 0 : 1
        });

        return {
            success: true,
            item,
            product: product ? {
                sku: product.sku,
                name: product.name,
                unit: product.unit
            } : undefined,
            isUnknown: !product
        };
    }

    /**
     * Update quantity of last scanned item (for corrections)
     */
    updateLastItemQuantity(sessionId: string, newQuantity: number): AuditScanItem | undefined {
        const lastItem = this.auditRepo.getLastItem(sessionId);
        if (lastItem) {
            this.auditRepo.updateItemQuantity(lastItem.id, newQuantity);
            return { ...lastItem, quantity: newQuantity };
        }
        return undefined;
    }

    /**
     * Delete last scanned item (undo)
     */
    undoLastScan(sessionId: string): boolean {
        const lastItem = this.auditRepo.getLastItem(sessionId);
        if (lastItem) {
            this.auditRepo.deleteItem(lastItem.id);
            return true;
        }
        return false;
    }

    /**
     * Get all items in session
     */
    getSessionItems(sessionId: string): AuditScanItem[] {
        return this.auditRepo.getSessionItems(sessionId);
    }

    /**
     * Get session summary
     */
    getSessionSummary(sessionId: string) {
        return this.auditRepo.getSessionSummary(sessionId);
    }

    /**
     * Complete the session
     */
    completeSession(sessionId: string): void {
        this.auditRepo.completeSession(sessionId);
    }

    /**
     * Search products (for manual entry)
     */
    searchProducts(query: string) {
        return this.productRepo.search(query);
    }
}
