/**
 * Pokyra Launcher - Contrôleur Logique Frontend v1.1.0
 * Gère les interactions utilisateur, les paramètres (RAM, Schematica)
 * et le lancement du jeu.
 */

const { ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');

// Paramètres de configuration globaux
const SERVER_IP = "play.pokyra.fr";
const SERVER_PORT = 25565;
const POKYRA_DIR = path.join(process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME), '.pokyra');
const MODPACK_ZIP_URL = "https://github.com/Wolfijoker/pokyra-assets/releases/download/1.0/modpack.zip";
const MODPACK_CACHE_PATH = path.join(POKYRA_DIR, "modpack-cache.zip");
const JAVA_RUNTIME_DIR = path.join(POKYRA_DIR, "runtime", "java8");
const JAVA8_WINDOWS_ZIP_URL = "https://api.adoptium.net/v3/binary/latest/8/ga/windows/x64/jre/hotspot/normal/eclipse";

// Noms des mods optionnels (inclus dans le modpack.zip de base, gérés par le launcher)
const SCHEMATICA_JAR = "Schematica-1.12.2-1.8.0.169-universal.jar";
const LUNATRIUSCORE_JAR = "LunatriusCore-1.12.2-1.2.0.42-universal.jar";

// JEI : le modpack.zip contient encore 4.16.1.1013 (textures GUI cassées avec Pixelmon 8.4)
const JEI_FIXED_JAR = "jei_1.12.2-4.16.1.301.jar";
const JEI_FIXED_URL = "https://maven.blamejared.com/mezz/jei/jei_1.12.2/4.16.1.301/jei_1.12.2-4.16.1.301.jar";

// PokyraOverlay : rechargement auto textures JEI à la connexion serveur
const OVERLAY_FIXED_JAR = "PokyraOverlay-1.0.3.jar";
const OVERLAY_FIXED_URL = "https://github.com/Wolfijoker/pokyra-assets/releases/download/1.0/PokyraOverlay-1.0.3.jar";

// Éléments du DOM
const btnClose = document.getElementById('btn-close');
const btnMinimize = document.getElementById('btn-minimize');
const btnSettings = document.getElementById('btn-settings');
const btnSettingsClose = document.getElementById('btn-settings-close');
const btnSaveSettings = document.getElementById('btn-save-settings');
const settingsOverlay = document.getElementById('settings-overlay');
const inputOfflineUsername = document.getElementById('offline-username-input');
const feedbackBox = document.getElementById('feedback-box');
const feedbackText = document.getElementById('feedback-text');
const btnPlay = document.getElementById('btn-play');
const progressState = document.getElementById('progress-state');
const progressPercent = document.getElementById('progress-percent');
const progressFill = document.getElementById('progress-fill');
const playerCountText = document.getElementById('player-count-text');
const ramSlider = document.getElementById('ram-slider');
const ramDisplayValue = document.getElementById('ram-display-value');
const toggleSchematica = document.getElementById('toggle-schematica');
const badgeRamLabel = document.getElementById('badge-ram-label');
const badgeSchematicaEl = document.getElementById('badge-schematica');

// Initialisation générale
document.addEventListener("DOMContentLoaded", () => {
    initWindowControls();
    initSettingsPanel();
    initOfflineForm();
    initServerStatus();
    initSocialLinks();
    updateActiveBadges();
});

// ---------------------------------------------------------
// CONTRÔLES FENÊTRE SYSTÈME
// ---------------------------------------------------------
function initWindowControls() {
    btnClose.addEventListener('click', () => {
        ipcRenderer.send('window-close');
    });

    btnMinimize.addEventListener('click', () => {
        ipcRenderer.send('window-minimize');
    });
}

// ---------------------------------------------------------
// PANNEAU DE PARAMÈTRES
// ---------------------------------------------------------
function initSettingsPanel() {
    // Charger les valeurs sauvegardées
    const savedRam = localStorage.getItem('pokyra_ram') || '4';
    const savedSchematica = localStorage.getItem('pokyra_schematica') === 'true';

    ramSlider.value = savedRam;
    ramDisplayValue.textContent = `${savedRam} Go`;
    toggleSchematica.checked = savedSchematica;

    // Ouvrir/fermer le panneau via l'engrenage
    btnSettings.addEventListener('click', () => {
        console.log('[Settings] Clic sur engrenage, overlay caché ?', settingsOverlay.classList.contains('hidden'));
        const isHidden = settingsOverlay.classList.contains('hidden');
        if (isHidden) {
            settingsOverlay.classList.remove('hidden');
            btnSettings.classList.add('active');
            console.log('[Settings] Panneau ouvert');
        } else {
            closeSettingsPanel();
            console.log('[Settings] Panneau fermé');
        }
    });

    // Bouton X dans le panneau
    btnSettingsClose.addEventListener('click', closeSettingsPanel);

    // Bouton Sauvegarder & Fermer
    btnSaveSettings.addEventListener('click', () => {
        saveSettings();
        closeSettingsPanel();
    });

    // Mise à jour dynamique du slider RAM
    ramSlider.addEventListener('input', () => {
        ramDisplayValue.textContent = `${ramSlider.value} Go`;
    });

    // Fermer en cliquant hors du panneau
    settingsOverlay.addEventListener('click', (e) => {
        if (e.target === settingsOverlay) {
            saveSettings();
            closeSettingsPanel();
        }
    });

    // Boutons d'accès rapide
    const btnOpenGameFolder = document.getElementById('btn-open-game-folder');
    const btnOpenModsFolder = document.getElementById('btn-open-mods-folder');
    const btnOpenScreenshots = document.getElementById('btn-open-screenshots-folder');

    btnOpenGameFolder.addEventListener('click', () => openFolder(POKYRA_DIR));
    btnOpenModsFolder.addEventListener('click', () => openFolder(path.join(POKYRA_DIR, 'mods')));
    btnOpenScreenshots.addEventListener('click', () => openFolder(path.join(POKYRA_DIR, 'screenshots')));
}

