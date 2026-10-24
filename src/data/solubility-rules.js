// Solubility rules extracted from reactions.js.
// Data-driven solubility prediction based on cation/anion classification.

export const COMMON_CATIONS = {
  'Li':  { sym: 'Li',  charge: 1, group: 1 },
  'Na':  { sym: 'Na',  charge: 1, group: 1 },
  'K':   { sym: 'K',   charge: 1, group: 1 },
  'Rb':  { sym: 'Rb',  charge: 1, group: 1 },
  'Cs':  { sym: 'Cs',  charge: 1, group: 1 },
  'NH4': { sym: 'NH4', charge: 1, group: -1 },
  'Ag':  { sym: 'Ag',  charge: 1, group: -2 },
  'Pb':  { sym: 'Pb',  charge: 2, group: -2 },
  'Hg2': { sym: 'Hg2', charge: 2, group: -2 },
  'Ba':  { sym: 'Ba',  charge: 2, group: 2 },
  'Sr':  { sym: 'Sr',  charge: 2, group: 2 },
  'Ca':  { sym: 'Ca',  charge: 2, group: 2 },
  'Mg':  { sym: 'Mg',  charge: 2, group: 2 },
  'Fe':  { sym: 'Fe',  charge: 3, group: -3 },
  'Fe2': { sym: 'Fe',  charge: 2, group: -3 },
  'Cu':  { sym: 'Cu',  charge: 2, group: -3 },
  'Cu1': { sym: 'Cu',  charge: 1, group: -3 },
  'Zn':  { sym: 'Zn',  charge: 2, group: -3 },
  'Al':  { sym: 'Al',  charge: 3, group: -3 },
  'Cr':  { sym: 'Cr',  charge: 3, group: -3 },
  'Ni':  { sym: 'Ni',  charge: 2, group: -3 },
  'Co':  { sym: 'Co',  charge: 2, group: -3 },
  'Mn':  { sym: 'Mn',  charge: 2, group: -3 },
};

export const COMMON_ANIONS = {
  'NO3':   { sym: 'NO3',   charge: -1, type: 'nitrate' },
  'NO2':   { sym: 'NO2',   charge: -1, type: 'nitrite' },
  'C2H3O2': { sym: 'C2H3O2', charge: -1, type: 'acetate' },
  'Cl':    { sym: 'Cl',    charge: -1, type: 'halide' },
  'Br':    { sym: 'Br',    charge: -1, type: 'halide' },
  'I':     { sym: 'I',     charge: -1, type: 'halide' },
  'SO4':   { sym: 'SO4',   charge: -2, type: 'sulfate' },
  'SO3':   { sym: 'SO3',   charge: -2, type: 'sulfite' },
  'HSO4':  { sym: 'HSO4',  charge: -1, type: 'hydrogenSulfate' },
  'HCO3':  { sym: 'HCO3',  charge: -1, type: 'hydrogenCarbonate' },
  'H2PO4': { sym: 'H2PO4', charge: -1, type: 'dihydrogenPhosphate' },
  'OH':    { sym: 'OH',    charge: -1, type: 'hydroxide' },
  'S':     { sym: 'S',     charge: -2, type: 'sulfide' },
  'CO3':   { sym: 'CO3',   charge: -2, type: 'carbonate' },
  'PO4':   { sym: 'PO4',   charge: -3, type: 'phosphate' },
  'CrO4':  { sym: 'CrO4',  charge: -2, type: 'chromate' },
  'SiO3':  { sym: 'SiO3',  charge: -2, type: 'silicate' },
  'ClO':   { sym: 'ClO',   charge: -1, type: 'hypochlorite' },
  'ClO2':  { sym: 'ClO2',  charge: -1, type: 'chlorite' },
  'ClO3':  { sym: 'ClO3',  charge: -1, type: 'chlorate' },
  'ClO4':  { sym: 'ClO4',  charge: -1, type: 'perchlorate' },
  'MnO4':  { sym: 'MnO4',  charge: -1, type: 'permanganate' },
  'AlO2':  { sym: 'AlO2',  charge: -1, type: 'metalate' },
  'ZnO2':  { sym: 'ZnO2',  charge: -2, type: 'metalate' },
  'CN':    { sym: 'CN',    charge: -1, type: 'cyanide' },
};

// Approximate Ksp values for common insoluble salts (at 25°C).
// Used for quantitative precipitation predictions.
export const KSP_VALUES = {
  'AgCl': 1.8e-10, 'AgBr': 5.4e-13, 'AgI': 8.5e-17,
  'PbCl2': 1.7e-5, 'PbBr2': 6.6e-6, 'PbI2': 9.8e-9,
  'BaSO4': 1.1e-10, 'SrSO4': 3.2e-7, 'PbSO4': 2.5e-8,
  'CaSO4': 4.9e-5,
  'CaCO3': 3.4e-9, 'BaCO3': 2.6e-9, 'SrCO3': 5.6e-10,
  'Fe(OH)3': 2.8e-39, 'Al(OH)3': 1.3e-33, 'Cu(OH)2': 2.2e-20,
  'Zn(OH)2': 3.0e-17, 'Mg(OH)2': 5.6e-12, 'Ca(OH)2': 5.5e-6,
  'Ag2CO3': 8.5e-12, 'PbCO3': 7.4e-14,
  'Ca3(PO4)2': 2.0e-29, 'Ag3PO4': 8.9e-17,
  'FeS': 6.3e-18, 'CuS': 6.3e-36, 'ZnS': 2.0e-25, 'PbS': 3.0e-28,
  'Ag2S': 6.3e-50, 'HgS': 1.6e-52,
  'AgCN': 6.0e-17, 'Pb(CN)2': 3.5e-16,
  'CaCrO4': 1.0e-8, 'BaCrO4': 1.2e-10, 'PbCrO4': 2.8e-13,
  'CaSiO3': 1.0e-8,
};

export function isSoluble(cation, anion) {
  if (!cation || !anion) return true;
  if (cation.group === 1 || cation.sym === 'NH4') return true;
  if (anion.type === 'nitrate' || anion.type === 'acetate') return true;
  if (anion.type === 'halide') {
    if (cation.sym === 'Ag' || cation.sym === 'Pb' || cation.sym === 'Hg2') return false;
    return true;
  }
  if (anion.type === 'sulfate') {
    if (cation.sym === 'Ba' || cation.sym === 'Sr' || cation.sym === 'Pb') return false;
    return true;
  }
  if (anion.type === 'hydrogenCarbonate' || anion.type === 'hydrogenSulfate' ||
      anion.type === 'dihydrogenPhosphate' || anion.type === 'metalate' ||
      anion.type === 'permanganate' || anion.type === 'chlorate' ||
      anion.type === 'perchlorate' || anion.type === 'hypochlorite' ||
      anion.type === 'chlorite' || anion.type === 'nitrite') return true;
  if (anion.type === 'cyanide') {
    return !(cation.sym === 'Ag' || cation.sym === 'Pb');
  }
  if (anion.type === 'hydroxide' || anion.type === 'sulfide' ||
      anion.type === 'carbonate' || anion.type === 'phosphate' ||
      anion.type === 'chromate' || anion.type === 'sulfite' ||
      anion.type === 'silicate') {
    return false;
  }
  return true;
}

// Check if a precipitate will form given ion concentrations and Ksp
export function willPrecipitate(ksp, ionProduct) {
  return ionProduct > ksp;
}
