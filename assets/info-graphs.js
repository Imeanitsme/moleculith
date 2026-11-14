/* ============================================================================
 * INFO-TAB MOLECULAR GRAPH PANEL  —  dependency-free IIFE
 * ----------------------------------------------------------------------------
 * Adds a "Graphs" section to the INFO sidebar. For the selected molecule it
 * draws four exact, closed-form statistical-mechanics / kinetic-theory plots
 * that depend only on quantities the scene really knows about that molecule:
 *   • molar mass   M  = Σ atom.el.mass      (g/mol, summed from the graph)
 *   • temperature  T  = environment.temperatureK   (K)
 *
 * Every curve is a real physics formula evaluated point-by-point — nothing is
 * sampled from a lookup table and nothing is a placeholder:
 *   G1 Maxwell–Boltzmann speed distribution   f(v)=4π(M/2πRT)^{3/2} v² e^{−Mv²/2RT}
 *   G2 Translational kinetic-energy distribution  g(E)=(2/√π)√E/(RT)^{3/2} e^{−E/RT}
 *   G3 Boltzmann population factor            P(E)=e^{−E/RT}
 *   G4 Molecular speeds vs temperature        v_mp, v_mean, v_rms = c·√(RT/M)
 *
 * The panel reads the app through window.__mol3d (atoms, environment, selected())
 * and re-renders on selection change, theme change, language change and resize.
 * It injects its own CSS so no bundled stylesheet is touched.
 * ==========================================================================*/
