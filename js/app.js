import * as THREE from './three.module.js';
import { ClaySculptor } from './clay.js';
import { OrbitControls } from './OrbitControls.js';

let canvas, cam, scene, renderer, controls;
let mouse = new THREE.Vector2(), dragging = false, lastMouse = new THREE.Vector2();
let clock = new THREE.Clock();

let autoSpin = false, spinSpeed = 0.001;
let clayColor = 0xe8c291;

let currentTheme = 0;
let themes = [
    { // warm
        bg: 0x1a1a1a, clay: 0xe8c291, 
        ambLight: 0xffd4a3, keyLight: 0xffb366,
        colors: { 'clay': 0xe8c291, 'terra': 0xd2691e, 'amber': 0xffbf00, 'sand': 0xc2b280 }
    },
    { // dark mode
        bg: 0x0a0a0a, clay: 0x404040,
        ambLight: 0x404040, keyLight: 0xffffff, 
        colors: { 'grey': 0x404040, 'silver': 0xc0c0c0, 'iron': 0x464451, 'ash': 0x918e85 }
    },
    { // blue theme - TODO: better colors
        bg: 0x0f1419, clay: 0x7fb3d3,
        ambLight: 0xb3d9ff, keyLight: 0x87ceeb,
        colors: { 'blue': 0x7fb3d3, 'ice': 0xb8e6e6, 'steel': 0x708090, 'mint': 0x98fb98 }
    }
];

let colors = themes[currentTheme].colors;
let moldStr = 0.05, touchStr = 0.08, tool = 'push', brushSize = 0.3;
let clay; 
let ambLight, keyLight;
let overClay = false, raycaster = new THREE.Raycaster(), initialized = false;

function setupLighting() {
    // clear old lights
    if (ambLight) scene.remove(ambLight);
    if (keyLight) scene.remove(keyLight);
    
    let theme = themes[currentTheme];
    
    ambLight = new THREE.AmbientLight(theme.ambLight, 0.4);
    scene.add(ambLight);
    
    keyLight = new THREE.DirectionalLight(theme.keyLight, 0.8);
    keyLight.position.set(8, 10, 6); 
    keyLight.castShadow = true;
    scene.add(keyLight);
}

function init() {
    if (initialized) return; // dont init twice lol
    initialized = true;
    
    canvas = document.getElementById('canvas-container');
    if (!canvas) return;
    canvas.innerHTML = '';

    // setup scene stuff
    scene = new THREE.Scene();
    scene.background = new THREE.Color(themes[currentTheme].bg);
    
    cam = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    cam.position.set(0, 0, 5); cam.lookAt(0, 0, 0);

    // renderer stuff
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    canvas.appendChild(renderer.domElement);

    setupLighting();

    // make clay ball
    clay = new ClaySculptor(scene); 
    clay.setColor(themes[currentTheme].clay);
    clay.setTool(tool);
    clay.setBrushSize(brushSize);

    // camera controls
    controls = new OrbitControls(cam, renderer.domElement);
    controls.enableDamping = true; 
    controls.enablePan = false;

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
    slider.value = brushSize; slider.className = 'size-slider';
    slider.oninput = (e) => { brushSize = parseFloat(e.target.value); clay.setBrushSize(brushSize); };
    sizeGrp.appendChild(sizeLbl); sizeGrp.appendChild(slider);
    
    let moldGrp = document.createElement('div');
    moldGrp.className = 'mold-group';
    
    let resetBtn = document.createElement('button');
    resetBtn.textContent = 'reset'; resetBtn.onclick = reset;
    
    let themeBtn = document.createElement('button');
    themeBtn.className = 'theme-btn'; themeBtn.textContent = 'theme'; themeBtn.onclick = switchTheme;
    
    moldGrp.appendChild(resetBtn); moldGrp.appendChild(themeBtn);
    
    ctrl.appendChild(colorGrp); ctrl.appendChild(toolGrp); ctrl.appendChild(sizeGrp); ctrl.appendChild(moldGrp);
}

function switchTheme() {
    currentTheme = (currentTheme + 1) % themes.length;
    applyTheme();
}

function applyTheme() {
    let theme = themes[currentTheme];
    scene.background = new THREE.Color(theme.bg);
    colors = theme.colors;
    clayColor = theme.clay;
    
    if (clay && clay.ball) clay.setColor(clayColor);
    
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
    if (clay) clay.setColor(val);
}

