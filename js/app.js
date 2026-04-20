import * as THREE from './three.module.js';
import { ClaySculptor } from './clay.js';
import { OrbitControls } from './OrbitControls.js';
import { EmojiExporter } from './Exporter.js';

let canvas, cam, scene, renderer, controls;
let mouse = new THREE.Vector2();
let dragging = false;
let autoSpin = false;
const spinSpeed = 0.001;
let exporter = null;

const VOID_BG = 0x000000;
/** Tight near plane for macro sculpting (avoids front clipping when zoomed in). */
const CAMERA_NEAR = 0.001;
const ABOUT_SIGNATURE = 'clayable v2.1 / built by prakruti / curated by wonder';

/** Discord invite — set to your server’s discord.gg/… link. */
const DISCORD_COMMUNITY_URL = 'https://discord.gg/wUAxP3YDv8';
const SAVE_ENDPOINT = '/api/state';
const SESSION_STORAGE_KEY = 'clayable:session-id';
const AUTOSAVE_DEBOUNCE_MS = 1200;

const GALLERY_BG = 0xf5f5f5;

/** scene + ui: dark studio vs sunlit gallery */
const themes = {
    dark: {
        scene: VOID_BG,
        clear: VOID_BG,
        ambIntensity: 0.1,
        ambColor: 0xffffff,
        keyColor: 0xfff4ec,
        keyIntensity: 2.45,
        rimColor: 0xc8e2ff,
        rimIntensity: 1.95,
        keyPosition: { x: 7, y: 11, z: 5 }
    },
    light: {
        scene: GALLERY_BG,
        clear: GALLERY_BG,
        ambIntensity: 0.84,
        ambColor: 0xffffff,
        keyColor: 0xfffcf5,
        keyIntensity: 2.35,
        rimColor: 0xfff2e8,
        rimIntensity: 1.38,
        keyPosition: { x: 4, y: 8, z: 11 }
    }
};

let isDarkMode = true;
let tool = 'pull';
let clay;
let ambLight, keyLight, rimLight;
let sculptStrength = 0.11;
let sculptRadius = 0.5;
let currentSwatchId = 'terracotta';
let rc = new THREE.Raycaster();
let initialized = false;
let lastStretchToastAt = 0;

/** studio palette — dark: earthy; light: porcelain / pastel mineral */
const STUDIO_SWATCHES = [
    { id: 'terracotta', label: 'terracotta', hex: 0xe2725b, roughness: 0.92, metalness: 0 },
    { id: 'sage', label: 'sage', hex: 0xb2ac88, roughness: 0.78, metalness: 0.02 },
    { id: 'ochre', label: 'ochre', hex: 0xcc7722, roughness: 0.84, metalness: 0.03 },
    { id: 'slate', label: 'slate', hex: 0x708090, roughness: 0.38, metalness: 0.22 },
    { id: 'sand', label: 'sand', hex: 0xc2b280, roughness: 0.74, metalness: 0.02 },
    { id: 'charcoal', label: 'charcoal', hex: 0x36454f, roughness: 0.58, metalness: 0.08 }
];

/** light-mode hex only (matte ceramic look) */
const STUDIO_SWATCHES_LIGHT_HEX = {
    terracotta: 0xff8a75,
    sage: 0xd1d8c5,
    ochre: 0xe8b05d,
    slate: 0xa0afba,
    sand: 0xf0e6d2,
    charcoal: 0x4a4a4a
};

const LIGHT_MODE_ROUGHNESS_BUMP = 0.1;

function hexForSwatchTheme(sw) {
    if (isDarkMode) return sw.hex;
    return STUDIO_SWATCHES_LIGHT_HEX[sw.id] ?? sw.hex;
}

function roughnessForSwatchTheme(sw) {
    let r = sw.roughness;
    if (!isDarkMode) {
        r = Math.min(0.98, r + LIGHT_MODE_ROUGHNESS_BUMP);
    }
    return r;
}

function metalnessForSwatchTheme(sw) {
    if (!isDarkMode) return 0;
    return sw.metalness;
}

