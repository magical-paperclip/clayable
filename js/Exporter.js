import * as THREE from './three.module.js';

/**
 * CLAYABLE EXPORT STYLE ENFORCER
 * 
 * Ensures EVERY exported image shares the unmistakable Clayable visual identity:
 * - Consistent clay-like material properties
 * - Signature studio lighting setup
 * - Distinctive 30-40° camera angle
 * - Auto-framing based on object size
 * - Professional contact shadows
 * - Playful, slightly stylized aesthetic
 * 
 * GOAL: Every export instantly identifiable as "Clayable"
 */

class EmojiExporter {
    constructor(scene, clayObject) {
        this.scene = scene;
        this.clayObject = clayObject;
        
        // Clayable Export Signature
        this.CLAY_STYLE = {
            // Material properties (clay-like, soft, tactile)
            material: {
                roughness: 0.52,      // Slightly matte, not glossy
                metalness: 0.10,      // Very subtle metallic hint
                clearcoat: 0.15,      // Soft sheen
                wireframe: false
            },
            // Lighting signature (soft studio setup)
            lighting: {
                ambient: { color: 0xffffff, intensity: 0.4 },
                keyLight: { 
                    color: 0xffffff, 
                    intensity: 0.75,
                    position: { x: 8, y: 10, z: 6 }
                },
                fillLight: { 
                    color: 0xaaccff, 
                    intensity: 0.35,
                    position: { x: -6, y: 4, z: 8 }
                },
                backLight: { 
                    color: 0xffffaa, 
                    intensity: 0.25,
                    position: { x: 0, y: 2, z: -8 }
                }
            },
            // Camera signature (30-40° angled view)
            camera: {
                fov: 60,
                angleX: 28,      // Side angle (degrees)
                angleY: 36,      // Elevation angle (degrees)
                lookAtOffset: { x: 0, y: 0.2, z: 0 }  // Slight upward look
            },
            // Framing rules (object occupies 75-85% of frame)
            framing: {
                minFrameFill: 0.75,
                maxFrameFill: 0.85,
                targetFrameFill: 0.80,
                paddingPercent: 0.12
            },
            // Contact shadow (depth cue)
            shadow: {
                opacity: 0.25,
                blur: 0.5,
                scale: 1.3,
                offsetY: -2.2
            },
            // Output quality
            render: {
                minResolution: 512,
                defaultResolution: 512,
                antialias: true,
                pixelRatioCap: 2
            }
        };
        
        // Export presets
        this.presets = {
            emoji: {
                resolution: 128,
                backgroundColor: 'transparent',
                filename: 'clayable-emoji.png',
                label: 'Emoji'
            },
            sticker: {
                resolution: 512,
                backgroundColor: 'transparent',
                filename: 'clayable-sticker.png',
                label: 'Sticker'
            },
            hires: {
                resolution: 1024,
                backgroundColor: 'transparent',
                filename: 'clayable-hires.png',
                label: 'High-Res'
            }
        };
    }

    /**
     * MAIN EXPORT FUNCTION
     * Applies Clayable style system and exports image
     */
    async exportAsImage(options = {}) {
        const {
            preset = 'sticker',
            filename = null,
            resolution = null,
            backgroundColor = 'transparent',
            skipAutoDownload = false,
            mainCamera = null,
            orbitControls = null
        } = options;

        let mainCamSnapshot = null;
        try {
            // Get preset settings
            const presetConfig = this.presets[preset] || this.presets.sticker;
            const finalResolution = resolution || presetConfig.resolution;
            const finalFilename = filename || presetConfig.filename;

            // Create isolated export scene
            const exportScene = new THREE.Scene();
            exportScene.background = backgroundColor === 'transparent' 
                ? null 
                : new THREE.Color(backgroundColor);

            // Clone and apply Clayable style
            const clayClone = this.clayObject.ball.clone();
            this.applyStylingMatrix(clayClone);
            exportScene.add(clayClone);

            const isEmoji = preset === 'emoji';

            let exportCamera;
            if (isEmoji) {
                const { camera, center } = this.createEmojiFrontCamera(clayClone, 0.9);
                exportCamera = camera;
                if (mainCamera) {
                    mainCamSnapshot = {
                        position: mainCamera.position.clone(),
                        quaternion: mainCamera.quaternion.clone(),
                        target: orbitControls ? orbitControls.target.clone() : null
                    };
                    mainCamera.position.copy(exportCamera.position);
                    mainCamera.quaternion.copy(exportCamera.quaternion);
                    if (orbitControls) {
                        orbitControls.target.copy(center);
                        orbitControls.update();
                    }
                }
            } else {
                const shadow = this.createClayableShadow();
                exportScene.add(shadow);
                exportCamera = this.createClayableCamera(clayClone);
            }

            // Setup Clayable lighting
            this.setupClayableLighting(exportScene);

            // Render with quality settings
            const imageData = await this.renderHighQuality(
                exportScene,
                exportCamera,
                finalResolution,
                backgroundColor === 'transparent'
            );

            if (skipAutoDownload) {
                return {
                    success: true,
                    imageData,
                    preset,
                    filename: finalFilename,
                    resolution: finalResolution,
                    timestamp: new Date().toISOString(),
                    message: 'export ready'
                };
            }
            this.downloadImage(imageData, finalFilename);
            return {
                success: true,
                filename: finalFilename,
                message: `exported ${finalFilename}`
            };

        } catch (error) {
            console.error('Export error:', error);
            return {
                success: false,
                error: error.message
            };
        } finally {
            if (mainCamSnapshot && mainCamera) {
                mainCamera.position.copy(mainCamSnapshot.position);
                mainCamera.quaternion.copy(mainCamSnapshot.quaternion);
                if (orbitControls && mainCamSnapshot.target) {
                    orbitControls.target.copy(mainCamSnapshot.target);
                    orbitControls.update();
                }
            }
        }
    }

