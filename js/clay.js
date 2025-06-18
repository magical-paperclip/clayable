import * as THREE from './three.module.js';

export class ClaySculptor {
    constructor(scene) {
        this.scene = scene;
        this.ball = null;
        this.geo = null;
        this.mat = null;
        this.origVerts = null;
        this.color = 0xe8c291;
        
        // tools
        this.tool = 'push';
        this.brushSize = 0.3;
        this.strength = 0.02;
        
        this.createClayBall();
    }
    
    createClayBall() {
        let r = 1.2, w = 80, h = 40;
        
        this.geo = new THREE.SphereGeometry(r, w, h);
        
        this.origVerts = this.geo.attributes.position.array.slice();
        
        this.mat = new THREE.MeshPhongMaterial({
            color: this.color,
            shininess: 30,
            specular: 0x222222
        });
        
        this.ball = new THREE.Mesh(this.geo, this.mat);
        this.ball.castShadow = true;
        this.ball.receiveShadow = true;
        
        this.scene.add(this.ball);
    }
    
    setColor(c) {
        this.color = c;
        if (this.mat) this.mat.color.setHex(c);
    }
    
    setTool(tool) {
        this.tool = tool;
    }
    
    setBrushSize(size) {
        this.brushSize = size;
    }
    
    setStrength(str) {
        this.strength = str;
    }
    
    moldClay(x, y, z, isTouch = false) {
        if (!this.geo) return;
        
        let pt = new THREE.Vector3(x, y, z);
        let pos = this.geo.attributes.position;
        let v = new THREE.Vector3();
        
        if (this.tool === 'push') {
            this.pushTool(pt, pos, v);
        } else if (this.tool === 'pull') {
            this.pullTool(pt, pos, v);
        } else if (this.tool === 'smooth') {
            this.smoothTool(pt, pos, v);
        } else if (this.tool === 'pinch') {
            this.pinchTool(pt, pos, v);
        } else if (this.tool === 'inflate') {
            this.inflateTool(pt, pos, v);
        }
        
        pos.needsUpdate = true;
        this.geo.computeVertexNormals();
    }
    
    pushTool(pt, pos, v) {
        for (let i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i);
            let d = v.distanceTo(pt);
            
            if (d < this.brushSize) {
                let inf = 1 - (d / this.brushSize);
                let dir = v.clone().sub(pt).normalize();
                
                let amt = inf * inf * this.strength;
                v.add(dir.multiplyScalar(amt));
                
                pos.setXYZ(i, v.x, v.y, v.z);
            }
        }
    }
    
    pullTool(pt, pos, v) {
        for (let i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i);
            let d = v.distanceTo(pt);
            
            if (d < this.brushSize) {
                let inf = 1 - (d / this.brushSize);
                let dir = pt.clone().sub(v).normalize();
                
                let amt = inf * inf * this.strength * 0.8;
                v.add(dir.multiplyScalar(amt));
                
                pos.setXYZ(i, v.x, v.y, v.z);
            }
        }
    }
    
    smoothTool(pt, pos, v) {
        let avgPos = new THREE.Vector3();
        let count = 0;
        
        // calc avg position
        for (let i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i);
            let d = v.distanceTo(pt);
            
            if (d < this.brushSize) {
                avgPos.add(v);
                count++;
            }
        }
        
        if (count > 0) {
            avgPos.divideScalar(count);
            
            // blend to avg
            for (let i = 0; i < pos.count; i++) {
                v.fromBufferAttribute(pos, i);
                let d = v.distanceTo(pt);
                
                if (d < this.brushSize) {
                    let inf = 1 - (d / this.brushSize);
                    let blend = inf * this.strength * 2;
                    
                    v.lerp(avgPos, Math.min(blend, 0.5));
                    pos.setXYZ(i, v.x, v.y, v.z);
                }
            }
        }
    }
    
    pinchTool(pt, pos, v) {
        for (let i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i);
            let d = v.distanceTo(pt);
            
            if (d < this.brushSize) {
                let inf = 1 - (d / this.brushSize);
                let dir = pt.clone().sub(v).normalize();
                
                let amt = inf * inf * inf * this.strength * 1.5;
                v.add(dir.multiplyScalar(amt));
                
                pos.setXYZ(i, v.x, v.y, v.z);
            }
        }
    }
    
    inflateTool(pt, pos, v) {
        let center = new THREE.Vector3(0, 0, 0);
        
        for (let i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i);
            let d = v.distanceTo(pt);
            
            if (d < this.brushSize) {
                let inf = 1 - (d / this.brushSize);
                let dir = v.clone().sub(center).normalize();
                
                let amt = inf * inf * this.strength * 0.6;
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
        
        pos.needsUpdate = true;
        this.geo.computeVertexNormals();
    }
} 