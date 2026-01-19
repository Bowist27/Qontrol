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
exports.SyncUsersUseCase = void 0;
class SyncUsersUseCase {
    constructor(cloudAdapter, userRepo) {
        this.cloudAdapter = cloudAdapter;
        this.userRepo = userRepo;
    }
    execute() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // 1. Fetch from cloud
                const users = yield this.cloudAdapter.getUsersFromCloud();
                if (users.length === 0) {
                    // Maybe success but 0 users?
                    return { success: true, added: 0, total: this.userRepo.count() };
                }
                // 2. Save locally
                const stats = this.userRepo.saveBatch(users);
                return {
                    success: true,
                    added: stats.added,
                    total: stats.total
                };
            }
            catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                console.error('Sync execution failed:', errorMessage);
                return {
                    success: false,
                    added: 0,
                    total: this.userRepo.count(),
                    error: errorMessage === 'NETWORK_ERROR' ? 'Error de conexión' : 'Error al sincronizar'
                };
            }
        });
    }
}
exports.SyncUsersUseCase = SyncUsersUseCase;
//# sourceMappingURL=SyncUsers.js.map