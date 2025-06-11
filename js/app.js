import { ClaySculptor } from './clay.js';
import { ImageUpload } from './components/ImageUpload.js';

let container;
let camera, scene, renderer;
let controls;
let mousePosition = new THREE.Vector2();
let isMouseDown = false;
let lastMousePosition = new THREE.Vector2();
let clock = new THREE.Clock();

// Enhanced 3D settings
let turntable = false;
let rotationSpeed = 0.001;
let fogEnabled = true;
let shadowsEnabled = true;
let cameraFollowsCursor = true;
// Clay texture settings
let clayTextureEnabled = true;
let clayTextureScale = 0.3;  
let clayTextureDepth = 0.1;  // Much lower depth for minimal surface irregularities
let clayColor = 0xe8c291;
const clayColors = {
    'Classic Clay': 0xe8c291,
    'Blue Clay': 0x4a87b3,
    'Red Clay': 0xc45c5c,
    'Green Clay': 0x6bab79,
    'Purple Clay': 0x9370db,
    'Gray Clay': 0x808080
};
let mouseMode = 'add';

let isDrawing = false;
let currentDrawingLine = null;
let drawingPoints = [];
let drawingLines = [];
let lineThickness = 3;
let drawingCurve = null;
let controlsEnabledBeforeDrawing = true; 
let cameraFixedPosition = null;
let cameraFixedQuaternion = null;

const specializedTools = {
    'stamp-sphere': { name: 'Sphere Stamp', size: 15, shape: 'sphere' },
    'stamp-cube': { name: 'Cube Stamp', size: 12, shape: 'cube' },
    'pattern-spiral': { name: 'Spiral Pattern', size: 25, particles: 12 },
    'pattern-ring': { name: 'Ring Pattern', size: 20, particles: 8 },
    'tool-flatten': { name: 'Flatten Tool', size: 18, strength: 0.8 }
};
let activeSpecialTool = null;
let toolSize = 10;

const maxParticles = 500;
let particleCount = 0;
let particles = [];
let clayMesh;

let uiInfo;
// Add raycaster for 3D drawing
let raycaster = new THREE.Raycaster();


let useMetaballs = true;
let metaballMesh = null;
let metaballMaterial = null;
let particleInfluence = 1.3; 
let claySmoothing = 0.85;  

// Create textures once and reuse them
let clayNoiseTexture = null;
let clayNormalMap = null;
let clayRoughnessMap = null;

let claySculptor;
let imageUpload;

const PORT = 3001; // Updated port for local development

init();
animate();

function init() {
    container = document.getElementById('container');
    
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);
    
    
    if (fogEnabled) {
        scene.fog = new THREE.FogExp2(0x222222, 0.0008);
    }
    
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera = new THREE.PerspectiveCamera(45, width / height, 1, 10000);
    camera.position.set(0, 0, 500);
    
    // Improved lighting setup - brighter lights
    const ambientLight = new THREE.AmbientLight(0x808080, 1.0);  // Brighter ambient light
    scene.add(ambientLight);
    
    // Main directional light with shadows - brighter
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(1, 1, 1).normalize();
    directionalLight.castShadow = shadowsEnabled;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 10;
    directionalLight.shadow.camera.far = 1000;
    directionalLight.shadow.camera.left = -300;
    directionalLight.shadow.camera.right = 300;
    directionalLight.shadow.camera.top = 300;
    directionalLight.shadow.camera.bottom = -300;
    directionalLight.shadow.bias = -0.001;
    scene.add(directionalLight);
    
    // Bottom light for fill - brighter
    const bottomLight = new THREE.DirectionalLight(0xffc0cb, 0.5);
    bottomLight.position.set(0, -1, 0).normalize();
    scene.add(bottomLight);
    
    // Add rim light for 3D effect - brighter
    const rimLight = new THREE.DirectionalLight(0x6aabff, 0.7);
    rimLight.position.set(-1, 0, -1).normalize();
    scene.add(rimLight);
    
    // Add frontal light to better illuminate the clay
    const frontLight = new THREE.DirectionalLight(0xffffff, 0.8);
    frontLight.position.set(0, 0, 1).normalize();
    scene.add(frontLight);
    
    // Add point light for local highlights - brighter
    const pointLight = new THREE.PointLight(0xffffff, 0.7, 300);
    pointLight.position.set(50, 50, 50);
    pointLight.castShadow = shadowsEnabled;
    scene.add(pointLight);
    
    // Create the clay textures once during initialization
    if (clayTextureEnabled) {
        clayNoiseTexture = createNoiseTexture();
        
        // Create normal map from the noise texture
        clayNormalMap = createNormalMapFromTexture(clayNoiseTexture);
        
        // Use the noise texture as a roughness map too
        clayRoughnessMap = clayNoiseTexture.clone();
    }
    
    createClayParticles();
    
    // Improved renderer with shadows
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        powerPreference: "high-performance"
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = shadowsEnabled;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.physicallyCorrectLights = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;  // Increased exposure
    container.appendChild(renderer.domElement);
    
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = 0.5;
    
    // Add a ground plane for shadows to fall on
    if (shadowsEnabled) {
        const groundGeometry = new THREE.PlaneGeometry(1000, 1000);
        const groundMaterial = new THREE.ShadowMaterial({ opacity: 0.3 });
        const groundPlane = new THREE.Mesh(groundGeometry, groundMaterial);
        groundPlane.rotation.x = -Math.PI / 2;
        groundPlane.position.y = -100;
        groundPlane.receiveShadow = true;
        scene.add(groundPlane);
    }
    
    createUI();
    
    window.addEventListener('resize', onWindowResize);
    
    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('mousedown', onMouseDown);
    container.addEventListener('mouseup', onMouseUp);
    container.addEventListener('dblclick', onDoubleClick); // Add double-click handler
    
    container.addEventListener('touchmove', onTouchMove);
    container.addEventListener('touchstart', () => { 
        isMouseDown = true;
        if (mouseMode === 'draw') startDrawing();
    });
    container.addEventListener('touchend', () => { 
        isMouseDown = false;
        if (mouseMode === 'draw') endDrawing();
    });
    
    window.addEventListener('keydown', onKeyDown);
    
    // Create environment map for reflections
    createEnvironmentMap();

    // Initialize the clay sculptor
    claySculptor = new ClaySculptor();

    // Setup image upload
    const controlsContainer = document.querySelector('.controls');
    imageUpload = new ImageUpload(controlsContainer);

    // Listen for image upload events
    document.addEventListener('imageUploaded', (e) => {
        const file = e.detail.file;
        if (file) {
            claySculptor.processImage(file);
        }
    });

    // Add keyboard shortcut for image upload
    document.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 'i') {
            document.getElementById('image-upload').click();
        }
    });
}

