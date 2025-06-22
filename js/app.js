import * as THREE from './three.module.js';
import { ClaySculptor } from './clay.js';
import { OrbitControls } from './OrbitControls.js';

let canvas, cam, scene, renderer, controls;
let mouse = new THREE.Vector2(), dragging = false, lastMouse = new THREE.Vector2();
let clock = new THREE.Clock();

let spin = false, spinSpd = 0.001;
let clayColor = 0xe8c291;

let currentTheme = 'warm';
let themes = {
    warm: {
        name: 'warm', bg: 0x1a1a1a, clay: 0xe8c291, title: '#e8c291',
        lighting: {
            ambient: { color: 0xffd4a3, intensity: 0.4 },
            key: { color: 0xffb366, intensity: 0.9, pos: [8, 12, 6] },
            fill: { color: 0xffe6cc, intensity: 0.3, pos: [-6, 3, 4] },
            rim: { color: 0xff9933, intensity: 0.5, pos: [2, -5, 8] }
        },
        colors: { 'classic': 0xe8c291, 'terracotta': 0xd2691e, 'amber': 0xffbf00, 'copper': 0xb87333, 'sand': 0xc2b280, 'cream': 0xfffdd0 }
    },
    cool: {
        name: 'cool', bg: 0x0f1419, clay: 0x7fb3d3, title: '#7fb3d3',
        lighting: {
            ambient: { color: 0xb3d9ff, intensity: 0.3 },
            key: { color: 0x87ceeb, intensity: 0.8, pos: [10, 8, 7] },
            fill: { color: 0xe0f6ff, intensity: 0.4, pos: [-8, 5, 3] },
            rim: { color: 0x4682b4, intensity: 0.6, pos: [3, -8, 9] }
        },
        colors: { 'ice': 0xb8e6e6, 'steel': 0x708090, 'slate': 0x6c7b7f, 'mint': 0x98fb98, 'sage': 0x9caf88, 'pearl': 0xf8f8ff }
    },
    dark: {
        name: 'dark', bg: 0x0a0a0a, clay: 0x404040, title: '#888888',
        lighting: {
            ambient: { color: 0x404040, intensity: 0.2 },
            key: { color: 0xffffff, intensity: 1.2, pos: [15, 15, 10] },
            fill: { color: 0x666666, intensity: 0.2, pos: [-12, 8, 5] },
            rim: { color: 0xcccccc, intensity: 0.8, pos: [5, -12, 12] }
        },
        colors: { 'charcoal': 0x36454f, 'graphite': 0x41424c, 'smoke': 0x738276, 'ash': 0x918e85, 'iron': 0x464451, 'silver': 0xc0c0c0 }
    },
    soft: {
        name: 'soft', bg: 0x1c1b1f, clay: 0xd4a574, title: '#d4a574',
        lighting: {
            ambient: { color: 0xffeee6, intensity: 0.5 },
            key: { color: 0xffd9cc, intensity: 0.7, pos: [6, 10, 8] },
            fill: { color: 0xffe6f2, intensity: 0.5, pos: [-5, 6, 6] },
            rim: { color: 0xffb3d9, intensity: 0.4, pos: [4, -6, 10] }
        },
        colors: { 'blush': 0xf4c2c2, 'peach': 0xffcba4, 'lavender': 0xe6e6fa, 'rose': 0xffc0cb, 'cream': 0xfdf6e3, 'powder': 0xb0c4de }
    },
    earth: {
        name: 'earth', bg: 0x2c1810, clay: 0x8b4513, title: '#cd853f',
        lighting: {
            ambient: { color: 0xd4a574, intensity: 0.35 },
            key: { color: 0xf4e4bc, intensity: 0.9, pos: [12, 14, 8] },
            fill: { color: 0xb8860b, intensity: 0.4, pos: [-8, 6, 5] },
            rim: { color: 0x8fbc8f, intensity: 0.3, pos: [6, -10, 12] }
        },
        colors: { 'clay': 0x8b4513, 'moss': 0x8a9a5b, 'forest': 0x355e3b, 'stone': 0x928e85, 'rust': 0xb7410e, 'bone': 0xf9f6ee }
    },
    ocean: {
        name: 'ocean', bg: 0x0d1321, clay: 0x415a77, title: '#778da9',
        lighting: {
            ambient: { color: 0x4169e1, intensity: 0.25 },
            key: { color: 0x87ceeb, intensity: 1.0, pos: [14, 12, 9] },
            fill: { color: 0x00ced1, intensity: 0.35, pos: [-10, 7, 4] },
            rim: { color: 0x20b2aa, intensity: 0.7, pos: [7, -9, 11] }
        },
        colors: { 'deep': 0x1d3557, 'wave': 0x457b9d, 'foam': 0xa8dadc, 'coral': 0xf1faee, 'tide': 0x778da9, 'shore': 0xe63946 }
    }
};