function closeSettingsPanel() {
    settingsOverlay.classList.add('hidden');
    btnSettings.classList.remove('active');
    updateActiveBadges();
}

function saveSettings() {
    localStorage.setItem('pokyra_ram', ramSlider.value);
    localStorage.setItem('pokyra_schematica', toggleSchematica.checked.toString());
    updateActiveBadges();
}

function updateActiveBadges() {
    const ram = localStorage.getItem('pokyra_ram') || '4';
    const schematica = localStorage.getItem('pokyra_schematica') === 'true';

    if (badgeRamLabel) badgeRamLabel.textContent = `${ram} Go RAM`;
    if (badgeSchematicaEl) {
        const span = badgeSchematicaEl.querySelector('span');
        if (schematica) {
            badgeSchematicaEl.classList.remove('config-badge-off');
            if (span) span.textContent = 'Schematica ON';
        } else {
            badgeSchematicaEl.classList.add('config-badge-off');
            if (span) span.textContent = 'Schematica OFF';
        }
    }
}

function openFolder(folderPath) {
    try {
        // Créer le dossier s'il n'existe pas
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
        }
        const { shell } = require('electron');
        shell.openPath(folderPath);
    } catch (e) {
        showFeedback(`Impossible d'ouvrir le dossier : ${e.message}`, 'warning');
    }
}

// ---------------------------------------------------------
// FORMULAIRE DE SAISIE DU PSEUDO (OFFLINE)
// ---------------------------------------------------------
function initOfflineForm() {
    const savedPseudo = localStorage.getItem('pokyra_last_pseudo');
    if (savedPseudo) {
        inputOfflineUsername.value = savedPseudo;
    }

    validatePlayButton();

    inputOfflineUsername.addEventListener('input', () => {
        const username = inputOfflineUsername.value.trim();
        if (username.length >= 3) {
            localStorage.setItem('pokyra_last_pseudo', username);
        }
        validatePlayButton();
    });
}

// ---------------------------------------------------------
// VALIDATION DU BOUTON JOUER
// ---------------------------------------------------------
function validatePlayButton() {
    const username = inputOfflineUsername.value.trim();
    if (username.length >= 3) {
        btnPlay.classList.remove('disabled');
    } else {
        btnPlay.classList.add('disabled');
    }
}

// ---------------------------------------------------------
// LIVE STATUT DU SERVEUR
// ---------------------------------------------------------
async function initServerStatus() {
    try {
        const serverTarget = localStorage.getItem('pokyra_server_endpoint') || `${SERVER_IP}:${SERVER_PORT}`;
        const { host } = parseServerEndpoint(serverTarget);
        const response = await fetch(`https://api.mcsrvstat.us/2/${host}`);
        const data = await response.json();

        if (data.online) {
            playerCountText.textContent = `${data.players.online} Joueurs en ligne`;
            document.querySelector('.status-indicator').style.backgroundColor = "var(--color-cyan)";
        } else {
            playerCountText.textContent = "Serveur Hors Ligne";
            document.querySelector('.status-indicator').style.backgroundColor = "var(--text-muted)";
        }
    } catch (e) {
        playerCountText.textContent = "play.pokyra.fr";
    }
}

// ---------------------------------------------------------
// RÉSEAUX SOCIAUX & LIENS EXTERNES
// ---------------------------------------------------------
function initSocialLinks() {
    const socialButtons = document.querySelectorAll('.social-btn');
    socialButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const url = btn.getAttribute('data-url');
            if (url && url !== "#") {
                const { shell } = require('electron');
                shell.openExternal(url);
            } else {
                showFeedback("Ce réseau social sera bientôt disponible !", "info");
            }
        });
    });
}

// ---------------------------------------------------------
// ENVOI DE MESSAGES DE NOTIFICATION DANS L'UI
// ---------------------------------------------------------
function showFeedback(text, type = "info") {
    feedbackBox.classList.remove('hidden');
    feedbackText.textContent = text;

    if (type === "success") {
        feedbackBox.style.borderColor = "hsl(142, 70%, 45%)";
        feedbackBox.style.background = "rgba(34, 197, 94, 0.05)";
        feedbackText.style.color = "hsl(142, 70%, 85%)";
    } else if (type === "danger" || type === "warning") {
        feedbackBox.style.borderColor = "hsl(0, 72%, 50%)";
        feedbackBox.style.background = "rgba(239, 68, 68, 0.05)";
        feedbackText.style.color = "hsl(0, 72%, 85%)";
    } else {
        feedbackBox.style.borderColor = "var(--color-cyan-glow)";
        feedbackBox.style.background = "rgba(6, 182, 212, 0.05)";
        feedbackText.style.color = "var(--text-secondary)";
    }
}

