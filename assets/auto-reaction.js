/* Automatic thermodynamic prediction.
 *
 * This module replaces the manual pairing workflow: nothing here waits for a
 * player to pick two molecules and choose a condition from a menu. It reads the
 * scene and the Environment tab, prices every rearrangement the scene could
 * undergo from measured data, and fires the ones the maths says are happening.
 *
 * Every number is produced by a universal relation, never keyed to a reaction:
 *   dH°(T) = Σ ν·ΔfH°(T)                dS°(T) = Σ ν·S°(T)
 *   dG°(T) = dH°(T) − T·dS°(T)           dG = dG° + R·T·ln Q
 *   k = A·e^(−Ea/(R·T))                  Ea = E₀·(1 + ΔG°/(4E₀))²
 *   ΔG‡ = ΔH‡ − T·ΔS‡                    ΔH‡ = Ea − nRT, ΔS‡ = R·ln(A·h/(e·k_B·T))
 *   A₂ = N_A·π·d²·√(8·k_B·T/(π·μ))       A₁ = k_B·T/h
 * The only per-species inputs are cited quantities: the standard-state rows in
 * assets/urpe-data.js, the bond dissociation enthalpies, and the atomic radii and
 * masses the element table already carries. Where a needed measurement is
 * missing the route is reported as unknown and never fires.
 */
