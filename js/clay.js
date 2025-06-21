import * as THREE from './three.module.js';

export class ClaySculptor {
    constructor(scene) {
        this.scene = scene;
        this.ball = null; this.geo = null; this.mat = null; this.origVerts = null;
        this.color = 0xe8c291;
        this.tool = 'push'; this.size = 0.3; this.str = 0.02;
        this.make();
    }
    
    make() {
        let r = 1.2, w = 80, h = 40;
        this.geo = new THREE.SphereGeometry(r, w, h);
        this.origVerts = this.geo.attributes.position.array.slice();
        
        this.mat = new THREE.MeshPhongMaterial({ color: this.color, shininess: 30, specular: 0x222222 });
        this.ball = new THREE.Mesh(this.geo, this.mat);
        this.ball.castShadow = true; this.ball.receiveShadow = true;
        this.scene.add(this.ball);
    }
    
    setColor(c) {
        this.color = c;
        if (this.ball && this.mat) {
            let newMat = new THREE.MeshPhongMaterial({ color: c, shininess: 30, specular: 0x222222 });
            this.ball.material = newMat; this.mat = newMat;
        }
    }
    
    setTool(t) { this.tool = t; }
    setBrushSize(s) { this.size = s; }
    setStrength(s) { this.str = s; }

    moldClay(x, y, z, touch = false) {
        if (!this.geo) return;
        
        let pt = new THREE.Vector3(x, y, z);
        let pos = this.geo.attributes.position;
        let v = new THREE.Vector3();
        
        if (this.tool === 'push') {
            this.push(pt, pos, v);
        } else if (this.tool === 'pull') {
            this.pull(pt, pos, v);
        } else if (this.tool === 'smooth') {
            this.smooth(pt, pos, v);
        } else if (this.tool === 'pinch') {
            this.pinch(pt, pos, v);
        } else if (this.tool === 'inflate') {
            this.inflate(pt, pos, v);
        }
        
        pos.needsUpdate = true;
        this.geo.computeVertexNormals();
    }
    
    push(pt, pos, v) {
        let center = new THREE.Vector3(0, 0, 0);
        
        for (let i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i);
            let d = v.distanceTo(pt);
            
            if (d < this.size) {
                let inf = 1 - (d / this.size);
                let dir = center.clone().sub(v).normalize();
                
                let amt = inf * inf * this.str;
                v.add(dir.multiplyScalar(amt));
                
                pos.setXYZ(i, v.x, v.y, v.z);
            }
        }
    }
    
    pull(pt, pos, v) {
        for (let i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i);
            let d = v.distanceTo(pt);
            
            if (d < this.size) {
                let inf = 1 - (d / this.size);
                let dir = pt.clone().sub(v).normalize();
                
                let amt = inf * inf * this.str * 0.8;
                v.add(dir.multiplyScalar(amt));
                
                pos.setXYZ(i, v.x, v.y, v.z);
            }
        }
    }
    
    smooth(pt, pos, v) {
        let avg = new THREE.Vector3();
        let count = 0;
        
        for (let i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i);
            let d = v.distanceTo(pt);
            
            if (d < this.size) {
                avg.add(v);
                count++;
            }
        }
        
        if (count > 0) {
            avg.divideScalar(count);
            
            for (let i = 0; i < pos.count; i++) {
                v.fromBufferAttribute(pos, i);
                let d = v.distanceTo(pt);
                
                if (d < this.size) {
                    let inf = 1 - (d / this.size);
                    let blend = inf * this.str * 2;
                    
                    v.lerp(avg, Math.min(blend, 0.5));
                    pos.setXYZ(i, v.x, v.y, v.z);
                }
            }
        }
    }
    
    pinch(pt, pos, v) {
        for (let i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i);
            let d = v.distanceTo(pt);
            
            if (d < this.size) {
                let inf = 1 - (d / this.size);
                let dir = pt.clone().sub(v).normalize();
                
                let amt = inf * inf * inf * this.str * 1.5;
                v.add(dir.multiplyScalar(amt));
                
                pos.setXYZ(i, v.x, v.y, v.z);
            }
        }
    }
    
    inflate(pt, pos, v) {
        let center = new THREE.Vector3(0, 0, 0);
        
        for (let i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i);
            let d = v.distanceTo(pt);
            
            if (d < this.size) {
                let inf = 1 - (d / this.size);
                let dir = v.clone().sub(center).normalize();
                
                let amt = inf * inf * this.str * 0.6;
                v.add(dir.multiplyScalar(amt));
                
                pos.setXYZ(i, v.x, v.y, v.z);
            }
        }
    }
    
    resetClay() {
        if (!this.geo || !this.origVerts) return;
        let pos = this.geo.attributes.position;
        for (let i = 0; i < this.origVerts.length; i++) 
            pos.array[i] = this.origVerts[i];
        pos.needsUpdate = true; this.geo.computeVertexNormals();
    }
}