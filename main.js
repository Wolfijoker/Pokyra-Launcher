/**
 * Pokyra - Main Process Electron
 * Fenêtre système, sécurité (contextIsolation) et IPC.
 */

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const launcherService = require('./launcher-service');

let mainWindow;

function sendLaunchEvent(payload) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('launch-event', payload);
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 900,
        height: 550,
        frame: false,
        transparent: true,
        resizable: false,
        show: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            webSecurity: true,
            allowRunningInsecureContent: false,
            devTools: !app.isPackaged
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        if (!app.isPackaged) {
            mainWindow.webContents.openDevTools({ mode: 'detach' });
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

ipcMain.on('window-close', () => {
    app.quit();
});

ipcMain.on('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('get-pokyra-dir', async () => {
    return launcherService.POKYRA_DIR;
});

ipcMain.handle('open-external', async (_event, url) => {
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
        return { success: false, error: 'URL invalide' };
    }
    await shell.openExternal(url);
    return { success: true };
});

ipcMain.handle('open-folder', async (_event, folderPath) => {
    if (typeof folderPath !== 'string' || folderPath.length === 0) {
        return { success: false, error: 'Chemin invalide' };
    }
    try {
        launcherService.ensureFolderExists(folderPath);
        const result = await shell.openPath(folderPath);
        if (result) {
            return { success: false, error: result };
        }
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('launch-game', async (_event, options) => {
    const safeOptions = {
        username: typeof options?.username === 'string' ? options.username : '',
        ram: typeof options?.ram === 'string' ? options.ram : '4',
        schematica: !!options?.schematica,
        serverEndpoint: typeof options?.serverEndpoint === 'string' ? options.serverEndpoint : '',
        onEvent: (type, data) => {
            if (type === 'window-hide') {
                if (mainWindow) mainWindow.hide();
                return;
            }
            if (type === 'window-show') {
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                }
                return;
            }
            sendLaunchEvent({ type, ...data });
        }
    };

    return launcherService.launchGame(safeOptions);
});
