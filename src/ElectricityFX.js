// ElectricityFX.js — Procedural lightning arcs via fractal midpoint displacement.
// Branching, additive blending (white core + cyan halo), spark particles on impact.

import * as THREE from 'three';

const SPARK_POOL_SIZE = 200;
const DEFAULT_SEGMENTS = 6;
const DEFAULT_DISPLACEMENT = 0.8;
const ARC_LIFETIME_MS = 120;
const SPARK_LIFETIME = 0.6;

export class ElectricityFX {
  constructor(scene) {
    this.scene = scene;
    this.arcs = [];
    this.sparks = [];
    this.sparkPool = [];
    this.active = false;

    this._initSparkPool();
    this._initSharedGeometries();
  }

  _initSharedGeometries() {
    this.geoSpark = new THREE.SphereGeometry(0.04, 4, 3);
  }

  _initSparkPool() {
    for (let i = 0; i < SPARK_POOL_SIZE; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x00E5FF,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(this.geoSpark, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.sparkPool.push({
        mesh, mat,
        v: new THREE.Vector3(),
        life: 0,
        decay: 0,
        gravity: true,
        drag: 0.96,
      });
    }
  }

  _acquireSpark() {
    for (const s of this.sparkPool) {
      if (s.life <= 0) return s;
    }
    return null;
  }

  /**
   * Fire a lightning arc between two world-space points.
   * @param {THREE.Vector3} start
   * @param {THREE.Vector3} end
   * @param {object} [opts]
   * @param {number} [opts.intensity=1] - Brightness multiplier (0–2)
   * @param {number} [opts.segments=6] - Subdivision depth
   * @param {number} [opts.displacement=0.8] - Perpendicular jitter amplitude
   * @param {number} [opts.branches=2] - Number of sub-branches
   * @param {number} [opts.lifetimeMs=120] - How long the arc persists
   * @param {number} [opts.color=0x00E5FF] - Halo color
   * @param {boolean} [opts.sparks=true] - Emit spark particles at endpoints
   * @param {number} [opts.sparkCount=12] - Number of impact sparks
   */
  strike(start, end, opts = {}) {
    const {
      intensity = 1,
      segments = DEFAULT_SEGMENTS,
      displacement = DEFAULT_DISPLACEMENT,
      branches = 2,
      lifetimeMs = ARC_LIFETIME_MS,
      color = 0x00E5FF,
      sparks = true,
      sparkCount = 12,
    } = opts;

    const points = this._generateArc(start, end, segments, displacement);

    const coreGeo = new THREE.BufferGeometry().setFromPoints(points);
    const coreMat = new THREE.LineBasicMaterial({
      color: 0xFFFFFF,
      transparent: true,
      opacity: Math.min(1, 0.85 * intensity),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      linewidth: 1,
    });
    const coreLine = new THREE.Line(coreGeo, coreMat);
    this.scene.add(coreLine);

    const haloGeo = new THREE.BufferGeometry().setFromPoints(points);
    const haloMat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: Math.min(1, 0.5 * intensity),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      linewidth: 1,
    });
    const haloLine = new THREE.Line(haloGeo, haloMat);
    haloLine.scale.setScalar(1.04);
    this.scene.add(haloLine);

    const branchLines = [];
    for (let b = 0; b < branches; b++) {
      const branchStart = this._pickBranchOrigin(points);
      const branchEnd = this._pickBranchTarget(branchStart, end, start);
      const branchPts = this._generateArc(branchStart, branchEnd, Math.max(3, segments - 2), displacement * 0.6);

      const bGeo = new THREE.BufferGeometry().setFromPoints(branchPts);
      const bMat = new THREE.LineBasicMaterial({
        color: 0xFFFFFF,
        transparent: true,
        opacity: Math.min(1, 0.45 * intensity),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const bLine = new THREE.Line(bGeo, bMat);
      this.scene.add(bLine);
      branchLines.push({ line: bLine, geo: bGeo, mat: bMat });
    }

    const arc = {
      coreLine, coreGeo, coreMat,
      haloLine, haloGeo, haloMat,
      branchLines,
      elapsed: 0,
      lifetime: lifetimeMs / 1000,
      intensity,
      jitterPhase: Math.random() * Math.PI * 2,
    };
    this.arcs.push(arc);

    if (sparks) {
      this._emitSparks(end, sparkCount, intensity);
      this._emitSparks(start, Math.ceil(sparkCount / 3), intensity * 0.5);
    }

    this.active = true;
    return arc;
  }

  _generateArc(start, end, depth, displacement) {
    let points = [start.clone(), end.clone()];

    for (let d = 0; d < depth; d++) {
      const newPoints = [points[0].clone()];
      const amp = displacement / Math.pow(2, d * 0.5);

      for (let i = 0; i < points.length - 1; i++) {
        const a = points[i];
        const b = points[i + 1];
        const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);

        const dir = new THREE.Vector3().subVectors(b, a);
        const len = dir.length();
        dir.normalize();

        const up = new THREE.Vector3(0, 1, 0);
        const perp = new THREE.Vector3().crossVectors(dir, up);
        if (perp.lengthSq() < 0.001) {
          perp.set(1, 0, 0);
        }
        perp.normalize();

        const perp2 = new THREE.Vector3().crossVectors(dir, perp).normalize();

        const offset = new THREE.Vector3()
          .addScaledVector(perp, (Math.random() * 2 - 1) * amp * len * 0.3)
          .addScaledVector(perp2, (Math.random() * 2 - 1) * amp * len * 0.3)
          .addScaledVector(up, (Math.random() * 2 - 1) * amp * len * 0.15);

        mid.add(offset);
        newPoints.push(mid.clone());
        newPoints.push(b.clone());
      }
      points = newPoints;
    }

    return points;
  }

