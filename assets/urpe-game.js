(function (root) {
  'use strict';
  const N = root.URPENumerics;
  const byFormula = new Map((root.URPEReferenceData || []).map(r => [r.formula, r]));
  // Equation text and table keys spell the same species differently
  // (C2H5OH vs C2H6O, Ca(OH)2 vs CaH2O2), so lookups fall back to a
  // canonical atom-count string.
  function canon(f) {
    const counts = Object.create(null);
    const raw = String(f).replace(/\((?:s|l|g|aq)\)$/, '').replace(/\s+/g, '');
    // The charge is part of the species, not decoration: Cl and Cl- are different
    // substances with different enthalpies, so the sign survives in the key instead
    // of being dropped by the atom-count parser.
    const tail = raw.match(/[+-]\d*$/);
    const charge = tail ? (tail[0][0] === '-' ? -1 : 1) * (+tail[0].slice(1) || 1) : 0;
    const body = charge ? raw.slice(0, raw.length - tail[0].length) : raw;
    const re = /([A-Z][a-z]?)(\d*)|\(([^)]*)\)(\d*)/g;
    let m;
    while ((m = re.exec(body))) {
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
    const atomKey = keys.length ? keys.map(k => k + counts[k]).join('') : raw;
    return charge ? atomKey + (charge > 0 ? '+' : '-') + Math.abs(charge) : atomKey;
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
    const rows = terms.map(t => speciesRow(t.formula));
    const missing = terms.filter((t, i) => !rows[i]).map(t => t.formula);
    if (missing.length) return { unsupported: missing };
    let res;
    try {
      res = N.thermo(terms.map((t, i) => {
        const d = rows[i].data;
        return { nu: t.nu, phase: d.phase, hf: d.hf, s: d.s, referenceTemperature: d.referenceTemperature,
          pStandard: d.pStandard, cStandard: d.cStandard, cp: d.cp, provenance: d.provenance, source: d.source };
      }), T);
    } catch (e) { return null; }
    res.sources = rows;
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
    const list = terms.map(t => ({ formula: t.formula, nu: t.nu, data: (speciesRow(t.formula) || {}).data || null }));
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
      cp: d.cp, cpPoly: d.cpPoly, cpIntervals: d.cpIntervals,
      provenance: d.provenance, source: d.source };
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

  // Solve dG0(T) = 0 numerically on a log grid, then bisect. The temperature ladder
  // is the model, so the search runs whether or not heat capacities are published;
  // `model` reports which rung each crossing point was priced with.
  function crossover(list) {
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
  // A power of ten is written with the exponent above the line, and a negative
  // number carries a minus sign rather than a hyphen. toExponential() is the value
  // in the form "1.2e-5"; this is the same value in the form it is read as.
  const SUP = { '-': '\u207B', '0': '\u2070', '1': '\u00B9', '2': '\u00B2', '3': '\u00B3', '4': '\u2074', '5': '\u2075', '6': '\u2076', '7': '\u2077', '8': '\u2078', '9': '\u2079' };
  function sup(s) { return String(s).split('').map(c => SUP[c] || c).join(''); }
  function sci10(v, d) {
    const e = v.toExponential(d);
    const i = e.indexOf('e');
    const mant = e.slice(0, i).replace(/\.?0+$/, '').replace(/^-/, '\u2212');
    return mant + '\u00d710' + sup(e.slice(i + 1).replace('+', ''));
  }
  function sci(v, d) {
    if (v === null || !Number.isFinite(v)) return L('unknown', 'chưa rõ');
    const a = Math.abs(v);
    if (a !== 0 && (a >= 1e5 || a < 1e-3)) return sci10(v, d === undefined ? 2 : d);
    return v.toFixed(d === undefined ? 2 : d).replace(/^-/, '\u2212');
  }

  // Equilibrium composition. The reaction coordinate ξ is measured in units of the
  // written equation, so species i holds n0(i) + ν(i)ξ. At fixed T and P a gas is
  // its mole fraction times P/p°, a pure condensed phase stays at unit activity, and
  // lnQ therefore rises monotonically with ξ, which makes ξ(K) a bisection rather
  // than a polynomial. The bracket is the stoichiometric limit in each direction:
  // a mixture can run out of material long before Q reaches K, and that clamp is
  // itself the prediction (quantitative reaction), so it is reported, not hidden.
  function equilibrium(list, r, moles, P) {
    if (r === null || r.lnK === null || !Number.isFinite(r.lnK)) return null;
    const sp = [];
    for (const t of list) {
      const ph = t.data.phase;
      if (ph === 'aq') return null;
      let n0 = amountFor(t.formula, moles);
      if (n0 === null || !Number.isFinite(n0)) n0 = 0;
      sp.push({ formula: t.formula, nu: t.nu, gas: ph === 'g', pStd: t.data.pStandard || 1, n0 });
    }
    let hi = Infinity, lo = -Infinity;
    for (const s of sp) {
      if (s.nu < 0) hi = Math.min(hi, s.n0 / -s.nu);
      else lo = Math.max(lo, -s.n0 / s.nu);
    }
    if (!Number.isFinite(hi) || !Number.isFinite(lo) || hi < lo) return null;
    const lnQ = xi => {
      let gas = 0;
      for (const s of sp) if (s.gas) gas += Math.max(0, s.n0 + s.nu * xi);
      let sum = 0;
      for (const s of sp) {
        if (!s.gas || s.nu === 0) continue;
        const n = Math.max(0, s.n0 + s.nu * xi);
        if (n <= 0) return s.nu > 0 ? -Infinity : Infinity;
        sum += s.nu * Math.log(n / gas * P / s.pStd);
      }
      return sum;
    };
    let xi, clamped = null;
    const fLo = lnQ(lo) - r.lnK, fHi = lnQ(hi) - r.lnK;
    if (fLo > 0) { xi = lo; clamped = 'reverse'; }
    else if (fHi < 0) { xi = hi; clamped = 'forward'; }
    else {
      let a = lo, b = hi;
      for (let k = 0; k < 200; k++) {
        const m = (a + b) / 2;
        if (lnQ(m) - r.lnK > 0) b = m; else a = m;
        if (b - a < 1e-12 * (Math.abs(hi) + 1e-12)) break;
      }
      xi = (a + b) / 2;
      // K sits outside the range Q can reach at this charge even though the far
      // end of the bracket is an infinite activity: the mixture simply runs out.
      const eps = 1e-7 * (hi - lo || 1);
      if (hi - xi < eps) clamped = 'forward';
      else if (xi - lo < eps) clamped = 'reverse';
    }
    const at = {};
    let prodmol = 0, reactmol = 0, limiting = null;
    for (const s of sp) {
      const n = Math.max(0, s.n0 + s.nu * xi);
      at[s.formula] = n;
      if (s.nu < 0) {
        reactmol += n;
        const conv = s.n0 > 0 ? (s.n0 - n) / s.n0 : 0;
        if (s.n0 > 0 && (limiting === null || conv > limiting.conv)) limiting = { formula: s.formula, conv };
      } else prodmol += n;
    }
    return { xi, moles: at, productMoles: prodmol, reactantMoles: reactmol,
      ratio: reactmol > 0 ? prodmol / reactmol : null,
      limiting: limiting && limiting.formula, conversion: limiting && limiting.conv,
      clamped };
  }

  function panelHtml(rx, moles) {
    const list = rx && speciesList(rx);
    if (!list) return '';
    const missing = list.filter(t => !t.data).map(t => t.formula);
    if (missing.length) {
      return '<div class="rxn-gibbs-note">' + esc(L('Gibbs: no standard-state data and no structure to estimate one from for ',
        'Dự đoán Gibbs: không có dữ liệu chuẩn và không có cấu trúc để ước lượng cho ')) +
        missing.map(esc).join(', ') + esc(L(' — the panel refuses to invent numbers.', ' — bảng từ chối bịa số.')) + '</div>';
    }
    // A species with no cited row is priced from the molecule the engine rebuilds
    // from its own template, and the panel has to say so: an estimated ΔfH° carries
    // the estimator's known biases, not a table's uncertainty.
    const estimated = list.filter(t => t.data.estimated).map(t => t.formula);
    const { T, P } = envState();
    const q = activities(list, moles, P);
    const terms = list.map(t => thermoTerm(t, q.acts[t.formula]));
    let r;
    try { r = N.thermo(terms, T); } catch (e) {
      return '<div class="rxn-gibbs-note">' + esc(L('Gibbs: the solver rejected this equation (', 'Dự đoán Gibbs: bộ giải từ chối phương trình (')) + esc(e.message) + ').</div>';
    }
    const K = r.lnK === null ? L('unknown', 'chưa rõ')
      : (Math.abs(r.lnK) > 700 ? 'e' + sup(r.lnK.toFixed(0)) : sci(r.K));
    let verdict;
    if (r.dG0 === null) verdict = L('undetermined: standard data incomplete', 'không xác định: dữ liệu chuẩn chưa đủ');
    else if (r.dG0 < 0) verdict = L('thermodynamically favourable as written at these conditions; it says nothing about how fast', 'thuận lợi về nhiệt động khi viết như trên ở điều kiện này; không nói gì về tốc độ');
    else verdict = L('thermodynamically unfavourable as written; the game condition must supply the driving energy', 'không thuận lợi khi viết như trên; điều kiện trong game phải cung cấp năng lượng thúc đẩy');

    const rows = [];
    rows.push('<div class="rxn-gibbs-eq"><b>ΔH°(T)</b> = ' + sci(r.dH, 2) + ' kJ·mol⁻¹' +
      ' <b>ΔS°(T)</b> = ' + sci(r.dS, 2) + ' J·mol⁻¹·K⁻¹</div>');
    rows.push('<div class="rxn-gibbs-eq"><b>ΔG°(T)</b> = ' + sci(r.dG0, 2) + ' kJ·mol⁻¹' +
      ' <b>K(T)</b> = ' + esc(K) + '</div>');
    if (estimated.length) {
      rows.push('<div class="rxn-gibbs-note">' + esc(L('Calculated, not measured: ', 'Tính ra chứ không đo: ')) +
        estimated.map(esc).join(', ') + esc(L(' — ΔfH° and S° for these come from the structure the engine rebuilds for them' +
          ' (bond-enthalpy cycle plus ideal-gas statistical mechanics at 298.15 K), so their biases are the estimator\'s:' +
          ' symmetry number 1, no bending or torsion modes, no aromatic resonance, and everything treated as a free gas molecule,' +
          ' which leaves an ionic or network solid without its lattice energy.',
          ' — ΔfH° và S° của các chất này lấy từ cấu trúc mà engine dựng lại cho chúng' +
          ' (chu trình năng lượng liên kết cộng cơ học thống kê khí lý tưởng ở 298,15 K), nên sai số là của phương pháp:' +
          ' số đối xứng 1, bỏ qua mode uốn và xoắn, chưa có cộng hưởng thơm, và mọi chất bị coi là phân tử khí tự do,' +
          ' nên chất rắn ion hoặc mạng cộng hoá trị mất luôn năng lượng mạng tinh thể.')) + '</div>');
    }
    if (r.lnQ !== null && r.lnQ !== undefined) {
      rows.push('<div class="rxn-gibbs-eq"><b>Q</b> = ' + (Number.isFinite(r.lnQ) ? sci(Math.exp(r.lnQ)) : (r.lnQ > 0 ? '→ ∞' : '→ 0')) +
        ' <b>ΔG</b> = ' + sci(r.dG, 2) + ' kJ·mol⁻¹</div>');
      rows.push('<div class="rxn-gibbs-note">' + esc(q.reactantGases
        ? L('Q uses the masses you entered for the gaseous reactants and holds every product at unit activity, so ΔG is the initial driving force.',
            'Q dùng khối lượng bạn nhập cho các chất khí tham gia và giữ mọi sản phẩm ở hoạt độ đơn vị, nên ΔG là lực đẩy ban đầu.')
        : L('All reactants are pure condensed phases and every product is held at unit activity, so Q = 1 and ΔG = ΔG°.',
            'Mọi chất tham gia là pha ngưng tụ thuần nhất và mỗi sản phẩm ở hoạt độ đơn vị, nên Q = 1 và ΔG = ΔG°.')) + '</div>');
    } else if (q.reason) {
      rows.push('<div class="rxn-gibbs-note">' + esc(L('ΔG not priced: ', 'Chưa tính ΔG: ') + q.reason + '.') + '</div>');
    }
    const eq = equilibrium(list, r, moles, P);
    if (eq) {
      const dir = eq.xi > 0 ? '→' : eq.xi < 0 ? '←' : '=';
      const pct = eq.conversion === null || eq.conversion === undefined ? null
        : eq.conversion > 0 && eq.conversion < 5e-4 ? L('<0.05 %', '<0,05 %')
        : (100 * eq.conversion).toFixed(1) + '%';
      const mix = list.map(t => esc(t.formula) + ' ' + sci(eq.moles[t.formula], 3) + ' mol').join(' · ');
      rows.push('<div class="rxn-gibbs-eq"><b>' + dir + '</b> ' +
        L('equilibrium mixture', 'hỗn hợp cân bằng') + ': ' + mix + '</div>');
      rows.push('<div class="rxn-gibbs-note">' + esc(
        (eq.clamped === 'forward' ? L('Runs to the stoichiometric limit (K is larger than any Q this charge can reach): ',
            'Chạy hết giới hạn hợp thức (K lớn hơn mọi Q mà lượng chất này đạt tới): ')
          : eq.clamped === 'reverse' ? L('Runs backward to the stoichiometric limit (K is smaller than any Q this charge can reach): ',
            'Chạy ngược hết giới hạn hợp thức (K nhỏ hơn mọi Q mà lượng chất này đạt tới): ')
          : L('Stops at equilibrium with ', 'Dừng ở cân bằng với ')) +
        (pct === null ? L('no charge given', 'không cho lượng chất nào')
          : pct + ' ' + L('of ' + eq.limiting + ' converted', ' ' + eq.limiting + ' đã chuyển hoá')) +
        (eq.ratio === null ? '' : ', ' + L('product:reactant = ', 'sản phẩm:chất tham gia = ') + sci(eq.ratio, 2) + ':1') +
        (eq.clamped ? L(' — the mixture runs out of material before K is reached.', ' — hỗn hợp cạn chất trước khi đạt K.') : '.')) + '</div>');
    }
    // Say how the number was carried to this temperature. The three-regime ladder
    // always prices a route, so a value 2000 K off the table is displayed with the
    // rung that produced it rather than looking like an integration that never ran.
    if (r.model) {
      const rungs = [...new Set((r.model.terms || []).map(t => t.regime))];
      const line = L('Temperature model: ΔT = ' + r.model.maxAbsDT.toFixed(2) + ' K, priced by ' + rungs.join(' + ') +
        (r.model.crossings ? ' across ' + r.model.crossings + ' phase transition(s)' : '') + '.',
        'Mô hình nhiệt độ: ΔT = ' + r.model.maxAbsDT.toFixed(2) + ' K, tính bằng ' + rungs.join(' + ') +
        (r.model.crossings ? ' qua ' + r.model.crossings + ' chuyển pha' : '') + '.');
      rows.push('<div class="rxn-gibbs-note">' + esc(line) +
        (r.model.caveats && r.model.caveats.length
          ? esc(' ' + L('Caveat: ', 'Cảnh báo: ') + r.model.caveats.slice(0, 2).join('; ') +
            (r.model.caveats.length > 2 ? ' (+' + (r.model.caveats.length - 2) + ')' : ''))
          : '') +
        '</div>');
    }
    const cross = crossover(list);
    if (cross.T !== undefined) {
      rows.push('<div class="rxn-gibbs-note">' + esc(L('ΔG°(T) = 0 at T ≈ ' + cross.T.toFixed(0) + ' K: ',
        'ΔG°(T) = 0 tại T ≈ ' + cross.T.toFixed(0) + ' K: ')) +
        esc(cross.above ? L('favourable above this temperature', 'thuận lợi trên nhiệt độ này')
          : L('favourable below this temperature', 'thuận lợi dưới nhiệt độ này')) +
        esc(L(' as the temperature model prices it.', ' theo đúng mô hình nhiệt độ đang dùng.')) + '</div>');
    } else if (cross.none) {
      rows.push('<div class="rxn-gibbs-note">' + esc(L('ΔG°(T) keeps its sign over 100–6000 K.', 'ΔG°(T) giữ nguyên dấu trong khoảng 100–6000 K.')) + '</div>');
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
    const cpLabel = d => {
      if (d.cpIntervals) return ' · Cp°(T) over ' + d.cpIntervals.length + ' phase interval(s)';
      if (d.cpPoly) return ' · Cp°(T) ' + d.cpPoly.length + ' piece(s)';
      return Number.isFinite(d.cp) ? ' · Cp ' + sci(d.cp, 2) : '';
    };
    const per = list.map(t => '<div>' + esc(t.formula) + ' ' + (t.nu < 0 ? L('reactant', 'chất tham gia') : L('product', 'sản phẩm')) +
      ' · ΔfH° ' + sci(t.data.hf, 2) + ' kJ·mol⁻¹ · S° ' + sci(t.data.s, 2) + ' J·mol⁻¹·K⁻¹ · ' + esc(phaseName(t.data.phase)) +
      (t.data.estimated ? ' · ' + L('estimated', 'ước lượng') : '') +
      cpLabel(t.data) + '</div>');
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
      return '<div class="urpe-g-note">' + L('Gibbs prediction: no standard data and no structure to estimate one from for ',
        'Dự đoán Gibbs: không có dữ liệu chuẩn và không có cấu trúc để ước lượng cho ') +
        r.unsupported.map(f => f.replace(/[<>&"]/g, '')).join(', ') + L(' — the numbers are left absent.', ' — các số liệu được để trống.') + '</div>';
    }
    const estimated = r.sources.filter(s => s.estimated).map(s => s.formula);
    let verdict = L('spontaneity unknown (missing data)', 'chưa rõ có tự diễn ra không (thiếu dữ liệu)');
    if (r.dG0 !== null) {
      verdict = r.dG0 < 0
        ? L('thermodynamically favourable at these conditions (says nothing about rate)', 'thuận lợi về nhiệt động ở điều kiện này (không nói gì về tốc độ)')
        : L('unfavourable at these conditions; the game condition supplies the driving energy', 'không thuận lợi ở điều kiện này; điều kiện trong game cung cấp năng lượng');
    }
    const K = r.lnK === null ? L('unknown', 'chưa rõ') : (Math.abs(r.lnK) > 700 ? 'e' + sup(r.lnK.toFixed(0)) : sci(r.K));
    const title = r.sources.map(s => s.formula + ': ' + s.data.source).join('\n');
    return '<div class="urpe-g" title="' + title.replace(/"/g, '&quot;') + '">' +
      '<b>' + L('Gibbs prediction at the environment setting', 'Dự đoán Gibbs theo điều kiện môi trường') +
      ' (' + T.toFixed(2) + ' K, ' + P.toFixed(P < 10 ? 3 : 1) + ' bar)</b><br>' +
      'ΔH° = ' + sci(r.dH, 2) + ' kJ·mol⁻¹ · ΔS° = ' + sci(r.dS, 2) + ' J·mol⁻¹·K⁻¹ · ΔG° = ' + sci(r.dG0, 2) + ' kJ·mol⁻¹ · K = ' + K +
      (estimated.length ? '<br><i>' + L('ΔfH°/S° estimated for ', 'ΔfH°/S° ước lượng cho ') +
        estimated.map(f => f.replace(/[<>&"]/g, '')).join(', ') + L(' from a rebuilt structure', ' từ cấu trúc dựng lại') + '</i>' : '') +
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

  // --- Theoretical standard-state estimator ---------------------------------
  // Measured rows cover only a few dozen species while the builder makes any
  // molecule, so the readout finishes the job with a calculation instead of a
  // refusal. Two textbook relations and no per-molecule fitting:
  //   ΔfH° = Σ n_E·ΔatH°(E) − Σ D(bond)      Hess cycle through gaseous atoms
  //   S°   = S_trans + S_rot + S_vib         ideal-gas statistical mechanics:
  //        Sackur–Tetrode, rigid rotor on the coordinates the scene actually drew,
  //        harmonic stretches whose force constants come from the same D(bond)
  // Biases left visible instead of tuned away: rotational symmetry σ = 1 (S° high
  // by R·ln σ), bending and torsion modes omitted (S° low), electronic/spin
  // entropy ignored, and average bond enthalpies are rough for ionic bonds.
  // Where an element has no atomisation datum, the whole species is referred to
  // its free gaseous atoms instead of its standard state, and the readout says so.
  const H_PLANCK = 6.62607015e-34, K_BOLTZ = 1.380649e-23, N_AV = 6.02214076e23, R_GAS = 8.31446261815324;
  const T_REF = 298.15, P_REF = 1e5;          // 1 bar
  const UNIT_M = 55e-12;                      // scene unit → m: bondLength() divides pm by 55
  const MORSE_A = 1.9e10;                     // m⁻¹, range parameter for the stretch estimate

  // Standard enthalpy of formation of one mole of GASEOUS atoms at 298.15 K
  // (kJ/mol) — the element's atomisation enthalpy. Anything absent here has no
  // entry in this list and drops the species onto the gaseous-atom reference.
  const ATOM_DH = {
    H: 218.0, He: 0, Li: 159.3, Be: 324.0, B: 565.0, C: 716.7, N: 472.7, O: 249.2,
    F: 79.4, Ne: 0, Na: 107.3, Mg: 148.0, Al: 330.0, Si: 450.0, P: 314.6, S: 277.2,
    Cl: 121.3, Ar: 0, K: 89.0, Ca: 178.0, Ti: 473.0, V: 524.7, Cr: 397.0, Mn: 280.3,
    Fe: 416.3, Co: 424.7, Ni: 429.7, Cu: 337.4, Zn: 147.1, Ga: 277.1, Ge: 376.6,
    As: 302.0, Se: 227.0, Br: 111.9, Kr: 0, Rb: 80.9, Sr: 164.5, Mo: 658.1, Zr: 624.3,
    Nb: 726.2, Ag: 284.9, Cd: 112.7, In: 243.7, Sn: 301.7, Sb: 254.9, Te: 193.8,
    I: 106.8, Xe: 0, Cs: 76.6, Hf: 654.0, Ta: 785.0, W: 849.3, Pt: 565.0, Au: 368.5,
    Hg: 61.4, Tl: 197.1, Pb: 195.6, Bi: 207.0
  };
  // Elements whose standard state at 298.15 K is not a solid; only needed to give
  // the gaseous-atom reference an entropy when measured data is missing.
  const GAS_ELEM = { H: 1, N: 1, O: 1, F: 1, Cl: 1, He: 1, Ne: 1, Ar: 1, Kr: 1, Xe: 1, Rn: 1, Og: 1 };
  const LIQUID_ELEM = { Br: 1, Hg: 1 };

  function transEntropy(massG, T, P) {
    const m = massG * 1e-3 / N_AV;
    const q = Math.pow(2 * Math.PI * m * K_BOLTZ * T / (H_PLANCK * H_PLANCK), 1.5) * (K_BOLTZ * T / P);
    return R_GAS * (2.5 + Math.log(q));
  }
  // Eigenvalues of a real symmetric 3×3 (Numerical Recipes trigonometric form).
  function eigSym3(a) {
    const p1 = a[0][1] * a[0][1] + a[0][2] * a[0][2] + a[1][2] * a[1][2];
    const q = (a[0][0] + a[1][1] + a[2][2]) / 3;
    if (!(p1 > 0)) return [a[0][0], a[1][1], a[2][2]].sort((x, y) => x - y);
    const p2 = Math.pow(a[0][0] - q, 2) + Math.pow(a[1][1] - q, 2) + Math.pow(a[2][2] - q, 2) + 2 * p1;
    const b = Math.sqrt(p2 / 6);
    const m = [[(a[0][0] - q) / b, a[0][1] / b, a[0][2] / b],
      [a[0][1] / b, (a[1][1] - q) / b, a[1][2] / b],
      [a[0][2] / b, a[1][2] / b, (a[2][2] - q) / b]];
    const det = m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
      m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
      m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
    const phi = Math.acos(Math.max(-1, Math.min(1, det / 2))) / 3;
    const e1 = q + 2 * b * Math.cos(phi);
    const e3 = q + 2 * b * Math.cos(phi + 2 * Math.PI / 3);
    return [e1, 3 * q - e1 - e3, e3].sort((x, y) => x - y);
  }

  // Absolute S° of the species as an ideal gas, from geometry and bonds only.
  function absoluteEntropy(list, bonds, bde) {
    const mass = list.map(a => (a.el && a.el.mass) || 0);
    const kg = mass.map(g => g * 1e-3 / N_AV);
    const xyz = list.map(a => [(a.pos && a.pos.x || 0) * UNIT_M, (a.pos && a.pos.y || 0) * UNIT_M, (a.pos && a.pos.z || 0) * UNIT_M]);
    let mtot = 0; const com = [0, 0, 0];
    kg.forEach((m, i) => { mtot += m; for (let c = 0; c < 3; c++) com[c] += m * xyz[i][c]; });
    if (!(mtot > 0)) return null;
    for (let c = 0; c < 3; c++) com[c] /= mtot;
    const I = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    kg.forEach((m, i) => {
      const x = xyz[i][0] - com[0], y = xyz[i][1] - com[1], z = xyz[i][2] - com[2];
      I[0][0] += m * (y * y + z * z); I[1][1] += m * (x * x + z * z); I[2][2] += m * (x * x + y * y);
      I[0][1] -= m * x * y; I[1][0] = I[0][1];
      I[0][2] -= m * x * z; I[2][0] = I[0][2];
      I[1][2] -= m * y * z; I[2][1] = I[1][2];
    });
    const eigs = eigSym3(I);
    const St = transEntropy(mass.reduce((s, g) => s + g, 0), T_REF, P_REF);
    let Sr = 0;
    if (list.length > 1) {
      const Br = 8 * Math.PI * Math.PI * K_BOLTZ * T_REF / (H_PLANCK * H_PLANCK);
      // σ = 1: no point-group detection, so S° is high by R·ln σ (≤ 20 J/mol·K).
      if (eigs[0] < 1e-47) Sr = R_GAS * (Math.log(Br * Math.max(eigs[1], eigs[2])) + 1);
      else Sr = R_GAS * (Math.log(Math.sqrt(Math.PI) * Math.pow(Br, 1.5) * Math.sqrt(eigs[0] * eigs[1] * eigs[2])) + 1.5);
    }
    let Sv = 0;
    for (const bd of bonds || []) {
      const D = bde(bd);
      const ia = list.findIndex(x => x.id === bd.a), ib = list.findIndex(x => x.id === bd.b);
      if (!(D > 0) || ia < 0 || ib < 0 || !(mass[ia] > 0) || !(mass[ib] > 0)) continue;
      const mu = mass[ia] * mass[ib] / (mass[ia] + mass[ib]) * 1e-3 / N_AV;
      const k = 2 * (D * 1e3 / N_AV) * MORSE_A * MORSE_A;         // Morse curvature, N/m
      const nu = Math.sqrt(k / mu) / (2 * Math.PI);               // Hz
      const x = H_PLANCK * nu / (K_BOLTZ * T_REF);
      if (x > 0 && x < 500) Sv += R_GAS * (x / (Math.exp(x) - 1) - Math.log(1 - Math.exp(-x)));
    }
    return { S: St + Sr + Sv, St, Sr, Sv, massTotal: mass.reduce((s, g) => s + g, 0) };
  }

  // --- Universal bonding corrections ---------------------------------------
  // The bare cycle sums tabulated AVERAGE bond enthalpies: numbers measured on
  // unstrained, closed-shell molecules whose lone pairs are held apart by carbon.
  // Put the same bond into a three-membered ring, into a row of lone-pair-bearing
  // atoms, or into an electron count that forces a formal charge, and the species
  // is destabilised by an amount the table cannot see, so the cycle reads too
  // stable. The correction layer derives that amount from two things the app
  // already has for every species - how the atoms are joined (a full Lewis
  // bookkeeping of the scene's bond orders) and where they are (the coordinates)
  // - and never from a per-molecule exception:
  //   fc      formal charge on an atom electronegativity does not want, diluted
  //           over the atoms a resonance system can spread it onto
  //   zw      Coulomb cost of a + and a − that no resonance path connects
  //   chain   lone-pair crowding that grows with the length of a σ-bonded
  //           heteroatom row. An isolated X-Y link costs nothing on purpose: the
  //           table's X-Y enthalpy is itself measured on that motif (peroxide),
  //           and charging it again was worth −1 kJ/mol of error on H2O2.
  //   octet   incomplete octet at a period-2 centre (carbenes, Lewis acids) and
  //           unpaired electrons, which are not the same thing as a bond
  //   strain  every bond angle bent away from the VSEPR ideal of its own steric
  //           number, measured on the real coordinates, plus the eclipsing of a
  //           four-membered ring (a three-membered ring needs no extra term: its
  //           60° angles already cost 115 kJ/mol through this same expression)
  //   res     Hückel aromatic stabilisation. The rules above only EXEMPT charges
  //           that resonance can move; the stabilisation itself has to be paid
  //           back too, or benzene stays +161 kJ/mol high.
  // Constants are order-of-magnitude physical scales (k_Boltz·T is 2.5 kJ/mol,
  // e²/4πε0 is 1389 kJ·mol⁻¹·Å, a C-C-C bend constant is ~0.5 mdyn·Å/rad²), not
  // per-species fits. Everything they miss is named in the caveat line.
  const FC_BASE = 14, FC_EN_GAIN = 13;   // kJ/mol per unit formal charge, per EN unit
  const ZW_K = 1389, ZW_Q = 0.25;        // e²/4πε0 in kJ·mol⁻¹·Å, effective charge per unit FC
  const LP_CHAIN = 12;                   // kJ/mol, escalating per link of a heteroatom row
  const OCTET_KJ = 32, RADICAL_KJ = 24;  // kJ/mol per missing electron, per unpaired electron
  const BEND_K = 102.8, RING4_KJ = 20;   // kJ/mol/rad², kJ/mol per eclipsed ring atom
  const AROMATIC_KJ = 25.1;              // kJ/mol per ring atom (benzene 150.6/6)
  const IDEAL_ANGLE = { 2: [180], 3: [120], 4: [109.47], 5: [90, 120, 180], 6: [90, 180] };
  // Pauling electronegativities, used when the element record does not carry one.
  const PAULING_EN = {
    H: 2.20, Li: 0.98, Be: 1.57, B: 2.04, C: 2.55, N: 3.04, O: 3.44, F: 3.98,
    Na: 0.93, Mg: 1.31, Al: 1.61, Si: 1.90, P: 2.19, S: 2.58, Cl: 3.16, Ar: 0,
    K: 0.82, Ca: 1.00, Ti: 1.54, Cr: 1.66, Mn: 1.55, Fe: 1.83, Co: 1.88, Ni: 1.91,
    Cu: 1.90, Zn: 1.65, Ga: 1.81, Ge: 2.01, As: 2.18, Se: 2.55, Br: 2.96, Kr: 0,
    Rb: 0.82, Sr: 0.95, Mo: 2.16, Ag: 1.93, Cd: 1.69, In: 1.78, Sn: 1.96, Sb: 2.05,
    Te: 2.10, I: 2.66, Cs: 0.79, Ba: 0.89, W: 2.36, Pt: 2.28, Au: 2.54, Hg: 2.00,
    Tl: 1.62, Pb: 2.33, Bi: 2.02
  };

  // Electrons outside the last noble-gas core, the period and whether the
  // differentiating electron is a d/f one: the Lewis rules below describe
  // two-electron shared pairs, so metals are identified and left alone.
  const AUFBAU = [[1, 0, 2], [2, 0, 2], [2, 1, 6], [3, 0, 2], [3, 1, 6], [4, 0, 2],
    [3, 2, 10], [4, 1, 6], [5, 0, 2], [4, 2, 10], [5, 1, 6], [6, 0, 2], [4, 3, 14],
    [5, 2, 10], [6, 1, 6], [7, 0, 2], [5, 3, 14], [6, 2, 10], [7, 1, 6]];
  function shellFrame(z) {
    let left = z, diff = 0, per = 1;
    const occ = Object.create(null);
    for (const s of AUFBAU) {
      const e = Math.min(s[2], left);
      if (e <= 0) break;
      occ[s[0] + '/' + s[1]] = e;
      diff = s[1];
      if (s[1] <= 1) per = Math.max(per, s[0]);
      left -= e;
    }
    const v = (occ[per + '/0'] || 0) + (occ[per + '/1'] || 0);
    const noP = !(occ[per + '/1'] > 0);
    return { v: v || (per === 1 ? 2 : 0), period: per, metal: per > 1 && (diff >= 2 || (noP && v <= 2)) };
  }

  // One node of the bonding graph: element data plus how the scene bonds it.
  function bondingGraph(list, bonds) {
    const idx = new Map(), nodes = [];
    for (let i = 0; i < list.length; i++) {
      const a = list[i], el = a.el || {};
      const z = el.z || 0, frame = shellFrame(z);
      nodes.push({
        id: a.id, sym: el.sym || '?', z,
        V: typeof el.valenceElectrons === 'number' && el.valenceElectrons > 0 ? el.valenceElectrons : frame.v,
        chi: typeof el.en === 'number' && el.en > 0 ? el.en : (PAULING_EN[el.sym] || 2.55),
        period: frame.period, metal: frame.metal || el.cat === 'transition' || el.cat === 'lanthanide' || el.cat === 'actinide',
        pos: [(a.pos && a.pos.x || 0) * UNIT_M * 1e10, (a.pos && a.pos.y || 0) * UNIT_M * 1e10, (a.pos && a.pos.z || 0) * UNIT_M * 1e10],
        B: 0, nbrs: [], links: []
      });
      idx.set(a.id, i);
    }
    for (const b of bonds || []) {
      const i = idx.get(b.a), j = idx.get(b.b);
      if (i === undefined || j === undefined || i === j) continue;
      const order = b.order || 1;
      nodes[i].B += order; nodes[j].B += order;
      nodes[i].nbrs.push(j); nodes[j].nbrs.push(i);
      nodes[i].links.push(order); nodes[j].links.push(order);
    }
    // The aufbau read only counts an s/p valence, but a transition metal also
    // brings d electrons to its bonds. Reading TiCl4 as a two-electron centre
    // would leave four shared pairs unpayable and dump the difference on the
    // chlorines as formal charges that do not exist, so a metal is given at least
    // the electrons its own bonding spends. It stays exempt from the rules.
    for (const nd of nodes) if (nd.metal && nd.V < nd.B) nd.V = nd.B;
    return { nodes, idx };
  }

  // Lewis bookkeeping: every shared pair belongs half to each partner, the rest
  // of an atom's valence electrons sit as lone pairs and unpaired electrons.
  // Setting lone_i = V_i − B_i makes every formal charge zero at once, and the
  // electron budget allows it exactly as long as no atom is pushed out of its
  // shell; when it is not allowed, the leftover electrons are distributed to
  // make the formal charges as small and as well-sited as they can be.
  function lewisBook(g, charge) {
    const nodes = g.nodes, n = nodes.length;
    let sumOrder = 0;
    for (const nd of nodes) sumOrder += nd.B;
    sumOrder /= 2;
    const budget = nodes.reduce((s, nd) => s + nd.V, 0) - (charge || 0) - 2 * sumOrder;
    // How many electrons an atom's valence shell can hold: the octet for a
    // main-group atom, twelve for a third-period one that can expand it, and the
    // d-inclusive eighteen of a metal, whose electron count the rules below do
    // not try to read.
    const limitOf = nd => nd.metal ? 18 : (nd.period <= 2 ? 8 : 12);
    const capOf = i => Math.max(0, limitOf(nodes[i]) - 2 * nodes[i].B);
    let lone = nodes.map((nd, i) => nd.V - nd.B);
    const naiveOk = budget >= 0 && lone.every((x, i) => x % 2 === 0 && x >= 0 &&
      x + 2 * nodes[i].B <= limitOf(nodes[i]));
    if (!naiveOk) lone = spreadLone(nodes, capOf, Math.max(0, budget));
    return nodes.map((nd, i) => {
      const shell = 2 * nd.B + lone[i];
      const target = nd.period <= 1 ? 2 : 8;
      return {
        lone: lone[i], fc: nd.V - lone[i] - nd.B,
        unpaired: lone[i] % 2 ? 1 : 0, lp: Math.floor(lone[i] / 2),
        short: nd.metal ? 0 : Math.max(0, Math.min(target, 8) - shell),
        pi: nd.links.some(o => o > 1), hasLP: lone[i] >= 2
      };
    });
  }
  // The DP over "how many non-bonding electrons does each atom keep". Cost is
  // the formal charge, nudged so that a + prefers the electropositive end and a
  // − the electronegative one, plus the penalties for leaving a shell short or
  // an electron alone.
  function spreadLone(nodes, capOf, budget) {
    const n = nodes.length, W = 41;
    const costOf = (i, x) => {
      const nd = nodes[i];
      // A metal is an electron sponge: whatever the covalent bookkeeping cannot
      // place is absorbed by the d shell rather than charged onto a nonmetal,
      // because the rules below never price a metal anyway.
      if (nd.metal) return 0;
      const fc = nd.V - x - nd.B;
      const shell = 2 * nd.B + x;
      let c = Math.abs(fc) + 0.3 * fc * (nd.chi - 2.55) + (x % 2 ? 0.6 : 0);
      if (shell < (nd.period <= 1 ? 2 : 8)) c += 0.9 * ((nd.period <= 1 ? 2 : 8) - shell) / 2;
      if (shell > 8 && nd.period <= 2) c += 40;
      if (shell > 8 && nd.period > 2) c += 0.15 * (shell - 8);
      return c;
    };
    const caps = nodes.map((nd, i) => Math.min(capOf(i), budget));
    const totalCap = caps.reduce((s, c) => s + c, 0);
    const want = Math.min(budget, totalCap);
    const INF = 1e18;
    let row = new Array(want + 1).fill(INF);
    row[0] = 0;
    const trace = [];
    for (let i = 0; i < n; i++) {
      const next = new Array(want + 1).fill(INF), pick = new Array(want + 1).fill(0);
      for (let used = 0; used <= want; used++) {
        if (!(row[used] < INF)) continue;
        for (let x = 0; x <= caps[i] && used + x <= want; x++) {
          const c = row[used] + costOf(i, x);
          if (c < next[used + x]) { next[used + x] = c; pick[used + x] = x; }
        }
      }
      row = next; trace.push(pick);
    }
    const out = new Array(n).fill(0);
    let used = want;
    for (let i = n - 1; i >= 0; i--) { out[i] = trace[i][used] || 0; used -= out[i]; }
    return out;
  }

  // Which bonds can move a charge along. A link transmits π delocalisation when
  // both partners have a p orbital to spare and at least one of them actually
  // holds a π bond, so a plain -O-O- peroxide step is never mistaken for a
  // resonance system while an allyl-type 3-atom 4-electron one is.
  function piSystems(g, lw) {
    const pOrb = (i) => lw[i].pi || lw[i].hasLP || lw[i].fc !== 0 || lw[i].unpaired === 1;
    const transmits = (i, j, order) => !g.nodes[i].metal && !g.nodes[j].metal &&
      (order > 1 || (pOrb(i) && pOrb(j) && (g.nodes[i].B > 0 && (lw[i].pi || lw[j].pi))));
    const comp = g.nodes.map(() => -1);
    let c = 0;
    for (let s = 0; s < g.nodes.length; s++) {
      if (comp[s] >= 0) continue;
      comp[s] = c;
      const stack = [s];
      while (stack.length) {
        const i = stack.pop();
        for (const j of g.nodes[i].nbrs) {
          const order = g.nodes[i].links[g.nodes[i].nbrs.indexOf(j)] || 1;
          if (comp[j] < 0 && pOrb(j) && (pOrb(i) || lw[i].pi) && transmits(i, j, order)) { comp[j] = c; stack.push(j); }
        }
      }
      c++;
    }
    return { comp, compCount: c, transmits };
  }
  // The atoms a formal charge can be spread over: same element, same sign or
  // neutral-with-a-π-bond, inside one π system. Ozone's −1 has two carriers
  // because either terminal oxygen can hold it.
  function carriers(g, lw, sys, i) {
    let m = 1;
    for (let j = 0; j < g.nodes.length; j++) {
      if (j === i || sys.comp[j] !== sys.comp[i] || g.nodes[j].sym !== g.nodes[i].sym) continue;
      if (lw[j].fc * lw[i].fc < 0) continue;
      if ((lw[j].fc === lw[i].fc && lw[j].fc !== 0) || (lw[j].fc === 0 && lw[j].pi)) m++;
    }
    return m;
  }

  // Every simple cycle up to eight atoms, each reported once (only atoms with an
  // index above the start are walked through).
  function cyclesOf(g, maxLen) {
    const nodes = g.nodes, seen = new Set(), out = [];
    for (let s = 0; s < nodes.length && out.length < 64; s++) {
      const stack = [[s, [s]]];
      while (stack.length) {
        const [i, path] = stack.pop();
        for (const j of nodes[i].nbrs) {
          if (j === s && path.length >= 3 && path.length <= maxLen) {
            const key = path.slice().sort((a, b) => a - b).join('.');
            if (!seen.has(key)) { seen.add(key); out.push(path.slice()); }
          } else if (j > s && path.indexOf(j) < 0 && path.length < maxLen) {
            stack.push([j, path.concat([j])]);
          }
        }
        if (stack.length > 4096) break;
      }
    }
    return out;
  }

  // The five destabilising terms plus the aromatic one, in kJ/mol.
  function bondingCorrections(g, lw, sys) {
    const out = { fc: 0, zw: 0, chain: 0, octet: 0, radical: 0, strain: 0, res: 0, terms: [] };
    const nodes = g.nodes, n = nodes.length;
    // 1a - formal charge on an atom that does not want it.
    for (let i = 0; i < n; i++) {
      const nd = nodes[i], q = lw[i].fc;
      if (nd.metal || !q) continue;
      const enPenalty = q > 0 ? Math.max(0, nd.chi - 2.55) : Math.max(0, 2.55 - nd.chi);
      const e = Math.abs(q) * (FC_BASE + FC_EN_GAIN * enPenalty) / carriers(g, lw, sys, i);
      out.fc += e;
    }
    // 1b - charge separated with no resonance path between the two centres.
    const pos = [], neg = [];
    for (let i = 0; i < n; i++) {
      if (nodes[i].metal) continue;
      if (lw[i].fc > 0) pos.push({ i, left: lw[i].fc });
      else if (lw[i].fc < 0) neg.push({ i, left: -lw[i].fc });
    }
    for (const p of pos) for (const q of neg) {
      const take = Math.min(p.left, q.left);
      if (take <= 0 || sys.comp[p.i] === sys.comp[q.i]) continue;
      p.left -= take; q.left -= take;
      const r = Math.max(1.2, Math.hypot(nodes[p.i].pos[0] - nodes[q.i].pos[0],
        nodes[p.i].pos[1] - nodes[q.i].pos[1], nodes[p.i].pos[2] - nodes[q.i].pos[2]));
      out.zw += ZW_K * ZW_Q * ZW_Q * take * take / r;
    }
    // 2 - rows of lone-pair-bearing atoms joined by σ bonds. A hub is not a row:
    // an atom that carries three or more lone-pair neighbours (PCl3's phosphorus)
    // is a branch point whose crowding the average BDE already measures, so only a
    // genuinely linear run of atoms is charged.
    const lpAtom = nodes.map((nd, i) => !nd.metal && nd.B > 0 && lw[i].hasLP);
    const rowSeen = new Set(), stack = [];
    for (let s = 0; s < n; s++) {
      if (!lpAtom[s] || rowSeen.has(s)) continue;
      const row = [];
      rowSeen.add(s); stack.push(s);
      let singles = 0, hub = false;
      while (stack.length) {
        const i = stack.pop();
        row.push(i);
        let touch = 0;
        for (let k = 0; k < nodes[i].nbrs.length; k++) {
          const j = nodes[i].nbrs[k], order = nodes[i].links[k];
          if (!lpAtom[j]) continue;
          touch++;
          if (order === 1) singles++;
          if (rowSeen.has(j)) continue;
          rowSeen.add(j); stack.push(j);
        }
        if (touch > 2) hub = true;
      }
      const L = row.length;
      if (L >= 3 && singles >= 1 && !hub) out.chain += LP_CHAIN * (L - 2) * (L - 1) / 2;
    }
    // 3 - open shells.
    for (let i = 0; i < n; i++) {
      const nd = nodes[i];
      if (nd.metal) continue;
      if (lw[i].short >= 2 && nd.period <= 2) out.octet += OCTET_KJ * lw[i].short;
      if (lw[i].unpaired) out.radical += RADICAL_KJ * (lw[i].pi ? 0.5 : 1);
    }
    // 4 - geometry. Every angle is measured against the ideal for the atom's own
    // steric number; heavier atoms may also sit at 90° (H2S, PH3 do).
    for (let i = 0; i < n; i++) {
      const nd = nodes[i];
      if (nd.metal || nd.nbrs.length < 2 || nd.nbrs.length > 6) continue;
      const sn = nd.nbrs.length + lw[i].lp;
      const ideals = (IDEAL_ANGLE[sn] || [109.47]).concat(nd.period >= 3 ? [90] : []);
      for (let x = 0; x < nd.nbrs.length; x++) for (let y = x + 1; y < nd.nbrs.length; y++) {
        const a = angleAt(nd.pos, nodes[nd.nbrs[x]].pos, nodes[nd.nbrs[y]].pos);
        if (a === null) continue;
        let dev = Infinity;
        for (const ideal of ideals) dev = Math.min(dev, Math.abs(a - ideal));
        if (dev > 90) dev = 180 - dev;
        out.strain += 0.5 * BEND_K * Math.pow(dev * Math.PI / 180, 2);
      }
    }
    const rings = cyclesOf(g, 8);
    for (const ring of rings) {
      if (ring.length === 4 && ring.every(i => !nodes[i].metal)) out.strain += RING4_KJ * ring.length;
      // aromatic term: a planar, fully conjugated ring of 4n+2 π electrons
      if (ring.length < 5 || ring.some(i => nodes[i].metal)) continue;
      let closed = true, pi = 0;
      for (let k = 0; k < ring.length && closed; k++) {
        const i = ring[k], j = ring[(k + 1) % ring.length];
        if (!sys.transmits(i, j, linkOrder(nodes, i, j)) || !sys.transmits(j, i, linkOrder(nodes, j, i))) closed = false;
      }
      if (!closed || !ringPlanar(ring.map(i => nodes[i].pos))) continue;
      // What each ring atom hands to the delocalised system: one electron when it
      // shares a π bond inside the ring (the pair is split half and half between
      // the partners), one for an unpaired electron, and two for a lone pair on an
      // atom that has no π bond of its own - pyrrole's nitrogen, cyclopentadienyl's
      // carbanion. A pyridine nitrogen already counts its π half, so its in-plane
      // lone pair is correctly left out.
      for (const i of ring) {
        const inRingPi = nodes[i].nbrs.some((j, k) => ring.indexOf(j) >= 0 && nodes[i].links[k] > 1);
        pi += inRingPi ? 1 : (lw[i].unpaired ? 1 : (lw[i].hasLP && lw[i].fc <= 0 ? 2 : 0));
      }
      if (pi % 4 !== 2 || pi < 6) continue;
      out.res -= AROMATIC_KJ * ring.length;
    }
    out.total = out.fc + out.zw + out.chain + out.octet + out.radical + out.strain + out.res;
    return out;
  }
  function linkOrder(nodes, i, j) {
    const k = nodes[i].nbrs.indexOf(j);
    return k < 0 ? 0 : (nodes[i].links[k] || 1);
  }
  function angleAt(c, a, b) {    const u = [a[0] - c[0], a[1] - c[1], a[2] - c[2]], v = [b[0] - c[0], b[1] - c[1], b[2] - c[2]];
    const nu = Math.hypot(u[0], u[1], u[2]), nv = Math.hypot(v[0], v[1], v[2]);
    if (!(nu > 0.1) || !(nv > 0.1)) return null;
    const cos = Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (nu * nv)));
    return Math.acos(cos) * 180 / Math.PI;
  }
  // Largest distance of the ring atoms from the best plane through them.
  function ringPlanar(pts) {
    const c = [0, 1, 2].map(k => pts.reduce((s, p) => s + p[k], 0) / pts.length);
    const cov = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (const p of pts) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) cov[a][b] += (p[a] - c[a]) * (p[b] - c[b]);
    const eigs = eigSym3(cov);
    // Take the direction of the smallest spread as the plane normal.
    let best = null, bestVal = Infinity;
    for (let k = 0; k < 3; k++) {
      const d = Math.hypot(cov[0][0] - eigs[k], cov[1][1] - eigs[k], cov[2][2] - eigs[k]);
      if (d > 0 && d < bestVal) { bestVal = d; best = [cov[0][0] - eigs[k], cov[1][1] - eigs[k], cov[2][2] - eigs[k]]; }
    }
    if (!best) return true;
    const nb = Math.hypot(best[0], best[1], best[2]) || 1;
    let mx = 0;
    for (const p of pts) mx = Math.max(mx, Math.abs(((p[0] - c[0]) * best[0] + (p[1] - c[1]) * best[1] + (p[2] - c[2]) * best[2]) / nb));
    return mx < 0.35;
  }

  // --- A bond enthalpy for pairs the engine's table does not carry ----------
  // The engine prices a bond from a couple of dozen tabulated pairs and answers a
  // flat 350 kJ/mol for anything else. As a force-field default that is harmless;
  // inside the atomisation cycle it is a hole large enough to drown in, because a
  // triple bond between two atoms the table has never met (C#O, 1076 kJ/mol) reads
  // as 726 kJ/mol of extra stability, and the N-N single bond of hydrazine (160)
  // reads as 190 kJ/mol of unstability. So the estimator asks the table whether
  // the pair is there at all, and when it is not it interpolates from the table's
  // own entries by two rules that are chemistry rather than a fit:
  //   a σ bond is priced by Pauling's relation: the arithmetic mean of the two
  //   homonuclear bond enthalpies plus an ionic-resonance term proportional to
  //   (Δχ)², which is the extra stability a polar bond has over the average of
  //   its two nonpolar ones. The homonuclear reference for an element is taken
  //   from the table when it is there (H-H 436, C-C 348, O-O 146, Cl-Cl 240) and
  //   otherwise, for an element that keeps a lone pair, from the table's
  //   lone-pair-to-lone-pair bonds of its own period, since those are the bonds
  //   that element would form with itself (N reads 167 this way, and N-N really
  //   is ~160; S reads 240 against a true 266, which is the diffuse-lone-pair
  //   softness of the third period and the reason the same-period rows matter).
  //   An element with neither read - silicon, boron - is left at the engine's
  //   default rather than guessed at, and the caveat line says so.
  //   a missing multiple bond is priced at the mean enthalpy of the table's bonds
  //   that share one of its elements and have the same bond order, since bond
  //   order is the strongest single predictor of a bond enthalpy.
  // These are interpolations, not measurements. The engine's own force field is
  // left exactly as it ships; only this thermodynamic reading changes.
  const BOND_CHAR = { 1: '-', 2: '=', 3: '≡' };
  const PAULING_IONIC = 96.5;            // kJ/mol per unit of (Δχ)²
  const avg = vals => vals.reduce((s, v) => s + v, 0) / vals.length;
  function elementOfSymbol(sym) {
    try { return (root.__mol3d || {}).auto ? root.__mol3d.auto.elementBySymbol(sym) : null; } catch (e) { return null; }
  }
  // An element whose atoms normally hold a lone pair: a nonmetal with five or more
  // valence electrons - nitrogen, oxygen, the halogens, sulfur, phosphorus - and
  // not carbon, not hydrogen, not a metal.
  function lonePairSym(sym) {
    const el = elementOfSymbol(sym);
    if (!el || !el.z) return false;
    const f = shellFrame(el.z);
    return !f.metal && f.v >= 5;
  }
  function enOf(sym) {
    const el = elementOfSymbol(sym);
    const e = el && typeof el.en === 'number' && el.en > 0 ? el.en : PAULING_EN[sym];
    return typeof e === 'number' && e > 0 ? e : null;
  }
  function bondEnthalpyOf(th, atomMap, lonePairIds) {
    let table = null;
    try { table = (root.__mol3d || {}).auto ? root.__mol3d.auto.bondEnergies() : null; } catch (e) { table = null; }
    const known = Object.create(null), byElement = Object.create(null), mean = Object.create(null);
    const homo = Object.create(null), lpRow = [], lpPeriod = Object.create(null);
    for (const ord of Object.keys(table || {})) {
      const o = Number(ord), row = (table || {})[ord] || {}, vals = [];
      for (const key of Object.keys(row)) {
        const v = row[key];
        if (!(typeof v === 'number' && v > 0)) continue;
        vals.push(v);
        known[o + '|' + key] = true;
        const parts = key.split(/[-=≡]/).filter(Boolean);
        for (const sym of parts) (byElement[o + '|' + sym] = byElement[o + '|' + sym] || []).push(v);
        if (o === 1 && parts.length === 2 && parts[0] === parts[1]) homo[parts[0]] = v;
        if (o !== 1 || parts.length !== 2 || !lonePairSym(parts[0]) || !lonePairSym(parts[1])) continue;
        lpRow.push(v);
        const a = elementOfSymbol(parts[0]), b = elementOfSymbol(parts[1]);
        const pa = shellFrame(a.z).period, pb = shellFrame(b.z).period;
        if (pa === pb) (lpPeriod[pa] = lpPeriod[pa] || []).push(v);
      }
      if (vals.length) mean[o] = avg(vals);
    }
    // The homonuclear anchor of an element, or null when the table says nothing
    // about how that element bonds to itself.
    const periodOf = sym => { const el = elementOfSymbol(sym); return el && el.z ? shellFrame(el.z).period : 0; };
    function refSingle(sym) {
      if (typeof homo[sym] === 'number') return homo[sym];
      if (!lonePairSym(sym)) return null;
      const own = lpPeriod[periodOf(sym)];
      if (own && own.length) return avg(own);
      return lpRow.length ? avg(lpRow) : null;
    }
    return function (bond) {
      const D = th && th.getBondDissociationEnergy ? th.getBondDissociationEnergy(bond, atomMap) : 0;
      if (!table) return D;
      const A = atomMap.get(bond.a), B = atomMap.get(bond.b);
      const sA = A && A.el && A.el.sym, sB = B && B.el && B.el.sym;
      if (!sA || !sB) return D;
      const o = Math.round(bond.order || 1), pair = [sA, sB].sort();
      if (known[o + '|' + pair[0] + (BOND_CHAR[o] || '-') + pair[1]]) return D;
      if (o === 1) {
        const ra = refSingle(sA), rb = refSingle(sB);
        if (ra !== null && rb !== null) {
          const ca = enOf(sA), cb = enOf(sB);
          return 0.5 * (ra + rb) + (ca === null || cb === null ? 0 : PAULING_IONIC * (ca - cb) * (ca - cb));
        }
        // No honest anchor for one of the two (silicon, boron: the table never
        // bonds them to themselves), and averaging the table's X-H rows instead
        // would read a Si-H bond as a C-H one. The engine's default stands.
        return D;
      }
      const shared = (byElement[o + '|' + pair[0]] || []).concat(byElement[o + '|' + pair[1]] || []);
      if (shared.length) return avg(shared);
      return typeof mean[o] === 'number' ? mean[o] : D;
    };
  }

  // The estimate itself: ΔfH° from the atomisation cycle plus the bonding
  // corrections above, ΔfS° from the entropy against the element reference
  // entropies, ΔfG° from the two (so every corrected number propagates).
  function theoreticalState(list, bonds, th, opts) {
    if (!list || list.length < 2) return null;
    const atomMap = atomMapOf(list);
    // The Lewis bookkeeping runs first so that a structure it cannot read is
    // reported as such even when the bond sum still works.
    let corr = { fc: 0, zw: 0, chain: 0, octet: 0, radical: 0, strain: 0, res: 0, total: 0, skipped: true };
    try {
      const g = bondingGraph(list, bonds);
      const charge = opts && typeof opts.charge === 'number' ? opts.charge : 0;
      const lw = lewisBook(g, charge);
      corr = bondingCorrections(g, lw, piSystems(g, lw));
      corr.skipped = false;
    } catch (e) { /* a structure the bookkeeping cannot read stays a plain bond sum */ }
    const bde = bondEnthalpyOf(th, atomMap);
    const ent = absoluteEntropy(list, bonds, bde);
    if (!ent) return null;
    const counts = Object.create(null);
    for (const a of list) { const s = a.el && a.el.sym; if (s) counts[s] = (counts[s] || 0) + 1; }
    const syms = Object.keys(counts);
    const refS = th && th.refS;
    const missing = syms.filter(s => ATOM_DH[s] === undefined || !(refS && typeof refS.get === 'function' && refS.get(s) !== undefined));
    const elementRef = missing.length === 0;
    let dh = 0, sRef = 0, bondSum = 0;
    for (const s of syms) {
      if (elementRef) { dh += counts[s] * ATOM_DH[s]; sRef += counts[s] * refS.get(s); continue; }
      const el = list.find(a => a.el && a.el.sym === s).el;
      // Gaseous-atom reference: the free atom's enthalpy is the zero, and its
      // entropy is the Sackur–Tetrode value (less a condensed-phase allowance
      // for the elements we still know are solids or liquids at 298 K).
      sRef += counts[s] * (transEntropy(el.mass, T_REF, P_REF) - (GAS_ELEM[s] ? 0 : LIQUID_ELEM[s] ? 90 : 115));
    }
    for (const bd of bonds || []) { const D = bde(bd); if (typeof D === 'number' && D > 0) bondSum += D; }
    const dfH = dh - bondSum + corr.total;
    const dfS = ent.S - sRef;
    return { dfH, dfS, dfG: dfH - T_REF * dfS / 1000, sAbs: ent.S, elementRef, missing, corr, parts: { St: ent.St, Sr: ent.Sr, Sv: ent.Sv } };
  }
  function atomMapOf(list) {
    const map = new Map();
    for (const a of list) if (a && a.id !== undefined) map.set(a.id, a);
    return map;
  }

  // --- Standard-state row for a species nobody measured ---------------------
  // A reaction product is usually not in the scene, so the estimator cannot be
  // handed coordinates the way the Info tab can. It does not need to: the builder's
  // own template table and the isomer enumerator both say how the atoms of a
  // formula are joined, and the physics engine turns those joins into coordinates
  // on request. Rebuilding the molecule that way, outside the scene, gives the same
  // three numbers the Info tab prints for it, and nothing in the world is touched.
  // A constitution for a formula nobody authored. The template table and the
  // isomer enumerator both answer "no structure" for anything outside the
  // built-in rule sets - a mixed oxide, a borohydride, an unusual arrangement the
  // player built by hand - and the estimator then has nothing to read, so the
  // panel leaves the numbers blank. This last resort wires the formula up from
  // the covalences alone: every hydrogen and halogen caps the most unsaturated
  // atom it can reach, the remaining heavy atoms link to each other in a chain,
  // and two bonded atoms still short of their covalence are joined by a higher
  // bond order. That gives one reasonable structure, not the reasonable one, and
  // the readout already says the numbers are estimated.
  function countsOf(formula) {
    const raw = String(formula).replace(/\((?:s|l|g|aq)\)$/, '').replace(/\s+/g, '');
    const body = raw.replace(/[+-]\d*$/, '');
    const counts = Object.create(null), re = /([A-Z][a-z]?)(\d*)|\(([^)]*)\)(\d*)/g;
    let m;
    while ((m = re.exec(body))) {
      if (m[3] !== undefined) {
        const mult = +m[4] || 1, re2 = /([A-Z][a-z]?)(\d*)/g;
        let inner;
        while ((inner = re2.exec(m[3]))) counts[inner[1]] = (counts[inner[1]] || 0) + (+inner[2] || 1) * mult;
      } else counts[m[1]] = (counts[m[1]] || 0) + (+m[2] || 1);
    }
    return counts;
  }
  const TERMINAL = { H: 1, F: 1, Cl: 1, Br: 1, I: 1 };
  function genericTemplate(formula) {
    const auto = (root.__mol3d || {}).auto || {};
    if (!auto.elementBySymbol) return null;
    const counts = countsOf(formula), keys = Object.keys(counts);
    if (!keys.length) return null;
    const tail = String(formula).match(/[+-]\d*$/);
    const charge = tail ? (tail[0][0] === '-' ? -1 : 1) * (+tail[0].slice(1) || 1) : 0;
    const syms = [];
    for (const sym of keys) {
      const el = auto.elementBySymbol(sym);
      if (!el || !el.z) return null;
      for (let i = 0; i < counts[sym]; i++) syms.push(sym);
    }
    if (syms.length < 2) return null;
    // Covalence: the bonds an atom wants. Hydrogen and the halogens take one;
    // a main-group atom takes as many as complete its octet, and a third-period
    // or heavier atom may go up to its full valence when there are enough
    // partners to ask for it (that is what makes SF6 and not SF2).
    const frame = syms.map(sym => {
      const el = auto.elementBySymbol(sym), f = shellFrame(el.z);
      const octet = Math.max(1, Math.min(f.v, 8 - f.v) || 1);
      return { sym, v: f.v, period: f.period, metal: f.metal,
        need: TERMINAL[sym] ? 1 : (f.metal ? 1 : octet) };
    });
    const chi = i => PAULING_EN[frame[i].sym] || 2.55;
    // A third-period or heavier atom can be asked to hold more bonds than its
    // octet covalence when the formula really does offer that many partners
    // (XeF4, SF6), so the hungriest centre is widened up to its full valence.
    const terminals = frame.filter(nd => TERMINAL[nd.sym]).length;
    const want = frame.filter(nd => !TERMINAL[nd.sym]).reduce((s, nd) => s + nd.need, 0);
    if (terminals > want) {
      let best = -1;
      frame.forEach((nd, i) => { if (!TERMINAL[nd.sym] && nd.v > 0 && (best < 0 || nd.v > frame[best].v)) best = i; });
      if (best >= 0) frame[best].need = Math.max(frame[best].need, Math.min(frame[best].v, terminals));
    }
    const bonds = [];
    const link = (i, j) => {
      if (frame[i].need <= 0 || frame[j].need <= 0) return false;
      const at = bonds.find(b => (b[0] === i && b[1] === j) || (b[0] === j && b[1] === i));
      if (at) { if (at[2] < 3) { at[2]++; frame[i].need--; frame[j].need--; return true; } return false; }
      bonds.push([i, j, 1]); frame[i].need--; frame[j].need--;
      return true;
    };
    const open = () => frame.map((nd, i) => ({ nd, i })).filter(x => x.nd.need > 0);
    const mostUnsaturated = avoid => open().filter(x => avoid.indexOf(x.i) < 0)
      .sort((a, b) => b.nd.need - a.nd.need || chi(a.i) - chi(b.i))[0];
    // Caps first: hydrogens, then halogens, onto whatever is hungriest.
    for (const list of [frame.map((nd, i) => ({ nd, i })).filter(x => x.nd.sym === 'H'),
      frame.map((nd, i) => ({ nd, i })).filter(x => TERMINAL[x.nd.sym] && x.nd.sym !== 'H')]) {
      for (const cap of list) {
        const host = mostUnsaturated([cap.i]);
        if (host && host.nd.need > 0) link(cap.i, host.i);
      }
    }
    // Then the heavy skeleton. Nonmetals are laid first, most electronegative
    // last, and each atom joins the open neighbour it suits: a metal reaches for
    // the most electronegative partner (so Na2O2 comes out Na-O-O-Na and not
    // Na-Na with a double-bonded O2), a nonmetal for the least.
    const heavy = frame.map((nd, i) => ({ nd, i }))
      .filter(x => !TERMINAL[x.nd.sym])
      .sort((a, b) => (a.nd.metal ? 1 : 0) - (b.nd.metal ? 1 : 0) ||
        chi(a.i) - chi(b.i) || b.nd.need - a.nd.need)
      .map(x => x.i);
    for (let k = 1; k < heavy.length; k++) {
      const i = heavy[k];
      if (frame[i].need <= 0) continue;
      let host = -1;
      for (const j of heavy.slice(0, k)) {
        if (frame[j].need <= 0 || bonds.some(b => (b[0] === i && b[1] === j) || (b[0] === j && b[1] === i))) continue;
        if (host < 0 || (frame[i].metal ? chi(j) > chi(host) : chi(j) < chi(host))) host = j;
      }
      if (host < 0) host = heavy[Math.max(0, k - 1)];
      link(i, host);
    }
    // Spare valences left on neighbours become multiple bonds.
    for (let pass = 0; pass < 3; pass++) {
      const unsat = open();
      if (!unsat.length) break;
      for (const a of unsat) for (const b of unsat) {
        if (a.i >= b.i || a.nd.need <= 0 || b.nd.need <= 0) continue;
        if (bonds.some(x => (x[0] === a.i && x[1] === b.i) || (x[0] === b.i && x[1] === a.i))) link(a.i, b.i);
      }
    }
    // An atom the valence bookkeeping left unattached still belongs to the
    // species, so it is joined to its nearest neighbour over budget rather than
    // dropped; the Lewis layer reads the oversaturation as charges.
    const bonded = new Set();
    for (const b of bonds) { bonded.add(b[0]); bonded.add(b[1]); }
    for (let i = 0; i < frame.length; i++) {
      if (bonded.has(i)) continue;
      let j = -1;
      for (let k = 0; k < frame.length; k++) {
        if (k === i || !bonded.has(k)) continue;
        if (j < 0 || frame[k].need > frame[j].need) j = k;
      }
      if (j < 0) j = i === 0 ? 1 : 0;
      bonds.push([i, j, 1]); bonded.add(i);
    }
    return bonds.length ? { atoms: syms, bonds, charge, generic: true } : null;
  }
  function templateFor(formula) {
    const auto = (root.__mol3d || {}).auto || {};
    let tpl = null;
    try { if (auto.template) tpl = auto.template(formula); } catch (e) { tpl = null; }
    if (tpl && Array.isArray(tpl.atoms) && tpl.atoms.length) return tpl;
    const ie = root.__isomerEngine;
    if (ie && typeof ie.enumerate === 'function') {
      try {
        const res = ie.enumerate(formula, { limit: 1, deadlineMs: 40 });
        const g = res && res.items && res.items[0] && res.items[0].graph;
        if (g && Array.isArray(g.nodes) && g.nodes.length) {
          // The enumerator hangs hydrogen on the heavy atom as a count while templates
          // and the geometry solver both want atoms, so materialise the hydrogens.
          const syms = g.nodes.map(n => n.el);
          const bonds = (g.edges || []).map(e => [g.nodes.findIndex(n => n.id === e.a), g.nodes.findIndex(n => n.id === e.b), e.order || 1]);
          g.nodes.forEach((n, i) => {
            for (let k = 0; k < (n.h || 0); k++) { syms.push('H'); bonds.push([i, syms.length - 1, 1]); }
          });
          if (bonds.length === (g.edges || []).length + g.nodes.reduce((s, n) => s + (n.h || 0), 0)) {
            return { atoms: syms, bonds, charge: 0 };
          }
        }
      } catch (e) { /* fall through to the generic constitution */ }
    }
    try { return genericTemplate(formula); } catch (e) { return null; }
  }
  function rebuiltStructure(formula) {
    const tpl = templateFor(formula);
    const P = root.Mol3DPhysics;
    if (!tpl || !P || !P.Builder || typeof P.Builder.build !== 'function') return null;
    let built = null;
    try {
      built = P.Builder.build({
        atoms: tpl.atoms.map(sym => ({ sym })),
        bonds: (tpl.bonds || []).map(b => [b[0], b[1], b[2] || 1]),
        charge: tpl.charge || 0
      }, { charges: false, deadlineMs: 30 });
    } catch (e) { return null; }
    if (!built || !built.ok || !built.mol || built.mol.atoms.length !== tpl.atoms.length) return null;
    const auto = (root.__mol3d || {}).auto || {};
    const atoms = built.mol.atoms.map((a, i) => {
      const rec = auto.elementBySymbol ? auto.elementBySymbol(a.sym) : null;
      const mass = rec && rec.mass ? rec.mass : (a.el && a.el.mass_u) || 0;
      return { id: i, el: { sym: a.sym, z: a.el ? a.el.z : 0, mass },
        pos: { x: a.x / UNIT_M, y: a.y / UNIT_M, z: a.z / UNIT_M } };
    });
    if (atoms.some(a => !(a.el.mass > 0))) return null;
    return { atoms, bonds: (built.mol.bonds || []).map(b => ({ a: b.i, b: b.j, order: b.order || 1 })), charge: tpl.charge || 0, generic: !!tpl.generic };
  }
  // One free atom has no bonds and no rotation, so its ideal-gas entropy is the
  // Sackur-Tetrode value and its formation enthalpy is the element's atomisation
  // enthalpy. For a noble gas that is not an approximation at all.
  function monatomicRow(formula) {
    const m = /^([A-Z][a-z]?)1$/.exec(canon(formula));
    if (!m || ATOM_DH[m[1]] === undefined) return null;
    const sym = m[1];
    const auto = (root.__mol3d || {}).auto || {};
    const rec = auto.elementBySymbol ? auto.elementBySymbol(sym) : null;
    const mass = rec && rec.mass;
    if (!(mass > 0)) return null;
    return { formula, estimated: true, data: {
      phase: 'g', hf: ATOM_DH[sym], s: transEntropy(mass, T_REF, P_REF),
      referenceTemperature: T_REF, pStandard: 1, cStandard: 1, provenance: 'calculated', estimated: true,
      source: L('estimated: free ' + sym + ' atom, Sackur-Tetrode entropy and atomisation enthalpy, ideal gas at 298.15 K',
        'ước lượng: nguyên tử ' + sym + ' tự do, entropy Sackur-Tetrode và enthalpy nguyên tử hoá, khí lý tưởng 298,15 K')
    } };
  }
  const estimateCache = new Map();
  function theoreticalRow(formula) {
    const key = canon(formula);
    if (estimateCache.has(key)) return estimateCache.get(key);
    let row = monatomicRow(formula);
    if (!row) {
      const s = rebuiltStructure(formula);
      const th = root.__mol3d && root.__mol3d.simulation && root.__mol3d.simulation.thermo;
      let est = null;
      if (s && th) { try { est = theoreticalState(s.atoms, s.bonds, th, { charge: s.charge }); } catch (e) { est = null; } }
      if (est) {
        const genericNote = s.generic ? L(', connected from the formula by valence rules (no authored structure exists for it)',
          ', nối từ công thức theo luật hoá trị (không có cấu trúc được soạn cho chất này)') : '';
        row = { formula, estimated: true, data: {
          phase: 'g', hf: est.dfH, s: est.sAbs,
          referenceTemperature: T_REF, pStandard: 1, cStandard: 1, provenance: 'calculated', estimated: true,
          source: L('estimated: bond-enthalpy cycle and statistical mechanics on a rebuilt structure, ideal gas at 298.15 K',
            'ước lượng: chu trình năng lượng liên kết và cơ học thống kê trên cấu trúc dựng lại, khí lý tưởng 298,15 K') +
            genericNote +
            (est.elementRef ? '' : L(', referred to gaseous atoms (no atomisation data for ', ', quy về nguyên tử khí (thiếu dữ liệu nguyên tử hoá của ') + est.missing.join(', ') + ')') +
            L('; bonding corrections for charge, lone pairs, radicals and strain; symmetry number 1, no bend or torsion modes',
              '; có hiệu chỉnh liên kết cho điện tích, cặp tự do, gốc tự do và ứng suất; số đối xứng 1, bỏ qua mode uốn và xoắn')
        } };
      }
    }
    estimateCache.set(key, row);
    return row;
  }
  // Measured first, then theoretical, then nothing. `lookup` stays strict so the
  // Info tab can still tell a cited table row apart from a calculation.
  function speciesRow(formula) { return lookup(formula) || theoreticalRow(formula); }

  // Measured standard-state data for whatever molecule the player selects,
  // rendered in the Info tab. Bundle tables win when they cover the species,
  // then the URPE reference table; anything else is calculated and labelled
  // as such rather than left blank.
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
        'ΔfH° = ' + r.dHf.toFixed(2) + ' kJ·mol⁻¹ · ΔfS° = ' + r.dSf.toFixed(2) + ' J·mol⁻¹·K⁻¹ · ΔfG° = ' + r.dG.toFixed(2) + ' kJ·mol⁻¹';
    }
    const sp = lookup(a.displayFormula || a.formula || (r && r.formula));
    if (sp) {
      const d = sp.data;
      // S° is absolute, so the formation entropy only needs the element
      // reference entropies; when they cover the species ΔfG° follows too.
      const ref = formationEntropy(list, d.s, th);
      return '<div class="urpe-g-note">' + L('Reference table (298.15 K)', 'Bảng dữ liệu chuẩn (298,15 K)') + '</div>' + head +
        'ΔfH° = ' + fmt(d.hf, 2) + ' kJ·mol⁻¹ · ΔfS° = ' + (ref === null ? fmt(d.s, 2) + ' J·mol⁻¹·K⁻¹ (absolute S°)' : ref.toFixed(2) + ' J·mol⁻¹·K⁻¹') +
        (ref === null ? '' : ' · ΔfG° = ' + (d.hf - T_REF * ref / 1000).toFixed(2) + ' kJ·mol⁻¹') +
        (d.phase ? ' · ' + esc(phaseName(d.phase)) : '') +
        '<br><i title="' + String(d.source || '').replace(/"/g, '&quot;') + '">' + String(d.source || '').replace(/[<>&]/g, '') + '</i>';
    }
    let est = null;
    try { est = theoreticalState(list, sel.comp.bonds, th, { charge: a.charge }); } catch (e) { est = null; }
    if (!est) return '';
    const basis = L('estimated: bond-enthalpy cycle with rule-based bonding corrections and statistical mechanics, ideal gas',
      'ước lượng: chu trình năng lượng liên kết kèm hiệu chỉnh liên kết theo luật và cơ học thống kê, khí lý tưởng') +
      (est.elementRef ? '' : L(' · referred to gaseous atoms, no atomisation data for ',
        ' · quy về nguyên tử khí, thiếu dữ liệu nguyên tử hoá của ') + est.missing.join(', '));
    const caveats = L('Ideal gas at 298.15 K. ΔfH° = atomisation enthalpies − bond enthalpies + bonding corrections (formal charge, charge separation, lone-pair rows, incomplete octets, radicals, ring and angle strain, aromatic resonance). Known limits: bond pairs the engine table lacks are interpolated by Pauling’s two-electron rule, which overshoots on a hypervalent, strongly polarised centre (SF6 reads far too stable) and is skipped when the table anchors neither element to itself (Si, B keep the 350 kJ·mol⁻¹ default); salts and network solids get no lattice energy; rotational symmetry number assumed 1; bending and torsion modes omitted; isotopes use the standard atomic mass.',
      'Khí lý tưởng ở 298,15 K. ΔfH° = enthalpy nguyên tử hoá − tổng năng lượng liên kết + các hiệu chỉnh liên kết (điện tích hình thức, tách điện tích, chuỗi cặp tự do, thiếu octet, gốc tự do, ứng suất góc/vòng, cộng hưởng thơm). Giới hạn đã biết: cặp liên kết thiếu trong bảng động học được nội suy theo quy tắc hai electron của Pauling, quy tắc này ước lượng quá mức tại tâm siêu hoá trị phân cực mạnh (SF6 đọc ra quá bền) và được bỏ qua khi bảng chưa neo nguyên tử đó với chính nó (Si, B giữ mặc định 350 kJ·mol⁻¹); muối và mạng tinh thể chưa có năng lượng mạng tinh thể; số đối xứng quay lấy bằng 1; bỏ qua mode uốn và xoắn; đồng vị dùng nguyên tử khối chuẩn.');
    return '<div class="urpe-g-note">' + L('Theoretically Measured Data (298.15 K, 1 bar)', 'Dữ liệu đo lý thuyết (298,15 K, 1 bar)') + '</div>' + head +
      'ΔfH° = ' + est.dfH.toFixed(2) + ' kJ·mol⁻¹ · ΔfS° = ' + est.dfS.toFixed(2) + ' J·mol⁻¹·K⁻¹ · ΔfG° = ' + est.dfG.toFixed(2) + ' kJ·mol⁻¹' +
      corrHtml(est.corr) +
      '<br><i title="' + esc(caveats) + '">' + esc(basis) + '</i>';
  }
  // The correction terms are part of the number, so the panel shows which of
  // them actually fired. A term that is zero is not noise to print.
  const CORR_LABEL = {
    fc: ['formal charge', 'điện tích hình thức'],
    zw: ['charge separation', 'tách điện tích'],
    chain: ['lone-pair row', 'chuỗi cặp tự do'],
    octet: ['incomplete octet', 'thiếu octet'],
    radical: ['radical', 'gốc tự do'],
    strain: ['angle & ring strain', 'ứng suất góc & vòng'],
    res: ['resonance', 'cộng hưởng']
  };
  function corrHtml(corr) {
    if (!corr || corr.skipped) return '';
    const parts = [];
    for (const k of Object.keys(CORR_LABEL)) {
      const v = corr[k];
      if (typeof v !== 'number' || !isFinite(v) || Math.abs(v) < 0.05) continue;
      parts.push(L(CORR_LABEL[k][0], CORR_LABEL[k][1]) + ' ' + (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1));
    }
    if (!parts.length) return '';
    return '<br>' + L('bonding corrections', 'hiệu chỉnh liên kết') + ': ' + parts.join(' · ') +
      ' · ' + L('total', 'tổng') + ' ' + (corr.total >= 0 ? '+' : '−') + Math.abs(corr.total).toFixed(1) + ' kJ·mol⁻¹';
  }
  // ΔfS° from a measured absolute S°, or null when an element has no reference
  // entropy to subtract.
  function formationEntropy(list, sAbs, th) {
    const refS = th && th.refS;
    if (!refS || typeof refS.get !== 'function' || !(sAbs > -Infinity)) return null;
    let sum = 0;
    for (const a of list) {
      const s = a.el && a.el.sym, r = s && refS.get(s);
      if (typeof r !== 'number') return null;
      sum += r;
    }
    return sAbs - sum;
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

  // Programmatic face of exactly the maths the panel draws, so the auto-reaction
  // loop, the console and any external caller read one object instead of HTML.
  function predict(equation, opts) {
    const o = opts || {};
    const env = envState();
    const T = Number.isFinite(o.T) ? o.T : env.T;
    const P = Number.isFinite(o.P) ? o.P : env.P;
    const terms = parse(equation);
    if (!terms) return null;
    const list = terms.map(t => ({ formula: t.formula, nu: t.nu, data: (speciesRow(t.formula) || {}).data || null }));
    const missing = list.filter(t => !t.data).map(t => t.formula);
    if (missing.length) return { equation, T, P, unsupported: missing };
    const moles = o.moles instanceof Map ? o.moles : new Map(Object.entries(o.moles || {}));
    const q = activities(list, moles, P);
    let r;
    try { r = N.thermo(list.map(t => thermoTerm(t, q.acts[t.formula])), T); } catch (e) { return { equation, T, P, error: e.message }; }
    const dG = r.dG === null || r.dG === undefined || !Number.isFinite(r.dG) ? null : r.dG;
    return {
      equation, T, P,
      dH: r.dH, dS: r.dS, dG0: r.dG0, dG,
      K: r.K, lnK: r.lnK,
      Q: r.lnQ === null || r.lnQ === undefined ? null : Math.exp(r.lnQ), lnQ: r.lnQ,
      spontaneous: dG === null ? null : dG < 0,
      spontaneousStandard: r.dG0 === null ? null : r.dG0 < 0,
      direction: dG === null ? 'unknown' : dG < -1e-9 ? 'forward' : dG > 1e-9 ? 'reverse' : 'equilibrium',
      equilibrium: equilibrium(list, r, moles, P),
      activities: q.acts, note: q.reason, model: r.model, provenance: r.provenance, missing: r.missing
    };
  }

  root.URPEGame = { evaluate, predict, equilibrium, panelHtml, lookup, speciesRow, theoreticalRow, canon, parse, envState, thermoTerm, sci, theoreticalState, ATOM_DH };
})(window);
