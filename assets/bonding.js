/* ChemBonding — deterministic bonding & octet-rule exception system.
 *
 * Self-contained: reads no game state, mutates nothing, so it unit-tests in
 * Node and sits beside the atom/molecule/reaction models, which hand it the
 * same plain {atoms, bonds} shape. Bond kinds, element rows and bulk metal
 * properties live in tables; the evaluator only applies rules to them.
 *
 * Molecule shape (index-addressed; atom `id` may be used in bond endpoints):
 *   { charge?: number,
 *     atoms: [{ sym, id?, fc?, lonePairs?, pos? }],
 *     bonds: [{ a, b, order?, ionic?, dative?, donor?, type? }] }
 * `donor` names the electron donor of a coordinate bond; when absent the
 * endpoint that can afford the pair (most free valence electrons) donates.
 */
(function (root) {
  'use strict';

  // --- Step 1: bond & interaction registry ---------------------------------
  // relativeStrength is a 1..5 tier (LONDON 1 weakest ... COVALENT/IONIC 5).
  const BOND_TYPES = Object.freeze({
    COVALENT: Object.freeze({
      key: 'COVALENT', category: 'primary', relativeStrength: 5,
      isDirectional: false, requiresElectronegativePair: false
    }),
    IONIC: Object.freeze({
      key: 'IONIC', category: 'primary', relativeStrength: 5,
      isDirectional: false, requiresElectronegativePair: false
    }),
    METALLIC: Object.freeze({
      key: 'METALLIC', category: 'primary', relativeStrength: 4,
      isDirectional: false, requiresElectronegativePair: false,
      // Bulk behaviour a connected metal network confers.
      bulkProperties: Object.freeze({
        electricalConductivity: true, thermalConductivity: true,
        malleability: true, ductility: true, luster: true
      })
    }),
    COORDINATE_COVALENT: Object.freeze({
      key: 'COORDINATE_COVALENT', category: 'specialized', relativeStrength: 5,
      isDirectional: true, requiresElectronegativePair: false
    }),
    ION_DIPOLE: Object.freeze({
      key: 'ION_DIPOLE', category: 'specialized', relativeStrength: 3,
      isDirectional: true, requiresElectronegativePair: true
    }),
    HALOGEN: Object.freeze({
      key: 'HALOGEN', category: 'specialized', relativeStrength: 4,
      isDirectional: true, requiresElectronegativePair: false
    }),
    THREE_CENTER_TWO_ELECTRON: Object.freeze({
      key: 'THREE_CENTER_TWO_ELECTRON', category: 'specialized', relativeStrength: 4,
      isDirectional: false, requiresElectronegativePair: false
    }),
    HYDROGEN_BOND: Object.freeze({
      key: 'HYDROGEN_BOND', category: 'intermolecular', relativeStrength: 4,
      isDirectional: true, requiresElectronegativePair: true
    }),
    DIPOLE_DIPOLE: Object.freeze({
      key: 'DIPOLE_DIPOLE', category: 'intermolecular', relativeStrength: 3,
      isDirectional: true, requiresElectronegativePair: true
    }),
    LONDON_DISPERSION: Object.freeze({
      key: 'LONDON_DISPERSION', category: 'intermolecular', relativeStrength: 1,
      isDirectional: false, requiresElectronegativePair: false
    })
  });

  // --- element data --------------------------------------------------------
  // z, period, group, valence (main-group valence electrons), en (Pauling),
  // cat ('alkali'|'alkaline'|'transition'|'post'|'metalloid'|'nonmetal'|'noble').
  const BUILT_IN_ELEMENTS = Object.freeze({
    H:  { z: 1, period: 1, group: 1, valence: 1, en: 2.20, cat: 'nonmetal' },
    He: { z: 2, period: 1, group: 18, valence: 0, en: 0, cat: 'noble' },
    Li: { z: 3, period: 2, group: 1, valence: 1, en: 0.98, cat: 'alkali' },
    Be: { z: 4, period: 2, group: 2, valence: 2, en: 1.57, cat: 'alkaline' },
    B:  { z: 5, period: 2, group: 13, valence: 3, en: 2.04, cat: 'metalloid' },
    C:  { z: 6, period: 2, group: 14, valence: 4, en: 2.55, cat: 'nonmetal' },
    N:  { z: 7, period: 2, group: 15, valence: 5, en: 3.04, cat: 'nonmetal' },
    O:  { z: 8, period: 2, group: 16, valence: 6, en: 3.44, cat: 'nonmetal' },
    F:  { z: 9, period: 2, group: 17, valence: 7, en: 3.98, cat: 'nonmetal' },
    Ne: { z: 10, period: 2, group: 18, valence: 0, en: 0, cat: 'noble' },
    Na: { z: 11, period: 3, group: 1, valence: 1, en: 0.93, cat: 'alkali' },
    Mg: { z: 12, period: 3, group: 2, valence: 2, en: 1.31, cat: 'alkaline' },
    Al: { z: 13, period: 3, group: 13, valence: 3, en: 1.61, cat: 'post' },
    Si: { z: 14, period: 3, group: 14, valence: 4, en: 1.90, cat: 'metalloid' },
    P:  { z: 15, period: 3, group: 15, valence: 5, en: 2.19, cat: 'nonmetal' },
    S:  { z: 16, period: 3, group: 16, valence: 6, en: 2.58, cat: 'nonmetal' },
    Cl: { z: 17, period: 3, group: 17, valence: 7, en: 3.16, cat: 'nonmetal' },
    Ar: { z: 18, period: 3, group: 18, valence: 0, en: 0, cat: 'noble' },
    K:  { z: 19, period: 4, group: 1, valence: 1, en: 0.82, cat: 'alkali' },
    Ca: { z: 20, period: 4, group: 2, valence: 2, en: 1.00, cat: 'alkaline' },
    Mn: { z: 25, period: 4, group: 7, valence: 7, en: 1.55, cat: 'transition' },
    Fe: { z: 26, period: 4, group: 8, valence: 8, en: 1.83, cat: 'transition' },
    Co: { z: 27, period: 4, group: 9, valence: 9, en: 1.88, cat: 'transition' },
    Ni: { z: 28, period: 4, group: 10, valence: 10, en: 1.91, cat: 'transition' },
    Cu: { z: 29, period: 4, group: 11, valence: 11, en: 1.90, cat: 'transition' },
    Zn: { z: 30, period: 4, group: 12, valence: 12, en: 1.65, cat: 'transition' },
    Kr: { z: 36, period: 4, group: 18, valence: 0, en: 3.00, cat: 'noble' },
    Mo: { z: 42, period: 5, group: 6, valence: 6, en: 2.16, cat: 'transition' },
    Ru: { z: 44, period: 5, group: 8, valence: 8, en: 2.20, cat: 'transition' },
    Rh: { z: 45, period: 5, group: 9, valence: 9, en: 2.28, cat: 'transition' },
    Pd: { z: 46, period: 5, group: 10, valence: 10, en: 2.20, cat: 'transition' },
    Ag: { z: 47, period: 5, group: 11, valence: 11, en: 1.93, cat: 'transition' },
    Sn: { z: 50, period: 5, group: 14, valence: 4, en: 1.96, cat: 'post' },
    Sb: { z: 51, period: 5, group: 15, valence: 5, en: 2.05, cat: 'post' },
    I:  { z: 53, period: 5, group: 17, valence: 7, en: 2.66, cat: 'nonmetal' },
    Xe: { z: 54, period: 5, group: 18, valence: 0, en: 2.60, cat: 'noble' },
    Pt: { z: 78, period: 6, group: 10, valence: 10, en: 2.28, cat: 'transition' },
    Au: { z: 79, period: 6, group: 11, valence: 11, en: 2.54, cat: 'transition' },
    Tl: { z: 81, period: 6, group: 13, valence: 3, en: 1.62, cat: 'post' },
    Pb: { z: 82, period: 6, group: 14, valence: 4, en: 2.33, cat: 'post' },
    Bi: { z: 83, period: 6, group: 15, valence: 5, en: 2.02, cat: 'post' }
  });

  // The game's element table can be injected so both models agree on
  // period/en/class without duplicating data here.
  let elementSource = null;
  function setElementSource(fn) { elementSource = typeof fn === 'function' ? fn : null; }
  function elementOf(sym) {
    if (elementSource) {
      const row = elementSource(sym);
      if (row) {
        return {
          sym: sym, z: row.z, period: row.period, group: row.group,
          valence: row.valence !== undefined ? row.valence : row.valenceElectrons,
          en: row.en !== undefined ? row.en : row.electronegativity,
          cat: row.cat || row.category
        };
      }
    }
    const row = BUILT_IN_ELEMENTS[sym];
    return row ? Object.assign({ sym: sym }, row) : null;
  }

  const METAL_CATS = ['alkali', 'alkaline', 'transition', 'post'];
  const isMetalRow = (row) => !!row && METAL_CATS.indexOf(row.cat) >= 0;
  const isTransitionRow = (row) => !!row && row.cat === 'transition';
  // Heavy post-transition ions whose inert pair survives bonding (Pb2+, Bi3+).
  const INERT_PAIR = ['Pb', 'Bi', 'Tl', 'Sn', 'Sb'];
  // Incomplete-octet centres allowed to stop at 4 (Be) or 6 (light group 13).
  const INCOMPLETE_OK = { Be: 4, B: 6, Al: 6 };

  // --- bond typing ---------------------------------------------------------
  function bondTypeOf(bond, rowA, rowB) {
    if (bond.type && BOND_TYPES[bond.type]) return BOND_TYPES[bond.type];
    if (bond.dative || bond.donor !== undefined) return BOND_TYPES.COORDINATE_COVALENT;
    if (bond.ionic) return BOND_TYPES.IONIC;
    if (rowA && rowB && isMetalRow(rowA) && isMetalRow(rowB)) return BOND_TYPES.METALLIC;
    if (bond.halogenBridge) return BOND_TYPES.HALOGEN;
    if (bond.threeCenter) return BOND_TYPES.THREE_CENTER_TWO_ELECTRON;
    return BOND_TYPES.COVALENT;
  }

  function distance(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  // A molecule is polar when it has a polar bond and no symmetric top that
  // cancels it: every atom of degree >= 2 must carry a lone pair or bond to
  // differing neighbours for the dipoles to survive (CO2/BF3/CH4 cancel,
  // H2O/NH3/ethanol do not).
  function isPolarMolecule(molecule) {
    const atoms = molecule.atoms || [];
    const bonds = molecule.bonds || [];
    if (atoms.length < 2) return false;
    const rows = atoms.map((a) => elementOf(a.sym || (a.el && a.el.sym) || ''));
    const degree = atoms.map(() => 0);
    let hasPolarBond = false;
    const lonePairsOf = (i) => {
      const a = atoms[i];
      if (a.lonePairs !== undefined) return a.lonePairs;
      const row = rows[i];
      if (!row || isMetalRow(row)) return 0;
      let covPaid = 0;
      for (const b of bonds) {
        if ((b.a === i || b.b === i || b.a === (a.id) || b.b === (a.id)) && !b.ionic && !(b.dative || b.donor !== undefined)) covPaid += b.order || 1;
      }
      const fc = a.fc || 0;
      return Math.max(0, Math.floor((row.valence - fc - covPaid) / 2));
    };
    const idx = (end, i) => (typeof end === 'number' ? end : (atoms[i] && atoms[i].id === end ? i : end));
    bonds.forEach((b, bi) => {
      const ai = idx(b.a, bi), aj = idx(b.b, bi);
      if (ai === aj || !rows[ai] || !rows[aj]) return;
      degree[ai]++; degree[aj]++;
      if (!b.ionic && Math.abs((rows[ai].en || 0) - (rows[aj].en || 0)) >= 0.5) hasPolarBond = true;
    });
    if (!hasPolarBond) return false;
    let centers = 0, symmetric = true;
    for (let i = 0; i < atoms.length; i++) {
      if (degree[i] < 2) continue;
      centers++;
      const neighbors = [];
      bonds.forEach((b, bi) => {
        const ai = idx(b.a, bi), aj = idx(b.b, bi);
        if (ai === i) neighbors.push(rows[aj]);
        else if (aj === i) neighbors.push(rows[ai]);
      });
      const uniform = neighbors.length > 0 && neighbors.every((n) => n && n.sym === neighbors[0].sym);
      if (lonePairsOf(i) > 0 || !uniform) symmetric = false;
    }
    if (centers === 0) return true; // heteronuclear pair (CO): dipole survives
    return !symmetric;
  }

  // --- Step 3: molecule evaluation -----------------------------------------
  function evaluateMoleculeBonding(molecule) {
    const atoms = (molecule && molecule.atoms) || [];
    const bonds = (molecule && molecule.bonds) || [];
    const charge = Number.isFinite(molecule && molecule.charge) ? molecule.charge : 0;
    const indexById = new Map();
    atoms.forEach((a, i) => { if (a && a.id !== undefined) indexById.set(a.id, i); });
    const idxOf = (end) => (indexById.has(end) ? indexById.get(end) : end);

    const rows = atoms.map((a) => {
      const sym = a.sym || (a.el && a.el.sym) || '';
      const row = elementOf(sym);
      if (!row) throw new Error('unknown element symbol: ' + sym);
      return row;
    });
    const per = rows.map(() => ({
      covPaid: 0, covAll: 0, dativeOut: 0, dativeIn: 0,
      ionicLost: 0, ionicGained: 0, degree: 0
    }));

    const typed = bonds.map((b, i) => {
      const ai = idxOf(b.a), bi = idxOf(b.b);
      if (!rows[ai] || !rows[bi]) throw new Error('bond references missing atom: ' + b.a + '-' + b.b);
      const order = b.order || 1;
      return {
        raw: b, key: i, ai: ai, bi: bi, order: order,
        type: bondTypeOf(b, rows[ai], rows[bi])
      };
    });

    // Pass 1 — covalent and ionic electron bookkeeping (datives and the
    // delocalized metallic sea are resolved separately: neither is a shared
    // pair this atom paid for).
    for (const t of typed) {
      per[t.ai].degree++; per[t.bi].degree++;
      if (t.type.key === 'COORDINATE_COVALENT' || t.type.key === 'METALLIC') continue;
      if (t.type.key === 'IONIC') {
        const metalA = isMetalRow(rows[t.ai]), metalB = isMetalRow(rows[t.bi]);
        if (metalA && !metalB) { per[t.ai].ionicLost += t.order; per[t.bi].ionicGained += t.order; }
        else if (metalB && !metalA) { per[t.bi].ionicLost += t.order; per[t.ai].ionicGained += t.order; }
        else { per[t.ai].ionicGained += t.order; per[t.bi].ionicGained += t.order; }
        continue;
      }
      per[t.ai].covPaid += t.order; per[t.ai].covAll += t.order;
      per[t.bi].covPaid += t.order; per[t.bi].covAll += t.order;
    }
    // Pass 2 — coordinate bonds: both electrons come from the donor's lone
    // pairs, so only the donor pays (2 per order) and the acceptor merely hosts
    // them (BF3's boron reaches 8 without having spent anything).
    for (const t of typed) {
      if (t.type.key !== 'COORDINATE_COVALENT') continue;
      let donorIdx;
      if (t.raw.donor !== undefined) donorIdx = idxOf(t.raw.donor);
      else {
        const free = (i) => (rows[i].valence || 0) - per[i].covPaid - per[i].ionicLost;
        donorIdx = free(t.ai) >= free(t.bi) ? t.ai : t.bi;
      }
      const accIdx = donorIdx === t.ai ? t.bi : t.ai;
      t.donorIdx = donorIdx;
      per[donorIdx].dativeOut += t.order;
      per[accIdx].dativeIn += t.order;
      per[donorIdx].covAll += t.order;
      per[accIdx].covAll += t.order;
    }

    // Formal charges: explicit wins; a lone ion takes the molecule charge; a
    // metal its oxidation state; otherwise charge is distributed deterministically
    // (cations onto the most connected atom, anions one unit at a time onto the
    // most electronegative lightly-bonded atom — carbonate puts -1 on two O's).
    const fc = rows.map((row, i) => {
      if (atoms[i].fc !== undefined) return atoms[i].fc;
      if (rows.length === 1) return charge;
      if (isMetalRow(row)) return per[i].ionicLost - per[i].ionicGained;
      return -per[i].ionicGained;
    });
    let unassigned = charge - fc.reduce((s, v) => s + v, 0);
    while (unassigned !== 0) {
      const step = unassigned > 0 ? 1 : -1;
      let pick = -1;
      if (step > 0) {
        let best = -1;
        for (let i = 0; i < rows.length; i++) {
          if (isMetalRow(rows[i])) continue;
          const score = per[i].covPaid * 100 - i - (fc[i] > 0 ? 1000 : 0);
          if (score > best) { best = score; pick = i; }
        }
      } else {
        let best = -1;
        for (let i = 0; i < rows.length; i++) {
          if (isMetalRow(rows[i])) continue;
          // One unit per atom per pass, so CO3^2- spreads onto two oxygens
          // instead of stacking -2 on a single O.
          const score = (rows[i].en || 0) * 100 - per[i].covPaid * 10 - i - (fc[i] < 0 ? 1000 : 0);
          if (score > best) { best = score; pick = i; }
        }
      }
      if (pick < 0) break;
      fc[pick] += step;
      unassigned -= step;
    }

    const totalValenceElectrons = rows.reduce((s, r) => s + (r.valence || 0), 0) - charge;
    const speciesOdd = totalValenceElectrons % 2 !== 0;

    const violations = [];
    const notes = [];
    const outAtoms = rows.map((row, i) => {
      const loneE = (atoms[i].lonePairs !== undefined)
        ? atoms[i].lonePairs * 2
        : row.valence - fc[i] - per[i].covPaid - 2 * per[i].dativeOut;
      const electronCount = loneE + 2 * per[i].covAll;
      const unpaired = loneE > 0 && loneE % 2 !== 0 ? loneE % 2 : (loneE < 0 && electronCount % 2 !== 0 ? 1 : 0);
      const entry = {
        index: i, sym: row.sym, period: row.period, group: row.group,
        category: row.cat, electronegativity: row.en,
        valenceElectrons: row.valence, formalCharge: fc[i],
        bondOrderSum: per[i].covAll + per[i].ionicLost + per[i].ionicGained,
        lonePairElectrons: loneE, electronCount: electronCount,
        octetStatus: 'standard_octet', octetTarget: 8,
        isLewisAcid: false, isRadical: false, unpairedElectrons: unpaired,
        inertPair: false, violations: [], notes: []
      };
      const block = (type, message) => {
        const v = { atomIndex: i, sym: row.sym, type: type, severity: 'block', message: message };
        entry.violations.push(v); violations.push(v);
      };

      // Be and the light group-13 elements stop at 4/6 when covalently bonded —
      // they are Lewis acids, not metal cations (BeCl2, AlCl3, BF3).
      const allowedIncomplete = INCOMPLETE_OK[row.sym];
      if (allowedIncomplete !== undefined && per[i].covPaid > 0 && electronCount === allowedIncomplete) {
        entry.octetStatus = 'incomplete';
        entry.isLewisAcid = true;
        return entry;
      }

      // Metals never play by the octet count; they carry bulk/coordination rules.
      if (isMetalRow(row)) {
        entry.octetStatus = 'metal_complex';
        entry.octetTarget = isTransitionRow(row) ? 18 : 8;
        entry.inertPair = INERT_PAIR.indexOf(row.sym) >= 0 && fc[i] > 0;
        if (entry.inertPair) entry.notes.push('inert pair may remain stereochemically active');
        return entry;
      }

      // Odd-electron centres: reactive, flagged, but not invalid.
      if (electronCount % 2 !== 0 || (speciesOdd && unpaired > 0)) {
        entry.octetStatus = 'radical';
        entry.isRadical = true;
        entry.unpairedElectrons = Math.max(1, unpaired);
        return entry;
      }

      if (row.sym === 'H' || row.sym === 'He') {
        entry.octetTarget = 2;
        entry.octetStatus = 'duet';
        if (electronCount > 2) block('duet_exceeded', 'H/He cannot hold more than 2 electrons');
        else if (electronCount < 2) block('duet_unsatisfied', 'H/He must hold 2 electrons');
        return entry;
      }

      // Hard constraint: period 2 never exceeds 8 — the expanded-octet
      // exception exists precisely because it is restricted to period 3+.
      if (row.period <= 2 && electronCount > 8) {
        entry.octetStatus = 'expanded';
        block('period2_expanded_octet', 'period 2 atoms can never exceed 8 electrons');
        return entry;
      }
      if (electronCount > 8) {
        if (electronCount === 10 || electronCount === 12) {
          entry.octetStatus = 'expanded';
          const partners = typed.filter((t) => (t.ai === i || t.bi === i) && t.type.key !== 'IONIC');
          const hasElectronegative = partners.some((t) => {
            const other = t.ai === i ? t.bi : t.ai;
            return (rows[other].en || 0) >= 2.5;
          });
          if (!hasElectronegative) {
            notes.push({ atomIndex: i, sym: row.sym, type: 'expanded_without_electronegative_partner',
              message: 'expanded octet on non-electronegative partners is unusual' });
          }
        } else {
          block('expanded_octet_unexpected', 'expanded shells are 10 or 12 electrons, got ' + electronCount);
        }
        return entry;
      }
      if (electronCount < 8) {
        const allowed = INCOMPLETE_OK[row.sym];
        entry.octetStatus = 'incomplete';
        if (allowed && electronCount === allowed) {
          entry.isLewisAcid = true; // accepts a dative pair and reaches 8
        } else {
          block('incomplete_octet', row.sym + ' holds ' + electronCount +
            ' electrons without a low-valence exception');
        }
        return entry;
      }
      return entry;
    });

    // Metallic networks: connected metal atoms confer the bulk properties.
    const parent = rows.map((_, i) => i);
    const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
    for (const t of typed) {
      if (t.type.key !== 'METALLIC') continue;
      parent[find(t.ai)] = find(t.bi);
    }
    const groups = new Map();
    rows.forEach((row, i) => {
      if (!isMetalRow(row)) return;
      const r = find(i);
      if (!groups.has(r)) groups.set(r, []);
      groups.get(r).push(i);
    });
    const metallicComponents = [];
    for (const members of groups.values()) {
      if (members.length < 2) continue;
      metallicComponents.push({ atoms: members, props: BOND_TYPES.METALLIC.bulkProperties });
    }

    return {
      totalValenceElectrons: totalValenceElectrons,
      isOddElectron: speciesOdd,
      valid: violations.length === 0,
      violations: violations,
      notes: notes,
      atoms: outAtoms,
      metallicNetwork: {
        present: metallicComponents.length > 0,
        components: metallicComponents,
        props: BOND_TYPES.METALLIC.bulkProperties
      }
    };
  }

  // --- intermolecular forces -----------------------------------------------
  function moleculeFeatures(molecule) {
    const atoms = molecule.atoms || [];
    const bonds = molecule.bonds || [];
    const idxOf = (end, i) => (typeof end === 'number' ? end : (atoms[i] && atoms[i].id === end ? i : end));
    const rows = atoms.map((a) => elementOf(a.sym || (a.el && a.el.sym) || ''));
    const donors = [];   // H covalently bonded to N/O/F
    const acceptors = [];// N/O/F sites
    const charged = [];
    rows.forEach((row, i) => {
      if (!row) return;
      if ((row.sym === 'N' || row.sym === 'O' || row.sym === 'F') && !isMetalRow(row)) acceptors.push(i);
      if (atoms[i].fc) charged.push(i);
    });
    bonds.forEach((b, bi) => {
      if (b.ionic || b.dative || b.donor !== undefined) return;
      const ai = idxOf(b.a, bi), aj = idxOf(b.b, bi);
      let h = -1, heavy = -1;
      if (rows[ai] && rows[ai].sym === 'H') { h = ai; heavy = aj; }
      else if (rows[aj] && rows[aj].sym === 'H') { h = aj; heavy = ai; }
      if (h < 0 || !rows[heavy]) return;
      const s = rows[heavy].sym;
      if (s === 'N' || s === 'O' || s === 'F') donors.push(h);
    });
    const totalValence = rows.reduce((s, r) => s + (r ? r.valence || 0 : 0), 0) - (molecule.charge || 0);
    return {
      rows: rows, donors: donors, acceptors: acceptors, charged: charged,
      totalValence: totalValence, polar: isPolarMolecule(molecule)
    };
  }

  // Between two molecules: H-bond (donor H ... N/O/F), dipole-dipole (both
  // polar), London dispersion (always; grows with size), ion-dipole when one
  // side carries charge. With atom positions the H-bond must be within the
  // cutoff; without them the capability set is returned.
  function computeIntermolecularInteractions(a, b, opts) {
    opts = opts || {};
    const hCutoff = opts.hBondCutoff !== undefined ? opts.hBondCutoff : 3.0;
    const fa = moleculeFeatures(a), fb = moleculeFeatures(b);
    const out = [];
    const posOf = (m, i) => (m.atoms[i] && m.atoms[i].pos) || null;
    const hasPos = (m, i) => { const p = posOf(m, i); return p && Number.isFinite(p.x); };

    let hb = false, hbPair = null;
    const tryPair = (donors, acceptors, mDon, mAcc) => {
      for (const d of donors) {
        for (const ac of acceptors) {
          if (mDon === mAcc && d === ac) continue;
          if (hasPos(mDon, d) && hasPos(mAcc, ac)) {
            if (distance(posOf(mDon, d), posOf(mAcc, ac)) > hCutoff) continue;
          }
          hb = true; hbPair = { donor: d, acceptor: ac };
          return true;
        }
      }
      return false;
    };
    if (fa.donors.length && fb.acceptors.length) tryPair(fa.donors, fb.acceptors, a, b);
    if (!hb && fb.donors.length && fa.acceptors.length) tryPair(fb.donors, fa.acceptors, b, a);
    if (hb) out.push({ type: 'HYDROGEN_BOND', category: 'intermolecular',
      strength: BOND_TYPES.HYDROGEN_BOND.relativeStrength, pair: hbPair });

    if (fa.polar && fb.polar) out.push({ type: 'DIPOLE_DIPOLE', category: 'intermolecular',
      strength: BOND_TYPES.DIPOLE_DIPOLE.relativeStrength });

    // London dispersion: always present, growing with polarisability; the
    // valence-electron count is the deterministic stand-in for size.
    const size = fa.totalValence + fb.totalValence;
    out.push({ type: 'LONDON_DISPERSION', category: 'intermolecular',
      strength: BOND_TYPES.LONDON_DISPERSION.relativeStrength * (1 + Math.min(2, size / 120)) });

    if (fa.charged.length && fb.polar) out.push({ type: 'ION_DIPOLE', category: 'specialized',
      strength: BOND_TYPES.ION_DIPOLE.relativeStrength, ionSide: 'a' });
    else if (fb.charged.length && fa.polar) out.push({ type: 'ION_DIPOLE', category: 'specialized',
      strength: BOND_TYPES.ION_DIPOLE.relativeStrength, ionSide: 'b' });

    return out;
  }

  const api = Object.freeze({
    version: '1.0.0',
    BOND_TYPES: BOND_TYPES,
    ELEMENTS: BUILT_IN_ELEMENTS,
    setElementSource: setElementSource,
    bondTypeOf: bondTypeOf,
    isPolarMolecule: isPolarMolecule,
    evaluateMoleculeBonding: evaluateMoleculeBonding,
    computeIntermolecularInteractions: computeIntermolecularInteractions
  });
  root.ChemBonding = api;
})(typeof window !== 'undefined' ? window : globalThis);