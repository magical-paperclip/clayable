// Main application
let container;
let camera, scene, renderer;
let controls;
let mousePosition = new THREE.Vector2();
let isMouseDown = false;
let lastMousePosition = new THREE.Vector2();
let clock = new THREE.Clock();

// Clay parameters
let clayColor = 0xe8c291; // Default light clay color
const clayColors = {
    'Classic Clay': 0xe8c291,
    'Blue Clay': 0x4a87b3,
    'Red Clay': 0xc45c5c,
    'Green Clay': 0x6bab79,
    'Purple Clay': 0x9370db,
    'Gray Clay': 0x808080
};
let mouseMode = 'add'; // 'add', 'remove', or 'smooth'

// Specialized tools parameters
const specializedTools = {
    'stamp-sphere': { name: 'Sphere Stamp', size: 15, shape: 'sphere' },
    'stamp-cube': { name: 'Cube Stamp', size: 12, shape: 'cube' },
    'pattern-spiral': { name: 'Spiral Pattern', size: 25, particles: 12 },
    'pattern-ring': { name: 'Ring Pattern', size: 20, particles: 8 },
    'tool-flatten': { name: 'Flatten Tool', size: 18, strength: 0.8 }
};
let activeSpecialTool = null;
let toolSize = 10; // Default tool size

// Clay particles
const maxParticles = 500;
let particleCount = 0;
let particles = [];
let clayMesh;

// UI elements for clay manipulation
let uiInfo;

init();
animate();

function init() {
    // Set up the container
    container = document.getElementById('container');
    
    // Create the scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);
    
    // Create the camera
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera = new THREE.PerspectiveCamera(45, width / height, 1, 10000);
    camera.position.set(0, 0, 500);
    
    // Add soft lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.8);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
    directionalLight.position.set(1, 1, 1).normalize();
    scene.add(directionalLight);
    
    // Add a soft light from the bottom for better clay feel
    const bottomLight = new THREE.DirectionalLight(0xffc0cb, 0.3); // Soft pink light
    bottomLight.position.set(0, -1, 0).normalize();
    scene.add(bottomLight);
    
    // Create the clay blob using particle system
    createClayParticles();
    
    // Create the renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);
    
    // Add controls for camera manipulation
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = 0.5;
    
    // Create UI elements for clay tools
    createUI();
    
    // Set up event listeners
    window.addEventListener('resize', onWindowResize);
    
    // Mouse interaction
    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('mousedown', () => { isMouseDown = true; });
    container.addEventListener('mouseup', () => { isMouseDown = false; });
    
    // Touch interaction
    container.addEventListener('touchmove', onTouchMove);
    container.addEventListener('touchstart', () => { isMouseDown = true; });
    container.addEventListener('touchend', () => { isMouseDown = false; });
    
    // Keyboard controls
    window.addEventListener('keydown', onKeyDown);
}

function createUI() {
    // Create UI for clay manipulation
    uiInfo = document.getElementById('ui-container');
    
    // Add basic tool buttons
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
    
    const resetButton = document.createElement('button');
    resetButton.textContent = 'Reset Clay (R)';
    resetButton.onclick = resetClay;
    
    toolsDiv.appendChild(addButton);
    toolsDiv.appendChild(removeButton);
    toolsDiv.appendChild(smoothButton);
    toolsDiv.appendChild(resetButton);
    
    uiInfo.appendChild(toolsDiv);
    
    // Add specialized tools section
    const specialToolsDiv = document.createElement('div');
    specialToolsDiv.className = 'special-tools';
    
    // Add label for specialized tools
    const specialToolsLabel = document.createElement('div');
    specialToolsLabel.className = 'tools-label';
    specialToolsLabel.textContent = 'Specialized Tools';
    specialToolsDiv.appendChild(specialToolsLabel);
    
    // Create specialized tool buttons
    const specialButtonsDiv = document.createElement('div');
    specialButtonsDiv.className = 'tool-buttons';
    
    // Add buttons for each specialized tool
    Object.entries(specializedTools).forEach(([id, tool]) => {
        const toolButton = document.createElement('button');
        toolButton.textContent = tool.name;
        toolButton.className = 'tool-btn';
        toolButton.onclick = () => setSpecialTool(id);
        specialButtonsDiv.appendChild(toolButton);
    });
    
    specialToolsDiv.appendChild(specialButtonsDiv);
    
    // Add tool size slider
    const sizeControlDiv = document.createElement('div');
    sizeControlDiv.className = 'size-control';
    
    const sizeLabel = document.createElement('label');
    sizeLabel.textContent = 'Tool Size';
    sizeLabel.htmlFor = 'tool-size';
    
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
    
    sizeControlDiv.appendChild(sizeLabel);
    sizeControlDiv.appendChild(sizeSlider);
    sizeControlDiv.appendChild(sizeValue);
    
    specialToolsDiv.appendChild(sizeControlDiv);
    uiInfo.appendChild(specialToolsDiv);
    
    // Add color selection
    const colorsDiv = document.createElement('div');
    colorsDiv.className = 'colors';
    
    // Add a label for the color section
    const colorLabel = document.createElement('div');
    colorLabel.className = 'color-label';
    colorLabel.textContent = 'Clay Color';
    colorsDiv.appendChild(colorLabel);
    
    // Create color buttons
    const colorButtonsDiv = document.createElement('div');
    colorButtonsDiv.className = 'color-buttons';
    
    // Add a button for each clay color
    Object.entries(clayColors).forEach(([name, colorValue]) => {
        const colorButton = document.createElement('button');
        colorButton.className = 'color-btn';
        colorButton.title = name;
        colorButton.style.backgroundColor = '#' + colorValue.toString(16).padStart(6, '0');
        
        // Mark the default color as selected
        if (colorValue === clayColor) {
            colorButton.classList.add('active');
        }
        
        colorButton.onclick = () => setClayColor(name, colorValue);
        colorButtonsDiv.appendChild(colorButton);
    });
    
    colorsDiv.appendChild(colorButtonsDiv);
    uiInfo.appendChild(colorsDiv);
    
    // Add footer
    const footer = document.createElement('div');
    footer.className = 'footer';
    footer.textContent = '© 2025 clayable - rotate with mouse, pinch to zoom';
    document.body.appendChild(footer);
}

