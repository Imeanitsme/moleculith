// Proton Gun & Nuclear Fission System - Standalone module
(function() {
  'use strict';
  let active = false;
  let timerInterval = null;
  let timerAtomId = null;
  let criticalOverlay = null;
  let audioCtx = null;
  let alarmOsc = null;
  let alarmGain = null;

  const NOBLE_GASES = new Set([2, 10, 18, 36, 54, 86, 118]);

  function showStatus(msg) {
    const el = document.getElementById('status-text');
    if (el) { el.textContent = msg; el.className = 'info'; }
  }

  // --- Red pulsing critical timer overlay ---
  function createCriticalOverlay() {
    if (criticalOverlay) return;
    criticalOverlay = document.createElement('div');
    criticalOverlay.id = 'critical-timer-overlay';
    criticalOverlay.style.cssText = [
      'position:fixed', 'top:50%', 'left:50%', 'transform:translate(-50%,-50%)',
      'z-index:9999', 'pointer-events:none', 'text-align:center',
      'font-family:monospace', 'font-weight:bold', 'font-size:28px',
      'color:#ff0000', 'text-shadow:0 0 20px #ff0000, 0 0 40px #ff3300',
      'animation:criticalPulse 0.5s ease-in-out infinite alternate',
      'background:rgba(255,0,0,0.08)', 'border:2px solid rgba(255,0,0,0.6)',
      'border-radius:12px', 'padding:16px 32px', 'backdrop-filter:blur(4px)',
      'display:none'
    ].join(';');

    if (!document.getElementById('critical-pulse-style')) {
      var style = document.createElement('style');
      style.id = 'critical-pulse-style';
      style.textContent = [
        '@keyframes criticalPulse {',
        '  0% { opacity:0.7; transform:translate(-50%,-50%) scale(1); border-color:rgba(255,0,0,0.4); }',
        '  100% { opacity:1; transform:translate(-50%,-50%) scale(1.05); border-color:rgba(255,60,0,0.9); }',
        '}',
        '@keyframes criticalBorderFlash {',
        '  0% { border-color:rgba(255,0,0,0.3); }',
        '  50% { border-color:rgba(255,80,0,1); }',
        '  100% { border-color:rgba(255,0,0,0.3); }',
        '}'
      ].join('\n');
      document.head.appendChild(style);
    }

    criticalOverlay.innerHTML = '<div id="critical-element" style="font-size:18px;margin-bottom:4px;color:#ff6644"></div>'
      + '<div id="critical-countdown" style="font-size:48px;line-height:1">60</div>'
      + '<div style="font-size:14px;color:#ff4444;margin-top:4px">TO FISSION</div>';
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
        countEl.style.color = '#ff0000';
        countEl.style.fontSize = '56px';
        countEl.style.animation = 'criticalPulse 0.25s ease-in-out infinite alternate';
      }
    }
    criticalOverlay.style.display = 'block';
  }

  function hideCriticalOverlay() {
    if (criticalOverlay) criticalOverlay.style.display = 'none';
  }

  // --- Nuclear alarm sound via Web Audio API ---
  function startAlarmSound() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();

      alarmOsc = audioCtx.createOscillator();
      alarmGain = audioCtx.createGain();

      alarmOsc.type = 'sawtooth';
      alarmOsc.frequency.setValueAtTime(220, audioCtx.currentTime);
      alarmGain.gain.setValueAtTime(0.15, audioCtx.currentTime);

      alarmOsc.connect(alarmGain);
      alarmGain.connect(audioCtx.destination);

      // Siren sweep: oscillate between 220Hz and 440Hz
      var now = audioCtx.currentTime;
      for (var i = 0; i < 120; i++) {
        var t = now + i * 0.5;
        alarmOsc.frequency.setValueAtTime(220, t);
        alarmOsc.frequency.linearRampToValueAtTime(440, t + 0.25);
        alarmOsc.frequency.linearRampToValueAtTime(220, t + 0.5);
      }

      alarmOsc.start();
    } catch (e) { /* audio not available */ }
  }

  function stopAlarmSound() {
    try {
      if (alarmOsc) { alarmOsc.stop(); alarmOsc.disconnect(); alarmOsc = null; }
      if (alarmGain) { alarmGain.disconnect(); alarmGain = null; }
    } catch (e) { /* ignore */ }
  }

  function clearCriticalTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    timerAtomId = null;
    stopAlarmSound();
    hideCriticalOverlay();
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

    if (atom.el.z >= 82) {
      startCriticalTimer(atom, atomId);
    } else {
      addProton(atom, atomId);
    }
  }

  function addProton(atom, atomId) {
    var newZ = atom.el.z + 1;
    var newEl = findElement(newZ);
    if (!newEl) { showStatus('No element above Z=' + atom.el.z); return; }

    if (NOBLE_GASES.has(newZ)) {
      showStatus('Cannot create noble gas ' + newEl.name + ' \u2014 inert and unwavering!');
      return;
    }

    var oldSym = atom.el.sym;
    atom.el = newEl;
    showStatus('Added proton: ' + oldSym + ' \u2192 ' + newEl.name + ' (Z=' + newZ + ')');

    // Update label sprite with new element symbol
    if (window.__mol3d.updateAtomLabel) {
      window.__mol3d.updateAtomLabel(atomId, newEl);
    }

    // Update x-ray visualization in real-time if active
    if (window.__xray && window.__xray.isActive && window.__xray.isActive()) {
      window.__xray.updateAtom(atomId, atom);
    }

    // Refresh inspector if this atom is selected
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

    showStatus('\u2622 CRITICAL: ' + atom.el.name + ' (Z=' + atom.el.z + ') \u2014 ' + countdown + 's to fission!');
    createCriticalOverlay();
    updateCriticalOverlay(atom.el.name, atom.el.z, countdown);
    startAlarmSound();

    timerInterval = setInterval(function() {
      if (!window.__mol3d || !window.__mol3d.atoms.has(atomId)) {
        clearCriticalTimer();
        return;
      }

      countdown--;
      updateCriticalOverlay(atom.el.name, atom.el.z, countdown);

      if (countdown > 0) {
        showStatus('\u2622 CRITICAL: ' + countdown + 's remaining!');
      }

      if (countdown <= 0) {
        clearCriticalTimer();
        triggerFission(atomId);
      }
    }, 1000);
  }

  function triggerFission(atomId) {
    if (!window.__mol3d || !window.__mol3d.atoms) return;
    var atom = window.__mol3d.atoms.get(atomId);
    if (!atom) return;
    var oldZ = atom.el.z;
    var oldName = atom.el.name;
    var pos = { x: atom.pos.x, y: atom.pos.y, z: atom.pos.z };

    // Clean up x-ray shell before deleting atom
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
      window.__mol3d.vfx.reactionVFX.explode(
        new window.__mol3d.THREE.Vector3(pos.x, pos.y, pos.z), 3.0, new window.__mol3d.THREE.Color(0xff0000)
      );
    }

    showStatus('\uD83D\uDCA5 ' + oldName + ' underwent fission: ' + el1.name + ' + ' + el2.name);
    if (window.__mol3d.reanalyze) window.__mol3d.reanalyze();
    if (window.__mol3d.refreshInspector) window.__mol3d.refreshInspector();
    if (window.__mol3d.invalidate) window.__mol3d.invalidate();
  }

  function init() {
    var btn = document.getElementById('btn-proton');
    if (btn) {
      btn.addEventListener('click', function() {
        active = !active;
        btn.classList.toggle('on', active);
        showStatus(active ? 'Proton gun activated \u2014 Click atoms!' : 'Proton gun deactivated');
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
