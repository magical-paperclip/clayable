import * as THREE from './three.module.js';

class ClaySculptor {
    constructor(scene) {
        this.scene = scene;
        this.tool = 'push';
        this.size = 0.3;
        this.str = 0.02;
        this.ball = null;
        this.verts = [];
        this.origPos = [];
        this.make();
    }

    make() {
        let geom = new THREE.SphereGeometry(2, 64, 32);
        let mat = new THREE.MeshLambertMaterial({ color: 0xe8c291 });
        
        this.ball = new THREE.Mesh(geom, mat);
        this.ball.castShadow = true;
        this.ball.receiveShadow = true;
        this.scene.add(this.ball);
        
        this.verts = geom.attributes.position.array;
        this.origPos = [...this.verts]; // copy for reset
    }

    setTool(t) { this.tool = t; }
    setBrushSize(s) { this.size = s; }
    setStrength(s) { this.str = s; }
    setColor(c) { this.ball.material.color.setHex(c); }

    moldClay(x, y, z, isTouch = false) {
        let pos = new THREE.Vector3(x, y, z);
        let geom = this.ball.geometry;
        let verts = geom.attributes.position.array;
        
        for (let i = 0; i < verts.length; i += 3) {
            let v = new THREE.Vector3(verts[i], verts[i + 1], verts[i + 2]);
            let dist = v.distanceTo(pos);
            
            if (dist < this.size) {
                let factor = 1 - (dist / this.size);
                factor = Math.pow(factor, 2); // smooth falloff
                
                this[this.tool](i, v, pos, factor, isTouch);
            }
        }
        
        geom.attributes.position.needsUpdate = true;
        geom.computeVertexNormals();
    }

    push(i, v, pt, factor, isTouch) {
        let dir = v.clone().normalize();
        let amt = this.str * factor * (isTouch ? 2 : 1);
        
        this.verts[i] -= dir.x * amt;
        this.verts[i + 1] -= dir.y * amt;
        this.verts[i + 2] -= dir.z * amt;
    }

    pull(i, v, pt, factor, isTouch) {
        let dir = v.clone().normalize();
        let amt = this.str * factor * (isTouch ? 2 : 1);
        
        this.verts[i] += dir.x * amt;
        this.verts[i + 1] += dir.y * amt;
        this.verts[i + 2] += dir.z * amt;
    }

    smooth(i, v, pt, factor, isTouch) {
        let target = v.clone().normalize().multiplyScalar(2);
        let amt = this.str * factor * 0.5 * (isTouch ? 1.5 : 1);
        
        this.verts[i] += (target.x - this.verts[i]) * amt;
        this.verts[i + 1] += (target.y - this.verts[i + 1]) * amt;
        this.verts[i + 2] += (target.z - this.verts[i + 2]) * amt;
    }

    pinch(i, v, pt, factor, isTouch) {
        let dir = pt.clone().sub(v).normalize();
        let amt = this.str * factor * 1.5 * (isTouch ? 2 : 1);
        
        this.verts[i] += dir.x * amt;
        this.verts[i + 1] += dir.y * amt;
        this.verts[i + 2] += dir.z * amt;
    }

    inflate(i, v, pt, factor, isTouch) {
        let dir = v.clone().normalize();
        let amt = this.str * factor * 0.8 * (isTouch ? 1.5 : 1);
        
        this.verts[i] += dir.x * amt;
        this.verts[i + 1] += dir.y * amt;
        this.verts[i + 2] += dir.z * amt;
    }

    resetClay() {
        // restore original positions
        for (let i = 0; i < this.verts.length; i++) {
            this.verts[i] = this.origPos[i];
        }
        
        this.ball.geometry.attributes.position.needsUpdate = true;
        this.ball.geometry.computeVertexNormals();
    }
}

export { ClaySculptor };