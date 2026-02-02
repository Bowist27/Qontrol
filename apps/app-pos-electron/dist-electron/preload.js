"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Expose auth API to renderer
electron_1.contextBridge.exposeInMainWorld('auth', {
    login: (credentials) => electron_1.ipcRenderer.invoke('auth:login', credentials),
    logout: () => electron_1.ipcRenderer.invoke('auth:logout'),
    sync: () => electron_1.ipcRenderer.invoke('auth:sync'),
    getCurrentUser: () => electron_1.ipcRenderer.invoke('auth:getCurrentUser'),
});
// Expose products API to renderer
electron_1.contextBridge.exposeInMainWorld('products', {
    sync: () => electron_1.ipcRenderer.invoke('products:sync'),
    search: (query) => electron_1.ipcRenderer.invoke('products:search', query),
    count: () => electron_1.ipcRenderer.invoke('products:count'),
});
// Expose audit API to renderer
electron_1.contextBridge.exposeInMainWorld('audit', {
    createSession: (storeId, storeName) => electron_1.ipcRenderer.invoke('audit:createSession', { storeId, storeName }),
    getActiveSessions: () => electron_1.ipcRenderer.invoke('audit:getActiveSessions'),
    getSession: (sessionId) => electron_1.ipcRenderer.invoke('audit:getSession', sessionId),
    scan: (sessionId, barcode, quantity) => electron_1.ipcRenderer.invoke('audit:scan', { sessionId, barcode, quantity }),
    getItems: (sessionId) => electron_1.ipcRenderer.invoke('audit:getItems', sessionId),
    getSummary: (sessionId) => electron_1.ipcRenderer.invoke('audit:getSummary', sessionId),
    undo: (sessionId) => electron_1.ipcRenderer.invoke('audit:undo', sessionId),
    updateQuantity: (sessionId, quantity) => electron_1.ipcRenderer.invoke('audit:updateQuantity', { sessionId, quantity }),
    complete: (sessionId) => electron_1.ipcRenderer.invoke('audit:complete', sessionId),
});
//# sourceMappingURL=preload.js.map