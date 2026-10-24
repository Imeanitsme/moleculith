// Test suite for chemistry engine data modules
// Run with: node --experimental-vm-modules src/data/__tests__/index.test.js

import { strict as assert } from 'assert';
import {
  OXIDATION_STATES,
  inferOxidationState,
  detectRedoxChanges,
  isMetal,
} from '../oxidation-states.js';
import {
  GROUP_TYPES,
  tagFunctionalGroups,
  hasFunctionalGroup,
  alcoholClass,
  haloalkaneClass,
} from '../functional-groups.js';
import { DECOMPOSITION_RULES } from '../decomposition-rules.js';
import {
  KNOWN_HYDRATES,
  predictHydrateWater,
  formsHydrate,
  hydrateFormula,
} from '../hydrate-rules.js';
import { COMMON_CATIONS, COMMON_ANIONS, isSoluble } from '../solubility-rules.js';

console.log('Running chemistry engine tests...\n');

// ── Oxidation States ─────────────────────────────────────────────────────

console.log('Testing oxidation state inference...');

assert.equal(inferOxidationState('Na', 'NaCl'), 1, 'Na in NaCl should be +1');
assert.equal(inferOxidationState('Cl', 'NaCl'), -1, 'Cl in NaCl should be -1');
assert.equal(inferOxidationState('O', 'H2O'), -2, 'O in H2O should be -2');
assert.equal(inferOxidationState('H', 'H2O'), 1, 'H in H2O should be +1');
assert.equal(inferOxidationState('O', 'H2O2'), -1, 'O in H2O2 (peroxide) should be -1');
assert.equal(inferOxidationState('O', 'Na2O2'), -1, 'O in Na2O2 (peroxide) should be -1');
assert.equal(inferOxidationState('O', 'KO2'), -0.5, 'O in KO2 (superoxide) should be -0.5');
assert.equal(inferOxidationState('Fe', 'Fe2O3'), 3, 'Fe in Fe2O3 should be +3');
assert.equal(inferOxidationState('S', 'H2SO4'), 6, 'S in H2SO4 should be +6');
assert.equal(inferOxidationState('N', 'HNO3'), 5, 'N in HNO3 should be +5');
assert.equal(inferOxidationState('Mn', 'KMnO4'), 7, 'Mn in KMnO4 should be +7');

console.log('✓ Oxidation state inference\n');

// ── Metal Detection ──────────────────────────────────────────────────────

console.log('Testing metal detection...');

assert.equal(isMetal('Na'), true, 'Na should be a metal');
assert.equal(isMetal('Fe'), true, 'Fe should be a metal');
assert.equal(isMetal('Cl'), false, 'Cl should not be a metal');
assert.equal(isMetal('O'), false, 'O should not be a metal');

console.log('✓ Metal detection\n');

// ── Redox Detection ──────────────────────────────────────────────────────

console.log('Testing redox change detection...');

const redox1 = detectRedoxChanges([
  { formulas: ['Zn', 'CuSO4'], role: 'reactant' },
  { formulas: ['ZnSO4', 'Cu'], role: 'product' },
]);
assert.ok(redox1, 'Should detect redox in Zn + CuSO4 -> ZnSO4 + Cu');
assert.ok(redox1.all && redox1.all.length > 0, 'Should have redox changes');

console.log('✓ Redox change detection\n');

// ── Functional Group Tagging ─────────────────────────────────────────────

console.log('Testing functional group tagging...');

const ethanol = {
  atoms: ['C', 'C', 'O', 'H', 'H', 'H', 'H', 'H', 'H'],
  bonds: [[0,1,1],[1,2,1],[0,3,1],[0,4,1],[0,5,1],[1,6,1],[1,7,1],[2,8,1]],
};
const tags = tagFunctionalGroups(ethanol);
assert.ok(tags.length > 0, 'Ethanol should have functional groups');
assert.ok(hasFunctionalGroup(ethanol, GROUP_TYPES.ALCOHOL), 'Ethanol should have alcohol group');

const acetone = {
  atoms: ['C', 'C', 'C', 'O', 'H', 'H', 'H', 'H', 'H', 'H'],
  bonds: [[0,1,1],[1,2,1],[1,3,2],[0,4,1],[0,5,1],[0,6,1],[2,7,1],[2,8,1],[2,9,1]],
};
assert.ok(hasFunctionalGroup(acetone, GROUP_TYPES.KETONE), 'Acetone should have ketone group');

console.log('✓ Functional group tagging\n');

// ── Alcohol Classification ───────────────────────────────────────────────

console.log('Testing alcohol classification...');

const primaryAlcohol = {
  atoms: ['C', 'C', 'O', 'H', 'H', 'H', 'H', 'H'],
  bonds: [[0,1,1],[1,2,1],[0,3,1],[0,4,1],[0,5,1],[1,6,1],[2,7,1]],
};
const alcoholTag = tagFunctionalGroups(primaryAlcohol).find(t => t.group === GROUP_TYPES.ALCOHOL);
assert.equal(alcoholClass(primaryAlcohol, alcoholTag), 'primary', 'Should classify as primary alcohol');

console.log('✓ Alcohol classification\n');

// ── Decomposition Rules ──────────────────────────────────────────────────

console.log('Testing decomposition rules...');

assert.ok(DECOMPOSITION_RULES.length > 0, 'Should have decomposition rules');
const carbonateRule = DECOMPOSITION_RULES.find(r => r.id === 'carbonate');
assert.ok(carbonateRule, 'Should have carbonate decomposition rule');

const caCO3 = new Map([['Ca', 1], ['C', 1], ['O', 3]]);
assert.ok(carbonateRule.match(caCO3, caCO3), 'CaCO3 should match carbonate rule');
const products = carbonateRule.products(caCO3, caCO3);
assert.ok(products.includes('CaO'), 'CaCO3 decomposition should produce CaO');
assert.ok(products.includes('CO2'), 'CaCO3 decomposition should produce CO2');

console.log('✓ Decomposition rules\n');

// ── Hydrate Formation ────────────────────────────────────────────────────

console.log('Testing hydrate formation...');

assert.ok(Object.keys(KNOWN_HYDRATES).length > 0, 'Should have known hydrates');
assert.ok(formsHydrate('CuSO4'), 'CuSO4 should form hydrate');
assert.equal(predictHydrateWater('CuSO4', new Map([['Cu', 1], ['S', 1], ['O', 4]])), 5, 'CuSO4 should form pentahydrate');
assert.equal(hydrateFormula('CuSO4', 5), 'CuSO4.5H2O', 'Hydrate formula should be CuSO4.5H2O');

console.log('✓ Hydrate formation\n');

// ── Solubility Rules ─────────────────────────────────────────────────────

console.log('Testing solubility rules...');

assert.ok(Object.keys(COMMON_CATIONS).length > 0, 'Should have common cations');
assert.ok(Object.keys(COMMON_ANIONS).length > 0, 'Should have common anions');

const na = COMMON_CATIONS['Na'];
const cl = COMMON_ANIONS['Cl'];
assert.ok(isSoluble(na, cl), 'NaCl should be soluble');

const ag = COMMON_CATIONS['Ag'];
assert.ok(!isSoluble(ag, cl), 'AgCl should be insoluble');

const ba = COMMON_CATIONS['Ba'];
const so4 = COMMON_ANIONS['SO4'];
assert.ok(!isSoluble(ba, so4), 'BaSO4 should be insoluble');

const no3 = COMMON_ANIONS['NO3'];
assert.ok(isSoluble(ag, no3), 'AgNO3 should be soluble');

console.log('✓ Solubility rules\n');

console.log('All tests passed! ✓');
