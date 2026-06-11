/**
 * Pont sécurisé renderer ↔ main (contextIsolation).
 * Seules ces APIs sont exposées à l'interface — pas d'accès Node.js direct.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pokyra', {
    windowClose: () => ipcRenderer.send('window-close'),
    windowMinimize: () => ipcRenderer.send('window-minimize'),
    getPokyraDir: () => ipcRenderer.invoke('get-pokyra-dir'),
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
    openFolder: (folderPath) => ipcRenderer.invoke('open-folder', folderPath),
    launchGame: (options) => ipcRenderer.invoke('launch-game', options),
    onLaunchEvent: (callback) => {
        const handler = (_event, payload) => callback(payload);
        ipcRenderer.on('launch-event', handler);
        return () => ipcRenderer.removeListener('launch-event', handler);
    }
});