function onKey(e) {
    if (e.key.toLowerCase() === 'r') reset();
    if (e.key === ' ') {
        e.preventDefault(); 
        autoSpin = !autoSpin; // toggle auto-spin
    }
    if (e.key.toLowerCase() === 't') switchTheme();
    
    // number keys switch tools
    let toolMap = {'1': 'push', '2': 'pull', '3': 'smooth', '4': 'pinch', '5': 'inflate'};
    if (toolMap[e.key]) {
        tool = toolMap[e.key]; 
        if (clay) clay.setTool(tool);
        // update buttons
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.textContent === tool) btn.classList.add('active');
        });
    }
    
    // bracket keys adjust brush size
    if (e.key === '[') {
        brushSize = Math.max(0.1, brushSize - 0.05); 
        clay.setBrushSize(brushSize);
        let slider = document.querySelector('.size-slider');
        if (slider) slider.value = brushSize;
    }
    if (e.key === ']') {
        brushSize = Math.min(0.8, brushSize + 0.05); 
        clay.setBrushSize(brushSize);
        let slider = document.querySelector('.size-slider');
        if (slider) slider.value = brushSize;
    }
}

function reset() { 
    if (clay) clay.resetClay(); 
}

function showTutorial() {
    alert(`clayable

SHIFT + drag = sculpt
1-5 = tools (push/pull/smooth/pinch/inflate)
[ ] = brush size
r = reset | space = spin | t = themes

drag = rotate | wheel = zoom`);
}

function resize() {
    if (cam && renderer) {
        cam.aspect = window.innerWidth / window.innerHeight;
        cam.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

// TODO: fix hover detection
// function checkClayHover() {
//     if (!clay || !clay.ball) return;
//     raycaster.setFromCamera(mouse, cam);
//     let hits = raycaster.intersectObject(clay.ball);
    
//     let wasOver = overClay;
//     overClay = hits.length > 0;
    
//     let c = canvas.querySelector('canvas');
//     if (!c) return;
    
//     if (overClay && !wasOver) c.style.cursor = 'crosshair';
//     else if (!overClay && wasOver) c.style.cursor = 'grab';
// }

function onTouchStart(e) {
    e.preventDefault();
    if (e.touches.length === 1) {
        let touch = e.touches[0];
        mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
        
        raycaster.setFromCamera(mouse, cam);
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
        mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
        
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
    raycaster.setFromCamera(mouse, cam);
    let hits = raycaster.intersectObject(clay.ball);
    
    if (hits.length > 0) {
        let pt = hits[0].point;
        let str = touch ? touchStr : moldStr;
        clay.setStrength(str); 
        clay.moldClay(pt.x, pt.y, pt.z, touch);

    }
}

function animate() {
    requestAnimationFrame(animate);
    if (controls) controls.update();
    if (autoSpin && clay && clay.ball) clay.ball.rotation.y += spinSpeed;
    renderer.render(scene, cam);
}

function setupEvents() {
    if (!canvas) return;
    let c = canvas.querySelector('canvas');
    if (!c) return;
    
    // touch stuff
    c.addEventListener('touchstart', onTouchStart);
    c.addEventListener('touchmove', onTouchMove);
    c.addEventListener('touchend', onTouchEnd);
    
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', onKey);
    
    setupSculptingMode();
}

function setupSculptingMode() {
    let c = canvas.querySelector('canvas');
    if (!c) return;
    
    let sculptMode = false;
    let mouseDown = false;
    
    // shift = sculpt mode
    window.addEventListener('keydown', function(e) {
        if (e.key === 'Shift' && !sculptMode) {
            sculptMode = true;
            controls.enabled = false; // kill orbit controls
            c.style.cursor = 'crosshair';
        }
    });
    
    window.addEventListener('keyup', function(e) {
        if (e.key === 'Shift' && sculptMode) {
            sculptMode = false;
            mouseDown = false;
            controls.enabled = true; // camera back on
            c.style.cursor = 'grab';
        }
    });
    
    // mouse stuff
    c.addEventListener('mousedown', function(e) {
        if (sculptMode && e.button === 0) {
            mouseDown = true;
            updateMouseAndSculpt(e);
        }
    });
    
    c.addEventListener('mousemove', function(e) {
        if (sculptMode) {
            updateMouseAndSculpt(e);
        }
    });
    
    c.addEventListener('mouseup', function(e) {
        if (sculptMode && e.button === 0) {
            mouseDown = false;
        }
    });
    
    function updateMouseAndSculpt(e) {
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        
        if (mouseDown) {
            sculpt();
        }
    }
}

init();
