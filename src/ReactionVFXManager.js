// ReactionVFXManager.js — High-performance VFX engine for chemical reaction explosions.
// Object-pooled particles, multi-stage explosions (flash → shockwave → emitter → shake).
// All effects render as Three.js meshes in the existing scene.

import * as THREE from 'three';

const POOL_SIZE = 300;
const SHOCKWAVE_SEGMENTS = 48;

export class ReactionVFXManager {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.active = false;

    this.particlePool = [];
    this.activeParticles = [];
    this.shockwaves = [];
    this.flashState = null;
    this.shakeState = null;

    this._initSharedGeometries();
    this._initPool();
  }

  _initSharedGeometries() {
    this.geoSmall = new THREE.SphereGeometry(0.06, 6, 4);
    this.geoMed = new THREE.SphereGeometry(0.1, 6, 4);
    this.geoLarge = new THREE.SphereGeometry(0.18, 6, 4);
    this.geoSmoke = new THREE.SphereGeometry(0.2, 6, 4);
    this.geos = [this.geoSmall, this.geoMed, this.geoLarge];
  }

  _initPool() {
    for (let i = 0; i < POOL_SIZE; i++) {
      const geo = this.geos[i % 3];
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.particlePool.push({
        mesh, mat,
        v: new THREE.Vector3(),
        life: 0, decay: 0,
        gravity: false, expand: false,
        drag: 2,
      });
    }
  }

  _acquire() {
    if (this.particlePool.length > 0) return this.particlePool.pop();
    const geo = this.geos[Math.floor(Math.random() * 3)];
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    this.scene.add(mesh);
    return {
      mesh, mat,
      v: new THREE.Vector3(),
      life: 0, decay: 0,
      gravity: false, expand: false,
      drag: 2,
    };
  }

  _release(p) {
    p.mesh.visible = false;
    p.life = 0;
    p.v.set(0, 0, 0);
    this.particlePool.push(p);
  }

  // ── Multi-stage explosion ──

  explode(center, intensity = 1.0, color = 0xff6600) {
    this.active = true;
    const c = center.clone ? center : new THREE.Vector3(center.x, center.y, center.z);

    this._stageFlash(c, intensity, color);
    this._stageShockwave(c, intensity, color);
    this._stageParticles(c, intensity, color);
    this._stageSmoke(c, intensity);
    this._stageShake(intensity * 0.4, 500 * intensity);
  }

  // Exothermic glow — soft sparkles, no shake
  exothermicGlow(center, intensity = 0.5, color = 0xffaa44) {
    this.active = true;
    const c = center.clone ? center : new THREE.Vector3(center.x, center.y, center.z);
    const count = Math.floor(20 * intensity);
    const sparkColors = [color, 0xffcc44, 0xffee88, 0xff8800];

    for (let i = 0; i < count; i++) {
      const p = this._acquire();
      p.mesh.position.copy(c);
      p.mat.color.setHex(sparkColors[i % sparkColors.length]);
      p.mat.opacity = 1;
      p.mesh.visible = true;
      p.mesh.scale.setScalar(0.5 + Math.random() * 0.5);
      const dir = new THREE.Vector3(
        (Math.random() - 0.5),
        (Math.random() - 0.5),
        (Math.random() - 0.5)
      ).normalize();
      const speed = (0.5 + Math.random() * 2) * intensity;
      p.v.copy(dir).multiplyScalar(speed);
      p.life = 1.0;
      p.decay = 0.8 + Math.random() * 0.6;
      p.gravity = false;
      p.expand = false;
      p.drag = 3;
      this.activeParticles.push(p);
    }
  }

  // ── Stage 1: Core Flash ──

  _stageFlash(center, intensity, color) {
    if (this.flashState) {
      this.scene.remove(this.flashState.mesh);
      this.flashState.geo.dispose();
      this.flashState.mat.dispose();
    }
    const rMax = 2.0 * intensity;
    const geo = new THREE.SphereGeometry(rMax, 16, 12);
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(center);
    this.scene.add(mesh);
    this.flashState = {
      mesh, geo, mat,
      rMax, elapsed: 0, duration: 0.15,
    };
  }

  // ── Stage 2: Shockwave Ring ──

  _stageShockwave(center, intensity, color) {
    const ringGeo = new THREE.RingGeometry(0.1, 0.3, SHOCKWAVE_SEGMENTS);
    const ringMat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.7 * intensity,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(center);
    ring.lookAt(this.camera.position);
    this.scene.add(ring);

    this.shockwaves.push({
      mesh: ring, geo: ringGeo, mat: ringMat,
      elapsed: 0, duration: 0.6,
      maxRadius: 5.0 * intensity,
      intensity,
    });
  }

  // ── Stage 3: Particle Emitter ──

  _stageParticles(center, intensity, color) {
    const count = Math.min(Math.floor(80 * intensity), 150);
    const colors = [color, 0xff4400, 0xff8800, 0xffaa00, 0xffcc00, 0xffee66];

    for (let i = 0; i < count; i++) {
      const p = this._acquire();
      p.mesh.position.copy(center);
      p.mat.color.setHex(colors[Math.floor(Math.random() * colors.length)]);
      p.mat.opacity = 1;
      p.mesh.visible = true;
      p.mesh.scale.setScalar(0.6 + Math.random() * 0.8);

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const speed = (2 + Math.random() * 6) * intensity;
      const vVar = 1.5 * intensity;
      p.v.set(
        Math.sin(phi) * Math.cos(theta) * speed + (Math.random() - 0.5) * vVar,
        Math.sin(phi) * Math.sin(theta) * speed + (Math.random() - 0.5) * vVar,
        Math.cos(phi) * speed + (Math.random() - 0.5) * vVar,
      );

      p.life = 1.0;
      p.decay = 0.5 + Math.random() * 0.8;
      p.gravity = true;
      p.expand = false;
      p.drag = 2;
      this.activeParticles.push(p);
    }
  }

  // ── Stage 3b: Smoke ──

  _stageSmoke(center, intensity) {
    const count = Math.floor(12 * intensity);
    for (let i = 0; i < count; i++) {
      const p = this._acquire();
      p.mesh.position.copy(center).add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.3,
        (Math.random() - 0.5) * 0.5,
      ));
      p.mat.color.setHex(0x444444);
      p.mat.opacity = 0.5;
      p.mesh.visible = true;
      p.mesh.scale.setScalar(1);
      p.v.set(
        (Math.random() - 0.5) * 0.4,
        0.4 + Math.random() * 0.6,
        (Math.random() - 0.5) * 0.4,
      );
      p.life = 1.0;
      p.decay = 0.15 + Math.random() * 0.2;
      p.gravity = false;
      p.expand = true;
      p.drag = 1;
      this.activeParticles.push(p);
    }
  }

  // ── Stage 4: Camera Shake ──

  _stageShake(intensity, durationMs) {
    this.shakeState = {
      intensity, duration: durationMs / 1000,
      elapsed: 0,
      origPos: this.camera.position.clone(),
      offset: new THREE.Vector3(),
    };
  }

  // ── Full-screen flash (for annihilation, etc.) ──

  screenFlash(color = 0xffffff, durationMs = 400) {
    if (this.flashState) {
      this.scene.remove(this.flashState.mesh);
      this.flashState.geo.dispose();
      this.flashState.mat.dispose();
    }
    const geo = new THREE.SphereGeometry(50, 8, 6);
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.7,
      side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(this.camera.position);
    this.scene.add(mesh);
    this.flashState = {
      mesh, geo, mat,
      rMax: 50, elapsed: 0, duration: durationMs / 1000,
      fullscreen: true,
    };
  }

  // ── Per-frame update ──

  update(dt) {
    let hasActive = false;

    hasActive = this._updateParticles(dt) || hasActive;
    hasActive = this._updateShockwaves(dt) || hasActive;
    hasActive = this._updateFlash(dt) || hasActive;
    hasActive = this._updateShake(dt) || hasActive;

    this.active = hasActive;
    return hasActive;
  }

  _updateParticles(dt) {
    for (let i = this.activeParticles.length - 1; i >= 0; i--) {
      const p = this.activeParticles[i];
      p.life -= dt * p.decay;

      if (p.life <= 0) {
        this._release(p);
        this.activeParticles.splice(i, 1);
        continue;
      }

      p.mesh.position.addScaledVector(p.v, dt);

      if (p.gravity) p.v.y -= dt * 4;
      p.v.multiplyScalar(1 - dt * p.drag);
      p.mat.opacity = Math.max(0, p.life);

      if (p.expand) {
        const s = 1 + (1 - p.life) * 3;
        p.mesh.scale.setScalar(s);
      }
    }
    return this.activeParticles.length > 0;
  }

  _updateShockwaves(dt) {
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.elapsed += dt;
      const t = sw.elapsed / sw.duration;

      if (t >= 1) {
        this.scene.remove(sw.mesh);
        sw.geo.dispose();
        sw.mat.dispose();
        this.shockwaves.splice(i, 1);
        continue;
      }

      const r = 0.3 + sw.maxRadius * (1 - Math.exp(-4 * t));
      sw.mesh.scale.setScalar(r);
      sw.mat.opacity = 0.7 * sw.intensity * (1 - t) * (1 - t);
      sw.mesh.lookAt(this.camera.position);
    }
    return this.shockwaves.length > 0;
  }

  _updateFlash(dt) {
    if (!this.flashState) return false;
    const f = this.flashState;
    f.elapsed += dt;
    const t = f.elapsed / f.duration;

    if (t >= 1) {
      this.scene.remove(f.mesh);
      f.geo.dispose();
      f.mat.dispose();
      this.flashState = null;
      return false;
    }

    if (f.fullscreen) {
      f.mat.opacity = 0.7 * (1 - t);
      f.mesh.position.copy(this.camera.position);
    } else {
      const r = f.rMax * (1 - Math.exp(-12 * t));
      f.mesh.scale.setScalar(r / f.rMax);
      f.mat.opacity = 0.9 * (1 - t * t);
    }
    return true;
  }

  _updateShake(dt) {
    if (!this.shakeState) return false;
    const s = this.shakeState;
    s.elapsed += dt;

    if (s.elapsed >= s.duration) {
      this.camera.position.sub(s.offset);
      s.offset.set(0, 0, 0);
      this.shakeState = null;
      return false;
    }

    const decay = 1 - s.elapsed / s.duration;
    const amp = s.intensity * decay;
    const nx = (Math.random() - 0.5) * 2 * amp;
    const ny = (Math.random() - 0.5) * 2 * amp;
    const nz = (Math.random() - 0.5) * 2 * amp;
    this.camera.position.sub(s.offset);
    s.offset.set(nx, ny, nz);
    this.camera.position.add(s.offset);
    return true;
  }

  dispose() {
    for (const p of this.particlePool) {
      this.scene.remove(p.mesh);
      p.mat.dispose();
    }
    for (const p of this.activeParticles) {
      this.scene.remove(p.mesh);
      p.mat.dispose();
    }
    for (const sw of this.shockwaves) {
      this.scene.remove(sw.mesh);
      sw.geo.dispose();
      sw.mat.dispose();
    }
    this.geoSmall.dispose();
    this.geoMed.dispose();
    this.geoLarge.dispose();
    this.geoSmoke.dispose();
    this.particlePool.length = 0;
    this.activeParticles.length = 0;
    this.shockwaves.length = 0;
  }
}
