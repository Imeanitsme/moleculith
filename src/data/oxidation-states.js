// Oxidation state data and electronegativity-aware solver.
// Covers all elements with variable oxidation states plus the common
// fixed-state elements. The solver handles peroxides, hydrides, and
// the sum-to-zero constraint for neutral compounds.

export const OXIDATION_STATES = {
  'H':  { states: [1, -1],    en: 2.20 },
  'O':  { states: [-2, -1],   en: 3.44 },
  'F':  { states: [-1],       en: 3.98 },
  'Li': { states: [1],        en: 0.98 },
  'Na': { states: [1],        en: 0.93 },
  'K':  { states: [1],        en: 0.82 },
  'Rb': { states: [1],        en: 0.82 },
  'Cs': { states: [1],        en: 0.79 },
  'Be': { states: [2],        en: 1.57 },
  'Mg': { states: [2],        en: 1.31 },
  'Ca': { states: [2],        en: 1.00 },
  'Sr': { states: [2],        en: 0.95 },
  'Ba': { states: [2],        en: 0.95 },
  'Al': { states: [3],        en: 1.61 },
  'Zn': { states: [2],        en: 1.65 },
  'Ag': { states: [1],        en: 1.93 },
  'Cu': { states: [2, 1],     en: 1.90 },
  'Fe': { states: [3, 2],     en: 1.83 },
  'Mn': { states: [7, 4, 3, 2], en: 1.55 },
  'Cr': { states: [6, 3, 2],  en: 1.66 },
  'Ni': { states: [2],        en: 1.91 },
  'Co': { states: [3, 2],     en: 1.88 },
  'Pb': { states: [2, 4],     en: 2.33 },
  'Sn': { states: [2, 4],     en: 1.96 },
  'Cl': { states: [-1, 1, 3, 5, 7], en: 3.16 },
  'Br': { states: [-1, 1, 3, 5],    en: 2.96 },
  'I':  { states: [-1, 1, 3, 5, 7], en: 2.66 },
  'S':  { states: [-2, 4, 6], en: 2.58 },
  'N':  { states: [-3, -2, -1, 1, 2, 3, 4, 5], en: 3.04 },
  'P':  { states: [-3, 3, 5], en: 2.19 },
  'C':  { states: [4, 2, -4], en: 2.55 },
  'W':  { states: [6],        en: 2.36 },
  'Mo': { states: [6, 5, 4, 3, 2], en: 2.16 },
  'V':  { states: [5, 4, 3, 2], en: 1.63 },
  'Ti': { states: [4, 3, 2],  en: 1.54 },
  'Au': { states: [3, 1],     en: 2.54 },
  'Pt': { states: [4, 2],     en: 2.28 },
  'Pd': { states: [4, 2],     en: 2.20 },
  'Hg': { states: [2, 1],     en: 2.00 },
  'Cd': { states: [2],        en: 1.69 },
  'As': { states: [-3, 3, 5], en: 2.18 },
  'Sb': { states: [-3, 3, 5], en: 2.05 },
  'Bi': { states: [3, 5],     en: 2.02 },
  'Se': { states: [-2, 4, 6], en: 2.55 },
  'Te': { states: [-2, 4, 6], en: 2.10 },
  'B':  { states: [3],        en: 2.04 },
  'Si': { states: [4],        en: 1.90 },
  'Ge': { states: [4, 2],     en: 2.01 },
};

const METALS = new Set([
  'Li','Na','K','Rb','Cs','Be','Mg','Ca','Sr','Ba','Al','Zn','Ag',
  'Cu','Fe','Mn','Cr','Ni','Co','Pb','Sn','W','Mo','V','Ti','Au',
  'Pt','Pd','Hg','Cd','Bi','Sb',
]);

export function isMetal(sym) {
  return METALS.has(sym);
}

// Determine the oxidation state of `sym` within `formula` (a parsed Map or
// formula string). Uses electronegativity ordering and special-case rules
// for peroxides, superoxides, and hydrides.
export function inferOxidationState(sym, formula) {
  const parsed = typeof formula === 'string' ? parseFormulaSimple(formula) : formula;
  if (!parsed || !parsed.has(sym)) return 0;

  const entry = OXIDATION_STATES[sym];
  if (!entry) return 0;

  if (sym === 'F') return -1;

  if (sym === 'O') {
    const oCount = parsed.get('O');
    if (parsed.size === 2 && parsed.has('H') && parsed.get('H') === oCount && oCount >= 2) return -1;
    for (const alkali of ['Na', 'K', 'Rb', 'Cs']) {
      if (parsed.has(alkali)) {
        const metalCount = parsed.get(alkali);
        if (oCount === metalCount && oCount >= 2) return -1;
        if (oCount === 2 * metalCount && metalCount >= 1) return -0.5;
      }
    }
    return -2;
  }

  if (sym === 'H') {
    const bondedToMetal = [...parsed.keys()].some(s => s !== 'H' && s !== 'O' && isMetal(s));
    if (bondedToMetal && !parsed.has('O')) return -1;
    return 1;
  }

  const symCount = parsed.get(sym);
  let knownCharge = 0;
  let unknownCount = 0;

  for (const [s, count] of parsed) {
    if (s === sym) continue;
    const sEntry = OXIDATION_STATES[s];
    if (!sEntry) { unknownCount += count; continue; }

    let sState;
    if (s === 'F') { sState = -1; }
    else if (s === 'O') { sState = -2; }
    else if (s === 'H') {
      sState = isMetal(sym) ? -1 : 1;
    } else {
      const moreEN = sEntry.en > entry.en;
      if (moreEN) {
        sState = sEntry.states.find(st => st < 0) ?? sEntry.states[0];
      } else {
        sState = sEntry.states.find(st => st > 0) ?? sEntry.states[0];
      }
    }
    knownCharge += sState * count;
  }

  if (unknownCount > 0 && symCount > 0) {
    const needed = -knownCharge;
    const perAtom = needed / symCount;
    const closest = entry.states.reduce((best, st) =>
      Math.abs(st - perAtom) < Math.abs(best - perAtom) ? st : best
    );
    return closest;
  }

  if (symCount > 0) {
    const needed = -knownCharge;
    const perAtom = needed / symCount;
    const exact = entry.states.find(st => Math.abs(st - perAtom) < 0.01);
    if (exact !== undefined) return exact;
    const closest = entry.states.reduce((best, st) =>
      Math.abs(st - perAtom) < Math.abs(best - perAtom) ? st : best
    );
    return closest;
  }

  return entry.states[0];
}

