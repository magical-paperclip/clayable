// Main application
let container;
let camera, scene, renderer;
let controls;
let mousePosition = new THREE.Vector2();
let isMouseDown = false;
let lastMousePosition = new THREE.Vector2();
let clock = new THREE.Clock();

// Clay parameters
const clayColor = 0xe8c291; // A light clay color
let mouseMode = 'add'; // 'add', 'remove', or 'smooth'

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
    uiInfo = document.getElementById('info');
    
    // Add tool buttons
    const toolsDiv = document.createElement('div');
    toolsDiv.className = 'tools';
    
    const addButton = document.createElement('button');
    addButton.textContent = 'Add Clay (A)';
    addButton.className = 'active';
    addButton.onclick = () => setMouseMode('add');
    
    const removeButton = document.createElement('button');
    removeButton.textContent = 'Remove Clay (S)';
    removeButton.onclick = () => setMouseMode('remove');
    
    const smoothButton = document.createElement('button');
    smoothButton.textContent = 'Smooth Clay (D)';
    smoothButton.onclick = () => setMouseMode('smooth');
    
    const resetButton = document.createElement('button');
    resetButton.textContent = 'Reset Clay (R)';
    resetButton.onclick = resetClay;
    
    toolsDiv.appendChild(addButton);
    toolsDiv.appendChild(removeButton);
    toolsDiv.appendChild(smoothButton);
    toolsDiv.appendChild(resetButton);
    
    uiInfo.appendChild(toolsDiv);
}

function setMouseMode(mode) {
    mouseMode = mode;
    
    // Update UI to reflect active tool
    const buttons = document.querySelectorAll('.tools button');
    buttons.forEach(button => {
        button.className = button.textContent.toLowerCase().includes(mouseMode) ? 'active' : '';
    });
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
    
    // Apply different effects based on the current mouse mode
    switch (mouseMode) {
        case 'add':
            // Add clay particles
            const size = 5 + Math.random() * 5;
            addParticle(pos.x, pos.y, pos.z, size);
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
    
    // Smooth movements by adding intermediate points for 'add' mode
    if (mouseMode === 'add' && lastMousePosition.distanceTo(mousePosition) > 0.01) {
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
            
            const size = 3 + Math.random() * 4;
            addParticle(p.x, p.y, p.z, size);
        }
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