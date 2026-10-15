// Reaction engine: equations matched by exact component-formula multisets,
// executed by reusing reactant atoms (conservation of mass) and wiring them
// into explicit product templates.
//
// Product template: { atoms: [elementSymbol], bonds: [[i, j, order, ionic?]] }.
// `charge` forces the product component's ion charge (e.g. NH4+ / Cl-).
import { elementBySym, isMetal } from './elements.js';
import { MAYHEM_ELEMENTS, MAYHEM_REACTIONS } from './mayhem.js';
import { structuralFingerprint } from './chemistry.js';
import { classifyMolecule, nameMolecule } from './names.js';
const T = {
  H2O:   { atoms: ['O', 'H', 'H'], bonds: [[0, 1, 1], [0, 2, 1]] },
  HCl:   { atoms: ['H', 'Cl'], bonds: [[0, 1, 1]] },
  NH3:   { atoms: ['N', 'H', 'H', 'H'], bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1]] },
  MgO:   { atoms: ['Mg', 'O'], bonds: [[0, 1, 2, true]] },
  NaCl:  { atoms: ['Na', 'Cl'], bonds: [[0, 1, 1, true]] },
  CaO:   { atoms: ['Ca', 'O'], bonds: [[0, 1, 2, true]] },
  CaOH2: { atoms: ['Ca', 'O', 'O', 'H', 'H'], bonds: [[0, 1, 1, true], [0, 2, 1, true], [1, 3, 1], [2, 4, 1]] },
  CaCO3: { atoms: ['Ca', 'C', 'O', 'O', 'O'], bonds: [[0, 2, 1, true], [0, 3, 1, true], [1, 2, 1], [1, 3, 1], [1, 4, 2]] },
  NaOH:  { atoms: ['Na', 'O', 'H'], bonds: [[0, 1, 1, true], [1, 2, 1]] },
  KOH:   { atoms: ['K', 'O', 'H'], bonds: [[0, 1, 1, true], [1, 2, 1]] },
  MgCl2: { atoms: ['Mg', 'Cl', 'Cl'], bonds: [[0, 1, 1, true], [0, 2, 1, true]] },
  AlCl3: { atoms: ['Al', 'Cl', 'Cl', 'Cl'], bonds: [[0, 1, 1, true], [0, 2, 1, true], [0, 3, 1, true]] },
  CO2:   { atoms: ['C', 'O', 'O'], bonds: [[0, 1, 2], [0, 2, 2]] },
  O2:    { atoms: ['O', 'O'], bonds: [[0, 1, 2]] },
  O3:    { atoms: ['O', 'O', 'O'], bonds: [[0, 1, 1], [1, 2, 2]] },
  NO:    { atoms: ['N', 'O'], bonds: [[0, 1, 2]] },
  H2:    { atoms: ['H', 'H'], bonds: [[0, 1, 1]] },
  SO2:   { atoms: ['S', 'O', 'O'], bonds: [[0, 1, 2], [0, 2, 2]] },
  SO3:   { atoms: ['S', 'O', 'O', 'O'], bonds: [[0, 1, 2], [0, 2, 2], [0, 3, 2]] },
  H2SO4: { atoms: ['S', 'O', 'O', 'O', 'O', 'H', 'H'], bonds: [[0, 1, 2], [0, 2, 2], [0, 3, 1], [0, 4, 1], [3, 5, 1], [4, 6, 1]] },
  HNO3:  { atoms: ['H', 'O', 'N', 'O', 'O'], bonds: [[0, 1, 1], [1, 2, 1], [2, 3, 2], [2, 4, 2]] },
  NH4:   { atoms: ['N', 'H', 'H', 'H', 'H'], bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1]], charge: 1 },
  ClI:   { atoms: ['Cl'], bonds: [], charge: -1 },
  MnO2:  { atoms: ['Mn', 'O', 'O'], bonds: [[0, 1, 2, true], [0, 2, 2, true]] },
  MnCl2: { atoms: ['Mn', 'Cl', 'Cl'], bonds: [[0, 1, 1, true], [0, 2, 1, true]] },
  Cl2:   { atoms: ['Cl', 'Cl'], bonds: [[0, 1, 1]] },
  KCl:   { atoms: ['K', 'Cl'], bonds: [[0, 1, 1, true]] },
  Na2SO4: { atoms: ['Na', 'Na', 'S', 'O', 'O', 'O', 'O'], bonds: [[0, 2, 1, true], [1, 2, 1, true], [2, 3, 2], [2, 4, 2], [2, 5, 1], [2, 6, 1]] },
  K2SO4: { atoms: ['K', 'K', 'S', 'O', 'O', 'O', 'O'], bonds: [[0, 2, 1, true], [1, 2, 1, true], [2, 3, 2], [2, 4, 2], [2, 5, 1], [2, 6, 1]] },
  CaCl2: { atoms: ['Ca', 'Cl', 'Cl'], bonds: [[0, 1, 1, true], [0, 2, 1, true]] },
  Al2O3: { atoms: ['Al', 'Al', 'O', 'O', 'O'], bonds: [[0, 2, 2, true], [0, 3, 2, true], [0, 4, 2, true], [1, 2, 2, true], [1, 3, 2, true], [1, 4, 2, true]] },
  Fe: { atoms: ['Fe'], bonds: [] },
  Cu: { atoms: ['Cu'], bonds: [] },
  Ag: { atoms: ['Ag'], bonds: [] },
  Zn: { atoms: ['Zn'], bonds: [] },
  Na: { atoms: ['Na'], bonds: [] },
  Al: { atoms: ['Al'], bonds: [] },
  K: { atoms: ['K'], bonds: [] },
  Ca: { atoms: ['Ca'], bonds: [] },
  Mg: { atoms: ['Mg'], bonds: [] },

  // ── Hydrocarbons ──
  CH4:   { atoms: ['C', 'H', 'H', 'H', 'H'], bonds: [[0,1,1],[0,2,1],[0,3,1],[0,4,1]] },
  C2H6:  { atoms: ['C','C','H','H','H','H','H','H'], bonds: [[0,1,1],[0,2,1],[0,3,1],[0,4,1],[1,5,1],[1,6,1],[1,7,1]] },
  C3H8:  { atoms: ['C','C','C','H','H','H','H','H','H','H','H'], bonds: [[0,1,1],[1,2,1],[0,3,1],[0,4,1],[0,5,1],[1,6,1],[1,7,1],[2,8,1],[2,9,1],[2,10,1]] },
  C2H4:  { atoms: ['C','C','H','H','H','H'], bonds: [[0,1,2],[0,2,1],[0,3,1],[1,4,1],[1,5,1]] },
  C3H6:  { atoms: ['C','C','C','H','H','H','H','H','H'], bonds: [[0,1,2],[1,2,1],[0,3,1],[0,4,1],[1,5,1],[2,6,1],[2,7,1],[2,8,1]] },
  C2H2:  { atoms: ['C','C','H','H'], bonds: [[0,1,3],[0,2,1],[1,3,1]] },
  C6H6:  { atoms: ['C','C','C','C','C','C','H','H','H','H','H','H'], bonds: [[0,1,2],[1,2,1],[2,3,2],[3,4,1],[4,5,2],[5,0,1],[0,6,1],[1,7,1],[2,8,1],[3,9,1],[4,10,1],[5,11,1]] },

  // ── Alcohols ──
  CH4O:  { atoms: ['C','O','H','H','H','H'], bonds: [[0,1,1],[0,2,1],[0,3,1],[0,4,1],[1,5,1]] },
  C2H6O: { atoms: ['C','C','O','H','H','H','H','H','H'], bonds: [[0,1,1],[1,2,1],[0,3,1],[0,4,1],[0,5,1],[1,6,1],[1,7,1],[2,8,1]] },

  // ── Aldehydes ──
  CH2O:  { atoms: ['C','O','H','H'], bonds: [[0,1,2],[0,2,1],[0,3,1]] },
  C2H4O: { atoms: ['C','C','O','H','H','H','H'], bonds: [[0,1,1],[1,2,2],[0,3,1],[0,4,1],[0,5,1],[1,6,1]] },

  // ── Ketones ──
  C3H6O: { atoms: ['C','C','C','O','H','H','H','H','H','H'], bonds: [[0,1,1],[1,2,1],[1,3,2],[0,4,1],[0,5,1],[0,6,1],[2,7,1],[2,8,1],[2,9,1]] },

  // ── Carboxylic acids ──
  CH2O2: { atoms: ['C','O','O','H','H'], bonds: [[0,1,2],[0,2,1],[0,3,1],[2,4,1]] },
  C2H4O2:{ atoms: ['C','C','O','O','H','H','H','H'], bonds: [[0,1,1],[1,2,2],[1,3,1],[0,4,1],[0,5,1],[0,6,1],[3,7,1]] },

  // ── Esters ──
  C3H6O2:{ atoms: ['C','C','O','O','C','H','H','H','H','H','H'], bonds: [[0,1,1],[1,2,2],[1,3,1],[3,4,1],[0,5,1],[0,6,1],[0,7,1],[4,8,1],[4,9,1],[4,10,1]] },
  C4H8O2:{ atoms: ['C','C','O','O','C','C','H','H','H','H','H','H','H','H'], bonds: [[0,1,1],[1,2,2],[1,3,1],[3,4,1],[4,5,1],[0,6,1],[0,7,1],[0,8,1],[4,9,1],[4,10,1],[5,11,1],[5,12,1],[5,13,1]] },

  // ── Amines ──
  CH5N:  { atoms: ['C','N','H','H','H','H','H'], bonds: [[0,1,1],[0,2,1],[0,3,1],[0,4,1],[1,5,1],[1,6,1]] },
  C2H7N: { atoms: ['C','C','N','H','H','H','H','H','H','H'], bonds: [[0,1,1],[1,2,1],[0,3,1],[0,4,1],[0,5,1],[1,6,1],[1,7,1],[2,8,1],[2,9,1]] },

  // ── Haloalkanes ──
  CH3Cl: { atoms: ['C','Cl','H','H','H'], bonds: [[0,1,1],[0,2,1],[0,3,1],[0,4,1]] },
  CH2Cl2:{ atoms: ['C','Cl','Cl','H','H'], bonds: [[0,1,1],[0,2,1],[0,3,1],[0,4,1]] },
  CHCl3: { atoms: ['C','Cl','Cl','Cl','H'], bonds: [[0,1,1],[0,2,1],[0,3,1],[0,4,1]] },
  CCl4:  { atoms: ['C','Cl','Cl','Cl','Cl'], bonds: [[0,1,1],[0,2,1],[0,3,1],[0,4,1]] },
  C2H5Cl:{ atoms: ['C','C','Cl','H','H','H','H','H'], bonds: [[0,1,1],[1,2,1],[0,3,1],[0,4,1],[0,5,1],[1,6,1],[1,7,1]] },
  HBr:   { atoms: ['H','Br'], bonds: [[0,1,1]] },
  HI:    { atoms: ['H','I'], bonds: [[0,1,1]] },
  HF:    { atoms: ['H','F'], bonds: [[0,1,1]] },
  Br2:   { atoms: ['Br','Br'], bonds: [[0,1,1]] },
  F2:    { atoms: ['F','F'], bonds: [[0,1,1]] },
  I2:    { atoms: ['I','I'], bonds: [[0,1,1]] },
  Na2O:  { atoms: ['Na','Na','O'], bonds: [[0,2,1,true],[1,2,1,true]] },
  K2O:   { atoms: ['K','K','O'], bonds: [[0,2,1,true],[1,2,1,true]] },
  N2:    { atoms: ['N','N'], bonds: [[0,1,3]] },

  // ── Amino acids ──
  C2H5NO2: { atoms: ['C','C','N','O','O','H','H','H','H','H'], bonds: [[0,1,1],[1,2,1],[0,3,2],[1,4,1],[0,5,1],[1,6,1],[2,7,1],[2,8,1],[4,9,1]] },
  C3H7NO2: { atoms: ['C','C','C','N','O','O','H','H','H','H','H','H','H'], bonds: [[0,1,1],[1,2,1],[2,3,1],[1,4,2],[2,5,1],[0,6,1],[0,7,1],[1,8,1],[2,9,1],[3,10,1],[3,11,1],[5,12,1]] },
  C5H11NO2: { atoms: ['C','C','C','C','C','N','O','O','H','H','H','H','H','H','H','H','H','H','H'], bonds: [[0,1,1],[1,2,1],[2,3,1],[3,4,1],[4,5,1],[3,6,2],[4,7,1],[0,8,1],[0,9,1],[1,10,1],[2,11,1],[3,12,1],[4,13,1],[5,14,1],[5,15,1],[6,16,1],[7,17,1],[5,18,1]] },
  C3H7NO3: { atoms: ['C','C','C','N','O','O','O','H','H','H','H','H','H','H','H'], bonds: [[0,1,1],[1,2,1],[2,3,1],[1,4,2],[2,5,1],[2,6,1],[0,7,1],[0,8,1],[1,9,1],[2,10,1],[3,11,1],[3,12,1],[4,13,1],[6,14,1]] },

  // ── Industrial compounds ──
  CH4N2O: { atoms: ['C','O','N','N','H','H','H','H'], bonds: [[0,1,2],[0,2,1],[0,3,1],[2,4,1],[2,5,1],[3,6,1],[3,7,1]] },

  // ── Coordination compounds ──
  CuH12N4: { atoms: ['Cu','N','N','N','N','H','H','H','H','H','H','H','H','H','H','H','H'], bonds: [[0,1,1,true],[0,2,1,true],[0,3,1,true],[0,4,1,true],[1,5,1],[1,6,1],[1,7,1],[2,8,1],[2,9,1],[2,10,1],[3,11,1],[3,12,1],[3,13,1],[4,14,1],[4,15,1],[4,16,1]], charge: 2 },
  AgH6N2: { atoms: ['Ag','N','N','H','H','H','H','H','H'], bonds: [[0,1,1,true],[0,2,1,true],[1,3,1],[1,4,1],[1,5,1],[2,6,1],[2,7,1],[2,8,1]], charge: 1 },

  // ── Industrial / inorganic salts ──
  Fe2O3: { atoms: ['Fe','Fe','O','O','O'], bonds: [[0,2,2,true],[0,3,2,true],[1,3,2,true],[1,4,2,true],[0,4,2,true],[1,2,2,true]] },
  NO2: { atoms: ['N','O','O'], bonds: [[0,1,2],[0,2,1]] },
  NaNO3: { atoms: ['Na','N','O','O','O'], bonds: [[0,1,1,true],[1,2,1,true],[1,3,1,true],[2,3,2],[2,4,1],[3,4,1]] },
  KNO3: { atoms: ['K','N','O','O','O'], bonds: [[0,1,1,true],[1,2,1,true],[1,3,1,true],[2,3,2],[2,4,1],[3,4,1]] },
  CaSO4: { atoms: ['Ca','S','O','O','O','O'], bonds: [[0,1,1,true],[0,2,1,true],[1,2,2],[1,3,2],[1,4,1,true],[1,5,1,true],[2,4,1],[3,5,1]] },
  ZnSO4: { atoms: ['Zn','S','O','O','O','O'], bonds: [[0,1,1,true],[0,2,1,true],[1,2,2],[1,3,2],[1,4,1,true],[1,5,1,true],[2,4,1],[3,5,1]] },
  AgNO3: { atoms: ['Ag','N','O','O','O'], bonds: [[0,1,1,true],[1,2,1,true],[1,3,1,true],[2,3,2],[2,4,1],[3,4,1]] },
  CuSO4: { atoms: ['Cu','S','O','O','O','O'], bonds: [[0,1,1,true],[0,2,1,true],[1,2,2],[1,3,2],[1,4,1,true],[1,5,1,true],[2,4,1],[3,5,1]] },
  CuNO32: { atoms: ['Cu','N','N','O','O','O','O','O','O'], bonds: [[0,1,1,true],[0,2,1,true],[1,3,1,true],[1,4,1,true],[2,5,1,true],[2,6,1,true],[3,4,2],[3,7,1],[4,7,1],[5,6,2],[5,8,1],[6,8,1]] },
};

