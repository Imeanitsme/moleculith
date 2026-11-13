/* Adaptive shell.
   Every floating surface used to be pinned to a guessed offset (bottom:140px,
   bottom:80px, max-height:calc(100vh - 130px)). Those guesses broke whenever the
   dock changed height — an expanded pool, a wrapped action row, a landscape
   phone. This module measures the real chrome once per frame and publishes it as
   --dock-h / --top-h / --free-h, then every overlay anchors to the measurement.
   It also owns the app grid for all breakpoints so no element can ever land in
   an implicit grid row, and drives a proportional density scale. */
(function () {
  'use strict';
  if (window.__mol3dResponsiveMounted) return;
  window.__mol3dResponsiveMounted = true;

  var SAVE_KEY = 'mol3d.uiShell.v1';
  var SHEET_IDS = ['side-pool', 'side-info', 'side-dex'];
  var COMPACT_MQ = '(max-width: 820px), (max-height: 560px)';

  var STR = {
    en: {
      dockHide: 'Focus mode — hide the tool bars',
      dockShow: 'Show the tool bars',
      closePanel: 'Close panel',
      more: 'Scroll for more tools',
      pool: 'Elements', info: 'Information', dex: 'Notebook',
      density: 'Interface size',
      hintMore: 'Show every tip', hintLess: 'Hide the extra tips'
    },
    vi: {
      dockHide: 'Chế độ tập trung — ẩn các thanh công cụ',
      dockShow: 'Hiện các thanh công cụ',
      closePanel: 'Đóng bảng',
      more: 'Cuộn để xem thêm công cụ',
      pool: 'Nguyên tố', info: 'Thông tin', dex: 'Sổ tay',
      density: 'Cỡ giao diện',
      hintMore: 'Hiện đủ mọi mẹo', hintLess: 'Ẩn các mẹo khác'
    }
  };

  var state = { dockMin: false, scaleOverride: 0 };
  try {
    var saved = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (saved) {
      if (typeof saved.dockMin === 'boolean') state.dockMin = saved.dockMin;
      if (typeof saved.scaleOverride === 'number') state.scaleOverride = saved.scaleOverride;
    }
  } catch (e) { /* fresh shell */ }

  function persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* private mode */ }
  }

  function api() { return window.__mol3d; }
  function lang() {
    var a = api();
    var l = a && a.i18n ? a.i18n.getLang() : (localStorage.getItem('mol3d.lang') || 'vi');
    return l === 'en' ? 'en' : 'vi';
  }
  function T() { return STR[lang()]; }

  var root = document.documentElement;
  var mq = window.matchMedia(COMPACT_MQ);
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ── density ── */
  function autoScale(vw, vh) {
    var compact = vw <= 820 || vh <= 560;
    if (!compact) {
      if (vw >= 2400 && vh >= 1300) return 1.26;
      if (vw >= 1900 && vh >= 1000) return 1.12;
      if (vw >= 1500) return 1;
      if (vw >= 1100) return 0.94;
      return 0.88;
    }
    if (vh <= 560) return vh <= 400 ? 0.72 : 0.8;
    var m = Math.min(vw, vh);
    if (m <= 330) return 0.76;
    if (m <= 370) return 0.82;
    if (m <= 430) return 0.88;
    return 0.96;
  }

  /* ── stylesheet ── */
  function css() {
    return [
      /* tokens */
      ':root{',
      '  --ui-scale:1;--app-h:100dvh;--app-w:100vw;--top-h:44px;--dock-h:0px;--free-h:100dvh;',
      '  --rz-track:rgba(0,212,255,.06);--rz-thumb:rgba(0,212,255,.42);',
      '  --rz-violet:#7a5cff;--rz-magenta:#e040fb;--rz-mint:#00ffc8;',
      '  --tap:calc(38px * var(--ui-scale));--gap:calc(7px * var(--ui-scale));',
      '  --pad:calc(9px * var(--ui-scale));--r-sm:calc(7px * var(--ui-scale));',
      '  --r-md:calc(11px * var(--ui-scale));--r-lg:calc(16px * var(--ui-scale));',
      '  --fs-xs:calc(10px * var(--ui-scale));--fs-sm:calc(11.5px * var(--ui-scale));',
      '  --fs-md:calc(13px * var(--ui-scale));--fs-lg:calc(16px * var(--ui-scale));',
      '  --safe-t:env(safe-area-inset-top,0px);--safe-b:env(safe-area-inset-bottom,0px);',
      '  --safe-l:env(safe-area-inset-left,0px);--safe-r:env(safe-area-inset-right,0px);',
      '}',
      // The arcade set (scrollbars, the wheel, the boost chip) is neon because it sits
      // on a dark shell. On the light shell those same hues land at 1.1:1, so each one
      // keeps its hue and drops its brightness rather than being replaced by a generic
      // blue: mint goes teal-700, magenta goes fuchsia-700, violet goes violet-700.
      // --rz-ink is the deepened cyan that small accent-hue readouts need on light
      // panels; --accent itself stays the brand cyan for the whole app.
      'html[data-theme="light"]{',
      '  --rz-track:rgba(0,90,140,.08);--rz-thumb:rgba(0,90,140,.3);',
      '  --rz-violet:#5b21b6;--rz-magenta:#a21caf;--rz-mint:#0b6f66;--rz-ink:#0369a1;',
      '}',
      'html{zoom:1 !important;--ui-zoom:1 !important;height:100%;}',
      'html,body{overflow:hidden;overscroll-behavior:none;-webkit-text-size-adjust:100%;}',
      'body{height:100%;}',

      /* themed scrollbars */
      '*{scrollbar-width:thin;scrollbar-color:var(--rz-thumb) var(--rz-track);}',
      '::-webkit-scrollbar{width:calc(9px * var(--ui-scale));height:calc(9px * var(--ui-scale));}',
      '::-webkit-scrollbar-track{background:var(--rz-track);border-radius:99px;}',
      '::-webkit-scrollbar-thumb{border-radius:99px;border:2px solid transparent;background-clip:padding-box;',
      '  background-color:var(--rz-thumb);background-image:linear-gradient(160deg,var(--accent),var(--rz-violet));}',
      '::-webkit-scrollbar-thumb:hover{background-image:linear-gradient(160deg,#8ef4ff,var(--rz-magenta));}',
      '::-webkit-scrollbar-corner{background:transparent;}',

      /* ambient depth behind the translucent panels */
      '#rz-aurora{position:fixed;inset:-25%;z-index:0;pointer-events:none;opacity:.55;',
      '  filter:blur(70px);will-change:transform;',
      '  background:',
      '    radial-gradient(38% 44% at 18% 22%,rgba(0,212,255,.30),transparent 70%),',
      '    radial-gradient(34% 40% at 82% 30%,rgba(122,92,255,.26),transparent 70%),',
      '    radial-gradient(42% 38% at 60% 88%,rgba(224,64,251,.18),transparent 70%),',
      '    radial-gradient(30% 30% at 30% 78%,rgba(0,255,200,.14),transparent 70%);',
      '  animation:rzDrift 46s ease-in-out infinite alternate;}',
      '@keyframes rzDrift{',
      '  0%{transform:translate3d(-2%,-1%,0) scale(1);}',
      '  50%{transform:translate3d(3%,2%,0) scale(1.08);}',
      '  100%{transform:translate3d(-1%,3%,0) scale(1.03);}}',
      'html[data-theme="light"] #rz-aurora{opacity:.32;filter:blur(80px);}',
      '@media (prefers-reduced-motion:reduce){#rz-aurora{animation:none;}}',

      /* ── grid: wide ── */
      'html.rz-wide #app{display:grid;height:var(--app-h);max-width:100vw;',
      '  grid-template-columns:auto minmax(0,1fr) auto;',
      '  grid-template-rows:minmax(0,1fr) auto auto;',
      '  grid-template-areas:"left scene right" "pool pool pool" "bottom bottom bottom";}',
      'html.rz-wide #left-sidebar{grid-area:left;}',
      'html.rz-wide #scene-wrap{grid-area:scene;}',
      'html.rz-wide #right-sidebar{grid-area:right;width:var(--rs-w,calc(46px * var(--ui-scale)));}',
      'html.rz-wide #pool-bar{grid-area:pool;}',
      'html.rz-wide .bottom-bar{grid-area:bottom;}',
      'html.rz-wide #mtabs{grid-area:bottom;display:none;}',
      'html.rz-wide #rz-dock-toggle{display:none;}',
      'html.rz-wide #rz-sheet-head{display:none;}',

      /* ── grid: compact ── */
      'html.rz-compact #app{display:grid;height:var(--app-h);max-width:100vw;',
      '  grid-template-columns:minmax(0,1fr);',
      '  grid-template-rows:minmax(0,1fr) auto auto auto auto;',
      '  grid-template-areas:"scene" "actions" "pool" "bottom" "mtabs";}',
      'html.rz-compact #left-sidebar{grid-area:scene;}',
      'html.rz-compact #scene-wrap{grid-area:scene;}',
      'html.rz-compact #right-sidebar{grid-area:actions;}',
      'html.rz-compact #pool-bar{grid-area:pool;}',
      'html.rz-compact .bottom-bar{grid-area:bottom;}',
      'html.rz-compact #mtabs{grid-area:mtabs;display:flex;}',
      /* focus mode: the two optional strips fold away, navigation stays */
      'html.rz-compact.rz-dock-min #app{grid-template-rows:minmax(0,1fr) auto auto;',
      '  grid-template-areas:"scene" "bottom" "mtabs";}',
      'html.rz-compact.rz-dock-min #right-sidebar,',
      'html.rz-compact.rz-dock-min #pool-bar{display:none;}',
      'html.rz-compact.rz-dock-min .bottom-bar .time-controls{flex:0 1 auto;}',

      /* ── top bar + persistent player HUD ── */
      '.top-bar{padding:0 max(var(--pad),var(--safe-r)) 0 max(var(--pad),var(--safe-l));',
      '  padding-top:var(--safe-t);height:calc(var(--top-bar-h,44px) + var(--safe-t));gap:var(--gap);}',
      '.top-bar-left{min-width:0;flex:1 1 auto;overflow:hidden;}',
      '.top-bar-right{flex:0 0 auto;}',
      // One line, whatever the label says: a wrapped chip is taller than the bar
      // and lands on top of the scene furniture below it.
      '.top-bar-left,.top-bar-right{flex-wrap:nowrap;align-items:center;}',
      '.top-bar-left>*,.top-bar-right>*{flex:none;white-space:nowrap;}',
      '.top-bar-left #mol-hud{flex:0 1 auto;}',
      '#mol-hud{display:flex;align-items:center;gap:calc(5px * var(--ui-scale));min-width:0;',
      '  overflow-x:auto;overflow-y:hidden;scrollbar-width:none;padding:2px 0;}',
      '#mol-hud:empty{display:none;}',
      '#mol-hud::-webkit-scrollbar{display:none;}',
      '.hud-chip{display:inline-flex;align-items:center;gap:calc(4px * var(--ui-scale));flex:none;',
      '  height:calc(var(--top-bar-h,44px) - 10px);padding:0 calc(8px * var(--ui-scale));',
      '  border-radius:99px;border:1px solid var(--border);background:var(--panel-2);',
      '  font-size:var(--fs-xs);font-weight:700;letter-spacing:.4px;color:var(--text);',
      '  white-space:nowrap;cursor:default;transition:border-color .2s,box-shadow .2s,transform .2s;}',
      '.hud-chip[data-act]{cursor:pointer;}',
      '.hud-chip[data-act]:hover{transform:translateY(-1px);border-color:var(--accent);',
      '  box-shadow:0 0 12px var(--accent-glow);}',
      '.hud-chip .hud-k{color:var(--muted);font-weight:600;}',
      '.hud-chip.hud-stars{color:var(--amber);border-color:rgba(255,204,0,.34);',
      '  background:linear-gradient(135deg,rgba(255,204,0,.14),rgba(255,140,0,.06));}',
      '.hud-chip.hud-mult[data-tone="good"]{color:var(--ok-text);border-color:rgba(0,255,136,.4);',
      '  background:linear-gradient(135deg,rgba(0,255,136,.16),rgba(0,212,255,.06));}',
      '.hud-chip.hud-mult[data-tone="bad"]{color:var(--err-text);border-color:rgba(255,51,102,.42);',
      '  background:linear-gradient(135deg,rgba(255,51,102,.16),rgba(224,64,251,.07));}',
      '.hud-chip.hud-mult[data-tone="flat"]{color:var(--muted);}',
      '.hud-chip.hud-event{color:#fff;border-color:transparent;',
      '  background:linear-gradient(120deg,var(--rz-violet),var(--rz-magenta));',
      '  box-shadow:0 0 14px rgba(224,64,251,.35);}',
      '.hud-chip.hud-event[data-ev="peak"]{background:linear-gradient(120deg,#ffb300,#ffe066);color:#3a2600;}',
      '.hud-chip.hud-event[data-ev="rush"]{background:linear-gradient(120deg,#00d4ff,#00ffc8);color:#04121c;}',
      '.hud-chip.hud-event[data-ev="overload"]{background:linear-gradient(120deg,#00ff88,#7a5cff);color:#04121c;}',
      '.hud-chip.hud-event[data-ev="market"]{background:linear-gradient(120deg,#2a0f2e,#ff2d55);}',
      '.hud-chip.hud-event[data-ev="golden"]{background:linear-gradient(120deg,#ffd54a,#ff8a00);color:#3a2600;}',
      '.hud-chip.hud-event[data-ev="assembly"]{background:linear-gradient(120deg,#00d4ff,#7a5cff);}',
      '.hud-chip.hud-idle{color:var(--muted);font-weight:600;}',
      '.hud-chip .hud-t{font-variant-numeric:tabular-nums;}',
      '@keyframes rzHudPulse{0%,100%{box-shadow:0 0 10px rgba(255,255,255,.12);}50%{box-shadow:0 0 20px rgba(255,255,255,.34);}}',
      '.hud-chip.hud-event{animation:rzHudPulse 2.4s ease-in-out infinite;}',
      '@media (prefers-reduced-motion:reduce){.hud-chip.hud-event{animation:none;}}',

      /* ── action strip: one row, never wraps ── */
      'html.rz-compact #right-sidebar{flex-direction:row;flex-wrap:nowrap;justify-content:flex-start;',
      '  align-items:center;gap:var(--gap);overflow-x:auto;overflow-y:hidden;',
      '  padding:calc(5px * var(--ui-scale)) max(var(--pad),var(--safe-r)) calc(5px * var(--ui-scale)) max(var(--pad),var(--safe-l));',
      '  border-left:none;border-top:1px solid var(--border);scroll-snap-type:x proximity;',
      '  -webkit-overflow-scrolling:touch;scrollbar-width:none;}',
      'html.rz-compact #right-sidebar::-webkit-scrollbar{height:3px;}',
      'html.rz-compact #right-sidebar::-webkit-scrollbar-track{background:transparent;}',
      'html.rz-compact #right-sidebar .drag-handle{display:none;}',
      'html.rz-compact #right-sidebar .ub-resize{display:none;}',
      'html.rz-compact #right-sidebar .ub-toggle{margin:0;order:-1;position:sticky;left:0;z-index:2;}',
      '.action-btn{width:var(--tap);height:var(--tap);flex:none;border-radius:var(--r-sm);scroll-snap-align:center;}',
      '.action-btn [data-lucide]{width:calc(19px * var(--ui-scale));height:calc(19px * var(--ui-scale));}',
      '.ub-toggle{width:calc(26px * var(--ui-scale));height:calc(26px * var(--ui-scale));border-radius:var(--r-sm);}',
      '.ub-toggle svg{width:calc(14px * var(--ui-scale));height:calc(14px * var(--ui-scale));}',

      /* ── pool strip ── */
      '#pool-bar .pb-head{padding:calc(5px * var(--ui-scale)) max(var(--pad),var(--safe-r)) calc(5px * var(--ui-scale)) max(var(--pad),var(--safe-l));gap:var(--gap);}',
      '#pool-bar #pool-search{padding:calc(4px * var(--ui-scale)) calc(9px * var(--ui-scale));font-size:var(--fs-sm);min-width:0;}',
      '#pool-bar #pool-view{font-size:var(--fs-xs);padding:calc(4px * var(--ui-scale)) calc(9px * var(--ui-scale));}',
      '#pool-bar .pb-count{font-size:var(--fs-xs);}',
      '#pool-bar #pool-list{gap:calc(5px * var(--ui-scale));padding:0 max(var(--pad),var(--safe-r)) calc(6px * var(--ui-scale)) max(var(--pad),var(--safe-l));}',
      '#pool-bar #pool-list .el-chip{padding:calc(4px * var(--ui-scale)) calc(9px * var(--ui-scale));font-size:var(--fs-sm);}',
      // Cap against the viewport, never --free-h: that token is derived from the
      // dock height, so feeding it back here makes the two oscillate.
      'html.rz-compact #pool-bar.open{height:min(var(--pb-h,42vh),44vh);}',
      'html.rz-compact #pool-bar.open #pool-list{grid-template-columns:repeat(auto-fill,minmax(calc(118px * var(--ui-scale)),1fr));}',
      '#pool-bar .panel-hint{font-size:var(--fs-xs);}',

      /* ── bottom bar ── */
      '.bottom-bar{height:var(--bb-h,calc(40px * var(--ui-scale)));min-height:0;',
      '  padding:0 max(var(--pad),var(--safe-r)) 0 max(var(--pad),var(--safe-l));gap:var(--gap);}',
      '.time-controls{padding:calc(2px * var(--ui-scale)) calc(6px * var(--ui-scale));gap:calc(4px * var(--ui-scale));min-width:0;}',
      '.time-display-box{min-width:calc(74px * var(--ui-scale));padding:0 calc(4px * var(--ui-scale));}',
      '#time-display,#env-temp-display{font-size:var(--fs-sm);}',
      '.time-speed{font-size:var(--fs-xs);}',
      '.time-btn{width:calc(28px * var(--ui-scale));height:calc(28px * var(--ui-scale));flex:none;}',
      '.time-btn [data-lucide]{width:calc(15px * var(--ui-scale));height:calc(15px * var(--ui-scale));}',
      '.menu-tab-btn{width:var(--tap);height:var(--tap);flex:none;}',
      '.menu-tab-btn [data-lucide]{width:calc(19px * var(--ui-scale));height:calc(19px * var(--ui-scale));}',
      '.bottom-left #status-text{font-size:var(--fs-sm);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.bottom-right #keys-hint{font-size:var(--fs-xs);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#rz-dock-toggle{order:-1;width:calc(28px * var(--ui-scale));height:calc(28px * var(--ui-scale));',
      '  flex:none;display:flex;align-items:center;justify-content:center;padding:0;cursor:pointer;',
      '  border-radius:var(--r-sm);border:1px solid var(--border);color:var(--accent);',
      '  background:linear-gradient(135deg,var(--accent-soft),rgba(122,92,255,.12));}',
      '#rz-dock-toggle svg{width:calc(15px * var(--ui-scale));height:calc(15px * var(--ui-scale));}',
      '#rz-dock-toggle:hover{border-color:var(--accent);box-shadow:0 0 12px var(--accent-glow);}',

      /* ── mobile tab bar ── */
      'html.rz-compact #mtabs{padding-bottom:var(--safe-b);',
      '  padding-left:var(--safe-l);padding-right:var(--safe-r);}',
      'html.rz-compact #mtabs button{padding:calc(7px * var(--ui-scale)) 0;font-size:var(--fs-sm);',
      '  font-weight:600;letter-spacing:.5px;}',

      /* ── scene furniture anchors to the measured top bar ── */
      '#scene-wrap canvas{top:var(--top-h) !important;left:0 !important;width:100% !important;',
      '  height:calc(100% - var(--top-h)) !important;}',
      '#hint{top:var(--top-h);}',
      '#meltdown-overlay{top:var(--top-h);}',
      '.health-bar-container{top:calc(var(--top-h) + 8px);left:max(10px,var(--safe-l));',
      '  min-width:calc(130px * var(--ui-scale));padding:calc(5px * var(--ui-scale)) calc(10px * var(--ui-scale));}',
      '.health-bar-label{font-size:var(--fs-md);}',
      '#fps-chip{top:calc(var(--top-h) + 6px);right:max(10px,var(--safe-r));font-size:var(--fs-xs);}',
      '#toast{top:calc(var(--top-h) + 10px);max-width:min(92vw,520px);font-size:var(--fs-sm);}',
      '#rxn-panel{bottom:calc(10px * var(--ui-scale));max-width:min(94%,560px);}',
      // Stays at the scene's own right edge — the box is positioned inside the
      // scene, so the landscape tool column is already excluded from its frame.
      '.app-name-box{bottom:calc(8px * var(--ui-scale));right:max(8px,var(--safe-r));}',
      '.app-name{font-size:var(--fs-sm);}#mode-indicator{font-size:var(--fs-xs);}',
      '#joy{bottom:calc(var(--dock-h) + 12px);left:max(14px,var(--safe-l));}',
      '#joy-stick{width:calc(96px * var(--ui-scale));height:calc(96px * var(--ui-scale));}',
      '#joy-knob{width:calc(42px * var(--ui-scale));height:calc(42px * var(--ui-scale));',
      '  margin:calc(-21px * var(--ui-scale)) 0 0 calc(-21px * var(--ui-scale));}',
      '#joy-vert button{width:calc(40px * var(--ui-scale));height:calc(34px * var(--ui-scale));}',
      '#joy-jump{font-size:var(--fs-xs);}',
      // The stick's own module parks it 104px off the bottom, which is exactly
      // where the compact pool strip lives, so the leftmost chips sit under it.
      // Two ids/classes are needed to beat that module's body.mobile rule.
      'html.rz-compact body.mobile #joy{bottom:calc(var(--dock-h) + 12px);}',
      // ...and once the bottom sheet is up it fills the whole scene band, so the
      // stick has nowhere to stand. It stands down instead of living under it.
      'html.rz-compact body.mobile:has(.side-tab-panel.open) #joy{display:none;}',

      /* ── compact bottom sheet ── */
      'html.rz-compact #left-sidebar{visibility:hidden;pointer-events:none;position:absolute;',
      '  width:0;height:0;overflow:visible;border-right:none;box-shadow:none;}',
      'html.rz-compact #left-sidebar:has(.side-tab-panel.active),',
      'html.rz-compact #left-sidebar:has(.side-tab-panel.open){',
      '  visibility:visible;pointer-events:auto;position:fixed;width:auto;',
      '  left:max(6px,var(--safe-l));right:calc(max(6px,var(--safe-r)) + var(--dock-r,0px));',
      '  bottom:calc(var(--dock-h) + 6px);height:auto;',
      '  max-height:calc(var(--free-h) - 14px);min-height:0;',
      '  display:flex;flex-direction:column;overflow:hidden;z-index:40;',
      '  background:var(--panel);border:1px solid var(--border);',
      '  border-radius:var(--r-lg) var(--r-lg) var(--r-md) var(--r-md);',
      '  box-shadow:var(--sheet-shadow);animation:rzSheetUp .26s cubic-bezier(.2,.9,.25,1);}',
      '@keyframes rzSheetUp{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:none;}}',
      '@media (prefers-reduced-motion:reduce){html.rz-compact #left-sidebar{animation:none !important;}}',
      'html.rz-compact #left-sidebar .drag-handle{display:none;}',
      'html.rz-compact #left-sidebar .sidebar-tabs{display:none;}',
      'html.rz-compact #left-sidebar .sidebar-body{flex:1;min-height:0;overflow-y:auto;',
      '  padding:calc(8px * var(--ui-scale));padding-bottom:calc(12px * var(--ui-scale));}',
      'html.rz-compact #app .side-tab-panel{display:none;}',
      'html.rz-compact #app .side-tab-panel.active,',
      'html.rz-compact #app .side-tab-panel.open{display:flex;gap:calc(8px * var(--ui-scale));}',
      '#rz-sheet-head{display:flex;align-items:center;gap:8px;flex:none;',
      '  padding:calc(8px * var(--ui-scale)) calc(12px * var(--ui-scale));',
      '  border-bottom:1px solid var(--border);',
      '  background:linear-gradient(120deg,var(--accent-soft),rgba(122,92,255,.12));}',
      '#rz-sheet-head .rz-sheet-title{flex:1;min-width:0;font-size:var(--fs-sm);font-weight:800;',
      '  letter-spacing:1.1px;text-transform:uppercase;color:var(--accent);',
      '  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#rz-sheet-head .rz-sheet-close{flex:none;width:calc(26px * var(--ui-scale));height:calc(26px * var(--ui-scale));',
      '  border-radius:99px;border:1px solid var(--border);background:var(--panel-2);color:var(--muted);',
      '  font-size:calc(15px * var(--ui-scale));line-height:1;cursor:pointer;padding:0;}',
      '#rz-sheet-head .rz-sheet-close:hover{color:var(--err-text);border-color:var(--err);}',

      /* ── floating surfaces never cover the dock ── */
      // --dock-r is the landscape tool column (0 everywhere else), so a popover
      // anchored to the right edge stops short of it instead of burying it.
      '.menu-dropdown{bottom:calc(var(--dock-h) + 8px);',
      '  right:calc(max(10px,var(--safe-r)) + var(--dock-r,0px));',
      '  width:min(280px,calc(100vw - 20px));max-height:calc(var(--free-h) - 16px);}',
      '.quest-panel{bottom:calc(var(--dock-h) + 8px);right:max(10px,var(--safe-r));',
      '  width:min(400px,calc(100vw - 20px));max-height:calc(var(--free-h) - 16px);',
      '  display:flex;flex-direction:column;}',
      '.quest-panel[hidden]{display:none;}',
      '.quest-messages{flex:1 1 auto;min-height:calc(90px * var(--ui-scale));max-height:none;}',
      'html.rz-compact .quest-panel{left:max(8px,var(--safe-l));width:auto;',
      '  right:calc(max(8px,var(--safe-r)) + var(--dock-r,0px));}',
      '.chat-box{bottom:calc(var(--dock-h) + 10px);left:max(12px,var(--safe-l));',
      '  width:min(350px,calc(100vw - 24px));',
      '  height:min(400px,calc(var(--free-h) - 20px));max-height:calc(var(--free-h) - 20px);}',
      'html.rz-compact .chat-box{width:calc(100vw - var(--dock-r,0px) - 24px);}',
      '.chat-box.minimized{height:calc(44px * var(--ui-scale));}',
      '.chat-toggle-btn{bottom:calc(var(--dock-h) + 12px);left:max(12px,var(--safe-l));',
      '  width:var(--tap);height:var(--tap);}',
      '.isomer-panel{width:min(420px,calc(100vw - 20px));max-height:calc(var(--app-h) - 24px);overflow-y:auto;}',
      // No backdrop, so on a phone it must not bury the tool bars it sits over.
      'html.rz-compact .isomer-panel{top:auto;bottom:calc(var(--dock-h) + 8px);',
      '  left:calc((100vw - var(--dock-r,0px)) / 2);',
      '  transform:translateX(-50%);max-height:calc(var(--free-h) - 16px);}',
      'html.rz-compact .isomer-panel.open{transform:translateX(-50%) scale(1);}',
      '.time-modal{width:100%;height:100%;top:0;left:0;transform:none;display:flex;',
      '  align-items:center;justify-content:center;padding:12px;}',
      '.time-modal[hidden]{display:none;}',
      '.time-modal-content{width:min(420px,100%);min-width:0;max-height:calc(var(--app-h) - 24px);',
      '  overflow-y:auto;padding:calc(15px * var(--ui-scale));}',
      '.modal{padding:max(12px,var(--safe-t)) 12px max(12px,var(--safe-b));}',
      '.modal-content{max-height:calc(var(--app-h) - 32px);overflow-y:auto;}',
      '.modal-overlay,.main-menu-overlay,.lobby-overlay,.credits-modal{height:var(--app-h);}',
      '.modal-overlay{padding:max(12px,var(--safe-t)) 12px max(12px,var(--safe-b));overflow-y:auto;}',
      '.modal-overlay .modal-content{padding:calc(24px * var(--ui-scale)) calc(20px * var(--ui-scale));',
      '  width:min(500px,100%);max-height:none;}',
      '.modal-overlay .modal-content h3{margin-bottom:calc(18px * var(--ui-scale));font-size:var(--fs-lg);}',
      '.main-menu-content,.lobby-content{max-height:calc(var(--app-h) - 24px);overflow-y:auto;}',

      /* ── density inside panels ── */
      '.panel{padding:calc(8px * var(--ui-scale)) calc(10px * var(--ui-scale));border-radius:var(--r-md);}',
      '.panel h2{font-size:var(--fs-sm);margin-bottom:calc(6px * var(--ui-scale));}',
      '.panel-hint{font-size:var(--fs-xs);}',
      '.kinetics-grid{grid-template-columns:repeat(auto-fit,minmax(calc(112px * var(--ui-scale)),1fr));gap:calc(5px * var(--ui-scale));}',
      '.kinetic-label{font-size:var(--fs-xs);}.kinetic-value{font-size:var(--fs-sm);}',
      '#kinetics-canvas,#bohr-canvas{max-width:100%;height:auto;}',
      '.stoich-table{font-size:var(--fs-xs);}',
      '.stoich-convert{display:flex;flex-wrap:wrap;gap:calc(6px * var(--ui-scale));}',
      '.stoich-convert label{flex:1 1 calc(110px * var(--ui-scale));min-width:0;}',
      '.el-chip .n{font-size:var(--fs-xs);}',
      '#ptable{overflow-x:auto;}',
      'html.rz-compact #pool-search{font-size:16px;}',
      'html.rz-compact .isomer-input,html.rz-compact .quest-input,html.rz-compact .chat-input,',
      'html.rz-compact #stoich-g,html.rz-compact #stoich-mol,html.rz-compact #stoich-n,',
      'html.rz-compact #env-temp-num,html.rz-compact #env-pressure-num{font-size:16px;}',
      // The hint module sets display inline, so only !important can put the card
      // away in landscape, where there is no vertical room for it.
      'html.rz-short #hint,html.rz-short #fps-chip{display:none !important;}',
      'html.rz-compact .top-bar{--top-bar-h:44px;}',
      'html.rz-short:not(.rz-compact) .top-bar{--top-bar-h:30px;}',
      'html.rz-tiny .top-badge{letter-spacing:.4px;padding:3px 7px;}',
      'html.rz-tiny .app-name-box{opacity:.7;}',

      /* ── landscape phones: dock beside the scene ── */
      // Four stacked strips need 233px of a 390px-tall screen and leave the
      // molecule 127px. Turned sideways the same strips fit in a column beside
      // the scene, which then keeps the height it actually needs.
      'html.rz-compact.rz-land{--dock-r:min(320px,38vw);}',
      'html.rz-compact.rz-land #app{grid-template-columns:minmax(0,1fr) var(--dock-r);',
      '  grid-template-rows:auto minmax(0,1fr) auto auto;',
      '  grid-template-areas:"scene actions" "scene pool" "scene mtabs" "bottom bottom";}',
      // The pool column is tall now, so the chips wrap into it instead of
      // trailing off the side of a one-row strip. Both ids are needed in the
      // selector: the pool module's own rule carries two of them.
      'html.rz-compact.rz-land #pool-bar #pool-list{flex:1 1 auto;height:100%;',
      '  flex-wrap:wrap;align-content:flex-start;overflow:auto;}',
      // The event surfaces are fixed to the viewport, so sideways they would
      // band straight across the tool column. They belong to the scene.
      'html.rz-compact.rz-land #ev-king{right:var(--dock-r);}',
      'html.rz-compact.rz-land #ev-status{right:calc(12px + var(--dock-r));}',
      'html.rz-compact.rz-land #ev-toast{left:calc((100vw - var(--dock-r)) / 2);}',

      /* ── touch floor: targets a finger can actually hit ── */
      // On a phone the density scale shrinks a 38px control to ~21px, which is
      // below what a thumb lands on. --tap keeps a hard floor instead of a
      // proportional one, and the bars around it grow to hold what it points at.
      'html.rz-compact{--tap:max(40px,calc(38px * var(--ui-scale)));',
      // Spacing may shrink, but text may not: 9px labels are unreadable at arm
      // length, so the size tokens stop following the scale below their base.
      '  --fs-xs:max(10px,calc(10px * var(--ui-scale)));--fs-sm:max(11.5px,calc(11.5px * var(--ui-scale)));',
      '  --fs-md:max(13px,calc(13px * var(--ui-scale)));--fs-lg:max(16px,calc(16px * var(--ui-scale)));}',
      'html.rz-compact .bottom-bar{height:max(var(--bb-h,calc(40px * var(--ui-scale))),calc(var(--tap) + 2px));}',
      'html.rz-compact .time-btn,html.rz-compact #rz-dock-toggle,',
      'html.rz-compact .ub-toggle,html.rz-compact .bottom-bar.closed #ub-status-toggle{',
      '  width:calc(var(--tap) - 6px);height:calc(var(--tap) - 6px);}',
      'html.rz-compact .ub-toggle svg{width:calc(16px * var(--ui-scale));height:calc(16px * var(--ui-scale));}',
      'html.rz-compact #mtabs button{min-height:var(--tap);padding:calc(3px * var(--ui-scale)) 0;}',
      'html.rz-compact #pool-bar .pb-head{min-height:calc(var(--tap) - 2px);}',
      'html.rz-compact #pool-bar #pool-search{min-height:calc(var(--tap) - 6px);}',
      'html.rz-compact #pool-bar #pool-view{min-height:calc(var(--tap) - 6px);',
      '  padding:calc(4px * var(--ui-scale)) calc(11px * var(--ui-scale));}',
      'html.rz-compact #pool-bar #pool-list .el-chip{min-height:calc(var(--tap) - 6px);}',
      'html.rz-compact #rz-sheet-head .rz-sheet-close{width:calc(var(--tap) - 6px);height:calc(var(--tap) - 6px);}',
      // Surfaces owned by other modules, sized for a finger from here because the
      // shell is the only place that knows the breakpoint.
      'html.rz-compact .shop-tab{min-height:calc(var(--tap) - 6px);}',
      'html.rz-compact .ev-btn{min-height:calc(var(--tap) - 6px);font-size:var(--fs-sm);}',
      // The crate list's quantity presets and its search box are the two shop
      // controls still sized for a mouse wheel.
      'html.rz-compact .shop-qty-btn{min-height:calc(var(--tap) - 6px);}',
      'html.rz-compact .shop-search{min-height:calc(var(--tap) - 6px);font-size:16px;}',
      // The learning chip is the last .btn left in the top bar; its padding gives
      // it 28px, which is the only thing on the bar a thumb can miss.
      'html.rz-compact #btn-learning{min-height:calc(var(--tap) - 6px);}',
      'html.rz-compact .shop-close,html.rz-compact #isomer-panel-close,html.rz-compact #htp-btn{',
      '  width:calc(var(--tap) - 6px);height:calc(var(--tap) - 6px);min-width:calc(var(--tap) - 6px);',
      '  min-height:calc(var(--tap) - 6px);}',
      'html.rz-compact #isomer-panel-close{font-size:calc(var(--fs-lg));padding:0;}',
      // Four things in one row is a desktop header. On a phone the shop name was
      // being crushed to three lines beside the rank and the balance, so the name
      // takes a line of its own and the rest share the next one.
      'html.rz-compact .shop-head{flex-wrap:wrap;row-gap:calc(4px * var(--ui-scale));}',
      'html.rz-compact .shop-title{flex:1 1 100%;min-width:0;}',
      'html.rz-compact .shop-rank{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      'html.rz-compact .shop-balance{flex:none;}',

      /* ── first-run hint: a card you can read, not a wall over the scene ── */
      'html.rz-compact #hint{top:calc(var(--top-h) + var(--king-h,0px) + 8px);left:50%;right:auto;bottom:auto;',
      '  width:min(92vw,430px);height:auto;align-items:stretch;transform:translateX(-50%);z-index:6;}',
      'html.rz-compact .rz-hint-card{pointer-events:auto;display:flex;flex-direction:column;min-width:0;overflow:hidden;',
      '  background:var(--panel);border:1px solid var(--border);border-radius:var(--r-md);',
      '  box-shadow:0 12px 30px rgba(0,0,0,.38);backdrop-filter:blur(10px);}',
      'html.rz-compact .rz-hint-row{display:flex;align-items:center;gap:calc(6px * var(--ui-scale));flex:none;min-width:0;',
      '  min-height:calc(var(--tap) - 4px);line-height:1.35;text-align:left;color:var(--text);',
      '  padding:calc(4px * var(--ui-scale)) calc(5px * var(--ui-scale)) calc(4px * var(--ui-scale)) calc(11px * var(--ui-scale));}',
      'html.rz-compact .rz-hint-lead{flex:1;min-width:0;font-size:var(--fs-sm);line-height:1.35;}',
      'html.rz-compact .rz-hint-toggle{flex:none;width:calc(var(--tap) - 6px);height:calc(var(--tap) - 6px);padding:0;cursor:pointer;',
      '  display:flex;align-items:center;justify-content:center;border-radius:var(--r-sm);',
      '  border:1px solid var(--border);background:var(--panel-2);color:var(--accent);}',
      'html.rz-compact .rz-hint-toggle svg{width:calc(15px * var(--ui-scale));height:calc(15px * var(--ui-scale));}',
      'html.rz-compact .rz-hint-more{max-height:0;overflow:hidden;opacity:0;color:var(--text);',
      '  transition:max-height .26s cubic-bezier(.2,.9,.25,1),opacity .18s;}',
      'html.rz-compact #hint.rz-hint-open .rz-hint-more{max-height:calc(var(--free-h) * .46);overflow-y:auto;opacity:1;',
      '  border-top:1px solid var(--border);}',
      'html.rz-compact .rz-hint-more .rz-hint-line{display:block;',
      '  padding:calc(6px * var(--ui-scale)) calc(11px * var(--ui-scale));font-size:var(--fs-sm);line-height:1.5;',
      '  text-align:left;border-bottom:1px solid rgba(255,255,255,.06);}',
      'html.rz-compact .rz-hint-more .rz-hint-line:last-child{border-bottom:none;}',
      '@media (prefers-reduced-motion:reduce){html.rz-compact .rz-hint-more{transition:none;}}',
      // A desktop screen has room for the whole list, so there the restructured
      // markup has to look exactly like the plain centred text it replaced.
      'html.rz-wide .rz-hint-card{display:contents;}',
      'html.rz-wide .rz-hint-toggle{display:none;}',
      'html.rz-wide .rz-hint-more{max-height:none;opacity:1;}',
      'html.rz-wide .rz-hint-row{display:block;}',
      // The hint shares the top band with the health bar, the fps chip and the
      // toasts, so those give way by exactly the height of the hint row.
      'html.rz-compact .health-bar-container,html.rz-compact #fps-chip{',
      '  top:calc(var(--top-h) + var(--king-h,0px) + var(--hint-h,0px) + 8px);}',
      'html.rz-compact #toast{top:calc(var(--top-h) + var(--king-h,0px) + var(--hint-h,0px) + 12px);}',
      // The learning chip is a third left-anchored floating chip, so it queues
      // under the health bar instead of landing on it.
      'html.rz-compact #learn-mini{left:max(8px,var(--safe-l));',
      '  top:calc(var(--top-h) + var(--king-h,0px) + var(--hint-h,0px) + var(--hb-h,0px) + 14px);',
      '  max-width:calc(100vw - 16px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      // The guide module hangs its "?" beside the rope, in the middle of the top
      // bar — on a phone that is exactly where the star and boost chips are, and
      // those are buttons. It joins the left chip column under the learn chip
      // instead, still a child of the rig so it tucks away when the shop drops.
      'html.rz-compact #htp-btn{position:fixed;left:max(8px,var(--safe-l));right:auto;',
      '  top:calc(var(--top-h) + var(--king-h,0px) + var(--hint-h,0px) + var(--hb-h,0px) + 58px);',
      '  width:calc(var(--tap) - 6px);height:calc(var(--tap) - 6px);font-size:calc(15px * var(--ui-scale));}',
      // ...but the shop panel is opened over that same band, and a chip sitting on
      // the shop tab row is a control you cannot press. It stands down while the
      // shop is open and returns when it closes.
      'html.rz-compact #shop-rig.open ~ #learn-mini{display:none;}',
      // A 360px panel on a 390px screen leaves the hint card, the health bar and
      // the fps chip poking out from behind it in clipped slivers. They go away
      // for the duration instead of showing half a readout.
      'html.rz-compact body:has(#shop-rig.open) #hint,',
      'html.rz-compact body:has(#shop-rig.open) .health-bar-container,',
      'html.rz-compact body:has(#shop-rig.open) #fps-chip{display:none !important;}',
      // Sideways the banner would stick out beside the panel as a clipped red
      // sliver. Its job while the shop is closed is to be the handle, and while
      // the shop is open the panel already carries the event tab.
      'html.rz-compact.rz-land body:has(#shop-rig.open) #ev-king{display:none !important;}',

      /* keep the rope clear of the notch and the dock */
      '#shop-rig{right:max(68px,calc(var(--safe-r) + 62px)) !important;}',
      'html.rz-compact #shop-rig{right:max(12px,var(--safe-r)) !important;}',
      // Sideways the shop belongs to the scene, not to the screen: the tool
      // column owns the right edge, so the rope and its panel pull back from it.
      // 380 rather than 460 keeps the panel clear of the health bar on its left.
      'html.rz-compact.rz-land #shop-rig{right:calc(max(12px,var(--safe-r)) + var(--dock-r)) !important;',
      '  width:min(380px,calc(100vw - var(--dock-r) - 24px)) !important;}',
      'html.rz-compact #shop-panel{max-height:calc(var(--free-h) - 20px) !important;}',
      // The panel drops from under the rope, so the room above it is not free
      // room: count the rope's hang back in or the open shop sits on the dock.
      'html.rz-compact #shop-panel{max-height:calc(var(--free-h) + var(--top-h) - var(--rope-h) - 16px) !important;}',
      // Sideways, --free-h is the scene row only, and the shop would hang in a
      // 230px panel with 27px of shelf left for a 3100px list. The rope takes a
      // short drop, the header and tabs take one line each, and the panel runs
      // to the bottom bar it clears on the x axis anyway.
      'html.rz-compact.rz-land #shop-rig.open{--rope-h:44px;}',
      'html.rz-compact.rz-land #shop-panel{max-height:calc(100dvh - var(--dock-h) - 58px) !important;}',
      'html.rz-compact.rz-land .shop-head{flex-wrap:nowrap;}',
      'html.rz-compact.rz-land .shop-title,html.rz-compact.rz-land .shop-rank{flex:0 1 auto;}',
      'html.rz-compact.rz-land #shop-panel .shop-tabs{flex-wrap:nowrap;overflow-x:auto;}',
      // On a phone the rig spans the whole width, so the rope hangs down the
      // middle of the screen — straight over the King's banner headline. While
      // the banner is up (--king-on, set by events.js) the rope retracts and the
      // banner itself is the handle: tapping it opens the shop on his desk. The
      // reclaimed height is given back as margin so the panel keeps its place.
      'html.rz-compact #shop-rope{height:calc(var(--rope-h) * (1 - var(--king-on,0)));',
      '  margin-bottom:calc(var(--rope-h) * var(--king-on,0));}',
      'html.rz-compact #shop-rig.hint #shop-hint{opacity:calc(1 - var(--king-on,0));}'
    ].join('\n');
  }

  var styleEl = null;
  function injectStyles() {
    if (styleEl) return;
    styleEl = document.createElement('style');
    styleEl.id = 'rz-shell-styles';
    styleEl.textContent = css();
    document.head.appendChild(styleEl);
    // Later modules inject their own sheets; stay last so measured anchors win.
    if (window.MutationObserver) {
      new MutationObserver(function () {
        if (styleEl && document.head.lastElementChild !== styleEl) document.head.appendChild(styleEl);
      }).observe(document.head, { childList: true });
    }
  }

  /* ── measurement ── */
  var app, scene, topBar, poolBar, rightBar, bottomBar, mtabs;
  var lastVars = {};
  function setVar(name, value) {
    if (lastVars[name] === value) return;
    lastVars[name] = value;
    root.style.setProperty(name, value);
  }

  var pending = 0;
  function schedule() {
    if (pending) return;
    // A timer, not rAF: a backgrounded tab must still measure when it is shown.
    pending = setTimeout(function () { pending = 0; measure(); }, 16);
  }

  function measure() {
    if (!app || !scene) return;
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var compact = mq.matches;
    var scale = state.scaleOverride > 0 ? state.scaleOverride : autoScale(vw, vh);

    root.classList.toggle('rz-compact', compact);
    root.classList.toggle('rz-wide', !compact);
    root.classList.toggle('rz-short', vh <= 560);
    // Landscape is its own case: the screen is wide enough for the tool strips
    // to stand beside the scene instead of stacking under it.
    root.classList.toggle('rz-land', compact && vw > vh);
    root.classList.toggle('rz-tiny', Math.min(vw, vh) <= 340);
    root.classList.toggle('rz-dock-min', compact && state.dockMin);

    setVar('--ui-scale', String(scale));
    setVar('--app-h', vh + 'px');
    setVar('--app-w', vw + 'px');

    // Changing the scale changes the dock's own height, so one read is stale.
    // Re-read until the measurement stops moving instead of asking callers to
    // invoke measure() twice.
    var topH = 0, dockH = 0;
    for (var pass = 0; pass < 4; pass++) {
      var t = topBar ? Math.round(topBar.getBoundingClientRect().height) : 0;
      var d = Math.max(0, Math.round(app.getBoundingClientRect().height - scene.getBoundingClientRect().height));
      var settled = (t === topH && d === dockH);
      topH = t; dockH = d;
      setVar('--top-h', topH + 'px');
      setVar('--dock-h', dockH + 'px');
      setVar('--free-h', Math.max(120, Math.round(vh - dockH - topH)) + 'px');
      if (settled) break;
    }

    setVar('--hint-h', hintOffset());
    setVar('--hb-h', floatHeight('.health-bar-container'));

    window.dispatchEvent(new CustomEvent('mol3d:shell', {
      detail: { compact: compact, scale: scale, vw: vw, vh: vh, dockH: dockH, topH: topH }
    }));
  }

  /* ── focus mode ── */
  var CHEV_DOWN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
  var CHEV_UP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>';
  var dockBtn = null;

  function setDock(min) {
    state.dockMin = !!min;
    persist();
    relabel();
    schedule();
  }

  function relabel() {
    var t = T();
    if (dockBtn) {
      dockBtn.innerHTML = state.dockMin ? CHEV_UP : CHEV_DOWN;
      dockBtn.title = state.dockMin ? t.dockShow : t.dockHide;
      dockBtn.setAttribute('aria-label', dockBtn.title);
      dockBtn.setAttribute('aria-expanded', state.dockMin ? 'false' : 'true');
    }
    if (sheetClose) {
      sheetClose.title = t.closePanel;
      sheetClose.setAttribute('aria-label', t.closePanel);
    }
    syncSheetTitle();
  }

  /* ── sheet header ── */
  var sheetHead = null, sheetTitle = null, sheetClose = null;

  function activeSheet() {
    for (var i = 0; i < SHEET_IDS.length; i++) {
      var el = document.getElementById(SHEET_IDS[i]);
      if (el && (el.classList.contains('active') || el.classList.contains('open'))) return SHEET_IDS[i];
    }
    return null;
  }

  function syncSheetTitle() {
    if (!sheetTitle) return;
    var id = activeSheet();
    var t = T();
    var label = id === 'side-info' ? t.info : id === 'side-dex' ? t.dex : t.pool;
    var tab = document.querySelector('#mtabs button[data-tab="' + id + '"]');
    sheetTitle.textContent = tab && tab.textContent.trim() ? tab.textContent.trim() : label;
  }

  function closeSheets() {
    for (var i = 0; i < SHEET_IDS.length; i++) {
      var el = document.getElementById(SHEET_IDS[i]);
      if (el) el.classList.remove('open', 'active');
    }
    var btns = document.querySelectorAll('#mtabs button');
    for (var j = 0; j < btns.length; j++) btns[j].classList.remove('on');
    schedule();
  }

  /* ── first-run hint card ── */
  // #hint is one block of prose separated by <br>, which on a phone is a wall of
  // text across the whole scene. Keep the markup, but split it into a lead line
  // plus a fold-out list, so the scene stays readable and the rest is one tap away.
  var hintEl = null, hintRow = null, hintBtn = null, hintBusy = false;

  function hintLabel() {
    if (!hintBtn || !hintEl) return;
    var open = hintEl.classList.contains('rz-hint-open');
    var label = open ? T().hintLess : T().hintMore;
    hintBtn.innerHTML = open ? CHEV_UP : CHEV_DOWN;
    hintBtn.title = label;
    hintBtn.setAttribute('aria-label', label);
    hintBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function buildHint() {
    hintEl = document.getElementById('hint');
    if (!hintEl || hintEl.querySelector('.rz-hint-card')) return;
    hintBusy = true;
    var lines = [];
    var cur = null;
    function open() { if (!cur) { cur = document.createElement('span'); cur.className = 'rz-hint-line'; lines.push(cur); } return cur; }
    Array.prototype.slice.call(hintEl.childNodes).forEach(function (n) {
      if (n.nodeName === 'BR') { cur = null; return; }
      if (n.nodeType === 3) {
        if (n.textContent.trim()) open().appendChild(document.createTextNode(n.textContent.trim()));
        return;
      }
      if (n.nodeType === 1) open().appendChild(n.cloneNode(true));
    });
    hintEl.textContent = '';
    if (!lines.length) { hintBusy = false; return; }

    var card = document.createElement('div');
    card.className = 'rz-hint-card';
    hintRow = document.createElement('div');
    hintRow.className = 'rz-hint-row';
    var lead = document.createElement('span');
    lead.className = 'rz-hint-lead';
    lead.appendChild(lines[0]);
    hintBtn = document.createElement('button');
    hintBtn.type = 'button';
    hintBtn.className = 'rz-hint-toggle';
    hintBtn.addEventListener('click', function () {
      hintEl.classList.toggle('rz-hint-open');
      hintLabel();
      schedule();
    });
    hintRow.appendChild(lead);
    hintRow.appendChild(hintBtn);
    card.appendChild(hintRow);

    if (lines.length > 1) {
      var more = document.createElement('div');
      more.className = 'rz-hint-more';
      lines.slice(1).forEach(function (l) { more.appendChild(l); });
      card.appendChild(more);
    }
    hintEl.appendChild(card);
    hintLabel();
    hintBusy = false;
    schedule();
  }

  function watchHint() {
    buildHint();
    // The translation layer rewrites #hint innerHTML on every language change,
    // which would drop the card, so rebuild whenever the card goes missing.
    if (hintEl && window.MutationObserver) {
      new MutationObserver(function () { if (!hintBusy) buildHint(); })
        .observe(hintEl, { childList: true });
    }
  }

  // Opening the shop puts the panel over the hint card and the readouts, which
  // changes what the anchors have to clear, so re-measure when it moves. The rig
  // belongs to the shop module and may not exist yet at this point.
  function watchShopRig() {
    if (!window.MutationObserver) return;
    var bind = function () {
      var rig = document.getElementById('shop-rig');
      if (!rig) return false;
      new MutationObserver(schedule).observe(rig, { attributes: true, attributeFilter: ['class'] });
      return true;
    };
    if (bind()) return;
    var boot = new MutationObserver(function () { if (bind()) boot.disconnect(); });
    boot.observe(document.body, { childList: true, subtree: true });
  }

  function hintOffset() {
    if (!hintRow || !hintEl) return '0px';
    if (getComputedStyle(hintEl).display === 'none') return '0px';
    return Math.round(hintRow.getBoundingClientRect().height + 8) + 'px';
  }

  function floatHeight(sel) {
    var el = document.querySelector(sel);
    if (!el) return '0px';
    var st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden') return '0px';
    return Math.round(el.getBoundingClientRect().height) + 'px';
  }

  /* ── build ── */
  function build() {
    app = document.getElementById('app');
    scene = document.getElementById('scene-wrap');
    topBar = document.getElementById('top-bar');
    poolBar = document.getElementById('pool-bar');
    rightBar = document.getElementById('right-sidebar');
    bottomBar = document.querySelector('.bottom-bar');
    mtabs = document.getElementById('mtabs');
    if (!app || !scene || !bottomBar) { setTimeout(build, 200); return; }
    if (document.getElementById('rz-shell-styles')) return;

    injectStyles();

    var aurora = document.createElement('div');
    aurora.id = 'rz-aurora';
    aurora.setAttribute('aria-hidden', 'true');
    app.insertBefore(aurora, app.firstChild);

    // Persistent player status area (filled by the economy module).
    if (topBar && !document.getElementById('mol-hud')) {
      var hud = document.createElement('div');
      hud.id = 'mol-hud';
      var left = topBar.querySelector('.top-bar-left');
      (left || topBar).appendChild(hud);
    }

    dockBtn = document.createElement('button');
    dockBtn.type = 'button';
    dockBtn.id = 'rz-dock-toggle';
    dockBtn.addEventListener('click', function () { setDock(!state.dockMin); });
    bottomBar.insertBefore(dockBtn, bottomBar.firstChild);

    var side = document.getElementById('left-sidebar');
    if (side) {
      sheetHead = document.createElement('div');
      sheetHead.id = 'rz-sheet-head';
      sheetTitle = document.createElement('span');
      sheetTitle.className = 'rz-sheet-title';
      sheetClose = document.createElement('button');
      sheetClose.type = 'button';
      sheetClose.className = 'rz-sheet-close';
      sheetClose.textContent = '×';
      sheetClose.addEventListener('click', closeSheets);
      sheetHead.appendChild(sheetTitle);
      sheetHead.appendChild(sheetClose);
      var body = side.querySelector('.sidebar-body');
      side.insertBefore(sheetHead, body || side.firstChild);
    }

    // Opening a sheet must not fight the expanded pool for the same space.
    if (mtabs) {
      mtabs.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-tab]');
        if (!b) return;
        if (window.__mol3dBars && window.__mol3dBars.poolOpen()) window.__mol3dBars.setPool(false);
        setTimeout(function () { syncSheetTitle(); schedule(); }, 0);
      });
    }

    if (window.ResizeObserver) {
      var ro = new ResizeObserver(schedule);
      [app, scene, topBar, poolBar, rightBar, bottomBar, mtabs].forEach(function (el) {
        if (el) ro.observe(el);
      });
    }
    if (window.MutationObserver) {
      var mo = new MutationObserver(schedule);
      [app, poolBar, rightBar, bottomBar].forEach(function (el) {
        if (el) mo.observe(el, { attributes: true, attributeFilter: ['class', 'style'] });
      });
      SHEET_IDS.forEach(function (id) {
        var el = document.getElementById(id);
        if (el) new MutationObserver(function () { syncSheetTitle(); schedule(); })
          .observe(el, { attributes: true, attributeFilter: ['class'] });
      });
    }

    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', function () { setTimeout(schedule, 120); });
    if (window.visualViewport) window.visualViewport.addEventListener('resize', schedule);
    mq.addEventListener('change', schedule);
    window.addEventListener('mol3d:lang', relabel);

    relabel();
    watchHint();
    watchShopRig();
    measure();

    window.__mol3dShell = {
      measure: schedule,
      compact: function () { return mq.matches; },
      scale: function () { return parseFloat(lastVars['--ui-scale'] || '1'); },
      dockMin: function () { return state.dockMin; },
      setDock: setDock,
      closeSheets: closeSheets,
      setScale: function (n) {
        state.scaleOverride = n > 0 ? Math.max(0.6, Math.min(1.6, n)) : 0;
        persist();
        schedule();
      },
      metrics: function () {
        return {
          compact: mq.matches, scale: parseFloat(lastVars['--ui-scale'] || '1'),
          appH: window.innerHeight, dockH: parseInt(lastVars['--dock-h'] || '0', 10),
          topH: parseInt(lastVars['--top-h'] || '0', 10),
          freeH: parseInt(lastVars['--free-h'] || '0', 10)
        };
      }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(build, 0); });
  } else {
    setTimeout(build, 0);
  }
})();