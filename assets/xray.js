// X-Ray Mode - shows atomic structure: nucleus (protons/red + neutrons/gray) and electron shells
(function() {
  'use strict';

  var active = false;
  var shellObjects = new Map(); // atomId -> { group, shells, electrons }
  var animFrameId = null;
  var SHELL_CAP = [2, 8, 18, 32, 32, 18, 8];

  function showStatus(msg) {
    var el = document.getElementById('status-text');
    if (el) { el.textContent = msg; el.className = 'info'; }
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

  function createNucleus(protons, neutrons, THREE) {
    var group = new THREE.Group();
    var nucleusRadius = 0.15;
    var particleRadius = 0.05;

    // Nucleus sphere (transparent shell)
    var nucleusGeo = new THREE.SphereGeometry(nucleusRadius, 16, 16);
    var nucleusMat = new THREE.MeshBasicMaterial({
      color: 0xff6b6b,
      transparent: true,
      opacity: 0.3,
      wireframe: false
    });
    var nucleus = new THREE.Mesh(nucleusGeo, nucleusMat);
    group.add(nucleus);

    // Protons (red) and neutrons (gray) as small spheres
    var total = protons + neutrons;
    var protonGeo = new THREE.SphereGeometry(particleRadius, 8, 8);
    var neutronGeo = new THREE.SphereGeometry(particleRadius, 8, 8);
    var protonMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    var neutronMat = new THREE.MeshBasicMaterial({ color: 0x888888 });

    // Arrange particles in a simple cluster
    var positions = [];
    if (total === 1) {
      positions.push([0, 0, 0]);
    } else {
      // Simple spiral arrangement
      for (var i = 0; i < total; i++) {
        var angle = (i / total) * Math.PI * 4;
        var r = (i / total) * nucleusRadius * 0.7;
        var y = (i % 3 - 1) * particleRadius * 0.5;
        positions.push([Math.cos(angle) * r, y, Math.sin(angle) * r]);
      }
    }

    for (var j = 0; j < total; j++) {
      var isProton = j < protons;
      var particle = new THREE.Mesh(
        isProton ? protonGeo : neutronGeo,
        isProton ? protonMat : neutronMat
      );
      particle.position.set(positions[j][0], positions[j][1], positions[j][2]);
      group.add(particle);
    }

    return group;
  }

  function createElectronShells(shells, THREE, atomRadius) {
    var group = new THREE.Group();
    var shellObjects = [];
    var electronMeshes = [];

    for (var s = 0; s < shells.length; s++) {
      var count = shells[s];
      var shellRadius = atomRadius * (1.5 + s * 0.8);

      // Shell ring (torus)
      var torusGeo = new THREE.TorusGeometry(shellRadius, 0.02, 8, 32);
      var torusMat = new THREE.MeshBasicMaterial({
        color: 0x58a6ff,
        transparent: true,
        opacity: 0.4
      });
      var torus = new THREE.Mesh(torusGeo, torusMat);
      torus.rotation.x = Math.PI / 2;
      group.add(torus);
      shellObjects.push(torus);

      // Electrons on this shell
      var electronGeo = new THREE.SphereGeometry(0.06, 8, 8);
      var electronMat = new THREE.MeshBasicMaterial({ color: 0x58a6ff });

      for (var e = 0; e < count; e++) {
        var electron = new THREE.Mesh(electronGeo, electronMat);
        electron.userData = {
          shellIndex: s,
          electronIndex: e,
          shellRadius: shellRadius,
          angle: (e / count) * Math.PI * 2,
          speed: (0.3 + s * 0.15) * (s % 2 === 0 ? 1 : -1)
        };
        group.add(electron);
        electronMeshes.push(electron);
      }
    }

    return { group: group, shells: shellObjects, electrons: electronMeshes };
  }

  function createAtomStructure(atom, THREE) {
    var group = new THREE.Group();
    var el = atom.el;
    var protons = el.z;
    var neutrons = Math.round(el.mass) - protons;
    var shells = electronShells(protons);

    // Get atom display radius
    var atomRadius = 0.5; // Default, will be scaled
    if (window.__mol3d.displayRadius) {
      atomRadius = window.__mol3d.displayRadius(el);
    }

    // Create nucleus
    var nucleus = createNucleus(protons, neutrons, THREE);
    group.add(nucleus);

    // Create electron shells
    var shellData = createElectronShells(shells, THREE, atomRadius);
    group.add(shellData.group);

    return { group: group, shellData: shellData };
  }

  function updateShellPositions() {
    if (!active || !window.__mol3d || !window.__mol3d.atoms) return;

    var THREE = window.__mol3d.THREE;
    if (!THREE) return;

    var time = performance.now() * 0.001;

    // Update positions for each atom
    window.__mol3d.atoms.forEach(function(atom, id) {
      var shellObj = shellObjects.get(id);
      if (!shellObj) return;

      // Update group position to match atom
      shellObj.group.position.set(atom.pos.x, atom.pos.y, atom.pos.z);

      // Animate electrons
      shellObj.shellData.electrons.forEach(function(electron) {
        var data = electron.userData;
        var angle = data.angle + time * data.speed;
        electron.position.x = Math.cos(angle) * data.shellRadius;
        electron.position.z = Math.sin(angle) * data.shellRadius;
        electron.position.y = 0;
      });
    });

    // Render
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

    // Clear existing
    clearAllShells();

    // Create shells for each atom
    window.__mol3d.atoms.forEach(function(atom, id) {
      var structure = createAtomStructure(atom, THREE);
      structure.group.position.set(atom.pos.x, atom.pos.y, atom.pos.z);
      window.__mol3d.scene.add(structure.group);
      shellObjects.set(id, structure);
    });
  }

  function clearAllShells() {
    if (!window.__mol3d || !window.__mol3d.scene) return;
    shellObjects.forEach(function(obj) {
      window.__mol3d.scene.remove(obj.group);
      // Dispose geometries and materials
      obj.group.traverse(function(child) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(function(m) { m.dispose(); });
          } else {
            child.material.dispose();
          }
        }
      });
    });
    shellObjects.clear();
  }

  function applyWireframe() {
    if (!window.__mol3d || !window.__mol3d.scene) return;
    window.__mol3d.scene.traverse(function(obj) {
      if ((obj.isMesh || obj.isInstancedMesh) && obj.material && !shellObjects.has(obj.id)) {
        // Skip shell objects
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
    showStatus(active ? 'X-Ray mode ON - showing atomic structure' : 'X-Ray mode OFF');
    return active;
  }

  function init() {
    var btn = document.getElementById('btn-xray');
    if (btn) btn.addEventListener('click', function() { btn.classList.toggle('on', toggle()); });

    window.addEventListener('keydown', function(e) {
      if ((e.key === 'x' || e.key === 'X') && !e.ctrlKey && !e.altKey && !e.metaKey) {
        var tag = document.activeElement && document.activeElement.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && btn) { e.preventDefault(); btn.click(); }
      }
    });

    // Hook into atom creation/deletion to update shells
    var originalReanalyze = window.__mol3d && window.__mol3d.reanalyze;
    if (window.__mol3d && originalReanalyze) {
      window.__mol3d.reanalyze = function() {
        var result = originalReanalyze.apply(this, arguments);
        if (active) {
          // Rebuild shells after reanalyze (atoms may have changed)
          setTimeout(buildAllShells, 0);
        }
        return result;
      };
    }

    window.__xray = {
      toggle: toggle,
      isActive: function() { return active; },
      rebuild: buildAllShells
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