(() => {
  'use strict';

  const R = 8.314;            // J·mol⁻¹·K⁻¹
  const PI = Math.PI, SQ = Math.sqrt, EX = Math.exp;

  const L = {
    en: {
      title: 'Molecular graphs',
      empty: 'Select a molecule to plot its physical-property graphs.',
      g1: 'Maxwell–Boltzmann speed distribution',
      g1f: 'f(v) = 4π (M / 2πRT)³ᐟ² · v² · e^(−Mv²/2RT)',
      g2: 'Translational energy distribution',
      g2f: 'g(E) = (2/√π) · √E / (RT)³ᐟ² · e^(−E/RT)',
      g3: 'Boltzmann population factor',
      g3f: 'P(E) = e^(−E/RT)',
      g4: 'Molecular speeds vs temperature',
      g4f: 'v_mp=√(2RT/M) · v_mean=√(8RT/πM) · v_rms=√(3RT/M)',
      T: 'T', mass: 'M', spont: 'most-probable', mean: 'mean', rms: 'rms'
    },
    vi: {
      title: 'Biểu đồ phân tử',
      empty: 'Chọn một phân tử để vẽ biểu đồ tính chất vật lý.',
      g1: 'Phân bố tốc độ Maxwell–Boltzmann',
      g1f: 'f(v) = 4π (M / 2πRT)³ᐟ² · v² · e^(−Mv²/2RT)',
      g2: 'Phân bố năng lượng dịch chuyển',
      g2f: 'g(E) = (2/√π) · √E / (RT)³ᐟ² · e^(−E/RT)',
      g3: 'Hệ số phân bố Boltzmann',
      g3f: 'P(E) = e^(−E/RT)',
      g4: 'Tốc độ phân tử theo nhiệt độ',
      g4f: 'v_mp=√(2RT/M) · v_mean=√(8RT/πM) · v_rms=√(3RT/M)',
      T: 'Nhiệt độ', mass: 'KLPT', spont: 'cực đại', mean: 'trung bình', rms: 'hiệu dụng'
    }
  };

  let mounted = false;
  let body, empty, captionEls = {}, canvasEls = {};

  // ── Data pulled live from the running scene ────────────────────────────────
  function molarMassG(comp) {                    // g/mol from the graph's atoms
    const atoms = window.__mol3d && window.__mol3d.atoms;
    if (!comp || !atoms) return 0;
    let m = 0;
    for (const id of comp.atoms) { const a = atoms.get(id); if (a && a.el) m += a.el.mass || 0; }
    return m;
  }
  function tempK() {
    const env = window.__mol3d && window.__mol3d.environment;
    return env && env.temperatureK > 0 ? env.temperatureK : 298.15;
  }
  function lang() {
    try { const i = window.__mol3d && window.__mol3d.i18n; if (i && i.getLang) { const l = i.getLang(); return l === 'vi' ? 'vi' : 'en'; } } catch (e) {}
    return 'vi';
  }
  function css(v, fb) {
    const s = getComputedStyle(document.documentElement).getPropertyValue(v).trim();
    return s || fb;
  }

  // ── Minimal 2D axis frame (matches the kinetics-canvas house style) ─────────
  function frame(ctx, W, H, opts) {
    const accent = css('--accent', '#4a9eff'), border = css('--border', 'rgba(60,120,200,.25)'),
      text = css('--muted', '#5a7090');
    const pad = { l: 46, r: 12, t: 14, b: 30 };
    const gw = W - pad.l - pad.r, gh = H - pad.t - pad.b;
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = border; ctx.lineWidth = 0.5; ctx.setLineDash([2, 3]);
    for (let i = 0; i <= 4; i++) { const y = pad.t + gh * i / 4; ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke(); }
    for (let i = 0; i <= 4; i++) { const x = pad.l + gw * i / 4; ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, H - pad.b); ctx.stroke(); }
    ctx.setLineDash([]);
    ctx.strokeStyle = text; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, H - pad.b); ctx.lineTo(W - pad.r, H - pad.b); ctx.stroke();
    return { pad, gw, gh, accent, text };
  }
  function xlabel(ctx, f, W, H, txt) { ctx.fillStyle = f.text; ctx.font = '9px monospace'; ctx.textAlign = 'center'; ctx.fillText(txt, f.pad.l + f.gw / 2, H - 4); }
  function ylabels(ctx, f, maxY, unit) { ctx.fillStyle = f.text; ctx.font = '9px monospace'; ctx.textAlign = 'right'; for (let i = 0; i <= 2; i++) { const y = f.pad.t + f.gh * i / 2; ctx.fillText(fmt(maxY * (1 - i / 2)), f.pad.l - 4, y + 3); } if (unit) { ctx.save(); ctx.translate(11, f.pad.t + f.gh / 2); ctx.rotate(-PI / 2); ctx.textAlign = 'center'; ctx.fillText(unit, 0, 0); ctx.restore(); } }
  function xticks(ctx, f, maxX, unit) { ctx.fillStyle = f.text; ctx.font = '9px monospace'; ctx.textAlign = 'center'; for (let i = 0; i <= 2; i++) { const x = f.pad.l + f.gw * i / 2; ctx.fillText(fmt(maxX * i / 2), x, f.pad.t + f.gh + 11); } if (unit) ctx.fillText(unit, f.pad.l + f.gw, f.pad.t + f.gh + 22); }
  function plot(ctx, f, pts, color, fill) {
    const n = pts.length; if (!n) return;
    let mx = 0, my = 0; for (const p of pts) { if (p[0] > mx) mx = p[0]; if (p[1] > my) my = p[1]; }
    const X = x => f.pad.l + f.gw * (mx ? x / mx : 0);
    const Y = y => f.pad.t + f.gh * (my ? (1 - y / my) : 1);
    if (fill) { const g = ctx.createLinearGradient(0, f.pad.t, 0, f.pad.t + f.gh); g.addColorStop(0, color + '55'); g.addColorStop(1, color + '08'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(X(0), Y(0)); for (const p of pts) ctx.lineTo(X(p[0]), Y(p[1])); ctx.lineTo(X(mx), Y(0)); ctx.closePath(); ctx.fill(); }
    ctx.strokeStyle = color; ctx.lineWidth = 1.8; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1]))); ctx.stroke();
    return { mx, my, X, Y };
  }
  function fmt(v) { if (!isFinite(v)) return '0'; const a = Math.abs(v); if (a >= 1e4 || (a > 0 && a < 1e-2)) return (window.__sciSup ? window.__sciSup(v, 2) : v.toExponential(1)); return (Math.round(v * 100) / 100).toString(); }

  // ── The four graphs ────────────────────────────────────────────────────────
  function drawSpeed(ctx, W, H, M, T) {         // M kg/mol
    const f = frame(ctx, W, H);
    const a = M / (2 * PI * R * T);
    const vr = SQ(3 * R * T / M);
    const maxV = 3.2 * vr;
    const pts = []; let peak = 0;
    for (let i = 0; i <= 160; i++) { const v = maxV * i / 160; const y = 4 * PI * Math.pow(a, 1.5) * v * v * EX(-M * v * v / (2 * R * T)); if (y > peak) peak = y; pts.push([v, y]); }
    const norm = pts.map(p => [p[0], peak ? p[1] / peak : 0]);
    const s = plot(ctx, f, norm, f.accent, true);
    // mark characteristic speeds
    const marks = [['v_mp', SQ(2 * R * T / M)], ['x̄', SQ(8 * R * T / PI / M)], ['v_rms', vr]];
    ctx.lineWidth = 1; for (const m of marks) { ctx.strokeStyle = css('--border', '#456'); ctx.setLineDash([1, 2]); ctx.beginPath(); ctx.moveTo(s.X(m[1]), f.pad.t); ctx.lineTo(s.X(m[1]), f.pad.t + f.gh); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = f.text; ctx.font = '8px monospace'; ctx.textAlign = 'center'; ctx.fillText(m[0], s.X(m[1]), f.pad.t + 8); }
    xticks(ctx, f, maxV, 'v (m/s)'); xlabel(ctx, f, W, H, 'v_rms = ' + fmt(vr) + ' m/s');
  }
  function drawEnergy(ctx, W, H, M, T) {        // per-mole kinetic energy dist
    const f = frame(ctx, W, H);
    const maxE = 6 * R * T;                     // J/mol
    const pts = []; let peak = 0;
    const c = 2 / SQ(PI) / Math.pow(R * T, 1.5);
    for (let i = 1; i <= 160; i++) { const E = maxE * i / 160; const y = c * SQ(E) * EX(-E / (R * T)); if (y > peak) peak = y; pts.push([E, y]); }
    plot(ctx, f, pts.map(p => [p[0] / 1000, peak ? p[1] / peak : 0]), f.accent, true);
    xticks(ctx, f, maxE / 1000, 'E (kJ/mol)'); xlabel(ctx, f, W, H, 'RT = ' + fmt(R * T / 1000) + ' kJ/mol');
  }
  function drawBoltz(ctx, W, H, M, T) {
    const f = frame(ctx, W, H);
    const maxE = 5 * R * T;                     // J/mol
    const pts = [];
    for (let i = 0; i <= 160; i++) { const E = maxE * i / 160; pts.push([E / 1000, EX(-E / (R * T))]); }
    plot(ctx, f, pts, f.accent, true);
    xticks(ctx, f, maxE / 1000, 'E (kJ/mol)'); xlabel(ctx, f, W, H, 'P(E)=e^(−E/RT)  @ ' + fmt(T) + ' K');
  }
  function drawSpeedVsT(ctx, W, H, M) {
    const f = frame(ctx, W, H);
    const T0 = tempK(), maxT = Math.max(600, Math.ceil((2 * T0) / 100) * 100);
    const mk = (coef) => { const p = []; for (let i = 1; i <= 100; i++) { const t = maxT * i / 100; p.push([t, coef * SQ(R * t / M)]); } return p; };
    const lines = [['v_mp', mk(SQ(2)), css('--accent', '#4a9eff')], ['v̄', mk(SQ(8 / PI)), css('--good', '#37c98b')], ['v_rms', mk(SQ(3)), css('--warn', '#f5a623')]];
    let mx = 0; for (const ln of lines) for (const p of ln[1]) if (p[1] > mx) mx = p[1];
    const X = t => f.pad.l + f.gw * (t / maxT), Y = v => f.pad.t + f.gh * (1 - (mx ? v / mx : 0));
    ctx.font = '8px monospace'; ctx.textAlign = 'left';
    lines.forEach((ln, i) => { ctx.strokeStyle = ln[2]; ctx.lineWidth = 1.6; ctx.beginPath(); ln[1].forEach((p, j) => j ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1]))); ctx.stroke(); ctx.fillStyle = ln[2]; ctx.fillText(ln[0] + ' ' + fmt(ln[1][ln[1].length - 1][1]), f.pad.l + 4, f.pad.t + 10 + i * 11); });
    xticks(ctx, f, maxT, 'T (K)'); xlabel(ctx, f, W, H, 'M = ' + fmt(M * 1000) + ' g/mol');
  }

  // ── Orchestration ──────────────────────────────────────────────────────────
  function render() {
    if (!mounted) return;
    const dict = L[lang()];
    const sel = window.__mol3d && window.__mol3d.selected ? window.__mol3d.selected() : null;
    const comp = sel && sel.comp;
    if (!comp || !comp.atoms || comp.atoms.length === 0) {
      body.hidden = true; empty.style.display = ''; return;
    }
    const Mg = molarMassG(comp);
    if (!(Mg > 0)) { body.hidden = true; empty.style.display = ''; return; }
    empty.style.display = 'none'; body.hidden = false;
    const M = Mg / 1000, T = tempK();
    const draw = { speed: drawSpeed, energy: drawEnergy, boltz: drawBoltz, speedT: drawSpeedVsT };
    const caps = { speed: dict.g1, energy: dict.g2, boltz: dict.g3, speedT: dict.g4 };
    const fs = { speed: dict.g1f, energy: dict.g2f, boltz: dict.g3f, speedT: dict.g4f };
    for (const key of Object.keys(canvasEls)) {
      const cv = canvasEls[key];
      const ctx = cv.getContext('2d');
      try { draw[key](ctx, cv.width, cv.height, M, T); } catch (e) { ctx.clearRect(0, 0, cv.width, cv.height); }
      captionEls[key].innerHTML = '<b>' + caps[key] + '</b><br><span class="ig-f">' + fs[key] + '</span>';
    }
  }

  function mount() {
    const side = document.getElementById('side-info');
    if (!side) return false;
    if (!window.__mol3d) return false;
    const sec = document.createElement('section');
    sec.className = 'panel';
    sec.innerHTML =
      '<h2 id="ig-title">Biểu đồ phân tử</h2>' +
      '<div id="graphs-empty" class="muted"></div>' +
      '<div id="graphs-body" hidden>' +
      ['speed', 'energy', 'boltz', 'speedT'].map(k =>
        '<div class="ig-block"><canvas class="ig-canvas" data-g="' + k + '" width="280" height="150"></canvas><div class="ig-cap" data-c="' + k + '"></div></div>'
      ).join('') +
      '</div>';
    side.appendChild(sec);
    body = sec.querySelector('#graphs-body');
    empty = sec.querySelector('#graphs-empty');
    for (const c of sec.querySelectorAll('.ig-canvas')) canvasEls[c.dataset.g] = c;
    for (const c of sec.querySelectorAll('.ig-cap')) captionEls[c.dataset.c] = c;
    mounted = true;

    const style = document.createElement('style');
    style.textContent =
      '.ig-block{margin:8px 0;padding-bottom:6px;border-bottom:1px solid var(--border,rgba(60,120,200,.15))}' +
      '.ig-block:last-child{border-bottom:none}' +
      '.ig-canvas{width:100%;height:auto;display:block;border-radius:6px;background:var(--panel-2,rgba(14,22,40,.4))}' +
      '.ig-cap{font-size:10px;line-height:1.35;margin-top:4px;color:var(--text,#cfe)}' +
      '.ig-cap .ig-f{font-family:monospace;font-size:9px;color:var(--muted,#5a7090);word-break:break-word}';
    document.head.appendChild(style);

    // Re-render whenever the inspector repaints the selected molecule.
    const molInfo = document.getElementById('mol-info');
    const selInfo = document.getElementById('sel-info');
    let timer = 0;
    const schedule = () => { clearTimeout(timer); timer = setTimeout(render, 16); };
    if (window.MutationObserver && molInfo) {
      const mo = new MutationObserver(schedule);
      mo.observe(molInfo, { childList: true, subtree: true, characterData: true });
      if (selInfo) mo.observe(selInfo, { childList: true, characterData: true });
    }
    // environment temperature changes / theme / language / resize
    window.addEventListener('mol3d:theme', schedule);
    window.addEventListener('mol3d:lang', () => { const d = L[lang()]; const el = document.getElementById('ig-title'); if (el) el.textContent = d.title; empty.textContent = d.empty; schedule(); });
    window.addEventListener('resize', schedule);
    if (window.__mol3d.environment) {
      // poll the env readout cheaply on input (the env tab mutates temperatureK directly)
      setInterval(() => { if (!document.hidden) schedule(); }, 800);
    }
    const d = L[lang()];
    empty.textContent = d.empty;
    const titleEl = document.getElementById('ig-title'); if (titleEl) titleEl.textContent = d.title;
    render();
    return true;
  }

  // Wait for the scene global to appear (main bundle is a module; this is a plain script).
  let tries = 0;
  const boot = setInterval(() => {
    if (mount() || ++tries > 200) clearInterval(boot);   // ~10s ceiling
  }, 50);
  if (document.readyState !== 'loading' && window.__mol3d) mount();
})();
