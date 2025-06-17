import * as THREE from './three.module.js';
import { ClaySculptor } from './clay.js';

import { OrbitControls } from './OrbitControls.js';

let canvas;
let cam, world, gl;
let orbit;
let mouse = new THREE.Vector2();
let dragging = false;
let lastMouse = new THREE.Vector2();
let timer = new THREE.Clock();

let spin = false;
let spinSpeed = 0.001;
let fog = true;
let shadows = true;
let followMouse = true;

let textureOn = true;
let textureZoom = 0.3;
let textureDepth = 0.1;
let clayColor = 0xe8c291;
const colors = {
    'Classic Clay': 0xe8c291,
    'Blue Clay': 0x4a87b3,
    'Red Clay': 0xc45c5c,
    'Green Clay': 0x6bab79,
    'Purple Clay': 0x9370db,
    'Gray Clay': 0x808080
};
let moldingStrength = 0.02;



let sculptor;


const port = 3001; 





init();

function init() {
    try {
        canvas = document.getElementById('canvas-container');
        if (!canvas) {
            console.error('Canvas container not found!');
            return;
        }

        world = new THREE.Scene();
        world.background = new THREE.Color(0x1a1a1a);
        
        cam = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        cam.position.set(0, 0, 5);
        cam.lookAt(0, 0, 0);
        
        gl = new THREE.WebGLRenderer({ antialias: true });
        gl.setSize(window.innerWidth, window.innerHeight);
        gl.shadowMap.enabled = true;
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
        canvas.appendChild(gl.domElement);
        
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        world.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 10, 5);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        world.add(directionalLight);
        
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
        fillLight.position.set(-5, 0, 5);
        world.add(fillLight);
        
        sculptor = new ClaySculptor(world);
        sculptor.setColor(clayColor);
        
        setupControls();
        setupEventListeners();
        window.addEventListener('keydown', onKeyDown);
        createUI();
        animate();
    } catch (error) {
        console.error('Error initializing:', error);
    }
}

function createUI() {
    const controlsDiv = document.querySelector('.controls');
    if (!controlsDiv) {
        console.error('Controls div not found!');
        return;
    }
    
    const toggle = document.createElement('div');
    toggle.className = 'controls-toggle';
    toggle.textContent = '▼';
    controlsDiv.appendChild(toggle);
    
    toggle.addEventListener('click', () => {
        controlsDiv.classList.toggle('collapsed');
        toggle.textContent = controlsDiv.classList.contains('collapsed') ? '▲' : '▼';
    });

    const moldGroup = document.createElement('div');
    moldGroup.className = 'mold-group';
    
    const resetButton = document.createElement('button');
    resetButton.textContent = 'Reset Clay Ball';
    resetButton.addEventListener('click', resetClay);
    moldGroup.appendChild(resetButton);
    
    controlsDiv.appendChild(moldGroup);
    
    setupColorButtons();
}

function setupColorButtons() {
    const colorButtons = document.querySelectorAll('.color-btn');
    colorButtons.forEach(button => {
        button.addEventListener('click', () => {
            const colorName = button.dataset.color;
            const colorValue = colors[colorName];
            if (colorValue !== undefined) {
                setClayColor(colorName, colorValue);
                
                colorButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
            }
        });
    });
    
    const classicButton = document.querySelector('.color-btn[data-color="Classic Clay"]');
    if (classicButton) {
        classicButton.classList.add('active');
    }
}

function setClayColor(colorName, colorValue) {
    console.log(`Setting clay color to ${colorName} (${colorValue.toString(16)})`);
    clayColor = colorValue;
    if (sculptor && sculptor.clayBall) {
        sculptor.setColor(colorValue);
        console.log('Clay color updated successfully');
    } else {
        console.log('Sculptor or clay ball not ready yet');
    }
    
    const bannerTitle = document.querySelector('.banner h1');
    if (bannerTitle) {
        bannerTitle.style.color = `#${colorValue.toString(16).padStart(6, '0')}`;
    }
}

function onKeyDown(event) {
    switch(event.key.toLowerCase()) {
        case 'r':
            resetClay();
            break;

    }
}

