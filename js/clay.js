import * as THREE from './three.module.js';

class ClaySculptor {
    constructor(scene) {
        this.scene = scene;
        this.tool = 'pull';
        this.size = 0.8;
        this.str = 0.15;
        this.ball = null;
        this.verts = [];
        this.origPos = [];
        this.replayPlaybackActive = false;
        this.sculptHistoryTarget = null;
        this.sculptResponse = 1;
        this.physicalMaterialId = 'wetClay';
        this.neighborList = [];
        this.sphereSegW = 256;
        this.sphereSegH = 256;
        /** grab / drag: brush delta per moldClay call */
        this._pickLastWorld = null;
        this._pickDelta = new THREE.Vector3(0, 0, 0);
        /** snapshot of normals at stroke start (inflate) */
        this._snNormals = null;
        this.make();
    }

    simpleNoise(x, y, z) {
        return Math.sin(x * 12.9898 + y * 78.233 + z * 43.141) * 0.5 + 0.5;
    }

    perlinNoise(x, y, z, octaves = 2) {
        let value = 0;
        let amplitude = 1;
        let frequency = 1;
        let maxValue = 0;

        for (let i = 0; i < octaves; i++) {
            value += amplitude * (this.simpleNoise(x * frequency, y * frequency, z * frequency) * 2 - 1);
            maxValue += amplitude;
            amplitude *= 0.5;
            frequency *= 2;
        }

        return (value / maxValue + 1) * 0.5;
    }

    applySurfaceNoise(geom, amount = 0.08) {
        const pos = geom.attributes.position.array;

        for (let i = 0; i < pos.length; i += 3) {
            const x = pos[i];
            const y = pos[i + 1];
            const z = pos[i + 2];

            const noise = this.perlinNoise(x, y, z, 3);

            const vector = new THREE.Vector3(x, y, z);
            const normal = vector.clone().normalize();
            const displacement = (noise - 0.5) * amount;

            pos[i] += normal.x * displacement;
            pos[i + 1] += normal.y * displacement;
            pos[i + 2] += normal.z * displacement;
        }

        geom.attributes.position.needsUpdate = true;
        geom.computeVertexNormals();
    }

    buildNeighborList(geom) {
        const count = geom.attributes.position.count;
        const sets = Array.from({ length: count }, () => new Set());
        const index = geom.index;
        if (index) {
            for (let f = 0; f < index.count; f += 3) {
                const a = index.getX(f);
                const b = index.getX(f + 1);
                const c = index.getX(f + 2);
                sets[a].add(b);
                sets[a].add(c);
                sets[b].add(a);
                sets[b].add(c);
                sets[c].add(a);
                sets[c].add(b);
            }
        } else {
            for (let i = 0; i < count; i++) {
                if (i > 0) sets[i].add(i - 1);
                if (i < count - 1) sets[i].add(i + 1);
            }
        }
        this.neighborList = sets.map((s) => Array.from(s));
    }

