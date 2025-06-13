// Remove Three.js imports since we're using the global object
import { ClaySculptor } from './clay.js';
import { ImageUpload } from './components/ImageUpload.js';

let container;
let camera, scene, renderer;
let controls;
let mousePosition = new THREE.Vector2();
let isMouseDown = false;
let lastMousePosition = new THREE.Vector2();
let clock = new THREE.Clock();


let turntable = false;
let rotationSpeed = 0.001;
let fogEnabled = true;
let shadowsEnabled = true;
let cameraFollowsCursor = true;

let clayTextureEnabled = true;
let clayTextureScale = 0.3;  
let clayTextureDepth = 0.1;  
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

let raycaster = new THREE.Raycaster();


let useMetaballs = true;
let metaballMesh = null;
let metaballMaterial = null;
let particleInfluence = 1.3; 
let claySmoothing = 0.85;  


let clayNoiseTexture = null;
let clayNormalMap = null;
let clayRoughnessMap = null;

let claySculptor;
let imageUpload;

const PORT = 3001; 

init();
animate();

function init() {
    try {
        container = document.getElementById('canvas-container');
        if (!container) {
            console.error('Canvas container not found!');
            return;
        }
        
        // Create UI first
        createUI();
        
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x222222);
        
        if (fogEnabled) {
            scene.fog = new THREE.FogExp2(0x222222, 0.0008);
        }
        
        const width = window.innerWidth;
        const height = window.innerHeight;
        camera = new THREE.PerspectiveCamera(45, width / height, 1, 10000);
        camera.position.set(0, 0, 500);
        
        // Enhanced lighting setup for playdough-like appearance
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        scene.add(ambientLight);
        
        // Main directional light
        const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
        mainLight.position.set(1, 1, 1).normalize();
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.width = 2048;
        mainLight.shadow.mapSize.height = 2048;
        mainLight.shadow.camera.near = 10;
        mainLight.shadow.camera.far = 1000;
        mainLight.shadow.camera.left = -300;
        mainLight.shadow.camera.right = 300;
        mainLight.shadow.camera.top = 300;
        mainLight.shadow.camera.bottom = -300;
        mainLight.shadow.bias = -0.001;
        scene.add(mainLight);
        
        // Fill light
        const fillLight = new THREE.DirectionalLight(0xffc0cb, 0.3);
        fillLight.position.set(-1, 0.5, -1).normalize();
        scene.add(fillLight);
        
        // Rim light for 3D effect
        const rimLight = new THREE.DirectionalLight(0x6aabff, 0.4);
        rimLight.position.set(0, -1, -1).normalize();
        scene.add(rimLight);
        
        
        const envMap = createEnvironmentMap();
        scene.environment = envMap;
        
       
        claySculptor = new ClaySculptor(scene);
        
        
        const controlsDiv = document.querySelector('.controls');
        if (controlsDiv) {
            imageUpload = new ImageUpload(controlsDiv);
        } else {
            console.error('Controls div not found!');
        }
        
        
        renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            powerPreference: "high-performance"
        });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(width, height);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.physicallyCorrectLights = true;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.2;
        renderer.outputEncoding = THREE.sRGBEncoding;
        container.appendChild(renderer.domElement);
        
        
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.rotateSpeed = 0.5;
        
        
        window.addEventListener('resize', onWindowResize);
        container.addEventListener('mousemove', onMouseMove);
        container.addEventListener('mousedown', onMouseDown);
        container.addEventListener('mouseup', onMouseUp);
        container.addEventListener('dblclick', onDoubleClick);
        
        
        createClayParticles();
        
        
        animate();
    } catch (error) {
        console.error('Error during initialization:', error);
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
    
    // Add click handler for toggle
    toggle.addEventListener('click', () => {
        controlsDiv.classList.toggle('collapsed');
        toggle.textContent = controlsDiv.classList.contains('collapsed') ? '▲' : '▼';
    });

    
    const toolGroup = document.createElement('div');
    toolGroup.className = 'tool-group';
    
    
    const tools = [
        { id: 'add', label: 'Add Clay' },
        { id: 'remove', label: 'Remove Clay' },
        { id: 'smooth', label: 'Smooth' }
    ];
    
    tools.forEach(tool => {
        const button = document.createElement('button');
        button.textContent = tool.label;
        button.dataset.tool = tool.id;
        button.addEventListener('click', () => setMouseMode(tool.id));
        toolGroup.appendChild(button);
    });
    
    
    const stampGroup = document.createElement('div');
    stampGroup.className = 'stamp-group';
    
    
    const stamps = [
        { id: 'stamp-sphere', label: 'Sphere' },
        { id: 'stamp-cube', label: 'Cube' },
        { id: 'pattern-spiral', label: 'Spiral' },
        { id: 'pattern-ring', label: 'Ring' }
    ];
    
    stamps.forEach(stamp => {
        const button = document.createElement('button');
        button.textContent = stamp.label;
        button.dataset.stamp = stamp.id;
        button.addEventListener('click', () => setSpecialTool(stamp.id));
        stampGroup.appendChild(button);
    });
    
    // Create color group
    const colorGroup = document.createElement('div');
    colorGroup.className = 'color-group';
    
    // Add color buttons
    Object.entries(clayColors).forEach(([name, color]) => {
        const button = document.createElement('button');
        button.className = 'color-btn';
        button.dataset.color = name;
        button.style.backgroundColor = `#${color.toString(16).padStart(6, '0')}`;
        button.addEventListener('click', () => setClayColor(name, color));
        colorGroup.appendChild(button);
    });
    
    // Create brush size group
    const brushGroup = document.createElement('div');
    brushGroup.className = 'brush-group';
    
    // Add brush size slider
    const sizeSlider = document.createElement('input');
    sizeSlider.type = 'range';
    sizeSlider.className = 'brush-size';
    sizeSlider.min = '1';
    sizeSlider.max = '50';
    sizeSlider.value = toolSize;
    sizeSlider.addEventListener('input', (e) => {
        toolSize = parseInt(e.target.value);
    });
    
    const sizeLabel = document.createElement('span');
    sizeLabel.className = 'brush-size-label';
    sizeLabel.textContent = `${toolSize}px`;
    
    sizeSlider.addEventListener('input', (e) => {
        toolSize = parseInt(e.target.value);
        sizeLabel.textContent = `${toolSize}px`;
    });
    
    brushGroup.appendChild(sizeSlider);
    brushGroup.appendChild(sizeLabel);
    
    // Append all groups to controls
    controlsDiv.appendChild(toolGroup);
    controlsDiv.appendChild(stampGroup);
    controlsDiv.appendChild(colorGroup);
    controlsDiv.appendChild(brushGroup);
    
    // Set initial active state
    const addButton = toolGroup.querySelector('[data-tool="add"]');
    if (addButton) {
        addButton.classList.add('active');
    }
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
        case 't':
            turntable = !turntable;
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
    if (claySculptor) {
        claySculptor.reset();
    }
    
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
    if (!isMouseDown) return;
    
    const rect = container.getBoundingClientRect();
    mousePosition.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mousePosition.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    // Update raycaster
    raycaster.setFromCamera(mousePosition, camera);
    
    // Get intersection point
    const intersects = raycaster.intersectObjects([claySculptor.metaballMesh]);
    if (intersects.length > 0) {
        const point = intersects[0].point;
        
        // Add particles along the path from last position to current position
        if (lastMousePosition) {
            claySculptor.addParticlesAlongPath(lastMousePosition, point, toolSize);
        }
        
        // Update last position
        lastMousePosition = point.clone();
        
        // Apply tool effect
        interactWithClay();
    }
}

