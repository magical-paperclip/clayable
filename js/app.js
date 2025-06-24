import * as THREE from './three.module.js';
import { ClaySculptor } from './clay.js';
import { OrbitControls } from './OrbitControls.js';

let canvas, cam, scene, renderer, controls;
let mouse = new THREE.Vector2(), dragging = false, lastMouse = new THREE.Vector2();
let clock = new THREE.Clock();

let autoSpin = false, spinSpeed = 0.001;
let clayColor = 0xe8c291;

let isDarkMode = true;
let themes = {
    light: {
        bg: 0xf5f5f5, clay: 0xd2691e, 
        ambLight: 0xffffff, keyLight: 0xffd700,
        colors: { 'terra': 0xd2691e, 'coral': 0xff7f50, 'salmon': 0xfa8072, 'peach': 0xffcba4 }
    },
    dark: {
        bg: 0x0a0a0a, clay: 0xe8c291,
        ambLight: 0x404040, keyLight: 0xffffff, 
        colors: { 'clay': 0xe8c291, 'terra': 0xd2691e, 'amber': 0xffbf00, 'sand': 0xc2b280 }
    }
};

let colors = themes[isDarkMode ? 'dark' : 'light'].colors;
let moldStr = 0.05, touchStr = 0.08, tool = 'push', brushSize = 0.3;
let clay; 
let ambLight, keyLight;
let overClay = false, raycaster = new THREE.Raycaster(), initialized = false;

function setupLighting() {
    if (ambLight) scene.remove(ambLight);
    if (keyLight) scene.remove(keyLight);
    
    let theme = themes[isDarkMode ? 'dark' : 'light'];
    
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
    scene.background = new THREE.Color(themes[isDarkMode ? 'dark' : 'light'].bg);
    
    cam = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    cam.position.set(0, 0, 5); cam.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    canvas.appendChild(renderer.domElement);

    setupLighting();

    clay = new ClaySculptor(scene); 
    clay.setColor(themes[isDarkMode ? 'dark' : 'light'].clay);
    clay.setTool(tool);
    clay.setBrushSize(brushSize);
    
    updateTitleColor(clayColor);

    controls = new OrbitControls(cam, renderer.domElement);
    controls.enableDamping = true; 
    controls.enablePan = false;
    
    // only middle mouse for camera, left is for sculpting
    controls.mouseButtons = {
        LEFT: null,  
        MIDDLE: THREE.MOUSE.ROTATE,  
        RIGHT: THREE.MOUSE.ROTATE    
    };

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
    themeBtn.className = 'theme-btn'; 
    themeBtn.textContent = isDarkMode ? '☀️ light' : '🌙 dark'; 
    themeBtn.onclick = toggleDarkMode;
    
    moldGrp.appendChild(resetBtn); moldGrp.appendChild(themeBtn);
    
    ctrl.appendChild(colorGrp); ctrl.appendChild(toolGrp); ctrl.appendChild(sizeGrp); ctrl.appendChild(moldGrp);
}

function toggleDarkMode() {
    isDarkMode = !isDarkMode;
    applyTheme();
    
    let themeBtn = document.querySelector('.theme-btn');
    if (themeBtn) themeBtn.textContent = isDarkMode ? '☀️ light' : '🌙 dark';
}

function applyTheme() {
    let theme = themes[isDarkMode ? 'dark' : 'light'];
    scene.background = new THREE.Color(theme.bg);
    colors = theme.colors;
    clayColor = theme.clay;
    
    if (clay && clay.ball) clay.setColor(clayColor);
    updateTitleColor(clayColor);
    
    setupLighting();
    updateColorButtons();
    updatePageStyles();
}

function updatePageStyles() {
    document.body.style.background = isDarkMode ? '#0a0a0a' : '#f5f5f5';
    document.body.style.color = isDarkMode ? '#fff' : '#333';
    
    let subtitle = document.querySelector('.banner p');
    if (subtitle) subtitle.style.color = isDarkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)';
}

function updateColorButtons() {
    let colorDiv = document.querySelector('.color-group');
    if (!colorDiv) return;
    colorDiv.innerHTML = '';
    
    Object.keys(colors).forEach(name => {
        let btn = document.createElement('button');
        btn.className = 'color-btn';
        btn.style.backgroundColor = '#' + colors[name].toString(16).padStart(6, '0');
        btn.onclick = () => changeColor(name, colors[name]);
        colorDiv.appendChild(btn);
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
    if (e.key.toLowerCase() === 't') toggleDarkMode();
    
    let toolMap = {'1': 'push', '2': 'pull', '3': 'smooth', '4': 'pinch', '5': 'inflate'};
    if (toolMap[e.key]) {
        tool = toolMap[e.key]; 
        if (clay) clay.setTool(tool);
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`.tool-btn:nth-child(${Object.keys(toolMap).indexOf(e.key) + 1})`).classList.add('active');
    }
}

function reset() { 
    if (clay) clay.resetClay(); 
}

function showTutorial() {
    alert(`clayable - sculpt with your cursor

controls:
- left click + drag: sculpt clay
- middle/right click + drag: rotate camera
- scroll: zoom in/out
- spacebar: auto-rotate
- r: reset clay
- t: switch light/dark mode
- 1-5: select tools

tools:
- push: add clay
- pull: remove clay  
- smooth: smooth surface
- pinch: pinch clay inward
- inflate: puff out clay

tips:
- larger brush = bigger effect
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
        let rect = renderer.domElement.getBoundingClientRect();
        
        mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
        
        raycaster.setFromCamera(mouse, cam);
        let hits = raycaster.intersectObject(clay.ball);
        
        if (hits.length > 0) {
            let pt = hits[0].point;
            clay.moldClay(pt.x, pt.y, pt.z, true);
        }
    }
}

function onTouchMove(e) {
    e.preventDefault();
    if (dragging && e.touches.length === 1) {
        let touch = e.touches[0];
        let rect = renderer.domElement.getBoundingClientRect();
        
        mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
        
        raycaster.setFromCamera(mouse, cam);
        let hits = raycaster.intersectObject(clay.ball);
        if (hits.length > 0) {
            let pt = hits[0].point;
            clay.moldClay(pt.x, pt.y, pt.z, true);
        }
    }
}

function onTouchEnd(e) { e.preventDefault(); dragging = false; }



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
        if (e.button === 0) {
            let rect = renderer.domElement.getBoundingClientRect();
            mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            
            console.log('click at:', e.clientX, e.clientY, 'normalized:', mouse.x, mouse.y);
            
            raycaster.setFromCamera(mouse, cam);
            let hits = raycaster.intersectObject(clay.ball);
            
            if (hits.length > 0) {
                sculpting = true;
                let pt = hits[0].point;
                console.log('hit point:', pt.x, pt.y, pt.z);
                clay.moldClay(pt.x, pt.y, pt.z, false);
            } else {
                console.log('no hit detected');
            }
        }
    });

    renderer.domElement.addEventListener('mousemove', (e) => {
        if (sculpting) {
            let rect = renderer.domElement.getBoundingClientRect();
            mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            
            raycaster.setFromCamera(mouse, cam);
            let hits = raycaster.intersectObject(clay.ball);
            if (hits.length > 0) {
                let pt = hits[0].point;
                clay.moldClay(pt.x, pt.y, pt.z, false);
            }
        }
    });

          renderer.domElement.addEventListener('mouseup', (e) => {
        if (e.button === 0) {
            sculpting = false;
        }
    });

    renderer.domElement.addEventListener('mouseleave', () => {
        sculpting = false;
    });

    renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
}

window.addEventListener('DOMContentLoaded', init);
