// Universal chemical kinetics solver: mass-action ODE networks integrated
// with RK4. Fully data-driven — species and reactions are plain data, the
// engine has no knowledge of any specific chemistry.
//
// Network schema:
//   {
//     species?: string[],                          // inferred from reactions when omitted
//     initialConcentrations?: Record<string, number>,
//     reactions: Reaction[],
//   }
//   Reaction = {
//     reactants?: ({ speciesId, stoichiometry? } | string)[],  // string shorthand = 1
//     products?:  ({ speciesId, stoichiometry? } | string)[],
//     rateConstant: number,                        // k (also exposed to customRateExpr)
//     customRateExpr?: string | ((C, ctx) => number),
//   }
//
// Rate of progress for reaction j:
//   elementary:  r_j = k_j · ∏ [R_i]^(stoichiometry_i)
//   custom:      r_j = customRateExpr
// Net change (stoichiometry matrix ν, rows = species, cols = reactions):
//   d[C_i]/dt = Σ_j ν_ij · r_j ,   ν_ij = Σ products stoich − Σ reactants stoich

export class KineticsError extends Error {
  constructor(message) {
    super(`kinetics: ${message}`);
    this.name = 'KineticsError';
  }
}

function requireCond(cond, message) {
  if (!cond) throw new KineticsError(message);
}

// ── Rate expression parser ─────────────────────────────────────────────
// String form of customRateExpr, compiled to a closure (no eval / Function).
// Grammar:
//   expr  := term (('+' | '-') term)*
//   term  := power (('*' | '/') power)*
//   power := unary ('^' power)?          right-assoc, binds tighter than unary minus
//   unary := ('-' | '+') unary | atom
//   atom  := number | '[' species ']' | 'k' | '(' expr ')'
// [Sp] reads the (clamped ≥ 0) concentration of species Sp; k is the
// reaction's rateConstant. Returns (C, k) => number.

export function parseRateExpr(src, speciesIndex, context) {
  requireCond(typeof src === 'string' && src.trim().length > 0,
    `${context}: expression must be a non-empty string`);
  let pos = 0;
  const n = src.length;

  const fail = (msg) => { throw new KineticsError(`${context}: ${msg} (at position ${pos})`); };
  const skipWs = () => { while (pos < n && /\s/.test(src[pos])) pos++; };
  const peek = () => { skipWs(); return pos < n ? src[pos] : ''; };
  const eat = (ch) => { if (peek() === ch) { pos++; return true; } return false; };
  const expect = (ch) => { if (!eat(ch)) fail(`expected "${ch}"`); };

  function parseNumber() {
    skipWs();
    const m = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(src.slice(pos));
    if (!m) fail('expected a number');
    pos += m[0].length;
    const v = parseFloat(m[0]);
    return () => v;
  }

  function parseAtom() {
    if (eat('(')) {
      const v = parseExpr();
      expect(')');
      return v;
    }
    const c = peek();
    if (c === '[') {
      pos++;
      const end = src.indexOf(']', pos);
      if (end < 0) fail('unclosed "["');
      const id = src.slice(pos, end).trim();
      pos = end + 1;
      const i = speciesIndex.get(id);
      if (i == null) fail(`unknown species "${id}"`);
      return (C) => (C[i] > 0 ? C[i] : 0);
    }
    if (c === 'k' && !/[\w.]/.test(src[pos + 1] ?? '')) {
      pos++;
      return (C, k) => k;
    }
    if (/[A-Za-z_]/.test(c)) fail(`unexpected identifier — species must be written as [Name]`);
    return parseNumber();
  }

  function parseUnary() {
    if (eat('-')) { const u = parseUnary(); return (C, k) => -u(C, k); }
    if (eat('+')) return parseUnary();
    return parsePower();
  }

  function parsePower() {
    const base = parseAtom();
    if (eat('^')) {
      const e = parsePower();
      return (C, k) => Math.pow(base(C, k), e(C, k));
    }
    return base;
  }

  function parseTerm() {
    let v = parseUnary();
    for (;;) {
      if (eat('*')) { const w = parseUnary(), l = v; v = (C, k) => l(C, k) * w(C, k); }
      else if (eat('/')) { const w = parseUnary(), l = v; v = (C, k) => l(C, k) / w(C, k); }
      else return v;
    }
  }

  function parseExpr() {
    let v = parseTerm();
    for (;;) {
      if (eat('+')) { const w = parseTerm(), l = v; v = (C, k) => l(C, k) + w(C, k); }
      else if (eat('-')) { const w = parseTerm(), l = v; v = (C, k) => l(C, k) - w(C, k); }
      else return v;
    }
  }

  const fn = parseExpr();
  skipWs();
  if (pos < n) fail('unexpected trailing input');
  return fn;
}

