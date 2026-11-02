// Proton Gun & Nuclear Fission System - Standalone module
(function() {
  'use strict';

  let protonGunActive = false;
  let criticalTimerActive = false;
  let criticalCountdown = 60.0;
  let criticalInterval = null;

  function toggleProtonGun() {
    protonGunActive = !protonGunActive;
    showStatus(protonGunActive ? 'Proton gun activated - Click atoms to shoot!' : 'Proton gun deactivated');
    return protonGunActive;
  }

  function shootProton(event) {
    if (!protonGunActive || !window.__mol3d) return;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const camera = window.__mol3d.camera;
    const renderer = window.__mol3d.renderer;

    if (!camera || !renderer) return;

    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const atomMeshM = window.__mol3d.atomMeshM;
    const atomMeshN = window.__mol3d.atomMeshN;
    const meshes = [atomMeshM, atomMeshN].filter(Boolean);

    const intersects = raycaster.intersectObjects(meshes);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const mesh = hit.object;
      const instanceId = hit.instanceId;

      if (instanceId !== undefined) {
        const ids = mesh.userData.ids;
        if (ids && ids[instanceId] !== undefined) {
          const atomId = ids[instanceId];
          const atom = window.__mol3d.atoms.get(atomId);

          if (atom) {
            handleProtonHit(atom, atomId);
          }
        }
      }
    }
  }

  function handleProtonHit(atom, atomId) {
    const z = atom.el.z;

    if (z > 82) {
      startCriticalTimer(atom, atomId);
    } else {
      addProton(atom, atomId);
    }
  }

  function addProton(atom, atomId) {
    const newZ = atom.el.z + 1;
    const newEl = window.__mol3d.elements && window.__mol3d.elements.find(e => e.z === newZ);

    if (!newEl) {
      const ELEMENTS = window.__mol3d.ELEMENTS;
      if (ELEMENTS) {
        const el = ELEMENTS.find(e => e.z === newZ);
        if (el) {
          atom.el = el;
          showStatus(`Added proton: ${el.name}`);
          if (window.__mol3d.reanalyze) window.__mol3d.reanalyze();
          if (window.__mol3d.invalidate) window.__mol3d.invalidate();
        }
      }
      return;
    }

    atom.el = newEl;
    showStatus(`Added proton: ${newEl.name}`);
    if (window.__mol3d.reanalyze) window.__mol3d.reanalyze();
    if (window.__mol3d.invalidate) window.__mol3d.invalidate();
  }

  function startCriticalTimer(atom, atomId) {
    if (criticalTimerActive) return;

    criticalTimerActive = true;
    criticalCountdown = 60.0;
    showStatus(`⚠ CRITICAL: ${atom.el.name} (z=${atom.el.z}) - 60s to fission!`);

    criticalInterval = setInterval(function() {
      criticalCountdown -= 1;

      if (criticalCountdown <= 0) {
        triggerNuclearFission(atom, atomId);
      } else if (criticalCountdown <= 10) {
        showStatus(`☢ CRITICAL: ${criticalCountdown}s remaining!`);
      }
    }, 1000);
  }

  function triggerNuclearFission(atom, atomId) {
    clearInterval(criticalInterval);
    criticalTimerActive = false;

    if (!window.__mol3d || !window.__mol3d.atoms) return;

    const pos = atom.pos;
    const oldZ = atom.el.z;

    const split1 = Math.floor(oldZ / 2);
    const split2 = oldZ - split1;

    const ELEMENTS = window.__mol3d.ELEMENTS;
    if (!ELEMENTS) return;

    const el1 = ELEMENTS.find(e => e.z === split1);
    const el2 = ELEMENTS.find(e => e.z === split2);

    if (!el1 || !el2) return;

    window.__mol3d.atoms.delete(atomId);

    for (const [bid, b] of window.__mol3d.bonds) {
      if (b.a === atomId || b.b === atomId) {
        window.__mol3d.bonds.delete(bid);
      }
    }

    if (window.__mol3d.vfx && window.__mol3d.vfx.reactionVFX) {
      const THREE = window.THREE;
      if (THREE) {
        window.__mol3d.vfx.reactionVFX.explode(
          new THREE.Vector3(pos.x, pos.y, pos.z),
          3.0,
          new THREE.Color(0xff0000)
        );
      }
    }

    showStatus(`☢ ${ELEMENTS.find(e => e.z === oldZ).name} underwent fission → ${el1.name} + ${el2.name}`);

    if (window.__mol3d.reanalyze) window.__mol3d.reanalyze();
    if (window.__mol3d.invalidate) window.__mol3d.invalidate();
  }

  function showStatus(msg) {
    const statusEl = document.getElementById('status-text');
    if (statusEl) {
      statusEl.textContent = msg;
      statusEl.className = 'info';
    }
  }

  function init() {
    const btn = document.getElementById('btn-proton');
    if (btn) {
      btn.addEventListener('click', function() {
        const active = toggleProtonGun();
        btn.classList.toggle('on', active);
      });
    }

    const renderer = window.__mol3d && window.__mol3d.renderer;
    if (renderer) {
      renderer.domElement.addEventListener('click', shootProton);
    } else {
      const checkRenderer = setInterval(function() {
        if (window.__mol3d && window.__mol3d.renderer) {
          window.__mol3d.renderer.domElement.addEventListener('click', shootProton);
          clearInterval(checkRenderer);
        }
      }, 100);
    }

    window.__protonGun = {
      toggle: toggleProtonGun,
      isActive: () => protonGunActive,
      shoot: shootProton
    };

    console.log('[Proton Gun] Module initialized');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
