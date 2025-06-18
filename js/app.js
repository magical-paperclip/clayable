import * as THREE from './three.module.js';
import { ClaySculptor } from './clay.js';
import { OrbitControls } from './OrbitControls.js';

let canvas, cam, scene, renderer, controls;
let mousePos = new THREE.Vector2();
let dragging = false, lastMouse = new THREE.Vector2();
let clock = new THREE.Clock();

let spin = false, spinSpd = 0.001;
let fog = true, shadows = true, follow = true;
let useTex = true, texScale = 0.3, texStr = 0.1;
let clayColor = 0xe8c291;
let colors = {
    'Classic Clay': 0xe8c291,
    'Blue Clay': 0x4a87b3,
    'Red Clay': 0xc45c5c,
    'Green Clay': 0x6bab79,
    'Purple Clay': 0x9370db,
    'Gray Clay': 0x808080
};
let moldStr = 0.02, touchStr = 0.035;
let tool = 'push';
let size = 0.3;

let clay;
let port = 3001; 

init();

function init() {
    try {
        canvas = document.getElementById('canvas-container');
        if (!canvas) return;

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a1a1a);
        
        cam = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        cam.position.set(0, 0, 5);
        cam.lookAt(0, 0, 0);
        
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        canvas.appendChild(renderer.domElement);
        
        let light1 = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(light1);
        
        let light2 = new THREE.DirectionalLight(0xffffff, 0.8);
        light2.position.set(10, 10, 5);
        light2.castShadow = true;
        light2.shadow.mapSize.width = 2048;
        light2.shadow.mapSize.height = 2048;
        scene.add(light2);
        
        let light3 = new THREE.DirectionalLight(0xffffff, 0.3);
        light3.position.set(-5, 0, 5);
        scene.add(light3);
        
        clay = new ClaySculptor(scene);
        clay.setColor(clayColor);
        
        setupControls();
        setupEvents();
        window.onkeydown = onKey;
        makeUI();
        animate();
    } catch (e) {
        console.log('init failed');
    }
}

function makeUI() {
    let ctrl = document.querySelector('.controls');
    if (!ctrl) return;
    
    let toggle = document.createElement('div');
    toggle.className = 'controls-toggle';
    toggle.textContent = '▼';
    ctrl.appendChild(toggle);
    
    toggle.onclick = () => {
        ctrl.classList.toggle('collapsed');
        toggle.textContent = ctrl.classList.contains('collapsed') ? '▲' : '▼';
    };

    let resetBtn = document.createElement('button');
    resetBtn.textContent = 'reset clay';
    resetBtn.onclick = () => {
        resetBtn.style.transform = 'scale(0.95)';
        setTimeout(() => resetBtn.style.transform = '', 100);
        reset();
    };
    
    let toolRow = document.createElement('div');
    toolRow.className = 'control-row';
    
    let toolGrp = document.createElement('div');
    toolGrp.className = 'tool-group';
    
    let tools = ['push', 'pull', 'smooth', 'pinch', 'inflate'];
    tools.forEach(t => {
        let btn = document.createElement('button');
        btn.textContent = t;
        btn.className = 'tool-btn';
        btn.dataset.tool = t;
        if (t === tool) btn.classList.add('active');
        
        btn.onclick = () => {
            tool = t;
            clay.setTool(t);
            
            document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            btn.style.transform = 'scale(0.95)';
            setTimeout(() => btn.style.transform = '', 100);
        };
        
        toolGrp.appendChild(btn);
    });
    
    let sizeBox = document.createElement('div');
    sizeBox.className = 'size-group';
    
    let sizeLbl = document.createElement('span');
    sizeLbl.textContent = 'size';
    sizeLbl.className = 'size-label';
    
    let slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0.1';
    slider.max = '0.8';
    slider.step = '0.05';
    slider.value = size;
    slider.className = 'size-slider';
    
    slider.oninput = (e) => {
        size = parseFloat(e.target.value);
        clay.setBrushSize(size);
    };
    
    sizeBox.appendChild(sizeLbl);
    sizeBox.appendChild(slider);
    
    toolRow.appendChild(toolGrp);
    toolRow.appendChild(sizeBox);
    
    let bottomRow = document.createElement('div');
    bottomRow.className = 'control-row';
    
    let moldGrp = document.createElement('div');
    moldGrp.className = 'mold-group';
    moldGrp.appendChild(resetBtn);
    
    bottomRow.appendChild(moldGrp);
    
    ctrl.appendChild(toolRow);
    ctrl.appendChild(bottomRow);
    
    setupColors();
    setupTutorial();
}

function setupTutorial() {
    let tutBtn = document.getElementById('tutorial-btn');
    if (tutBtn) {
        tutBtn.onclick = () => {
            tutBtn.style.transform = 'scale(0.95)';
            setTimeout(() => tutBtn.style.transform = '', 100);
            showTutorial();
        };
    }
}

function setupColors() {
    let btns = document.querySelectorAll('.color-btn');
    btns.forEach(btn => {
        btn.onclick = () => {
            let name = btn.dataset.color;
            let val = colors[name];
            if (!val) return;
            
            btn.style.transform = 'scale(0.9)';
            setTimeout(() => btn.style.transform = '', 150);
            
            changeColor(name, val);
            
            btns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        };
        
        btn.onmouseenter = () => {
            if (!btn.classList.contains('active')) {
                btn.style.transform = 'scale(1.05)';
            }
        };
        btn.onmouseleave = () => {
            if (!btn.classList.contains('active')) {
                btn.style.transform = '';
            }
        };
    });
    
    let def = document.querySelector('.color-btn[data-color="Classic Clay"]');
    if (def) def.classList.add('active');
}

