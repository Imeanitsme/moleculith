// Decay ejecta — the particles a nucleus actually throws.
//
// What a decay emits is not an atom: an alpha is a bare helium nucleus with no
// electron cloud, a beta is one electron or one positron, and a neutrino is a
// point of almost nothing. None of them belong in the atoms Map — they carry no
// element, take no bonds, cost no crate unit and never appear in the inspector —
// so this file draws them straight into the scene and owns their short lives.
//
// Every ejecta is drawn twice: a solid core that states what it is, and a softer
// shell that carries its light. The shell has to work on both themes, and the two
// behave oppositely — on the dark theme additive blending is what makes something
// glow, while on the light theme adding light to an already-white screen shows
// nothing at all, so the same shell switches to tinting instead.
(function () {
  'use strict';

  // Sizes are scene units. A hydrogen atom draws at 0.56 and a heavy radioactive
  // parent at nearly 1.8, so an alpha cluster of 0.42 is small enough to read as a
  // fragment and large enough to follow against either.
  const KIND = {
    alpha: {
      r: 0.42, life: 1700, drag: 0.22,
      ghostR: 0.15, ghostLife: 900, gap: 34,
      dark: { p: 0xff3324, n: 0xe6eff8, aura: 0xff5a3c, trail: 0xff5230, auraO: 0.34, trailO: 0.24 },
      light: { p: 0xd81e08, n: 0x7f95aa, aura: 0xff6a35, trail: 0xe03a12, auraO: 0.26, trailO: 0.42 }
    },
    electron: {
      r: 0.15, life: 1300, drag: 0.5,
      ghostR: 0.09, ghostLife: 620, gap: 26,
      dark: { p: 0x2ae4ff, aura: 0x9df7ff, trail: 0x2ae4ff, auraO: 0.46, trailO: 0.5 },
      light: { p: 0x0090c4, aura: 0x35c8ee, trail: 0x0aa8d8, auraO: 0.42, trailO: 0.5 }
    },
    positron: {
      r: 0.15, life: 1300, drag: 0.5,
      ghostR: 0.09, ghostLife: 620, gap: 26,
      dark: { p: 0xff8033, aura: 0xffc49a, trail: 0xff7a2e, auraO: 0.46, trailO: 0.5 },
      light: { p: 0xd2530a, aura: 0xff8a2a, trail: 0xe0621a, auraO: 0.42, trailO: 0.5 }
    },
    // The faintest of the set on purpose: a neutrino passes through almost
    // everything, so it earns a hint of a trail rather than a streak.
    neutrino: {
      r: 0.08, life: 1100, drag: 0.12,
      ghostR: 0.07, ghostLife: 480, gap: 20,
      dark: { p: 0x2ee6c8, aura: 0xb5fff3, trail: 0x2ee6c8, auraO: 0.2, trailO: 0.38 },
      light: { p: 0x0c8f78, aura: 0x2ec9ad, trail: 0x12a58b, auraO: 0.26, trailO: 0.46 }
    }
  };

  // Ceiling at the fullest tier. A trail is ~13 dots, so an alpha plus its
  // neutrino still reads end to end on Low while a chain of decays cannot bury
  // the frame the way it used to.
  const MAX_PARTICLES = 90;
  const MAX_GHOSTS = 300;

  // The scene's tier is the only useful measure of what this device can afford to
  // have drawn on top of it, and the ejecta is the busiest thing the decay code
  // puts in the scene. A short trail costs the read almost nothing here; the
  // frame time it saves is what the player actually feels.
  function mult() {
    const A = api();
    const m = A && typeof A.particleMult === 'function' ? A.particleMult() : 1;
    return typeof m === 'number' && m > 0 ? m : 1;
  }
  function budget(n) {
    return Math.max(6, Math.round(n * mult()));
  }

  let assets = null;
  const live = [];
  const ghosts = [];
  // Spent trail dots keep their mesh and material and wait here. Rebuilding a
  // MeshBasicMaterial per dot meant a new shader uniform set and a new buffer
  // upload several times a second, which is exactly the work a low tier cannot
  // spare while the dots themselves are only ever a few hundred at a time.
  const pool = [];
  let frame = 0;

  function api() {
    const A = window.__mol3d;
    if (!A || !A.THREE || !A.scene) return null;
    return A;
  }

  function isLight() {
    return document.documentElement.getAttribute('data-theme') === 'light';
  }

  function palette(K) {
    return K[isLight() ? 'light' : 'dark'];
  }

  function geo() {
    if (!assets) {
      const A = api();
      if (!A) return null;
      const THREE = A.THREE;
      assets = {
        unit: new THREE.SphereGeometry(1, 14, 12),
        ghost: new THREE.SphereGeometry(1, 10, 8)
      };
    }
    return assets;
  }

  function unitDir() {
    const u = Math.random() * 2 - 1;
    const phi = Math.random() * Math.PI * 2;
    const s = Math.sqrt(Math.max(0, 1 - u * u));
    return { x: s * Math.cos(phi), y: u, z: s * Math.sin(phi) };
  }

  function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }

  // A heavy radioactive parent is drawn as a sphere metres across, so the ejecta
  // is born inside it and would be hidden for most of its flight. The shells
  // ignore the depth buffer: the glow stays on screen while the solid core only
  // appears once the fragment has actually cleared the atom.
  function shell(THREE, G, color, scale, opacity, additive) {
    const mat = new THREE.MeshBasicMaterial({
      color: color, transparent: true, opacity: opacity,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: false, depthTest: false
    });
    const mesh = new THREE.Mesh(G.unit, mat);
    mesh.scale.setScalar(scale);
    mesh.renderOrder = 6;
    return { mesh: mesh, mat: mat };
  }

  function coreMat(THREE, color) {
    return new THREE.MeshBasicMaterial({
      color: color, transparent: true, opacity: 1,
      blending: THREE.NormalBlending, depthWrite: false
    });
  }

  function addParticle(kindName, from, dir, speed) {
    const A = api(), G = geo();
    if (!A || !G) return null;
    if (live.length >= budget(MAX_PARTICLES)) return null;
    const THREE = A.THREE;
    const K = KIND[kindName];
    if (!K) return null;
    const P = palette(K);
    const additive = !isLight();

    let head, mats, opacityBase;
    if (kindName === 'alpha') {
      // The bare nucleus: two protons and two neutrons, no electrons. Four
      // spheres on a tetrahedron are as close as a scene this size can get to
      // "strictly 2p + 2n". The cluster is built from K.r, so the corner
      // distance off*sqrt(3) plus one nucleon radius fills exactly K.r.
      head = new THREE.Group();
      mats = [];
      const nr = K.r * 0.36;
      const off = K.r * 0.375;
      const corners = [
        [1, 1, 1], [-1, -1, 1], [-1, 1, -1], [1, -1, -1]
      ];
      for (let i = 0; i < 4; i++) {
        const c = corners[i];
        const m = coreMat(THREE, i < 2 ? P.p : P.n);
        const n = new THREE.Mesh(G.unit, m);
        n.position.set(c[0] * off, c[1] * off, c[2] * off);
        n.scale.setScalar(nr);
        head.add(n);
        mats.push(m);
      }
      const halo = shell(THREE, G, P.aura, K.r * 1.25, P.auraO, additive);
      head.add(halo.mesh);
      mats.push(halo.mat);
      opacityBase = mats.map(m => m.opacity);
    } else {
      const mat = coreMat(THREE, P.p);
      head = new THREE.Mesh(G.unit, mat);
      head.scale.setScalar(K.r);
      const aura = shell(THREE, G, P.aura, kindName === 'neutrino' ? 1.8 : 2.4, P.auraO, additive);
      head.add(aura.mesh);
      mats = [mat, aura.mat];
      opacityBase = [1, P.auraO];
    }

    head.raycast = function () {};
    head.position.set(from.x, from.y, from.z);
    A.scene.add(head);

    const d = dir || unitDir();
    const v = speed == null ? 6 : speed;
    const p = {
      kind: kindName, mesh: head, mats: mats, base: opacityBase,
      x: from.x, y: from.y, z: from.z,
      vx: d.x * v, vy: d.y * v, vz: d.z * v,
      born: performance.now(), last: performance.now(), lastGhost: 0,
      life: K.life
    };
    live.push(p);
    dropGhost(p, p.born);
    if (!frame) frame = requestAnimationFrame(tick);
    if (typeof A.invalidate === 'function') A.invalidate();
    return p;
  }

  function dropGhost(p, now) {
    const A = api(), G = geo();
    if (!A || !G || ghosts.length >= budget(MAX_GHOSTS)) return;
    const THREE = A.THREE;
    const K = KIND[p.kind];
    const P = palette(K);
    let g = pool.pop();
    if (!g) {
      const mat = new THREE.MeshBasicMaterial({
        color: P.trail, transparent: true, opacity: P.trailO,
        blending: isLight() ? THREE.NormalBlending : THREE.AdditiveBlending,
        depthWrite: false, depthTest: false
      });
      const mesh = new THREE.Mesh(G.ghost, mat);
      mesh.renderOrder = 5;
      mesh.raycast = function () {};
      A.scene.add(mesh);
      g = { mesh: mesh, mat: mat, o: 0, r0: 0, born: 0, life: 0 };
    }
    // Everything the dot can be asked for changes between uses: which theme is
    // live, which kind threw it, and where the trail is at that moment.
    g.mat.color.setHex(P.trail);
    g.mat.blending = isLight() ? THREE.NormalBlending : THREE.AdditiveBlending;
    g.mat.opacity = P.trailO;
    g.mesh.visible = true;
    g.mesh.position.set(p.x, p.y, p.z);
    g.mesh.scale.setScalar(K.ghostR);
    g.o = P.trailO;
    g.r0 = K.ghostR;
    g.born = now;
    g.life = K.ghostLife;
    ghosts.push(g);
  }

  function releaseParticle(p) {
    const A = api();
    if (A && p.mesh.parent) p.mesh.parent.remove(p.mesh);
    for (const m of p.mats) { try { m.dispose(); } catch (e) {} }
  }

  function releaseGhost(g) {
    // Hidden and parked rather than removed and disposed: the next decay wants
    // this exact mesh and material back.
    g.mesh.visible = false;
    pool.push(g);
  }

  function tick() {
    frame = 0;
    const A = api();
    if (!A) { live.length = 0; ghosts.length = 0; return; }
    const now = performance.now();
    let alive = false;

    for (let i = live.length - 1; i >= 0; i--) {
      const p = live[i];
      const dt = Math.min(0.06, Math.max(0, (now - p.last) / 1000));
      p.last = now;
      const age = now - p.born;
      if (age >= p.life) { releaseParticle(p); live.splice(i, 1); continue; }

      const K = KIND[p.kind];
      const damp = Math.exp(-K.drag * dt);
      p.vx *= damp; p.vy *= damp; p.vz *= damp;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.mesh.position.set(p.x, p.y, p.z);

      const k = 1 - age / p.life;
      for (let m = 0; m < p.mats.length; m++) {
        p.mats[m].opacity = p.base[m] * (k > 0.25 ? 1 : k / 0.25);
      }

      if (now - p.lastGhost >= K.gap) {
        p.lastGhost = now;
        dropGhost(p, now);
      }
      alive = true;
    }

    for (let i = ghosts.length - 1; i >= 0; i--) {
      const g = ghosts[i];
      const k = 1 - (now - g.born) / g.life;
      if (k <= 0) { releaseGhost(g); ghosts.splice(i, 1); continue; }
      g.mat.opacity = g.o * k;
      g.mesh.scale.setScalar(g.r0 * (0.4 + 0.6 * k));
      alive = true;
    }

    if (typeof A.invalidate === 'function') A.invalidate();
    if (alive) frame = requestAnimationFrame(tick);
  }

  // A nucleus throwing an alpha. `dir` and `speed` come from the decay code so
  // the visual and the recoil describe the same event.
  function alpha(from, dir, speed) {
    const d = dir || unitDir();
    const v = Math.max(2.4, Math.min(9, (speed || 3) * 1.05));
    return addParticle('alpha', from, d, v);
  }

  // A weak decay: one charged lepton plus its neutrino, thrown apart so the two
  // clearly do not share a direction. Electron capture emits neither — the
  // nucleus takes an electron in, it does not throw one out.
  function beta(from, mode) {
    if (mode !== 'minus' && mode !== 'plus') return null;
    const e = unitDir();
    const kind = mode === 'plus' ? 'positron' : 'electron';
    addParticle(kind, from, e, 7.6);
    let n = unitDir();
    for (let guard = 0; guard < 24 && Math.abs(dot(n, e)) > 0.35; guard++) n = unitDir();
    addParticle('neutrino', from, n, 10.2);
    return true;
  }

  function clear() {
    for (const p of live) releaseParticle(p);
    for (const g of ghosts) releaseGhost(g);
    live.length = 0;
    ghosts.length = 0;
  }

  window.__decayParticles = {
    alpha: alpha,
    beta: beta,
    clear: clear,
    active: function () { return live.length + ghosts.length; },
    // Pooled dots stay in the scene between decays; the number that has ever been
    // needed at once is what this reports.
    pooled: function () { return pool.length; }
  };
})();