// Detect which elements change oxidation state across a set of formulas
// (reactants + products). Returns { oxidized, reduced } or null.
export function detectRedoxChanges(formulaGroups) {
  // formulaGroups: [{ formulas: string[], role: 'reactant'|'product' }]
  const allElements = new Set();
  for (const group of formulaGroups) {
    for (const f of group.formulas) {
      const parsed = parseFormulaSimple(f);
      if (!parsed) continue;
      for (const sym of parsed.keys()) {
        if (sym !== 'H' && sym !== 'O') allElements.add(sym);
      }
    }
  }

  const changes = [];
  for (const sym of allElements) {
    const reactantStates = new Set();
    const productStates = new Set();

    for (const group of formulaGroups) {
      for (const f of group.formulas) {
        const parsed = parseFormulaSimple(f);
        if (!parsed || !parsed.has(sym)) continue;
        const state = inferOxidationState(sym, parsed);
        if (group.role === 'reactant') reactantStates.add(state);
        else productStates.add(state);
      }
    }

    if (reactantStates.size > 0 && productStates.size > 0) {
      const rStates = [...reactantStates];
      const pStates = [...productStates];
      const minR = Math.min(...rStates);
      const maxR = Math.max(...rStates);
      const minP = Math.min(...pStates);
      const maxP = Math.max(...pStates);

      if (minP > maxR) {
        changes.push({ sym, type: 'oxidized', from: minR, to: minP });
      } else if (maxP < minR) {
        changes.push({ sym, type: 'reduced', from: maxR, to: maxP });
      } else if (minP < minR && maxP > maxR) {
        changes.push({ sym, type: 'disproportionated', from: minR, toLower: minP, toHigher: maxP });
      }
    }
  }

  if (changes.length === 0) return null;

  const oxidized = changes.find(c => c.type === 'oxidized');
  const reduced = changes.find(c => c.type === 'reduced');
  const disproportionated = changes.find(c => c.type === 'disproportionated');

  return { oxidized, reduced, disproportionated, all: changes };
}

// Detect comproportionation: two reactants with same element at different
// oxidation states converge to one state in the product.
export function detectComproportionation(reactants, products) {
  const allElements = new Set();
  for (const f of [...reactants, ...products]) {
    const parsed = parseFormulaSimple(f);
    if (!parsed) continue;
    for (const sym of parsed.keys()) {
      if (sym !== 'H' && sym !== 'O') allElements.add(sym);
    }
  }

  for (const sym of allElements) {
    const reactantStates = new Map();
    for (const f of reactants) {
      const parsed = parseFormulaSimple(f);
      if (!parsed || !parsed.has(sym)) continue;
      const state = inferOxidationState(sym, parsed);
      if (!reactantStates.has(state)) reactantStates.set(state, []);
      reactantStates.get(state).push(f);
    }

    if (reactantStates.size < 2) continue;

    const productStates = new Set();
    for (const f of products) {
      const parsed = parseFormulaSimple(f);
      if (!parsed || !parsed.has(sym)) continue;
      productStates.add(inferOxidationState(sym, parsed));
    }

    if (productStates.size === 1) {
      const pState = [...productStates][0];
      const rStates = [...reactantStates.keys()].sort((a, b) => a - b);
      if (pState > rStates[0] && pState < rStates[rStates.length - 1]) {
        return {
          sym,
          fromStates: rStates,
          toState: pState,
          fromFormulas: rStates.map(s => reactantStates.get(s)),
        };
      }
    }
  }
  return null;
}

function parseFormulaSimple(f) {
  const result = new Map();
  const re = /([A-Z][a-z]?)(\d*)/g;
  let m;
  while ((m = re.exec(f)) !== null) {
    if (!m[1]) continue;
    const count = m[2] ? parseInt(m[2]) : 1;
    result.set(m[1], (result.get(m[1]) || 0) + count);
  }
  return result.size > 0 ? result : null;
}
