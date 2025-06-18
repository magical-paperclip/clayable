import * as THREE from './three.module.js';
import { ClaySculptor } from './clay.js';
import { OrbitControls } from './OrbitControls.js';

let canvas, camera, scene, renderer, controls;
let mousePos = new THREE.Vector2();
let isDragging = false, lastMousePos = new THREE.Vector2();
let clock = new THREE.Clock();

let shouldSpin = false, spinSpeed = 0.001;
let fog = true, shadows = true, mouseFollow = true;
let useTex = true, texScale = 0.3, texStr = 0.1;
let clayColor = 0xe8c291;
let clayColors = {
    'Classic Clay': 0xe8c291,
    'Blue Clay': 0x4a87b3,
    'Red Clay': 0xc45c5c,
    'Green Clay': 0x6bab79,
    'Purple Clay': 0x9370db,
    'Gray Clay': 0x808080
};
let moldStr = 0.02, touchStr = 0.035;
let currentTool = 'push';
let brushSize = 0.3;

let clayMaker;
let port = 3001; 

init();

function init() {
    try {
        canvas = document.getElementById('canvas-container');
        if (!canvas) return;

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a1a1a);
        
        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 0, 5);
        camera.lookAt(0, 0, 0);
        
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        canvas.appendChild(renderer.domElement);
        
        let ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);
        
        let directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 10, 5);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        scene.add(directionalLight);
        
        let fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
        fillLight.position.set(-5, 0, 5);
        scene.add(fillLight);
        
        clayMaker = new ClaySculptor(scene);
        clayMaker.setColor(clayColor);
        
        setupControls();
        setupEventListeners();
        window.onkeydown = keyPress;
        createUI();
        animate();
    } catch (e) {
        // ignore
    }
}

function createUI() {
    let controls = document.querySelector('.controls');
    if (!controls) return;
    
    let toggle = document.createElement('div');
    toggle.className = 'controls-toggle';
    toggle.textContent = '▼';
    controls.appendChild(toggle);
    
    toggle.onclick = () => {
        controls.classList.toggle('collapsed');
        toggle.textContent = controls.classList.contains('collapsed') ? '▲' : '▼';
    };

    let group = document.createElement('div');
    group.className = 'mold-group';
    
    let btn = document.createElement('button');
    btn.textContent = 'reset clay';
    btn.onclick = () => {
        btn.style.transform = 'scale(0.95)';
        setTimeout(() => btn.style.transform = '', 100);
        resetClay();
    };
    group.appendChild(btn);
    
    let topRow = document.createElement('div');
    topRow.className = 'control-row';
    
    let toolGroup = document.createElement('div');
    toolGroup.className = 'tool-group';
    
    let tools = ['push', 'pull', 'smooth', 'pinch', 'inflate'];
    for(let i = 0; i < tools.length; i++) {
        let tool = tools[i];
        let btn = document.createElement('button');
        btn.textContent = tool;
        btn.className = 'tool-btn';
        btn.dataset.tool = tool;
        if (tool === currentTool) btn.classList.add('active');
        
        btn.onclick = () => {
            currentTool = tool;
            clayMaker.setTool(tool);
            
            let allBtns = document.querySelectorAll('.tool-btn');
            for(let j = 0; j < allBtns.length; j++) {
                allBtns[j].classList.remove('active');
            }
            btn.classList.add('active');
            
            btn.style.transform = 'scale(0.95)';
            setTimeout(() => btn.style.transform = '', 100);
        };
        
        toolGroup.appendChild(btn);
    }
    
    topRow.appendChild(toolGroup);
    
    let sizeGroup = document.createElement('div');
    sizeGroup.className = 'size-group';
    
    let sizeLabel = document.createElement('span');
    sizeLabel.textContent = 'size';
    sizeLabel.className = 'size-label';
    
    let sizeSlider = document.createElement('input');
    sizeSlider.type = 'range';
    sizeSlider.min = '0.1';
    sizeSlider.max = '0.8';
    sizeSlider.step = '0.05';
    sizeSlider.value = brushSize;
    sizeSlider.className = 'size-slider';
    
    sizeSlider.oninput = (e) => {
        brushSize = parseFloat(e.target.value);
        clayMaker.setBrushSize(brushSize);
    };
    
    sizeGroup.appendChild(sizeLabel);
    sizeGroup.appendChild(sizeSlider);
    topRow.appendChild(sizeGroup);
    
    controls.appendChild(topRow);
    
    let bottomRow = document.createElement('div');
    bottomRow.className = 'control-row';
    bottomRow.appendChild(group);
    controls.appendChild(bottomRow);
    
    setupColorButtons();
}

function setupColorButtons() {
    let btns = document.querySelectorAll('.color-btn');
    for(let i = 0; i < btns.length; i++) {
        let btn = btns[i];
        btn.onclick = () => {
            let name = btn.dataset.color;
            let val = clayColors[name];
            if (val !== undefined) {
                btn.style.transform = 'scale(0.9)';
                setTimeout(() => btn.style.transform = '', 150);
                
                setClayColor(name, val);
                
                for(let j = 0; j < btns.length; j++) {
                    btns[j].classList.remove('active');
                }
                btn.classList.add('active');
            }
        };
        
        btn.onmouseenter = () => {
            if (!btn.classList.contains('active')) btn.style.transform = 'scale(1.05)';
        };
        btn.onmouseleave = () => {
            if (!btn.classList.contains('active')) btn.style.transform = '';
        };
    }
    
    let def = document.querySelector('.color-btn[data-color="Classic Clay"]');
    if (def) def.classList.add('active');
}

