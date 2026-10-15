import { isMetal, nobleInertPartner, nobleAllowedPartner, elementBySym } from './elements.js';

// ---------------------------------------------------------------------------
// World state: atoms: Map id -> {id, el, pos:{x,y,z}}
//              bonds: Map id -> {id, a, b, order (1..3), ionic:bool}
// All functions below are pure with respect to these structures.
// ---------------------------------------------------------------------------

export function bondsOf(atoms, bonds, atomId) {
  return [...bonds.values()].filter(b => b.a === atomId || b.b === atomId);
}

export function orderSumOf(atoms, bonds, atomId) {
  return bondsOf(atoms, bonds, atomId)
    .filter(b => !b.ionic)
    .reduce((s, b) => s + b.order, 0);
}

export function ionicCountOf(atoms, bonds, atomId) {
  return bondsOf(atoms, bonds, atomId).filter(b => b.ionic).reduce((s, b) => s + b.order, 0);
}

export function partnerId(bond, atomId) { return bond.a === atomId ? bond.b : bond.a; }

// --- Bond legality ----------------------------------------------------------

// Lewis feasibility of a nonmetal holding both covalent bonds (covSum) and
// accepted ionic electrons (ionU): formal charge −ionU forces lone pairs
// (V + ionU − covSum) / 2 — a non-negative integer that fits the shell
// (period ≤ 2 octet: bonds + lone pairs ≤ 4). Returns null when the state is
// real, else which constraint fails. This is what forbids hybrid states like
// Cl− sharing a covalent bond in "NaH2ClO".
function anionStateError(el, covSum, ionU) {
  const L2 = el.valenceElectrons + ionU - covSum;
  if (L2 < 0 || L2 % 2 !== 0) return 'parity';
  if (el.z <= 10 && covSum + L2 / 2 > 4) return 'octet';
  return null;
}

// Accepting ionic electron #ionAfter must leave the anion reachable: the exact
// state or some deeper state within the anion charge capacity must be a valid
// Lewis picture (N never rests at 7 electrons on its way to N³⁻, so the 2nd
// electron is allowed; O⁻ on the way to O²⁻ likewise).
function anionPathFeasible(el, covSum, ionAfter) {
  for (let k = ionAfter; k <= el.anionCharge; k++)
    if (!anionStateError(el, covSum, k)) return true;
  return false;
}

export function covalentCheck(atoms, bonds, aId, bId) {
  const a = atoms.get(aId), b = atoms.get(bId);
  if (isMetal(a.el) || isMetal(b.el)) {
    if (isMetal(a.el) && isMetal(b.el))
      return { ok: false, reason: { key: 'chem.metalMetal' } };
    return { ok: false, reason: { key: 'chem.metalIonic' } };
  }
  if (nobleInertPartner(a.el) || nobleInertPartner(b.el))
    return { ok: false, reason: { key: 'chem.nobleNoCompound' } };
  if ((a.el.cat === 'noble' && !nobleAllowedPartner(b.el)) ||
      (b.el.cat === 'noble' && !nobleAllowedPartner(a.el)))
    return { ok: false, reason: { key: 'chem.nobleOnlyFO' } };
  const free = at => at.el.maxBonds - orderSumOf(atoms, bonds, at.id);
  if (free(a) <= 0) return { ok: false, reason: { key: 'chem.noCapacity', p: { sym: a.el.sym, max: a.el.maxBonds } } };
  if (free(b) <= 0) return { ok: false, reason: { key: 'chem.noCapacity', p: { sym: b.el.sym, max: b.el.maxBonds } } };
  for (const at of [a, b]) {
    if (isMetal(at.el)) continue;
    const ionU = ionicCountOf(atoms, bonds, at.id);
    if (!ionU) continue;
    const err = anionStateError(at.el, orderSumOf(atoms, bonds, at.id) + 1, ionU);
    if (!err) continue;
    return {
      ok: false,
      reason: err === 'octet'
        ? { key: 'chem.octet', p: { sym: at.el.sym } }
        : { key: 'chem.anionClosedShare', p: { sym: at.el.sym, n: ionU, s: ionU > 1 ? 's' : '' } },
    };
  }
  return { ok: true, type: 'covalent' };
}

