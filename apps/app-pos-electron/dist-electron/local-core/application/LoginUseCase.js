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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
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
            // 3. Verify Password Hash
            try {
                const valid = yield argon2_1.default.verify(user.password_hash, password);
                if (!valid) {
                    return { success: false, error: 'Credenciales inválidas.', isOfflineLogin: true };
                }
                // 4. Return success (without hash)
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { password_hash: _ph } = user, safeUser = __rest(user, ["password_hash"]);
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