// Add new mousedown and mouseup event handlers for drawing
function onMouseDown(event) {
    isMouseDown = true;
    lastMousePosition = null;
    
    const rect = container.getBoundingClientRect();
    mousePosition.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mousePosition.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    // Update raycaster
    raycaster.setFromCamera(mousePosition, camera);
    
    // Get intersection point
    const intersects = raycaster.intersectObjects([claySculptor.metaballMesh]);
    if (intersects.length > 0) {
        lastMousePosition = intersects[0].point.clone();
        interactWithClay();
    }
}

function onMouseUp(event) {
    isMouseDown = false;
    lastMousePosition = null;
}

function onTouchMove(event) {
    event.preventDefault();
    
    mousePosition.x = (event.touches[0].clientX / window.innerWidth) * 2 - 1;
    mousePosition.y = -(event.touches[0].clientY / window.innerHeight) * 2 + 1;
    
    interactWithClay();
    
    lastMousePosition.copy(mousePosition);
}

function interactWithClay() {
    if (!lastMousePosition) return;
    
    switch (mouseMode) {
        case 'add':
            // Add clay with more natural distribution and better blending
            for (let i = 0; i < 3; i++) {
                const offset = new THREE.Vector3(
                    (Math.random() - 0.5) * toolSize,
                    (Math.random() - 0.5) * toolSize,
                    (Math.random() - 0.5) * toolSize
                );
                const position = lastMousePosition.clone().add(offset);
                const size = toolSize * (0.8 + Math.random() * 0.4);
                
                // Add particle with enhanced properties
                const particle = claySculptor.addParticle(
                    position.x,
                    position.y,
                    position.z,
                    size
                );
                
                // Create connections with nearby particles for better blending
                if (particle) {
                    createConnectionsNearParticle(particle);
                }
            }
            break;
            
        case 'remove':
            // Remove clay with smoother falloff and better edge blending
            const radius = toolSize * 1.5;
            const falloff = 0.7;
            const particlesToRemove = [];
            
            claySculptor.particles.forEach((particle, index) => {
                const distance = particle.position.distanceTo(lastMousePosition);
                if (distance < radius) {
                    const strength = Math.pow(1 - distance / radius, falloff);
                    if (Math.random() < strength) {
                        particlesToRemove.push(index);
                    } else {
                        // Push nearby particles away for better edge effect
                        const pushDirection = particle.position.clone()
                            .sub(lastMousePosition)
                            .normalize()
                            .multiplyScalar(strength * 0.5);
                        particle.position.add(pushDirection);
                    }
                }
            });
            
            // Remove particles in reverse order to maintain correct indices
            for (let i = particlesToRemove.length - 1; i >= 0; i--) {
                claySculptor.removeParticle(particlesToRemove[i]);
            }
            break;
            
        case 'smooth':
            // Enhanced smoothing with better clay-like behavior and moldability
            const smoothRadius = toolSize * 2;
            const smoothStrength = 0.4;
            const nearbyParticles = claySculptor.particles.filter(particle => 
                particle.position.distanceTo(lastMousePosition) < smoothRadius
            );
            
            if (nearbyParticles.length > 0) {
                // Calculate average position and normal for smoothing
                const center = new THREE.Vector3();
                const normal = lastMousePosition.clone().sub(camera.position).normalize();
                
                nearbyParticles.forEach(particle => center.add(particle.position));
                center.divideScalar(nearbyParticles.length);
                
                // Calculate velocity for momentum effect
                const velocity = new THREE.Vector3().subVectors(
                    lastMousePosition,
                    lastMousePosition.clone().add(normal.multiplyScalar(0.1))
                );
                
                nearbyParticles.forEach(particle => {
                    const distance = particle.position.distanceTo(lastMousePosition);
                    const strength = Math.pow(1 - distance / smoothRadius, 2) * smoothStrength;
                    
                    // Move particle towards center with momentum
                    particle.position.lerp(center, strength * 0.5);
                    
                    // Add momentum-based movement
                    const momentum = velocity.clone().multiplyScalar(strength * 0.3);
                    particle.position.add(momentum);
                    
                    // Add slight push in normal direction for better clay-like feel
                    const pushDirection = normal.clone().multiplyScalar(strength * 0.3);
                    particle.position.add(pushDirection);
                    
                    // Update particle mesh position
                    if (particle.mesh) {
                        particle.mesh.position.copy(particle.position);
                    }
                });
                
                // Update metaball mesh for smooth appearance
                claySculptor.updateMetaballMesh();
            }
            break;
    }
    
    // Always update the metaball mesh after any interaction
    claySculptor.updateMetaballMesh();
}

