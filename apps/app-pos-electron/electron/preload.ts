import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('auth', {
    login: (credentials: any) => ipcRenderer.invoke('auth:login', credentials),
    sync: () => ipcRenderer.invoke('auth:sync'),
    // Add listener for sync status updates if needed
});
