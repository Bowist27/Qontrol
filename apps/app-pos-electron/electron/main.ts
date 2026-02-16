import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import dotenv from 'dotenv';
import { SQLiteUserRepo } from './local-core/adapters/sqlite/SQLiteUserRepo';
import { SQLiteProductRepo } from './local-core/adapters/sqlite/SQLiteProductRepo';
import { SQLiteAuditRepo } from './local-core/adapters/sqlite/SQLiteAuditRepo';
import { CloudAuthAdapter } from './local-core/adapters/api/CloudAuthAdapter';
import { CloudProductAdapter } from './local-core/adapters/api/CloudProductAdapter';
import { LoginUseCase } from './local-core/application/LoginUseCase';
import { SyncUsersUseCase } from './local-core/application/SyncUsers';
import { SyncProductsUseCase } from './local-core/application/SyncProducts';
import { AuditUseCase } from './local-core/application/AuditUseCase';
import { SafeUser } from './local-core/domain/User';

// Load env vars
// In dev: from monorepo root .env (3 levels up from dist-electron/)
// In production: from .env.production bundled as extraResource
const isDev = !app.isPackaged;
let envPath: string;
if (isDev) {
    envPath = path.resolve(__dirname, '../../../.env');
} else {
    envPath = path.join(process.resourcesPath, '.env.production');
}
console.log('Loading .env from:', envPath);
dotenv.config({ path: envPath });

let mainWindow: BrowserWindow | null = null;
let currentUser: SafeUser | null = null; // Store current logged-in user

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    if (isDev) {
        mainWindow.loadURL('http://localhost:5174');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    mainWindow.on('closed', () => (mainWindow = null));
}

app.on('ready', async () => {
    createWindow();

    try {
        // --- Hexagonal Initialization ---
        console.log('Initializing Core...');

        // 1. Env & Config
        const API_URL = process.env.VITE_API_URL || 'http://127.0.0.1:8081'; // Backend URL
        console.log('API_URL:', API_URL);
        const SYNC_KEY = process.env.SYNC_SECRET_KEY || 'my-secret-key-123'; // Must matches Backend .env
        console.log('SYNC_KEY (first 5 chars):', SYNC_KEY.substring(0, 5) + (SYNC_KEY.length > 5 ? '...' : ''));

        if (!SYNC_KEY) console.warn('WARNING: SYNC_SECRET_KEY is empty in Electron environment!');

        // 2. Adapters & Repo
        const userRepo = new SQLiteUserRepo();
        const productRepo = new SQLiteProductRepo();
        const auditRepo = new SQLiteAuditRepo();
        const cloudAdapter = new CloudAuthAdapter(API_URL, SYNC_KEY);
        const cloudProductAdapter = new CloudProductAdapter(API_URL, SYNC_KEY);

        // 3. Use Cases
        const loginUseCase = new LoginUseCase(userRepo);
        const syncUseCase = new SyncUsersUseCase(cloudAdapter, userRepo);
        const syncProductsUseCase = new SyncProductsUseCase(cloudProductAdapter, productRepo);
        const auditUseCase = new AuditUseCase(auditRepo, productRepo);

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

        ipcMain.handle('auth:login', async (_event, { email, password }) => {
            console.log(`IPC: auth:login for ${email}`);
            const result = await loginUseCase.execute(email, password);
            
            // Store user in memory if login successful
            if (result.success && result.user) {
                currentUser = result.user;
                console.log(`User logged in: ${currentUser.email} (${currentUser.role_name})`);
                console.log(`Permissions: ${currentUser.permissions.join(', ')}`);
            }
            
            return result;
        });

        ipcMain.handle('auth:logout', async (_event) => {
            console.log(`IPC: auth:logout for ${currentUser?.email || 'unknown'}`);
            currentUser = null;
            return { success: true };
        });

        ipcMain.handle('auth:getCurrentUser', async (_event) => {
            return currentUser;
        });

        ipcMain.handle('auth:sync', async (_event) => {
            console.log('IPC: auth:sync manual request');
            const result = await syncUseCase.execute();
            return result;
        });

        // --- Product Sync IPC ---
        ipcMain.handle('products:sync', async (_event) => {
            console.log('IPC: products:sync manual request');
            const result = await syncProductsUseCase.execute();
            return result;
        });

        ipcMain.handle('products:search', async (_event, query: string) => {
            return productRepo.search(query);
        });

        ipcMain.handle('products:count', async (_event) => {
            return productRepo.count();
        });

        ipcMain.handle('products:create', async (_event, product: { sku: string; barcode: string | null; name: string; unit: string; last_price: number | null }) => {
            console.log('IPC: products:create', product.sku);
            try {
                const saved = productRepo.saveOne(product);
                return { success: true, product: saved };
            } catch (err: any) {
                console.error('Failed to create product:', err);
                return { success: false, error: err.message };
            }
        });

        // --- Audit IPC Handlers ---
        ipcMain.handle('audit:createSession', async (_event, { storeId, storeName }) => {
            if (!currentUser) {
                return { success: false, error: 'No user logged in' };
            }
            const session = auditUseCase.createSession(
                storeId,
                storeName,
                currentUser.id,
                `${currentUser.first_name} ${currentUser.last_name}`
            );
            return { success: true, session };
        });

        ipcMain.handle('audit:getActiveSessions', async (_event) => {
            return auditUseCase.getActiveSessions();
        });

        ipcMain.handle('audit:getSession', async (_event, sessionId: string) => {
            return auditUseCase.getSession(sessionId);
        });

        ipcMain.handle('audit:scan', async (_event, { sessionId, barcode, quantity }) => {
            return auditUseCase.scanBarcode(sessionId, barcode, quantity || 1);
        });

        ipcMain.handle('audit:getItems', async (_event, sessionId: string) => {
            return auditUseCase.getSessionItems(sessionId);
        });

        ipcMain.handle('audit:getSummary', async (_event, sessionId: string) => {
            return auditUseCase.getSessionSummary(sessionId);
        });

        ipcMain.handle('audit:undo', async (_event, sessionId: string) => {
            return auditUseCase.undoLastScan(sessionId);
        });

        ipcMain.handle('audit:updateQuantity', async (_event, { sessionId, quantity }) => {
            return auditUseCase.updateLastItemQuantity(sessionId, quantity);
        });

        ipcMain.handle('audit:complete', async (_event, sessionId: string) => {
            auditUseCase.completeSession(sessionId);
            return { success: true };
        });

        console.log('Core Initialization Complete: Handlers Registered');
    } catch (error) {
        console.error('CRITICAL ERROR: Failed to initialize Electron Core:', error);
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
