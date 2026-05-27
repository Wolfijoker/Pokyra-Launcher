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
            devTools: true      // Activé en développement pour le débogage
        }
    });

    // Chargement de l'interface graphique
    mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

    // Affichage propre une fois le contenu chargé
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.webContents.openDevTools({ mode: 'detach' });
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
// REQUÊTES SYSTÈME IPC (Boutons Fermer / Réduire)
// ---------------------------------------------------------
ipcMain.on('window-close', () => {
    app.quit();
});

ipcMain.on('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
});

// ---------------------------------------------------------
// CONNEXION SÉCURISÉE MICROSOFT (Exécutée côté Main Process)
// ---------------------------------------------------------
ipcMain.on('microsoft-login-request', async (event) => {
    try {
        const { Auth } = require('msmc');
        const msmcAuth = new Auth("select_account");
        
        // Lance la popup de connexion Microsoft native d'Electron depuis le Main Process
        const xboxProfile = await msmcAuth.launch("electron");
        
        if (xboxProfile) {
            // Dans msmc v5, il faut appeler getMinecraft() pour récupérer la session MC
            const minecraft = await xboxProfile.getMinecraft();
            
            if (minecraft && minecraft.mcToken) {
                event.reply('microsoft-login-response', {
                    success: true,
                    profile: {
                        username: minecraft.profile.name,
                        uuid: minecraft.profile.id,
                        token: minecraft.mcToken
                    }
                });
            } else {
                event.reply('microsoft-login-response', { success: false, reason: "Impossible d'obtenir le jeton Minecraft." });
            }
        } else {
            event.reply('microsoft-login-response', { success: false, reason: "Annulé" });
        }
    } catch (error) {
        console.error("Erreur d'authentification Microsoft dans le Main Process :", error);
        event.reply('microsoft-login-response', { success: false, reason: error.message || error });
    }
});
