import * as THREE from './three.module.js';

export class ClaySculptor {
    constructor(world) {
        this.world = world;
        this.ballRadius = 1.2;
        this.color = 0xe8c291;
        this.originalPositions = null;
        
        this.createClayBall();
    }
    
    createClayBall() {
        const geo = new THREE.SphereGeometry(this.ballRadius, 64, 32);
        const mat = new THREE.MeshLambertMaterial({
            color: this.color,
            side: THREE.FrontSide
        });
        
        this.clayBall = new THREE.Mesh(geo, mat);
        this.clayBall.position.set(0, 0, 0);
        this.clayBall.castShadow = true;
        this.clayBall.receiveShadow = true;
        
        this.world.add(this.clayBall);
        
        const positions = this.clayBall.geometry.attributes.position;
        this.originalPositions = new Float32Array(positions.array);
        
        return this.clayBall;
    }
    
    setColor(newColor) {
        this.color = newColor;
        if (this.clayBall && this.clayBall.material) {
            this.clayBall.material.color.setHex(newColor);
        }
    }
    

    
    resetClay() {
        const positions = this.clayBall.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            positions.setXYZ(
                i,
                this.originalPositions[i * 3],
                this.originalPositions[i * 3 + 1],
                this.originalPositions[i * 3 + 2]
            );
        }
        
        positions.needsUpdate = true;
        this.clayBall.geometry.computeVertexNormals();
    }
    
    moldClay(x, y, z, size, strength) {
        const moldPos = new THREE.Vector3(x, y, z);
        
        const positions = this.clayBall.geometry.attributes.position;
        const originalPositions = this.originalPositions;
        
        for (let i = 0; i < positions.count; i++) {
            const vertex = new THREE.Vector3(
                positions.getX(i),
                positions.getY(i),
                positions.getZ(i)
            );
            
            const distance = vertex.distanceTo(moldPos);
            const falloff = size;
            
            if (distance < falloff) {
                const influence = 1 - (distance / falloff);
                const smoothInfluence = influence * influence * (3 - 2 * influence);
                
                const direction = vertex.clone().normalize();
                const deformation = smoothInfluence * strength;
                
                const newVertex = vertex.clone().sub(direction.multiplyScalar(deformation));
                positions.setXYZ(i, newVertex.x, newVertex.y, newVertex.z);
            }
        }
        
        positions.needsUpdate = true;
        this.clayBall.geometry.computeVertexNormals();
        
        return this.clayBall;
    }
} 