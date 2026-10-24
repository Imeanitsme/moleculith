// Molecule Builder BluePrint: 2D blueprint-style visualization with Bohr electron shells
// Grid-aligned rendering with explicit electron pair visualization

export const BLUEPRINT_MODES = {
  STRUCTURAL: 'structural',    // Standard 2D structural formula
  BOHR: 'bohr',                // Bohr model with electron shells
  COORDINATION: 'coordination', // Coordination complex with brackets
};

// Grid configuration for blueprint rendering
export const BLUEPRINT_GRID = {
  cellSize: 40,          // pixels per grid cell
  atomRadius: 15,        // atom circle radius
  bondWidth: 2,          // bond line width
  electronRadius: 3,     // electron dot radius
  shellSpacing: 12,      // spacing between electron shells
};

// Electron configuration data for Bohr model
export const ELECTRON_CONFIGS = {
  'H':  [1],
  'He': [2],
  'Li': [2, 1],
  'Be': [2, 2],
  'B':  [2, 3],
  'C':  [2, 4],
  'N':  [2, 5],
  'O':  [2, 6],
  'F':  [2, 7],
  'Ne': [2, 8],
  'Na': [2, 8, 1],
  'Mg': [2, 8, 2],
  'Al': [2, 8, 3],
  'Si': [2, 8, 4],
  'P':  [2, 8, 5],
  'S':  [2, 8, 6],
  'Cl': [2, 8, 7],
  'Ar': [2, 8, 8],
  'K':  [2, 8, 8, 1],
  'Ca': [2, 8, 8, 2],
  'Fe': [2, 8, 14, 2],
  'Cu': [2, 8, 18, 1],
  'Zn': [2, 8, 18, 2],
  'Ag': [2, 8, 18, 1],
};

// Render a molecule in blueprint style
export function renderBlueprint(molecule, mode = BLUEPRINT_MODES.STRUCTURAL) {
  const { atoms, bonds } = molecule;
  if (!atoms || atoms.length === 0) return '';

  switch (mode) {
    case BLUEPRINT_MODES.BOHR:
      return renderBohrBlueprint(atoms, bonds);
    case BLUEPRINT_MODES.COORDINATION:
      return renderCoordinationBlueprint(atoms, bonds);
    default:
      return renderStructuralBlueprint(atoms, bonds);
  }
}

// Structural blueprint: grid-aligned 2D layout
function renderStructuralBlueprint(atoms, bonds) {
  const lines = [];
  lines.push('╔══════════════════════════════════════╗');
  lines.push('║   MOLECULE BUILDER BLUEPRINT         ║');
  lines.push('╚══════════════════════════════════════╝');
  lines.push('');
  lines.push('STRUCTURAL FORMULA:');
  lines.push('┌' + '─'.repeat(40) + '┐');

  // Calculate layout positions
  const layout = calculateGridLayout(atoms, bonds);

  // Render atoms and bonds
  for (const row of layout.rows) {
    let line = '│ ';
    for (const cell of row) {
      if (cell.atom) {
        line += cell.atom.sym.padEnd(3);
      } else if (cell.bond) {
        line += cell.bond.padEnd(3);
      } else {
        line += '   ';
      }
    }
    line += '│';
    lines.push(line);
  }

  lines.push('└' + '─'.repeat(40) + '┘');
  lines.push('');

  // Add bond information
  lines.push('BOND ANALYSIS:');
  for (const bond of bonds) {
    const atom1 = atoms[bond.i];
    const atom2 = atoms[bond.j];
    const bondType = bond.order === 1 ? '─' : bond.order === 2 ? '═' : '≡';
    lines.push(`  ${atom1.sym} ${bondType} ${atom2.sym}  (order: ${bond.order}${bond.ionic ? ', ionic' : ''})`);
  }

  return lines.join('\n');
}

