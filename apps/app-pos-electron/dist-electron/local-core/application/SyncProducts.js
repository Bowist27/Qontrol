"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncProductsUseCase = void 0;
class SyncProductsUseCase {
    constructor(cloudAdapter, productRepo) {
        this.cloudAdapter = cloudAdapter;
        this.productRepo = productRepo;
    }
    execute() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const cloudProducts = yield this.cloudAdapter.getProductsFromCloud();
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
            }
            catch (error) {
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
        });
    }
}
exports.SyncProductsUseCase = SyncProductsUseCase;
//# sourceMappingURL=SyncProducts.js.map