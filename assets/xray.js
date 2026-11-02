// X-Ray Mode System - Standalone module
// Shows atomic structure: nucleus (protons/red + neutrons/gray) and electron shells
(function() {
  'use strict';

  var isXRayActive = false;
  var xrayGroup = null;
  var atomVisuals = {};
  var animFrameId = null;

  var SHELL_COLORS = [0x00ccff, 0x00ff88, 0xffcc00, 0xff6600, 0xff00cc, 0x8800ff, 0x00ffcc];

  function showStatus(msg) {
    var el = document.getElementById('status-text');
    if (el) { el.textContent = msg; el.className = 'info'; }
  }

  function getAtomPos(atomId) {
    if (!window.__mol3d || !window.__mol3d.atoms) return null;
    var atom = window.__mol3d.atoms.get(atomId);
    return atom ? atom.pos : null;
  }

  function getAtomEl(atomId) {
    if (!window.__mol3d || !window.__mol3d.atoms) return null;
    var atom = window.__mol3d.atoms.get(atomId);
    return atom ? atom.el : null;
  }

  function createNucleus(atomId, el) {
    var THREE = window.__mol3d.THREE;
    if (!THREE) return null;

    var group = new THREE.Group();
    var z = el.z;
    var a = el.mass ? Math.round(el.mass) : z * 2;
    var neutrons = Math.max(0, a - z);
    var nucleusR = 0.08 + Math.pow(z, 1/3) * 0.04;

    var protonGeo = new THREE.SphereGeometry(nucleusR, 8, 6);
    var protonMat = new THREE.MeshBasicMaterial({ color: 0xff3333 });
    var neutronGeo = new THREE.SphereGeometry(nucleusR, 8, 6);
    var neutronMat = new THREE.MeshBasicMaterial({ color: 0x999999 });

    var total = Math.min(z + neutrons, 64);
    var protonsPlaced = 0;
    var neutronsPlaced = 0;

    for (var i = 0; i < total; i++) {
      var isProton = protonsPlaced < z && (neutronsPlaced >= neutrons || i % 2 === 0);
      var mesh = new THREE.Mesh(
        isProton ? protonGeo : neutronGeo,
        isProton ? protonMat : neutronMat
      );

      var phi = Math.acos(1 - 2 * (i + 0.5) / total);
      var theta = Math.PI * (1 + Math.sqrt(5)) * i;
      var r = nucleusR * 0.6 * Math.cbrt((i + 1) / total);
      mesh.position.set(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      );

      if (isProton) protonsPlaced++;
      else neutronsPlaced++;

      group.add(mesh);
    }

    var labelCanvas = document.createElement('canvas');
    labelCanvas.width = 128;
    labelCanvas.height = 64;
    var ctx = labelCanvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(el.sym, 64, 24);
    ctx.font = '18px monospace';
    ctx.fillStyle = '#aaaaaa';
    ctx.fillText('Z=' + z, 64, 50);

    var labelTex = new THREE.CanvasTexture(labelCanvas);
    var labelMat = new THREE.SpriteMaterial({ map: labelTex, transparent: true, depthTest: false });
    var label = new THREE.Sprite(labelMat);
    label.scale.set(0.8, 0.4, 1);
    label.position.set(0, nucleusR + 0.4, 0);
    group.add(label);

    return group;
  }

  function createShellRings(atomId, el) {
    var THREE = window.__mol3d.THREE;
    if (!THREE) return [];

    var shells = [];
    var shellFn = window.__mol3d.electronShells;
    var shellCounts;

    if (shellFn) {
      shellCounts = shellFn(el.z);
    } else {
      shellCounts = [];
      var remaining = el.z;
      var caps = [2, 8, 18, 32, 32, 18, 8];
      for (var i = 0; i < caps.length && remaining > 0; i++) {
        var n = Math.min(remaining, caps[i]);
        shellCounts.push(n);
        remaining -= n;
      }
    }

    var baseR = 0.35;
    var gap = 0.25;

    for (var s = 0; s < shellCounts.length; s++) {
      var radius = baseR + s * gap;
      var ringGeo = new THREE.TorusGeometry(radius, 0.012, 8, 48);
      var ringMat = new THREE.MeshBasicMaterial({
        color: SHELL_COLORS[s % SHELL_COLORS.length],
        transparent: true,
        opacity: 0.6
      });
      var ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.userData.shellIndex = s;
      ring.userData.electronCount = shellCounts[s];
      ring.userData.radius = radius;
      shells.push(ring);

      if (s > 0 && s % 2 === 0) {
        var ring2 = ring.clone();
        ring2.rotation.x = Math.PI / 3;
        ring2.rotation.z = Math.PI / 4;
        ring2.userData = Object.assign({}, ring.userData);
        shells.push(ring2);
      }

      var electronCount = shellCounts[s];
      var dotGeo = new THREE.SphereGeometry(0.03, 6, 4);
      var dotMat = new THREE.MeshBasicMaterial({
        color: SHELL_COLORS[s % SHELL_COLORS.length]
      });
      for (var e = 0; e < Math.min(electronCount, 12); e++) {
        var dot = new THREE.Mesh(dotGeo, dotMat);
        var angle = (e / Math.min(electronCount, 12)) * Math.PI * 2;
        dot.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
        dot.userData.orbitAngle = angle;
        dot.userData.orbitRadius = radius;
        dot.userData.orbitSpeed = 0.5 / (s + 1);
        dot.userData.isElectron = true;
        ring.add(dot);
      }
    }

    return shells;
  }

  function buildXRayVisuals() {
    if (!window.__mol3d || !window.__mol3d.atoms || !window.__mol3d.THREE) return;
    var THREE = window.__mol3d.THREE;

    if (xrayGroup) {
      window.__mol3d.scene.remove(xrayGroup);
      xrayGroup = null;
    }
    atomVisuals = {};
    xrayGroup = new THREE.Group();

    window.__mol3d.atoms.forEach(function(atom, id) {
      var el = atom.el;
      if (!el) return;

      var group = new THREE.Group();
      group.position.set(atom.pos.x, atom.pos.y, atom.pos.z);

      var nucleus = createNucleus(id, el);
      if (nucleus) group.add(nucleus);

      var shells = createShellRings(id, el);
      for (var i = 0; i < shells.length; i++) {
        group.add(shells[i]);
      }

      xrayGroup.add(group);
      atomVisuals[id] = { group: group, nucleus: nucleus, shells: shells };
    });

    window.__mol3d.scene.add(xrayGroup);
  }

  function updateXRayVisuals() {
    if (!isXRayActive || !xrayGroup) return;
    var THREE = window.__mol3d.THREE;
    if (!THREE) return;

    var toRemove = [];
    for (var id in atomVisuals) {
      var pos = getAtomPos(parseInt(id));
      if (!pos) {
        toRemove.push(id);
        continue;
      }
      var vis = atomVisuals[id];
      vis.group.position.set(pos.x, pos.y, pos.z);

      for (var s = 0; s < vis.shells.length; s++) {
        var shell = vis.shells[s];
        for (var c = 0; c < shell.children.length; c++) {
          var child = shell.children[c];
          if (child.userData.isElectron) {
            child.userData.orbitAngle += child.userData.orbitSpeed * 0.016;
            var r = child.userData.orbitRadius;
            var a = child.userData.orbitAngle;
            child.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
          }
        }
      }
    }

    for (var i = 0; i < toRemove.length; i++) {
      var vis2 = atomVisuals[toRemove[i]];
      if (vis2 && vis2.group && vis2.group.parent) {
        vis2.group.parent.remove(vis2.group);
      }
      delete atomVisuals[toRemove[i]];
    }

    window.__mol3d.atoms.forEach(function(atom, id) {
      if (!atomVisuals[id]) {
        var el = atom.el;
        if (!el) return;
        var group = new THREE.Group();
        group.position.set(atom.pos.x, atom.pos.y, atom.pos.z);
        var nucleus = createNucleus(id, el);
        if (nucleus) group.add(nucleus);
        var shells = createShellRings(id, el);
        for (var j = 0; j < shells.length; j++) group.add(shells[j]);
        xrayGroup.add(group);
        atomVisuals[id] = { group: group, nucleus: nucleus, shells: shells };
      }
    });
  }

  function animLoop() {
    if (!isXRayActive) { animFrameId = null; return; }
    updateXRayVisuals();
    animFrameId = requestAnimationFrame(animLoop);
  }

  function applyXRayVisuals() {
    if (!window.__mol3d) return;
    var matM = window.__mol3d.atomMatM;
    var matN = window.__mol3d.atomMatN;
    if (!matM || !matN) return;

    if (isXRayActive) {
      matM.transparent = true;
      matM.opacity = 0.15;
      matM.wireframe = true;
      matN.transparent = true;
      matN.opacity = 0.15;
      matN.wireframe = true;
      matM.needsUpdate = true;
      matN.needsUpdate = true;

      buildXRayVisuals();
      if (!animFrameId) animFrameId = requestAnimationFrame(animLoop);
    } else {
      matM.transparent = false;
      matM.opacity = 1.0;
      matM.wireframe = false;
      matN.transparent = false;
      matN.opacity = 1.0;
      matN.wireframe = false;
      matM.needsUpdate = true;
      matN.needsUpdate = true;

      if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
      if (xrayGroup && window.__mol3d.scene) {
        window.__mol3d.scene.remove(xrayGroup);
      }
      xrayGroup = null;
      atomVisuals = {};
    }

    if (window.__mol3d.invalidate) window.__mol3d.invalidate();
  }

  function toggleXRay() {
    isXRayActive = !isXRayActive;
    applyXRayVisuals();
    showStatus(isXRayActive ? 'X-Ray mode: atomic structure visible' : 'X-Ray mode disabled');
    return isXRayActive;
  }

  function init() {
    var btn = document.getElementById('btn-xray');
    if (btn) {
      btn.addEventListener('click', function() {
        btn.classList.toggle('on', toggleXRay());
      });
    }

    window.addEventListener('keydown', function(e) {
      if ((e.key === 'x' || e.key === 'X') && !e.ctrlKey && !e.altKey && !e.metaKey) {
        var tag = document.activeElement && document.activeElement.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && btn) {
          e.preventDefault();
          btn.click();
        }
      }
    });

    window.__xray = { toggle: toggleXRay, isActive: function() { return isXRayActive; } };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
