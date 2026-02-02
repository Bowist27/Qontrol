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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoginUseCase = void 0;
const argon2_1 = __importDefault(require("argon2"));
class LoginUseCase {
    constructor(userRepo) {
        this.userRepo = userRepo;
    }
    execute(email, password) {
        return __awaiter(this, void 0, void 0, function* () {
            // 1. Find user locally
            const user = this.userRepo.findByEmail(email);
            // 2. If no user found
            // Specialized logic: If DB is empty, guide user to sync
            if (!user) {
                const count = this.userRepo.count();
                if (count === 0) {
                    return { success: false, error: 'DB_EMPTY', isOfflineLogin: true };
                }
                return { success: false, error: 'Credenciales inválidas.', isOfflineLogin: true };
            }
            // 3. Check if user is active
            if (!user.is_active) {
                return { success: false, error: 'Usuario desactivado. Contacte al administrador.', isOfflineLogin: true };
            }
            // 4. Verify Password Hash
            try {
                const valid = yield argon2_1.default.verify(user.password_hash, password);
                if (!valid) {
                    return { success: false, error: 'Credenciales inválidas.', isOfflineLogin: true };
                }
                // 5. Return success with safe user data (no password_hash)
                const safeUser = {
                    id: user.id,
                    email: user.email,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    role_id: user.role_id,
                    role_name: user.role_name,
                    is_active: user.is_active,
                    permissions: user.permissions || [],
                    store_ids: user.store_ids || [],
                };
                return { success: true, user: safeUser, isOfflineLogin: true };
            }
            catch (err) {
                console.error('Argon2 verify error:', err);
                return { success: false, error: 'Error interno de autenticación.', isOfflineLogin: true };
            }
        });
    }
}
exports.LoginUseCase = LoginUseCase;
//# sourceMappingURL=LoginUseCase.js.map