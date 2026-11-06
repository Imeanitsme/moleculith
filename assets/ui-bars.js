/* Bottom-bar element pool + collapsible action/status bars.
   Moves the pool out of the tabbed sidebar into a strip at the bottom of the
   screen and gives every horizontal bar an open/close button and a drag edge. */
(function () {
  'use strict';

  var SAVE_KEY = 'mol3d.uibars.v1';

  var STR = {
    en: {
      expand: 'Expand the pool',
      collapse: 'Collapse the pool',
      hideBar: 'Hide the action bar',
      showBar: 'Show the action bar',
      hideStatus: 'Hide the status bar',
      showStatus: 'Show the status bar',
      resize: 'Drag up or down to resize',
      elements: 'elements',
      oneElement: 'element'
    },
    vi: {
      expand: 'Mở rộng khay nguyên tố',
      collapse: 'Thu gọn khay nguyên tố',
      hideBar: 'Ẩn thanh nút',
      showBar: 'Hiện thanh nút',
      hideStatus: 'Ẩn thanh trạng thái',
      showStatus: 'Hiện thanh trạng thái',
      resize: 'Kéo lên xuống để đổi kích thước',
      elements: 'nguyên tố',
      oneElement: 'nguyên tố'
    }
  };

  var CHEV = {
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
    right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
    left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>'
  };

  var state = {
    poolOpen: false,
    poolH: 0,
    barOpen: true,
    barH: 0,
    barW: 0,
    statusOpen: true,
    statusH: 0
  };
  try {
    var saved = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (saved) for (var k in state) if (typeof saved[k] === typeof state[k]) state[k] = saved[k];
  } catch (e) { /* fresh layout */ }

  function persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* private mode */ }
  }

  var app = document.getElementById('app');
  var sidePool = document.getElementById('side-pool');
  var tools = document.getElementById('pool-tools');
  var list = document.getElementById('pool-list');
  var ptable = document.getElementById('ptable');
  var legend = document.getElementById('legend');
  var viewBtn = document.getElementById('pool-view');
  var search = document.getElementById('pool-search');
  var rightBar = document.getElementById('right-sidebar');
  var status = document.querySelector('.bottom-bar');

  function lang() {
    var a = window.__mol3d;
    var l = a && a.i18n ? a.i18n.getLang() : 'en';
    return l === 'vi' ? 'vi' : 'en';
  }
  function T() { return STR[lang()]; }

  function css() {
    return [
      '@media (min-width:641px){',
      '  #app{grid-template-columns:auto minmax(0,1fr) var(--rs-w,46px);max-width:100vw;',
      '    grid-template-rows:1fr auto var(--bb-h,40px);',
      '    grid-template-areas:"left scene right" "pool pool pool" "bottom bottom bottom";}',
      '  .right-sidebar{width:var(--rs-w,46px);}',
      '  .right-sidebar .ub-resize{display:block;}',
      '}',
      '@media (max-width:640px){',
      '  #app{grid-template-columns:minmax(0,1fr);max-width:100vw;',
      '    grid-template-rows:1fr auto auto var(--bb-h,40px) auto;',
      '    grid-template-areas:"scene" "actions" "pool" "bottom" "mtabs";}',
      '  .ub-resize.h-side,.right-sidebar .ub-resize{display:none;}',
      '}',
      '@media (max-height:500px) and (orientation:landscape){',
      '  #app{grid-template-columns:minmax(0,1fr);grid-template-rows:1fr auto auto var(--bb-h,32px);',
      '    grid-template-areas:"scene" "actions" "pool" "bottom";}',
      '  .right-sidebar{width:auto;}',
      '  .ub-resize.h-side,.right-sidebar .ub-resize{display:none;}',
      '}',
      '.right-sidebar.sized{height:var(--rs-h);align-self:start;}',
      '.right-sidebar.closed .action-btn,.right-sidebar.closed .drag-handle{display:none;}',
      '.bottom-bar{height:var(--bb-h,40px);min-height:0;}',
      '.bottom-bar.closed>*:not(#ub-status-toggle){display:none;}',
      '.bottom-bar.closed{justify-content:center;}',
      '.bottom-bar.closed #ub-status-toggle{width:22px;height:22px;}',
      '.bottom-bar.closed #ub-status-toggle svg{width:12px;height:12px;}',

      '#pool-bar{grid-area:pool;display:flex;flex-direction:column;position:relative;min-width:0;',
      '  background:var(--panel);border-top:1px solid var(--border);backdrop-filter:blur(12px);',
      '  z-index:40;min-height:0;}',
      '#pool-bar.open{height:var(--pb-h,34vh);}',
      '#pool-bar .pb-head{display:flex;align-items:center;gap:6px;padding:6px 10px;flex:none;min-width:0;}',
      '#pool-bar #pool-tools{margin:0;flex:1;min-width:0;align-items:center;}',
      '#pool-bar #pool-search{padding:4px 9px;font-size:12px;}',
      '#pool-bar #pool-view{font-size:11px;padding:4px 9px;flex:none;}',
      '#pool-bar .pb-count{font-size:10px;color:var(--muted);white-space:nowrap;flex:none;}',
      '#pool-bar .pb-body{flex:1;min-height:0;min-width:0;display:flex;flex-direction:column;gap:6px;padding:0;overflow:hidden;}',
      '#pool-bar .panel-hint{display:none;margin:0;padding:0 10px;font-size:10px;line-height:1.45;}',
      '#pool-bar.open .panel-hint{display:block;}',
      '#pool-bar #legend{display:none;padding:0 10px;}',
      '#pool-bar.open #legend{display:flex;}',
      '#pool-bar #ptable{flex:none;padding:0 10px;}',
      '#pool-bar #ptable[hidden]{display:none;}',
      '#pool-bar #pool-list[hidden]{display:none;}',
      // The old sidebar pool needed a swipe gutter; the bar scrolls natively.
      '#pool-bar #pool-scroll-gutter{display:none;}',

      '#pool-bar #pool-list{display:flex;flex-wrap:nowrap;gap:5px;overflow-x:auto;overflow-y:hidden;',
      '  min-width:0;padding:0 10px 7px;touch-action:pan-x;scrollbar-width:thin;flex:none;}',
      '#pool-bar #pool-list .el-chip{flex:none;width:auto;touch-action:pan-x;padding:4px 9px;}',
      '#pool-bar #pool-list::-webkit-scrollbar{height:5px;}',
      '#pool-bar #pool-list::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px;}',
      '#pool-bar.open #pool-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(122px,1fr));',
      '  gap:5px;overflow-x:hidden;overflow-y:auto;flex:1;min-height:0;padding:0 4px 8px 10px;',
      '  touch-action:pan-y;align-content:start;}',
      '#pool-bar.open #pool-list .el-chip{width:auto;touch-action:pan-y;}',
      '#pool-bar.open #pool-list::-webkit-scrollbar{width:8px;}',
      '@media (max-width:640px){',
      '  #pool-bar.open{height:var(--pb-h,42vh);}',
      '  #pool-bar.open #pool-list{grid-template-columns:repeat(auto-fill,minmax(132px,1fr));}',
      '}',

      '.ub-toggle{width:26px;height:26px;flex:none;display:flex;align-items:center;justify-content:center;',
      '  border:1px solid var(--border);border-radius:8px;background:var(--panel-2);color:var(--muted);',
      '  cursor:pointer;padding:0;transition:border-color .18s,color .18s;}',
      '.ub-toggle:hover{border-color:var(--accent);color:var(--accent);}',
      '.ub-toggle svg{width:14px;height:14px;}',
      '#right-sidebar .ub-toggle{margin:0 auto;}',
      '.bottom-bar .ub-toggle{margin:0 auto;}',

      '.ub-resize{position:absolute;top:0;left:0;right:0;height:7px;cursor:ns-resize;z-index:2;',
      '  touch-action:none;}',
      '.ub-resize::after{content:"";position:absolute;left:50%;top:2px;width:54px;height:3px;',
      '  margin-left:-27px;border-radius:2px;background:var(--border);opacity:0;transition:opacity .18s;}',
      '.ub-resize:hover::after,.ub-resize.active::after{opacity:1;}',
      // Bottom-edge grab, so the app's own 8px move handle at the top stays usable.
      '.ub-resize.edge-bottom{top:auto;bottom:0;}',
      '.ub-resize.edge-bottom::after{top:auto;bottom:2px;}',
      // A short centre zone leaves the rest of the top handle free for moving.
      '.ub-resize.zone{left:50%;right:auto;width:130px;margin-left:-65px;}',
      '#right-sidebar.sized .ub-resize{cursor:ns-resize;}',
      '.ub-resize.h-side{left:0;right:auto;top:50%;width:7px;height:44px;transform:translateY(-50%);cursor:ew-resize;}',
      '.ub-resize.h-side::after{top:50%;left:2px;width:3px;height:40px;margin:-20px 0 0 0;}'
    ].join('\n');
  }

  function injectStyles() {
    if (document.getElementById('ui-bar-styles')) return;
    var s = document.createElement('style');
    s.id = 'ui-bar-styles';
    s.textContent = css();
    document.head.appendChild(s);
  }

  function toggleBtn(id) {
    var b = document.createElement('button');
    b.type = 'button';
    b.id = id;
    b.className = 'ub-toggle';
    return b;
  }

  /* ── pool bar ── */
  var poolBar, poolToggle, poolCount, poolResize;

  function buildPoolBar() {
    poolBar = document.createElement('div');
    poolBar.id = 'pool-bar';
    poolBar.className = 'collapsed';
    poolBar.innerHTML = '<div class="ub-resize"></div><div class="pb-head"></div><div class="pb-body"></div>';

    poolResize = poolBar.querySelector('.ub-resize');
    var head = poolBar.querySelector('.pb-head');
    var body = poolBar.querySelector('.pb-body');

    head.appendChild(tools);
    poolCount = document.createElement('span');
    poolCount.className = 'pb-count';
    head.appendChild(poolCount);
    poolToggle = toggleBtn('ub-pool-toggle');
    head.appendChild(poolToggle);

    var hint = sidePool.querySelector('.panel-hint');
    if (hint) body.appendChild(hint);
    body.appendChild(list);
    body.appendChild(ptable);
    body.appendChild(legend);

    app.appendChild(poolBar);

    poolToggle.addEventListener('click', function () { setPool(!state.poolOpen); });
    makeResize(poolResize, {
      canResize: function () { return state.poolOpen; },
      get: function () { return poolBar.getBoundingClientRect().height; },
      set: function (px) {
        state.poolH = clamp(px, 110, window.innerHeight * 0.62);
        app.style.setProperty('--pb-h', Math.round(state.poolH) + 'px');
      },
      save: persist
    });

    // The periodic table needs the tall layout, so asking for it opens the bar.
    viewBtn.addEventListener('click', function () {
      setTimeout(function () { if (!ptable.hidden && !state.poolOpen) setPool(true); }, 0);
    });

    updateCount();
    search.addEventListener('input', updateCount);
    // The app fills #pool-list after this script runs, and rebuilds it whenever
    // Mayhem mode or a purchase changes the element set.
    if (window.MutationObserver) {
      new MutationObserver(updateCount).observe(list, { childList: true });
    }
  }

  function updateCount() {
    if (!poolCount) return;
    var chips = list.querySelectorAll('.el-chip');
    var n = 0;
    for (var i = 0; i < chips.length; i++) {
      if (chips[i].style.display !== 'none') n++;
    }
    poolCount.textContent = n + ' ' + (n === 1 ? T().oneElement : T().elements);
  }

  function setPool(open) {
    state.poolOpen = open;
    poolBar.classList.toggle('open', open);
    poolBar.classList.toggle('collapsed', !open);
    poolResize.style.display = open ? '' : 'none';
    if (open && !state.poolH) {
      state.poolH = Math.round(window.innerHeight * (window.innerWidth <= 640 ? 0.42 : 0.34));
    }
    app.style.setProperty('--pb-h', Math.round(state.poolH || 220) + 'px');
    relabel();
    persist();
  }

  /* ── action bar + status bar ── */
  var barToggle, statusToggle;

  function buildBarToggles() {
    var handle = rightBar.querySelector('.drag-handle');
    barToggle = toggleBtn('ub-bar-toggle');
    rightBar.insertBefore(barToggle, handle ? handle.nextSibling : rightBar.firstChild);
    barToggle.addEventListener('click', function () { setBar(!state.barOpen); });

    var rResize = document.createElement('div');
    rResize.className = 'ub-resize edge-bottom';
    rightBar.appendChild(rResize);
    makeResize(rResize, {
      edge: 'bottom',
      canResize: function () { return state.barOpen; },
      get: function () { return rightBar.getBoundingClientRect().height; },
      set: function (px) {
        state.barH = clamp(px, 40, window.innerHeight * 0.9);
        rightBar.style.setProperty('--rs-h', Math.round(state.barH) + 'px');
      },
      save: persist,
      onStart: function () { rightBar.classList.add('sized'); }
    });
    if (state.barH) {
      rightBar.classList.add('sized');
      rightBar.style.setProperty('--rs-h', Math.round(state.barH) + 'px');
    }

    // A second drag edge lets the bar be widened as well as lengthened.
    var wResize = document.createElement('div');
    wResize.className = 'ub-resize h-side';
    rightBar.appendChild(wResize);
    makeResize(wResize, {
      horizontal: true,
      canResize: function () { return state.barOpen; },
      get: function () { return rightBar.getBoundingClientRect().width; },
      set: function (px) {
        var w = clamp(px, 40, Math.min(140, window.innerWidth * 0.3));
        app.style.setProperty('--rs-w', Math.round(w) + 'px');
        state.barW = Math.round(w);
      },
      save: persist
    });
    if (state.barW) app.style.setProperty('--rs-w', Math.round(state.barW) + 'px');

    statusToggle = toggleBtn('ub-status-toggle');
    status.insertBefore(statusToggle, status.firstChild);
    statusToggle.addEventListener('click', function () { setStatus(!state.statusOpen); });

    var sResize = document.createElement('div');
    sResize.className = 'ub-resize zone';
    status.appendChild(sResize);
    makeResize(sResize, {
      canResize: function () { return state.statusOpen; },
      get: function () { return status.getBoundingClientRect().height; },
      set: function (px) {
        state.statusH = clamp(px, 34, 110);
        app.style.setProperty('--bb-h', Math.round(state.statusH) + 'px');
      },
      save: persist
    });
    if (state.statusH) app.style.setProperty('--bb-h', Math.round(state.statusH) + 'px');
  }

  function setBar(open) {
    state.barOpen = open;
    rightBar.classList.toggle('closed', !open);
    // On desktop the bar owns a grid column, so hiding it must also narrow that track.
    app.style.setProperty('--rs-w', open
      ? Math.round(state.barW || 46) + 'px'
      : '34px');
    if (!open) {
      rightBar.classList.remove('sized');
      state.barH = 0;
      rightBar.style.removeProperty('--rs-h');
    } else if (state.barH) {
      rightBar.classList.add('sized');
      rightBar.style.setProperty('--rs-h', Math.round(state.barH) + 'px');
    }
    relabel();
    persist();
  }

  function setStatus(open) {
    state.statusOpen = open;
    status.classList.toggle('closed', !open);
    app.style.setProperty('--bb-h', open
      ? Math.round(state.statusH || (window.innerHeight <= 500 ? 32 : 40)) + 'px'
      : '28px');
    relabel();
    persist();
  }

  /* ── shared drag-to-resize ── */
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function makeResize(handle, opts) {
    var id = null, origin = 0, start = 0;
    handle.addEventListener('pointerdown', function (e) {
      if (!opts.canResize()) return;
      id = e.pointerId;
      origin = opts.horizontal ? e.clientX : e.clientY;
      start = opts.get();
      handle.classList.add('active');
      try { handle.setPointerCapture(id); } catch (err) { /* older engines */ }
      if (opts.onStart) opts.onStart();
      e.preventDefault();
      e.stopPropagation();
    });
    handle.addEventListener('pointermove', function (e) {
      if (e.pointerId !== id) return;
      // A handle always sits on the edge that grows the bar when pulled away
      // from it: top/left edges invert the pointer delta, bottom edges do not.
      var delta = opts.horizontal
        ? origin - e.clientX
        : (opts.edge === 'bottom' ? e.clientY - origin : origin - e.clientY);
      opts.set(start + delta);
    });
    function end(e) {
      if (e.pointerId !== id) return;
      id = null;
      handle.classList.remove('active');
      opts.save();
    }
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  }

  /* ── labels ── */
  function relabel() {
    var t = T();
    if (poolToggle) {
      poolToggle.innerHTML = state.poolOpen ? CHEV.down : CHEV.up;
      poolToggle.title = state.poolOpen ? t.collapse : t.expand;
      poolToggle.setAttribute('aria-label', state.poolOpen ? t.collapse : t.expand);
      poolToggle.setAttribute('aria-expanded', state.poolOpen ? 'true' : 'false');
    }
    if (barToggle) {
      barToggle.innerHTML = state.barOpen ? CHEV.right : CHEV.left;
      barToggle.title = state.barOpen ? t.hideBar : t.showBar;
      barToggle.setAttribute('aria-label', state.barOpen ? t.hideBar : t.showBar);
    }
    if (statusToggle) {
      statusToggle.innerHTML = state.statusOpen ? CHEV.down : CHEV.up;
      statusToggle.title = state.statusOpen ? t.hideStatus : t.showStatus;
      statusToggle.setAttribute('aria-label', state.statusOpen ? t.hideStatus : t.showStatus);
    }
    updateCount();
  }

  /* ── retire the pool tab from the sidebar and the mobile tab bar ── */
  function retirePoolTabs() {
    var tab = document.querySelector('.sidebar-tab[data-panel="pool"]');
    if (tab) tab.remove();
    var mtab = document.querySelector('#mtabs button[data-tab="side-pool"]');
    if (mtab) mtab.remove();
    if (sidePool) sidePool.classList.remove('active', 'open');
    var info = document.querySelector('.sidebar-tab[data-panel="info"]');
    var infoPanel = document.getElementById('side-info');
    if (info && infoPanel && infoPanel.classList.contains('active')) info.classList.add('active');
  }

  function start() {
    if (!app || !sidePool || !list || !rightBar || !status) { setTimeout(start, 200); return; }
    if (document.getElementById('pool-bar')) return;
    injectStyles();
    buildPoolBar();
    buildBarToggles();
    retirePoolTabs();
    setPool(state.poolOpen);
    if (!state.barOpen) setBar(false);
    if (!state.statusOpen) setStatus(false);
    relabel();

    document.addEventListener('click', function (e) {
      var el = e.target;
      if (el && typeof el.closest === 'function' && el.closest('#btn-lang')) {
        setTimeout(relabel, 0);
      }
    }, true);

    window.__mol3dBars = {
      poolOpen: function () { return state.poolOpen; },
      setPool: setPool,
      setBar: setBar,
      setStatus: setStatus,
      state: function () { return JSON.parse(JSON.stringify(state)); }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 0); });
  } else {
    setTimeout(start, 0);
  }
})();
