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
    let res;
    try {
      res = N.thermo(terms.map(t => {
        const d = lookup(t.formula).data;
        return { nu: t.nu, phase: d.phase, hf: d.hf, s: d.s, referenceTemperature: d.referenceTemperature,
          pStandard: d.pStandard, cStandard: d.cStandard, cp: d.cp, provenance: d.provenance, source: d.source };
      }), T);
    } catch (e) { return null; }
    res.sources = terms.map(t => lookup(t.formula));
    return res;
  }

  const fmt = (v, d) => v === null ? L('unknown', 'chưa rõ') : v.toFixed(d);

  // --- Reaction panel Gibbs prediction ---------------------------------------
  // Every number below comes out of URPENumerics.thermo, which evaluates the
  // universal relations: Kirchhoff in the constant-Cp form
  //   H(T) = H(ref) + Cp(T-ref),  S(T) = S(ref) + Cp ln(T/ref)
  //   dG0(T) = dH(T) - T dS(T),  lnK = -dG0/(RT),  dG = dG0 + RT lnQ
  // Nothing is keyed to a particular reaction; the only per-species input is the
  // cited standard-state row, and an absent number makes the result unknown
  // rather than guessed.
  const ATM_TO_BAR = 1.01325;
  const SWEEP = { from: 100, to: 6000 }; // same ceiling the environment slider offers

  function envState() {
    const e = (root.__mol3d && root.__mol3d.environment) || {};
    const T = Number.isFinite(e.temperatureK) ? e.temperatureK : 298.15;
    const P = Number.isFinite(e.pressureAtm) ? e.pressureAtm * ATM_TO_BAR : 1;
    return { T, P, standard: T === 298.15 && Math.abs(P - 1) < 1e-9 };
  }

  function speciesList(rx) {
    const terms = parse(rx.equation);
    if (!terms) return null;
    const list = terms.map(t => ({ formula: t.formula, nu: t.nu, data: (lookup(t.formula) || {}).data || null }));
    return list;
  }

  // Reactant amounts are keyed by the table's own spelling, which need not match
  // the equation text, so match on the canonical atom count as well.
  function amountFor(formula, moles) {
    if (!moles || typeof moles.get !== 'function') return null;
    if (moles.has(formula)) return moles.get(formula);
    const want = canon(formula);
    for (const [key, value] of moles) if (canon(key) === want) return value;
    return null;
  }

  function thermoTerm(entry, activity) {
    const d = entry.data;
    const term = { nu: entry.nu, phase: d.phase, hf: d.hf, s: d.s,
      referenceTemperature: d.referenceTemperature, pStandard: d.pStandard, cStandard: d.cStandard,
      cp: d.cp, provenance: d.provenance, source: d.source };
    if (activity !== undefined) term.activity = activity;
    return term;
  }

  // Activities the scene can actually support: a pure solid or liquid is unity, a
  // gaseous reactant is its mole fraction times the total pressure (the mole
  // fraction is taken over the reacting gases alone, because the world reports no
  // vessel volume), and an aqueous species would need mol/L, which the world does
  // not track at all. Products are held at unit activity: they have not formed yet,
  // so what comes out is the initial driving force, not an equilibrium statement.
  function activities(list, moles, P) {
    const out = {};
    const aqueous = list.some(t => t.data && t.data.phase === 'aq');
    if (aqueous) return { acts: {}, reason: L('aqueous species need a concentration and the scene tracks no solution volume',
      'loài trong dung dịch cần nồng độ và cảnh không ghi nhận thể tích dung dịch') };
    for (const t of list) if (t.data && t.nu < 0 && t.data.phase !== 'g') out[t.formula] = 1;
    const reactantGases = list.filter(t => t.data && t.nu < 0 && t.data.phase === 'g');
    let total = 0;
    const known = [];
    for (const t of reactantGases) {
      const n = amountFor(t.formula, moles);
      if (n === null || !Number.isFinite(n) || n <= 0) return { acts: {}, reason: L('enter a mass for every gaseous reactant',
        'hãy nhập khối lượng cho mọi chất khí tham gia') };
      known.push({ t, n });
      total += n;
    }
    for (const { t, n } of known) out[t.formula] = (n / total) * P / t.data.pStandard;
    for (const t of list) if (t.data && t.nu > 0 && out[t.formula] === undefined) out[t.formula] = 1;
    return { acts: out, reason: null, reactantGases: reactantGases.length > 0 };
  }

  // Solve dG0(T) = 0 numerically on a log grid, then bisect. Constant-Cp
  // Kirchhoff is the model, so the answer is indicative above its validity range.
  function crossover(list) {
    if (!list.every(t => t.data && Number.isFinite(t.data.cp))) return { reason: 'no-cp' };
    const value = T => {
      try { return N.thermo(list.map(t => thermoTerm(t)), T).dG0; } catch (e) { return null; }
    };
    let prevT = null, prev = null;
    for (let i = 0; i <= 64; i++) {
      const T = SWEEP.from * Math.pow(SWEEP.to / SWEEP.from, i / 64);
      const v = value(T);
      if (v === null) return { reason: 'error' };
      if (prev !== null && (v === 0 || v < 0 !== prev < 0)) {
        let a = prevT, b = T, fa = prev;
        for (let k = 0; k < 80; k++) {
          const m = (a + b) / 2, fm = value(m);
          if (fm === null) return { reason: 'error' };
          if (fm === 0 || (fm < 0) === (fa < 0)) { a = m; fa = fm; } else b = m;
        }
        return { T: (a + b) / 2, above: prev > 0 };
      }
      prev = v; prevT = T;
    }
    return { none: true };
  }

  function esc(s) { return String(s).replace(/[<>&"]/g, ''); }
  function att(s) { return String(s).replace(/"/g, '&quot;'); }
  // Vietnamese textbooks write the phase markers as răn/liquid/khí/dung dịch.
  const PHASE = { g: ['gas', 'khí'], l: ['liquid', 'lỏng'], s: ['solid', 'rắn'], aq: ['aqueous', 'dung dịch'] };
  const PROV = { measured: ['measured', 'đo lường'], calculated: ['calculated', 'tính toán'],
    empirical: ['empirical', 'thực nghiệm'], mixed: ['mixed sources', 'nhiều nguồn'], unknown: ['unknown', 'chưa rõ'] };
  const phaseName = p => { const n = PHASE[p]; return n ? L(n[0], n[1]) : String(p); };
  const provName = p => { const n = PROV[p]; return n ? L(n[0], n[1]) : String(p); };
  function sci(v, d) {
    if (v === null || !Number.isFinite(v)) return L('unknown', 'chưa rõ');
    const a = Math.abs(v);
    if (a !== 0 && (a >= 1e5 || a < 1e-3)) return v.toExponential(d === undefined ? 2 : d);
    return v.toFixed(d === undefined ? 2 : d);
  }

  function panelHtml(rx, moles) {
    const list = rx && speciesList(rx);
    if (!list) return '';
    const missing = list.filter(t => !t.data).map(t => t.formula);
    if (missing.length) {
      return '<div class="rxn-gibbs-note">' + esc(L('Gibbs: no sourced standard-state data for ', 'Dự đoán Gibbs: không có dữ liệu chuẩn có nguồn cho ')) +
        missing.map(esc).join(', ') + esc(L(' — the panel refuses to invent numbers.', ' — bảng từ chối bịa số.')) + '</div>';
    }
    const { T, P } = envState();
    const q = activities(list, moles, P);
    const terms = list.map(t => thermoTerm(t, q.acts[t.formula]));
    let r;
    try { r = N.thermo(terms, T); } catch (e) {
      return '<div class="rxn-gibbs-note">' + esc(L('Gibbs: the solver rejected this equation (', 'Dự đoán Gibbs: bộ giải từ chối phương trình (')) + esc(e.message) + ').</div>';
    }
    const K = r.lnK === null ? L('unknown', 'chưa rõ')
      : (Math.abs(r.lnK) > 700 ? 'e^' + r.lnK.toFixed(1) : sci(r.K));
    let verdict;
    if (r.dG0 === null) verdict = L('undetermined: standard data incomplete', 'không xác định: dữ liệu chuẩn chưa đủ');
    else if (r.dG0 < 0) verdict = L('thermodynamically favourable as written at these conditions; it says nothing about how fast', 'thuận lợi về nhiệt động khi viết như trên ở điều kiện này; không nói gì về tốc độ');
    else verdict = L('thermodynamically unfavourable as written; the game condition must supply the driving energy', 'không thuận lợi khi viết như trên; điều kiện trong game phải cung cấp năng lượng thúc đẩy');

    const rows = [];
    rows.push('<div class="rxn-gibbs-eq"><b>ΔH°(T)</b> = ' + sci(r.dH, 2) + ' kJ/mol' +
      ' <b>ΔS°(T)</b> = ' + sci(r.dS, 2) + ' J·mol⁻¹·K⁻¹</div>');
    rows.push('<div class="rxn-gibbs-eq"><b>ΔG°(T)</b> = ' + sci(r.dG0, 2) + ' kJ/mol' +
      ' <b>K(T)</b> = ' + esc(K) + '</div>');
    if (r.lnQ !== null && r.lnQ !== undefined) {
      rows.push('<div class="rxn-gibbs-eq"><b>Q</b> = ' + (Number.isFinite(r.lnQ) ? sci(Math.exp(r.lnQ)) : (r.lnQ > 0 ? '→ ∞' : '→ 0')) +
        ' <b>ΔG</b> = ' + sci(r.dG, 2) + ' kJ/mol</div>');
      rows.push('<div class="rxn-gibbs-note">' + esc(q.reactantGases
        ? L('Q uses the masses you entered for the gaseous reactants and holds every product at unit activity, so ΔG is the initial driving force.',
            'Q dùng khối lượng bạn nhập cho các chất khí tham gia và giữ mọi sản phẩm ở hoạt độ đơn vị, nên ΔG là lực đẩy ban đầu.')
        : L('All reactants are pure condensed phases and every product is held at unit activity, so Q = 1 and ΔG = ΔG°.',
            'Mọi chất tham gia là pha ngưng tụ thuần nhất và mỗi sản phẩm ở hoạt độ đơn vị, nên Q = 1 và ΔG = ΔG°.')) + '</div>');
    } else if (q.reason) {
      rows.push('<div class="rxn-gibbs-note">' + esc(L('ΔG not priced: ', 'Chưa tính ΔG: ') + q.reason + '.') + '</div>');
    }
    const cross = crossover(list);
    if (cross.T !== undefined) {
      rows.push('<div class="rxn-gibbs-note">' + esc(L('ΔG°(T) = 0 at T ≈ ' + cross.T.toFixed(0) + ' K: ',
        'ΔG°(T) = 0 tại T ≈ ' + cross.T.toFixed(0) + ' K: ')) +
        esc(cross.above ? L('favourable above this temperature', 'thuận lợi trên nhiệt độ này')
          : L('favourable below this temperature', 'thuận lợi dưới nhiệt độ này')) +
        esc(L(' (constant-Cp extrapolation).', ' (ngoại suy Cp không đổi).')) + '</div>');
    } else if (cross.none) {
      rows.push('<div class="rxn-gibbs-note">' + esc(L('ΔG°(T) keeps its sign over 100–6000 K.', 'ΔG°(T) giữ nguyên dấu trong khoảng 100–6000 K.')) + '</div>');
    } else if (cross.reason === 'no-cp') {
      rows.push('<div class="rxn-gibbs-note">' + esc(L('No crossover search: at least one species has no measured Cp, so ΔG°(T) cannot be moved off its reference temperature.',
        'Không tìm điểm đổi dấu: ít nhất một loài chưa có Cp đo lường, nên ΔG°(T) không rời được nhiệt độ chuẩn.')) + '</div>');
    }
    // Map the solver's internal paths back onto the species they came from, so the
    // panel names a chemical instead of an array index.
    const FIELD = { activity: L('activity', 'hoạt độ'), cp: 'Cp', hf: 'ΔfH°', s: 'S°',
      referenceTemperature: L('reference temperature', 'nhiệt độ chuẩn'), pStandard: 'p°', cStandard: 'c°' };
    const explain = m => {
      const mm = /^terms\[(\d+)\](?:[.:]\s*)?([\s\S]*)$/.exec(m);
      if (!mm) return m;
      const t = list[Number(mm[1])];
      const rest = mm[2];
      const named = FIELD[rest];
      return (t ? t.formula : '?') + (named ? ': ' + named : ': ' + rest);
    };
    const gaps = r.missing
      .filter(m => !(q.reason && /\.activity$/.test(m)))
      .map(explain);
    if (gaps.length) {
      rows.push('<div class="rxn-gibbs-note">' + esc(L('Missing for a full answer: ', 'Còn thiếu để có câu trả lời đầy đủ: ')) +
        gaps.slice(0, 6).map(esc).join('; ') +
        (gaps.length > 6 ? esc(L(' (+' + (gaps.length - 6) + ' more)', ' (+ ' + (gaps.length - 6) + ' nữa)')) : '') + '.</div>');
    }
    const per = list.map(t => '<div>' + esc(t.formula) + ' ' + (t.nu < 0 ? L('reactant', 'chất tham gia') : L('product', 'sản phẩm')) +
      ' · ΔfH° ' + sci(t.data.hf, 2) + ' kJ/mol · S° ' + sci(t.data.s, 2) + ' J·mol⁻¹·K⁻¹ · ' + esc(phaseName(t.data.phase)) +
      (Number.isFinite(t.data.cp) ? ' · Cp ' + sci(t.data.cp, 2) : '') + '</div>');
    const titles = list.map(t => att(t.formula + ': ' + t.data.source)).join('\n');
    return '<div class="rxn-gibbs" title="' + titles + '">' +
      '<div class="rxn-gibbs-head">' + esc(L('Gibbs prediction at the environment setting', 'Dự đoán Gibbs theo điều kiện môi trường')) +
      ': ' + T.toFixed(2) + ' K · ' + P.toFixed(P < 10 ? 3 : 1) + ' bar · ' + esc(L('provenance', 'nguồn dữ liệu')) + ': ' + esc(provName(r.provenance)) + '</div>' +
      rows.join('') +
      '<div class="rxn-gibbs-verdict ' + (r.dG0 === null ? 'unk' : (r.dG0 < 0 ? 'neg' : 'pos')) + '"><i>' + esc(verdict) + '</i></div>' +
      '<details class="rxn-gibbs-src"><summary>' + esc(L('Standard-state data used', 'Dữ liệu chuẩn đã dùng')) + '</summary>' + per.join('') + '</details>' +
      '</div>';
  }
  function html(eq) {
    const { T, P } = envState();
    const r = evaluate(eq, T);
    if (!r) return '';
    if (r.unsupported) {
      return '<div class="urpe-g-note">' + L('Gibbs prediction: no sourced standard data for ', 'Dự đoán Gibbs: chưa có dữ liệu chuẩn có nguồn cho ') +
        r.unsupported.map(f => f.replace(/[<>&"]/g, '')).join(', ') + L(' — not estimated.', ' — không ước đoán.') + '</div>';
    }
    let verdict = L('spontaneity unknown (missing data)', 'chưa rõ có tự diễn ra không (thiếu dữ liệu)');
    if (r.dG0 !== null) {
      verdict = r.dG0 < 0
        ? L('thermodynamically favourable at these conditions (says nothing about rate)', 'thuận lợi về nhiệt động ở điều kiện này (không nói gì về tốc độ)')
        : L('unfavourable at these conditions; the game condition supplies the driving energy', 'không thuận lợi ở điều kiện này; điều kiện trong game cung cấp năng lượng');
    }
    const K = r.lnK === null ? L('unknown', 'chưa rõ') : (Math.abs(r.lnK) > 700 ? 'e^' + r.lnK.toFixed(1) : sci(r.K));
    const title = r.sources.map(s => s.formula + ': ' + s.data.source).join('\n');
    return '<div class="urpe-g" title="' + title.replace(/"/g, '&quot;') + '">' +
      '<b>' + L('Gibbs prediction at the environment setting', 'Dự đoán Gibbs theo điều kiện môi trường') +
      ' (' + T.toFixed(2) + ' K, ' + P.toFixed(P < 10 ? 3 : 1) + ' bar)</b><br>' +
      'ΔH° = ' + sci(r.dH, 2) + ' kJ/mol · ΔS° = ' + sci(r.dS, 2) + ' J/(mol·K) · ΔG° = ' + sci(r.dG0, 2) + ' kJ/mol · K = ' + K +
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
        (d.phase ? ' · ' + esc(phaseName(d.phase)) : '') +
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

  root.URPEGame = { evaluate, panelHtml };
})(window);
