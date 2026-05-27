/**
 * Pokyra Launcher - Contrôleur Logique Frontend
 * Gère les interactions utilisateur, la connexion Microsoft et le lancement du jeu.
 */

const { ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');

// Paramètres de configuration globaux
const SERVER_IP = "play.pokyra.fr";
const POKYRA_DIR = path.join(process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME), '.pokyra');
// Lien direct vers le fichier ZIP de votre modpack contenant les dossiers 'mods/' et 'resourcepacks/'
// Exemple: "https://mon-hebergement.fr/modpack.zip"
const MODPACK_ZIP_URL = "https://github.com/Wolfijoker/pokyra-assets/releases/download/1.0/modpack.zip";

// Éléments du DOM
const btnClose = document.getElementById('btn-close');
const btnMinimize = document.getElementById('btn-minimize');
const inputOfflineUsername = document.getElementById('offline-username-input');
const feedbackBox = document.getElementById('feedback-box');
const feedbackText = document.getElementById('feedback-text');
const btnPlay = document.getElementById('btn-play');
const progressState = document.getElementById('progress-state');
const progressPercent = document.getElementById('progress-percent');
const progressFill = document.getElementById('progress-fill');
const playerCountText = document.getElementById('player-count-text');

// Initialisation générale
document.addEventListener("DOMContentLoaded", () => {
    initWindowControls();
    initOfflineForm();
    initServerStatus();
});