function syncPaletteSwatchColors() {
    document.querySelectorAll('.studio-swatch').forEach((el) => {
        const id = el.dataset.swatch;
        const sw = STUDIO_SWATCHES.find((s) => s.id === id);
        if (!sw) return;
        const hex = hexForSwatchTheme(sw);
        el.style.backgroundColor = '#' + hex.toString(16).padStart(6, '0');
    });
}

const SCULPT_TOOLS = ['push', 'pull', 'smooth', 'pick', 'inflate'];

let sculptHistory = [];
let replayRunning = false;
let hydrateDone = false;
let autosaveTimer = null;
let autosaveInFlight = false;
let autosaveQueued = false;

function setupLighting() {
    if (ambLight) scene.remove(ambLight);
    if (keyLight) scene.remove(keyLight);
    if (rimLight) scene.remove(rimLight);

    const t = themes[isDarkMode ? 'dark' : 'light'];

    ambLight = new THREE.AmbientLight(t.ambColor, t.ambIntensity);
    scene.add(ambLight);

    keyLight = new THREE.DirectionalLight(t.keyColor, t.keyIntensity);
    const kp = t.keyPosition || { x: 7, y: 11, z: 5 };
    keyLight.position.set(kp.x, kp.y, kp.z);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 40;
    keyLight.shadow.camera.left = -10;
    keyLight.shadow.camera.right = 10;
    keyLight.shadow.camera.top = 10;
    keyLight.shadow.camera.bottom = -10;
    keyLight.shadow.bias = -0.0001;
    scene.add(keyLight);

    rimLight = new THREE.DirectionalLight(t.rimColor, t.rimIntensity);
    rimLight.position.set(-9, 4, -10);
    rimLight.castShadow = false;
    scene.add(rimLight);
}

function syncSceneAndRendererBg() {
    if (!scene || !renderer) return;
    const t = themes[isDarkMode ? 'dark' : 'light'];
    scene.background = new THREE.Color(t.scene);
    renderer.setClearColor(t.clear, 1);
}

function showStudioToast(message) {
    document.querySelectorAll('.studio-toast').forEach((n) => n.remove());
    const t = document.createElement('div');
    t.className = 'studio-toast';
    t.textContent = message;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('is-visible'));
    setTimeout(() => {
        t.classList.remove('is-visible');
        setTimeout(() => t.remove(), 300);
    }, 3200);
}

function maybeShowStretchToast() {
    if (!clay) return;
    const m = clay.getStretchMetric();
    if (m < 0.36) return;
    const now = Date.now();
    if (now - lastStretchToastAt < 9000) return;
    lastStretchToastAt = now;
    showStudioToast('mesh is stretching—try refine or smooth mode');
}

function syncToolStripUI() {
    document.querySelectorAll('.studio-tool').forEach((el) => {
        const active = el.dataset.tool === tool;
        el.classList.toggle('is-active', active);
        el.setAttribute('aria-current', active ? 'true' : 'false');
    });
}

function selectSculptTool(id) {
    if (!SCULPT_TOOLS.includes(id)) return;
    tool = id;
    if (clay) {
        clay.setTool(tool);
        clay.endPickStroke();
    }
    syncToolStripUI();
    scheduleAutosave('tool');
}

function applyStudioSwatch(id, syncSliders = true) {
    const sw = STUDIO_SWATCHES.find((s) => s.id === id);
    if (!sw) return;

    currentSwatchId = id;

    if (clay?.ball) {
        const mat = clay.ball.material;
        mat.color.setHex(hexForSwatchTheme(sw));
        mat.roughness = roughnessForSwatchTheme(sw);
        mat.metalness = metalnessForSwatchTheme(sw);
        mat.needsUpdate = true;
    }

    document.querySelectorAll('.studio-swatch').forEach((el) => {
        el.classList.toggle('is-active', el.dataset.swatch === id);
    });
    syncPaletteSwatchColors();

    if (syncSliders) {
        const sizeSlider = document.querySelector('.size-slider');
        if (sizeSlider) sizeSlider.value = String(sculptRadius);
        const strengthSlider = document.querySelector('.strength-slider');
        if (strengthSlider) strengthSlider.value = String(sculptStrength);
    }
    scheduleAutosave('swatch');
}

