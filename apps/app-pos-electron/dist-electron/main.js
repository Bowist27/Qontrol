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
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const SQLiteUserRepo_1 = require("./local-core/adapters/sqlite/SQLiteUserRepo");
const SQLiteProductRepo_1 = require("./local-core/adapters/sqlite/SQLiteProductRepo");
const SQLiteAuditRepo_1 = require("./local-core/adapters/sqlite/SQLiteAuditRepo");
const CloudAuthAdapter_1 = require("./local-core/adapters/api/CloudAuthAdapter");
const CloudProductAdapter_1 = require("./local-core/adapters/api/CloudProductAdapter");
const LoginUseCase_1 = require("./local-core/application/LoginUseCase");
const SyncUsers_1 = require("./local-core/application/SyncUsers");
const SyncProducts_1 = require("./local-core/application/SyncProducts");
const AuditUseCase_1 = require("./local-core/application/AuditUseCase");
// Load env vars from root of monorepo (2 levels up from apps/app-pos-electron)
// apps/app-pos-electron -> apps -> Base (root)
// Note: __dirname is dist-electron/
const envPath = path_1.default.resolve(__dirname, '../../../.env');
console.log('Loading .env from:', envPath);
dotenv_1.default.config({ path: envPath });
let mainWindow = null;
let currentUser = null; // Store current logged-in user
const isDev = !electron_1.app.isPackaged;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile(path_1.default.join(__dirname, '../dist/index.html'));
    }
    mainWindow.on('closed', () => (mainWindow = null));
}
electron_1.app.on('ready', () => __awaiter(void 0, void 0, void 0, function* () {
    createWindow();
    try {
        // --- Hexagonal Initialization ---
        console.log('Initializing Core...');
        // 1. Env & Config
        const API_URL = process.env.VITE_API_URL || 'http://127.0.0.1:8081'; // Backend URL
        console.log('API_URL:', API_URL);
        const SYNC_KEY = process.env.SYNC_SECRET_KEY || 'my-secret-key-123'; // Must matches Backend .env
        console.log('SYNC_KEY (first 5 chars):', SYNC_KEY.substring(0, 5) + (SYNC_KEY.length > 5 ? '...' : ''));
        if (!SYNC_KEY)
            console.warn('WARNING: SYNC_SECRET_KEY is empty in Electron environment!');
        // 2. Adapters & Repo
        const userRepo = new SQLiteUserRepo_1.SQLiteUserRepo();
        const productRepo = new SQLiteProductRepo_1.SQLiteProductRepo();
        const auditRepo = new SQLiteAuditRepo_1.SQLiteAuditRepo();
        const cloudAdapter = new CloudAuthAdapter_1.CloudAuthAdapter(API_URL, SYNC_KEY);
        const cloudProductAdapter = new CloudProductAdapter_1.CloudProductAdapter(API_URL, SYNC_KEY);
        // 3. Use Cases
        const loginUseCase = new LoginUseCase_1.LoginUseCase(userRepo);
        const syncUseCase = new SyncUsers_1.SyncUsersUseCase(cloudAdapter, userRepo);
        const syncProductsUseCase = new SyncProducts_1.SyncProductsUseCase(cloudProductAdapter, productRepo);
        const auditUseCase = new AuditUseCase_1.AuditUseCase(auditRepo, productRepo);
        // --- Auto Sync on Startup ---
        // Sync users and products in parallel
        Promise.all([
            syncUseCase.execute(),
            syncProductsUseCase.execute()
        ]).then(([userRes, productRes]) => {
            console.log('Startup User Sync Result:', userRes);
            console.log('Startup Product Sync Result:', productRes);
        });
        // --- IPC Handlers ---
        electron_1.ipcMain.handle('auth:login', (_event_1, _a) => __awaiter(void 0, [_event_1, _a], void 0, function* (_event, { email, password }) {
            console.log(`IPC: auth:login for ${email}`);
            const result = yield loginUseCase.execute(email, password);
            // Store user in memory if login successful
            if (result.success && result.user) {
                currentUser = result.user;
                console.log(`User logged in: ${currentUser.email} (${currentUser.role_name})`);
                console.log(`Permissions: ${currentUser.permissions.join(', ')}`);
            }
            return result;
        }));
        electron_1.ipcMain.handle('auth:logout', (_event) => __awaiter(void 0, void 0, void 0, function* () {
            console.log(`IPC: auth:logout for ${(currentUser === null || currentUser === void 0 ? void 0 : currentUser.email) || 'unknown'}`);
            currentUser = null;
            return { success: true };
        }));
        electron_1.ipcMain.handle('auth:getCurrentUser', (_event) => __awaiter(void 0, void 0, void 0, function* () {
            return currentUser;
        }));
        electron_1.ipcMain.handle('auth:sync', (_event) => __awaiter(void 0, void 0, void 0, function* () {
            console.log('IPC: auth:sync manual request');
            const result = yield syncUseCase.execute();
            return result;
        }));
        // --- Product Sync IPC ---
        electron_1.ipcMain.handle('products:sync', (_event) => __awaiter(void 0, void 0, void 0, function* () {
            console.log('IPC: products:sync manual request');
            const result = yield syncProductsUseCase.execute();
            return result;
        }));
        electron_1.ipcMain.handle('products:search', (_event, query) => __awaiter(void 0, void 0, void 0, function* () {
            return productRepo.search(query);
        }));
        electron_1.ipcMain.handle('products:count', (_event) => __awaiter(void 0, void 0, void 0, function* () {
            return productRepo.count();
        }));
        electron_1.ipcMain.handle('products:create', (_event, product) => __awaiter(void 0, void 0, void 0, function* () {
            console.log('IPC: products:create', product.sku);
            try {
                const saved = productRepo.saveOne(product);
                return { success: true, product: saved };
            }
            catch (err) {
                console.error('Failed to create product:', err);
                return { success: false, error: err.message };
            }
        }));
        // --- Audit IPC Handlers ---
        electron_1.ipcMain.handle('audit:createSession', (_event_1, _a) => __awaiter(void 0, [_event_1, _a], void 0, function* (_event, { storeId, storeName }) {
            if (!currentUser) {
                return { success: false, error: 'No user logged in' };
            }
            const session = auditUseCase.createSession(storeId, storeName, currentUser.id, `${currentUser.first_name} ${currentUser.last_name}`);
            return { success: true, session };
        }));
        electron_1.ipcMain.handle('audit:getActiveSessions', (_event) => __awaiter(void 0, void 0, void 0, function* () {
            return auditUseCase.getActiveSessions();
        }));
        electron_1.ipcMain.handle('audit:getSession', (_event, sessionId) => __awaiter(void 0, void 0, void 0, function* () {
            return auditUseCase.getSession(sessionId);
        }));
        electron_1.ipcMain.handle('audit:scan', (_event_1, _a) => __awaiter(void 0, [_event_1, _a], void 0, function* (_event, { sessionId, barcode, quantity }) {
            return auditUseCase.scanBarcode(sessionId, barcode, quantity || 1);
        }));
        electron_1.ipcMain.handle('audit:getItems', (_event, sessionId) => __awaiter(void 0, void 0, void 0, function* () {
            return auditUseCase.getSessionItems(sessionId);
        }));
        electron_1.ipcMain.handle('audit:getSummary', (_event, sessionId) => __awaiter(void 0, void 0, void 0, function* () {
            return auditUseCase.getSessionSummary(sessionId);
        }));
        electron_1.ipcMain.handle('audit:undo', (_event, sessionId) => __awaiter(void 0, void 0, void 0, function* () {
            return auditUseCase.undoLastScan(sessionId);
        }));
        electron_1.ipcMain.handle('audit:updateQuantity', (_event_1, _a) => __awaiter(void 0, [_event_1, _a], void 0, function* (_event, { sessionId, quantity }) {
            return auditUseCase.updateLastItemQuantity(sessionId, quantity);
        }));
        electron_1.ipcMain.handle('audit:complete', (_event, sessionId) => __awaiter(void 0, void 0, void 0, function* () {
            auditUseCase.completeSession(sessionId);
            return { success: true };
        }));
        console.log('Core Initialization Complete: Handlers Registered');
    }
    catch (error) {
        console.error('CRITICAL ERROR: Failed to initialize Electron Core:', error);
    }
}));
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
//# sourceMappingURL=main.js.map