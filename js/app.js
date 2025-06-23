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
    { // warm theme
        bg: 0x1a1a1a, clay: 0xe8c291, 
        ambLight: 0xffd4a3, keyLight: 0xffb366,
        colors: { 'clay': 0xe8c291, 'terra': 0xd2691e, 'amber': 0xffbf00, 'sand': 0xc2b280 }
    },
    { // dark mode
        bg: 0x0a0a0a, clay: 0x404040,
        ambLight: 0x404040, keyLight: 0xffffff, 
        colors: { 'grey': 0x404040, 'silver': 0xc0c0c0, 'iron': 0x464451, 'ash': 0x918e85 }
    },
    { // blue theme
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

    clay = new ClaySculptor(scene); 
    clay.setColor(themes[currentTheme].clay);
    clay.setTool(tool);
    clay.setBrushSize(brushSize);
    
    // sync title color with clay color
    updateTitleColor(clayColor);

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
    updateTitleColor(clayColor);
    
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
    updateTitleColor(val);
}

function updateTitleColor(color) {
    const title = document.querySelector('.banner h1');
    if (title) {
        const hexColor = '#' + color.toString(16).padStart(6, '0');
        title.style.color = hexColor;
        // update text shadow to match the color with reduced opacity
        const r = (color >> 16) & 255;
        const g = (color >> 8) & 255;
        const b = color & 255;
        title.style.textShadow = `0 0 20px rgba(${r}, ${g}, ${b}, 0.3)`;
    }
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
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`.tool-btn:nth-child(${Object.keys(toolMap).indexOf(e.key) + 1})`).classList.add('active');
    }
}

function reset() { 
    if (clay) clay.reset(); 
}

function showTutorial() {
    alert(`clayable - sculpt with your cursor

controls:
- click & drag: sculpt clay
- scroll: zoom in/out
- right click + drag: rotate camera
- spacebar: auto-rotate
- r: reset clay
- t: switch theme
- 1-5: select tools

tools:
- push: add clay
- pull: remove clay  
- smooth: smooth surface
- pinch: pinch clay inward
- inflate: puff out clay

tips:
- larger brush = bigger effect
- hold shift for fine control
- try different colors & themes!`);
}

function resize() {
    if (!cam || !renderer) return;
    cam.aspect = window.innerWidth / window.innerHeight;
    cam.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

let touchStartPos = null;

function onTouchStart(e) {
    e.preventDefault();
    if (e.touches.length === 1) {
        dragging = true;
        let touch = e.touches[0];
        touchStartPos = { x: touch.clientX, y: touch.clientY };
        
        mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
        lastMouse.copy(mouse);
        
        raycaster.setFromCamera(mouse, cam);
        let intersects = raycaster.intersectObject(clay.ball);
        overClay = intersects.length > 0;
        
        if (overClay) sculpt(true);
    }
}

function onTouchMove(e) {
    e.preventDefault();
    if (dragging && e.touches.length === 1) {
        let touch = e.touches[0];
        mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
        
        raycaster.setFromCamera(mouse, cam);
        let intersects = raycaster.intersectObject(clay.ball);
        overClay = intersects.length > 0;
        
        if (overClay) sculpt(true);
        lastMouse.copy(mouse);
    }
}

function onTouchEnd(e) { e.preventDefault(); dragging = false; }

function sculpt(touch = false) {
    if (!clay || !overClay) return;
    
    raycaster.setFromCamera(mouse, cam);
    let intersects = raycaster.intersectObject(clay.ball);
    if (intersects.length > 0) {
        let point = intersects[0].point;
        let normal = intersects[0].face.normal;
        let strength = touch ? touchStr : moldStr;
        clay.sculpt(point, normal, strength);
    }
}

function animate() {
    requestAnimationFrame(animate);
    
    if (autoSpin && !dragging) {
        clay.ball.rotation.y += spinSpeed;
    }
    
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
    let isMouseDown = false;
    let isDragging = false;
    let dragThreshold = 3;
    let startPos = { x: 0, y: 0 };

    renderer.domElement.addEventListener('mousedown', (e) => {
        if (e.button === 0) {
            isMouseDown = true;
            isDragging = false;
            startPos.x = e.clientX;
            startPos.y = e.clientY;
            controls.enabled = false;
        }
    });

    renderer.domElement.addEventListener('mousemove', (e) => {
        updateMouseAndSculpt(e);
        
        if (isMouseDown) {
            let deltaX = Math.abs(e.clientX - startPos.x);
            let deltaY = Math.abs(e.clientY - startPos.y);
            
            if (deltaX > dragThreshold || deltaY > dragThreshold) {
                isDragging = true;
            }
        }
    });

    renderer.domElement.addEventListener('mouseup', (e) => {
        if (e.button === 0) {
            isMouseDown = false;
            dragging = false;
            
            setTimeout(() => {
                controls.enabled = true;
            }, 50);
        }
    });

    renderer.domElement.addEventListener('mouseleave', () => {
        isMouseDown = false;
        dragging = false;
        controls.enabled = true;
    });

    renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

    function updateMouseAndSculpt(e) {
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        
        raycaster.setFromCamera(mouse, cam);
        let intersects = raycaster.intersectObject(clay.ball);
        overClay = intersects.length > 0;
        
        if (isMouseDown && overClay) {
            dragging = true;
            sculpt();
        }
    }
}

// start everything when page loads
window.addEventListener('DOMContentLoaded', init);
