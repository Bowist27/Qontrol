import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import dotenv from 'dotenv';
import axios from 'axios';
import { autoUpdater } from 'electron-updater';
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

// --- Auto-Updater Configuration (S3) ---
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

autoUpdater.on('checking-for-update', () => {
    console.log('[AutoUpdater] Checking for updates...');
});

autoUpdater.on('update-available', (info) => {
    console.log(`[AutoUpdater] Update available: v${info.version}`);
});

autoUpdater.on('update-not-available', () => {
    console.log('[AutoUpdater] App is up to date.');
});

autoUpdater.on('download-progress', (progress) => {
    console.log(`[AutoUpdater] Downloading: ${Math.round(progress.percent)}%`);
    if (mainWindow) {
        mainWindow.setProgressBar(progress.percent / 100);
    }
});

autoUpdater.on('update-downloaded', (info) => {
    console.log(`[AutoUpdater] Update downloaded: v${info.version}`);
    if (mainWindow) {
        mainWindow.setProgressBar(-1); // Remove progress bar
    }
    dialog.showMessageBox(mainWindow!, {
        type: 'info',
        title: 'Actualización disponible',
        message: `Se descargó la versión ${info.version}. La app se actualizará al cerrarla.`,
        buttons: ['Reiniciar ahora', 'Después'],
    }).then((result) => {
        if (result.response === 0) {
            autoUpdater.quitAndInstall();
        }
    });
});

autoUpdater.on('error', (err) => {
    console.error('[AutoUpdater] Error:', err.message);
});

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

    // --- Auto-Update: check on startup (only in production) ---
    if (!isDev) {
        setTimeout(() => {
            console.log('[AutoUpdater] Checking for updates on startup...');
            autoUpdater.checkForUpdates().catch(err => {
                console.error('[AutoUpdater] Failed to check:', err.message);
            });
        }, 5000); // Wait 5s for app to fully load before checking
    }

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

        // ─────────────────────────────────────────────────────────────
        // Offline-First: workers en segundo plano (Store & Forward)
        // ─────────────────────────────────────────────────────────────

        // Base de la API de auditoría (mismo formato que el renderer: base + /api)
        const AUDIT_API = `${process.env.VITE_AUDIT_API_URL || 'http://localhost:8085'}/api`;
        const CATALOG_REFRESH_MS = 30 * 60 * 1000; // refrescar catálogo cada 30 min

        let isSyncingScans = false;

        // Worker 1: sube a la nube los escaneos guardados localmente sin red.
        async function runScanSyncWorker() {
            if (isSyncingScans) return; // evita ciclos solapados
            isSyncingScans = true;
            try {
                const pending = auditRepo.getPendingScans(50);
                if (pending.length === 0) return;
                console.log(`[SyncWorker] Subiendo ${pending.length} escaneo(s) pendiente(s)...`);

                const synced: number[] = [];
                for (const item of pending) {
                    try {
                        await axios.post(
                            `${AUDIT_API}/audits/${item.audit_id}/scans`,
                            {
                                barcode: item.barcode,
                                quantity: item.quantity,
                                scanned_by: item.scanned_by || undefined,
                                device_id: item.device_id || undefined,
                                scanned_at: item.scanned_at
                            },
                            { timeout: 8000 }
                        );
                        synced.push(item.id);
                    } catch (err: any) {
                        auditRepo.markScanFailed(item.id, err?.message ?? 'unknown');
                    }
                }
                if (synced.length > 0) {
                    auditRepo.markScansSynced(synced);
                    console.log(`[SyncWorker] ${synced.length} escaneo(s) subido(s) correctamente.`);
                }
            } catch (err) {
                console.error('[SyncWorker] Error inesperado:', err);
            } finally {
                isSyncingScans = false;
            }
        }

        // Worker 2: descarga/actualiza el catálogo local de productos y usuarios.
        // Así la búsqueda manual (F7) funciona aunque se caiga el internet.
        async function runCatalogSyncWorker() {
            const lastSync = productRepo.getLastSyncedAt();
            if (lastSync) {
                const elapsed = Date.now() - new Date(lastSync).getTime();
                if (elapsed < CATALOG_REFRESH_MS) return; // ya está fresco
            }
            try {
                const [userRes, productRes] = await Promise.all([
                    syncUseCase.execute(),
                    syncProductsUseCase.execute()
                ]);
                if (productRes.success) {
                    productRepo.setLastSyncedAt(new Date().toISOString());
                }
                console.log('[CatalogWorker] Sync usuarios:', userRes, '| productos:', productRes);
            } catch (err) {
                // Silencioso: sin red se reintenta en el próximo ciclo.
                console.warn('[CatalogWorker] Sync falló, se reintentará:', err);
            }
        }

        // Arranque: recuperar pendientes de sesiones anteriores e intentar sync.
        auditRepo.resetStaleScans();
        runScanSyncWorker();
        runCatalogSyncWorker();

        // Ciclos periódicos.
        setInterval(runScanSyncWorker, 15_000);   // cada 15s sube pendientes
        setInterval(runCatalogSyncWorker, 60_000); // cada 1 min revisa si toca refrescar (guarda interna de 30 min)

        // --- IPC Handlers ---

        ipcMain.handle('app:getVersion', () => app.getVersion());

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

        // Offline-First: búsqueda directa por código de barras en el catálogo local.
        ipcMain.handle('products:findByBarcode', async (_event, barcode: string) => {
            const byBarcode = productRepo.findByBarcode(barcode);
            if (byBarcode) return byBarcode;
            // Fallback: algunos productos usan el SKU como código escaneado.
            return productRepo.findBySku(barcode) ?? null;
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

        // --- Offline-First: cola de escaneos + estado del catálogo ---
        ipcMain.handle('queue:enqueue', async (_event, item: {
            auditId: number;
            barcode: string;
            quantity: number;
            scannedBy?: string | null;
            deviceId?: string | null;
            scannedAt: string;
        }) => {
            try {
                const saved = auditRepo.enqueueScan({
                    audit_id: item.auditId,
                    barcode: item.barcode,
                    quantity: item.quantity,
                    scanned_by: item.scannedBy ?? null,
                    device_id: item.deviceId ?? null,
                    scanned_at: item.scannedAt
                });
                // Dispara un intento inmediato por si la red ya volvió.
                runScanSyncWorker();
                return { success: true, item: saved };
            } catch (err: any) {
                console.error('queue:enqueue failed:', err);
                return { success: false, error: err?.message };
            }
        });

        ipcMain.handle('queue:getPendingCount', async (_event) => {
            return auditRepo.countPendingScans();
        });

        ipcMain.handle('catalog:getLastSyncedAt', async (_event) => {
            return productRepo.getLastSyncedAt();
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