const ISOMERS = {};
function registerIsomer(formula, key, tpl, displayName) {
  if (!ISOMERS[formula]) ISOMERS[formula] = [];
  ISOMERS[formula].push({ 
    key, 
    tpl, 
    displayFormula: orderingToFormulaStatic(tpl.atoms),
    displayName: displayName || key.split('_').pop()
  });
  T[key] = tpl;
}

// Static version for use before orderingToFormula is defined
function orderingToFormulaStatic(atoms) {
  const count = new Map();
  for (const sym of atoms) count.set(sym, (count.get(sym) || 0) + 1);
  let result = '';
  const used = new Set();
  for (const sym of atoms) {
    if (used.has(sym)) continue;
    used.add(sym);
    const c = count.get(sym);
    result += sym + (c > 1 ? c : '');
  }
  return result;
}

registerIsomer('C2H6O', 'C2H6O_ethanol', {
  atoms: ['C','C','O','H','H','H','H','H','H'],
  bonds: [[0,1,1],[1,2,1],[0,3,1],[0,4,1],[0,5,1],[1,6,1],[1,7,1],[2,8,1]]
}, 'Ethanol');
registerIsomer('C2H6O', 'C2H6O_ether', {
  atoms: ['C','O','C','H','H','H','H','H','H'],
  bonds: [[0,1,1],[1,2,1],[0,3,1],[0,4,1],[0,5,1],[2,6,1],[2,7,1],[2,8,1]]
}, 'Dimethyl ether');

registerIsomer('C3H6O', 'C3H6O_acetone', {
  atoms: ['C','C','C','O','H','H','H','H','H','H'],
  bonds: [[0,1,1],[1,2,1],[1,3,2],[0,4,1],[0,5,1],[0,6,1],[2,7,1],[2,8,1],[2,9,1]]
}, 'Acetone');
registerIsomer('C3H6O', 'C3H6O_propanal', {
  atoms: ['C','C','C','O','H','H','H','H','H','H'],
  bonds: [[0,1,1],[1,2,1],[2,3,2],[0,4,1],[0,5,1],[0,6,1],[1,7,1],[1,8,1],[2,9,1]]
}, 'Propanal');

const isoCache = new Map();

export function isomerTemplates(formula) {
  const cached = isoCache.get(formula);
  if (cached) return cached;

  // Manually registered isomers come first (curated structures + names)
  const registered = ISOMERS[formula] || [];
  // Then every text arrangement generated for this formula, skipping texts the
  // registered entries already cover
  const generated = generateIsomers(formula, new Set(registered.map(r => r.displayFormula)));
  const list = registered.concat(generated);
  if (generated.truncated) list.truncated = true;
  isoCache.set(formula, list);
  return list;
}

// Every distinct arrangement of the formula's symbols becomes a pickable
// option (deduped by structure + text). Small formulas enumerate every text
// arrangement; big ones switch to heavy-atom skeletons with hydrogens
// appended, so the budget covers every skeleton instead of drowning in
// hydrogen placements. DFS tries symbols in formula-string order, so the
// canonical arrangement comes first.
const MAX_ARRANGEMENTS = 200;      // options kept per formula
const ARRANGEMENT_BUDGET = 12000;  // candidates built before the search gives up
const FULL_ENUM_LIMIT = 5000;      // below this total, enumerate every text arrangement

function totalArrangements(counts) {
  let total = 1, sum = 0;
  for (const c of counts) {
    for (let k = 1; k <= c; k++) total = total * (sum + k) / k;
    sum += c;
  }
  return Math.round(total);
}

// Label-invariant connectivity signature (Weisfeiler-Lehman refinement):
// the same structure built from different atom orderings produces the same
// signature, unlike the index-labeled structuralFingerprint.
function wlSignature(atoms, bonds) {
  const n = atoms.length;
  const nbr = Array.from({ length: n }, () => []);
  for (const [a, b, o] of bonds) {
    nbr[a].push([b, o]);
    nbr[b].push([a, o]);
  }
  let labels = atoms.map((s, i) =>
    `${s}:${nbr[i].length}:${nbr[i].map(x => x[1]).sort((a, b) => a - b).join(',')}`);
  for (let round = 0; round < 6; round++) {
    const next = labels.map((l, i) =>
      l + '#' + nbr[i].map(([j, o]) => o + ':' + labels[j]).sort().join(';'));
    if (next.join() === labels.join()) break;
    labels = next;
  }
  return labels.slice().sort().join('|');
}

function generateIsomers(formula, skipTexts) {
  const atomCounts = parseFormula(formula);
  const syms = [];
  const counts = [];
  for (const [sym, count] of atomCounts) {
    if (!elementBySym(sym)) continue;
    syms.push(sym);
    counts.push(count);
  }
  const n = counts.reduce((a, b) => a + b, 0);
  if (n === 0) return [];

  const found = [];
  const seen = new Set();
  let tried = 0;
  let truncated = false;

  function tryOne(seqArr, bonds) {
    const text = orderingToFormula(seqArr);
    if (skipTexts && skipTexts.has(text)) return true;
    const fp = wlSignature(seqArr, bonds);
    const key = fp + '|' + text;
    if (seen.has(key)) return true;
    seen.add(key);
    found.push({ atoms: [...seqArr], bonds, text });
    if (found.length >= MAX_ARRANGEMENTS) { truncated = true; return false; }
    return true;
  }

  function trySequence(seqArr) {
    if (tried >= ARRANGEMENT_BUDGET) { truncated = true; return false; }
    tried++;
    // Two connection strategies: linear chains and capacity-first trees, so
    // branched isomers are covered too. Greedy rescues what both miss.
    const chain = buildStructure(seqArr, 'chain');
    let pushed = false;
    if (chain && isValidComplete(seqArr, chain)) {
      if (!tryOne(seqArr, chain)) return false;
      pushed = true;
    }
    const tree = buildStructure(seqArr, 'tree');
    if (tree && isValidComplete(seqArr, tree)) {
      if (!tryOne(seqArr, tree)) return false;
      pushed = true;
    }
    if (!pushed) {
      const alt = buildStructureGreedy(seqArr);
      if (alt && isValidComplete(seqArr, alt)) {
        if (!tryOne(seqArr, alt)) return false;
      }
    }
    return true;
  }

  const seq = new Array(n);
  function dfs(depth, order) {
    if (depth === n) return trySequence(seq);
    for (let s = 0; s < order.length; s++) {
      const si = order[s];
      if (!counts[si]) continue;
      counts[si]--;
      seq[depth] = syms[si];
      const ok = dfs(depth + 1, order);
      counts[si]++;
      if (!ok) return false;
    }
    return true;
  }

  if (totalArrangements(counts) <= FULL_ENUM_LIMIT) {
    dfs(0, syms.map((_, i) => i));
  } else {
    const heavyIdx = [];
    for (let s = 0; s < syms.length; s++) {
      if (syms[s] !== 'H') heavyIdx.push(s);
    }
    // Expand heavy symbols into individual atoms: the DFS walks heavy ATOMS
    // (multiset permutations), not symbols, then appends every H wholesale.
    const heavyExpanded = [];
    for (const si of heavyIdx) for (let k = 0; k < counts[si]; k++) heavyExpanded.push(syms[si]);
    heavyExpanded.sort();
    const heavyN = heavyExpanded.length;
    const heavySeq = new Array(heavyN);
    const hSeq = new Array(n);
    const skeletons = new Set();

    // Canonical arrangement (formula symbol order) first
    const canon = [];
    for (let s = 0; s < syms.length; s++) for (let k = 0; k < counts[s]; k++) canon.push(syms[s]);
    if (!trySequence(canon)) truncated = true;

    let stop = truncated;
    const usedHeavy = new Array(heavyN).fill(false);
    (function dfsHeavy(depth) {
      if (stop) return;
      if (depth === heavyN) {
        const key = heavySeq.join('\u0000');
        if (skeletons.has(key)) return;
        skeletons.add(key);
        for (let i = 0; i < heavyN; i++) hSeq[i] = heavySeq[i];
        for (let i = heavyN; i < n; i++) hSeq[i] = 'H';
        if (!trySequence(hSeq)) stop = true;
        return;
      }
      let prev = null;
      for (let s = 0; s < heavyN; s++) {
        if (usedHeavy[s] || heavyExpanded[s] === prev) continue;
        prev = heavyExpanded[s];
        usedHeavy[s] = true;
        heavySeq[depth] = heavyExpanded[s];
        dfsHeavy(depth + 1);
        usedHeavy[s] = false;
      }
    })(0);
  }

  const out = found.map((iso, idx) => {
    const displayName = generateIsomerName(iso.atoms, iso.bonds, formula);
    return {
      key: `${formula}_${displayName.replace(/\s+/g, '_').toLowerCase()}_${idx}`,
      tpl: { atoms: iso.atoms, bonds: iso.bonds },
      displayFormula: iso.text,
      displayName
    };
  });
  out.truncated = truncated;
  return out;
}

// Generate a descriptive name for an isomer based on its structure
function generateIsomerName(atoms, bonds, formula) {
  // Try to use the existing nameMolecule function
  try {
    const fakeAtoms = new Map();
    atoms.forEach((sym, i) => {
      const el = elementBySym(sym);
      if (el) fakeAtoms.set(i, { id: i, el });
    });
    
    const fakeBonds = new Map();
    bonds.forEach((b, i) => {
      fakeBonds.set(i, { id: i, a: b[0], b: b[1], order: b[2] || 1, ionic: false });
    });
    
    const name = nameMolecule(
      atoms.map((_, i) => fakeAtoms.get(i)),
      [...fakeBonds.values()],
      formula,
      0,
      new Map()
    );
    
    if (name) return name;
  } catch (e) {
    // Fallback if naming fails
  }
  
  // Fallback: use the display formula
  return orderingToFormula(atoms);
}

// Convert an atom ordering to a formula string (e.g., [H,C,N] -> "HCN")
function orderingToFormula(atoms) {
  const count = new Map();
  for (const sym of atoms) count.set(sym, (count.get(sym) || 0) + 1);
  
  let result = '';
  const used = new Set();
  for (const sym of atoms) {
    if (used.has(sym)) continue;
    used.add(sym);
    const c = count.get(sym);
    result += sym + (c > 1 ? c : '');
  }
  return result;
}

// Build a valid structure for a given atom ordering. Plan: single-bond the
// heavy atoms along the sequence, grow that framework only while leftover
// valence exceeds what the free hydrogens can absorb, then hand hydrogens
// out round-robin. The greedy builder below rescues what this misses.
function buildStructure(atoms, mode = 'chain') {
  const n = atoms.length;
  const els = atoms.map(s => elementBySym(s));
  if (els.some(e => !e)) return null;
  if (n === 2 && atoms[0] === 'H' && atoms[1] === 'H') return [[0, 1, 1]];

  const capOf = i => {
    const el = els[i];
    if (el.cat === 'Noble gas' && el.sym !== 'Xe' && el.sym !== 'Kr') return 0;
    if (atoms[i] === 'C') return 4;
    if (atoms[i] === 'N') return Math.min(el.maxBonds, 3); // neutral nitrogen
    if (atoms[i] === 'O') return 2; // el.maxBonds is 3 (hydronium) — neutral O never takes 3
    return el.maxBonds ?? 2;
  };

  const used = new Array(n).fill(0);
  const pair = new Map(); // pkey -> total bond order between the pair
  const bonds = [];
  const rem = i => capOf(i) - used[i];
  const pkey = (a, b) => (a < b ? a * n + b : b * n + a);
  const isHeavy = i => atoms[i] !== 'H' && capOf(i) > 0;

  function add(a, b, order) {
    if (a === b || order <= 0 || rem(a) < order || rem(b) < order) return false;
    const k = pkey(a, b);
    if ((pair.get(k) || 0) + order > 3) return false;
    pair.set(k, (pair.get(k) || 0) + order);
    bonds.push([Math.min(a, b), Math.max(a, b), order]);
    used[a] += order;
    used[b] += order;
    return true;
  }

  function bump(k) {
    const a = Math.floor(k / n), b = k % n;
    const cur = pair.get(k) || 0;
    if (cur === 0 || cur >= 3 || rem(a) <= 0 || rem(b) <= 0) return false;
    pair.set(k, cur + 1);
    used[a]++;
    used[b]++;
    const bd = bonds.find(x => pkey(x[0], x[1]) === k);
    if (bd) bd[2]++;
    return true;
  }

  const freeH = () => {
    let c = 0;
    for (let i = 0; i < n; i++) if (atoms[i] === 'H' && rem(i) > 0) c++;
    return c;
  };
  const heavyDeficit = () => {
    let sum = 0;
    for (let i = 0; i < n; i++) if (isHeavy(i)) sum += rem(i);
    return sum - freeH();
  };

  // Heavy framework. 'chain' bonds adjacent heavy atoms (linear shapes);
  // 'tree' attaches each heavy to the highest-capacity placed heavy (branched
  // shapes like isobutane, 2-butanol, tert-butanol).
  if (mode === 'chain') {
    for (let i = 0; i + 1 < n; i++) {
      if (isHeavy(i) && isHeavy(i + 1)) add(i, i + 1, 1);
    }
  } else {
    let first = true;
    for (let i = 0; i < n; i++) {
      if (!isHeavy(i)) continue;
      if (first) { first = false; continue; }
      let host = -1, hostCap = -1;
      for (let j = 0; j < i; j++) {
        if (!isHeavy(j) || rem(j) <= 0) continue;
        if (capOf(j) > hostCap) { host = j; hostCap = capOf(j); }
      }
      if (host !== -1) add(host, i, 1);
    }
  }

  // Connect heavy clusters the chain left apart (e.g. an oxygen stranded at
  // the end of the sequence) — a disconnected heavy atom is always invalid
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  for (const k of pair.keys()) {
    const ra = find(Math.floor(k / n)), rb = find(k % n);
    if (ra !== rb) parent[ra] = rb;
  }
  const compRoots = () => {
    const m = new Map();
    for (let i = 0; i < n; i++) if (isHeavy(i)) m.set(find(i), true);
    return m;
  };
  let comps = compRoots();
  while (comps.size > 1) {
    let best = null;
    for (let i = 0; i < n; i++) {
      if (!isHeavy(i) || rem(i) <= 0) continue;
      for (let j = i + 1; j < n; j++) {
        if (!isHeavy(j) || rem(j) <= 0 || find(i) === find(j)) continue;
        const dist = j - i;
        if (!best || dist < best.dist) best = { i, j, dist };
      }
    }
    if (!best || !add(best.i, best.j, 1)) break;
    parent[find(best.i)] = find(best.j);
    comps = compRoots();
  }

  // Grow the framework only while valence exceeds hydrogens' absorption
  let guard = 0;
  while (heavyDeficit() > 0 && guard++ < 4 * n) {
    let changed = false;
    for (const k of [...pair.keys()]) {
      if (heavyDeficit() <= 0) break;
      if (bump(k)) changed = true;
    }
    for (let i = 0; i < n && heavyDeficit() > 0; i++) {
      if (!isHeavy(i) || rem(i) <= 0) continue;
      for (let d = 1; d < n && heavyDeficit() > 0 && rem(i) > 0; d++) {
        for (const j of [(i + d) % n, (i - d + n) % n]) {
          if (!isHeavy(j) || rem(j) <= 0 || (pair.get(pkey(i, j)) || 0) > 0) continue;
          if (add(i, j, 1)) { changed = true; break; }
        }
      }
    }
    if (!changed) break;
  }

  // Hydrogens: one per sweep over heavy atoms with spare capacity
  const hs = [];
  for (let i = 0; i < n; i++) if (atoms[i] === 'H' && rem(i) > 0) hs.push(i);
  let progress = true;
  while (progress && hs.length) {
    progress = false;
    for (let i = 0; i < n && hs.length; i++) {
      if (!isHeavy(i) || rem(i) <= 0) continue;
      const hIdx = hs.findIndex(h => rem(h) > 0);
      if (hIdx === -1) break;
      if (add(hs[hIdx], i, 1)) { hs.splice(hIdx, 1); progress = true; }
    }
  }

  return bonds.length > 0 ? bonds : null;
}