function resetClay() {
    if (sculptor) {
        sculptor.resetClay();
    }
}

function onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    cam.aspect = width / height;
    cam.updateProjectionMatrix();
    gl.setSize(width, height);
}

function onMouseMove(event) {
    const rect = gl.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    if (dragging) {
        moldClay();
    }
}

function onMouseDown(event) {
    dragging = true;
    lastMouse.copy(mouse);
    
    if (event.button === 0) {
        moldClay();
    }
}

function onMouseUp(event) {
    dragging = false;
}

function onTouchStart(event) {
    event.preventDefault();
    
    if (event.touches.length === 2) {
        pinching = true;
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        
        touchX = (touch1.clientX + touch2.clientX) / 2;
        touchY = (touch1.clientY + touch2.clientY) / 2;
        
        touchDist = Math.hypot(
            touch2.clientX - touch1.clientX,
            touch2.clientY - touch1.clientY
        );
        
        touchAngle = Math.atan2(
            touch2.clientY - touch1.clientY,
            touch2.clientX - touch1.clientX
        );
    } else if (event.touches.length === 1) {
        dragging = true;
        const touch = event.touches[0];
        const rect = canvas.getBoundingClientRect();
        mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
        lastMouse.copy(mouse);
        
        moldClay();
    }
}

function onTouchMove(event) {
    event.preventDefault();
    
    if (pinching && event.touches.length === 2) {
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        
        const currentDistance = Math.hypot(
            touch2.clientX - touch1.clientX,
            touch2.clientY - touch1.clientY
        );
        
        const currentAngle = Math.atan2(
            touch2.clientY - touch1.clientY,
            touch2.clientX - touch1.clientX
        );
        
        const scale = currentDistance / touchDist;
        const rotation = currentAngle - touchAngle;
        
        cam.position.multiplyScalar(scale);
        cam.rotation.y += rotation;
        
        touchDist = currentDistance;
        touchAngle = currentAngle;
    } else if (dragging && event.touches.length === 1) {
        const touch = event.touches[0];
        const rect = canvas.getBoundingClientRect();
        mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
        
        moldClay();
    }
}

function onTouchEnd(event) {
    event.preventDefault();
    
    if (event.touches.length < 2) {
        pinching = false;
    }
    
    if (event.touches.length === 0) {
        dragging = false;
    }
}

function moldClay() {
    if (!sculptor || !sculptor.clayBall) return;
    
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cam);
    
    const intersects = raycaster.intersectObject(sculptor.clayBall);
    
    if (intersects.length > 0) {
        const point = intersects[0].point;
        const moldSize = 0.3;
        const moldDepth = moldingStrength;
        
        sculptor.moldClay(point.x, point.y, point.z, moldSize, moldDepth);
    }
}

function animate() {
    requestAnimationFrame(animate);
    
    const delta = timer.getDelta();
    
    if (orbit) {
        orbit.update();
    }
    
    gl.render(world, cam);
}

function setupPanelToggle() {
    const toggle = document.getElementById('panel-toggle');
    const uiContainer = document.getElementById('ui-container');
    
    if (toggle && uiContainer) {
        toggle.addEventListener('click', () => {
            uiContainer.classList.toggle('hidden');
            toggle.textContent = uiContainer.classList.contains('hidden') ? '☰' : '✕';
        });
    }
}

function startDrawing() {
    if (drawing) return;
    
    drawing = true;
    orbitEnabled = false;
    
    camPos = cam.position.clone();
    camRot = cam.quaternion.clone();
    
    points = [];
    lines = [];
    
    const material = new THREE.LineBasicMaterial({ color: 0xffffff });
    const geometry = new THREE.BufferGeometry();
    currentLine = new THREE.Line(geometry, material);
    world.add(currentLine);
}

