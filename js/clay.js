import * as THREE from './three.module.js';

export class ClaySculptor {
    constructor(scene) {
        this.scene = scene;
        this.clayBall = null;
        this.clayGeometry = null;
        this.clayMaterial = null;
        this.originalVertices = null;
        this.currentColor = 0xe8c291;
        
        this.createClayBall();
    }
    
    createClayBall() {
        let radius = 1.2, widthSegs = 64, heightSegs = 32;
        
        this.clayGeometry = new THREE.SphereGeometry(radius, widthSegs, heightSegs);
        
        this.originalVertices = this.clayGeometry.attributes.position.array.slice();
        
        this.clayMaterial = new THREE.MeshPhongMaterial({
            color: this.currentColor,
            shininess: 30,
            specular: 0x222222
        });
        
        this.clayBall = new THREE.Mesh(this.clayGeometry, this.clayMaterial);
        this.clayBall.castShadow = true;
        this.clayBall.receiveShadow = true;
        
        this.scene.add(this.clayBall);
    }
    
    setColor(newColor) {
        this.currentColor = newColor;
        if (this.clayMaterial) {
            this.clayMaterial.color.setHex(newColor);
        }
    }
    
    moldClay(x, y, z, size, depth) {
        if (!this.clayGeometry) return;
        
        let moldPoint = new THREE.Vector3(x, y, z);
        let positions = this.clayGeometry.attributes.position;
        let vertex = new THREE.Vector3();
        
        for (let i = 0; i < positions.count; i++) {
            vertex.fromBufferAttribute(positions, i);
            
            let dist = vertex.distanceTo(moldPoint);
            
            if (dist < size) {
                let influence = 1 - (dist / size);
                let pushDir = vertex.clone().sub(moldPoint).normalize();
                
                let pushAmt = influence * influence * depth;
                vertex.add(pushDir.multiplyScalar(pushAmt));
                
                positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
            }
        }
        
        positions.needsUpdate = true;
        this.clayGeometry.computeVertexNormals();
    }
    
    resetClay() {
        if (!this.clayGeometry || !this.originalVertices) return;
        
        let positions = this.clayGeometry.attributes.position;
        
        for (let i = 0; i < this.originalVertices.length; i++) 
            positions.array[i] = this.originalVertices[i];
        
        positions.needsUpdate = true;
        this.clayGeometry.computeVertexNormals();
    }
} 