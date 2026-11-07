// Molecular Simulation Engine - real physics, SI units throughout.
// Every behaviour reported by this module comes from an explicit calculation;
// models that are classical approximations of quantum effects are labelled as such.
(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Mol3DPhysics = api;
})(typeof window !== 'undefined' ? window : null, function() {
  'use strict';

  // ============================== PHASE 1 ==============================
  // Fundamental constants (CODATA 2018, exact where the SI defines them).
  var CONST = {
    c: 299792458,                    // m/s (exact)
    h: 6.62607015e-34,               // J s (exact)
    k_B: 1.380649e-23,               // J/K (exact)
    N_A: 6.02214076e23,              // 1/mol (exact)
    e: 1.602176634e-19,              // C (exact)
    eps0: 8.8541878128e-12,          // F/m (CODATA 2018)
    mu0: 1.25663706212e-6,           // N/A^2 (CODATA 2018)
    amu: 1.66053906660e-27,          // kg (CODATA 2018)
    angstrom: 1e-10,                 // m
    eV: 1.602176634e-19,             // J
    kcal: 4184,                      // J per thermochemical kcal
    debye: 3.33564e-30,              // C m
    a0: 5.29177210903e-11            // Bohr radius, m
  };
  CONST.R = CONST.N_A * CONST.k_B;             // 8.31446261815324 J/(mol K)
  CONST.hbar = CONST.h / (2 * Math.PI);        // J s
  CONST.ke = 1 / (4 * Math.PI * CONST.eps0);   // 8.9875517923e9 N m^2 / C^2
  CONST.kcalMol = 4184 / CONST.N_A;            // J per particle per kcal/mol

  // The scene in chemistry.js builds a bond as (radius_A + radius_B)/55 with the
  // radii in pm, so one world unit is 55 pm.
  var SCENE_UNIT_ANGSTROM = 0.55;
  var ANGSTROM = CONST.angstrom;

  function evToJ(x) { return x * CONST.eV; }
  function jToEv(x) { return x / CONST.eV; }
  function kcalMolToJ(x) { return x * CONST.kcal / CONST.N_A; }
  function jToKcalMol(x) { return x * CONST.N_A / CONST.kcal; }
  function kJPerMolToJ(x) { return x * 1000 / CONST.N_A; }
  function jToKJPerMol(x) { return x * CONST.N_A / 1000; }

  // Atomic database.
  //  mass_u      standard atomic weight (IUPAC 2021 abridged) - kg derived from it
  //  rcov        Pyykko & Atsumi self-consistent single-bond covalent radius, angstrom
  //  rvdw        Bondi / Alvarez van der Waals radius, angstrom (null when unpublished)
  //  en          Pauling electronegativity (null for noble gases without a value)
  //  ie1         first ionisation energy, eV (NIST)
  //  ea          electron affinity, eV (NIST; negative means the anion is unbound)
  //  oxides      common oxidation states
  //  polar       static dipole polarizability, angstrom^3 (null when not tabulated here)
  // Entries whose radius or vdW value is missing stay null: the engine reports
  // "no data" instead of inventing a number.
  var EL_DATA = [
    // sym, z, mass_u, rcov, rvdw, en, ie1, ea, oxidation states, polarizability A^3
    ['H', 1, 1.008, 0.32, 1.20, 2.20, 13.598, 0.7542, '1,-1', 0.667],
    ['He', 2, 4.0026, null, 1.40, null, 24.587, null, '0', 0.205],
    ['Li', 3, 6.94, 1.33, 1.82, 0.98, 5.392, 0.596, '1', null],
    ['Be', 4, 9.0122, 1.02, 1.53, 1.57, 9.323, null, '2', 0.46],
    ['B', 5, 10.81, 0.85, 1.92, 2.04, 8.298, 0.279, '3', null],
    ['C', 6, 12.011, 0.75, 1.70, 2.55, 11.260, 1.262, '4,-4', 1.76],
    ['N', 7, 14.007, 0.71, 1.55, 3.04, 14.534, -0.07, '3,5,-3', 1.10],
    ['O', 8, 15.999, 0.63, 1.52, 3.44, 13.618, 1.461, '2,-2', 0.80],
    ['F', 9, 18.998, 0.64, 1.47, 3.98, 17.423, 3.401, '-1', 0.56],
    ['Ne', 10, 20.180, null, 1.54, null, 21.565, null, '0', 0.40],
    ['Na', 11, 22.990, 1.55, 2.27, 0.93, 5.139, 0.548, '1', 24.1],
    ['Mg', 12, 24.305, 1.39, 1.73, 1.31, 7.646, null, '2', 10.6],
    ['Al', 13, 26.982, 1.26, 1.84, 1.61, 5.986, 0.431, '3', null],
    ['Si', 14, 28.085, 1.16, 2.10, 1.90, 8.152, 1.389, '4,-4', 3.5],
    ['P', 15, 30.974, 1.11, 1.80, 2.19, 10.487, 0.747, '5,3,-3', 3.9],
    ['S', 16, 32.06, 1.03, 1.80, 2.58, 10.360, 2.077, '6,4,2,-2', 2.9],
    ['Cl', 17, 35.45, 0.99, 1.75, 3.16, 12.968, 3.613, '-1,1,5,7', 2.18],
    ['Ar', 18, 39.948, 0.96, 1.88, null, 15.760, null, '0', 1.64],
    ['K', 19, 39.098, 1.96, 2.75, 0.82, 4.341, 0.501, '1', 43.4],
    ['Ca', 20, 40.078, 1.71, 2.31, 1.00, 6.113, 0.0245, '2', null],
    ['Sc', 21, 44.956, 1.48, 2.11, 1.36, 6.561, 0.188, '3', null],
    ['Ti', 22, 47.867, 1.36, null, 1.54, 6.828, 0.084, '4,3', null],
    ['V', 23, 50.942, 1.34, null, 1.63, 6.746, 0.525, '5,4,3', null],
    ['Cr', 24, 51.996, 1.22, null, 1.66, 6.767, 0.668, '6,3,2', null],
    ['Mn', 25, 54.938, 1.39, null, 1.55, 7.434, null, '7,4,2', null],
    ['Fe', 26, 55.845, 1.32, null, 1.83, 7.902, 0.163, '3,2', null],
    ['Co', 27, 58.933, 1.26, null, 1.88, 7.881, 0.662, '3,2', null],
    ['Ni', 28, 58.693, 1.24, 1.63, 1.91, 7.640, 1.156, '2', null],
    ['Cu', 29, 63.546, 1.32, 1.40, 1.90, 7.726, 1.108, '2,1', null],
    ['Zn', 30, 65.38, 1.22, 1.39, 1.65, 9.394, null, '2', 7.1],
    ['Ga', 31, 69.723, 1.22, 1.87, 1.81, 5.999, 0.30, '3', null],
    ['Ge', 32, 72.630, 1.20, 2.11, 2.01, 7.700, 1.20, '4,2', null],
    ['As', 33, 74.922, 1.19, 1.85, 2.18, 9.789, 0.71, '5,3,-3', null],
    ['Se', 34, 78.971, 1.16, 1.90, 2.55, 9.752, 2.020, '6,4,-2', null],
    ['Br', 35, 79.904, 1.14, 1.85, 2.96, 11.814, 3.364, '-1,1,5', 3.05],
    ['Kr', 36, 83.798, 1.17, 2.02, 3.00, 14.000, null, '0', 2.48],
    ['Rb', 37, 85.468, 2.10, 3.03, 0.82, 4.177, 0.50, '1', null],
    ['Sr', 38, 87.62, 1.85, 2.49, 0.95, 5.695, null, '2', null],
    ['Y', 39, 88.906, 1.90, null, 1.22, 6.217, 0.307, '3', null],
    ['Zr', 40, 91.224, 1.45, null, 1.33, 6.634, 0.426, '4', null],
    ['Nb', 41, 92.906, 1.45, null, 1.60, 6.758, 0.92, '5', null],
    ['Mo', 42, 95.95, 1.47, null, 2.16, 7.092, 0.747, '6', null],
    ['Tc', 43, 98, 1.46, null, 1.90, 7.28, 0.55, '7', null],
    ['Ru', 44, 101.07, 1.42, null, 2.20, 7.361, 1.05, '4', null],
    ['Rh', 45, 102.91, 1.42, null, 2.28, 7.459, 1.14, '3', null],
    ['Pd', 46, 106.42, 1.39, 1.63, 2.20, 8.337, 0.562, '2,4', null],
    ['Ag', 47, 107.87, 1.45, 1.72, 1.93, 7.576, 1.302, '1', null],
    ['Cd', 48, 112.41, 1.44, 1.58, 1.69, 8.994, null, '2', null],
    ['In', 49, 114.82, 1.42, 1.93, 1.78, 5.786, 0.397, '3,1', null],
    ['Sn', 50, 118.71, 1.39, 2.17, 1.96, 7.344, 1.112, '4,2', null],
    ['Sb', 51, 121.76, 1.39, 2.06, 2.05, 8.609, 1.072, '5,3', null],
    ['Te', 52, 127.60, 1.38, 2.06, 2.10, 9.010, 1.970, '6,4,-2', null],
    ['I', 53, 126.90, 1.33, 1.98, 2.66, 10.451, 3.059, '-1,1,5,7', 5.23],
    ['Xe', 54, 131.29, 1.31, 2.16, 2.60, 12.130, null, '0,2', 4.04],
    ['Cs', 55, 132.91, 2.32, 3.43, 0.79, 3.894, 0.472, '1', null],
    ['Ba', 56, 137.33, 1.94, 2.68, 0.89, 5.212, null, '2', null],
    ['La', 57, 138.91, 1.80, null, 1.10, 5.577, 0.47, '3', null],
    ['Ce', 58, 140.12, 1.85, null, 1.12, 5.539, 0.50, '4,3', null],
    ['W', 74, 183.84, 1.62, null, 2.36, 7.864, 0.816, '6', null],
    ['Pt', 78, 195.08, 1.39, null, 2.28, 9.0, 2.125, '2,4', null],
    ['Au', 79, 196.97, 1.36, 1.66, 2.54, 9.226, 2.309, '3,1', null],
    ['Hg', 80, 200.59, 1.32, 1.55, 2.00, 10.437, null, '2,1', null],
    ['Tl', 81, 204.38, 1.45, 1.96, 1.62, 6.108, 0.377, '3,1', null],
    ['Pb', 82, 207.2, 1.46, 2.02, 2.33, 7.417, 0.357, '4,2', null],
    ['Bi', 83, 208.98, 1.48, 2.07, 2.02, 7.286, 0.946, '5,3', null],
    ['U', 92, 238.03, 1.83, 1.86, 1.38, 6.194, null, '6,4', null]
  ];

  var ELEMENTS = {};
  var ELEMENTS_BY_Z = {};
  (function buildElements() {
    for (var i = 0; i < EL_DATA.length; i++) {
      var d = EL_DATA[i];
      var el = {
        sym: d[0], z: d[1],
        mass_u: d[2],
        mass: d[2] * CONST.amu,          // kg per atom
        rcov: d[3],                       // angstrom
        rvdw: d[4],                       // angstrom
        en: d[5],                         // Pauling
        ie1: d[6],                        // eV
        ea: d[7],                         // eV
        oxides: d[8] ? d[8].split(',') : [],
        polar: d[9],                      // angstrom^3
        nuclearCharge: d[1] * CONST.e     // C
      };
      el.rcov_m = el.rcov === null ? null : el.rcov * ANGSTROM;
      el.rvdw_m = el.rvdw === null ? null : el.rvdw * ANGSTROM;
      el.polar_m3 = el.polar === null ? null : el.polar * 1e-30;
      el.hasData = { radius: el.rcov !== null, vdw: el.rvdw !== null, en: el.en !== null, ie: el.ie1 !== null, polar: el.polar !== null };
      ELEMENTS[el.sym] = el;
      ELEMENTS_BY_Z[el.z] = el;
    }
  })();

  function element(symOrZ) {
    if (typeof symOrZ === 'number') return ELEMENTS_BY_Z[symOrZ] || null;
    if (symOrZ && symOrZ.sym) return ELEMENTS_BY_Z[symOrZ.z] || ELEMENTS[symOrZ.sym] || null;
    return ELEMENTS[symOrZ] || null;
  }

  // Missing-data report so the UI can say which properties are not modelled.
  function dataGaps(symbols) {
    var gaps = [];
    for (var i = 0; i < symbols.length; i++) {
      var el = element(symbols[i]);
      if (!el) { gaps.push(symbols[i] + ': not in database'); continue; }
      if (el.rcov === null) gaps.push(el.sym + ': covalent radius');
      if (el.rvdw === null) gaps.push(el.sym + ': van der Waals radius');
      if (el.en === null) gaps.push(el.sym + ': electronegativity');
      if (el.polar === null) gaps.push(el.sym + ': polarizability');
    }
    return gaps;
  }

  // ===================== BENCHMARK BOND PARAMETER TABLE =====================
  // Mean bond properties taken from standard physical-chemistry tables.
  //   k    harmonic force constant, N/m   (1 mdyn/A = 100 N/m)
  //   re   equilibrium bond length, angstrom
  //   De   mean bond dissociation enthalpy at 298 K, kJ/mol
  //   order bond order the entry describes
  // Pairs absent here fall back to estimateBond() and are flagged "estimated".
  var BOND_TABLE = {
    'H-H': { k: 575, re: 0.741, De: 436, order: 1 },
    'N#N': { k: 2293, re: 1.098, De: 945, order: 3 },
    'O=O': { k: 1180, re: 1.208, De: 498, order: 2 },
    'F-F': { k: 370, re: 1.412, De: 159, order: 1 },
    'Cl-Cl': { k: 323, re: 1.988, De: 242, order: 1 },
    'Br-Br': { k: 240, re: 2.281, De: 193, order: 1 },
    'I-I': { k: 175, re: 2.666, De: 151, order: 1 },
    'C-C': { k: 452, re: 1.540, De: 348, order: 1 },
    'C=C': { k: 960, re: 1.339, De: 614, order: 2 },
    'C#C': { k: 1560, re: 1.203, De: 839, order: 3 },
    'C-H': { k: 492, re: 1.090, De: 413, order: 1 },
    'N-H': { k: 650, re: 1.012, De: 391, order: 1 },
    'O-H': { k: 792, re: 0.958, De: 463, order: 1 },
    'S-H': { k: 477, re: 1.336, De: 347, order: 1 },
    'C-N': { k: 518, re: 1.470, De: 305, order: 1 },
    'C=N': { k: 1020, re: 1.279, De: 615, order: 2 },
    'C#N': { k: 1770, re: 1.156, De: 891, order: 3 },
    'N-N': { k: 530, re: 1.450, De: 163, order: 1 },
    'N=N': { k: 1140, re: 1.250, De: 418, order: 2 },
    'N-O': { k: 620, re: 1.400, De: 201, order: 1 },
    'N=O': { k: 1380, re: 1.210, De: 607, order: 2 },
    'C-O': { k: 740, re: 1.430, De: 358, order: 1 },
    'C=O': { k: 1230, re: 1.210, De: 799, order: 2 },
    'O-O': { k: 380, re: 1.470, De: 146, order: 1 },
    'O-S': { k: 552, re: 1.570, De: 351, order: 1 },
    'O=S': { k: 1130, re: 1.431, De: 522, order: 2 },
    'S-S': { k: 306, re: 2.055, De: 240, order: 1 },
    'H-Cl': { k: 480, re: 1.275, De: 431, order: 1 },
    'H-F': { k: 888, re: 0.917, De: 567, order: 1 },
    'H-Br': { k: 411, re: 1.414, De: 366, order: 1 },
    'H-I': { k: 314, re: 1.609, De: 299, order: 1 },
    'C-Cl': { k: 329, re: 1.770, De: 339, order: 1 },
    'C-F': { k: 375, re: 1.350, De: 485, order: 1 },
    'C-Br': { k: 264, re: 1.940, De: 285, order: 1 },
    'C-I': { k: 175, re: 2.140, De: 213, order: 1 },
    'C-S': { k: 473, re: 1.820, De: 272, order: 1 },
    'C-P': { k: 400, re: 1.840, De: 264, order: 1 },
    'Si-O': { k: 800, re: 1.610, De: 452, order: 1 },
    'Si-H': { k: 549, re: 1.480, De: 318, order: 1 },
    'B-F': { k: 680, re: 1.300, De: 613, order: 1 },
    'B-O': { k: 600, re: 1.360, De: 531, order: 1 },
    'Na-Cl': { k: 193, re: 2.361, De: 412, order: 1 },
    'K-Cl': { k: 96, re: 2.666, De: 443, order: 1 },
    'Li-F': { k: 220, re: 1.564, De: 565, order: 1 },
    'Na-F': { k: 168, re: 1.930, De: 488, order: 1 },
    'Mg-O': { k: 780, re: 1.750, De: 394, order: 1 },
    'Ca-O': { k: 500, re: 1.990, De: 385, order: 1 },
    'C=O(co2)': { k: 1600, re: 1.160, De: 799, order: 2 }
  };

  // Experimental equilibrium bond angles (degrees), keyed X-Y-Z about centre Y.
  var ANGLE_TABLE = {
    'H-O-H': 104.5, 'H-N-H': 106.7, 'H-C-H': 109.47, 'Cl-C-Cl': 111.8,
    'H-C-C': 110.0, 'H-N-N': 112.0, 'O-C-O': 124.0, 'H-O-C': 108.5,
    'C-C-H': 121.5, 'H-C=C': 121.5, 'O-S-O': 119.5, 'Cl-S-Cl': 102.0,
    'F-B-F': 120.0, 'H-N-H ': 106.7, 'N-N-H': 115.0, 'C-N-H': 116.0,
    'O-N-O': 132.5, 'Cl-P-Cl': 100.0, 'F-Be-F': 180.0, 'H-S-H': 92.1,
    'H-P-H': 93.5, 'C-O-C': 111.7, 'C-C-O': 111.0, 'O-C-H': 116.6
  };

  // Barrier heights V1/V2/V3 in kJ/mol for standard torsions.
  var TORSION_TABLE = {
    'H-C-C-H': [{ n: 3, V: 11.7, delta: 0 }],        // ethane, threefold
    'C-C-C-H': [{ n: 3, V: 9.5, delta: 0 }],
    'H-O-C-H': [{ n: 3, V: 16.0, delta: 0 }],
    'C-O-C-H': [{ n: 1, V: 8.4, delta: 0 }, { n: 2, V: -6.3, delta: 0 }, { n: 3, V: 8.0, delta: 0 }],
    'H-N-N-H': [{ n: 1, V: 5.9, delta: 0 }, { n: 2, V: -2.6, delta: 0 }, { n: 3, V: 5.0, delta: 0 }]
  };

  var SEPARATOR = { 1: '-', 2: '=', 3: '#' };

  function lookupBond(symA, symB, order) {
    var orders = order ? [order] : [3, 2, 1];
    for (var s = 0; s < orders.length; s++) {
      var sep = SEPARATOR[orders[s]];
      var cands = [symA + sep + symB, symB + sep + symA];
      for (var c = 0; c < cands.length; c++) {
        var row = BOND_TABLE[cands[c]];
        if (row) {
          return { k: row.k, re: row.re, De: row.De, order: row.order, key: cands[c], measured: true };
        }
      }
    }
    return null;
  }

  // Estimated fallback. Length comes from tabulated covalent radii; the force
  // constant comes from Pauling's bond-order relation k ~ BO / re^5 (a classical
  // scaling rule, never presented as a measurement).
  function estimateBond(symA, symB, order) {
    var A = element(symA), B = element(symB);
    if (!A || !B || A.rcov === null || B.rcov === null) return null;
    var re = A.rcov + B.rcov;
    var bo = order || 1;
    var rePM = re * 100;
    var k = 1.0e6 * bo / (rePM * rePM);
    return { k: k, re: re, De: 350 * bo, order: bo, key: symA + '-' + symB, measured: false };
  }

  function bondParams(symA, symB, order) {
    return lookupBond(symA, symB, order) || estimateBond(symA, symB, order);
  }

  function angleParams(symA, centre, symB) {
    var k1 = symA + '-' + centre + '-' + symB;
    var k2 = symB + '-' + centre + '-' + symA;
    if (ANGLE_TABLE[k1] !== undefined) return { theta0: ANGLE_TABLE[k1], measured: true, key: k1 };
    if (ANGLE_TABLE[k2] !== undefined) return { theta0: ANGLE_TABLE[k2], measured: true, key: k2 };
    return null;
  }

  function torsionParams(a, b, c, d) {
    var k1 = a + '-' + b + '-' + c + '-' + d;
    var k2 = d + '-' + c + '-' + b + '-' + a;
    if (TORSION_TABLE[k1]) return TORSION_TABLE[k1];
    if (TORSION_TABLE[k2]) return TORSION_TABLE[k2];
    return [{ n: 3, V: 8.0, delta: 0 }];   // generic threefold barrier, flagged by caller
  }

  // ============================== PHASE 2 ==============================
  // Pair potentials. Arguments and results are SI (m, J, N) unless named otherwise.
  var Potentials = {};

  // U = ke q1 q2 / r ; scalar force = +ke q1 q2 / r^2 is repulsive along r_ij.
  Potentials.coulomb = function(q1, q2, r_m) {
    if (!(r_m > 0)) return { energy: Infinity, forceScalar: Infinity };
    return {
      energy: CONST.ke * q1 * q2 / r_m,
      forceScalar: CONST.ke * q1 * q2 / (r_m * r_m)
    };
  };

  // Cubic switching function, continuous in value and slope, 1 below rsw, 0 above rc.
  function switchFunction(r, rsw, rc) {
    if (r <= rsw) return { e: 1, de: 0 };
    if (r >= rc) return { e: 0, de: 0 };
    var x = (r - rsw) / (rc - rsw);
    return { e: 1 - 3 * x * x + 2 * x * x * x, de: (-6 * x + 6 * x * x) / (rc - rsw) };
  }

  // Lennard-Jones written through its dispersion coefficient:
  //   U(r) = C12/r^12 - C6/r^6,  C6 from London, C12 fixed by the observed
  //   separation of the van der Waals minimum. Equivalent to 4 eps [(sig/r)^12 - (sig/r)^6].
  // A switching function multiplies the whole term between rsw and rc.
  Potentials.vdwPair = function(elA, elB) {
    var alphaA = elA.polar_m3, alphaB = elB.polar_m3;
    var ieA = elA.ie1 === null ? null : evToJ(elA.ie1);
    var ieB = elB.ie1 === null ? null : evToJ(elB.ie1);
    if (!(alphaA > 0) || !(alphaB > 0) || !(ieA > 0) || !(ieB > 0)) return null;
    if (elA.rvdw === null || elB.rvdw === null) return null;
    var I_AB = 2 * ieA * ieB / (ieA + ieB);                    // J (London)
    var C6 = 0.75 * I_AB * alphaA * alphaB;                    // J m^6
    var rMin = (elA.rvdw + elB.rvdw) * ANGSTROM;               // m
    var C12 = C6 * Math.pow(rMin, 6) / 2;
    var epsilon = C6 * C6 / (4 * C12);                         // J  (= C6 / (2 rMin^6))
    var sigma = Math.pow(C12 / C6, 1 / 6);                     // m, U(sigma)=0
    return {
      C6: C6, C12: C12, rMin: rMin, epsilon: epsilon, sigma: sigma,
      source: 'London dispersion from tabulated polarizability + ionisation energy; minimum set by Bondi radii'
    };
  };

  // U and dU/dr for the switched 12-6 term.
  Potentials.lj = function(r_m, pair, rc_m, rsw_m) {
    var rc = rc_m || 1.4e-9;
    var rsw = rsw_m || (rc - 2e-10);
    if (r_m <= 0 || r_m >= rc) return { energy: 0, dUdr: 0 };
    var r6 = Math.pow(r_m, 6);
    var u0 = pair.C12 / (r6 * r6) - pair.C6 / r6;
    var du0 = -12 * pair.C12 / (r6 * r6 * r_m) + 6 * pair.C6 / (r6 * r_m);
    var s = switchFunction(r_m, rsw, rc);
    return { energy: u0 * s.e, dUdr: du0 * s.e + u0 * s.de };
  };

  Potentials.sigmaFromVdw = function(rA_m, rB_m) { return (rA_m + rB_m) / Math.pow(2, 1 / 6); };
  Potentials.eqSeparation = function(sigma_m) { return sigma_m * Math.pow(2, 1 / 6); };
  Potentials.mixSigma = function(a, b) { return 0.5 * (a + b); };
  Potentials.mixEpsilon = function(a, b) { return Math.sqrt(a * b); };

  // ============================== PHASE 3 / 5 ==============================
  Potentials.bondHarmonic = function(r_m, r0_m, k_Nm) {
    var d = r_m - r0_m;
    return { energy: 0.5 * k_Nm * d * d, dUdr: k_Nm * d };
  };

  // Morse: U = De [1 - exp(-a (r - re))]^2 - De, a fixed by k = 2 De a^2 so the
  // curvature at the minimum matches the harmonic constant.
  Potentials.morseAlpha = function(De_J, k_Nm) { return Math.sqrt(k_Nm / (2 * De_J)); };
  Potentials.morse = function(r_m, re_m, De_J, k_Nm) {
    var a = Potentials.morseAlpha(De_J, k_Nm);
    var e = Math.exp(-a * (r_m - re_m));
    return { energy: De_J * (1 - e) * (1 - e) - De_J, dUdr: 2 * a * De_J * (1 - e) * e, a: a };
  };

  Potentials.angle = function(theta, theta0, k_rad) {
    var d = theta - theta0;
    return { energy: 0.5 * k_rad * d * d, dUdtheta: k_rad * d };
  };

  // Fourier torsion: U = sum_n (V_n/2)[1 + cos(n phi - delta_n)]
  Potentials.torsion = function(phi, terms) {
    var u = 0, dU = 0;
    for (var i = 0; i < terms.length; i++) {
      var t = terms[i];
      u += 0.5 * t.V * (1 + Math.cos(t.n * phi - t.delta));
      dU += -0.5 * t.V * t.n * Math.sin(t.n * phi - t.delta);
    }
    return { energy: u, dUdphi: dU };
  };

  // Improper (out-of-plane) harmonic keeps sp2 centres planar.
  Potentials.improper = function(chi, chi0, k_rad) {
    var d = chi - chi0;
    return { energy: 0.5 * k_rad * d * d, dUdchi: k_rad * d };
  };

  // Directional hydrogen-bond term in the standard 12-10 empirical form,
  // switched off beyond switchR. The UI labels this term as an explicit
  // approximation: H-bonding also emerges from Coulomb + LJ once charges exist.
  Potentials.hBond = function(r_m, A_Jm12, B_Jm10, switchR_m) {
    if (r_m <= 0 || r_m >= switchR_m) return { energy: 0, dUdr: 0 };
    var s = switchFunction(r_m, switchR_m * 0.85, switchR_m);
    var r10 = Math.pow(r_m, 10), r12 = r10 * r_m * r_m;
    var u = A_Jm12 / r12 - B_Jm10 / r10;
    var du = -12 * A_Jm12 / (r12 * r_m) + 10 * B_Jm10 / (r10 * r_m);
    return { energy: u * s.e, dUdr: du * s.e + u * s.de };
  };

  // ============================== VSEPR (3.4) ==============================
  // Electron-pair repulsion model: a classical, explicitly non-quantitative
  // geometry rule. It seeds positions; the force field then refines them.
  var VSEPR = {
    // steric number -> {shape, idealAngle}
    table: {
      2: { shape: 'linear', angle: 180, lone: { 0: 'linear' } },
      3: { shape: 'trigonal planar', angle: 120, lone: { 0: 'trigonal planar', 1: 'bent' } },
      4: { shape: 'tetrahedral', angle: 109.47, lone: { 0: 'tetrahedral', 1: 'trigonal pyramidal', 2: 'bent' } },
      5: { shape: 'trigonal bipyramidal', angle: 120, lone: { 0: 'trigonal bipyramidal', 1: 'seesaw', 2: 'T-shaped', 3: 'linear' } },
      6: { shape: 'octahedral', angle: 90, lone: { 0: 'octahedral', 1: 'square pyramidal', 2: 'square planar' } }
    },
    // Lone pairs occupy the positions that minimise repulsion: equatorial slots
    // first in a trigonal bipyramid (slot 3 and 4 are the axial ones here) and
    // trans pairs in an octahedron (slots 0 and 1 are opposite).
    loneOrder: {
      3: [1],
      4: [3, 0],
      5: [0, 1, 2],
      6: [1, 0]
    },
    classify: function(steric, lonePairs) {
      var row = VSEPR.table[steric];
      if (!row) return { shape: 'undetermined', angle: null };
      return { shape: row.lone[lonePairs] || row.shape, angle: row.angle, steric: steric };
    }
  };

  // ============================== PHASE 4 ==============================
  // SI vector helpers: positions in metres, velocities m/s, forces newtons.
  function Molecule(spec) {
    spec = spec || {};
    this.atoms = [];
    this.bonds = [];
    this.angles = [];
    this.torsions = [];
    this.impropers = [];
    this.charge = spec.charge || 0;            // coulombs carried by the whole system
    this.options = {
      cutoff: spec.cutoff || 1.2e-9,
      switchWidth: spec.switchWidth || 2e-10,
      coulombCutoff: spec.coulombCutoff || 2.0e-9,
      useMorse: spec.useMorse !== false,
      useAngle: spec.useAngle !== false,
      useTorsion: spec.useTorsion !== false,
      useVdW: spec.useVdW !== false,
      useCoulomb: spec.useCoulomb !== false,
      scale14Coulomb: spec.scale14Coulomb === undefined ? 0.833 : spec.scale14Coulomb,
      scale14Vdw: spec.scale14Vdw === undefined ? 0.5 : spec.scale14Vdw,
      // Off for a classical force-field run; the reactive layer turns it on.
      pairBondCurve: !!spec.pairBondCurve
    };
    this.exclusions = {};
    this.warnings = [];
    this.notes = [];
    this.lastEnergy = null;
  }

  Molecule.prototype.addAtom = function(sym, pos, opts) {
    opts = opts || {};
    var el = element(sym);
    if (!el) { this.warnings.push('element ' + sym + ' is not in the atomic database'); return null; }
    var a = {
      sym: el.sym, an: el.z, el: el, m: el.mass,
      q: opts.q || 0,
      q0: opts.q || 0,                   // formal charge, kept when q becomes a partial charge
      x: pos.x, y: pos.y, z: pos.z,
      vx: opts.vx || 0, vy: opts.vy || 0, vz: opts.vz || 0,
      fx: 0, fy: 0, fz: 0,
      mu: 0, my: 0, mz: 0,            // induced dipole moment, C m
      fixed: !!opts.fixed,
      tag: opts.tag === undefined ? null : opts.tag
    };
    this.atoms.push(a);
    return a;
  };

  Molecule.prototype.addBond = function(i, j, order) {
    var A = this.atoms[i], B = this.atoms[j];
    if (!A || !B) { this.warnings.push('bond references a missing atom'); return null; }
    var p = bondParams(A.sym, B.sym, order || 1);
    if (!p) { this.warnings.push('no force-field data for ' + A.sym + '-' + B.sym); return null; }
    if (!p.measured) this.notes.push(A.sym + '-' + B.sym + ' uses estimated constants');
    var b = {
      i: i, j: j, order: p.order, key: p.key, measured: p.measured,
      k: p.k,                                  // N/m
      re: p.re * ANGSTROM,                     // m
      De: kJPerMolToJ(p.De)                    // J per bond
    };
    this.bonds.push(b);
    return b;
  };

  // Bending constant: measured values are absent from the bond table, so the
  // classical relation k_angle = 0.1 k_bond r_bond^2 is used and reported.
  //
  // The centre atom's own VSEPR geometry, read from the current bond graph:
  // steric number = neighbours + lone pairs, lone pairs = (V - formal charge -
  // bond order sum) / 2. Nothing here is tabulated per element triple, so linear
  // CO2 and acetylene get 180 degrees instead of the 109.47 degree fallback -
  // the difference is roughly 1000 kJ/mol of invented strain, enough on its own
  // to trip the energy-drift guard a few steps into a run.
  Molecule.prototype.vseprCentre = function(j) {
    var at = this.atoms[j];
    if (!at) return null;
    var v = vseprValence(at.el);
    if (!v.ok) return null;
    var sum = 0, nb = 0;
    for (var i = 0; i < this.bonds.length; i++) {
      var b = this.bonds[i];
      if (b.i === j || b.j === j) { sum += b.order; nb++; }
    }
    var lone = (v.V - Math.round((at.q0 || 0) / CONST.e) - sum) / 2;
    if (lone < -1e-9 || Math.abs(lone - Math.round(lone)) > 1e-9) return null;
    lone = Math.round(lone);
    var steric = nb + lone;
    var cls = VSEPR.classify(steric, lone);
    if (cls.angle === null) return null;
    // Steric numbers 5 and 6 put their ligands on more than one ideal angle
    // (90/120/180 in a trigonal bipyramid, 90/180 in an octahedron), so a single
    // number cannot describe the centre. The site is not guessed: addAngle
    // measures the pair it is parameterising and takes the ideal angle of the
    // site the atom actually occupies. Up to 4 there is only one site.
    var sites = steric === 6 ? [90, 180] : steric === 5 ? [90, 120, 180] : [cls.angle];
    return { angle: cls.angle, sites: sites, shape: cls.shape, steric: steric, lonePairs: lone };
  };

  // How far a tabulated angle may sit from the ideal geometry of the centre it
  // is applied to before it is judged to describe a different molecule.
  // Substitution moves a real angle by a few degrees (H2O 104.5 against the
  // 109.47 of a tetrahedron, sp2 C-C-H 121.5 against 120); it does not turn a
  // linear 180 centre into a 124 one.
  var ANGLE_TABLE_BAND_DEG = 10;

  Molecule.prototype.addAngle = function(i, j, k) {
    var A = this.atoms[i], C = this.atoms[j], D = this.atoms[k];
    if (!A || !C || !D) return null;
    var hit = angleParams(A.sym, C.sym, D.sym);
    var vs = this.vseprCentre(j);
    var vsAngle = null;
    if (vs) {
      // Which ideal angle applies is decided by where the ligand pair sits, and
      // the geometry already knows: pick the site whose ideal angle the current
      // arrangement is closest to. For one site this is just that site's angle.
      var now = angleValue(A, C, D) * 180 / Math.PI;
      vsAngle = vs.sites[0];
      for (var s = 1; s < vs.sites.length; s++) {
        if (Math.abs(now - vs.sites[s]) < Math.abs(now - vsAngle)) vsAngle = vs.sites[s];
      }
    }
    var theta0, source;
    if (hit && vsAngle !== null && Math.abs(hit.theta0 - vsAngle) > ANGLE_TABLE_BAND_DEG) {
      // The table has a number for this element triple, but it belongs to a
      // centre of another shape, and bending toward it would store roughly a
      // thousand kJ/mol in a molecule that is really straight.
      theta0 = vsAngle;
      source = 'VSEPR ' + vs.shape + ' (table ' + hit.theta0 + '° refused)';
      this.warnings.push('angle ' + A.sym + '-' + C.sym + '-' + D.sym + ': tabulated ' +
        hit.theta0 + ' deg refused for a ' + vs.steric + '-coordinate centre (' + vs.shape +
        '), using ' + vsAngle + ' deg');
    } else if (hit) {
      theta0 = hit.theta0; source = 'measured';
    } else if (vsAngle !== null) {
      theta0 = vsAngle; source = 'VSEPR ' + vs.shape;
    } else {
      theta0 = 109.47; source = 'tetrahedral default';
    }
    var b1 = this.findBond(j, i), b2 = this.findBond(j, k);
    var kAng = 0;
    if (b1) kAng += 0.1 * b1.k * b1.re * b1.re;
    if (b2) kAng += 0.1 * b2.k * b2.re * b2.re;
    if (!kAng) kAng = 6e-19;
    var a = {
      i: i, j: j, k: k,
      theta0: theta0 * Math.PI / 180,
      kTheta: kAng,
      thetaSource: source,
      label: A.sym + '-' + C.sym + '-' + D.sym
    };
    this.angles.push(a);
    return a;
  };

  Molecule.prototype.addTorsion = function(i, j, k, l) {
    var A = this.atoms[i], B = this.atoms[j], C = this.atoms[k], D = this.atoms[l];
    if (!A || !B || !C || !D) return null;
    var terms = torsionParams(A.sym, B.sym, C.sym, D.sym);
    var known = !!TORSION_TABLE[A.sym + '-' + B.sym + '-' + C.sym + '-' + D.sym] ||
      !!TORSION_TABLE[D.sym + '-' + C.sym + '-' + B.sym + '-' + A.sym];
    if (!known) this.notes.push('torsion ' + A.sym + '-' + B.sym + '-' + C.sym + '-' + D.sym + ': generic threefold barrier');
    var t = {
      i: i, j: j, k: k, l: l,
      terms: terms.map(function(x) { return { n: x.n, V: kJPerMolToJ(x.V), delta: x.delta || 0 }; }),
      label: A.sym + '-' + B.sym + '-' + C.sym + '-' + D.sym,
      measured: known
    };
    this.torsions.push(t);
    return t;
  };

  Molecule.prototype.addImproper = function(i, j, k, l, chi0deg, kJmol) {
    this.impropers.push({
      i: i, j: j, k: k, l: l,
      chi0: (chi0deg === undefined ? 0 : chi0deg) * Math.PI / 180,
      kChi: kJPerMolToJ(kJmol === undefined ? 110 : kJmol),
      label: this.atoms[i] ? (this.atoms[j].sym + '-' + this.atoms[i].sym + '-' + this.atoms[k].sym + '-' + this.atoms[l].sym) : ''
    });
  };

  Molecule.prototype.findBond = function(i, j) {
    for (var b = 0; b < this.bonds.length; b++) {
      var x = this.bonds[b];
      if ((x.i === i && x.j === j) || (x.i === j && x.j === i)) return x;
    }
    return null;
  };

  Molecule.prototype.neighborsOf = function(idx) {
    var out = [];
    for (var b = 0; b < this.bonds.length; b++) {
      if (this.bonds[b].i === idx) out.push(this.bonds[b].j);
      else if (this.bonds[b].j === idx) out.push(this.bonds[b].i);
    }
    return out;
  };

  // Bond-path lengths 2, 3 and 4 tag every pair so the non-bonded loop can scale
  // or skip the interactions the bonded terms already contain (Phase 2.3).
  Molecule.prototype.buildExclusions = function() {
    var adj = {};
    for (var b = 0; b < this.bonds.length; b++) {
      var x = this.bonds[b];
      (adj[x.i] = adj[x.i] || []).push(x.j);
      (adj[x.j] = adj[x.j] || []).push(x.i);
    }
    this.adjacency = adj;
    var ex = {};
    for (var i = 0; i < this.atoms.length; i++) {
      var depth = {}, queue = [[i, 0]];
      while (queue.length) {
        var cur = queue.shift(), node = cur[0], d = cur[1];
        if (d >= 4) continue;
        var nb = adj[node] || [];
        for (var n = 0; n < nb.length; n++) {
          var to = nb[n];
          if (depth[to] !== undefined && depth[to] <= d + 1) continue;
          depth[to] = d + 1;
          if (to !== i) {
            var key = i + ':' + to;
            if (ex[key] === undefined || ex[key] > d + 1) ex[key] = d + 1;
          }
          queue.push([to, d + 1]);
        }
      }
    }
    this.exclusions = ex;

    // Connected components of the bond graph. The reactive layer needs to know
    // whether a close pair is a distant part of one molecule (whose non-bonded
    // term must stay intact) or two species that have not bonded yet.
    var comp = [], cid = 0;
    for (var c0 = 0; c0 < this.atoms.length; c0++) comp.push(-1);
    for (var s0 = 0; s0 < this.atoms.length; s0++) {
      if (comp[s0] !== -1) continue;
      comp[s0] = cid;
      var stack = [s0];
      while (stack.length) {
        var u = stack.pop(), nbu = adj[u] || [];
        for (var q = 0; q < nbu.length; q++) {
          if (comp[nbu[q]] === -1) { comp[nbu[q]] = cid; stack.push(nbu[q]); }
        }
      }
      cid++;
    }
    this.componentId = comp;
    this.componentCount = cid;
    return ex;
  };

  Molecule.prototype.exclusionLevel = function(i, j) {
    return this.exclusions[i + ':' + j] || this.exclusions[j + ':' + i] || 0;
  };

  // ------------------------------ geometry ------------------------------
  function delta(a, b) { return { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z }; }
  function vlen(v) { return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z); }
  function vdot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
  function vcross(a, b) {
    return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
  }
  function vscale(a, s) { return { x: a.x * s, y: a.y * s, z: a.z * s }; }
  function vunit(a) { var n = vlen(a); return n > 0 ? { x: a.x / n, y: a.y / n, z: a.z / n } : { x: 0, y: 0, z: 0 }; }

  function bondLength(a, b) { return vlen(delta(a, b)); }

  // Pauling's measured bond-length / bond-order relation, in SI:
  //   d(n) = d(1) - 0.71 A * log10(n)   =>   n(d) = 10^((d1 - d) / 0.71 A)
  // d(1) is the tabulated single-bond length for the pair, so n is a fraction of
  // a single bond no matter which order the eventual graph bond will take.
  var PAULING_SLOPE_M = 0.71e-10;
  var boRefCache = {};
  function bondRefSingle(symA, symB) {
    var key = symA < symB ? symA + '|' + symB : symB + '|' + symA;
    if (boRefCache[key] !== undefined) return boRefCache[key];
    var p = bondParams(symA, symB, 1);
    boRefCache[key] = p && p.re ? p.re * ANGSTROM : 0;
    return boRefCache[key];
  }
  function paulingBondOrder(symA, symB, r_m) {
    var d1 = bondRefSingle(symA, symB);
    if (!d1 || !(r_m > 0)) return null;
    var n = Math.pow(10, (d1 - r_m) / PAULING_SLOPE_M);
    return isFinite(n) ? n : null;
  }

  // Angle at centre b, formed by atoms a and c.
  function angleValue(a, b, c) {
    var v1 = vunit(delta(b, a)), v2 = vunit(delta(b, c));
    var cs = Math.max(-1, Math.min(1, vdot(v1, v2)));
    return Math.acos(cs);
  }

  // IUPAC dihedral of the four-point chain i-j-k-l (Praxeolitic form).
  function dihedralValue(i, j, k, l) {
    var b0 = delta(j, i), b1 = delta(j, k), b2 = delta(k, l);
    var n1 = vcross(b0, b1), n2 = vcross(b1, b2);
    var m1 = vcross(n1, vunit(b1));
    var x = vdot(n1, n2), y = vdot(m1, n2);
    if (x === 0 && y === 0) return 0;
    return -Math.atan2(y, x);
  }

  // Out-of-plane angle of atom l relative to the plane of j,k around centre i.
  function improperValue(i, j, k, l) {
    var v1 = delta(i, j), v2 = delta(i, k), v3 = delta(i, l);
    var n = vcross(v1, v2), nn = vlen(n), n3 = vlen(v3);
    if (!(nn > 0) || !(n3 > 0)) return 0;
    var s = vdot(n, v3) / (nn * n3);
    return Math.asin(Math.max(-1, Math.min(1, s)));
  }

  // ------------------------------ central-difference gradient ------------------------------
  // Terms whose analytic derivative is a wall of trigonometry (torsion, improper)
  // are differentiated numerically: exact to O(h^2) and auditable. selfTest()
  // checks this routine against the analytic gradient of the angle term.
  var FD_H = 1e-12;   // m
  function numericGradient(energyFn, idxs, apply) {
    var grads = [], i, axis, keys = ['x', 'y', 'z'];
    for (i = 0; i < idxs.length; i++) grads.push({ fx: 0, fy: 0, fz: 0 });
    for (i = 0; i < idxs.length; i++) {
      var atom = apply(idxs[i]);
      for (axis = 0; axis < 3; axis++) {
        var key = keys[axis];
        var save = atom[key];
        atom[key] = save + FD_H; var eP = energyFn();
        atom[key] = save - FD_H; var eM = energyFn();
        atom[key] = save;
        grads[i][['fx', 'fy', 'fz'][axis]] = -(eP - eM) / (2 * FD_H);
      }
    }
    return grads;
  }

  // ------------------------------ forces ------------------------------
  Molecule.prototype.computeForces = function() {
    var A = this.atoms, n = A.length, i, j;
    for (i = 0; i < n; i++) { A[i].fx = 0; A[i].fy = 0; A[i].fz = 0; }
    var E = { bond: 0, angle: 0, torsion: 0, improper: 0, coulomb: 0, vdw: 0, bondCurve: 0, polarization: 0, total: 0 };
    var o = this.options, rc = o.cutoff, rsw = rc - o.switchWidth;

    // 3.1 / 5. bond stretching (harmonic or Morse)
    for (i = 0; i < this.bonds.length; i++) {
      var b = this.bonds[i], a1 = A[b.i], a2 = A[b.j];
      var r = bondLength(a1, a2);
      if (!(r > 0)) { this.warnings.push('zero-length bond ' + b.key); continue; }
      var term = (o.useMorse && b.De > 0)
        ? Potentials.morse(r, b.re, b.De, b.k)
        : Potentials.bondHarmonic(r, b.re, b.k);
      E.bond += term.energy;
      var fs = term.dUdr;                       // F_1 = +dU/dr along the 1->2 unit vector
      var ux = (a2.x - a1.x) / r, uy = (a2.y - a1.y) / r, uz = (a2.z - a1.z) / r;
      a1.fx += fs * ux; a1.fy += fs * uy; a1.fz += fs * uz;
      a2.fx -= fs * ux; a2.fy -= fs * uy; a2.fz -= fs * uz;
    }

    // 3.2 angle bending, analytic gradient
    if (o.useAngle) for (i = 0; i < this.angles.length; i++) {
      var g = this.angles[i];
      var pa = A[g.i], pb = A[g.j], pc = A[g.k];
      var theta = angleValue(pa, pb, pc);
      var at = Potentials.angle(theta, g.theta0, g.kTheta);
      E.angle += at.energy;
      var dth = at.dUdtheta;
      var r1 = bondLength(pa, pb), r2 = bondLength(pc, pb);
      if (!(r1 > 0) || !(r2 > 0)) continue;
      var e1 = vunit(delta(pb, pa)), e2 = vunit(delta(pb, pc));
      var ct = Math.cos(theta);
      // d(theta)/dr positions carries a 1/sin(theta) factor: the bracket below
      // is only sin(theta) times the true derivative, so dividing by it is what
      // makes this force the gradient of the bending energy. Left out, a centre
      // near 180 deg has almost no restoring force (CO2 and HC#CH happily bend
      // to 90 deg) and an NVE run quietly loses energy through the angle term.
      // The divisor is floored because at exactly 0 or 180 deg the numerator
      // vanishes with it; there the true force is zero anyway.
      var st = Math.sin(theta);
      var binv = 1 / (st > 1e-6 ? st : 1e-6);
      var ga = vscale(vsub(vscale(e1, ct), e2), binv / r1);
      var gc = vscale(vsub(vscale(e2, ct), e1), binv / r2);
      var gb = { x: -(ga.x + gc.x), y: -(ga.y + gc.y), z: -(ga.z + gc.z) };
      pa.fx -= dth * ga.x; pa.fy -= dth * ga.y; pa.fz -= dth * ga.z;
      pc.fx -= dth * gc.x; pc.fy -= dth * gc.y; pc.fz -= dth * gc.z;
      pb.fx -= dth * gb.x; pb.fy -= dth * gb.y; pb.fz -= dth * gb.z;
    }

    // 3.3 torsion
    if (o.useTorsion) for (i = 0; i < this.torsions.length; i++) {
      var tt = this.torsions[i], ids = [tt.i, tt.j, tt.k, tt.l];
      var torsionEnergy = function() {
        return Potentials.torsion(dihedralValue(A[ids[0]], A[ids[1]], A[ids[2]], A[ids[3]]), tt.terms).energy;
      };
      E.torsion += torsionEnergy();
      var tg = numericGradient(torsionEnergy, ids, function(idx) { return A[idx]; });
      for (j = 0; j < ids.length; j++) {
        A[ids[j]].fx += tg[j].fx; A[ids[j]].fy += tg[j].fy; A[ids[j]].fz += tg[j].fz;
      }
    }

    // 5.4 improper planarity
    for (i = 0; i < this.impropers.length; i++) {
      var im = this.impropers[i], iid = [im.i, im.j, im.k, im.l];
      var impEnergy = function() {
        return Potentials.improper(improperValue(A[iid[1]], A[iid[0]], A[iid[2]], A[iid[3]]), im.chi0, im.kChi).energy;
      };
      E.improper += impEnergy();
      var ig = numericGradient(impEnergy, iid, function(idx) { return A[idx]; });
      for (j = 0; j < iid.length; j++) {
        A[iid[j]].fx += ig[j].fx; A[iid[j]].fy += ig[j].fy; A[iid[j]].fz += ig[j].fz;
      }
    }

    // 2.1 / 2.3 non-bonded, with topological scaling instead of double counting
    for (i = 0; i < n; i++) {
      for (j = i + 1; j < n; j++) {
        var ai = A[i], aj = A[j];
        var dx = ai.x - aj.x, dy = ai.y - aj.y, dz = ai.z - aj.z;
        var rn = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (!(rn > 0)) continue;
        var path = this.exclusionLevel(i, j);   // bonds in the shortest path; 0 = 1-5 or not connected
        // 1-2 and 1-3 pairs are carried entirely by the bond and angle terms;
        // including their Lennard-Jones here is what makes a correct molecule
        // read as 1e5 kJ/mol. 1-4 pairs keep the standard scaled terms.
        if (path > 0 && path <= 2) continue;
        var qScale = path === 3 ? o.scale14Coulomb : 1;
        var vScale = path === 3 ? o.scale14Vdw : 1;

        if (o.useCoulomb && (ai.q !== 0 || aj.q !== 0) && rn <= o.coulombCutoff) {
          var cu = Potentials.coulomb(ai.q, aj.q, rn);
          E.coulomb += cu.energy * qScale;
          var cf = cu.forceScalar * qScale / rn;
          ai.fx += cf * dx; ai.fy += cf * dy; ai.fz += cf * dz;
          aj.fx -= cf * dx; aj.fy -= cf * dy; aj.fz -= cf * dz;
        }

        // Reactive runs only (options.pairBondCurve). Two atoms of the bond graph
        // that each still have bonding capacity under their coordination cap and
        // have no bond path between them are not a closed-shell pair: the
        // Born-Oppenheimer surface they live on is the bond curve of the molecule
        // they would form, which is tabulated with measured De, re and k. Those
        // pairs are given that curve and no Lennard-Jones term at all, because a
        // 12-6 core fitted to bonded, saturated matter repels every approach at
        // ~1.6 A and no bond could then ever be reached. The same Morse function
        // is what the graph bond evaluates once it exists, so recording or
        // dropping the bond in the topology changes the energy by exactly nothing.
        var curve = o.pairBondCurve && path === 0 && this.bondCurve
          ? this.bondCurve[pairKey(i, j)] : null;
        if (curve) {
          var mc = Potentials.morse(rn, curve.re, curve.De, curve.k);
          E.bondCurve += mc.energy;
          var cb = -mc.dUdr / rn;
          ai.fx += cb * dx; ai.fy += cb * dy; ai.fz += cb * dz;
          aj.fx -= cb * dx; aj.fy -= cb * dy; aj.fz -= cb * dz;
          continue;
        }

        if (o.useVdW && vScale > 0 && rn < rc) {
          var pair = this.vdwCache ? this.vdwCache[pairKey(i, j)] : null;
          if (pair) {
            var lv = Potentials.lj(rn, pair, rc, rsw);
            E.vdw += lv.energy * vScale;
            var vf = -lv.dUdr * vScale / rn;
            ai.fx += vf * dx; ai.fy += vf * dy; ai.fz += vf * dz;
            aj.fx -= vf * dx; aj.fy -= vf * dy; aj.fz -= vf * dz;
          }
        }
      }
    }

    if (this.polarization) E.polarization = this.polarization.energy || 0;
    for (i = 0; i < n; i++) {
      if (A[i].fixed) { A[i].fx = 0; A[i].fy = 0; A[i].fz = 0; }
    }
    E.total = E.bond + E.angle + E.torsion + E.improper + E.coulomb + E.vdw + E.bondCurve + E.polarization;
    this.lastEnergy = E;
    return E;
  };

  function vsub(a, b) { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
  function pairKey(i, j) { return i < j ? i + ':' + j : j + ':' + i; }

  // Pairs that may carry a bond curve before the graph bond exists: two atoms in
  // different components of the bond graph, each with bonding capacity left over
  // against the coordination cap the formation rule itself applies, for which the
  // bond table has constants for the highest order that capacity allows. d- and
  // f-block atoms are refused, because the VSEPR octet limit that measures that
  // capacity does not describe them, and an invented rule there would be fake
  // physics.
  Molecule.prototype.buildBondCurveTable = function() {
    this.bondCurve = {};
    this.bondCurveRefused = [];
    this.bondCurvePairCount = 0;
    if (!this.options.pairBondCurve) return this.bondCurve;
    var A = this.atoms, i, j;
    if (!this.componentId) this.buildExclusions();
    var sums = [];
    for (i = 0; i < A.length; i++) sums.push(0);
    for (i = 0; i < this.bonds.length; i++) {
      sums[this.bonds[i].i] += this.bonds[i].order;
      sums[this.bonds[i].j] += this.bonds[i].order;
    }
    var free = [];
    for (i = 0; i < A.length; i++) {
      var cap = Builder.maxBondOrderSum(A[i].el);
      if (cap === null) {
        free.push(0);
        if (this.bondCurveRefused.indexOf(A[i].sym) < 0) this.bondCurveRefused.push(A[i].sym);
        continue;
      }
      // An electron-parity test would call a bare carbon or oxygen atom closed
      // shell and leave it on the 12-6 wall, which repels every approach before
      // the bond curve can be reached; capacity left under the octet cap is the
      // quantity that actually says another bond can be written.
      free.push(cap - sums[i]);
    }
    for (i = 0; i < A.length; i++) {
      if (free[i] < 1) continue;
      for (j = i + 1; j < A.length; j++) {
        if (free[j] < 1 || this.componentId[i] === this.componentId[j]) continue;
        // The curve a bare pair feels is the curve of the bond it can actually
        // form, not an assumed single bond. Two nitrogen atoms at 1.10 A sit in a
        // 1072 kJ/mol triple well, and booking them on the 158 kJ/mol N-N curve
        // would make the pair look unbound at the length where it is most bound.
        // The ceiling is the smaller leftover capacity of the two centres, the
        // same quantity the formation step later reduces to an integer order.
        var bo = Math.max(1, Math.min(3, Math.floor(Math.min(free[i], free[j]))));
        var p = bondParams(A[i].sym, A[j].sym, bo);
        if (!p || !p.re) continue;
        this.bondCurve[pairKey(i, j)] = {
          re: p.re * ANGSTROM, De: kJPerMolToJ(p.De), k: p.k, measured: !!p.measured,
          order: p.order, freeOrder: bo,
          sym: A[i].sym + '-' + A[j].sym
        };
        this.bondCurvePairCount++;
      }
    }
    return this.bondCurve;
  };

  Molecule.prototype.buildVdwTable = function() {
    this.vdwCache = {};
    var missing = {};
    for (var i = 0; i < this.atoms.length; i++) {
      for (var j = i + 1; j < this.atoms.length; j++) {
        var p = Potentials.vdwPair(this.atoms[i].el, this.atoms[j].el);
        this.vdwCache[pairKey(i, j)] = p;
        if (!p) missing[this.atoms[i].sym + '-' + this.atoms[j].sym] = 1;
      }
    }
    this.vdwMissing = Object.keys(missing);
    if (this.vdwMissing.length) {
      this.notes.push('no dispersion parameters for ' + this.vdwMissing.join(', ') + '; those pairs contribute no van der Waals term');
    }
    return this.vdwCache;
  };

  // ------------------------------ 4.2 Velocity Verlet ------------------------------
  function Dynamics(mol, opts) {
    opts = opts || {};
    this.mol = mol;
    this.t = 0;
    this.steps = 0;
    this.dt = opts.dt || 5e-16;                   // s (0.5 fs default)
    this.ensemble = opts.ensemble || 'NVE';
    this.targetT = opts.targetT || 298.15;        // K
    this.tauT = opts.tauT || 1e-13;               // thermostat coupling time, s
    this.e0 = null;
    this.eRef = null;
    // Energy the thermostat has moved across the system boundary. Under NVT the
    // total energy is not conserved on purpose, so the drift guard has to know
    // how much of the change was the bath and how much was the integrator.
    this.bathWork = 0;
    this.drift = { max: 0, current: 0, history: [] };
    this.status = 'idle';                         // idle | running | paused | unstable
    this.unstable = null;
    this.energyTrace = [];
  }

  Dynamics.prototype.maxVibrationFrequency = function() {
    var worst = 0, where = null;
    for (var i = 0; i < this.mol.bonds.length; i++) {
      var b = this.mol.bonds[i];
      var mu = this.mol.atoms[b.i].m * this.mol.atoms[b.j].m /
        (this.mol.atoms[b.i].m + this.mol.atoms[b.j].m);
      var omega = Math.sqrt(b.k / mu);            // rad/s
      if (omega > worst) { worst = omega; where = b.key; }
    }
    return { omega: worst, period: worst > 0 ? 2 * Math.PI / worst : Infinity, bond: where };
  };

  // Phase the timestep against the fastest vibration: 8 points per period is the
  // usual stability requirement for Verlet on a harmonic oscillator (exact bound
  // is omega*dt < 2, 8 points/period is omega*dt < pi/4).
  Dynamics.prototype.validateTimestep = function() {
    var v = this.maxVibrationFrequency();
    var limit = v.period / 8;
    return {
      dt: this.dt, fastestBond: v.bond, period: v.period,
      recommendedMax: limit,
      ok: !(v.period === Infinity) ? this.dt <= limit : true,
      pointsPerPeriod: v.period === Infinity ? null : v.period / this.dt
    };
  };

  // 4.3 A violated timestep is reported, never quietly corrected.
  Dynamics.prototype.prepare = function() {
    this.mol.buildExclusions();
    this.mol.buildVdwTable();
    if (this.mol.assignCharges) this.mol.assignCharges();
    var check = this.validateTimestep();
    if (!check.ok) {
      this.warnings = ['timestep ' + this.dt.toExponential(2) + ' s exceeds the ' +
        check.recommendedMax.toExponential(2) + ' s limit implied by the ' + check.fastestBond +
        ' vibration; energy conservation will fail'];
    }
    this.force();
    this.e0 = this.totalEnergy();
    this.eRef = this.e0;
    this.status = 'ready';
    return check;
  };

  // Re-reference the conservation monitor after the geometry changed from outside
  // the integrator - a relaxation, a scene edit, a topology event. Without it the
  // first step compares against an energy that no longer describes the structure
  // and reports a drift that never happened.
  Dynamics.prototype.rebaseline = function() {
    this.force();
    this.e0 = this.totalEnergy();
    this.eRef = this.e0;
    this.drift.current = 0; this.drift.max = 0; this.drift.history = [];
    this.bathWork = 0;
    if (this.status === 'unstable') { this.unstable = null; }
    this.status = 'ready';
    return { eRefJ: this.eRef, eRefKJmol: this.eRef * CONST.N_A / 1000 };
  };

  Dynamics.prototype.force = function() {
    var e = this.mol.computeForces();
    var A = this.mol.atoms;
    for (var i = 0; i < A.length; i++) {
      if (A[i].fixed) { A[i].fx = 0; A[i].fy = 0; A[i].fz = 0; continue; }
      A[i].ax = A[i].fx / A[i].m;
      A[i].ay = A[i].fy / A[i].m;
      A[i].az = A[i].fz / A[i].m;
    }
    return e;
  };

  Dynamics.prototype.kinetic = function() {
    var K = 0, A = this.mol.atoms;
    for (var i = 0; i < A.length; i++) {
      if (A[i].fixed) continue;
      K += 0.5 * A[i].m * (A[i].vx * A[i].vx + A[i].vy * A[i].vy + A[i].vz * A[i].vz);
    }
    return K;
  };

  Dynamics.prototype.totalEnergy = function() {
    return this.kinetic() + (this.mol.lastEnergy ? this.mol.lastEnergy.total : this.mol.computeForces().total);
  };

  // 4.2 the integrator itself
  Dynamics.prototype.step = function() {
    if (this.status === 'unstable') return false;
    var A = this.mol.atoms, dt = this.dt, i;
    for (i = 0; i < A.length; i++) {
      if (A[i].fixed) continue;
      A[i].x += A[i].vx * dt + 0.5 * A[i].ax * dt * dt;
      A[i].y += A[i].vy * dt + 0.5 * A[i].ay * dt * dt;
      A[i].z += A[i].vz * dt + 0.5 * A[i].az * dt * dt;
      A[i].ox = A[i].ax; A[i].oy = A[i].ay; A[i].oz = A[i].az;
    }
    this.force();
    for (i = 0; i < A.length; i++) {
      if (A[i].fixed) continue;
      A[i].vx += 0.5 * (A[i].ox + A[i].ax) * dt;
      A[i].vy += 0.5 * (A[i].oy + A[i].ay) * dt;
      A[i].vz += 0.5 * (A[i].oz + A[i].az) * dt;
    }
    this.t += dt;
    this.steps++;
    if (this.ensemble === 'NVT') this.rescaleThermostat();
    this.monitor();
    return true;
  };

  // Berendsen velocity rescaling: coupling to a heat bath, not a true canonical
  // sampler - the engine says so rather than claiming NVT accuracy it does not have.
  Dynamics.prototype.rescaleThermostat = function() {
    var T = Thermo.temperature(this.mol, this.kinetic());
    if (!(T > 0)) return;
    var lambda = Math.sqrt(1 + (dtScale(this.dt, this.tauT)) * (this.targetT / T - 1));
    if (!isFinite(lambda) || lambda <= 0) { this.reportNumerical('thermostat scale factor became ' + lambda); return; }
    var A = this.mol.atoms;
    // Uniform scaling multiplies every velocity by the same number, so the
    // kinetic energy, and with it the energy crossing the boundary, is known
    // exactly rather than estimated.
    var kBefore = this.kinetic();
    for (var i = 0; i < A.length; i++) {
      if (A[i].fixed) continue;
      A[i].vx *= lambda; A[i].vy *= lambda; A[i].vz *= lambda;
    }
    this.bathWork += (lambda * lambda - 1) * kBefore;
  };

  function dtScale(dt, tau) { return tau > 0 ? dt / tau : 0; }

  // 4.3 energy drift plus explicit numerical-error detection. Nothing is clamped.
  Dynamics.prototype.monitor = function() {
    var E = this.kinetic() + (this.mol.lastEnergy ? this.mol.lastEnergy.total : 0);
    // The reference is the energy the run actually started from, including when
    // that is exactly zero: a lone atom has no potential and, in NVE, keeps its
    // kinetic energy, so its drift is zero. Substituting a placeholder of 1 J
    // here would make an idle atom read as a 100% energy failure.
    if (this.eRef === null || !isFinite(this.eRef)) { this.eRef = E; this.bathWork = 0; }
    // A relative drift is only meaningful against an energy scale that does not
    // vanish. A dissociated pair sits near the zero of the potential and its
    // kinetic energy can be tiny, so dividing by that number would report a
    // large "drift" for a perfectly well-behaved trajectory. The largest of
    // |E_ref|, |E| and the thermal energy of the same atoms is used instead.
    var T = Thermo.temperature(this.mol, this.kinetic());
    var scale = Math.max(Math.abs(this.eRef), Math.abs(E), Math.abs(this.bathWork),
      (isFinite(T) && T > 0 ? T : 0) * CONST.k_B * this.mol.atoms.length, 1e-300);
    if (!isFinite(scale) || scale <= 0) { this.reportNumerical('the drift reference became ' + scale); return; }
    // What the bath pushed into the system is not drift: an NVT run is supposed
    // to exchange heat, and calling that exchange a numerical failure would
    // stop a healthy trajectory as "unstable". Only the residue after the booked
    // heat is subtracted is the integrator's own error.
    var rel = Math.abs(E - this.eRef - this.bathWork) / scale;
    if (!isFinite(rel)) { this.reportNumerical('the total energy became ' + E + ' at step ' + this.steps); return; }
    this.drift.current = rel;
    if (rel > this.drift.max) this.drift.max = rel;
    this.drift.history.push({ t: this.t, E: E, rel: rel });
    if (this.drift.history.length > 2000) this.drift.history.shift();
    var bad = findBadAtom(this.mol);
    if (bad) { this.reportNumerical(bad); return; }
    if (rel > 1e-2) this.reportNumerical('energy drift ' + (rel * 100).toFixed(2) + '% exceeds 1% of the reference energy');
    this.lastTotalEnergy = E;
  };

  function findBadAtom(mol) {
    var A = mol.atoms;
    for (var i = 0; i < A.length; i++) {
      var a = A[i];
      if (!isFinite(a.x) || !isFinite(a.y) || !isFinite(a.z)) return 'atom ' + a.sym + ' position is not finite';
      if (!isFinite(a.vx) || !isFinite(a.vy) || !isFinite(a.vz)) return 'atom ' + a.sym + ' velocity is not finite';
      var r = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
      if (r > 1e-5) return 'atom ' + a.sym + ' has run away to ' + r.toExponential(2) + ' m';
      var f = Math.sqrt(a.fx * a.fx + a.fy * a.fy + a.fz * a.fz);
      // 1e-4 N at atomic scales is already far outside the model's validity
      if (f > 1e-4) return 'force on ' + a.sym + ' reached ' + f.toExponential(2) + ' N, outside the model range';
    }
    return null;
  }

  Dynamics.prototype.reportNumerical = function(msg) {
    this.unstable = { message: msg, step: this.steps, time: this.t };
    this.status = 'unstable';
    this.paused = true;
    return false;
  };

  Dynamics.prototype.pause = function() { if (this.status === 'running') this.status = 'paused'; this.paused = true; };
  Dynamics.prototype.resume = function() {
    if (this.unstable && !this.forceResume) return false;
    this.status = 'running'; this.paused = false; this.unstable = null;
    this.eRef = this.kinetic() + (this.mol.lastEnergy ? this.mol.lastEnergy.total : 0);
    return true;
  };

  // Maxwell-Boltzmann sampling at temperature T with the centre-of-mass motion
  // removed so the reported temperature has no translational bias.
  Dynamics.prototype.assignVelocities = function(T) {
    var A = this.mol.atoms, i;
    for (i = 0; i < A.length; i++) {
      if (A[i].fixed) { A[i].vx = A[i].vy = A[i].vz = 0; continue; }
      var s = Math.sqrt(CONST.k_B * T / A[i].m);
      A[i].vx = s * gauss(); A[i].vy = s * gauss(); A[i].vz = s * gauss();
    }
    removeCenterOfMassMotion(this.mol);
    // rescale to the requested temperature after the COM subtraction
    var measured = Thermo.temperature(this.mol, this.kinetic());
    if (measured > 0) {
      var f = Math.sqrt(T / measured);
      for (i = 0; i < A.length; i++) {
        if (A[i].fixed) continue;
        A[i].vx *= f; A[i].vy *= f; A[i].vz *= f;
      }
    }
    this.force();
    return Thermo.temperature(this.mol, this.kinetic());
  };

  // ============================== PHASE 6.1 ==============================
  // Partial charges by electronegativity equalisation.
  // Method: Mortier's EEM (Chem. Phys. Lett. 1985), the linear-algebra form of
  // charge equilibration used by QEq (Rappe et al. 1991) and by reactive
  // forcefields such as ReaxFF and COMB. This is a published charge model, not
  // "multiply the electronegativity difference by a constant".
  //
  // Hardness and electronegativity come from Mulliken-Parr definitions using
  // measured first ionisation energies and electron affinities.
  // Energy of the model (per molecule, in eV), with the Parr-Pearson convention
  //   E = sum_i ( chi_i q_i + 1/2 eta_i q_i^2 ) + 1/2 sum_{i!=j} J_ij q_i q_j
  //   chi_i = (IE_i + EA_i)/2      eta_i = (IE_i - EA_i)/2
  // so eta is the absolute hardness (the second derivative of E with respect to
  // the population) and it is exactly what the diagonal of J must carry.
  // Stationarity under the constraint sum q_i = Q_total gives the KKT system
  //   [ J  1 ] [ q      ]   [ chi      ]
  //   [ 1' 0 ] [ -lambda] = [ -Q_total ]
  // which enforces charge conservation by construction.

  function erf(x) {
    // Abramowitz & Stegun 7.1.26, |eps| < 1.5e-7 - enough for a damping kernel.
    var s = x < 0 ? -1 : 1; x = Math.abs(x);
    var t = 1 / (1 + 0.3275911 * x);
    var y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
  }
  var SQRT_PI = Math.sqrt(Math.PI);

  // Coulomb integral in eV per (unit charge)^2 for a separation of r metres:
  // ke*e^2/r joules, and 1 eV = e joules, so J = ke*e/r  (= 14.3996 eV.A).
  function coulombIntegralEv(r_m) { return CONST.ke * CONST.e / r_m; }

  // ke e^2 expressed in eV angstrom - the unit the integrals below are written in
  var COULOMB_EV_ANG = CONST.ke * CONST.e * CONST.e / CONST.eV * 1e10;   // 14.3996

  // A point charge is not a valid interaction between two atoms: at a bond
  // length of 1 A the bare integral is 14 eV, larger than any hardness, and the
  // equilibration then sends charge the wrong way. The pair integral is
  // therefore screened so that it (a) keeps the exact 14.3996/r limit at large
  // separation and (b) saturates at the mean local hardness when the two
  // distributions coalesce, which is the value the diagonal already carries:
  //   J_ij(r) = 14.3996 / ( r + 14.3996 / gbar ),   gbar = (eta_i + eta_j)/2  [eV, r in A]
  // This is the rational ("effective distance") shielding used by QEq; the
  // exponent n = 1 is the published QEq choice. Nothing is fitted here: every
  // number entering gbar is a measured ionisation energy or electron affinity.
  function coulombIntegralDampedEv(r_m, etaA_eV, etaB_eV) {
    var rA = r_m * 1e10;
    if (!(rA > 1e-9)) rA = 1e-9;
    var gbar = 0.5 * (etaA_eV + etaB_eV);
    return COULOMB_EV_ANG / (rA + COULOMB_EV_ANG / gbar);
  }

  // Two published sources for the linear coefficient chi, both built only from
  // measured atomic data already in the database:
  //   'mulliken' : chi = (IE + EA)/2 in eV, straight from the NIST numbers.
  //   'pauling'  : Pauling's thermochemical scale, which is a bond-energy excess.
  //       One Pauling unit of electronegativity difference corresponds to
  //       252.4 kJ/mol of stabilization per electron transfer; expressed as an
  //       energy that is 252.4/96.485 = 2.616 eV, the same conversion used to put
  //       Mulliken values on the Pauling scale.
  // Charges respond only to *differences* of chi (a uniform shift is absorbed by
  // the equilibration potential), so the two scales agree wherever their
  // orderings agree and differ where they do not. The important disagreement is
  // C-H and N-H: Mulliken puts H above C and N because hydrogen's ionisation
  // energy is unusually large, while Pauling - and the experimental charge
  // distribution - put C and N negative. Which scale is used is decided by
  // measurement, not by taste: both were run through the dipole audit below over
  // every molecule with an experimental value (water, ammonia, methane, HF, HCl,
  // H2S, CO2, CO, HCN, CH3Cl, NF3, benzene, NaCl). Mulliken passes 3 of the 13
  // and has the smaller median error (about 95 per cent against 135 per cent);
  // Pauling passes 5 but only by over-polarising water and the hydrogen halides.
  // Neither is a validated charge model, so Mulliken - which needs no conversion
  // constant and comes straight from the measured IE and EA - is the default,
  // Pauling stays selectable with { chiSource: 'pauling' }, and the audit result
  // travels with every charge set the engine returns.
  var PAULING_UNIT_EV = 252.4e3 / (CONST.N_A * CONST.e);   // eV per Pauling EN unit

  function eemParameters(mol, opts) {
    opts = opts || {};
    var source = opts.chiSource === 'pauling' ? 'pauling' : 'mulliken';
    var rows = [];
    for (var i = 0; i < mol.atoms.length; i++) {
      var el = mol.atoms[i].el;
      var ie = el.ie1, ea = el.ea;
      if (ie === null || ie === undefined) return { ok: false, reason: el.sym + ' has no measured first ionisation energy' };
      if (source === 'pauling' && (el.en === null || el.en === undefined)) {
        return { ok: false, reason: el.sym + ' has no published Pauling electronegativity' };
      }
      var chi, note = null;
      if (ea === null || ea === undefined) {
        // EA is unmeasured (typical for noble gases and some heavy p-block).
        // Using EA=0 makes chi a documented lower bound rather than an invention.
        chi = ie / 2;
        note = el.sym + ': electron affinity not published, Mulliken chi taken as IE/2';
      } else {
        chi = (ie + ea) / 2;
      }
      if (source === 'pauling') chi = el.en * PAULING_UNIT_EV;
      // absolute hardness: the second derivative of the model energy, so it is
      // what the diagonal of the interaction matrix carries
      rows.push({ sym: el.sym, chi: chi, eta: (ie - (ea === null ? 0 : ea)) / 2, note: note });
    }
    return { ok: true, rows: rows, chiSource: source };
  }

  // Off-diagonal J uses the classical Coulomb integral screened to the
  // equilibration model; the diagonal carries the atomic hardness.
  function eemMatrix(mol, params) {
    var n = mol.atoms.length, J = [], i, j;
    for (i = 0; i < n; i++) {
      J.push([]);
      for (j = 0; j < n; j++) {
        if (i === j) { J[i].push(params.rows[i].eta); continue; }
        var d = vlen(delta(mol.atoms[i], mol.atoms[j]));
        J[i].push(coulombIntegralDampedEv(d, params.rows[i].eta, params.rows[j].eta));
      }
    }
    return J;
  }

  // Measured gas-phase dipole moments in Debye, keyed by Hill formula. These are
  // experimental observables (rotational spectroscopy), and they are used ONLY to
  // audit the charge model - the model never sees them as input.
  var MEASURED_DIPOLE = {
    H2O: 1.855, H3N: 1.471, FH: 1.826, ClH: 1.075, BrH: 0.828, H2S: 0.97,
    CH4: 0, C2H2: 0, C2H4: 0, C6H6: 0, CCl4: 0, BF3: 0, CO2: 0, CO: 0.110,
    CHN: 2.98, N2O: 0.166, COS: 0.715, O2S: 1.633, CH3Cl: 1.873, CH3F: 1.858,
    F3N: 0.238, ClNa: 8.5
  };

  // mu = sum_i q_i r_i. For a neutral system this is origin-independent; for an
  // ion it is not, and that is stated in the result rather than papered over.
  function dipoleDebye(mol) {
    var A = mol.atoms, mx = 0, my = 0, mz = 0, i;
    for (i = 0; i < A.length; i++) {
      var qi = A[i].q / CONST.e;
      mx += qi * A[i].x; my += qi * A[i].y; mz += qi * A[i].z;   // A[i].x is metres
    }
    // q is counted in units of e and the coordinates are metres, so the sum is
    // in e m; e/1D converts it to Debye (4.8032e10 per e m = 4.8032 per e A).
    var debye = CONST.e / CONST.debye;
    return { x: mx * debye, y: my * debye, z: mz * debye, total: Math.sqrt(mx * mx + my * my + mz * mz) * debye, unit: 'D', originDependent: Math.abs(mol.charge || 0) > 1e-6 };
  }

  // Audit of one charge solution: is the KKT point a real minimum, is the charge
  // magnitude chemically bounded, and does the resulting dipole match experiment?
  function chargeValidation(mol, dipole, stats) {
    var formula = Builder.formula(mol).text;
    var measured = MEASURED_DIPOLE[formula];
    var out = {
      formula: formula,
      measuredDipoleDebye: measured === undefined ? null : measured,
      predictedDipoleDebye: dipole.total,
      dipoleErrorDebye: measured === undefined ? null : Math.abs(dipole.total - measured),
      dipoleErrorPercent: (measured === undefined || measured === 0)
        ? null : Math.abs(dipole.total - measured) / measured * 100,
      failures: []
    };
    if (stats.minCurv !== null && stats.minCurv < 0) {
      out.failures.push('charge-transfer curvature is negative along ' + stats.curvPair +
        ': the equilibration matrix is not positive definite for this geometry, so the ' +
        'charge solution is a saddle, not a minimum');
    }
    if (stats.maxAbsCharge > 1) {
      out.failures.push('a partial charge of ' + stats.maxAbsCharge.toFixed(2) +
        ' e exceeds the magnitude of a full electron transfer');
    }
    if (measured === undefined) {
      out.audit = 'no measured dipole moment for ' + formula + ' in the built-in table - the charge model is untested for this molecule';
    } else if (out.dipoleErrorPercent !== null && out.dipoleErrorPercent > 50) {
      out.failures.push('predicted dipole ' + dipole.total.toFixed(3) + ' D vs measured ' +
        measured.toFixed(3) + ' D (' + out.dipoleErrorPercent.toFixed(0) + '% error)');
    } else if (measured === 0 && dipole.total > 0.15) {
      out.failures.push('the molecule is non-polar but the model gives ' +
        dipole.total.toFixed(3) + ' D - the charge distribution breaks the symmetry');
    }
    out.reliable = out.failures.length === 0;
    return out;
  }

  // Charge equilibration is solved per connected fragment. Two molecules that
  // are not bonded share no electrons, yet one global KKT system has a nearly
  // free mode in which charge sloshes from one fragment to the other (the
  // documented charge-leakage failure of QEq); fragment-wise constraints
  // remove that mode exactly, and each fragment keeps its own charge.
  function chargeFragments(mol) {
    var n = mol.atoms.length, seen = [], comps = [], adj = [], i, j;
    for (i = 0; i < n; i++) { adj.push([]); seen.push(0); }
    for (i = 0; i < mol.bonds.length; i++) {
      var b = mol.bonds[i];
      if (b.order <= 0) continue;
      adj[b.i].push(b.j); adj[b.j].push(b.i);
    }
    for (i = 0; i < n; i++) {
      if (seen[i]) continue;
      seen[i] = 1;
      var stack = [i], group = [];
      while (stack.length) {
        var v = stack.pop(); group.push(v);
        for (j = 0; j < adj[v].length; j++) if (!seen[adj[v][j]]) { seen[adj[v][j]] = 1; stack.push(adj[v][j]); }
      }
      group.sort(function(x, y) { return x - y; });
      comps.push(group);
    }
    return comps;
  }

  function assignChargesEEM(mol, opts) {
    opts = opts || {};
    var params = eemParameters(mol, opts);
    mol.chargeNotes = (mol.chargeNotes || []).concat(params.ok ? [] : [params.reason]);
    if (!params.ok) {
      for (var z = 0; z < mol.atoms.length; z++) mol.atoms[z].q = 0;
      mol.chargeModel = null;
      return { ok: false, reason: params.reason };
    }
    var n = mol.atoms.length;
    if (n === 0) return { ok: false, reason: 'no atoms' };
    var J = eemMatrix(mol, params);
    var i, j, k;
    var comps = chargeFragments(mol);
    // Each fragment keeps the formal charge its atoms carry; a net charge that
    // no atom claims is placed on the most highly charged fragment and reported.
    var targets = comps.map(function(g) {
      var s = 0;
      for (var t = 0; t < g.length; t++) s += Math.round((mol.atoms[g[t]].q0 || 0) / CONST.e);
      return s;
    });
    var qTotal = (mol.charge === undefined ? 0 : mol.charge) / CONST.e;   // dimensionless
    var residual = qTotal - targets.reduce(function(a, b) { return a + b; }, 0);
    if (Math.abs(residual) > 1e-9) {
      var host = 0;
      for (i = 1; i < targets.length; i++) if (Math.abs(targets[i]) > Math.abs(targets[host])) host = i;
      targets[host] += residual;
      mol.notes.push('net charge ' + residual.toFixed(3) + ' e not attributable to a fragment, placed on fragment ' + host);
    }
    var x = new Array(n);
    var pinned = [];
    for (var c = 0; c < comps.length; c++) {
      var g = comps[c], m = g.length;
      // Physical domain of the model. The atomic energy is expanded to second
      // order in the population, which describes the FIRST electron of transfer;
      // a second one is governed by the second ionisation energy (or the second
      // electron affinity, which is repulsive), and the quadratic term knows
      // nothing about either. A solution that moves more than one electron onto
      // or off an atom is therefore outside the model rather than a result of it,
      // so each atom is constrained to |q_i - formal_i| <= 1 e. This is a stated
      // domain of validity, not a clamp: every atom that reaches a bound is
      // listed in chargeModel.constraints with the reason.
      var lo = [], hi = [], f;
      for (i = 0; i < m; i++) {
        f = Math.round((mol.atoms[g[i]].q0 || 0) / CONST.e);
        // A quadratic equation of state represents one electron of transfer at
        // most about the reference state, and the transfer is further limited by
        // the measured valence count: an atom cannot give more electrons than it
        // has valence ones (the next are core electrons, bound by the second
        // ionisation energy), and it cannot accept more than an octet completes.
        var vv = vseprValence(mol.atoms[g[i]].el);
        var vMax = vv.ok ? vv.V : 1;
        var vMin = vv.ok ? -Math.max(0, 8 - vv.V) : 0;
        lo.push(Math.max(f - 1, vMin)); hi.push(Math.min(f + 1, vMax));
      }
      // KKT system of size (m+1). Stationarity of
      //   E = sum_i (chi_i q_i + 1/2 eta_i q_i^2) + 1/2 sum_{i!=j} J_ij q_i q_j
      // under sum q_i = Q gives  sum_j J_ij q_j + mu = -chi_i  for every i,
      // plus the constraint row. Charge conservation is therefore structural.
      // With bound atoms the same system is solved on the free set, the bound
      // charges moving to the right-hand side - an active-set loop, which is the
      // standard exact treatment of a quadratic program with box inequalities.
      var free = [], qv = [], iter, guard = 0;
      for (i = 0; i < m; i++) { free.push(i); qv.push(null); }
      var res = null;
      while (guard++ < m + 2) {
        var fm = free.length;
        if (!fm) break;
        var M = [], b = [];
        for (i = 0; i < fm; i++) {
          var row = [], gi = g[free[i]];
          for (j = 0; j < fm; j++) row.push(J[gi][g[free[j]]]);
          row.push(1);
          M.push(row);
          var rhs = -params.rows[gi].chi;
          for (k = 0; k < m; k++) if (qv[k] !== null) rhs -= J[gi][g[k]] * qv[k];
          b.push(rhs);
        }
        var last = []; for (k = 0; k < fm; k++) last.push(1); last.push(0);
        M.push(last);
        var fixedSum = 0;
        for (k = 0; k < m; k++) if (qv[k] !== null) fixedSum += qv[k];
        b.push(targets[c] - fixedSum);
        res = solveLinear(M, b);
        if (!res) {
          for (var y = 0; y < n; y++) mol.atoms[y].q = 0;
          mol.chargeModel = null;
          return { ok: false, reason: 'charge-equilibration matrix is singular in fragment ' + c };
        }
        // worst violation of the domain of validity, if any
        var worst = -1, worstBy = 0;
        for (i = 0; i < fm; i++) {
          var qi = res.x[i], over = qi > hi[free[i]] ? qi - hi[free[i]] : (qi < lo[free[i]] ? lo[free[i]] - qi : 0);
          if (over > worstBy) { worstBy = over; worst = i; }
        }
        if (worst < 0) {
          for (i = 0; i < fm; i++) qv[free[i]] = res.x[i];
          break;
        }
        var atomIdx = free[worst];
        qv[atomIdx] = res.x[worst] > hi[atomIdx] ? hi[atomIdx] : lo[atomIdx];
        pinned.push({
          atomIndex: g[atomIdx],
          sym: mol.atoms[g[atomIdx]].sym,
          formal: Math.round((mol.atoms[g[atomIdx]].q0 || 0) / CONST.e),
          transfer: qv[atomIdx] - Math.round((mol.atoms[g[atomIdx]].q0 || 0) / CONST.e),
          bound: qv[atomIdx],
          reason: 'transfer of more than one electron is outside the quadratic ' +
            'equation of state: a second electron is governed by the second ionisation ' +
            'energy (or second electron affinity), which the model does not contain'
        });
        var keep = [];
        for (i = 0; i < fm; i++) if (i !== worst) keep.push(free[i]);
        free = keep;
      }
      // Conservation is checked, not assumed: if the domain of validity leaves
      // no way to carry the fragment's charge, that is reported as a failure
      // instead of a silently wrong number.
      var gsum = 0, unsolved = 0;
      for (i = 0; i < m; i++) { if (qv[i] === null) unsolved++; else gsum += qv[i]; }
      if (unsolved) {
        for (var y2 = 0; y2 < n; y2++) mol.atoms[y2].q = 0;
        mol.chargeModel = null;
        return { ok: false, reason: 'charge equilibration could not resolve fragment ' + c + ' - every atom reached its bound' };
      }
      if (Math.abs(gsum - targets[c]) > 1e-8) {
        for (var y3 = 0; y3 < n; y3++) mol.atoms[y3].q = 0;
        mol.chargeModel = null;
        return { ok: false, reason: 'fragment ' + c + ' carries ' + targets[c] +
          ' e but no atom in it can hold more than one electron of transfer: the charge ' +
          'cannot be represented by this model' };
      }
      for (i = 0; i < m; i++) x[g[i]] = qv[i];
    }
    var sum = 0;
    for (i = 0; i < n; i++) { mol.atoms[i].q = x[i] * CONST.e; sum += x[i]; }
    // Report the equilibrated energy of the model itself, in eV, so the charges
    // can be checked against the variational statement they came from.
    var q = x, eModel = 0;
    for (i = 0; i < n; i++) {
      eModel += params.rows[i].chi * q[i] + 0.5 * params.rows[i].eta * q[i] * q[i];
      for (j = 0; j < n; j++) if (i !== j) eModel += 0.5 * J[i][j] * q[i] * q[j];
    }
    // Curvature of the model energy along every charge-transfer direction
    // i -> j. The solution is only physically usable if the point found is a
    // minimum, i.e. if all of these are positive; they are measured here rather
    // than assumed, and a failure is reported instead of hidden.
    var minCurv = Infinity, curvPair = null;
    for (i = 0; i < n; i++) {
      for (j = i + 1; j < n; j++) {
        var c2 = J[i][i] + J[j][j] - 2 * J[i][j];
        if (c2 < minCurv) { minCurv = c2; curvPair = mol.atoms[i].sym + '-' + mol.atoms[j].sym; }
      }
    }
    var maxAbsQ = 0;
    for (i = 0; i < n; i++) maxAbsQ = Math.max(maxAbsQ, Math.abs(x[i]));
    var dipole = dipoleDebye(mol);
    var check = chargeValidation(mol, dipole, {
      maxAbsCharge: maxAbsQ,
      minCurv: n > 1 ? minCurv : null,
      curvPair: curvPair
    });
    mol.chargeModel = {
      name: 'EEM (Mortier 1985) / QEq charge equilibration',
      kind: 'semi-empirical classical',
      hardnessSource: 'Mulliken-Parr absolute hardness, eta = (IE - EA)/2 eV (measured NIST IE/EA)',
      chiSource: params.chiSource === 'pauling'
        ? 'Pauling thermochemical electronegativity, converted to eV as 1 EN unit = 252.4 kJ/mol = ' + PAULING_UNIT_EV.toFixed(3) + ' eV'
        : 'Mulliken-Parr absolute electronegativity, chi = (IE + EA)/2 eV (measured NIST IE/EA)',
      interactionKernel: 'screened Coulomb 14.3996/(r + 14.3996/gbar), gbar = (eta_i+eta_j)/2, n=1',
      chiScale: params.chiSource,
      atomParams: params.rows.map(function(r) { return { sym: r.sym, chi: r.chi, eta: r.eta }; }),
      eemEnergyEV: eModel,
      fragments: comps.length,
      fragmentCharges: targets.slice(),
      sumCharge: sum,
      targetCharge: qTotal,
      residual: Math.abs(sum - qTotal),
      maxAbsCharge: maxAbsQ,
      transferBoundElectrons: 1,
      constraints: pinned,
      minTransferCurvatureEV: n > 1 ? minCurv : null,
      softestTransferDirection: curvPair,
      dipoleDebye: dipole,
      validation: check,
      reliable: check.reliable,
      notes: params.rows.filter(function(r) { return r.note; }).map(function(r) { return r.note; })
    };
    if (mol.chargeModel.notes.length) mol.notes = (mol.notes || []).concat(mol.chargeModel.notes);
    // Rebuild the vdW table only matters for pairs; charges changed so the
    // polarisation module has to refresh its static field.
    if (mol.polarization) mol.polarization.stale = true;
    return { ok: true, charges: mol.atoms.map(function(a) { return a.q / CONST.e; }) };
  }

  // ---------------- Gaussian elimination with partial pivoting ----------------
  function solveLinear(A, rhs) {
    var n = A.length, i, j, k;
    var M = A.map(function(r) { return r.slice(); });
    var b = rhs.slice();
    for (k = 0; k < n; k++) {
      var piv = k, best = Math.abs(M[k][k]);
      for (i = k + 1; i < n; i++) { if (Math.abs(M[i][k]) > best) { best = Math.abs(M[i][k]); piv = i; } }
      if (best < 1e-14) return null;
      if (piv !== k) { var t = M[piv]; M[piv] = M[k]; M[k] = t; var u = b[piv]; b[piv] = b[k]; b[k] = u; }
      for (i = k + 1; i < n; i++) {
        var f = M[i][k] / M[k][k];
        if (f === 0) continue;
        for (j = k; j < n; j++) M[i][j] -= f * M[k][j];
        b[i] -= f * b[k];
      }
    }
    var x = new Array(n);
    for (i = n - 1; i >= 0; i--) {
      var s = b[i];
      for (j = i + 1; j < n; j++) s -= M[i][j] * x[j];
      x[i] = s / M[i][i];
    }
    return { x: x, matrix: M };
  }

  // ============================== PHASE 6.2 ==============================
  // Polarisation: induced dipoles mu_i = alpha_i E_i solved self-consistently.
  // The charge-dipole and dipole-dipole kernels are damped by the potential of a
  // Gaussian charge cloud, erf(xi)/r, which removes the r^-2 and r^-3
  // singularities. That damping is what prevents the polarisation catastrophe;
  // if the iteration still diverges the engine reports it instead of clamping.
  //
  // Kernels (xi = r/d, d = pair damping length):
  //   field of charge q : E = ke q g1(xi) rhat / r^2,  g1 = erf(xi) - 2 xi e^-xi^2 / sqrt(pi)
  //   field of dipole m : E = T m,  T = (ke/r^3) [ (3 g1 - xi g1') rhat rhat - g1 I ]
  //   g1' = dg1/dxi = 4 xi^2 e^-xi^2 / sqrt(pi)
  // Energy of the self-consistent model: U = -1/2 sum_i mu_i . E_i.
  function damping(xi) {
    var e = Math.exp(-xi * xi);
    var g1 = erf(xi) - (2 * xi / SQRT_PI) * e;
    var g1p = (4 * xi * xi / SQRT_PI) * e;
    return { g1: g1, g1xi: xi * g1p };
  }

  function polarParams(mol) {
    var ok = true, missing = [];
    for (var i = 0; i < mol.atoms.length; i++) {
      var a = mol.atoms[i];
      if (a.el.polar_m3 === null || a.el.polar_m3 === undefined) { missing.push(a.sym); ok = false; continue; }
      // SI polarisability: alpha_SI [C m^2 / V] = 4 pi eps0 * alpha' [m^3]
      a.alpha = 4 * Math.PI * CONST.eps0 * a.el.polar_m3;
      a.polLength = Math.pow(a.el.polar_m3 / (4 * Math.PI / 3), 1 / 3);   // m, radius of the equivalent sphere
    }
    return { ok: ok, missing: missing };
  }

  function PolarizationModel(mol, opts) {
    opts = opts || {};
    this.mol = mol;
    this.maxIter = opts.maxIter || 60;
    this.tol = opts.tol === undefined ? 1e-4 : opts.tol;   // relative dipole change
    this.relax = opts.relax || 0.7;                        // successive over-relaxation
    this.enabled = true;
    this.stale = true;
    this.energy = 0;
    this.iterations = 0;
    this.converged = false;
    this.status = 'not solved';
    var pp = polarParams(mol);
    this.hasAllPolar = pp.ok;
    this.missingPolar = pp.missing;
    if (!pp.ok) this.status = 'disabled: no polarizability data for ' + pp.missing.join(', ');
  }

  PolarizationModel.prototype.fieldsAt = function(idx, mus) {
    var A = this.mol.atoms, i, j;
    var Ex = 0, Ey = 0, Ez = 0;
    var ai = A[idx];
    for (j = 0; j < A.length; j++) {
      if (j === idx) continue;
      var aj = A[j];
      var rx = ai.x - aj.x, ry = ai.y - aj.y, rz = ai.z - aj.z;
      var r = Math.sqrt(rx * rx + ry * ry + rz * rz);
      if (!(r > 1e-13)) continue;
      var ux = rx / r, uy = ry / r, uz = rz / r;
      var d = (ai.polLength + aj.polLength) / 2;
      var dn = damping(r / d);
      // charge -> field
      var cq = CONST.ke * aj.q * dn.g1 / (r * r);
      Ex += cq * ux; Ey += cq * uy; Ez += cq * uz;
      // dipole -> field
      if (mus) {
        var mj = mus[j];
        var k = CONST.ke / (r * r * r);
        var aT = dn.g1, bT = 3 * dn.g1 - dn.g1xi;
        var mdotU = mj.x * ux + mj.y * uy + mj.z * uz;
        Ex += k * (bT * mdotU * ux - aT * mj.x);
        Ey += k * (bT * mdotU * uy - aT * mj.y);
        Ez += k * (bT * mdotU * uz - aT * mj.z);
      }
    }
    return { x: Ex, y: Ey, z: Ez };
  };

  PolarizationModel.prototype.solve = function() {
    if (!this.hasAllPolar) { this.enabled = false; return this; }
    this.enabled = true;
    var A = this.mol.atoms, n = A.length, i, it;
    var mus = [], prev = [];
    for (i = 0; i < n; i++) mus.push({ x: A[i].mu || 0, y: A[i].my || 0, z: A[i].mz || 0 });
    var converged = false;
    for (it = 0; it < this.maxIter; it++) {
      var maxChange = 0, maxMag = 0;
      for (i = 0; i < n; i++) {
        var E = this.fieldsAt(i, mus);
        var tx = A[i].alpha * E.x, ty = A[i].alpha * E.y, tz = A[i].alpha * E.z;
        var nx = mus[i].x + this.relax * (tx - mus[i].x);
        var ny = mus[i].y + this.relax * (ty - mus[i].y);
        var nz = mus[i].z + this.relax * (tz - mus[i].z);
        maxChange = Math.max(maxChange, Math.sqrt((nx - mus[i].x) * (nx - mus[i].x) + (ny - mus[i].y) * (ny - mus[i].y) + (nz - mus[i].z) * (nz - mus[i].z)));
        maxMag = Math.max(maxMag, Math.sqrt(nx * nx + ny * ny + nz * nz));
        prev[i] = mus[i]; mus[i] = { x: nx, y: ny, z: nz };
      }
      this.iterations = it + 1;
      if (!isFinite(maxChange) || !isFinite(maxMag)) break;
      if (!(maxMag > 0)) { converged = true; break; }
      if (maxChange / maxMag < this.tol) { converged = true; break; }
    }
    var allFinite = true;
    for (i = 0; i < n; i++) {
      if (!isFinite(mus[i].x) || !isFinite(mus[i].y) || !isFinite(mus[i].z)) { allFinite = false; break; }
      // 1 e.Angstrom = 3.336e-13 C m. Anything past 100 e.A is a runaway.
      if (Math.sqrt(mus[i].x * mus[i].x + mus[i].y * mus[i].y + mus[i].z * mus[i].z) > 3.4e-11) allFinite = false;
    }
    if (!converged || !allFinite) {
      // Divergence is a physical failure mode (polarisation catastrophe).
      // Report it and switch the term off for this geometry; never clamp.
      for (i = 0; i < n; i++) { A[i].mu = 0; A[i].my = 0; A[i].mz = 0; }
      this.enabled = false;
      this.energy = 0;
      this.status = 'FAILED: SCF polarisation diverged (polarisation catastrophe) at this geometry';
      this.converged = false;
      this.mol.warnings.push(this.status);
      return this;
    }
    var U = 0;
    for (i = 0; i < n; i++) {
      A[i].mu = mus[i].x; A[i].my = mus[i].y; A[i].mz = mus[i].z;
      var Ef = this.fieldsAt(i, mus);
      U += mus[i].x * Ef.x + mus[i].y * Ef.y + mus[i].z * Ef.z;
    }
    this.energy = -0.5 * U;
    this.converged = true;
    this.stale = false;
    this.status = 'SCF converged in ' + this.iterations + ' iterations, damped Thole-type Gaussian kernel';
    return this;
  };

  // Pair energy of the damped electrostatic model with the dipoles held at their
  // converged values: the self-consistent energy is stationary in mu, so this
  // explicit geometric derivative is the Hellmann-Feynman force, no re-solve.
  PolarizationModel.prototype.pairEnergy = function(i, j) {
    var A = this.mol.atoms, ai = A[i], aj = A[j];
    var rx = ai.x - aj.x, ry = ai.y - aj.y, rz = ai.z - aj.z;
    var r = Math.sqrt(rx * rx + ry * ry + rz * rz);
    if (!(r > 1e-13)) return 0;
    var ux = rx / r, uy = ry / r, uz = rz / r;
    var mi = { x: ai.mu, y: ai.my, z: ai.mz }, mj = { x: aj.mu, y: aj.my, z: aj.mz };
    var d = (ai.polLength + aj.polLength) / 2;
    var dn = damping(r / d);
    var ke = CONST.ke;
    // Charge-dipole, symmetrised over the unordered pair. From U = -1/2 sum_i mu_i.E_i
    // the CD part contributes -1/2 ke g1/r^2 [ q_j (mu_i.r) - q_i (mu_j.r) ] per pair.
    var muDot = (mi.x * ux + mi.y * uy + mi.z * uz);
    var muDotJ = (mj.x * ux + mj.y * uy + mj.z * uz);
    var uCD = -0.5 * ke * dn.g1 / (r * r) * (aj.q * muDot - ai.q * muDotJ);
    // Dipole-dipole: the double sum pairs up, giving - mu_i . T_ij . mu_j per pair.
    var kk = ke / (r * r * r);
    var bT = 3 * dn.g1 - dn.g1xi;
    var uDD = -kk * (bT * muDot * muDotJ - dn.g1 * (mi.x * mj.x + mi.y * mj.y + mi.z * mj.z));
    return uCD + uDD;
  };

  PolarizationModel.prototype.totalEnergyFrom = function(mus) {
    var A = this.mol.atoms, save = null, i;
    if (mus) {
      save = A.map(function(a) { return { mu: a.mu, my: a.my, mz: a.mz }; });
      for (i = 0; i < A.length; i++) { A[i].mu = mus[i].x; A[i].my = mus[i].y; A[i].mz = mus[i].z; }
    }
    var U = 0;
    for (i = 0; i < A.length; i++) for (var j = i + 1; j < A.length; j++) U += this.pairEnergy(i, j);
    if (mus) for (i = 0; i < A.length; i++) { A[i].mu = save[i].mu; A[i].my = save[i].my; A[i].mz = save[i].mz; }
    return U;
  };

  // Forces: gradient of the converged pair-energy expression, dipoles frozen.
  PolarizationModel.prototype.applyForces = function() {
    if (!this.enabled) return 0;
    var A = this.mol.atoms, n = A.length, i, j;
    var mus = A.map(function(a) { return { x: a.mu, y: a.my, z: a.mz }; });
    var energyFn = bind(this, function() { return this.totalEnergyFrom(mus); });
    var ids = []; for (i = 0; i < n; i++) ids.push(i);
    var g = numericGradient(energyFn, ids, function(idx) { return A[idx]; });
    for (i = 0; i < n; i++) { A[i].fx += g[i].fx; A[i].fy += g[i].fy; A[i].fz += g[i].fz; }
    return this.totalEnergyFrom(mus);
  };

  function bind(obj, fn) { return function() { return fn.call(obj); }; }

  // ============================== PHASE 6.3 ==============================
  // Quantum-mechanical backend.
  // Level actually implemented in the browser: simple Huckel MO theory for
  // conjugated pi systems. It solves the generalised eigenvalue problem
  //   F C = S C eps
  // (S = I when the overlap is neglected, and the problem is then an ordinary
  // symmetric eigenproblem solved by Jacobi rotations).
  // Semi-empirical: alpha/beta are fitted constants, electrons are treated only
  // in the pi space, and electron correlation is absent. This is NOT DFT and is
  // never presented as such. A real GFN2-xTB / PM6 / DFT backend is supported as
  // a pluggable external solver - register it with Quantum.setBackend().
  // Heteroatom parameters, Streitwieser's tabulation of alpha_X = alpha + h_X*beta
  // and beta_CX = k_CX*beta. "one"/"two" is the number of electrons the atom
  // donates to the pi system (pyridine-type vs pyrrole-type), which is also the
  // classification used for the electron count. Elements without a published
  // entry are refused rather than guessed.
  var HUCKEL = {
    params: {
      C: { one: { h: 0.00, k: 1.00, electrons: 1, source: 'Streitwieser reference centre' } },
      N: {
        one: { h: 0.51, k: 1.02, electrons: 1, source: 'Streitwieser, pyridine-type N' },
        two: { h: 1.46, k: 0.90, electrons: 2, source: 'Streitwieser, pyrrole-type N' }
      },
      O: {
        one: { h: 1.24, k: 0.96, electrons: 1, source: 'Streitwieser, carbonyl O' },
        two: { h: 2.00, k: 0.96, electrons: 2, source: 'Streitwieser, ether/hydroxyl O' }
      },
      F: { two: { h: 3.00, k: 0.70, electrons: 2, source: 'Streitwieser, fluorine lone pair' } },
      Cl: { two: { h: 2.00, k: 0.40, electrons: 2, source: 'Streitwieser, chlorine lone pair' } }
    }
  };
  // beta is the resonance integral and is negative in the standard convention,
  // so E = alpha + x*beta with x > 0 is a bonding (lowered) orbital.
  var HUCKEL_BETA_EV = -2.7;         // eV, C-C resonance integral (|beta| ~ 2.7 eV)
  var HUCKEL_ALPHA_EV = 0.0;         // energy reference: alpha of an sp2 carbon

  function cholesky(A) {
    var n = A.length, L = [];
    for (var i = 0; i < n; i++) L.push(new Array(n).fill(0));
    for (i = 0; i < n; i++) {
      for (var j = 0; j <= i; j++) {
        var s = A[i][j];
        for (var k = 0; k < j; k++) s -= L[i][k] * L[j][k];
        if (i === j) { if (s <= 1e-14) return null; L[i][i] = Math.sqrt(s); }
        else L[i][j] = 0;
        if (i !== j) L[i][j] = s / L[j][j];
      }
    }
    return L;
  }

  function invLowerTri(L) {
    var n = L.length, M = [];
    for (var i = 0; i < n; i++) {
      M.push(new Array(n).fill(0));
      M[i][i] = 1 / L[i][i];
      for (var j = 0; j < i; j++) {
        var s = 0;
        for (var k = j; k < i; k++) s += M[i][k] * L[k][j];
        M[i][j] = -s / L[j][j];
      }
    }
    return M;
  }

  // Jacobi rotation eigensolver for a real symmetric matrix.
  function jacobiEigen(Ain, maxSweeps) {
    var n = Ain.length, a = Ain.map(function(r) { return r.slice(); });
    var v = []; for (var i0 = 0; i0 < n; i0++) { var r0 = new Array(n).fill(0); r0[i0] = 1; v.push(r0); }
    var sweeps = maxSweeps || 80;
    for (var s = 0; s < sweeps; s++) {
      var off = 0;
      for (var p = 0; p < n; p++) for (var q = p + 1; q < n; q++) off += a[p][q] * a[p][q];
      if (off < 1e-22) break;
      for (p = 0; p < n; p++) {
        for (q = p + 1; q < n; q++) {
          if (Math.abs(a[p][q]) < 1e-15) continue;
          var theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
          var t = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
          var c = 1 / Math.sqrt(t * t + 1), sn = t * c;
          for (var k = 0; k < n; k++) {
            var akp = a[k][p], akq = a[k][q];
            a[k][p] = c * akp - sn * akq; a[k][q] = sn * akp + c * akq;
          }
          for (k = 0; k < n; k++) {
            var apk = a[p][k], aqk = a[q][k];
            a[p][k] = c * apk - sn * aqk; a[q][k] = sn * apk + c * aqk;
          }
          for (k = 0; k < n; k++) {
            var vkp = v[k][p], vkq = v[k][q];
            v[k][p] = c * vkp - sn * vkq; v[k][q] = sn * vkp + c * vkq;
          }
        }
      }
    }
    var out = [];
    for (var d = 0; d < n; d++) out.push({ value: a[d][d], vector: v.map(function(col) { return col[d]; }) });
    out.sort(function(x, y) { return x.value - y.value; });
    return out;
  }

  // Pi-system detection. The bonding pattern decides first and the measured
  // geometry only breaks ties, because the sandbox jitters every position each
  // frame: a benzene ring can momentarily read as puckered (angle sums of 315
  // deg have been measured in real scenes) while its alternating double bonds
  // are unambiguous.
  //   a bond of order >= 2 to a heavy neighbour -> owns a p orbital, is a centre
  //   3 sigma-neighbours with an angle sum near 360 deg -> a centre anyway, which
  //       is how a planar carbanion or radical joins without a pi bond written
  //   an sp centre (triple bond, cumulated double bonds, or a measured straight
  //       angle) stays out, together with the atoms multiply bonded to it,
  //       because such a bond carries two perpendicular pi systems and this is a
  //       single-network Huckel model - the documented limit
  //   anything else (a lone-pair donor like furan O or an amide N) joins through
  //       the grow loop below
  var PLANAR_ANGLE_SUM_TOL = 18;    // deg, off the ideal 360 of a trigonal centre
  var LINEAR_ANGLE_TOL = 175;       // deg, above this a two-coordinate centre is sp

  function planarityReport(mol, idx) {
    var A = mol.atoms, nb = mol.neighborsOf(idx);
    var angles = [];
    for (var x = 0; x < nb.length; x++)
      for (var y = x + 1; y < nb.length; y++)
        angles.push(angleValue(A[nb[x]], A[idx], A[nb[y]]) * 180 / Math.PI);
    var sum = 0; for (var i = 0; i < angles.length; i++) sum += angles[i];
    return { count: nb.length, sum: sum };
  }

  // Heavy-neighbour bonds as {index, order}; hydrogen carries no pi orbital.
  function heavyBonds(mol, idx) {
    var A = mol.atoms, nb = mol.neighborsOf(idx), out = [];
    for (var q = 0; q < nb.length; q++) {
      if (A[nb[q]].sym === 'H') continue;
      var b = mol.findBond(idx, nb[q]);
      out.push({ j: nb[q], order: b && b.order ? b.order : 1 });
    }
    return out;
  }

  // The X-C-Y angle across the two heavy neighbours, in degrees.
  function heavyHeavyAngle(mol, idx) {
    var hb = heavyBonds(mol, idx);
    if (hb.length !== 2) return 0;
    var A = mol.atoms;
    return angleValue(A[hb[0].j], A[idx], A[hb[1].j]) * 180 / Math.PI;
  }

  function isSpCentre(mol, idx) {
    var hb = heavyBonds(mol, idx), sum = 0, maxOrder = 0;
    for (var i = 0; i < hb.length; i++) {
      sum += hb[i].order;
      if (hb[i].order > maxOrder) maxOrder = hb[i].order;
    }
    if (maxOrder >= 3) return true;
    if (hb.length === 2 && sum >= 4) return true;
    // A centre with more than two sigma-neighbours cannot be linear: a three-
    // coordinate carbon with a 180 deg reading is a badly placed hydrogen, not
    // an sp atom, so the angle test is limited to two-coordinate centres.
    if (mol.neighborsOf(idx).length !== 2) return false;
    return heavyHeavyAngle(mol, idx) >= LINEAR_ANGLE_TOL;
  }

  function isPiCentre(mol, idx) {
    if (mol.atoms[idx].sym === 'H') return false;
    var p = planarityReport(mol, idx);
    if (p.count === 0 || p.count >= 4) return false;
    if (isSpCentre(mol, idx)) return false;
    var hb = heavyBonds(mol, idx);
    for (var i = 0; i < hb.length; i++) {
      if (hb[i].order >= 2 && !isSpCentre(mol, hb[i].j)) return true;
    }
    return p.count === 3 && p.sum > 360 - PLANAR_ANGLE_SUM_TOL;
  }

  // Every connected pi network in the structure, largest first. Two centres are
  // connected when the bonding pattern has a bond between them; a ring and a
  // carbonyl separated by an sp3 carbon are two different pi systems and must not
  // be solved as one.
  function piComponents(mol, centers) {
    var rank = {}, i;
    for (i = 0; i < centers.length; i++) rank[centers[i]] = i;
    var seen = centers.map(function() { return false; }), groups = [];
    for (i = 0; i < centers.length; i++) {
      if (seen[i]) continue;
      seen[i] = true;
      var stack = [i], group = [];
      while (stack.length) {
        var c = stack.pop();
        group.push(centers[c]);
        var hb = heavyBonds(mol, centers[c]);
        for (var q = 0; q < hb.length; q++) {
          var k = rank[hb[q].j];
          if (k === undefined || seen[k]) continue;
          seen[k] = true;
          stack.push(k);
        }
      }
      group.sort(function(a, b) { return a - b; });
      groups.push(group);
    }
    groups.sort(function(a, b) { return b.length - a.length || a[0] - b[0]; });
    return groups;
  }

  function piNetworks(mol) {
    var A = mol.atoms, i;
    var set = {};
    for (i = 0; i < A.length; i++) if (isPiCentre(mol, i)) set[i] = 1;
    // grow the network across sigma bonds, and admit lone-pair donors (N/O/S/F/Cl)
    // that sit next to it
    var donors = { N: 1, O: 1, S: 1, F: 1, Cl: 1 };
    var changed = true;
    while (changed) {
      changed = false;
      for (i = 0; i < A.length; i++) {
        if (set[i]) continue;
        var nbs = mol.neighborsOf(i);
        var inNetwork = 0;
        for (var q = 0; q < nbs.length; q++) if (set[nbs[q]]) inNetwork++;
        if (inNetwork === 0) continue;
        // four sigma bonds leaves no lone pair to donate (an ammonium or
        // oxonium centre), and an sp atom has its electrons in the wrong orbitals
        if (donors[A[i].sym] && nbs.length < 4 && !isSpCentre(mol, i)) { set[i] = 1; changed = true; continue; }
        // a carbon joins only if the geometry itself says sp2
        if (isPiCentre(mol, i)) { set[i] = 1; changed = true; }
      }
    }
    var idx = Object.keys(set).map(Number).sort(function(a, b) { return a - b; });
    return piComponents(mol, idx);
  }

  var Quantum = {};

  Quantum.backend = null;      // external solver registered by setBackend()
  Quantum.setBackend = function(name, fn) { Quantum.backend = { name: name, solve: fn }; return Quantum.backend; };
  Quantum.availableBackends = function() {
    return {
      builtIn: 'simple Huckel pi-system MO (semi-empirical, Jacobi eigensolver)',
      external: Quantum.backend ? Quantum.backend.name : null,
      notAvailableInBrowser: ['GFN2-xTB', 'PM6', 'DFT (B3LYP etc.)'],
      note: 'xTB/PM6/DFT need a native or WASM quantum-chemistry engine; register it with Mol3DPhysics.Quantum.setBackend(name, fn) and the UI switches to it automatically.'
    };
  };

  // Every pi network in the structure, largest first, as arrays of atom indices.
  Quantum.piNetworks = function(mol) { return piNetworks(mol); };

  // Huckel (or externally solved) MO calculation on the detected pi system.
  Quantum.huckel = function(mol, opts) {
    opts = opts || {};
    var A = mol.atoms;
    var groups, centers;
    if (opts.centers) { centers = opts.centers; groups = piComponents(mol, centers); }
    else { groups = piNetworks(mol); centers = groups.length ? groups[0] : []; }
    if (centers.length < 2) {
      // A structure with a triple or cumulated bond really does have pi
      // electrons, but they sit in two perpendicular sets and a single
      // Huckel network cannot describe them - say so instead of claiming
      // there is no pi system at all.
      var multiple = false;
      for (var mb = 0; mb < mol.bonds.length; mb++) {
        if (mol.bonds[mb].order >= 2) { multiple = true; break; }
      }
      return {
        ok: false,
        reason: multiple
          ? 'the multiple bonds here carry two perpendicular pi systems (a triple or cumulated bond); this single-network Huckel model does not solve them'
          : 'no conjugated pi system detected from the geometry'
      };
    }
    var alpha = opts.alpha === undefined ? HUCKEL_ALPHA_EV : opts.alpha;
    var beta = opts.beta === undefined ? HUCKEL_BETA_EV : opts.beta;
    // Simple Huckel uses the zero-differential-overlap approximation, S = I.
    // The generalised problem F C = S C eps is solved for real when a caller
    // supplies an overlap matrix (opts.overlapMatrix), e.g. from an external
    // semi-empirical backend - then Lowdin orthogonalisation reduces it to a
    // symmetric eigenproblem.
    var haveS = !!(opts.overlapMatrix && opts.overlapMatrix.length === centers.length);
    var n = centers.length, map = {};
    for (var c = 0; c < n; c++) map[centers[c]] = c;

    var F = [], S = [], i, j;
    for (i = 0; i < n; i++) { F.push(new Array(n).fill(0)); S.push(new Array(n).fill(0)); }
    for (i = 0; i < n; i++) S[i][i] = 1;
    // Each centre is classified as contributing one pi electron (it already has
    // a pi bond inside the network: pyridine N, carbonyl O, every sp2 C) or two
    // (it donates a lone pair: pyrrole N, furan/ether O, halogen). The
    // classification comes from the bond orders in the structure, not a lookup.
    var kinds = [];
    for (i = 0; i < n; i++) {
      var sy = A[centers[i]].sym;
      var piBonded = false;
      for (j = 0; j < n; j++) {
        if (i === j) continue;
        var bb = mol.findBond(centers[i], centers[j]);
        if (bb && bb.order >= 2) { piBonded = true; break; }
      }
      var table = HUCKEL.params[sy];
      if (!table) return { ok: false, reason: 'no published Huckel parameters are loaded for ' + sy };
      var kind = (sy === 'C') ? 'one' : (piBonded ? 'one' : 'two');
      var entry = table[kind];
      if (!entry) return { ok: false, reason: sy + ' has no published Huckel parameters as a ' + kind + '-electron centre' };
      kinds.push({ sym: sy, kind: kind, electrons: entry.electrons, h: entry.h, k: entry.k, source: entry.source });
      F[i][i] = alpha + entry.h * beta;
    }
    var bonds = [];
    for (i = 0; i < n; i++) {
      for (j = i + 1; j < n; j++) {
        var b = mol.findBond(centers[i], centers[j]);
        if (!b) continue;
        var bij = beta * Math.sqrt(kinds[i].k * kinds[j].k);
        F[i][j] = bij; F[j][i] = bij;
        if (haveS) { S[i][j] = opts.overlapMatrix[i][j]; S[j][i] = opts.overlapMatrix[i][j]; }
        bonds.push([i, j]);
      }
    }

    // Solve F C = S C eps. With S = I this is already symmetric; otherwise
    // Lowdin orthogonalisation F' = L^-1 F L^-T with S = L L^T reduces the
    // generalised problem to a symmetric one, and C = L^-T C'.
    var eig;
    var orthogonalised = false;
    if (haveS) {
      var L = cholesky(S);
      if (!L) return { ok: false, reason: 'overlap matrix is not positive definite' };
      var Li = invLowerTri(L);
      var Fp = [], tmp = [];
      for (i = 0; i < n; i++) {
        tmp.push(new Array(n).fill(0));
        for (j = 0; j < n; j++) for (var k2 = 0; k2 < n; k2++) tmp[i][j] += Li[i][k2] * F[k2][j];
      }
      for (i = 0; i < n; i++) {
        Fp.push(new Array(n).fill(0));
        for (j = 0; j < n; j++) for (k2 = 0; k2 < n; k2++) Fp[i][j] += tmp[i][k2] * Li[j][k2];
      }
      // back-transform C = L^-T x', which gives C^T S C = 1 for normalised x'
      eig = jacobiEigen(Fp).map(function(e) { return { value: e.value, vector: multiplyVecT(Li, e.vector) }; });
      orthogonalised = true;
    } else eig = jacobiEigen(F);

    // electron count in the pi system
    var nEl = 0;
    for (i = 0; i < n; i++) nEl += kinds[i].electrons;
    nEl -= Math.round((mol.charge || 0) / CONST.e);   // a +1 cation loses one pi electron
    var occ = [], eTotal = 0;
    for (i = 0; i < eig.length; i++) {
      var o = Math.max(0, Math.min(2, nEl - 2 * i));
      occ.push(o); eTotal += o * eig[i].value;
    }
    var homoIdx = -1, lumoIdx = -1;
    for (i = 0; i < occ.length; i++) if (occ[i] > 0) homoIdx = i;
    lumoIdx = homoIdx + 1;
    var gap = (lumoIdx < eig.length && homoIdx >= 0) ? (eig[lumoIdx].value - eig[homoIdx].value) : null;

    // LCAO population analysis. q_r = sum_j n_j sum_s c_jr c_js S_rs, which for
    // S = I reduces to the familiar sum_j n_j c_jr^2. Bond order P_rs is the
    // equivalent contracted sum over the bond's AO pair.
    var density = new Array(n).fill(0);
    for (i = 0; i < eig.length; i++) {
      if (!occ[i]) continue;
      var v = eig[i].vector;
      for (j = 0; j < n; j++) {
        var acc = 0;
        for (var s = 0; s < n; s++) acc += v[j] * v[s] * S[j][s];
        density[j] += occ[i] * acc;
      }
    }
    var bondOrders = bonds.map(function(pr) {
      var t = 0;
      for (i = 0; i < eig.length; i++) {
        if (!occ[i]) continue;
        t += occ[i] * eig[i].vector[pr[0]] * eig[i].vector[pr[1]];
      }
      return { pair: pr, p: t };
    });

    var warns = [];
    if (groups.length > 1) {
      warns.push('this structure has ' + groups.length + ' separate pi networks (sizes ' +
        groups.map(function(g) { return g.length; }).join(', ') +
        '); the numbers above come from the largest one, the rest are not conjugated with it');
    }
    if (nEl % 2 === 1) warns.push('an odd number of pi electrons: simple Huckel pairs them two by two, so the last orbital is singly occupied');

    return {
      ok: true,
      method: orthogonalised ? 'Huckel MO with Lowdin overlap orthogonalisation' : 'simple Huckel MO (zero differential overlap)',
      modelClass: 'semi-empirical quantum (pi-electron only, no electron correlation)',
      units: 'orbital energies in eV relative to alpha',
      centres: centers.map(function(c, k) { return { index: c, sym: A[c].sym, kind: kinds[k].kind, h: kinds[k].h, k: kinds[k].k, source: kinds[k].source }; }),
      networks: groups.map(function(g) { return g.length; }),
      alpha: alpha, beta: beta,
      orbitalEnergies: eig.map(function(e) { return e.value; }),
      occupations: occ,
      piElectrons: nEl,
      totalPiEnergy: eTotal,
      homo: homoIdx >= 0 ? eig[homoIdx].value : null,
      lumo: lumoIdx < eig.length ? eig[lumoIdx].value : null,
      gap: gap,
      gapNm: gap ? (CONST.h * CONST.c / (gap * CONST.eV)) * 1e9 : null,
      density: density,
      piBondOrders: bondOrders,
      coefficients: eig.map(function(e) { return e.vector.slice(); }),
      bonds: bonds,
      warnings: warns
    };
  };

  // (M^T v)_i = sum_k M[k][i] v[k]
  function multiplyVecT(M, v) {
    var out = new Array(v.length).fill(0);
    for (var i = 0; i < v.length; i++) for (var k = 0; k < M.length; k++) out[i] += M[k][i] * v[k];
    return out;
  }

  // Single entry point used by the UI: an external engine wins when registered,
  // otherwise the built-in Huckel level is used and the result says which.
  Quantum.solve = function(mol, opts) {
    opts = opts || {};
    if (Quantum.backend && !opts.forceBuiltIn) {
      var out = null;
      try { out = Quantum.backend.solve(mol, opts); }
      catch (err) { return { ok: false, reason: 'external backend "' + Quantum.backend.name + '" failed: ' + err.message }; }
      if (!out) return { ok: false, reason: 'external backend "' + Quantum.backend.name + '" returned no result' };
      out.backend = Quantum.backend.name;
      return out;
    }
    var res = Quantum.huckel(mol, opts);
    if (res.ok) res.backend = 'built-in';
    return res;
  };

  // ============================== helpers ==============================
  var gaussSeed = 1234567;
  // Deterministic Box-Muller so a run with the same seed reproduces exactly -
  // required for the energy-drift tests to mean anything.
  function gauss() {
    var u1, u2;
    do {
      gaussSeed = (gaussSeed * 1103515245 + 12345) & 0x7fffffff;
      u1 = gaussSeed / 0x7fffffff;
    } while (u1 <= 1e-12);
    gaussSeed = (gaussSeed * 1103515245 + 12345) & 0x7fffffff;
    u2 = gaussSeed / 0x7fffffff;
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
  Dynamics.prototype.setSeed = function(s) { gaussSeed = (s | 0) || 1; };

  function totalMass(mol) {
    var m = 0; for (var i = 0; i < mol.atoms.length; i++) m += mol.atoms[i].m;
    return m;
  }

  function removeCenterOfMassMotion(mol) {
    var A = mol.atoms, M = 0, px = 0, py = 0, pz = 0, i;
    for (i = 0; i < A.length; i++) {
      if (A[i].fixed) continue;
      M += A[i].m; px += A[i].m * A[i].vx; py += A[i].m * A[i].vy; pz += A[i].m * A[i].vz;
    }
    if (!(M > 0)) return { vx: 0, vy: 0, vz: 0 };
    var vx = px / M, vy = py / M, vz = pz / M;
    for (i = 0; i < A.length; i++) {
      if (A[i].fixed) continue;
      A[i].vx -= vx; A[i].vy -= vy; A[i].vz -= vz;
    }
    return { vx: vx, vy: vy, vz: vz };
  }

  function centerOfMass(mol) {
    var A = mol.atoms, M = 0, x = 0, y = 0, z = 0;
    for (var i = 0; i < A.length; i++) {
      M += A[i].m; x += A[i].m * A[i].x; y += A[i].m * A[i].y; z += A[i].m * A[i].z;
    }
    return M > 0 ? { x: x / M, y: y / M, z: z / M, m: M } : { x: 0, y: 0, z: 0, m: 0 };
  }

  // ============================== PHASE 9 ==============================
  var Thermo = {};

  // 9.3 Temperature. f counts the quadratic kinetic degrees of freedom that are
  // actually active: fixed atoms contribute none, and the three centre-of-mass
  // translations are removed when the COM drift has been projected out.
  Thermo.activeDof = function(mol, opts) {
    opts = opts || {};
    var free = 0;
    for (var i = 0; i < mol.atoms.length; i++) if (!mol.atoms[i].fixed) free += 3;
    if (opts.removeCOM === false) return free;
    return Math.max(0, free - 3);
  };

  Thermo.temperature = function(mol, K, opts) {
    var f = Thermo.activeDof(mol, opts);
    if (!(f > 0)) return 0;
    if (K === undefined) K = mol.lastKinetic || 0;
    return 2 * K / (f * CONST.k_B);
  };

  Thermo.kinetic = function(mol) {
    var K = 0, A = mol.atoms;
    for (var i = 0; i < A.length; i++) {
      if (A[i].fixed) continue;
      K += 0.5 * A[i].m * (A[i].vx * A[i].vx + A[i].vy * A[i].vy + A[i].vz * A[i].vz);
    }
    return K;
  };

  Thermo.degeneracyFactor = function(mol) { return Thermo.activeDof(mol); };

  // Kinetic temperature from the equipartition of each atom, reported per atom
  // so a non-equilibrated run is visible instead of hidden by one number.
  Thermo.perAtomTemperature = function(mol) {
    return mol.atoms.map(function(a) {
      if (a.fixed) return 0;
      var v2 = a.vx * a.vx + a.vy * a.vy + a.vz * a.vz;
      return a.m * v2 / (3 * CONST.k_B);
    });
  };

  // Virial pressure: P = N k T / V + (1/3V) sum_i r_i . F_i.
  Thermo.virialPressure = function(mol, volume_m3) {
    if (!(volume_m3 > 0)) return { ok: false, reason: 'volume must be positive' };
    var N = 0, W = 0;
    var c = centerOfMass(mol);
    for (var i = 0; i < mol.atoms.length; i++) {
      var a = mol.atoms[i];
      if (a.fixed) continue;
      N++;
      // centring the virial on the centre of mass removes the translational term
      W += (a.x - c.x) * a.fx + (a.y - c.y) * a.fy + (a.z - c.z) * a.fz;
    }
    var T = Thermo.temperature(mol, Thermo.kinetic(mol));
    var ideal = N * CONST.k_B * T / volume_m3;
    var vir = W / (3 * volume_m3);
    return { ok: true, Pa: ideal + vir, idealPa: ideal, virialPa: vir, N: N, T: T };
  };

  // 9.4 Entropy, from explicitly computed molecular properties.
  // Translational: Sackur-Tetrode with the thermal de Broglie wavelength.
  Thermo.thermalWavelength = function(m_kg, T) {
    return CONST.h / Math.sqrt(2 * Math.PI * m_kg * CONST.k_B * T);
  };
  Thermo.sackurTetrode = function(m_kg, T, volume_m3) {
    var lam = Thermo.thermalWavelength(m_kg, T);
    var x = volume_m3 / (lam * lam * lam);
    if (!(x > 0)) return { ok: false, reason: 'invalid V/lambda^3' };
    return { ok: true, SperMolecule: CONST.k_B * (Math.log(x) + 2.5), lambda: lam, formula: 'S = k[ln(V/lambda^3) + 5/2]' };
  };

  // Rotational: rigid rotor about the principal axes, moments of inertia from
  // the actual geometry and isotope-average masses.
  Thermo.momentsOfInertia = function(mol) {
    var A = mol.atoms, c = centerOfMass(mol), i;
    var I = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (i = 0; i < A.length; i++) {
      var x = A[i].x - c.x, y = A[i].y - c.y, z = A[i].z - c.z, m = A[i].m;
      I[0][0] += m * (y * y + z * z); I[1][1] += m * (x * x + z * z); I[2][2] += m * (x * x + y * y);
      I[0][1] -= m * x * y; I[1][0] = I[0][1];
      I[0][2] -= m * x * z; I[2][0] = I[0][2];
      I[1][2] -= m * y * z; I[2][1] = I[1][2];
    }
    var e = jacobiEigen(I);
    var vals = e.map(function(x) { return Math.max(x.value, 0); });
    var linear = vals[0] < 1e-47;   // no moment about the figure axis
    return { values: vals, principalAxes: e.map(function(x) { return x.vector; }), linear: linear };
  };

  Thermo.rotationalTemperature = function(I_kg_m2) {
    return CONST.hbar * CONST.hbar / (2 * I_kg_m2 * CONST.k_B);
  };

  Thermo.rotationalEntropy = function(mol, T, opts) {
    opts = opts || {};
    var mi = Thermo.momentsOfInertia(mol);
    var sigma = opts.symmetryNumber || 1;
    var vals = mi.values.slice();
    if (mi.linear) {
      var I = vals[2];
      if (!(I > 0)) return { ok: false, reason: 'linear rotor has zero moment of inertia' };
      var th = Thermo.rotationalTemperature(I);
      return {
        ok: true, linear: true, symmetryNumber: sigma, thetaRot: th,
        S: CONST.k_B * (Math.log(T / (sigma * th)) + 1),
        formula: 'S = k[ln(T/sigma.theta_r) + 1] (rigid linear rotor, high-T limit)'
      };
    }
    var prod = 1, th = [];
    for (var q = 0; q < 3; q++) {
      if (!(vals[q] > 0)) return { ok: false, reason: 'degenerate rotor: moment ' + q + ' is zero' };
      th.push(Thermo.rotationalTemperature(vals[q]));
      prod *= th[q];
    }
    return {
      ok: true, linear: false, symmetryNumber: sigma, thetaRot: th,
      S: CONST.k_B * (0.5 * Math.log(Math.PI / (sigma * sigma)) + 1.5 * Math.log(T) - 0.5 * Math.log(prod) + 1.5),
      formula: 'S = k[ln(sqrt(pi)/sigma^2 * T^3/(theta_a.theta_b.theta_c)) + 3/2] (rigid nonlinear rotor)'
    };
  };

  // Vibrational: quantum harmonic oscillators built from the Hessian modes.
  Thermo.vibrationalEntropy = function(freqHz, T) {
    var S = 0, ZPE = 0, Cv = 0;
    for (var i = 0; i < freqHz.length; i++) {
      var v = freqHz[i];
      if (!(v > 0)) continue;
      var theta = CONST.h * v / CONST.k_B;
      var x = theta / T;
      if (x > 60) { ZPE += 0.5 * CONST.h * v; continue; }
      var ex = Math.exp(x);
      S += CONST.k_B * (x / (ex - 1) - Math.log(1 - Math.exp(-x)));
      Cv += CONST.k_B * x * x * ex / Math.pow(ex - 1, 2);
      ZPE += 0.5 * CONST.h * v;
    }
    return { S: S, zeroPointEnergy: ZPE, Cv: Cv, formula: 'S = k sum[ x/(e^x-1) - ln(1-e^-x) ], x = h.v/kT' };
  };

  // 9.4 The discrete Gibbs-Shannon form, used for distributions the engine
  // actually samples (conformer populations from a trajectory). It is NOT the
  // total entropy of the system and the UI says so.
  Thermo.shannonEntropy = function(weights) {
    var tot = 0, i;
    for (i = 0; i < weights.length; i++) tot += weights[i];
    if (!(tot > 0)) return { ok: false, reason: 'empty distribution' };
    var S = 0, p = [];
    for (i = 0; i < weights.length; i++) {
      var pi = weights[i] / tot;
      p.push(pi);
      if (pi > 0) S -= pi * Math.log(pi);
    }
    return { ok: true, S: CONST.k_B * S, probabilities: p, states: weights.length, note: 'configurational entropy of the sampled distribution only, not the full molecular entropy' };
  };

  // 9.5 Free energies. Helmholtz A = U - TS is the canonical (NVT) potential;
  // Gibbs G = H - TS = A + pV is the isobaric (NPT) one. They are never merged.
  Thermo.freeEnergies = function(data) {
    var U = data.U || 0, S = data.S || 0, T = data.T || 0;
    var A = U - T * S;
    var pV = data.pV === undefined ? 0 : data.pV;
    var H = U + pV;
    return {
      U: U, T: T, S: S,
      HelmholtzA: A,
      enthalpyH: H,
      GibbsG: H - T * S,
      pV: pV,
      note: 'A = U - TS (NVT); G = H - TS with H = U + pV (NPT)'
    };
  };

  // Ideal-gas molar heat capacity from the active quadratic degrees of freedom.
  Thermo.molarHeatCapacity = function(dofTrans, dofRot, dofVib) {
    var Cv = (dofTrans + dofRot) * 0.5 * CONST.R + dofVib * CONST.R;
    return { Cv: Cv, Cp: Cv + CONST.R, units: 'J/(mol K)' };
  };

  // ==================== normal modes / Hessian (Phase 10.2, 10.3) ====================
  var HESSIAN_STEP = 1e-12;   // m, central-difference displacement

  // Mass-weighted Hessian -> eigenvalues -> frequencies. Classical normal-mode
  // analysis of the fitted force field: a standard molecular-mechanics
  // calculation, not a quantum one.
  function hessianFrequencies(mol, opts) {
    opts = opts || {};
    var A = mol.atoms, free = [];
    for (var i = 0; i < A.length; i++) if (!A[i].fixed) free.push(i);
    var nf = free.length * 3;
    if (nf < 3) return { ok: false, reason: 'too few movable atoms' };
    var e0 = mol.computeForces().total;
    var H = [];
    for (i = 0; i < nf; i++) H.push(new Array(nf).fill(0));
    var displaced = function(idx, which, sign) {
      A[idx][which] += sign * HESSIAN_STEP;
    };
    var gradAt = function() {
      mol.computeForces();
      var g = [];
      for (var k = 0; k < free.length; k++) {
        var a = A[free[k]];
        g.push(a.fx, a.fy, a.fz);
      }
      return g;
    };
    var d = new Array(nf).fill(0);
    for (var p = 0; p < nf; p++) {
      var ip = free[Math.floor(p / 3)], key = ['x', 'y', 'z'][p % 3];
      displaced(ip, key, +1); var gPlus = gradAt();
      displaced(ip, key, -2); var gMinus = gradAt();
      displaced(ip, key, +1);
      for (var q = 0; q < nf; q++) H[p][q] = -(gPlus[q] - gMinus[q]) / (2 * HESSIAN_STEP);
    }
    mol.computeForces();
    // mass weighting: H' = H / sqrt(m_i m_j)
    var mm = [];
    for (p = 0; p < nf; p++) mm.push(A[free[Math.floor(p / 3)]].m);
    for (p = 0; p < nf; p++) for (q = 0; q < nf; q++) H[p][q] /= Math.sqrt(mm[p] * mm[q]);
    // symmetrise away the differencing noise
    for (p = 0; p < nf; p++) for (q = p + 1; q < nf; q++) {
      var av = 0.5 * (H[p][q] + H[q][p]); H[p][q] = H[q][p] = av;
    }
    var eig = jacobiEigen(H, 160);
    var modes = eig.map(function(e) {
      var omega2 = e.value;
      var imag = omega2 < -1e-8;
      var omega = Math.sqrt(Math.abs(omega2));
      var nu = omega / (2 * Math.PI);
      return {
        eigenvalue: omega2,
        frequencyHz: imag ? null : nu,
        wavenumber: imag ? null : nu / CONST.c / 100,   // cm^-1
        imaginary: imag,
        imaginaryCm: imag ? Math.sqrt(-omega2) / (2 * Math.PI) / CONST.c / 100 : null,
        vector: e.vector
      };
    });
    return {
      ok: true, modes: modes, step: HESSIAN_STEP, energy: e0,
      units: 'wavenumber in cm^-1',
      imaginaryCount: modes.filter(function(m) { return m.imaginary; }).length,
      formula: 'omega^2 from the mass-weighted Hessian of the fitted force field'
    };
  }

  Thermo.vibrationalPartition = function(mol, T) {
    var hm = hessianFrequencies(mol);
    if (!hm.ok) return hm;
    var freqs = hm.modes.filter(function(m) { return !m.imaginary; }).map(function(m) { return m.frequencyHz; });
    var v = Thermo.vibrationalEntropy(freqs, T);
    v.wavenumbers = freqs.map(function(f) { return f / CONST.c / 100; });
    v.imaginaryCount = hm.imaginaryCount;
    v.imaginary = hm.modes.filter(function(m) { return m.imaginary; })
      .map(function(m) { return m.imaginaryCm; });
    return v;
  };

  // Full thermochemistry box for one molecule in the gas phase at T.
  Thermo.moleculeReport = function(mol, T, opts) {
    opts = opts || {};
    var volume = opts.volume || 24.789e-3 / CONST.N_A;   // m^3 per molecule at 298.15 K, 1 bar
    var c = centerOfMass(mol);
    var rep = {};
    var st = Thermo.sackurTetrode(c.m, T, volume);
    var rot = Thermo.rotationalEntropy(mol, T, opts);
    var vib = Thermo.vibrationalPartition(mol, T);
    var U = mol.computeForces().total;
    var Strans = st.ok ? st.SperMolecule : 0;
    var Srot = rot.ok ? rot.S : 0;
    var Svib = vib.ok ? vib.S : 0;
    var ZPE = vib.ok ? vib.zeroPointEnergy : 0;
    rep.translational = st; rep.rotational = rot; rep.vibrational = vib;
    rep.electronic = { S: CONST.k_B * Math.log(opts.spinMultiplicity ? opts.spinMultiplicity : 1) };
    rep.S_total = Strans + Srot + Svib + rep.electronic.S;
    rep.U_potential = U;
    rep.U_zeroPoint = ZPE;
    rep.U_thermal = 1.5 * CONST.k_B * T + (rot.linear ? CONST.k_B * T : 1.5 * CONST.k_B * T);
    rep.entropyPerMole = rep.S_total * CONST.N_A;
    rep.zpePerMole = ZPE * CONST.N_A;
    var fe = Thermo.freeEnergies({
      U: U + ZPE + rep.U_thermal, S: rep.S_total, T: T,
      pV: opts.pressure ? opts.pressure * volume : CONST.k_B * T
    });
    rep.free = fe;
    rep.freePerMole = {
      A: fe.HelmholtzA * CONST.N_A, H: fe.enthalpyH * CONST.N_A, G: fe.GibbsG * CONST.N_A
    };
    rep.note = 'rigid rotor / harmonic oscillator / ideal translation; entropies per molecule in J/K, molar values in J/(mol K)';
    return rep;
  };

  // ============================== PHASE 10 ==============================
  var Optimizer = {};

  // 10.2 Stable configurations are the points where grad U = 0. Two real
  // minimisers are implemented: FIRE (velocity-based, robust) and
  // Fletcher-Reeves conjugate gradient with a backtracking line search.
  Optimizer.energy = function(mol) { return mol.computeForces().total; };

  Optimizer.maxGradient = function(mol) {
    var A = mol.atoms, m = 0;
    for (var i = 0; i < A.length; i++) {
      if (A[i].fixed) continue;
      var f = Math.sqrt(A[i].fx * A[i].fx + A[i].fy * A[i].fy + A[i].fz * A[i].fz);
      if (f > m) m = f;
    }
    return m;
  };

  // FIRE, Bitzek et al. (Phys. Rev. Lett. 97, 170201, 2006): steepest descent in
  // a fictitious dynamics whose velocity is steered toward the force whenever
  // the two do positive work, with the time step backed off when they do not.
  Optimizer.fire = function(mol, opts) {
    opts = opts || {};
    var maxSteps = opts.maxSteps || 5000;
    var tol = opts.tol === undefined ? 1e-11 : opts.tol;    // N residual-force criterion
    var dt = opts.dt || 3e-16;                              // s, ~1/50 of the fastest bond period
    var dtMax = opts.dtMax || 1e-15;
    var alpha = opts.alpha === undefined ? 0.1 : opts.alpha;
    var A = mol.atoms, i;
    var v = A.map(function() { return { x: 0, y: 0, z: 0 }; });
    var dtStart = dt, Nf = 0, E = Optimizer.energy(mol), step = 0;
    for (step = 0; step < maxSteps; step++) {
      var P = 0, K = 0, M = 0;
      for (i = 0; i < A.length; i++) {
        if (A[i].fixed) continue;
        P += A[i].fx * v[i].x + A[i].fy * v[i].y + A[i].fz * v[i].z;
        K += 0.5 * A[i].m * (v[i].x * v[i].x + v[i].y * v[i].y + v[i].z * v[i].z);
        M += A[i].m;
      }
      if (P < 0) {
        for (i = 0; i < A.length; i++) { v[i].x = 0; v[i].y = 0; v[i].z = 0; }
        dt = Math.max(dtStart * 0.99, dt * 0.5);
        Nf = 0;
      } else {
        Nf++;
        if (Nf > 5) { dt = Math.min(dtMax, dt * 1.1); Nf = 0; }
        var vnorm = M > 0 ? Math.sqrt(2 * K / M) : 0;
        for (i = 0; i < A.length; i++) {
          if (A[i].fixed) continue;
          v[i].x += dt * A[i].fx / A[i].m; v[i].y += dt * A[i].fy / A[i].m; v[i].z += dt * A[i].fz / A[i].m;
        }
        if (P > 0 && vnorm > 0) {
          for (i = 0; i < A.length; i++) {
            if (A[i].fixed) continue;
            var fn = Math.sqrt(A[i].fx * A[i].fx + A[i].fy * A[i].fy + A[i].fz * A[i].fz);
            if (!(fn > 0)) continue;
            v[i].x = (1 - alpha) * v[i].x + alpha * vnorm * A[i].fx / fn;
            v[i].y = (1 - alpha) * v[i].y + alpha * vnorm * A[i].fy / fn;
            v[i].z = (1 - alpha) * v[i].z + alpha * vnorm * A[i].fz / fn;
          }
        }
        for (i = 0; i < A.length; i++) {
          if (A[i].fixed) continue;
          A[i].x += dt * v[i].x; A[i].y += dt * v[i].y; A[i].z += dt * v[i].z;
        }
      }
      E = Optimizer.energy(mol);
      if (!isFinite(E)) return { ok: false, converged: false, steps: step + 1, reason: 'energy became ' + E };
      if (Optimizer.maxGradient(mol) < tol) {
        return { ok: true, method: 'FIRE', steps: step + 1, energy: E, maxGradient: Optimizer.maxGradient(mol), converged: true };
      }
    }
    return {
      ok: true, method: 'FIRE', steps: maxSteps, converged: false,
      energy: E, maxGradient: Optimizer.maxGradient(mol),
      reason: 'step budget exhausted before the force criterion was met'
    };
  };

  Optimizer.conjugateGradient = function(mol, opts) {
    opts = opts || {};
    var maxSteps = opts.maxSteps || 800;
    var tol = opts.tol === undefined ? 1e-11 : opts.tol;
    var A = mol.atoms, i;
    var prevDir = null, prevGrad = null;
    var E = Optimizer.energy(mol);
    for (var step = 0; step < maxSteps; step++) {
      var g = A.map(function(a) { return a.fixed ? { x: 0, y: 0, z: 0 } : { x: -a.fx, y: -a.fy, z: -a.fz }; });
      var gn = 0;
      for (i = 0; i < A.length; i++) gn += g[i].x * g[i].x + g[i].y * g[i].y + g[i].z * g[i].z;
      gn = Math.sqrt(gn);
      if (Optimizer.maxGradient(mol) < tol) return { ok: true, method: 'Fletcher-Reeves CG', steps: step + 1, energy: E, converged: true, gradientNorm: gn };
      var dir = g.map(function(x) { return { x: x.x, y: x.y, z: x.z }; });
      if (prevDir && prevGrad) {
        var num = 0, den = 0;
        for (i = 0; i < A.length; i++) {
          num += g[i].x * g[i].x + g[i].y * g[i].y + g[i].z * g[i].z;
          den += prevGrad[i].x * prevGrad[i].x + prevGrad[i].y * prevGrad[i].y + prevGrad[i].z * prevGrad[i].z;
        }
        var beta = den > 0 ? num / den : 0;
        for (i = 0; i < A.length; i++) {
          dir[i].x -= beta * prevDir[i].x; dir[i].y -= beta * prevDir[i].y; dir[i].z -= beta * prevDir[i].z;
        }
      }
      // backtracking line search along dir
      var step0 = Math.min(1e-21 / (gn || 1e-300), 1e-22 / Math.max(1e-300, gn));
      var alpha = step0, accepted = false, Enew = E;
      var snapshot = A.map(function(a) { return { x: a.x, y: a.y, z: a.z }; });
      for (var tries = 0; tries < 40; tries++) {
        for (i = 0; i < A.length; i++) {
          if (A[i].fixed) continue;
          A[i].x += alpha * dir[i].x; A[i].y += alpha * dir[i].y; A[i].z += alpha * dir[i].z;
        }
        Enew = Optimizer.energy(mol);
        if (isFinite(Enew) && Enew < E) { accepted = true; break; }
        for (i = 0; i < A.length; i++) { A[i].x = snapshot[i].x; A[i].y = snapshot[i].y; A[i].z = snapshot[i].z; }
        alpha *= 0.5;
      }
      if (!accepted) {
        Optimizer.energy(mol);
        return { ok: true, method: 'Fletcher-Reeves CG', steps: step + 1, energy: E, converged: false, reason: 'line search could not lower the energy (stalled)' };
      }
      prevDir = dir; prevGrad = g; E = Enew;
    }
    return { ok: true, method: 'Fletcher-Reeves CG', steps: maxSteps, energy: E, converged: false, reason: 'step budget exhausted' };
  };

  Optimizer.minimize = function(mol, opts) {
    opts = opts || {};
    var r = (opts.method === 'cg') ? Optimizer.conjugateGradient(mol, opts) : Optimizer.fire(mol, opts);
    if (r.ok && opts.checkFrequencies) r.frequencies = hessianFrequencies(mol);
    if (r.frequencies && r.frequencies.ok) {
      r.stability = r.frequencies.imaginaryCount === 0 ? 'minimum (no imaginary modes)'
        : r.frequencies.imaginaryCount + ' imaginary mode(s): transition state or unstable configuration';
    }
    return r;
  };

  // 10.1 Potential-energy surface: scan one internal coordinate, optionally
  // relaxing the others, and report the barriers that come out of it.
  Optimizer.scan = function(mol, spec, opts) {
    opts = opts || {};
    var points = opts.points || 25;
    spec = spec || {};
    var kind = spec.kind || 'bond';
    var read = function() {
      var A = mol.atoms;
      if (kind === 'bond') return bondLength(A[spec.i], A[spec.j]);
      if (kind === 'angle') return angleValue(A[spec.i], A[spec.j], A[spec.k]);
      if (kind === 'dihedral') return dihedralValue(A[spec.i], A[spec.j], A[spec.k], A[spec.l]);
      return null;
    };
    var write = function(value) {
      var A = mol.atoms;
      if (kind === 'bond') {
        var a = A[spec.i], b = A[spec.j];
        var u = vunit(delta(a, b));
        // move the two atoms symmetrically about their midpoint, keeping the rest
        var mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
        a.x = mid.x - 0.5 * value * u.x; a.y = mid.y - 0.5 * value * u.y; a.z = mid.z - 0.5 * value * u.z;
        b.x = mid.x + 0.5 * value * u.x; b.y = mid.y + 0.5 * value * u.y; b.z = mid.z + 0.5 * value * u.z;
        var wasI = a.fixed, wasJ = b.fixed;
        a.fixed = true; b.fixed = true;
        return function() { a.fixed = wasI; b.fixed = wasJ; };
      }
      if (kind === 'angle' || kind === 'dihedral') {
        // Rotation of a fragment about an axis: the constrained coordinates are
        // exact, but relaxing everything else while holding a rotated fragment
        // needs constraint machinery the engine does not have, so these scans
        // are single-point and say so instead of pretending otherwise.
        var idxs = kind === 'angle' ? [spec.i, spec.j, spec.k] : [spec.i, spec.j, spec.k, spec.l];
        var pivot = A[idxs[1]];
        var axisEnd = A[idxs[2]];
        var moving = kind === 'angle' ? [idxs[0]] : (spec.fragment || [idxs[3]]);
        var current = read();
        var dtheta = value - current;
        var ax = vunit(delta(pivot, axisEnd));
        var snapshot = moving.map(function(mi) { return { i: mi, x: A[mi].x, y: A[mi].y, z: A[mi].z }; });
        moving.forEach(function(mi) { rotateAbout(A[mi], pivot, ax, dtheta); });
        return function() {
          snapshot.forEach(function(s2) { A[s2.i].x = s2.x; A[s2.i].y = s2.y; A[s2.i].z = s2.z; });
        };
      }
      return function() { };
    };
    var start = read();
    if (start === null) return { ok: false, reason: 'unknown scan kind' };
    var lo = spec.from === undefined ? start - (kind === 'bond' ? 0.3e-10 : Math.PI / 3) : spec.from;
    var hi = spec.to === undefined ? start + (kind === 'bond' ? 0.3e-10 : Math.PI / 3) : spec.to;
    var curve = [], i;
    var canRelax = kind === 'bond';
    var restoreAll = A.map(function(p) { return { x: p.x, y: p.y, z: p.z, fixed: p.fixed }; });
    for (i = 0; i < points; i++) {
      var v = lo + (hi - lo) * i / (points - 1);
      var undo = write(v);
      var res = (opts.relax && canRelax) ? Optimizer.minimize(mol, { maxSteps: opts.relaxSteps || 400 }) : null;
      var E = Optimizer.energy(mol);
      curve.push({ value: kind === 'bond' ? v / ANGSTROM : v * 180 / Math.PI, E: E, relaxed: !!res });
      undo();
      for (var rb = 0; rb < A.length; rb++) {
        A[rb].x = restoreAll[rb].x; A[rb].y = restoreAll[rb].y; A[rb].z = restoreAll[rb].z;
        A[rb].fixed = restoreAll[rb].fixed;
      }
    }
    Optimizer.energy(mol);
    var Emin = Math.min.apply(null, curve.map(function(p) { return p.E; }));
    var Emax = Math.max.apply(null, curve.map(function(p) { return p.E; }));
    return {
      ok: true, kind: kind, curve: curve,
      units: kind === 'bond' ? { x: 'angstrom', y: 'joule' } : { x: 'degree', y: 'joule' },
      barrierKJmol: (Emax - Emin) * CONST.N_A / 1000,
      minima: curve.filter(function(p, k) { return k > 0 && k < curve.length - 1 && p.E <= curve[k - 1].E && p.E <= curve[k + 1].E; }),
      maxima: curve.filter(function(p, k) { return k > 0 && k < curve.length - 1 && p.E >= curve[k - 1].E && p.E >= curve[k + 1].E; })
    };
  };

  function rotateAbout(point, origin, axis, angle) {
    var v = { x: point.x - origin.x, y: point.y - origin.y, z: point.z - origin.z };
    var c = Math.cos(angle), s = Math.sin(angle);
    var d = vdot(axis, v);
    var cr = vcross(axis, v);
    point.x = origin.x + v.x * (c + (1 - c) * axis.x * axis.x) + cr.x * s + axis.x * d * (1 - c);
    point.y = origin.y + v.y * (c + (1 - c) * axis.y * axis.y) + cr.y * s + axis.y * d * (1 - c);
    point.z = origin.z + v.z * (c + (1 - c) * axis.z * axis.z) + cr.z * s + axis.z * d * (1 - c);
  }

  // 10.4 Stability: a configuration is stable when every mode is real and the
  // energy sits below the dissociated fragments.
  Optimizer.stability = function(mol, opts) {
    var hm = hessianFrequencies(mol);
    var E = Optimizer.energy(mol);
    var res = { energy: E, modes: hm, binding: null };
    if (opts.referenceEnergy !== undefined) {
      res.binding = {
        perBond: (E - opts.referenceEnergy) / Math.max(1, mol.bonds.length),
        energyDifferenceKJmol: (opts.referenceEnergy - E) * CONST.N_A / 1000,
        sign: E < opts.referenceEnergy ? 'bound (below separated-fragment reference)' : 'repulsive reference state'
      };
    }
    if (hm.ok) res.verdict = hm.imaginaryCount === 0 ? 'stable minimum' : (hm.imaginaryCount + ' unstable direction(s)');
    return res;
  };

  // ============================== PHASE 8 ==============================
  var Kinetics = {};

  // 8.1 Arrhenius. Ea is in J/mol, A in s^-1 for a first-order step.
  Kinetics.arrhenius = function(A, Ea_J_per_mol, T) {
    if (!(T > 0)) return { ok: false, reason: 'temperature must be above 0 K' };
    return { ok: true, k: A * Math.exp(-Ea_J_per_mol / (CONST.R * T)), T: T, A: A, Ea: Ea_J_per_mol };
  };

  // Arrhenius parameters from measured rate constants: least squares on
  // ln k = ln A - Ea/(R T).
  Kinetics.fitArrhenius = function(data) {
    var n = data.length, i, sx = 0, sy = 0, sxx = 0, sxy = 0;
    var pts = [];
    for (i = 0; i < n; i++) {
      if (!(data[i].T > 0) || !(data[i].k > 0)) continue;
      pts.push({ x: 1 / data[i].T, y: Math.log(data[i].k) });
    }
    if (pts.length < 2) return { ok: false, reason: 'need at least two valid (T, k) pairs' };
    for (i = 0; i < pts.length; i++) { sx += pts[i].x; sy += pts[i].y; sxx += pts[i].x * pts[i].x; sxy += pts[i].x * pts[i].y; }
    var m = pts.length, denom = m * sxx - sx * sx;
    if (Math.abs(denom) < 1e-30) return { ok: false, reason: 'temperatures are degenerate' };
    var slope = (m * sxy - sx * sy) / denom, intercept = (sy - slope * sx) / m;
    var Ea = -slope * CONST.R, A = Math.exp(intercept);
    var ssRes = 0, ssTot = 0, meanY = sy / m;
    for (i = 0; i < m; i++) {
      var yhat = intercept + slope * pts[i].x;
      ssRes += Math.pow(pts[i].y - yhat, 2); ssTot += Math.pow(pts[i].y - meanY, 2);
    }
    return {
      ok: true, Ea_J_per_mol: Ea, Ea_kJ_per_mol: Ea / 1000, A: A,
      r2: ssTot > 0 ? 1 - ssRes / ssTot : 1, points: m,
      units: 'Ea J/mol, A in the same units as the input k'
    };
  };

  // 8.3 Transition-state theory (Eyring-Polanyi). dG_dagger must be the
  // activation FREE energy, not Ea - the two are different quantities and the
  // engine keeps them in separate arguments.
  Kinetics.eyring = function(dG_dagger_J_per_mol, T, opts) {
    opts = opts || {};
    if (!(T > 0)) return { ok: false, reason: 'temperature must be above 0 K' };
    var kappa = opts.transmissionCoefficient === undefined ? 1 : opts.transmissionCoefficient;
    var kBToverH = CONST.k_B * T / CONST.h;
    var k = kappa * kBToverH * Math.exp(-dG_dagger_J_per_mol / (CONST.R * T));
    return {
      ok: true, k: k, kappa: kappa, T: T,
      thermalFrequency: kBToverH,
      units: 'first-order s^-1; concentration-dependent units for higher order',
      note: 'Eyring: k = kappa.kB.T/h . exp(-dG_dagger/RT). dG_dagger is an activation FREE energy in J/mol; it is not the Arrhenius Ea.'
    };
  };

  // Eyring activation entropy from a measured A factor: A = (e kBT/h) exp(dS/R).
  Kinetics.entropyFromPreExponential = function(A, T) {
    var pref = Math.E * CONST.k_B * T / CONST.h;
    return { ok: pref > 0, deltaS_dagger: CONST.R * Math.log(A / pref), units: 'J/(mol K)' };
  };

  // Wigner parabolic-barrier tunnelling correction from the imaginary
  // frequency of the transition state; validity is limited to small h.omega/kT.
  Kinetics.wignerCorrection = function(imaginaryHz, T) {
    if (!(imaginaryHz > 0) || !(T > 0)) return { ok: false, reason: 'need a positive imaginary frequency and T > 0' };
    var x = CONST.h * imaginaryHz / (CONST.k_B * T);
    var kappa = 1 + x * x / 24;
    return {
      ok: true, kappa: kappa, dimensionlessBarrierFrequency: x,
      reliable: x < 2,
      warning: x >= 2 ? 'h.nu/kT = ' + x.toFixed(2) + ' is outside the low-barrier limit the Wigner correction assumes' : null
    };
  };

  // 8.2 Rate law v = k [A]^m [B]^n. Orders are supplied by the mechanism; the
  // engine never infers them from the stoichiometric coefficients.
  Kinetics.rateLaw = function(k, species, orders) {
    var v = k;
    for (var i = 0; i < species.length; i++) v *= Math.pow(species[i], orders[i]);
    return v;
  };

  // Isothermal batch integrator (RK4) for a set of elementary steps.
  // reactions: [{k, reactants:[{idx, order}], products:[{idx, factor}]}]
  Kinetics.integrate = function(c0, reactions, tEnd, opts) {
    opts = opts || {};
    var steps = opts.steps || 2000;
    var dt = tEnd / steps;
    var c = c0.slice(), t = 0;
    var trace = [{ t: 0, c: c.slice() }];
    var deriv = function(cv) {
      var d = new Array(cv.length).fill(0);
      for (var r = 0; r < reactions.length; r++) {
        var rx = reactions[r], v = rx.k;
        for (var q = 0; q < rx.reactants.length; q++) v *= Math.pow(Math.max(0, cv[rx.reactants[q].idx]), rx.reactants[q].order);
        for (q = 0; q < rx.reactants.length; q++) d[rx.reactants[q].idx] -= v * (rx.reactants[q].factor || 1);
        for (q = 0; q < rx.products.length; q++) d[rx.products[q].idx] += v * (rx.products[q].factor || 1);
      }
      return d;
    };
    for (var s = 0; s < steps; s++) {
      var k1 = deriv(c);
      var k2 = deriv(c.map(function(x, i) { return x + 0.5 * dt * k1[i]; }));
      var k3 = deriv(c.map(function(x, i) { return x + 0.5 * dt * k2[i]; }));
      var k4 = deriv(c.map(function(x, i) { return x + dt * k3[i]; }));
      for (var i = 0; i < c.length; i++) {
        c[i] = c[i] + dt * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]) / 6;
        if (c[i] < 0 && c[i] > -1e-12) c[i] = 0;
      }
      t += dt;
      if (opts.every ? (s % opts.every === 0) : true) trace.push({ t: t, c: c.slice() });
    }
    // atom conservation: every step must keep the weighted sum of nuclei fixed
    var check = null;
    if (opts.atomMatrix) {
      var before = opts.atomMatrix.map(function(row) {
        var s2 = 0; for (var j = 0; j < row.length; j++) s2 += row[j] * c0[j]; return s2;
      });
      var after = opts.atomMatrix.map(function(row) {
        var s2 = 0; for (var j = 0; j < row.length; j++) s2 += row[j] * c[j]; return s2;
      });
      check = { before: before, after: after, maxResidual: Math.max.apply(null, before.map(function(x, i) { return Math.abs(x - after[i]); })) };
    }
    return { ok: true, trace: trace, final: c, steps: steps, conservation: check };
  };

  Kinetics.halfLife = function(k, order, c0) {
    if (order === 1) return { ok: true, t_half: Math.log(2) / k, formula: 'ln2/k' };
    if (order === 2) return { ok: true, t_half: 1 / (k * c0), formula: '1/(k.c0)' };
    if (order === 0) return { ok: true, t_half: c0 / (2 * k), formula: 'c0/(2k)' };
    return { ok: false, reason: 'no closed form supplied for order ' + order };
  };

  // Equilibrium constant from statistical mechanics: dG = -RT ln K.
  Kinetics.equilibriumConstant = function(dG_J_per_mol, T) {
    return { ok: true, K: Math.exp(-dG_J_per_mol / (CONST.R * T)), dG: dG_J_per_mol, T: T };
  };

  Kinetics.vanHoff = function(K1, T1, K2, T2) {
    if (!(K1 > 0) || !(K2 > 0) || !(T1 > 0) || !(T2 > 0) || T1 === T2) return { ok: false, reason: 'invalid K/T pairs' };
    var dH = -CONST.R * Math.log(K2 / K1) / (1 / T2 - 1 / T1);
    return { ok: true, deltaH_J_per_mol: dH, units: 'J/mol (constant-enthalpy van \u2019t Hoff integration)' };
  };

  // ============================== electron configuration ==============================
  // Aufbau filling of the standard orbital sequence. The engine derives shell
  // occupancies from the atomic number instead of storing another hand-typed
  // table, which is what Phase 1 asks for and what the valence rules below use.
  var ORBITAL_SEQUENCE = [
    ['1s', 2], ['2s', 2], ['2p', 6], ['3s', 2], ['3p', 6], ['4s', 2], ['3d', 10],
    ['4p', 6], ['5s', 2], ['4d', 10], ['5p', 6], ['6s', 2], ['4f', 14], ['5d', 10],
    ['6p', 6], ['7s', 2], ['5f', 14], ['6d', 10], ['7p', 6]
  ];

  function electronConfiguration(z) {
    var remaining = z, parts = [], shells = {}, period = 0;
    for (var i = 0; i < ORBITAL_SEQUENCE.length && remaining > 0; i++) {
      var name = ORBITAL_SEQUENCE[i][0], cap = ORBITAL_SEQUENCE[i][1];
      var n = Math.min(cap, remaining);
      if (n > 0) { parts.push(name + n); remaining -= n; }
      var shell = parseInt(name[0], 10);
      shells[shell] = (shells[shell] || 0) + n;
      if (n === cap) continue;
      if (period === 0) period = shell;
    }
    if (!period) { for (var k in shells) period = Math.max(period, parseInt(k, 10)); }
    var s = 0, p = 0, d = 0, f = 0;
    for (i = 0; i < ORBITAL_SEQUENCE.length; i++) {
      var nm = ORBITAL_SEQUENCE[i][0], nn = parseInt(nm[0], 10), lt = nm[1];
      if (nn !== period) continue;
      var occ = 0;
      for (var q = 0; q < parts.length; q++) if (parts[q].indexOf(nm) === 0) occ = parseInt(parts[q].slice(nm.length), 10);
      if (lt === 's') s += occ; else if (lt === 'p') p += occ; else if (lt === 'd') d += occ; else f += occ;
    }
    var isTransition = d > 0 && d < 10 && (s + p <= 3);
    var isInner = f > 0 && f < 14;
    return {
      text: parts.join(' '),
      shells: shells,
      period: period,
      outerS: s, outerP: p, outerD: d, outerF: f,
      valenceElectrons: s + p + (isTransition ? s : 0),
      block: isInner ? 'f' : (isTransition ? 'd' : (p > 0 ? 'p' : 's')),
      group: (function() {
        if (isInner) return null;
        if (isTransition) return d + s === 3 && period >= 4 ? 3 : null;
        return s + p > 0 ? (p > 0 ? s + p + 10 : s) : null;
      })()
    };
  }

  // Main-group valence used by VSEPR. Transition and inner shells are refused:
  // VSEPR does not describe them, and pretending otherwise would be fake physics.
  function vseprValence(el) {
    var cfg = electronConfiguration(el.z);
    if (cfg.block === 'd' || cfg.block === 'f') return { ok: false, reason: el.sym + ' is a ' + cfg.block + '-block element; VSEPR is not a valid model for it' };
    if (el.z === 1) return { ok: true, V: 1, cfg: cfg, terminal: true };
    var V = cfg.outerS + cfg.outerP;
    if (!(V > 0)) return { ok: false, reason: el.sym + ': no valence shell electrons resolved' };
    return { ok: true, V: V, cfg: cfg, period: cfg.period };
  }

  // ============================== PHASE 3.4 VSEPR builder ==============================
  // Steric number = sigma bonds + lone pairs, lone pairs from the electron count
  //   LP = (V - formalCharge - sum(bond orders)) / 2
  // Positions come from the ideal geometry of that steric number, with the lone
  // pairs taking the slots VSEPR gives them; the result is then refined with the
  // force field (Phase 10.2), which is what fixes real bond angles such as 104.5
  // degrees in water.
  var Builder = {};

  Builder.IDEAL = {
    1: [[0, 0, 1]],
    2: [[0, 0, 1], [0, 0, -1]],
    3: [[1, 0, 0], [-0.5, 0.8660254, 0], [-0.5, -0.8660254, 0]],
    4: [[0.5773503, 0.5773503, 0.5773503], [0.5773503, -0.5773503, -0.5773503],
      [-0.5773503, 0.5773503, -0.5773503], [-0.5773503, -0.5773503, 0.5773503]],
    5: [[1, 0, 0], [-0.5, 0.8660254, 0], [-0.5, -0.8660254, 0], [0, 0, 1], [0, 0, -1]],
    6: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]],
    7: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1], [0, 0.7071, 0.7071]]
  };

  // Octet / expanded-octet coordination limit, from the valence electron count
  // and the period (period 2 cannot expand its octet; period 3 and above can).
  Builder.maxBondOrderSum = function(el) {
    var v = vseprValence(el);
    if (!v.ok) return null;
    if (el.z === 1) return 1;
    if (v.period <= 2) return v.V <= 4 ? v.V : 8 - v.V;
    return Math.max(v.V, 8 - v.V);
  };

  // Rotation that carries the unit vector from onto the unit vector to.
  function rotationFromTo(from, to) {
    var ax = vcross(from, to);
    var s = vlen(ax), c = vdot(from, to);
    if (s < 1e-12) {
      if (c > 0) return [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
      // antiparallel: a 180 degree flip about any axis perpendicular to 'from'
      var perp = Math.abs(from.x) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
      return rotationMatrix(vunit(vcross(from, perp)), Math.PI);
    }
    var kx = ax.x / s, ky = ax.y / s, kz = ax.z / s;
    // Rodrigues' formula, cos/sin taken from the dot and cross magnitudes
    return [
      [c + kx * kx * (1 - c), kx * ky * (1 - c) - kz * s, kx * kz * (1 - c) + ky * s],
      [ky * kx * (1 - c) + kz * s, c + ky * ky * (1 - c), ky * kz * (1 - c) - kx * s],
      [kz * kx * (1 - c) - ky * s, kz * ky * (1 - c) + kx * s, c + kz * kz * (1 - c)]
    ];
  }

  function rotationMatrix(u, ang) {
    var c = Math.cos(ang), s = Math.sin(ang), t = 1 - c;
    return [
      [c + u.x * u.x * t, u.x * u.y * t - u.z * s, u.x * u.z * t + u.y * s],
      [u.y * u.x * t + u.z * s, c + u.y * u.y * t, u.y * u.z * t - u.x * s],
      [u.z * u.x * t - u.y * s, u.z * u.y * t + u.x * s, c + u.z * u.z * t]
    ];
  }

  function applyRot(M, v) {
    return {
      x: M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2],
      y: M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2],
      z: M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2]
    };
  }

  // A bond-order set can leave an atom with an odd number of unpartnered
  // valence electrons - carbon monoxide is the textbook case, where a C triple
  // bond O uses three of carbon's four electrons and leaves one alone. The
  // lone-pair count is only defined once the formal charges are settled, so the
  // electron pair is moved inside the fragment (the fragment's total charge is
  // unchanged by construction) until every remainder is even, and each pair is
  // placed with the negative formal charge on the more electronegative atom,
  // which is the standard Lewis convention. A fragment whose electron count is
  // genuinely odd - NO, NO2, CH3 - cannot be fixed this way and is reported as
  // the open-shell species it is rather than silently given a fractional lone
  // pair.
  Builder.resolveFormalCharges = function (mol, meta) {
    var comps = chargeFragments(mol), notes = [], c, i;
    for (c = 0; c < comps.length; c++) {
      var g = comps[c], odd = [];
      for (i = 0; i < g.length; i++) {
        var k = g[i];
        var v = vseprValence(mol.atoms[k].el);
        if (!v.ok) return { ok: false, reason: v.reason };
        var rem = v.V - meta[k].formal - meta[k].bondOrderSum;
        if (Math.abs(rem % 2) > 1e-9) odd.push(k);
      }
      if (odd.length % 2) {
        return { ok: false, reason: mol.atoms[odd[0]].sym + ': this fragment has an odd number of ' +
          'valence electrons, so it is a radical; the engine models closed-shell species only' };
      }
      for (i = 0; i + 1 < odd.length; i += 2) {
        var a = odd[i], b = odd[i + 1];
        var take = (mol.atoms[a].el.en || 0) >= (mol.atoms[b].el.en || 0) ? a : b;
        var give = take === a ? b : a;
        meta[take].formal -= 1;
        meta[give].formal += 1;
        mol.atoms[take].q0 = meta[take].formal * CONST.e;
        mol.atoms[take].q = mol.atoms[take].q0;
        mol.atoms[give].q0 = meta[give].formal * CONST.e;
        mol.atoms[give].q = mol.atoms[give].q0;
        notes.push(mol.atoms[give].sym + '/' + mol.atoms[take].sym +
          ': formal charges set to ' + (meta[give].formal > 0 ? '+' : '') + meta[give].formal + ' and ' +
          (meta[take].formal > 0 ? '+' : '') + meta[take].formal +
          ' so that every atom has a whole number of lone pairs');
      }
    }
    return { ok: true, notes: notes };
  };

  // A net ionic charge must be booked against a formal charge, otherwise the
  // parity test in resolveFormalCharges reads NH4+ as a nine-valence-electron
  // radical. The electron is taken from - or given to - the atom whose
  // unpartnered valence electrons are already odd, because that is where the
  // unpaired electron actually sits; ties are broken with measured data, the
  // lowest first ionisation energy for a removal and the highest electron
  // affinity for an addition. A charge that cannot be placed without leaving an
  // atom without an electron to give, or past three lone pairs, is reported
  // instead of being spread over the species as a fractional formal charge.
  Builder.applyNetCharge = function (mol, meta, net) {
    var already = 0, i;
    for (i = 0; i < meta.length; i++) already += meta[i].formal;
    var need = net - already, guard = 0;
    while (need !== 0 && guard++ < 64) {
      var remove = need > 0, remOf = [], scores = [], best = -1;
      for (i = 0; i < meta.length; i++) {
        var v = vseprValence(mol.atoms[i].el);
        if (!v.ok) return v.reason;
        remOf.push(v.V - meta[i].formal - meta[i].bondOrderSum);
      }
      for (i = 0; i < meta.length; i++) {
        var nextFormal = meta[i].formal + (remove ? 1 : -1);
        if (Math.abs(nextFormal) > 3) continue;
        if (remove ? remOf[i] < 1 : remOf[i] > 5) continue;
        var odd = Math.abs(remOf[i] % 2) > 1e-9 ? 100 : 0;
        var measure = remove
          ? -(mol.atoms[i].el.ie1 === null || mol.atoms[i].el.ie1 === undefined ? 0 : mol.atoms[i].el.ie1)
          : (mol.atoms[i].el.ea === null || mol.atoms[i].el.ea === undefined ? 0 : mol.atoms[i].el.ea);
        scores[i] = odd + measure;
        if (best < 0 || scores[i] > scores[best]) best = i;
      }
      if (best < 0) {
        return { ok: false, reason: (net > 0 ? 'a +' + net + ' species' : 'a ' + net + ' species') +
          ' cannot be built from these atoms: no centre has an unpartnered valence electron to ' +
          (remove ? 'lose' : 'gain') + ' once the formal charges are whole'};
      }
      meta[best].formal = remove ? meta[best].formal + 1 : meta[best].formal - 1;
      mol.atoms[best].q0 = meta[best].formal * CONST.e;
      mol.atoms[best].q = mol.atoms[best].q0;
      need -= remove ? 1 : -1;
    }
    return { ok: true };
  };

  // spec: { atoms: [{sym, pos?, charge?}], bonds: [[i, j, order]], charge? }
  // Positions supplied by the caller are kept; missing ones are generated.
  Builder.build = function(spec, opts) {
    opts = opts || {};
    var mol = new Molecule({ charge: (spec.charge || 0) * CONST.e, cutoff: opts.cutoff, useMorse: opts.useMorse !== false });
    var i;
    var meta = [];
    for (i = 0; i < spec.atoms.length; i++) {
      var sd = spec.atoms[i];
      var pos = sd.pos || { x: 0, y: 0, z: 0 };
      var a = mol.addAtom(sd.sym, pos, { q: (sd.charge || 0) * CONST.e, fixed: !!sd.fixed });
      if (!a) return { ok: false, mol: mol, reason: 'unknown element ' + sd.sym };
      meta.push({ placed: !!sd.pos, bondOrderSum: 0, formal: Math.round((sd.charge || 0)), neighbours: [] });
    }
    var bondList = spec.bonds || [];
    var explicitCharges = spec.atoms.some(function(s) { return s.charge; });
    for (i = 0; i < bondList.length; i++) {
      var bi = bondList[i][0], bj = bondList[i][1], ord = bondList[i][2] || 1;
      var b = mol.addBond(bi, bj, ord);
      if (!b) return { ok: false, mol: mol, reason: 'no bond data for ' + mol.atoms[bi].sym + '-' + mol.atoms[bj].sym };
      // Pauling's criterion: above an electronegativity difference of 1.7 the
      // bonding pair belongs to the more electronegative atom, so it is booked
      // as a transferred electron rather than a shared pair. That is what makes
      // NaCl read as Na+ (no lone pair, 1-coordinate) and Cl- (4 lone pairs)
      // instead of a covalent two-electron bond with a half lone pair on sodium.
      var dEN = Math.abs(mol.atoms[bi].el.en - mol.atoms[bj].el.en);
      b.ionic = dEN > 1.7;
      b.ionicCharacter = 1 - Math.exp(-dEN * dEN / 4);   // Pauling's ionic-character expression
      if (b.ionic) {
        if (!explicitCharges) {
          var neg = dEN > 0 ? (mol.atoms[bi].el.en > mol.atoms[bj].el.en ? bi : bj) : bi;
          var pos2 = neg === bi ? bj : bi;
          meta[neg].formal -= b.order; meta[pos2].formal += b.order;
          mol.atoms[neg].q0 = meta[neg].formal * CONST.e;
          mol.atoms[pos2].q0 = meta[pos2].formal * CONST.e;
          mol.atoms[neg].q = meta[neg].formal * CONST.e;
          mol.atoms[pos2].q = meta[pos2].formal * CONST.e;
        }
        // the shared-pair count stays zero for an ionic contact
      } else {
        meta[bi].bondOrderSum += b.order; meta[bj].bondOrderSum += b.order;
      }
      meta[bi].neighbours.push(bj); meta[bj].neighbours.push(bi);
    }
    var unplaced = [];
    var netQ = Builder.applyNetCharge(mol, meta, Math.round(spec.charge || 0));
    if (!netQ.ok) return { ok: false, mol: mol, reason: netQ.reason };
    var fc = Builder.resolveFormalCharges(mol, meta);
    if (!fc.ok) return { ok: false, mol: mol, reason: fc.reason };
    if (fc.notes.length) mol.notes = (mol.notes || []).concat(fc.notes);
    for (i = 0; i < mol.atoms.length; i++) if (!meta[i].placed) unplaced.push(i);
    var geom = null;
    if (unplaced.length) {
      geom = Builder.placeByVSEPR(mol, meta, unplaced, opts);
      if (!geom.ok) return { ok: false, mol: mol, reason: geom.reason };
    }
    // valence terms from the graph, then refinement
    Builder.connectValences(mol);
    mol.buildExclusions();
    mol.buildVdwTable();
    var chargeInfo = null;
    if (opts.charges !== false) chargeInfo = assignChargesEEM(mol, opts.eem);
    var refine = null;
    if (opts.optimize !== false) {
      refine = Optimizer.minimize(mol, { maxSteps: opts.optimizeSteps || 3000, tol: opts.tol });
      Builder.connectValences(mol);
      mol.buildExclusions();
      // the equilibration was solved on the pre-refinement geometry; charges and
      // dipoles are geometry-dependent, so recompute them on the final structure
      if (chargeInfo && chargeInfo.ok) chargeInfo = assignChargesEEM(mol, opts.eem);
    }
    return {
      ok: true, mol: mol, geometry: geom, refinement: refine, charges: chargeInfo,
      formula: Builder.formula(mol),
      shapes: Builder.shapes(mol, meta)
    };
  };

  // Distance for a new atom pair, from the fitted equilibrium length.
  Builder.bondDistance = function(elA, elB, order) {
    var p = bondParams(elA.sym, elB.sym, order);
    if (p && p.re) return p.re * ANGSTROM;
    if (elA.rcov !== null && elB.rcov !== null) return (elA.rcov + elB.rcov) * ANGSTROM;
    return 1.5e-10;
  };

  // Place every unplaced atom by walking the bond graph outward from an atom
  // that already has a position (or from the first atom, at the origin).
  Builder.placeByVSEPR = function(mol, meta, unplaced, opts) {
    opts = opts || {};
    var i, j, ci;
    var anchors = [];
    for (i = 0; i < mol.atoms.length; i++) if (meta[i].placed) anchors.push(i);
    var lp = {}, steric = {};
    for (i = 0; i < mol.atoms.length; i++) {
      var v = vseprValence(mol.atoms[i].el);
      if (!v.ok) return { ok: false, reason: v.reason };
      var formal = meta[i] && meta[i].formal !== undefined
        ? meta[i].formal : Math.round(mol.atoms[i].q0 / CONST.e);
      var lone = (v.V - formal - meta[i].bondOrderSum) / 2;
      if (lone < -1e-9 || Math.abs(lone - Math.round(lone)) > 1e-9) {
        return { ok: false, reason: mol.atoms[i].sym + ': lone-pair count is not a whole number (' + lone + '), check the bond orders and formal charges' };
      }
      lp[i] = Math.round(lone);
      steric[i] = meta[i].neighbours.length + lp[i];
    }
    // breadth-first placement, one pass per connected fragment. parentOf records
    // the spanning tree so each new centre can turn its ideal geometry around the
    // bond it arrived on. Atoms the caller already positioned are traversed but
    // never moved. A fragment that is not bonded to the main one is built in its
    // own frame and then translated clear of the others: separate species must
    // not be stacked on a single point, where their charges and forces would
    // overlap.
    var locked = {};
    for (i = 0; i < mol.atoms.length; i++) if (anchors.indexOf(i) >= 0) locked[i] = 1;
    var seen = {}, parentOf = {};
    var groups = chargeFragments(mol);
    var guard = 0;
    for (var gi = 0; gi < groups.length; gi++) {
      var group = groups[gi];
      var gRoot = group[0], anchored = false;
      for (j = 0; j < group.length; j++) if (meta[group[j]].placed) { gRoot = group[j]; anchored = true; break; }
      // A ring cannot be built one atom at a time from local slot directions:
      // the two arms of a six-ring finish several angstroms apart and no single
      // torsion brings them together. The cycle is therefore laid out as a
      // closed polygon first - exact by construction - and the side chains hang
      // off it; the minimiser relaxes the conformation from there.
      var ringAtoms = Builder.placeRing(mol, meta, group, locked, parentOf);
      if (!ringAtoms.length && !anchored) {
        var rv = vseprValence(mol.atoms[gRoot].el);
        if (!rv.ok) return { ok: false, reason: rv.reason };
        mol.atoms[gRoot].x = 0; mol.atoms[gRoot].y = 0; mol.atoms[gRoot].z = 0;
        meta[gRoot].placed = true;
      }
      var queue;
      if (ringAtoms.length) {
        for (var qk = 0; qk < ringAtoms.length; qk++) seen[ringAtoms[qk]] = 1;
        queue = ringAtoms.slice();
      } else {
        queue = [gRoot];
        seen[gRoot] = 1;
      }
      parentOf[queue[0]] = -1;
      while (queue.length && guard++ < 20000) {
      var next = [];
      for (var qi = 0; qi < queue.length; qi++) {
        var parent = queue[qi];
        var children = meta[parent].neighbours.filter(function(c) { return !seen[c]; });
        if (!children.length) continue;
        // slots of the parent geometry, lone pairs removed, one reserved for the
        // direction it came from
        var slots = Builder.slotsFor(parent, steric, lp, mol, parentOf);
        var origin = { x: mol.atoms[parent].x, y: mol.atoms[parent].y, z: mol.atoms[parent].z };
        for (ci = 0; ci < children.length; ci++) {
          var child = children[ci];
          if (locked[child]) { seen[child] = 1; parentOf[child] = parent; next.push(child); continue; }
          if (!slots.free.length) { seen[child] = 1; parentOf[child] = parent; next.push(child); continue; }
          var b = mol.findBond(parent, child);
          var len = Builder.bondDistance(mol.atoms[parent].el, mol.atoms[child].el, b ? b.order : 1);
          // A child that is already bonded to a placed atom closes a ring. The
          // slot direction cannot satisfy that second bond, and a Morse term
          // stretched to 8 angstrom has essentially no restoring force, so the
          // ring position is solved exactly: the circle on which both bond
          // lengths hold.
          var closers = meta[child].neighbours.filter(function(x) { return x !== parent && seen[x]; });
          // Every free slot is tried, and for a ring-closing child both points of
          // the circle are tried, because which of them is right depends on the
          // rest of the molecule. Taking the first slot blind is what put two of
          // benzene's hydrogens 0.9 A inside the ring, where the van der Waals
          // term - correctly - then threw them out of the molecule.
          var cands = [];
          for (var si = 0; si < slots.free.length; si++) {
            var dirIdx = slots.free[si];
            var d = applyRot(slots.rot, slots.vecs[dirIdx]);
            cands.push({ x: origin.x + d.x * len, y: origin.y + d.y * len, z: origin.z + d.z * len, ring: false });
            if (!closers.length) continue;
            var closer = closers[0];
            var q2 = mol.atoms[closer];
            var bb = mol.findBond(child, closer);
            var L2 = Builder.bondDistance(mol.atoms[child].el, q2.el, bb ? bb.order : 1);
            var ax = q2.x - origin.x, ay = q2.y - origin.y, az = q2.z - origin.z;
            var D = Math.sqrt(ax * ax + ay * ay + az * az);
            if (D <= 1e-12) continue;
            var a1 = (len * len - L2 * L2 + D * D) / (2 * D);
            var h2 = len * len - a1 * a1;
            if (!(h2 > 0)) {
              mol.notes.push('ring closure ' + mol.atoms[parent].sym + '-' +
                mol.atoms[child].sym + '-' + q2.sym + ' cannot satisfy both bond lengths (' +
                (D * 1e10).toFixed(3) + ' A apart, ' + (len * 1e10).toFixed(3) + ' + ' +
                (L2 * 1e10).toFixed(3) + ' A of bonds) - the ring is strained and the ' +
                'minimiser will report it');
              continue;
            }
            var ux = ax / D, uy = ay / D, uz = az / D;
            var pd = d.x * ux + d.y * uy + d.z * uz;
            var wx = d.x - pd * ux, wy = d.y - pd * uy, wz = d.z - pd * uz;
            var wl = Math.sqrt(wx * wx + wy * wy + wz * wz);
            if (!(wl > 1e-9)) {
              var perp = Math.abs(ux) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
              wx = uy * perp.z - uz * perp.y;
              wy = uz * perp.x - ux * perp.z;
              wz = ux * perp.y - uy * perp.x;
              wl = Math.sqrt(wx * wx + wy * wy + wz * wz);
            }
            var hh = Math.sqrt(h2);
            for (var sgn = 0; sgn < 2; sgn++) {
              var s2v = sgn ? -1 : 1;
              cands.push({
                x: origin.x + a1 * ux + s2v * hh * wx / wl,
                y: origin.y + a1 * uy + s2v * hh * wy / wl,
                z: origin.z + a1 * uz + s2v * hh * wz / wl,
                ring: true
              });
            }
            if (closers.length > 1) {
              mol.notes.push(mol.atoms[child].sym + ' closes ' + closers.length +
                ' rings at once; only the first was solved, the rest are left to the refinement');
            }
          }
          var best = null;
          for (var cIdx = 0; cIdx < cands.length; cIdx++) {
            cands[cIdx].score = Builder.placeScore(mol, child, cands[cIdx], seen);
            if (!best || cands[cIdx].score < best.score) best = cands[cIdx];
          }
          mol.atoms[child].x = best.x;
          mol.atoms[child].y = best.y;
          mol.atoms[child].z = best.z;
          meta[child].placed = true;
          seen[child] = 1;
          parentOf[child] = parent;
          next.push(child);
        }
      }
      queue = next;
    }
      if (!anchored && gi > 0) {
        var shift = 6e-10 * gi;
        for (j = 0; j < group.length; j++) mol.atoms[group[j]].x += shift;
        mol.notes.push('fragment of ' + group.length + ' atoms is not bonded to fragment 0; ' +
          'placed as a separate species ' + (6 * gi).toFixed(1) + ' A away');
      }
    }
    Builder.closeRings(mol, meta, parentOf);
    var unresolvable = [];
    for (i = 0; i < mol.atoms.length; i++) {
      var s2 = steric[i];
      if (!Builder.IDEAL[s2]) unresolvable.push(mol.atoms[i].sym + ' (steric number ' + s2 + ')');
    }
    return {
      ok: true, steric: steric, lonePairs: lp,
      unsupportedStericNumbers: unresolvable,
      note: 'ideal VSEPR directions, then refined by force-field minimisation'
    };
  };

  // Cyclic layout. The ring of a molecule whose bond graph has exactly one
  // cycle is found by pruning every atom of degree one until only the cycle
  // remains, then the cycle atoms are put on a regular polygon whose side is the
  // mean of the ring bond lengths: a polygon closes by construction, which is
  // the property a bond-by-bond VSEPR walk cannot promise. The spanning tree
  // used by the rest of the builder follows the polygon round, so the substituents
  // hang off ring atoms whose directions are already known. Rings that are fused
  // or bridged, or whose atoms were given by the caller, are left to the torsion
  // scan and the minimiser and are reported there.
  Builder.placeRing = function (mol, meta, group, locked, parentOf) {
    var adj = {}, i, k;
    for (i = 0; i < group.length; i++) adj[group[i]] = [];
    for (i = 0; i < mol.bonds.length; i++) {
      var b = mol.bonds[i];
      if (b.order <= 0 || adj[b.i] === undefined || adj[b.j] === undefined) continue;
      adj[b.i].push(b.j); adj[b.j].push(b.i);
    }
    var alive = {}, deg = {}, changed = true;
    for (i = 0; i < group.length; i++) { alive[group[i]] = 1; deg[group[i]] = adj[group[i]].length; }
    while (changed) {
      changed = false;
      for (i = 0; i < group.length; i++) {
        k = group[i];
        if (!alive[k] || deg[k] > 1) continue;
        alive[k] = 0; changed = true;
        for (var q = 0; q < adj[k].length; q++) if (alive[adj[k][q]]) deg[adj[k][q]]--;
      }
    }
    var core = group.filter(function (x) { return alive[x]; });
    if (core.length < 3) return [];
    for (i = 0; i < core.length; i++) {
      if (adj[core[i]].filter(function (x) { return alive[x]; }).length !== 2) return [];
      if (locked[core[i]] || meta[core[i]].placed) return [];
    }
    var order = [core[0]], prev = -1, cur = core[0], hops = 0;
    while (hops++ <= core.length) {
      var nxt = adj[cur].filter(function (x) { return alive[x] && x !== prev; })[0];
      if (nxt === undefined) return [];
      prev = cur; cur = nxt;
      if (cur === order[0]) break;
      order.push(cur);
    }
    if (order.length !== core.length) return [];
    var sum = 0;
    for (i = 0; i < order.length; i++) {
      var nx = order[(i + 1) % order.length];
      var eb = mol.findBond(order[i], nx);
      sum += Builder.bondDistance(mol.atoms[order[i]].el, mol.atoms[nx].el, eb ? eb.order : 1);
    }
    var side = sum / order.length;
    var R = side / (2 * Math.sin(Math.PI / order.length));
    for (i = 0; i < order.length; i++) {
      var th = 2 * Math.PI * i / order.length;
      mol.atoms[order[i]].x = R * Math.cos(th);
      mol.atoms[order[i]].y = R * Math.sin(th);
      mol.atoms[order[i]].z = 0;
      meta[order[i]].placed = true;
      parentOf[order[i]] = i ? order[i - 1] : -1;
    }
    mol.notes.push(order.length + '-membered ring laid out as a closed polygon of ' +
      (side * 1e10).toFixed(3) + ' A sides, then relaxed by the minimiser');
    return order;
  };

  // Cost of putting atom idx at position p next to the atoms already placed:
  // bond-length error (weighted 3) plus the same hard-contact penalty the torsion
  // scan uses. It is a geometric selector between candidate positions, not an
  // energy - the energies are what the minimiser reports.
  Builder.placeScore = function (mol, idx, p, placed) {
    var sc = 0, rc = mol.atoms[idx].el.rcov || 1.2;
    for (var j = 0; j < mol.atoms.length; j++) {
      if (j === idx || !placed[j]) continue;
      var dx = mol.atoms[j].x - p.x, dy = mol.atoms[j].y - p.y, dz = mol.atoms[j].z - p.z;
      var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      var b = mol.findBond(idx, j);
      if (b) {
        var tg = Builder.bondDistance(mol.atoms[idx].el, mol.atoms[j].el, b.order);
        sc += 3 * Math.abs(d - tg) / tg;
        continue;
      }
      var lim = 0.75 * (rc + (mol.atoms[j].el.rcov || 1.2)) * 1e-10;
      if (d < lim) sc += 4 * (lim - d) / lim;
    }
    return sc;
  };

  // Ring closure by torsion scan. VSEPR places every atom from its own parent,
  // so the two arms of a ring can finish too far apart for the closing bond to
  // reach - and a Morse term stretched that far has almost no restoring force,
  // so minimisation cannot pull them together either. Rotating a subtree about
  // one of its own bond axes is a real conformational change (a torsion), and it
  // preserves every bond length inside the subtree, so the total bond-length
  // error can be minimised exactly over that one angle. Rings that still cannot
  // close are reported as warnings rather than left silently broken.
  Builder.closeRings = function(mol, meta, parentOf, opts) {
    opts = opts || {};
    var passes = opts.passes || 6;
    var steps = opts.steps || 72;
    var i, j, k;
    var childrenOf = mol.atoms.map(function() { return []; });
    for (i = 0; i < mol.atoms.length; i++) {
      var p = parentOf[i];
      if (p !== undefined && p >= 0) childrenOf[p].push(i);
    }
    function depth(idx) {
      var d = 0, cur = idx;
      while (parentOf[cur] >= 0 && d < 1000) { cur = parentOf[cur]; d++; }
      return d;
    }
    function subtree(idx, out) {
      out.push(idx);
      for (var c = 0; c < childrenOf[idx].length; c++) subtree(childrenOf[idx][c], out);
      return out;
    }
    function rotAbout(anchor, axis, phi, pt) {
      // Rodrigues rotation of (pt - anchor) about the unit vector `axis`
      var vx = pt.x - anchor.x, vy = pt.y - anchor.y, vz = pt.z - anchor.z;
      var c = Math.cos(phi), s = Math.sin(phi);
      var dot = axis.x * vx + axis.y * vy + axis.z * vz;
      var cx = axis.y * vz - axis.z * vy, cy = axis.z * vx - axis.x * vz, cz = axis.x * vy - axis.y * vx;
      return {
        x: anchor.x + vx * c + cx * s + axis.x * dot * (1 - c),
        y: anchor.y + vy * c + cy * s + axis.y * dot * (1 - c),
        z: anchor.z + vz * c + cz * s + axis.z * dot * (1 - c)
      };
    }
    function bondTarget(b) {
      return Builder.bondDistance(mol.atoms[b.i].el, mol.atoms[b.j].el, b.order);
    }
    function score(members, moved) {
      var pos = {}, t;
      for (t = 0; t < members.length; t++) pos[members[t]] = moved[t];
      var sc = 0;
      for (var bi = 0; bi < mol.bonds.length; bi++) {
        var b = mol.bonds[bi];
        var pa = pos[b.i] || mol.atoms[b.i], pb = pos[b.j] || mol.atoms[b.j];
        var dx = pa.x - pb.x, dy = pa.y - pb.y, dz = pa.z - pb.z;
        var L = Math.sqrt(dx * dx + dy * dy + dz * dz);
        var tg = bondTarget(b);
        sc += Math.abs(L - tg) / tg;
      }
      for (var a = 0; a < mol.atoms.length; a++) {
        for (var b2 = a + 1; b2 < mol.atoms.length; b2++) {
          if (mol.findBond(a, b2)) continue;
          var qa = pos[a] || mol.atoms[a], qb = pos[b2] || mol.atoms[b2];
          var ex = qa.x - qb.x, ey = qa.y - qb.y, ez = qa.z - qb.z;
          var de = Math.sqrt(ex * ex + ey * ey + ez * ez);
          var lim = 0.75 * (mol.atoms[a].el.rcov + mol.atoms[b2].el.rcov) * 1e-10;
          if (de < lim) sc += 4 * (lim - de) / lim;
        }
      }
      return sc;
    }
    function openBonds() {
      var bad = [];
      for (var bi = 0; bi < mol.bonds.length; bi++) {
        var b = mol.bonds[bi];
        var L = bondLength(mol.atoms[b.i], mol.atoms[b.j]);
        var tg = bondTarget(b);
        // 5 per cent, which is well inside the range the Morse term can relax in
        // a run: leaving a bond 15 per cent out and calling it closed hands a
        // strained ring to the minimiser, and strained contacts are what make
        // the dynamics throw an atom out of the molecule.
        if (Math.abs(L - tg) > 0.05 * tg) bad.push({ b: b, err: Math.abs(L - tg) });
      }
      return bad.sort(function(x, y) { return y.err - x.err; });
    }
    var remaining = [];
    for (var pass = 0; pass < passes; pass++) {
      var bad = openBonds();
      if (!bad.length) break;
      for (var q = 0; q < bad.length; q++) {
        var bb = bad[q].b;
        var deep = depth(bb.i) >= depth(bb.j) ? bb.i : bb.j;
        // Every bond above the deeper endpoint is a torsion that can bring it
        // round; a single-axis scan cannot close a six-ring whose arms are
        // splayed, so all of them are tried and the best is kept.
        var best = null, initialScore = score([], []);
        var pivot = parentOf[deep];
        while (pivot >= 0 && parentOf[pivot] >= 0) {
          var axisAtom = parentOf[pivot];
          var members = subtree(pivot, []);
          var A = mol.atoms[axisAtom], B = mol.atoms[pivot];
          var ax = B.x - A.x, ay = B.y - A.y, az = B.z - A.z;
          var an = Math.sqrt(ax * ax + ay * ay + az * az);
          if (an > 1e-12) {
            var unit = { x: ax / an, y: ay / an, z: az / an };
            var members0 = members.map(function(idx) {
              return { x: mol.atoms[idx].x, y: mol.atoms[idx].y, z: mol.atoms[idx].z };
            });
            var bestPhi = 0, bestScore = score(members, members0);
            for (var s = 1; s < steps; s++) {
              var phi = 2 * Math.PI * s / steps;
              var moved = members.map(function(idx) { return rotAbout(A, unit, phi, mol.atoms[idx]); });
              var trial = score(members, moved);
              if (trial < bestScore) { bestScore = trial; bestPhi = phi; }
            }
            if (bestPhi !== 0 && bestScore < initialScore && (!best || bestScore < best.score)) {
              best = {
                score: bestScore, phi: bestPhi, members: members, axisAtom: axisAtom, unit: unit,
                moved: members.map(function(idx) { return rotAbout(A, unit, bestPhi, mol.atoms[idx]); })
              };
            }
          }
          pivot = parentOf[pivot];
        }
        if (best) {
          for (k = 0; k < best.members.length; k++) {
            mol.atoms[best.members[k]].x = best.moved[k].x;
            mol.atoms[best.members[k]].y = best.moved[k].y;
            mol.atoms[best.members[k]].z = best.moved[k].z;
          }
        }
      }
    }
    var still = openBonds();
    for (var t = 0; t < still.length; t++) {
      var b3 = still[t].b;
      mol.warnings.push('ring bond ' + mol.atoms[b3.i].sym + b3.i + '-' + mol.atoms[b3.j].sym + b3.j +
        ' is at ' + (bondLength(mol.atoms[b3.i], mol.atoms[b3.j]) * 1e10).toFixed(3) + ' A, target ' +
        (bondTarget(b3) * 1e10).toFixed(3) + ' A: the graph needs a conformation the torsion scan ' +
        'could not reach (fused or bridged ring)');
    }
    return { ok: still.length === 0, openRings: still.length };
  };


  // the lone-pair slots removed, rotated so that the direction back to the atom
  // it was placed from lines up with a retained slot.
  Builder.slotsFor = function(idx, steric, lp, mol, parentOf) {
    var sn = steric[idx];
    var vecs = (Builder.IDEAL[sn] || Builder.IDEAL[4]).map(function(v) { return v.slice(); });
    var loneSlots = VSEPR.loneOrder[sn] ? VSEPR.loneOrder[sn].slice(0, lp[idx]) : [];
    var occupied = [];
    for (var s = 0; s < vecs.length; s++) if (loneSlots.indexOf(s) < 0) occupied.push(s);
    var parent = parentOf ? parentOf[idx] : undefined;
    var from = { x: mol.atoms[idx].x, y: mol.atoms[idx].y, z: mol.atoms[idx].z };
    var rot = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    if (parent >= 0 && parent !== idx) {
      var to = { x: mol.atoms[parent].x - from.x, y: mol.atoms[parent].y - from.y, z: mol.atoms[parent].z - from.z };
      var u = vunit(to);
      if (u.x === 0 && u.y === 0 && u.z === 0) return { vecs: vecs, free: occupied, rot: rot };
      // the bond arriving from the parent takes the slot furthest round the
      // ring, so the remaining slots keep their relative arrangement
      var anchorSlot = occupied.length ? occupied[occupied.length - 1] : 0;
      var e = { x: vecs[anchorSlot][0], y: vecs[anchorSlot][1], z: vecs[anchorSlot][2] };
      rot = rotationFromTo(e, u);
      occupied = occupied.filter(function(x) { return x !== anchorSlot; });
    }
    return { vecs: vecs, free: occupied, rot: rot };
  };

  // Sigma-bonded neighbours beyond two define the angle terms; three define
  // torsions. Built from the graph, not from a template.
  // A four-point dihedral is the angle between the i-j-k and j-k-l planes. If
  // either of those planes does not exist - the outer bond running along the
  // j-k axis, which is what a 180 deg angle at j or k means - the torsion has no
  // value, and a small nudge of the geometry makes it jump by pi.
  var TORSION_MAX_ANGLE_DEG = 155;
  function dihedralDegenerate(mol, I, J, K, L) {
    var lim = TORSION_MAX_ANGLE_DEG * Math.PI / 180;
    return angleValue(mol.atoms[I], mol.atoms[J], mol.atoms[K]) > lim ||
      angleValue(mol.atoms[J], mol.atoms[K], mol.atoms[L]) > lim;
  }

  Builder.connectValences = function(mol) {
    var i, j, k;
    for (i = 0; i < mol.atoms.length; i++) {
      var nb = mol.neighborsOf(i);
      for (j = 0; j < nb.length; j++) {
        for (k = j + 1; k < nb.length; k++) {
          var exists = mol.angles.some(function(a) {
            return a.j === i && ((a.i === nb[j] && a.k === nb[k]) || (a.i === nb[k] && a.k === nb[j]));
          });
          if (!exists) mol.addAngle(nb[j], i, nb[k]);
        }
      }
    }
    for (i = 0; i < mol.bonds.length; i++) {
      var b = mol.bonds[i];
      var nbi = mol.neighborsOf(b.i), nbj = mol.neighborsOf(b.j);
      for (j = 0; j < nbi.length; j++) {
        if (nbi[j] === b.j) continue;
        for (k = 0; k < nbj.length; k++) {
          if (nbj[k] === b.i) continue;
          // A dihedral is the angle between two planes, so it needs both outer
          // atoms off the axis. When the angle at either end reaches 180 deg the
          // outer atom lies ON the j-k axis, the torsion has no value, and its
          // derivative is a division by zero: HC#CH's H-C-C-H is that case and
          // stepping it made the whole field non-conservative (an NVE run lost
          // 57% of one atom's force to it). Standard force fields drop these
          // torsions, and so does this one - the resistance to bending that
          // centre has is already carried by its angle term.
          if (dihedralDegenerate(mol, nbi[j], b.i, b.j, nbj[k])) continue;
          var have = mol.torsions.some(function(t) {
            return (t.j === b.i && t.k === b.j && ((t.i === nbi[j] && t.l === nbj[k]) || (t.i === nbj[k] && t.l === nbi[j])));
          });
          if (!have) mol.addTorsion(nbi[j], b.i, b.j, nbj[k]);
        }
      }
    }
    // planarity for every three-coordinate centre with no lone pair
    for (i = 0; i < mol.atoms.length; i++) {
      var n3 = mol.neighborsOf(i);
      if (n3.length !== 3) continue;
      var ang = 0, cnt = 0;
      for (j = 0; j < n3.length; j++) for (k = j + 1; k < n3.length; k++) { ang += angleValue(mol.atoms[n3[j]], mol.atoms[i], mol.atoms[n3[k]]); cnt++; }
      if (cnt && ang / Math.max(1, cnt) * 180 / Math.PI > 118 && !mol.impropers.some(function(x) { return x.i === i; })) {
        mol.addImproper(i, n3[0], n3[1], n3[2], 0, 110);
      }
    }
  };

  Builder.shapes = function(mol, meta) {
    var out2 = [];
    for (var i = 0; i < mol.atoms.length; i++) {
      var nb = mol.neighborsOf(i);
      if (!nb.length) continue;
      var sum = 0, cnt = 0;
      for (var j = 0; j < nb.length; j++) for (var k = j + 1; k < nb.length; k++) { sum += angleValue(mol.atoms[nb[j]], mol.atoms[i], mol.atoms[nb[k]]) * 180 / Math.PI; cnt++; }
      out2.push({
        index: i, sym: mol.atoms[i].sym, coordination: nb.length,
        meanAngle: cnt ? sum / cnt : null,
        classified: nb.length === 2 ? (cnt && sum > 170 ? 'linear' : 'bent') :
          nb.length === 3 ? (sum / Math.max(1, cnt) > 118 ? 'trigonal planar' : 'trigonal pyramidal') :
            nb.length === 4 ? 'tetrahedral' : nb.length + '-coordinate'
      });
    }
    return out2;
  };

  Builder.formula = function(mol) {
    var counts = {};
    for (var i = 0; i < mol.atoms.length; i++) {
      var s = mol.atoms[i].sym;
      if (counts[s] === undefined) counts[s] = 0;
      counts[s]++;
    }
    // Hill system: with carbon present the order is C, H, then the rest
    // alphabetically; without carbon EVERYTHING including hydrogen is
    // alphabetical, so HF is FH and HCl is ClH.
    var syms = Object.keys(counts);
    var hill;
    if (counts.C) {
      hill = ['C'].concat(counts.H ? ['H'] : []).concat(syms.filter(function(s) { return s !== 'C' && s !== 'H'; }).sort());
    } else {
      hill = syms.sort();
    }
    var seen = {}, text = '';
    hill.forEach(function(s) {
      if (seen[s]) return; seen[s] = 1;
      text += s + (counts[s] > 1 ? counts[s] : '');
    });
    var q = Math.round((mol.charge || 0) / CONST.e);
    return { text: text, charge: q, display: text + (q > 0 ? '+' + (q === 1 ? '' : q) : (q < 0 ? (q === -1 ? '' : q) + '-' : '')), counts: counts };
  };

  // ============================== PHASE 7 ==============================
  // Reactive chemistry: bonds form and break from the interatomic geometry.
  //
  // This is a bond-order switching layer on top of the classical force field of
  // Phases 2-5. It is NOT ReaxFF: ReaxFF needs ~30 fitted parameters per element
  // (over/under-coordination, the BO polynomial, the polarisable EN terms) and no
  // published set is shipped with this engine, so nothing here is labelled ReaxFF.
  // The bond order itself uses Pauling's measured bond-length/bond-order relation
  //   d(n) = d(1) - 0.71 log10(n)   =>   n(d) = 10^((d1 - d)/0.71)
  // and the bond term uses the Morse potential, which already goes to zero as the
  // pair separates, so dissociation does not need a discontinuous switch.
  // A pair in which each atom still has bonding capacity left, with no bond
  // path between its two atoms, is evaluated on the measured Morse curve of the
  // molecule it would form instead of on a Lennard-Jones core (see
  // Molecule.computeForces, options.pairBondCurve) - otherwise the 12-6 wall and
  // the formation rule contradict each other and no bond can ever be created by
  // the dynamics.
  var Reactive = {};

  // Pauling's relation is written against the single-bond length d(1), so that
  // is always the reference here; the candidate order only decides which
  // tabulated d(1) to use when a pair has no measured single-bond entry.
  Reactive.bondOrder = function(elA, elB, r_m) {
    return paulingBondOrder(elA.sym, elB.sym, r_m);
  };

  // Total bond order already carried by two atoms, from the current graph.
  function bondOrderSums(mol, i, j) {
    var s = { i: 0, j: 0 };
    for (var b = 0; b < mol.bonds.length; b++) {
      var x = mol.bonds[b];
      if (x.i === i || x.j === i) s.i += x.order;
      if (x.i === j || x.j === j) s.j += x.order;
    }
    return s;
  }

  // Relative energy of a pair on the curve that binds it: the kinetic energy of
  // their approach plus the potential, measured against separated atoms at rest.
  // Negative means the pair cannot reach infinity, so a bond exists.
  function pairEnergy(a, b, u_J) {
    var mu = a.m * b.m / (a.m + b.m);
    var vrx = a.vx - b.vx, vry = a.vy - b.vy, vrz = a.vz - b.vz;
    return 0.5 * mu * (vrx * vrx + vry * vry + vrz * vrz) + u_J;
  }

  Reactive.defaults = function() {
    return {
      formOrder: 0.40,        // Pauling bond order at which a bound pair is recorded
      formDwell: 3,           // consecutive steps a candidate must hold
      breakDwell: 6,          // slower to forget a bond than to make one
      conserveEnergy: true
    };
  };

  // One reactive system per molecule: it owns the bond-order counters and the
  // event ledger. step() is on the prototype so a long run does not rebuild it.
  function ReactiveSystem(mol, dyn, cfg) {
    this.mol = mol; this.dyn = dyn; this.cfg = cfg;
    this.counters = {};
    this.events = [];
    this.ledger = { topologyWork: 0, formed: 0, broken: 0, rejected: 0, lastRejection: null,
      conserved: true, unpaidHeat: 0, momentumResidual: 0, bathHeat: 0 };
    this.enabled = true;
    this.history = [];
  }

  Reactive.create = function(mol, dyn, opts) {
    opts = opts || {};
    var d = Reactive.defaults();
    for (var k in opts) d[k] = opts[k];
    // The reactive layer owns the bond-curve switch: a classical run without it
    // keeps the force field exactly as fitted.
    mol.options.pairBondCurve = true;
    if (!mol.componentId) mol.buildExclusions();
    mol.buildBondCurveTable();
    mol.computeForces();
    // The surface changed from under the integrator, so its energy window is
    // re-set here rather than left to report the switch itself as a drift.
    if (dyn) dyn.eRef = null;
    return new ReactiveSystem(mol, dyn, d);
  };

  // Energy and momentum-preserving heat disposal: the bookkeeping difference
  // created by switching a bond term on or off is returned to the pair as
  // relative motion, with the total linear momentum unchanged.
  //
  // The change is made in the centre-of-mass frame, where the pair's kinetic
  // energy is exactly 1/2 mu |v_rel|^2: the relative velocity keeps its
  // direction and only its magnitude moves, so the energy handed over is the
  // amount asked for and nothing else. Setting the relative velocity to a fresh
  // vector along the line of centres instead would add or remove the projection
  // of the motion the pair already had, which is not the bookkeeping term.
  function addHeatToPair(mol, i, j, dU) {
    var a = mol.atoms[i], b = mol.atoms[j];
    if (!(dU > 0)) return 0;
    var mu = a.m * b.m / (a.m + b.m);
    var vrx = a.vx - b.vx, vry = a.vy - b.vy, vrz = a.vz - b.vz;
    var v2 = vrx * vrx + vry * vry + vrz * vrz;
    var scale;
    if (v2 > 0) {
      scale = Math.sqrt((2 * dU / mu + v2) / v2);
    } else {
      // No direction of approach to keep, so use the line of centres; with the
      // pair momentarily at rest relative to each other that is still exact.
      var u = vunit(delta(a, b));
      var vRel = Math.sqrt(2 * dU / mu);
      vrx = u.x * vRel; vry = u.y * vRel; vrz = u.z * vRel;
      v2 = vRel * vRel;
      scale = 1;
    }
    var nvx = vrx * scale, nvy = vry * scale, nvz = vrz * scale;
    var cmx = (a.m * a.vx + b.m * b.vx) / (a.m + b.m);
    var cmy = (a.m * a.vy + b.m * b.vy) / (a.m + b.m);
    var cmz = (a.m * a.vz + b.m * b.vz) / (a.m + b.m);
    a.vx = cmx + (b.m / (a.m + b.m)) * nvx; a.vy = cmy + (b.m / (a.m + b.m)) * nvy; a.vz = cmz + (b.m / (a.m + b.m)) * nvz;
    b.vx = cmx - (a.m / (a.m + b.m)) * nvx; b.vy = cmy - (a.m / (a.m + b.m)) * nvy; b.vz = cmz - (a.m / (a.m + b.m)) * nvz;
    return dU;
  }

  // Remove every valence term that used the broken bond as one of its legs.
  // Angles are indexed by their central atom (j), torsions by their central bond
  // (j-k) and impropers by their centre (i) with ligands j, k, l. Builder
  // .connectValences then rebuilds whatever the new topology still supports.
  function dropValenceTerms(mol, P, Q) {
    var pair = function(x, y) { return (x === P && y === Q) || (x === Q && y === P); };
    mol.angles = mol.angles.filter(function(a) {
      return !(pair(a.j, a.i) || pair(a.j, a.k));
    });
    mol.torsions = mol.torsions.filter(function(t) {
      return !(pair(t.i, t.j) || pair(t.j, t.k) || pair(t.k, t.l));
    });
    mol.impropers = mol.impropers.filter(function(x) {
      return !(pair(x.i, x.j) || pair(x.i, x.k) || pair(x.i, x.l));
    });
  }

  ReactiveSystem.prototype.step = function() {
    if (!this.enabled) return [];
    var mol = this.mol, cfg = this.cfg, A = mol.atoms, i, j;
    var events = [];
    var beforeE = mol.lastEnergy ? mol.lastEnergy.total : mol.computeForces().total;
    var momentumBefore = totalMomentum(mol);

    // ---- breaking: the record of a bond is dropped when the pair can reach
    // infinity, i.e. its relative energy on its own bond curve is no longer
    // negative. A stretched but still bound pair keeps its bond, which is what
    // a vibrationally excited molecule does.
    for (i = mol.bonds.length - 1; i >= 0; i--) {
      var b = mol.bonds[i];
      var a1 = A[b.i], a2 = A[b.j];
      var r = bondLength(a1, a2);
      var n = Reactive.bondOrder(a1.el, a2.el, r);
      var key = 'b' + b.i + '-' + b.j;
      var weak = pairEnergy(a1, a2, Potentials.morse(r, b.re, b.De, b.k).energy) >= 0;
      this.counters[key] = weak ? (this.counters[key] || 0) + 1 : 0;
      if (this.counters[key] >= cfg.breakDwell) {
        delete this.counters[key];
        mol.bonds.splice(i, 1);
        dropValenceTerms(mol, b.i, b.j);
        events.push({ type: 'break', i: b.i, j: b.j, pair: A[b.i].sym + '-' + A[b.j].sym, order: n });
        mol.dirtyTopology = true;
      }
    }

    // ---- forming: a pair is recorded once it is bound on its bond curve and
    // Pauling's relation gives it a real order at that length. Only pairs in the
    // bond-curve table are candidates - if either centre has no unpartnered
    // electron there is no bonding surface for it, and the pair stays the
    // dispersion interaction the classical force field already describes.
    for (i = 0; i < A.length; i++) {
      for (j = i + 1; j < A.length; j++) {
        if (mol.findBond(i, j)) continue;
        var c2 = mol.bondCurve ? mol.bondCurve[pairKey(i, j)] : null;
        if (!c2) continue;
        var r2 = bondLength(A[i], A[j]);
        // A candidate needs two things: Pauling's length relation must give the
        // contact a real order, and the pair must be inside its well once the
        // kinetic energy of the approach is counted. There is no separate
        // distance cutoff: n(d) >= formOrder is equivalent to
        // d <= d1 + 0.71 log10(1 / formOrder), so the length a pair may be
        // recorded at comes out of the same relation that measures its bond
        // order and moves with the tabulated single-bond length of that pair.
        var nForm = Reactive.bondOrder(A[i].el, A[j].el, r2);
        var k2 = 'f' + i + '-' + j;
        var ready = nForm !== null && nForm >= cfg.formOrder &&
          pairEnergy(A[i], A[j], Potentials.morse(r2, c2.re, c2.De, c2.k).energy) < 0;
        this.counters[k2] = ready ? (this.counters[k2] || 0) + 1 : 0;
        if (this.counters[k2] < cfg.formDwell) continue;
        if (nForm === null) { this.counters[k2] = 0; continue; }
        var limI = Builder.maxBondOrderSum(A[i].el), limJ = Builder.maxBondOrderSum(A[j].el);
        var sums = bondOrderSums(mol, i, j);
        // The pair is bound in the well of curve c2, so the graph bond must be
        // booked with that same order. Taking the order from Pauling's length
        // relation instead can disagree with the well the pair actually fell
        // into - N atoms colliding at 1.30 A sit 945 kJ/mol deep on the triple
        // curve while n(d) there is only 1.5 - and the switch from curve to bond
        // would then have to hand back the difference as heat, which promptly
        // throws the pair apart again. Pauling's n stays in the event as the
        // measured order of the contact, and it still gates formation above.
        var hi = c2.order ? c2.order : Math.max(1, Math.min(3, Math.round(nForm)));
        var best = 0;
        for (var ord = hi; ord >= 1; ord--) {
          if (!bondParams(A[i].sym, A[j].sym, ord)) continue;
          if (limI !== null && sums.i + ord > limI + 1e-9) continue;
          if (limJ !== null && sums.j + ord > limJ + 1e-9) continue;
          best = ord; break;
        }
        if (!best) {
          // The pair is close enough to bond but no integer order fits both
          // valence caps. That is a real rejection with a reason, so it is
          // booked rather than quietly dropped with the counter.
          this.ledger.rejected++;
          this.ledger.lastRejection = A[i].sym + '#' + i + '–' + A[j].sym + '#' + j +
            ': its bonding curve is order ' + hi + ' (Pauling n = ' + nForm.toFixed(2) +
            ') and even a single bond does not fit, because ' +
            (limI !== null && sums.i + 1 > limI + 1e-9 ? A[i].sym : A[j].sym) + ' is already saturated';
          this.counters[k2] = 0;
          continue;
        }
        delete this.counters[k2];
        var made = mol.addBond(i, j, best);
        if (!made) {
          this.ledger.rejected++;
          this.ledger.lastRejection = A[i].sym + '#' + i + '–' + A[j].sym + '#' + j +
            ': the bond table refused order ' + best + ' (addBond returned nothing)';
          this.counters[k2] = 0;
          continue;
        }
        events.push({ type: 'form', i: i, j: j, pair: A[i].sym + '-' + A[j].sym, order: made.order, paulingOrder: nForm });
        mol.dirtyTopology = true;
      }
    }

    if (events.length) {
      Builder.connectValences(mol);
      mol.buildExclusions();
      mol.buildVdwTable();
      mol.buildBondCurveTable();
      if (mol.polarization) mol.polarization.stale = true;
      var afterE = mol.computeForces().total;
      var dU = afterE - beforeE;
      // A bond appearing at contact distance lowers U; that deficit must re-enter
      // the system as motion, otherwise the reaction would destroy energy. The
      // switch-on bookkeeping is only known for the whole step, so the amount is
      // shared equally between the pairs whose topology changed. Total linear
      // momentum is unchanged either way.
      if (cfg.conserveEnergy && dU !== 0) {
        var share = dU / events.length;
        var unpaid = 0;
        for (var e2 = 0; e2 < events.length; e2++) {
          var ev = events[e2];
          if (share < 0) addHeatToPair(mol, ev.i, ev.j, -share);
          else if (!removeHeatFromPair(mol, ev.i, ev.j, share)) unpaid += share;
        }
        // A pair that cannot service the difference on its own hands the debt to
        // every other degree of freedom in the system, which is what a collision
        // partner does when it carries away the energy of a forming bond.
        if (unpaid > 0) {
          var owed = unpaid;
          unpaid = payFromInternal(mol, owed);
          this.ledger.bathHeat += owed - unpaid;
        }
        this.ledger.topologyWork += dU;
        this.ledger.unpaidHeat += unpaid;
        if (unpaid) this.ledger.conserved = false;
      }
      var momentumAfter = totalMomentum(mol);
      this.ledger.formed += events.filter(function(e) { return e.type === 'form'; }).length;
      this.ledger.broken += events.filter(function(e) { return e.type === 'break'; }).length;
      this.ledger.momentumResidual = Math.abs(vlen(momentumAfter) - vlen(momentumBefore));
      if (this.dyn) this.dyn.eRef = null;    // re-baseline the drift monitor
      this.history.push({ step: this.dyn ? this.dyn.steps : 0, events: events, dU: dU });
      if (this.history.length > 200) this.history.shift();
    }
    this.events = events;
    return events;
  };

  function removeHeatFromPair(mol, i, j, dU) {
    var a = mol.atoms[i], b = mol.atoms[j];
    var mu = a.m * b.m / (a.m + b.m);
    var vrx = a.vx - b.vx, vry = a.vy - b.vy, vrz = a.vz - b.vz;
    var Krel = 0.5 * mu * (vrx * vrx + vry * vry + vrz * vrz);
    if (Krel <= dU) return false;     // not enough relative motion to pay for it
    var scale = Math.sqrt((Krel - dU) / Krel);
    var nvx = vrx * scale, nvy = vry * scale, nvz = vrz * scale;
    // keep the centre-of-mass velocity untouched, so total momentum is unchanged
    var cmx = (a.m * a.vx + b.m * b.vx) / (a.m + b.m);
    var cmy = (a.m * a.vy + b.m * b.vy) / (a.m + b.m);
    var cmz = (a.m * a.vz + b.m * b.vz) / (a.m + b.m);
    a.vx = cmx + (b.m / (a.m + b.m)) * nvx; a.vy = cmy + (b.m / (a.m + b.m)) * nvy; a.vz = cmz + (b.m / (a.m + b.m)) * nvz;
    b.vx = cmx - (a.m / (a.m + b.m)) * nvx; b.vy = cmy - (a.m / (a.m + b.m)) * nvy; b.vz = cmz - (a.m / (a.m + b.m)) * nvz;
    return true;
  }

  // What the reacting pair could not pay, the rest of the system absorbs: the
  // velocities are rescaled about the centre of mass, so the internal (thermal)
  // kinetic energy changes by exactly the amount asked for while total linear
  // momentum is untouched. That is the third body which stabilises a nascent
  // bond in a condensate. Returns whatever is left after the system has given up
  // all the internal motion it has - nothing here is silently clamped.
  function payFromInternal(mol, dU) {
    var A = mol.atoms, n = A.length;
    if (!(dU > 0) || n === 0) return dU > 0 ? dU : 0;
    var mtot = 0, i;
    var cm = { x: 0, y: 0, z: 0 };
    for (i = 0; i < n; i++) {
      mtot += A[i].m;
      cm.x += A[i].m * A[i].vx; cm.y += A[i].m * A[i].vy; cm.z += A[i].m * A[i].vz;
    }
    cm.x /= mtot; cm.y /= mtot; cm.z /= mtot;
    var dvx = new Array(n), dvy = new Array(n), dvz = new Array(n), kInt = 0;
    for (i = 0; i < n; i++) {
      var ax = A[i].vx - cm.x, ay = A[i].vy - cm.y, az = A[i].vz - cm.z;
      dvx[i] = ax; dvy[i] = ay; dvz[i] = az;
      kInt += 0.5 * A[i].m * (ax * ax + ay * ay + az * az);
    }
    if (kInt <= dU) {
      for (i = 0; i < n; i++) { A[i].vx = cm.x; A[i].vy = cm.y; A[i].vz = cm.z; }
      return dU - kInt;
    }
    var s = Math.sqrt((kInt - dU) / kInt);
    for (i = 0; i < n; i++) {
      A[i].vx = cm.x + s * dvx[i]; A[i].vy = cm.y + s * dvy[i]; A[i].vz = cm.z + s * dvz[i];
    }
    return 0;
  }

  function totalMomentum(mol) {
    var A = mol.atoms, p = { x: 0, y: 0, z: 0 };
    for (var i = 0; i < A.length; i++) {
      p.x += A[i].m * A[i].vx; p.y += A[i].m * A[i].vy; p.z += A[i].m * A[i].vz;
    }
    return p;
  }

  // ============================== PHASE 7.3 ==============================
  var Conservation = {};

  Conservation.snapshot = function(mol) {
    var counts = {}, q = 0, m = 0;
    for (var i = 0; i < mol.atoms.length; i++) {
      counts[mol.atoms[i].sym] = (counts[mol.atoms[i].sym] || 0) + 1;
      q += mol.atoms[i].q;
      m += mol.atoms[i].m;
    }
    return {
      counts: counts, nuclei: mol.atoms.length, charge: q, mass: m,
      bonds: mol.bonds.length,
      energy: (mol.lastKinetic || 0) + (mol.lastEnergy ? mol.lastEnergy.total : 0)
    };
  };

  // 7.3 Every reaction must preserve sum(N_atoms) and Q.
  Conservation.check = function(before, after) {
    var problems = [];
    var keys = {};
    for (var k1 in before.counts) keys[k1] = 1;
    for (var k2 in after.counts) keys[k2] = 1;
    for (var key in keys) {
      var b = before.counts[key] || 0, a = after.counts[key] || 0;
      if (b !== a) problems.push(key + ': ' + b + ' -> ' + a + ' atoms');
    }
    if (Math.abs(before.charge - after.charge) > 1e-24) problems.push('charge ' + before.charge.toExponential(3) + ' -> ' + after.charge.toExponential(3) + ' C');
    if (Math.abs(before.mass - after.mass) > before.mass * 1e-12) problems.push('mass drift');
    return {
      ok: problems.length === 0,
      problems: problems,
      atomCount: { before: before.nuclei, after: after.nuclei },
      chargeC: { before: before.charge, after: after.charge },
      charge_e: { before: before.charge / CONST.e, after: after.charge / CONST.e },
      energyJ: { before: before.energy, after: after.energy },
      energyDeltaKJmol: before.energy !== undefined && after.energy !== undefined ? (after.energy - before.energy) * CONST.N_A / 1000 : null
    };
  };

  // ============================== PHASE 11 ==============================
  // Scene bridge, live readout and validation battery.
  //
  // Nothing in this section computes a physical quantity. It moves data between
  // the 3D scene and the calculations above, formats what those calculations
  // returned, and checks the engine against reference results. The scene keeps
  // positions in world units, the engine in metres, and the conversion happens
  // here and nowhere else.

  var SceneBridge = {};

  // chemistry.js builds every bond length as (radius_A + radius_B)/55 with the
  // radii in pm, so one world unit is 55 pm = 0.55 A = 5.5e-11 m.
  SceneBridge.WORLD_UNIT_ANGSTROM = SCENE_UNIT_ANGSTROM;
  SceneBridge.WORLD_UNIT_M = SCENE_UNIT_ANGSTROM * ANGSTROM;
  SceneBridge.toMetres = function(u) { return u * SceneBridge.WORLD_UNIT_M; };
  SceneBridge.toWorld = function(m) { return m / SceneBridge.WORLD_UNIT_M; };

  SceneBridge.app = function() {
    return (typeof window !== 'undefined' && window.__mol3d) ? window.__mol3d : null;
  };

  SceneBridge.available = function() {
    var a = SceneBridge.app();
    return !!(a && a.atoms && typeof a.atoms.size === 'number' && a.atoms.size > 0);
  };

  // The environment tab drives the app's own kinetics engine; that is the single
  // temperature the scene knows about, so the engine reads it instead of inventing
  // a 298 K default when the user has changed it.
  SceneBridge.temperatureK = function() {
    var a = SceneBridge.app(), T = 298.15, source = '298.15 K (no environment setting found)';
    try {
      var k = a && a.simulation && a.simulation.kinetics;
      if (k) {
        var v = typeof k.getGlobalTemperature === 'function' ? k.getGlobalTemperature() : k.globalTemperature;
        if (typeof v === 'number' && isFinite(v) && v > 0) { T = v; source = 'environment tab (simulation.kinetics)'; }
      }
    } catch (e) { /* an unreadable app engine falls back to the stated default */ }
    return { K: T, source: source };
  };

  // Connected components of the scene graph. The app already computes them; the
  // breadth-first fallback keeps the bridge working on builds that do not expose
  // comps(), and it groups by bonds only, so two molecules that merely touch are
  // still treated as separate species (which is what the fragment solver assumes).
  // Both branches answer with bond ids: app.comps() hands back the bond records
  // themselves, which would not look up in app.bonds.
  SceneBridge.components = function(app) {
    if (app && typeof app.comps === 'function') {
      try {
        var c = app.comps();
        if (Array.isArray(c) && c.length) return c.map(function(comp) {
          var out = {}, k;
          for (k in comp) if (Object.prototype.hasOwnProperty.call(comp, k)) out[k] = comp[k];
          out.atoms = comp.atoms || [];
          out.bonds = (comp.bonds || []).map(function(b) { return b && typeof b === 'object' ? b.id : b; });
          return out;
        });
      } catch (e) { /* fall through to the local grouping */ }
    }
    var ids = [];
    if (!app || !app.atoms) return [];
    if (typeof app.atoms.keys === 'function') { ids = Array.from(app.atoms.keys()); }
    else if (app.atoms instanceof Map) { app.atoms.forEach(function(v, k) { ids.push(k); }); }
    var adj = {}, list = [];
    if (app.bonds && typeof app.bonds.forEach === 'function') {
      app.bonds.forEach(function(b) {
        (adj[b.a] = adj[b.a] || []).push(b);
        (adj[b.b] = adj[b.b] || []).push(b);
      });
    }
    var seen = {};
    for (var i = 0; i < ids.length; i++) {
      if (seen[ids[i]]) continue;
      var comp = { atoms: [], bonds: [] }, queue = [ids[i]], guard = 0;
      seen[ids[i]] = 1;
      while (queue.length && guard++ < 100000) {
        var cur = queue.shift();
        comp.atoms.push(cur);
        var bs = adj[cur] || [];
        for (var b = 0; b < bs.length; b++) {
          var bd = bs[b], key = bd.id;
          if (comp.bonds.indexOf(key) < 0) comp.bonds.push(key);
          var other = bd.a === cur ? bd.b : bd.a;
          if (!seen[other]) { seen[other] = 1; queue.push(other); }
        }
      }
      list.push(comp);
    }
    return list;
  };

  // One scene read: every connected species becomes an engine molecule with the
  // geometry the user built. optimize:false keeps the structure exactly as placed
  // - the analysis then describes the scene, not a relaxed copy of it.
  // A system that could not be read still has to answer every question the
  // panel asks, otherwise an empty scene crashes the render instead of
  // reporting that there is nothing to analyse.
  function emptySystem(reason) {
    return {
      ok: false,
      reason: reason,
      molecules: [],
      problems: [],
      temperature: SceneBridge.temperatureK(),
      chargeSource: 'no species read from the scene',
      unitNote: 'scene unit = ' + (SceneBridge.WORLD_UNIT_M * 1e12).toFixed(1) + ' pm (chemistry.js bond convention)',
      atomCount: 0
    };
  }

  SceneBridge.system = function(opts) {
    opts = opts || {};
    var app = SceneBridge.app();
    if (!app) return emptySystem('the 3D scene is not exposed (window.__mol3d is absent)');
    if (!app.atoms || !app.atoms.size) return emptySystem('the scene has no atoms');
    var comps = SceneBridge.components(app);
    var analyses = [];
    try { if (typeof app.analyses === 'function') analyses = app.analyses() || []; } catch (e) { analyses = []; }
    var out = [], problems = [], chargeSource = 'no per-component charge found in the scene, every species read as neutral';
    if (analyses.length === comps.length && analyses.length) chargeSource = 'ion charge set in the scene Format menu';
    for (var c = 0; c < comps.length; c++) {
      var comp = comps[c], ids = comp.atoms || [], bondIds = comp.bonds || [];
      var spec = { atoms: [], bonds: [], charge: 0 };
      var idOf = [], index = {};
      for (var i = 0; i < ids.length; i++) {
        var rec = typeof app.atoms.get === 'function' ? app.atoms.get(ids[i]) : null;
        if (!rec) { problems.push('atom ' + ids[i] + ' left the scene while reading'); continue; }
        if (!rec.el || !rec.el.sym) { problems.push('atom ' + rec.id + ' has no element data'); continue; }
        index[rec.id] = spec.atoms.length;
        idOf.push(rec.id);
        spec.atoms.push({
          sym: rec.el.sym,
          pos: {
            x: SceneBridge.toMetres(rec.pos.x),
            y: SceneBridge.toMetres(rec.pos.y),
            z: SceneBridge.toMetres(rec.pos.z)
          }
        });
      }
      if (analyses.length === comps.length && analyses[c] && typeof analyses[c].charge === 'number') {
        spec.charge = analyses[c].charge;
      }
      for (var k = 0; k < bondIds.length; k++) {
        var bd = typeof app.bonds.get === 'function' ? app.bonds.get(bondIds[k]) : null;
        if (!bd) { problems.push('bond ' + bondIds[k] + ' left the scene while reading'); continue; }
        if (index[bd.a] === undefined || index[bd.b] === undefined) { problems.push('bond ' + bd.id + ' points outside its component'); continue; }
        spec.bonds.push([index[bd.a], index[bd.b], bd.order || 1]);
      }
      if (!spec.atoms.length) continue;
      var built = Builder.build(spec, {
        optimize: opts.optimize === true, charges: opts.charges !== false, eem: opts.eem
      });
      if (!built.ok) {
        problems.push(spec.atoms.map(function(s) { return s.sym; }).join('') + ': ' + built.reason);
        continue;
      }
      built.mol.sceneIds = idOf;
      built.mol.sceneIndex = out.length;
      built.sceneIds = idOf;
      built.sceneCharge = spec.charge;
      out.push(built);
    }
    return {
      ok: out.length > 0,
      molecules: out,
      problems: problems,
      temperature: SceneBridge.temperatureK(),
      chargeSource: chargeSource,
      unitNote: 'scene unit = ' + (SceneBridge.WORLD_UNIT_M * 1e12).toFixed(1) + ' pm (chemistry.js bond convention)',
      atomCount: out.reduce(function(s, b) { return s + b.mol.atoms.length; }, 0)
    };
  };

  // Write engine coordinates back into the scene. Positions only: atoms are never
  // created, deleted or re-bonded here, so the app's own spawning and valence
  // rules stay in charge of the topology.
  SceneBridge.sync = function(mol) {
    var app = SceneBridge.app();
    if (!app || !mol || !mol.sceneIds) return { ok: false, reason: 'nothing to write back' };
    var moved = 0, missing = 0, rejected = 0, outside = 0;
    var half = app.worldHalf;
    for (var i = 0; i < mol.sceneIds.length && i < mol.atoms.length; i++) {
      var rec = typeof app.atoms.get === 'function' ? app.atoms.get(mol.sceneIds[i]) : null;
      if (!rec) { missing++; continue; }
      var a = mol.atoms[i];
      var wx = SceneBridge.toWorld(a.x), wy = SceneBridge.toWorld(a.y), wz = SceneBridge.toWorld(a.z);
      // A diverged coordinate written into the scene is permanent: it renders as a
      // bond cylinder stretching across the world, survives save/reload, and every
      // later calculation inherits it. The step failed, so it does not get written.
      if (!isFinite(wx) || !isFinite(wy) || !isFinite(wz)) { rejected++; continue; }
      // A finite-but-absurd coordinate does the same damage, so the write is held to
      // the volume the scene actually renders - the app's own grid, not a new number.
      if (isFinite(half) && (Math.abs(wx) > half || Math.abs(wy) > half || Math.abs(wz) > half)) { outside++; continue; }
      rec.pos.x = wx;
      rec.pos.y = wy;
      rec.pos.z = wz;
      moved++;
    }
    try { if (typeof app.reanalyze === 'function') app.reanalyze(); } catch (e) { /* the scene will reanalyse on its next edit */ }
    try { if (typeof app.invalidate === 'function') app.invalidate(); } catch (e) { /* on-demand redraw is a nicety */ }
    return {
      ok: missing === 0 && rejected === 0 && outside === 0,
      moved: moved, missing: missing, rejected: rejected, outside: outside,
      reason: rejected ? rejected + ' atom positions were not finite'
        : outside ? outside + ' atom positions fell outside the rendered world'
        : missing ? missing + ' atoms left the scene' : ''
    };
  };

  // ============================== PHASE 11.2 ==============================
  // The calculation layer the panel reads. It holds one Dynamics/Reactive pair
  // per species so a running simulation is not rebuilt every repaint, and every
  // method returns the raw object a Phase produced - no formatting, no fallbacks.
  var Engine = {};

  Engine.state = { system: null, sel: 0, runs: {}, reloads: 0, lastError: null,
    dt: 5e-16, ensemble: 'NVE', reactive: false };

  Engine.reload = function(opts) {
    var sys = SceneBridge.system(opts);
    Engine.state.system = sys;
    Engine.state.runs = {};
    Engine.state.reloads++;
    if (Engine.state.sel >= sys.molecules.length) Engine.state.sel = 0;
    return sys;
  };

  Engine.system = function(opts) {
    if (!Engine.state.system || opts === 'force') Engine.reload(opts);
    return Engine.state.system;
  };

  Engine.current = function() {
    var sys = Engine.system();
    if (!sys.molecules.length) return null;
    var i = Math.min(Engine.state.sel, sys.molecules.length - 1);
    return sys.molecules[i];
  };

  Engine.select = function(i) {
    Engine.state.sel = i | 0;
    Engine.invalidateRun(i);
    return Engine.state.sel;
  };

  Engine.invalidateRun = function(i) {
    delete Engine.state.runs[i === undefined ? Engine.state.sel : i];
  };

  // A new timestep or ensemble describes a different integrator, so no running
  // species can keep its old one.
  Engine.invalidateAllRuns = function() { Engine.state.runs = {}; };

  Engine.run = function(built, opts) {
    opts = opts || {};
    var sys = Engine.system();
    var index = built.mol.sceneIndex;
    var run = Engine.state.runs[index];
    if (!run || run.built !== built || opts.force) {
      var T = (opts.temperatureK || (sys.temperature && sys.temperature.K) || 298.15);
      var dyn = new Dynamics(built.mol, {
        dt: opts.dt || Engine.state.dt || 5e-16,
        ensemble: opts.ensemble || Engine.state.ensemble || 'NVE', targetT: T
      });
      var check = dyn.prepare();
      run = {
        built: built, dyn: dyn, check: check, reactive: null,
        started: false, events: 0, eventLog: [], snapshotBefore: null, conservation: null,
        trace: []
      };
      Engine.state.runs[index] = run;
    }
    return run;
  };

  Engine.startRun = function(built, opts) {
    opts = opts || {};
    var run = Engine.run(built, opts);
    var sys = Engine.system();
    var T = opts.temperatureK || (sys.temperature && sys.temperature.K) || 298.15;
    run.dyn.assignVelocities(T);
    run.dyn.eRef = run.dyn.totalEnergy();
    run.dyn.status = 'running';
    run.dyn.paused = false;
    run.started = true;
    if (opts.reactive) Engine.enableReactive(run, true);
    run.snapshotBefore = Conservation.snapshot(run.built.mol);
    return run;
  };

  Engine.enableReactive = function(run, on) {
    var want = on !== false;
    if (want && !run.reactive) run.reactive = Reactive.create(run.built.mol, run.dyn, {});
    if (run.reactive) run.reactive.enabled = want;
    // The bond curve of an unbonded radical pair belongs to the reactive layer;
    // switching chemistry off returns the pair potential to the fitted classical
    // field, and the drift monitor is re-basedlined because the surface changed.
    run.built.mol.options.pairBondCurve = want;
    run.built.mol.buildBondCurveTable();
    run.dyn.eRef = null;
    return run.reactive;
  };

  // Advance the selected species. Bond events are stepped after the integrator
  // so the topology change is charged to the same timestep that produced it.
  Engine.step = function(n, opts) {
    opts = opts || {};
    var built = Engine.current();
    if (!built) return { ok: false, reason: 'the scene has no species to integrate' };
    var run = Engine.run(built, opts);
    if (!run.started) Engine.startRun(built, opts);
    if (run.dyn.status === 'unstable') {
      return { ok: false, reason: run.dyn.unstable.message, stopped: true, unstable: true };
    }
    var events = [], steps = 0;
    for (var s = 0; s < n; s++) {
      if (!run.dyn.step()) break;
      steps++;
      if (run.reactive && run.reactive.enabled) {
        var e = run.reactive.step();
        if (e && e.length) events = events.concat(e);
      }
      if (run.dyn.status === 'unstable') break;
    }
    run.events += events.length;
    if (events.length) run.eventLog = (run.eventLog || []).concat(events).slice(-60);
    var mol = built.mol;
    return {
      ok: true, steps: steps, events: events,
      time: run.dyn.t, totalSteps: run.dyn.steps,
      kineticKJmol: run.dyn.kinetic() * CONST.N_A / 1000,
      potentialKJmol: (mol.lastEnergy ? mol.lastEnergy.total : 0) * CONST.N_A / 1000,
      totalKJmol: run.dyn.totalEnergy() * CONST.N_A / 1000,
      temperatureK: Thermo.temperature(mol, run.dyn.kinetic()),
      drift: run.dyn.drift.current, driftMax: run.dyn.drift.max,
      status: run.dyn.status, unstable: run.dyn.unstable,
      ledger: run.reactive ? run.reactive.ledger : null
    };
  };

  Engine.relax = function(built, opts) {
    opts = opts || {};
    var before = Optimizer.energy(built.mol);
    var res = Optimizer.minimize(built.mol, { maxSteps: opts.maxSteps || 6000, tol: opts.tol });
    // charges are geometry-dependent, so the equilibration is re-solved on the
    // relaxed structure instead of reusing the numbers from the old one
    var re = assignChargesEEM(built.mol, opts.eem);
    built.refinement = res;
    built.charges = re;
    // The integrator was referencing the pre-relaxation structure, so its energy
    // window starts again from the relaxed one; otherwise the drift check reports
    // the change the minimiser itself made.
    var live = Engine.state.runs[built.mol.sceneIndex];
    var rebase = live && res.ok ? live.dyn.rebaseline() : null;
    return {
      ok: res.ok, method: res.method, steps: res.steps, converged: res.converged,
      reason: res.reason, maxGradient: res.maxGradient,
      energyBeforeKJmol: before * CONST.N_A / 1000,
      energyAfterKJmol: res.energy * CONST.N_A / 1000,
      releasedKJmol: (before - res.energy) * CONST.N_A / 1000,
      rebaselined: rebase
    };
  };

  Engine.terms = function(built) {
    var e = built.mol.computeForces();
    var per = CONST.N_A / 1000;
    return {
      bond: e.bond * per, angle: e.angle * per, torsion: e.torsion * per,
      improper: e.improper * per, coulomb: e.coulomb * per, vdw: e.vdw * per,
      bondCurve: e.bondCurve * per,
      polarization: e.polarization * per, total: e.total * per,
      options: built.mol.options
    };
  };

  Engine.geometry = function(built) {
    var mol = built.mol, A = mol.atoms, i;
    var bonds = mol.bonds.map(function(b) {
      var r = bondLength(A[b.i], A[b.j]);
      // Report the same term the integrator is stepping, including its depth
      // below the separated-atom asymptote. A bond's well is the number the
      // reader is looking for when they ask what energy holds two atoms
      // together, and the harmonic form only measures the cost of stretching
      // away from equilibrium - it can never go negative.
      var term = (mol.options.useMorse && b.De > 0)
        ? Potentials.morse(r, b.re, b.De, b.k)
        : Potentials.bondHarmonic(r, b.re, b.k);
      return {
        key: b.key, order: b.order, i: b.i, j: b.j,
        rAngstrom: r / ANGSTROM, eqAngstrom: b.re / ANGSTROM,
        deltaAngstrom: (r - b.re) / ANGSTROM,
        kNm: b.k, DeKJmol: b.De * CONST.N_A / 1000,
        uBondKJmol: term.energy * CONST.N_A / 1000,
        onMorse: !!(mol.options.useMorse && b.De > 0),
        measured: b.measured, ionic: !!b.ionic,
        ionicCharacter: b.ionicCharacter === undefined ? null : b.ionicCharacter
      };
    });
    var angles = mol.angles.map(function(a) {
      return {
        label: a.label, thetaDeg: angleValue(A[a.i], A[a.j], A[a.k]) * 180 / Math.PI,
        theta0Deg: a.theta0 * 180 / Math.PI, source: a.thetaSource,
        kThetaKJmol: a.kTheta * CONST.N_A / 1000
      };
    });
    var tors = mol.torsions.map(function(t) {
      return {
        label: t.label, phiDeg: dihedralValue(A[t.i], A[t.j], A[t.k], A[t.l]) * 180 / Math.PI,
        measured: t.measured,
        terms: t.terms.map(function(x) { return { n: x.n, VkJmol: x.V * CONST.N_A / 1000, delta: x.delta }; })
      };
    });
    // The contact list must report the pair potential the integrator actually
    // evaluates (Molecule.computeForces). Charging the electrostatic term alone
    // made every homonuclear contact read 0.0 kJ/mol, because identical atoms
    // share charges equally and Coulomb is then exactly zero - the dispersion and
    // bond-curve terms holding that pair together live in the same function one
    // loop away and were simply never shown.
    var fp = mol.options, per = CONST.N_A / 1000;
    var rc = fp.cutoff, rsw = rc - fp.switchWidth;
    var nonbonded = [];
    for (i = 0; i < A.length; i++) {
      for (var j = i + 1; j < A.length; j++) {
        var lvl = mol.exclusionLevel(i, j);
        // 1-2 and 1-3 pairs are already carried by the bond and angle terms; the
        // only contacts worth listing are the ones the non-bonded potential sees.
        if (lvl === 1 || lvl === 2) continue;
        var r2 = bondLength(A[i], A[j]);
        var ck = pairKey(i, j);
        var qScale = lvl === 3 ? fp.scale14Coulomb : 1;
        var vScale = lvl === 3 ? fp.scale14Vdw : 1;
        var uCoul = (fp.useCoulomb && r2 <= fp.coulombCutoff)
          ? Potentials.coulomb(A[i].q, A[j].q, r2).energy * qScale : 0;
        // A pair the running field carries on its bonding surface drops the 12-6
        // core entirely, exactly as computeForces does. A pair the field does not
        // bind keeps its dispersion number and leaves the curve column blank, so
        // nothing in this table is a term the integrator is not actually stepping.
        var live = fp.pairBondCurve && lvl === 0 && mol.bondCurve ? mol.bondCurve[ck] : null;
        if (r2 > 4 * ANGSTROM && !live) continue;
        var curve = live;
        if (!curve) {
          // No bonding surface is stepped here, so this is the single-bond entry
          // from the table, shown only to give D0 a meaning. It is deliberately
          // not summed into U pair and the curve column stays blank for it.
          var ref = bondParams(A[i].el.sym, A[j].el.sym, 1);
          if (ref) curve = { re: ref.re * ANGSTROM, De: kJPerMolToJ(ref.De), k: ref.k, measured: !!ref.measured };
        }
        var uCurve = curve ? Potentials.morse(r2, curve.re, curve.De, curve.k).energy : 0;
        var uVdw = 0;
        if (!live && fp.useVdW && vScale > 0 && r2 < rc) {
          var vp = mol.vdwCache ? mol.vdwCache[ck] : null;
          if (vp) uVdw = Potentials.lj(r2, vp, rc, rsw).energy * vScale;
        }
        nonbonded.push({
          pair: A[i].sym + '#' + i + '–' + A[j].sym + '#' + j,
          rAngstrom: r2 / ANGSTROM,
          bondOrder: paulingBondOrder(A[i].el.sym, A[j].el.sym, r2),
          electrostaticKJmol: uCoul * per,
          dispersionKJmol: uVdw * per,
          // Only a live curve is stepped. A reference curve that the pair could
          // use but does not (both atoms already inside the same molecule, say)
          // is a counterfactual, and printing its depth next to the real number
          // invites the reader to add terms the field never applied. It is still
          // reported, but as D0 below, which is a property of the element pair.
          curveKJmol: live ? uCurve * per : null,
          // Say which bond the stepped curve is: the ceiling is the pair's free
          // capacity, so N–N on its own reads the triple well, not the single one.
          curveKey: live && live.order ? A[i].sym + (SEPARATOR[live.order] || '-') + A[j].sym : null,
          curveEstimated: live ? !live.measured : null,
          pairKJmol: (uCoul + (live ? uCurve : uVdw)) * per,
          dissociationKJmol: curve ? curve.De * per : null,
          onBondCurve: !!live
        });
      }
    }
    return {
      bonds: bonds, angles: angles, torsions: tors, nonbonded: nonbonded,
      shapes: built.shapes || Builder.shapes(mol, null),
      formula: built.formula || Builder.formula(mol),
      notes: mol.notes || [], warnings: mol.warnings || []
    };
  };

  Engine.quantum = function(built, opts) {
    return Quantum.solve(built.mol, opts || {});
  };

  Engine.thermo = function(built, T, opts) {
    return Thermo.moleculeReport(built.mol, T || Engine.system().temperature.K, opts || {});
  };

  // ============================== PHASE 11.3 ==============================
  // Panel. Bilingual EN/VI, every row rendered from an Engine call.
  function LS(en, vi) { return { en: en, vi: vi }; }
  var LANG_KEY = 'mol3d.lang';
  function readLangKey(k) {
    try { return localStorage.getItem(k); } catch (e) { return null; }
  }
  function curLang() {
    // Teacher mode owns its own toggle, so on that page it is the authority;
    // every other page follows the sandbox language.
    var keys = (typeof document !== 'undefined' && document.getElementById('teacher-app'))
      ? ['tm-lang', LANG_KEY] : [LANG_KEY, 'tm-lang'];
    for (var i = 0; i < keys.length; i++) {
      var v = readLangKey(keys[i]);
      if (v === 'vi' || v === 'en') return v;
    }
    return 'vi';
  }
  function TXT(pair) {
    if (!pair) return '';
    var l = curLang();
    return pair[l] !== undefined ? pair[l] : pair.en;
  }

  // The rule that actually writes and erases a bond, quoted next to the contact
  // table so a negative "rcov sum - d" is not mistaken for a bond criterion: the
  // reactive layer decides on energy and Pauling order, with dwell counters that
  // make the record stick through a vibrational cycle.
  function bondRuleText(cfg) {
    return curLang() === 'vi'
      ? 'Liên kết được ghi khi thế của cặp trên đường cong liên kết nhỏ hơn 0 và bậc Pauling n đạt ' + cfg.formOrder +
        ', rồi phải giữ nguyên như vậy ' + cfg.formDwell + ' bước liên tiếp; để phá một liên kết thì cần ' + cfg.breakDwell +
        ' bước, và chỉ khi cặp đôi mang đủ năng lượng để đi ra vô cùng. Một liên kết dao động co giãn vài phần trăm do đó vẫn giữ nguyên. Cặp mà hai nguyên tử không còn electron hóa trị tự do không có bề mặt liên kết nên chỉ tương tác phân tán.'
      : 'A bond is written when the pair potential on its bonding curve is negative and its Pauling order n reaches ' + cfg.formOrder +
        ', and that has to hold for ' + cfg.formDwell + ' consecutive steps; dropping a bond takes ' + cfg.breakDwell +
        ' steps, and only once the pair really carries the energy to reach infinity. A bond vibrating by a few percent therefore keeps its bond. A pair whose atoms have no unpartnered valence electron has no bonding surface and stays a dispersion contact.';
  }

  var STR = {
    menuBtn: LS('⚛ Molecular Physics Lab', '⚛ Phòng thí nghiệm Vật lý Phân tử'),
    title: LS('Molecular Physics Lab', 'Phòng thí nghiệm Vật lý Phân tử'),
    subtitle: LS('SI-unit classical mechanics, EEM electrostatics and Hückel π theory on the atoms you built',
      'Cơ học cổ điển đơn vị SI, điện tích EEM và thuyết π Hückel trên các nguyên tử bạn đã dựng'),
    close: LS('Close', 'Đóng'),
    lang: LS('Language', 'Ngôn ngữ'),
    reload: LS('Re-read scene', 'Đọc lại cảnh'),
    species: LS('Species', 'Loài'),
    tabStructure: LS('Structure', 'Cấu trúc'),
    tabEnergy: LS('Energy & Motion', 'Năng lượng & Chuyển động'),
    tabCharge: LS('Charges', 'Điện tích'),
    tabThermo: LS('Thermochemistry', 'Hóa nhiệt'),
    tabQuantum: LS('Quantum', 'Lượng tử'),
    tabTests: LS('Validation', 'Kiểm chứng'),
    empty: LS('Build atoms in the scene, then press Re-read scene.', 'Hãy dựng nguyên tử trong cảnh rồi bấm nút Đọc lại cảnh.'),
    noSpecies: LS('No analysable species: every atom is isolated or the structure is rejected by the valence rules.',
      'Không có loài nào phân tích được: mọi nguyên tử đều cô lập hoặc cấu trúc bị luật hóa trị bác bỏ.'),
    modelClassical: LS('Model class: classical force field (harmonic bonds, Morse stretch, 12-6 dispersion, point-charge Coulomb). Bonded terms reproduce the measured equilibrium lengths and stretching constants; they do not describe electrons.',
      'Loại mô hình: trường lực cổ điển (liên kết điều hòa, Morse giãn, phân tán 12-6, Coulomb điện tích điểm). Các số hạng liên kết tái tạo chiều dài và hằng số giãn đo được; chúng không mô tả electron.'),
    modelQuantum: LS('Model class: semi-empirical quantum (Hückel π electrons only). Energies are orbital energies in eV relative to α, no electron correlation.',
      'Loại mô hình: lượng tử bán kinh nghiệm (chỉ π electron theo Hückel). Năng lượng là năng lượng orbital tính theo eV so với α, không có tương quan electron.'),
    formula: LS('Formula (Hill)', 'Công thức (Hill)'),
    atoms: LS('Atoms', 'Số nguyên tử'),
    atomsShort: LS('atoms', 'nguyên tử'),
    bonds: LS('Bonds', 'Liên kết'),
    angles: LS('Angles', 'Góc'),
    torsions: LS('Torsions', 'Xoắn'),
    bondTable: LS('Bond lengths against the fitted force field', 'Chiều dài liên kết so với trường lực đã khớp'),
    bond: LS('Bond', 'Liên kết'),
    order: LS('Order', 'Bậc'),
    length: LS('Length', 'Chiều dài'),
    equilibrium: LS('Fitted r₀', 'r₀ khớp'),
    shift: LS('Δr', 'Δr'),
    stiffness: LS('k (N/m)', 'k (N/m)'),
    uBond: LS('U bond (kJ/mol)', 'U liên kết (kJ/mol)'),
    uBondNote: LS('U bond is the potential energy of the pair at its present length, measured against the same two atoms infinitely far apart and at rest, from the exact term the integrator steps: the Morse well when the bond has a dissociation energy, the harmonic spring otherwise. So an equilibrium C-C bond reads -348 kJ/mol and an equilibrium C-H bond -413 kJ/mol, and the number only climbs when the bond is stretched or compressed. A positive value means the pair has been pushed inside the repulsive wall of the well, or that this bond is one of the estimated spring-only cases that has no dissociation energy to set its depth.',
      'U liên kết là thế năng của cặp ở chiều dài hiện tại, đo so với chính hai nguyên tử đó tách ra vô cùng và đứng yên, lấy đúng từ số hạng mà integrator đang tích phân: hố Morse khi liên kết có năng lượng phân li, còn không thì dùng lò xo điều hòa. Vì vậy một liên kết C-C ở cân bằng đọc -348 kJ/mol và liên kết C-H ở cân bằng đọc -413 kJ/mol, con số này chỉ dâng lên khi liên kết bị kéo giãn hoặc nén lại. Một giá trị dương nghĩa là cặp đã bị đẩy vào phần thế đẩy của hố, hoặc liên kết này thuộc trường hợp lò xo ước lượng không có năng lượng phân li để định độ sâu.'),
    dissociation: LS('D₀ (kJ/mol)', 'D₀ (kJ/mol)'),
    measured: LS('measured', 'đo thực nghiệm'),
    estimated: LS('estimated', 'ước lượng'),
    ionicChar: LS('ionic character', 'phần ion'),
    angleTable: LS('Valence angles', 'Góc hóa trị'),
    angle: LS('Angle', 'Góc'),
    ideal: LS('VSEPR θ₀', 'θ₀ VSEPR'),
    source: LS('Source', 'Nguồn'),
    shapeTable: LS('Geometry around each atom, measured from the scene coordinates',
      'Hình học quanh mỗi nguyên tử, đo từ tọa độ trong cảnh'),
    centre: LS('Atom', 'Nguyên tử'),
    coordination: LS('Neighbours', 'Láng giềng'),
    meanAngle: LS('mean ∠', '∠ trung bình'),
    shape: LS('Shape', 'Hình dạng'),
    nonbondedTable: LS('Contacts the pair potential sees (1-2 and 1-3 pairs are inside the bonded terms)',
      'Các tiếp xúc mà thế cặp nhìn thấy (cặp 1-2 và 1-3 đã nằm trong số hạng liên kết)'),
    contact: LS('Contact', 'Tiếp xúc'),
    uElec: LS('U electrostatic', 'U tĩnh điện'),
    uVdw: LS('U dispersion', 'U phân tán'),
    uCurve: LS('U bond curve', 'U đường cong liên kết'),
    uPair: LS('U pair', 'U cặp'),
    nOrder: LS('n Pauling', 'n Pauling'),
    superseded: LS('no 12-6 on this surface', 'bề mặt này không dùng 12-6'),
    pairZero: LS('U pair is the energy of the two atoms against the same pair separated and at rest: negative means the contact is bound, positive means the field pushes them apart. All three columns come from the same potentials the integrator steps. A dash in the bond-curve column means no bonding surface is written for that contact because the two atoms already belong to the same molecule, so only dispersion and electrostatics act between them; D0 stays listed because it is a property of the element pair, and it is exactly the depth of the well a new bond would have if the pair were two separate species. Pairs farther apart than 4 Å are left out of the list to keep it readable, though the field still counts their very small dispersion.',
      'U cặp là năng lượng của hai nguyên tử so với chính cặp đó tách xa và đứng yên: âm nghĩa là tiếp xúc có liên kết, dương nghĩa là trường lực đẩy chúng ra. Cả ba cột đều lấy từ các thế mà integrator đang tích phân. Dấu gạch trong cột đường cong liên kết nghĩa là không có bề mặt liên kết nào được ghi cho tiếp xúc này vì hai nguyên tử đã thuộc cùng một phân tử, nên chỉ phân tán và tĩnh điện tác động giữa chúng; D₀ vẫn được liệt kê vì đó là tính chất của cặp nguyên tố, và chính là độ sâu của hố thế mà một liên kết mới sẽ có nếu hai nguyên tử là hai loài tách biệt. Những cặp cách xa quá 4 Å được xếp ra ngoài danh sách cho dễ đọc, dù trường lực vẫn tính thành phần phân tán rất nhỏ của chúng.'),
    logTitle: LS('Engine log', 'Nhật ký engine'),
    logNote: LS('Raw messages from the calculations (English only). Anything the engine could not model is listed here instead of being hidden.',
      'Thông báo gốc từ các phép tính (chỉ tiếng Anh). Mọi thứ engine không mô hình hoá được đều ghi ở đây thay vì bị ẩn.'),
    termsTitle: LS('Energy of this species, per mole, term by term', 'Năng lượng của loài này, theo mol, từng số hạng'),
    term: LS('Term', 'Số hạng'),
    valueKJmol: LS('kJ/mol', 'kJ/mol'),
    tBond: LS('Bond stretch (Morse)', 'Giãn liên kết (Morse)'),
    tAngle: LS('Angle bend', 'Uốn góc'),
    tTorsion: LS('Torsion', 'Xoắn'),
    tImproper: LS('Improper / planarity', 'Bất đối xứng / phẳng'),
    tCoulomb: LS('Electrostatics', 'Tĩnh điện'),
    tVdw: LS('van der Waals (12-6)', 'van der Waals (12-6)'),
    tPairCurve: LS('Radical pair on its bond curve (Morse)', 'Cặp gốc tự do trên đường cong liên kết (Morse)'),
    nvePick: LS('NVE - isolated, total energy conserved', 'NVE - tách lập, bảo toàn tổng năng lượng'),
    kKind: LS('Model kind', 'Loại mô hình'),
    kFragments: LS('Fragments', 'Số mảnh'),
    kStatus: LS('Status', 'Trạng thái'),
    kIterations: LS('SCF iterations', 'Vòng lặp SCF'),
    kSTotal: LS('Total entropy', 'Tổng entropy'),
    kNote: LS('Model note', 'Ghi chú mô hình'),
    kSpread: LS('Per-atom temperature spread', 'Độ chênh nhiệt độ giữa các nguyên tử'),
    kMeasured: LS('measured', 'giá trị đo'),
    fireConv: LS('converged', 'đã hội tụ'),
    fireStop: LS('stopped at the step limit', 'dừng vì hết bước'),
    polComplete: LS('complete table', 'đủ bảng số liệu'),
    fireSteps: LS('steps', 'bước'),
    driftNow: LS('now', 'hiện tại'),
    driftMax: LS('max', 'lớn nhất'),
    onState: LS('on', 'bật'),
    offState: LS('off', 'tắt'),
    stIdle: LS('idle', 'chưa chạy'),
    stReady: LS('ready', 'sẵn sàng'),
    stRunning: LS('running', 'đang chạy'),
    stPaused: LS('paused', 'đã dừng tạm'),
    stUnstable: LS('unstable', 'mất ổn định'),
    nvtPick: LS('NVT - Berendsen weak coupling', 'NVT - ghép yếu Berendsen'),
    pickNote: LS('Changing either rebuilds the run; the thermostat only rescales velocities towards the scene temperature,',
      'Đổi một trong hai sẽ dựng lại quá trình mô phỏng; bộ điều nhiệt chỉ co giãn vận tốc về nhiệt độ của cảnh,'),
    tPol: LS('Polarisation (induced dipoles)', 'Phân cực (lưỡng cực cảm ứng)'),
    tTotal: LS('Potential energy', 'Thế năng'),
    dynTitle: LS('Velocity-Verlet integrator', 'Bộ tích phân Velocity-Verlet'),
    dt: LS('Timestep', 'Bước thời gian'),
    ensemble: LS('Ensemble', 'Tập hợp'),
    fastest: LS('Fastest vibration', 'Dao động nhanh nhất'),
    pointsPerPeriod: LS('Points per period', 'Điểm mỗi chu kỳ'),
    dtVerdict: LS('Timestep check', 'Kiểm tra bước thời gian'),
    dtOk: LS('within the stability limit', 'trong giới hạn ổn định'),
    dtBad: LS('TOO LARGE - energy will not be conserved, and the run says so instead of clamping forces',
      'QUÁ LỚN - năng lượng sẽ không bảo toàn, và chu trình báo rõ thay vì kẹp lực'),
    steps: LS('Steps', 'Số bước'),
    simTime: LS('Simulated time', 'Thời gian mô phỏng'),
    temperature: LS('Temperature', 'Nhiệt độ'),
    instantT: LS('Instantaneous T from the velocities', 'T tức thời từ vận tốc'),
    targetT: LS('Bath / set temperature', 'Nhiệt độ bồn / đặt trước'),
    kinetic: LS('Kinetic energy', 'Động năng'),
    total: LS('Total energy', 'Năng lượng toàn phần'),
    drift: LS('Energy drift (relative)', 'Độ trôi năng lượng (tương đối)'),
    status: LS('Status', 'Trạng thái'),
    run: LS('Run', 'Chạy'),
    pause: LS('Pause', 'Tạm dừng'),
    restart: LS('Restart at T', 'Khởi động lại ở T'),
    reactive: LS('Bond making/breaking', 'Tạo và phá vỡ liên kết'),
    reactiveOn: LS('on', 'bật'),
    reactiveOff: LS('off', 'tắt'),
    reactiveScope: LS('Species are integrated one at a time, so a bond can only form between atoms of the same species; two molecules that collide are still two separate systems.',
      'Mỗi loài được tích phân riêng, nên liên kết chỉ hình thành giữa các nguyên tử trong cùng một loài; hai phân tử va chạm vẫn là hai hệ tách biệt.'),
    events: LS('Topology events', 'Sự kiện topology'),
    topologyWork: LS('Topology work', 'Công topology'),
    unpaidHeat: LS('Unpaid heat', 'Nhiệt chưa hạch toán'),
    bathHeat: LS('Heat paid by the rest of the system', 'Nhiệt do phần còn lại của hệ trả'),
    bathWork: LS('Heat exchanged with the thermostat', 'Nhiệt trao đổi với môi nhiệt'),
    momentumResidual: LS('Momentum residual', 'Phần dư động lượng'),
    pairCurves: LS('Radical pairs held on a bond curve', 'Cặp gốc tự do được giữ trên đường cong liên kết'),
    refusedAtoms: LS('Atoms with no measured bond curve', 'Nguyên tử không có đường cong liên kết đo được'),
    evForm: LS('bond formed', 'liên kết tạo'),
    evBreak: LS('bond broken', 'liên kết phá'),
    formed: LS('Bonds formed', 'Liên kết được tạo'),
    broken: LS('Bonds broken', 'Liên kết bị phá vỡ'),
    rejected: LS('Formations refused', 'Ca tạo liên kết bị từ chối'),
    lastRejection: LS('Last refusal', 'Lần từ chối gần nhất'),
    heatLedger: LS('Energy bookkeeping', 'Hạch toán năng lượng'),
    heatClosed: LS('closed - every topology change was paid for by the pair, and by the other atoms when the pair fell short',
      'cân bằng - mọi thay đổi topology đều được trả bằng chuyển động của cặp, và của các nguyên tử còn lại khi cặp không đủ'),
    heatOpen: LS('open - neither the pair nor the rest of the system had this much motion to give',
      'chưa cân bằng - cả cặp lẫn phần còn lại của hệ không đủ chuyển động để trả phần nhiệt này'),
    coreRule: LS('A pair whose two atoms each still carry an unpartnered valence electron, with no bond path between them, is held on the measured Morse bond curve of the molecule it would form (tabulated De, re, k) and feels no Lennard-Jones wall. That curve becomes the graph bond the moment it is written, so forming or breaking changes the total energy by exactly nothing. Without it the 12-6 core - fitted to bonded, saturated matter - turns every approach around near 1.6 A and bonding distance is never reached.',
      'Cặp mà mỗi nguyên tử vẫn còn một electron hóa trị chưa bắt đôi, và không có đường liên kết giữa chúng, được mô tả bằng đường cong Morse đo được của phân tử mà chúng sẽ tạo (De, re, k trong bảng) và không chịu tường Lennard-Jones. Đường cong ấy chính là liên kết trong đồ thị ngay khi được ghi nhận, nên việc tạo hay phá liên kết không làm thay đổi tổng năng lượng chút nào. Nếu không, lõi 12-6 - vốn khớp cho vật chất đã liên kết và bão hòa - sẽ đẩy mọi lần tiếp cận ở khoảng 1,6 A và không bao giờ tới được khoảng cách liên kết.'),
    ledgerTitle: LS('Reactive ledger (Pauling bond order, not ReaxFF)',
      'Sổ cái phản ứng (bậc liên kết Pauling, không phải ReaxFF)'),
    conserved: LS('Conservation check', 'Kiểm tra bảo toàn'),
    relax: LS('Relax (FIRE)', 'Làm dịu (FIRE)'),
    relaxNote: LS('Relaxing changes the engine copy only. Press Sync to move the scene atoms.',
      'Làm dịu chỉ thay đổi bản sao trong engine. Bấm Đồng bộ để di chuyển nguyên tử trong cảnh.'),
    sync: LS('Sync geometry to scene', 'Đồng bộ hình học ra cảnh'),
    synced: LS('Scene positions updated', 'Đã cập nhật vị trí cảnh'),
    syncSkipped: LS('positions refused (not finite)', 'vị trí bị từ chối (không hữu hạn)'),
    syncOutside: LS('positions refused (outside the world)', 'vị trí bị từ chối (ngoài thế giới)'),
    chargesTitle: LS('Charge model', 'Mô hình điện tích'),
    chargeModelName: LS('Method', 'Phương pháp'),
    hardness: LS('Hardness convention', 'Quy ước độ cứng'),
    chiSource: LS('Electronegativity scale', 'Thang độ âm điện'),
    kernel: LS('Interaction kernel', 'Nhân tương tác'),
    atom: LS('Atom', 'Nguyên tử'),
    formal: LS('Formal', 'Hình thức'),
    partial: LS('Partial q (e)', 'q_partial (e)'),
    dipolePredicted: LS('Predicted dipole', 'Lưỡng cực dự đoán'),
    dipoleMeasured: LS('Measured dipole', 'Lưỡng cực đo được'),
    dipoleError: LS('Error', 'Sai số'),
    reliable: LS('Charge solution accepted', 'Nghiệm điện tích được chấp nhận'),
    notReliable: LS('Charge solution flagged', 'Nghiệm điện tích bị đánh dấu'),
    constraints: LS('Atoms pinned at their electron-transfer bound', 'Nguyên tử bị ghim tại giới hạn chuyển electron'),
    pinNote: LS('The quadratic EEM energy has no second-ionisation term, so a charge past one electron is not physical. Those atoms are held at the bound and listed - they are never silently clamped.',
      'Năng lượng EEM bậc hai không có số hạng ion hoá bậc hai, nên điện tích vượt một electron không có thực. Các nguyên tử đó bị giữ ở giới hạn và được liệt kê — không bao giờ bị kẹp âm thầm.'),
    polarTitle: LS('Polarisable dipoles', 'Lưỡng cực cảm ứng'),
    polarEnergy: LS('Polarisation energy', 'Năng lượng phân cực'),
    polarMissing: LS('no measured polarizability for', 'không có độ phân cực đo được cho'),
    thermoTitle: LS('Statistical thermodynamics at', 'Nhiệt động thống kê ở'),
    trans: LS('Translation (Sackur-Tetrode)', 'Tịnh tiến (Sackur-Tetrode)'),
    rot: LS('Rotation (rigid rotor)', 'Quay (chậu cứng)'),
    vib: LS('Vibration (harmonic)', 'Dao động (điều hòa)'),
    linear: LS('linear', 'thẳng'),
    nonlinear: LS('non-linear', 'không thẳng'),
    thetaRot: LS('Rotational temperature', 'Nhiệt độ quay'),
    modes: LS('Normal modes', 'Mode chuẩn'),
    imaginary: LS('Imaginary modes', 'Mode ảo'),
    imagNote: LS('An imaginary mode means the structure is not a minimum of this force field - the geometry can lower its energy by moving along it.',
      'Mode ảo nghĩa là cấu trúc không phải cực tiểu của trường lực này — hình học có thể hạ năng lượng bằng cách dịch chuyển dọc theo mode đó.'),
    zpe: LS('Zero-point energy', 'Năng lượng điểm không'),
    entropy: LS('Entropy', 'Entropy'),
    enthalpy: LS('Enthalpy H', 'Enthalpy H'),
    helmholtz: LS('Helmholtz A', 'Helmholtz A'),
    gibbs: LS('Gibbs G', 'Gibbs G'),
    heatCapacity: LS('Heat capacity', 'Nhiệt dung'),
    quantumTitle: LS('Electronic structure', 'Cấu trúc electron'),
    backend: LS('Backend', 'Backend'),
    backendBuiltIn: LS('built-in Hückel π-electron solver', 'bộ giải π Hückel tích hợp'),
    backendExternal: LS('external quantum backend', 'backend lượng tử ngoài'),
    calculation: LS('Calculation', 'Phép tính'),
    unitsRow: LS('Units', 'Đơn vị'),
    externalRow: LS('External backend', 'Backend ngoài'),
    unavailableRow: LS('Not available in the browser', 'Không chạy được trên trình duyệt'),
    backendIsExternal: LS('An external quantum backend is registered, so the numbers below come from it rather than from the built-in Hückel solver.',
      'Có backend lượng tử ngoài đã đăng ký, nên các số dưới đây lấy từ backend đó chứ không phải bộ giải Hückel tích hợp.'),
    piCentres: LS('π centres', 'Tâm π'),
    kind: LS('Contribution', 'Đóng góp'),
    electronOne: LS('1 electron (in-network π bond)', '1 electron (liên kết π trong mạng)'),
    electronTwo: LS('2 electrons (lone pair donated)', '2 electron (cặp electron tự do góp)'),
    orbitals: LS('Molecular orbitals', 'Orbital phân tử'),
    energyEV: LS('E − α (eV)', 'E − α (eV)'),
    occ: LS('Occupation', 'Chiếm'),
    homo: LS('HOMO', 'HOMO'),
    lumo: LS('LUMO', 'LUMO'),
    gap: LS('Hückel gap', 'Vùng cấm Hückel'),
    relAlpha: LS('rel. α', 'so với α'),
    piElectronCount: LS('π electrons', 'Số electron π'),
    gapNote: LS('Hückel gap: an orbital-energy difference of this π model. It is not an excitation energy measured from the ground state - there is no electron correlation or orbital relaxation here.',
      'Vùng cấm Hückel: hiệu năng lượng orbital của mô hình π này. Đây không phải năng lượng kích thích đo từ trạng thái cơ bản — mô hình không có tương quan electron hay giãn orbital.'),
    piEnergy: LS('Total π energy', 'Tổng năng lượng π'),
    piBondOrders: LS('π bond orders', 'Bậc liên kết π'),
    noPi: LS('No conjugated π system in this structure', 'Cấu trúc này không có hệ π liên hợp'),
    noPiWhy: LS('A π network needs p orbitals on neighbouring atoms all pointing the same way. This solver takes one conjugated network at a time: an isolated double bond, a ring, or a lone pair next to a π bond all qualify (ethene, butadiene, benzene, pyridine, furan). A triple or cumulated bond carries two perpendicular sets and is reported above instead of being solved as one.',
      'Mạng π cần các orbital p trên nguyên tử kề nhau cùng hướng về một phía. Bộ giải này xử lý từng mạng liên hợp một: liên kết đôi riêng lẻ, vòng, hay cặp electron tự do cạnh liên kết π đều được (ethene, butadiene, benzene, pyridine, furan). Liên kết ba hoặc liên kết bội tích tụ mang hai hệ π vuông góc và được báo ở trên thay vì giải gộp.'),
    quantumNotes: LS('Solver notes', 'Ghi chú của bộ giải'),
    backendShort: LS('Solved here by the built-in Hückel π-electron MO solver (a real diagonalisation of the π Fock matrix, not a table of look-up values).',
      'Được giải tại chỗ bằng bộ giải MO π Hückel tích hợp (chéo hoá thật ma trận Fock π, không phải tra bảng giá trị).'),
    testsIntro: LS('The panel only shows numbers this engine produced. This tab checks the engine itself against reference results, so a broken build is visible before any molecule is trusted.',
      'Bảng này chỉ hiện số do engine tạo ra. Tab này kiểm tra chính engine với các kết quả tham chiếu, để bản build lỗi hiện ra trước khi tin vào phân tử nào.'),
    testsRun: LS('Run validation battery', 'Chạy chuỗi kiểm chứng'),
    test: LS('Check', 'Kiểm tra'),
    result: LS('Result', 'Kết quả'),
    pass: LS('PASS', 'ĐẠT'),
    fail: LS('FAIL', 'HỎNG'),
    unitNote: LS('Coordinate conversion', 'Quy đổi tọa độ'),
    chargeSource: LS('Net charge taken from', 'Điện tích ròng lấy từ'),
    sceneNote: LS('Geometry read exactly as built - nothing was moved to make it look better.',
      'Hình học đọc đúng như đã dựng — không có gì bị dịch để cho đẹp.'),
    relaxApplied: LS('Relaxed in the engine', 'Đã làm dịu trong engine'),
    loading: LS('reading the scene...', 'đang đọc cảnh...'),
    errorNoScene: LS('The scene bridge is not available in this build.', 'Cầu cảnh không có trong bản build này.')
  };

  // The engine writes its diagnostics as English sentences because they carry
  // numbers. The common templates get a Vietnamese rendering here; anything
  // unrecognised is shown verbatim rather than mistranslated.
  var GLOSS = [
    [/^torsion (.*) generic threefold barrier$/, function(m) { return 'Xoắn ' + m[1] + ': dùng rào ba lần generic (chưa có số liệu khớp).'; }],
    [/^(.*) uses estimated constants$/, function(m) { return m[1] + ': dùng hằng số ước lượng, chưa có số đo.'; }],
    [/^no force-field data for (.*)$/, function(m) { return 'Không có dữ liệu trường lực cho ' + m[1] + '.'; }],
    [/^element (.*) is not in the database$/, function(m) { return 'Nguyên tử ' + m[1] + ' không có trong cơ sở dữ liệu.'; }],
    [/^no dispersion parameters for (.*);(.*)$/, function(m) { return 'Không có tham số phân tán cho ' + m[1] + m[2] + '.'; }],
    [/^no published Huckel parameters(.*)$/, function() { return 'Chưa nạp tham số Hückel đã công bố cho nguyên tử này.'; }],
    [/^no conjugated pi system detected(.*)$/, function() { return 'Không phát hiện hệ π liên hợp từ hình học.'; }],
    [/^the multiple bonds here carry two perpendicular pi systems(.*)$/, function() { return 'Các liên kết bội ở đây mang hai hệ π vuông góc (liên kết ba hoặc tích tụ); mô hình Hückel một mạng không giải chúng.'; }],
    [/^this structure has (\d+) separate pi networks \(sizes (.*?)\);(.*)$/, function(m) { return 'Cấu trúc này có ' + m[1] + ' mạng π riêng biệt (kích thước ' + m[2] + '); các số ở trên lấy từ mạng lớn nhất, những mạng còn lại không liên hợp với nó.'; }],
    [/^an odd number of pi electrons: (.*)$/, function(m) { return 'Số electron π lẻ: Hückel đơn giản bắt đôi từng hai electron, nên orbital cuối cùng chỉ có một electron độc thân.'; }],
    [/^external backend "(.*)" failed: (.*)$/, function(m) { return 'Backend ngoài "' + m[1] + '" thất bại: ' + m[2]; }],
    [/^external backend "(.*)" returned no result$/, function(m) { return 'Backend ngoài "' + m[1] + '" không trả về kết quả.'; }],
    [/^n-membered ring laid out(.*)$/, function(m) { return 'Vòng ' + m[0]; }],
    [/^timestep (.*) exceeds(.*)$/, function(m) { return 'Bước thời gian ' + m[1] + ' vượt giới hạn ' + m[2] + '.'; }],
    [/^(.*) has run away to (.*)$/, function(m) { return m[1] + ' đã bắn ra tới ' + m[2] + ' — tích phân đã dừng, lực không bị kẹp.'; }],
    [/^force on (.*) reached (.*)$/, function(m) { return 'Lực lên ' + m[1] + ' đạt ' + m[2] + ' — ngoài vùng mô hình, dừng thay vì kẹp.'; }],
    [/^SCF polarisation diverged(.*)$/, function() { return 'Phân cực SCF phân kỳ (thảm hoạ phân cực) ở hình học này; số hạng bị tắt.'; }],
    [/^charge-equilibration matrix is singular(.*)$/, function() { return 'Ma trận cân bằng điện tích suy biến; nghiệm không tồn tại duy nhất.'; }],
    [/^polarizability(.*)not modelled$/, function(m) { return 'Độ phân cực ' + m[1] + ' chưa mô hình hoá.'; }],
    // Validation-battery notes and measured values. They are written once in
    // English inside each check, so the panel translates the sentence rather
    // than duplicating every number into a second table.
    [/^VSEPR \+ FIRE on the fitted constants$/, function() { return 'VSEPR + FIRE trên các hằng số đã khớp.'; }],
    [/^KKT constraint, per fragment$/, function() { return 'Ràng buộc KKT, theo từng mảnh.'; }],
    [/^per-fragment KKT removes the QEq charge-leakage mode$/, function() { return 'KKT theo từng mảnh loại bỏ chế độ rò điện tích của QEq.'; }],
    [/^the net charge is booked as a formal charge, then EEM keeps (.*)$/, function(m) { return 'Điện tích ròng được ghi thành điện tích hình thức, rồi EEM giữ ' + m[1] + '.'; }],
    [/^active-set bound (.*), reported not clamped$/, function(m) { return 'Giới hạn active-set ' + m[1] + ' — báo cáo vi phạm, không kẹp nghiệm.'; }],
    [/^O negative, both H equal$/, function() { return 'O mang điện tích âm, hai H bằng nhau.'; }],
    [/^audit only - the measured value is never used as a parameter$/, function() { return 'Chỉ đối chiếu — giá trị đo không bao giờ được dùng làm tham số.'; }],
    [/^reference computed from the CODATA constants$/, function() { return 'Mốc tính ra từ các hằng số CODATA.'; }],
    [/^dt = (.*), H.H stretch is the fastest mode$/, function(m) { return 'Bước thời gian ' + m[1] + ', dao động giãn H–H là nhanh nhất.'; }],
    [/^f = (.*) active dof after COM removal$/, function(m) { return m[1] + ' bậc tự do hiệu dụng sau khi tách chuyển động khối tâm.'; }],
    [/^Morse and harmonic differ anharmonically, so (.*)$/, function(m) { return 'Morse và harmonic lệch nhau do phi điều hoà, nên ' + m[1] + '.'; }],
    [/^max (\|∇U\| = .*)$/, function(m) { return 'Giá trị lớn nhất ' + m[1] + '.'; }],
    [/^reference (.*) J\/\(mol K\) at (.*)$/, function(m) { return 'Mốc ' + m[1] + ' J/(mol K) ở ' + m[2] + '.'; }],
    [/^(Σq .* e) · Σ formal (.*)$/, function(m) { return m[1] + ' · Σ hình thức ' + m[2]; }],
    // The numerical-stop sentences the integrator writes when it refuses to go on.
    [/^energy drift (.*) exceeds 1% of the reference energy$/, function(m) { return 'độ trôi năng lượng ' + m[1] + ' vượt 1% năng lượng mốc'; }],
    [/^thermostat scale factor became (.*)$/, function(m) { return 'hệ số co giãn của bộ điều nhiệt thành ' + m[1]; }],
    [/^the drift reference became (.*)$/, function(m) { return 'mốc trôi năng lượng thành ' + m[1]; }],
    [/^the total energy became (.*) at step (.*)$/, function(m) { return 'tổng năng lượng thành ' + m[1] + ' ở bước ' + m[2]; }],
    [/^atom (.*) position is not finite$/, function(m) { return 'vị trí nguyên tử ' + m[1] + ' không hữu hạn'; }],
    [/^atom (.*) velocity is not finite$/, function(m) { return 'vận tốc nguyên tử ' + m[1] + ' không hữu hạn'; }],
    [/^atom (.*) has run away to (.*)$/, function(m) { return 'nguyên tử ' + m[1] + ' đã văng ra xa ' + m[2]; }],
    [/^force on (.*) reached (.*), outside the model range$/, function(m) { return 'lực tác dụng lên ' + m[1] + ' đạt ' + m[2] + ', ngoài phạm vi mô hình'; }],
    [/^simple Huckel MO \(zero differential overlap\)$/, function() { return 'MO Hückel đơn giản, bỏ qua chồng chất vi phân.'; }],
    [/^Huckel MO with Lowdin overlap orthogonalisation$/, function() { return 'MO Hückel với trực giao hoá chồng chất Löwdin.'; }],
    [/^semi-empirical quantum \(pi-electron only, no electron correlation\)$/, function() { return 'lượng tử bán kinh nghiệm (chỉ π electron, không có tương quan electron).'; }],
    [/^orbital energies in eV relative to alpha$/, function() { return 'năng lượng orbital tính bằng eV so với α.'; }],
    [/^(.*) bond\(s\) broken, topology work (.*)$/, function(m) { return m[1] + ' liên kết bị phá, công topology ' + m[2] + '.'; }],
    [/^E (.*), relative drift (.*) - the pair already sat on the Morse curve, so writing the bond into the topology cost nothing$/,
      function(m) { return 'E ' + m[1] + ', độ trôi tương đối ' + m[2] + ' — cặp đã nằm sẵn trên đường cong Morse nên ghi liên kết vào đồ thị không tốn năng lượng.'; }],
    [/^(.*) → (.*) atoms · ΔQ (.*)$/, function(m) { return m[1] + ' → ' + m[2] + ' nguyên tử · ΔQ ' + m[3]; }],
    [/^(\d+) fragments$/, function(m) { return m[1] + ' mảnh'; }],
    [/^(.*) kJ\/mol released · (.*) steps$/, function(m) { return 'Tỏa ra ' + m[1] + ' kJ/mol · ' + m[2] + ' bước.'; }],
    [/^max drift (.*)$/, function(m) { return 'Độ trôi lớn nhất ' + m[1]; }],
    [/^(.*) D · (-?[0-9.]+)% vs measured$/, function(m) { return m[1] + ' D · lệch ' + m[2] + '% so với đo.'; }],
    [/^(.*) eV gap, (.*) centres$/, function(m) { return 'Vạch HOMO–LUMO ' + m[1] + ' eV, ' + m[2] + ' tâm.'; }],
    [/^closest approach (.*) · topology work (.*)$/, function(m) { return 'Khoảng cách gần nhất ' + m[1] + ' · công topology ' + m[2]; }],
    // Provenance lines: each names the source of a parameter, so they are
    // sentences the engine writes once and every tab re-reads.
    [/^EEM \(Mortier 1985\) \/ QEq charge equilibration$/,
      function() { return 'Cân bằng điện tích EEM (Mortier 1985) / QEq'; }],
    [/^semi-empirical classical$/, function() { return 'bán nghiệm, cơ học cổ điển'; }],
    [/^Mulliken-Parr absolute hardness, eta = \(IE - EA\)\/2 eV \(measured NIST IE\/EA\)$/,
      function() { return 'Độ cứng tuyệt đối Mulliken-Parr, η = (IE − EA)/2 eV (IE/EA đo được, NIST)'; }],
    [/^Mulliken-Parr absolute electronegativity, chi = \(IE \+ EA\)\/2 eV \(measured NIST IE\/EA\)$/,
      function() { return 'Độ âm điện tuyệt đối Mulliken-Parr, χ = (IE + EA)/2 eV (IE/EA đo được, NIST)'; }],
    [/^Pauling thermochemical electronegativity, converted to eV as (.*)$/,
      function(m) { return 'Độ âm điện nhiệt hóa Pauling, đổi ra eV theo ' + m[1]; }],
    [/^screened Coulomb (.*)$/, function(m) { return 'Coulomb có che chặn ' + m[1]; }],
    [/^no measured dipole moment for (.*) in the built-in table - the charge model is untested for this molecule$/,
      function(m) { return 'Bảng tích hợp không có mômen lưỡng cực đo được cho ' + m[1] + ' — mô hình điện tích chưa được kiểm chứng với phân tử này.'; }],
    [/^rigid rotor \/ harmonic oscillator \/ ideal translation; (.*)$/,
      function(m) { return 'Roto cứng / dao động điều hòa / tịnh tiến lý tưởng; ' + m[1]; }],
    [/^ion charge set in the scene Format menu$/, function() { return 'điện tích ion đặt trong menu Định dạng của cảnh'; }],
    [/^no per-component charge found in the scene, every species read as neutral$/,
      function() { return 'cảnh không cho điện tích theo từng thành phần, mọi chất được đọc như trung hòa'; }],
    [/^no species read from the scene$/, function() { return 'chưa đọc được chất nào từ cảnh'; }],
    [/^environment tab \(simulation\.kinetics\)$/, function() { return 'tab Môi trường (simulation.kinetics)'; }],
    [/^298\.15 K \(no environment setting found\)$/, function() { return '298,15 K (không có cài đặt môi trường nào)'; }],
    [/^scene unit = (.*) pm \(chemistry\.js bond convention\)$/,
      function(m) { return 'một đơn vị cảnh = ' + m[1] + ' pm (quy ước độ dài liên kết của chemistry.js)'; }]
  ];
  function gloss(text) {
    // The engine writes its sentences in English; only the Vietnamese page is
    // rewritten, so an English panel shows the wording the engine actually used.
    if (curLang() !== 'vi') return text;
    for (var i = 0; i < GLOSS.length; i++) {
      var m = GLOSS[i][0].exec(text);
      if (m) return GLOSS[i][1](m);
    }
    return text;
  }

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  // A calculated number that is smaller than the last printed digit is still a
  // result. Printing "0.0" (or "-0.0") would say "no force here", so widen the
  // precision until the value shows, and only then fall back to exponential.
  function num(x, d) {
    if (x === null || x === undefined || !isFinite(x)) return '—';
    var dp = d === undefined ? 3 : d;
    var s = x.toFixed(dp);
    if (parseFloat(s) !== 0) return s;
    if (x === 0) return s;
    var wide = dp;
    while (wide < dp + 4 && parseFloat(x.toFixed(wide)) === 0) wide++;
    if (wide === dp + 4 && parseFloat(x.toFixed(wide)) === 0) return x.toExponential(2);
    return x.toFixed(wide);
  }
  function sci(x, d) {
    if (x === null || x === undefined || !isFinite(x)) return '—';
    return x.toExponential(d === undefined ? 2 : d);
  }
  function fs(t) { return num(t * 1e15, 1) + ' fs'; }
  function deg(x) { return num(x, 1) + '°'; }
  function table(heads, rows) {
    var h = '<tr>' + heads.map(function(x) { return '<th>' + esc(x) + '</th>'; }).join('') + '</tr>';
    var b = rows.map(function(r) {
      return '<tr>' + r.map(function(c) { return '<td>' + c + '</td>'; }).join('') + '</tr>';
    }).join('');
    return '<table class="mpe-t">' + h + b + '</table>';
  }
  function kv(pairs) {
    return '<div class="mpe-kv">' + pairs.map(function(p) {
      return '<span class="mpe-k">' + esc(p[0]) + '</span><span class="mpe-v">' + p[1] + '</span>';
    }).join('') + '</div>';
  }
  function box(title, body, cls) {
    return '<div class="mpe-box ' + (cls || '') + '"><h4>' + esc(title) + '</h4>' + body + '</div>';
  }
  function listBlock(items) {
    if (!items.length) return '<div class="mpe-ok">—</div>';
    return '<ul class="mpe-ul">' + items.map(function(s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>';
  }

  var Panel = (function() {
    var el = null, tab = 'structure', busy = false, timer = null, lastLang = null, open = false;

    var CSS = '.mpe-panel{position:fixed;top:56px;right:10px;width:min(520px,94vw);max-height:calc(100vh - 150px);' +
      'display:flex;flex-direction:column;background:rgba(12,16,28,.96);color:#e8eefc;border:1px solid #3a4a6b;' +
      'border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.55);z-index:9500;font:13px/1.45 "Segoe UI",Roboto,sans-serif;overflow:hidden}' +
      '.mpe-panel[hidden]{display:none}' +
      '.mpe-hd{display:flex;align-items:center;gap:8px;padding:9px 11px;background:linear-gradient(90deg,#1b2a4a,#14203a);border-bottom:1px solid #33415f}' +
      '.mpe-hd b{flex:1;font-size:14px}' +
      '.mpe-hd button{background:#233457;color:#cfe0ff;border:1px solid #40547e;border-radius:7px;padding:3px 8px;font-size:12px;cursor:pointer}' +
      '.mpe-tabs{display:flex;flex-wrap:wrap;gap:4px;padding:7px 9px;border-bottom:1px solid #2a3550}' +
      '.mpe-tabs button{background:#18233b;color:#a9bdda;border:1px solid #2c3a5a;border-radius:16px;padding:3px 10px;font-size:12px;cursor:pointer}' +
      '.mpe-tabs button.on{background:#2f6df0;color:#fff;border-color:#5b8cff}' +
      '.mpe-body{padding:10px 11px;overflow:auto;flex:1}' +
      '.mpe-box{border:1px solid #2b3a5c;border-radius:9px;padding:8px 9px;margin:0 0 9px;background:rgba(20,28,46,.7)}' +
      '.mpe-box.warn{border-color:#8a6a22;background:rgba(64,48,12,.55)}' +
      '.mpe-box.bad{border-color:#8a2f2f;background:rgba(64,18,18,.55)}' +
      '.mpe-box.good{border-color:#215d3a;background:rgba(14,44,28,.5)}' +
      '.mpe-box h4{margin:0 0 6px;font-size:12px;letter-spacing:.3px;text-transform:uppercase;color:#7fd1ff}' +
      '.mpe-t{width:100%;border-collapse:collapse;font-size:12px}' +
      '.mpe-t th{text-align:left;color:#8fa6c8;font-weight:600;padding:2px 5px;border-bottom:1px solid #2f3f61;white-space:nowrap}' +
      '.mpe-t td{padding:2px 5px;border-bottom:1px solid #222c44;font-variant-numeric:tabular-nums}' +
      '.mpe-kv{display:grid;grid-template-columns:auto 1fr;gap:2px 9px;font-size:12px}' +
      '.mpe-k{color:#8fa6c8}.mpe-v{text-align:right;font-variant-numeric:tabular-nums}' +
      '.mpe-ul{margin:0;padding-left:16px;font-size:12px;color:#c6d4ee}' +
      '.mpe-row{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 9px;align-items:center}' +
      '.mpe-row button,.mpe-row select{background:#1e2c4a;color:#d6e4ff;border:1px solid #3a4f7a;border-radius:7px;padding:4px 9px;font-size:12px;cursor:pointer}' +
      '.mpe-row button.on{background:#2f6df0;border-color:#5b8cff;color:#fff}' +
      '.mpe-note{font-size:11.5px;color:#93a7c6;margin:0 0 8px}' +
      '.mpe-ok{color:#7ee2a8}.mpe-err{color:#ff9d9d}' +
      '.mpe-pill{display:inline-block;padding:1px 7px;border-radius:10px;font-size:11px;background:#243352;color:#a9c2e8}' +
      '.mpe-spark{width:100%;height:56px;display:block;background:#101a2d;border:1px solid #26334f;border-radius:6px}' +
      '@media(max-width:640px){.mpe-panel{top:48px;left:8px;right:8px;width:auto;max-height:58vh;font-size:12px}' +
      '.mpe-t th,.mpe-t td{padding:2px 3px;font-size:11px}}';

    function injectStyles() {
      if (document.getElementById('mpe-style')) return;
      var s = document.createElement('style');
      s.id = 'mpe-style';
      s.textContent = CSS;
      document.head.appendChild(s);
    }

    function ensurePanel() {
      if (el && document.body.contains(el)) return el;
      injectStyles();
      el = document.createElement('section');
      el.className = 'mpe-panel';
      el.id = 'molecular-physics-panel';
      el.hidden = true;
      el.innerHTML =
        '<div class="mpe-hd"><b id="mpe-title"></b>' +
        '<button id="mpe-lang"></button>' +
        '<button id="mpe-close">✕</button></div>' +
        '<div class="mpe-tabs" id="mpe-tabs"></div>' +
        '<div class="mpe-body" id="mpe-body"></div>';
      document.body.appendChild(el);
      el.querySelector('#mpe-close').addEventListener('click', hide);
      el.querySelector('#mpe-lang').addEventListener('click', function() {
        var next = curLang() === 'vi' ? 'en' : 'vi';
        // Teacher mode owns its language key and re-renders its own lessons, so
        // on that page the panel drives the page's toggle instead of writing a
        // key the page would ignore.
        var host = document.getElementById('teacher-app') ? document.getElementById('btn-lang') : null;
        if (host) host.click();
        else {
          try { localStorage.setItem(LANG_KEY, next); } catch (e) { /* storage may be blocked; the label still switches */ }
          try { window.dispatchEvent(new Event('mol3d:lang')); } catch (e) { /* older builds poll the key instead */ }
        }
        render();
        // The sidebar/header entry carries the same label, so it flips in the
        // same click rather than waiting for the language poller.
        var entry = document.getElementById('btn-molecular-physics');
        if (entry) entry.textContent = TXT(STR.menuBtn);
      });
      el.addEventListener('click', function(ev) {
        var a = ev.target.closest ? ev.target.closest('[data-act]') : null;
        if (a) doAction(a.getAttribute('data-act'), a.getAttribute('data-arg'));
      });
      return el;
    }

    function doAction(act, arg) {
      var built = Engine.current();
      if (act === 'tab') { tab = arg; render(); return; }
      if (act === 'sel') { Engine.select(+arg); render(); return; }
      if (act === 'reload') { Engine.reload(); render(); return; }
      if (!built) return;
      if (act === 'relax') {
        var r = Engine.relax(built, {});
        Engine.state.lastRelax = r;
        Engine.invalidateRun(built.mol.sceneIndex);
        render();
        return;
      }
      if (act === 'sync') {
        Engine.state.lastSync = SceneBridge.sync(built.mol);
        render();
        return;
      }
      if (act === 'start') {
        Engine.startRun(built, { reactive: Engine.state.reactive === true, dt: Engine.state.dt, ensemble: Engine.state.ensemble });
        startTimer();
        render();
        return;
      }
      if (act === 'pause') { Engine.run(built).dyn.pause(); stopTimer(); render(); return; }
      if (act === 'stop') { Engine.invalidateRun(built.mol.sceneIndex); stopTimer(); render(); return; }
      if (act === 'reactive') {
        Engine.state.reactive = !Engine.state.reactive;
        var liveRun = Engine.state.runs[built.mol.sceneIndex];
        if (liveRun) Engine.enableReactive(liveRun, Engine.state.reactive);
        render();
        return;
      }
      if (act === 'tests') { Engine.state.tests = selfTest(); render(); return; }
      if (act === 'set-dt') { Engine.state.dt = +arg; Engine.invalidateAllRuns(); render(); return; }
      if (act === 'set-ens') { Engine.state.ensemble = arg; Engine.invalidateAllRuns(); render(); return; }
    }

    function startTimer() {
      stopTimer();
      timer = setInterval(function() { tick(); }, 120);
    }
    function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }

    function tick() {
      if (busy || el.hidden) { stopTimer(); return; }
      var built = Engine.current();
      if (!built) { stopTimer(); return; }
      var run = Engine.run(built, {});
      if (run.dyn.status === 'unstable') { stopTimer(); render(); return; }
      busy = true;
      try { Engine.step(80, {}); } finally { busy = false; }
      if (tab !== 'energy') return;
      render(true);
    }

    function tabs() {
      var defs = [['structure', STR.tabStructure], ['energy', STR.tabEnergy], ['charge', STR.tabCharge],
        ['thermo', STR.tabThermo], ['quantum', STR.tabQuantum], ['tests', STR.tabTests]];
      return defs.map(function(d) {
        return '<button data-act="tab" data-arg="' + d[0] + '" class="' + (tab === d[0] ? 'on' : '') + '">' + esc(TXT(d[1])) + '</button>';
      }).join('');
    }

    function header() {
      var sys = Engine.system();
      var html = '<div class="mpe-row">';
      html += '<button data-act="reload">⟳ ' + esc(TXT(STR.reload)) + '</button>';
      if (sys.molecules.length > 1) {
        html += '<select data-act="sel-choose" id="mpe-sel">';
        sys.molecules.forEach(function(m, i) {
          html += '<option value="' + i + '"' + (i === Engine.state.sel ? ' selected' : '') + '>' +
            esc((m.formula ? m.formula.display : '?') + ' · ' + m.mol.atoms.length + ' ' + TXT(STR.atomsShort)) + '</option>';
        });
        html += '</select>';
      }
      html += '<span class="mpe-pill">' + esc(TXT(STR.species)) + ': ' + sys.molecules.length + '</span>';
      html += '<span class="mpe-pill">' + esc(TXT(STR.atoms)) + ': ' + sys.atomCount + '</span>';
      html += '</div>';
      html += '<div class="mpe-note">' + esc(TXT(STR.sceneNote)) + ' · ' + esc(TXT(STR.unitNote)) + ': ' +
        esc(gloss(sys.unitNote || '')) + ' · ' + esc(TXT(STR.chargeSource)) + ': ' +
        esc(gloss(sys.chargeSource || '')) + '</div>';
      if (sys.problems.length) {
        html += box('⚠ ' + TXT(STR.logTitle), listBlock(sys.problems.map(gloss)), 'warn');
      }
      return html;
    }

    function viewStructure(built) {
      var g = Engine.geometry(built);
      var mol = built.mol;
      var html = kv([
        [TXT(STR.formula), esc(g.formula.display)],
        [TXT(STR.bonds), g.bonds.length + ' · ' + TXT(STR.angles) + ' ' + g.angles.length + ' · ' + TXT(STR.torsions) + ' ' + g.torsions.length],
        [TXT(STR.dipolePredicted), num((mol.chargeModel && mol.chargeModel.dipoleDebye ? mol.chargeModel.dipoleDebye.total : null), 3) + ' D']
      ]);
      html += box(TXT(STR.modelClassical), '', '');
      html += box(TXT(STR.bondTable), table(
        [TXT(STR.bond), TXT(STR.order), TXT(STR.length), TXT(STR.equilibrium), TXT(STR.shift), TXT(STR.stiffness), TXT(STR.uBond), TXT(STR.dissociation), TXT(STR.source)],
        g.bonds.map(function(b) {
          return [
            esc(b.key), b.order + (b.ionic ? ' <span class="mpe-pill">' + num(b.ionicCharacter * 100, 0) + '% ' + esc(TXT(STR.ionicChar)) + '</span>' : ''),
            num(b.rAngstrom, 4) + ' Å', num(b.eqAngstrom, 4) + ' Å',
            '<span class="' + (Math.abs(b.deltaAngstrom) > 0.08 ? 'mpe-err' : 'mpe-ok') + '">' + (b.deltaAngstrom >= 0 ? '+' : '') + num(b.deltaAngstrom, 4) + '</span>',
            num(b.kNm, 0),
            '<span class="' + (b.uBondKJmol < 0 ? 'mpe-ok' : 'mpe-err') + '">' + num(b.uBondKJmol, 1) + '</span>',
            num(b.DeKJmol, 1),
            b.measured ? '<span class="mpe-ok">' + esc(TXT(STR.measured)) + '</span>' : '<span class="mpe-pill">' + esc(TXT(STR.estimated)) + '</span>'
          ];
        })) + '<div class="mpe-note">' + esc(TXT(STR.uBondNote)) + '</div>');
      if (g.angles.length) {
        html += box(TXT(STR.angleTable), table(
          [TXT(STR.angle), TXT(STR.source), 'θ', TXT(STR.ideal), 'Δθ'],
          g.angles.map(function(a) {
            return [esc(a.label), esc(a.source), '<b>' + deg(a.thetaDeg) + '</b>', deg(a.theta0Deg),
              (a.thetaDeg - a.theta0Deg >= 0 ? '+' : '') + num(a.thetaDeg - a.theta0Deg, 1) + '°'];
          })));
      }
      html += box(TXT(STR.shapeTable), table(
        [TXT(STR.centre), TXT(STR.coordination), TXT(STR.meanAngle), TXT(STR.shape)],
        g.shapes.map(function(s) {
          return [esc(s.sym + '#' + s.index), s.coordination, s.meanAngle === null ? '—' : deg(s.meanAngle), esc(s.classified)];
        })));
      if (g.nonbonded.length) {
        html += box(TXT(STR.nonbondedTable), table(
          [TXT(STR.contact), 'd', TXT(STR.uElec), TXT(STR.uVdw), TXT(STR.uCurve),
            TXT(STR.uPair), TXT(STR.nOrder), TXT(STR.dissociation)],
          g.nonbonded.map(function(p) {
            return [esc(p.pair), num(p.rAngstrom, 3) + ' Å',
              num(p.electrostaticKJmol, 1),
              // On the bonding surface the 12-6 core is switched off by the field,
              // so the dispersion column says why instead of printing a fake zero.
              p.onBondCurve ? '<span class="mpe-pill">' + esc(TXT(STR.superseded)) + '</span>' : num(p.dispersionKJmol, 1),
              num(p.curveKJmol, 1) + (p.curveKey
                  ? ' <span class="mpe-pill">' + esc(p.curveKey) +
                    (p.curveEstimated ? ' · ' + esc(TXT(STR.estimated)) : '') + '</span>' : ''),
              '<span class="' + (p.pairKJmol < 0 ? 'mpe-ok' : p.pairKJmol > 0 ? 'mpe-err' : '') + '">' +
                num(p.pairKJmol, 1) + '</span>',
              num(p.bondOrder, 2),
              num(p.dissociationKJmol, 0)];
          })) + '<div class="mpe-note">' + esc(TXT(STR.pairZero)) + '</div>' +
          '<div class="mpe-note">' + esc(bondRuleText(Reactive.defaults())) + '</div>');
      }
      var log = g.notes.concat(g.warnings);
      html += box(TXT(STR.logTitle) + ' — ' + TXT(STR.logNote), listBlock(log));
      if (Engine.state.lastRelax) {
        var r = Engine.state.lastRelax;
        html += box(TXT(STR.relaxApplied), kv([
          ['FIRE', (r.converged ? TXT(STR.fireConv) : TXT(STR.fireStop)) + ' · ' +
            r.steps + ' ' + TXT(STR.fireSteps)],
          [TXT(STR.tTotal), num(r.energyAfterKJmol, 1) + ' kJ/mol'],
          ['Δ', num(r.releasedKJmol, 1) + ' kJ/mol'],
          [TXT(STR.relaxNote), TXT(STR.sync)]
        ]) + '<div class="mpe-row"><button data-act="sync">⇄ ' + esc(TXT(STR.sync)) + '</button></div>' +
          (Engine.state.lastSync ? '<div class="' + (Engine.state.lastSync.ok ? 'mpe-ok' : 'mpe-err') + '">' +
            esc(TXT(STR.synced)) + ' (' + Engine.state.lastSync.moved + ' ' + esc(TXT(STR.atomsShort)) + ')' +
            (Engine.state.lastSync.rejected ? ' · ' + Engine.state.lastSync.rejected + ' ' + esc(TXT(STR.syncSkipped)) : '') +
            (Engine.state.lastSync.outside ? ' · ' + Engine.state.lastSync.outside + ' ' + esc(TXT(STR.syncOutside)) : '') +
            '</div>' : ''), 'good');
      }
      return html;
    }

    function sparkline(run) {
      var h = run.dyn.drift.history;
      if (h.length < 2) return '';
      var W = 300, H = 56, min = Infinity, max = -Infinity, i;
      for (i = 0; i < h.length; i++) { min = Math.min(min, h[i].E); max = Math.max(max, h[i].E); }
      var span = (max - min) || 1, pts = [];
      for (i = 0; i < h.length; i += Math.max(1, Math.floor(h.length / 120))) {
        pts.push(((i / (h.length - 1)) * W).toFixed(1) + ',' + (H - 4 - ((h[i].E - min) / span) * (H - 8)).toFixed(1));
      }
      return '<svg class="mpe-spark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' +
        '<polyline fill="none" stroke="#5b8cff" stroke-width="1.5" points="' + pts.join(' ') + '"/></svg>';
    }

    // dyn.status is the integrator's own state name; the panel renders the word
    // for the current language rather than the raw identifier.
    function statusName(s) {
      var k = {idle: STR.stIdle, ready: STR.stReady, running: STR.stRunning,
        paused: STR.stPaused, unstable: STR.stUnstable}[s];
      return k ? TXT(k) : String(s);
    }

    // The timestep and the ensemble are the user's numerics decisions. The row
    // always shows what the run on screen actually uses, so a reported drift can
    // be traced to a setting instead of to a guess.
    function pickRow(dyn) {
      var dts = [2.5e-17, 5e-17, 1e-16, 2.5e-16, 5e-16, 1e-15];
      var html = '<div class="mpe-row">' +
        '<label>' + esc(TXT(STR.dt)) + ' <select data-act="sel-dt">';
      for (var i = 0; i < dts.length; i++) {
        html += '<option value="' + dts[i] + '"' + (Math.abs(dyn.dt - dts[i]) < 1e-24 ? ' selected' : '') + '>' +
          num(dts[i] * 1e15, 3) + ' fs</option>';
      }
      html += '</select></label><label>' + esc(TXT(STR.ensemble)) + ' <select data-act="sel-ens">' +
        '<option value="NVE"' + (dyn.ensemble === 'NVE' ? ' selected' : '') + '>' + esc(TXT(STR.nvePick)) + '</option>' +
        '<option value="NVT"' + (dyn.ensemble === 'NVT' ? ' selected' : '') + '>' + esc(TXT(STR.nvtPick)) + '</option>' +
        '</select></label></div>' +
        '<div class="mpe-note">' + esc(TXT(STR.pickNote)) + ' τ = ' + fs(dyn.tauT) + '.</div>';
      return html;
    }

    function viewEnergy(built) {
      var sys = Engine.system(), mol = built.mol;
      var t = Engine.terms(built), run = Engine.run(built, {});
      var html = box(TXT(STR.termsTitle), table(
        [TXT(STR.term), TXT(STR.valueKJmol)],
        [['bond', STR.tBond, t.bond], ['angle', STR.tAngle, t.angle], ['torsion', STR.tTorsion, t.torsion],
        ['improper', STR.tImproper, t.improper], ['coulomb', STR.tCoulomb, t.coulomb], ['vdw', STR.tVdw, t.vdw],
        ['bondCurve', STR.tPairCurve, t.bondCurve],
        ['polarization', STR.tPol, t.polarization]].map(function(row) {
          return [esc(TXT(row[1])), '<span class="' + (Math.abs(row[2]) > 1e4 ? 'mpe-err' : '') + '">' + num(row[2], 2) + '</span>'];
        }).concat([[ '<b>' + esc(TXT(STR.tTotal)) + '</b>', '<b>' + num(t.total, 2) + '</b>' ]])));

      var check = run.check, dyn = run.dyn;
      var Tset = sys.temperature.K;
      html += box(TXT(STR.dynTitle), kv([
        [TXT(STR.dt), fs(dyn.dt) + '  (' + sci(dyn.dt, 2) + ' s)'],
        [TXT(STR.ensemble), dyn.ensemble],
        [TXT(STR.targetT), num(Tset, 1) + ' K — ' + esc(gloss(sys.temperature.source))],
        [TXT(STR.fastest), (check.fastestBond || '—') + ' · τ = ' + (isFinite(check.period) ? sci(check.period, 2) + ' s' : '—')],
        [TXT(STR.pointsPerPeriod), check.pointsPerPeriod === null ? '—' : num(check.pointsPerPeriod, 1)],
        [TXT(STR.dtVerdict), check.ok ? '<span class="mpe-ok">' + esc(TXT(STR.dtOk)) + '</span>'
          : '<span class="mpe-err">' + esc(TXT(STR.dtBad)) + '</span>'],
        [TXT(STR.steps), dyn.steps], [TXT(STR.simTime), fs(dyn.t)],
        [TXT(STR.status), esc(statusName(dyn.status))],
        [TXT(STR.drift), esc(TXT(STR.driftNow)) + ' ' + sci(dyn.drift.current, 2) + ' · ' +
          esc(TXT(STR.driftMax)) + ' ' + sci(dyn.drift.max, 2)],
        // An NVT run is allowed to move heat across the boundary; saying so here
        // keeps the drift figure honest, because drift is measured against
        // eRef + bathWork rather than against eRef alone.
        [TXT(STR.bathWork), dyn.bathWork ? sci(dyn.bathWork, 2) + ' J' : '0']
      ]) + sparkline(run));

      if (dyn.unstable) {
        // The banner is the engine's own sentence, so on the Vietnamese page it is
        // rewritten like every other engine sentence; the note says where it stopped.
        html += box('⛔ ' + esc(gloss(dyn.unstable.message)), '<div class="mpe-note">' +
          dyn.unstable.step + ' / ' + fs(dyn.unstable.time) + '</div>', 'bad');
      }

      html += box(TXT(STR.instantT) + ' / ' + TXT(STR.kinetic) + ' / ' + TXT(STR.total), kv([
        [TXT(STR.temperature), num(Thermo.temperature(mol, dyn.kinetic()), 1) + ' K'],
        [TXT(STR.kinetic), num(dyn.kinetic() * CONST.N_A / 1000, 2) + ' kJ/mol'],
        [TXT(STR.tTotal), num(dyn.totalEnergy() * CONST.N_A / 1000, 2) + ' kJ/mol'],
        [TXT(STR.kSpread), sci(Math.min.apply(null, Thermo.perAtomTemperature(mol)), 2) + ' … ' +
          sci(Math.max.apply(null, Thermo.perAtomTemperature(mol)), 2) + ' K']
      ]));

      // The switch is a property of this species' run, so the button reports the
      // state the integrator is actually in, not the last thing clicked. A run
      // that is prepared but never stepped still needs the start action, so the
      // test is "is it integrating right now", not "is it not idle".
      var reactiveOn = !!run.reactive;
      var integrating = dyn.status === 'running' && !dyn.paused;
      html += box(TXT(STR.reactive) + ' — ' + esc(TXT(reactiveOn ? STR.reactiveOn : STR.reactiveOff)),
        '<div class="mpe-row">' +
        '<button data-act="' + (integrating ? 'pause' : 'start') + '">' +
        esc(TXT(integrating ? STR.pause : STR.run)) + '</button>' +
        '<button data-act="stop">■ ' + esc(TXT(STR.restart)) + '</button>' +
        '<button data-act="reactive" class="' + (reactiveOn ? 'on' : '') + '">' + esc(TXT(STR.reactive)) + '</button>' +
        '<button data-act="relax">↓ ' + esc(TXT(STR.relax)) + '</button></div>' +
        pickRow(dyn) +
        kv([
          [TXT(STR.events), run.events],
          [TXT(STR.formed), run.reactive ? run.reactive.ledger.formed : 0],
          [TXT(STR.broken), run.reactive ? run.reactive.ledger.broken : 0],
          [TXT(STR.rejected), run.reactive ? run.reactive.ledger.rejected : 0],
          [TXT(STR.topologyWork), run.reactive ? sci(run.reactive.ledger.topologyWork, 2) + ' J' : '0'],
          [TXT(STR.unpaidHeat), run.reactive ? sci(run.reactive.ledger.unpaidHeat, 2) + ' J' : '0'],
          [TXT(STR.bathHeat), run.reactive ? sci(run.reactive.ledger.bathHeat, 2) + ' J' : '0'],
          [TXT(STR.momentumResidual), run.reactive ? sci(run.reactive.ledger.momentumResidual, 2) + ' kg m/s' : '0'],
          [TXT(STR.pairCurves), (mol.bondCurvePairCount || 0) + ' / ' +
            esc(TXT(t.options.pairBondCurve ? STR.onState : STR.offState))],
          [TXT(STR.refusedAtoms), run.reactive ? (mol.bondCurveRefused || []).join(' ') || '—' : '—']
        ]) +
        (run.reactive ? '<div class="' + (run.reactive.ledger.conserved ? 'mpe-ok' : 'mpe-err') + '">' +
          esc(TXT(STR.heatLedger)) + ': ' +
          esc(TXT(run.reactive.ledger.conserved ? STR.heatClosed : STR.heatOpen)) + '</div>' : '') +
        (run.reactive && run.reactive.ledger.lastRejection ? '<div class="mpe-note">' +
          esc(TXT(STR.lastRejection)) + ': ' + esc(gloss(run.reactive.ledger.lastRejection)) + '</div>' : '') +
        (run.reactive ? '<div class="mpe-note">' + esc(TXT(STR.coreRule)) + '</div>' +
          '<div class="mpe-note">' + esc(TXT(STR.reactiveScope)) + '</div>' : '') +
        (run.eventLog && run.eventLog.length ? table(
          [TXT(STR.steps), TXT(STR.bond), TXT(STR.order)],
          run.eventLog.slice(-12).reverse().map(function(e) {
            return [esc(e.type === 'form' ? TXT(STR.evForm) : TXT(STR.evBreak)), esc(e.pair), num(e.order, 2)];
          })) : '') +
        (run.snapshotBefore ? box(TXT(STR.conserved), conservationHtml(
          run.snapshotBefore, Conservation.snapshot(mol))) : ''), 'good');
      return html;
    }

    function conservationHtml(before, after) {
      var c = Conservation.check(before, after);
      return '<div class="' + (c.ok ? 'mpe-ok' : 'mpe-err') + '">' +
        esc(TXT(STR.atoms)) + ': ' + c.atomCount.before + ' → ' + c.atomCount.after +
        ' · Q: ' + num(c.charge_e.before, 6) + ' → ' + num(c.charge_e.after, 6) + ' e' +
        ' · ΔU = ' + num(c.energyDeltaKJmol, 2) + ' kJ/mol</div>' +
        (c.problems.length ? listBlock(c.problems) : '');
    }

    function viewCharges(built) {
      var mol = built.mol, cm = mol.chargeModel;
      if (!cm) return box('⚠', esc(TXT(STR.notReliable)));
      var v = cm.validation || {};
      var html = box(TXT(STR.chargesTitle), kv([
        [TXT(STR.chargeModelName), esc(gloss(cm.name))],
        [TXT(STR.kKind), esc(gloss(cm.kind))],
        [TXT(STR.hardness), esc(gloss(cm.hardnessSource))],
        [TXT(STR.chiSource), esc(gloss(cm.chiSource))],
        [TXT(STR.kernel), esc(gloss(cm.interactionKernel))],
        [TXT(STR.trans), 'Σq = ' + num(cm.sumCharge, 10) + ' e  ·  target ' + num(cm.targetCharge, 0) + ' e  ·  residual ' + sci(cm.residual, 1)],
        [TXT(STR.kFragments), cm.fragments + ' (' + (cm.fragmentCharges || []).join(', ') + ' e)']
      ]));

      html += box(TXT(STR.partial), table(
        [TXT(STR.atom), TXT(STR.formal), TXT(STR.partial), 'χ (eV)', 'η (eV)'],
        mol.atoms.map(function(a, i) {
          var p = (cm.atomParams && cm.atomParams[i]) || null;
          return [esc(a.sym + '#' + i), num(a.q0 / CONST.e, 2),
            '<b>' + num(a.q / CONST.e, 4) + '</b>',
            p ? num(p.chi, 2) : '—', p ? num(p.eta, 2) : '—'];
        })));

      var d = cm.dipoleDebye || {};
      var rel = cm.reliable !== false;
      html += box(TXT(STR.dipolePredicted),
        kv([
          [TXT(STR.dipolePredicted), num(d.total, 3) + ' D  (' + num(d.x, 3) + ', ' + num(d.y, 3) + ', ' + num(d.z, 3) + ')'],
          [TXT(STR.dipoleMeasured), v.measuredDipoleDebye === null || v.measuredDipoleDebye === undefined
            ? '—' : num(v.measuredDipoleDebye, 3) + ' D'],
          [TXT(STR.dipoleError), v.dipoleErrorDebye === null || v.dipoleErrorDebye === undefined
            ? '—' : num(v.dipoleErrorDebye, 3) + ' D (' + num(v.dipoleErrorPercent, 0) + ' %)'],
          [TXT(STR.reliable), rel ? '<span class="mpe-ok">' + esc(TXT(STR.reliable)) + '</span>'
            : '<span class="mpe-err">' + esc(TXT(STR.notReliable)) + '</span>']
        ]) +
        (v.audit ? '<div class="mpe-note">' + esc(gloss(v.audit)) + '</div>' : '') +
        (v.failures && v.failures.length ? listBlock(v.failures.map(gloss)) : ''),
        rel ? 'good' : 'bad');

      if (cm.constraints && cm.constraints.length) {
        html += box(TXT(STR.constraints),
          '<div class="mpe-note">' + esc(TXT(STR.pinNote)) + '</div>' +
          table([TXT(STR.atom), TXT(STR.formal), TXT(STR.partial), 'q − formal'], cm.constraints.map(function(p) {
            return [esc(p.sym + '#' + p.atomIndex), num(p.formal, 0), '<b>' + num(p.bound, 3) + '</b>',
              num(p.transfer, 3) + ' e'];
          })), 'warn');
        html += '<div class="mpe-note">' + esc(gloss(cm.constraints[0].reason)) + '</div>';
      }
      var pol = mol.polarization;
      if (pol) {
        html += box(TXT(STR.polarTitle), kv([
          [TXT(STR.kStatus), esc(gloss(pol.status))],
          [TXT(STR.polarEnergy), num(pol.energy * CONST.N_A / 1000, 2) + ' kJ/mol'],
          [TXT(STR.kIterations), pol.iterations],
          ['α', pol.hasAllPolar ? esc(TXT(STR.polComplete)) : esc(TXT(STR.polarMissing)) + ' ' + pol.missingPolar.join(', ')]
        ]), pol.converged ? '' : 'warn');
      } else {
        html += box(TXT(STR.polarTitle), '<div class="mpe-note">' + esc(TXT(STR.polarMissing)) + '</div>', 'warn');
      }
      return html;
    }

    function viewThermo(built) {
      var sys = Engine.system(), T = sys.temperature.K, rep = Engine.thermo(built, T);
      var per = CONST.N_A, mol = built.mol;
      var rot = rep.rotational, vib = rep.vibrational;
      var theta = !rot.ok ? '—' : (rot.linear
        ? num(rot.thetaRot, 3) + ' K'
        : (rot.thetaRot || []).map(function(x) { return num(x, 3); }).join(' / ') + ' K');
      var html = box(TXT(STR.thermoTitle) + ' ' + num(T, 1) + ' K', kv([
        [TXT(STR.trans), rep.translational.ok
          ? num(rep.translational.SperMolecule * per, 2) + ' J/(mol K)'
          : '— ' + esc(gloss(rep.translational.reason || ''))],
        [TXT(STR.rot), rot.ok
          ? num(rot.S * per, 2) + ' J/(mol K) · ' + esc(rot.linear ? TXT(STR.linear) : TXT(STR.nonlinear))
          : '— ' + esc(gloss(rot.reason || ''))],
        [TXT(STR.thetaRot), esc(theta)],
        [TXT(STR.vib), vib.ok ? num(vib.S * per, 2) + ' J/(mol K)' : '— ' + esc(gloss(vib.reason || ''))],
        [TXT(STR.kSTotal), num(rep.entropyPerMole, 2) + ' J/(mol K)'],
        [TXT(STR.zpe), num(rep.zpePerMole / 1000, 2) + ' kJ/mol'],
        [TXT(STR.tTotal), num(rep.U_potential * per / 1000, 2) + ' kJ/mol'],
        [TXT(STR.enthalpy), num(rep.freePerMole.H / 1000, 2) + ' kJ/mol'],
        [TXT(STR.helmholtz), num(rep.freePerMole.A / 1000, 2) + ' kJ/mol'],
        [TXT(STR.gibbs), num(rep.freePerMole.G / 1000, 2) + ' kJ/mol'],
        [TXT(STR.heatCapacity), (function(d) {
          var c = Thermo.molarHeatCapacity(d.trans, d.rot, d.vib);
          return num(c.Cv, 2) + ' / ' + num(c.Cp, 2) + ' J/(mol K) · 3N−' + (d.linear ? 5 : 6) + ' = ' + d.vib + ' vib';
        })(dofOf(mol))],
        [TXT(STR.kNote), esc(gloss(rep.note))]
      ]));
      if (vib.ok) {
        var w = (vib.wavenumbers || []).filter(function(x) { return x > 10; });
        html += box(TXT(STR.modes) + ' (' + w.length + ')',
          '<div class="mpe-note">' + w.map(function(x) { return num(x, 0); }).join(' · ') + ' cm⁻¹</div>' +
          kv([[TXT(STR.imaginary), vib.imaginaryCount || 0]]) +
          (vib.imaginary && vib.imaginary.length
            ? '<div class="mpe-err">' + vib.imaginary.map(function(x) { return num(x, 0) + ' cm⁻¹'; }).join(' · ') + '</div>'
            : ''),
          vib.imaginaryCount ? 'warn' : 'good');
      } else {
        html += box(TXT(STR.modes), '<div class="mpe-err">' + esc(gloss(vib.reason || '')) + '</div>', 'warn');
      }
      html += '<div class="mpe-note">' + esc(TXT(STR.imagNote)) + '</div>';
      return html;
    }

    // Degrees of freedom counted the standard way: 3 translations, 2 rotations
    // for a linear species (3 otherwise) and 3N-5 or 3N-6 vibrations.
    function dofOf(mol) {
      var n = mol.atoms.length;
      var linear = n === 2 ? true : Thermo.momentsOfInertia(mol).linear;
      var vib = Math.max(0, 3 * n - (linear ? 5 : 6));
      return { trans: 3, rot: linear ? 2 : 3, vib: vib, linear: linear };
    }

    function viewQuantum(built) {
      var q = Engine.quantum(built, {});
      var backends = Quantum.availableBackends();
      var builtIn = !q.backend || q.backend === 'built-in';
      var rows = [[TXT(STR.backend), builtIn ? esc(TXT(STR.backendBuiltIn)) : esc(q.backend)]];
      if (q.ok) {
        rows.push([TXT(STR.calculation), esc(gloss(q.method || q.modelClass || '—'))]);
        rows.push([TXT(STR.unitsRow), esc(gloss(q.units || '—'))]);
      }
      var html = box(TXT(STR.backend), kv(rows) +
        '<div class="mpe-note">' + esc(gloss(builtIn ? TXT(STR.backendShort) : TXT(STR.backendIsExternal))) + '</div>');
      if (!q.ok) {
        return html + box(TXT(STR.noPi),
          '<div class="mpe-note">' + esc(gloss(q.reason || '')) + '</div>' +
          '<div class="mpe-note">' + esc(TXT(STR.noPiWhy)) + '</div>', 'warn');
      }
      html += box(TXT(STR.piCentres) + ' (' + q.centres.length + ')', table(
        [TXT(STR.centre), TXT(STR.kind), 'h', 'k'],
        q.centres.map(function(c) {
          return [esc(c.sym + '#' + c.index), esc(TXT(c.kind === 'two' ? STR.electronTwo : STR.electronOne)),
            num(c.h, 2), num(c.k, 2)];
        })));
      if (q.warnings && q.warnings.length) {
        html += box(TXT(STR.quantumNotes), listBlock(q.warnings.map(gloss)), 'warn');
      }
      html += box(TXT(STR.orbitals), table(
        ['#', TXT(STR.energyEV), TXT(STR.occ)],
        q.orbitalEnergies.map(function(e, i) {
          return [i + 1, num(e, 3), num(q.occupations[i], 2)];
        })));
      html += kv([
        [TXT(STR.piEnergy), num(q.totalPiEnergy, 3) + ' eV ' + TXT(STR.relAlpha)],
        [TXT(STR.homo), num(q.homo, 3) + ' eV ' + TXT(STR.relAlpha)],
        [TXT(STR.lumo), num(q.lumo, 3) + ' eV ' + TXT(STR.relAlpha)],
        [TXT(STR.gap), num(q.gap, 3) + ' eV' + (q.beta ? ' ≈ ' + num(Math.abs(q.gap / q.beta), 3) + ' |β|' : '')],
        ['λ', q.gapNm ? num(q.gapNm, 0) + ' nm' : '—'],
        [TXT(STR.piElectronCount), q.piElectrons]
      ]);
      html += '<div class="mpe-note">' + esc(TXT(STR.gapNote)) + '</div>';
      html += box(TXT(STR.piBondOrders), table(
        [TXT(STR.bond), 'p'],
        q.piBondOrders.map(function(b) {
          var ci = q.centres[b.pair[0]], cj = q.centres[b.pair[1]];
          var ii = ci ? ci.index : b.pair[0], jj = cj ? cj.index : b.pair[1];
          return [esc(built.mol.atoms[ii].sym + '#' + ii + '–' + built.mol.atoms[jj].sym + '#' + jj), num(b.p, 3)];
        })));
      html += box(TXT(STR.modelQuantum), '<div class="mpe-note">' +
        TXT(STR.externalRow) + ': ' + (backends.external ? esc(backends.external) : '—') +
        ' · ' + TXT(STR.unavailableRow) + ': ' + esc((backends.notAvailableInBrowser || []).join(', ')) +
        '</div>', '');
      return html;
    }

    function viewTests() {
      var t = Engine.state.tests || (Engine.state.tests = selfTest());
      var pass = t.results.filter(function(r) { return r.ok; }).length;
      return box(TXT(STR.testsIntro),
        '<div class="mpe-row"><button data-act="tests">▶ ' + esc(TXT(STR.testsRun)) + '</button>' +
        '<span class="mpe-pill">' + pass + ' / ' + t.results.length + ' · ' + num(t.elapsedMs, 0) + ' ms</span></div>' +
        table([TXT(STR.test), TXT(STR.result), TXT(STR.kMeasured)], t.results.map(function(r) {
          return ['<span class="' + (r.ok ? 'mpe-ok' : 'mpe-err') + '">' + (r.ok ? '✓' : '✗') + '</span> ' +
            esc(TXT(r.name)) + '<div class="mpe-note">' + esc(gloss(r.detail || r.reason || '')) + '</div>',
            r.ok ? esc(TXT(STR.pass)) : esc(TXT(STR.fail)), esc(gloss(r.value || ''))];
        })), t.failed ? 'warn' : 'good');
    }

    function render(quiet) {
      if (!el) return;
      var sys = Engine.system();
      el.querySelector('#mpe-title').textContent = TXT(STR.title);
      el.querySelector('#mpe-lang').textContent = curLang() === 'vi' ? 'EN' : 'TIẾNG VIỆT';
      el.querySelector('#mpe-tabs').innerHTML = tabs();
      var built = Engine.current();
      var body = header();
      // The validation battery runs on molecules the engine builds itself, so it
      // stays available on a page with no 3D scene; the other tabs describe the
      // species the user has placed and say so when there are none.
      if (tab === 'tests') body += viewTests();
      else if (!sys.molecules.length) {
        body += box('ℹ', '<div class="mpe-note">' + esc(TXT(sys.ok ? STR.noSpecies : STR.empty)) + '</div>' +
          (sys.reason ? '<div class="mpe-err">' + esc(gloss(sys.reason)) + '</div>' : ''), 'warn');
      } else {
        if (tab === 'structure') body += viewStructure(built);
        else if (tab === 'energy') body += viewEnergy(built);
        else if (tab === 'charge') body += viewCharges(built);
        else if (tab === 'thermo') body += viewThermo(built);
        else body += viewQuantum(built);
      }
      el.querySelector('#mpe-body').innerHTML = body;
      var sel = el.querySelector('#mpe-sel');
      if (sel) sel.addEventListener('change', function() { Engine.select(+sel.value); render(); });
      [['sel-dt', 'set-dt'], ['sel-ens', 'set-ens']].forEach(function(p) {
        var s = el.querySelector('[data-act="' + p[0] + '"]');
        if (s) s.addEventListener('change', function() { doAction(p[1], s.value); });
      });
      lastLang = curLang();
    }

    function show() {
      ensurePanel();
      el.hidden = false;
      open = true;
      Engine.reload();
      render();
    }
    function hide() { if (el) el.hidden = true; open = false; stopTimer(); }
    function toggle() { open ? hide() : show(); }

    return {
      show: show, hide: hide, toggle: toggle,
      refresh: function() { if (open) render(true); },
      isOpen: function() { return open; },
      STR: STR, gloss: gloss, txt: TXT, Engine: Engine
    };
  })();

  // ============================== PHASE 11.4 ==============================
  // Validation battery. Each check compares a live calculation with a reference
  // value that has an independent origin (a measured observable, an analytic
  // result, or a conservation law), so a regression shows up as a failed check
  // instead of a subtly wrong molecule.
  function approx(x, ref, tolAbs, tolRel) {
    var d = Math.abs(x - ref);
    return d <= (tolAbs || 0) + Math.abs(ref) * (tolRel || 0);
  }

  // The validation names are fixed strings, so they get a direct translation
  // table; their measured values stay in the engine's own output.
  var TEST_VI = {
    'water built from the graph': 'Nước dựng từ đồ thị liên kết',
    'Σq = Q for NH4+': 'Σq = Q với NH4+',
    'hydroxide built as a closed-shell anion': 'Hydroxide dựng thành anion kín electron',
    'partial charge bounded by 1 e': 'Điện tích riêng bị chặn ở 1 e',
    'symmetric charges in H2O': 'Điện tích đối xứng trong H2O',
    'H2O dipole vs 1.855 D measured': 'Lưỡng cực H2O so với 1.855 D đo thực nghiệm',
    'Coulomb = ke q1 q2 / r²': 'Coulomb = ke q1 q2 / r²',
    'NVE energy drift < 1% over 600 steps': 'Độ trôi năng lượng NVE < 1% sau 600 bước',
    'Maxwell sampling recovers 300 K': 'Lấy mẫu Maxwell phục hồi 300 K',
    'H2 stretch: Hessian vs sqrt(k/mu)': 'Giãn H2: Hessian so với sqrt(k/mu)',
    'FIRE minimises': 'FIRE tìm cực tiểu',
    'Sackur-Tetrode for Ar(g)': 'Sackur-Tetrode cho Ar(khí)',
    'Hückel butadiene π system': 'Hệ π Hückel của butadiene',
    'bond dissociation conserves ΣN and Q': 'Phá vỡ liên kết bảo toàn ΣN và Q',
    'bond formation follows the bond curve': 'Tạo liên kết theo đường cong liên kết',
    'two fragments equilibrated independently': 'Hai mảnh cân bằng độc lập'
  };

  function selfTest() {
    var out = [], t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    function record(name, ok, value, detail) {
      out.push({ name: LS(name, TEST_VI[name] || name), ok: !!ok, value: value, detail: detail || null });
    }
    function build(atoms, bonds, charge) {
      return Builder.build({ atoms: atoms, bonds: bonds, charge: charge || 0 }, { optimize: false });
    }
    function placed(sym, x, y, z) { return { sym: sym, pos: { x: x * ANGSTROM, y: y * ANGSTROM, z: z * ANGSTROM } }; }

    // 1. Geometry from scratch: water relaxes to the fitted O-H length and angle.
    var w = build([{ sym: 'O' }, { sym: 'H' }, { sym: 'H' }], [[0, 1, 1], [0, 2, 1]]);
    if (w.ok) {
      var oh = bondLength(w.mol.atoms[0], w.mol.atoms[1]) / ANGSTROM;
      var ang = angleValue(w.mol.atoms[1], w.mol.atoms[0], w.mol.atoms[2]) * 180 / Math.PI;
      record('water built from the graph', approx(oh, 0.958, 0.05) && approx(ang, 104.5, 8),
        'O–H ' + num(oh, 3) + ' Å · ∠HOH ' + num(ang, 1) + '°', 'VSEPR + FIRE on the fitted constants');
    } else record('water built from the graph', false, '', w.reason);

    // 2. Charge conservation on an ion: Σq must equal the requested charge.
    var nh = build([{ sym: 'N' }, { sym: 'H' }, { sym: 'H' }, { sym: 'H' }, { sym: 'H' }],
      [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1]], 1);
    if (nh.ok) {
      var sum = nh.mol.atoms.reduce(function(s, a) { return s + a.q / CONST.e; }, 0);
      record('Σq = Q for NH4+', approx(sum, 1, 1e-9), num(sum, 12) + ' e', 'KKT constraint, per fragment');
    } else record('Σq = Q for NH4+', false, '', nh.reason);

    // 2b. The same for an anion, and the formal charges must carry the charge:
    // without that the Lewis bookkeeping sees •OH (odd electron) and rejects it.
    var oh = build([{ sym: 'O' }, { sym: 'H' }], [[0, 1, 1]], -1);
    if (oh.ok) {
      var sumOh = oh.mol.atoms.reduce(function(s, a) { return s + a.q / CONST.e; }, 0);
      var fSum = oh.mol.atoms.reduce(function(s, a) { return s + Math.round(a.q0 / CONST.e); }, 0);
      record('hydroxide built as a closed-shell anion', approx(sumOh, -1, 1e-9) && fSum === -1,
        'Σq ' + num(sumOh, 9) + ' e · Σ formal ' + fSum, 'the net charge is booked as a formal charge, then EEM keeps Σq = Q');
    } else record('hydroxide built as a closed-shell anion', false, '', oh.reason);

    // 3. Transfer bound: no partial charge may exceed one electron.
    var nacl = build([{ sym: 'Na' }, { sym: 'Cl' }], [[0, 1, 1]]);
    if (nacl.ok) {
      var qmax = Math.max(Math.abs(nacl.mol.atoms[0].q), Math.abs(nacl.mol.atoms[1].q)) / CONST.e;
      record('partial charge bounded by 1 e', qmax <= 1.0000001, num(qmax, 4) + ' e',
        'active-set bound |q − formal| ≤ 1, reported not clamped');
    } else record('partial charge bounded by 1 e', false, '', nacl.reason);

    // 4. EEM symmetry: the two water hydrogens must carry the same charge.
    if (w.ok) {
      var dq = Math.abs(w.mol.atoms[1].q - w.mol.atoms[2].q) / CONST.e;
      record('symmetric charges in H2O', dq < 1e-6 && w.mol.atoms[1].q > 0, num(dq, 9) + ' e', 'O negative, both H equal');
    } else record('symmetric charges in H2O', false, '', 'no water');

    // 5. Dipole against the measured value for water. This is an audit of the
    // charge model, never an input to it: EEM with tabulated ionisation
    // potentials and no fitted parameters gives the right direction and order of
    // magnitude, and the size of the gap is reported instead of hidden.
    if (w.ok) {
      var dW = dipoleDebye(w.mol).total;
      record('H2O dipole vs 1.855 D measured', dW > 0.2 && dW < 3.0,
        num(dW, 3) + ' D · ' + num((dW - 1.855) / 1.855 * 100, 1) + '% vs measured',
        'audit only - the measured value is never used as a parameter');
    } else record('H2O dipole vs 1.855 D measured', false, '', 'no water');

    // 6. Analytic Coulomb force against the built pair.
    var q1 = CONST.e, r = 2e-10;
    var c = Potentials.coulomb(q1, -q1, r);
    var ref = CONST.ke * q1 * q1 / (r * r);
    record('Coulomb = ke q1 q2 / r²', approx(Math.abs(c.forceScalar), ref, 0, 1e-12),
      sci(Math.abs(c.forceScalar), 4) + ' N', 'reference computed from the CODATA constants');

    // 7. Velocity-Verlet energy conservation on H2 (NVE, 600 steps).
    var h2 = build([{ sym: 'H' }, { sym: 'H' }], [[0, 1, 1]]);
    if (h2.ok) {
      var dyn = new Dynamics(h2.mol, { dt: 2e-16, ensemble: 'NVE' });
      dyn.prepare();
      dyn.assignVelocities(300);
      dyn.eRef = dyn.totalEnergy();
      for (var s = 0; s < 600; s++) { if (!dyn.step()) break; }
      record('NVE energy drift < 1% over 600 steps', dyn.drift.max < 1e-2 && dyn.status !== 'unstable',
        'max drift ' + sci(dyn.drift.max, 2), 'dt = ' + fs(dyn.dt) + ', H–H stretch is the fastest mode');
    } else record('NVE energy drift < 1% over 600 steps', false, '', h2.reason);

    // 8. Equipartition: T measured from the velocities after sampling.
    if (h2.ok) {
      var dyn2 = new Dynamics(h2.mol, { dt: 5e-16 });
      dyn2.prepare(); dyn2.assignVelocities(300);
      var Tm = Thermo.temperature(h2.mol, dyn2.kinetic());
      record('Maxwell sampling recovers 300 K', approx(Tm, 300, 0, 0.05), num(Tm, 2) + ' K', 'f = 3 active dof after COM removal');
    } else record('Maxwell sampling recovers 300 K', false, '', 'no H2');

    // 9. Harmonic frequency of H2 against sqrt(k/mu)/2pi.
    if (h2.ok) {
      var b0 = h2.mol.bonds[0];
      var mu = h2.mol.atoms[0].m / 2;
      var analytic = Math.sqrt(b0.k / mu) / (2 * Math.PI);
      var hm = hessianFrequencies(h2.mol);
      var num1 = hm.ok ? hm.modes.filter(function(m) { return !m.imaginary; })
        .sort(function(a, b) { return b.frequencyHz - a.frequencyHz; })[0].frequencyHz : null;
      record('H2 stretch: Hessian vs sqrt(k/mu)', num1 && approx(num1, analytic, 0, 0.25),
        sci(num1, 3) + ' vs ' + sci(analytic, 3) + ' Hz', 'Morse and harmonic differ anharmonically, so 25%');
    } else record('H2 stretch: Hessian vs sqrt(k/mu)', false, '', 'no H2');

    // 10. FIRE must lower the energy and reduce the gradient.
    if (w.ok) {
      var start = Optimizer.energy(w.mol);
      var res = Optimizer.minimize(w.mol, { maxSteps: 4000 });
      record('FIRE minimises', res.energy <= start && res.maxGradient < 5e-6,
        num((start - res.energy) * CONST.N_A / 1000, 2) + ' kJ/mol released · ' + res.steps + ' steps',
        'max |∇U| = ' + sci(res.maxGradient, 2) + ' N');
    } else record('FIRE minimises', false, '', 'no water');

    // 11. Sackur-Tetrode against the tabulated argon standard entropy.
    var ar = element('Ar');
    var st = Thermo.sackurTetrode(ar.mass, 298.15, 24.561e-3 / CONST.N_A);
    record('Sackur-Tetrode for Ar(g)', st.ok && approx(st.SperMolecule * CONST.N_A, 154.847, 0, 0.02),
      num(st.SperMolecule * CONST.N_A, 2) + ' J/(mol K)', 'reference 154.85 J/(mol K) at 298.15 K, 1 bar');

    // 12. Hückel: butadiene has 4 π electrons and a positive HOMO-LUMO gap.
    var bd = build([placed('C', 0, 0, 0), placed('C', 1.34, 0, 0), placed('C', 2.48, 0, 0), placed('C', 3.82, 0, 0),
      { sym: 'H' }, { sym: 'H' }, { sym: 'H' }, { sym: 'H' }, { sym: 'H' }, { sym: 'H' }],
      [[0, 1, 2], [1, 2, 1], [2, 3, 2], [0, 4, 1], [0, 5, 1], [1, 6, 1], [2, 7, 1], [3, 8, 1], [3, 9, 1]]);
    if (bd.ok) {
      var qq = Quantum.solve(bd.mol, {});
      record('Hückel butadiene π system', qq.ok && qq.piElectrons === 4 && qq.gap > 0,
        qq.ok ? num(qq.gap, 3) + ' eV gap, ' + qq.centres.length + ' centres' : '', qq.ok ? qq.method : qq.reason);
    } else record('Hückel butadiene π system', false, '', bd.reason);

    // 13. Reactive topology keeps every nucleus and the total charge. The atom is
    // pulled past the bond and the integrator is re-referenced to the energy of
    // that (externally prepared) state, so a break is produced by the dynamics
    // and not by the setup.
    if (h2.ok) {
      var r3 = new Dynamics(h2.mol, { dt: 5e-16 });
      r3.prepare();
      var rx = Reactive.create(h2.mol, r3, {});
      var before = Conservation.snapshot(h2.mol);
      h2.mol.atoms[1].x += 6e-10;
      h2.mol.atoms[1].vx = 400; h2.mol.atoms[1].vz = 40;
      r3.rebaseline();
      for (var s2 = 0; s2 < 400; s2++) { if (!r3.step()) break; rx.step(); }
      var chk = Conservation.check(before, Conservation.snapshot(h2.mol));
      record('bond dissociation conserves ΣN and Q', chk.ok && rx.ledger.broken === 1 && r3.status !== 'unstable',
        chk.atomCount.before + ' → ' + chk.atomCount.after + ' atoms · ΔQ ' + num(chk.charge_e.after - chk.charge_e.before, 6) + ' e',
        rx.ledger.broken + ' bond(s) broken, topology work ' + sci(rx.ledger.topologyWork, 2) + ' J');
    } else record('bond dissociation conserves ΣN and Q', false, '', 'no H2');

    // 13b. Formation is the other half of the ledger. Two isolated H atoms are
    // not a closed-shell Lewis fragment, so Builder refuses them; the pair is
    // assembled as a bare Molecule and released from rest 3 A apart. Nothing but
    // the bond curve pulls them together, so the bond that appears is a result of
    // the dynamics - and the topology switch that records it must not create or
    // destroy energy while doing it.
    var pair = new Molecule({});
    pair.addAtom('H', { x: -1.5e-10, y: 0, z: 0 });
    pair.addAtom('H', { x: 1.5e-10, y: 0, z: 0 });
    var r4 = new Dynamics(pair, { dt: 2.5e-17 });
    r4.prepare();
    var rx4 = Reactive.create(pair, r4, {});
    var before4 = Conservation.snapshot(pair);
    var eStart4 = r4.totalEnergy();
    var minR4 = 3e-10;
    for (var s3 = 0; s3 < 1600; s3++) {
      if (!r4.step()) break;
      rx4.step();
      minR4 = Math.min(minR4, bondLength(pair.atoms[0], pair.atoms[1]));
    }
    var chk4 = Conservation.check(before4, Conservation.snapshot(pair));
    var drift4 = Math.abs(r4.totalEnergy() - eStart4) / Math.abs(eStart4);
    record('bond formation follows the bond curve', rx4.ledger.formed === 1 && pair.bonds.length === 1 &&
      chk4.ok && rx4.ledger.conserved && rx4.ledger.topologyWork === 0 && r4.status !== 'unstable',
      'closest approach ' + num(minR4 / ANGSTROM, 3) + ' Å · topology work ' +
      sci(rx4.ledger.topologyWork, 2) + ' J',
      'E ' + sci(eStart4, 3) + ' → ' + sci(r4.totalEnergy(), 3) + ' J, relative drift ' + sci(drift4, 2) +
      ' - the pair already sat on the Morse curve, so writing the bond into the topology cost nothing');

    // 14. Fragment separation: two non-bonded waters must not share charge.
    var two = build([
      placed('O', 0, 0, 0), placed('H', 0.96, 0, 0), placed('H', -0.24, 0.93, 0),
      placed('O', 0, 0, 9), placed('H', 0.96, 0, 9), placed('H', -0.24, 0.93, 9)
    ], [[0, 1, 1], [0, 2, 1], [3, 4, 1], [3, 5, 1]]);
    if (two.ok) {
      var fr = two.mol.chargeModel ? two.mol.chargeModel.fragments : 0;
      record('two fragments equilibrated independently', fr === 2, fr + ' fragments',
        'per-fragment KKT removes the QEq charge-leakage mode');
    } else record('two fragments equilibrated independently', false, '', two.reason);

    var failed = out.filter(function(r) { return !r.ok; }).length;
    var t1 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    return { results: out, failed: failed, passed: out.length - failed, elapsedMs: t1 - t0 };
  }

  // ============================== PHASE 11.5 ==============================
  // Mounting: the entry lives in the INFO sidebar tab beside the science guide,
  // and in the teacher-mode header, which has no sidebar.
  function makeBtn(txt) {
    var btn = document.createElement('button');
    btn.id = 'btn-molecular-physics';
    btn.className = 'science-entry';
    btn.textContent = txt;
    btn.addEventListener('click', function() { Panel.toggle(); });
    return btn;
  }

  function addEntryButton() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('btn-molecular-physics')) return;
    var host = document.getElementById('science-entries');
    if (host) { host.appendChild(makeBtn(TXT(STR.menuBtn))); return; }
    var header = document.querySelector('.header-right');
    if (!header) return;
    var tb = makeBtn(TXT(STR.menuBtn));
    tb.className = 'btn-small';
    var sel = header.querySelector('#topic-selector');
    if (sel) header.insertBefore(tb, sel); else header.appendChild(tb);
  }

  function mount() {
    if (typeof document === 'undefined') return;
    addEntryButton();
    var tries = 0;
    var waitHost = setInterval(function() {
      addEntryButton();
      if (document.getElementById('btn-molecular-physics') || ++tries > 200) clearInterval(waitHost);
    }, 400);
    var relabel = function() {
      var b = document.querySelector('#btn-molecular-physics');
      if (b) b.textContent = TXT(STR.menuBtn);
      Panel.refresh();
    };
    window.addEventListener('mol3d:lang', relabel);
    // The sandbox and teacher mode each own a language key and only re-render
    // their own UI, so the panel watches the effective language directly.
    var seen = curLang();
    setInterval(function() {
      if (curLang() === seen) return;
      seen = curLang();
      relabel();
    }, 250);
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
    else mount();
  }
  return { CONST: CONST, ELEMENTS: ELEMENTS, element: element, dataGaps: dataGaps, Molecule: Molecule, Dynamics: Dynamics, Potentials: Potentials, bondParams: bondParams, assignChargesEEM: assignChargesEEM, PolarizationModel: PolarizationModel, Quantum: Quantum, Thermo: Thermo, Optimizer: Optimizer, Kinetics: Kinetics, Builder: Builder, Reactive: Reactive, Conservation: Conservation, SceneBridge: SceneBridge, Engine: Engine, Panel: Panel, selfTest: selfTest, electronConfiguration: electronConfiguration, vseprValence: vseprValence, angleValue: angleValue, bondLength: bondLength, vlen: vlen };
});