function getSessionId() {
    let id = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (id) return id;
    id = `clay-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(SESSION_STORAGE_KEY, id);
    return id;
}

function buildPersistedState() {
    return {
        version: 1,
        isDarkMode,
        tool,
        sculptStrength,
        sculptRadius,
        currentSwatchId,
        sculptHistory
    };
}

async function saveStateNow() {
    if (!hydrateDone || replayRunning || !clay) return;
    if (autosaveInFlight) {
        autosaveQueued = true;
        return;
    }
    autosaveInFlight = true;
    try {
        await fetch(SAVE_ENDPOINT, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: getSessionId(),
                state: buildPersistedState()
            })
        });
    } catch (error) {
        showStudioToast('autosave failed');
    } finally {
        autosaveInFlight = false;
        if (autosaveQueued) {
            autosaveQueued = false;
            scheduleAutosave('queued');
        }
    }
}

function scheduleAutosave(_reason = 'change') {
    if (!hydrateDone) return;
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
        autosaveTimer = null;
        saveStateNow();
    }, AUTOSAVE_DEBOUNCE_MS);
}

async function hydrateStateFromCloud() {
    const sessionId = getSessionId();
    try {
        const resp = await fetch(`${SAVE_ENDPOINT}?sessionId=${encodeURIComponent(sessionId)}`);
        if (!resp.ok) return;
        const payload = await resp.json();
        const state = payload?.state;
        if (!state || typeof state !== 'object') return;

        if (typeof state.isDarkMode === 'boolean' && state.isDarkMode !== isDarkMode) {
            isDarkMode = state.isDarkMode;
            syncSceneAndRendererBg();
            setupLighting();
            updatePageStyles();
            syncThemeToggleLabel();
        }

        if (typeof state.sculptStrength === 'number') {
            sculptStrength = state.sculptStrength;
            clay.setStrength(sculptStrength);
        }

        if (typeof state.sculptRadius === 'number') {
            sculptRadius = state.sculptRadius;
            clay.setBrushSize(sculptRadius);
        }

        if (typeof state.currentSwatchId === 'string') {
            currentSwatchId = state.currentSwatchId;
        }

        if (typeof state.tool === 'string' && SCULPT_TOOLS.includes(state.tool)) {
            tool = state.tool;
            clay.setTool(tool);
        }

        const savedHistory = Array.isArray(state.sculptHistory) ? state.sculptHistory : [];
        resetMesh();
        sculptHistory.length = 0;
        clay.replayPlaybackActive = true;
        for (const step of savedHistory) {
            if (!step || typeof step !== 'object') continue;
            if (!SCULPT_TOOLS.includes(step.tool)) continue;
            clay.setTool(step.tool);
            clay.setStrength(typeof step.strength === 'number' ? step.strength : sculptStrength);
            clay.setBrushSize(typeof step.radius === 'number' ? step.radius : sculptRadius);
            clay.sculptResponse = typeof step.sculptResponse === 'number' ? step.sculptResponse : 1;
            if (
                typeof step.x === 'number' &&
                typeof step.y === 'number' &&
                typeof step.z === 'number'
            ) {
                clay.moldClay(step.x, step.y, step.z, Boolean(step.isTouch));
                sculptHistory.push(step);
            }
        }
        clay.replayPlaybackActive = false;
        clay.setTool(tool);
        clay.setStrength(sculptStrength);
        clay.setBrushSize(sculptRadius);
        applyStudioSwatch(currentSwatchId, true);
        syncToolStripUI();
        showStudioToast('restored your last clay session');
    } catch (error) {
        showStudioToast('could not load saved session');
    } finally {
        hydrateDone = true;
    }
}

async function init() {
    if (initialized) return;
    initialized = true;

    canvas = document.getElementById('canvas-container');
    if (!canvas) return;
    canvas.innerHTML = '';

    scene = new THREE.Scene();
    scene.background = new THREE.Color(themes.dark.scene);

    cam = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, CAMERA_NEAR, 1000);
    cam.position.set(0, 0, 5);
    cam.lookAt(0, 0, 0);
    cam.near = CAMERA_NEAR;
    cam.updateProjectionMatrix();

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(themes.dark.clear, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    /** @note Three.js reads shadow bias from each light; this mirrors common presets for macro zoom stability. */
    renderer.shadowMap.bias = -0.0001;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    canvas.appendChild(renderer.domElement);

    setupLighting();

    clay = new ClaySculptor(scene);
    clay.setTool(tool);
    clay.sculptHistoryTarget = sculptHistory;
    clay.setStrength(sculptStrength);
    clay.setBrushSize(sculptRadius);

    if (typeof window !== 'undefined') {
        window.sculptHistory = sculptHistory;
        window.resetMesh = resetMesh;
        window.playReplay = playReplay;
    }

    exporter = new EmojiExporter(scene, clay);

    controls = new OrbitControls(cam, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    const clayRadius = clay.ball.geometry.parameters.radius;
    controls.minDistance = Math.max(0.5, clayRadius * 1.03);
    controls.maxDistance = 15;
    controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.ROTATE,
        RIGHT: THREE.MOUSE.ROTATE
    };

    setupEvents();
    makeUI();
    setupChrome();
    applyStudioSwatch(currentSwatchId, true);
    updatePageStyles();
    await hydrateStateFromCloud();
    if (!hydrateDone) hydrateDone = true;
    animate();
}

function makeUI() {
    const toolbar = document.getElementById('studio-toolbar');
    const palette = document.getElementById('studio-palette');
    const ctrl = document.getElementById('studio-dock') || document.querySelector('.controls');
    if (!toolbar || !palette || !ctrl) return;
    toolbar.innerHTML = '';
    palette.innerHTML = '';
    ctrl.innerHTML = '';

    const toolsWrap = document.createElement('div');
    toolsWrap.className = 'studio-tools';
    toolsWrap.setAttribute('role', 'toolbar');
    toolsWrap.setAttribute('aria-label', 'sculpt mode');
    SCULPT_TOOLS.forEach((tid) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'studio-tool';
        b.dataset.tool = tid;
        b.textContent = tid;
        b.title = tid;
        b.onclick = () => selectSculptTool(tid);
        toolsWrap.appendChild(b);
    });
    toolbar.appendChild(toolsWrap);

    const swWrap = document.createElement('div');
    swWrap.className = 'studio-swatches';
    swWrap.setAttribute('role', 'group');
    swWrap.setAttribute('aria-label', 'material');

    STUDIO_SWATCHES.forEach((sw) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'studio-swatch';
        b.dataset.swatch = sw.id;
        b.setAttribute('aria-label', sw.label);
        b.setAttribute('aria-pressed', sw.id === currentSwatchId ? 'true' : 'false');
        b.style.backgroundColor = '#' + hexForSwatchTheme(sw).toString(16).padStart(6, '0');
        b.onclick = () => {
            applyStudioSwatch(sw.id, true);
            document.querySelectorAll('.studio-swatch').forEach((el) => {
                el.setAttribute('aria-pressed', el.dataset.swatch === sw.id ? 'true' : 'false');
            });
        };
        swWrap.appendChild(b);
    });
    palette.appendChild(swWrap);

    const sizeWrap = document.createElement('div');
    sizeWrap.className = 'studio-control-group studio-dock__segment';
    const sizeGroup = document.createElement('div');
    sizeGroup.className = 'slider-group';
    const sizeCap = document.createElement('span');
    sizeCap.className = 'studio-dock-cap';
    sizeCap.id = 'dock-radius-cap';
    sizeCap.textContent = 'radius';
    const sizeSlider = document.createElement('input');
    sizeSlider.id = 'size-slider';
    sizeSlider.setAttribute('aria-labelledby', 'dock-radius-cap');
    sizeSlider.type = 'range';
    sizeSlider.min = '0.1';
    sizeSlider.max = '0.8';
    sizeSlider.step = '0.1';
    sizeSlider.value = String(sculptRadius);
    sizeSlider.className = 'size-slider studio-slider';
    sizeSlider.oninput = (e) => {
        sculptRadius = parseFloat(e.target.value);
        if (clay) clay.setBrushSize(sculptRadius);
        scheduleAutosave('radius');
    };
    sizeGroup.appendChild(sizeCap);
    sizeGroup.appendChild(sizeSlider);
    sizeWrap.appendChild(sizeGroup);

    const strWrap = document.createElement('div');
    strWrap.className = 'studio-control-group studio-dock__segment';
    const strGroup = document.createElement('div');
    strGroup.className = 'slider-group';
    const strCap = document.createElement('span');
    strCap.className = 'studio-dock-cap';
    strCap.id = 'dock-intensity-cap';
    strCap.textContent = 'intensity';
    const strSlider = document.createElement('input');
    strSlider.id = 'strength-slider';
    strSlider.setAttribute('aria-labelledby', 'dock-intensity-cap');
    strSlider.type = 'range';
    strSlider.min = '0.05';
    strSlider.max = '0.35';
    strSlider.step = '0.01';
    strSlider.value = String(sculptStrength);
    strSlider.className = 'strength-slider studio-slider';
    strSlider.oninput = (e) => {
        sculptStrength = parseFloat(e.target.value);
        if (clay) clay.setStrength(sculptStrength);
        scheduleAutosave('strength');
    };
    strGroup.appendChild(strCap);
    strGroup.appendChild(strSlider);
    strWrap.appendChild(strGroup);

    const replayBtn = document.createElement('button');
    replayBtn.type = 'button';
    replayBtn.className = 'studio-btn';
    replayBtn.textContent = 'replay';
    replayBtn.title = 'replay session';
    replayBtn.onclick = () => playReplay();

    const exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.className = 'studio-btn';
    exportBtn.textContent = 'export sticker';
    exportBtn.onclick = (ev) => exportWithPreset('sticker', ev);

    ctrl.appendChild(sizeWrap);
    ctrl.appendChild(strWrap);
    ctrl.appendChild(replayBtn);
    ctrl.appendChild(exportBtn);

    syncToolStripUI();
}

function setupChrome() {
    let cluster = document.getElementById('chrome-cluster');
    if (!cluster) {
        cluster = document.createElement('div');
        cluster.id = 'chrome-cluster';
        cluster.className = 'chrome-cluster';
        cluster.setAttribute('aria-label', 'help, community, and theme');
        document.body.appendChild(cluster);
    }

    let help = document.getElementById('help-btn');
    if (!help) {
        help = document.createElement('button');
        help.type = 'button';
        help.id = 'help-btn';
        help.className = 'chrome-anchor chrome-anchor--help';
        help.setAttribute('aria-label', 'help');
        help.textContent = '?';
        help.onclick = () => showHelpModal();
        cluster.appendChild(help);
    } else if (help.parentElement !== cluster) {
        cluster.appendChild(help);
    }

    let community = document.getElementById('community-link');
    if (!community) {
        community = document.createElement('a');
        community.href = DISCORD_COMMUNITY_URL;
        community.target = '_blank';
        community.rel = 'noopener noreferrer';
        community.id = 'community-link';
        community.className = 'chrome-anchor chrome-anchor--community';
        community.setAttribute('aria-label', 'community — opens discord in a new tab');

        const label = document.createElement('span');
        label.className = 'chrome-community__label';
        label.textContent = 'community';

        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        icon.setAttribute('class', 'chrome-community__icon');
        icon.setAttribute('viewBox', '0 0 24 24');
        icon.setAttribute('width', '14');
        icon.setAttribute('height', '14');
        icon.setAttribute('aria-hidden', 'true');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('fill', 'currentColor');
        path.setAttribute(
            'd',
            'M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z'
        );
        icon.appendChild(path);
        community.appendChild(label);
        community.appendChild(icon);
        help.insertAdjacentElement('afterend', community);
    } else if (community.parentElement !== cluster) {
        help.insertAdjacentElement('afterend', community);
    }

    let themeBtn = document.getElementById('theme-toggle');
    if (!themeBtn) {
        themeBtn = document.createElement('button');
        themeBtn.type = 'button';
        themeBtn.id = 'theme-toggle';
        themeBtn.className = 'chrome-anchor chrome-anchor--theme';
        themeBtn.onclick = () => toggleDarkMode();
        cluster.appendChild(themeBtn);
    }
    syncThemeToggleLabel();

    let wrap = document.querySelector('.studio-signature-wrap');
    let sig = document.getElementById('studio-signature');
    if (!sig) {
        wrap = document.createElement('div');
        wrap.className = 'studio-signature-wrap';
        sig = document.createElement('p');
        sig.id = 'studio-signature';
        sig.className = 'studio-signature';
        sig.setAttribute('aria-hidden', 'true');
        wrap.appendChild(sig);
        document.body.appendChild(wrap);
    }
    sig.textContent = ABOUT_SIGNATURE;
}

function wireEscapeDismiss(overlay) {
    const onKey = (e) => {
        if (e.key === 'Escape') dismiss();
    };
    document.addEventListener('keydown', onKey);
    let gone = false;
    function dismiss() {
        if (gone) return;
        gone = true;
        document.removeEventListener('keydown', onKey);
        overlay.remove();
    }
    return dismiss;
}

function showHelpModal() {
    const overlay = document.createElement('div');
    overlay.className = 'info-overlay info-overlay--dim';
    overlay.innerHTML = `
        <div class="info-stack" role="dialog" aria-modal="true" aria-labelledby="help-title">
            <p id="help-title" class="info-heading">help</p>
            <ul class="help-list">
                <li>sculpt: shift + click + drag</li>
                <li>rotate: drag</li>
                <li>zoom: scroll</li>
                <li>reset: r</li>
                <li>refine mesh: f</li>
                <li>modes: push pull smooth pick inflate (left bar or keys 1–5)</li>
                <li>gallery light / studio dark: t or light · beside help</li>
                <li>community: link beside ? (opens in new tab)</li>
            </ul>
            <button type="button" class="info-dismiss">close</button>
        </div>
    `;
    document.body.appendChild(overlay);

    const stack = overlay.querySelector('.info-stack');
    const dismiss = wireEscapeDismiss(overlay);
    overlay.querySelector('.info-dismiss').onclick = dismiss;
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) dismiss();
    });
    if (stack) stack.addEventListener('click', (e) => e.stopPropagation());
}

function showAboutModal() {
    const overlay = document.createElement('div');
    overlay.className = 'about-overlay';
    overlay.innerHTML = `
        <div class="about-glass" role="dialog" aria-modal="true" aria-labelledby="about-line">
            <p id="about-line" class="about-glass__text">${ABOUT_SIGNATURE}</p>
            <button type="button" class="about-glass__dismiss">close</button>
        </div>
    `;
    document.body.appendChild(overlay);

    const panel = overlay.querySelector('.about-glass');
    const dismiss = wireEscapeDismiss(overlay);
    overlay.querySelector('.about-glass__dismiss').onclick = dismiss;
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) dismiss();
    });
    if (panel) panel.addEventListener('click', (e) => e.stopPropagation());
}

function toggleDarkMode() {
    isDarkMode = !isDarkMode;
    syncSceneAndRendererBg();
    setupLighting();
    updatePageStyles();
    applyStudioSwatch(currentSwatchId, false);
    syncThemeToggleLabel();
    scheduleAutosave('theme');
}

function syncThemeToggleLabel() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    btn.textContent = isDarkMode ? 'light' : 'dark';
    btn.setAttribute('aria-label', isDarkMode ? 'switch to gallery light mode' : 'switch to dark studio');
}

function updatePageStyles() {
    document.body.dataset.theme = isDarkMode ? 'dark' : 'light';
    const canvasHost = document.getElementById('canvas-container');
    if (canvasHost) {
        canvasHost.style.backgroundColor = isDarkMode ? '#000000' : '#f5f5f5';
    }
}

function onKey(e) {
    if (e.key.toLowerCase() === 'r') reset();
    if (e.key.toLowerCase() === 'f' && clay) {
        if (!clay.refineMesh()) {
            showStudioToast('already at max mesh density');
        } else {
            applyStudioSwatch(currentSwatchId, false);
            showStudioToast('refined—vertices redistributed');
        }
    }
    if (e.key === ' ') {
        e.preventDefault();
        autoSpin = !autoSpin;
    }
    if (e.key.toLowerCase() === 't') toggleDarkMode();

    const toolMap = { '1': 'push', '2': 'pull', '3': 'smooth', '4': 'pick', '5': 'inflate' };
    if (toolMap[e.key]) {
        selectSculptTool(toolMap[e.key]);
    }
}

function resetMesh() {
    if (clay) clay.resetMesh();
}

function reset() {
    resetMesh();
    sculptHistory.length = 0;
    scheduleAutosave('reset');
}

async function playReplay() {
    if (!clay || replayRunning) return;
    replayRunning = true;
    clay.replayPlaybackActive = true;

    const savedTool = tool;
    const savedRadius = sculptRadius;
    const savedStr = sculptStrength;
    const savedResponse = clay.sculptResponse;

    resetMesh();
    const steps = sculptHistory.slice();
    clay.endPickStroke();

    try {
        for (let i = 0; i < steps.length; i++) {
            if (i > 0) await new Promise((r) => setTimeout(r, 20));
            const step = steps[i];
            clay.setTool(step.tool);
            tool = step.tool;
            clay.setStrength(step.strength);
            clay.setBrushSize(step.radius);
            clay.sculptResponse = step.sculptResponse != null ? step.sculptResponse : 1;
            clay.moldClay(step.x, step.y, step.z, step.isTouch);
        }
    } finally {
        clay.replayPlaybackActive = false;
        tool = savedTool;
        sculptRadius = savedRadius;
        sculptStrength = savedStr;
        clay.setTool(savedTool);
        clay.setStrength(savedStr);
        clay.setBrushSize(savedRadius);
        clay.sculptResponse = savedResponse;
        clay.endPickStroke();
        const sizeSlider = document.querySelector('.size-slider');
        if (sizeSlider) sizeSlider.value = String(savedRadius);
        const strengthSlider = document.querySelector('.strength-slider');
        if (strengthSlider) strengthSlider.value = String(savedStr);
        syncToolStripUI();
        replayRunning = false;
    }
}

async function exportWithPreset(presetName, ev) {
    if (!exporter) {
        alert('exporter not ready');
        return;
    }

    const presets = EmojiExporter.getPresets();
    const preset = presets[presetName];
    if (!preset) {
        alert('unknown preset');
        return;
    }

    const btn = ev && ev.currentTarget;
    const originalText = btn ? btn.textContent : '';
    if (btn) {
        btn.textContent = 'exporting…';
        btn.disabled = true;
    }

    try {
        const exportOpts = {
            preset: presetName,
            filename: preset.filename,
            resolution: preset.resolution,
            backgroundColor: preset.backgroundColor,
            skipAutoDownload: presetName !== 'sticker'
        };
        if (presetName === 'emoji' && cam && controls) {
            exportOpts.mainCamera = cam;
            exportOpts.orbitControls = controls;
        }
        const result = await exporter.exportAsImage(exportOpts);

        if (result.success) {
            if (presetName === 'sticker') {
                await new Promise((resolve) => {
                    requestAnimationFrame(() => requestAnimationFrame(resolve));
                });
            } else {
                showExportModal(result);
            }
            if (btn) {
                btn.textContent = 'exported';
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.disabled = false;
                }, 800);
            }
        } else {
            alert('export failed: ' + (result.error || 'unknown'));
            if (btn) {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        }
    } catch (error) {
        alert('export error: ' + error.message);
        if (btn) {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    }
}

function showExportModal(exportData) {
    const modal = document.createElement('div');
    modal.className = 'export-modal-overlay';
    modal.innerHTML = `
        <div class="export-modal" role="dialog" aria-modal="true">
            <div class="export-modal-header">
                <h2>export complete</h2>
                <button type="button" class="modal-close-btn" aria-label="close">×</button>
            </div>
            <div class="export-modal-body">
                <img src="${exportData.imageData}" alt="preview" class="export-preview">
                <p>download below</p>
            </div>
            <div class="export-modal-footer">
                <button type="button" class="btn-action btn-download-now">download image</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const panel = modal.querySelector('.export-modal');
    const dismiss = wireEscapeDismiss(modal);
    modal.querySelector('.modal-close-btn').onclick = dismiss;
    modal.onclick = (e) => {
        if (e.target === modal) dismiss();
    };
    if (panel) panel.addEventListener('click', (e) => e.stopPropagation());
    modal.querySelector('.btn-download-now').onclick = () => {
        const link = document.createElement('a');
        link.href = exportData.imageData;
        link.download = exportData.filename;
        link.click();
        dismiss();
    };
}