// Fallback builder: greedily maxes bond orders along the chain. Rescues
// shapes the primary builder misses, e.g. O=C=O from a [C,O,O] sequence.
function buildStructureGreedy(atoms) {
  const n = atoms.length;
  const bonds = [];
  const bondCount = new Array(n).fill(0);

  // Build a chain/tree structure
  for (let i = 0; i < n - 1; i++) {
    // Try to bond atom i with atom i+1
    const order = findValidBondOrder(atoms[i], atoms[i + 1], bondCount[i], bondCount[i + 1]);
    if (order > 0) {
      bonds.push([i, i + 1, order]);
      bondCount[i] += order;
      bondCount[i + 1] += order;
    }
  }

  // Try to add more bonds to satisfy valence
  for (let i = 0; i < n; i++) {
    const el = elementBySym(atoms[i]);
    if (!el) continue;

    const targetBonds = atoms[i] === 'C' ? 4 : el.maxBonds;
    const currentBonds = bondCount[i];

    if (currentBonds < targetBonds) {
      // Try to bond with other atoms
      for (let j = i + 2; j < n; j++) {
        if (bondCount[j] < elementBySym(atoms[j])?.maxBonds || 0) {
          const order = findValidBondOrder(atoms[i], atoms[j], bondCount[i], bondCount[j]);
          if (order > 0) {
            bonds.push([i, j, order]);
            bondCount[i] += order;
            bondCount[j] += order;
            if (bondCount[i] >= targetBonds) break;
          }
        }
      }
    }
  }

  return bonds.length > 0 ? bonds : null;
}

// Find a valid bond order between two atoms
function findValidBondOrder(sym1, sym2, count1, count2) {
  const el1 = elementBySym(sym1);
  const el2 = elementBySym(sym2);
  if (!el1 || !el2) return 0;

  // No bonds to noble gases (except Xe, Kr with F, O)
  if (el1.cat === 'Noble gas' && el1.sym !== 'Xe' && el1.sym !== 'Kr') return 0;
  if (el2.cat === 'Noble gas' && el2.sym !== 'Xe' && el2.sym !== 'Kr') return 0;

  // Neutral nitrogen takes 3 bonds; its 4th slot only applies to ions like
  // NH4+, which this neutral-structure generator never builds. Oxygen's
  // maxBonds is 3 (hydronium) but neutral O takes 2.
  const cap = (sym, el) => (sym === 'C' ? 4 : sym === 'N' ? Math.min(el.maxBonds, 3) : sym === 'O' ? 2 : el.maxBonds);
  const target1 = cap(sym1, el1);
  const target2 = cap(sym2, el2);

  const remaining1 = target1 - count1;
  const remaining2 = target2 - count2;

  if (remaining1 <= 0 || remaining2 <= 0) return 0;

  // Hydrogen can only have single bonds
  if (sym1 === 'H' || sym2 === 'H') return 1;

  // Try to use the minimum of remaining capacities
  const maxOrder = Math.min(remaining1, remaining2, 3);
  return maxOrder > 0 ? maxOrder : 0;
}

function isValidComplete(atoms, bonds) {
  const bondOrder = new Map();
  for (let i = 0; i < atoms.length; i++) bondOrder.set(i, 0);

  for (const [i, j, order] of bonds) {
    bondOrder.set(i, bondOrder.get(i) + order);
    bondOrder.set(j, bondOrder.get(j) + order);
  }

  for (let i = 0; i < atoms.length; i++) {
    const el = elementBySym(atoms[i]);
    if (!el) return false;

    const order = bondOrder.get(i);

    // Hydrogen must have exactly 1 bond
    if (atoms[i] === 'H' && order !== 1) return false;

    // Other atoms must not exceed max bonds
    if (order > el.maxBonds) return false;

    // For organic molecules, carbon should have 4 bonds
    if (atoms[i] === 'C' && order !== 4) return false;
  }

  // Check connectivity (all atoms must be in one component)
  return isConnected(atoms.length, bonds);
}

function isConnected(n, bonds) {
  if (n === 0) return true;
  const parent = Array.from({length: n}, (_, i) => i);

  function find(x) {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  }

  function union(a, b) {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }

  for (const [i, j] of bonds) union(i, j);

  const root = find(0);
  for (let i = 1; i < n; i++) {
    if (find(i) !== root) return false;
  }
  return true;
}

export const CONDITIONS = [
  { key: 'rt', label: 'Room temp' },
  { key: 'heat', label: 'Heat' },
  { key: 'spark', label: 'Spark' },
  { key: 'electricity', label: 'Electricity' },
  { key: 'catalyst', label: 'Catalyst' },
  { key: 'uv', label: 'UV light' },
];

export const CONDITION_LABEL = Object.fromEntries(CONDITIONS.map(c => [c.key, c.label]));

// Universal acid-base detection
// Acid: starts with H (e.g., HCl, H2SO4, H3PO4, HNO3, CH3COOH)
// Base: contains OH group (e.g., NaOH, Ca(OH)2, Ba(OH)2, Al(OH)3)

function isAcid(formula) {
  // Use the universal classification system
  const cls = classifyMolecule(formula, 0, null);
  return cls.key === 'acid' || cls.key === 'carboxylicAcid';
}

function isBase(formula) {
  // Use the universal classification system
  const cls = classifyMolecule(formula, 0, null);
  return cls.key === 'base';
}

function getAcidHCount(formula) {
  return parseFormula(formula).get('H') || 0;
}

function getBaseOHCount(formula) {
  // Structural: X(OH)n
  const m = formula.match(/\(OH\)(\d+)$/);
  if (m) return parseInt(m[1]);
  // Structural: XOH
  if (/OH$/.test(formula)) return 1;
  // Empirical: XHnOn where n = OH count
  const m2 = formula.match(/^([A-Z][a-z]?)H(\d*)O(\d*)$/);
  if (m2) {
    const h = m2[2] ? parseInt(m2[2]) : 1, o = m2[3] ? parseInt(m2[3]) : 1;
    if (h === o && h > 0) return h;
  }
  return 0;
}

function getBaseCation(formula) {
  // Structural: X(OH)n -> cation is X with charge n
  const m2 = formula.match(/^([A-Z][a-z]?)\(OH\)(\d+)$/);
  if (m2) return { sym: m2[1], charge: parseInt(m2[2]) };
  // Structural: XOH -> cation is X with charge 1
  const m1 = formula.match(/^([A-Z][a-z]?)OH$/);
  if (m1) return { sym: m1[1], charge: 1 };
  // Empirical: XHnOn -> cation is X with charge n
  const m3 = formula.match(/^([A-Z][a-z]?)H(\d*)O(\d*)$/);
  if (m3) {
    const h = m3[2] ? parseInt(m3[2]) : 1, o = m3[3] ? parseInt(m3[3]) : 1;
    if (h === o && h > 0) return { sym: m3[1], charge: h };
  }
  return null;
}

function getAcidAnion(formula) {
  const counts = parseFormula(formula);
  const hCount = counts.get('H') || 0;
  if (hCount === 0) return null;

  const anionCounts = new Map(counts);
  anionCounts.delete('H');

  const remaining = [...anionCounts.entries()];
  if (remaining.length === 0) return null;

  if (remaining.length === 1) {
    const [sym, count] = remaining[0];
    return { sym: count === 1 ? sym : `${sym}${count}`, charge: -hCount };
  }

  const central = remaining.find(([sym]) => sym !== 'O');
  if (!central) return null;
  const oCount = anionCounts.get('O') || 0;

  // No oxygen case: include all non-H atoms in anion (e.g., HCN -> CN-)
  if (oCount === 0) {
    const nonH = remaining.sort(([a], [b]) => a.localeCompare(b));
    const anionSym = nonH.map(([sym, count]) => count === 1 ? sym : `${sym}${count}`).join('');
    return { sym: anionSym, charge: -hCount };
  }

  const anionSym = oCount > 1 ? `${central[0]}O${oCount}` : oCount === 1 ? `${central[0]}O` : central[0];
  return { sym: anionSym, charge: -hCount };
}

// Generate salt template from cation and anion
function generateSaltTemplate(cation, anion) {
  const cationCharge = Math.abs(cation.charge);
  const anionCharge = Math.abs(anion.charge);
  
  // Find LCM to balance charges
  const lcm = (cationCharge * anionCharge) / gcd(cationCharge, anionCharge);
  const cationCount = lcm / cationCharge;
  const anionCount = lcm / anionCharge;
  
  // Build atom list
  const atoms = [];
  for (let i = 0; i < cationCount; i++) atoms.push(cation.sym);
  
  // Parse anion formula
  const anionAtoms = parseAnionFormula(anion.sym);
  for (let i = 0; i < anionCount; i++) {
    for (const a of anionAtoms) atoms.push(a);
  }
  
  // Build bonds (ionic bonds between cations and anion central atoms)
  const bonds = [];
  const cationIndices = [];
  for (let i = 0; i < cationCount; i++) cationIndices.push(i);
  
  // Find central atom of each anion group
  const anionStartIdx = cationCount;
  for (let i = 0; i < anionCount; i++) {
    const anionOffset = anionStartIdx + i * anionAtoms.length;
    const centralIdx = findCentralAtom(anionAtoms, anionOffset);
    
    // Connect cations to central atom with ionic bonds
    for (const catIdx of cationIndices) {
      bonds.push([catIdx, centralIdx, 1, true]);
    }
  }
  
  // Add internal anion bonds
  for (let i = 0; i < anionCount; i++) {
    const anionOffset = anionStartIdx + i * anionAtoms.length;
    const internalBonds = getAnionInternalBonds(anion.sym, anionOffset);
    bonds.push(...internalBonds);
  }
  
  return { atoms, bonds };
}

function gcd(a, b) { return b === 0 ? a : gcd(b, a % b); }

// ── Organic template builders ──

function buildAlkaneTemplate(n) {
  const atoms = [];
  const bonds = [];
  for (let i = 0; i < n; i++) atoms.push('C');
  for (let i = 0; i < n - 1; i++) bonds.push([i, i + 1, 1]);
  let h = atoms.length;
  for (let i = 0; i < n; i++) {
    const hc = n === 1 ? 4 : (i === 0 || i === n - 1) ? 3 : 2;
    for (let j = 0; j < hc; j++) { atoms.push('H'); bonds.push([i, h++, 1]); }
  }
  return { atoms, bonds };
}

function buildAlkeneTemplate(n) {
  if (n < 2) return buildAlkaneTemplate(1);
  const atoms = [];
  const bonds = [];
  for (let i = 0; i < n; i++) atoms.push('C');
  bonds.push([0, 1, 2]);
  for (let i = 1; i < n - 1; i++) bonds.push([i, i + 1, 1]);
  let h = atoms.length;
  for (let i = 0; i < n; i++) {
    let hc;
    if (i === 0) hc = 2;
    else if (i === 1) hc = n === 2 ? 2 : 1;
    else if (i === n - 1) hc = 3;
    else hc = 2;
    for (let j = 0; j < hc; j++) { atoms.push('H'); bonds.push([i, h++, 1]); }
  }
  return { atoms, bonds };
}

function buildAlkyneTemplate(n) {
  if (n < 2) return buildAlkaneTemplate(1);
  const atoms = [];
  const bonds = [];
  for (let i = 0; i < n; i++) atoms.push('C');
  bonds.push([0, 1, 3]);
  for (let i = 1; i < n - 1; i++) bonds.push([i, i + 1, 1]);
  let h = atoms.length;
  for (let i = 0; i < n; i++) {
    let hc;
    if (i === 0) hc = 1;
    else if (i === 1) hc = n === 2 ? 1 : 0;
    else if (i === n - 1) hc = 3;
    else hc = 2;
    for (let j = 0; j < hc; j++) { atoms.push('H'); bonds.push([i, h++, 1]); }
  }
  return { atoms, bonds };
}

function buildAlcoholTemplate(n) {
  const atoms = [];
  const bonds = [];
  for (let i = 0; i < n; i++) atoms.push('C');
  const oIdx = atoms.length;
  atoms.push('O');
  for (let i = 0; i < n - 1; i++) bonds.push([i, i + 1, 1]);
  bonds.push([n - 1, oIdx, 1]);
  const hIdx = atoms.length;
  atoms.push('H');
  bonds.push([oIdx, hIdx, 1]);
  let h = hIdx + 1;
  for (let i = 0; i < n; i++) {
    let hc;
    if (n === 1) hc = 3;
    else if (i === n - 1) hc = 2;
    else if (i === 0) hc = 3;
    else hc = 2;
    for (let j = 0; j < hc; j++) { atoms.push('H'); bonds.push([i, h++, 1]); }
  }
  return { atoms, bonds };
}

function generateEsterTemplate(acidC, alcoholC) {
  const rLen = acidC - 1;
  const rpLen = alcoholC;
  const atoms = [];
  const bonds = [];
  for (let i = 0; i < rLen; i++) atoms.push('C');
  const cC = atoms.length; atoms.push('C');
  const cO = atoms.length; atoms.push('O');
  const eO = atoms.length; atoms.push('O');
  const rpStart = atoms.length;
  for (let i = 0; i < rpLen; i++) atoms.push('C');
  if (rLen > 0) {
    for (let i = 0; i < rLen - 1; i++) bonds.push([i, i + 1, 1]);
    bonds.push([rLen - 1, cC, 1]);
  }
  bonds.push([cC, cO, 2]);
  bonds.push([cC, eO, 1]);
  bonds.push([eO, rpStart, 1]);
  for (let i = 0; i < rpLen - 1; i++) bonds.push([rpStart + i, rpStart + i + 1, 1]);
  let h = atoms.length;
  for (let i = 0; i < rLen; i++) {
    const hc = rLen === 1 ? 3 : (i === 0 ? 3 : 2);
    for (let j = 0; j < hc; j++) { atoms.push('H'); bonds.push([i, h++, 1]); }
  }
  for (let i = 0; i < rpLen; i++) {
    const hc = rpLen === 1 ? 3 : (i === 0 ? 2 : (i === rpLen - 1 ? 3 : 2));
    for (let j = 0; j < hc; j++) { atoms.push('H'); bonds.push([rpStart + i, h++, 1]); }
  }
  return { atoms, bonds };
}

function buildHaloalkaneTemplate(alkaneC, halSym) {
  const a = [];
  const b = [];
  for (let i = 0; i < alkaneC; i++) a.push('C');
  for (let i = 0; i < alkaneC - 1; i++) b.push([i, i + 1, 1]);
  const xIdx = a.length; a.push(halSym);
  b.push([alkaneC - 1, xIdx, 1]);
  let h = a.length;
  for (let i = 0; i < alkaneC; i++) {
    let hc;
    if (alkaneC === 1) hc = 3;
    else if (i === alkaneC - 1) hc = 2;
    else if (i === 0) hc = 3;
    else hc = 2;
    for (let j = 0; j < hc; j++) { a.push('H'); b.push([i, h++, 1]); }
  }
  return { atoms: a, bonds: b };
}

function organicFormula(c, h, o, n) {
  let f = '';
  if (c === 1) f += 'C'; else f += `C${c}`;
  if (h === 1) f += 'H'; else if (h > 0) f += `H${h}`;
  if (n && n > 0) { if (n === 1) f += 'N'; else f += `N${n}`; }
  if (o && o > 0) { if (o === 1) f += 'O'; else f += `O${o}`; }
  return f;
}

function parseAnionFormula(sym) {
  const counts = parseFormula(sym);
  const atoms = [];
  for (const [symbol, count] of counts) {
    for (let i = 0; i < count; i++) atoms.push(symbol);
  }
  return atoms;
}

function findCentralAtom(anionAtoms, offset) {
  // Central atom is the first non-oxygen atom
  for (let i = 0; i < anionAtoms.length; i++) {
    if (anionAtoms[i] !== 'O') return offset + i;
  }
  return offset;
}

function getAnionInternalBonds(anionSym, offset) {
  const atoms = parseAnionFormula(anionSym);
  if (atoms.length <= 1) return [];

  const bonds = [];
  let centralLocal = 0;
  for (let i = 0; i < atoms.length; i++) {
    if (atoms[i] !== 'O') { centralLocal = i; break; }
  }

  for (let i = 0; i < atoms.length; i++) {
    if (i === centralLocal) continue;
    bonds.push([offset + centralLocal, offset + i, 1]);
  }

  return bonds;
}

