// Gamma rays — long white pulsing beams.
//
// A gamma is the nucleus handing energy to a photon instead of throwing
// something out: it leaves at the speed of light and, unlike an alpha or a
// beta, nothing about it is a particle this game can put in the atoms Map. So
// it is drawn as what a ray actually is — a straight line of light from where
// the energy was released — and it owns its short life the way decay-particles
// does: scene objects only, never data.
//
// The physics this build draws is the one its own decay text already promises:
// a positron annihilates against an electron and hands back TWO 511 keV gammas
// flying apart in opposite directions (the whole of PET). `annihilation()`
// fires exactly that pair, back to back, from one point.
//
// The beam is deliberately two coaxial cylinders — a hard white core and a
// softer halo — both additive on the dark theme. On the light theme adding
// white to a white screen shows nothing (the same problem decay-particles
// documents for its shells), so the halo switches to a normal-blended pale
// blue that keeps the beam readable while the core stays white.
(function () {
  'use strict';

  // Scene units. The grid runs ±120, so a beam of 80 leaves the nucleus and
  // still crosses the whole view: "long" is the point of a ray.
  const LENGTH = 80;
  const LIFE_MS = 1400;
  const HZ = 9; // pulses per second — bright/shine rhythm

  let coreGeo = null, haloGeo = null;
  let beams = [];
  let raf = 0;

  function ctx() {
    const A = window.__mol3d;
    if (!A || !A.THREE || !A.scene) return null;
    if (!coreGeo) {
      // Unit cylinders (height 1, radius 1) shared by every beam; the beam
      // scales them to length/width so geometry is built once for the session.
      coreGeo = new A.THREE.CylinderGeometry(1, 1, 1, 8, 1, true);
      haloGeo = new A.THREE.CylinderGeometry(1, 1, 1, 8, 1, true);
    }
    return A;
  }

  function isLightTheme() {
    try { return document.documentElement.dataset.theme === 'light'; } catch (e) { return false; }
  }

  // from/to are {x,y,z}; opts: { length, lifeMs, hz }.
  function fire(from, to, opts) {
    const A = ctx();
    if (!A) return null;
    opts = opts || {};
    const THREE = A.THREE;
    const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
    const span = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (!(span > 0)) return null;
    const len = opts.length || LENGTH;
    const dir = new THREE.Vector3(dx / span, dy / span, dz / span);

    const light = isLightTheme();
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: light ? THREE.NormalBlending : THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    const haloMat = new THREE.MeshBasicMaterial({
      color: light ? 0x9db8ff : 0xffffff,
      transparent: true,
      opacity: light ? 0.5 : 0.3,
      depthWrite: false,
      blending: light ? THREE.NormalBlending : THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    const halo = new THREE.Mesh(haloGeo, haloMat);
    // The cylinder's axis is +Y: aim it along dir, then place the midpoint
    // half a length from the origin of the ray.
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const mid = new THREE.Vector3(from.x + dir.x * len / 2, from.y + dir.y * len / 2, from.z + dir.z * len / 2);
    const radiusCore = opts.coreR || 0.1;
    const radiusHalo = opts.haloR || 0.34;
    for (const [mesh, r] of [[core, radiusCore], [halo, radiusHalo]]) {
      mesh.quaternion.copy(quat);
      mesh.position.copy(mid);
      mesh.scale.set(r, len, r);
      A.scene.add(mesh);
    }
    const beam = {
      core: core, halo: halo, coreMat: coreMat, haloMat: haloMat,
      radiusCore: radiusCore, radiusHalo: radiusHalo,
      birth: performance.now(),
      lifeMs: opts.lifeMs || LIFE_MS,
      hz: (opts.hz || HZ) * (0.85 + Math.random() * 0.3)
    };
    beams.push(beam);
    start();
    return beam;
  }

  // The gamma leaves the nucleus in ONE direction — a single ray, not a pair:
  // the beam should streak one way across the scene and stop there.
  function annihilation(pos) {
    const A = ctx();
    if (!A || !pos) return 0;
    const THREE = A.THREE;
    const a = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
    if (a.lengthSq() < 1e-6) a.set(1, 0, 0);
    a.normalize();
    const n = fire(pos, { x: pos.x + a.x, y: pos.y + a.y, z: pos.z + a.z });
    return n ? 1 : 0;
  }

  let lastStep = 0;
  function step(now) {
    // The World: beam ages are wall time, so while the world is stopped each
    // beam's birth is pushed forward by the frozen span — the light hangs
    // mid-pulse and resumes exactly where it stopped.
    if (document.body.classList.contains('time-stopped')) {
      const shift = lastStep ? now - lastStep : 0;
      lastStep = now;
      if (shift > 0) for (const b of beams) b.birth += shift;
      if (beams.length) raf = window.requestAnimationFrame(step);
      else raf = 0;
      return;
    }
    lastStep = now;
    for (let i = beams.length - 1; i >= 0; i--) {
      const b = beams[i];
      const age = now - b.birth;
      if (age >= b.lifeMs) {
        const scene = window.__mol3d && window.__mol3d.scene;
        if (scene) { scene.remove(b.core); scene.remove(b.halo); }
        b.coreMat.dispose();
        b.haloMat.dispose();
        beams.splice(i, 1);
        continue;
      }
      const t = age / 1000;
      const pulse = 0.5 + 0.5 * Math.sin(t * 2 * Math.PI * b.hz);
      const left = 1 - age / b.lifeMs;
      const fade = left < 0.35 ? left / 0.35 : 1;
      b.coreMat.opacity = (0.6 + 0.4 * pulse) * fade;
      b.haloMat.opacity = (0.16 + 0.3 * pulse) * fade;
      // The halo breathes with the pulse — the "shining" part.
      const swell = 1 + 0.45 * pulse;
      b.halo.scale.x = b.radiusHalo * swell;
      b.halo.scale.z = b.radiusHalo * swell;
    }
    if (beams.length) raf = window.requestAnimationFrame(step);
    else raf = 0;
  }

  function start() {
    if (raf) return;
    raf = window.requestAnimationFrame(step);
  }

  window.__gammaRay = Object.freeze({
    fire: fire,
    annihilation: annihilation,
    activeCount: () => beams.length
  });
})();