function setClayColor(name, val) {
    clayColor = val;
    if (clayMaker && clayMaker.ball) clayMaker.setColor(val);
    
    let banner = document.querySelector('.banner h1');
    if (banner) {
        banner.style.color = '#' + val.toString(16);
        banner.style.transform = 'scale(1.02)';
        setTimeout(() => banner.style.transform = '', 200);
    }
}

function keyPress(e) {
    if(e.key.toLowerCase() === 'r') resetClay();
    
    let toolKeys = {'1': 'push', '2': 'pull', '3': 'smooth', '4': 'pinch', '5': 'inflate'};
    if (toolKeys[e.key]) {
        currentTool = toolKeys[e.key];
        clayMaker.setTool(currentTool);
        
        let toolBtns = document.querySelectorAll('.tool-btn');
        for(let i = 0; i < toolBtns.length; i++) {
            toolBtns[i].classList.remove('active');
            if (toolBtns[i].dataset.tool === currentTool) {
                toolBtns[i].classList.add('active');
            }
        }
    }
    
    if (e.key === '[') {
        brushSize = Math.max(0.1, brushSize - 0.05);
        clayMaker.setBrushSize(brushSize);
        let slider = document.querySelector('.size-slider');
        if (slider) slider.value = brushSize;
    }
    if (e.key === ']') {
        brushSize = Math.min(0.8, brushSize + 0.05);
        clayMaker.setBrushSize(brushSize);
        let slider = document.querySelector('.size-slider');
        if (slider) slider.value = brushSize;
    }
}

function resetClay() {
    if (clayMaker) clayMaker.resetClay();
}

function showHelp() {
    alert(`
Clay Sculptor Controls:
- Click and drag to sculpt
- [1-5] Change tools
- [R] Reset clay
- [ ] Decrease brush size
- [ ] Increase brush size
- Mouse: Sculpt the clay
    `);
}

function resize() {
    if (camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

function mouseMove(e) {
    mousePos.x = (e.clientX / window.innerWidth) * 2 - 1;
    mousePos.y = -(e.clientY / window.innerHeight) * 2 + 1;
    
    if (isDragging) {
        moldClay();
    }
}

function mouseDown(e) {
    isDragging = true;
    lastMousePos.set(e.clientX, e.clientY);
    moldClay();
}

function mouseUp(e) {
    isDragging = false;
    if (controls) controls.enabled = true;
}

function touchStart(e) {
    e.preventDefault();
    if (e.touches.length === 1) {
        let touch = e.touches[0];
        mousePos.x = (touch.clientX / window.innerWidth) * 2 - 1;
        mousePos.y = -(touch.clientY / window.innerHeight) * 2 + 1;
        
        isDragging = true;
        lastMousePos.set(touch.clientX, touch.clientY);
        
        if (controls) controls.enabled = false;
        
        moldClay(true);
    } else if (e.touches.length === 2) {
        if (controls) controls.enabled = true;
        isDragging = false;
    }
}

function touchMove(e) {
    e.preventDefault();
    if (e.touches.length === 1 && isDragging) {
        let touch = e.touches[0];
        mousePos.x = (touch.clientX / window.innerWidth) * 2 - 1;
        mousePos.y = -(touch.clientY / window.innerHeight) * 2 + 1;
        
        let deltaX = touch.clientX - lastMousePos.x;
        let deltaY = touch.clientY - lastMousePos.y;
        let delta = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        if (delta > 5) {
            moldClay(true);
            lastMousePos.set(touch.clientX, touch.clientY);
        }
    }
}

function touchEnd(e) {
    e.preventDefault();
    isDragging = false;
    if (controls) controls.enabled = true;
}

function moldClay(isTouch = false) {
    if (!clayMaker || !clayMaker.ball) return;
    
    let raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mousePos, camera);
    
    let intersects = raycaster.intersectObject(clayMaker.ball);
    if (intersects.length > 0) {
        let point = intersects[0].point;
        
        if (controls) controls.enabled = false;
        
        let str = isTouch ? touchStr : moldStr;
        clayMaker.setStrength(str);
        clayMaker.moldClay(point.x, point.y, point.z, isTouch);
    }
}

function animate() {
    requestAnimationFrame(animate);
    
    if (controls) controls.update();
    
    if (shouldSpin && clayMaker && clayMaker.ball) {
        clayMaker.ball.rotation.y += spinSpeed;
    }
    
    renderer.render(scene, camera);
}

function setupControls() {
    if (!canvas) return;
    
    controls = new OrbitControls(camera, canvas.querySelector('canvas'));
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.enableZoom = true;
    controls.enablePan = false;
}

function setupEventListeners() {
    window.addEventListener('resize', resize);
    
    let canvasEl = canvas.querySelector('canvas');
    if (canvasEl) {
        canvasEl.addEventListener('mousemove', mouseMove);
        canvasEl.addEventListener('mousedown', mouseDown);
        canvasEl.addEventListener('mouseup', mouseUp);
        canvasEl.addEventListener('touchstart', touchStart, { passive: false });
        canvasEl.addEventListener('touchmove', touchMove, { passive: false });
        canvasEl.addEventListener('touchend', touchEnd, { passive: false });
    }
}