// Try to match acid-base neutralization
function tryAcidBaseReaction(formulas) {
  const acids = formulas.filter(f => isAcid(f));
  const bases = formulas.filter(f => isBase(f));
  
  if (acids.length === 0 || bases.length === 0) return null;
  
  // For now, handle simple 1:1 or balanced cases
  const acid = acids[0];
  const base = bases[0];
  
  const hCount = getAcidHCount(acid);
  const ohCount = getBaseOHCount(base);
  
  if (hCount === 0 || ohCount === 0) return null;
  
  // Balance: need hCount * base = ohCount * acid
  // Simplified: handle common cases
  const cation = getBaseCation(base);
  const anion = getAcidAnion(acid);
  
  if (!cation || !anion) return null;
  
  // Calculate stoichiometry
  // Balance: acidMultiplier * hCount = baseMultiplier * ohCount
  // Simplify by dividing by GCD
  const rawAcidMult = ohCount;
  const rawBaseMult = hCount;
  const multGcd = gcd(rawAcidMult, rawBaseMult);
  const acidMultiplier = rawAcidMult / multGcd;
  const baseMultiplier = rawBaseMult / multGcd;
  const waterCount = (hCount * ohCount) / multGcd;
  
  // Generate salt
  const saltTemplate = generateSaltTemplate(cation, anion);
  const saltFormula = generateSaltFormula(cation, anion);
  
  // Store template dynamically
  const saltKey = saltFormula;
  T[saltKey] = saltTemplate;
  
  // Build equation
  const acidPart = acidMultiplier === 1 ? acid : `${acidMultiplier}${acid}`;
  const basePart = baseMultiplier === 1 ? base : `${baseMultiplier}${base}`;
  const waterPart = waterCount === 1 ? 'H2O' : `${waterCount}H2O`;
  const equation = `${acidPart} + ${basePart} -> ${saltFormula} + ${waterPart}`;
  
  return {
    reactants: { [acid]: acidMultiplier, [base]: baseMultiplier },
    condition: 'rt',
    products: [[saltKey, 1], ['H2O', waterCount]],
    equation,
    dynamic: true
  };
}

function generateSaltFormula(cation, anion) {
  const cationCharge = Math.abs(cation.charge);
  const anionCharge = Math.abs(anion.charge);
  const lcm = (cationCharge * anionCharge) / gcd(cationCharge, anionCharge);
  const cationCount = lcm / cationCharge;
  const anionCount = lcm / anionCharge;

  const anionCounts = parseFormula(anion.sym);
  const isPolyatomicAnion = anionCounts.size > 1;

  let formula = cation.sym;
  if (cationCount > 1) formula += cationCount;

  if (anionCount > 1 && isPolyatomicAnion) {
    formula += `(${anion.sym})${anionCount}`;
  } else {
    formula += anion.sym;
    if (anionCount > 1) formula += anionCount;
  }

  return formula;
}

// General formula parser handling parentheses: Ca(OH)2 -> {Ca:1, O:2, H:2}
function parseFormula(f) {
  const counts = new Map();
  const stack = [counts];
  const re = /([A-Z][a-z]?)(\d*)|(\()|(\))(\d*)/g;
  let m;
  while ((m = re.exec(f)) !== null) {
    if (m[1]) {
      const n = m[2] ? parseInt(m[2]) : 1;
      const top = stack[stack.length - 1];
      top.set(m[1], (top.get(m[1]) || 0) + n);
    } else if (m[3]) {
      const group = new Map();
      stack.push(group);
    } else if (m[4]) {
      const group = stack.pop();
      const mult = m[5] ? parseInt(m[5]) : 1;
      const top = stack[stack.length - 1];
      for (const [sym, n] of group) {
        top.set(sym, (top.get(sym) || 0) + n * mult);
      }
    }
  }
  return counts;
}

// Combustion detection: hydrocarbon/organic + O2 -> CO2 + H2O
function isCombustible(formula) {
  if (formula === 'O2' || formula === 'H2') return false;
  // Use classification system for organic molecules
  const cls = classifyMolecule(formula, 0, null);
  if (['alkane', 'alkene', 'alkyne', 'organic'].includes(cls.key)) return true;
  // Fallback: any hydrocarbon (C + H)
  const c = parseFormula(formula);
  return c.has('C') && c.has('H');
}

function tryCombustion(formulas) {
  const have = multisetOf(formulas);
  const fuels = [...have.keys()].filter(f => isCombustible(f));
  if (fuels.length === 0 || !have.has('O2')) return null;
  if (have.size !== 2) return null;
  
  const fuel = fuels[0];
  const fc = parseFormula(fuel);
  const x = fc.get('C') || 0;
  const y = fc.get('H') || 0;
  const z = fc.get('O') || 0;
  
  // CxHyOz + (x + y/4 - z/2) O2 -> x CO2 + (y/2) H2O
  // Multiply by 4 to clear fractions: 4 fuel + (4x+y-2z) O2 -> 4x CO2 + 2y H2O
  let fuelCoeff = 4;
  let o2Coeff = 4 * x + y - 2 * z;
  let co2Coeff = 4 * x;
  let h2oCoeff = 2 * y;
  
  if (o2Coeff <= 0) return null;
  
  const g = gcd(gcd(fuelCoeff, o2Coeff), gcd(co2Coeff, h2oCoeff));
  fuelCoeff /= g; o2Coeff /= g; co2Coeff /= g; h2oCoeff /= g;
  
  const reactants = { [fuel]: fuelCoeff, O2: o2Coeff };
  const fuelPart = fuelCoeff === 1 ? fuel : `${fuelCoeff}${fuel}`;
  const o2Part = o2Coeff === 1 ? 'O2' : `${o2Coeff}O2`;
  const co2Part = co2Coeff === 1 ? 'CO2' : `${co2Coeff}CO2`;
  const h2oPart = h2oCoeff === 1 ? 'H2O' : `${h2oCoeff}H2O`;
  
  return {
    reactants,
    condition: 'spark',
    products: [['CO2', co2Coeff], ['H2O', h2oCoeff]],
    equation: `${fuelPart} + ${o2Part} -> ${co2Part} + ${h2oPart}`,
    dynamic: true
  };
}

// Metal + acid detection: M + acid -> salt + H2
function isSingleMetal(formula) {
  const el = elementBySym(formula);
  return el && isMetal(el);
}

function getMetalCharge(formula) {
  const el = elementBySym(formula);
  if (!el || !el.charges || el.charges.length === 0) return null;
  return el.charges[0];
}

function tryMetalAcidReaction(formulas) {
  const have = multisetOf(formulas);
  if (have.size !== 2) return null;
  
  const metals = [...have.keys()].filter(f => isSingleMetal(f));
  const acids = [...have.keys()].filter(f => isAcid(f));
  
  if (metals.length === 0 || acids.length === 0) return null;
  
  const metal = metals[0];
  const acid = acids[0];
  const metalCharge = getMetalCharge(metal);
  const anion = getAcidAnion(acid);
  
  if (!metalCharge || !anion) return null;
  
  const cation = { sym: metal, charge: metalCharge };
  const saltFormula = generateSaltFormula(cation, anion);
  const saltTemplate = generateSaltTemplate(cation, anion);
  T[saltFormula] = saltTemplate;
  
  // Balance: M + acid -> salt + H2
  // Salt has cationCount metals and anionCount anion groups
  const anionCharge = Math.abs(anion.charge);
  const g = gcd(metalCharge, anionCharge);
  const saltCationCount = anionCharge / g;
  const saltAnionCount = metalCharge / g;
  
  // Each acid provides some H. Total H must equal 2 * H2 count.
  const acidHCount = getAcidHCount(acid);
  if (acidHCount === 0) return null;
  
  // Metal balance: metalCoeff = saltCationCount * metalCoeff / saltCationCount
  // Anion balance: acidCoeff * (anions per acid) = saltAnionCount * saltCoeff
  // For simple acids (HCl, HNO3): 1 anion per acid
  // For H2SO4: 1 anion per acid
  const anionsPerAcid = 1;
  
  // Let saltCoeff = 1
  // metalCoeff = saltCationCount
  // acidCoeff = saltAnionCount * anionsPerAcid / anionsPerAcid = saltAnionCount (for 1-anion acids)
  // But acid also needs to provide enough anions: acidCoeff = saltAnionCount
  // H balance: acidCoeff * acidHCount = 2 * h2Coeff
  // h2Coeff = acidCoeff * acidHCount / 2
  
  let metalCoeff = saltCationCount;
  let acidCoeff = saltAnionCount;
  let saltCoeff = 1;
  let h2Num = acidCoeff * acidHCount;
  let h2Den = 2;
  
  const h2g = gcd(h2Num, h2Den);
  let h2Coeff = h2Num / h2g;
  const divisor = h2Den / h2g;
  
  if (divisor !== 1) {
    metalCoeff *= divisor;
    acidCoeff *= divisor;
    saltCoeff *= divisor;
  }
  
  const metalPart = metalCoeff === 1 ? metal : `${metalCoeff}${metal}`;
  const acidPart = acidCoeff === 1 ? acid : `${acidCoeff}${acid}`;
  const saltPart = saltCoeff === 1 ? saltFormula : `${saltCoeff}${saltFormula}`;
  const h2Part = h2Coeff === 1 ? 'H2' : `${h2Coeff}H2`;
  
  return {
    reactants: { [metal]: metalCoeff, [acid]: acidCoeff },
    condition: 'rt',
    products: [[saltFormula, saltCoeff], ['H2', h2Coeff]],
    equation: `${metalPart} + ${acidPart} -> ${saltPart} + ${h2Part}`,
    dynamic: true
  };
}

// Active metal + water: M + H2O -> MOH/M(OH)2 + H2
function tryMetalWaterReaction(formulas) {
  const have = multisetOf(formulas);
  if (have.size !== 2 || !have.has('H2O')) return null;
  
  const other = [...have.keys()].find(f => f !== 'H2O');
  if (!other) return null;
  
  const el = elementBySym(other);
  if (!el || !isMetal(el) || !el.charges || el.charges.length === 0) return null;
  
  const charge = el.charges[0];
  const isAlkali = el.cat === 'alkali';
  const isAlkalineEarth = el.cat === 'alkaline';
  
  if (!isAlkali && !isAlkalineEarth) return null;
  
  const cation = { sym: other, charge };
  const anion = { sym: 'OH', charge: -1 };
  
  const hydroxideFormula = generateHydroxideFormula(cation);
  const hydroxideTemplate = generateHydroxideTemplate(cation);
  T[hydroxideFormula] = hydroxideTemplate;
  
  // Alkali: 2M + 2H2O -> 2MOH + H2
  // Alkaline earth: M + 2H2O -> M(OH)2 + H2
  let metalCoeff, h2oCoeff, hydroCoeff, h2Coeff;
  if (charge === 1) {
    metalCoeff = 2; h2oCoeff = 2; hydroCoeff = 2; h2Coeff = 1;
  } else {
    metalCoeff = 1; h2oCoeff = 2; hydroCoeff = 1; h2Coeff = 1;
  }
  
  const metalPart = metalCoeff === 1 ? other : `${metalCoeff}${other}`;
  const hydroPart = hydroCoeff === 1 ? hydroxideFormula : `${hydroCoeff}${hydroxideFormula}`;
  
  return {
    reactants: { [other]: metalCoeff, H2O: h2oCoeff },
    condition: 'rt',
    products: [[hydroxideFormula, hydroCoeff], ['H2', h2Coeff]],
    equation: `${metalPart} + ${h2oCoeff}H2O -> ${hydroPart} + ${h2Coeff === 1 ? 'H2' : h2Coeff + 'H2'}`,
    dynamic: true
  };
}

function generateHydroxideFormula(cation) {
  const charge = cation.charge;
  if (charge === 1) return `${cation.sym}OH`;
  return `${cation.sym}(OH)${charge}`;
}

function generateHydroxideTemplate(cation) {
  const charge = cation.charge;
  const atoms = [cation.sym];
  for (let i = 0; i < charge; i++) {
    atoms.push('O', 'H');
  }
  const bonds = [];
  for (let i = 0; i < charge; i++) {
    const oIdx = 1 + i * 2;
    const hIdx = 2 + i * 2;
    bonds.push([0, oIdx, 1, true]);
    bonds.push([oIdx, hIdx, 1]);
  }
  return { atoms, bonds };
}

// Carbonate + acid: MCO3 + acid -> salt + CO2 + H2O
function isCarbonate(formula) {
  const c = parseFormula(formula);
  const cCount = c.get('C') || 0;
  const oCount = c.get('O') || 0;
  return cCount > 0 && oCount === cCount * 3;
}

function getCarbonateCation(formula) {
  const counts = parseFormula(formula);
  const cCount = counts.get('C') || 0;
  const oCount = counts.get('O') || 0;
  if (cCount === 0 || oCount !== cCount * 3) return null;

  const metalKeys = [...counts.keys()].filter(k => {
    if (k === 'C' || k === 'O') return false;
    const el = elementBySym(k);
    return el && isMetal(el);
  });

  if (metalKeys.length !== 1) return null;
  const metalSym = metalKeys[0];
  const metalCount = counts.get(metalSym) || 1;
  const metalEl = elementBySym(metalSym);
  if (!metalEl || !metalEl.charges || metalEl.charges.length === 0) return null;

  const totalNegCharge = cCount * 2;
  const charge = Math.round(totalNegCharge / metalCount);
  if (!metalEl.charges.includes(charge)) return null;

  return { sym: metalSym, charge };
}

function tryCarbonateAcidReaction(formulas) {
  const have = multisetOf(formulas);
  if (have.size !== 2) return null;
  
  const carbonates = [...have.keys()].filter(f => getCarbonateCation(f));
  const acids = [...have.keys()].filter(f => isAcid(f));
  
  if (carbonates.length === 0 || acids.length === 0) return null;
  
  const carbonate = carbonates[0];
  const acid = acids[0];
  const cation = getCarbonateCation(carbonate);
  const anion = getAcidAnion(acid);
  
  if (!cation || !anion) return null;
  
  const saltFormula = generateSaltFormula(cation, anion);
  const saltTemplate = generateSaltTemplate(cation, anion);
  T[saltFormula] = saltTemplate;
  
  const acidH = getAcidHCount(acid);
  if (acidH === 0) return null;
  
  // MCO3 + acid -> salt + CO2 + H2O
  // CO3^2- + 2H+ -> CO2 + H2O
  // acidCoeff * acidH = 2 * carbonateCoeff
  const g2 = gcd(2, acidH);
  const carbonateCoeff = acidH / g2;
  const acidCoeff = 2 / g2;
  const co2Coeff = carbonateCoeff;
  const h2oCoeff = acidCoeff * acidH / 2;
  
  // Salt coefficient: total cations / cations per salt formula
  const carbCounts = parseFormula(carbonate);
  const cationsInCarbonate = carbCounts.get(cation.sym) || 1;
  const totalCations = carbonateCoeff * cationsInCarbonate;
  const saltCounts = parseFormula(saltFormula);
  const cationsInSalt = saltCounts.get(cation.sym) || 1;
  const saltCoeff = totalCations / cationsInSalt;
  
  const g = gcd(gcd(carbonateCoeff, acidCoeff), gcd(saltCoeff, gcd(co2Coeff, h2oCoeff)));
  
  const carbPart = carbonateCoeff === 1 ? carbonate : `${carbonateCoeff}${carbonate}`;
  const acidPart = acidCoeff === 1 ? acid : `${acidCoeff}${acid}`;
  const saltPart = saltCoeff === 1 ? saltFormula : `${saltCoeff}${saltFormula}`;
  const co2Part = co2Coeff === 1 ? 'CO2' : `${co2Coeff}CO2`;
  const h2oPart = h2oCoeff === 1 ? 'H2O' : `${h2oCoeff}H2O`;
  
  return {
    reactants: { [carbonate]: carbonateCoeff, [acid]: acidCoeff },
    condition: 'rt',
    products: [[saltFormula, saltCoeff], ['CO2', co2Coeff], ['H2O', h2oCoeff]],
    equation: `${carbPart} + ${acidPart} -> ${saltPart} + ${co2Part} + ${h2oPart}`,
    dynamic: true
  };
}

