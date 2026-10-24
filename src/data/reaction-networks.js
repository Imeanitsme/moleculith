// Data-driven reaction network configurations for biochemical pathways
// and industrial processes. Each network is a JSON-compatible spec that
// can be fed directly into the kinetics solver (compileNetwork).
//
// Schema matches kinetics.js's compileNetwork input:
// {
//   species: string[],
//   reactions: [{
//     reactants: [{ speciesId, stoichiometry }],
//     products: [{ speciesId, stoichiometry }],
//     rateConstant: number,
//     customRateExpr?: string,
//     arrhenius?: { A: number, Ea: number },
//     enzyme?: string,
//   }],
//   temperature?: number,
// }

export const BIOCHEMICAL_NETWORKS = {
  glycolysis: {
    name: 'Glycolysis (simplified)',
    species: ['Glucose', 'G6P', 'F6P', 'F16BP', 'G3P', 'Pyruvate', 'ATP', 'ADP', 'NAD', 'NADH'],
    initialConcentrations: {
      Glucose: 5e-3, ATP: 2e-3, NAD: 1e-3,
      G6P: 0, F6P: 0, F16BP: 0, G3P: 0, Pyruvate: 0, ADP: 0.5e-3, NADH: 0,
    },
    reactions: [
      {
        reactants: [{ speciesId: 'Glucose', stoichiometry: 1 }, { speciesId: 'ATP', stoichiometry: 1 }],
        products: [{ speciesId: 'G6P', stoichiometry: 1 }, { speciesId: 'ADP', stoichiometry: 1 }],
        rateConstant: 200,
        enzyme: 'hexokinase',
      },
      {
        reactants: [{ speciesId: 'G6P', stoichiometry: 1 }],
        products: [{ speciesId: 'F6P', stoichiometry: 1 }],
        rateConstant: 80,
        enzyme: 'phosphoglucose isomerase',
      },
      {
        reactants: [{ speciesId: 'F6P', stoichiometry: 1 }, { speciesId: 'ATP', stoichiometry: 1 }],
        products: [{ speciesId: 'F16BP', stoichiometry: 1 }, { speciesId: 'ADP', stoichiometry: 1 }],
        rateConstant: 100,
        enzyme: 'phosphofructokinase',
      },
      {
        reactants: [{ speciesId: 'F16BP', stoichiometry: 1 }],
        products: [{ speciesId: 'G3P', stoichiometry: 2 }],
        rateConstant: 50,
        enzyme: 'aldolase',
      },
      {
        reactants: [{ speciesId: 'G3P', stoichiometry: 1 }, { speciesId: 'NAD', stoichiometry: 1 }],
        products: [{ speciesId: 'Pyruvate', stoichiometry: 1 }, { speciesId: 'NADH', stoichiometry: 1 }],
        rateConstant: 30,
        enzyme: 'GAPDH + pyruvate kinase',
      },
    ],
    temperature: 310.15,
  },

  fermentation: {
    name: 'Alcoholic Fermentation',
    species: ['Glucose', 'Ethanol', 'CO2', 'ATP', 'ADP'],
    initialConcentrations: { Glucose: 10e-3, ATP: 1e-3, Ethanol: 0, CO2: 0, ADP: 0.5e-3 },
    reactions: [
      {
        reactants: [{ speciesId: 'Glucose', stoichiometry: 1 }, { speciesId: 'ADP', stoichiometry: 2 }],
        products: [{ speciesId: 'Ethanol', stoichiometry: 2 }, { speciesId: 'CO2', stoichiometry: 2 }, { speciesId: 'ATP', stoichiometry: 2 }],
        rateConstant: 0.5,
        enzyme: 'zymase',
      },
    ],
    temperature: 303.15,
  },

  krebsCycle: {
    name: 'Krebs Cycle (simplified)',
    species: ['AcetylCoA', 'Citrate', 'Oxaloacetate', 'CO2', 'NADH', 'NAD', 'FADH2', 'FAD', 'ATP', 'ADP'],
    initialConcentrations: {
      AcetylCoA: 1e-3, Oxaloacetate: 0.5e-3, NAD: 2e-3, FAD: 0.5e-3, ADP: 1e-3,
      Citrate: 0, CO2: 0, NADH: 0, FADH2: 0, ATP: 0,
    },
    reactions: [
      {
        reactants: [{ speciesId: 'AcetylCoA', stoichiometry: 1 }, { speciesId: 'Oxaloacetate', stoichiometry: 1 }],
        products: [{ speciesId: 'Citrate', stoichiometry: 1 }],
        rateConstant: 100,
        enzyme: 'citrate synthase',
      },
      {
        reactants: [{ speciesId: 'Citrate', stoichiometry: 1 }, { speciesId: 'NAD', stoichiometry: 3 }],
        products: [{ speciesId: 'Oxaloacetate', stoichiometry: 1 }, { speciesId: 'CO2', stoichiometry: 2 }, { speciesId: 'NADH', stoichiometry: 3 }],
        rateConstant: 20,
        enzyme: 'isocitrate DH + α-KG DH',
      },
      {
        reactants: [{ speciesId: 'ADP', stoichiometry: 1 }],
        products: [{ speciesId: 'ATP', stoichiometry: 1 }],
        rateConstant: 50,
        enzyme: 'succinyl-CoA synthetase',
      },
    ],
    temperature: 310.15,
  },

  carbonicAnhydrase: {
    name: 'CO2 Hydration (carbonic anhydrase)',
    species: ['CO2', 'H2O', 'HCO3', 'H'],
    initialConcentrations: { CO2: 1.2e-3, H2O: 55.5, HCO3: 24e-3, H: 1e-7 },
    reactions: [
      {
        reactants: [{ speciesId: 'CO2', stoichiometry: 1 }, { speciesId: 'H2O', stoichiometry: 1 }],
        products: [{ speciesId: 'HCO3', stoichiometry: 1 }, { speciesId: 'H', stoichiometry: 1 }],
        rateConstant: 1e4,
        enzyme: 'carbonic anhydrase',
      },
    ],
    temperature: 310.15,
  },
};

