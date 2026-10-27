/**
 * Molecular Simulation Engine
 * 
 * Comprehensive system for molecular behavior, stability, reactions, and energy calculations.
 * Bridges macroscopic kinetics with structural and quantum-ready extensibility.
 * 
 * Modules:
 * 1. ThermodynamicSystem - Potential energy, free energy, stability flags
 * 2. KineticsEngine - Arrhenius rates, activation barriers, temperature
 * 3. StructuralStrain - BDE, angle strain, steric effects
 * 4. QMInterface - Extensible hook for quantum mechanical calculations
 */

// Universal gas constant (J/(mol·K))
export const R_GAS = 8.314;

// Standard temperature (298.15 K = 25°C)
export const T_STANDARD = 298.15;

// ============================================================================
// Module 1: Thermodynamic & Potential Energy System
// ============================================================================

export class ThermodynamicSystem {
  constructor() {
    // Lookup tables for standard formation enthalpies (kJ/mol)
    this.dHfTable = new Map([
      ['H2', 0], ['O2', 0], ['N2', 0], ['F2', 0], ['Cl2', 0],
      ['H2O', -285.83], ['CO2', -393.51], ['CH4', -74.81],
      ['NH3', -46.11], ['HCl', -92.31], ['NaCl', -411.12],
      ['H2O2', -187.78], ['O3', 142.67], ['NO', 90.25],
      ['NO2', 33.18], ['SO2', -296.83], ['SO3', -395.72],
    ]);

    // Standard entropies (J/(mol·K))
    this.sTable = new Map([
      ['H2', 130.68], ['O2', 205.14], ['N2', 191.61],
      ['H2O', 69.91], ['CO2', 213.74], ['CH4', 186.26],
      ['NH3', 192.45], ['HCl', 186.90], ['NaCl', 72.11],
    ]);

    // Cache for computed energies
    this.energyCache = new Map();
  }

  /**
   * Calculate baseline potential energy for a molecule
   * Uses bond energy summation approach
   */
  calculatePotentialEnergy(atoms, bonds) {
    const cacheKey = this.getCacheKey(atoms, bonds);
    if (this.energyCache.has(cacheKey)) {
      return this.energyCache.get(cacheKey);
    }

    let ePotential = 0;

    // Sum bond dissociation energies
    for (const bond of bonds) {
      const bde = this.getBondDissociationEnergy(bond, atoms);
      ePotential -= bde; // Negative because bonds stabilize
    }

    // Add atomic formation energies
    for (const atom of atoms) {
      const eForm = this.getFormationEnergy(atom.el.sym);
      ePotential += eForm;
    }

    this.energyCache.set(cacheKey, ePotential);
    return ePotential;
  }

  /**
   * Calculate Gibbs free energy change: ΔG = ΔH - TΔS
   */
  calculateFreeEnergy(atoms, bonds, temperature = T_STANDARD) {
    const dH = this.calculateEnthalpyChange(atoms, bonds);
    const dS = this.calculateEntropyChange(atoms, bonds);
    const dG = dH - temperature * (dS / 1000); // Convert J to kJ
    return { dG, dH, dS, temperature };
  }

  /**
   * Check if molecule is thermodynamically unstable
   * Returns true if ΔG < 0 for decomposition
   */
  isThermodynamicallyUnstable(atoms, bonds, temperature = T_STANDARD) {
    const { dG } = this.calculateFreeEnergy(atoms, bonds, temperature);
    return dG < -50; // Threshold for significant instability (kJ/mol)
  }

  /**
   * Calculate enthalpy change from formation energies
   */
  calculateEnthalpyChange(atoms, bonds) {
    let dH = 0;
    for (const bond of bonds) {
      dH -= this.getBondDissociationEnergy(bond, atoms);
    }
    return dH;
  }

  /**
   * Calculate entropy change (simplified)
   */
  calculateEntropyChange(atoms, bonds) {
    // Simplified: more bonds = lower entropy
    const baseEntropy = atoms.length * 150; // J/(mol·K) per atom
    const bondPenalty = bonds.length * 50; // Each bond reduces entropy
    return baseEntropy - bondPenalty;
  }