export function ionicCheck(atoms, bonds, aId, bId) {
  const a = atoms.get(aId), b = atoms.get(bId);
  const metal = isMetal(a.el) ? a : (isMetal(b.el) ? b : null);
  const nonmetal = metal ? (metal === a ? b : a) : null;
  if (!metal) return { ok: false, reason: { key: 'chem.ionicNeedMetal' } };
  if (nonmetal.el.cat === 'noble') return { ok: false, reason: { key: 'chem.nobleNoCompound' } };
  const maxCharge = Math.max(...metal.el.charges);
  if (ionicCountOf(atoms, bonds, metal.id) >= maxCharge)
    return { ok: false, reason: { key: 'chem.metalMax', p: { sym: metal.el.sym, max: maxCharge } } };
  if (!nonmetal.el.anionCharge) return { ok: false, reason: { key: 'chem.noAnion', p: { sym: nonmetal.el.sym } } };
  if (ionicCountOf(atoms, bonds, nonmetal.id) >= nonmetal.el.anionCharge)
    return { ok: false, reason: { key: 'chem.anionMax', p: { sym: nonmetal.el.sym, max: nonmetal.el.anionCharge } } };
  const covSum = orderSumOf(atoms, bonds, nonmetal.id);
  const ionAfter = ionicCountOf(atoms, bonds, nonmetal.id) + 1;
  if (!anionPathFeasible(nonmetal.el, covSum, ionAfter)) {
    const err = anionStateError(nonmetal.el, covSum, ionAfter);
    return {
      ok: false,
      reason: err === 'octet'
        ? { key: 'chem.octet', p: { sym: nonmetal.el.sym } }
        : { key: 'chem.noLewisSharing', p: { sym: nonmetal.el.sym, n: covSum, s: covSum === 1 ? '' : 's' } },
    };
  }
  return { ok: true, type: 'ionic' };
}

// Which bond type would form between two atoms right now?
export function bondCheck(atoms, bonds, aId, bId) {
  if (aId === bId) return { ok: false, reason: { key: 'chem.selfBond' } };
  if (bondsOf(atoms, bonds, aId).some(b => partnerId(b, aId) === bId))
    return { ok: false, reason: { key: 'chem.alreadyBonded' } };
  const covalent = covalentCheck(atoms, bonds, aId, bId);
  if (covalent.ok) return covalent;
  const ionic = ionicCheck(atoms, bonds, aId, bId);
  if (ionic.ok) return ionic;
  return (covalent.reason?.key && !covalent.reason.key.startsWith('chem.metal')) ? covalent : ionic;
}

// Per-pair max bond order: real chemistry forbids some high-order pairs even
// when both atoms have spare capacity (no O≡O, no halogen–halogen doubles).
// Quadruple bonds allowed for transition metal dimers (Mo₂, W₂, Re₂, etc.).
const HALO = new Set(['F', 'Cl', 'Br', 'I', 'At']);
const TRANSITION_METALS = new Set([
  'Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn',
  'Y', 'Zr', 'Nb', 'Mo', 'Tc', 'Ru', 'Rh', 'Pd', 'Ag', 'Cd',
  'Hf', 'Ta', 'W', 'Re', 'Os', 'Ir', 'Pt', 'Au', 'Hg',
  'La', 'Ce', 'Pr', 'Nd', 'Pm', 'Sm', 'Eu', 'Gd', 'Tb', 'Dy', 'Ho', 'Er', 'Tm', 'Yb', 'Lu',
  'Ac', 'Th', 'Pa', 'U', 'Np', 'Pu', 'Am', 'Cm', 'Bk', 'Cf', 'Es', 'Fm', 'Md', 'No', 'Lr',
]);

export function pairOrderCap(elA, elB) {
  if (HALO.has(elA.sym) && HALO.has(elB.sym)) return 1;
  if (elA.sym === 'O' && elB.sym === 'O') return 2;
  const pair = [elA.sym, elB.sym];
  if (pair.includes('O') && pair.includes('F')) return 1;
  // Quadruple bonds for transition metal dimers
  if (TRANSITION_METALS.has(elA.sym) && TRANSITION_METALS.has(elB.sym)) return 4;
  return 3;
}

