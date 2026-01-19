"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('auth', {
    login: (credentials) => electron_1.ipcRenderer.invoke('auth:login', credentials),
    sync: () => electron_1.ipcRenderer.invoke('auth:sync'),
    // Add listener for sync status updates if needed
});
//# sourceMappingURL=preload.js.map