let colors = themes[currentTheme].colors;
let moldStr = 0.02, touchStr = 0.035, tool = 'push', size = 0.3;
let clay; 
let ambLight, keyLight, fillLight, rimLight;
let overClay = false, raycaster = new THREE.Raycaster(), initialized = false;

function setupLighting() {
    if (ambLight) scene.remove(ambLight);
    if (keyLight) scene.remove(keyLight);
    if (fillLight) scene.remove(fillLight);
    if (rimLight) scene.remove(rimLight);
    
    let l = themes[currentTheme].lighting;
    
    ambLight = new THREE.AmbientLight(l.ambient.color, l.ambient.intensity);
    scene.add(ambLight);
    
    keyLight = new THREE.DirectionalLight(l.key.color, l.key.intensity);
    keyLight.position.set(...l.key.pos); keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048; keyLight.shadow.mapSize.height = 2048;
    scene.add(keyLight);
    
    fillLight = new THREE.DirectionalLight(l.fill.color, l.fill.intensity);
    fillLight.position.set(...l.fill.pos); scene.add(fillLight);
    
    rimLight = new THREE.DirectionalLight(l.rim.color, l.rim.intensity);
    rimLight.position.set(...l.rim.pos); scene.add(rimLight);
}

function init() {
    if (initialized) return;
    initialized = true;
    
    canvas = document.getElementById('canvas-container');
    if (!canvas) return;
    canvas.innerHTML = '';

    scene = new THREE.Scene();
    scene.background = new THREE.Color(themes[currentTheme].bg);
    
    cam = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    cam.position.set(0, 0, 5); cam.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    canvas.appendChild(renderer.domElement);

    setupLighting();

    clay = new ClaySculptor(scene); clay.setColor(themes[currentTheme].clay);

    controls = new OrbitControls(cam, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.05;
    controls.enableZoom = true; controls.enablePan = false;
    controls.minDistance = 2; controls.maxDistance = 10;

    setupEvents(); makeUI(); setupTutorial();
    animate();
}

function makeUI() {
    let ctrl = document.querySelector('.controls');
    ctrl.innerHTML = '';
    
    let colorGrp = document.createElement('div');
    colorGrp.className = 'color-group';
    
    Object.entries(colors).forEach(([name, val]) => {
        let btn = document.createElement('button');
        btn.className = 'color-btn';
        btn.textContent = name;
        btn.style.backgroundColor = '#' + val.toString(16).padStart(6, '0');
        btn.onclick = () => changeColor(name, val);
        colorGrp.appendChild(btn);
    });
    
    let toolGrp = document.createElement('div');
    toolGrp.className = 'tool-group';
    
    ['push', 'pull', 'smooth', 'pinch', 'inflate'].forEach(t => {
        let btn = document.createElement('button');
        btn.className = 'tool-btn';
        btn.textContent = t;
        if (t === tool) btn.classList.add('active');
        btn.onclick = () => {
            tool = t; clay.setTool(t);
            document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        };
        toolGrp.appendChild(btn);
    });
    
    let sizeGrp = document.createElement('div');
    sizeGrp.className = 'size-group';
    let sizeLbl = document.createElement('span');
    sizeLbl.className = 'size-label'; sizeLbl.textContent = 'size';
    let slider = document.createElement('input');
    slider.type = 'range'; slider.min = '0.1'; slider.max = '0.8'; slider.step = '0.1';
    slider.value = size; slider.className = 'size-slider';
    slider.oninput = (e) => { size = parseFloat(e.target.value); clay.setBrushSize(size); };
    sizeGrp.appendChild(sizeLbl); sizeGrp.appendChild(slider);
    
    let moldGrp = document.createElement('div');
    moldGrp.className = 'mold-group';
    
    let resetBtn = document.createElement('button');
    resetBtn.textContent = 'reset'; resetBtn.onclick = reset;
    
    let helpBtn = document.createElement('button');
    helpBtn.className = 'help-btn'; helpBtn.textContent = '?'; helpBtn.onclick = showTutorial;
    
    let themeBtn = document.createElement('button');
    themeBtn.className = 'theme-btn'; themeBtn.textContent = 'theme'; themeBtn.onclick = switchTheme;
    
    moldGrp.appendChild(resetBtn); moldGrp.appendChild(helpBtn); moldGrp.appendChild(themeBtn);
    
    ctrl.appendChild(colorGrp); ctrl.appendChild(toolGrp); ctrl.appendChild(sizeGrp); ctrl.appendChild(moldGrp);
}

function switchTheme() {
    let keys = Object.keys(themes);
    let idx = keys.indexOf(currentTheme);
    let next = (idx + 1) % keys.length;
    currentTheme = keys[next];
    applyTheme();
}

function applyTheme() {
    let theme = themes[currentTheme];
    scene.background = new THREE.Color(theme.bg);
    colors = theme.colors;
    clayColor = theme.clay;
    
    if (clay && clay.ball) clay.setColor(clayColor);
    
    let title = document.querySelector('.banner h1');
    if (title) title.style.color = theme.title;
    
    setupLighting();
    updateColorButtons();
}

function updateColorButtons() {
    let colorDiv = document.querySelector('.color-group');
    if (!colorDiv) return;
    colorDiv.innerHTML = '';
    
    Object.keys(colors).forEach(name => {
        let colorBtn = document.createElement('button');
        colorBtn.className = 'color-btn';
        colorBtn.textContent = name;
        colorBtn.style.backgroundColor = '#' + colors[name].toString(16).padStart(6, '0');
        colorBtn.onclick = () => changeColor(name, colors[name]);
        colorDiv.appendChild(colorBtn);
    });
}

function setupTutorial() {
    let tutBtn = document.getElementById('tutorial-btn');
    if (tutBtn) tutBtn.onclick = showTutorial;
}

function changeColor(name, val) {
    clayColor = val;
    if (clay && clay.ball) clay.setColor(val);
    
    let titleEl = document.querySelector('.banner h1');
    if (titleEl) {
        titleEl.style.color = '#' + val.toString(16).padStart(6, '0');
    }
}

function onKey(e) {
    if (e.key.toLowerCase() === 'r') reset();
    if (e.key === ' ') {
        e.preventDefault(); spin = !spin;
    }
    if (e.key.toLowerCase() === 't') switchTheme();
    
    let toolMap = {'1': 'push', '2': 'pull', '3': 'smooth', '4': 'pinch', '5': 'inflate'};
    if (toolMap[e.key]) {
        tool = toolMap[e.key]; clay.setTool(tool);
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.textContent === tool) btn.classList.add('active');
        });
    }
    
    if (e.key === '[') {
        size = Math.max(0.1, size - 0.05); clay.setBrushSize(size);
        let sizeSlider = document.querySelector('.size-slider');
        if (sizeSlider) sizeSlider.value = size;
    }
    if (e.key === ']') {
        size = Math.min(0.8, size + 0.05); clay.setBrushSize(size);
        let sizeSlider = document.querySelector('.size-slider');
        if (sizeSlider) sizeSlider.value = size;
    }
}