function createUI() {
    uiInfo = document.getElementById('ui-container');
    
    const toolsLabel = document.createElement('div');
    toolsLabel.className = 'tools-label';
    toolsLabel.textContent = 'Basic Tools';
    uiInfo.appendChild(toolsLabel);
    
    const toolsDiv = document.createElement('div');
    toolsDiv.className = 'tools';
    
    const addButton = document.createElement('button');
    addButton.textContent = 'Add Clay (A)';
    addButton.className = 'active';
    addButton.onclick = () => {
        setMouseMode('add');
        setSpecialTool(null);
    };
    
    const removeButton = document.createElement('button');
    removeButton.textContent = 'Remove Clay (S)';
    removeButton.onclick = () => {
        setMouseMode('remove');
        setSpecialTool(null);
    };
    
    const smoothButton = document.createElement('button');
    smoothButton.textContent = 'Smooth Clay (D)';
    smoothButton.onclick = () => {
        setMouseMode('smooth');
        setSpecialTool(null);
    };
    
    // Add new draw button
    const drawButton = document.createElement('button');
    drawButton.textContent = 'Draw 3D (F)';
    drawButton.onclick = () => {
        setMouseMode('draw');
        setSpecialTool(null);
    };
    
    const resetButton = document.createElement('button');
    resetButton.textContent = 'Reset Clay (R)';
    resetButton.onclick = resetClay;
    
    toolsDiv.appendChild(addButton);
    toolsDiv.appendChild(removeButton);
    toolsDiv.appendChild(smoothButton);
    toolsDiv.appendChild(drawButton);
    toolsDiv.appendChild(resetButton);
    
    uiInfo.appendChild(toolsDiv);
    
    // Add line thickness control
    const lineThicknessDiv = document.createElement('div');
    lineThicknessDiv.className = 'size-control';
    lineThicknessDiv.style.display = 'none';
    lineThicknessDiv.id = 'line-thickness-control';
    
    const thicknessLabel = document.createElement('label');
    thicknessLabel.textContent = 'Line Thickness';
    thicknessLabel.htmlFor = 'line-thickness';
    
    const thicknessContainer = document.createElement('div');
    thicknessContainer.className = 'slider-container';
    
    const thicknessSlider = document.createElement('input');
    thicknessSlider.type = 'range';
    thicknessSlider.min = '1';
    thicknessSlider.max = '10';
    thicknessSlider.value = lineThickness;
    thicknessSlider.id = 'line-thickness';
    thicknessSlider.oninput = () => {
        lineThickness = parseInt(thicknessSlider.value);
        thicknessValue.textContent = lineThickness;
    };
    
    const thicknessValue = document.createElement('span');
    thicknessValue.textContent = lineThickness;
    thicknessValue.id = 'thickness-value';
    
    thicknessContainer.appendChild(thicknessSlider);
    thicknessContainer.appendChild(thicknessValue);
    
    lineThicknessDiv.appendChild(thicknessLabel);
    lineThicknessDiv.appendChild(thicknessContainer);
    
    uiInfo.appendChild(lineThicknessDiv);
    
    const divider1 = document.createElement('div');
    divider1.className = 'section-divider';
    uiInfo.appendChild(divider1);
    
    const specialToolsDiv = document.createElement('div');
    specialToolsDiv.className = 'special-tools';
    
    const specialToolsLabel = document.createElement('div');
    specialToolsLabel.className = 'tools-label';
    specialToolsLabel.textContent = 'Specialized Tools';
    specialToolsDiv.appendChild(specialToolsLabel);
    
    const specialButtonsDiv = document.createElement('div');
    specialButtonsDiv.className = 'tool-buttons';
    
    Object.entries(specializedTools).forEach(([id, tool]) => {
        const toolButton = document.createElement('button');
        toolButton.textContent = tool.name;
        toolButton.className = 'tool-btn';
        toolButton.onclick = () => setSpecialTool(id);
        specialButtonsDiv.appendChild(toolButton);
    });
    
    specialToolsDiv.appendChild(specialButtonsDiv);
    
    const sizeControlDiv = document.createElement('div');
    sizeControlDiv.className = 'size-control';
    
    const sizeLabel = document.createElement('label');
    sizeLabel.textContent = 'Tool Size';
    sizeLabel.htmlFor = 'tool-size';
    
    const sliderContainer = document.createElement('div');
    sliderContainer.className = 'slider-container';
    
    const sizeSlider = document.createElement('input');
    sizeSlider.type = 'range';
    sizeSlider.min = '5';
    sizeSlider.max = '30';
    sizeSlider.value = toolSize;
    sizeSlider.id = 'tool-size';
    sizeSlider.oninput = () => {
        toolSize = parseInt(sizeSlider.value);
        sizeValue.textContent = toolSize;
    };
    
    const sizeValue = document.createElement('span');
    sizeValue.textContent = toolSize;
    sizeValue.id = 'size-value';
    
    sliderContainer.appendChild(sizeSlider);
    sliderContainer.appendChild(sizeValue);
    
    sizeControlDiv.appendChild(sizeLabel);
    sizeControlDiv.appendChild(sliderContainer);
    
    specialToolsDiv.appendChild(sizeControlDiv);
    uiInfo.appendChild(specialToolsDiv);
    
    const divider2 = document.createElement('div');
    divider2.className = 'section-divider';
    uiInfo.appendChild(divider2);
    
    const colorsDiv = document.createElement('div');
    colorsDiv.className = 'colors';
    
    const colorLabel = document.createElement('div');
    colorLabel.className = 'color-label';
    colorLabel.textContent = 'Clay Color';
    colorsDiv.appendChild(colorLabel);
    
    const colorButtonsDiv = document.createElement('div');
    colorButtonsDiv.className = 'color-buttons';
    
    Object.entries(clayColors).forEach(([name, colorValue]) => {
        const colorButton = document.createElement('button');
        colorButton.className = 'color-btn';
        colorButton.title = name;
        colorButton.style.backgroundColor = '#' + colorValue.toString(16).padStart(6, '0');
        
        if (colorValue === clayColor) {
            colorButton.classList.add('active');
        }
        
        colorButton.onclick = () => setClayColor(name, colorValue);
        colorButtonsDiv.appendChild(colorButton);
    });
    
    colorsDiv.appendChild(colorButtonsDiv);
    uiInfo.appendChild(colorsDiv);
    
    const footer = document.createElement('div');
    footer.className = 'footer';
    footer.textContent = '© 2025 clayable - rotate with mouse, pinch to zoom';
    document.body.appendChild(footer);
    
    setupPanelToggle();
}

