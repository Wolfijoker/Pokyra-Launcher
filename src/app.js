/**
 * Pokyra Launcher - Interface utilisateur (renderer sécurisé)
 * Pas d'accès Node.js — communication via window.pokyra (preload).
 */

const SERVER_IP = "play.pokyra.fr";
const SERVER_PORT = 25565;

let pokyraDir = '';

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

let launchInProgress = false;
let unsubscribeLaunchEvents = null;

document.addEventListener('DOMContentLoaded', async () => {
    pokyraDir = await window.pokyra.getPokyraDir();
    initWindowControls();
    initSettingsPanel();
    initOfflineForm();
    initServerStatus();
    initSocialLinks();
    initPlayButton();
    updateActiveBadges();
});

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

function initWindowControls() {
    btnClose.addEventListener('click', () => window.pokyra.windowClose());
    btnMinimize.addEventListener('click', () => window.pokyra.windowMinimize());
}

function initSettingsPanel() {
    const savedRam = localStorage.getItem('pokyra_ram') || '4';
    const savedSchematica = localStorage.getItem('pokyra_schematica') === 'true';

    ramSlider.value = savedRam;
    ramDisplayValue.textContent = `${savedRam} Go`;
    toggleSchematica.checked = savedSchematica;

    btnSettings.addEventListener('click', () => {
        const isHidden = settingsOverlay.classList.contains('hidden');
        if (isHidden) {
            settingsOverlay.classList.remove('hidden');
            btnSettings.classList.add('active');
        } else {
            closeSettingsPanel();
        }
    });

    btnSettingsClose.addEventListener('click', closeSettingsPanel);

    btnSaveSettings.addEventListener('click', () => {
        saveSettings();
        closeSettingsPanel();
    });

    ramSlider.addEventListener('input', () => {
        ramDisplayValue.textContent = `${ramSlider.value} Go`;
    });

    settingsOverlay.addEventListener('click', (e) => {
        if (e.target === settingsOverlay) {
            saveSettings();
            closeSettingsPanel();
        }
    });

    const btnOpenGameFolder = document.getElementById('btn-open-game-folder');
    const btnOpenModsFolder = document.getElementById('btn-open-mods-folder');
    const btnOpenScreenshots = document.getElementById('btn-open-screenshots-folder');

    btnOpenGameFolder.addEventListener('click', () => openFolder(pokyraDir));
    btnOpenModsFolder.addEventListener('click', () => openFolder(pokyraDir ? `${pokyraDir}/mods` : ''));
    btnOpenScreenshots.addEventListener('click', () => openFolder(pokyraDir ? `${pokyraDir}/screenshots` : ''));
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

async function openFolder(folderPath) {
    if (!folderPath) {
        showFeedback('Chemin du dossier indisponible.', 'warning');
        return;
    }
    const result = await window.pokyra.openFolder(folderPath);
    if (!result.success) {
        showFeedback(`Impossible d'ouvrir le dossier : ${result.error}`, 'warning');
    }
}

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

function validatePlayButton() {
    const username = inputOfflineUsername.value.trim();
    const canPlay = username.length >= 3 && !launchInProgress;
    if (canPlay) {
        btnPlay.classList.remove('disabled');
    } else {
        btnPlay.classList.add('disabled');
    }
}

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

function initSocialLinks() {
    const socialButtons = document.querySelectorAll('.social-btn');
    socialButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const url = btn.getAttribute('data-url');
            if (url && url !== "#") {
                window.pokyra.openExternal(url);
            } else {
                showFeedback("Ce réseau social sera bientôt disponible !", "info");
            }
        });
    });
}

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

function updateProgress(percent, stateText) {
    if (typeof percent === 'number' && Number.isFinite(percent)) {
        const clamped = Math.max(0, Math.min(100, percent));
        progressPercent.textContent = `${Math.round(clamped)}%`;
        progressFill.style.width = `${clamped}%`;
    }
    if (stateText) {
        progressState.textContent = stateText;
    }
}

function initPlayButton() {
    unsubscribeLaunchEvents = window.pokyra.onLaunchEvent((payload) => {
        if (!payload || !payload.type) return;

        switch (payload.type) {
            case 'progress':
                updateProgress(payload.percent, payload.stateText);
                break;
            case 'feedback':
                showFeedback(payload.text, payload.severity || 'info');
                break;
            case 'launch-end':
                launchInProgress = false;
                validatePlayButton();
                break;
            default:
                break;
        }
    });

    btnPlay.addEventListener('click', async () => {
        if (btnPlay.classList.contains('disabled') || launchInProgress) return;

        launchInProgress = true;
        btnPlay.classList.add('disabled');
        updateProgress(5, "Préparation du lancement...");

        const username = inputOfflineUsername.value.trim();
        const ram = localStorage.getItem('pokyra_ram') || '4';
        const schematica = localStorage.getItem('pokyra_schematica') === 'true';
        const serverEndpoint = localStorage.getItem('pokyra_server_endpoint') || `${SERVER_IP}:${SERVER_PORT}`;

        const result = await window.pokyra.launchGame({
            username,
            ram,
            schematica,
            serverEndpoint
        });

        if (!result || !result.success) {
            launchInProgress = false;
            validatePlayButton();
            if (result && result.error) {
                showFeedback(`Erreur : ${result.error}`, 'danger');
            }
            updateProgress(0, "Erreur de lancement");
        }
    });
}
