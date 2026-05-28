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
const POKYRA_DIR = path.join(process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME), '.pokyra');
const MODPACK_ZIP_URL = "https://github.com/Wolfijoker/pokyra-assets/releases/download/1.0/modpack.zip";
const RESOURCEPACK_URLS = [
    "https://github.com/Wolfijoker/pokyra-assets/releases/download/1.0/pokyra.zip",
    "https://github.com/Wolfijoker/pokyra-assets/releases/download/1.0/Pokyra.zip"
];

// Noms des mods optionnels (inclus dans le modpack.zip de base, gérés par le launcher)
const SCHEMATICA_JAR = "Schematica-1.12.2-1.8.0.169-universal.jar";
const LUNATRIUSCORE_JAR = "LunatriusCore-1.12.2-1.2.0.42-universal.jar";

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
        const response = await fetch(`https://api.mcsrvstat.us/2/${SERVER_IP}`);
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

async function ensureResourcePack() {
    const rpDir = path.join(POKYRA_DIR, "resourcepacks");
    const expectedPaths = [
        path.join(rpDir, "pokyra.zip"),
        path.join(rpDir, "Pokyra.zip"),
        path.join(rpDir, "pokyra"),
        path.join(rpDir, "Pokyra")
    ];

    if (expectedPaths.some(p => fs.existsSync(p))) {
        return;
    }

    fs.mkdirSync(rpDir, { recursive: true });
    const targetPath = path.join(rpDir, "pokyra.zip");
    let lastError = null;

    for (const url of RESOURCEPACK_URLS) {
        try {
            await downloadWithRedirects(url, targetPath, (downloaded, total) => {
                if (total > 0) {
                    const percent = (downloaded / total) * 100;
                    updateProgress(percent, `Resource pack : ${(downloaded / 1024 / 1024).toFixed(1)} Mo / ${(total / 1024 / 1024).toFixed(1)} Mo`);
                } else {
                    progressState.textContent = "Téléchargement du resource pack...";
                }
            });
            ensureExtractedResourcePackFolder();
            console.log(`🎨 Resource pack téléchargé depuis ${url}`);
            return;
        } catch (err) {
            lastError = err;
            console.warn(`Échec téléchargement resource pack (${url}) :`, err.message);
        }
    }

    throw new Error(`Impossible de télécharger le resource pack Pokyra.zip (${lastError ? lastError.message : 'erreur inconnue'})`);
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
        // 0. Vérifier que Java est installé sur ce PC
        if (!checkJavaInstalled()) {
            throw new Error(
                "Java n'est pas installé sur ce PC !\n\n" +
                "Minecraft 1.12.2 + Forge nécessite Java 8.\n" +
                "Télécharge-le ici : https://www.java.com/fr/download/\n\n" +
                "Installe Java puis relance le launcher."
            );
        }

        // 1. Suppression préventive des mods optionnels si déjà présents et toggle OFF
        manageOptionalMods();

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
        const resolvedJavaPath = findJava8Path();

        const opts = {
            clientPackage: MODPACK_ZIP_URL,
            removePackage: true,
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
            customLaunchArgs: ["--server", SERVER_IP, "--port", "25565"],
            overrides: {
                detached: true
            }
        };

        showFeedback(`Lancement avec ${ramGo} Go de RAM...`, "info");
        progressState.textContent = "Téléchargement des ressources de jeu...";

        // Écouter l'extraction du modpack (déclenché si nouveau téléchargement)
        // DOIT être enregistré AVANT launcher.launch()
        launcher.on('package-extract', () => {
            console.log('[Launcher] Modpack extrait ! Application des préférences Schematica...');
            manageOptionalMods();
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

        // Après extraction du modpack
        launcher.on('package-extract', () => {
            console.log('Modpack extrait ! Gestion des mods optionnels...');
            manageOptionalMods();
        });

        // Réécriture de sécurité du resourcepack après extraction
        setTimeout(() => forceWriteOptionsTxt(), 3000);

        updateProgress(100, "Jeu lancé ! Bon jeu ! ⚡");
        showFeedback(`Minecraft lancé avec ${ramGo} Go de RAM. Bonne aventure sur Pokyra !`, "success");

        // Cacher le launcher une fois que Minecraft est démarré (comportement professionnel)
        setTimeout(() => {
            ipcRenderer.send('window-hide');
        }, 5000);

        // Si Minecraft se ferme, réafficher le launcher
        proc.on('close', (code) => {
            console.log(`Minecraft fermé avec le code : ${code}`);
            ipcRenderer.send('window-show');
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