function setMouseMode(mode) {
    mouseMode = mode;
    
    const buttons = document.querySelectorAll('.tools button');
    buttons.forEach(button => {
        button.className = button.textContent.toLowerCase().includes(mouseMode) ? 'active' : '';
    });
    
    // Show/hide line thickness control based on draw mode
    const lineThicknessControl = document.getElementById('line-thickness-control');
    if (lineThicknessControl) {
        lineThicknessControl.style.display = mode === 'draw' ? 'block' : 'none';
    }
}

function setSpecialTool(toolId) {
    activeSpecialTool = toolId;
    
    const toolButtons = document.querySelectorAll('.tool-btn');
    toolButtons.forEach(button => {
        button.classList.remove('active');
        if (toolId && button.textContent === specializedTools[toolId].name) {
            button.classList.add('active');
        }
    });
    
    if (toolId) {
        const basicButtons = document.querySelectorAll('.tools button');
        basicButtons.forEach(button => {
            button.classList.remove('active');
        });
    }
}

function onKeyDown(event) {
    switch(event.key.toLowerCase()) {
        case 'a':
            setMouseMode('add');
            break;
        case 's':
            setMouseMode('remove');
            break;
        case 'd':
            setMouseMode('smooth');
            break;
        case 'f':
            setMouseMode('draw');
            break;
        case 'r':
            resetClay();
            break;
    }
}

function createClayParticles() {
    if (clayMesh) {
        scene.remove(clayMesh);
    }
    
    // Create container for individual particles
    clayMesh = new THREE.Group();
    scene.add(clayMesh);
    
    // Create shared material for all clay particles
    const material = new THREE.MeshPhysicalMaterial({
        color: clayColor,
        metalness: 0.1,
        roughness: 0.5,
        clearcoat: 0.4,
        clearcoatRoughness: 0.3,
        reflectivity: 0.2,
        envMapIntensity: 0.4,
    });
    
    // For metaball effect
    if (useMetaballs) {
        // Create metaball material with custom shader
        metaballMaterial = new THREE.ShaderMaterial({
            uniforms: {
                uColor: { value: new THREE.Color(clayColor) },
                uTime: { value: 0 },
                uClaySmoothing: { value: claySmoothing },
                uMetalness: { value: 0.1 },
                uRoughness: { value: 0.5 },
                uClearcoat: { value: 0.4 }
            },
            vertexShader: `
                varying vec3 vPosition;
                varying vec3 vNormal;
                varying vec2 vUv;
                
                void main() {
                    vPosition = position;
                    vNormal = normal;
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 uColor;
                uniform float uTime;
                uniform float uClaySmoothing;
                uniform float uMetalness;
                uniform float uRoughness;
                uniform float uClearcoat;
                
                varying vec3 vPosition;
                varying vec3 vNormal;
                varying vec2 vUv;
                
                void main() {
                    // Base clay color with slight variation for texture
                    vec3 clayColor = uColor * (0.95 + 0.1 * sin(vPosition.x * 10.0 + vPosition.y * 15.0 + vPosition.z * 5.0));
                    
                    // Calculate rim lighting
                    vec3 viewDirection = normalize(-vPosition);
                    float rimFactor = 1.0 - max(0.0, dot(viewDirection, vNormal));
                    rimFactor = pow(rimFactor, 3.0) * 0.5;
                    
                    // Subtle surface variation
                    float variation = 0.08 * sin(vPosition.x * 2.0 + vPosition.y * 3.0 + vPosition.z * 1.5 + uTime);
                    
                    // Simple lighting model
                    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
                    float diffuse = max(0.0, dot(vNormal, lightDir)) * 0.7 + 0.3;
                    
                    // Combine all factors
                    vec3 finalColor = clayColor * diffuse + vec3(1.0, 0.9, 0.8) * rimFactor;
                    finalColor += variation;
                    
                    gl_FragColor = vec4(finalColor, 1.0);
                }
            `,
            transparent: false
        });
    }
    
    particles = [];
    particleCount = 0;
    
    resetClay();
}