  /**
   * Get bond dissociation energy (kJ/mol)
   */
  getBondDissociationEnergy(bond, atomsMap) {
    const bdeTable = {
      1: { 'H-H': 436, 'C-H': 413, 'C-C': 348, 'C-O': 358, 'O-H': 463,
           'N-H': 391, 'C-N': 305, 'O-O': 146, 'C-F': 485, 'C-Cl': 339 },
      2: { 'C=C': 614, 'C=O': 799, 'N=N': 418, 'O=O': 498 },
      3: { 'CC': 839, 'C≡N': 891, 'N≡N': 945 },
    };

    const order = bond.order || 1;
    const atomA = atomsMap.get(bond.a);
    const atomB = atomsMap.get(bond.b);
    if (!atomA || !atomB) return 350; // Default if atoms not found
    
    const syms = [atomA.el.sym, atomB.el.sym].sort();
    const bondChar = order === 1 ? '-' : order === 2 ? '=' : '≡';
    const key = `${syms[0]}${bondChar}${syms[1]}`;
    
    return bdeTable[order]?.[key] || 350; // Default average BDE
  }

  /**
   * Get formation energy for an element (kJ/mol)
   */
  getFormationEnergy(sym) {
    // Standard state elements have ΔHf = 0
    const stableElements = ['H', 'O', 'N', 'F', 'Cl', 'Br', 'I', 'S', 'P', 'C'];
    if (stableElements.includes(sym)) return 0;
    
    // Approximate values for other elements
    return 50; // Default positive value for non-standard state
  }

  getCacheKey(atoms, bonds) {
    // Handle both Map and array
    const atomList = atoms instanceof Map ? Array.from(atoms.values()) : atoms;
    const atomKeys = atomList.map(a => a.id).sort().join(',');
    const bondKeys = bonds.map(b => `${b.a}-${b.b}`).sort().join(',');
    return `${atomKeys}|${bondKeys}`;
  }

  clearCache() {
    this.energyCache.clear();
  }
}

// ============================================================================
// Module 2: Kinetics & Temperature-Dependent Rates (Arrhenius Engine)
// ============================================================================

export class KineticsEngine {
  constructor() {
    // Global temperature (Kelvin)
    this.globalTemperature = T_STANDARD;
    
    // Local temperature overrides (for specific molecules/regions)
    this.localTemperatures = new Map();

    // Pre-exponential factors (s^-1) for different reaction types
    this.preExponentialFactors = {
      unimolecular: 1e13,
      bimolecular: 1e10,
      radical: 1e14,
    };
  }

  /**
   * Calculate rate constant using Arrhenius equation
   * k = A * exp(-Ea / (R * T))
   * @param {number} ea - Activation energy in kJ/mol
   * @param {number} temperature - Temperature in Kelvin
   * @param {string} reactionType - Type of reaction for pre-exponential factor
   */
  calculateRateConstant(ea, temperature = null, reactionType = 'unimolecular') {
    const T = temperature || this.globalTemperature;
    const A = this.preExponentialFactors[reactionType] || 1e13;
    
    // Convert Ea from kJ/mol to J/mol for Arrhenius equation
    const eaJ = ea * 1000;
    
    // Arrhenius equation
    const k = A * Math.exp(-eaJ / (R_GAS * T));
    return k;
  }

  /**
   * Calculate half-life for first-order decomposition
   * t1/2 = ln(2) / k
   */
  calculateHalfLife(ea, temperature = null) {
    const k = this.calculateRateConstant(ea, temperature);
    if (k <= 0) return Infinity;
    return Math.LN2 / k;
  }

  /**
   * Check if molecule will thermally decompose at given temperature
   * Returns decomposition probability per second
   */
  calculateDecompositionProbability(ea, temperature = null, dt = 1) {
    const k = this.calculateRateConstant(ea, temperature);
    // Probability = 1 - exp(-k*dt) ≈ k*dt for small k*dt
    return 1 - Math.exp(-k * dt);
  }

  /**
   * Set global temperature
   */
  setGlobalTemperature(tempK) {
    this.globalTemperature = Math.max(0, tempK);
  }

  /**
   * Set local temperature for a specific molecule
   */
  setLocalTemperature(moleculeId, tempK) {
    this.localTemperatures.set(moleculeId, Math.max(0, tempK));
  }