function resize() {
    if (!cam || !renderer) return;
    cam.aspect = window.innerWidth / window.innerHeight;
    cam.near = CAMERA_NEAR;
    cam.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    syncSceneAndRendererBg();
}

function onTouchStart(e) {
    e.preventDefault();
    if (e.touches.length === 1) {
        dragging = true;
        const touch = e.touches[0];
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
        rc.setFromCamera(mouse, cam);
        const hits = rc.intersectObject(clay.ball);
        if (hits.length > 0) {
            const pt = hits[0].point;
            clay.moldClay(pt.x, pt.y, pt.z, true);
            scheduleAutosave('touch-start');
        }
    }
}

function onTouchMove(e) {
    e.preventDefault();
    if (dragging && e.touches.length === 1) {
        const touch = e.touches[0];
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
        rc.setFromCamera(mouse, cam);
        const hits = rc.intersectObject(clay.ball);
        if (hits.length > 0) {
            const pt = hits[0].point;
            clay.moldClay(pt.x, pt.y, pt.z, true);
            scheduleAutosave('touch-move');
        }
    }
}

function onTouchEnd(e) {
    e.preventDefault();
    dragging = false;
    if (clay) clay.endPickStroke();
}

function animate() {
    requestAnimationFrame(animate);
    if (autoSpin && !dragging) clay.ball.rotation.y += spinSpeed;
    if (controls) controls.update();
    if (renderer && scene && cam) renderer.render(scene, cam);
}