function addParticle(x, y, z, size) {
    if (particleCount >= maxParticles) return;
    
    // Use higher quality geometry for better 3D appearance
    const geometry = new THREE.SphereGeometry(size, 16, 14);
    
    // Enhanced material with smooth clay-like appearance
    const material = new THREE.MeshPhysicalMaterial({
        color: clayColor,
        metalness: 0.08,
        roughness: 0.3,      
        clearcoat: 0.7,      
        clearcoatRoughness: 0.2,  
        reflectivity: 0.25,
        envMapIntensity: 0.4,
        flatShading: false,  // No flat shading for smoother look
        emissive: new THREE.Color(clayColor).multiplyScalar(0.05) // Subtle glow
    });
    
    // If texture is enabled, apply it subtly for a shapeable look
    if (clayTextureEnabled && clayNoiseTexture) {
        // Very minimal displacement for subtle texture
        material.displacementMap = clayNoiseTexture;
        material.displacementScale = 0.01 * size;
        
        // Very subtle bump mapping
        material.bumpMap = clayNoiseTexture;
        material.bumpScale = 0.01;
    }
    
    const particle = new THREE.Mesh(geometry, material);
    particle.position.set(x, y, z);
    
    // Make particles larger to create better blending effect
    particle.scale.set(particleInfluence * 1.1, particleInfluence * 1.1, particleInfluence * 1.1);
    
    // Enable shadows for particles
    particle.castShadow = true;
    particle.receiveShadow = true;
    
    particles.push({
        mesh: particle,
        size: size,
        position: new THREE.Vector3(x, y, z),
        originalPosition: new THREE.Vector3(x, y, z),
        phase: Math.random() * Math.PI * 2 // Random starting phase for animation
    });
    
    clayMesh.add(particle);
    particleCount++;
    
    // After adding particles, update nearby particles to create connection effect
    if (useMetaballs && particleCount > 1) {
        createConnectionsNearParticle(particles[particleCount - 1]);
    }
}

function removeParticle(index) {
    if (index < 0 || index >= particleCount) return;
    
    clayMesh.remove(particles[index].mesh);
    
    particles.splice(index, 1);
    particleCount--;
}

function resetClay() {
    // Clear all clay particles
    while (particles.length > 0) {
        removeParticle(0);
    }
    
    // Clear all 3D drawing lines
    for (let i = 0; i < drawingLines.length; i++) {
        scene.remove(drawingLines[i]);
        if (drawingLines[i].geometry) {
            drawingLines[i].geometry.dispose();
        }
        if (drawingLines[i].material) {
            drawingLines[i].material.dispose();
        }
    }
    drawingLines = [];
    
    // Reset any current drawing
    if (currentDrawingLine) {
        scene.remove(currentDrawingLine);
        currentDrawingLine.geometry.dispose();
        currentDrawingLine = null;
    }
    
    // Add new clay particles in default formation
    const numParticles = 50;
    const radius = 20;
    
    for (let i = 0; i < numParticles; i++) {
        const phi = Math.acos(-1 + (2 * i) / numParticles);
        const theta = Math.sqrt(numParticles * Math.PI) * phi;
        
        const x = radius * Math.cos(theta) * Math.sin(phi) + (Math.random() - 0.5) * 5;
        const y = radius * Math.sin(theta) * Math.sin(phi) + (Math.random() - 0.5) * 5;
        const z = radius * Math.cos(phi) + (Math.random() - 0.5) * 5;
        
        const size = 5 + Math.random() * 5;
        
        addParticle(x, y, z, size);
    }
    
    for (let i = 0; i < 20; i++) {
        const r = radius * 0.7;
        const size = 4 + Math.random() * 4;
        const x = (Math.random() - 0.5) * r;
        const y = (Math.random() - 0.5) * r;
        const z = (Math.random() - 0.5) * r;
        
        addParticle(x, y, z, size);
    }
}

function onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    
    renderer.setSize(width, height);
}

function onMouseMove(event) {
    mousePosition.x = (event.clientX / window.innerWidth) * 2 - 1;
    mousePosition.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    if (isMouseDown) {
        interactWithClay();
    }
    
    lastMousePosition.copy(mousePosition);
}

// Add new mousedown and mouseup event handlers for drawing
function onMouseDown(event) {
    isMouseDown = true;
    
    if (mouseMode === 'draw') {
        startDrawing();
    }
}

function onMouseUp(event) {
    isMouseDown = false;
    
    if (mouseMode === 'draw') {
        endDrawing();
    }
}