export function upgradeCheck(atoms, bonds, bond) {
  if (bond.order >= 5) {
    return { ok: false, reason: { key: bond.ionic ? 'chem.ionicMax4' : 'chem.quadrupleMax' } };
  }
  if (bond.ionic) {
    const a = atoms.get(bond.a), b = atoms.get(bond.b);
    const metal = isMetal(a.el) ? a : b;
    const nonmetal = metal === a ? b : a;
    const maxQ = Math.max(...metal.el.charges);
    if (ionicCountOf(atoms, bonds, metal.id) + 1 > maxQ)
      return { ok: false, reason: { key: 'chem.metalTransferMax', p: { sym: metal.el.sym, max: maxQ } } };
    if (ionicCountOf(atoms, bonds, nonmetal.id) + 1 > nonmetal.el.anionCharge)
      return { ok: false, reason: { key: 'chem.anionAcceptMax', p: { sym: nonmetal.el.sym, max: nonmetal.el.anionCharge } } };
    const covSum = orderSumOf(atoms, bonds, nonmetal.id);
    const ionAfter = ionicCountOf(atoms, bonds, nonmetal.id) + 1;
    if (!anionPathFeasible(nonmetal.el, covSum, ionAfter)) {
      const err = anionStateError(nonmetal.el, covSum, ionAfter);
      return {
        ok: false,
        reason: err === 'octet'
          ? { key: 'chem.octet', p: { sym: nonmetal.el.sym } }
          : { key: 'chem.noLewisSharing', p: { sym: nonmetal.el.sym, n: covSum, s: covSum === 1 ? '' : 's' } },
      };
    }
    return { ok: true };
  }
  const cap = pairOrderCap(atoms.get(bond.a).el, atoms.get(bond.b).el);
  if (bond.order + 1 > cap) {
    const a = atoms.get(bond.a).el.sym, b = atoms.get(bond.b).el.sym;
    return { ok: false, reason: cap === 1
      ? { key: 'chem.pairCapSingle', p: { a, b } }
      : cap === 2
      ? { key: 'chem.pairCapDouble', p: { a, b } }
      : { key: 'chem.pairCapTriple', p: { a, b } } };
  }
  for (const id of [bond.a, bond.b]) {
    const at = atoms.get(id);
    if (orderSumOf(atoms, bonds, id) + 1 > at.el.maxBonds)
      return { ok: false, reason: { key: 'chem.capacityMax', p: { sym: at.el.sym, max: at.el.maxBonds } } };
    if (isMetal(at.el)) continue;
    const ionU = ionicCountOf(atoms, bonds, id);
    if (!ionU) continue;
    const err = anionStateError(at.el, orderSumOf(atoms, bonds, id) + 1, ionU);
    if (err === 'parity')
      return { ok: false, reason: { key: 'chem.anionClosedShareMore', p: { sym: at.el.sym } } };
    if (err === 'octet')
      return { ok: false, reason: { key: 'chem.octet', p: { sym: at.el.sym } } };
  }
  return { ok: true };
}

// --- Molecule analysis ------------------------------------------------------

export function componentsOf(atoms, bonds) {
  const comps = [];
  const seen = new Set();
  for (const id of atoms.keys()) {
    if (seen.has(id)) continue;
    const comp = { atoms: [], bonds: [] };
    const stack = [id];
    seen.add(id);
    while (stack.length) {
      const cur = stack.pop();
      comp.atoms.push(cur);
      for (const bd of bondsOf(atoms, bonds, cur)) {
        comp.bonds.push(bd);
        const p = partnerId(bd, cur);
        if (!seen.has(p)) { seen.add(p); stack.push(p); }
      }
    }
    comp.bonds = [...new Set(comp.bonds)];
    comps.push(comp);
  }
  return comps;
}

export function componentOf(atoms, bonds, atomId) {
  return componentsOf(atoms, bonds).find(c => c.atoms.includes(atomId));
}