// ── Network compiler ───────────────────────────────────────────────────

function normalizeSide(list, label, side) {
  if (list == null) return [];
  requireCond(Array.isArray(list), `${label}: "${side}" must be an array`);
  const out = [];
  for (const entry of list) {
    if (typeof entry === 'string') {
      out.push({ speciesId: entry, stoichiometry: 1 });
      continue;
    }
    requireCond(entry && typeof entry === 'object' && !Array.isArray(entry),
      `${label}: "${side}" entries must be { speciesId, stoichiometry } or strings`);
    requireCond(typeof entry.speciesId === 'string' && entry.speciesId.length > 0,
      `${label}: "${side}" entry is missing speciesId`);
    const stoich = entry.stoichiometry ?? 1;
    requireCond(Number.isFinite(stoich) && stoich > 0,
      `${label}: "${side}" stoichiometry for "${entry.speciesId}" must be a positive number`);
    out.push({ speciesId: entry.speciesId, stoichiometry: stoich });
  }
  return out;
}

export function compileNetwork(network) {
  requireCond(network && typeof network === 'object' && !Array.isArray(network),
    'network must be an object');
  requireCond(Array.isArray(network.reactions) && network.reactions.length > 0,
    'network.reactions must be a non-empty array');

  const referenced = new Set();
  for (const [j, r] of network.reactions.entries()) {
    requireCond(r && typeof r === 'object' && !Array.isArray(r),
      `reactions[${j}] must be an object`);
    for (const side of ['reactants', 'products']) {
      for (const e of normalizeSide(r[side], `reactions[${j}]`, side)) {
        referenced.add(e.speciesId);
      }
    }
  }

  let species;
  if (network.species != null) {
    requireCond(Array.isArray(network.species) && network.species.every(s => typeof s === 'string' && s.length > 0),
      'network.species must be an array of non-empty strings');
    species = [...network.species];
    const declared = new Set(species);
    requireCond(declared.size === species.length, 'network.species contains duplicate ids');
    for (const s of referenced) {
      requireCond(declared.has(s), `species "${s}" is referenced by reactions but missing from network.species`);
    }
  } else {
    species = [...referenced];
  }
  const S = species.length;
  const index = new Map(species.map((s, i) => [s, i]));

  const initial = new Float64Array(S);
  if (network.initialConcentrations != null) {
    requireCond(typeof network.initialConcentrations === 'object' && !Array.isArray(network.initialConcentrations),
      'initialConcentrations must be an object mapping speciesId -> number');
    for (const [id, v] of Object.entries(network.initialConcentrations)) {
      requireCond(index.has(id), `initialConcentrations: unknown species "${id}"`);
      requireCond(Number.isFinite(v) && v >= 0,
        `initialConcentrations["${id}"] must be a finite non-negative number`);
      initial[index.get(id)] = v;
    }
  }

  const concReader = (C) => (id) => {
    const i = index.get(id);
    return i == null ? undefined : C[i];
  };

  const reactions = network.reactions.map((r, j) => {
    const label = `reactions[${j}]`;
    const reactants = normalizeSide(r.reactants, label, 'reactants');
    const products = normalizeSide(r.products, label, 'products');
    requireCond(reactants.length + products.length > 0,
      `${label}: must have at least one reactant or product`);
    const k = r.rateConstant;
    requireCond(Number.isFinite(k) && k >= 0,
      `${label}: rateConstant must be a finite non-negative number`);

    let rate;
    if (r.customRateExpr != null) {
      const fn = typeof r.customRateExpr === 'function'
        ? (C, kk, t) => r.customRateExpr(C, { k: kk, time: t, conc: concReader(C) })
        : parseRateExpr(r.customRateExpr, index, `${label}.customRateExpr`);
      rate = (C, t) => {
        const v = fn(C, k, t);
        requireCond(Number.isFinite(v), `${label}: custom rate expression produced a non-finite value`);
        return v;
      };
    } else {
      const pairs = reactants.map(e => [index.get(e.speciesId), e.stoichiometry]);
      rate = (C) => {
        if (k === 0) return 0;
        let v = k;
        for (const [i, p] of pairs) {
          const c = C[i] > 0 ? C[i] : 0;
          v *= p === 1 ? c : Math.pow(c, p);
        }
        requireCond(Number.isFinite(v), `${label}: mass-action rate overflowed`);
        return v;
      };
    }

    const net = new Map();
    for (const e of reactants) {
      const i = index.get(e.speciesId);
      net.set(i, (net.get(i) ?? 0) - e.stoichiometry);
    }
    for (const e of products) {
      const i = index.get(e.speciesId);
      net.set(i, (net.get(i) ?? 0) + e.stoichiometry);
    }
    const netPairs = [...net.entries()].filter(([, nu]) => nu !== 0);

    return { label, k, rate, net: netPairs };
  });

  const derivative = (C, t) => {
    const dC = new Float64Array(S);
    for (const rx of reactions) {
      const v = rx.rate(C, t);
      if (v !== 0) for (const [i, nu] of rx.net) dC[i] += nu * v;
    }
    return dC;
  };

  const stoichMatrix = Array.from({ length: S }, () => new Array(reactions.length).fill(0));
  reactions.forEach((rx, j) => {
    for (const [i, nu] of rx.net) stoichMatrix[i][j] = nu;
  });

  return { species, index, initial, reactions, derivative, stoichMatrix };
}