function onTouchMove(event) {
    event.preventDefault();
    
    mousePosition.x = (event.touches[0].clientX / window.innerWidth) * 2 - 1;
    mousePosition.y = -(event.touches[0].clientY / window.innerHeight) * 2 + 1;
    
    interactWithClay();
    
    lastMousePosition.copy(mousePosition);
}

function interactWithClay() {
    const vector = new THREE.Vector3(mousePosition.x, mousePosition.y, 0.5);
    vector.unproject(camera);
    
    const dir = vector.sub(camera.position).normalize();
    const distance = -camera.position.z / dir.z;
    const pos = camera.position.clone().add(dir.multiplyScalar(distance));
    
    if (mouseMode === 'draw') {
        if (isDrawing) {
            
            if (cameraFixedPosition && cameraFixedQuaternion) {
                camera.position.copy(cameraFixedPosition);
                camera.quaternion.copy(cameraFixedQuaternion);
            }
            updateDrawing(pos);
        }
        return;
    }
    
    if (activeSpecialTool) {
        switch (activeSpecialTool) {
            case 'stamp-sphere':
                applyStampSphere(pos, toolSize);
                break;
            case 'stamp-cube':
                applyStampCube(pos, toolSize);
                break;
            case 'pattern-spiral':
                applyPatternSpiral(pos, toolSize);
                break;
            case 'pattern-ring':
                applyPatternRing(pos, toolSize);
                break;
            case 'tool-flatten':
                applyFlattenTool(pos, toolSize, specializedTools['tool-flatten'].strength);
                break;
        }
        return;
    }
    
    switch (mouseMode) {
        case 'add':
            const size = 5 + Math.random() * 5;
            addParticle(pos.x, pos.y, pos.z, size);
            
            if (lastMousePosition.distanceTo(mousePosition) > 0.01) {
                const steps = 3;
                const deltaX = (mousePosition.x - lastMousePosition.x) / steps;
                const deltaY = (mousePosition.y - lastMousePosition.y) / steps;
                
                for (let i = 1; i < steps; i++) {
                    const x = lastMousePosition.x + deltaX * i;
                    const y = lastMousePosition.y + deltaY * i;
                    
                    const v = new THREE.Vector3(x, y, 0.5);
                    v.unproject(camera);
                    
                    const d = v.sub(camera.position).normalize();
                    const dist = -camera.position.z / d.z;
                    const p = camera.position.clone().add(d.multiplyScalar(dist));
                    
                    const intermediateSize = 3 + Math.random() * 4;
                    addParticle(p.x, p.y, p.z, intermediateSize);
                }
            }
            break;
            
        case 'remove':
            removeNearbyParticles(pos, 15);
            break;
            
        case 'smooth':
            smoothNearbyParticles(pos, 30);
            break;
    }
}

function removeNearbyParticles(position, radius) {
    const tempParticles = [...particles];
    
    for (let i = tempParticles.length - 1; i >= 0; i--) {
        const particle = tempParticles[i];
        const distance = position.distanceTo(particle.position);
        
        if (distance < radius) {
            removeParticle(i);
        }
    }
}

function smoothNearbyParticles(position, radius) {
    const nearbyParticles = [];
    
    for (let i = 0; i < particleCount; i++) {
        const particle = particles[i];
        const distance = position.distanceTo(particle.position);
        
        if (distance < radius) {
            nearbyParticles.push(particle);
        }
    }
    
    if (nearbyParticles.length < 2) return;
    
    const avgPos = new THREE.Vector3(0, 0, 0);
    for (const particle of nearbyParticles) {
        avgPos.add(particle.position);
    }
    avgPos.divideScalar(nearbyParticles.length);
    
    for (const particle of nearbyParticles) {
        const toAvg = new THREE.Vector3().subVectors(avgPos, particle.position);
        particle.position.add(toAvg.multiplyScalar(0.1));
        particle.mesh.position.copy(particle.position);
    }
}

function setClayColor(name, colorValue) {
    clayColor = colorValue;
    
    const colorButtons = document.querySelectorAll('.color-btn');
    colorButtons.forEach(button => {
        button.classList.remove('active');
        if (button.title === name) {
            button.classList.add('active');
        }
    });
    
    for (const particle of particles) {
        particle.mesh.material.color.setHex(colorValue);
    }
}

function animate() {
    requestAnimationFrame(animate);
    
    // Only update controls if not in drawing mode
    if (!isDrawing) {
        controls.update();
    } else if (cameraFixedPosition && cameraFixedQuaternion) {
        // Force camera to stay at the fixed position while drawing
        camera.position.copy(cameraFixedPosition);
        camera.quaternion.copy(cameraFixedQuaternion);
    }
    
    // Enhanced 3D animation
    const time = clock.getElapsedTime();
    
    // Subtle breathing animation for clay particles
    animateClayParticles(time);
    
    // Optional turntable rotation for showcasing the model
    if (turntable) {
        clayMesh.rotation.y += rotationSpeed;
    }
    
    renderer.render(scene, camera);
}

function animateClayParticles(time) {
    // Apply subtle movement to particles to enhance 3D look
    for (let i = 0; i < particles.length; i++) {
        const particle = particles[i];
        
        // Only apply subtle movement to some particles
        if (i % 3 === 0) {
            // Get original position
            const origPos = particle.originalPosition;
            
            // Apply sine wave movement with unique phase for each particle
            const pulseAmplitude = particle.size * 0.03;
            const pulseSpeed = 1.5;
            
            const xOffset = Math.sin(time * pulseSpeed + particle.phase) * pulseAmplitude;
            const yOffset = Math.cos(time * pulseSpeed + particle.phase * 2) * pulseAmplitude;
            const zOffset = Math.sin(time * pulseSpeed * 0.7 + particle.phase * 3) * pulseAmplitude;
            
            // Apply offset to position
            particle.position.x = origPos.x + xOffset;
            particle.position.y = origPos.y + yOffset;
            particle.position.z = origPos.z + zOffset;
            
            // Update mesh position
            particle.mesh.position.copy(particle.position);
        }
    }
}

