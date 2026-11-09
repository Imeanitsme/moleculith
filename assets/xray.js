// X-Ray Mode - Schrödinger model: optimized electron probability clouds
(function() {
  'use strict';

  var active = false;
  var shellObjects = new Map(); // atomId -> { group, cloudData }
  var animFrameId = null;
  var SHELL_CAP = [2, 8, 18, 32, 32, 18, 8];
  var SHELL_NAMES = ['K', 'L', 'M', 'N', 'O', 'P', 'Q'];
  var CFG_KEY = 'mol3d.xray.cfg.v1';

  // grid: shells drawn as wireframe grids instead of soft clouds
  // labels: element symbols stay visible while in x-ray
  // shells: per-shell-level visibility (K..Q)
  var config = { grid: false, labels: true, shells: [true, true, true, true, true, true, true] };

  function loadConfig() {
    try {
      var d = JSON.parse(localStorage.getItem(CFG_KEY));
      if (!d || typeof d !== 'object') return;
      if (typeof d.grid === 'boolean') config.grid = d.grid;
      if (typeof d.labels === 'boolean') config.labels = d.labels;
      if (Array.isArray(d.shells)) {
        for (var i = 0; i < SHELL_NAMES.length; i++) {
          if (typeof d.shells[i] === 'boolean') config.shells[i] = d.shells[i];
        }
      }
    } catch (e) {}
  }
  function saveConfig() {
    try {
      localStorage.setItem(CFG_KEY, JSON.stringify(config));
    } catch (e) {}
  }
  function shellEnabled(index) {
    return config.shells[index] !== false;
  }
  // Labels are always back on when x-ray is off; the option only gates them inside x-ray.
  function applyLabelVisibility() {
    var m = window.__mol3d;
    if (!m || typeof m.setLabels !== 'function') return;
    m.setLabels(!active || config.labels);
  }

  function showStatus(msg) {
    var el = document.getElementById('status-text');
    if (el) { el.textContent = msg; el.className = 'info'; }
  }

  function tt(key, params) {
    var i18n = window.__mol3d && window.__mol3d.i18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, params) : key;
  }

  function electronShells(z) {
    var shells = [];
    var remaining = z;
    for (var i = 0; i < SHELL_CAP.length && remaining > 0; i++) {
      var n = Math.min(remaining, SHELL_CAP[i]);
      shells.push(n);
      remaining -= n;
    }
    return shells;
  }

  // --- Isotope readout for the nucleus ---
  // An atom in this build carries nothing but its element: the neutrons the
  // neutron barrel captured live in the gun's own ledger (window.__protonGun),
  // so the x-ray asks the gun for them instead of trusting the tabulated average
  // atomic mass. The value is read when a structure is built and is never kept
  // across frames - a shot can land between two of them.
  function neutronExcess(atomId) {
    var gun = window.__protonGun;
    if (!gun || typeof gun.neutronExcessOf !== 'function') return 0;
    var n;
    try { n = gun.neutronExcessOf(atomId); } catch (e) { return 0; }
    return (typeof n === 'number' && isFinite(n) && n > 0) ? Math.floor(n) : 0;
  }

  // Z comes from the element, A from the element's own mass number plus every
  // neutron the gun added, N = A - Z. The baseline rule mirrors the gun's
  // mass-number readout exactly, so the panel and the x-ray can never disagree
  // about which isotope an atom is.
  function nuclideOf(atom, atomId) {
    var el = atom.el;
    var z = (typeof el.z === 'number') ? el.z : 0;
    var m = (typeof el.mass === 'number' && isFinite(el.mass)) ? Math.round(el.mass) : null;
    var base = (m !== null && m >= z) ? m : Math.max(1, z * 2 - 1);
    var a = base + neutronExcess(atomId);
    return { z: z, n: a - z, a: a, label: el.sym + '-' + a };
  }

  // The tag is a texture, not geometry: a nuclide that was drawn before is reused
  // as it is, so repainting an atom after a shot costs a Map lookup instead of a
  // fresh canvas. The key is the full nuclide label, so a cached image can never
  // describe a different isotope. Entries are shared by every sprite showing that
  // nuclide, so an overflow drops the oldest one instead of disposing it -
  // disposing a texture another atom still displays would blank that one out.
  var NUCLIDE_TEX_MAX = 128;
  var nuclideTextures = new Map();

  // The tag is a texture on a sprite, so it sits directly on whatever the scene's
  // background is: dark halo + warm ink over the night sky, light halo + dark warm
  // ink over the daylight sky. Resolved per paint, never baked at load.
  function nuclideInk() {
    return document.documentElement.dataset.theme === 'light'
      ? { edge: 'rgba(255,255,255,0.92)', fill: '#8a4b12' }
      : { edge: 'rgba(8,12,18,0.9)', fill: '#ffd9a8' };
  }

  function nuclideTexture(label, THREE) {
    var cached = nuclideTextures.get(label);
    if (cached) return cached;
    var canvas = document.createElement('canvas');
    canvas.width = 192;
    canvas.height = 64;
    var g = canvas.getContext('2d');
    if (!g) return null;
    g.font = 'bold 40px "Segoe UI", Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 8;
    g.lineJoin = 'round';
    var ink = nuclideInk();
    g.strokeStyle = ink.edge;
    g.strokeText(label, 96, 34);
    // Warm rather than the symbol's white: this line belongs to the nucleus, and
    // the element label floating on the same atom already uses white.
    g.fillStyle = ink.fill;
    g.fillText(label, 96, 34);
    var tex = new THREE.CanvasTexture(canvas);
    if (nuclideTextures.size >= NUCLIDE_TEX_MAX) {
      nuclideTextures.delete(nuclideTextures.keys().next().value);
    }
    nuclideTextures.set(label, tex);
    return tex;
  }

  function createNuclideTag(nuclide, THREE, atomRadius) {
    if (!THREE || typeof THREE.Sprite !== 'function' ||
        typeof THREE.SpriteMaterial !== 'function' ||
        typeof THREE.CanvasTexture !== 'function') return null;
    var tex = nuclideTexture(nuclide.label, THREE);
    if (!tex) return null;
    var sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, transparent: true, depthWrite: false
    }));
    // The canvas is 3:1, so the sprite keeps that ratio and the text stays upright.
    var h = 0.24 + atomRadius * 0.16;
    sprite.scale.set(h * 3, h, 1);
    sprite.position.set(0, -(0.22 + atomRadius * 0.5), 0);
    sprite.userData.nuclide = nuclide.label;
    return sprite;
  }

  function createNucleus(protons, neutrons, THREE) {
    var group = new THREE.Group();
    var nucleusRadius = 0.15;
    var particleRadius = 0.05;

    // Nucleus sphere (transparent shell)
    var nucleusGeo = new THREE.SphereGeometry(nucleusRadius, 12, 12);
    var nucleusMat = new THREE.MeshBasicMaterial({
      color: 0xff6b6b,
      transparent: true,
      opacity: 0.3
    });
    var nucleus = new THREE.Mesh(nucleusGeo, nucleusMat);
    group.add(nucleus);

    // Protons (red) and neutrons (gray) as small spheres
    var total = protons + neutrons;
    var particleGeo = new THREE.SphereGeometry(particleRadius, 6, 6);
    var protonMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    var neutronMat = new THREE.MeshBasicMaterial({ color: 0x888888 });

    // Arrange particles in a simple cluster
    var positions = [];
    if (total === 1) {
      positions.push([0, 0, 0]);
    } else {
      for (var i = 0; i < total; i++) {
        var angle = (i / total) * Math.PI * 4;
        var r = (i / total) * nucleusRadius * 0.7;
        var y = (i % 3 - 1) * particleRadius * 0.5;
        positions.push([Math.cos(angle) * r, y, Math.sin(angle) * r]);
      }
    }

    for (var j = 0; j < total; j++) {
      var isProton = j < protons;
      var particle = new THREE.Mesh(particleGeo, isProton ? protonMat : neutronMat);
      particle.position.set(positions[j][0], positions[j][1], positions[j][2]);
      group.add(particle);
    }

    return group;
  }

  // Optimized Schrödinger-style electron cloud
  function createElectronCloud(shellIndex, electronCount, THREE, atomRadius) {
    var group = new THREE.Group();
    var shellRadius = atomRadius * (1.5 + shellIndex * 0.8);
    var baseOpacity = 0.15;

    // Single cloud layer with gradient opacity (optimized: was 3 layers)
    var cloudGeo = new THREE.SphereGeometry(shellRadius, 16, 16);
    var cloudMat = new THREE.MeshBasicMaterial({
      color: 0x58a6ff,
      transparent: true,
      opacity: baseOpacity,
      depthWrite: false,
      wireframe: false,
      side: THREE.DoubleSide
    });
    var cloud = new THREE.Mesh(cloudGeo, cloudMat);
    group.add(cloud);

    // Reduced point count for performance (was electronCount * 8, now * 4)
    var pointCount = Math.min(electronCount * 4, 32);
    var pointGeo = new THREE.SphereGeometry(0.03, 4, 4); // Smaller, lower poly
    var pointMat = new THREE.MeshBasicMaterial({
      color: 0x88ccff,
      transparent: true,
      opacity: 0.5,
      depthWrite: false
    });

    var points = [];
    for (var p = 0; p < pointCount; p++) {
      // Golden ratio spiral distribution
      var phi = Math.acos(1 - 2 * (p + 0.5) / pointCount);
      var theta = Math.PI * (1 + Math.sqrt(5)) * p;
      var r = shellRadius * (0.85 + Math.random() * 0.3);

      var point = new THREE.Mesh(pointGeo, pointMat);
      point.position.set(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      );
      point.userData = {
        basePos: point.position.clone(),
        phase: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random() * 0.5
      };
      group.add(point);
      points.push(point);
    }

    return {
      group: group,
      cloud: cloud,
      points: points,
      radius: shellRadius,
      baseOpacity: baseOpacity,
      electronCount: electronCount
    };
  }

  function createElectronShells(shells, THREE, atomRadius) {
    var group = new THREE.Group();
    var cloudData = [];

    for (var s = 0; s < shells.length; s++) {
      if (!shellEnabled(s)) continue;
      var count = shells[s];
      var cloud = createElectronCloud(s, count, THREE, atomRadius);
      group.add(cloud.group);
      cloudData.push(cloud);
    }

    return { group: group, cloudData: cloudData };
  }

  function createAtomStructure(atom, THREE, atomId) {
    var group = new THREE.Group();
    var el = atom.el;
    // The isotope the gun leaves behind, not the periodic table's average: a
    // carbon that has swallowed two neutrons has to be drawn as carbon-14.
    var nuclide = nuclideOf(atom, atomId);
    var protons = nuclide.z;
    var neutrons = nuclide.n;
    var shells = electronShells(protons);

    var atomRadius = 0.5;
    if (window.__mol3d.displayRadius) {
      atomRadius = window.__mol3d.displayRadius(el);
    }

    var nucleus = createNucleus(protons, neutrons, THREE);
    group.add(nucleus);
    // Null only when the renderer's build predates sprites; the nucleus itself is
    // still the correct isotope without it.
    var tag = createNuclideTag(nuclide, THREE, atomRadius);
    if (tag) group.add(tag);

    var shellData = createElectronShells(shells, THREE, atomRadius);
    group.add(shellData.group);

    return { group: group, shellData: shellData, nuclide: nuclide };
  }

  // Update single atom's x-ray structure (for real-time proton gun updates)
  function updateAtomStructure(atomId, atom, THREE) {
    var existing = shellObjects.get(atomId);
    if (existing) {
      // Remove old structure
      window.__mol3d.scene.remove(existing.group);
      existing.group.traverse(function(child) {
        // three keeps one shared geometry for every Sprite, so disposing it here
        // would take the engine's own atom labels with it. Materials are per
        // sprite and still go.
        if (child.geometry && !child.isSprite) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(function(m) { m.dispose(); });
          } else {
            child.material.dispose();
          }
        }
      });
    }

    // Create new structure
    var structure = createAtomStructure(atom, THREE, atomId);
    structure.group.position.set(atom.pos.x, atom.pos.y, atom.pos.z);
    window.__mol3d.scene.add(structure.group);
    shellObjects.set(atomId, structure);
  }

  function removeShellObject(id) {
    var obj = shellObjects.get(id);
    if (!obj || !window.__mol3d || !window.__mol3d.scene) return;
    window.__mol3d.scene.remove(obj.group);
    obj.group.traverse(function(child) {
      // Shared sprite geometry is never disposed - see updateAtomStructure.
      if (child.geometry && !child.isSprite) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(function(m) { m.dispose(); });
        } else {
          child.material.dispose();
        }
      }
    });
    shellObjects.delete(id);
  }

  function updateShellPositions() {
    if (!active || !window.__mol3d || !window.__mol3d.atoms) return;

    var time = performance.now() * 0.001;

    // Clean up shells for deleted atoms
    for (var id of shellObjects.keys()) {
      if (!window.__mol3d.atoms.has(id)) {
        removeShellObject(id);
      }
    }

    window.__mol3d.atoms.forEach(function(atom, id) {
      var shellObj = shellObjects.get(id);
      if (!shellObj) return;

      shellObj.group.position.set(atom.pos.x, atom.pos.y, atom.pos.z);

      // Animate electron clouds (quantum fluctuation)
      shellObj.shellData.cloudData.forEach(function(cloud) {
        // Pulsing effect for cloud
        var pulse = 1.0 + Math.sin(time * 2) * 0.05;
        cloud.cloud.scale.set(pulse, pulse, pulse);
        cloud.cloud.material.opacity = cloud.baseOpacity + Math.sin(time * 1.5) * 0.03;

        // Quantum fluctuation for probability points
        cloud.points.forEach(function(point) {
          var data = point.userData;
          var fluctuation = Math.sin(time * data.speed + data.phase) * 0.1;
          point.position.copy(data.basePos);
          point.position.multiplyScalar(1 + fluctuation);
          point.material.opacity = 0.4 + Math.sin(time * data.speed * 2 + data.phase) * 0.2;
        });
      });
    });

    if (window.__mol3d.renderer && window.__mol3d.camera && window.__mol3d.scene) {
      window.__mol3d.renderer.render(window.__mol3d.scene, window.__mol3d.camera);
    }
  }

  function startAnimation() {
    if (animFrameId) return;
    function animate() {
      updateShellPositions();
      animFrameId = requestAnimationFrame(animate);
    }
    animate();
  }

  function stopAnimation() {
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
  }

  function buildAllShells() {
    if (!window.__mol3d || !window.__mol3d.atoms || !window.__mol3d.scene) return;
    var THREE = window.__mol3d.THREE;
    if (!THREE) return;

    clearAllShells();

    window.__mol3d.atoms.forEach(function(atom, id) {
      var structure = createAtomStructure(atom, THREE, id);
      structure.group.position.set(atom.pos.x, atom.pos.y, atom.pos.z);
      window.__mol3d.scene.add(structure.group);
      shellObjects.set(id, structure);
    });
  }

  function clearAllShells() {
    if (!window.__mol3d || !window.__mol3d.scene) return;
    for (var id of shellObjects.keys()) {
      removeShellObject(id);
    }
  }

  function applyWireframe() {
    if (!window.__mol3d || !window.__mol3d.scene) return;
    window.__mol3d.scene.traverse(function(obj) {
      if ((obj.isMesh || obj.isInstancedMesh) && obj.material) {
        var isShell = false;
        shellObjects.forEach(function(shellObj) {
          shellObj.group.traverse(function(child) {
            if (child === obj) isShell = true;
          });
        });
        if (isShell) return;

        var mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach(function(m) {
          m.transparent = active;
          m.opacity = active ? 0.3 : 1.0;
          m.wireframe = active;
          m.needsUpdate = true;
        });
      }
    });
  }

  function toggle() {
    active = !active;

    if (active) {
      buildAllShells();
      startAnimation();
    } else {
      clearAllShells();
      stopAnimation();
    }

    applyWireframe();
    applyLabelVisibility();
    showStatus(active ? tt('xray.on') : tt('xray.off'));
    return active;
  }

  // Called by the Format panel; every change repaints the shells that are on screen.
  function setConfig(patch) {
    if (!patch || typeof patch !== 'object') return config;
    if (typeof patch.grid === 'boolean') config.grid = patch.grid;
    if (typeof patch.labels === 'boolean') config.labels = patch.labels;
    if (Array.isArray(patch.shells)) {
      for (var i = 0; i < SHELL_NAMES.length; i++) {
        if (typeof patch.shells[i] === 'boolean') config.shells[i] = patch.shells[i];
      }
    }
    saveConfig();
    applyLabelVisibility();
    if (active) buildAllShells();
    if (window.__mol3d && typeof window.__mol3d.invalidate === 'function') window.__mol3d.invalidate();
    return config;
  }

  function init() {
    loadConfig();
    var btn = document.getElementById('btn-xray');
    if (btn) btn.addEventListener('click', function() {
      if (window.__mol3dShop && window.__mol3dShop.blocksFeature('xray')) {
        showStatus(window.__mol3dShop.lockedMessage('xray'));
        window.__mol3dShop.open();
        return;
      }
      btn.classList.toggle('on', toggle());
    });

    window.addEventListener('keydown', function(e) {
      if ((e.key === 'x' || e.key === 'X') && !e.ctrlKey && !e.altKey && !e.metaKey) {
        var tag = document.activeElement && document.activeElement.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && btn) { e.preventDefault(); btn.click(); }
      }
    });

    // The nuclide tags are cached textures, so a theme flip has to throw the cache
    // away and repaint. The old images are handed to the next frame for disposal:
    // every sprite that shared them is rebuilt first, so nothing is disposed while
    // it is still on screen.
    window.addEventListener('mol3d:theme', function() {
      var stale = nuclideTextures;
      nuclideTextures = new Map();
      if (active) buildAllShells();
      window.setTimeout(function() {
        for (var tex of stale.values()) { if (tex && tex.dispose) tex.dispose(); }
      }, 0);
    });

    // Hook into atom creation/deletion to update shells
    var originalReanalyze = window.__mol3d && window.__mol3d.reanalyze;
    if (window.__mol3d && originalReanalyze) {
      window.__mol3d.reanalyze = function() {
        var result = originalReanalyze.apply(this, arguments);
        if (active) {
          setTimeout(buildAllShells, 0);
        }
        return result;
      };
    }

    // Expose function for proton gun to update specific atom
    window.__xray = {
      toggle: toggle,
      isActive: function() { return active; },
      config: function() {
        return { grid: config.grid, labels: config.labels, shells: config.shells.slice() };
      },
      setConfig: setConfig,
      shellNames: SHELL_NAMES.slice(),
      rebuild: buildAllShells,
      removeAtom: function(atomId) {
        if (shellObjects.has(atomId)) removeShellObject(atomId);
      },
      updateAtom: function(atomId, atom) {
        if (!active || !window.__mol3d || !window.__mol3d.THREE) return;
        updateAtomStructure(atomId, atom, window.__mol3d.THREE);
      },
      // Read-only, for the inspector and for tests: the isotope this view draws for
      // an atom right now (Z, N, A and the nuclide label). Asking here instead of
      // recomputing N from the tabulated average mass is the whole point of the
      // neutron barrel.
      nuclideOf: function(atomId) {
        var atoms = window.__mol3d && window.__mol3d.atoms;
        var atom = atoms && typeof atoms.get === 'function' ? atoms.get(atomId) : null;
        return atom ? nuclideOf(atom, atomId) : null;
      },
      // The isotope currently on screen for an atom, or null while it has no shell.
      shownNuclide: function(atomId) {
        var obj = shellObjects.get(atomId);
        return obj && obj.nuclide ? obj.nuclide : null;
      }
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