function changeColor(name, val) {
    clayColor = val;
    if (clay && clay.ball) clay.setColor(val);
    
    let title = document.querySelector('.banner h1');
    if (title) {
        title.style.color = '#' + val.toString(16);
        title.style.transform = 'scale(1.02)';
        setTimeout(() => title.style.transform = '', 200);
    }
}

function onKey(e) {
    if (e.key.toLowerCase() === 'r') reset();
    if (e.key === ' ') {
        e.preventDefault();
        spin = !spin;
    }
    
    let toolKeys = {'1': 'push', '2': 'pull', '3': 'smooth', '4': 'pinch', '5': 'inflate'};
    if (toolKeys[e.key]) {
        tool = toolKeys[e.key];
        clay.setTool(tool);
        
        let btns = document.querySelectorAll('.tool-btn');
        btns.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tool === tool) {
                btn.classList.add('active');
            }
        });
    }
    
    if (e.key === '[') {
        size = Math.max(0.1, size - 0.05);
        clay.setBrushSize(size);
        let s = document.querySelector('.size-slider');
        if (s) s.value = size;
    }
    if (e.key === ']') {
        size = Math.min(0.8, size + 0.05);
        clay.setBrushSize(size);
        let s = document.querySelector('.size-slider');
        if (s) s.value = size;
    }
}

function reset() {
    if (clay) clay.resetClay();
}

function showTutorial() {
    alert(`🎨 clayable tutorial

basic controls:
• drag your mouse or finger to sculpt
• use mouse wheel or two fingers to zoom
• right-click and drag to rotate view

tools (keys 1-5):
• push (1) - push clay inward
• pull (2) - pull clay outward  
• smooth (3) - smooth rough areas
• pinch (4) - create sharp details
• inflate (5) - expand clay volume

size controls:
• [ ] keys to change brush size
• or use the size slider

color selection:
• click color buttons to change clay color
• title color changes to match your selection

other keys:
• r - reset clay to original sphere
• space - auto-rotate clay ball

tips:
• start with large brush for basic shapes
• use smaller brush for fine details
• smooth tool helps blend areas together
• try different colors to see your work better!`);
}

function showHelp() {
    alert(`
Clay thing:
- drag to sculpt
- 1-5 for tools  
- R to reset
- [ ] for size
- mouse does stuff
    `);
}

function resize() {
    if (cam && renderer) {
        cam.aspect = window.innerWidth / window.innerHeight;
        cam.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

function onMouseMove(e) {
    mousePos.x = (e.clientX / window.innerWidth) * 2 - 1;
    mousePos.y = -(e.clientY / window.innerHeight) * 2 + 1;
    
    if (dragging) sculpt();
}

function onMouseDown(e) {
    dragging = true;
    lastMouse.set(e.clientX, e.clientY);
    sculpt();
}

function onMouseUp(e) {
    dragging = false;
    if (controls) controls.enabled = true;
}

function onTouchStart(e) {
    e.preventDefault();
    if (e.touches.length === 1) {
        let touch = e.touches[0];
        mousePos.x = (touch.clientX / window.innerWidth) * 2 - 1;
        mousePos.y = -(touch.clientY / window.innerHeight) * 2 + 1;
        
        dragging = true;
        lastMouse.set(touch.clientX, touch.clientY);
        
        if (controls) controls.enabled = false;
        sculpt(true);
    } else if (e.touches.length === 2) {
        if (controls) controls.enabled = true;
        dragging = false;
    }
}

function onTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 1 && dragging) {
        let touch = e.touches[0];
        mousePos.x = (touch.clientX / window.innerWidth) * 2 - 1;
        mousePos.y = -(touch.clientY / window.innerHeight) * 2 + 1;
        
        let dx = touch.clientX - lastMouse.x;
        let dy = touch.clientY - lastMouse.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > 5) {
            sculpt(true);
            lastMouse.set(touch.clientX, touch.clientY);
        }
    }
}

function onTouchEnd(e) {
    e.preventDefault();
    dragging = false;
    if (controls) controls.enabled = true;
}

function sculpt(touch = false) {
    if (!clay || !clay.ball) return;
    
    let ray = new THREE.Raycaster();
    ray.setFromCamera(mousePos, cam);
    
    let hits = ray.intersectObject(clay.ball);
    if (hits.length > 0) {
        let pt = hits[0].point;
        
        if (controls) controls.enabled = false;
        
        let str = touch ? touchStr : moldStr;
        clay.setStrength(str);
        clay.moldClay(pt.x, pt.y, pt.z, touch);
    }
}

function animate() {
    requestAnimationFrame(animate);
    
    if (controls) controls.update();
    
    if (spin && clay && clay.ball) {
        clay.ball.rotation.y += spinSpd;
    }
    
    renderer.render(scene, cam);
}

function setupControls() {
    if (!canvas) return;
    
    controls = new OrbitControls(cam, canvas.querySelector('canvas'));
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.enableZoom = true;
    controls.enablePan = false;
}

function setupEvents() {
    window.addEventListener('resize', resize);
    
    let canvasEl = canvas.querySelector('canvas');
    if (canvasEl) {
        canvasEl.addEventListener('mousemove', onMouseMove);
        canvasEl.addEventListener('mousedown', onMouseDown);
        canvasEl.addEventListener('mouseup', onMouseUp);
        canvasEl.addEventListener('touchstart', onTouchStart, { passive: false });
        canvasEl.addEventListener('touchmove', onTouchMove, { passive: false });
        canvasEl.addEventListener('touchend', onTouchEnd, { passive: false });
    }
}