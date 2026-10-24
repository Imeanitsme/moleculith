// Rule-based thermal decomposition patterns.
// Each rule matches by structural/compositional features (not by specific
// compound names) and generates the correct products.

// Decomposition rule schema:
// {
//   id: string,
//   match: (parsedFormula, elements) => boolean,
//   products: (parsedFormula, elements) => string[],
//   condition: string,
//   description: string,
// }

export const DECOMPOSITION_RULES = [
  // ── Carbonates → metal oxide + CO2 ──
  {
    id: 'carbonate',
    match: (parsed) => {
      const c = parsed.get('C') || 0;
      const o = parsed.get('O') || 0;
      const metals = getMetals(parsed);
      return metals.length > 0 && c >= 1 && o >= 3 && o / c >= 3;
    },
    products: (parsed) => {
      const metals = getMetals(parsed);
      const oxide = buildOxide(metals);
      return [oxide, 'CO2'];
    },
  },

  // ── Hydrogen carbonates → carbonate + CO2 + H2O ──
  {
    id: 'hydrogenCarbonate',
    match: (parsed) => {
      const h = parsed.get('H') || 0;
      const c = parsed.get('C') || 0;
      const o = parsed.get('O') || 0;
      const metals = getMetals(parsed);
      return metals.length > 0 && h > 0 && c >= 1 && o >= 3;
    },
    products: (parsed) => {
      const metals = getMetals(parsed);
      const carbonate = buildCarbonate(metals);
      return [carbonate, 'CO2', 'H2O'];
    },
  },

  // ── Metal hydroxides → metal oxide + H2O (non-alkali) ──
  {
    id: 'hydroxide',
    match: (parsed) => {
      const h = parsed.get('H') || 0;
      const o = parsed.get('O') || 0;
      const metals = getMetals(parsed);
      if (metals.length === 0 || h === 0 || o === 0) return false;
      const metal = metals[0];
      return !['Li', 'Na', 'K', 'Rb', 'Cs'].includes(metal);
    },
    products: (parsed) => {
      const metals = getMetals(parsed);
      const oxide = buildOxide(metals);
      return [oxide, 'H2O'];
    },
  },

  // ── Metal nitrates → metal nitrite + O2 (Group 1/2) ──
  //   or → metal oxide + NO2 + O2 (other metals)
  {
    id: 'nitrate',
    match: (parsed) => {
      const n = parsed.get('N') || 0;
      const o = parsed.get('O') || 0;
      const metals = getMetals(parsed);
      return metals.length > 0 && n >= 1 && o >= 3 && o / n >= 3;
    },
    products: (parsed) => {
      const metals = getMetals(parsed);
      const metal = metals[0];
      if (['Li', 'Na', 'K', 'Rb', 'Cs', 'Ca', 'Ba', 'Sr'].includes(metal)) {
        return [buildNitrite(metals), 'O2'];
      }
      return [buildOxide(metals), 'NO2', 'O2'];
    },
  },

  // ── Chlorates → chloride + O2 ──
  {
    id: 'chlorate',
    match: (parsed) => {
      const cl = parsed.get('Cl') || 0;
      const o = parsed.get('O') || 0;
      const metals = getMetals(parsed);
      return metals.length > 0 && cl >= 1 && o === 3;
    },
    products: (parsed) => {
      const metals = getMetals(parsed);
      return [buildChloride(metals), 'O2'];
    },
  },

  // ── Permanganates → manganate + O2 (or MnO2 + O2) ──
  {
    id: 'permanganate',
    match: (parsed) => {
      const k = parsed.get('K') || 0;
      const mn = parsed.get('Mn') || 0;
      const o = parsed.get('O') || 0;
      return k > 0 && mn > 0 && o === 4;
    },
    products: () => ['K2MnO4', 'MnO2', 'O2'],
  },

  // ── Ammonium salts → NH3 + acid gas ──
  {
    id: 'ammoniumSalt',
    match: (parsed) => {
      const n = parsed.get('N') || 0;
      const h = parsed.get('H') || 0;
      return n >= 1 && h >= 4 && h / n === 4 && !getMetals(parsed).length;
    },
    products: (parsed) => {
      const cl = parsed.get('Cl') || 0;
      const no3 = (parsed.get('N') || 0) >= 2 && (parsed.get('O') || 0) >= 3;
      if (cl > 0) return ['NH3', 'HCl'];
      if (no3) return ['NH3', 'HNO3'];
      const s = parsed.get('S') || 0;
      if (s > 0) return ['NH3', 'H2SO4'];
      return ['NH3'];
    },
  },

  // ── Peroxides → oxide + O2 ──
  {
    id: 'peroxide',
    match: (parsed) => {
      const o = parsed.get('O') || 0;
      const metals = getMetals(parsed);
      if (metals.length === 0) return false;
      const metal = metals[0];
      const metalCount = parsed.get(metal) || 1;
      return o / metalCount >= 1 && o / metalCount <= 1.5;
    },
    products: (parsed) => {
      const metals = getMetals(parsed);
      return [buildOxide(metals), 'O2'];
    },
  },

  // ── Hydrated salts → anhydrous + nH2O ──
  {
    id: 'hydrate',
    match: (parsed) => {
      const h = parsed.get('H') || 0;
      const o = parsed.get('O') || 0;
      const metals = getMetals(parsed);
      if (metals.length === 0) return false;
      const nonWaterO = estimateNonWaterOxygen(parsed, metals);
      return h >= 2 && o > nonWaterO && h % 2 === 0;
    },
    products: (parsed) => {
      const metals = getMetals(parsed);
      const anhydrous = buildAnhydrous(parsed, metals);
      return [anhydrous, 'H2O'];
    },
  },

  // ── Metal oxides with low-activity metals → metal + O2 ──
  {
    id: 'nobleOxide',
    match: (parsed) => {
      const metals = getMetals(parsed);
      if (metals.length === 0) return false;
      const metal = metals[0];
      return ['Ag', 'Hg', 'Au'].includes(metal);
    },
    products: (parsed) => {
      const metals = getMetals(parsed);
      return [metals[0], 'O2'];
    },
  },

  // ── Sulfates → oxide + SO3 (high heat, non-alkali) ──
  {
    id: 'sulfate',
    match: (parsed) => {
      const s = parsed.get('S') || 0;
      const o = parsed.get('O') || 0;
      const metals = getMetals(parsed);
      if (metals.length === 0 || s === 0) return false;
      const metal = metals[0];
      return !['Na', 'K', 'Li'].includes(metal) && o / s >= 4;
    },
    products: (parsed) => {
      const metals = getMetals(parsed);
      return [buildOxide(metals), 'SO3'];
    },
  },
];