  /**
   * Get effective temperature for a molecule
   */
  getTemperature(moleculeId = null) {
    if (moleculeId && this.localTemperatures.has(moleculeId)) {
      return this.localTemperatures.get(moleculeId);
    }
    return this.globalTemperature;
  }

  /**
   * Calculate activation energy modifier based on temperature
   * Higher temperature effectively lowers Ea barrier
   */
  getEffectiveActivationEnergy(ea, temperature = null) {
    const T = temperature || this.globalTemperature;
    const TRef = T_STANDARD;
    
    // Temperature scaling factor (empirical)
    const scaleFactor = Math.exp((T - TRef) / 100);
    return ea / scaleFactor;
  }
}

// ============================================================================
// Module 3: Structural Strain & Bonding Factors
// ============================================================================

export class StructuralStrain {
  constructor() {
    // Bond dissociation energy modifiers
    this.bdeModifiers = {
      peroxide: 0.3,    // O-O bonds are weak
      radical: 0.5,     // Radical bonds are unstable
      strained: 0.7,    // Strained ring bonds
    };

    // Ring strain energies (kJ/mol)
    this.ringStrain = {
      3: 115,  // cyclopropane
      4: 110,  // cyclobutane
      5: 26,   // cyclopentane
      6: 0,    // cyclohexane (reference)
      7: 26,   // cycloheptane
    };

    // Steric hindrance parameters
    this.stericParameters = {
      'H': 0,
      'F': 15,
      'OH': 25,
      'CH3': 40,
      'Cl': 50,
      'Br': 70,
      'I': 90,
      'tBu': 120,
    };
  }

  /**
   * Calculate structural strain energy for a molecule
   */
  calculateStrainEnergy(atoms, bonds, geometry = null) {
    let strainEnergy = 0;

    // Ring strain
    const rings = this.detectRings(atoms, bonds);
    for (const ring of rings) {
      const ringSize = ring.length;
      strainEnergy += this.ringStrain[ringSize] || 0;
    }

    // Steric strain
    strainEnergy += this.calculateStericStrain(atoms, geometry);

    // Torsional strain (simplified)
    strainEnergy += this.calculateTorsionalStrain(bonds, atoms);

    return strainEnergy;
  }

  /**
   * Detect rings in molecular graph
   */
  detectRings(atoms, bonds) {
    const rings = [];
    const visited = new Set();
    const adjList = this.buildAdjacencyList(atoms, bonds);

    for (const atom of atoms) {
      if (!visited.has(atom.id)) {
        const ring = this.findRing(atom.id, adjList, visited);
        if (ring && ring.length >= 3) {
          rings.push(ring);
        }
      }
    }

    return rings;
  }

  /**
   * Build adjacency list from bonds
   */
  buildAdjacencyList(atoms, bonds) {
    const adj = new Map();
    for (const atom of atoms) {
      adj.set(atom.id, []);
    }
    for (const bond of bonds) {
      const listA = adj.get(bond.a);
      const listB = adj.get(bond.b);
      if (listA) listA.push(bond.b);
      if (listB) listB.push(bond.a);
    }
    return adj;
  }

  /**
   * Find ring starting from atom (DFS)
   */
  findRing(startId, adjList, visited) {
    const stack = [{ id: startId, path: [startId] }];
    visited.add(startId);

    while (stack.length > 0) {
      const { id, path } = stack.pop();
      const neighbors = adjList.get(id) || [];

      for (const neighbor of neighbors) {
        if (neighbor === startId && path.length >= 3) {
          return path;
        }
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          stack.push({ id: neighbor, path: [...path, neighbor] });
        }
      }
    }

