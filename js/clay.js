import * as THREE from './three.module.js';

class ClaySculptor {
    constructor(scene) {
        this.scene = scene; this.tool = 'push'; this.size = 0.8; this.str = 0.02;
        this.ball = null; this.verts = []; this.origPos = [];
        this.make();
    }

    make() {
        let geom = new THREE.SphereGeometry(2, 64, 32), mat = new THREE.MeshLambertMaterial({ color: 0xe8c291 }); 
        
        this.ball = new THREE.Mesh(geom, mat);
        this.ball.castShadow = true; this.ball.receiveShadow = true;
        this.scene.add(this.ball);
        
        this.verts = geom.attributes.position.array; this.origPos = [...this.verts]; 
    }

    setTool(t) { this.tool = t; }
    setBrushSize(s) { this.size = s; }
    setStrength(s) { this.str = s; }
    setColor(c) { this.ball.material.color.setHex(c); }

    moldClay(x, y, z, isTouch = false) {
        let pos = new THREE.Vector3(x, y, z), geom = this.ball.geometry;
        let verts = geom.attributes.position.array, affected = 0;
        
        for (let i = 0; i < verts.length; i += 3) {
            let v = new THREE.Vector3(verts[i], verts[i + 1], verts[i + 2]);
            let dist = v.distanceTo(pos);
            
            if (dist < this.size) {
                let factor = Math.pow(1 - (dist / this.size), 2); 
                this[this.tool](i, v, pos, factor, isTouch); 
                affected++;
            }
        }
        
        console.log('sculpting at', pos.x.toFixed(2), pos.y.toFixed(2), pos.z.toFixed(2), 'hit', affected, 'verts');
        geom.attributes.position.needsUpdate = true; geom.computeVertexNormals(); 
    }

    push(i, v, pt, factor, isTouch) {
        let dir = v.clone().normalize();
        let amt = this.str * factor * (isTouch ? 4 : 3); 
        
        this.verts[i] -= dir.x * amt;
        this.verts[i + 1] -= dir.y * amt;
        this.verts[i + 2] -= dir.z * amt;
    }

    pull(i, v, pt, factor, isTouch) {
        let dir = v.clone().normalize();
        let amt = this.str * factor * (isTouch ? 5 : 4); 
        
        this.verts[i] += dir.x * amt;
        this.verts[i + 1] += dir.y * amt;
        this.verts[i + 2] += dir.z * amt;
    }

    smooth(i, v, pt, factor, isTouch) {
        let original = new THREE.Vector3(this.origPos[i], this.origPos[i + 1], this.origPos[i + 2]);
        let amt = this.str * factor * (isTouch ? 1.5 : 1) * 0.8; 
        
        this.verts[i] += (original.x - this.verts[i]) * amt;
        this.verts[i + 1] += (original.y - this.verts[i + 1]) * amt;
        this.verts[i + 2] += (original.z - this.verts[i + 2]) * amt;
    }

    pinch(i, v, pt, factor, isTouch) {
        let dir = pt.clone().sub(v).normalize();
        let amt = this.str * factor * (isTouch ? 6 : 5); 
        
        this.verts[i] += dir.x * amt;
        this.verts[i + 1] += dir.y * amt;
        this.verts[i + 2] += dir.z * amt;
    }

    inflate(i, v, pt, factor, isTouch) {
        let dir = v.clone().normalize();
        let amt = this.str * factor * (isTouch ? 3 : 2);
        
        this.verts[i] += dir.x * amt;
        this.verts[i + 1] += dir.y * amt;
        this.verts[i + 2] += dir.z * amt;
    }

    resetClay() {
        for (let i = 0; i < this.verts.length; i++) {
            this.verts[i] = this.origPos[i];
        }
        
        this.ball.geometry.attributes.position.needsUpdate = true;
        this.ball.geometry.computeVertexNormals();
    }
}

export { ClaySculptor };