// ---------------------------------------------------------
// TÉLÉCHARGEMENT AVEC GESTION DES REDIRECTIONS
// ---------------------------------------------------------
function downloadWithRedirects(url, destPath, onProgress) {
    const https = require('https');
    const http = require('http');
    const { URL } = require('url');

    fs.mkdirSync(path.dirname(destPath), { recursive: true });

    return new Promise((resolve, reject) => {
        function executeGet(currentUrl) {
            try {
                const urlObj = new URL(currentUrl);
                const client = urlObj.protocol === 'https:' ? https : http;

                client.get(currentUrl, (response) => {
                    if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                        executeGet(new URL(response.headers.location, currentUrl).href);
                        return;
                    }

                    if (response.statusCode !== 200) {
                        reject(new Error(`Code statut invalide : ${response.statusCode}`));
                        return;
                    }

                    const total = parseInt(response.headers['content-length'], 10) || 0;
                    let downloaded = 0;
                    const file = fs.createWriteStream(destPath);

                    response.on('data', (chunk) => {
                        downloaded += chunk.length;
                        if (onProgress && total > 0) {
                            onProgress(downloaded, total);
                        }
                    });

                    response.pipe(file);
                    file.on('finish', () => { file.close(); resolve(); });
                }).on('error', (err) => {
                    fs.unlink(destPath, () => { });
                    reject(err);
                });
            } catch (e) {
                reject(e);
            }
        }

        executeGet(url);
    });
}

function headWithRedirects(url) {
    const https = require('https');
    const http = require('http');
    const { URL } = require('url');

    return new Promise((resolve, reject) => {
        function executeHead(currentUrl) {
            try {
                const urlObj = new URL(currentUrl);
                const client = urlObj.protocol === 'https:' ? https : http;

                const request = client.request(currentUrl, { method: 'HEAD' }, (response) => {
                    if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                        response.resume();
                        executeHead(new URL(response.headers.location, currentUrl).href);
                        return;
                    }

                    if (response.statusCode !== 200) {
                        response.resume();
                        reject(new Error(`Code statut invalide : ${response.statusCode}`));
                        return;
                    }

                    response.resume();
                    resolve({
                        contentLength: parseInt(response.headers['content-length'], 10) || 0
                    });
                });

                request.on('error', reject);
                request.end();
            } catch (e) {
                reject(e);
            }
        }

        executeHead(url);
    });
}

async function getRemoteModpackSize() {
    try {
        const head = await headWithRedirects(MODPACK_ZIP_URL);
        return head.contentLength;
    } catch (err) {
        console.warn('Vérification modpack distant impossible :', err.message);
        return 0;
    }
}

function getLocalModpackSize(filePath) {
    if (!filePath || !fs.existsSync(filePath)) return -1;
    return fs.statSync(filePath).size;
}

async function isModpackCacheUpToDate() {
    const localPath = fs.existsSync(MODPACK_CACHE_PATH) ? MODPACK_CACHE_PATH : null;
    if (!localPath) return false;

    const remoteSize = await getRemoteModpackSize();
    if (remoteSize <= 0) return true;

    return getLocalModpackSize(localPath) === remoteSize;
}

// ---------------------------------------------------------
// GESTION DES MODS OPTIONNELS (SCHEMATICA)
// ---------------------------------------------------------
// ---------------------------------------------------------
// GESTION DES MODS OPTIONNELS (SCHEMATICA)
// Schematica et LunatriusCore sont inclus dans le modpack.zip.
// Si le toggle est OFF, on les supprime après extraction.
// Si le toggle est ON, ils restent en place (comportement par défaut).
// ---------------------------------------------------------
function manageOptionalMods() {
    const modsDir = path.join(POKYRA_DIR, 'mods');
    const schematicaPath = path.join(modsDir, SCHEMATICA_JAR);
    const lunatriusPath = path.join(modsDir, LUNATRIUSCORE_JAR);
    const schematicaEnabled = localStorage.getItem('pokyra_schematica') === 'true';

    if (!schematicaEnabled) {
        // Supprimer les mods optionnels si le toggle est OFF
        let removed = [];
        for (const [modPath, name] of [[schematicaPath, SCHEMATICA_JAR], [lunatriusPath, LUNATRIUSCORE_JAR]]) {
            if (fs.existsSync(modPath)) {
                fs.unlinkSync(modPath);
                removed.push(name);
                console.log(`🗑️ Mod optionnel supprimé : ${name}`);
            }
        }
        if (removed.length > 0) {
            console.log('Schematica désactivé : mods supprimés du dossier.');
        }
    } else {
        console.log('Schematica activé : les mods seront conservés après extraction du pack.');
    }
}

// ---------------------------------------------------------
// JEI — une seule version (évite doublon FML + textures blanches)
// ---------------------------------------------------------
function removeDuplicateJeiJars() {
    const modsDir = path.join(POKYRA_DIR, 'mods');
    if (!fs.existsSync(modsDir)) {
        return;
    }
    for (const file of fs.readdirSync(modsDir)) {
        if (!file.toLowerCase().startsWith('jei_') || !file.endsWith('.jar')) {
            continue;
        }
        if (file === JEI_FIXED_JAR) {
            continue;
        }
        fs.unlinkSync(path.join(modsDir, file));
        console.log(`🔧 JEI : version en double supprimée — ${file}`);
    }
}

async function ensureFixedJeiVersion() {
    const modsDir = path.join(POKYRA_DIR, 'mods');
    fs.mkdirSync(modsDir, { recursive: true });
    const fixedPath = path.join(modsDir, JEI_FIXED_JAR);

    if (!fs.existsSync(fixedPath)) {
        console.log('📥 Téléchargement JEI corrigé (4.16.1.301)...');
        await downloadWithRedirects(JEI_FIXED_URL, fixedPath);
        console.log('✅ JEI 4.16.1.301 installé.');
    }

    removeDuplicateJeiJars();
}