// Metal oxide reduction (thermite-type): more reactive metal reduces a less
// reactive metal's oxide.  E.g. Fe2O3 + 2Al -> Al2O3 + 2Fe
const REACTIVITY = {
  Fr:1, Cs:2, Rb:3, K:4, Na:5, Li:6, Ba:7, Sr:8, Ca:9, Mg:10,
  Al:11, Mn:12, Zn:13, Cr:14, Fe:15, Cd:16, Co:17, Ni:18, Sn:19, Pb:20,
  Cu:21, Ag:22, Hg:23, Pt:24, Au:25,
};

function isMetalOxide(formula) {
  // Use classification system first
  const cls = classifyMolecule(formula, 0, null);
  if (cls.key !== 'basicOxide') return null;

  const counts = parseFormula(formula);
  const keys = [...counts.keys()];

  const metals = keys.filter(k => {
    const el = elementBySym(k);
    return el && isMetal(el);
  });

  if (metals.length !== 1 || keys.length !== 2 || !counts.has('O')) return null;

  const metalSym = metals[0];
  const metalCount = counts.get(metalSym);
  const oCount = counts.get('O');

  if ((oCount * 2) % metalCount !== 0) return null;

  return { metalSym, oCount, oxidationState: (oCount * 2) / metalCount };
}

function generateOxideFormula(metalSym, oxState) {
  if (oxState === 2) return `${metalSym}O`;
  if (oxState % 2 === 0) return `${metalSym}O${oxState / 2}`;
  return `${metalSym}2O${oxState}`;
}

function generateOxideTemplate(metalSym, oxState) {
  const formula = generateOxideFormula(metalSym, oxState);
  const counts = parseFormula(formula);
  const atoms = [];
  for (const [sym, n] of counts) for (let i = 0; i < n; i++) atoms.push(sym);
  
  const bonds = [];
  const metalIndices = [];
  const oxygenIndices = [];
  for (let i = 0; i < atoms.length; i++) {
    if (atoms[i] === 'O') oxygenIndices.push(i);
    else metalIndices.push(i);
  }
  
  // Bond each metal to all oxygen atoms (ionic lattice structure)
  for (const mIdx of metalIndices) {
    for (const oIdx of oxygenIndices) {
      bonds.push([mIdx, oIdx, 2, true]);
    }
  }
  return { atoms, bonds };
}

function generateSingleAtomTemplate(sym) {
  return { atoms: [sym], bonds: [] };
}

function tryMetalOxideReduction(formulas) {
  const have = multisetOf(formulas);
  if (have.size !== 2) return null;

  const keys = [...have.keys()];
  let oxideFormula = null, oxideInfo = null, reducingMetal = null;

  for (const f of keys) {
    const info = isMetalOxide(f);
    if (info) { oxideFormula = f; oxideInfo = info; }
    else {
      const el = elementBySym(f);
      if (el && isMetal(el) && el.charges && el.charges.length > 0) reducingMetal = f;
    }
  }

  if (!oxideFormula || !oxideInfo || !reducingMetal) return null;

  const redRank = REACTIVITY[reducingMetal];
  const oxRank = REACTIVITY[oxideInfo.metalSym];
  if (redRank == null || oxRank == null || redRank >= oxRank) return null;

  const redCharge = elementBySym(reducingMetal).charges[0];
  const oxState = oxideInfo.oxidationState;
  const oxideCounts = parseFormula(oxideFormula);
  const metalCount = oxideCounts.get(oxideInfo.metalSym) || 1;
  const g = gcd(redCharge, oxState);
  const lcmVal = (redCharge * oxState) / g;

  let oxideCoeff = lcmVal / oxState;
  let metalCoeff = (lcmVal * metalCount) / redCharge;
  const newOxideFormula = generateOxideFormula(reducingMetal, redCharge);
  const newOxideCounts = parseFormula(newOxideFormula);
  const newOxideO = newOxideCounts.get('O') || 1;
  const newOxideCoeff = (oxideCoeff * oxideInfo.oCount) / newOxideO;
  const freedMetalCoeff = oxideCoeff * (parseFormula(oxideFormula).get(oxideInfo.metalSym) || 1);

  const num = [oxideCoeff, metalCoeff, newOxideCoeff, freedMetalCoeff];
  let den = num[0];
  for (let i = 1; i < 4; i++) den = gcd(den, num[i]);
  const [a, b, c, d] = num.map(n => n / den);

  if (!T[newOxideFormula]) T[newOxideFormula] = generateOxideTemplate(reducingMetal, redCharge);
  if (!T[oxideInfo.metalSym]) T[oxideInfo.metalSym] = generateSingleAtomTemplate(oxideInfo.metalSym);

  const oP = a === 1 ? oxideFormula : `${a}${oxideFormula}`;
  const mP = b === 1 ? reducingMetal : `${b}${reducingMetal}`;
  const noP = c === 1 ? newOxideFormula : `${c}${newOxideFormula}`;
  const fP = d === 1 ? oxideInfo.metalSym : `${d}${oxideInfo.metalSym}`;

  return {
    reactants: { [oxideFormula]: a, [reducingMetal]: b },
    condition: 'heat',
    products: [[newOxideFormula, c], [oxideInfo.metalSym, d]],
    equation: `${oP} + ${mP} -> ${noP} + ${fP}`,
    dynamic: true,
  };
}

// Single displacement: A + BC → AC + B (more reactive metal displaces less
// reactive metal from compound).  E.g. Zn + CuSO4 -> ZnSO4 + Cu
function detectAnion(compCounts, metalSym, metalCount) {
  const metalEl = elementBySym(metalSym);
  if (!metalEl || !metalEl.charges || metalEl.charges.length === 0) return null;
  const metalCharge = metalEl.charges[0];
  const totalPositiveCharge = metalCharge * metalCount;

  const nonMetalKeys = [...compCounts.keys()].filter(k => {
    if (k === metalSym) return false;
    const el = elementBySym(k);
    return el && !isMetal(el);
  });

  const hasO = compCounts.has('O');
  const centralAtoms = nonMetalKeys.filter(k => k !== 'O');

  if (centralAtoms.length === 1 && hasO) {
    const central = centralAtoms[0];
    const centralCount = compCounts.get(central) || 1;
    const oCount = compCounts.get('O') || 0;
    const anionSym = oCount === 0 ? central :
                     oCount === 1 ? `${central}O` :
                     `${central}O${oCount}`;
    const chargePerUnit = -Math.round(totalPositiveCharge / centralCount);
    return { sym: anionSym, count: centralCount, chargePerUnit };
  }

  if (centralAtoms.length === 1 && !hasO) {
    const anionSym = centralAtoms[0];
    const anionCount = compCounts.get(anionSym) || 1;
    const chargePerUnit = -Math.round(totalPositiveCharge / anionCount);
    return { sym: anionSym, count: anionCount, chargePerUnit };
  }

  if (centralAtoms.length === 0 && hasO) {
    const oCount = compCounts.get('O') || 1;
    const chargePerUnit = -Math.round(totalPositiveCharge / oCount);
    return { sym: 'O', count: oCount, chargePerUnit };
  }

  return null;
}

function trySingleDisplacement(formulas) {
  const have = multisetOf(formulas);
  if (have.size !== 2) return null;

  const keys = [...have.keys()];
  let pureMetal = null, compound = null;

  for (const f of keys) {
    const el = elementBySym(f);
    if (el && isMetal(el) && el.charges && el.charges.length > 0) {
      pureMetal = f;
    } else {
      compound = f;
    }
  }

  if (!pureMetal || !compound) return null;

  const compCounts = parseFormula(compound);
  const compKeys = [...compCounts.keys()];
  const metalsInCompound = compKeys.filter(k => {
    const el = elementBySym(k);
    return el && isMetal(el);
  });

  if (metalsInCompound.length !== 1) return null;

  const displacedMetal = metalsInCompound[0];
  const pureRank = REACTIVITY[pureMetal];
  const displacedRank = REACTIVITY[displacedMetal];

  if (pureRank == null || displacedRank == null || pureRank >= displacedRank) return null;

  const pureCharge = elementBySym(pureMetal).charges[0];
  const displacedCharge = elementBySym(displacedMetal).charges[0];
  const displacedCount = compCounts.get(displacedMetal);
  const anion = detectAnion(compCounts, displacedMetal, displacedCount);
  if (!anion) return null;

  const newSaltFormula = generateSaltFormula(
    { sym: pureMetal, charge: pureCharge },
    { sym: anion.sym, charge: anion.chargePerUnit }
  );
  const newSaltTemplate = generateSaltTemplate(
    { sym: pureMetal, charge: pureCharge },
    { sym: anion.sym, charge: anion.chargePerUnit }
  );

  if (!T[newSaltFormula]) T[newSaltFormula] = newSaltTemplate;
  if (!T[displacedMetal]) T[displacedMetal] = generateSingleAtomTemplate(displacedMetal);

  const newSaltCounts = parseFormula(newSaltFormula);
  const pureAtomsInNewSalt = newSaltCounts.get(pureMetal) || 1;

  let newSaltCoeff = 1;
  let pureCoeff = pureAtomsInNewSalt;
  let compoundCoeff = (pureCoeff * pureCharge) / (displacedCount * displacedCharge);
  let displacedCoeff = compoundCoeff * displacedCount;

  const g = gcd(gcd(pureCoeff, compoundCoeff), gcd(newSaltCoeff, displacedCoeff));
  const [a, b, c, d] = [pureCoeff, compoundCoeff, newSaltCoeff, displacedCoeff].map(n => n / g);

  const mP = a === 1 ? pureMetal : `${a}${pureMetal}`;
  const cP = b === 1 ? compound : `${b}${compound}`;
  const nsP = c === 1 ? newSaltFormula : `${c}${newSaltFormula}`;
  const dP = d === 1 ? displacedMetal : `${d}${displacedMetal}`;

  return {
    reactants: { [pureMetal]: a, [compound]: b },
    condition: 'rt',
    products: [[newSaltFormula, c], [displacedMetal, d]],
    equation: `${mP} + ${cP} -> ${nsP} + ${dP}`,
    dynamic: true,
  };
}

// Metal + halogen synthesis: M + X2 → MXn.  E.g. 2Al + 3Cl2 -> 2AlCl3
function tryMetalHalogenSynthesis(formulas) {
  const have = multisetOf(formulas);
  if (have.size !== 2) return null;

  const keys = [...have.keys()];
  let metal = null, halogen = null;

  for (const f of keys) {
    const el = elementBySym(f);
    if (el && isMetal(el) && el.charges && el.charges.length > 0) {
      metal = f;
    } else if (f === 'Cl2' || f === 'Br2' || f === 'F2' || f === 'I2') {
      halogen = f;
    }
  }

  if (!metal || !halogen) return null;

  const metalCharge = elementBySym(metal).charges[0];
  const halogenSym = halogen.replace('2', '');
  const halideFormula = generateSaltFormula(
    { sym: metal, charge: metalCharge },
    { sym: halogenSym, charge: -1 }
  );
  const halideTemplate = generateSaltTemplate(
    { sym: metal, charge: metalCharge },
    { sym: halogenSym, charge: -1 }
  );

  if (!T[halideFormula]) T[halideFormula] = halideTemplate;

  const halideCounts = parseFormula(halideFormula);
  const metalInHalide = halideCounts.get(metal) || 1;
  const halogenInHalide = halideCounts.get(halogenSym) || 1;

  let metalCoeff = metalInHalide;
  let halogenCoeff = halogenInHalide / 2;
  let halideCoeff = 1;

  if (halogenCoeff !== Math.floor(halogenCoeff)) {
    metalCoeff *= 2;
    halogenCoeff *= 2;
    halideCoeff *= 2;
  }

  const g = gcd(gcd(metalCoeff, halogenCoeff), halideCoeff);
  metalCoeff /= g;
  halogenCoeff /= g;
  halideCoeff /= g;

  const mP = metalCoeff === 1 ? metal : `${metalCoeff}${metal}`;
  const hP = halogenCoeff === 1 ? halogen : `${halogenCoeff}${halogen}`;
  const hp = halideCoeff === 1 ? halideFormula : `${halideCoeff}${halideFormula}`;

  return {
    reactants: { [metal]: metalCoeff, [halogen]: halogenCoeff },
    condition: 'heat',
    products: [[halideFormula, halideCoeff]],
    equation: `${mP} + ${hP} -> ${hp}`,
    dynamic: true,
  };
}

// Metal dimer formation: M + M → M₂ (quadruple bond for transition metals)
// E.g. Mo + Mo -> Mo2, W + W -> W2, Re + Re -> Re2
function tryMetalDimerFormation(formulas) {
  const have = multisetOf(formulas);
  if (have.size !== 1) return null;

  const keys = [...have.keys()];
  const metal = keys[0];
  const count = have.get(metal);

  if (count < 2) return null;

  const el = elementBySym(metal);
  if (!el || !isMetal(el)) return null;

  // Only transition metals form stable dimers with quadruple bonds
  const transitionMetals = new Set([
    'Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn',
    'Y', 'Zr', 'Nb', 'Mo', 'Tc', 'Ru', 'Rh', 'Pd', 'Ag', 'Cd',
    'Hf', 'Ta', 'W', 'Re', 'Os', 'Ir', 'Pt', 'Au', 'Hg',
  ]);

  if (!transitionMetals.has(metal)) return null;

  const dimerFormula = `${metal}2`;
  const dimerTemplate = {
    atoms: [metal, metal],
    bonds: [[0, 1, 4]]  // Quadruple bond
  };

  if (!T[dimerFormula]) T[dimerFormula] = dimerTemplate;

  const pairs = Math.floor(count / 2);
  if (pairs < 1) return null;

  const mP = count === 2 ? metal : `${count}${metal}`;
  const dP = pairs === 1 ? dimerFormula : `${pairs}${dimerFormula}`;

  return {
    reactants: { [metal]: count },
    condition: 'heat',
    products: [[dimerFormula, pairs]],
    equation: `${mP} -> ${dP}`,
    dynamic: true,
  };
}

// Metal dimer decomposition: M₂ → 2M (reverse of formation)
function tryMetalDimerDecomposition(formulas) {
  const have = multisetOf(formulas);
  if (have.size !== 1) return null;

  const keys = [...have.keys()];
  const dimer = keys[0];

  // Check if it's a metal dimer (X2 where X is a transition metal)
  const m = dimer.match(/^([A-Z][a-z]?)2$/);
  if (!m) return null;

  const metal = m[1];
  const el = elementBySym(metal);
  if (!el || !isMetal(el)) return null;

  const transitionMetals = new Set([
    'Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn',
    'Y', 'Zr', 'Nb', 'Mo', 'Tc', 'Ru', 'Rh', 'Pd', 'Ag', 'Cd',
    'Hf', 'Ta', 'W', 'Re', 'Os', 'Ir', 'Pt', 'Au', 'Hg',
  ]);

  if (!transitionMetals.has(metal)) return null;

  const count = have.get(dimer);
  const metalCoeff = count * 2;
  const dP = metalCoeff === 1 ? metal : `${metalCoeff}${metal}`;
  const mP = count === 1 ? dimer : `${count}${dimer}`;

  return {
    reactants: { [dimer]: count },
    condition: 'heat',
    products: [[metal, metalCoeff]],
    equation: `${mP} -> ${dP}`,
    dynamic: true,
  };
}

// ── Organic reaction patterns ──

function isAlkane(f) {
  const cls = classifyMolecule(f, 0, null);
  return cls.key === 'alkane';
}

function isAlkene(f) {
  const cls = classifyMolecule(f, 0, null);
  return cls.key === 'alkene';
}

function isAlkyne(f) {
  const cls = classifyMolecule(f, 0, null);
  return cls.key === 'alkyne';
}

function isAlcohol(f) {
  const cls = classifyMolecule(f, 0, null);
  return cls.key === 'alcohol';
}

