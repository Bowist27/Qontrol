import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import dotenv from 'dotenv';
import { SQLiteUserRepo } from './local-core/adapters/sqlite/SQLiteUserRepo';
import { CloudAuthAdapter } from './local-core/adapters/api/CloudAuthAdapter';
import { LoginUseCase } from './local-core/application/LoginUseCase';
import { SyncUsersUseCase } from './local-core/application/SyncUsers';

// Load env vars from root of monorepo (2 levels up from apps/app-pos-electron)
// apps/app-pos-electron -> apps -> Base (root)
// Note: __dirname is dist-electron/
const envPath = path.resolve(__dirname, '../../../.env');
console.log('Loading .env from:', envPath);
dotenv.config({ path: envPath });

let mainWindow: BrowserWindow | null = null;
const isDev = !app.isPackaged;

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
        mainWindow.loadURL('http://localhost:5173');
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
        const cloudAdapter = new CloudAuthAdapter(API_URL, SYNC_KEY);

        // 3. Use Cases
        const loginUseCase = new LoginUseCase(userRepo);
        const syncUseCase = new SyncUsersUseCase(cloudAdapter, userRepo);

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

        ipcMain.handle('auth:login', async (_event, { email, password }) => {
            console.log(`IPC: auth:login for ${email}`);
            const result = await loginUseCase.execute(email, password);
            return result;
        });

        ipcMain.handle('auth:sync', async (_event) => {
            console.log('IPC: auth:sync manual request');
            const result = await syncUseCase.execute();
            return result;
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