    return null;
  }

  /**
   * Calculate steric strain from bulky groups
   */
  calculateStericStrain(atoms, geometry = null) {
    let stericEnergy = 0;

    // Count bulky substituents on each atom
    for (const atom of atoms) {
      if (!atom || !atom.el) continue;
      const substituentSize = this.stericParameters[atom.el.sym] || 0;
      if (substituentSize > 50) { // Only count significantly bulky groups
        stericEnergy += substituentSize * 0.1; // Scale factor
      }
    }

    return stericEnergy;
  }

  /**
   * Calculate torsional strain (simplified)
   */
  calculateTorsionalStrain(bonds, atomsMap) {
    // Simplified: count eclipsed conformations
    let torsionalEnergy = 0;
    
    for (const bond of bonds) {
      if (bond.order === 1) { // Single bonds can rotate
        const atomA = atomsMap.get(bond.a);
        const atomB = atomsMap.get(bond.b);
        const aNeighbors = atomA?.bonds?.length || 0;
        const bNeighbors = atomB?.bonds?.length || 0;
        
        // More substituents = more torsional strain
        torsionalEnergy += (aNeighbors + bNeighbors) * 2;
      }
    }

    return torsionalEnergy;
  }

  /**
   * Get modified activation energy considering structural factors
   */
  getModifiedActivationEnergy(baseEa, atoms, bonds) {
    let modifiedEa = baseEa;

    // Apply BDE modifiers for weak bonds
    for (const bond of bonds) {
      if (this.isPeroxideBond(bond, atoms)) {
        modifiedEa *= this.bdeModifiers.peroxide;
      }
      if (this.isRadicalBond(bond, atoms)) {
        modifiedEa *= this.bdeModifiers.radical;
      }
    }

    // Apply ring strain
    const rings = this.detectRings(atoms, bonds);
    for (const ring of rings) {
      const strain = this.ringStrain[ring.length] || 0;
      modifiedEa -= strain * 0.5; // Strain lowers activation barrier
    }

    return Math.max(0, modifiedEa); // Ea can't be negative
  }

  isPeroxideBond(bond, atomsMap) {
    const atomA = atomsMap.get(bond.a);
    const atomB = atomsMap.get(bond.b);
    if (!atomA || !atomB) return false;
    return atomA.el.sym === 'O' && atomB.el.sym === 'O';
  }

  isRadicalBond(bond, atomsMap) {
    // Simplified radical detection
    const atomA = atomsMap.get(bond.a);
    if (!atomA) return false;
    return atomA.el.sym === 'C' && bond.order === 1 && 
           (atomA.bonds?.length || 0) < 4;
  }
}

// ============================================================================
// Module 4: Quantum Mechanics / Electronic Structure Extensibility Hook
// ============================================================================

export class QMInterface {
  constructor() {
    // Abstract base for quantum mechanical calculations
    // Currently uses empirical approximations, structured for future QM integration
    
    // Basis set stubs (for future expansion)
    this.basisSets = {
      'STO-3G': { type: 'minimal', functions: 1 },
      '6-31G': { type: 'split-valence', functions: 2 },
      '6-311G': { type: 'triple-zeta', functions: 3 },
    };

    // Property lookup tables
    this.propertyTables = {
      electronegativity: new Map([
        ['H', 2.20], ['C', 2.55], ['N', 3.04], ['O', 3.44], ['F', 3.98],
        ['Cl', 3.16], ['Br', 2.96], ['I', 2.66], ['S', 2.58], ['P', 2.19],
      ]),
      atomicRadius: new Map([
        ['H', 53], ['C', 77], ['N', 75], ['O', 73], ['F', 71],
        ['Cl', 99], ['Br', 114], ['I', 133], ['S', 102], ['P', 106],
      ]),
      ionizationEnergy: new Map([
        ['H', 1312], ['C', 1086], ['N', 1402], ['O', 1314], ['F', 1681],
        ['Cl', 1251], ['Br', 1140], ['I', 1008], ['S', 1000], ['P', 1012],
      ]),
    };

    // Cache for QM calculations
    this.qmCache = new Map();
  }

  /**
   * Calculate molecular orbital properties (stub for future QM integration)
   * Currently returns empirical approximations
   */
  calculateMolecularOrbitals(atoms, bonds, basisSet = 'STO-3G') {
    const cacheKey = `mo_${this.getCacheKey(atoms, bonds)}_${basisSet}`;
    if (this.qmCache.has(cacheKey)) {
      return this.qmCache.get(cacheKey);
    }

    // Empirical approximation of HOMO-LUMO gap
    const homoLumoGap = this.estimateHomoLumoGap(atoms, bonds);
    
    // Empirical approximation of dipole moment
    const dipoleMoment = this.estimateDipoleMoment(atoms, bonds);

    const result = {
      basisSet,
      homoLumoGap, // eV
      dipoleMoment, // Debye
      numOrbitals: atoms.length * this.basisSets[basisSet].functions,
      // Future: MO coefficients, overlap integrals, electron densities
    };

    this.qmCache.set(cacheKey, result);
    return result;
  }

