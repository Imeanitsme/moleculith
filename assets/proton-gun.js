// Proton Gun & Nuclear Fission System - Standalone module
(function() {
  'use strict';
  let active = false;
  let timerInterval = null;
  let timerAtomId = null;

  function showStatus(msg) {
    const el = document.getElementById('status-text');
    if (el) { el.textContent = msg; el.className = 'info'; }
  }

  function clearCriticalTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    timerAtomId = null;
  }

  function getElements() {
    return (window.__mol3d && window.__mol3d.ELEMENTS) || null;
  }

  function findElement(z) {
    const els = getElements();
    return els ? els.find(function(e) { return e.z === z; }) : null;
  }

  function findAtomMeshes() {
    if (!window.__mol3d || !window.__mol3d.scene) return [];
    var meshes = [];
    window.__mol3d.scene.traverse(function(obj) {
      if (obj.isInstancedMesh && obj.userData.ids) meshes.push(obj);
    });
    return meshes;
  }

  function shootProton(event) {
    if (!active || !window.__mol3d || !window.__mol3d.THREE) return;
    var THREE = window.__mol3d.THREE;
    var camera = window.__mol3d.camera;
    var renderer = window.__mol3d.renderer;
    if (!camera || !renderer) return;

    var rect = renderer.domElement.getBoundingClientRect();
    var mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    var raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    var meshes = findAtomMeshes();
    var hits = raycaster.intersectObjects(meshes);
    if (!hits.length) return;

    var hit = hits[0];
    var ids = hit.object.userData.ids;
    if (!ids || hit.instanceId === undefined) return;

    var atomId = ids[hit.instanceId];
    var atom = window.__mol3d.atoms.get(atomId);
    if (!atom) return;

    if (atom.el.z > 82) {
      startCriticalTimer(atom, atomId);
    } else {
      addProton(atom);
    }
  }

  function addProton(atom) {
    var newEl = findElement(atom.el.z + 1);
    if (!newEl) { showStatus('No element above Z=' + atom.el.z); return; }
    atom.el = newEl;
    showStatus('Added proton: ' + newEl.name);
    if (window.__mol3d.reanalyze) window.__mol3d.reanalyze();
    if (window.__mol3d.renderer && window.__mol3d.camera) {
      window.__mol3d.renderer.render(window.__mol3d.scene, window.__mol3d.camera);
    }
  }

  function startCriticalTimer(atom, atomId) {
    if (timerInterval) return;
    timerAtomId = atomId;
    var countdown = 60;
    showStatus('CRITICAL: ' + atom.el.name + ' (Z=' + atom.el.z + ') - ' + countdown + 's to fission!');
    timerInterval = setInterval(function() {
      if (!window.__mol3d || !window.__mol3d.atoms.has(atomId)) { clearCriticalTimer(); return; }
      countdown--;
      if (countdown <= 0) { clearCriticalTimer(); triggerFission(atomId); }
      else if (countdown <= 10) { showStatus('CRITICAL: ' + countdown + 's remaining!'); }
    }, 1000);
  }

  function triggerFission(atomId) {
    if (!window.__mol3d || !window.__mol3d.atoms) return;
    var atom = window.__mol3d.atoms.get(atomId);
    if (!atom) return;
    var oldZ = atom.el.z;
    var oldName = atom.el.name;
    var pos = atom.pos;
    var split1 = Math.floor(oldZ / 2);
    var split2 = oldZ - split1;
    var el1 = findElement(split1);
    var el2 = findElement(split2);
    if (!el1 || !el2) return;

    window.__mol3d.atoms.delete(atomId);
    for (var entry of window.__mol3d.bonds) {
      var b = entry[1];
      if (b.a === atomId || b.b === atomId) window.__mol3d.bonds.delete(entry[0]);
    }

    if (window.__mol3d.vfx && window.__mol3d.vfx.reactionVFX && window.__mol3d.THREE) {
      window.__mol3d.vfx.reactionVFX.explode(
        new window.__mol3d.THREE.Vector3(pos.x, pos.y, pos.z), 3.0, new window.__mol3d.THREE.Color(0xff0000)
      );
    }

    showStatus(oldName + ' underwent fission: ' + el1.name + ' + ' + el2.name);
    if (window.__mol3d.reanalyze) window.__mol3d.reanalyze();
    if (window.__mol3d.renderer && window.__mol3d.camera) {
      window.__mol3d.renderer.render(window.__mol3d.scene, window.__mol3d.camera);
    }
  }

  function init() {
    var btn = document.getElementById('btn-proton');
    if (btn) {
      btn.addEventListener('click', function() {
        active = !active;
        btn.classList.toggle('on', active);
        showStatus(active ? 'Proton gun activated - Click atoms!' : 'Proton gun deactivated');
        if (!active) clearCriticalTimer();
      });
    }

    function attachClick() {
      if (window.__mol3d && window.__mol3d.renderer) {
        window.__mol3d.renderer.domElement.addEventListener('click', shootProton);
        return true;
      }
      return false;
    }

    if (!attachClick()) {
      var poll = setInterval(function() { if (attachClick()) clearInterval(poll); }, 200);
    }

    window.__protonGun = {
      toggle: function() { if (btn) btn.click(); },
      isActive: function() { return active; },
      shoot: shootProton
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