function updateDrawing(position) {
    if (!drawing) return;
    
    points.push(position.clone());
    
    if (currentLine) {
        const positions = new Float32Array(points.length * 3);
        points.forEach((point, i) => {
            positions[i * 3] = point.x;
            positions[i * 3 + 1] = point.y;
            positions[i * 3 + 2] = point.z;
        });
        
        currentLine.geometry.setAttribute(
            'position',
            new THREE.BufferAttribute(positions, 3)
        );
        currentLine.geometry.attributes.position.needsUpdate = true;
    }
}

function endDrawing() {
    if (!drawing) return;
    
    drawing = false;
    orbitEnabled = true;
    
    if (currentLine) {
        world.remove(currentLine);
        currentLine = null;
    }
    
    if (points.length > 1) {
        const curve = new THREE.CatmullRomCurve3(points);
        addParticlesAlongTube(curve, thickness);
    }
    
    points = [];
    lines = [];
}



function createEnvironmentMap() {
    const envMap = new THREE.CubeTextureLoader().load([
        'px.jpg', 'nx.jpg',
        'py.jpg', 'ny.jpg',
        'pz.jpg', 'nz.jpg'
    ]);
    return envMap;
}

function onDoubleClick(event) {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cam);
    
    const intersects = raycaster.intersectObjects(world.children);
    
    if (intersects.length > 0) {
        const point = intersects[0].point;
        startDrawing();
        updateDrawing(point);
    }
}



function createNoiseTexture() {
    const size = 256;
    const data = new Uint8Array(size * size * 4);
    
    for (let i = 0; i < size * size; i++) {
        const value = Math.random() * 255;
        data[i * 4] = value;
        data[i * 4 + 1] = value;
        data[i * 4 + 2] = value;
        data[i * 4 + 3] = 255;
    }
    
    const texture = new THREE.DataTexture(
        data,
        size,
        size,
        THREE.RGBAFormat
    );
    texture.needsUpdate = true;
    
    return texture;
}

function createNormalMapFromTexture(texture) {
    const size = texture.image.width;
    const data = new Uint8Array(size * size * 4);
    
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const i = (y * size + x) * 4;
            
            const x1 = (x - 1 + size) % size;
            const x2 = (x + 1) % size;
            const y1 = (y - 1 + size) % size;
            const y2 = (y + 1) % size;
            
            const h1 = texture.image.data[(y1 * size + x) * 4] / 255;
            const h2 = texture.image.data[(y2 * size + x) * 4] / 255;
            const h3 = texture.image.data[(y * size + x1) * 4] / 255;
            const h4 = texture.image.data[(y * size + x2) * 4] / 255;
            
            const dx = (h4 - h3) * 0.5;
            const dy = (h2 - h1) * 0.5;
            
            const normal = new THREE.Vector3(-dx, -dy, 1).normalize();
            
            data[i] = (normal.x * 0.5 + 0.5) * 255;
            data[i + 1] = (normal.y * 0.5 + 0.5) * 255;
            data[i + 2] = (normal.z * 0.5 + 0.5) * 255;
            data[i + 3] = 255;
        }
    }
    
    const normalMap = new THREE.DataTexture(
        data,
        size,
        size,
        THREE.RGBAFormat
    );
    normalMap.needsUpdate = true;
    
    return normalMap;
}







function setupDynamicLighting() {
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.2);
    rimLight.position.set(0, -1, -1).normalize();
    world.add(rimLight);
    
    lights.push(rimLight);
}











function setupControls() {
    orbit = new OrbitControls(cam, gl.domElement);
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.05;
    orbit.screenSpacePanning = false;
    orbit.minDistance = 1;
    orbit.maxDistance = 50;
    orbit.maxPolarAngle = Math.PI / 2;
}

function setupEventListeners() {
    window.addEventListener('resize', onWindowResize);
    gl.domElement.addEventListener('mousemove', onMouseMove);
    gl.domElement.addEventListener('mousedown', onMouseDown);
    gl.domElement.addEventListener('mouseup', onMouseUp);
    gl.domElement.addEventListener('touchstart', onTouchStart, { passive: false });
    gl.domElement.addEventListener('touchmove', onTouchMove, { passive: false });
    gl.domElement.addEventListener('touchend', onTouchEnd);
    gl.domElement.addEventListener('dblclick', onDoubleClick);
}