// Lewis assignment: choose lone-pair counts for all bonded non-metals at once
// so that the sum of |formal charges| is minimal (textbook Lewis rule).
// Metals: lp=0, charge=+ionic units. Free atoms: neutral.
// chargeOverride: force the component's net charge (user-set), else auto.
export function lewisAssign(atoms, bonds, atomIds, chargeOverride = null) {
  const per = new Map();
  const part = []; // bonded non-metals participating in LP distribution
  let sumV = 0, sumCov = 0, sumIon = 0;

  for (const id of atomIds) {
    const at = atoms.get(id);
    const bs = bondsOf(atoms, bonds, id);
    const covSum = bs.filter(b => !b.ionic).reduce((s, b) => s + b.order, 0);
    const ionU = bs.filter(b => b.ionic).reduce((s, b) => s + b.order, 0);
    const bonded = bs.length > 0;
    const isM = isMetal(at.el);
    const V = at.el.valenceElectrons;
    let lp = 0, fc = 0, cap = 0;
    if (isM) { lp = 0; fc = ionU; }
    else if (!bonded) {
      lp = Math.floor(V / 2); fc = 0;
      if (chargeOverride != null && atomIds.length === 1) {
        const pairs = (V - chargeOverride) / 2;
        const maxLp = at.el.z <= 10 ? 4 : 6;
        if (!Number.isInteger(pairs) || pairs < 0 || pairs > maxLp)
          return { feasible: false, reason: { key: 'chem.lewis.charge' }, charge: chargeOverride };
        lp = pairs; fc = chargeOverride;
      }
    }
    else {
      sumV += V; sumCov += covSum; sumIon += ionU;
      // Received ionic electrons join the atom's own pool (anions own more
      // electrons than their neutral valence, e.g. Cl- has 4 lone pairs).
      const poolCap = Math.ceil(Math.max(0, V + ionU - covSum) / 2);
      cap = at.el.z <= 10 ? Math.max(0, Math.min(4 - covSum, poolCap)) : poolCap;
    }
    per.set(id, { lp, fc, ionU, covSum, sigma: bs.length, cap, isMetal: isM, bonded });
    if (!isM && bonded) part.push({
      id, cap, V, covSum, ionU,
      heavy: at.el.z > 10,
      carbon: at.el.z === 6,
      of: at.el.sym === 'O' || at.el.sym === 'F',
    });
  }

  const applyLps = lps => { part.forEach((p, i) => { per.get(p.id).lp = lps[i]; per.get(p.id).fc = p.V - 2 * lps[i] - p.covSum; }); };

  // Score for one atom's lone-pair count: |FC| first, then textbook refinements:
  // lone pairs never sit on heavy central atoms or carbon unless parity forces
  // them, and positive formal charge on O/F is strongly disfavored.
  const scoreOf = (p, lp) => {
    const fc = p.V - 2 * lp - p.covSum;
    let s = Math.abs(fc) + 0.01 * lp;
    if ((p.heavy || p.carbon) && lp > 0) s += 3 * lp;
    if (fc > 0 && p.of) s += 3;
    return s;
  };

  const solveFor = S => {
    // DP: min Σ scoreOf subject to Σlp = S
    const n = part.length;
    const memo = new Map();
    const f = (i, rem) => {
      if (i === n) return rem === 0 ? { score: 0, lps: [] } : null;
      const key = i * 4096 + rem;
      if (memo.has(key)) return memo.get(key);
      let best = null;
      for (let lp = 0; lp <= Math.min(part[i].cap, rem); lp++) {
        const r = f(i + 1, rem - lp);
        if (!r) continue;
        const score = r.score + scoreOf(part[i], lp);
        if (!best || score < best.score) best = { score, lps: [lp, ...r.lps] };
      }
      memo.set(key, best);
      return best;
    };
    return f(0, S);
  };

  if (chargeOverride !== null && chargeOverride !== undefined) {
    // Component of only free atoms / metals: charges live directly in per.
    if (part.length === 0) {
      const total = [...per.values()].reduce((s, p) => s + p.fc, 0);
      return total === chargeOverride
        ? { feasible: true, per, charge: chargeOverride }
        : { feasible: false, reason: { key: 'chem.lewis.charge' }, charge: chargeOverride };
    }
    const S = sumV + sumIon - sumCov - chargeOverride;
    if (S % 2 !== 0) return { feasible: false, reason: { key: 'chem.lewis.radical' }, charge: chargeOverride };
    if (S < 0) return { feasible: false, reason: { key: 'chem.lewis.electrons' }, charge: chargeOverride };
    const sol = solveFor(S / 2);
    if (!sol) return { feasible: false, reason: { key: 'chem.lewis.charge' }, charge: chargeOverride };
    applyLps(sol.lps);
    return { feasible: true, per, charge: chargeOverride };
  }

  // Auto: prefer the neutral structure; only fall back to larger |charge| if
  // nothing feasible exists (keeps neutral atoms from becoming ions).
  const base = sumV + sumIon - sumCov;
  let best = null;
  for (let q = 0; q <= 12 && !(best && Math.abs(best.charge) < q); q++) {
    for (const sgn of q === 0 ? [1] : [1, -1]) {
      const num = base - sgn * q;
      if (num < 0 || num % 2 !== 0) continue;
      const sol = solveFor(num / 2);
      if (!sol) continue;
      const key = [sol.score, num / 2];
      if (!best || key < best.key) best = { sol, charge: sgn * q, key };
    }
  }
  if (!best) return { feasible: true, per, charge: 0 };
  applyLps(best.sol.lps);
  return { feasible: true, per, charge: best.charge };
}