function setupEvents() {
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', resize);
    window.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: false });
    setupSculptingMode();
}

function setupSculptingMode() {
    let sculpting = false;

    renderer.domElement.addEventListener('mousedown', (e) => {
        if (e.button === 0 && e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            const rect = renderer.domElement.getBoundingClientRect();
            mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            rc.setFromCamera(mouse, cam);
            const hits = rc.intersectObject(clay.ball);
            if (hits.length > 0) {
                sculpting = true;
                controls.enabled = false;
                const pt = hits[0].point;
                clay.moldClay(pt.x, pt.y, pt.z, false);
                scheduleAutosave('sculpt-start');
            }
        }
    });

    renderer.domElement.addEventListener('mousemove', (e) => {
        if (sculpting && e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            const rect = renderer.domElement.getBoundingClientRect();
            mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            rc.setFromCamera(mouse, cam);
            const hits = rc.intersectObject(clay.ball);
            if (hits.length > 0) {
                const pt = hits[0].point;
                clay.moldClay(pt.x, pt.y, pt.z, false);
                scheduleAutosave('sculpt-move');
            }
        }
    });

    renderer.domElement.addEventListener('mouseup', (e) => {
        if (e.button === 0 && sculpting) {
            e.preventDefault();
            e.stopPropagation();
            sculpting = false;
            controls.enabled = true;
            if (clay) clay.endPickStroke();
            maybeShowStretchToast();
        }
    });

    renderer.domElement.addEventListener('mouseleave', () => {
        if (sculpting) {
            sculpting = false;
            controls.enabled = true;
            if (clay) clay.endPickStroke();
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.key === 'Shift' && sculpting) {
            sculpting = false;
            controls.enabled = true;
            if (clay) clay.endPickStroke();
        }
    });

    renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
}

window.addEventListener('DOMContentLoaded', init);
