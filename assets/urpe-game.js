(function (root) {
  'use strict';
  const N = root.URPENumerics;
  const byFormula = new Map((root.URPEReferenceData || []).map(r => [r.formula, r]));
  // Equation text and table keys spell the same species differently
  // (C2H5OH vs C2H6O, Ca(OH)2 vs CaH2O2), so lookups fall back to a
  // canonical atom-count string.
  function canon(f) {
    const counts = Object.create(null);
    const re = /([A-Z][a-z]?)(\d*)|\(([^)]*)\)(\d*)/g;
    let m;
    while ((m = re.exec(String(f).replace(/\((?:s|l|g|aq)\)$/, '').replace(/\s+/g, '')))) {
      if (m[3] !== undefined) {
        const mult = +m[4] || 1;
        const re2 = /([A-Z][a-z]?)(\d*)/g;
        let inner;
        while ((inner = re2.exec(m[3]))) counts[inner[1]] = (counts[inner[1]] || 0) + (+inner[2] || 1) * mult;
      } else {
        counts[m[1]] = (counts[m[1]] || 0) + (+m[2] || 1);
      }
    }
    const keys = Object.keys(counts).sort();
    return keys.length ? keys.map(k => k + counts[k]).join('') : String(f);
  }
  const byCanon = new Map();
  for (const [k, r] of byFormula) { const c = canon(k); if (!byCanon.has(c)) byCanon.set(c, r); }
  function lookup(formula) { return byFormula.get(formula) || byCanon.get(canon(formula)) || null; }
  const vi = () => { try { return (localStorage.getItem('mol3d.lang') || 'vi') !== 'en'; } catch (e) { return true; } };
  const L = (en, v) => vi() ? v : en;

  function parse(equation) {
    const sides = String(equation).split(/->|→/);
    if (sides.length !== 2) return null;
    const terms = [];
    sides.forEach((side, i) => side.split(' + ').forEach(raw => {
      const m = raw.trim().match(/^(\d*)\s*(.+)$/);
      if (m) terms.push({ formula: m[2], nu: (i ? 1 : -1) * (m[1] ? +m[1] : 1) });
    }));
    return terms;
  }

  const styleEl = document.createElement('style');
  styleEl.textContent = '.urpe-g-note{opacity:.75;font-style:italic;margin-bottom:2px}';
  document.head.appendChild(styleEl);

  function evaluate(equation, T) {
    const terms = parse(equation);
    if (!terms) return null;
    const missing = terms.filter(t => !lookup(t.formula)).map(t => t.formula);
    if (missing.length) return { unsupported: missing };
    const res = N.thermo(terms.map(t => {
      const d = lookup(t.formula).data;
      return { nu: t.nu, phase: d.phase, hf: d.hf, s: d.s, referenceTemperature: d.referenceTemperature,
        pStandard: d.pStandard, cStandard: d.cStandard, cp: d.cp, provenance: d.provenance, source: d.source };
    }), T);
    res.sources = terms.map(t => lookup(t.formula));
    return res;
  }

  const fmt = (v, d) => v === null ? L('unknown', 'chưa rõ') : v.toFixed(d);
  function html(eq) {
    const r = evaluate(eq, 298.15);
    if (!r) return '';
    if (r.unsupported) {
      return '<div class="urpe-g-note">' + L('Gibbs prediction: no sourced standard data for ', 'Dự đoán Gibbs: chưa có dữ liệu chuẩn có nguồn cho ') +
        r.unsupported.map(f => f.replace(/[<>&"]/g, '')).join(', ') + L(' — not estimated.', ' — không ước đoán.') + '</div>';
    }
    let verdict = L('spontaneity unknown (missing data)', 'chưa rõ có tự diễn ra không (thiếu dữ liệu)');
    if (r.dG0 !== null) {
      verdict = r.dG0 < 0
        ? L('thermodynamically favourable under standard conditions (says nothing about rate)', 'thuận lợi về nhiệt động ở điều kiện chuẩn (không nói gì về tốc độ)')
        : L('unfavourable under standard conditions; the game condition supplies the driving energy', 'không thuận lợi ở điều kiện chuẩn; điều kiện trong game cung cấp năng lượng');
    }
    const K = r.lnK === null ? L('unknown', 'chưa rõ') : (Math.abs(r.lnK) > 700 ? 'e^' + r.lnK.toFixed(1) : r.K.toExponential(2));
    const title = r.sources.map(s => s.formula + ': ' + s.data.source).join('\n');
    return '<div class="urpe-g" title="' + title.replace(/"/g, '&quot;') + '">' +
      '<b>' + L('Gibbs prediction (298.15 K, 1 bar, measured standard-state data)', 'Dự đoán Gibbs (298,15 K, 1 bar, dữ liệu chuẩn đo lường)') + '</b><br>' +
      'ΔH° = ' + fmt(r.dH, 2) + ' kJ/mol · ΔS° = ' + fmt(r.dS, 2) + ' J/(mol·K) · ΔG° = ' + fmt(r.dG0, 2) + ' kJ/mol · K = ' + K +
      '<br><i>' + verdict + '</i></div>';
  }

  root.addEventListener('mol3d:reaction-completed', e => {
    const eq = e.detail && e.detail.equation;
    setTimeout(() => {
      const ov = document.getElementById('rxn-overlay');
      if (!ov) return;
      let box = ov.querySelector('.urpe-g-box');
      if (!box) {
        box = document.createElement('div');
        box.className = 'urpe-g-box';
        box.style.cssText = 'font-size:12px;opacity:.9;margin-top:6px;max-width:520px;line-height:1.35';
        (ov.querySelector('.rxn-equation') || ov).insertAdjacentElement('afterend', box);
      }
      box.innerHTML = html(eq);
    }, 0);
  });

  // Measured standard-state data for whatever molecule the player selects,
  // rendered in the Info tab. Bundle tables win when they cover the species;
  // otherwise the URPE reference table is consulted; never estimated silently.
  let thermoBox = null;
  let lastSelectedId = null;
  function selectedComponent(id) {
    const m = root.__mol3d;
    if (!m || !m.comps || !m.atoms || id === null || !m.atoms.has(id)) return null;
    const comps = m.comps() || [];
    const an = (m.analyses && m.analyses()) || [];
    for (let i = 0; i < comps.length; i++) {
      if (comps[i].atoms.indexOf(id) !== -1) return { comp: comps[i], a: an[i] || null };
    }
    return null;
  }
  function thermoHtml(sel) {
    const m = root.__mol3d;
    const list = sel.comp.atoms.map(id => m.atoms.get(id)).filter(Boolean);
    if (!list.length) return '';
    const a = sel.a || {};
    let head = a.displayFormula || a.formula ? '<b>' + String(a.displayFormula || a.formula).replace(/[<>&]/g, '') + '</b><br>' : '';
    const th = m.simulation && m.simulation.thermo;
    let r = null;
    try { if (th && th.standardStateGibbs) r = th.standardStateGibbs(list); } catch (e) { r = null; }
    if (r && r.dG !== null && r.dG !== undefined) {
      return '<div class="urpe-g-note">' + L('Standard-state data (298.15 K, 1 bar)', 'Dữ liệu chuẩn (298,15 K, 1 bar)') + '</div>' + head +
        'ΔfH° = ' + r.dHf.toFixed(2) + ' kJ/mol · ΔfS° = ' + r.dSf.toFixed(2) + ' J/(mol·K) · ΔfG° = ' + r.dG.toFixed(2) + ' kJ/mol';
    }
    const sp = lookup(a.displayFormula || a.formula || (r && r.formula));
    if (sp) {
      const d = sp.data;
      return '<div class="urpe-g-note">' + L('Reference table (298.15 K)', 'Bảng dữ liệu chuẩn (298,15 K)') + '</div>' + head +
        'ΔfH° = ' + fmt(d.hf, 2) + ' kJ/mol · S° = ' + fmt(d.s, 2) + ' J/(mol·K)' +
        (d.phase ? ' · ' + d.phase : '') +
        '<br><i title="' + String(d.source || '').replace(/"/g, '&quot;') + '">' + String(d.source || '').replace(/[<>&]/g, '') + '</i>';
    }
    return '<div class="urpe-g-note">' + head + L('No measured standard-state data for this species — nothing estimated.',
      'Loài này chưa có dữ liệu chuẩn đo lường — không ước đoán.') + '</div>';
  }
  root.addEventListener('mol3d:atom-selected', e => {
    lastSelectedId = e.detail && e.detail.id !== undefined ? e.detail.id : null;
    setTimeout(() => {
      const mol = document.getElementById('mol-info');
      if (!mol) return;
      if (!thermoBox) {
        thermoBox = document.createElement('div');
        thermoBox.className = 'urpe-thermo';
        thermoBox.style.cssText = 'font-size:12px;opacity:.92;margin-top:6px;line-height:1.4';
        mol.insertAdjacentElement('afterend', thermoBox);
      }
      const sel = selectedComponent(lastSelectedId);
      if (!sel || !sel.comp.bonds || !sel.comp.bonds.length) { thermoBox.innerHTML = ''; thermoBox.style.display = 'none'; return; }
      thermoBox.style.display = '';
      thermoBox.innerHTML = thermoHtml(sel);
    }, 0);
  });

  root.URPEGame = { evaluate };
})(window);