export function analyzeComponent(atoms, bonds, comp, chargeOverride = null) {
  const res = lewisAssign(atoms, bonds, comp.atoms, chargeOverride);
  const formula = formulaOfComponent(atoms, bonds, comp.atoms, res.per);
  const fingerprint = structuralFingerprint(atoms, bonds, comp.atoms);
  return { ...res, formula, fingerprint };
}

// Canonical formula ordering: textbook style (NH3, H2O, SO4, XeF4, H2SO4).
// Hill order only for carbon compounds; hydrides central-first; everything
// else electronegativity-ascending so the most electronegative element last
// (the -ide position).
const CENTRAL_FIRST_H = new Set(['N']);
export function formulaOf(elements) {
  const count = new Map();
  for (const el of elements) count.set(el.sym, (count.get(el.sym) || 0) + 1);
  const syms = [...count.keys()];
  const seg = s => s + (count.get(s) > 1 ? count.get(s) : '');
  if (syms.length === 1) return seg(syms[0]);
  if (count.has('C')) {
    let s = seg('C');
    if (count.has('H')) s += seg('H');
    s += syms.filter(x => x !== 'C' && x !== 'H').sort().map(seg).join('');
    return s;
  }
  const h = count.get('H') || 0;
  const o = count.get('O') || 0;
  const others = syms.filter(s => s !== 'H' && s !== 'O');

  // Acid formulas: H first, then central atom, then O (e.g., H3PO4, H2SO4, HNO3)
  const ACID_CENTRAL = new Set(['P', 'S', 'N', 'Cl', 'Br', 'I', 'C', 'B', 'Si', 'Ge', 'As', 'Sb', 'Te', 'Cr', 'Mn', 'V', 'W', 'Mo']);
  if (h > 0 && o > 0 && others.length === 1 && ACID_CENTRAL.has(others[0])) {
    return seg('H') + seg(others[0]) + seg('O');
  }

  if (h > 0 && others.length === 1 && CENTRAL_FIRST_H.has(others[0])) return seg(others[0]) + (h > 1 ? `H${h}` : 'H');
  if (h > 0 && others.length === 1 && (others[0] === 'Te' || others[0] === 'Po' || others[0] === 'At')) return (h > 1 ? `H${h}` : 'H') + seg(others[0]);
  if (h === 1 && o === 1 && syms.length === 2) return 'OH';
  const en = s => elementBySym(s)?.en ?? 0;
  return [...syms].sort((a, b) => (en(a) - en(b)) || (a < b ? -1 : 1)).map(seg).join('');
}