function isCarboxylicAcid(f) {
  const cls = classifyMolecule(f, 0, null);
  return cls.key === 'carboxylicAcid';
}

function tryEsterification(formulas) {
  if (formulas.length !== 2) return null;
  const [a, b] = formulas;
  let acid = null, alcohol = null;
  if (isCarboxylicAcid(a) && isAlcohol(b)) { acid = a; alcohol = b; }
  else if (isCarboxylicAcid(b) && isAlcohol(a)) { acid = b; alcohol = a; }
  if (!acid || !alcohol) return null;

  const ac = parseFormula(acid);
  const al = parseFormula(alcohol);
  const acidC = ac.get('C');
  const alcoholC = al.get('C');

  const esterC = acidC + alcoholC;
  const esterH = 2 * esterC;
  const esterFormula = organicFormula(esterC, esterH, 2, 0);

  if (!T[esterFormula]) T[esterFormula] = generateEsterTemplate(acidC, alcoholC);

  const acidP = acid;
  const alP = alcohol;
  const estP = esterFormula;

  return {
    reactants: { [acid]: 1, [alcohol]: 1 },
    condition: 'catalyst',
    products: [[estP, 1], ['H2O', 1]],
    equation: `${acidP} + ${alP} -> ${estP} + H2O`,
    dynamic: true,
  };
}

function tryHydrogenation(formulas) {
  if (formulas.length !== 2) return null;
  const [a, b] = formulas;
  let unsat = null;
  if (a === 'H2' && (isAlkene(b) || isAlkyne(b))) unsat = b;
  else if (b === 'H2' && (isAlkene(a) || isAlkyne(a))) unsat = a;
  if (!unsat) return null;

  const c = parseFormula(unsat);
  const n = c.get('C');
  const h = c.get('H');

  if (h === 2 * n) {
    const prodFormula = organicFormula(n, 2 * n + 2, 0, 0);
    if (!T[prodFormula]) T[prodFormula] = buildAlkaneTemplate(n);
    return {
      reactants: { [unsat]: 1, H2: 1 },
      condition: 'catalyst',
      products: [[prodFormula, 1]],
      equation: `${unsat} + H2 -> ${prodFormula}`,
      dynamic: true,
    };
  }
  if (h === 2 * n - 2) {
    const prodFormula = organicFormula(n, 2 * n, 0, 0);
    if (!T[prodFormula]) T[prodFormula] = buildAlkeneTemplate(n);
    return {
      reactants: { [unsat]: 1, H2: 1 },
      condition: 'catalyst',
      products: [[prodFormula, 1]],
      equation: `${unsat} + H2 -> ${prodFormula}`,
      dynamic: true,
    };
  }
  return null;
}

function tryHalogenation(formulas) {
  if (formulas.length !== 2) return null;
  const [a, b] = formulas;
  let alkane = null, halogen = null;
  const diatomicHal = { Cl2: 'Cl', Br2: 'Br', F2: 'F', I2: 'I' };
  if (isAlkane(a) && diatomicHal[b]) { alkane = a; halogen = diatomicHal[b]; }
  else if (isAlkane(b) && diatomicHal[a]) { alkane = b; halogen = diatomicHal[a]; }
  if (!alkane || !halogen) return null;

  const c = parseFormula(alkane);
  const n = c.get('C');
  const haloFormula = buildHaloalkaneFormula(n, halogen);
  const hxFormula = `H${halogen}`;

  if (!T[haloFormula]) T[haloFormula] = buildHaloalkaneTemplate(n, halogen);

  const halogenKey = Object.keys(diatomicHal).find(k => diatomicHal[k] === halogen);

  return {
    reactants: { [alkane]: 1, [halogenKey]: 1 },
    condition: 'uv',
    products: [[haloFormula, 1], [hxFormula, 1]],
    equation: `${alkane} + ${halogenKey} -> ${haloFormula} + ${hxFormula}`,
    dynamic: true,
  };
}

function buildHaloalkaneFormula(alkaneC, halSym) {
  const hCount = 2 * alkaneC + 2 - 1;
  let f = '';
  if (alkaneC === 1) f += 'C'; else f += `C${alkaneC}`;
  if (hCount === 1) f += 'H'; else f += `H${hCount}`;
  f += halSym;
  return f;
}

function isEster(f) {
  const c = parseFormula(f);
  if (!c.has('C') || !c.has('H') || !c.has('O')) return false;
  if (c.size !== 3) return false;
  const n = c.get('C'), h = c.get('H'), o = c.get('O');
  return o === 2 && h === 2 * n;
}

function isHaloalkane(f) {
  const cls = classifyMolecule(f, 0, null);
  return cls.key === 'haloalkane';
}

function tryDehydration(formulas) {
  if (formulas.length !== 1) return null;
  const alcohol = formulas[0];
  if (!isAlcohol(alcohol)) return null;
  const c = parseFormula(alcohol);
  const n = c.get('C');
  if (n < 2) return null;
  const alkeneF = organicFormula(n, 2 * n, 0, 0);
  if (!T[alkeneF]) T[alkeneF] = buildAlkeneTemplate(n);
  return {
    reactants: { [alcohol]: 1 },
    condition: 'heat',
    products: [[alkeneF, 1], ['H2O', 1]],
    equation: `${alcohol} -> ${alkeneF} + H2O`,
    dynamic: true,
  };
}

function tryAlkeneAdditionHX(formulas) {
  if (formulas.length !== 2) return null;
  const [a, b] = formulas;
  let alkene = null, hx = null, halSym = null;
  const hxMap = { HCl: 'Cl', HBr: 'Br', HF: 'F', HI: 'I' };
  if (isAlkene(a) && hxMap[b]) { alkene = a; hx = b; halSym = hxMap[b]; }
  else if (isAlkene(b) && hxMap[a]) { alkene = b; hx = a; halSym = hxMap[a]; }
  if (!alkene || !halSym) return null;
  const c = parseFormula(alkene);
  const n = c.get('C');
  const haloFormula = buildHaloalkaneFormula(n, halSym);
  if (!T[haloFormula]) T[haloFormula] = buildHaloalkaneTemplate(n, halSym);
  return {
    reactants: { [alkene]: 1, [hx]: 1 },
    condition: 'rt',
    products: [[haloFormula, 1]],
    equation: `${alkene} + ${hx} -> ${haloFormula}`,
    dynamic: true,
  };
}

function tryAlkeneHydration(formulas) {
  if (formulas.length !== 2) return null;
  const [a, b] = formulas;
  let alkene = null;
  if (a === 'H2O' && isAlkene(b)) alkene = b;
  else if (b === 'H2O' && isAlkene(a)) alkene = a;
  if (!alkene) return null;
  const c = parseFormula(alkene);
  const n = c.get('C');
  const alcoholF = organicFormula(n, 2 * n + 2, 1, 0);
  if (!T[alcoholF]) T[alcoholF] = buildAlcoholTemplate(n);
  return {
    reactants: { [alkene]: 1, H2O: 1 },
    condition: 'catalyst',
    products: [[alcoholF, 1]],
    equation: `${alkene} + H2O -> ${alcoholF}`,
    dynamic: true,
  };
}

function tryEsterHydrolysis(formulas) {
  if (formulas.length !== 2) return null;
  const [a, b] = formulas;
  let ester = null;
  if (a === 'H2O' && isEster(b)) ester = b;
  else if (b === 'H2O' && isEster(a)) ester = a;
  if (!ester) return null;
  const c = parseFormula(ester);
  const n = c.get('C');
  for (let acidC = 1; acidC < n; acidC++) {
    const alcoholC = n - acidC;
    const acidF = organicFormula(acidC, 2 * acidC, 2, 0);
    const alcoholF = organicFormula(alcoholC, 2 * alcoholC + 2, 1, 0);
    if (!T[acidF]) T[acidF] = buildCarboxylicAcidTemplate(acidC);
    if (!T[alcoholF]) T[alcoholF] = buildAlcoholTemplate(alcoholC);
    return {
      reactants: { [ester]: 1, H2O: 1 },
      condition: 'catalyst',
      products: [[acidF, 1], [alcoholF, 1]],
      equation: `${ester} + H2O -> ${acidF} + ${alcoholF}`,
      dynamic: true,
    };
  }
  return null;
}

function buildCarboxylicAcidTemplate(n) {
  const atoms = [];
  for (let i = 0; i < n; i++) atoms.push('C');
  atoms.push('O');
  atoms.push('O');
  const totalH = 2 * n - 1;
  for (let i = 0; i < totalH; i++) atoms.push('H');
  const bonds = [];
  for (let i = 0; i < n - 1; i++) bonds.push([i, i + 1, 1]);
  bonds.push([n - 1, n, 2]);
  bonds.push([n - 1, n + 1, 1]);
  let hIdx = n + 2;
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < 2 && hIdx < atoms.length; j++) bonds.push([i, hIdx++, 1]);
  }
  if (hIdx < atoms.length) bonds.push([n + 1, hIdx++, 1]);
  return { atoms, bonds };
}

// ========== PRECIPITATION & DOUBLE DISPLACEMENT ==========

const COMMON_CATIONS = {
  'Li': { sym: 'Li', charge: 1, group: 1 }, 'Na': { sym: 'Na', charge: 1, group: 1 },
  'K': { sym: 'K', charge: 1, group: 1 }, 'Rb': { sym: 'Rb', charge: 1, group: 1 },
  'Cs': { sym: 'Cs', charge: 1, group: 1 }, 'NH4': { sym: 'NH4', charge: 1, group: -1 },
  'Ag': { sym: 'Ag', charge: 1, group: -2 }, 'Pb': { sym: 'Pb', charge: 2, group: -2 },
  'Hg2': { sym: 'Hg2', charge: 2, group: -2 },
  'Ba': { sym: 'Ba', charge: 2, group: 2 }, 'Sr': { sym: 'Sr', charge: 2, group: 2 },
  'Ca': { sym: 'Ca', charge: 2, group: 2 }, 'Mg': { sym: 'Mg', charge: 2, group: 2 },
  'Fe': { sym: 'Fe', charge: 3, group: -3 }, 'Fe2': { sym: 'Fe', charge: 2, group: -3 },
  'Cu': { sym: 'Cu', charge: 2, group: -3 }, 'Cu1': { sym: 'Cu', charge: 1, group: -3 },
  'Zn': { sym: 'Zn', charge: 2, group: -3 }, 'Al': { sym: 'Al', charge: 3, group: -3 },
  'Cr': { sym: 'Cr', charge: 3, group: -3 }, 'Ni': { sym: 'Ni', charge: 2, group: -3 },
  'Co': { sym: 'Co', charge: 2, group: -3 }, 'Mn': { sym: 'Mn', charge: 2, group: -3 },
};

const COMMON_ANIONS = {
  'NO3': { sym: 'NO3', charge: -1, type: 'nitrate' },
  'C2H3O2': { sym: 'C2H3O2', charge: -1, type: 'acetate' },
  'Cl': { sym: 'Cl', charge: -1, type: 'halide' },
  'Br': { sym: 'Br', charge: -1, type: 'halide' },
  'I': { sym: 'I', charge: -1, type: 'halide' },
  'SO4': { sym: 'SO4', charge: -2, type: 'sulfate' },
  'OH': { sym: 'OH', charge: -1, type: 'hydroxide' },
  'S': { sym: 'S', charge: -2, type: 'sulfide' },
  'CO3': { sym: 'CO3', charge: -2, type: 'carbonate' },
  'PO4': { sym: 'PO4', charge: -3, type: 'phosphate' },
  'CrO4': { sym: 'CrO4', charge: -2, type: 'chromate' },
};

function isSoluble(cation, anion) {
  if (!cation || !anion) return true;
  if (cation.group === 1 || cation.sym === 'NH4') return true;
  if (anion.type === 'nitrate' || anion.type === 'acetate') return true;
  if (anion.type === 'halide') {
    if (cation.sym === 'Ag' || cation.sym === 'Pb' || cation.sym === 'Hg2') return false;
    return true;
  }
  if (anion.type === 'sulfate') {
    if (cation.sym === 'Ba' || cation.sym === 'Sr' || cation.sym === 'Pb') return false;
    if (cation.sym === 'Ca') return true;
    return true;
  }
  if (anion.type === 'hydroxide' || anion.type === 'sulfide' ||
      anion.type === 'carbonate' || anion.type === 'phosphate' || anion.type === 'chromate') {
    return false;
  }
  return true;
}

function parseIonicCompound(formula) {
  const f = normalizeFormula(formula);
  for (const [catSym, cat] of Object.entries(COMMON_CATIONS)) {
    for (const [anSym, an] of Object.entries(COMMON_ANIONS)) {
      const catCharge = Math.abs(cat.charge);
      const anCharge = Math.abs(an.charge);
      const lcm = (catCharge * anCharge) / gcd(catCharge, anCharge);
      const catCount = lcm / catCharge;
      const anCount = lcm / anCharge;

      let expected = catSym;
      if (catCount > 1) expected += catCount;
      if (anCount > 1 && anSym.length > 1) {
        expected += `(${anSym})${anCount}`;
      } else {
        expected += anSym;
        if (anCount > 1) expected += anCount;
      }
      if (normalizeFormula(expected) === f) {
        return { cation: cat, anion: an, catCount, anCount };
      }
    }
  }
  return null;
}

function buildIonicFormula(cation, anion) {
  const catCharge = Math.abs(cation.charge);
  const anCharge = Math.abs(anion.charge);
  const lcm = (catCharge * anCharge) / gcd(catCharge, anCharge);
  const catCount = lcm / catCharge;
  const anCount = lcm / anCharge;

  let formula = cation.sym;
  if (catCount > 1) formula += catCount;
  if (anCount > 1 && anion.sym.length > 1) {
    formula += `(${anion.sym})${anCount}`;
  } else {
    formula += anion.sym;
    if (anCount > 1) formula += anCount;
  }
  return formula;
}

function tryPrecipitation(formulas) {
  if (formulas.length !== 2) return null;
  const [f1, f2] = formulas;
  const ions1 = parseIonicCompound(f1);
  const ions2 = parseIonicCompound(f2);
  if (!ions1 || !ions2) return null;

  const prodA = buildIonicFormula(ions1.cation, ions2.anion);
  const prodB = buildIonicFormula(ions2.cation, ions1.anion);

  const solA = isSoluble(ions1.cation, ions2.anion);
  const solB = isSoluble(ions2.cation, ions1.anion);

  if (solA && solB) return null;
  if (prodA === f1 && prodB === f2) return null;
  if (prodA === prodB) return null;

  const catCharge1 = Math.abs(ions1.cation.charge);
  const anCharge2 = Math.abs(ions2.anion.charge);
  const lcmA = (catCharge1 * anCharge2) / gcd(catCharge1, anCharge2);
  const coeffA = lcmA / catCharge1;
  const coeffB_factor = lcmA / anCharge2;

  const catCharge2 = Math.abs(ions2.cation.charge);
  const anCharge1 = Math.abs(ions1.anion.charge);
  const lcmB = (catCharge2 * anCharge1) / gcd(catCharge2, anCharge1);
  const coeffB = lcmB / catCharge2;

  const reactantCoeff1 = lcmA / Math.abs(ions1.cation.charge) * Math.abs(ions1.anion.charge) / gcd(Math.abs(ions1.anion.charge), Math.abs(ions2.cation.charge));

  const phaseA = solA ? '(aq)' : '(s)';
  const phaseB = solB ? '(aq)' : '(s)';

  const eq = `${f1}(aq) + ${f2}(aq) -> ${prodA}${phaseA} + ${prodB}${phaseB}`;

  if (!T[prodA]) T[prodA] = { atoms: [], bonds: [] };
  if (!T[prodB]) T[prodB] = { atoms: [], bonds: [] };

  return {
    reactants: { [f1]: 1, [f2]: 1 },
    condition: 'rt',
    products: [[prodA, 1], [prodB, 1]],
    equation: eq,
    dynamic: true,
    phases: { [prodA]: phaseA, [prodB]: phaseB },
  };
}

// ========== ADVANCED DECOMPOSITION PATTERNS ==========