function setMouseMode(mode) {
    mouseMode = mode;
    
    // Update UI to reflect active tool
    const buttons = document.querySelectorAll('.tools button');
    buttons.forEach(button => {
        button.className = button.textContent.toLowerCase().includes(mouseMode) ? 'active' : '';
    });
}

function setSpecialTool(toolId) {
    activeSpecialTool = toolId;
    
    // Update UI to reflect active special tool
    const toolButtons = document.querySelectorAll('.tool-btn');
    toolButtons.forEach(button => {
        button.classList.remove('active');
        if (toolId && button.textContent === specializedTools[toolId].name) {
            button.classList.add('active');
        }
    });
    
    // If a special tool is selected, deactivate basic tools
    if (toolId) {
        const basicButtons = document.querySelectorAll('.tools button');
        basicButtons.forEach(button => {
            button.classList.remove('active');
        });
    }
}

function onKeyDown(event) {
    // Keyboard shortcuts for tools
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
        case 'r':
            resetClay();
            break;
    }
}

function createClayParticles() {
    // Remove any existing clay mesh
    if (clayMesh) {
        scene.remove(clayMesh);
    }
    
    // Create a material for the clay particles
    const material = new THREE.MeshPhysicalMaterial({
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
    
    // Initialize particles array with defaults
    particles = [];
    particleCount = 0;
    
    // Create parent group for clay mesh
    clayMesh = new THREE.Group();
    scene.add(clayMesh);
    
    // Add initial clay shape
    resetClay();
}

function addParticle(x, y, z, size) {
    if (particleCount >= maxParticles) return;
    
    // Create a sphere for this particle
    const geometry = new THREE.SphereGeometry(size, 8, 8);
    const material = new THREE.MeshPhysicalMaterial({
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
    
    const particle = new THREE.Mesh(geometry, material);
    particle.position.set(x, y, z);
    
    // Store particle data
    particles.push({
        mesh: particle,
        size: size,
        position: new THREE.Vector3(x, y, z)
    });
    
    clayMesh.add(particle);
    particleCount++;
}

function removeParticle(index) {
    if (index < 0 || index >= particleCount) return;
    
    // Remove the particle mesh
    clayMesh.remove(particles[index].mesh);
    
    // Remove from the array
    particles.splice(index, 1);
    particleCount--;
}

function resetClay() {
    // Clear all existing particles
    while (particles.length > 0) {
        removeParticle(0);
    }
    
    // Create a spherical arrangement of particles
    const numParticles = 50;
    const radius = 20;
    
    for (let i = 0; i < numParticles; i++) {
        // Create a somewhat uniform distribution on a sphere
        const phi = Math.acos(-1 + (2 * i) / numParticles);
        const theta = Math.sqrt(numParticles * Math.PI) * phi;
        
        // Add some randomness for organic feel
        const x = radius * Math.cos(theta) * Math.sin(phi) + (Math.random() - 0.5) * 5;
        const y = radius * Math.sin(theta) * Math.sin(phi) + (Math.random() - 0.5) * 5;
        const z = radius * Math.cos(phi) + (Math.random() - 0.5) * 5;
        
        // Random sizes for organic feel
        const size = 5 + Math.random() * 5;
        
        addParticle(x, y, z, size);
    }
    
    // Add a few more random particles inside for solidity
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
    // Calculate normalized mouse position (-1 to 1)
    mousePosition.x = (event.clientX / window.innerWidth) * 2 - 1;
    mousePosition.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Interact with clay if mouse is down
    if (isMouseDown) {
        interactWithClay();
    }
    
    lastMousePosition.copy(mousePosition);
}

function onTouchMove(event) {
    event.preventDefault();
    
    // Calculate normalized touch position (-1 to 1)
    mousePosition.x = (event.touches[0].clientX / window.innerWidth) * 2 - 1;
    mousePosition.y = -(event.touches[0].clientY / window.innerHeight) * 2 + 1;
    
    // Always interact with clay on touch devices
    interactWithClay();
    
    lastMousePosition.copy(mousePosition);
}

function interactWithClay() {
    // Get 3D position from mouse position using raycasting
    const vector = new THREE.Vector3(mousePosition.x, mousePosition.y, 0.5);
    vector.unproject(camera);
    
    const dir = vector.sub(camera.position).normalize();
    const distance = -camera.position.z / dir.z;
    const pos = camera.position.clone().add(dir.multiplyScalar(distance));
    
    // Handle specialized tools if one is active
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
        return; // Skip basic tool handling if using specialized tools
    }
    
    // Handle basic tools
    switch (mouseMode) {
        case 'add':
            // Add clay particles
            const size = 5 + Math.random() * 5;
            addParticle(pos.x, pos.y, pos.z, size);
            
            // Smooth movements by adding intermediate points for 'add' mode
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
            // Find and remove the closest particle(s)
            removeNearbyParticles(pos, 15);
            break;
            
        case 'smooth':
            // Move particles slightly towards the average position
            smoothNearbyParticles(pos, 30);
            break;
    }
}

function removeNearbyParticles(position, radius) {
    const tempParticles = [...particles]; // Create a copy to avoid issues during removal
    
    for (let i = tempParticles.length - 1; i >= 0; i--) {
        const particle = tempParticles[i];
        const distance = position.distanceTo(particle.position);
        
        if (distance < radius) {
            removeParticle(i);
        }
    }
}

function smoothNearbyParticles(position, radius) {
    // Find particles within radius
    const nearbyParticles = [];
    
    for (let i = 0; i < particleCount; i++) {
        const particle = particles[i];
        const distance = position.distanceTo(particle.position);
        
        if (distance < radius) {
            nearbyParticles.push(particle);
        }
    }
    
    // Nothing to smooth
    if (nearbyParticles.length < 2) return;
    
    // Calculate average position
    const avgPos = new THREE.Vector3(0, 0, 0);
    for (const particle of nearbyParticles) {
        avgPos.add(particle.position);
    }
    avgPos.divideScalar(nearbyParticles.length);
    
    // Move particles slightly towards the average position
    for (const particle of nearbyParticles) {
        const toAvg = new THREE.Vector3().subVectors(avgPos, particle.position);
        particle.position.add(toAvg.multiplyScalar(0.1));
        particle.mesh.position.copy(particle.position);
    }
}

function setClayColor(name, colorValue) {
    // Update the current clay color
    clayColor = colorValue;
    
    // Update UI to reflect active color
    const colorButtons = document.querySelectorAll('.color-btn');
    colorButtons.forEach(button => {
        button.classList.remove('active');
        if (button.title === name) {
            button.classList.add('active');
        }
    });
    
    // Update existing particles' colors
    for (const particle of particles) {
        particle.mesh.material.color.setHex(colorValue);
    }
}

function animate() {
    requestAnimationFrame(animate);
    
    // Update controls
    controls.update();
    
    // Add some subtle ambient motion to the clay
    addAmbientMotion();
    
    // Render the scene
    renderer.render(scene, camera);
}

function addAmbientMotion() {
    // Only update every few frames to improve performance
    if (Math.floor(clock.getElapsedTime() * 10) % 10 !== 0) return;
    
    // Add a very subtle random motion to random particles
    const time = Date.now() * 0.001;
    const intensity = 0.2; // Subtle motion
    
    // Move a few random particles
    for (let i = 0; i < 3; i++) {
        if (particleCount <= 0) continue;
        
        const index = Math.floor(Math.random() * particleCount);
        const particle = particles[index];
        
        // Apply a small random movement
        particle.position.x += (Math.random() - 0.5) * intensity;
        particle.position.y += (Math.random() - 0.5) * intensity;
        particle.position.z += (Math.random() - 0.5) * intensity;
        
        // Update the mesh position
        particle.mesh.position.copy(particle.position);
    }
}

// Apply a sphere stamp to add multiple particles in a spherical shape
function applyStampSphere(position, size) {
    const radius = size;
    const numParticles = Math.floor(size * 1.5);
    
    // Add a center particle
    addParticle(position.x, position.y, position.z, size / 3);
    
    // Add particles in a spherical distribution
    for (let i = 0; i < numParticles; i++) {
        // Create points around a sphere with random distribution
        const phi = Math.random() * Math.PI * 2;
        const theta = Math.random() * Math.PI;
        
        // Calculate position on sphere
        const r = radius * 0.7 * Math.random();
        const x = position.x + r * Math.cos(phi) * Math.sin(theta);
        const y = position.y + r * Math.sin(phi) * Math.sin(theta);
        const z = position.z + r * Math.cos(theta);
        
        // Random sizes for organic feel
        const particleSize = (2 + Math.random() * 3) * (size / 15);
        
        addParticle(x, y, z, particleSize);
    }
}

// Apply a cube stamp to add multiple particles in a cubic shape
function applyStampCube(position, size) {
    const side = size * 0.8;
    const halfSide = side / 2;
    const numPerSide = 3;
    const step = side / numPerSide;
    
    // Create particles in a grid pattern
    for (let x = 0; x < numPerSide; x++) {
        for (let y = 0; y < numPerSide; y++) {
            for (let z = 0; z < numPerSide; z++) {
                const px = position.x + (x * step) - halfSide + (Math.random() - 0.5) * step * 0.5;
                const py = position.y + (y * step) - halfSide + (Math.random() - 0.5) * step * 0.5;
                const pz = position.z + (z * step) - halfSide + (Math.random() - 0.5) * step * 0.5;
                
                // Skip some particles for a less perfect cube
                if (Math.random() > 0.8) continue;
                
                // Random sizes for organic feel
                const particleSize = (2 + Math.random() * 2) * (size / 15);
                
                addParticle(px, py, pz, particleSize);
            }
        }
    }
}

// Create a spiral pattern of particles
function applyPatternSpiral(position, size) {
    const radius = size * 0.7;
    const numParticles = Math.max(8, Math.floor(size * 0.7));
    const turns = 2; // Number of complete turns in spiral
    
    for (let i = 0; i < numParticles; i++) {
        // Calculate position on spiral
        const angle = (i / numParticles) * Math.PI * 2 * turns;
        const spiralRadius = (i / numParticles) * radius;
        
        const x = position.x + spiralRadius * Math.cos(angle);
        const y = position.y + spiralRadius * Math.sin(angle);
        const z = position.z + (i / numParticles - 0.5) * (radius * 0.5);
        
        // Gradually decreasing size for spiral effect
        const particleSize = (5 - (i / numParticles) * 3) * (size / 20);
        
        addParticle(x, y, z, particleSize);
    }
}

// Create a ring pattern of particles
function applyPatternRing(position, size) {
    const radius = size * 0.7;
    const numParticles = Math.max(8, Math.floor(size * 0.5));
    
    for (let i = 0; i < numParticles; i++) {
        // Calculate position on ring
        const angle = (i / numParticles) * Math.PI * 2;
        
        const x = position.x + radius * Math.cos(angle);
        const y = position.y + radius * Math.sin(angle);
        const z = position.z + (Math.random() - 0.5) * 2; // Slight z-variation
        
        // Consistent size for ring particles
        const particleSize = 3 * (size / 20);
        
        addParticle(x, y, z, particleSize);
    }
}

// Flatten nearby particles along a plane
function applyFlattenTool(position, size, strength) {
    // Find particles within radius
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
    
    // Calculate average position for the center of flattening
    const avgPos = new THREE.Vector3(0, 0, 0);
    for (const particle of nearbyParticles) {
        avgPos.add(particle.position);
    }
    avgPos.divideScalar(nearbyParticles.length);
    
    // Find surface normal (use camera direction as approximation)
    const normal = position.clone().sub(camera.position).normalize();
    
    // Move particles to flatten along the plane
    for (const particle of nearbyParticles) {
        // Project vector from avg position to particle onto normal
        const toParticle = particle.position.clone().sub(avgPos);
        const dot = toParticle.dot(normal);
        const projection = normal.clone().multiplyScalar(dot);
        
        // Calculate flattening movement
        const flatten = projection.multiplyScalar(strength * 0.3);
        
        // Apply flattening
        particle.position.sub(flatten);
        particle.mesh.position.copy(particle.position);
    }
}