  /**
   * Estimate HOMO-LUMO gap from electronegativity differences
   */
  estimateHomoLumoGap(atoms, bonds) {
    const atomList = atoms instanceof Map ? Array.from(atoms.values()) : atoms;
    if (atomList.length === 0) return 0;

    let maxEN = 0;
    let minEN = 999;

    for (const atom of atomList) {
      if (!atom || !atom.el) continue;
      const en = this.propertyTables.electronegativity.get(atom.el.sym) || 2.5;
      maxEN = Math.max(maxEN, en);
      minEN = Math.min(minEN, en);
    }

    // Empirical relationship: larger EN difference → larger gap
    const enDiff = maxEN - minEN;
    return 5 + enDiff * 2; // Base gap + EN contribution (eV)
  }

  /**
   * Estimate dipole moment from bond polarities
   */
  estimateDipoleMoment(atoms, bonds) {
    let dipole = 0;

    for (const bond of bonds) {
      const atomA = atoms.get(bond.a);
      const atomB = atoms.get(bond.b);
      if (!atomA || !atomB) continue;
      
      const enA = this.propertyTables.electronegativity.get(atomA.el.sym) || 2.5;
      const enB = this.propertyTables.electronegativity.get(atomB.el.sym) || 2.5;
      const enDiff = Math.abs(enA - enB);
      
      // Dipole contribution from bond polarity
      dipole += enDiff * bond.order * 0.5;
    }

    return dipole; // Debye (approximate)
  }

  /**
   * Calculate electron density at a point (stub for future QM)
   */
  calculateElectronDensity(atoms, point) {
    // Simplified: sum of atomic contributions
    let density = 0;
    
    for (const atom of atoms) {
      const radius = this.propertyTables.atomicRadius.get(atom.el.sym) || 100;
      const dist = Math.sqrt(
        Math.pow(point.x - atom.pos.x, 2) +
        Math.pow(point.y - atom.pos.y, 2) +
        Math.pow(point.z - atom.pos.z, 2)
      );
      
      // Gaussian approximation of electron density
      density += Math.exp(-Math.pow(dist / radius, 2));
    }

    return density;
  }

  /**
   * Get atomic properties from lookup tables
   */
  getAtomicProperty(sym, property) {
    return this.propertyTables[property]?.get(sym) || null;
  }

  /**
   * Stub for future Hartree-Fock/DFT integration
   */
  async runHartreeFock(atoms, bonds, basisSet = '6-31G') {
    // Future implementation would call external QM software
    // or WebAssembly-compiled quantum chemistry libraries
    throw new Error('Hartree-Fock calculation not yet implemented. Use empirical methods.');
  }

  /**
   * Stub for future DFT integration
   */
  async runDFT(atoms, bonds, functional = 'B3LYP', basisSet = '6-31G') {
    // Future implementation
    throw new Error('DFT calculation not yet implemented. Use empirical methods.');
  }

  getCacheKey(atoms, bonds) {
    // Handle both Map and array
    const atomList = atoms instanceof Map ? Array.from(atoms.values()) : atoms;
    const atomKeys = atomList.map(a => a.id).sort().join(',');
    const bondKeys = bonds.map(b => `${b.a}-${b.b}`).sort().join(',');
    return `${atomKeys}|${bondKeys}`;
  }

  clearCache() {
    this.qmCache.clear();
  }
}

// ============================================================================
// Integrated Simulation Engine
// ============================================================================

export class SimulationEngine {
  constructor() {
    this.thermo = new ThermodynamicSystem();
    this.kinetics = new KineticsEngine();
    this.strain = new StructuralStrain();
    this.qm = new QMInterface();

    // Simulation state
    this.isRunning = false;
    this.simulationTime = 0;
    this.timeStep = 0.001; // seconds

    // Event listeners for simulation updates
    this.listeners = new Map();
  }