function tryAdvancedDecomposition(formulas) {
  if (formulas.length !== 1) return null;
  const f = formulas[0];
  const parsed = parseFormula(f);

  const nitrateMatch = f.match(/^(.+?)\(NO3\)(\d*)$/);
  if (nitrateMatch) {
    const metalSym = nitrateMatch[1];
    const no3Count = nitrateMatch[2] ? parseInt(nitrateMatch[2]) : 1;
    const metal = COMMON_CATIONS[metalSym] || COMMON_CATIONS[metalSym + '2'];

    if (metal) {
      if (metal.group === 1) {
        const nitrite = metalSym + 'NO2';
        if (!T[nitrite]) T[nitrite] = { atoms: [], bonds: [] };
        return {
          reactants: { [f]: 2 },
          condition: 'heat',
          products: [[nitrite, 2], ['O2', 1]],
          equation: `2${f} -> 2${nitrite} + O2`,
          dynamic: true,
        };
      } else {
        const oxide = buildIonicFormula(metal, { sym: 'O', charge: -2 });
        if (!T[oxide]) T[oxide] = { atoms: [], bonds: [] };
        return {
          reactants: { [f]: 2 },
          condition: 'heat',
          products: [[oxide, 1], ['NO2', no3Count * 2], ['O2', 1]],
          equation: `2${f} -> ${oxide} + ${no3Count * 2}NO2 + O2`,
          dynamic: true,
        };
      }
    }
  }

  const chlorateMatch = f.match(/^(.+?)ClO3(\d*)$/);
  if (chlorateMatch) {
    const metalSym = chlorateMatch[1];
    const metal = COMMON_CATIONS[metalSym];
    if (metal) {
      const chloride = buildIonicFormula(metal, { sym: 'Cl', charge: -1 });
      if (!T[chloride]) T[chloride] = { atoms: [], bonds: [] };
      return {
        reactants: { [f]: 2 },
        condition: 'heat',
        products: [[chloride, 2], ['O2', 3]],
        equation: `2${f} -> 2${chloride} + 3O2`,
        dynamic: true,
      };
    }
  }

  if (f === 'NH4Cl') {
    return {
      reactants: { NH4Cl: 1 },
      condition: 'heat',
      products: [['NH3', 1], ['HCl', 1]],
      equation: 'NH4Cl -> NH3 + HCl',
      dynamic: true,
    };
  }

  return null;
}

// ========== EXTENDED GAS EVOLUTION REACTIONS ==========

function tryGasEvolution(formulas) {
  if (formulas.length !== 2) return null;
  let acid = null, salt = null;
  for (const f of formulas) {
    if (isAcid(f)) acid = f;
    else salt = f;
  }
  if (!acid || !salt) return null;

  const saltParsed = parseFormula(salt);

  if (saltParsed.has('S') && saltParsed.get('S') === 1 && !saltParsed.has('O')) {
    const metalPart = [...saltParsed.entries()].filter(([sym]) => sym !== 'S');
    if (metalPart.length === 1) {
      const metalSym = metalPart[0][0];
      const metal = COMMON_CATIONS[metalSym] || COMMON_CATIONS[metalSym + '2'];
      if (metal) {
        const h2sCount = metal.charge === 2 ? 1 : metal.charge;
        return {
          reactants: { [salt]: 1, [acid]: 1 },
          condition: 'rt',
          products: [['H2S', 1], [buildIonicFormula(metal, getAcidAnion(acid)), 1]],
          equation: `${salt} + ${acid} -> H2S(g) + ${buildIonicFormula(metal, getAcidAnion(acid))}`,
          dynamic: true,
          gas: 'H2S',
        };
      }
    }
  }

  if (saltParsed.has('S') && saltParsed.has('O')) {
    const sCount = saltParsed.get('S');
    const oCount = saltParsed.get('O');
    if (oCount / sCount === 3) {
      return {
        reactants: { [salt]: 1, [acid]: 1 },
        condition: 'rt',
        products: [['SO2', 1], ['H2O', 1]],
        equation: `${salt} + ${acid} -> SO2(g) + H2O + ...`,
        dynamic: true,
        gas: 'SO2',
      };
    }
  }

  if (salt === 'NH4Cl' || salt === 'NH4NO3' || salt === '(NH4)2SO4') {
    if (isBase(acid) || acid === 'NaOH' || acid === 'KOH') {
      return {
        reactants: { [salt]: 1, [acid]: 1 },
        condition: 'rt',
        products: [['NH3', 1], ['H2O', 1]],
        equation: `${salt} + ${acid} -> NH3(g) + H2O + ...`,
        dynamic: true,
        gas: 'NH3',
      };
    }
  }

  if (saltParsed.has('N') && saltParsed.has('O')) {
    const nCount = saltParsed.get('N');
    const oCount = saltParsed.get('O');
    if (oCount / nCount === 2) {
      return {
        reactants: { [salt]: 1, [acid]: 1 },
        condition: 'rt',
        products: [['NO', 1], ['H2O', 1]],
        equation: `${salt} + ${acid} -> NO(g) + H2O + ...`,
        dynamic: true,
        gas: 'NO',
      };
    }
  }

  return null;
}

// ========== COMPLEX REDOX BALANCING ==========

const OXIDATION_STATES = {
  'H': [1, -1], 'O': [-2, -1], 'F': [-1],
  'Li': [1], 'Na': [1], 'K': [1], 'Rb': [1], 'Cs': [1],
  'Be': [2], 'Mg': [2], 'Ca': [2], 'Sr': [2], 'Ba': [2],
  'Al': [3], 'Zn': [2], 'Ag': [1], 'Cu': [2, 1], 'Fe': [3, 2],
  'Mn': [7, 4, 2], 'Cr': [6, 3], 'Ni': [2], 'Co': [2, 3],
  'Pb': [2, 4], 'Sn': [2, 4], 'Cl': [-1, 1, 3, 5, 7],
  'Br': [-1, 1, 3, 5], 'I': [-1, 1, 3, 5, 7],
  'S': [-2, 4, 6], 'N': [-3, 3, 5], 'P': [3, 5],
  'C': [4, 2, -4], 'W': [6], 'Mo': [6], 'V': [5, 4, 3, 2],
};

function getOxidationState(sym, formula) {
  const parsed = parseFormula(formula);
  const states = OXIDATION_STATES[sym];
  if (!states || states.length === 0) return 0;

  if (sym === 'O') return parsed.has('H') && parsed.get('H') === 2 && parsed.size === 2 ? -1 : -2;
  if (sym === 'H') return parsed.has('O') ? 1 : (states.includes(-1) ? -1 : 1);

  let totalCharge = 0;
  for (const [s, count] of parsed) {
    if (s === sym) continue;
    const sStates = OXIDATION_STATES[s];
    if (sStates && sStates.length > 0) {
      totalCharge += sStates[0] * count;
    }
  }

  for (const state of states) {
    const symCount = parsed.get(sym) || 1;
    if (state * symCount + totalCharge === 0) return state;
  }

  return states[0];
}

function detectRedoxPairs(formulas) {
  if (formulas.length < 2) return null;

  const allElements = new Set();
  for (const f of formulas) {
    const parsed = parseFormula(f);
    for (const sym of parsed.keys()) allElements.add(sym);
  }

  const oxidized = [];
  const reduced = [];

  for (const sym of allElements) {
    if (sym === 'H' || sym === 'O') continue;
    const states = new Set();
    for (const f of formulas) {
      const parsed = parseFormula(f);
      if (parsed.has(sym)) {
        states.add(getOxidationState(sym, f));
      }
    }
    if (states.size > 1) {
      const stateArray = [...states].sort((a, b) => a - b);
      reduced.push({ sym, from: stateArray[stateArray.length - 1], to: stateArray[0] });
      oxidized.push({ sym, from: stateArray[0], to: stateArray[stateArray.length - 1] });
    }
  }

  if (oxidized.length === 0 || reduced.length === 0) return null;
  return { oxidized: oxidized[0], reduced: reduced[0] };
}

function tryRedoxBalancing(formulas) {
  if (formulas.length < 2) return null;

  const redoxPatterns = [
    {
      reactants: ['Fe2O3', 'CO'],
      condition: 'heat',
      products: [['Fe', 2], ['CO2', 3]],
      equation: 'Fe2O3 + 3CO -> 2Fe + 3CO2',
    },
    {
      reactants: ['CuO', 'H2'],
      condition: 'heat',
      products: [['Cu', 1], ['H2O', 1]],
      equation: 'CuO + H2 -> Cu + H2O',
    },
    {
      reactants: ['WO3', 'H2'],
      condition: 'heat',
      products: [['W', 1], ['H2O', 3]],
      equation: 'WO3 + 3H2 -> W + 3H2O',
    },
    {
      reactants: ['Cr2O3', 'Al'],
      condition: 'heat',
      products: [['Cr', 2], ['Al2O3', 1]],
      equation: 'Cr2O3 + 2Al -> 2Cr + Al2O3',
    },
    {
      reactants: ['KMnO4', 'HCl'],
      condition: 'rt',
      products: [['KCl', 1], ['MnCl2', 1], ['Cl2', 5], ['H2O', 8]],
      equation: '2KMnO4 + 16HCl -> 2KCl + 2MnCl2 + 5Cl2 + 8H2O',
    },
    {
      reactants: ['K2Cr2O7', 'HCl'],
      condition: 'rt',
      products: [['KCl', 2], ['CrCl3', 2], ['Cl2', 3], ['H2O', 7]],
      equation: 'K2Cr2O7 + 14HCl -> 2KCl + 2CrCl3 + 3Cl2 + 7H2O',
    },
    {
      reactants: ['Zn', 'HCl'],
      condition: 'rt',
      products: [['ZnCl2', 1], ['H2', 1]],
      equation: 'Zn + 2HCl -> ZnCl2 + H2',
    },
    {
      reactants: ['Fe', 'HCl'],
      condition: 'rt',
      products: [['FeCl2', 1], ['H2', 1]],
      equation: 'Fe + 2HCl -> FeCl2 + H2',
    },
    {
      reactants: ['Mg', 'HCl'],
      condition: 'rt',
      products: [['MgCl2', 1], ['H2', 1]],
      equation: 'Mg + 2HCl -> MgCl2 + H2',
    },
    {
      reactants: ['Al', 'HCl'],
      condition: 'rt',
      products: [['AlCl3', 2], ['H2', 3]],
      equation: '2Al + 6HCl -> 2AlCl3 + 3H2',
    },
  ];

  for (const pattern of redoxPatterns) {
    const patternSet = new Set(pattern.reactants.map(normalizeFormula));
    const inputSet = new Set(formulas.map(normalizeFormula));
    if (patternSet.size === inputSet.size && [...patternSet].every(f => inputSet.has(f))) {
      for (const [prod, count] of pattern.products) {
        if (!T[prod]) T[prod] = { atoms: [], bonds: [] };
      }
      const reactantObj = {};
      for (const r of pattern.reactants) reactantObj[r] = 1;
      return {
        reactants: reactantObj,
        condition: pattern.condition,
        products: pattern.products,
        equation: pattern.equation,
        dynamic: true,
        redox: true,
      };
    }
  }

  const pairs = detectRedoxPairs(formulas);
  if (!pairs) return null;

  return null;
}

// ========== COORDINATION CHEMISTRY ==========

const COORDINATION_GEOMETRIES = {
  2: 'linear',
  4: ['tetrahedral', 'square planar'],
  6: 'octahedral',
};

const COMMON_LIGANDS = {
  'H2O': { name: 'aqua', charge: 0, denticity: 1 },
  'NH3': { name: 'ammine', charge: 0, denticity: 1 },
  'Cl': { name: 'chloro', charge: -1, denticity: 1 },
  'Br': { name: 'bromo', charge: -1, denticity: 1 },
  'I': { name: 'iodo', charge: -1, denticity: 1 },
  'OH': { name: 'hydroxo', charge: -1, denticity: 1 },
  'CN': { name: 'cyano', charge: -1, denticity: 1 },
  'CO': { name: 'carbonyl', charge: 0, denticity: 1 },
  'NO2': { name: 'nitro', charge: -1, denticity: 1 },
  'en': { name: 'ethylenediamine', charge: 0, denticity: 2 },
  'ox': { name: 'oxalato', charge: -2, denticity: 2 },
};

function tryCoordinationComplex(formulas) {
  if (formulas.length < 2) return null;

  const transitionMetals = ['Fe', 'Cu', 'Co', 'Ni', 'Zn', 'Cr', 'Mn', 'Pt', 'Pd', 'Ag'];
  let metal = null;
  let ligands = [];

  for (const f of formulas) {
    const parsed = parseFormula(f);
    let isMetal = false;
    for (const sym of parsed.keys()) {
      if (transitionMetals.includes(sym)) {
        metal = { sym, formula: f };
        isMetal = true;
        break;
      }
    }
    if (!isMetal && COMMON_LIGANDS[f]) {
      ligands.push({ formula: f, ...COMMON_LIGANDS[f] });
    }
  }

  if (!metal || ligands.length === 0) return null;

  const totalLigandCharge = ligands.reduce((sum, l) => sum + l.charge, 0);
  const metalOxidationStates = OXIDATION_STATES[metal.sym];
  if (!metalOxidationStates || metalOxidationStates.length === 0) return null;

  const metalCharge = metalOxidationStates[0];
  const complexCharge = metalCharge + totalLigandCharge;

  const coordinationNumber = ligands.reduce((sum, l) => sum + l.denticity, 0);
  if (![2, 4, 6].includes(coordinationNumber)) return null;

  const ligandNames = ligands.map(l => l.name).join('-');
  const complexName = `${ligandNames}${metal.sym.toLowerCase()}ate`;

  let complexFormula = `[${metal.formula}`;
  for (const l of ligands) {
    complexFormula += l.formula;
  }
  complexFormula += ']';
  if (complexCharge !== 0) {
    complexFormula += complexCharge > 0 ? `+${complexCharge}` : `${complexCharge}`;
  }

  if (!T[complexFormula]) T[complexFormula] = { atoms: [], bonds: [] };

  return {
    reactants: { [metal.formula]: 1, ...ligands.reduce((acc, l) => { acc[l.formula] = (acc[l.formula] || 0) + 1; return acc; }, {}) },
    condition: 'rt',
    products: [[complexFormula, 1]],
    equation: `${metal.formula} + ${ligands.map(l => l.formula).join(' + ')} -> ${complexFormula}`,
    dynamic: true,
    coordination: true,
    geometry: COORDINATION_GEOMETRIES[coordinationNumber],
    coordinationNumber,
  };
}

// ========== BIOCHEMICAL PATHWAYS ==========

function tryBiochemicalReaction(formulas) {
  if (formulas.length < 2) return null;

  const hasFormula = f => formulas.some(x => normalizeFormula(x) === normalizeFormula(f));

  if (hasFormula('CO2') && hasFormula('H2O')) {
    if (!T['HCO3']) T['HCO3'] = { atoms: [], bonds: [] };
    return {
      reactants: { CO2: 1, H2O: 1 },
      condition: 'rt',
      products: [['HCO3', 1]],
      equation: 'CO2 + H2O ⇌ HCO3- + H+ (carbonic anhydrase)',
      dynamic: true,
      biochemical: true,
      enzyme: 'carbonic anhydrase',
    };
  }

  if (hasFormula('ATP') && hasFormula('H2O')) {
    if (!T['ADP']) T['ADP'] = { atoms: [], bonds: [] };
    if (!T['HPO4']) T['HPO4'] = { atoms: [], bonds: [] };
    return {
      reactants: { ATP: 1, H2O: 1 },
      condition: 'rt',
      products: [['ADP', 1], ['HPO4', 1]],
      equation: 'ATP4- + H2O → ADP3- + HPO42- + H+ (ΔG° ≈ -30.5 kJ/mol)',
      dynamic: true,
      biochemical: true,
      enzyme: 'ATPase',
    };
  }

  if (hasFormula('N2') && hasFormula('H2')) {
    return {
      reactants: { N2: 1, H2: 3 },
      condition: 'catalyst',
      products: [['NH3', 2]],
      equation: 'N2 + 3H2 → 2NH3 (nitrogenase)',
      dynamic: true,
      biochemical: true,
      enzyme: 'nitrogenase',
    };
  }

  return null;
}

