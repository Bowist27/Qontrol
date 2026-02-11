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
exports.CloudAuthAdapter = void 0;
const axios_1 = __importDefault(require("axios"));
class CloudAuthAdapter {
    constructor(apiUrl, syncKey) {
        this.apiUrl = apiUrl;
        this.syncKey = syncKey;
    }
    getUsersFromCloud() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const url = `${this.apiUrl}/api/users/sync`;
                console.log(`Syncing from ${url} with key ${this.syncKey ? 'PRESENT' : 'MISSING'}...`);
                const response = yield axios_1.default.get(url, {
                    headers: {
                        'X-Sync-Key': this.syncKey,
                    },
                    timeout: 5000 // 5 seconds timeout
                });
                if (response.data && response.data.users) {
                    return response.data.users;
                }
                return [];
            }
            catch (error) {
                console.error('Cloud Sync Error:', error);
                throw new Error('NETWORK_ERROR');
            }
        });
    }
}
exports.CloudAuthAdapter = CloudAuthAdapter;
//# sourceMappingURL=CloudAuthAdapter.js.map