function applyStampSphere(position, size) {
    const radius = size;
    const numParticles = Math.floor(size * 1.5);
    
    addParticle(position.x, position.y, position.z, size / 3);
    
    for (let i = 0; i < numParticles; i++) {
        const phi = Math.random() * Math.PI * 2;
        const theta = Math.random() * Math.PI;
        
        const r = radius * 0.7 * Math.random();
        const x = position.x + r * Math.cos(phi) * Math.sin(theta);
        const y = position.y + r * Math.sin(phi) * Math.sin(theta);
        const z = position.z + r * Math.cos(theta);
        
        const particleSize = (2 + Math.random() * 3) * (size / 15);
        
        addParticle(x, y, z, particleSize);
    }
}

function applyStampCube(position, size) {
    const side = size * 0.8;
    const halfSide = side / 2;
    const numPerSide = 3;
    const step = side / numPerSide;
    
    for (let x = 0; x < numPerSide; x++) {
        for (let y = 0; y < numPerSide; y++) {
            for (let z = 0; z < numPerSide; z++) {
                const px = position.x + (x * step) - halfSide + (Math.random() - 0.5) * step * 0.5;
                const py = position.y + (y * step) - halfSide + (Math.random() - 0.5) * step * 0.5;
                const pz = position.z + (z * step) - halfSide + (Math.random() - 0.5) * step * 0.5;
                
                if (Math.random() > 0.8) continue;
                
                const particleSize = (2 + Math.random() * 2) * (size / 15);
                
                addParticle(px, py, pz, particleSize);
            }
        }
    }
}

function applyPatternSpiral(position, size) {
    const radius = size * 0.7;
    const numParticles = Math.max(8, Math.floor(size * 0.7));
    const turns = 2;
    
    for (let i = 0; i < numParticles; i++) {
        const angle = (i / numParticles) * Math.PI * 2 * turns;
        const spiralRadius = (i / numParticles) * radius;
        
        const x = position.x + spiralRadius * Math.cos(angle);
        const y = position.y + spiralRadius * Math.sin(angle);
        const z = position.z + (i / numParticles - 0.5) * (radius * 0.5);
        
        const particleSize = (5 - (i / numParticles) * 3) * (size / 20);
        
        addParticle(x, y, z, particleSize);
    }
}

function applyPatternRing(position, size) {
    const radius = size * 0.7;
    const numParticles = Math.max(8, Math.floor(size * 0.5));
    
    for (let i = 0; i < numParticles; i++) {
        const angle = (i / numParticles) * Math.PI * 2;
        
        const x = position.x + radius * Math.cos(angle);
        const y = position.y + radius * Math.sin(angle);
        const z = position.z + (Math.random() - 0.5) * 2;
        
        const particleSize = 3 * (size / 20);
        
        addParticle(x, y, z, particleSize);
    }
}

function applyFlattenTool(position, size, strength) {
    const radius = size;
    const nearbyParticles = [];
    
    for (let i = 0; i < particleCount; i++) {
        const particle = particles[i];
        const distance = position.distanceTo(particle.position);
        
        if (distance < radius) {
            nearbyParticles.push(particle);
        }
    }
    
    if (nearbyParticles.length < 1) return;
    
    const avgPos = new THREE.Vector3(0, 0, 0);
    for (const particle of nearbyParticles) {
        avgPos.add(particle.position);
    }
    avgPos.divideScalar(nearbyParticles.length);
    
    const normal = position.clone().sub(camera.position).normalize();
    
    for (const particle of nearbyParticles) {
        const toParticle = particle.position.clone().sub(avgPos);
        const dot = toParticle.dot(normal);
        const projection = normal.clone().multiplyScalar(dot);
        
        const flatten = projection.multiplyScalar(strength * 0.3);
        
        particle.position.sub(flatten);
        particle.mesh.position.copy(particle.position);
    }
}

function setupPanelToggle() {
    const panelToggle = document.getElementById('panel-toggle');
    const uiContainer = document.getElementById('ui-container');
    const iconElement = panelToggle.querySelector('i');
    
    if (uiContainer.classList.contains('hidden')) {
        iconElement.className = 'fas fa-sliders-h';
    } else {
        iconElement.className = 'fas fa-times';
    }
    
    panelToggle.addEventListener('click', () => {
        uiContainer.classList.toggle('hidden');
        
        if (uiContainer.classList.contains('hidden')) {
            iconElement.className = 'fas fa-sliders-h';
        } else {
            iconElement.className = 'fas fa-times';
        }
    });
    
    window.addEventListener('keydown', (event) => {
        if (event.key === 'Tab') {
            event.preventDefault();
            panelToggle.click();
        }
    });
}