    /**
     * APPLY CLAYABLE STYLING MATRIX
     * Transforms material to match Clayable aesthetic
     * Material becomes: soft, slightly glossy, clay-like, optimized for lighting
     */
    applyStylingMatrix(mesh) {
        const hasVertexColors = !!mesh.geometry.getAttribute('color');
        const material = new THREE.MeshStandardMaterial({
            color: mesh.material.color,
            roughness: this.CLAY_STYLE.material.roughness,
            metalness: this.CLAY_STYLE.material.metalness,
            clearcoat: this.CLAY_STYLE.material.clearcoat,
            clearcoatRoughness: 0.3,  // Give clay a soft sheen
            envMapIntensity: 0.6,
            side: THREE.FrontSide,
            vertexColors: hasVertexColors
        });

        mesh.material = material;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
    }

    /**
     * CLAYABLE LIGHTING SETUP
     * Signature three-light studio setup:
     * 1. Ambient (base visibility)
     * 2. Key light (main directional highlight)
     * 3. Fill light (shadows softening)
     * 4. Back light (rim/separation)
     */
    setupClayableLighting(scene) {
        const { lighting } = this.CLAY_STYLE;

        // Ambient Light - soft base
        const ambientLight = new THREE.AmbientLight(
            lighting.ambient.color,
            lighting.ambient.intensity
        );
        scene.add(ambientLight);

        // Key Light - main directional from top-right
        const keyLight = new THREE.DirectionalLight(
            lighting.keyLight.color,
            lighting.keyLight.intensity
        );
        const keyPos = lighting.keyLight.position;
        keyLight.position.set(keyPos.x, keyPos.y, keyPos.z);
        keyLight.castShadow = true;

        // High-quality shadows
        keyLight.shadow.mapSize.width = 2048;
        keyLight.shadow.mapSize.height = 2048;
        keyLight.shadow.camera.left = -8;
        keyLight.shadow.camera.right = 8;
        keyLight.shadow.camera.top = 8;
        keyLight.shadow.camera.bottom = -8;
        keyLight.shadow.camera.far = 20;
        keyLight.shadow.bias = -0.001;
        keyLight.shadow.blurSamples = 16;

        scene.add(keyLight);

        // Fill Light - soft secondary from opposite side
        const fillLight = new THREE.DirectionalLight(
            lighting.fillLight.color,
            lighting.fillLight.intensity
        );
        const fillPos = lighting.fillLight.position;
        fillLight.position.set(fillPos.x, fillPos.y, fillPos.z);
        scene.add(fillLight);

        // Back Light - rim lighting for separation
        const backLight = new THREE.DirectionalLight(
            lighting.backLight.color,
            lighting.backLight.intensity
        );
        const backPos = lighting.backLight.position;
        backLight.position.set(backPos.x, backPos.y, backPos.z);
        scene.add(backLight);
    }

    /**
     * CREATE CLAYABLE CAMERA
     * Positioned at signature 30-40° angle with auto-framing
     * 
     * Returns camera that:
     * - Views object at ~36° elevation
     * - Positioned ~28° to the side
     * - Automatically scales distance to fill 75-85% of frame
     * - Centers object perfectly
     */
    createClayableCamera(clayObject) {
        const camera = new THREE.PerspectiveCamera(
            this.CLAY_STYLE.camera.fov,
            1,  // 1:1 square aspect
            0.1,
            1000
        );

        // Calculate bounding sphere for auto-framing
        clayObject.geometry.computeBoundingSphere();
        const boundingSphere = clayObject.geometry.boundingSphere;
        const objectRadius = boundingSphere.radius;

        // Calculate camera distance to achieve target frame fill
        // targetFrameFill = 0.80 means object should take 80% of frame
        const vFOV = THREE.MathUtils.degToRad(camera.fov / 2);
        const requiredDistance = objectRadius / Math.sin(vFOV) / (this.CLAY_STYLE.framing.targetFrameFill / 2);

        // Position camera at signature angle
        const angleX = THREE.MathUtils.degToRad(this.CLAY_STYLE.camera.angleX);
        const angleY = THREE.MathUtils.degToRad(this.CLAY_STYLE.camera.angleY);

        camera.position.set(
            requiredDistance * Math.sin(angleX),
            requiredDistance * Math.sin(angleY),
            requiredDistance * Math.cos(angleX) * Math.cos(angleY)
        );

        // Slight upward look for friendliness
        const lookOffset = this.CLAY_STYLE.camera.lookAtOffset;
        camera.lookAt(
            clayObject.position.x + lookOffset.x,
            clayObject.position.y + lookOffset.y,
            clayObject.position.z + lookOffset.z
        );

        camera.updateProjectionMatrix();
        return camera;
    }