// ---------------------------------------------------------
// CONTRÔLES FENÊTRE SYSTEME
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
// FORMULAIRE DE SAISIE DU PSEUDO (OFFLINE)
// ---------------------------------------------------------
function initOfflineForm() {
    // Restaure le dernier pseudo enregistré
    const savedPseudo = localStorage.getItem('pokyra_last_pseudo');
    if (savedPseudo) {
        inputOfflineUsername.value = savedPseudo;
    }

    // Valide l'état initial du bouton jouer
    validatePlayButton();

    inputOfflineUsername.addEventListener('input', () => {
        const username = inputOfflineUsername.value.trim();
        // Sauvegarde dynamique
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
        playerCountText.textContent = " play.pokyra.fr";
    }
}

// ---------------------------------------------------------
// ENVOI DE MESSAGES DE NOTIFICATION DANS L'UI
// ---------------------------------------------------------
function showFeedback(text, type = "info") {
    feedbackBox.classList.remove('hidden');
    feedbackText.textContent = text;

    // Changement de style dynamique selon le type
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

// Helper pour télécharger un fichier avec support des redirections HTTP/HTTPS
function downloadWithRedirects(url, destPath, onProgress) {
    const fs = require('fs');
    const https = require('https');
    const http = require('http');
    const path = require('path');
    const { URL } = require('url');

    fs.mkdirSync(path.dirname(destPath), { recursive: true });

    return new Promise((resolve, reject) => {
        function executeGet(currentUrl) {
            try {
                const urlObj = new URL(currentUrl);
                const client = urlObj.protocol === 'https:' ? https : http;

                client.get(currentUrl, (response) => {
                    // Gérer les redirections (3xx)
                    if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                        executeGet(new URL(response.headers.location, currentUrl).href);
                        return;
                    }

                    if (response.statusCode !== 200) {
                        reject(new Error(`Code statut de téléchargement invalide : ${response.statusCode}`));
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

                    file.on('finish', () => {
                        file.close();
                        resolve();
                    });
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
// RECHERCHE DYNAMIQUE DE JAVA 8 (REQUIS POUR 1.12.2)
// ---------------------------------------------------------
function findJava8Path() {
    const child_process = require('child_process');
    const fs = require('fs');
    const path = require('path');

    // 1. Essayer de trouver Java via la commande Windows 'where java'
    try {
        const output = child_process.execSync('where java', { encoding: 'utf8' });
        const foundPaths = output.split('\r\n').map(p => p.trim()).filter(p => p.length > 0);

        // Prioriser les chemins qui pointent vers Java 8 (contenant "8", "1.8", "jre8", "jdk8", "java8path")
        const java8Paths = foundPaths.filter(p =>
            p.toLowerCase().includes('8') ||
            p.toLowerCase().includes('1.8') ||
            p.toLowerCase().includes('java8path')
        );

        if (java8Paths.length > 0) {
            console.log("☕ Java 8 détecté dynamiquement :", java8Paths[0]);
            return java8Paths[0];
        }

        if (foundPaths.length > 0) {
            console.log("☕ Aucun chemin Java 8 explicite trouvé par 'where', utilisation de :", foundPaths[0]);
            return foundPaths[0];
        }
    } catch (e) {
        console.warn("Recherche de Java par 'where java' indisponible, passage au scan de dossiers :", e.message);
    }

    // 2. Scan des dossiers d'installation standards de Java
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
                        if (fs.existsSync(candidatePath)) {
                            console.log("☕ Java 8 scanné avec succès :", candidatePath);
                            return candidatePath;
                        }
                        const candidateJre = path.join(folder, sub, 'jre', 'bin', 'java.exe');
                        if (fs.existsSync(candidateJre)) {
                            console.log("☕ JRE 8 scanné avec succès :", candidateJre);
                            return candidateJre;
                        }
                    }
                }
            } catch (err) { }
        }
    }

    // 3. Fallback par défaut (on laisse le système tenter de l'appeler)
    console.warn("☕ Aucun chemin absolu Java 8 trouvé, utilisation du binaire par défaut.");
    return "java";
}

// ---------------------------------------------------------
// LOGIQUE DE CHARGEMENT & LANCEMENT DU JEU
// ---------------------------------------------------------
btnPlay.addEventListener('click', async () => {
    if (btnPlay.classList.contains('disabled')) return;

    // Verrouille l'interface pour éviter les double clics
    btnPlay.classList.add('disabled');

    progressState.textContent = "Préparation du lancement...";
    progressFill.style.width = "5%";
    progressPercent.textContent = "5%";

    try {
        const forgeJarPath = path.join(POKYRA_DIR, "forge.jar");

        // 1. Télécharger Forge s'il est manquant
        if (!fs.existsSync(forgeJarPath)) {
            showFeedback("Téléchargement du moteur de jeu Forge 1.12.2...", "info");
            const forgeUrl = "https://maven.minecraftforge.net/net/minecraftforge/forge/1.12.2-14.23.5.2860/forge-1.12.2-14.23.5.2860-installer.jar";

            await downloadWithRedirects(forgeUrl, forgeJarPath, (downloaded, total) => {
                const percent = Math.round((downloaded / total) * 100);
                progressPercent.textContent = `${percent}%`;
                progressFill.style.width = `${percent}%`;
                progressState.textContent = `Téléchargement de Forge : ${(downloaded / 1024 / 1024).toFixed(1)} Mo / ${(total / 1024 / 1024).toFixed(1)} Mo`;
            });
            showFeedback("Moteur Forge téléchargé avec succès !", "success");
        }

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

        // 1. Nettoyage chirurgical des anciens resourcepacks pour ne garder que Pokyra.zip (Évite l'accumulation de fichiers fantômes)
        try {
            const rpDir = path.join(POKYRA_DIR, "resourcepacks");
            if (fs.existsSync(rpDir)) {
                const files = fs.readdirSync(rpDir);
                for (const file of files) {
                    if (file !== "Pokyra.zip" && file !== "Pokyra") {
                        const filePath = path.join(rpDir, file);
                        const stat = fs.statSync(filePath);
                        if (stat.isDirectory()) {
                            fs.rmdirSync(filePath, { recursive: true });
                        } else {
                            fs.unlinkSync(filePath);
                        }
                    }
                }
                console.log("🧹 Anciens packs de ressources nettoyés chirurgicalement !");
            }
        } catch (err) {
            console.error("Erreur lors du nettoyage des anciens packs :", err);
        }

        // Helper pour forcer la configuration de options.txt (Double compatibilité 1.12.2)
        function forceWriteOptionsTxt() {
            try {
                const optionsTxtPath = path.join(POKYRA_DIR, "options.txt");
                const packList = 'resourcePacks:["Pokyra","file/Pokyra"]'; // Double format pour dossier Pokyra
                if (fs.existsSync(optionsTxtPath)) {
                    let optionsContent = fs.readFileSync(optionsTxtPath, "utf8");
                    if (optionsContent.includes("resourcePacks:")) {
                        optionsContent = optionsContent.replace(/resourcePacks:\[.*\]/, packList);
                    } else {
                        optionsContent += "\n" + packList;
                    }
                    fs.writeFileSync(optionsTxtPath, optionsContent, "utf8");
                    console.log("🎨 options.txt forcé avec succès !");
                } else {
                    const defaultOptions = `version:1343\n${packList}\n`;
                    fs.writeFileSync(optionsTxtPath, defaultOptions, "utf8");
                    console.log("🎨 Fichier options.txt forcé par création !");
                }
            } catch (err) {
                console.error("Erreur forceWriteOptionsTxt :", err);
            }
        }

        // Première écriture préventive
        forceWriteOptionsTxt();
        
        // Résolution dynamique du chemin Java 8
        const resolvedJavaPath = findJava8Path();

        // Options de lancement de Minecraft Forge 1.12.2
        const opts = {
            clientPackage: MODPACK_ZIP_URL,
            removePackage: true, // supprime le zip du modpack après extraction
            authorization: authSession,
            root: POKYRA_DIR,
            javaPath: resolvedJavaPath, // Utilise la version de Java 8 détectée
            version: {
                number: "1.12.2",
                type: "release"
            },
            forge: forgeJarPath, // Utilise le fichier forge.jar téléchargé
            memory: {
                max: "4G", // Alloue 4 Go de RAM max par défaut
                min: "2G"
            },
            customLaunchArgs: ["--server", SERVER_IP, "--port", "25565"], // Argument MCLC officiel pour se connecter directement
            overrides: {
                detached: true // Permet de fermer le launcher après le lancement du jeu
            }
        };

        showFeedback("Recherche de mises à jour de Minecraft...", "info");
        progressState.textContent = "Téléchargement des ressources de jeu...";

        // Branchement des écouteurs de progression
        launcher.on('debug', (e) => console.log(e));
        launcher.on('data', (e) => console.log(e));

        launcher.on('progress', (e) => {
            const percent = Math.round((e.task / e.total) * 100);
            progressPercent.textContent = `${percent}%`;
            progressFill.style.width = `${percent}%`;
            progressState.textContent = `Téléchargement : ${e.type} (${e.task}/${e.total})`;
        });

        launcher.on('download-status', (e) => {
            if (e.total && e.total > 0) {
                const percent = Math.round((e.current / e.total) * 100);
                progressPercent.textContent = `${percent}%`;
                progressFill.style.width = `${percent}%`;
                progressState.textContent = `Téléchargement : ${e.type} (${(e.current / 1024 / 1024).toFixed(1)} Mo / ${(e.total / 1024 / 1024).toFixed(1)} Mo)`;
            } else {
                progressState.textContent = `Téléchargement des fichiers : ${e.type}`;
            }
        });

        // Lancement effectif
        console.log("Démarrage de Minecraft...");
        const proc = await launcher.launch(opts);

        if (!proc) {
            throw new Error("Le processus Minecraft n'a pas pu être instancié. Veuillez vérifier que Java est correctement installé sur votre système.");
        }

        // Seconde écriture de sécurité (après extraction finale du modpack ZIP !)
        forceWriteOptionsTxt();

        progressState.textContent = "Jeu lancé ! Bon jeu !";
        progressFill.style.width = "100%";
        progressPercent.textContent = "100%";
        showFeedback("Minecraft est démarré. En attente du chargement...", "success");

        // Ferme le launcher proprement après 3 secondes (désactivé en dév pour garder les logs)
        /*
        setTimeout(() => {
            ipcRenderer.send('window-close');
        }, 3000);
        */

    } catch (error) {
        console.error("Erreur de lancement :", error);
        showFeedback(`Erreur lors du démarrage : ${error.message || error}`, "danger");

        // Déverrouille l'interface en cas d'erreur
        validatePlayButton();
        progressState.textContent = "Erreur de lancement";
        progressFill.style.width = "0%";
        progressPercent.textContent = "0%";
    }
});

