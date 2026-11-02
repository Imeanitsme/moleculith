// X-Ray Mode - Schrödinger model: optimized electron probability clouds
(function() {
  'use strict';

  var active = false;
  var shellObjects = new Map(); // atomId -> { group, cloudData }
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

    // Single cloud layer with gradient opacity (optimized: was 3 layers)
    var cloudGeo = new THREE.SphereGeometry(shellRadius, 16, 16);
    var cloudMat = new THREE.MeshBasicMaterial({
      color: 0x58a6ff,
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
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
      electronCount: electronCount
    };
  }

  function createElectronShells(shells, THREE, atomRadius) {
    var group = new THREE.Group();
    var cloudData = [];

    for (var s = 0; s < shells.length; s++) {
      var count = shells[s];
      var cloud = createElectronCloud(s, count, THREE, atomRadius);
      group.add(cloud.group);
      cloudData.push(cloud);
    }

    return { group: group, cloudData: cloudData };
  }

  function createAtomStructure(atom, THREE) {
    var group = new THREE.Group();
    var el = atom.el;
    var protons = el.z;
    var neutrons = Math.round(el.mass) - protons;
    var shells = electronShells(protons);

    var atomRadius = 0.5;
    if (window.__mol3d.displayRadius) {
      atomRadius = window.__mol3d.displayRadius(el);
    }

    var nucleus = createNucleus(protons, neutrons, THREE);
    group.add(nucleus);

    var shellData = createElectronShells(shells, THREE, atomRadius);
    group.add(shellData.group);

    return { group: group, shellData: shellData };
  }

  // Update single atom's x-ray structure (for real-time proton gun updates)
  function updateAtomStructure(atomId, atom, THREE) {
    var existing = shellObjects.get(atomId);
    if (existing) {
      // Remove old structure
      window.__mol3d.scene.remove(existing.group);
      existing.group.traverse(function(child) {
        if (child.geometry) child.geometry.dispose();
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
    var structure = createAtomStructure(atom, THREE);
    structure.group.position.set(atom.pos.x, atom.pos.y, atom.pos.z);
    window.__mol3d.scene.add(structure.group);
    shellObjects.set(atomId, structure);
  }

  function updateShellPositions() {
    if (!active || !window.__mol3d || !window.__mol3d.atoms) return;

    var time = performance.now() * 0.001;

    window.__mol3d.atoms.forEach(function(atom, id) {
      var shellObj = shellObjects.get(id);
      if (!shellObj) return;

      shellObj.group.position.set(atom.pos.x, atom.pos.y, atom.pos.z);

      // Animate electron clouds (quantum fluctuation)
      shellObj.shellData.cloudData.forEach(function(cloud) {
        // Pulsing effect for cloud
        var pulse = 1.0 + Math.sin(time * 2) * 0.05;
        cloud.cloud.scale.set(pulse, pulse, pulse);
        cloud.cloud.material.opacity = 0.15 + Math.sin(time * 1.5) * 0.03;

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
    showStatus(active ? 'X-Ray mode ON - Schrödinger electron clouds' : 'X-Ray mode OFF');
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
          setTimeout(buildAllShells, 0);
        }
        return result;
      };
    }

    // Expose function for proton gun to update specific atom
    window.__xray = {
      toggle: toggle,
      isActive: function() { return active; },
      rebuild: buildAllShells,
      updateAtom: function(atomId, atom) {
        if (!active || !window.__mol3d || !window.__mol3d.THREE) return;
        updateAtomStructure(atomId, atom, window.__mol3d.THREE);
      }
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