function setClayColor(name, colorValue) {
    clayColor = colorValue;
    if (claySculptor) {
        claySculptor.setColor(colorValue);
    }
    
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
    
    const deltaTime = clock.getDelta() * 1000; // Convert to milliseconds
    
    // Update particles if claySculptor exists
    if (claySculptor && typeof claySculptor.updateParticles === 'function') {
        claySculptor.updateParticles(deltaTime);
    }
    
    // Update controls
    if (controls) controls.update();
    
    // Render scene
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
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
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    
    // Create gradient background
    const gradient = context.createLinearGradient(0, 0, 0, size);
    gradient.addColorStop(0, '#4a4a4a');
    gradient.addColorStop(1, '#2a2a2a');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
    
    // Add some noise for texture
    const imageData = context.getImageData(0, 0, size, size);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        const noise = Math.random() * 20;
        data[i] = Math.min(255, data[i] + noise);     // R
        data[i + 1] = Math.min(255, data[i + 1] + noise); // G
        data[i + 2] = Math.min(255, data[i + 2] + noise); // B
    }
    context.putImageData(imageData, 0, 0);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    
    return texture;
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
    const maxConnections = 4; // Increased from 3 for better blending
    const blendRadius = targetParticle.size * 4; // Increased radius for better connections
    let connections = 0;
    
    for (let i = 0; i < particles.length; i++) {
        const particle = particles[i];
        
        if (particle === targetParticle) continue;
        
        const distance = particle.position.distanceTo(targetParticle.position);
        
        if (distance < blendRadius && connections < maxConnections) {
            createClayConnection(particle, targetParticle, distance);
            connections++;
        }
    }
}

function createClayConnection(particle1, particle2, distance) {
    const midpoint = new THREE.Vector3().addVectors(
        particle1.position, 
        particle2.position
    ).multiplyScalar(0.5);
    
    const direction = new THREE.Vector3().subVectors(
        particle2.position,
        particle1.position
    ).normalize();
    
    // Create a more flexible connector
    const length = distance * 0.9; // Increased from 0.8 for better connection
    const radius = Math.min(particle1.size, particle2.size) * 0.5; // Increased from 0.45
    
    const geometry = new THREE.CylinderGeometry(
        radius,
        radius,
        length,
        12, // Increased segments for smoother appearance
        4,  // Increased height segments for better deformation
        true
    );
    
    const material = new THREE.MeshPhysicalMaterial({
        color: clayColor,
        metalness: 0.1,
        roughness: 0.5,
        clearcoat: 0.6, // Increased for better clay-like appearance
        clearcoatRoughness: 0.2,
        reflectivity: 0.3,
        envMapIntensity: 0.5,
        emissive: new THREE.Color(clayColor).multiplyScalar(0.05)
    });
    
    const connector = new THREE.Mesh(geometry, material);
    connector.position.copy(midpoint);
    
    const axis = new THREE.Vector3(0, 1, 0);
    connector.quaternion.setFromUnitVectors(axis, direction);
    
    clayMesh.add(connector);
    
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