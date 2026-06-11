/**
 * Sync dev-built mods into .pokyra/mods before npm start.
 * Prefers the freshest build from forge_extracted/pokyraforms_out.
 */
const fs = require('fs');
const path = require('path');

const POKYRAFORMS_JAR = 'PokyraForms-1.0.6.jar';
const REPO_ROOT = path.join(__dirname, '..', '..');
const BUILD_OUT = path.join(REPO_ROOT, 'forge_extracted', 'pokyraforms_out', POKYRAFORMS_JAR);
const LAUNCHER_ASSETS = path.join(__dirname, '..', 'assets', POKYRAFORMS_JAR);
const MODS_DIR = process.env.APPDATA
    ? path.join(process.env.APPDATA, '.pokyra', 'mods')
    : path.join(process.env.HOME || '', '.pokyra', 'mods');

function copyIfNewer(source, dest) {
    if (!fs.existsSync(source)) {
        return false;
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (!fs.existsSync(dest) || fs.statSync(source).mtimeMs > fs.statSync(dest).mtimeMs) {
        fs.copyFileSync(source, dest);
        console.log(`[sync-dev-mods] ${path.basename(dest)} <= ${source}`);
        return true;
    }
    return false;
}

function removeOldPokyraFormsJars(dir) {
    if (!fs.existsSync(dir)) {
        return;
    }
    for (const file of fs.readdirSync(dir)) {
        if (!/^pokyraforms-/i.test(file) || !file.endsWith('.jar')) {
            continue;
        }
        if (file === POKYRAFORMS_JAR) {
            continue;
        }
        fs.unlinkSync(path.join(dir, file));
        console.log(`[sync-dev-mods] removed old ${file}`);
    }
}

function main() {
    let source = null;
    if (fs.existsSync(BUILD_OUT)) {
        source = BUILD_OUT;
    } else if (fs.existsSync(LAUNCHER_ASSETS)) {
        source = LAUNCHER_ASSETS;
    }

    if (!source) {
        console.warn(`[sync-dev-mods] ${POKYRAFORMS_JAR} not found (build with compile_pokyraforms.ps1 first).`);
        return;
    }

    fs.mkdirSync(path.dirname(LAUNCHER_ASSETS), { recursive: true });
    copyIfNewer(source, LAUNCHER_ASSETS);
    if (fs.existsSync(BUILD_OUT) && BUILD_OUT !== source) {
        copyIfNewer(BUILD_OUT, LAUNCHER_ASSETS);
    }

    const bundled = fs.existsSync(LAUNCHER_ASSETS) ? LAUNCHER_ASSETS : source;
    fs.mkdirSync(MODS_DIR, { recursive: true });
    copyIfNewer(bundled, path.join(MODS_DIR, POKYRAFORMS_JAR));
    removeOldPokyraFormsJars(MODS_DIR);
}

main();
