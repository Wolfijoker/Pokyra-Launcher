/**
 * Pokyra - Main Process Electron
 * Gère la fenêtre système sans bordure, la sécurité et la communication IPC.
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 900,
        height: 550,
        frame: false,          // Fenêtre sans bordures système (look premium custom)
        transparent: true,     // Support de la transparence et des coins arrondis
        resizable: false,      // Taille fixe pour garantir l'intégrité du design
        show: false,           // Masqué au départ pour éviter le flash blanc au chargement
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            devTools: !app.isPackaged  // DevTools UNIQUEMENT en mode développement
        }
    });

    // Chargement de l'interface graphique
    mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

    // Affichage propre une fois le contenu chargé — sans console en production
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        // DevTools uniquement quand on lance via "npm start" (développement)
        if (!app.isPackaged) {
            mainWindow.webContents.openDevTools({ mode: 'detach' });
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Initialisation de l'application Electron
app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// ---------------------------------------------------------
// REQUÊTES SYSTÈME IPC (Boutons Fermer / Réduire / Cacher)
// ---------------------------------------------------------
ipcMain.on('window-close', () => {
    app.quit();
});

ipcMain.on('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
});

// Cacher le launcher (quand Minecraft démarre)
ipcMain.on('window-hide', () => {
    if (mainWindow) mainWindow.hide();
});

// Réafficher le launcher (si Minecraft se ferme)
ipcMain.on('window-show', () => {
    if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
    }
});