function reset() { if (clay) clay.resetClay(); }

function showTutorial() {
    alert(`clayable

drag to sculpt clay
mouse wheel - zoom
right click drag - rotate

tools:
1 - push (makes dents)
2 - pull (pulls out)  
3 - smooth 
4 - pinch (sharp)
5 - inflate

keys:
[ ] - size
r - reset
space - spin
t - themes`);
}

function resize() {
    if (cam && renderer) {
        cam.aspect = window.innerWidth / window.innerHeight;
        cam.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

function onMouseMove(e) {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    checkClayHover();
    if (dragging) sculpt();
}

function checkClayHover() {
    if (!clay || !clay.ball) return;
    raycaster.setFromCamera(mouse, cam);
    let hits = raycaster.intersectObject(clay.ball);
    
    let wasOver = overClay;
    overClay = hits.length > 0;
    
    let c = canvas.querySelector('canvas');
    if (!c) return;
    
    if (overClay && !wasOver) c.style.cursor = 'crosshair';
    else if (!overClay && wasOver) c.style.cursor = 'grab';
}

function onMouseDown(e) {
    let c = canvas.querySelector('canvas');
    
    if (overClay && e.button === 0) {
        e.preventDefault(); dragging = true;
        lastMouse.set(e.clientX, e.clientY);
        if (c) c.style.cursor = 'crosshair';
        sculpt();
    } else {
        if (c) c.style.cursor = 'grabbing';
    }
}

function onMouseUp(e) {
    dragging = false;
    let c = canvas.querySelector('canvas');
    if (overClay) {
        if (c) c.style.cursor = 'crosshair';
    } else {
        if (c) c.style.cursor = 'grab';
    }
}

function onTouchStart(e) {
    e.preventDefault();
    if (e.touches.length === 1) {
        let touch = e.touches[0];
        mousePos.x = (touch.clientX / window.innerWidth) * 2 - 1;
        mousePos.y = -(touch.clientY / window.innerHeight) * 2 + 1;
        
        raycaster.setFromCamera(mousePos, cam);
        let hits = raycaster.intersectObject(clay.ball);
        
        if (hits.length > 0) {
            dragging = true; lastMouse.set(touch.clientX, touch.clientY);
            sculpt(true);
        }
    } else if (e.touches.length === 2) {
        dragging = false;
    }
}

function onTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 1 && dragging) {
        let touch = e.touches[0];
        mousePos.x = (touch.clientX / window.innerWidth) * 2 - 1;
        mousePos.y = -(touch.clientY / window.innerHeight) * 2 + 1;
        
        let dx = touch.clientX - lastMouse.x, dy = touch.clientY - lastMouse.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > 5) {
            sculpt(true); lastMouse.set(touch.clientX, touch.clientY);
        }
    }
}

function onTouchEnd(e) { e.preventDefault(); dragging = false; }

function sculpt(touch = false) {
    if (!clay || !clay.ball) return;
    raycaster.setFromCamera(mousePos, cam);
    let hits = raycaster.intersectObject(clay.ball);
    
    if (hits.length > 0) {
        let pt = hits[0].point;
        let str = touch ? touchStr : moldStr;
        clay.setStrength(str); clay.moldClay(pt.x, pt.y, pt.z, touch);
    }
}

function animate() {
    requestAnimationFrame(animate);
    if (controls) controls.update();
    if (spin && clay && clay.ball) clay.ball.rotation.y += spinSpd;
    renderer.render(scene, cam);
}

function setupEvents() {
    if (!canvas) return;
    let c = canvas.querySelector('canvas');
    if (!c) return;
    
    c.addEventListener('mousemove', onMouseMove);
    c.addEventListener('mousedown', onMouseDown);
    c.addEventListener('mouseup', onMouseUp);
    c.addEventListener('touchstart', onTouchStart);
    c.addEventListener('touchmove', onTouchMove);
    c.addEventListener('touchend', onTouchEnd);
    
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', onKey);
}

init();