    /**
     * Front-facing emoji snapshot: camera on +Z, centered on mesh AABB,
     * distance chosen so projected corners reach ~fillRatio of the NDC frame (default 90%).
     */
    createEmojiFrontCamera(mesh, fillRatio = 0.9) {
        mesh.updateWorldMatrix(true, false);
        const box = new THREE.Box3().setFromObject(mesh);
        const center = new THREE.Vector3();
        if (box.isEmpty()) {
            box.setFromCenterAndSize(new THREE.Vector3(0, 0, 0), new THREE.Vector3(2, 2, 2));
        }
        box.getCenter(center);

        const corners = [
            new THREE.Vector3(box.min.x, box.min.y, box.min.z),
            new THREE.Vector3(box.max.x, box.min.y, box.min.z),
            new THREE.Vector3(box.min.x, box.max.y, box.min.z),
            new THREE.Vector3(box.min.x, box.min.y, box.max.z),
            new THREE.Vector3(box.max.x, box.max.y, box.min.z),
            new THREE.Vector3(box.max.x, box.min.y, box.max.z),
            new THREE.Vector3(box.min.x, box.max.y, box.max.z),
            new THREE.Vector3(box.max.x, box.max.y, box.max.z)
        ];

        const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 2000);

        const maxNdcXY = (dist) => {
            camera.position.set(center.x, center.y, center.z + dist);
            camera.lookAt(center);
            camera.updateProjectionMatrix();
            camera.updateMatrixWorld(true);
            let m = 0;
            for (let i = 0; i < corners.length; i++) {
                const p = corners[i].clone().project(camera);
                if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return Infinity;
                m = Math.max(m, Math.abs(p.x), Math.abs(p.y));
            }
            return m;
        };

        let a = 0.05;
        for (let i = 0; i < 80 && maxNdcXY(a) < fillRatio && a > 1e-5; i++) {
            a *= 0.88;
        }

        let b = Math.max(a * 2, 0.2);
        for (let i = 0; i < 80 && maxNdcXY(b) > fillRatio && b < 8000; i++) {
            b *= 1.12;
        }

        if (maxNdcXY(a) < fillRatio || maxNdcXY(b) > fillRatio || !(a < b)) {
            const dist = 5;
            camera.position.set(center.x, center.y, center.z + dist);
            camera.lookAt(center);
            camera.updateProjectionMatrix();
            return { camera, center };
        }

        for (let i = 0; i < 44; i++) {
            const mid = (a + b) * 0.5;
            if (maxNdcXY(mid) > fillRatio) a = mid;
            else b = mid;
        }

        const dist = (a + b) * 0.5;
        camera.position.set(center.x, center.y, center.z + dist);
        camera.lookAt(center);
        camera.updateProjectionMatrix();
        return { camera, center };
    }

    /**
     * CREATE CLAYABLE SHADOW
     * Soft contact shadow for grounding and depth
     * Uses shadow material with subtle opacity
     */
    createClayableShadow() {
        const shadowGeometry = new THREE.PlaneGeometry(8, 8);
        const shadowMaterial = new THREE.ShadowMaterial({
            opacity: this.CLAY_STYLE.shadow.opacity
        });

        const shadowPlane = new THREE.Mesh(shadowGeometry, shadowMaterial);
        shadowPlane.rotation.x = -Math.PI / 2;
        shadowPlane.position.y = this.CLAY_STYLE.shadow.offsetY;
        shadowPlane.receiveShadow = true;

        return shadowPlane;
    }

    /**
     * RENDER HIGH QUALITY
     * Outputs high-DPI image respecting device pixel ratio
     */
    async renderHighQuality(scene, camera, resolution, transparentBackground = false) {
        const pixelRatio = Math.min(
            window.devicePixelRatio || 1,
            this.CLAY_STYLE.render.pixelRatioCap
        );

        const renderer = new THREE.WebGLRenderer({
            antialias: this.CLAY_STYLE.render.antialias,
            alpha: true,
            preserveDrawingBuffer: true
        });

        renderer.setSize(resolution, resolution);
        renderer.setPixelRatio(pixelRatio);
        if (transparentBackground) {
            renderer.setClearColor(0x000000, 0);
        } else {
            renderer.setClearColor(0x000000, 1);
        }
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;

        renderer.render(scene, camera);

        // Extract image data
        const imageData = renderer.domElement.toDataURL('image/png');

        // Cleanup
        renderer.dispose();

        return imageData;
    }

    /**
     * DOWNLOAD IMAGE
     * Triggers browser download
     */
    downloadImage(dataUrl, filename) {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    /**
     * GET PRESETS
     * Returns all available export presets
     */
    static getPresets() {
        const exporter = new EmojiExporter(null, null);
        return exporter.presets;
    }
}

export { EmojiExporter };