export const INDUSTRIAL_NETWORKS = {
  haberProcess: {
    name: 'Haber-Bosch Process',
    species: ['N2', 'H2', 'NH3'],
    initialConcentrations: { N2: 0.5, H2: 1.5, NH3: 0 },
    reactions: [
      {
        reactants: [{ speciesId: 'N2', stoichiometry: 1 }, { speciesId: 'H2', stoichiometry: 3 }],
        products: [{ speciesId: 'NH3', stoichiometry: 2 }],
        rateConstant: 0.01,
        arrhenius: { A: 1.5e3, Ea: 335000 },
      },
    ],
    temperature: 723.15,
  },

  contactProcess: {
    name: 'Contact Process (SO2 oxidation)',
    species: ['SO2', 'O2', 'SO3'],
    initialConcentrations: { SO2: 0.1, O2: 0.05, SO3: 0 },
    reactions: [
      {
        reactants: [{ speciesId: 'SO2', stoichiometry: 2 }, { speciesId: 'O2', stoichiometry: 1 }],
        products: [{ speciesId: 'SO3', stoichiometry: 2 }],
        rateConstant: 0.1,
        arrhenius: { A: 50, Ea: 98000 },
      },
    ],
    temperature: 723.15,
  },

  ostwaldProcess: {
    name: 'Ostwald Process (NH3 → HNO3)',
    species: ['NH3', 'O2', 'NO', 'NO2', 'H2O', 'HNO3'],
    initialConcentrations: { NH3: 0.1, O2: 0.25, NO: 0, NO2: 0, H2O: 0.1, HNO3: 0 },
    reactions: [
      {
        reactants: [{ speciesId: 'NH3', stoichiometry: 4 }, { speciesId: 'O2', stoichiometry: 5 }],
        products: [{ speciesId: 'NO', stoichiometry: 4 }, { speciesId: 'H2O', stoichiometry: 6 }],
        rateConstant: 5,
        arrhenius: { A: 2e6, Ea: 116000 },
      },
      {
        reactants: [{ speciesId: 'NO', stoichiometry: 2 }, { speciesId: 'O2', stoichiometry: 1 }],
        products: [{ speciesId: 'NO2', stoichiometry: 2 }],
        rateConstant: 0.5,
      },
      {
        reactants: [{ speciesId: 'NO2', stoichiometry: 3 }, { speciesId: 'H2O', stoichiometry: 1 }],
        products: [{ speciesId: 'HNO3', stoichiometry: 2 }, { speciesId: 'NO', stoichiometry: 1 }],
        rateConstant: 0.1,
      },
    ],
    temperature: 1123.15,
  },

  solvayProcess: {
    name: 'Solvay Process (Na2CO3 production)',
    species: ['NaCl', 'NH3', 'CO2', 'H2O', 'NaHCO3', 'NH4Cl', 'Na2CO3'],
    initialConcentrations: { NaCl: 5, NH3: 1, CO2: 1, H2O: 55.5, NaHCO3: 0, NH4Cl: 0, Na2CO3: 0 },
    reactions: [
      {
        reactants: [{ speciesId: 'NaCl', stoichiometry: 1 }, { speciesId: 'NH3', stoichiometry: 1 }, { speciesId: 'CO2', stoichiometry: 1 }, { speciesId: 'H2O', stoichiometry: 1 }],
        products: [{ speciesId: 'NaHCO3', stoichiometry: 1 }, { speciesId: 'NH4Cl', stoichiometry: 1 }],
        rateConstant: 0.05,
      },
      {
        reactants: [{ speciesId: 'NaHCO3', stoichiometry: 2 }],
        products: [{ speciesId: 'Na2CO3', stoichiometry: 1 }],
        rateConstant: 0.001,
        arrhenius: { A: 100, Ea: 150000 },
      },
    ],
    temperature: 333.15,
  },
};

export const ALL_NETWORKS = {
  ...BIOCHEMICAL_NETWORKS,
  ...INDUSTRIAL_NETWORKS,
};