(function (root) {
  'use strict';

  const R = 8.314462618;          // J·mol⁻¹·K⁻¹
  const NA = 6.02214076e23;       // mol⁻¹
  const KB = 1.380649e-23;        // J·K⁻¹
  const PLANCK = 6.62607015e-34;  // J·s
  const AMU = 1.66053906660e-27;  // kg
  const ATM_BAR = 1.01325;        // bar per atm
  const R_L = 0.082057366080960;  // L·atm·mol⁻¹·K⁻¹

  const MAX_EVENTS_PER_SECOND = 3; // the ceiling the decomposition loop already uses
  const MIN_GAP_MS = 400;
  const PAINT_THROTTLE_MS = 250;
  const PANEL_ROWS = 10;
  // Collapsed by default; the Show More button below the rows opens the full
  // ranked list in place, and Show less puts it back.
  let showAllRoutes = false;
  // A route counts as proceeding when its own half-life is under about two hours
  // of simulated time; anything slower is reported as frozen with its half-life.
  const LIVE_PER_SECOND = Math.LN2 / 7200;

  function game() { return root.__mol3d || null; }
  function auto() { const g = game(); return g && g.auto || null; }
  function numerics() { return root.URPENumerics || null; }
  function ready() { return !!auto() && !!numerics() && !!root.URPEGame && typeof root.URPEGame.lookup === 'function'; }

  function isVi() {
    const a = auto();
    if (!a) return true;
    try { return a.lang() !== 'en'; } catch (e) { return true; }
  }
  function L(en, vi) { return isVi() ? vi : en; }

  const SUP = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
  function sup(s) { return String(s).split('').map(c => SUP[c] || c).join(''); }
  function exp10(v, d) {
    const e = v.toExponential(d);
    const i = e.indexOf('e');
    return e.slice(0, i).replace(/\.?0+$/, '').replace(/^-/, '−') + '×10' + sup(e.slice(i + 1).replace('+', ''));
  }
  function sci(v, d) {
    if (v === null || v === undefined || !Number.isFinite(v)) return L('unknown', 'không rõ');
    const digits = d === undefined ? 2 : d;
    const a = Math.abs(v);
    if (a !== 0 && (a >= 1e5 || a < 10 ** -digits)) return exp10(v, digits);
    const text = v.toFixed(digits);
    // A value that rounds away is not zero, and printing it as 0.00 would be a lie.
    if (v !== 0 && Math.abs(parseFloat(text)) < 0.5 * 10 ** -digits) return exp10(v, digits);
    return text.replace(/^-/, '−');
  }
  function duration(seconds) {
    if (!Number.isFinite(seconds)) return L('longer than the age of the universe', 'lâu hơn tuổi vũ trụ');
    if (seconds < 1e-3) return sci(seconds * 1e3, 2) + ' ms';
    if (seconds < 90) return sci(seconds, 2) + ' s';
    if (seconds < 5400) return sci(seconds / 60, 2) + ' ' + L('min', 'phút');
    if (seconds < 172800) return sci(seconds / 3600, 2) + ' h';
    if (seconds < 6.307e7) return sci(seconds / 86400, 2) + ' ' + L('days', 'ngày');
    if (seconds < 3.155e9) return sci(seconds / 3.15576e7, 2) + ' ' + L('years', 'năm');
    return sci(seconds / 3.15576e7, 2) + ' ' + L('years', 'năm');
  }
  function esc(s) { return String(s).replace(/[<>&]/g, ''); }

  // --- environment (Step 2) --------------------------------------------------
  function env() {
    const g = game();
    const e = (g && g.environment) || {};
    const T = Number.isFinite(e.temperatureK) ? e.temperatureK : 298.15;
    const atm = Number.isFinite(e.pressureAtm) ? e.pressureAtm : 1;
    return { T, atm, bar: atm * ATM_BAR };
  }
  function atmosphere() {
    const g = game();
    const a = g && g.atmosphere;
    const out = new Map();
    if (!a || !a.enabled || !a.composition || typeof a.composition.forEach !== 'function') return out;
    a.composition.forEach((ratio, formula) => { if (ratio > 0) out.set(String(formula), ratio); });
    return out;
  }

  // --- scene structures, masses and radii (Step 4) ---------------------------
  // A molecule's kinetic size is not a fitted constant: it is half the longest
  // through-bond path plus the largest covalent radius along it, from the element
  // data the game already ships.
  let GRAPHS = new Map();
  let SIZES = new Map();

  function graphOf(formula) {
    const a = auto();
    const norm = a.normalize(formula);
    if (GRAPHS.has(norm)) return GRAPHS.get(norm);
    const tpl = a.template ? a.template(formula) || a.template(norm) : null;
    if (!tpl || !Array.isArray(tpl.atoms) || !tpl.atoms.length) return null;
    const graph = {
      symbols: tpl.atoms.slice(),
      bonds: (tpl.bonds || []).map(b => [b[0], b[1], b[2] || 1, !!b[3]])
    };
    GRAPHS.set(norm, graph);
    return graph;
  }
  function sceneGraphs() {
    const g = game(), a = auto();
    const out = new Map();
    if (!g || !g.atoms) return out;
    const comps = (g.comps && g.comps()) || [];
    const analyses = (g.analyses && g.analyses()) || [];
    const bondList = g.bonds && typeof g.bonds.values === 'function' ? [...g.bonds.values()] : [];
    for (let i = 0; i < comps.length; i++) {
      const an = analyses[i] || {};
      const norm = a.normalize(an.displayFormula || an.formula || '');
      if (!norm || out.has(norm)) continue;
      const index = new Map();
      const symbols = [];
      let ok = true;
      for (const id of comps[i].atoms) {
        const sym = a.atomElement(id);
        if (!sym) { ok = false; break; }
        index.set(id, symbols.length);
        symbols.push(sym);
      }
      if (!ok || !symbols.length) continue;
      const bonds = [];
      for (const b of bondList) {
        if (!b || !index.has(b.a) || !index.has(b.b)) continue;
        bonds.push([index.get(b.a), index.get(b.b), b.order || 1, !!b.ionic]);
      }
      out.set(norm, { symbols, bonds });
    }
    return out;
  }
  function sizeOf(graph) {
    if (!graph) return null;
    const cached = SIZES.get(graph);
    if (cached !== undefined) return cached;
    const a = auto();
    const radii = graph.symbols.map(s => {
      const el = a.elementBySymbol(s);
      return el && Number.isFinite(el.radius) ? el.radius : null;
    });
    const masses = graph.symbols.map(s => {
      const el = a.elementBySymbol(s);
      return el && Number.isFinite(el.mass) ? el.mass : null;
    });
    let value = null;
    if (radii.every(r => r !== null) && masses.every(m => m !== null)) {
      const mass = masses.reduce((s, m) => s + m, 0);
      const n = radii.length;
      let reach = radii[0];
      let connected = n === 1;
      if (n > 1) {
        const adj = Array.from({ length: n }, () => []);
        for (const [i, j] of graph.bonds) {
          if (!adj[i] || !adj[j]) continue;
          adj[i].push([j, radii[i] + radii[j]]);
          adj[j].push([i, radii[i] + radii[j]]);
        }
        const dist = new Array(n).fill(Infinity);
        const seen = new Array(n).fill(false);
        dist[0] = 0;
        for (;;) {
          let u = -1, best = Infinity;
          for (let k = 0; k < n; k++) if (!seen[k] && dist[k] < best) { best = dist[k]; u = k; }
          if (u < 0) break;
          seen[u] = true;
          for (const [v, w] of adj[u]) if (dist[u] + w < dist[v]) dist[v] = dist[u] + w;
        }
        connected = dist.every(d => Number.isFinite(d));
        // A disconnected set of species has no single kinetic size, so it is
        // reported rather than guessed at.
        if (connected) reach = Math.max(...dist);
      }
      if (connected) value = { radiusPm: 0.5 * reach + Math.max(...radii), massAmu: mass };
    }
    SIZES.set(graph, value);
    return value;
  }
  function bondSig(graph, bond) {
    const a = auto();
    const s1 = graph.symbols[bond[0]], s2 = graph.symbols[bond[1]];
    if (!s1 || !s2) return null;
    const order = bond[2] === 2 ? 2 : bond[2] === 3 ? 3 : 1;
    const ch = order === 2 ? '=' : order === 3 ? '≡' : '-';
    const pair = [s1, s2].sort();
    return (bond[3] ? 'ionic:' : '') + pair[0] + ch + pair[1];
  }
  function bondMultiset(entries) {
    const out = new Map();
    for (const { graph, nu } of entries) {
      if (!graph) continue;
      for (const b of graph.bonds) {
        const sig = bondSig(graph, b);
        if (!sig) continue;
        out.set(sig, (out.get(sig) || 0) + nu);
      }
    }
    return out;
  }
  // The intrinsic barrier is a quarter of the enthalpy of the COVALENT bonds that
  // have to break and do not reappear in the products — the measured bond
  // dissociation table, nothing else. An ionic contact is not a covalent bond: it
  // is a non-directional Coulomb association between ions that survive the
  // rearrangement, so swapping partners (metathesis, neutralization, precipitation)
  // is capture-controlled and carries no bond-dissociation barrier — the same
  // reason ion combination is barrierless. This engine bonds metals by electron
  // transfer and the measured table covers no metal pair, so a metal–nonmetal
  // contact is ionic here even when the scene's relaxation flags it covalent.
  const METAL_CATS = ['alkali', 'alkaline', 'transition', 'post', 'lanthanide', 'actinide'];
  function intrinsicBarrier(reactants, products, protonTransfer) {
    // A Brønsted neutralization moves the proton heterolytically: the bonding
    // pair stays on the conjugate base, so homolytic bond energies are the wrong
    // currency for the step. Favorable proton transfer is capture-controlled
    // (Eigen), the same reason ion combination is barrierless — the ΔG gate above
    // still decides whether it happens at all.
    if (protonTransfer) return { value: 0 };
    if (reactants.some(e => !e.graph) || products.some(e => !e.graph)) {
      return { value: null, reason: L('a species has no bond structure in this scene, so the barrier cannot be built',
        'một loài không có cấu trúc liên kết trong cảnh này, nên không dựng được rào cản') };
    }
    const a = auto();
    const isMetalSym = s => { const el = a.elementBySymbol(s); return !!el && METAL_CATS.includes(el.cat); };
    const broken = bondMultiset(reactants);
    const kept = bondMultiset(products);
    const table = a.bondEnergies();
    let sum = 0, count = 0, unknown = null;
    for (const [sig, n] of broken) {
      const left = n - (kept.get(sig) || 0);
      if (left <= 0) continue;
      const core = sig.startsWith('ionic:') ? sig.slice(6) : sig;
      const sep = core.includes('≡') ? '≡' : core.includes('=') ? '=' : '-';
      const pair = core.split(sep);
      // Ionic flag, or either atom a metal: an electrostatic contact, not a
      // covalent bond, so it rearranges without a bond-dissociation barrier.
      if (sig.startsWith('ionic:') || isMetalSym(pair[0]) || isMetalSym(pair[1])) continue;
      const order = sep === '≡' ? 3 : sep === '=' ? 2 : 1;
      const bde = (table[order] || {})[core];
      if (!Number.isFinite(bde)) {
        unknown = L('no measured bond energy for ' + sig, 'chưa có năng lượng liên kết đo lường cho ' + sig);
        continue;
      }
      sum += bde * left;
      count += left;
    }
    if (unknown) return { value: null, reason: unknown };
    // No covalent bond breaks: the rearrangement costs nothing to reach its own
    // transition state, which is why proton transfers and ion combinations are fast.
    return { value: count ? 0.25 * sum : 0 };
  }

  // --- terms and activities --------------------------------------------------
  // A product entry is a template key, and the keys are not all formulas: "ClI" is
  // the chloride ion and "NH4" is NH4+. The species is rebuilt from the template's
  // own atoms and charge so the table is addressed by what the substance is, not by
  // the label the database happens to file it under.
  function speciesRef(formula) {
    const U = root.URPEGame;
    if (U.lookup(formula)) return formula;
    const tpl = auto().template ? auto().template(formula) : null;
    if (!tpl || !Array.isArray(tpl.atoms) || !tpl.atoms.length) return formula;
    const counts = new Map();
    for (const s of tpl.atoms) counts.set(s, (counts.get(s) || 0) + 1);
    const base = [...counts.keys()].sort().map(s => s + counts.get(s)).join('');
    const q = tpl.charge || 0;
    const ion = base + (q > 0 ? '+'.repeat(q) : '-'.repeat(-q));
    return U.lookup(ion) ? ion : formula;
  }
  function termsOf(rx) {
    const out = [];
    for (const [f, n] of Object.entries(rx.reactants || {})) out.push({ formula: f, nu: -n });
    for (const entry of rx.products || []) out.push({ formula: entry[0], nu: entry[1] });
    for (const t of out) t.ref = speciesRef(t.formula);
    return out;
  }
  // A pure condensed phase has unit activity; a gas has its mole fraction times
  // the pressure over its standard pressure; a gas the atmosphere donates enters
  // at the atmosphere's own fraction. Products have not formed yet, so they are
  // held at unity and the answer is the initial driving force, not an equilibrium
  // statement.
  function activities(terms, classes, atmo, bar) {
    const acts = new Map();
    const norm = f => auto().normalize(f);
    for (const t of terms) {
      const row = root.URPEGame.speciesRow(t.ref);
      t.phase = row ? row.data.phase : null;
    }
    const reactantGases = terms.filter(t => t.nu < 0 && t.phase === 'g');
    const sceneTotal = reactantGases.reduce((s, t) => s + (classes.get(norm(t.formula)) || 0), 0);
    for (const t of reactantGases) {
      const count = classes.get(norm(t.formula)) || 0;
      // atmosphere.composition holds mole fractions (ratio/total, summing to 1),
      // the same unit envGasFraction and the attack model read. Dividing by 100
      // here made every atmosphere-fed gas 100x too dilute: the rate collapsed and
      // the panel behaved as if the gas were barely present.
      const donated = atmo.has(t.formula) ? atmo.get(t.formula) : atmo.has(norm(t.formula)) ? atmo.get(norm(t.formula)) : null;
      let x;
      if (count > 0) x = sceneTotal > 0 ? count / sceneTotal : 0;
      else if (donated !== null) x = donated;
      else return { acts: null, reason: L('no amount or atmosphere fraction for ' + t.formula, 'không có số lượng hay tỉ lệ khí quyển cho ' + t.formula) };
      if (!(x > 0)) return { acts: null, reason: L(t.formula + ' has no molecules present', t.formula + ' không có phân tử nào hiện diện') };
      t.x = x;
      acts.set(t.formula, x * bar / (root.URPEGame.speciesRow(t.ref).data.pStandard || 1));
    }
    for (const t of terms) {
      if (t.nu > 0) acts.set(t.formula, 1);
      else if (t.phase === 's' || t.phase === 'l') acts.set(t.formula, 1);
    }
    return { acts, reason: null };
  }
  function thermoOf(terms, acts, T) {
    return numerics().thermo(terms.map(t => {
      const d = root.URPEGame.speciesRow(t.ref).data;
      const term = { nu: t.nu, phase: d.phase, hf: d.hf, s: d.s, cp: d.cp,
        cpPoly: d.cpPoly, cpIntervals: d.cpIntervals,
        referenceTemperature: d.referenceTemperature, pStandard: d.pStandard, cStandard: d.cStandard,
        provenance: d.provenance, source: d.source };
      if (acts) term.activity = acts.get(t.formula);
      return term;
    }), T);
  }
  function applicableCatalysts(rx) {
    const a = auto();
    const out = [];
    if (!a.catalysts) return out;
    const classes = a.species();
    for (const c of a.catalysts()) {
      if (!Number.isFinite(c.deltaEa) || !classes.has(a.normalize(c.formula))) continue;
      if ((c.reactions || []).some(r => r === '*' || rx.equation.includes(r))) out.push(c);
    }
    return out;
  }

  // --- prefactor and collision pair (Step 4) ---------------------------------
  function collisionPair(terms, classes) {
    const reactants = terms.filter(t => t.nu < 0);
    const gases = reactants.filter(t => t.phase === 'g');
    const condensed = reactants.filter(t => t.phase !== 'g');
    const count = t => classes.get(auto().normalize(t.formula)) || 0;
    if (reactants.length === 1) {
      // One species rearranging on its own: kBT/h is the transition-state attempt
      // frequency, valid for a molecule in any phase.
      return { mode: 'unimolecular', target: reactants[0], count: count(reactants[0]), order: 1 };
    }
    if (gases.length >= 2) {
      // Hard-sphere bimolecular prefactor; the first reactant is taken as the one
      // the world has more of, so the molecule count in the rate is real.
      const ordered = gases.slice().sort((a, b) => count(b) - count(a) || a.formula.localeCompare(b.formula));
      const a1 = ordered[0], a2 = ordered[1];
      const sa = sizeOf(graphOf(a1.formula)), sb = sizeOf(graphOf(a2.formula));
      if (!sa || !sb) return { mode: null, reason: L('no measured radii and masses for its reactants, so no collision cross-section',
        'không có bán kính và khối lượng đo lường cho các chất tham gia, nên không có tiết diện va chạm') };
      return { mode: 'bimolecular', target: a1, partner: a2, count: count(a1), order: 2,
        radiusA: sa.radiusPm, radiusB: sb.radiusPm, massA: sa.massAmu, massB: sb.massAmu };
    }
    if (gases.length === 1 && condensed.length === 1) {
      const st = sizeOf(graphOf(condensed[0].formula)), gs = sizeOf(graphOf(gases[0].formula));
      if (!st || !gs) return { mode: null, reason: L('no measured radii and masses for its reactants, so no collision cross-section',
        'không có bán kính và khối lượng đo lường cho các chất tham gia, nên không có tiết diện va chạm') };
      return { mode: 'surface', target: condensed[0], partner: gases[0], count: count(condensed[0]), order: 1,
        radiusA: st.radiusPm, radiusB: gs.radiusPm, massB: gs.massAmu };
    }
    if (!gases.length) {
      return { mode: null, reason: L('two condensed reactants have no contact rate: the world tracks no solid or liquid volume',
        'hai chất ngưng tụ không có tốc độ tiếp xúc: thế giới không ghi thể tích rắn hay lỏng') };
    }
    return { mode: null, reason: L('more than two gaseous reactants meet in no single bimolecular step',
        'nhiều hơn hai chất tham gia khí không gặp nhau trong một bước hai phân tử duy nhất') };
  }
  // No steric factor is fitted, so the collision prefactor is an upper bound; the
  // exponential term decides what actually happens.
  function prefactor(pair, T, atm) {
    if (pair.mode === 'unimolecular') return { A: KB * T / PLANCK, units: 's⁻¹', basis: 'kBT/h' };
    const sigma = Math.PI * Math.pow((pair.radiusA + pair.radiusB) * 1e-12, 2);
    if (pair.mode === 'bimolecular') {
      const mu = (pair.massA * pair.massB) / (pair.massA + pair.massB) * AMU;
      const vbar = Math.sqrt(8 * KB * T / (Math.PI * mu));
      return { A: NA * sigma * vbar * 1000, units: 'L·mol⁻¹·s⁻¹', basis: 'πd²√(8kBT/πμ)·N_A', sigma, mu, vbar };
    }
    const conc = (pair.partner.x || 0) * atm / (R_L * T); // mol·L⁻¹ of the gas
    const vbar = Math.sqrt(8 * KB * T / (Math.PI * pair.massB * AMU));
    const A = sigma * vbar * conc * 1000 * NA;            // collisions·s⁻¹ per target
    return { A, units: 's⁻¹', basis: L('gas flux on a condensed molecule', 'dòng khí trên một phân tử ngưng tụ'), conc };
  }

  // --- one route, end to end -------------------------------------------------
  function evaluateRoute(rx, classes, atmo, T, bar) {
    const U = root.URPEGame, a = auto();
    const terms = termsOf(rx);
    if (terms.length < 2 || !terms.some(t => t.nu > 0)) {
      return { state: 'blocked', reason: L('the route has no species left to price', 'phương trình không còn loài nào để tính') };
    }
    // Only a species that neither the cited table nor a rebuildable structure can
    // reach is left unpriced; anything with a template is estimated and labelled.
    const estimated = terms.filter(t => !U.lookup(t.ref)).map(t => t.ref);
    const missing = terms.filter(t => !U.speciesRow(t.ref)).map(t => t.ref);
    if (missing.length) return { state: 'nodata', missing };
    // Schema metadata rides with every route: which species used theoretical
    // structure or standard data, and the units/reference state of the numbers.
    const warnings = [];
    if (U.normalizeSpecies) {
      for (const t of terms) {
        const sch = U.normalizeSpecies(t.ref, { stoichiometric_coeff: t.nu });
        if (sch.is_theoretical || sch.structure_status !== 'defined') {
          warnings.push({ formula: sch.formula || t.ref, structure_status: sch.structure_status,
            data_source: sch.data_source, is_theoretical: sch.is_theoretical });
        }
      }
    }
    const base = {
      estimated,
      warnings,
      reference: { temperature_k: T, pressure_bar: bar,
        units: { delta_f_h: 'kJ·mol−1', delta_f_g: 'kJ·mol−1', s: 'J·mol−1·K−1', cp: 'J·mol−1·K−1' } }
    };
    let acts = { acts: null, reason: null };
    try { acts = activities(terms, classes, atmo, bar); } catch (e) { acts = { acts: null, reason: e.message }; }
    let res;
    try { res = thermoOf(terms, acts.acts, T); } catch (e) {
      return Object.assign(base, { state: 'blocked', reason: L('the solver rejected these standard-state rows (' + e.message + ')',
        'bộ giải từ chối các dòng dữ liệu chuẩn này (' + e.message + ')') });
    }
    Object.assign(base, { dH: res.dH, dS: res.dS, dG0: res.dG0, dG: res.dG, K: res.K, lnK: res.lnK, lnQ: res.lnQ, terms });
    if (res.dG0 === null) {
      // The solver reports a gap by term index; the player needs the species and the
      // reason, because 'terms[3].cp' explains nothing about the environment.
      const gaps = res.missing.slice(0, 3).map(m => {
        const t = /^terms\[(\d+)\]\.cp\b/.exec(m);
        return t && terms[+t[1]] ? terms[+t[1]].ref : m;
      });
      const cpOnly = gaps.length === res.missing.length && gaps.every(g => terms.some(t => t.ref === g));
      return Object.assign(base, { state: 'blocked', reason: cpOnly ?
        L('no measured heat capacity for ' + gaps.join(', ') + ' — their ΔH° and ΔS° cannot be moved off 298.15 K, and this scene is at ' + T.toFixed(2) + ' K',
          'chưa có nhiệt dung đo được cho ' + gaps.join(', ') + ' — không kéo được ΔH° và ΔS° của chúng ra khỏi 298.15 K, còn cảnh này đang ở ' + T.toFixed(2) + ' K') :
        L('standard data incomplete: ' + gaps.join('; '), 'dữ liệu chuẩn chưa đủ: ' + gaps.join('; ')) });
    }
    const priced = res.dG !== null && Number.isFinite(res.dG);
    base.drive = priced ? res.dG : res.dG0;
    base.driveLabel = priced ? L('ΔG', 'ΔG') : L('ΔG° (Q unpriced)', 'ΔG° (chưa tính Q)');
    base.T = T;
    // Three bands, not two: ΔG < 0 is favourable, ΔG > 0 is pushed back, and
    // exactly zero is equilibrium — no net reaction either way, so it must not be
    // handed to the kinetics solver and fired as if something were proceeding.
    base.spontaneity = base.drive < -1e-9 ? 'favorable' : base.drive > 1e-9 ? 'nonspontaneous' : 'equilibrium';
    // When ΔH° and ΔS° share a sign, ΔG° = ΔH° − T·ΔS° changes sign at
    // T* = ΔH°/ΔS°: the temperature the player set decides the direction of this
    // route, not merely how fast it gets there. ΔH° is in kJ and ΔS° in J, so the
    // enthalpy is converted before the ratio.
    if (res.dH !== null && res.dS !== null && Number.isFinite(res.dH) && Number.isFinite(res.dS) &&
        res.dH !== 0 && res.dS !== 0 && res.dH * res.dS > 0) {
      const tStar = res.dH * 1000 / res.dS;
      if (Number.isFinite(tStar) && tStar > 0) {
        base.temperatureShift = {
          crossoverK: tStar,
          currentAbove: T > tStar,
          favorableAbove: res.dS > 0
        };
      }
    }
    if (rx.effect && !a.mayhemOn()) {
      return Object.assign(base, { state: 'blocked', reason: L('a mayhem-only equation, and mayhem mode is off',
        'phương trình chỉ dành cho chế độ Hỗn Loạn, và chế độ đang tắt') });
    }
    if (base.drive > 0) {
      return Object.assign(base, { state: 'uphill', reason: L('not spontaneous as written here: ' + base.driveLabel + ' = ' + sci(base.drive, 2) +
        ' kJ·mol⁻¹, so no amount of mixing will drive it', 'không tự diễn ra ở đây khi viết như trên: ' + base.driveLabel + ' = ' + sci(base.drive, 2) +
        ' kJ·mol⁻¹, nên trộn bao nhiêu cũng không thúc đẩy được') });
    }
    // At ΔG = 0 forward and reverse rates are equal, so nothing net happens; the
    // kinetics solver would still report a positive rate constant and fire it.
    if (base.spontaneity === 'equilibrium') {
      return Object.assign(base, { state: 'equilibrium', reason: L('at equilibrium here: ' + base.driveLabel + ' = 0 kJ·mol−1, so forward and reverse rates match and no net change occurs',
        'đang cân bằng ở đây: ' + base.driveLabel + ' = 0 kJ·mol−1, nên tốc độ tiến và nghịch bằng nhau nên không có thay đổi ròng') });
    }
    if (acts.reason) return Object.assign(base, { state: 'blocked', reason: L('ΔG not priced: ' + acts.reason, 'chưa tính ΔG: ' + acts.reason) });
    const e0 = intrinsicBarrier(
      terms.filter(t => t.nu < 0).map(t => ({ graph: graphOf(t.formula), nu: -t.nu })),
      terms.filter(t => t.nu > 0).map(t => ({ graph: graphOf(t.formula), nu: t.nu })),
      !!rx.protonTransfer);
    if (e0.value === null) {
      return Object.assign(base, { state: 'blocked', reason: L('barrier unknown — ' + e0.reason + ', and nothing fires on a guess',
        'chưa rõ rào cản — ' + e0.reason + ', và không có gì được bắn theo phỏng đoán') });
    }
    const pair = collisionPair(terms, classes);
    if (!pair.mode) return Object.assign(base, { state: 'blocked', reason: pair.reason });
    const pf = prefactor(pair, T, env().atm);
    if (!Number.isFinite(pf.A) || pf.A <= 0) {
      return Object.assign(base, { state: 'blocked', reason: L('no collision frequency follows from the measured sizes',
        'không có tần số va chạm nào suy ra từ các kích thước đo lường') });
    }
    // Marcus: the barrier falls as the reaction returns free energy. Beyond the
    // point where it would go negative the relation stops applying, and the floor
    // is zero.
    const ratio = e0.value > 0 ? Math.max(0, 1 + res.dG0 / (4 * e0.value)) : 1;
    let Ea = e0.value * ratio * ratio;
    if (!Number.isFinite(Ea) || Ea < 0) Ea = 0;
    const catalysts = applicableCatalysts(rx);
    if (catalysts.length) Ea = Math.max(0, Ea - Math.max(...catalysts.map(c => c.deltaEa)));
    const N = numerics();
    const source = L('measured bond dissociation enthalpies + collision theory + transition-state theory',
      'năng lượng phân ly liên kết đo lường + thuyết va chạm + thuyết trạng thái chuyển tiếp');
    let arr;
    try { arr = N.rate({ model: 'arrhenius', A: pf.A, Ea: Ea * 1000, provenance: 'calculated', source }, T, pair.order); } catch (e) {
      return Object.assign(base, { state: 'blocked', reason: L('the kinetics solver rejected this route (' + e.message + ')',
        'bộ giải động học từ chối phương trình này (' + e.message + ')') });
    }
    // ΔH‡ = Ea − nRT and ΔS‡ = R ln(Ah/(e kBT)) invert the same Eyring relation,
    // so ΔG‡ comes back out of the solver instead of being written twice.
    const molecularity = pair.mode === 'unimolecular' ? 1 : 2;
    const dHd = Ea * 1000 - molecularity * R * T;
    const dSd = R * (Math.log(pf.A) - Math.log(KB / PLANCK) - Math.log(T) - 1);
    let dGd = null;
    try {
      const eyr = N.rate({ model: 'eyring', dH: dHd, dS: dSd, provenance: 'calculated', source }, T, pair.order);
      dGd = eyr.barrier ? eyr.barrier.value : null;
    } catch (e) { dGd = null; }
    const numbers = { Ea, e0: e0.value, dGd, A: pf.A, units: pf.units, k: arr.k, logK: arr.logK,
      order: pair.order, catalysts: catalysts.map(c => c.formula).join(', '), mode: pair.mode,
      count: pair.count, conc: pf.conc === undefined ? (pair.mode === 'bimolecular' ? (pair.partner.x || 0) * env().atm / (R_L * T) : null) : pf.conc };
    if (!(arr.k > 0) || !Number.isFinite(arr.k)) {
      return Object.assign(base, { state: 'blocked', reason: L('the Arrhenius rate constant is not a positive finite number at ' + T.toFixed(2) + ' K',
        'hằng số tốc độ Arrhenius không phải số dương hữu hạn tại ' + T.toFixed(2) + ' K'), numbers });
    }
    // Rate per target molecule: a bimolecular step multiplies k by the partner's
    // concentration, an attempt frequency stands alone.
    const per = pair.mode === 'bimolecular' ? arr.k * numbers.conc : arr.k;
    if (!(pair.count > 0)) {
      return Object.assign(base, { state: 'blocked', reason: L('no molecules of ' + pair.target.formula + ' are present to react',
        'không có phân tử ' + pair.target.formula + ' nào hiện diện để phản ứng'), numbers });
    }
    numbers.lambda = per * pair.count;
    numbers.halfLife = numbers.lambda > 0 ? Math.LN2 / numbers.lambda : Infinity;
    numbers.per = per;
    if (numbers.lambda < LIVE_PER_SECOND) {
      return Object.assign(base, { state: 'frozen', numbers, reason: L('spontaneous but kinetically frozen: ΔG = ' + sci(base.drive, 2) +
        ' kJ·mol⁻¹ against a barrier of ' + sci(Ea, 1) + ' kJ·mol⁻¹, half-life ' + duration(numbers.halfLife),
        'tự diễn ra nhưng bị đóng băng động học: ΔG = ' + sci(base.drive, 2) + ' kJ·mol⁻¹ với rào cản ' + sci(Ea, 1) +
        ' kJ·mol⁻¹, nửa đời ' + duration(numbers.halfLife)) });
    }
    return Object.assign(base, { state: 'live', numbers });
  }

  // Builders spell the same species differently (C1H4 and CH4), and a '1' after an
  // atom symbol is never a real count, so both notations price one route.
  function displayEq(eq) { return String(eq).replace(/(\D)1(?!\d)/g, '$1'); }
  function lambdaOf(r) { return (r.numbers && r.numbers.lambda) || 0; }
  // The condition chip is decoration from the old catalog: nothing in this module
  // rates a route by it. Identity is the stoichiometry alone, so a curated equation
  // and the same equation found by the enumerator are one route, not two.
  // Multiplying every coefficient by the same whole number also writes the same
  // reaction, so identity is read from the lowest-term form: the catalog's
  // 4H2O -> 4H2 + 2O2 and the enumerator's 2H2O -> 2H2 + O2 are one route.
  function routeIdentity(rx) {
    const U = root.URPEGame;
    const terms = termsOf(rx);
    const gcd = (a, b) => (b ? gcd(b, a % b) : a);
    let g = 0;
    for (const t of terms) g = gcd(g, Math.abs(t.nu));
    if (!g) g = 1;
    return {
      id: terms.map(t => (t.nu > 0 ? '+' : '') + (t.nu / g) + U.canon(t.ref)).sort().join(','),
      scale: g
    };
  }

  // Molecular carbonic and sulfurous acid have no measured standard-state data
  // anywhere, because they are never isolated: what exists is the hydrated oxide.
  // A route that carries one of these acids is re-expressed with the acid replaced
  // by its oxide + water on the same side, which is the chemistry that actually
  // happens. A route that collapses to the same species on both sides is no
  // reaction at all and is dropped.
  function rewriteOxyacids(rx) {
    const a = auto();
    if (!a.oxyacidGas) return { rx: rx, drop: false };
    let touched = false;
    const expand = (entries, asMap) => {
      const out = asMap ? new Map() : [];
      const push = (f, n) => {
        const gas = a.oxyacidGas(f);
        if (!gas) {
          if (asMap) out.set(f, (out.get(f) || 0) + n);
          else out.push([f, n]);
          return;
        }
        touched = true;
        if (asMap) {
          out.set(gas, (out.get(gas) || 0) + n);
          out.set('H2O', (out.get('H2O') || 0) + n);
        } else {
          out.push([gas, n], ['H2O', n]);
        }
      };
      if (asMap) { for (const [f, n] of Object.entries(entries || {})) push(f, n); }
      else { for (const e of entries || []) push(e[0], e[1]); }
      return out;
    };
    const reactants = expand(rx.reactants, true);
    const products = expand(rx.products, false);
    if (!touched) return { rx: rx, drop: false };
    // An acid that is fully on one side with nothing else there can be cancelled
    // against equal amounts of the same species on the other side.
    const pCount = new Map();
    for (const [f, n] of products) pCount.set(f, (pCount.get(f) || 0) + n);
    const netR = new Map(), netP = new Map();
    for (const [f, n] of reactants) {
      const shared = Math.min(n, pCount.get(f) || 0);
      if (n > shared) netR.set(f, n - shared);
      pCount.set(f, (pCount.get(f) || 0) - shared);
    }
    for (const [f, n] of pCount) if (n > 0) netP.set(f, n);
    if (!netR.size || !netP.size) return { rx: rx, drop: true };
    const termStr = (m, sign) => [...m.entries()].sort()
      .map(([f, n]) => (n > 1 ? n : '') + f).join(sign === '-' ? ' + ' : ' + ');
    const eq = termStr(netR, '-') + ' -> ' + termStr(netP, '+');
    return {
      rx: Object.assign({}, rx, {
        reactants: Object.fromEntries(netR),
        products: [...netP.entries()],
        equation: eq
      }),
      drop: false
    };
  }

  // --- evaluation cache ------------------------------------------------------
  let cache = { key: null, routes: [], error: null };
  function evaluateAll() {
    if (!ready()) return [];
    const a = auto();
    const { T, bar } = env();
    const atmo = atmosphere();
    const classes = a.species();
    const key = [a.signature(), T, bar, a.mayhemOn() ? 'm' : '-', [...atmo.entries()].map(([f, r]) => f + ':' + r).sort().join(',')].join('|');
    if (cache.key === key) return cache.routes;
    GRAPHS = sceneGraphs();
    SIZES = new Map();
    let candidates = [];
    try { candidates = a.candidates(false) || []; } catch (e) { cache = { key, routes: [], error: e.message }; return []; }
    const routes = [];
    const sameRoute = new Map();
    for (const candidate of candidates) {
      const rewritten = rewriteOxyacids(candidate);
      if (rewritten.drop) continue;
      const rx = rewritten.rx;
      let ev;
      try { ev = evaluateRoute(rx, classes, atmo, T, bar); } catch (e) { ev = { state: 'blocked', reason: String((e && e.message) || e) }; }
      ev.rx = rx;
      const identity = routeIdentity(rx);
      ev.id = identity.id;
      ev.scale = identity.scale;
      ev.label = displayEq(rx.equation);
      const twin = sameRoute.get(ev.id);
      if (twin !== undefined) {
        // Two spellings of one reaction. Show the lowest-term form, because that is
        // the equation as chemistry writes it and its ΔG is per mole of reaction as
        // stated; the rate only breaks a tie between equally reduced forms.
        const held = routes[twin];
        if (ev.scale < held.scale ||
          (ev.scale === held.scale && lambdaOf(ev) > lambdaOf(held))) routes[twin] = ev;
        continue;
      }
      sameRoute.set(ev.id, routes.length);
      routes.push(ev);
    }
    const rank = { live: 0, frozen: 1, equilibrium: 2, uphill: 3, blocked: 4, nodata: 5 };
    routes.sort((x, y) => (rank[x.state] - rank[y.state]) ||
      (lambdaOf(y) - lambdaOf(x)) ||
      x.label.localeCompare(y.label));
    cache = { key, routes, error: null };
    dirty = true;
    return routes;
  }

  // --- firing loop (Step 5) --------------------------------------------------
  const fires = new Map();
  let eventsThisSecond = 0, secondStart = 0, lastFireAt = -1e9;
  function tick(now, dt) {
    if (!ready() || !Number.isFinite(dt) || dt <= 0) return;
    if (now - secondStart > 1000) { secondStart = now; eventsThisSecond = 0; }
    let routes;
    try { routes = evaluateAll(); } catch (e) { return; }
    paint();
    if (eventsThisSecond >= MAX_EVENTS_PER_SECOND || now - lastFireAt < MIN_GAP_MS) return;
    for (const r of routes) {
      if (r.state !== 'live') continue;
      // One Bernoulli trial per route per frame: λ·Δt is the expected number of
      // reaction events the rate law pays for in that slice of time.
      if (Math.random() >= -Math.expm1(-r.numbers.lambda * dt)) continue;
      let done = false;
      try { done = !!auto().execute(r.rx); } catch (e) { done = false; }
      if (!done) continue;
      lastFireAt = now;
      eventsThisSecond++;
      const prev = fires.get(r.id) || { n: 0, at: 0 };
      fires.set(r.id, { n: prev.n + 1, at: now });
      dirty = true;
      break; // one equation per frame; the gap cap paces the rest
    }
  }

  // --- panel -----------------------------------------------------------------
  const STYLE = [
    '.arxn-item{border:1px solid var(--border);border-radius:8px;padding:5px 8px;display:flex;flex-direction:column;gap:3px}',
    '.arxn-item[data-state="live"]{border-color:rgba(120,220,160,.6)}',
    '.arxn-item[data-state="frozen"]{border-color:rgba(230,190,110,.5)}',
    '.arxn-item[data-state="uphill"]{border-color:rgba(220,130,130,.42)}',
    '.arxn-item[data-state="nodata"],.arxn-item[data-state="blocked"]{opacity:.68}',
    '.arxn-state{font-size:11px;line-height:1.4;opacity:.9}',
    '.arxn-tag{display:inline-block;font-size:9.5px;font-weight:700;letter-spacing:.4px;' +
      'text-transform:uppercase;padding:1px 5px;margin-right:5px;border-radius:4px;vertical-align:1px}',
    '.arxn-tag.live{background:rgba(60,160,100,.3);color:#6fd39a}',
    '.arxn-tag.frozen{background:rgba(180,140,40,.28);color:#e8c26a}',
    '.arxn-tag.uphill{background:rgba(170,60,60,.28);color:#e88a8a}',
    '.arxn-tag.equilibrium{background:rgba(90,130,180,.28);color:#9cc3e8}',
    '.arxn-tag.nodata,.arxn-tag.blocked{background:rgba(130,130,140,.25);color:var(--muted)}',
    '.arxn-nums{font-size:11px;line-height:1.5;opacity:.92}',
    '.arxn-nums b{font-weight:600}',
    '.arxn-item details{font-size:11px;width:100%}',
    '.arxn-item summary{cursor:pointer;opacity:.75}',
    '.arxn-more{font-size:10.5px;opacity:.7;line-height:1.45}',
    '.arxn-showmore{display:block;width:100%;margin-top:5px;padding:6px 8px;font-size:11.5px;' +
      'font-weight:600;line-height:1.4;text-align:center;cursor:pointer;color:inherit;' +
      'background:rgba(127,127,127,.08);border:1px dashed var(--border);border-radius:8px}',
    '.arxn-showmore:hover{background:rgba(127,127,127,.16);border-style:solid}',
    '.auto-rxn-env b{font-weight:600}'
  ].join('');

  let panel = null, envBox = null, listBox = null, lastPaintKey = null, dirty = true, repaintAt = 0;
  const openIds = new Set();
  function mount() {
    panel = document.getElementById('auto-rxn-panel');
    envBox = document.getElementById('auto-rxn-env');
    listBox = document.getElementById('auto-rxn-list');
    if (!panel || !envBox || !listBox) return false;
    if (!document.getElementById('auto-rxn-style')) {
      const style = document.createElement('style');
      style.id = 'auto-rxn-style';
      style.textContent = STYLE;
      document.head.appendChild(style);
    }
    listBox.addEventListener('toggle', e => {
      const item = e.target.closest && e.target.closest('.arxn-item');
      if (!item) return;
      if (e.target.open) openIds.add(item.dataset.id); else openIds.delete(item.dataset.id);
    }, true);
    return true;
  }
  function envLine() {
    const { T, atm, bar } = env();
    const atmo = atmosphere();
    const parts = ['<b>' + esc(L('Environment', 'Điều kiện')) + '</b> ' + T.toFixed(2) + ' K · ' +
      sci(atm, atm < 10 ? 4 : 1) + ' atm (' + sci(bar, bar < 10 ? 3 : 1) + ' bar)'];
    if (atmo.size) {
      // composition stores mole fractions; the readout is a percentage.
      const asPct = (r) => { const p = r * 100; return p % 1 ? p.toFixed(2) : String(p); };
      parts.push(esc(L('atmosphere', 'khí quyển')) + ': ' + [...atmo.entries()].sort((x, y) => y[1] - x[1])
        .map(([f, r]) => esc(f) + ' ' + asPct(r) + '%').join(', '));
    } else {
      parts.push(esc(L('no atmosphere feed', 'không có nguồn khí quyển')));
    }
    if (auto().mayhemOn()) parts.push(esc(L('mayhem on', 'hỗn loạn đang bật')));
    return parts.join(' · ');
  }
  function numbersLine(r) {
    if (r.dG0 === undefined) return '';
    const bits = [];
    if (r.dH !== null) bits.push('<b>ΔH°</b> ' + sci(r.dH, 2) + ' kJ·mol⁻¹');
    if (r.dS !== null) bits.push('<b>ΔS°</b> ' + sci(r.dS, 2) + ' J·mol⁻¹·K⁻¹');
    bits.push('<b>ΔG°</b> ' + sci(r.dG0, 2) + ' kJ·mol⁻¹');
    if (r.dG !== null && r.dG !== undefined && r.dG !== r.dG0) bits.push('<b>ΔG</b> ' + sci(r.dG, 2) + ' kJ·mol⁻¹');
    if (r.spontaneity) {
      bits.push('<b>' + esc(L('spontaneity', 'tính tự diễn ra')) + '</b> ' + esc(
        r.spontaneity === 'favorable' ? L('favorable (ΔG < 0)', 'thuận (ΔG < 0)') :
        r.spontaneity === 'equilibrium' ? L('equilibrium (ΔG = 0)', 'cân bằng (ΔG = 0)') :
        L('non-spontaneous (ΔG > 0)', 'không tự phát (ΔG > 0)')));
    }
    if (r.warnings && r.warnings.length) {
      const shown = r.warnings.slice(0, 3);
      const more = r.warnings.length - shown.length;
      bits.push('<b>' + esc(L('theoretical inputs', 'dữ liệu lý thuyết')) + '</b> ' + esc(
        shown.map((w) => w.formula + ' (' + w.data_source + ')').join(', ') + (more > 0 ? ' +' + more : '')));
      if (r.reference) {
        bits.push('<b>' + esc(L('reference', 'chuẩn trạng thái')) + '</b> ' +
          r.reference.temperature_k.toFixed(2) + ' K · ' + sci(r.reference.pressure_bar, 3) + ' bar · ' +
          'ΔfH/ΔG ' + r.reference.units.delta_f_h + ' · S ' + r.reference.units.s);
      }
    }
    if (r.temperatureShift) {
      const ts = r.temperatureShift;
      bits.push('<b>' + esc(L('crossover', 'nhiệt độ đổi chiều')) + '</b> ' + esc(
        ts.crossoverK.toFixed(1) + ' K · ' +
        (ts.currentAbove ? L('above', 'trên') : L('below', 'dưới')) + ' ' +
        (ts.favorableAbove ? L('favourable side', 'chiều thuận') : L('unfavourable side', 'chiều bất thuận'))));
    }
    if (Number.isFinite(r.lnK)) bits.push('<b>K</b> ' + (Math.abs(r.lnK) > 700 ? 'e' + sup(r.lnK.toFixed(0)) : sci(r.K)));
    const n = r.numbers;
    if (n) {
      bits.push('<b>Eₐ</b> ' + sci(n.Ea, 1) + ' kJ·mol⁻¹');
      if (n.dGd !== null) bits.push('<b>ΔG‡</b> ' + sci(n.dGd, 1) + ' kJ·mol⁻¹');
      bits.push('<b>A</b> ' + sci(n.A, 2) + ' ' + n.units);
      bits.push('<b>k</b> ' + sci(n.k, 2) + (n.units ? ' ' + n.units : ''));
      if (n.conc) bits.push('<b>' + esc(L('partner', 'đối tác')) + '</b> ' + sci(n.conc, 3) + ' mol·L⁻¹');
      if (n.catalysts) bits.push(esc(L('catalysed by ', 'xúc tác bởi ')) + esc(n.catalysts));
    }
    return '<div class="arxn-nums">' + bits.join(' · ') + '</div>';
  }
  // Every row of this list is an equation the scene *could* run; only the ones
  // tagged as proceeding do. Without the tag on the row itself, a route priced as
  // uphill or frozen reads exactly like a promise, which is what a list of
  // equations looks like to a player.
  function tag(state) {
    const label = state === 'live' ? L('happening', 'đang xảy ra') :
      state === 'frozen' ? L('too slow', 'quá chậm') :
      state === 'equilibrium' ? L('equilibrium', 'cân bằng') :
      state === 'uphill' ? L("won't run", 'không xảy ra') :
      L('no data', 'thiếu dữ liệu');
    return '<span class="arxn-tag ' + state + '">' + esc(label) + '</span>';
  }
  function stateLine(r) {
    const f = fires.get(r.id);
    const tail = f ? ' · ' + esc(L('fired ' + f.n + '×', 'đã xảy ra ' + f.n + ' lần')) : '';
    // A route whose species came from the estimator rather than a cited table says
    // so on the row, because the verdict inherits the estimator's error bars.
    const est = r.state !== 'nodata' && r.estimated && r.estimated.length
      ? '<div class="arxn-state">' + esc(L('ΔfH°/S° estimated for ' + r.estimated.join(', ') +
          ' from the structure the game rebuilds for it (ideal gas at 298.15 K), not measured',
          'ΔfH°/S° của ' + r.estimated.join(', ') +
          ' được ước lượng từ cấu trúc game dựng lại cho nó (khí lý tưởng 298,15 K), không phải đo')) + '</div>'
      : '';
    if (r.state === 'live') {
      const n = r.numbers;
      return '<div class="arxn-state live">' + tag('live') + esc(L('proceeding: ΔG = ' + sci(r.drive, 2) + ' kJ·mol⁻¹, ' +
        sci(n.lambda, 3) + ' events·s⁻¹ over ' + n.count + ' molecule' + (n.count === 1 ? '' : 's') + ', half-life ' +
        duration(n.halfLife), 'đang tiến hành: ΔG = ' + sci(r.drive, 2) + ' kJ·mol⁻¹, ' +
        sci(n.lambda, 3) + ' biến·s⁻¹ trên ' + n.count + ' phân tử, nửa đời ' + duration(n.halfLife))) + tail + '</div>' + est;
    }
    if (r.state === 'nodata') {
      return '<div class="arxn-state">' + tag('nodata') + esc(L('no standard-state data and no structure to estimate one from for ',
        'không có dữ liệu chuẩn và không có cấu trúc để ước lượng cho ')) +
        r.missing.map(esc).join(', ') + esc(L(' — the numbers are left absent.', ' — các số liệu được để trống.')) + '</div>';
    }
    return '<div class="arxn-state">' + tag(r.state) + esc(r.reason || L('not priced', 'chưa tính')) + tail + '</div>' + est;
  }
  function row(r) {
    const a = auto();
    const el = document.createElement('div');
    el.className = 'arxn-item';
    el.dataset.state = r.state;
    el.dataset.id = r.id;
    let eq;
    try { eq = a.prettyEq(r.label); } catch (e) { eq = esc(r.label); }
    el.innerHTML = '<div class="arxn-eq">' + eq + ' <span class="cond-chip">' + esc(a.condLabel(r.rx.condition)) + '</span></div>' +
      numbersLine(r) + stateLine(r);
    if (r.numbers && r.numbers.Ea !== undefined) {
      const det = document.createElement('details');
      const sum = document.createElement('summary');
      let label;
      try { label = a.t('stoich.rxnTitle'); } catch (e) { label = L('Amounts, yield and Data Used', 'Lượng chất, hiệu suất và dữ liệu đã dùng'); }
      sum.textContent = label;
      det.appendChild(sum);
      try { const block = a.stoichBlock(r.rx); if (block) det.appendChild(block); } catch (e) { /* nothing extra to show */ }
      if (openIds.has(r.id)) det.open = true;
      el.appendChild(det);
    }
    return el;
  }
  function paint() {
    const now = performance.now();
    if (!panel && !mount()) return;
    if (!ready()) return;
    if (!dirty || now - repaintAt < PAINT_THROTTLE_MS) return;
    const routes = cache.routes;
    repaintAt = now;
    dirty = false;
    envBox.innerHTML = envLine();
    panel.classList.toggle('live', routes.length > 0);
    lastPaintKey = cache.key;
    if (!routes.length) {
      listBox.className = 'muted';
      listBox.innerHTML = '<div>' + esc(L('Place molecules and this lists every rearrangement the environment can price, then fires the ones with ΔG < 0.',
        'Hãy đặt các phân tử; bảng này liệt kê mọi sắp xếp lại mà môi trường tính được, rồi kích hoạt những phản ứng có ΔG < 0.')) + '</div>';
      return;
    }
    // Rebuilding the list would throw away a mass field the player is typing in.
    // The Show More button lives inside this list, so only real inputs block a rebuild.
    const active = document.activeElement;
    if (active && listBox.contains(active) && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) {
      dirty = true; return;
    }
    listBox.className = '';
    listBox.textContent = '';
    const shown = showAllRoutes ? routes : routes.slice(0, PANEL_ROWS);
    for (const r of shown) listBox.appendChild(row(r));
    if (routes.length > PANEL_ROWS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'arxn-showmore';
      const hidden = routes.length - PANEL_ROWS;
      btn.setAttribute('aria-expanded', String(showAllRoutes));
      btn.textContent = showAllRoutes
        ? L('Show less', 'Thu gọn')
        : L('+ ' + hidden + ' more reactions the maths approves — show all',
            '+ ' + hidden + ' phản ứng nữa mà toán học ủng hộ — xem tất cả');
      btn.addEventListener('click', () => {
        showAllRoutes = !showAllRoutes;
        dirty = true;
        repaintAt = 0; // the paint throttle must not swallow the click
        paint();
      });
      listBox.appendChild(btn);
    }
    if (!routes.some(r => r.state === 'live' || r.state === 'frozen')) {
      const note = document.createElement('div');
      note.className = 'arxn-more';
      note.textContent = L('None of these is both spontaneous and priced from measured data at these conditions.',
        'Không phương trình nào vừa tự diễn ra vừa được tính từ dữ liệu đo lường ở điều kiện này.');
      listBox.appendChild(note);
    }
  }

  function bind() {
    if (!ready() || !mount()) return false;
    for (const name of ['mol3d:environment', 'mol3d:lang', 'mol3d:theme', 'mol3d:reaction-completed']) {
      root.addEventListener(name, () => { cache.key = null; dirty = true; });
    }
    dirty = true;
    return true;
  }
  // The bundle loads as a module, so it finishes after this script does; the
  // world being present is what lets the panel bind.
  let bound = false, attempts = 0;
  function pump() {
    if (bound) return;
    if (bind()) { bound = true; return; }
    if (attempts++ < 1200) root.setTimeout(pump, 50);
  }
  pump();

  root.__mol3dAuto = {
    tick,
    evaluateAll: () => evaluateAll(),
    routes: () => cache.routes,
    env,
    size: f => sizeOf(graphOf(f)),
    graphs: () => GRAPHS,
    fires,
    repaint: () => { dirty = true; paint(); }
  };
})(window);