// ── RK4 integrator ─────────────────────────────────────────────────────
// One generic step for ANY autonomous ODE system dC/dt = f(C, t):
//   C(t+dt) = C + dt/6 · (k1 + 2k2 + 2k3 + k4)

export function rk4Step(f, C, dt) {
  const S = C.length;
  const k1 = f(C);
  const y2 = new Float64Array(S);
  const y3 = new Float64Array(S);
  const y4 = new Float64Array(S);
  for (let i = 0; i < S; i++) y2[i] = C[i] + (dt / 2) * k1[i];
  const k2 = f(y2);
  for (let i = 0; i < S; i++) y3[i] = C[i] + (dt / 2) * k2[i];
  const k3 = f(y3);
  for (let i = 0; i < S; i++) y4[i] = C[i] + dt * k3[i];
  const k4 = f(y4);
  const out = new Float64Array(S);
  for (let i = 0; i < S; i++) {
    const v = C[i] + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
    out[i] = v > 0 ? v : 0; // concentrations are physically non-negative
  }
  return out;
}

// ── Simulator (state update loop) ──────────────────────────────────────

export function createSimulation(network) {
  const { species, index, initial, reactions, derivative, stoichMatrix } = compileNetwork(network);
  let C = initial.slice();
  let t = 0;

  const sim = {
    species: species.slice(),
    get time() { return t; },
    get C() { return C.slice(); },
    stoichMatrix: () => stoichMatrix.map(row => row.slice()),
    concentration(id) {
      const i = index.get(id);
      requireCond(i != null, `unknown species "${id}"`);
      return C[i];
    },
    concentrations: () => Object.fromEntries(species.map((s, i) => [s, C[i]])),
    rates: () => reactions.map(rx => rx.rate(C, t)),
    dCdt() {
      const d = derivative(C, t);
      return Object.fromEntries(species.map((s, i) => [s, d[i]]));
    },
    step(dt) {
      requireCond(Number.isFinite(dt) && dt >= 0, 'dt must be a finite non-negative number');
      if (dt > 0) {
        C = rk4Step(derivative, C, dt);
        t += dt;
      }
      return sim.concentrations();
    },
    advance(T, { maxStep = 0.01 } = {}) {
      requireCond(Number.isFinite(T) && T >= 0, 'T must be a finite non-negative number');
      requireCond(Number.isFinite(maxStep) && maxStep > 0, 'maxStep must be a finite positive number');
      if (T === 0) return { steps: 0, time: t };
      const steps = Math.max(1, Math.ceil(T / maxStep));
      const h = T / steps;
      for (let s = 0; s < steps; s++) sim.step(h);
      return { steps, time: t };
    },
    reset() {
      C = initial.slice();
      t = 0;
    },
  };
  return sim;
}