    make() {
        const geom = new THREE.SphereGeometry(2, this.sphereSegW, this.sphereSegH);

        const posLength = geom.attributes.position.array.length;
        const colorArray = new Float32Array(posLength);
        for (let i = 0; i < colorArray.length; i += 3) {
            colorArray[i] = 0.93;
            colorArray[i + 1] = 0.76;
            colorArray[i + 2] = 0.57;
        }
        geom.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));

        const mat = new THREE.MeshStandardMaterial({
            color: 0xe8c291,
            roughness: 0.4,
            metalness: 0.05,
            clearcoat: 0,
            clearcoatRoughness: 0.5,
            envMapIntensity: 1,
            vertexColors: true,
            flatShading: false
        });
        mat.flatShading = false;

        this.ball = new THREE.Mesh(geom, mat);
        this.ball.castShadow = true;
        this.ball.receiveShadow = true;
        this.ball.visible = true;
        this.scene.add(this.ball);

        this.buildNeighborList(geom);

        this.verts = geom.attributes.position.array;
        this.origPos = [...this.verts];
        geom.computeVertexNormals();
    }

    setTool(t) {
        this.tool = t;
    }
    setBrushSize(s) {
        this.size = s;
    }
    setStrength(s) {
        this.str = s;
    }
    setColor(c) {
        this.ball.material.color.setHex(c);
    }

    /** Ends a pick/grab stroke so the next sample starts fresh. */
    endPickStroke() {
        this._pickLastWorld = null;
        this._pickDelta.set(0, 0, 0);
    }

    getStretchMetric() {
        let maxR = 0;
        for (let i = 0; i < this.verts.length; i += 3) {
            const r = Math.hypot(this.verts[i], this.verts[i + 1], this.verts[i + 2]);
            if (r > maxR) maxR = r;
        }
        return maxR / 2 - 1;
    }

    refineMesh() {
        if (this.sphereSegW >= 256) {
            return false;
        }

        const oldGeom = this.ball.geometry;
        const oldPos = oldGeom.attributes.position.array;
        const oldColors = oldGeom.getAttribute('color');
        const oldCount = oldGeom.attributes.position.count;

        const oldDirs = new Float32Array(oldCount * 3);
        const oldLens = new Float32Array(oldCount);
        for (let vi = 0; vi < oldCount; vi++) {
            const i = vi * 3;
            const x = oldPos[i];
            const y = oldPos[i + 1];
            const z = oldPos[i + 2];
            const len = Math.hypot(x, y, z) || 1;
            oldLens[vi] = len;
            oldDirs[i] = x / len;
            oldDirs[i + 1] = y / len;
            oldDirs[i + 2] = z / len;
        }

        const newW = Math.min(this.sphereSegW * 2, 256);
        const newH = Math.min(this.sphereSegH * 2, 256);
        const newGeom = new THREE.SphereGeometry(2, newW, newH);
        const newCount = newGeom.attributes.position.count;
        const newColorArray = new Float32Array(newCount * 3);
        newGeom.setAttribute('color', new THREE.BufferAttribute(newColorArray, 3));

        const rest = new Float32Array(newGeom.attributes.position.array);
        const pos = newGeom.attributes.position.array;
        const colorAttr = newGeom.getAttribute('color');
        const newColors = colorAttr.array;

        const tmp = new THREE.Vector3();
        const dir = new THREE.Vector3();

        for (let vi = 0; vi < newCount; vi++) {
            const i = vi * 3;
            dir.set(rest[i], rest[i + 1], rest[i + 2]).normalize();

            let bestDot = -2;
            let bestLen = 2;
            let bestColor = [0.93, 0.76, 0.57];
            for (let oi = 0; oi < oldCount; oi++) {
                const j = oi * 3;
                const d =
                    dir.x * oldDirs[j] +
                    dir.y * oldDirs[j + 1] +
                    dir.z * oldDirs[j + 2];
                if (d > bestDot) {
                    bestDot = d;
                    bestLen = oldLens[oi];
                    if (oldColors) {
                        bestColor[0] = oldColors.getX(oi);
                        bestColor[1] = oldColors.getY(oi);
                        bestColor[2] = oldColors.getZ(oi);
                    }
                }
            }

            tmp.copy(dir).multiplyScalar(bestLen);
            pos[i] = tmp.x;
            pos[i + 1] = tmp.y;
            pos[i + 2] = tmp.z;

            newColors[i] = bestColor[0];
            newColors[i + 1] = bestColor[1];
            newColors[i + 2] = bestColor[2];
        }

        colorAttr.needsUpdate = true;

        newGeom.attributes.position.needsUpdate = true;
        newGeom.computeVertexNormals();

        this.ball.geometry.dispose();
        this.ball.geometry = newGeom;
        this.sphereSegW = newW;
        this.sphereSegH = newH;
        this.verts = newGeom.attributes.position.array;
        this.origPos = [...rest];
        this.buildNeighborList(newGeom);
        this.endPickStroke();

        return true;
    }

    _preparePickBrush(worldHit) {
        if (this.tool !== 'pick') return;
        if (this._pickLastWorld == null) {
            this._pickLastWorld = worldHit.clone();
            this._pickDelta.set(0, 0, 0);
        } else {
            this._pickDelta.subVectors(worldHit, this._pickLastWorld);
            this._pickLastWorld.copy(worldHit);
        }
    }

    /**
     * Gaussian thumb: exp(-(dist^2) / (2 * radius^2)) — soft dough, no spike cone.
     */
    _brushFalloff(dist) {
        const r = this.size;
        if (r <= 0 || dist > r * 1.05) return 0;
        return Math.exp(-(dist * dist) / (2 * r * r));
    }

    /**
     * Post push/pull relax on brush zone — blends neighbors to prevent tearing.
     */
    _relaxBrushRegion(brushCenter, isTouch) {
        const verts = this.verts;
        const snap = new Float32Array(verts);
        const count = verts.length / 3;
        const alphaBase = isTouch ? 0.34 : 0.27;
        for (let vi = 0; vi < count; vi++) {
            const i = vi * 3;
            const vx = snap[i];
            const vy = snap[i + 1];
            const vz = snap[i + 2];
            const d = Math.hypot(vx - brushCenter.x, vy - brushCenter.y, vz - brushCenter.z);
            const g = this._brushFalloff(d);
            if (g < 1e-5) continue;
            const nbrs = this.neighborList[vi];
            if (!nbrs || nbrs.length === 0) continue;
            let sx = 0;
            let sy = 0;
            let sz = 0;
            for (const j of nbrs) {
                const k = j * 3;
                sx += snap[k];
                sy += snap[k + 1];
                sz += snap[k + 2];
            }
            const inv = 1 / nbrs.length;
            const tx = sx * inv;
            const ty = sy * inv;
            const tz = sz * inv;
            const a = alphaBase * g * this.sculptResponse;
            verts[i] = vx + (tx - vx) * a;
            verts[i + 1] = vy + (ty - vy) * a;
            verts[i + 2] = vz + (tz - vz) * a;
        }
    }

    moldClay(x, y, z, isTouch = false) {
        const pos = new THREE.Vector3(x, y, z);
        if (this.sculptHistoryTarget && !this.replayPlaybackActive) {
            this.sculptHistoryTarget.push({
                x: pos.x,
                y: pos.y,
                z: pos.z,
                strength: this.str,
                radius: this.size,
                tool: this.tool,
                isTouch,
                sculptResponse: this.sculptResponse
            });
        }

        const sculptOp = this[this.tool];
        if (typeof sculptOp !== 'function') {
            return;
        }

        const geom = this.ball.geometry;
        const verts = geom.attributes.position.array;
        const na = geom.attributes.normal?.array;
        this._snNormals = na ? new Float32Array(na) : null;

        this._preparePickBrush(pos);

        const toolId = this.tool;
        for (let i = 0; i < verts.length; i += 3) {
            const v = new THREE.Vector3(verts[i], verts[i + 1], verts[i + 2]);
            const dist = v.distanceTo(pos);
            const factor = this._brushFalloff(dist);
            if (factor < 1e-6) continue;
            sculptOp.call(this, i, v, pos, factor, isTouch);
        }

        if (toolId === 'push' || toolId === 'pull') {
            this._relaxBrushRegion(pos, isTouch);
        }

        geom.attributes.position.needsUpdate = true;
        geom.computeVertexNormals();
        if (geom.attributes.normal) {
            geom.attributes.normal.needsUpdate = true;
        }
    }

    push(i, v, pt, factor, isTouch) {
        const dir = v.clone().normalize();
        const disp =
            this.str * this.sculptResponse * factor * (isTouch ? 4.25 : 3.65);

        this.verts[i] -= dir.x * disp;
        this.verts[i + 1] -= dir.y * disp;
        this.verts[i + 2] -= dir.z * disp;
    }

    pull(i, v, pt, factor, isTouch) {
        const dir = v.clone().normalize();
        const disp =
            this.str * this.sculptResponse * factor * (isTouch ? 4.6 : 4.0);

        this.verts[i] += dir.x * disp;
        this.verts[i + 1] += dir.y * disp;
        this.verts[i + 2] += dir.z * disp;
    }

    /**
     * Laplacian smoothing: lerp vertex toward ring neighbor centroid.
     */
    smooth(i, v, pt, factor, isTouch) {
        const vi = i / 3;
        const nbrs = this.neighborList[vi];
        if (!nbrs || nbrs.length === 0) return;

        let sx = 0;
        let sy = 0;
        let sz = 0;
        for (const j of nbrs) {
            const k = j * 3;
            sx += this.verts[k];
            sy += this.verts[k + 1];
            sz += this.verts[k + 2];
        }
        const inv = 1 / nbrs.length;
        const neighborPos = new THREE.Vector3(sx * inv, sy * inv, sz * inv);
        const cur = new THREE.Vector3(this.verts[i], this.verts[i + 1], this.verts[i + 2]);
        const smoothingFactor = this.str * factor * (isTouch ? 0.68 : 0.58) * this.sculptResponse;
        cur.lerp(neighborPos, smoothingFactor);
        this.verts[i] = cur.x;
        this.verts[i + 1] = cur.y;
        this.verts[i + 2] = cur.z;
    }

    pick(i, v, pt, factor, isTouch) {
        const w = this.str * factor * (isTouch ? 5.5 : 4.6) * this.sculptResponse;
        this.verts[i] += this._pickDelta.x * w;
        this.verts[i + 1] += this._pickDelta.y * w;
        this.verts[i + 2] += this._pickDelta.z * w;
    }

    inflate(i, v, pt, factor, isTouch) {
        let nx;
        let ny;
        let nz;
        if (this._snNormals) {
            nx = this._snNormals[i];
            ny = this._snNormals[i + 1];
            nz = this._snNormals[i + 2];
        } else {
            const dir = v.clone().normalize();
            nx = dir.x;
            ny = dir.y;
            nz = dir.z;
        }
        const amt = this.str * factor * (isTouch ? 5 : 4) * this.sculptResponse;

        this.verts[i] += nx * amt;
        this.verts[i + 1] += ny * amt;
        this.verts[i + 2] += nz * amt;
    }

    resetMesh() {
        this.resetClay();
    }

    resetClay() {
        for (let i = 0; i < this.verts.length; i++) {
            this.verts[i] = this.origPos[i];
        }

        const colors = this.ball.geometry.getAttribute('color');
        if (colors) {
            const colorArray = colors.array;
            for (let i = 0; i < colorArray.length; i += 3) {
                colorArray[i] = 0.93;
                colorArray[i + 1] = 0.76;
                colorArray[i + 2] = 0.57;
            }
            colors.needsUpdate = true;
        }

        const geom = this.ball.geometry;
        geom.attributes.position.needsUpdate = true;
        geom.computeVertexNormals();
        if (geom.attributes.normal) {
            geom.attributes.normal.needsUpdate = true;
        }
        this.endPickStroke();
    }
}

export { ClaySculptor };