// Formula for a whole component, which may contain several ionic fragments
// (metal cations + polyatomic anion). Cations first, then anions, with
// multiplicity suffixes or parentheses for multi-element fragments.
export function formulaOfComponent(atoms, bonds, atomIds, per = new Map()) {
  const idSet = new Set(atomIds);
  const parent = new Map(atomIds.map(id => [id, id]));
  const find = x => { let r = x; while (parent.get(r) !== r) r = parent.get(r); while (parent.get(x) !== r) { const n = parent.get(x); parent.set(x, r); x = n; } return r; };
  for (const b of bonds.values()) {
    if (b.ionic || !idSet.has(b.a) || !idSet.has(b.b)) continue;
    parent.set(find(b.a), find(b.b));
  }
  const frags = [];
  const byRoot = new Map();
  for (const id of atomIds) {
    const r = find(id);
    if (!byRoot.has(r)) { byRoot.set(r, []); frags.push(byRoot.get(r)); }
    byRoot.get(r).push(id);
  }
  if (frags.length === 1) return formulaOf(atomIds.map(id => atoms.get(id).el));
  const pos = new Map(), neg = new Map(), neu = [];
  for (const frag of frags) {
    const f = formulaOf(frag.map(id => atoms.get(id).el));
    const ch = frag.reduce((s, id) => s + (per.get(id)?.fc ?? 0), 0);
    if (ch > 0) pos.set(f, (pos.get(f) || 0) + 1);
    else if (ch < 0) neg.set(f, (neg.get(f) || 0) + 1);
    else neu.push(f);
  }
  const grp = m => [...m.entries()].map(([f, n]) => {
    if (n === 1) return f;
    const multi = (f.match(/[A-Z][a-z]?\d*/g) || []).length > 1;
    return multi && (/\d$/.test(f) || /H/.test(f)) ? `(${f})${n}` : f + n;
  }).join('');
  return grp(pos) + neu.join('') + grp(neg);
}

export function formulaWithCharge(formula, charge) {
  if (charge === 0) return formula;
  const mag = Math.abs(charge);
  const sup = String(mag === 1 ? '' : mag) + (charge > 0 ? '+' : '−');
  const map = { '+': '⁺', '-': '⁻', '−': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
  return formula + [...sup].map(ch => map[ch] || ch).join('');
}

export function structuralFingerprint(atoms, bonds, atomIds) {
  const n = atomIds.length;
  if (n === 0) return '';
  const atomsArr = atoms instanceof Map
    ? atomIds.map(id => atoms.get(id))
    : atomIds.map((id, i) => ({ el: { sym: atoms[i] || id } }));
  const adj = Array.from({ length: n }, () => []);
  for (const b of bonds) {
    if (b[3]) continue;
    const i = atomIds.indexOf(b[0]);
    const j = atomIds.indexOf(b[1]);
    if (i >= 0 && j >= 0) {
      adj[i].push({ to: j, order: b[2] || 1 });
      adj[j].push({ to: i, order: b[2] || 1 });
    }
  }
  let ids = atomsArr.map((a, i) => `${atomIds[i] || a.el.sym}_${i}`);
  for (let iter = 0; iter < 3; iter++) {
    ids = ids.map((id, i) => {
      const sig = [id];
      for (const { to, order } of adj[i].sort((a, b) => a.to - b.to)) {
        sig.push(`${ids[to]}_${order}`);
      }
      return sig.join('|');
    });
  }
  const counts = {};
  for (let i = 0; i < n; i++) {
    const sym = atomIds[i] || atomsArr[i].el.sym;
    const key = `${sym}:${ids[i]}`;
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}×${v}`)
    .join(';');
}

const SUBS = '₀₁₂₃₄₅₆₇₈₉';
export function prettyFormula(formula) {
  if (typeof formula !== 'string') {
    console.warn('[prettyFormula] Expected string, got:', typeof formula, formula);
    return String(formula ?? '');
  }
  return [...formula].map(ch => (ch >= '0' && ch <= '9') ? SUBS[+ch] : ch).join('');
}

// Bond length in world units
export function bondLength(elA, elB, ionic) {
  const r = (elA.radius + elB.radius) / 55;
  return ionic ? r * 1.18 : r;
}

export function displayRadius(el) {
  return 0.28 + el.radius / 110;
}