  _pickBranchOrigin(points) {
    const idx = Math.floor(Math.random() * (points.length - 1));
    return points[idx].clone();
  }

  _pickBranchTarget(origin, arcEnd, arcStart) {
    const dir = new THREE.Vector3()
      .subVectors(arcEnd, origin)
      .normalize();
    const dist = origin.distanceTo(arcEnd) * (0.3 + Math.random() * 0.4);
    const target = origin.clone().addScaledVector(dir, dist);
    target.y += (Math.random() - 0.5) * 1.5;
    target.x += (Math.random() - 0.5) * 1.0;
    target.z += (Math.random() - 0.5) * 1.0;
    return target;
  }

  _emitSparks(position, count, intensity) {
    for (let i = 0; i < count; i++) {
      const spark = this._acquireSpark();
      if (!spark) break;

      spark.mesh.position.copy(position);
      spark.mesh.visible = true;

      const speed = (1.5 + Math.random() * 3) * intensity;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      spark.v.set(
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.abs(Math.cos(phi)) * speed * 1.2,
        Math.sin(phi) * Math.sin(theta) * speed
      );

      spark.life = SPARK_LIFETIME * (0.5 + Math.random() * 0.5);
      spark.decay = 1 / spark.life;
      spark.mat.opacity = Math.min(1, 0.8 * intensity);
      spark.mat.color.setHex(Math.random() > 0.3 ? 0x00E5FF : 0xFFFFFF);
      spark.mesh.scale.setScalar(0.5 + Math.random() * 1.0);
    }
  }

  /**
   * Chain lightning: strike from origin to multiple targets.
   */
  chainStrike(origin, targets, opts = {}) {
    const arcs = [];
    for (const target of targets) {
      arcs.push(this.strike(origin, target, opts));
    }
    return arcs;
  }

  /**
   * Random discharge between nearby molecules.
   */
  randomDischarge(positions, range = 6, opts = {}) {
    if (positions.length < 2) return null;
    const a = positions[Math.floor(Math.random() * positions.length)];
    let b;
    const candidates = positions.filter(p => p !== a && p.distanceTo(a) <= range);
    if (candidates.length > 0) {
      b = candidates[Math.floor(Math.random() * candidates.length)];
    } else {
      b = positions[Math.floor(Math.random() * positions.length)];
    }
    return this.strike(a, b, opts);
  }

  update(dt) {
    let anyActive = false;

    for (let i = this.arcs.length - 1; i >= 0; i--) {
      const arc = this.arcs[i];
      arc.elapsed += dt;
      arc.jitterPhase += dt * 60;

      const t = arc.elapsed / arc.lifetime;
      if (t >= 1) {
        this._disposeArc(arc);
        this.arcs.splice(i, 1);
        continue;
      }

      const fade = 1 - t * t;
      const jitter = 0.7 + 0.3 * Math.sin(arc.jitterPhase * 12 + Math.random() * 0.5);
      arc.coreMat.opacity = fade * jitter * Math.min(1, 0.85 * arc.intensity);
      arc.haloMat.opacity = fade * jitter * Math.min(1, 0.5 * arc.intensity);

      for (const bl of arc.branchLines) {
        bl.mat.opacity = fade * jitter * Math.min(1, 0.45 * arc.intensity);
      }

      anyActive = true;
    }

    for (let i = 0; i < this.sparkPool.length; i++) {
      const s = this.sparkPool[i];
      if (s.life <= 0) continue;

      s.life -= dt;
      if (s.life <= 0) {
        s.mesh.visible = false;
        s.mat.opacity = 0;
        s.life = 0;
        continue;
      }

      s.v.y -= 9.8 * dt;
      s.v.multiplyScalar(Math.pow(s.drag, dt * 60));
      s.mesh.position.addScaledVector(s.v, dt);

      const lifeRatio = s.life / SPARK_LIFETIME;
      s.mat.opacity = lifeRatio * 0.9;
      s.mesh.scale.setScalar(lifeRatio * (0.5 + Math.random() * 0.3));

      anyActive = true;
    }

    this.active = anyActive;
    return anyActive;
  }

  _disposeArc(arc) {
    this.scene.remove(arc.coreLine);
    this.scene.remove(arc.haloLine);
    arc.coreGeo.dispose();
    arc.coreMat.dispose();
    arc.haloGeo.dispose();
    arc.haloMat.dispose();

    for (const bl of arc.branchLines) {
      this.scene.remove(bl.line);
      bl.geo.dispose();
      bl.mat.dispose();
    }
  }

  dispose() {
    for (const arc of this.arcs) {
      this._disposeArc(arc);
    }
    this.arcs.length = 0;

    for (const s of this.sparkPool) {
      this.scene.remove(s.mesh);
      s.mat.dispose();
    }
    this.sparkPool.length = 0;
    this.geoSpark.dispose();
  }
}
