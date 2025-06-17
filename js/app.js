import * as THREE from './three.module.js';
import { ClaySculptor } from './clay.js';

import { OrbitControls } from './OrbitControls.js';

let canvas;
let camera, scene, renderer;
let controls;
let mousePos = new THREE.Vector2();
let isDragging = false;
let lastMousePos = new THREE.Vector2();
let clock = new THREE.Clock();

let shouldSpin = false;
let spinningSpeed = 0.001;
let fogEnabled = true;
let shadowsEnabled = true;
let mouseFollow = true;

let useTexture = true;
let texScale = 0.3;
let texStrength = 0.1;
let currentClayColor = 0xe8c291;
let clayColors = {
    'Classic Clay': 0xe8c291,
    'Blue Clay': 0x4a87b3,
    'Red Clay': 0xc45c5c,
    'Green Clay': 0x6bab79,
    'Purple Clay': 0x9370db,
    'Gray Clay': 0x808080
};
let moldPower = 0.02;
let touchMoldPower = 0.035;

let clayMaker;

let serverPort = 3001; 





init();

function init() {
    try {
        canvas = document.getElementById('canvas-container');
        if (!canvas) {
            return;
        }

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
        clayMaker.setColor(currentClayColor);
        
        setupControls();
        setupEventListeners();
        window.addEventListener('keydown', handleKeyPress);
        createUI();
        animate();
    } catch (error) {
        
    }
}

function createUI() {
    const controlsDiv = document.querySelector('.controls');
    if (!controlsDiv) {
        return;
    }
    
    let toggle = document.createElement('div');
    toggle.className = 'controls-toggle';
    toggle.textContent = '▼';
    controlsDiv.appendChild(toggle);
    
    toggle.addEventListener('click', () => {
        controlsDiv.classList.toggle('collapsed');
        toggle.textContent = controlsDiv.classList.contains('collapsed') ? '▲' : '▼';
    });

    let moldGroup = document.createElement('div');
    moldGroup.className = 'mold-group';
    
    let resetBtn = document.createElement('button');
    resetBtn.textContent = 'Reset Clay Ball';
    resetBtn.onclick = resetClay;
    moldGroup.appendChild(resetBtn);
    
    controlsDiv.appendChild(moldGroup);
    
    setupColorButtons();
}

function setupColorButtons() {
    let colorBtns = document.querySelectorAll('.color-btn');
    for(let i = 0; i < colorBtns.length; i++) {
        let btn = colorBtns[i];
        btn.addEventListener('click', () => {
            let colorName = btn.dataset.color;
            let colorVal = clayColors[colorName];
            if (colorVal !== undefined) {
                setClayColor(colorName, colorVal);
                
                colorBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            }
        });
    }
    
    let defaultBtn = document.querySelector('.color-btn[data-color="Classic Clay"]');
    if (defaultBtn) {
        defaultBtn.classList.add('active');
    }
}

function setClayColor(colorName, colorValue) {
    currentClayColor = colorValue;
    if (clayMaker && clayMaker.clayBall) {
        clayMaker.setColor(colorValue);
    }
    
    let banner = document.querySelector('.banner h1');
    if (banner) {
        banner.style.color = '#' + colorValue.toString(16);
    }
}

function handleKeyPress(event) {
    if(event.key.toLowerCase() === 'r') {
        resetClay();
    }
}

function resetClay() {
    if (clayMaker) {
        clayMaker.resetClay();
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function handleMouseMove(event) {
    let rect = renderer.domElement.getBoundingClientRect();
    mousePos.x = (event.clientX - rect.left) / rect.width * 2 - 1;
    mousePos.y = -((event.clientY - rect.top) / rect.height * 2 - 1);
    
    if (isDragging) {
        moldClay();
    }
}

function handleMouseDown(event) {
    isDragging = true;
    lastMousePos.copy(mousePos);
    
    if (event.button === 0) {
        moldClay();
    }
}

function handleMouseUp(event) {
    isDragging = false;
}

let isPinching = false;
let touchX = 0, touchY = 0;
let touchDist = 0, touchAngle = 0;

function onTouchStart(event) {
    event.preventDefault();
    
    if (event.touches.length === 2) {
        isPinching = true;
        let touch1 = event.touches[0];
        let touch2 = event.touches[1];
        
        touchX = (touch1.clientX + touch2.clientX) / 2;
        touchY = (touch1.clientY + touch2.clientY) / 2;
        
        let dx = touch2.clientX - touch1.clientX;
        let dy = touch2.clientY - touch1.clientY;
        touchDist = Math.sqrt(dx * dx + dy * dy);
        
        touchAngle = Math.atan2(dy, dx);
    } else if (event.touches.length === 1) {
        isDragging = true;
        let touch = event.touches[0];
        let rect = renderer.domElement.getBoundingClientRect();
        mousePos.x = (touch.clientX - rect.left) / rect.width * 2 - 1;
        mousePos.y = -((touch.clientY - rect.top) / rect.height * 2 - 1);
        lastMousePos.copy(mousePos);
        
        moldClay(true);
    }
}

function onTouchMove(event) {
    event.preventDefault();
    
    if (isPinching && event.touches.length === 2) {
        let touch1 = event.touches[0];
        let touch2 = event.touches[1];
        
        let dx = touch2.clientX - touch1.clientX;
        let dy = touch2.clientY - touch1.clientY;
        let currentDistance = Math.sqrt(dx * dx + dy * dy);
        
        let currentAngle = Math.atan2(dy, dx);
        
        let scale = currentDistance / touchDist;
        let rotation = currentAngle - touchAngle;
        
        camera.position.multiplyScalar(scale);
        camera.rotation.y += rotation;
        
        touchDist = currentDistance;
        touchAngle = currentAngle;
    } else if (isDragging && event.touches.length === 1) {
        let touch = event.touches[0];
        let rect = renderer.domElement.getBoundingClientRect();
        mousePos.x = (touch.clientX - rect.left) / rect.width * 2 - 1;
        mousePos.y = -((touch.clientY - rect.top) / rect.height * 2 - 1);
        
        moldClay(true);
    }
}

function onTouchEnd(event) {
    event.preventDefault();
    
    if (event.touches.length < 2) {
        isPinching = false;
    }
    
    if (event.touches.length === 0) {
        isDragging = false;
    }
}

function moldClay(isTouch = false) {
    if (!clayMaker || !clayMaker.clayBall) return;
    
    let raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mousePos, camera);
    
    let intersects = raycaster.intersectObject(clayMaker.clayBall);
    
    if (intersects.length > 0) {
        let point = intersects[0].point;
        let size = isTouch ? 0.35 : 0.3;
        let depth = isTouch ? touchMoldPower : moldPower;
        
        clayMaker.moldClay(point.x, point.y, point.z, size, depth);
    }
}

function animate() {
    requestAnimationFrame(animate);
    
    if (controls) controls.update();
    
    renderer.render(scene, camera);
}

function setupControls() {
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 1;
    controls.maxDistance = 50;
    controls.maxPolarAngle = Math.PI / 2;
}

function setupEventListeners() {
    window.addEventListener('resize', onWindowResize);
    renderer.domElement.addEventListener('mousemove', handleMouseMove);
    renderer.domElement.addEventListener('mousedown', handleMouseDown);
    renderer.domElement.addEventListener('mouseup', handleMouseUp);
    renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: false });
    renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: false });
    renderer.domElement.addEventListener('touchend', onTouchEnd);
}