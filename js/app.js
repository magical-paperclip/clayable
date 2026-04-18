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
const CLEAR_COLOR = 0x000000;
const CAMERA_NEAR = 0.01;
const ABOUT_SIGNATURE = 'clayable v2.0 / built by prakruti / curated by wonder';

const themes = {
    light: {
        bg: VOID_BG,
        ambLight: 0xffffff,
        keyLight: 0xffd700
    },
    dark: {
        bg: VOID_BG,
        ambLight: 0x404040,
        keyLight: 0xffffff
    }
};

let isDarkMode = true;
let tool = 'pull';
let clay;
let ambLight, keyLight, backLight;
let sculptStrength = 0.11;
let sculptRadius = 0.5;
let currentSwatchId = 'terracotta';
let rc = new THREE.Raycaster();
let initialized = false;
let lastStretchToastAt = 0;

/** earthy palette — roughness tuned per pigment */
const STUDIO_SWATCHES = [
    { id: 'terracotta', label: 'terracotta', hex: 0xe2725b, roughness: 0.92, metalness: 0 },
    { id: 'sage', label: 'sage', hex: 0xb2ac88, roughness: 0.78, metalness: 0.02 },
    { id: 'ochre', label: 'ochre', hex: 0xcc7722, roughness: 0.84, metalness: 0.03 },
    { id: 'slate', label: 'slate', hex: 0x708090, roughness: 0.38, metalness: 0.22 },
    { id: 'sand', label: 'sand', hex: 0xc2b280, roughness: 0.74, metalness: 0.02 },
    { id: 'charcoal', label: 'charcoal', hex: 0x36454f, roughness: 0.58, metalness: 0.08 }
];

const SCULPT_TOOLS = ['push', 'pull', 'smooth', 'pick', 'inflate'];

let sculptHistory = [];
let replayRunning = false;

function setupLighting() {
    if (ambLight) scene.remove(ambLight);
    if (keyLight) scene.remove(keyLight);
    if (backLight) scene.remove(backLight);

    const theme = themes[isDarkMode ? 'dark' : 'light'];

    ambLight = new THREE.AmbientLight(theme.ambLight, 0.6);
    scene.add(ambLight);

    keyLight = new THREE.DirectionalLight(theme.keyLight, 0.85);
    keyLight.position.set(8, 10, 6);
    keyLight.castShadow = true;
    scene.add(keyLight);

    backLight = new THREE.DirectionalLight(0xffffff, 0.3);
    backLight.position.set(-6, -4, -8);
    scene.add(backLight);
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
}

function applyStudioSwatch(id, syncSliders = true) {
    const sw = STUDIO_SWATCHES.find((s) => s.id === id);
    if (!sw || !clay?.ball) return;

    currentSwatchId = id;
    const mat = clay.ball.material;
    mat.color.setHex(sw.hex);
    mat.roughness = sw.roughness;
    mat.metalness = sw.metalness;
    mat.needsUpdate = true;

    document.querySelectorAll('.studio-swatch').forEach((el) => {
        el.classList.toggle('is-active', el.dataset.swatch === id);
    });

    if (syncSliders) {
        const sizeSlider = document.querySelector('.size-slider');
        if (sizeSlider) sizeSlider.value = String(sculptRadius);
        const strengthSlider = document.querySelector('.strength-slider');
        if (strengthSlider) strengthSlider.value = String(sculptStrength);
    }
}

function init() {
    if (initialized) return;
    initialized = true;

    canvas = document.getElementById('canvas-container');
    if (!canvas) return;
    canvas.innerHTML = '';

    scene = new THREE.Scene();
    scene.background = new THREE.Color(VOID_BG);

    cam = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, CAMERA_NEAR, 1000);
    cam.position.set(0, 0, 5);
    cam.lookAt(0, 0, 0);
    cam.near = CAMERA_NEAR;
    cam.updateProjectionMatrix();

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(CLEAR_COLOR, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
    controls.minDistance = 0.75;
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
        b.style.backgroundColor = '#' + sw.hex.toString(16).padStart(6, '0');
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
    const sizeLbl = document.createElement('label');
    sizeLbl.className = 'studio-label';
    sizeLbl.htmlFor = 'size-slider';
    sizeLbl.textContent = 'size';
    const sizeSlider = document.createElement('input');
    sizeSlider.id = 'size-slider';
    sizeSlider.type = 'range';
    sizeSlider.min = '0.1';
    sizeSlider.max = '0.8';
    sizeSlider.step = '0.1';
    sizeSlider.value = String(sculptRadius);
    sizeSlider.className = 'size-slider studio-slider';
    sizeSlider.oninput = (e) => {
        sculptRadius = parseFloat(e.target.value);
        if (clay) clay.setBrushSize(sculptRadius);
    };
    sizeWrap.appendChild(sizeLbl);
    sizeWrap.appendChild(sizeSlider);

    const strWrap = document.createElement('div');
    strWrap.className = 'studio-control-group studio-dock__segment';
    const strLbl = document.createElement('label');
    strLbl.className = 'studio-label';
    strLbl.htmlFor = 'strength-slider';
    strLbl.textContent = 'strength';
    const strSlider = document.createElement('input');
    strSlider.id = 'strength-slider';
    strSlider.type = 'range';
    strSlider.min = '0.05';
    strSlider.max = '0.35';
    strSlider.step = '0.01';
    strSlider.value = String(sculptStrength);
    strSlider.className = 'strength-slider studio-slider';
    strSlider.oninput = (e) => {
        sculptStrength = parseFloat(e.target.value);
        if (clay) clay.setStrength(sculptStrength);
    };
    strWrap.appendChild(strLbl);
    strWrap.appendChild(strSlider);

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
    if (!document.getElementById('help-btn')) {
        const help = document.createElement('button');
        help.type = 'button';
        help.id = 'help-btn';
        help.className = 'chrome-anchor chrome-anchor--help';
        help.setAttribute('aria-label', 'help');
        help.textContent = '?';
        help.onclick = () => showHelpModal();
        document.body.appendChild(help);
    }

    let aboutBtn = document.getElementById('about-btn');
    if (!aboutBtn) {
        aboutBtn = document.createElement('button');
        aboutBtn.type = 'button';
        aboutBtn.id = 'about-btn';
        aboutBtn.className = 'chrome-anchor chrome-anchor--about';
        aboutBtn.setAttribute('aria-label', 'about clayable');
        aboutBtn.textContent = ABOUT_SIGNATURE;
        document.body.appendChild(aboutBtn);
    }
    aboutBtn.textContent = ABOUT_SIGNATURE;
    if (!aboutBtn.dataset.wired) {
        aboutBtn.dataset.wired = '1';
        aboutBtn.addEventListener('click', () => showAboutModal());
    }
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
    scene.background = new THREE.Color(themes[isDarkMode ? 'dark' : 'light'].bg);
    setupLighting();
    updatePageStyles();
}

function updatePageStyles() {
    document.body.style.background = '#000000';
    document.body.style.color = '#ffffff';
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
    renderer.setClearColor(CLEAR_COLOR, 1);
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
