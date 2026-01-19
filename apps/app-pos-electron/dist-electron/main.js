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
const CloudAuthAdapter_1 = require("./local-core/adapters/api/CloudAuthAdapter");
const LoginUseCase_1 = require("./local-core/application/LoginUseCase");
const SyncUsers_1 = require("./local-core/application/SyncUsers");
// Load env vars from root of monorepo (2 levels up from apps/app-pos-electron)
// apps/app-pos-electron -> apps -> Base (root)
// Note: __dirname is dist-electron/
const envPath = path_1.default.resolve(__dirname, '../../../.env');
console.log('Loading .env from:', envPath);
dotenv_1.default.config({ path: envPath });
let mainWindow = null;
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
        const cloudAdapter = new CloudAuthAdapter_1.CloudAuthAdapter(API_URL, SYNC_KEY);
        // 3. Use Cases
        const loginUseCase = new LoginUseCase_1.LoginUseCase(userRepo);
        const syncUseCase = new SyncUsers_1.SyncUsersUseCase(cloudAdapter, userRepo);
        // --- Auto Sync on Startup ---
        // We run this without blocking the window creation, just fire and forget (or log)
        syncUseCase.execute().then((res) => {
            console.log('Startup Sync Result:', res);
            if (mainWindow && !res.success) {
                // Optional: send error to UI
                // mainWindow.webContents.send('sync:error', res.error);
            }
        });
        // --- IPC Handlers ---
        electron_1.ipcMain.handle('auth:login', (_event_1, _a) => __awaiter(void 0, [_event_1, _a], void 0, function* (_event, { email, password }) {
            console.log(`IPC: auth:login for ${email}`);
            const result = yield loginUseCase.execute(email, password);
            return result;
        }));
        electron_1.ipcMain.handle('auth:sync', (_event) => __awaiter(void 0, void 0, void 0, function* () {
            console.log('IPC: auth:sync manual request');
            const result = yield syncUseCase.execute();
            return result;
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