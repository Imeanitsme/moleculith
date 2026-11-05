// Pool Drag-to-Drop System
(function() {
  'use strict';

  window.__poolDragActive = true;

  var dragging = false;
  var dragSym = null;
  var dragEl = null;
  var ghost = null;
  var sceneOverlay = false;
  var DRAG_THRESHOLD = 6;
  var startX = 0, startY = 0;
  var pendingChip = null;
  var pendingX = 0, pendingY = 0;

  function getSceneEl() {
    return document.getElementById('scene-wrap')
      || document.getElementById('scene-container')
      || document.getElementById('game-scene')
      || document.querySelector('.scene-wrapper');
  }

  function isOverScene(x, y) {
    var scene = getSceneEl();
    if (scene) {
      var r = scene.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return true;
    }
    var canvases = document.querySelectorAll('canvas');
    for (var i = 0; i < canvases.length; i++) {
      var c = canvases[i];
      if (c.id === 'bohr-canvas' || c.id === 'kinetics-canvas') continue;
      var cr = c.getBoundingClientRect();
      if (x >= cr.left && x <= cr.right && y >= cr.top && y <= cr.bottom) return true;
    }
    return false;
  }

  function createGhost(chip) {
    var g = document.createElement('div');
    g.id = 'pool-drag-ghost';
    var dot = chip.querySelector('i, .el-dot, [class*="dot"]');
    var sym = chip.querySelector('.s');
    var name = chip.querySelector('.n');
    var dotColor = dot ? (getComputedStyle(dot).backgroundColor || '#888') : '#888';
    g.innerHTML = '<div class="pool-ghost-chip">'
      + '<span class="pool-ghost-dot" style="background:' + dotColor + '"></span>'
      + '<span class="pool-ghost-sym">' + (sym ? sym.textContent : '') + '</span>'
      + '<span class="pool-ghost-name">' + (name ? name.textContent : '') + '</span>'
      + '</div>';
    return g;
  }

  function showSceneOverlay() {
    if (sceneOverlay) return;
    sceneOverlay = true;
    var scene = getSceneEl();
    if (scene) scene.classList.add('pool-drop-target');
  }

  function hideSceneOverlay() {
    if (!sceneOverlay) return;
    sceneOverlay = false;
    var scene = getSceneEl();
    if (scene) scene.classList.remove('pool-drop-target');
  }

  function spawnCinematic(x, y) {
    var burst = document.createElement('div');
    burst.className = 'pool-spawn-burst';
    burst.style.left = x + 'px';
    burst.style.top = y + 'px';
    document.body.appendChild(burst);
    setTimeout(function() { if (burst.parentNode) burst.remove(); }, 800);
  }

  function onPointerDown(e) {
    if (e.target.closest && e.target.closest('#pool-scroll-gutter')) return;
    var chip = e.target.closest('.el-chip');
    if (!chip) return;
    var poolList = document.getElementById('pool-list');
    if (!poolList || !poolList.contains(chip)) return;
    if (chip.classList.contains('locked')) return;

    if (e.pointerType === 'mouse') e.preventDefault();
    pendingChip = chip;
    startX = e.clientX;
    startY = e.clientY;
    pendingX = e.clientX;
    pendingY = e.clientY;
    dragSym = chip.dataset.sym;
    dragEl = window.__mol3d && window.__mol3d.ELEMENTS
      ? window.__mol3d.ELEMENTS.find(function(el) { return el.sym === dragSym; })
      : null;
  }

  function onPointerMove(e) {
    if (!pendingChip && !dragging) return;

    var cx = e.clientX;
    var cy = e.clientY;

    if (pendingChip && !dragging) {
      var dist = Math.hypot(cx - startX, cy - startY);
      if (dist < DRAG_THRESHOLD) return;
      dragging = true;
      pendingChip.classList.add('dragging');
      ghost = createGhost(pendingChip);
      document.body.appendChild(ghost);
      pendingChip = null;
    }

    if (!dragging || !ghost) return;
    e.preventDefault();

    ghost.style.left = (cx + 16) + 'px';
    ghost.style.top = (cy - 20) + 'px';

    if (isOverScene(cx, cy)) {
      showSceneOverlay();
      ghost.classList.add('over-scene');
    } else {
      hideSceneOverlay();
      ghost.classList.remove('over-scene');
    }
  }

  function onPointerUp(e) {
    if (pendingChip) {
      if (!dragging && dragEl) {
        if (window.__mol3d && window.__mol3d.spawnAtom) {
          window.__mol3d.spawnAtom(dragEl);
        }
      }
      pendingChip = null;
      dragging = false;
      dragEl = null;
      dragSym = null;
      return;
    }

    if (!dragging) return;

    var cx = e.clientX;
    var cy = e.clientY;

    if (isOverScene(cx, cy) && dragEl && window.__mol3d) {
      var placed = false;
      if (typeof window.__mol3d.spawnAtomFromScreen === 'function') {
        placed = window.__mol3d.spawnAtomFromScreen(dragEl, cx, cy) != null;
      }
      if (!placed && window.__mol3d.spawnAtom) {
        window.__mol3d.spawnAtom(dragEl);
      }
      spawnCinematic(cx, cy);
      if (document.body.classList.contains('mobile')) {
        var closeSheets = window.__mol3d && window.__mol3d.closeMobileSheets;
        if (typeof closeSheets === 'function') closeSheets();
      }
    }

    dragging = false;
    if (ghost && ghost.parentNode) ghost.remove();
    ghost = null;
    hideSceneOverlay();
    document.querySelectorAll('.el-chip.dragging').forEach(function(c) {
      c.classList.remove('dragging');
    });
    dragEl = null;
    dragSym = null;
  }

  function injectStyles() {
    if (document.getElementById('pool-drag-styles')) return;
    var s = document.createElement('style');
    s.id = 'pool-drag-styles';
    s.textContent = [
      '.el-chip { -webkit-user-select:none; user-select:none; touch-action:pan-y; }',
      '.el-chip.dragging { opacity:0.35; transform:scale(0.95) !important; }',

      '#pool-list { position:relative; }',
      '#pool-scroll-gutter {',
      '  position:absolute; top:0; right:0; bottom:0; width:0;',
      '  touch-action:pan-y; -webkit-user-select:none; user-select:none;',
      '  pointer-events:auto; opacity:0;',
      '}',
      'body.mobile #pool-list { padding-right:20px; }',
      'body.mobile #pool-scroll-gutter {',
      '  width:16px; opacity:1;',
      '  border-radius:8px;',
      '  background:repeating-linear-gradient(180deg, rgba(0,212,255,0.22) 0 5px, transparent 5px 13px);',
      '}',

      '#pool-drag-ghost {',
      '  position:fixed; z-index:10000; pointer-events:none;',
      '  transition: opacity 0.15s;',
      '  filter:drop-shadow(0 4px 16px rgba(0,212,255,0.35));',
      '}',
      '#pool-drag-ghost.over-scene {',
      '  filter:drop-shadow(0 4px 24px rgba(0,255,136,0.5));',
      '}',
      '.pool-ghost-chip {',
      '  display:flex; align-items:center; gap:6px;',
      '  padding:6px 12px 6px 8px;',
      '  background:linear-gradient(145deg, rgba(12,20,40,0.95), rgba(8,14,30,0.98));',
      '  border:1px solid rgba(0,212,255,0.5);',
      '  border-radius:14px;',
      '  backdrop-filter:blur(12px);',
      '  animation:ghostPulse 1.5s ease-in-out infinite;',
      '}',
      '#pool-drag-ghost * { pointer-events:none !important; }',
      '@keyframes ghostPulse {',
      '  0%,100% { border-color:rgba(0,212,255,0.5); box-shadow:0 0 12px rgba(0,212,255,0.2); }',
      '  50% { border-color:rgba(0,212,255,0.8); box-shadow:0 0 20px rgba(0,212,255,0.35); }',
      '}',
      '.pool-ghost-dot {',
      '  width:14px; height:14px; border-radius:50%; flex:none;',
      '  box-shadow:0 0 6px currentColor;',
      '}',
      '.pool-ghost-sym {',
      '  font-weight:700; font-size:13px; color:#e0f0ff;',
      '}',
      '.pool-ghost-name {',
      '  font-size:11px; color:rgba(224,240,255,0.6);',
      '}',

      '#scene-wrap.pool-drop-target {',
      '  outline:2px dashed rgba(0,212,255,0.3);',
      '  outline-offset:-2px;',
      '  transition:outline-color 0.2s;',
      '}',

      '.pool-spawn-burst {',
      '  position:fixed; z-index:9998; pointer-events:none;',
      '  width:40px; height:40px; margin-left:-20px; margin-top:-20px;',
      '  border-radius:50%;',
      '  background:radial-gradient(circle, rgba(0,212,255,0.6) 0%, rgba(0,255,136,0.3) 40%, transparent 70%);',
      '  animation:poolBurst 0.7s ease-out forwards;',
      '}',
      '@keyframes poolBurst {',
      '  0% { transform:scale(0); opacity:1; }',
      '  50% { transform:scale(2.5); opacity:0.6; }',
      '  100% { transform:scale(4); opacity:0; }',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function init() {
    injectStyles();

    var poolList = document.getElementById('pool-list');
    if (!poolList) {
      setTimeout(init, 500);
      return;
    }

    poolList.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', function() {
      dragging = false;
      pendingChip = null;
      if (ghost && ghost.parentNode) ghost.remove();
      ghost = null;
      hideSceneOverlay();
      document.querySelectorAll('.el-chip.dragging').forEach(function(c) {
        c.classList.remove('dragging');
      });
    });

    var gutter = document.createElement('div');
    gutter.id = 'pool-scroll-gutter';
    gutter.setAttribute('aria-hidden', 'true');
    var GUTTER_FALLBACK = {
      en: 'Swipe here to scroll the element list',
      vi: 'Vuốt ở đây để cuộn danh sách nguyên tố'
    };
    var applyGutterTitle = function() {
      var i18n = window.__mol3d && window.__mol3d.i18n;
      var lang = document.documentElement.lang === 'vi' ? 'vi' : 'en';
      var text = i18n && typeof i18n.t === 'function' ? i18n.t('pool.gutterTitle') : GUTTER_FALLBACK[lang];
      gutter.title = text === 'pool.gutterTitle' ? GUTTER_FALLBACK[lang] : text;
    };
    applyGutterTitle();
    new MutationObserver(applyGutterTitle).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['lang']
    });
    var keepGutter = function() {
      if (poolList.lastElementChild !== gutter) poolList.appendChild(gutter);
    };
    keepGutter();
    new MutationObserver(keepGutter).observe(poolList, { childList: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