  /**
   * Run one simulation step
   */
  step(atoms, bonds, molecules = []) {
    if (!this.isRunning) return;

    this.simulationTime += this.timeStep;

    // Update each molecule
    for (const mol of molecules) {
      this.updateMolecule(mol, atoms, bonds);
    }

    // Emit simulation tick event
    this.emit('tick', { time: this.simulationTime });
  }

  /**
   * Update a single molecule's state
   */
  updateMolecule(molecule, atoms, bonds) {
    // Calculate thermodynamic stability
    const { dG } = this.thermo.calculateFreeEnergy(atoms, bonds);
    
    // Calculate structural strain
    const strainEnergy = this.strain.calculateStrainEnergy(atoms, bonds);
    
    // Get effective activation energy
    const baseEa = 200; // kJ/mol (default decomposition barrier)
    const effectiveEa = this.strain.getModifiedActivationEnergy(baseEa, atoms, bonds);
    
    // Calculate decomposition probability
    const temp = this.kinetics.getTemperature(molecule.id);
    const decompProb = this.kinetics.calculateDecompositionProbability(effectiveEa, temp, this.timeStep);

    // Update molecule state
    molecule.energy = {
      potential: this.thermo.calculatePotentialEnergy(atoms, bonds),
      strain: strainEnergy,
      freeEnergy: dG,
    };

    molecule.stability = {
      thermodynamicallyUnstable: dG > 50,
      kineticallyUnstable: decompProb > 0.1,
      decompositionProbability: decompProb,
    };

    // Check for decomposition
    if (Math.random() < decompProb) {
      this.emit('decompose', { molecule, probability: decompProb });
    }
  }

  /**
   * Start simulation
   */
  start() {
    this.isRunning = true;
    this.emit('start', { time: this.simulationTime });
  }

  /**
   * Stop simulation
   */
  stop() {
    this.isRunning = false;
    this.emit('stop', { time: this.simulationTime });
  }

  /**
   * Reset simulation
   */
  reset() {
    this.simulationTime = 0;
    this.thermo.clearCache();
    this.qm.clearCache();
    this.emit('reset');
  }

  /**
   * Set simulation temperature
   */
  setTemperature(tempK, moleculeId = null) {
    if (moleculeId) {
      this.kinetics.setLocalTemperature(moleculeId, tempK);
    } else {
      this.kinetics.setGlobalTemperature(tempK);
    }
  }

  /**
   * Register event listener
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  /**
   * Emit event
   */
  emit(event, data) {
    const callbacks = this.listeners.get(event) || [];
    for (const cb of callbacks) {
      try {
        cb(data);
      } catch (e) {
        console.error(`Simulation event handler error: ${e}`);
      }
    }
  }

  /**
   * Get comprehensive molecule analysis
   */
  analyzeMolecule(atoms, bonds, moleculeId = null) {
    // Convert atoms array to Map for lookup
    const atomsMap = new Map();
    for (const atom of atoms) {
      atomsMap.set(atom.id, atom);
    }
    
    const thermo = this.thermo.calculateFreeEnergy(atomsMap, bonds);
    const strainEnergy = this.strain.calculateStrainEnergy(atomsMap, bonds);
    const baseEa = 200;
    const effectiveEa = this.strain.getModifiedActivationEnergy(baseEa, atomsMap, bonds);
    const temp = this.kinetics.getTemperature(moleculeId);
    const decompProb = this.kinetics.calculateDecompositionProbability(effectiveEa, temp);
    const halfLife = this.kinetics.calculateHalfLife(effectiveEa, temp);
    const mo = this.qm.calculateMolecularOrbitals(atomsMap, bonds);

    return {
      thermodynamics: thermo,
      strain: {
        energy: strainEnergy,
        rings: this.strain.detectRings(atomsMap, bonds),
      },
      kinetics: {
        activationEnergy: effectiveEa,
        rateConstant: this.kinetics.calculateRateConstant(effectiveEa, temp),
        halfLife,
        decompositionProbability: decompProb,
        temperature: temp,
      },
      quantum: mo,
      stability: {
        thermodynamicallyUnstable: thermo.dG > 50,
        kineticallyUnstable: decompProb > 0.1,
      },
    };
  }
}

// Export singleton instance
export const simulation = new SimulationEngine();