// ---------------------------------------------------------
// PokyraOverlay — version avec fix JEI (rechargement textures auto)
// ---------------------------------------------------------
function removeDuplicateOverlayJars() {
    const modsDir = path.join(POKYRA_DIR, 'mods');
    if (!fs.existsSync(modsDir)) {
        return;
    }
    for (const file of fs.readdirSync(modsDir)) {
        if (!file.toLowerCase().startsWith('pokyraoverlay-') || !file.endsWith('.jar')) {
            continue;
        }
        if (file === OVERLAY_FIXED_JAR) {
            continue;
        }
        fs.unlinkSync(path.join(modsDir, file));
        console.log(`🔧 PokyraOverlay : version en double supprimée — ${file}`);
    }
}

async function ensureFixedOverlayVersion() {
    const modsDir = path.join(POKYRA_DIR, 'mods');
    fs.mkdirSync(modsDir, { recursive: true });
    const fixedPath = path.join(modsDir, OVERLAY_FIXED_JAR);

    if (!fs.existsSync(fixedPath)) {
        const bundledPath = path.join(__dirname, '..', 'assets', OVERLAY_FIXED_JAR);
        if (fs.existsSync(bundledPath)) {
            fs.copyFileSync(bundledPath, fixedPath);
            console.log('✅ PokyraOverlay 1.0.3 installé depuis le launcher.');
        } else {
            console.log('📥 Téléchargement PokyraOverlay 1.0.3...');
            await downloadWithRedirects(OVERLAY_FIXED_URL, fixedPath);
            console.log('✅ PokyraOverlay 1.0.3 installé.');
        }
    }

    removeDuplicateOverlayJars();
}

