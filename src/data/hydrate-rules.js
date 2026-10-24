// Hydrate formation rules.
// Anhydrous salt + nH2O → hydrated salt
// Water count determined by metal coordination number and charge density.

// Common hydrates with their water counts (empirical data)
export const KNOWN_HYDRATES = {
  'CuSO4':   { water: 5, name: 'copper(II) sulfate pentahydrate', color: 'blue' },
  'CaSO4':   { water: 2, name: 'calcium sulfate dihydrate (gypsum)', color: 'white' },
  'Na2CO3':  { water: 10, name: 'sodium carbonate decahydrate', color: 'white' },
  'CoCl2':   { water: 6, name: 'cobalt(II) chloride hexahydrate', color: 'pink' },
  'NiCl2':   { water: 6, name: 'nickel(II) chloride hexahydrate', color: 'green' },
  'FeCl3':   { water: 6, name: 'iron(III) chloride hexahydrate', color: 'yellow-brown' },
  'FeSO4':   { water: 7, name: 'iron(II) sulfate heptahydrate', color: 'green' },
  'MgSO4':   { water: 7, name: 'magnesium sulfate heptahydrate', color: 'white' },
  'ZnSO4':   { water: 7, name: 'zinc sulfate heptahydrate', color: 'white' },
  'MnSO4':   { water: 7, name: 'manganese(II) sulfate heptahydrate', color: 'pink' },
  'AlCl3':   { water: 6, name: 'aluminum chloride hexahydrate', color: 'white' },
  'CrCl3':   { water: 6, name: 'chromium(III) chloride hexahydrate', color: 'violet' },
  'Na2SO4':  { water: 10, name: 'sodium sulfate decahydrate', color: 'white' },
  'CaCl2':   { water: 6, name: 'calcium chloride hexahydrate', color: 'white' },
  'MgCl2':   { water: 6, name: 'magnesium chloride hexahydrate', color: 'white' },
  'BaCl2':   { water: 2, name: 'barium chloride dihydrate', color: 'white' },
  'SrCl2':   { water: 6, name: 'strontium chloride hexahydrate', color: 'white' },
  'LiCl':    { water: 2, name: 'lithium chloride dihydrate', color: 'white' },
  'K2Cr2O7': { water: 0, name: 'potassium dichromate (anhydrous)', color: 'orange' },
  'KMnO4':   { water: 0, name: 'potassium permanganate (anhydrous)', color: 'purple' },
};

// Coordination numbers by metal ion (most common)
export const COORDINATION_NUMBERS = {
  'Cu2': 6, 'Cu': 4, 'Zn': 6, 'Fe2': 6, 'Fe': 6,
  'Co': 6, 'Ni': 6, 'Mn': 6, 'Cr': 6, 'Al': 6,
  'Ag': 2, 'Pt': 4, 'Pd': 4, 'Au': 4,
  'Ca': 6, 'Mg': 6, 'Ba': 8, 'Sr': 6,
  'Na': 6, 'K': 6, 'Li': 4,
  'Sn': 6, 'Pb': 6, 'Cd': 6, 'Hg': 4,
  'Ti': 6, 'V': 6, 'W': 6, 'Mo': 6,
};

// Predict water count for a salt based on coordination number
export function predictHydrateWater(saltFormula, parsedSalt) {
  if (KNOWN_HYDRATES[saltFormula]) {
    return KNOWN_HYDRATES[saltFormula].water;
  }
  const metals = getTransitionMetals(parsedSalt);
  if (metals.length === 0) return 0;
  const metal = metals[0];
  return COORDINATION_NUMBERS[metal] || 6;
}

// Check if a salt commonly forms hydrates
export function formsHydrate(saltFormula) {
  if (KNOWN_HYDRATES[saltFormula]) {
    return KNOWN_HYDRATES[saltFormula].water > 0;
  }
  const parsed = parseSimple(saltFormula);
  if (!parsed) return false;
  const metals = getTransitionMetals(parsed);
  return metals.length > 0;
}

// Generate hydrate formula string
export function hydrateFormula(saltFormula, waterCount) {
  if (waterCount === 0) return saltFormula;
  if (waterCount === 1) return `${saltFormula}.H2O`;
  return `${saltFormula}.${waterCount}H2O`;
}

// Generate hydrate template: salt atoms + water molecules with coordinate bonds
export function buildHydrateTemplate(saltTpl, waterCount) {
  if (!saltTpl || waterCount <= 0) return saltTpl;

  const atoms = [...saltTpl.atoms];
  const bonds = [...saltTpl.bonds.map(b => [...b])];

  const metalIdx = findMetalIndex(atoms);
  if (metalIdx < 0) return saltTpl;

  for (let w = 0; w < waterCount; w++) {
    const oIdx = atoms.length;
    atoms.push('O');
    const h1Idx = atoms.length;
    atoms.push('H');
    const h2Idx = atoms.length;
    atoms.push('H');

    bonds.push([metalIdx, oIdx, 1, true]);
    bonds.push([oIdx, h1Idx, 1]);
    bonds.push([oIdx, h2Idx, 1]);
  }

  return { atoms, bonds };
}

function getTransitionMetals(parsed) {
  const transitionMetals = new Set([
    'Cu','Zn','Fe','Co','Ni','Mn','Cr','Ag','Pt','Pd','Au',
    'Ti','V','W','Mo','Cd','Hg','Sn','Pb',
  ]);
  const result = [];
  for (const sym of parsed.keys()) {
    if (transitionMetals.has(sym)) result.push(sym);
  }
  return result;
}

function findMetalIndex(atoms) {
  const metals = new Set([
    'Cu','Zn','Fe','Co','Ni','Mn','Cr','Ag','Pt','Pd','Au',
    'Ti','V','W','Mo','Cd','Hg','Sn','Pb','Ca','Mg','Ba','Sr','Al',
  ]);
  for (let i = 0; i < atoms.length; i++) {
    if (metals.has(atoms[i])) return i;
  }
  return -1;
}

function parseSimple(f) {
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