export const REACTIONS = [
  { reactants: { H2: 2, O2: 1 }, condition: 'spark', products: [['H2O', 2]], equation: '2H2 + O2 -> 2H2O' },
  { reactants: { H2: 1, Cl2: 1 }, condition: 'spark', products: [['HCl', 2]], equation: 'H2 + Cl2 -> 2HCl' },
  { reactants: { N2: 1, H2: 3 }, condition: 'catalyst', products: [['NH3', 2]], equation: 'N2 + 3H2 -> 2NH3' },
  { reactants: { Mg: 2, O2: 1 }, condition: 'heat', products: [['MgO', 2]], equation: '2Mg + O2 -> 2MgO' },
  { reactants: { Na: 2, Cl2: 1 }, condition: 'spark', products: [['NaCl', 2]], equation: '2Na + Cl2 -> 2NaCl' },
  { reactants: { CaO: 1, H2O: 1 }, condition: 'rt', products: [['CaOH2', 1]], equation: 'CaO + H2O -> Ca(OH)2' },
  { reactants: { CaO: 1, CO2: 1 }, condition: 'rt', products: [['CaCO3', 1]], equation: 'CaO + CO2 -> CaCO3' },
  { reactants: { CaCO3: 1 }, condition: 'heat', products: [['CaO', 1], ['CO2', 1]], equation: 'CaCO3 -> CaO + CO2' },
  { reactants: { CaOH2: 1, CO2: 1 }, condition: 'rt', products: [['CaCO3', 1], ['H2O', 1]], equation: 'Ca(OH)2 + CO2 -> CaCO3 + H2O' },
  { reactants: { HCl: 1, NaOH: 1 }, condition: 'rt', products: [['NaCl', 1], ['H2O', 1]], equation: 'HCl + NaOH -> NaCl + H2O' },
  { reactants: { H2O2: 2 }, condition: 'catalyst', products: [['H2O', 2], ['O2', 1]], equation: '2H2O2 -> 2H2O + O2' },
  { reactants: { CH4: 1, O2: 2 }, condition: 'spark', products: [['CO2', 1], ['H2O', 2]], equation: 'CH4 + 2O2 -> CO2 + 2H2O' },
  { reactants: { C: 1, O2: 1 }, condition: 'heat', products: [['CO2', 1]], equation: 'C + O2 -> CO2' },
  { reactants: { N2: 1, O2: 1 }, condition: 'spark', products: [['NO', 2]], equation: 'N2 + O2 -> 2NO' },
  { reactants: { SO2: 2, O2: 1 }, condition: 'catalyst', products: [['SO3', 2]], equation: '2SO2 + O2 -> 2SO3' },
  { reactants: { SO3: 1, H2O: 1 }, condition: 'rt', products: [['H2SO4', 1]], equation: 'SO3 + H2O -> H2SO4' },
  { reactants: { H2O: 2 }, condition: 'electricity', products: [['H2', 2], ['O2', 1]], equation: '2H2O -> 2H2 + O2' },
  { reactants: { NH3: 1, HCl: 1 }, condition: 'rt', products: [['NH4', 1], ['ClI', 1]], equation: 'NH3 + HCl -> NH4+ + Cl-' },
  { reactants: { Na: 2, H2O: 2 }, condition: 'rt', products: [['NaOH', 2], ['H2', 1]], equation: '2Na + 2H2O -> 2NaOH + H2' },
  { reactants: { K: 2, H2O: 2 }, condition: 'rt', products: [['KOH', 2], ['H2', 1]], equation: '2K + 2H2O -> 2KOH + H2' },
  { reactants: { Al: 2, Cl2: 3 }, condition: 'heat', products: [['AlCl3', 2]], equation: '2Al + 3Cl2 -> 2AlCl3' },
  { reactants: { Mg: 1, HCl: 2 }, condition: 'rt', products: [['MgCl2', 1], ['H2', 1]], equation: 'Mg + 2HCl -> MgCl2 + H2' },
  { reactants: { O2: 3 }, condition: 'uv', products: [['O3', 2]], equation: '3O2 -> 2O3' },
  { reactants: { MnO2: 1, HCl: 4 }, condition: 'heat', products: [['MnCl2', 1], ['Cl2', 1], ['H2O', 2]], equation: 'MnO2 + 4HCl -> MnCl2 + Cl2 + 2H2O' },
  { reactants: { HCl: 1, KOH: 1 }, condition: 'rt', products: [['KCl', 1], ['H2O', 1]], equation: 'HCl + KOH -> KCl + H2O' },
  { reactants: { H2SO4: 1, NaOH: 2 }, condition: 'rt', products: [['Na2SO4', 1], ['H2O', 2]], equation: 'H2SO4 + 2NaOH -> Na2SO4 + 2H2O' },
  { reactants: { H2SO4: 1, KOH: 2 }, condition: 'rt', products: [['K2SO4', 1], ['H2O', 2]], equation: 'H2SO4 + 2KOH -> K2SO4 + 2H2O' },
  { reactants: { HCl: 2, CaOH2: 1 }, condition: 'rt', products: [['CaCl2', 1], ['H2O', 2]], equation: '2HCl + Ca(OH)2 -> CaCl2 + 2H2O' },

  // ── Ostwald process ──
  { reactants: { NH3: 4, O2: 5 }, condition: 'catalyst', products: [['NO', 4], ['H2O', 6]], equation: '4NH3 + 5O2 -> 4NO + 6H2O' },
  { reactants: { NO: 2, O2: 1 }, condition: 'rt', products: [['NO2', 2]], equation: '2NO + O2 -> 2NO2' },
  { reactants: { NO2: 3, H2O: 1 }, condition: 'rt', products: [['HNO3', 2], ['NO', 1]], equation: '3NO2 + H2O -> 2HNO3 + NO' },

  // ── More industrial ──
  { reactants: { Fe: 2, O2: 3 }, condition: 'heat', products: [['Fe2O3', 1]], equation: '2Fe + 3O2 -> Fe2O3' },
  { reactants: { Cu: 1, AgNO3: 2 }, condition: 'rt', products: [['CuNO32', 1], ['Ag', 2]], equation: 'Cu + 2AgNO3 -> Cu(NO3)2 + 2Ag' },
  { reactants: { Zn: 1, CuSO4: 1 }, condition: 'rt', products: [['ZnSO4', 1], ['Cu', 1]], equation: 'Zn + CuSO4 -> ZnSO4 + Cu' },

  // ── More acid-base ──
  { reactants: { HNO3: 1, NaOH: 1 }, condition: 'rt', products: [['NaNO3', 1], ['H2O', 1]], equation: 'HNO3 + NaOH -> NaNO3 + H2O' },
  { reactants: { HNO3: 1, KOH: 1 }, condition: 'rt', products: [['KNO3', 1], ['H2O', 1]], equation: 'HNO3 + KOH -> KNO3 + H2O' },
  { reactants: { H2SO4: 1, CaOH2: 1 }, condition: 'rt', products: [['CaSO4', 1], ['H2O', 2]], equation: 'H2SO4 + Ca(OH)2 -> CaSO4 + 2H2O' },

  // ── More combustion ──
  { reactants: { C2H6: 2, O2: 7 }, condition: 'spark', products: [['CO2', 4], ['H2O', 6]], equation: '2C2H6 + 7O2 -> 4CO2 + 6H2O' },
  { reactants: { C3H8: 1, O2: 5 }, condition: 'spark', products: [['CO2', 3], ['H2O', 4]], equation: 'C3H8 + 5O2 -> 3CO2 + 4H2O' },
  { reactants: { C2H4: 1, O2: 3 }, condition: 'spark', products: [['CO2', 2], ['H2O', 2]], equation: 'C2H4 + 3O2 -> 2CO2 + 2H2O' },

  // ── Electrolysis ──
  { reactants: { NaCl: 2 }, condition: 'electricity', products: [['Na', 2], ['Cl2', 1]], equation: '2NaCl -> 2Na + Cl2' },
  { reactants: { Al2O3: 2 }, condition: 'electricity', products: [['Al', 4], ['O2', 3]], equation: '2Al2O3 -> 4Al + 3O2' },
  { reactants: { KCl: 2 }, condition: 'electricity', products: [['K', 2], ['Cl2', 1]], equation: '2KCl -> 2K + Cl2' },
  { reactants: { CaCl2: 1 }, condition: 'electricity', products: [['Ca', 1], ['Cl2', 1]], equation: 'CaCl2 -> Ca + Cl2' },
  { reactants: { MgCl2: 1 }, condition: 'electricity', products: [['Mg', 1], ['Cl2', 1]], equation: 'MgCl2 -> Mg + Cl2' },
];

function multisetOf(formulas) {
  const m = new Map();
  for (const f of formulas) m.set(f, (m.get(f) || 0) + 1);
  return m;
}

// Normalize formula to canonical atom count string for universal matching
// e.g., "CaOH2" -> "Ca1H2O1", "CaH2O2" -> "Ca1H2O2" (different!)
// e.g., "H3PO4" -> "H3O4P1", "PH3O4" -> "H3O4P1" (same!)
function normalizeFormula(f) {
  const counts = parseFormula(f);
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([sym, n]) => `${sym}${n}`)
    .join('');
}

function matches(rx, have) {
  const need = Object.entries(rx.reactants);
  if (need.length !== have.size) return false;

  // Build normalized multiset for have
  const haveNorm = new Map();
  for (const [f, n] of have) {
    const norm = normalizeFormula(f);
    haveNorm.set(norm, (haveNorm.get(norm) || 0) + n);
  }

  // Check each reactant
  for (const [f, n] of need) {
    const norm = normalizeFormula(f);
    if (haveNorm.get(norm) !== n) return false;
  }
  return true;
}

// Exact match for a chosen condition, or null.
export function findReaction(formulas, conditionKey) {
  const have = multisetOf(formulas);
  
  // First check static reactions
  for (const rx of REACTIONS) {
    if (rx.condition !== conditionKey) continue;
    if (matches(rx, have)) return rx;
  }
  
  // Check mayhem reactions
  for (const rx of MAYHEM_REACTIONS) {
    if (rx.condition !== conditionKey) continue;
    if (matches(rx, have)) return rx;
  }
  
  // Then try dynamic reaction patterns
  const dynamicChecks = {
    'rt': [tryAcidBaseReaction, tryMetalAcidReaction, tryMetalWaterReaction, tryCarbonateAcidReaction, trySingleDisplacement, tryAlkeneAdditionHX, tryPrecipitation, tryGasEvolution, tryRedoxBalancing, tryCoordinationComplex, tryBiochemicalReaction],
    'spark': [tryCombustion],
    'heat': [tryCombustion, tryMetalOxideReduction, tryMetalHalogenSynthesis, tryMetalDimerFormation, tryMetalDimerDecomposition, tryDehydration, tryAdvancedDecomposition],
    'catalyst': [tryEsterification, tryHydrogenation, tryAlkeneHydration, tryEsterHydrolysis, tryBiochemicalReaction],
    'uv': [tryHalogenation],
  };
  
  const checks = dynamicChecks[conditionKey] || [];
  for (const tryFn of checks) {
    const rx = tryFn([...have.keys()]);
    if (rx && matches(rx, have)) return rx;
  }
  
  return null;
}

// Conditions under which this selection could participate in a reaction.
// Subset semantics — every selected formula must be a reactant, with counts
// not exceeding what the reaction needs — so partial selections still hint
// at the right condition. Execution itself stays exact (findReaction).
export function conditionsFor(formulas) {
  const have = multisetOf(formulas);
  const set = new Set();
  
  // Check static reactions
  for (const rx of REACTIONS) {
    let ok = true;
    for (const [f, n] of have) {
      const fNorm = normalizeFormula(f);
      let found = 0;
      for (const [rf, rn] of Object.entries(rx.reactants)) {
        if (normalizeFormula(rf) === fNorm) found = rn;
      }
      if (found < n) { ok = false; break; }
    }
    if (ok) set.add(rx.condition);
  }

  // Check mayhem reactions
  for (const rx of MAYHEM_REACTIONS) {
    let ok = true;
    for (const [f, n] of have) {
      const fNorm = normalizeFormula(f);
      let found = 0;
      for (const [rf, rn] of Object.entries(rx.reactants)) {
        if (normalizeFormula(rf) === fNorm) found = rn;
      }
      if (found < n) { ok = false; break; }
    }
    if (ok) set.add(rx.condition);
  }

  // Check dynamic patterns
  const allChecks = [
    { fn: tryAcidBaseReaction, cond: 'rt' },
    { fn: tryMetalAcidReaction, cond: 'rt' },
    { fn: tryMetalWaterReaction, cond: 'rt' },
    { fn: tryCarbonateAcidReaction, cond: 'rt' },
    { fn: tryCombustion, cond: 'spark' },
    { fn: tryMetalOxideReduction, cond: 'heat' },
    { fn: trySingleDisplacement, cond: 'rt' },
    { fn: tryMetalHalogenSynthesis, cond: 'heat' },
    { fn: tryEsterification, cond: 'catalyst' },
    { fn: tryHydrogenation, cond: 'catalyst' },
    { fn: tryHalogenation, cond: 'uv' },
    { fn: tryDehydration, cond: 'heat' },
    { fn: tryAlkeneAdditionHX, cond: 'rt' },
    { fn: tryAlkeneHydration, cond: 'catalyst' },
    { fn: tryEsterHydrolysis, cond: 'catalyst' },
    { fn: tryPrecipitation, cond: 'rt' },
    { fn: tryGasEvolution, cond: 'rt' },
    { fn: tryRedoxBalancing, cond: 'rt' },
    { fn: tryAdvancedDecomposition, cond: 'heat' },
    { fn: tryCoordinationComplex, cond: 'rt' },
    { fn: tryBiochemicalReaction, cond: 'rt' },
    { fn: tryBiochemicalReaction, cond: 'catalyst' },
  ];
  
  for (const { fn, cond } of allChecks) {
    const rx = fn([...have.keys()]);
    if (rx) {
      let ok = true;
      for (const [f, n] of have) {
        const fNorm = normalizeFormula(f);
        let found = 0;
        for (const [rf, rn] of Object.entries(rx.reactants)) {
          if (normalizeFormula(rf) === fNorm) found = rn;
        }
        if (found < n) { ok = false; break; }
      }
      if (ok) set.add(cond);
    }
  }
  
  return set;
}

// Shortfall for reactions under `condKey` that this partial selection could
// still complete, e.g. "2H2" or "Cl2", or null when nothing applies.
export function missingFor(formulas, condKey) {
  const have = multisetOf(formulas);
  const options = [];
  for (const rx of REACTIONS) {
    if (rx.condition !== condKey) continue;
    let ok = true;
    for (const [f, n] of have) {
      const fNorm = normalizeFormula(f);
      let found = 0;
      for (const [rf, rn] of Object.entries(rx.reactants)) {
        if (normalizeFormula(rf) === fNorm) found = rn;
      }
      if (found < n) { ok = false; break; }
    }
    if (!ok) continue;
    const missing = [];
    for (const [f, n] of Object.entries(rx.reactants)) {
      const fNorm = normalizeFormula(f);
      let haveCount = 0;
      for (const [hf, hn] of have) {
        if (normalizeFormula(hf) === fNorm) haveCount = hn;
      }
      const need = n - haveCount;
      if (need > 0) missing.push(need === 1 ? f : `${need}${f}`);
    }
    if (missing.length) options.push(missing.join(' + '));
  }
  return options.length ? [...new Set(options)].join(' or ') : null;
}

export function productTemplate(key, fingerprint) {
  if (fingerprint) {
    const iso = ISOMERS[key];
    if (iso) {
      for (const entry of iso) {
        const atomIds = entry.tpl.atoms.map((_, i) => i);
        const fp = structuralFingerprint(
          entry.tpl.atoms,
          entry.tpl.bonds,
          atomIds
        );
        if (fp === fingerprint) return entry.tpl;
      }
    }
  }
  return T[key];
}