// ── Helpers ──

const METAL_SET = new Set([
  'Li','Na','K','Rb','Cs','Be','Mg','Ca','Sr','Ba','Al','Zn','Ag',
  'Cu','Fe','Mn','Cr','Ni','Co','Pb','Sn','W','Mo','V','Ti','Au',
  'Pt','Pd','Hg','Cd','Cd','Bi',
]);

function getMetals(parsed) {
  const metals = [];
  for (const sym of parsed.keys()) {
    if (METAL_SET.has(sym)) metals.push(sym);
  }
  return metals;
}

function buildOxide(metals) {
  if (metals.length === 0) return 'O2';
  const metal = metals[0];
  const charges = { Li:1,Na:1,K:1,Rb:1,Cs:1,Be:2,Mg:2,Ca:2,Sr:2,Ba:2,
    Al:3,Zn:2,Ag:1,Cu:2,Fe:3,Mn:2,Cr:3,Ni:2,Co:2,Pb:2,Sn:2,W:6,Mo:6,
    V:5,Ti:4,Au:3,Pt:4,Pd:2,Hg:2,Cd:2,Bi:3,Fe2:2 };
  const charge = charges[metal] || 2;
  if (charge === 2) return `${metal}O`;
  if (charge === 1) return `${metal}2O`;
  return `${metal}2O${charge}`;
}

function buildNitrite(metals) {
  const metal = metals[0];
  const charges = { Li:1,Na:1,K:1,Rb:1,Cs:1,Ca:2,Ba:2,Sr:2 };
  const charge = charges[metal] || 1;
  if (charge === 1) return `${metal}NO2`;
  return `${metal}(NO2)${charge}`;
}

function buildChloride(metals) {
  const metal = metals[0];
  const charges = { Li:1,Na:1,K:1,Rb:1,Cs:1,Be:2,Mg:2,Ca:2,Sr:2,Ba:2,
    Al:3,Zn:2,Ag:1,Cu:2,Fe:3,Mn:2,Cr:3,Ni:2,Co:2,Pb:2,Sn:2 };
  const charge = charges[metal] || 2;
  if (charge === 1) return `${metal}Cl`;
  if (charge === 2) return `${metal}Cl2`;
  return `${metal}Cl${charge}`;
}

function buildCarbonate(metals) {
  const metal = metals[0];
  const charges = { Li:1,Na:1,K:1,Rb:1,Cs:1,Ca:2,Ba:2,Sr:2,Mg:2,Zn:2,Cu:2,Fe:3,Al:3 };
  const charge = charges[metal] || 2;
  if (charge === 1) return `${metal}HCO3`;
  if (charge === 2) return `${metal}CO3`;
  return `${metal}2(CO3)${charge}`;
}

function estimateNonWaterOxygen(parsed, metals) {
  const h = parsed.get('H') || 0;
  const waterO = h / 2;
  return (parsed.get('O') || 0) - waterO;
}

function buildAnhydrous(parsed, metals) {
  const h = parsed.get('H') || 0;
  const waterO = h / 2;
  const metal = metals[0];
  const metalCount = parsed.get(metal) || 1;
  const totalO = parsed.get('O') || 0;
  const remainingO = totalO - waterO;
  let formula = metal;
  if (metalCount > 1) formula += metalCount;
  const otherNonH = [...parsed.keys()].filter(s => s !== 'H' && s !== 'O' && s !== metal);
  for (const s of otherNonH) {
    formula += s + (parsed.get(s) || '');
  }
  if (remainingO > 0) formula += 'O' + (remainingO > 1 ? remainingO : '');
  return formula;
}