// Add new drawing functions
function startDrawing() {
    isDrawing = true;
    drawingPoints = [];
    
    // Disable camera controls while drawing
    controlsEnabledBeforeDrawing = controls.enabled;
    controls.enabled = false;
    
    // Store camera position to keep it fixed during drawing
    cameraFixedPosition = camera.position.clone();
    cameraFixedQuaternion = camera.quaternion.clone();
    
    const vector = new THREE.Vector3(mousePosition.x, mousePosition.y, 0.5);
    vector.unproject(camera);
    
    const dir = vector.sub(camera.position).normalize();
    const distance = -camera.position.z / dir.z;
    const pos = camera.position.clone().add(dir.multiplyScalar(distance));
    
    drawingPoints.push(pos.clone());
    
    // Create simple line as a placeholder while drawing
    const material = new THREE.LineBasicMaterial({
        color: clayColor,
        linewidth: 1
    });
    
    const geometry = new THREE.BufferGeometry().setFromPoints(drawingPoints);
    currentDrawingLine = new THREE.Line(geometry, material);
    scene.add(currentDrawingLine);
}

function updateDrawing(position) {
    if (!isDrawing || !currentDrawingLine) return;
    
    drawingPoints.push(position.clone());
    
    // Update the line geometry
    currentDrawingLine.geometry.dispose();
    currentDrawingLine.geometry = new THREE.BufferGeometry().setFromPoints(drawingPoints);
}

function endDrawing() {
    if (!isDrawing || !currentDrawingLine) return;
    
    isDrawing = false;
    
    // Restore camera controls to previous state
    controls.enabled = controlsEnabledBeforeDrawing;
    
    // Remove the temporary line
    scene.remove(currentDrawingLine);
    currentDrawingLine.geometry.dispose();
    
    // Only create a tube if we have enough points
    if (drawingPoints.length >= 2) {
        // Create a smooth curve from the points
        drawingCurve = new THREE.CatmullRomCurve3(drawingPoints);
        
        // Create a tube geometry with proper thickness
        const tubeGeometry = new THREE.TubeGeometry(
            drawingCurve,
            Math.min(64, drawingPoints.length * 3), // Segments - more segments = smoother curve
            lineThickness * 0.8,                    // Radius - visual thickness of the tube
            8,                                      // RadialSegments - roundness of the tube
            false                                   // Closed - whether to connect ends
        );
        
        // Create material for the tube
        const tubeMaterial = new THREE.MeshPhysicalMaterial({
            color: clayColor,
            metalness: 0.0,
            roughness: 0.7,
            clearcoat: 0.2,
            clearcoatRoughness: 0.4,
            reflectivity: 0.1,
            envMapIntensity: 0.3,
            transparent: true,
            opacity: 0.9,
        });
        
        // Create the tube mesh
        const tubeMesh = new THREE.Mesh(tubeGeometry, tubeMaterial);
        scene.add(tubeMesh);
        
        // Add to drawing lines array
        drawingLines.push(tubeMesh);
        
        // Add clay particles along the tube
        addParticlesAlongTube(drawingCurve, lineThickness);
    }
    
    // Reset current drawing line
    currentDrawingLine = null;
}

function addParticlesAlongTube(curve, thickness) {
    // Number of particles depends on curve length and thickness
    const numPoints = Math.max(10, Math.floor(drawingPoints.length * 2));
    
    // Calculate points along the curve
    for (let i = 0; i < numPoints; i++) {
        const t = i / (numPoints - 1);
        const point = curve.getPoint(t);
        
        // Add variation to make it look more natural
        const jitter = thickness * 0.2;
        const jx = point.x + (Math.random() - 0.5) * jitter;
        const jy = point.y + (Math.random() - 0.5) * jitter;
        const jz = point.z + (Math.random() - 0.5) * jitter;
        
        // Particle size based on thickness
        const size = thickness * 0.5 + Math.random() * thickness * 0.3;
        
        addParticle(jx, jy, jz, size);
    }
}

function createEnvironmentMap() {
    // Create a cubemap for environment reflections
    const path = 'https://threejs.org/examples/textures/cube/';
    const format = '.jpg';
    const urls = [
        path + 'px' + format, path + 'nx' + format,
        path + 'py' + format, path + 'ny' + format,
        path + 'pz' + format, path + 'nz' + format
    ];
    
    const loader = new THREE.CubeTextureLoader();
    const envMap = loader.load(urls);
    
    scene.environment = envMap;
}

function onDoubleClick(event) {
    // Toggle camera following cursor
    cameraFollowsCursor = !cameraFollowsCursor;
    
    // Provide visual feedback (could be improved with a UI indicator)
    const feedbackColor = cameraFollowsCursor ? 0x007700 : 0x770000;
    const originalColor = scene.background.getHex();
    
    // Brief flash to indicate the change
    scene.background.setHex(feedbackColor);
    setTimeout(() => {
        scene.background.setHex(originalColor);
    }, 200);
}

function createConnectionsNearParticle(targetParticle) {
    
    const maxConnections = 3;
    const blendRadius = targetParticle.size * 3.5;
    let connections = 0;
    
    for (let i = 0; i < particles.length; i++) {
        const particle = particles[i];
        
        // Skip the target particle itself
        if (particle === targetParticle) continue;
        
        const distance = particle.position.distanceTo(targetParticle.position);
        
        // If particles are close enough, create a connection
        if (distance < blendRadius && connections < maxConnections) {
            createClayConnection(particle, targetParticle, distance);
            connections++;
        }
    }
}

