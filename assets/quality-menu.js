// Graphics quality dropdown - pick a tier instead of cycling
(function() {
  'use strict';

  // Order as requested: fixed tiers first, then Auto.
  var MODES = [
    { id: 'low', key: 'quality.low' },
    { id: 'med', key: 'quality.med' },
    { id: 'high', key: 'quality.high' },
    { id: 'ultra', key: 'quality.ultra' },
    { id: 'auto', key: 'quality.auto' }
  ];

  var panel = null, isOpen = false, anchorEl = null;

  function game() { return window.__mol3d || null; }
  function t(key, params) {
    var i18n = game() && game().i18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, params) : key;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function(c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function currentMode() {
    var m = game();
    return m && typeof m.quality === 'function' ? m.quality() : 'auto';
  }
  function currentTier() {
    var m = game();
    return m && typeof m.tierKey === 'function' ? m.tierKey() : 'med';
  }
  function labelFor(mode) {
    if (mode !== 'auto') return t('quality.' + mode);
    return t('quality.autoShort') + ' (' + t('quality.' + currentTier()) + ')';
  }

  var CSS = [
    '#quality-menu{position:fixed;z-index:1300;width:212px;background:var(--panel);border:1px solid var(--border);',
    '  border-radius:12px;box-shadow:0 14px 34px rgba(0,0,0,.45);backdrop-filter:blur(12px);padding:7px;',
    '  display:none;flex-direction:column;gap:3px;}',
    '#quality-menu.open{display:flex;}',
    '.qm-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;',
    '  color:var(--accent);padding:2px 6px 5px;}',
    '.qm-row{display:flex;align-items:center;gap:8px;width:100%;padding:7px 8px;border-radius:9px;',
    '  border:1px solid transparent;background:transparent;color:var(--text);font:inherit;font-size:12px;',
    '  text-align:left;cursor:pointer;transition:background .16s,border-color .16s;}',
    '.qm-row:hover{background:var(--panel-2);border-color:var(--border);}',
    '.qm-mark{width:14px;flex:none;color:var(--accent);font-weight:800;font-size:12px;}',
    '.qm-row.on{background:var(--accent-soft);border-color:var(--accent);font-weight:700;}',
    '.qm-row.on .qm-mark::after{content:"\\2713";}',
    '.qm-hint{font-size:10px;color:var(--muted);padding:3px 8px 5px;line-height:1.35;}',
    '@media (max-width:640px){',
    '  #quality-menu{width:184px;padding:6px;}',
    '  .qm-row{font-size:11px;padding:6px 7px;}',
    '  .qm-hint{font-size:9px;}',
    '}'
  ].join('\n');

  function build() {
    if (panel) return;
    var style = document.createElement('style');
    style.id = 'quality-menu-styles';
    style.textContent = CSS;
    document.head.appendChild(style);

    panel = document.createElement('div');
    panel.id = 'quality-menu';
    panel.setAttribute('role', 'menu');
    panel.addEventListener('click', function(e) {
      // Keep the host dropdown (menu / settings modal) from treating this as an outside click.
      e.stopPropagation();
    });
    document.body.appendChild(panel);
    render();
  }

  function render() {
    if (!panel) return;
    var mode = currentMode();
    var html = '<div class="qm-title">' + esc(t('qual.title')) + '</div>';
    MODES.forEach(function(m) {
      html += '<button type="button" class="qm-row' + (m.id === mode ? ' on' : '') + '"' +
        ' role="menuitemradio" aria-checked="' + (m.id === mode ? 'true' : 'false') + '"' +
        ' data-mode="' + m.id + '"><span class="qm-mark"></span><span>' + esc(t(m.key)) + '</span></button>';
      if (m.id === 'auto') html += '<div class="qm-hint">' + esc(t('qual.autoHint')) + '</div>';
    });
    panel.innerHTML = html;
    panel.querySelectorAll('.qm-row').forEach(function(row) {
      row.addEventListener('click', function() {
        pick(row.dataset.mode);
      });
    });
  }

  function pick(id) {
    var m = game();
    if (!m || typeof m.setQuality !== 'function') return;
    m.setQuality(id);
    if (typeof m.status === 'function') m.status(t('status.quality', { mode: labelFor(id) }), 'ok');
    render();
    place();
  }

  function anchorFrom() {
    if (anchorEl && document.body.contains(anchorEl) && anchorEl.offsetParent !== null) return anchorEl;
    return document.getElementById('btn-quality') || document.getElementById('settings-quality');
  }

  function place() {
    var a = anchorFrom();
    if (!a || !panel) return;
    var r = a.getBoundingClientRect();
    var w = panel.offsetWidth || 212;
    var h = panel.offsetHeight || 220;
    var vw = window.innerWidth, vh = window.innerHeight;
    function fits(x, y) {
      return x >= 8 && y >= 8 && x + w <= vw - 8 && y + h <= vh - 8;
    }
    // A settings row can be wider than the space beside it, in which case a
    // side placement would sit on top of the very control it was opened from.
    var spots = [
      [r.left - w - 8, r.top],
      [r.right + 8, r.top],
      [r.left, r.bottom + 8],
      [r.left, r.top - h - 8],
      [Math.min(r.right + 8, vw - w - 8), r.top]
    ];
    var chosen = null;
    for (var i = 0; i < spots.length; i++) {
      var x = Math.round(spots[i][0]), y = Math.round(spots[i][1]);
      if (!fits(x, y)) continue;
      if (x < r.right && x + w > r.left && y < r.bottom && y + h > r.top) continue;
      chosen = [x, y];
      break;
    }
    if (!chosen) chosen = [Math.round(Math.max(8, Math.min(spots[0][0], vw - w - 8))), Math.round(Math.max(8, Math.min(r.top, vh - h - 8)))];
    panel.style.left = chosen[0] + 'px';
    panel.style.top = chosen[1] + 'px';
  }

  function open(anchor) {
    build();
    anchorEl = anchor || anchorEl;
    render();
    panel.classList.add('open');
    isOpen = true;
    place();
  }
  function close() {
    if (!panel) return;
    panel.classList.remove('open');
    isOpen = false;
  }

  function init() {
    document.addEventListener('mol3d:quality-menu', function(e) {
      var id = (e.detail && e.detail.anchor) || 'btn-quality';
      var anchor = document.getElementById(id);
      if (isOpen && anchorEl === anchor) { close(); return; }
      open(anchor);
    });
    document.addEventListener('click', function(e) {
      if (!isOpen) return;
      if (panel.contains(e.target)) return;
      var a = anchorFrom();
      if (a && a.contains(e.target)) return;
      close();
    });
    window.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && isOpen) close();
    });
    window.addEventListener('resize', function() { if (isOpen) place(); });
    window.addEventListener('mol3d:lang', function() {
      if (!panel) return;
      render();
      if (isOpen) place();
    });
    window.__mol3dQualityMenu = {
      open: open,
      close: close,
      isOpen: function() { return isOpen; },
      modes: MODES.map(function(m) { return m.id; })
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
