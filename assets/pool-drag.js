// Pool Drag-to-Drop System
(function() {
  'use strict';

  var dragging = false;
  var dragSym = null;
  var dragElData = null;
  var ghost = null;
  var sceneOverlay = false;
  var DRAG_THRESHOLD = 6;
  var startX = 0, startY = 0;
  var pendingChip = null;
  var suppressClick = false;

  function isOverScene(x, y) {
    var candidates = [
      document.querySelector('#app canvas'),
      document.getElementById('scene-container'),
      document.getElementById('game-scene')
    ];
    for (var i = 0; i < candidates.length; i++) {
      var el = candidates[i];
      if (!el) continue;
      var r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return true;
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
    var canvas = document.querySelector('#app canvas');
    if (canvas) canvas.classList.add('pool-drop-target');
  }

  function hideSceneOverlay() {
    if (!sceneOverlay) return;
    sceneOverlay = false;
    var canvas = document.querySelector('#app canvas');
    if (canvas) canvas.classList.remove('pool-drop-target');
  }

  function spawnCinematic(x, y) {
    var burst = document.createElement('div');
    burst.className = 'pool-spawn-burst';
    burst.style.left = x + 'px';
    burst.style.top = y + 'px';
    document.body.appendChild(burst);
    setTimeout(function() { if (burst.parentNode) burst.remove(); }, 800);
  }

  function doSpawn() {
    if (!dragElData) return;
    if (window.__mol3d && window.__mol3d.spawnAtom) {
      window.__mol3d.spawnAtom(dragElData);
    }
    if (document.body.classList.contains('mobile')) {
      var closeSheets = window.__mol3d && window.__mol3d.closeMobileSheets;
      if (typeof closeSheets === 'function') closeSheets();
    }
  }

  function onPointerDown(e) {
    var chip = e.target.closest('.el-chip');
    if (!chip) return;
    var poolList = document.getElementById('pool-list');
    if (!poolList || !poolList.contains(chip)) return;
    if (chip.classList.contains('locked')) return;

    e.preventDefault();
    e.stopPropagation();
    suppressClick = true;
    setTimeout(function() { suppressClick = false; }, 400);

    pendingChip = chip;
    startX = e.clientX;
    startY = e.clientY;
    dragSym = chip.dataset.sym;
    dragElData = window.__mol3d && window.__mol3d.ELEMENTS
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
      if (!dragging && dragElData) {
        doSpawn();
      }
      pendingChip = null;
      dragging = false;
      dragElData = null;
      return;
    }

    if (!dragging) return;

    var cx = e.clientX;
    var cy = e.clientY;

    if (isOverScene(cx, cy) && dragElData) {
      doSpawn();
      spawnCinematic(cx, cy);
    }

    dragging = false;
    if (ghost && ghost.parentNode) ghost.remove();
    ghost = null;
    hideSceneOverlay();
    document.querySelectorAll('.el-chip.dragging').forEach(function(c) {
      c.classList.remove('dragging');
    });
    dragElData = null;
    dragSym = null;
  }

  function onDocumentClick(e) {
    if (suppressClick) {
      e.stopPropagation();
      e.preventDefault();
      suppressClick = false;
    }
  }

  function injectStyles() {
    if (document.getElementById('pool-drag-styles')) return;
    var s = document.createElement('style');
    s.id = 'pool-drag-styles';
    s.textContent = [
      '.el-chip { -webkit-user-select:none; user-select:none; touch-action:none; }',
      '.el-chip.dragging { opacity:0.35; transform:scale(0.95) !important; }',

      '#pool-drag-ghost, #pool-drag-ghost * {',
      '  pointer-events:none !important;',
      '}',
      '#pool-drag-ghost {',
      '  position:fixed; z-index:10000;',
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
      '@keyframes ghostPulse {',
      '  0%,100% { border-color:rgba(0,212,255,0.5); box-shadow:0 0 12px rgba(0,212,255,0.2); }',
      '  50% { border-color:rgba(0,212,255,0.8); box-shadow:0 0 20px rgba(0,212,255,0.35); }',
      '}',
      '.pool-ghost-dot {',
      '  width:14px; height:15px; border-radius:50%; flex:none;',
      '  box-shadow:0 0 6px currentColor;',
      '}',
      '.pool-ghost-sym {',
      '  font-weight:700; font-size:13px; color:#e0f0ff;',
      '}',
      '.pool-ghost-name {',
      '  font-size:11px; color:rgba(224,240,255,0.6);',
      '}',

      'canvas.pool-drop-target {',
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

    poolList.addEventListener('pointerdown', onPointerDown, true);
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
    document.addEventListener('click', onDocumentClick, true);

    var hint = document.querySelector('.panel-hint');
    if (hint && hint.textContent.indexOf('Click') !== -1) {
      hint.textContent = hint.textContent.replace('Click an element to place an atom.', 'Drag an element into the scene to place it.');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