function createClayConnection(particle1, particle2, distance) {
    // Calculate midpoint between particles
    const midpoint = new THREE.Vector3().addVectors(
        particle1.position, 
        particle2.position
    ).multiplyScalar(0.5);
    
    
    const direction = new THREE.Vector3().subVectors(
        particle2.position,
        particle1.position
    ).normalize();
    
    // Create a small cylinder/bridge between the particles
    const length = distance * 0.8; // Slightly shorter than actual distance
    const radius = Math.min(particle1.size, particle2.size) * 0.45;
    
    // Create the connector geometry (cylinder)
    const geometry = new THREE.CylinderGeometry(
        radius, // radiusTop
        radius, // radiusBottom
        length, // height
        8,      // radialSegments
        3,      // heightSegments
        true    // openEnded
    );
    
    // Create the connector material - match clay appearance
    const material = new THREE.MeshPhysicalMaterial({
        color: clayColor,
        metalness: 0.1,
        roughness: 0.55,
        clearcoat: 0.5,
        clearcoatRoughness: 0.25,
        reflectivity: 0.3,
        envMapIntensity: 0.5,
        emissive: new THREE.Color(clayColor).multiplyScalar(0.05)
    });
    
    // Create the connector mesh
    
    const connector = new THREE.Mesh(geometry, material);
    
    // Position and rotate the connector
    connector.position.copy(midpoint);
    
    // Orient cylinder along the direction between particles
    const axis = new THREE.Vector3(0, 1, 0);
    connector.quaternion.setFromUnitVectors(axis, direction);
    
    // Add to scene
    clayMesh.add(connector);
    
    // Store reference to connector in particles for cleanup/update later
    if (!particle1.connections) particle1.connections = [];
    if (!particle2.connections) particle2.connections = [];
    
    particle1.connections.push(connector);
    particle2.connections.push(connector);
}

function createNoiseTexture() {
    // Create a canvas to generate noise texture
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    // Fill with noise
    const imageData = ctx.createImageData(size, size);
    const data = imageData.data;
    
    for (let i = 0; i < size * size; i++) {
        // Random noise with clay-like patterns
        const x = i % size;
        const y = Math.floor(i / size);
        
        // Create multi-frequency noise for more natural texture
        const highFreq = Math.random() * 0.3;
        const medFreq = Math.sin(x * 0.05) * Math.cos(y * 0.05) * 0.2;
        const lowFreq = Math.sin(x * 0.01 + y * 0.01) * 0.1;
        
        // Combine frequencies
        const noiseVal = 0.6 + highFreq + medFreq + lowFreq;
        
        // Add subtle color variation for more realism
        const val = Math.floor(255 * Math.min(1, Math.max(0, noiseVal)));
        
        data[i * 4] = val;     // R
        data[i * 4 + 1] = val; // G
        data[i * 4 + 2] = val; // B
        data[i * 4 + 3] = 255; // A
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    // Convert to texture
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 3);
    
    return texture;
}

function createNormalMapFromTexture(texture) {
    // Create normal map from height map
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    // Draw the texture to the canvas
    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = size;
    tmpCanvas.height = size;
    const tmpCtx = tmpCanvas.getContext('2d');
    
    // Need to set up a dummy image with the texture data
    const img = document.createElement('img');
    img.src = texture.image.toDataURL();
    
    // Process once image is loaded
    return new Promise((resolve) => {
        img.onload = function() {
            tmpCtx.drawImage(img, 0, 0, size);
            const imgData = tmpCtx.getImageData(0, 0, size);
            
            // Create normal map
            const normalData = ctx.createImageData(size, size);
            
            // Calculate normals based on height differences
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const index = (y * size + x) * 4;
                    
                    // Get heights at neighboring pixels
                    const left = x > 0 ? imgData.data[index - 4] / 255 : 0;
                    const right = x < size - 1 ? imgData.data[index + 4] / 255 : 0;
                    const up = y > 0 ? imgData.data[index - size * 4] / 255 : 0;
                    const down = y < size - 1 ? imgData.data[index + size * 4] / 255 : 0;
                    
                    // Calculate normal vector using Sobel operator
                    const dx = (right - left) * 2.0;
                    const dy = (down - up) * 2.0;
                    const dz = 1.0 / clayTextureDepth;  // Adjust for height intensity
                    
                    // Normalize
                    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
                    const nx = dx / length;
                    const ny = dy / length;
                    const nz = dz / length;
                    
                    // Set normal map color (normal vector -> RGB)
                    normalData.data[index] = Math.floor((nx * 0.5 + 0.5) * 255);     // R
                    normalData.data[index + 1] = Math.floor((ny * 0.5 + 0.5) * 255); // G
                    normalData.data[index + 2] = Math.floor((nz * 0.5 + 0.5) * 255); // B
                    normalData.data[index + 3] = 255; // A
                }
            }
            
            ctx.putImageData(normalData, 0, 0);
            
            // Create normal map texture
            const normalMap = new THREE.CanvasTexture(canvas);
            normalMap.wrapS = THREE.RepeatWrapping;
            normalMap.wrapT = THREE.RepeatWrapping;
            normalMap.repeat.set(3, 3);
            
            resolve(normalMap);
        };
    });
}

class App {
    constructor() {
        this.setupApp();
    }

    setupApp() {
        // Initialize the clay sculptor
        this.claySculptor = new ClaySculptor();

        // Setup image upload
        const controlsContainer = document.querySelector('.controls');
        this.imageUpload = new ImageUpload(controlsContainer);

        // Listen for image upload events
        document.addEventListener('imageUploaded', (e) => {
            const file = e.detail.file;
            if (file) {
                this.claySculptor.processImage(file);
            }
        });

        // Add keyboard shortcut for image upload
        document.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'i') {
                document.getElementById('image-upload').click();
            }
        });
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new App();
});