// Bohr model blueprint with electron shells
function renderBohrBlueprint(atoms, bonds) {
  const lines = [];
  lines.push('╔══════════════════════════════════════╗');
  lines.push('║   BOHR ELECTRON SHELL MODEL          ║');
  lines.push('╚══════════════════════════════════════╝');
  lines.push('');

  for (let i = 0; i < atoms.length; i++) {
    const atom = atoms[i];
    const config = ELECTRON_CONFIGS[atom.sym] || [0];

    lines.push(`ATOM ${i}: ${atom.sym}`);
    lines.push('  Electron Configuration:');

    // Render electron shells
    for (let shell = 0; shell < config.length; shell++) {
      const electrons = config[shell];
      const shellLabel = `n=${shell + 1}`;
      const electronDots = '•'.repeat(electrons);
      lines.push(`  ${shellLabel}: [${electronDots.padEnd(8)}] = ${electrons} e⁻`);
    }

    // Show bonding electrons
    const bondingBonds = bonds.filter(b => b.i === i || b.j === i);
    if (bondingBonds.length > 0) {
      lines.push('  Bonding Electrons:');
      for (const bond of bondingBonds) {
        const otherIdx = bond.i === i ? bond.j : bond.i;
        const otherAtom = atoms[otherIdx];
        const sharedPairs = bond.order;
        lines.push(`    ${atom.sym} ↔ ${otherAtom.sym}: ${sharedPairs} shared pair${sharedPairs > 1 ? 's' : ''} (${sharedPairs * 2} e⁻)`);
      }
    }

    // Lone pairs
    const totalValence = config[config.length - 1];
    const bondingElectrons = bondingBonds.reduce((sum, b) => sum + b.order, 0);
    const lonePairs = (totalValence - bondingElectrons) / 2;
    if (lonePairs > 0) {
      lines.push(`  Lone Pairs: ${lonePairs} (${lonePairs * 2} e⁻)`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

// Coordination complex blueprint with brackets
function renderCoordinationBlueprint(atoms, bonds) {
  const lines = [];
  lines.push('╔══════════════════════════════════════╗');
  lines.push('║   COORDINATION COMPLEX ANALYSIS      ║');
  lines.push('╚══════════════════════════════════════╝');
  lines.push('');

  // Identify central metal and ligands
  const metals = atoms.filter(a => isTransitionMetal(a.sym));
  const ligands = atoms.filter(a => !isTransitionMetal(a.sym));

  if (metals.length === 0) {
    lines.push('No coordination complex detected.');
    lines.push('Rendering as standard structural formula...');
    lines.push('');
    return lines.join('\n') + renderStructuralBlueprint(atoms, bonds);
  }

  const centralMetal = metals[0];
  lines.push(`CENTRAL METAL: ${centralMetal.sym}`);
  lines.push('');

  // Identify coordination sphere
  const innerSphere = [];
  const outerSphere = [];

  for (const bond of bonds) {
    if (bond.i === atoms.indexOf(centralMetal) || bond.j === atoms.indexOf(centralMetal)) {
      const ligandIdx = bond.i === atoms.indexOf(centralMetal) ? bond.j : bond.i;
      const ligand = atoms[ligandIdx];
      innerSphere.push({
        atom: ligand,
        bondOrder: bond.order,
        coordinate: bond.ionic || bond.order === 0,
      });
    }
  }

  // Render coordination complex
  lines.push('COORDINATION SPHERE:');
  lines.push('┌' + '─'.repeat(40) + '┐');

  let complexFormula = `[${centralMetal.sym}`;
  for (const lig of innerSphere) {
    const bondSymbol = lig.coordinate ? '←' : '─';
    complexFormula += `(${lig.atom.sym}${bondSymbol})`;
  }
  complexFormula += ']';

  lines.push(`│  ${complexFormula.padEnd(38)}│`);
  lines.push('└' + '─'.repeat(40) + '┘');
  lines.push('');

  // Ligand analysis
  lines.push('LIGAND ANALYSIS:');
  for (const lig of innerSphere) {
    const type = lig.coordinate ? 'coordinate bond' : lig.bondOrder > 1 ? 'multiple bond' : 'single bond';
    lines.push(`  ${lig.atom.sym}: ${type} (order: ${lig.bondOrder})`);
  }

  lines.push('');
  lines.push(`Coordination Number: ${innerSphere.length}`);

  return lines.join('\n');
}

// Calculate grid layout for structural formula
function calculateGridLayout(atoms, bonds) {
  const rows = [];
  const visited = new Set();

  // Simple linear layout for now
  for (let i = 0; i < atoms.length; i++) {
    const row = [];
    row.push({ atom: atoms[i] });

    // Check for bonds to next atom
    const bond = bonds.find(b =>
      (b.i === i && b.j === i + 1) || (b.j === i && b.i === i + 1)
    );

    if (bond) {
      const bondSymbol = bond.order === 1 ? '─' : bond.order === 2 ? '═' : '≡';
      row.push({ bond: bondSymbol });
    }

    rows.push(row);
  }

  return { rows };
}

// Check if element is a transition metal
function isTransitionMetal(sym) {
  const transitionMetals = new Set([
    'Fe', 'Cu', 'Zn', 'Ag', 'Au', 'Pt', 'Pd', 'Ni', 'Co', 'Cr', 'Mn', 'V', 'Ti', 'Mo', 'W'
  ]);
  return transitionMetals.has(sym);
}

// Generate blueprint for a reaction
export function renderReactionBlueprint(reactants, products, condition) {
  const lines = [];
  lines.push('╔══════════════════════════════════════╗');
  lines.push('║   REACTION BLUEPRINT                 ║');
  lines.push('╚══════════════════════════════════════╝');
  lines.push('');
  lines.push(`Condition: ${condition}`);
  lines.push('');

  lines.push('REACTANTS:');
  for (const r of reactants) {
    lines.push(`  ${r.formula}`);
  }

  lines.push('');
  lines.push('  ↓');
  lines.push('');

  lines.push('PRODUCTS:');
  for (const p of products) {
    lines.push(`  ${p.formula}`);
  }

  lines.push('');
  lines.push('ELECTRON TRANSFER ANALYSIS:');
  lines.push('  [Detailed electron flow would be shown here]');

  return lines.join('\n');
}

// Export for integration with main app
export default {
  renderBlueprint,
  renderReactionBlueprint,
  BLUEPRINT_MODES,
  BLUEPRINT_GRID,
  ELECTRON_CONFIGS,
};
