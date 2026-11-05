// Format panel - X-Ray configuration above the formal charge controls
(function() {
  'use strict';

  var SHELL_NAMES = ['K', 'L', 'M', 'N', 'O', 'P', 'Q'];
  var btn = null, panel = null, open = false;

  function tt(key, params) {
    var i18n = window.__mol3d && window.__mol3d.i18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, params) : key;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function(c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function xrayApi() {
    return window.__xray || null;
  }
  function gameApi() {
    return window.__mol3d || null;
  }
  function xrayLocked() {
    var shop = window.__mol3dShop;
    return !!(shop && typeof shop.blocksFeature === 'function' && shop.blocksFeature('xray'));
  }

  var CSS = [
    '#format-panel{position:fixed;z-index:1200;width:min(330px,86vw);max-height:min(72vh,560px);',
    '  overflow-y:auto;touch-action:pan-y;background:var(--panel);border:1px solid var(--border);',
    '  border-radius:14px;box-shadow:0 16px 40px rgba(0,0,0,.5);backdrop-filter:blur(12px);',
    '  padding:10px 12px 12px;display:none;}',
    '#format-panel.open{display:block;}',
    '.fm-head{display:flex;align-items:center;gap:8px;margin-bottom:6px;}',
    '.fm-title{font-size:12px;font-weight:700;letter-spacing:.3px;}',
    '.fm-close{margin-left:auto;width:22px;height:22px;border-radius:7px;border:1px solid var(--border);',
    '  background:transparent;color:var(--muted);cursor:pointer;font-size:13px;line-height:1;}',
    '.fm-close:hover{color:var(--text);border-color:var(--accent);}',
    '.fm-section{border-top:1px solid var(--border);padding:9px 0 2px;}',
    '.fm-section:first-of-type{border-top:none;}',
    '.fm-sec-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;',
    '  color:var(--accent);margin-bottom:6px;}',
    '.fm-sec-note{font-size:10px;color:var(--muted);line-height:1.4;margin:2px 0 6px;}',
    '.fm-row{display:flex;align-items:center;gap:9px;width:100%;padding:6px 7px;margin-bottom:4px;',
    '  border:1px solid var(--border);border-radius:10px;background:var(--panel-2);color:var(--text);',
    '  font:inherit;text-align:left;cursor:pointer;transition:border-color .18s;}',
    '.fm-row:hover{border-color:var(--accent);}',
    '.fm-row:disabled{opacity:.45;cursor:not-allowed;}','.fm-row:disabled:hover{border-color:var(--border);}',
    '.fm-row-main{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1;}',
    '.fm-row-title{font-size:12px;font-weight:700;}',
    '.fm-row-hint{font-size:10px;color:var(--muted);line-height:1.35;}',
    '.fm-switch{flex:none;width:34px;height:18px;border-radius:9px;background:var(--border);',
    '  position:relative;transition:background .18s;}',
    '.fm-switch::after{content:"";position:absolute;top:2px;left:2px;width:14px;height:14px;',
    '  border-radius:50%;background:var(--muted);transition:transform .18s,background .18s;}',
    '.fm-row[aria-checked="true"] .fm-switch{background:var(--accent-soft);}',
    '.fm-row[aria-checked="true"] .fm-switch::after{transform:translateX(16px);background:var(--accent);}',
    '.fm-chips{display:flex;flex-wrap:wrap;gap:5px;margin:2px 0 6px;}',
    '.fm-chip{min-width:34px;padding:5px 7px;border-radius:9px;border:1px solid var(--border);',
    '  background:var(--panel-2);color:var(--muted);font:inherit;font-size:11px;font-weight:700;',
    '  cursor:pointer;transition:border-color .16s,color .16s;}',
    '.fm-chip.on{color:var(--text);border-color:var(--accent);background:var(--accent-soft);}',
    '.fm-chip:hover{border-color:var(--accent);}',
    '.fm-chip-link{background:none;border:none;color:var(--accent);font:inherit;font-size:10px;',
    '  font-weight:700;cursor:pointer;padding:5px 4px;text-decoration:underline;}',
    '@media (max-width:640px){',
    '  #format-panel{width:min(300px,80vw);max-height:58vh;padding:8px 10px 10px;}',
    '  .fm-row-title{font-size:11px;}',
    '  .fm-row-hint{font-size:9px;}',
    '  .fm-chip{min-width:30px;padding:4px 6px;font-size:10px;}',
    '}'
  ].join('\n');

  function switchRow(key, titleKey, hintKey, onClick, isChecked) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'fm-row';
    b.setAttribute('role', 'switch');
    b.dataset.key = key;
    b.innerHTML =
      '<span class="fm-row-main">' +
        '<span class="fm-row-title">' + esc(tt(titleKey)) + '</span>' +
        (hintKey ? '<span class="fm-row-hint">' + esc(tt(hintKey)) + '</span>' : '') +
      '</span>' +
      '<span class="fm-switch"></span>';
    b.addEventListener('click', function() {
      onClick(!isChecked());
      paint();
    });
    return b;
  }

  function config() {
    var x = xrayApi();
    if (x && typeof x.config === 'function') return x.config();
    return { grid: false, labels: true, shells: [true, true, true, true, true, true, true] };
  }

  function fcOn() {
    var m = gameApi();
    return !!(m && typeof m.fc === 'function' ? m.fc() : true);
  }

  function setGrid(v) {
    var x = xrayApi();
    if (x && typeof x.setConfig === 'function') x.setConfig({ grid: v });
  }
  function setLabels(v) {
    var x = xrayApi();
    if (x && typeof x.setConfig === 'function') x.setConfig({ labels: v });
  }
  function setShell(i, v) {
    var x = xrayApi();
    if (!x || typeof x.setConfig !== 'function') return;
    var next = config().shells.slice();
    next[i] = v;
    x.setConfig({ shells: next });
  }
  function setAllShells(v) {
    var x = xrayApi();
    if (!x || typeof x.setConfig !== 'function') return;
    var next = SHELL_NAMES.map(function() { return v; });
    x.setConfig({ shells: next });
  }
  function setFc(v) {
    var m = gameApi();
    if (m && typeof m.setFc === 'function') m.setFc(v);
  }

  function build() {
    if (panel) return;
    var style = document.createElement('style');
    style.id = 'format-panel-styles';
    style.textContent = CSS;
    document.head.appendChild(style);

    panel = document.createElement('div');
    panel.id = 'format-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', tt('btn.format.title'));

    var head = document.createElement('div');
    head.className = 'fm-head';
    head.innerHTML = '<span class="fm-title">' + esc(tt('btn.format.title')) + '</span>' +
      '<button type="button" class="fm-close" aria-label="' + esc(tt('ui.close')) + '">×</button>';
    panel.appendChild(head);

    var xraySec = document.createElement('div');
    xraySec.className = 'fm-section';
    xraySec.innerHTML = '<div class="fm-sec-title" data-i18n="fmt.xray">' + esc(tt('fmt.xray')) + '</div>';
    xraySec.appendChild(switchRow('grid', 'fmt.grid', 'fmt.gridHint', setGrid, function() { return config().grid; }));
    xraySec.appendChild(switchRow('labels', 'fmt.labels', 'fmt.labelsHint', setLabels, function() { return config().labels; }));
    var shellsNote = document.createElement('div');
    shellsNote.className = 'fm-sec-note';
    shellsNote.textContent = tt('fmt.shellsHint');
    panel.appendChild(xraySec);

    var chipsWrap = document.createElement('div');
    chipsWrap.className = 'fm-chips';
    var chipsHead = document.createElement('div');
    chipsHead.className = 'fm-sec-title';
    chipsHead.textContent = tt('fmt.shells');
    xraySec.appendChild(chipsHead);
    xraySec.appendChild(shellsNote);
    SHELL_NAMES.forEach(function(name, i) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'fm-chip';
      chip.dataset.shell = String(i);
      chip.textContent = name;
      chip.addEventListener('click', function() {
        setShell(i, !config().shells[i]);
        paint();
      });
      chipsWrap.appendChild(chip);
    });
    var allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = 'fm-chip-link';
    allBtn.dataset.all = 'true';
    allBtn.textContent = tt('fmt.all');
    allBtn.addEventListener('click', function() { setAllShells(true); paint(); });
    var noneBtn = document.createElement('button');
    noneBtn.type = 'button';
    noneBtn.className = 'fm-chip-link';
    noneBtn.dataset.all = 'false';
    noneBtn.textContent = tt('fmt.none');
    noneBtn.addEventListener('click', function() { setAllShells(false); paint(); });
    chipsWrap.appendChild(allBtn);
    chipsWrap.appendChild(noneBtn);
    xraySec.appendChild(chipsWrap);

    var fcSec = document.createElement('div');
    fcSec.className = 'fm-section';
    fcSec.innerHTML = '<div class="fm-sec-title">' + esc(tt('btn.fc')) + '</div>';
    fcSec.appendChild(switchRow('fc', 'btn.fc', 'fmt.fcHint', setFc, fcOn));
    panel.appendChild(fcSec);

    document.body.appendChild(panel);

    head.querySelector('.fm-close').addEventListener('click', close);
    paint();
  }

  function paint() {
    if (!panel) return;
    var cfg = config();
    var locked = xrayLocked();
    var gridRow = panel.querySelector('.fm-row[data-key="grid"]');
    var labelRow = panel.querySelector('.fm-row[data-key="labels"]');
    var fcRow = panel.querySelector('.fm-row[data-key="fc"]');
    if (gridRow) {
      gridRow.setAttribute('aria-checked', cfg.grid ? 'true' : 'false');
      gridRow.disabled = locked;
    }
    if (labelRow) {
      labelRow.setAttribute('aria-checked', cfg.labels ? 'true' : 'false');
      labelRow.disabled = locked;
    }
    panel.querySelectorAll('.fm-chip[data-shell]').forEach(function(chip) {
      var i = parseInt(chip.dataset.shell, 10);
      chip.classList.toggle('on', cfg.shells[i] !== false);
      chip.disabled = locked;
    });
    panel.querySelectorAll('.fm-chip-link').forEach(function(b) { b.disabled = locked; });
    if (fcRow) fcRow.setAttribute('aria-checked', fcOn() ? 'true' : 'false');
    var note = panel.querySelector('.fm-sec-note[data-locked]');
    if (!note && locked) {
      note = document.createElement('div');
      note.className = 'fm-sec-note';
      note.dataset.locked = '1';
      note.textContent = tt('fmt.xrayLocked');
      var sec = panel.querySelector('.fm-section');
      if (sec) sec.appendChild(note);
    } else if (note && !locked) {
      note.remove();
    }
  }

  function place() {
    if (!btn || !panel) return;
    var r = btn.getBoundingClientRect();
    // The sidebar can sit on either edge; open toward the scene, never over the button strip.
    var towardLeft = r.right > window.innerWidth / 2;
    panel.style.right = '';
    panel.style.left = '';
    if (towardLeft) panel.style.right = Math.round(window.innerWidth - r.left + 8) + 'px';
    else panel.style.left = Math.round(r.right + 8) + 'px';
    var h = panel.offsetHeight || 260;
    var top = Math.round(r.top - 8);
    top = Math.max(8, Math.min(top, window.innerHeight - h - 8));
    panel.style.top = top + 'px';
    panel.style.bottom = 'auto';
  }

  function openPanel() {
    build();
    paint();
    panel.classList.add('open');
    open = true;
    place();
    if (btn) {
      btn.classList.add('on');
      btn.setAttribute('aria-expanded', 'true');
    }
  }
  function close() {
    if (!panel) return;
    panel.classList.remove('open');
    open = false;
    if (btn) {
      btn.classList.remove('on');
      btn.setAttribute('aria-expanded', 'false');
    }
  }
  function toggle() {
    if (open) close(); else openPanel();
  }

  function relabelButton() {
    if (!btn) return;
    btn.setAttribute('data-i18n-title', 'btn.format.title');
    btn.setAttribute('title', tt('btn.format.title'));
    btn.setAttribute('aria-label', tt('btn.format.title'));
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    var icon = btn.querySelector('[data-lucide]');
    if (icon && icon.getAttribute('data-lucide') !== 'superscript') {
      icon.setAttribute('data-lucide', 'superscript');
      icon.innerHTML = '';
      try {
        if (typeof window.lucide !== 'undefined' && window.lucide.createIcons) window.lucide.createIcons();
      } catch (e) {}
    }
  }

  function init() {
    btn = document.getElementById('btn-fc');
    if (!btn) return;
    relabelButton();
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      toggle();
    });
    document.addEventListener('click', function(e) {
      if (!open) return;
      if (panel.contains(e.target) || btn.contains(e.target)) return;
      close();
    });
    window.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && open) close();
    });
    window.addEventListener('resize', function() { if (open) place(); });
    window.addEventListener('scroll', function() { if (open) place(); }, true);
    window.addEventListener('mol3d:lang', function() {
      relabelButton();
      if (!panel) return;
      panel.setAttribute('aria-label', tt('btn.format.title'));
      var title = panel.querySelector('.fm-title');
      if (title) title.textContent = tt('btn.format.title');
      var closeBtn = panel.querySelector('.fm-close');
      if (closeBtn) closeBtn.setAttribute('aria-label', tt('ui.close'));
      var secs = panel.querySelectorAll('.fm-sec-title');
      if (secs[0]) secs[0].textContent = tt('fmt.xray');
      if (secs[1]) secs[1].textContent = tt('fmt.shells');
      if (secs[2]) secs[2].textContent = tt('btn.fc');
      panel.querySelectorAll('.fm-row').forEach(function(row) {
        var t2 = row.querySelector('.fm-row-title');
        var h = row.querySelector('.fm-row-hint');
        if (t2) t2.textContent = tt(row.dataset.key === 'fc' ? 'btn.fc' : row.dataset.key === 'grid' ? 'fmt.grid' : 'fmt.labels');
        if (h) h.textContent = tt(row.dataset.key === 'fc' ? 'fmt.fcHint' : row.dataset.key === 'grid' ? 'fmt.gridHint' : 'fmt.labelsHint');
      });
      var notes = panel.querySelectorAll('.fm-sec-note');
      notes.forEach(function(n) {
        n.textContent = n.dataset.locked ? tt('fmt.xrayLocked') : tt('fmt.shellsHint');
      });
      panel.querySelectorAll('.fm-chip-link').forEach(function(b) {
        b.textContent = b.dataset.all === 'true' ? tt('fmt.all') : tt('fmt.none');
      });
      paint();
      if (open) place();
    });
    window.__mol3dFormat = {
      open: openPanel,
      close: close,
      toggle: toggle,
      isOpen: function() { return open; }
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
