import { elementBySym } from './elements.js';

// Avogadro constant (exact, SI definition)
export const AVOGADRO = 6.02214076e23;

// main.js overrides this so custom/mayhem elements resolve too.
let elementOf = (sym) => elementBySym(sym);
export function setElementLookup(fn) { elementOf = fn; }

// Parse a molecular formula into a Map of symbol -> count.
// Handles nested parentheses/brackets and ignores charges, dots, spaces.
export function formulaCounts(formula) {
  const counts = new Map();
  if (typeof formula !== 'string' || !formula) return counts;
  let i = 0;
  const walk = () => {
    const local = new Map();
    const add = (sym, n) => local.set(sym, (local.get(sym) || 0) + n);
    while (i < formula.length) {
      const ch = formula[i];
      if (ch === ')' || ch === ']') { i++; return local; }
      if (ch === '(' || ch === '[') {
        i++;
        const g = walk();
        const num = /^(\d+)/.exec(formula.slice(i));
        let n = 1;
        if (num) { n = parseInt(num[1], 10); i += num[1].length; }
        for (const [s, c] of g) add(s, c * n);
        continue;
      }
      const m = /^[A-Z][a-z]?/.exec(formula.slice(i));
      if (!m) { i++; continue; }
      i += m[0].length;
      const num = /^(\d+)/.exec(formula.slice(i));
      let n = 1;
      if (num) { n = parseInt(num[1], 10); i += num[1].length; }
      add(m[0], n);
    }
    return local;
  };
  for (const [sym, n] of walk()) counts.set(sym, n);
  return counts;
}

// Molar mass in g/mol, or null if any symbol is unknown.
export function molarMass(formula) {
  let total = 0;
  for (const [sym, n] of formulaCounts(formula)) {
    const el = elementOf(sym);
    if (!el || typeof el.mass !== 'number') return null;
    total += el.mass * n;
  }
  return formulaCounts(formula).size ? total : null;
}

// Per-element breakdown: rows sorted by mass share.
export function compositionOf(formula) {
  const counts = formulaCounts(formula);
  if (!counts.size) return null;
  const rows = [];
  for (const [sym, n] of counts) {
    const el = elementOf(sym);
    if (!el || typeof el.mass !== 'number') return null;
    rows.push({ sym, name: el.name, z: el.z, count: n, atomicMass: el.mass, subtotal: el.mass * n });
  }
  const total = rows.reduce((s, r) => s + r.subtotal, 0);
  for (const r of rows) r.pct = total > 0 ? (r.subtotal / total) * 100 : 0;
  rows.sort((a, b) => b.subtotal - a.subtotal);
  return { rows, total };
}

// Limiting-reagent analysis for a reaction rx (reactants: formula->coeff,
// products: [[formula, count],...]) given available moles per reactant formula.
export function limitingAnalysis(rx, molesByFormula) {
  const extents = [];
  for (const [f, coeff] of Object.entries(rx.reactants)) {
    const n = molesByFormula.get(f);
    if (typeof n !== 'number' || !isFinite(n) || n < 0) return null;
    extents.push({ formula: f, coeff, moles: n, extent: n / coeff });
  }
  if (!extents.length) return null;
  const limiting = extents.reduce((a, b) => (b.extent < a.extent ? b : a));
  const products = [];
  for (const [f, count] of rx.products) {
    const moles = limiting.extent * count;
    const m = molarMass(f);
    products.push({ formula: f, count, moles, mass: m === null ? null : moles * m });
  }
  const leftovers = extents
    .filter(e => e !== limiting && limiting.extent * e.coeff < e.moles)
    .map(e => ({ formula: e.formula, moles: e.moles - limiting.extent * e.coeff }));
  return {
    limiting: { formula: limiting.formula, extent: limiting.extent },
    reactants: extents,
    products,
    leftovers,
  };
}

// Compact number formatting: 4 significant digits, exponential for extremes.
export function fmtAmount(x, sig = 4) {
  if (typeof x !== 'number' || !isFinite(x)) return '—';
  if (x === 0) return '0';
  const a = Math.abs(x);
  if (a >= 1e6 || a < 1e-4) {
    return x.toExponential(Math.max(sig - 1, 0)).replace(/\.?0+e/, 'e');
  }
  const d = Math.max(0, sig - 1 - Math.floor(Math.log10(a)));
  return x.toFixed(Math.min(d, 6)).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}
