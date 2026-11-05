// Proton Gun & Nuclear Fission System - Standalone module
(function() {
  'use strict';
  let active = false;
  let timerInterval = null;
  let timerAtomId = null;
  let criticalOverlay = null;
  let redFlash = null;
  let whiteFlash = null;

  const NOBLE_GASES = new Set([2, 10, 18, 36, 54, 86, 118]);

  function showStatus(msg, kind) {
    const el = document.getElementById('status-text');
    if (el) { el.textContent = msg; el.className = kind || 'info'; }
  }

  function esc(v) { return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function tt(key, params) {
    const i18n = window.__mol3d && window.__mol3d.i18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, params) : key;
  }

  // The proton gun may only push an atom into an element the player actually owns.
  function ownsElement(z) {
    const shop = window.__mol3dShop;
    if (!shop || typeof shop.ownsElement !== 'function') return true;
    return !!shop.ownsElement(z);
  }
  function tierPriceFor(z) {
    const tiers = window.__mol3dShop && window.__mol3dShop.catalogue && window.__mol3dShop.catalogue.tiers;
    if (!Array.isArray(tiers)) return null;
    for (let i = 0; i < tiers.length; i++) if (z <= tiers[i].maxZ) return tiers[i].price;
    return null;
  }
  function elNameOf(el) {
    const i18n = window.__mol3d && window.__mol3d.i18n;
    try {
      if (el && i18n && typeof i18n.elName === 'function') return i18n.elName(el);
    } catch (e) {}
    return el ? (el.name || el.sym) : '';
  }
  function refuseUpgrade(newEl) {
    const price = tierPriceFor(newEl.z);
    const params = { sym: newEl.sym, name: elNameOf(newEl), price: price };
    const msg = price === null || price === undefined
      ? tt('pg.needOwn', params)
      : tt('pg.needOwnPrice', params);
    showStatus('🔒 ' + msg, 'err');
    const shop = window.__mol3dShop;
    if (shop && typeof shop.open === 'function') shop.open();
  }

  // --- Cinematic screen effects ---
  function createRedFlash() {
    if (redFlash) return;
    redFlash = document.createElement('div');
    redFlash.id = 'nuclear-red-flash';
    redFlash.style.cssText = [
      'position:fixed', 'top:0', 'left:0', 'width:100vw', 'height:100vh',
      'z-index:9990', 'pointer-events:none', 'display:none',
      'background:radial-gradient(ellipse at center, rgba(255,0,0,0.15) 0%, rgba(180,0,0,0.25) 100%)',
      'animation:nuclearRedPulse 1s ease-in-out infinite'
    ].join(';');
    if (!document.getElementById('nuclear-fx-styles')) {
      var style = document.createElement('style');
      style.id = 'nuclear-fx-styles';
      style.textContent = [
        '@keyframes nuclearRedPulse {',
        '  0% { opacity:0.3; } 50% { opacity:0.8; } 100% { opacity:0.3; }',
        '}',
        '@keyframes nuclearCountdownPulse {',
        '  0% { transform:scale(1); text-shadow:0 0 30px #ff0000, 0 0 60px #ff3300, 0 0 90px #ff0000; }',
        '  100% { transform:scale(1.08); text-shadow:0 0 50px #ff0000, 0 0 100px #ff3300, 0 0 150px #ff0000; }',
        '}',
        '@keyframes nuclearUrgentPulse {',
        '  0% { transform:scale(1); text-shadow:0 0 40px #ff0000, 0 0 80px #ff0000, 0 0 120px #ff3300; }',
        '  100% { transform:scale(1.15); text-shadow:0 0 60px #ff0000, 0 0 120px #ff0000, 0 0 180px #ff3300; }',
        '}',
        '@keyframes whiteFadeOut {',
        '  0% { opacity:1; } 80% { opacity:1; } 100% { opacity:0; }',
        '}',
        '.nuclear-countdown-num { font-variant-numeric:tabular-nums; }'
      ].join('\n');
      document.head.appendChild(style);
    }
    document.body.appendChild(redFlash);
  }

  function showRedFlash() {
    createRedFlash();
    redFlash.style.display = 'block';
  }

  function hideRedFlash() {
    if (!redFlash) return;
    redFlash.remove();
    redFlash = null;
  }

  function triggerWhiteFlash(durationSec, callback) {
    if (!whiteFlash) {
      whiteFlash = document.createElement('div');
      whiteFlash.id = 'nuclear-white-flash';
      whiteFlash.style.cssText = [
        'position:fixed', 'top:0', 'left:0', 'width:100vw', 'height:100vh',
        'z-index:99999', 'pointer-events:all', 'background:#ffffff',
        'display:flex', 'align-items:center', 'justify-content:center',
        'flex-direction:column', 'font-family:monospace'
      ].join(';');
      document.body.appendChild(whiteFlash);
    }
    whiteFlash.style.display = 'flex';
    whiteFlash.style.opacity = '1';
    whiteFlash.innerHTML = '<div style="color:#333;font-size:24px;font-weight:bold;letter-spacing:4px">'+esc(tt('pg.containment'))+'</div>'
      + '<div style="color:#666;font-size:16px;margin-top:12px">'+esc(tt('pg.reinitializing'))+'</div>'
      + '<div id="white-reset-countdown" style="color:#999;font-size:48px;margin-top:20px;font-weight:bold">' + durationSec + '</div>';

    var remaining = durationSec;
    var countEl = document.getElementById('white-reset-countdown');
    var iv = setInterval(function() {
      remaining--;
      if (countEl) countEl.textContent = remaining;
      if (remaining <= 0) {
        clearInterval(iv);
        whiteFlash.style.animation = 'whiteFadeOut 1.5s ease-out forwards';
        setTimeout(function() {
          whiteFlash.remove();
          whiteFlash = null;
          if (callback) callback();
        }, 1500);
      }
    }, 1000);
  }

  // --- Critical timer overlay (big cinematic counter) ---
  function createCriticalOverlay() {
    if (criticalOverlay) return;
    criticalOverlay = document.createElement('div');
    criticalOverlay.id = 'critical-timer-overlay';
    criticalOverlay.style.cssText = [
      'position:fixed', 'top:50%', 'left:50%',
      'transform:translate(-50%,-50%)',
      'z-index:9995', 'pointer-events:none', 'text-align:center',
      'font-family:"Courier New",monospace', 'font-weight:bold',
      'display:none', 'flex-direction:column', 'align-items:center',
      'background:rgba(0,0,0,0.75)', 'border:2px solid rgba(255,0,0,0.5)',
      'border-radius:16px', 'padding:24px 48px',
      'backdrop-filter:blur(6px)', 'box-shadow:0 0 60px rgba(255,0,0,0.3), inset 0 0 30px rgba(255,0,0,0.1)'
    ].join(';');

    criticalOverlay.innerHTML = ''
      + '<div id="critical-element" style="font-size:18px;color:#ff6644;letter-spacing:3px;margin-bottom:16px;text-shadow:0 0 10px #ff4400;white-space:nowrap"></div>'
      + '<div id="critical-countdown" class="nuclear-countdown-num" style="font-size:120px;line-height:1;color:#ff0000;text-shadow:0 0 30px #ff0000, 0 0 60px #ff3300, 0 0 90px #ff0000;animation:nuclearCountdownPulse 1s ease-in-out infinite alternate"></div>'
      + '<div style="font-size:14px;color:#ff4444;margin-top:16px;letter-spacing:8px;text-shadow:0 0 10px #ff0000">' + esc(tt('pg.toFission')) + '</div>';
    document.body.appendChild(criticalOverlay);
  }

  function updateCriticalOverlay(atomName, atomZ, countdown) {
    if (!criticalOverlay) createCriticalOverlay();
    var nameEl = document.getElementById('critical-element');
    var countEl = document.getElementById('critical-countdown');
    if (nameEl) nameEl.textContent = '\u2622 ' + atomName + ' (Z=' + atomZ + ')';
    if (countEl) {
      countEl.textContent = countdown;
      if (countdown <= 10) {
        countEl.style.animation = 'nuclearUrgentPulse 0.25s ease-in-out infinite alternate';
        countEl.style.color = '#ff0000';
      }
    }
    criticalOverlay.style.display = 'flex';
  }

  function hideCriticalOverlay() {
    if (!criticalOverlay) return;
    criticalOverlay.remove();
    criticalOverlay = null;
  }

  // --- Nuclear alarm sound ---
  function startAlarmSound() {
    try {
      var audio = document.getElementById('sfx-nuclear');
      if (audio) {
        audio.currentTime = 0;
        audio.volume = 0.6;
        audio.play().catch(function() {});
      }
    } catch (e) {}
  }

  function stopAlarmSound() {
    try {
      var audio = document.getElementById('sfx-nuclear');
      if (audio) { audio.pause(); audio.currentTime = 0; }
    } catch (e) {}
  }

  function clearCriticalTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    timerAtomId = null;
    stopAlarmSound();
    hideCriticalOverlay();
    hideRedFlash();
  }

  function getElements() {
    return (window.__mol3d && window.__mol3d.ELEMENTS) || null;
  }

  function findElement(z) {
    var els = getElements();
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
      // If already counting down on this atom, don't reset
      if (timerAtomId === atomId && timerInterval) {
        showStatus(tt('pg.alreadyCritical'));
        return;
      }
      startCriticalTimer(atom, atomId);
    } else {
      addProton(atom, atomId);
    }
  }

  function addProton(atom, atomId) {
    var newZ = atom.el.z + 1;
    var newEl = findElement(newZ);
    if (!newEl) { showStatus(tt('pg.noAbove', { z: atom.el.z })); return; }
    if (!ownsElement(newZ)) { refuseUpgrade(newEl); return; }

    var oldSym = atom.el.sym;
    var isNoble = NOBLE_GASES.has(newZ);
    atom.el = newEl;

    if (isNoble) {
      var bondsBroken = 0;
      for (var entry of window.__mol3d.bonds) {
        var b = entry[1];
        if (b.a === atomId || b.b === atomId) {
          window.__mol3d.bonds.delete(entry[0]);
          bondsBroken++;
        }
      }
      showStatus(tt('pg.addedProtonNoble', { from: oldSym, to: newEl.name, z: newZ, n: bondsBroken }));
    } else {
      showStatus(tt('pg.addedProton', { from: oldSym, to: newEl.name, z: newZ }));
    }

    if (window.__mol3d.updateAtomLabel) {
      window.__mol3d.updateAtomLabel(atomId, newEl);
    }

    if (window.__xray && window.__xray.isActive && window.__xray.isActive()) {
      window.__xray.updateAtom(atomId, atom);
    }

    if (window.__mol3d.refreshInspector) {
      window.__mol3d.refreshInspector();
    }

    if (window.__mol3d.reanalyze) window.__mol3d.reanalyze();
    if (window.__mol3d.invalidate) window.__mol3d.invalidate();
  }

  function startCriticalTimer(atom, atomId) {
    clearCriticalTimer();
    timerAtomId = atomId;
    var countdown = 60;

    showStatus(tt('pg.critical', { name: atom.el.name, z: atom.el.z, n: countdown }));
    createCriticalOverlay();
    updateCriticalOverlay(atom.el.name, atom.el.z, countdown);
    showRedFlash();
    startAlarmSound();

    timerInterval = setInterval(function() {
      if (!window.__mol3d || !window.__mol3d.atoms.has(atomId)) {
        clearCriticalTimer();
        return;
      }

      countdown--;
      updateCriticalOverlay(atom.el.name, atom.el.z, countdown);

      if (countdown > 0) {
        showStatus(tt('pg.criticalLeft', { n: countdown }));
      }

      if (countdown <= 0) {
        clearCriticalTimer();
        triggerFission(atomId);
      }
    }, 1000);
  }

  function resetCameraToGround() {
    if (!window.__mol3d || !window.__mol3d.camera) return;
    var cam = window.__mol3d.camera;
    cam.position.set(0, 4.2, 10.5);
    if (window.__mol3d.controls && window.__mol3d.controls.target) {
      window.__mol3d.controls.target.set(0, 1.6, 0);
      window.__mol3d.controls.update();
    }
    cam.lookAt(0, 0, 0);
  }

  function triggerFission(atomId) {
    if (!window.__mol3d || !window.__mol3d.atoms) return;
    var atom = window.__mol3d.atoms.get(atomId);
    if (!atom) return;
    var oldZ = atom.el.z;
    var oldName = atom.el.name;
    var pos = { x: atom.pos.x, y: atom.pos.y, z: atom.pos.z };

    if (window.__xray && window.__xray.removeAtom) {
      window.__xray.removeAtom(atomId);
    }

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
      window.__mol3d.vfx.reactionVFX.fission(
        new window.__mol3d.THREE.Vector3(pos.x, pos.y, pos.z), 5.0
      );
    }
    if (window.__mol3d.triggerNuclearVFX) {
      window.__mol3d.triggerNuclearVFX();
    }

    showStatus(tt('pg.fission', { name: oldName, a: el1.name, b: el2.name }));
    if (window.__mol3d.reanalyze) window.__mol3d.reanalyze();
    if (window.__mol3d.refreshInspector) window.__mol3d.refreshInspector();
    if (window.__mol3d.invalidate) window.__mol3d.invalidate();

    // Cinematic: white flash for 10 seconds, then reset to ground state
    triggerWhiteFlash(10, function() {
      if (window.__mol3d.clearAll) window.__mol3d.clearAll();
      resetCameraToGround();
      showStatus(tt('pg.restored', { name: oldName }));
    });
  }

  function init() {
    var btn = document.getElementById('btn-proton');
    if (btn) {
      btn.addEventListener('click', function() {
        if (window.__mol3dShop && window.__mol3dShop.blocksFeature('proton')) {
          showStatus(window.__mol3dShop.lockedMessage('proton'));
          window.__mol3dShop.open();
          return;
        }
        active = !active;
        btn.classList.toggle('on', active);
        showStatus(active ? tt('pg.on') : tt('pg.off'));
        // Don't clear critical timer when toggling off - fission continues independently
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
