// Bond type taxonomy.
// Extends the bond schema from strict integer orders (1-4) to support
// fractional orders (1.5 for aromatic) and typed bonds (covalent, ionic,
// coordinate, hydrogen, aromatic).

export const BOND_TYPES = {
  COVALENT: 'covalent',
  IONIC: 'ionic',
  COORDINATE: 'coordinate',
  HYDROGEN: 'hydrogen',
  AROMATIC: 'aromatic',
  METALLIC: 'metallic',
};

// Default bond orders by type
export const BOND_ORDER = {
  [BOND_TYPES.COVALENT]: 1,
  [BOND_TYPES.IONIC]: 1,
  [BOND_TYPES.COORDINATE]: 1,
  [BOND_TYPES.HYDROGEN]: 0,
  [BOND_TYPES.AROMATIC]: 1.5,
  [BOND_TYPES.METALLIC]: 0,
};

// Classify bond type from element pair and context.
// Uses electronegativity difference and the existing ionic flag.
export function classifyBond(symA, symB, bondOrder, ionicFlag) {
  if (ionicFlag) return BOND_TYPES.IONIC;
  if (Math.abs(bondOrder - 1.5) < 0.1) return BOND_TYPES.AROMATIC;

  const enA = ELECTRONEGATIVITY[symA];
  const enB = ELECTRONEGATIVITY[symB];
  if (enA === undefined || enB === undefined) return BOND_TYPES.COVALENT;

  const diff = Math.abs(enA - enB);
  if (diff > 1.7) return BOND_TYPES.IONIC;
  if (diff > 0.5) return BOND_TYPES.COVALENT;
  return BOND_TYPES.COVALENT;
}

// Bond energy in kJ/mol (approximate averages)
export const BOND_ENERGY = {
  'H-H': 436, 'H-O': 463, 'H-N': 391, 'H-C': 413, 'H-F': 567,
  'H-Cl': 431, 'H-Br': 366, 'H-I': 299, 'H-S': 339,
  'C-C': 348, 'C=C': 614, 'C#C': 839,
  'C-O': 358, 'C=O': 799, 'C-N': 305, 'C=N': 615, 'C#N': 891,
  'C-F': 485, 'C-Cl': 339, 'C-Br': 276, 'C-I': 240,
  'C-S': 259, 'C=C(aromatic)': 518,
  'N-N': 163, 'N=N': 418, 'N#N': 945,
  'N-O': 201, 'N=O': 607,
  'O-O': 146, 'O=O': 498,
  'S-S': 226, 'S=O': 523,
  'Cl-Cl': 242, 'Br-Br': 193, 'I-I': 151, 'F-F': 159,
  'Na-Cl': 410, 'K-Cl': 430, 'Mg-O': 394, 'Ca-O': 464,
  'Fe-O': 397, 'Al-O': 511,
};

// Bond length in pm (approximate averages)
export const BOND_LENGTH = {
  'H-H': 74, 'H-O': 96, 'H-N': 101, 'H-C': 109, 'H-F': 92,
  'H-Cl': 127, 'H-Br': 141, 'H-I': 161,
  'C-C': 154, 'C=C': 134, 'C#C': 120,
  'C-O': 143, 'C=O': 120, 'C-N': 147, 'C=N': 128, 'C#N': 116,
  'C-F': 135, 'C-Cl': 177, 'C-Br': 194, 'C-I': 214,
  'C-S': 182, 'C=C(aromatic)': 140,
  'N-N': 145, 'N=N': 125, 'N#N': 110,
  'O-O': 148, 'O=O': 121,
  'Cl-Cl': 199, 'Br-Br': 228, 'I-I': 267, 'F-F': 142,
  'Na-Cl': 236, 'K-Cl': 267,
};

const ELECTRONEGATIVITY = {
  'H': 2.20, 'He': 0, 'Li': 0.98, 'Be': 1.57, 'B': 2.04, 'C': 2.55,
  'N': 3.04, 'O': 3.44, 'F': 3.98, 'Ne': 0, 'Na': 0.93, 'Mg': 1.31,
  'Al': 1.61, 'Si': 1.90, 'P': 2.19, 'S': 2.58, 'Cl': 3.16, 'Ar': 0,
  'K': 0.82, 'Ca': 1.00, 'Sc': 1.36, 'Ti': 1.54, 'V': 1.63, 'Cr': 1.66,
  'Mn': 1.55, 'Fe': 1.83, 'Co': 1.88, 'Ni': 1.91, 'Cu': 1.90, 'Zn': 1.65,
  'Ga': 1.81, 'Ge': 2.01, 'As': 2.18, 'Se': 2.55, 'Br': 2.96, 'Kr': 3.00,
  'Rb': 0.82, 'Sr': 0.95, 'Ag': 1.93, 'Cd': 1.69, 'Sn': 1.96, 'Sb': 2.05,
  'Te': 2.10, 'I': 2.66, 'Xe': 2.60, 'Cs': 0.79, 'Ba': 0.95, 'Au': 2.54,
  'Hg': 2.00, 'Pb': 2.33, 'Bi': 2.02, 'Pt': 2.28, 'W': 2.36, 'Mo': 2.16,
};

// Get approximate bond length for a pair of elements and bond order
export function estimatedBondLength(symA, symB, order) {
  const key1 = `${symA}-${symB}`;
  const key2 = `${symB}-${symA}`;
  const base = BOND_LENGTH[key1] || BOND_LENGTH[key2];
  if (!base) return 150;
  if (Math.abs(order - 1) < 0.1) return base;
  if (Math.abs(order - 2) < 0.1) {
    const doubleKey = key1.replace('-', '=');
    return BOND_LENGTH[doubleKey] || Math.round(base * 0.87);
  }
  if (Math.abs(order - 3) < 0.1) {
    const tripleKey = key1.replace('-', '#');
    return BOND_LENGTH[tripleKey] || Math.round(base * 0.80);
  }
  if (Math.abs(order - 1.5) < 0.1) return Math.round(base * 0.93);
  return base;
}
