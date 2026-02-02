"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditUseCase = void 0;
class AuditUseCase {
    constructor(auditRepo, productRepo) {
        this.auditRepo = auditRepo;
        this.productRepo = productRepo;
    }
    /**
     * Create a new audit session
     */
    createSession(storeId, storeName, userId, userName) {
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
    getActiveSessions() {
        return this.auditRepo.getActiveSessions();
    }
    /**
     * Get session by ID
     */
    getSession(sessionId) {
        return this.auditRepo.getSession(sessionId);
    }
    /**
     * Scan a barcode - the core operation
     * @param sessionId - Current session
     * @param barcode - Scanned barcode
     * @param quantity - Quantity (default 1, or set via F2)
     */
    scanBarcode(sessionId, barcode, quantity = 1) {
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
            sku: (product === null || product === void 0 ? void 0 : product.sku) || null,
            product_name: (product === null || product === void 0 ? void 0 : product.name) || null,
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
    updateLastItemQuantity(sessionId, newQuantity) {
        const lastItem = this.auditRepo.getLastItem(sessionId);
        if (lastItem) {
            this.auditRepo.updateItemQuantity(lastItem.id, newQuantity);
            return Object.assign(Object.assign({}, lastItem), { quantity: newQuantity });
        }
        return undefined;
    }
    /**
     * Delete last scanned item (undo)
     */
    undoLastScan(sessionId) {
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
    getSessionItems(sessionId) {
        return this.auditRepo.getSessionItems(sessionId);
    }
    /**
     * Get session summary
     */
    getSessionSummary(sessionId) {
        return this.auditRepo.getSessionSummary(sessionId);
    }
    /**
     * Complete the session
     */
    completeSession(sessionId) {
        this.auditRepo.completeSession(sessionId);
    }
    /**
     * Search products (for manual entry)
     */
    searchProducts(query) {
        return this.productRepo.search(query);
    }
}
exports.AuditUseCase = AuditUseCase;
//# sourceMappingURL=AuditUseCase.js.map