// ---------------------------------------------------------
// VÉRIFICATION QUE JAVA EST INSTALLÉ
// ---------------------------------------------------------
function checkJavaInstalled() {
    const child_process = require('child_process');
    try {
        const result = child_process.execSync('java -version', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
        return true;
    } catch (e) {
        // java -version écrit sur stderr donc on doit aussi capturer stderr
        try {
            child_process.execSync('java -version 2>&1', { encoding: 'utf8', shell: true });
            return true;
        } catch (e2) {
            return false;
        }
    }
}

// ---------------------------------------------------------
// RECHERCHE DYNAMIQUE DE JAVA 8
// ---------------------------------------------------------
function findJava8Path() {
    const child_process = require('child_process');

    try {
        const output = child_process.execSync('where java', { encoding: 'utf8' });
        const foundPaths = output.split('\r\n').map(p => p.trim()).filter(p => p.length > 0);

        const java8Paths = foundPaths.filter(p =>
            p.toLowerCase().includes('8') ||
            p.toLowerCase().includes('1.8') ||
            p.toLowerCase().includes('java8path')
        );

        if (java8Paths.length > 0) return java8Paths[0];
        if (foundPaths.length > 0) return foundPaths[0];
    } catch (e) {
        console.warn("Recherche Java indisponible via 'where java':", e.message);
    }

    const standardJavaFolders = [
        "C:\\Program Files\\Java",
        "C:\\Program Files (x86)\\Java",
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Eclipse Adoptium')
    ];

    for (const folder of standardJavaFolders) {
        if (fs.existsSync(folder)) {
            try {
                const subfolders = fs.readdirSync(folder);
                for (const sub of subfolders) {
                    if (sub.includes('8') || sub.includes('1.8')) {
                        const candidatePath = path.join(folder, sub, 'bin', 'java.exe');
                        if (fs.existsSync(candidatePath)) return candidatePath;
                        const candidateJre = path.join(folder, sub, 'jre', 'bin', 'java.exe');
                        if (fs.existsSync(candidateJre)) return candidateJre;
                    }
                }
            } catch (err) { }
        }
    }

    return "java";
}

function getJavaVersionMajor(javaPath) {
    const child_process = require('child_process');
    try {
        const output = child_process.execSync(`"${javaPath}" -version 2>&1`, { encoding: 'utf8', shell: true });
        const match = output.match(/version "(.*?)"/i);
        if (!match) return null;

        const versionString = match[1];
        // Java 8 => "1.8.x", Java 11+ => "11.x"
        if (versionString.startsWith("1.")) {
            const minor = parseInt(versionString.split(".")[1], 10);
            return Number.isFinite(minor) ? minor : null;
        }
        const major = parseInt(versionString.split(".")[0], 10);
        return Number.isFinite(major) ? major : null;
    } catch (e) {
        return null;
    }
}

function parseServerEndpoint(rawEndpoint) {
    const fallback = { host: SERVER_IP, port: SERVER_PORT };
    if (!rawEndpoint || typeof rawEndpoint !== 'string') return fallback;

    const endpoint = rawEndpoint.trim().replace(/^minecraft:\/\//i, '');
    if (!endpoint) return fallback;

    const lastColonIndex = endpoint.lastIndexOf(':');
    if (lastColonIndex > 0) {
        const host = endpoint.slice(0, lastColonIndex).trim();
        const portRaw = endpoint.slice(lastColonIndex + 1).trim();
        const parsedPort = parseInt(portRaw, 10);
        if (host && Number.isFinite(parsedPort) && parsedPort > 0 && parsedPort <= 65535) {
            return { host, port: parsedPort };
        }
    }

    return { host: endpoint, port: SERVER_PORT };
}

function normalizeExitCode(code) {
    if (typeof code !== 'number' || !Number.isFinite(code)) return code;
    // Sur Windows certains codes négatifs sont exposés en uint32.
    return code > 2147483647 ? code - 4294967296 : code;
}

function findFileRecursive(rootDir, fileName, maxDepth = 4) {
    if (!fs.existsSync(rootDir)) return null;
    const stack = [{ dir: rootDir, depth: 0 }];

    while (stack.length > 0) {
        const { dir, depth } = stack.pop();
        let entries = [];
        try {
            entries = fs.readdirSync(dir);
        } catch (e) {
            continue;
        }

        for (const entry of entries) {
            const fullPath = path.join(dir, entry);
            let stat = null;
            try {
                stat = fs.statSync(fullPath);
            } catch (e) {
                continue;
            }

            if (stat.isFile() && entry.toLowerCase() === fileName.toLowerCase()) {
                return fullPath;
            }
            if (stat.isDirectory() && depth < maxDepth) {
                stack.push({ dir: fullPath, depth: depth + 1 });
            }
        }
    }

    return null;
}

async function ensureManagedJava8Runtime() {
    const javaExecutableName = process.platform === 'win32' ? 'java.exe' : 'java';
    const existingJavaPath = findFileRecursive(JAVA_RUNTIME_DIR, javaExecutableName);
    if (existingJavaPath) return existingJavaPath;

    if (process.platform !== 'win32') {
        throw new Error("Téléchargement automatique de Java 8 non supporté sur cette plateforme.");
    }

    const child_process = require('child_process');
    const zipPath = path.join(JAVA_RUNTIME_DIR, "java8-runtime.zip");
    fs.mkdirSync(JAVA_RUNTIME_DIR, { recursive: true });

    await downloadWithRedirects(JAVA8_WINDOWS_ZIP_URL, zipPath, (downloaded, total) => {
        if (total > 0) {
            const percent = (downloaded / total) * 100;
            updateProgress(percent, `Java 8 : ${(downloaded / 1024 / 1024).toFixed(1)} Mo / ${(total / 1024 / 1024).toFixed(1)} Mo`);
        } else {
            progressState.textContent = "Téléchargement automatique de Java 8...";
        }
    });

    const quotedZip = zipPath.replace(/'/g, "''");
    const quotedDst = JAVA_RUNTIME_DIR.replace(/'/g, "''");
    child_process.execSync(
        `powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath '${quotedZip}' -DestinationPath '${quotedDst}' -Force"`,
        { stdio: 'ignore' }
    );

    try {
        fs.unlinkSync(zipPath);
    } catch (e) { }

    const installedJavaPath = findFileRecursive(JAVA_RUNTIME_DIR, "java.exe");
    if (!installedJavaPath) {
        throw new Error("Java 8 téléchargé mais java.exe introuvable après extraction.");
    }
    return installedJavaPath;
}

// ---------------------------------------------------------
// FORCER L'OPTIONS.TXT AVEC LE RESOURCEPACK POKYRA
// ---------------------------------------------------------
function forceWriteOptionsTxt() {
    try {
        const optionsTxtPath = path.join(POKYRA_DIR, "options.txt");
        const rpDir = path.join(POKYRA_DIR, "resourcepacks");
        // 1.12.2 attend des noms de pack "locaux" (sans préfixe file/).
        const preferredOrder = ["Pokyra", "pokyra", "Pokyra.zip", "pokyra.zip"];
        const availablePackNames = preferredOrder.filter((name) => fs.existsSync(path.join(rpDir, name)));
        const packNames = availablePackNames.length > 0 ? availablePackNames : ["Pokyra.zip"];
        const packList = `resourcePacks:${JSON.stringify(packNames)}`;

        if (fs.existsSync(optionsTxtPath)) {
            let content = fs.readFileSync(optionsTxtPath, "utf8");
            if (content.includes("resourcePacks:")) {
                content = content.replace(/resourcePacks:\[.*\]/, packList);
            } else {
                content += "\n" + packList;
            }
            // Corriger également incompatibleResourcePacks pour ne pas bloquer Pokyra
            if (content.includes("incompatibleResourcePacks:")) {
                content = content.replace(/incompatibleResourcePacks:\[.*\]/, 'incompatibleResourcePacks:[]');
            }
            fs.writeFileSync(optionsTxtPath, content, "utf8");
        } else {
            const defaultOptions = `version:1343\n${packList}\nincompatibleResourcePacks:[]\n`;
            fs.writeFileSync(optionsTxtPath, defaultOptions, "utf8");
        }
        console.log("🎨 options.txt forcé avec resourcepack Pokyra.zip !");
    } catch (err) {
        console.error("Erreur forceWriteOptionsTxt :", err);
    }
}

// OptiFine : AF + Custom GUIs cassent les textures JEI (carrés blancs)
function ensureOptifineJeISettings() {
    try {
        const optionsOfPath = path.join(POKYRA_DIR, "optionsof.txt");
        let content = fs.existsSync(optionsOfPath)
            ? fs.readFileSync(optionsOfPath, "utf8")
            : "";
        let changed = false;

        if (/^ofAfLevel:\d+/m.test(content)) {
            if (!/^ofAfLevel:0$/m.test(content)) {
                content = content.replace(/^ofAfLevel:\d+/m, "ofAfLevel:0");
                changed = true;
            }
        } else {
            content += (content.length > 0 && !content.endsWith("\n") ? "\n" : "") + "ofAfLevel:0\n";
            changed = true;
        }

        if (/^ofCustomGuis:(true|false)/m.test(content)) {
            if (!/^ofCustomGuis:false$/m.test(content)) {
                content = content.replace(/^ofCustomGuis:(true|false)/m, "ofCustomGuis:false");
                changed = true;
            }
        } else {
            content += (content.length > 0 && !content.endsWith("\n") ? "\n" : "") + "ofCustomGuis:false\n";
            changed = true;
        }

        if (changed) {
            fs.writeFileSync(optionsOfPath, content, "utf8");
            console.log("🖼️ OptiFine ajusté pour JEI (AF off, Custom GUIs off).");
        }
    } catch (err) {
        console.error("Erreur ensureOptifineJeISettings :", err);
    }
}

// FoamFix : patches textures/atlas qui cassent JEI avec Pixelmon + OptiFine
function ensureFoamFixJeISettings() {
    try {
        const foamPath = path.join(POKYRA_DIR, "config", "foamfix.cfg");
        if (!fs.existsSync(foamPath)) {
            return;
        }
        let content = fs.readFileSync(foamPath, "utf8");
        let changed = false;

        const patches = [
            { needle: "B:dynamicItemModels=true", replacement: "B:dynamicItemModels=false" },
            { needle: "B:jeiCreativeSearch=true", replacement: "B:jeiCreativeSearch=false" },
            { needle: "B:enable=true", replacement: "B:enable=false" }
        ];

        for (const patch of patches) {
            if (content.includes(patch.needle)) {
                content = content.split(patch.needle).join(patch.replacement);
                changed = true;
            }
        }

        if (changed) {
            fs.writeFileSync(foamPath, content, "utf8");
            console.log("🧩 FoamFix ajusté pour JEI (textures patch off, dynamicItemModels off).");
        }
    } catch (err) {
        console.error("Erreur ensureFoamFixJeISettings :", err);
    }
}

function ensureExtractedResourcePackFolder() {
    try {
        const child_process = require('child_process');
        const rpDir = path.join(POKYRA_DIR, "resourcepacks");
        const folderCandidates = ["Pokyra", "pokyra"];
        const zipCandidates = ["Pokyra.zip", "pokyra.zip"];

        // Si un dossier pack valide existe déjà, ne rien faire.
        const hasReadyFolder = folderCandidates.some((folderName) =>
            fs.existsSync(path.join(rpDir, folderName, "pack.mcmeta"))
        );
        if (hasReadyFolder) return;

        const zipName = zipCandidates.find((name) => fs.existsSync(path.join(rpDir, name)));
        if (!zipName) return;

        // Le zip fourni contient un dossier parent "Pokyra/" : on l'extrait pour créer un pack dossier valide.
        if (process.platform === 'win32') {
            const zipPath = path.join(rpDir, zipName).replace(/'/g, "''");
            const dstPath = rpDir.replace(/'/g, "''");
            child_process.execSync(
                `powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${dstPath}' -Force"`,
                { stdio: 'ignore' }
            );
        }
    } catch (err) {
        console.warn("Impossible d'extraire automatiquement le resource pack :", err.message);
    }
}

function updateProgress(percent, stateText) {
    const clamped = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));
    progressPercent.textContent = `${Math.round(clamped)}%`;
    progressFill.style.width = `${clamped}%`;
    if (stateText) progressState.textContent = stateText;
}

function tryReadNumber(source, keys) {
    for (const key of keys) {
        const value = source && source[key];
        if (typeof value === 'number' && Number.isFinite(value)) return value;
    }
    return null;
}

function hasResourcePackInstalled() {
    const rpDir = path.join(POKYRA_DIR, "resourcepacks");
    const expectedPaths = [
        path.join(rpDir, "pokyra.zip"),
        path.join(rpDir, "Pokyra.zip"),
        path.join(rpDir, "pokyra"),
        path.join(rpDir, "Pokyra")
    ];
    return expectedPaths.some(p => fs.existsSync(p));
}

function isResourcePackZipEntry(entryName) {
    const normalized = entryName.replace(/\\/g, "/").toLowerCase();
    return /(?:resource|ressource)packs?\/pokyra\.zip$/.test(normalized);
}

function findModpackZipOnDisk() {
    const candidates = [
        MODPACK_CACHE_PATH,
        path.join(POKYRA_DIR, "clientPackage.zip")
    ];
    return candidates.find(p => fs.existsSync(p)) || null;
}

function relocateResourcePackFromExtractedModpack() {
    const rpDir = path.join(POKYRA_DIR, "resourcepacks");
    const targetPath = path.join(rpDir, "pokyra.zip");
    if (fs.existsSync(targetPath)) return true;

    const searchDirs = [
        path.join(POKYRA_DIR, "resourcepacks"),
        path.join(POKYRA_DIR, "resourcepack"),
        path.join(POKYRA_DIR, "ressourcepacks"),
        path.join(POKYRA_DIR, "ressourcepack")
    ];

    for (const dir of searchDirs) {
        for (const name of ["pokyra.zip", "Pokyra.zip"]) {
            const src = path.join(dir, name);
            if (fs.existsSync(src) && path.resolve(src) !== path.resolve(targetPath)) {
                fs.mkdirSync(rpDir, { recursive: true });
                fs.copyFileSync(src, targetPath);
                console.log(`🎨 Resource pack copié depuis ${src}`);
                return true;
            }
        }
    }
    return false;
}

function extractResourcePackFromModpackZip(modpackZipPath) {
    const AdmZip = require("adm-zip");
    const zip = new AdmZip(modpackZipPath);
    const entry = zip.getEntries().find(e => !e.isDirectory && isResourcePackZipEntry(e.entryName));
    if (!entry) return false;

    const rpDir = path.join(POKYRA_DIR, "resourcepacks");
    fs.mkdirSync(rpDir, { recursive: true });
    fs.writeFileSync(path.join(rpDir, "pokyra.zip"), entry.getData());
    console.log(`🎨 Resource pack extrait du modpack (${entry.entryName})`);
    return true;
}

async function ensureModpackCache() {
    fs.mkdirSync(POKYRA_DIR, { recursive: true });

    const upToDate = await isModpackCacheUpToDate();
    if (upToDate) {
        return MODPACK_CACHE_PATH;
    }

    if (fs.existsSync(MODPACK_CACHE_PATH)) {
        console.log('Mise à jour du modpack détectée (nouvelle version sur GitHub)...');
        progressState.textContent = "Mise à jour du modpack...";
    }

    await downloadWithRedirects(MODPACK_ZIP_URL, MODPACK_CACHE_PATH, (downloaded, total) => {
        if (total > 0) {
            const percent = (downloaded / total) * 100;
            updateProgress(percent, `Modpack : ${(downloaded / 1024 / 1024).toFixed(1)} Mo / ${(total / 1024 / 1024).toFixed(1)} Mo`);
        } else {
            progressState.textContent = "Téléchargement du modpack...";
        }
    });
    return MODPACK_CACHE_PATH;
}

async function ensureResourcePack() {
    if (hasResourcePackInstalled()) return;

    if (relocateResourcePackFromExtractedModpack()) {
        ensureExtractedResourcePackFolder();
        return;
    }

    const modpackPath = await ensureModpackCache();
    if (extractResourcePackFromModpackZip(modpackPath)) {
        ensureExtractedResourcePackFolder();
        return;
    }

    throw new Error("Pokyra.zip introuvable dans modpack.zip (attendu dans resourcepack/pokyra.zip).");
}

// ---------------------------------------------------------
// LOGIQUE DE CHARGEMENT & LANCEMENT DU JEU
// ---------------------------------------------------------
btnPlay.addEventListener('click', async () => {
    if (btnPlay.classList.contains('disabled')) return;

    btnPlay.classList.add('disabled');
    progressState.textContent = "Préparation du lancement...";
    updateProgress(5);

    try {
        // 1. Suppression préventive des mods optionnels si déjà présents et toggle OFF
        manageOptionalMods();

        // 1b. JEI unique (modpack.zip peut réinjecter 4.16.1.1013)
        await ensureFixedJeiVersion();

        // 1c. PokyraOverlay avec fix textures JEI
        await ensureFixedOverlayVersion();

        const forgeJarPath = path.join(POKYRA_DIR, "forge.jar");

        // 2. Télécharger Forge si manquant
        if (!fs.existsSync(forgeJarPath)) {
            showFeedback("Téléchargement du moteur Forge 1.12.2...", "info");
            const forgeUrl = "https://maven.minecraftforge.net/net/minecraftforge/forge/1.12.2-14.23.5.2860/forge-1.12.2-14.23.5.2860-installer.jar";
            await downloadWithRedirects(forgeUrl, forgeJarPath, (downloaded, total) => {
                const percent = total > 0 ? (downloaded / total) * 100 : 0;
                updateProgress(percent, `Forge : ${(downloaded / 1024 / 1024).toFixed(1)} Mo / ${(total / 1024 / 1024).toFixed(1)} Mo`);
            });
            showFeedback("Forge téléchargé avec succès !", "success");
        }

        // 3. S'assurer que le resource pack Pokyra est présent
        await ensureResourcePack();

        // 4. Préparer options.txt AVANT le lancement (resourcepack Pokyra)
        ensureExtractedResourcePackFolder();
        forceWriteOptionsTxt();
        ensureOptifineJeISettings();
        ensureFoamFixJeISettings();

        // 5. Nettoyer les anciens resourcepacks
        try {
            const rpDir = path.join(POKYRA_DIR, "resourcepacks");
            if (fs.existsSync(rpDir)) {
                const files = fs.readdirSync(rpDir);
                for (const file of files) {
                    if (file !== "Pokyra.zip" && file !== "pokyra.zip" && file !== "Pokyra" && file !== "pokyra") {
                        const filePath = path.join(rpDir, file);
                        const stat = fs.statSync(filePath);
                        if (stat.isDirectory()) {
                            fs.rmdirSync(filePath, { recursive: true });
                        } else {
                            fs.unlinkSync(filePath);
                        }
                    }
                }
                console.log("🧹 Anciens resourcepacks nettoyés !");
            }
        } catch (err) {
            console.error("Erreur nettoyage resourcepacks :", err);
        }

        // 6. Préparer la session et les options de lancement
        const { Client } = require('minecraft-launcher-core');
        const launcher = new Client();

        const crackedPseudo = inputOfflineUsername.value.trim();
        const authSession = {
            access_token: "cracked-token",
            client_token: "cracked-client",
            uuid: "00000000-0000-0000-0000-000000000000",
            name: crackedPseudo,
            user_properties: "{}"
        };

        // RAM choisie par l'utilisateur dans les paramètres
        const ramGo = localStorage.getItem('pokyra_ram') || '4';
        const serverEndpoint = localStorage.getItem('pokyra_server_endpoint') || `${SERVER_IP}:${SERVER_PORT}`;
        const { host: serverHost, port: serverPort } = parseServerEndpoint(serverEndpoint);
        let resolvedJavaPath = findJava8Path();

        let javaMajor = getJavaVersionMajor(resolvedJavaPath);
        if (javaMajor !== 8) {
            showFeedback("Java 8 non détecté. Téléchargement automatique en cours...", "info");
            resolvedJavaPath = await ensureManagedJava8Runtime();
            javaMajor = getJavaVersionMajor(resolvedJavaPath);
            if (javaMajor !== 8) {
                throw new Error(
                    `Java détecté: version ${javaMajor || 'inconnue'} (${resolvedJavaPath}).\n` +
                    "Minecraft 1.12.2 + Forge nécessite Java 8."
                );
            }
        }

        const modpackPath = await ensureModpackCache();
        const opts = {
            clientPackage: modpackPath,
            removePackage: false,
            authorization: authSession,
            root: POKYRA_DIR,
            javaPath: resolvedJavaPath,
            version: {
                number: "1.12.2",
                type: "release"
            },
            forge: forgeJarPath,
            memory: {
                max: `${ramGo}G`,
                min: `${Math.min(2, parseInt(ramGo))}G`
            },
            customLaunchArgs: ["--server", serverHost, "--port", String(serverPort)],
            overrides: {
                detached: false
            }
        };

        showFeedback(`Lancement avec ${ramGo} Go de RAM vers ${serverHost}:${serverPort}...`, "info");
        progressState.textContent = "Téléchargement des ressources de jeu...";

        // Écouter l'extraction du modpack (déclenché si nouveau téléchargement)
        // DOIT être enregistré AVANT launcher.launch()
        launcher.on('package-extract', () => {
            console.log('[Launcher] Modpack extrait ! Application des préférences...');
            manageOptionalMods();
            removeDuplicateJeiJars();
            removeDuplicateOverlayJars();
            relocateResourcePackFromExtractedModpack();
            ensureExtractedResourcePackFolder();
            forceWriteOptionsTxt();
            ensureOptifineJeISettings();
        ensureFoamFixJeISettings();
        });

        launcher.on('data', (e) => {
            // Afficher les infos de chargement de Minecraft dans la barre de progression
            if (typeof e === 'string' && e.includes('[')) {
                progressState.textContent = e.substring(0, 60);
            }
        });

        launcher.on('progress', (e) => {
            const done = tryReadNumber(e, ['task', 'current', 'progress', 'value']);
            const total = tryReadNumber(e, ['total', 'max', 'size']);
            if (done !== null && total !== null && total > 0) {
                updateProgress((done / total) * 100, `Téléchargement : ${e.type || 'fichiers'} (${Math.round(done)}/${Math.round(total)})`);
            } else if (typeof e === 'object') {
                progressState.textContent = `Téléchargement : ${e.type || 'fichiers'}`;
            }
        });

        launcher.on('download-status', (e) => {
            if (e.total && e.total > 0) {
                updateProgress((e.current / e.total) * 100, `Téléchargement : ${e.type} (${(e.current / 1024 / 1024).toFixed(1)} Mo / ${(e.total / 1024 / 1024).toFixed(1)} Mo)`);
            } else {
                progressState.textContent = `Téléchargement des fichiers : ${e.type}`;
            }
        });

        console.log("Démarrage de Minecraft...");
        const proc = await launcher.launch(opts);

        if (!proc) {
            throw new Error("Le processus Minecraft n'a pas pu être instancié. Vérifiez que Java 8 est installé.");
        }

        // (package-extract déjà enregistré plus haut)

        // Réécriture de sécurité du resourcepack après extraction
        setTimeout(() => forceWriteOptionsTxt(), 3000);

        updateProgress(100, "Jeu lancé ! Bon jeu ! ⚡");
        showFeedback(`Minecraft lancé avec ${ramGo} Go de RAM. Bonne aventure sur Pokyra !`, "success");

        // Si Minecraft se ferme, réafficher le launcher
        proc.on('close', (code) => {
            const normalizedCode = normalizeExitCode(code);
            console.log(`Minecraft fermé avec le code : ${normalizedCode}`);
            ipcRenderer.send('window-show');
            if (normalizedCode && normalizedCode !== 0) {
                if (normalizedCode === -1) {
                    showFeedback("Minecraft s'est fermé avec le code -1. Vérifie Java 8, les logs et l'adresse serveur (host:port).", 'danger');
                } else {
                    showFeedback(`Minecraft s'est fermé avec le code ${normalizedCode}. Vérifie Java 8 et les logs du jeu.`, 'danger');
                }
            }
            updateProgress(0, "Prêt à lancer");
            validatePlayButton();
        });

        // Si Minecraft plante au démarrage
        proc.on('error', (err) => {
            console.error('Erreur processus Minecraft :', err);
            ipcRenderer.send('window-show');
            showFeedback(`Erreur au démarrage de Minecraft : ${err.message}`, 'danger');
            validatePlayButton();
        });

    } catch (error) {
        console.error("Erreur de lancement :", error);
        showFeedback(`Erreur : ${error.message || error}`, "danger");
        validatePlayButton();
        updateProgress(0, "Erreur de lancement");
    }
});
