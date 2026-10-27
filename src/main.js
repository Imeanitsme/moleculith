import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ELEMENTS, CAT_COLOR, isMetalCat, gridPos, elementBySym as elementBySymBase } from './elements.js';

function elementBySym(sym) {
  return elementBySymBase(sym) || getMayhemElement(sym) || customElements.find(e => e.sym === sym);
}
import {
  bondsOf, partnerId, bondCheck, upgradeCheck, componentsOf, componentOf,
  analyzeComponent, formulaWithCharge, prettyFormula, displayRadius, bondLength,
  structuralFingerprint,
} from './chemistry.js';
import { solveAll } from './vsepr.js';
import { nameMolecule, classifyMolecule } from './names.js';
import { CHALLENGES } from './challenges.js';
import { MAYHEM_ELEMENTS, MAYHEM_REACTIONS, isMayhemElement, getMayhemElement } from './mayhem.js';
import { TIERS, TIER_ORDER, AutoThrottle, FpsSampler } from './quality.js';
import { createMovement } from './movement.js';
import {
  CONDITIONS, findReaction, conditionsFor, missingFor, productTemplate, isomerTemplates,
} from './reactions.js';
import { initLang, applyStatic, t, trReason, elName, catLabel, isVi, otherLang, setLang, getLang } from './i18n.js';
import { initTutorial, showTutorial } from './tutorial.js';
import { AVOGADRO, setElementLookup, molarMass, compositionOf, limitingAnalysis, fmtAmount } from './stoich.js';
import { createSimulation, compileNetwork, parseRateExpr, rk4Step } from './kinetics.js';
import { SimulationEngine, simulation } from './simulation.js';

// Log simulation events to console
simulation.on('decompose', ({ molecule, probability }) => {
  addConsoleEntry('warn', [`⚠ Molecule decomposed (prob: ${(probability * 100).toFixed(1)}%)`]);
});
simulation.on('start', ({ time }) => {
  addConsoleEntry('info', [`▶ Simulation started at t=${time.toFixed(1)}s`]);
});
simulation.on('stop', ({ time }) => {
  addConsoleEntry('info', [`⏸ Simulation stopped at t=${time.toFixed(1)}s`]);
});
simulation.on('reset', () => {
  addConsoleEntry('info', ['↺ Simulation reset']);
});

setElementLookup(elementBySym);

// Tolerate hand-edited challenge entries: skip malformed ones with a warning
// instead of breaking the Dex.
const CHALLENGE_LIST = CHALLENGES.filter(c => {
  if (c && typeof c.formula === 'string' && c.formula.trim()) return true;
  console.warn('challenges.js: skipping malformed entry', c);
  return false;
});

initLang();

// Initialize Lucide icons
if (typeof lucide !== 'undefined') {
  lucide.createIcons();
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const atoms = new Map();      // id -> {id, el, pos:{x,y,z}}
const bonds = new Map();      // id -> {id, a, b, order, ionic}
const overrides = new Map();  // componentKey -> charge (user-set ion charge)
const isoSel = new Map();     // componentKey -> display formula of the chosen isomer arrangement
let nextId = 1;
let selectedId = null;
let hoverId = null;
let fcVisible = true;
let mayhemMode = false;
const customElements = [];
const completed = new Set();  // challenge keys
const undoStack = [];

let targetPos = new Map();    // id -> VSEPR target position
const atomFC = new Map();     // id -> formal charge
let analyses = [];            // parallel to lastComps
let lastComps = [];
const spawnAnim = new Map();  // id -> start time
const driftState = new Map(); // compKey -> {v, axis, rate}

let drag = null;
let snapTargetId = null;
let snapLegal = false;
let snapMsg = '';
let downInfo = null;
let lastPointerType = 'mouse';

const reactionSel = new Set();      // selected component keys for a reaction
const reactionSelIds = new Set();   // atom ids highlighted amber

const discoveries = [];             // {formula, charge, name, t, saved}
const seenDisc = new Set();
let discUnsaved = false;
const DISC_KEY = 'mol3d.discoveries.v1';

// ---------------------------------------------------------------------------
// Radioactive decay system
// ---------------------------------------------------------------------------
// Time Control System (Solar Scope inspired)
// ---------------------------------------------------------------------------
let simulationTime = 0; // Accumulated simulation time in seconds
let timeSpeed = 1; // Multiplier: 1 = real-time, 2 = 2x speed, etc.
let timeFrozen = false; // When true, simulation time stops
let lastRealTime = performance.now();

function formatSimulationTime(seconds) {
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}

function updateTimeDisplay() {
  const display = document.getElementById('time-display');
  if (display) {
    display.textContent = timeFrozen ? 'FROZEN' : formatSimulationTime(simulationTime);
  }
  const label = document.getElementById('time-speed-label');
  if (label) {
    label.textContent = `${timeSpeed}×`;
  }
}

function toggleFreeze() {
  timeFrozen = !timeFrozen;
  const btn = document.getElementById('btn-time-freeze');
  if (btn) {
    btn.classList.toggle('frozen', timeFrozen);
    btn.textContent = timeFrozen ? '▶️' : '❄️';
  }
  if (!timeFrozen) {
    lastRealTime = performance.now();
  }
  updateTimeDisplay();
}

function cycleSpeed() {
  const speeds = [1, 2, 5, 10, 50, 100];
  const idx = speeds.indexOf(timeSpeed);
  timeSpeed = speeds[(idx + 1) % speeds.length];
  const btn = document.getElementById('btn-time-speed');
  if (btn) {
    btn.textContent = `${timeSpeed}×`;
    btn.classList.toggle('active', timeSpeed > 1);
  }
  const label = document.getElementById('time-speed-label');
  if (label) {
    label.textContent = `${timeSpeed}×`;
  }
  updateTimeDisplay();
}

function updateSimulationTime(now) {
  if (timeFrozen) return;
  const realDt = (now - lastRealTime) / 1000;
  lastRealTime = now;
  simulationTime += realDt * timeSpeed;
  updateTimeDisplay();
}

// ---------------------------------------------------------------------------
// Half-lives in seconds (real values). Elements z > 82 decay toward Lead (z=82).
const DECAY_HALF_LIFE = {
  83: 6.34e26,   // Bi-209: 2.01e19 years (effectively stable)
  84: 1.196e7,   // Po-210: 138.4 days
  85: 2.916e4,   // At-210: 8.1 hours
  86: 3.300e5,   // Rn-222: 3.82 days
  87: 1.320e3,   // Fr-223: 22 minutes
  88: 5.049e10,  // Ra-226: 1600 years
  89: 6.870e8,   // Ac-227: 21.77 years
  90: 4.434e17,  // Th-232: 1.405e10 years
  91: 1.034e9,   // Pa-231: 32,760 years
  92: 1.410e17,  // U-238: 4.468e9 years
  93: 6.764e13,  // Np-237: 2.144e6 years
  94: 2.550e15,  // Pu-244: 8.08e7 years
  95: 2.304e11,  // Am-243: 7,370 years
  96: 4.944e8,   // Cm-247: 1.56e7 years
  97: 4.320e6,   // Bk-247: 138 years
  98: 1.128e7,   // Cf-251: 898 years
  99: 4.080e5,   // Es-252: 472 days
  100: 3.240e4,  // Fm-257: 100.5 days
  101: 1.860e4,  // Md-258: 51.5 days
  102: 3.510e4,  // No-259: 9.75 hours
  103: 1.100e2,  // Lr-266: 11 hours
  104: 4.200e1,  // Rf-267: 42 seconds
  105: 1.000e1,  // Db-268: 10 seconds
  106: 2.400e0,  // Sg-269: 2.4 seconds
  107: 1.700e0,  // Bh-270: 1.7 seconds
  108: 1.600e0,  // Hs-269: 1.6 seconds
  109: 3.600e-1, // Mt-278: 0.36 seconds
  110: 1.100e-1, // Ds-281: 0.11 seconds
  111: 3.600e-2, // Rg-282: 0.036 seconds
  112: 2.900e-1, // Cn-285: 0.29 seconds
  113: 2.000e-2, // Nh-286: 0.02 seconds
  114: 2.600e0,  // Fl-289: 2.6 seconds
  115: 6.500e-2, // Mc-290: 0.065 seconds
  116: 6.000e-2, // Lv-293: 0.06 seconds
  117: 5.100e-2, // Ts-294: 0.051 seconds
  118: 7.000e-4, // Og-294: 0.7 milliseconds
};

// Decay mode: alpha (z-2) or beta (z+1). Simplified decay chains toward Pb.
function decayProduct(z) {
  if (z <= 82) return null; // Stable
  // Alpha decay for heavy elements (most common for z > 84)
  if (z >= 84) return z - 2;
  // Beta decay for Bi, At, Fr, Ac, Pa, Np, Am, Bk, Es, Md, No, Lr, and superheavy odd-z
  if ([83, 85, 87, 89, 91, 93, 95, 97, 99, 101, 103, 105, 107, 109, 111, 113, 115, 117].includes(z)) {
    return z + 1;
  }
  // Alpha for even-z actinides and superheavy
  return z - 2;
}

// Track radioactive atoms: id -> {spawnTime, halfLife}
const decayTrack = new Map();

function isRadioactive(el) {
  return el.z > 82;
}

function updateRadioactiveDecay(now) {
  if (decayTrack.size === 0) return;
  if (timeFrozen) return; // No decay when time is frozen
  const toDecay = [];
  for (const [id, info] of decayTrack) {
    const atom = atoms.get(id);
    if (!atom) { decayTrack.delete(id); continue; }
    const elapsed = simulationTime - info.spawnSimTime; // simulation seconds
    const halfLife = info.halfLife;
    // Probability of decay: 1 - 2^(-t/t_half)
    const decayProb = 1 - Math.pow(2, -elapsed / halfLife);
    if (Math.random() < decayProb) {
      toDecay.push({ id, atom });
    }
  }
  for (const { id, atom } of toDecay) {
    const oldEl = atom.el;
    const newZ = decayProduct(oldEl.z);
    if (newZ === null) { decayTrack.delete(id); continue; }
    const newEl = ELEMENTS.find(e => e.z === newZ);
    if (!newEl) { decayTrack.delete(id); continue; }
    // Transform atom
    atom.el = newEl;
    decayTrack.delete(id);
    // If new element is still radioactive, re-track
    if (isRadioactive(newEl)) {
      const hl = DECAY_HALF_LIFE[newEl.z] || 1;
      decayTrack.set(id, { spawnSimTime: simulationTime, halfLife: hl });
    }
    spawnAnim.set(id, now);
    // Update label sprite with new element symbol
    const label = labelSprites.get(id);
    if (label) {
      label.material.map = labelTex(newEl.sym);
      label.material.needsUpdate = true;
      const r = displayRadius(newEl);
      const s = 0.42 + r * 0.55;
      label.scale.set(s, s, 1);
    }
    status(`☢ ${oldEl.name} decayed to ${newEl.name}`, 'warn');
  }
  if (toDecay.length > 0) {
    reanalyze();
    invalidate();
  }
}

function trackRadioactiveAtom(id, atom, now) {
  if (isRadioactive(atom.el)) {
    const hl = DECAY_HALF_LIFE[atom.el.z] || 1;
    decayTrack.set(id, { spawnSimTime: simulationTime, halfLife: hl });
  }
}

// ---------------------------------------------------------------------------
// Three.js scene
// ---------------------------------------------------------------------------
const sceneWrap = document.getElementById('scene-wrap');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
renderer.setSize(sceneWrap.clientWidth, sceneWrap.clientHeight);
sceneWrap.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d1117);
scene.fog = new THREE.Fog(0x0d1117, 34, 80);

const camera = new THREE.PerspectiveCamera(50, sceneWrap.clientWidth / sceneWrap.clientHeight, 0.1, 200);
camera.position.set(0, 4.2, 10.5);

scene.add(new THREE.HemisphereLight(0xffffff, 0x33404f, 1.05));
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(6, 10, 8);
scene.add(sun);
const fill = new THREE.DirectionalLight(0x88aaff, 0.4);
fill.position.set(-6, 4, -6);
scene.add(fill);

let grid = new THREE.GridHelper(60, 60, 0x30363d, 0x1d232a);
grid.position.y = -1.7;
scene.add(grid);

// Pointer handlers must be registered BEFORE OrbitControls so atom drags
// can stop the camera from orbiting.
renderer.domElement.addEventListener('pointerdown', onPointerDown);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 1.6, 0);
controls.minDistance = 2.5;
controls.maxDistance = 45;
controls.maxPolarAngle = Math.PI * 0.55;
controls.addEventListener('change', invalidate);
const movement = createMovement({ camera, controls });
window.addEventListener('pointermove', onPointerMove);
window.addEventListener('pointerup', onPointerUp);
window.addEventListener('pointercancel', onPointerUp);
window.addEventListener('pointerleave', onPointerUp);
window.addEventListener('resize', () => {
  camera.aspect = sceneWrap.clientWidth / sceneWrap.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(sceneWrap.clientWidth, sceneWrap.clientHeight);
  invalidate();
});

// ---------------------------------------------------------------------------
// Shared geometry / materials / instanced meshes
// ---------------------------------------------------------------------------
let sphereGeo = new THREE.SphereGeometry(1, 16, 12);
let cylGeo = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true);

const MAX_ATOMS = 320;
const MAX_CYLS = 1280;
const Q_ID = new THREE.Quaternion();
const C_WHITE = new THREE.Color(0xffffff);
const C_COV = new THREE.Color(0x9aa7b3);
const C_ION = new THREE.Color(0xf0b429);
const C_SEL = new THREE.Color(0x58a6ff);
const C_OK = new THREE.Color(0x3fb950);
const C_ERR = new THREE.Color(0xf85149);
const C_RXN = new THREE.Color(0xf0b429);
const OFF1 = [0], OFF2 = [-0.12, 0.12], OFF3 = [-0.18, 0, 0.18], OFF4 = [-0.22, -0.07, 0.07, 0.22];

const atomMatM = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 70, specular: 0x555555 });
const atomMatN = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 20, specular: 0x181818 });
const bondMatC = new THREE.MeshLambertMaterial({ color: 0xffffff });
const bondMatI = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });

const atomMeshM = new THREE.InstancedMesh(sphereGeo, atomMatM, MAX_ATOMS);
const atomMeshN = new THREE.InstancedMesh(sphereGeo, atomMatN, MAX_ATOMS);
const bondMeshC = new THREE.InstancedMesh(cylGeo, bondMatC, MAX_CYLS);
const bondMeshI = new THREE.InstancedMesh(cylGeo, bondMatI, MAX_CYLS);
for (const m of [atomMeshM, atomMeshN, bondMeshC, bondMeshI]) {
  m.frustumCulled = false;
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(m);
}
const atomIdM = [], atomIdN = [], bondIdC = [], bondIdI = [];
atomMeshM.userData.ids = atomIdM;
atomMeshN.userData.ids = atomIdN;
bondMeshC.userData.ids = bondIdC;
bondMeshI.userData.ids = bondIdI;

const labelSprites = new Map(); // id -> Sprite
const badgeSprites = new Map(); // id -> Sprite

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _pa = new THREE.Vector3();
const _pb = new THREE.Vector3();
const _s = new THREE.Vector3();
const _d = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _ref = new THREE.Vector3();
const _perp = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _col = new THREE.Color();

const ghostMat = new THREE.MeshBasicMaterial({ color: 0x3fb950, transparent: true, opacity: 0.55 });
const ghost = new THREE.Mesh(cylGeo, ghostMat);
ghost.visible = false;
scene.add(ghost);

// ---------------------------------------------------------------------------
// Quality ("potato mode")
// ---------------------------------------------------------------------------
const QUALITY_MODES = ['auto', 'low', 'med', 'high'];
let qualityMode = 'auto';
let tierIndex = 1; // medium
const fpsSampler = new FpsSampler();
const throttle = new AutoThrottle();
let lastAuto = 0;
const fpsChip = document.getElementById('fps-chip');
const btnQuality = document.getElementById('btn-quality');

function tier() { return TIERS[TIER_ORDER[tierIndex]]; }

function applyTier(i) {
  tierIndex = i;
  const td = TIERS[TIER_ORDER[i]];
  renderer.setPixelRatio(Math.min(td.pixelRatio, window.devicePixelRatio || 1));
  const sg = new THREE.SphereGeometry(1, td.sphereSeg[0], td.sphereSeg[1]);
  const cg = new THREE.CylinderGeometry(1, 1, 1, td.cylSeg, 1, true);
  for (const m of [atomMeshM, atomMeshN]) m.geometry = sg;
  for (const m of [bondMeshC, bondMeshI, ghost]) m.geometry = cg;
  sphereGeo.dispose();
  cylGeo.dispose();
  sphereGeo = sg;
  cylGeo = cg;
  updateQualityHud();
  invalidate();
}

function tierLabel() { return t(`quality.${TIER_ORDER[tierIndex]}`); }

function modeLabel() {
  return qualityMode === 'auto' ? `${t('quality.autoShort')} (${tierLabel()})` : tierLabel();
}

function updateQualityHud() {
  if (btnQuality) btnQuality.textContent = t('btn.quality', { mode: modeLabel() });
  if (fpsChip) fpsChip.textContent = `-- fps · ${modeLabel()}`;
}

function applyMode(m) {
  qualityMode = m;
  throttle.reset();
  if (m !== 'auto') applyTier(TIER_ORDER.indexOf(m));
  updateQualityHud();
}

function autoTick(now) {
  if (now - lastAuto < 500) return;
  lastAuto = now;
  const fps = fpsSampler.fps;
  if (qualityMode === 'auto') {
    const s = throttle.update(fps, tierIndex);
    if (s !== tierIndex) {
      applyTier(s);
      status(t('status.autoAdjusted', { tier: t(`quality.${TIER_ORDER[s]}`), fps: Math.round(fps) }));
    }
  }
  if (fpsChip) fpsChip.textContent = `${Math.round(fps)} fps · ${modeLabel()}`;
}

// ---------------------------------------------------------------------------
// Textures (labels / badges)
// ---------------------------------------------------------------------------
const labelCache = new Map();
function labelTex(sym) {
  if (labelCache.has(sym)) return labelCache.get(sym);
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.font = 'bold 68px "Segoe UI", Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 10; g.lineJoin = 'round';
  g.strokeStyle = 'rgba(8,12,18,0.9)';
  g.strokeText(sym, 64, 68);
  g.fillStyle = '#f4f8ff';
  g.fillText(sym, 64, 68);
  const t = new THREE.CanvasTexture(c);
  labelCache.set(sym, t);
  return t;
}

const badgeCache = new Map();
function badgeTex(fc) {
  if (badgeCache.has(fc)) return badgeCache.get(fc);
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 46px "Segoe UI", Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const txt = fc > 0 ? `${fc}+` : `${-fc}\u2212`;
  g.lineWidth = 8; g.lineJoin = 'round';
  g.strokeStyle = 'rgba(8,12,18,0.95)';
  g.strokeText(txt, 64, 34);
  g.fillStyle = fc > 0 ? '#7ee787' : '#ff9d96';
  g.fillText(txt, 64, 34);
  const t = new THREE.CanvasTexture(c);
  badgeCache.set(fc, t);
  return t;
}

function syncSprites() {
  for (const [id, at] of atoms) {
    if (!labelSprites.has(id)) {
      const r = displayRadius(at.el);
      const s = 0.42 + r * 0.55;
      const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex(at.el.sym), transparent: true, depthWrite: false }));
      label.scale.set(s, s, 1);
      labelSprites.set(id, label);
      scene.add(label);
      const badge = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
      badge.scale.set(0.62, 0.31, 1);
      badge.visible = false;
      badgeSprites.set(id, badge);
      scene.add(badge);
    }
  }
  for (const [id, sp] of labelSprites) {
    if (!atoms.has(id)) {
      scene.remove(sp);
      sp.material.dispose();
      labelSprites.delete(id);
    }
  }
  for (const [id, sp] of badgeSprites) {
    if (!atoms.has(id)) {
      scene.remove(sp);
      sp.material.dispose();
      badgeSprites.delete(id);
    }
  }
}

// ---------------------------------------------------------------------------
// Instance sync (matrices + colors) — runs once per rendered frame
// ---------------------------------------------------------------------------
const easeOutBack = t => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

function spawnScale(id, now) {
  const t0 = spawnAnim.get(id);
  if (t0 === undefined) return 1;
  const t = (now - t0) / 380;
  if (t >= 1) { spawnAnim.delete(id); return 1; }
  return Math.max(0.001, easeOutBack(Math.max(0, t)));
}

function atomColor(id, col) {
  const at = atoms.get(id);
  col.set(at.el.color);
  if (reactionSelIds.has(id)) col.lerp(C_RXN, 0.5);
  if (id === snapTargetId) col.lerp(snapLegal ? C_OK : C_ERR, 0.55);
  else if (id === selectedId) col.lerp(C_SEL, 0.45);
  else if (id === hoverId) col.lerp(C_SEL, 0.18);
}

function syncInstances() {
  const now = performance.now();
  let mi = 0, ni = 0;
  for (const [id, at] of atoms) {
    const metal = isMetalCat(at.el.cat);
    const mesh = metal ? atomMeshM : atomMeshN;
    const idx = metal ? mi++ : ni++;
    if (idx >= MAX_ATOMS) continue;
    const r = displayRadius(at.el) * spawnScale(id, now);
    _p.set(at.pos.x, at.pos.y, at.pos.z);
    _s.setScalar(r);
    _m.compose(_p, Q_ID, _s);
    mesh.setMatrixAt(idx, _m);
    atomColor(id, _col);
    mesh.setColorAt(idx, _col);
    (metal ? atomIdM : atomIdN)[idx] = id;
  }
  atomMeshM.count = mi;
  atomMeshN.count = ni;
  atomMeshM.instanceMatrix.needsUpdate = true;
  atomMeshN.instanceMatrix.needsUpdate = true;
  if (atomMeshM.instanceColor) atomMeshM.instanceColor.needsUpdate = true;
  if (atomMeshN.instanceColor) atomMeshN.instanceColor.needsUpdate = true;
  // three.js caches InstancedMesh.boundingSphere on first raycast; with
  // drifting molecules the cached sphere goes stale and picking misses.
  // Force recomputation by setting to null and calling computeBoundingSphere.
  atomMeshM.boundingSphere = null;
  atomMeshN.boundingSphere = null;
  if (mi > 0) atomMeshM.computeBoundingSphere();
  if (ni > 0) atomMeshN.computeBoundingSphere();

  let ci = 0, ii = 0;
  for (const b of bonds.values()) {
    const ma = atoms.get(b.a), mb = atoms.get(b.b);
    if (!ma || !mb) continue;
    _pa.set(ma.pos.x, ma.pos.y, ma.pos.z);
    _pb.set(mb.pos.x, mb.pos.y, mb.pos.z);
    _d.subVectors(_pb, _pa);
    const len = _d.length() || 0.0001;
    _dir.copy(_d).divideScalar(len);
    _ref.set(0, 1, 0);
    if (Math.abs(_dir.y) > 0.9) _ref.set(1, 0, 0);
    _perp.crossVectors(_dir, _ref).normalize();
    const offs = b.order === 1 ? OFF1 : b.order === 2 ? OFF2 : b.order === 3 ? OFF3 : OFF4;
    const radius = b.ionic ? 0.06 : 0.075;
    _q.setFromUnitVectors(_up, _dir);
    for (let k = 0; k < b.order; k++) {
      _p.copy(_pa).addScaledVector(_dir, len / 2).addScaledVector(_perp, offs[k]);
      _s.set(radius, len, radius);
      _m.compose(_p, _q, _s);
      if (b.ionic) {
        if (ii >= MAX_CYLS) break;
        bondMeshI.setMatrixAt(ii, _m);
        bondMeshI.setColorAt(ii, C_ION);
        bondIdI[ii] = b.id;
        ii++;
      } else {
        if (ci >= MAX_CYLS) break;
        bondMeshC.setMatrixAt(ci, _m);
        bondMeshC.setColorAt(ci, C_COV);
        bondIdC[ci] = b.id;
        ci++;
      }
    }
  }
  bondMeshC.count = ci;
  bondMeshI.count = ii;
  bondMeshC.instanceMatrix.needsUpdate = true;
  bondMeshI.instanceMatrix.needsUpdate = true;
  if (bondMeshC.instanceColor) bondMeshC.instanceColor.needsUpdate = true;
  if (bondMeshI.instanceColor) bondMeshI.instanceColor.needsUpdate = true;
  bondMeshC.boundingSphere = null;
  bondMeshI.boundingSphere = null;
  if (ci > 0) bondMeshC.computeBoundingSphere();
  if (ii > 0) bondMeshI.computeBoundingSphere();
}

function updateSprites() {
  camera.getWorldDirection(_v);
  for (const [id, sp] of labelSprites) {
    const at = atoms.get(id);
    if (!at) continue;
    const r = displayRadius(at.el);
    sp.position.set(at.pos.x, at.pos.y, at.pos.z).addScaledVector(_v, -(r + 0.1));
  }
  for (const [id, sp] of badgeSprites) {
    const at = atoms.get(id);
    if (!at) continue;
    const fc = atomFC.get(id);
    const show = fcVisible && fc !== undefined;
    sp.visible = show;
    if (!show) continue;
    if (sp.userData.fc !== fc) {
      sp.material.map = badgeTex(fc);
      sp.material.needsUpdate = true;
      sp.userData.fc = fc;
    }
    const r = displayRadius(at.el);
    sp.position.set(at.pos.x, at.pos.y, at.pos.z).addScaledVector(_v, -(r + 0.48));
  }
}

// ---------------------------------------------------------------------------
// Chemistry pipeline
// ---------------------------------------------------------------------------
function compKey(comp) { return [...comp.atoms].sort((x, y) => x - y).join(','); }

let meltdownTimer = null;
let meltdownActive = false;

function triggerMeltdown() {
  if (!window.__mol3d?.SafeMode) return;
  const overlay = document.getElementById('meltdown-overlay');
  if (!overlay) return;
  meltdownActive = true;
  if (meltdownTimer) clearTimeout(meltdownTimer);
  overlay.classList.remove('active');
  void overlay.offsetWidth;
  overlay.classList.add('active');
}

function clearMeltdown() {
  const overlay = document.getElementById('meltdown-overlay');
  if (!overlay) return;
  meltdownActive = false;
  if (meltdownTimer) { clearTimeout(meltdownTimer); meltdownTimer = null; }
  overlay.classList.remove('active');
}

function checkUnstableMolecules() {
  if (!window.__mol3d?.SafeMode) { clearMeltdown(); return; }
  let danger = false;
  // Check feasibility
  for (const an of analyses) {
    if (!an.feasible) { danger = true; break; }
  }
  // Check simulation stability (fixed: positive dG = unstable, not negative)
  if (!danger) {
    for (const comp of lastComps) {
      if (comp.simulation?.stability) {
        const s = comp.simulation.stability;
        // dG > 50 means thermodynamically unfavorable (positive = unstable)
        // decompProb > 0.1 means >10% chance of decomposition
        if (s.thermodynamicallyUnstable || s.kineticallyUnstable) { danger = true; break; }
      }
    }
  }
  // Check for radioactive elements
  if (!danger) {
    for (const [, atom] of atoms) {
      if (isRadioactive(atom.el)) { danger = true; break; }
    }
  }
  if (danger) {
    triggerMeltdown();
  } else {
    clearMeltdown();
  }
}

function runSimulationAnalysis() {
  if (!simulation || lastComps.length === 0) return;
  
  // Analyze each molecule component
  for (let i = 0; i < lastComps.length; i++) {
    const comp = lastComps[i];
    const compAtoms = comp.atoms.map(id => atoms.get(id)).filter(Boolean);
    const compBonds = comp.bonds;
    
    if (compAtoms.length === 0) continue;
    
    // Run comprehensive simulation analysis
    const analysis = simulation.analyzeMolecule(compAtoms, compBonds, i);
    
    // Store analysis results on the component for UI access
    comp.simulation = analysis;
    
    // Log instability warnings
    if (analysis.stability.thermodynamicallyUnstable) {
      console.log(`⚠ Molecule ${i} is thermodynamically unstable (ΔG = ${analysis.thermodynamics.dG.toFixed(1)} kJ/mol)`);
    }
    if (analysis.stability.kineticallyUnstable) {
      console.log(`⚠ Molecule ${i} is kinetically unstable (decomposition prob = ${(analysis.kinetics.decompositionProbability * 100).toFixed(1)}%)`);
    }
  }
}

function reanalyze(pinnedIds = new Set()) {
  lastComps = componentsOf(atoms, bonds);
  const keySet = new Set(lastComps.map(compKey));
  for (const k of [...overrides.keys()]) if (!keySet.has(k)) overrides.delete(k);
  for (const k of [...isoSel.keys()]) if (!keySet.has(k)) isoSel.delete(k);
  for (const k of [...reactionSel]) if (!keySet.has(k)) reactionSel.delete(k);
  rebuildReactionSelIds();
  updateRxnPanel();
  analyses = lastComps.map(c => analyzeComponent(atoms, bonds, c, overrides.has(compKey(c)) ? overrides.get(compKey(c)) : null));
  checkUnstableMolecules();
  runSimulationAnalysis();
  for (let i = 0; i < lastComps.length; i++) {
    const df = isoSel.get(compKey(lastComps[i]));
    if (df) analyses[i].displayFormula = df;
  }
  const solved = solveAll(atoms, bonds, lastComps, analyses, pinnedIds);
  targetPos = new Map();
  for (const [id, p] of solved) targetPos.set(id, { x: p.x, y: p.y, z: p.z });
  for (const id of atoms.keys()) {
    if (!targetPos.has(id)) { const p = atoms.get(id).pos; targetPos.set(id, { x: p.x, y: p.y, z: p.z }); }
  }
  if (drag) { const p = atoms.get(drag.id).pos; targetPos.set(drag.id, { x: p.x, y: p.y, z: p.z }); }
  for (const k of [...driftState.keys()]) if (!keySet.has(k)) driftState.delete(k);
  updateFCBadges();
  recordDiscoveries();
  updateInspector();
  updateMoleculeList();
  checkChallenges();
  save();
  syncSprites();
  document.getElementById('hint').style.display = atoms.size ? 'none' : 'flex';
  invalidate();
  return lastComps;
}

function updateFCBadges() {
  atomFC.clear();
  for (const an of analyses) {
    if (!an.feasible) continue;
    for (const [id, p] of an.per) if (p.fc !== 0) atomFC.set(id, p.fc);
  }
}

// ---------------------------------------------------------------------------
// Discoveries
// ---------------------------------------------------------------------------
function discKeyOf(f, charge) { return `${f}|${charge}`; }

function safeName(comp, an) {
  if (!an.feasible) return null;
  try {
    return nameMolecule(comp.atoms.map(id => atoms.get(id)), comp.bonds, an.formula, an.charge, an.per) || null;
  } catch {
    return null;
  }
}

function structureTplOf(comp, an) {
  const idxMap = new Map(comp.atoms.map((id, i) => [id, i]));
  const cKey = compKey(comp);
  const tpl = {
    atoms: comp.atoms.map(id => atoms.get(id).el.sym),
    bonds: comp.bonds.map(b => [idxMap.get(b.a), idxMap.get(b.b), b.order, b.ionic ? 1 : 0]),
    charge: overrides.get(cKey) || 0,
  };
  return { tpl, cKey };
}

function recordDiscoveries() {
  for (let i = 0; i < lastComps.length; i++) {
    const comp = lastComps[i], an = analyses[i];
    if (!an || !an.feasible) continue;
    if (!an.formula || typeof an.formula !== 'string') continue;
    if (comp.bonds.length === 0 || comp.atoms.length < 2) continue;
    const key = discKeyOf(an.formula, an.charge);
    const { tpl, cKey } = structureTplOf(comp, an);
    if (seenDisc.has(key)) {
      // Same molecule already known — keep its structure current so Spawn
      // rebuilds the latest arrangement (e.g. after a bond-order upgrade).
      const existing = discoveries.find(x => discKeyOf(x.formula, x.charge ?? 0) === key);
      if (existing && JSON.stringify(existing.tpl) !== JSON.stringify(tpl)) {
        existing.tpl = tpl;
        const df = isoSel.get(cKey);
        if (df) existing.displayFormula = df;
        else delete existing.displayFormula;
        if (existing.saved) persistSavedDiscoveries();
      }
      continue;
    }
    seenDisc.add(key);
    const nm = safeName(comp, an);
    const d = {
      formula: an.formula, charge: an.charge, name: nm, t: Date.now(), saved: false,
      // exact structure so Spawn can rebuild it faithfully (bond orders, ionic flags, charge)
      tpl,
    };
    const df = isoSel.get(cKey);
    if (df) d.displayFormula = df;
    discoveries.push(d);
    discUnsaved = true;
    toast(t('toast.newDisc', { f: prettyFormula(an.formula) + formulaWithCharge('', an.charge), name: nm ? ` — ${nm}` : '' }));
  }
  updateDiscList();
}

function loadDiscoveries() {
  try {
    const arr = JSON.parse(localStorage.getItem(DISC_KEY) || '[]');
    for (const d of arr) {
      if (!d || !d.formula) continue;
      d.saved = true;
      discoveries.push(d);
      seenDisc.add(discKeyOf(d.formula, d.charge ?? 0));
    }
  } catch { /* corrupted storage: start fresh */ }
}

function saveDiscoveries() {
  if (!discoveries.length) return;
  try {
    localStorage.setItem(DISC_KEY, JSON.stringify(discoveries));
    for (const d of discoveries) d.saved = true;
    discUnsaved = false;
    updateDiscList();
    toast(t('toast.saved', { n: discoveries.length, s: discoveries.length > 1 ? 's' : '' }));
  } catch {
    status(t('status.saveFail'), 'err');
  }
}

// Rewrite storage with only the still-saved entries (delete must not
// accidentally persist unsaved ones).
function persistSavedDiscoveries() {
  try {
    const saved = discoveries.filter(x => x.saved);
    if (saved.length) localStorage.setItem(DISC_KEY, JSON.stringify(saved));
    else localStorage.removeItem(DISC_KEY);
  } catch { /* storage blocked: list stays in memory */ }
}

function deleteDiscovery(d) {
  const i = discoveries.indexOf(d);
  if (i === -1) return;
  discoveries.splice(i, 1);
  seenDisc.delete(discKeyOf(d.formula, d.charge ?? 0));
  persistSavedDiscoveries();
  discUnsaved = discoveries.some(x => !x.saved);
  updateDiscList();
  toast(t('toast.discDeleted', { f: prettyFormula(d.formula) + formulaWithCharge('', d.charge ?? 0) }));
}

// Free spot near scene center, maximizing distance to existing molecules.
function findSpawnSpot() {
  const cents = lastComps.map(c => {
    let x = 0, y = 0, z = 0;
    for (const id of c.atoms) { const p = atoms.get(id).pos; x += p.x; y += p.y; z += p.z; }
    const k = c.atoms.length;
    return { x: x / k, y: y / k, z: z / k };
  });
  let best = { x: 0, y: 1.8, z: 0 }, bestScore = -1;
  for (let t = 0; t < 10; t++) {
    const a = Math.random() * Math.PI * 2;
    const r = t === 0 ? 0 : 2.2 + t * 0.9 + Math.random();
    const c = { x: Math.cos(a) * r, y: 1.2 + Math.random() * 1.4, z: Math.sin(a) * r };
    let minD = 99;
    for (const p of cents) minD = Math.min(minD, Math.hypot(p.x - c.x, p.y - c.y, p.z - c.z));
    if (minD > bestScore) { bestScore = minD; best = c; }
  }
  return best;
}

function spawnDiscovery(d) {
  // Faithful structure if captured at discovery time; legacy entries fall back
  // to curated templates, then the canonical generated arrangement.
  const tpl = d.tpl || productTemplate(d.formula) || (isomerTemplates(d.formula)[0] || {}).tpl;
  if (!tpl || !tpl.atoms || !tpl.atoms.length) {
    status(t('status.spawnFail', { f: prettyFormula(d.formula) + formulaWithCharge('', d.charge ?? 0) }), 'err');
    return;
  }
  const c = findSpawnSpot();
  pushUndo({
    type: 'snapshot',
    atoms: [...atoms.values()].map(snapAtom),
    bonds: [...bonds.values()].map(b => ({ ...b })),
    overrides: [...overrides],
    iso: [...isoSel],
    nextId,
  });
  const { ids } = buildMoleculeAt(tpl, c.x, c.y, c.z);
  if (!ids.length) {
    status(t('status.spawnFail', { f: prettyFormula(d.formula) + formulaWithCharge('', d.charge ?? 0) }), 'err');
    return;
  }
  const key = compKey({ atoms: ids, bonds: [] });
  if (tpl.charge) overrides.set(key, tpl.charge);
  if (d.displayFormula) isoSel.set(key, d.displayFormula);
  reanalyze(new Set(ids));
  toast(t('toast.spawned', { f: prettyFormula(d.formula) + formulaWithCharge('', d.charge ?? 0) }));
}

function updateDiscList() {
  const list = document.getElementById('disc-list');
  const count = document.getElementById('disc-count');
  const btn = document.getElementById('btn-save-disc');
  if (!list) return;
  count.textContent = discoveries.length ? String(discoveries.length) : '';
  if (!discoveries.length) {
    list.textContent = t('dex.discEmpty');
    btn.disabled = true;
    return;
  }
  list.textContent = '';
  for (const d of discoveries) {
    const row = document.createElement('div');
    row.className = 'disc-row';
    const f = document.createElement('span');
    f.className = 'd-f';
    f.textContent = prettyFormula(d.formula) + formulaWithCharge('', d.charge ?? 0);
    const n = document.createElement('span');
    n.className = 'd-n';
    n.textContent = d.name || t('dex.unknown');
    n.title = d.name || '';
    row.append(f, n);
    if (!d.saved) {
      const dot = document.createElement('span');
      dot.className = 'd-dot';
      dot.title = t('dex.notSaved');
      row.appendChild(dot);
    }
    const spawnBtn = document.createElement('button');
    spawnBtn.className = 'd-btn d-spawn';
    spawnBtn.textContent = t('dex.spawn');
    spawnBtn.title = t('dex.spawnTitle');
    spawnBtn.addEventListener('click', e => { e.stopPropagation(); spawnDiscovery(d); });
    const delBtn = document.createElement('button');
    delBtn.className = 'd-btn d-del';
    delBtn.textContent = '\u2715';
    delBtn.title = t('dex.deleteTitle');
    delBtn.setAttribute('aria-label', `${t('dex.deleteTitle')} ${d.name || d.formula}`);
    delBtn.addEventListener('click', e => { e.stopPropagation(); deleteDiscovery(d); });
    row.append(spawnBtn, delBtn);
    list.appendChild(row);
  }
  btn.disabled = !discUnsaved;
}

// ---------------------------------------------------------------------------
// Scene edits (all funnel through here so undo + overrides stay consistent)
// ---------------------------------------------------------------------------
const snapAtom = a => ({ id: a.id, el: a.el, pos: { x: a.pos.x, y: a.pos.y, z: a.pos.z } });

function pushUndo(a) {
  undoStack.push(a);
  if (undoStack.length > 200) undoStack.shift();
  updateUndoBtn();
}

function createBond(aId, bId) {
  const chk = bondCheck(atoms, bonds, aId, bId);
  if (!chk.ok && !window.__mol3d?._godMode) { status(trReason(chk.reason), 'err'); return false; }
  const compA = componentOf(atoms, bonds, aId);
  const compB = componentOf(atoms, bonds, bId);
  const merging = compA !== compB;
  const kA = merging ? compKey(compA) : null;
  const kB = merging ? compKey(compB) : null;
  const vA = merging ? overrides.get(kA) : undefined;
  const vB = merging ? overrides.get(kB) : undefined;
  if (merging) { overrides.delete(kA); overrides.delete(kB); }
  const id = nextId++;
  bonds.set(id, { id, a: aId, b: bId, order: 1, ionic: chk.type === 'ionic' });
  if (merging && (vA !== undefined) !== (vB !== undefined)) {
    overrides.set(compKey(componentOf(atoms, bonds, aId)), vA !== undefined ? vA : vB);
  }
  pushUndo({ type: 'bond', bondId: id });
  reanalyze();
  save(true); // Force immediate save to ensure bond persistence
  const elA = atoms.get(aId).el.sym, elB = atoms.get(bId).el.sym;
  status(chk.type === 'ionic'
    ? t('status.ionicBond', { a: elA, b: elB })
    : t('status.covBond', { a: elA, b: elB }), 'ok');
  return true;
}

function removeBond(bid, undoable = true) {
  const b = bonds.get(bid);
  if (!b) return;
  const compBefore = componentOf(atoms, bonds, b.a);
  const oldKey = compKey(compBefore);
  const ov = overrides.get(oldKey);
  bonds.delete(bid);
  if (ov !== undefined) {
    const pieces = componentsOf(atoms, bonds)
      .filter(c => c.atoms.some(x => compBefore.atoms.includes(x)) && c.bonds.length > 0);
    const pick = pieces.find(c => c.atoms.includes(b.a))
      || pieces.find(c => c.atoms.includes(b.b)) || pieces[0];
    if (pick) overrides.set(compKey(pick), ov);
  }
  if (undoable) pushUndo({ type: 'delBond', snap: { ...b } });
  reanalyze();
}

function removeAtom(id, undoable = true) {
  const at = atoms.get(id);
  if (!at) return;
  const compBefore = componentOf(atoms, bonds, id);
  const oldKey = compKey(compBefore);
  const ov = overrides.get(oldKey);
  const bondSnaps = bondsOf(atoms, bonds, id).map(b => ({ ...b }));
  for (const b of bondSnaps) bonds.delete(b.id);
  atoms.delete(id);
  if (selectedId === id) { selectedId = null; updateDeleteBtn(); }
  if (hoverId === id) hoverId = null;
  if (ov !== undefined) {
    const pieces = componentsOf(atoms, bonds)
      .filter(c => c.atoms.some(x => compBefore.atoms.includes(x)) && c.bonds.length > 0)
      .sort((x, y) => y.atoms.length - x.atoms.length);
    if (pieces[0]) overrides.set(compKey(pieces[0]), ov);
  }
  if (undoable) pushUndo({ type: 'delAtom', atom: snapAtom(at), bonds: bondSnaps });
  reanalyze();
}

function setBondOrder(bid, n) {
  const b = bonds.get(bid);
  if (!b) return;
  pushUndo({ type: 'order', bondId: bid, prev: b.order });
  b.order = n;
  reanalyze();
  status(b.ionic ? t('status.orderIonic', { n }) : t('status.orderCov', { n }), 'ok');
}

const bondDirection = new Map();

function cycleBondOrder(bid) {
  const b = bonds.get(bid);
  if (!b) return;
  let dir = bondDirection.get(bid) || 1;
  
  let newOrder = b.order + dir;
  let attempts = 0;
  const maxAttempts = 8;
  
  while (attempts < maxAttempts) {
    if (newOrder > 4) {
      dir = -1;
      newOrder = 3;
      continue;
    }
    
    if (newOrder < 1) {
      removeBond(bid);
      bondDirection.delete(bid);
      return;
    }
    
    const testBond = { ...b, order: newOrder };
    const chk = upgradeCheck(atoms, bonds, testBond);
    if (chk.ok || window.__mol3d?._godMode) {
      bondDirection.set(bid, dir);
      setBondOrder(bid, newOrder);
      return;
    }
    
    newOrder += dir;
    attempts++;
  }
  
  status(trReason({ key: 'chem.noValidBondOrder' }), 'err');
}

function upgradeBond(bid) {
  const b = bonds.get(bid);
  if (!b) return;
  const up = upgradeCheck(atoms, bonds, b);
  if (!up.ok && !window.__mol3d?._godMode) { status(trReason(up.reason), 'err'); return; }
  setBondOrder(bid, b.order + 1);
}

function downgradeBond(bid) {
  const b = bonds.get(bid);
  if (!b) return;
  if (b.order > 1) setBondOrder(bid, b.order - 1);
  else removeBond(bid);
}

function spawnAtom(elOrSym) {
  const el = typeof elOrSym === 'string' ? elementBySym(elOrSym) : elOrSym;
  if (!el) return;
  let pos = null;
  for (let t = 0; t < 60; t++) {
    const ang = Math.random() * Math.PI * 2;
    const rad = 1.2 + Math.random() * 3.4;
    const p = { x: Math.cos(ang) * rad, y: 1.6 + (Math.random() - 0.5) * 2.6, z: Math.sin(ang) * rad };
    let ok = true;
    for (const [, a] of atoms) {
      const d = Math.hypot(a.pos.x - p.x, a.pos.y - p.y, a.pos.z - p.z);
      if (d < displayRadius(a.el) + displayRadius(el) + 0.5) { ok = false; break; }
    }
    if (ok) { pos = p; break; }
  }
  if (!pos) pos = { x: (nextId % 7) * 1.5 - 4.5, y: 6, z: 0 };
  const id = nextId++;
  atoms.set(id, { id, el, pos });
  spawnAnim.set(id, performance.now());
  trackRadioactiveAtom(id, atoms.get(id), performance.now());
  pushUndo({ type: 'add', id });
  selectAtom(id);
  reanalyze();
  status(t('status.placed', { name: elName(el) }), 'info');
  return id;
}

function duplicateMolecule() {
  if (selectedId === null || !atoms.has(selectedId)) {
    status(t('status.noSelection'), 'err');
    return;
  }
  const comp = lastComps.find(c => c.atoms.includes(selectedId));
  if (!comp) return;

  const idMap = new Map();
  const newAtoms = [];
  const cx = comp.atoms.reduce((s, id) => s + atoms.get(id).pos.x, 0) / comp.atoms.length;
  const cy = comp.atoms.reduce((s, id) => s + atoms.get(id).pos.y, 0) / comp.atoms.length;
  const cz = comp.atoms.reduce((s, id) => s + atoms.get(id).pos.z, 0) / comp.atoms.length;

  for (const id of comp.atoms) {
    const old = atoms.get(id);
    const newId = nextId++;
    idMap.set(id, newId);
    newAtoms.push({
      id: newId,
      el: old.el,
      pos: { x: old.pos.x + 2.5, y: old.pos.y, z: old.pos.z },
    });
  }

  pushUndo({
    type: 'duplicate',
    originalIds: [...comp.atoms],
    newIds: [...idMap.values()],
  });

  for (const at of newAtoms) {
    atoms.set(at.id, at);
    spawnAnim.set(at.id, performance.now());
  }

  for (const b of comp.bonds) {
    const newA = idMap.get(b.a);
    const newB = idMap.get(b.b);
    if (newA !== undefined && newB !== undefined) {
      bonds.set(nextId, { id: nextId, a: newA, b: newB, order: b.order, ionic: b.ionic });
      nextId++;
    }
  }

  const oldKey = compKey(comp);
  const newKey = [...idMap.values()].sort((x, y) => x - y).join(',');
  if (overrides.has(oldKey)) {
    overrides.set(newKey, overrides.get(oldKey));
  }

  selectAtom([...idMap.values()][0]);
  reanalyze();
  status(t('status.duplicated'), 'info');
}

function clearAll() {
  if (!atoms.size && !bonds.size && !overrides.size) return;
  pushUndo({
    type: 'clear',
    atoms: [...atoms.values()].map(snapAtom),
    bonds: [...bonds.values()].map(b => ({ ...b })),
    overrides: [...overrides],
    nextId,
  });
  for (const id of [...bonds.keys()]) bonds.delete(id);
  for (const id of [...atoms.keys()]) atoms.delete(id);
  atoms.clear(); bonds.clear(); overrides.clear(); isoSel.clear(); driftState.clear();
  selectedId = null; hoverId = null;
  clearReactionSel();
  reanalyze();
  status(t('status.cleared'), 'info');
}

function undo() {
  const a = undoStack.pop();
  updateUndoBtn();
  if (!a) { status(t('status.nothingUndo')); return; }
  switch (a.type) {
    case 'add':
      removeAtom(a.id, false);
      break;
    case 'bond':
      removeBond(a.bondId, false);
      break;
    case 'delBond': {
      const b = a.snap;
      bonds.set(b.id, { ...b });
      reanalyze();
      break;
    }
    case 'order': {
      const b = bonds.get(a.bondId);
      if (b) b.order = a.prev;
      reanalyze();
      break;
    }
    case 'delAtom': {
      const at = a.atom;
      atoms.set(at.id, at);
      for (const b of a.bonds) bonds.set(b.id, { ...b });
      reanalyze();
      break;
    }
    case 'clear': {
      for (const at of a.atoms) atoms.set(at.id, at);
      for (const b of a.bonds) bonds.set(b.id, { ...b });
      for (const [k, v] of a.overrides) overrides.set(k, v);
      nextId = Math.max(nextId, a.nextId);
      reanalyze();
      break;
    }
    case 'duplicate': {
      for (const id of a.newIds) {
        atoms.delete(id);
        spawnAnim.delete(id);
      }
      for (const b of [...bonds.values()]) {
        if (a.newIds.includes(b.a) || a.newIds.includes(b.b)) bonds.delete(b.id);
      }
      reanalyze();
      break;
    }
    case 'snapshot': {
      atoms.clear(); bonds.clear(); overrides.clear(); isoSel.clear(); driftState.clear();
      for (const at of a.atoms) atoms.set(at.id, at);
      for (const b of a.bonds) bonds.set(b.id, { ...b });
      for (const [k, v] of a.overrides) overrides.set(k, v);
      for (const [k, v] of a.iso || []) isoSel.set(k, v);
      nextId = Math.max(nextId, a.nextId);
      selectedId = null; hoverId = null;
      clearReactionSel();
      reanalyze();
      break;
    }
  }
  status(t('status.undone'));
}

// ---------------------------------------------------------------------------
// Drift physics — molecules float and tumble gently
// ---------------------------------------------------------------------------
const DRIFT_SPEED = 0.4;
const BOUND_R = 10.5;
const Y_MIN = -0.2, Y_MAX = 4.6;

function randUnit() {
  return new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
}

function updateDrift(dt) {
  if (!tier().drift || drag || lastComps.length === 0) return false;
  let any = false;
  for (const comp of lastComps) {
    const key = compKey(comp);
    let d = driftState.get(key);
    if (!d) {
      d = { v: randUnit().multiplyScalar(DRIFT_SPEED * (0.7 + Math.random() * 0.6)), axis: randUnit(), rate: 0.08 + Math.random() * 0.18 };
      driftState.set(key, d);
    }
    const sp = d.v.length() || 0.0001;
    if (sp > DRIFT_SPEED * 1.001) d.v.multiplyScalar(Math.max(DRIFT_SPEED, sp - dt * 2.2) / sp);
    else if (sp < DRIFT_SPEED * 0.999) d.v.setLength(Math.min(DRIFT_SPEED, sp + dt * 0.4));

    const c = new THREE.Vector3();
    for (const id of comp.atoms) {
      const p = atoms.get(id).pos;
      c.x += p.x; c.y += p.y; c.z += p.z;
    }
    c.divideScalar(comp.atoms.length);
    const horiz = Math.hypot(c.x, c.z);
    if (horiz > BOUND_R || c.y < Y_MIN || c.y > Y_MAX) {
      _v.set(-c.x, 1.9 - c.y, -c.z).normalize();
      d.v.lerp(_v, Math.min(1, dt * 1.6)).setLength(DRIFT_SPEED);
    }
    _q.setFromAxisAngle(d.axis, d.rate * dt);
    for (const id of comp.atoms) {
      const at = atoms.get(id);
      _p.set(at.pos.x, at.pos.y, at.pos.z).sub(c).applyQuaternion(_q).add(c).addScaledVector(d.v, dt);
      at.pos.x = _p.x; at.pos.y = _p.y; at.pos.z = _p.z;
      const tp = targetPos.get(id);
      if (tp) {
        _p.set(tp.x, tp.y, tp.z).sub(c).applyQuaternion(_q).add(c).addScaledVector(d.v, dt);
        tp.x = _p.x; tp.y = _p.y; tp.z = _p.z;
      }
    }
    any = true;
  }
  return any;
}

// ---------------------------------------------------------------------------
// Reactions
// ---------------------------------------------------------------------------
const rxnPanel = document.getElementById('rxn-panel');
const rxnCount = document.getElementById('rxn-count');
const rxnConds = document.getElementById('rxn-conds');
const condLabel = k => t(`cond.${k}`);

function rebuildReactionSelIds() {
  reactionSelIds.clear();
  for (const comp of lastComps) {
    if (!reactionSel.has(compKey(comp))) continue;
    for (const id of comp.atoms) reactionSelIds.add(id);
  }
}

function clearReactionSel() {
  if (!reactionSel.size) return;
  reactionSel.clear();
  reactionSelIds.clear();
  updateRxnPanel();
  invalidate();
}

function updateRxnPanel() {
  if (!rxnPanel) return;
  updateRxnStoich();
  if (reactionSel.size === 0) { rxnPanel.style.display = 'none'; return; }
  rxnPanel.style.display = 'flex';
  rxnCount.textContent = t('rxn.count', { n: reactionSel.size, s: reactionSel.size > 1 ? 's' : '' });
  updateRxnStoich();
}

const rxnStoichBox = document.getElementById('rxn-stoich');

// Amounts & yield: one calculator per exactly-matched reaction for the
// current selection. Skips mayhem visual effects (not stoichiometric).
function updateRxnStoich() {
  if (!rxnStoichBox) return;
  rxnStoichBox.innerHTML = '';
  rxnStoichBox.style.display = 'none';
  if (reactionSel.size === 0) return;
  const formulas = selectedFormulas();
  const seen = new Set();
  const matched = [];
  for (const c of CONDITIONS) {
    const rx = findReaction(formulas, c.key, selectedStructures());
    if (!rx || rx.effect) continue;
    const k = `${rx.equation}|${rx.condition}`;
    if (seen.has(k)) continue;
    seen.add(k);
    matched.push(rx);
  }
  if (!matched.length) return;
  rxnStoichBox.style.display = 'flex';
  const title = document.createElement('div');
  title.className = 'rxn-stoich-title';
  title.textContent = t('stoich.rxnTitle');
  rxnStoichBox.appendChild(title);
  for (const rx of matched) rxnStoichBox.appendChild(buildRxnStoichBlock(rx));
}

function buildRxnStoichBlock(rx) {
  const block = document.createElement('div');
  block.className = 'rxn-stoich-block';

  const eq = document.createElement('div');
  eq.className = 'rxn-stoich-eq';
  eq.innerHTML = `${prettyEq(rx.equation)} <span class="cond-chip">${condLabel(rx.condition)}</span>`;
  block.appendChild(eq);

  const reactants = Object.entries(rx.reactants);
  const inputs = [];
  for (const [f, coeff] of reactants) {
    const row = document.createElement('div');
    row.className = 'rxn-stoich-row';
    const lbl = document.createElement('span');
    lbl.className = 'rxn-stoich-f';
    lbl.innerHTML = `${prettyFormula(f)}${coeff > 1 ? ` <span class="muted">&times;${coeff}</span>` : ''}`;
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.min = '0';
    inp.step = 'any';
    inp.placeholder = 'g';
    inp.setAttribute('aria-label', `${t('stoich.massLbl')} ${f}`);
    const molSpan = document.createElement('span');
    molSpan.className = 'rxn-stoich-mol';
    row.append(lbl, inp, molSpan);
    block.appendChild(row);
    inputs.push({ f, coeff, inp, molSpan });
  }

  const out = document.createElement('div');
  out.className = 'rxn-stoich-out';
  block.appendChild(out);

  const yieldRow = document.createElement('div');
  yieldRow.className = 'rxn-stoich-row';
  const yieldLbl = document.createElement('span');
  yieldLbl.className = 'rxn-stoich-f';
  yieldLbl.textContent = t('stoich.yieldLbl');
  const yieldInp = document.createElement('input');
  yieldInp.type = 'number';
  yieldInp.min = '0';
  yieldInp.max = '100';
  yieldInp.step = 'any';
  yieldInp.value = '100';
  yieldRow.append(yieldLbl, yieldInp);
  block.appendChild(yieldRow);

  const num = (el) => { const v = parseFloat(el.value); return isFinite(v) && v >= 0 ? v : null; };

  const recalc = () => {
    const moles = new Map();
    let any = false, all = true;
    for (const r of inputs) {
      const g = num(r.inp);
      const M = molarMass(r.f);
      if (g === null || M === null) {
        r.molSpan.textContent = '';
        all = false;
        if (g !== null) any = true;
      } else {
        r.molSpan.textContent = `${fmtAmount(g / M)} mol`;
        moles.set(r.f, g / M);
        any = true;
      }
    }
    if (!any) { out.textContent = ''; return; }
    const res = all ? limitingAnalysis(rx, moles) : null;
    if (!res) { out.textContent = t('stoich.enterAll'); return; }
    const pct = num(yieldInp);
    const lines = [];
    lines.push(`${t('stoich.limiting')}: <b>${prettyFormula(res.limiting.formula)}</b> — ${fmtAmount(res.limiting.extent)} mol`);
    for (const l of res.leftovers) {
      lines.push(`${prettyFormula(l.formula)}: +${fmtAmount(l.moles)} mol ${t('stoich.left')}`);
    }
    for (const p of res.products) {
      const massStr = p.mass !== null ? ` · ${fmtAmount(p.mass)} g` : '';
      lines.push(`&rarr; ${prettyFormula(p.formula)}: ${fmtAmount(p.moles)} mol${massStr}`);
      if (pct !== null && pct !== 100) {
        const am = p.mass !== null ? ` · ${fmtAmount(p.mass * pct / 100)} g` : '';
        lines.push(`&nbsp;&nbsp;${t('stoich.actual')} (${fmtAmount(pct)}%): ${fmtAmount(p.moles * pct / 100)} mol${am}`);
      }
    }
    out.innerHTML = lines.map(s => `<div>${s}</div>`).join('');
  };
  for (const r of inputs) r.inp.addEventListener('input', recalc);
  yieldInp.addEventListener('input', recalc);
  return block;
}

function selectedFormulas() {
  const out = [];
  for (let i = 0; i < lastComps.length; i++) {
    if (reactionSel.has(compKey(lastComps[i]))) {
      const an = analyses[i];
      // The arrangement the user picked is the molecule's identity for reactions
      out.push(an ? (an.displayFormula || an.formula) : '');
    }
  }
  return out;
}

// Structure templates of the selected components, parallel to
// selectedFormulas() — feeds the structure-aware reaction checkers.
function selectedStructures() {
  const out = [];
  for (let i = 0; i < lastComps.length; i++) {
    if (!reactionSel.has(compKey(lastComps[i]))) continue;
    const an = analyses[i];
    if (!an) continue;
    out.push(structureTplOf(lastComps[i], an).tpl);
  }
  return out;
}

function prettyEq(eq) {
  const sub = '₀₁₂₃₄₅₆₇₈₉';
  return eq.replace(/->/g, '\u2192').replace(/(?<=[A-Za-z)\]])\d+/g, m => [...m].map(c => sub[+c]).join(''));
}

function buildRxnPanel() {
  if (!rxnConds) return;
  for (const c of CONDITIONS) {
    const b = document.createElement('button');
    b.textContent = condLabel(c.key);
    b.dataset.cond = c.key;
    b.addEventListener('click', () => onConditionPick(c.key));
    rxnConds.appendChild(b);
  }
  document.getElementById('rxn-cancel').addEventListener('click', () => {
    clearReactionSel();
    status(t('status.reactionCancelled'));
  });
}

function onConditionPick(cond) {
  const formulas = selectedFormulas();
  const rx = findReaction(formulas, cond, selectedStructures());
  if (rx) { executeReaction(rx); return; }
  const valid = conditionsFor(formulas, selectedStructures());
  if (!valid.size) { status(t('status.noReaction'), 'err'); return; }
  if (valid.has(cond)) {
    const more = missingFor(formulas, cond);
    status(more
      ? t('status.notEnough', { more: prettyEq(more), cond: condLabel(cond).toLowerCase() })
      : t('status.nothingHappens', { cond: condLabel(cond) }), 'err');
    return;
  }
  status(t('status.nothingHappensTry', { cond: condLabel(cond), valid: [...valid].map(k => condLabel(k)).join(', ') }), 'err');
}

let rxnOverlayTimer = null;
function showRxnOverlay(rx) {
  const overlay = document.getElementById('rxn-overlay');
  const condEl = overlay.querySelector('.rxn-condition');
  const eqEl = overlay.querySelector('.rxn-equation');
  condEl.textContent = condLabel(rx.condition);
  eqEl.innerHTML = prettyEq(rx.equation);
  overlay.classList.add('show');
  overlay.setAttribute('aria-hidden', 'false');
  if (rxnOverlayTimer) clearTimeout(rxnOverlayTimer);
  rxnOverlayTimer = setTimeout(() => {
    overlay.classList.remove('show');
    overlay.setAttribute('aria-hidden', 'true');
  }, 3000);
}

function executeReaction(rx) {
  const selComps = lastComps.filter(c => reactionSel.has(compKey(c)));
  if (!selComps.length) return;
  const formulas = selComps.map(c => {
    const an = analyses[lastComps.indexOf(c)];
    return an ? (an.displayFormula || an.formula) : '';
  });
  const structs = selComps.map(c => structureTplOf(c, analyses[lastComps.indexOf(c)]).tpl);
  if (!findReaction(formulas, rx.condition, structs)) {
    status(t('status.sceneChanged'), 'err');
    clearReactionSel();
    return;
  }

  const consumedIds = [];
  for (const c of selComps) for (const id of c.atoms) consumedIds.push(id);
  const consumedSet = new Set(consumedIds);

  const cen = new THREE.Vector3();
  for (const id of consumedIds) {
    const p = atoms.get(id).pos;
    cen.x += p.x; cen.y += p.y; cen.z += p.z;
  }
  cen.divideScalar(consumedIds.length);

  pushUndo({
    type: 'snapshot',
    atoms: [...atoms.values()].map(snapAtom),
    bonds: [...bonds.values()].map(b => ({ ...b })),
    overrides: [...overrides],
    iso: [...isoSel],
    nextId,
  });

  for (const b of [...bonds.values()]) {
    if (consumedSet.has(b.a) || consumedSet.has(b.b)) bonds.delete(b.id);
  }

  if (rx.effect) {
    executeMayhemEffect(rx, consumedIds, cen);
    return;
  }

  const instances = [];
  for (const [key, n] of rx.products) for (let i = 0; i < n; i++) instances.push(key);

  for (const key of instances) {
    if (!productTemplate(key)) {
      status(t('status.reactionFailed', { product: key }), 'err');
      clearReactionSel();
      return;
    }
  }

  const pool = new Map(); // element symbol -> [reusable atom ids]
  for (const id of consumedIds) {
    const sym = atoms.get(id).el.sym;
    if (!pool.has(sym)) pool.set(sym, []);
    pool.get(sym).push(id);
  }

  let mainIdx = 0;
  for (let i = 1; i < instances.length; i++) {
    if (productTemplate(instances[i]).atoms.length > productTemplate(instances[mainIdx]).atoms.length) mainIdx = i;
  }

  const golden = Math.PI * (3 - Math.sqrt(5));
  const newCompKeys = [];
  for (let i = 0; i < instances.length; i++) {
    const tpl = productTemplate(instances[i]);
    let center = cen;
    if (i !== mainIdx) {
      const a = Math.random() * Math.PI * 2;
      const dist = 3.2 + Math.random() * 1.8 + i * 0.9;
      center = new THREE.Vector3(
        cen.x + Math.cos(a) * dist,
        Math.max(0.8, Math.min(4.2, cen.y + (Math.random() - 0.5) * 1.6)),
        cen.z + Math.sin(a) * dist,
      );
    }
    const ids = [];
    const n = tpl.atoms.length;
    for (let j = 0; j < n; j++) {
      const sym = tpl.atoms[j];
      let id = pool.get(sym)?.pop();
      if (id === undefined) {
        const el = elementBySym(sym);
        if (!el) {
          status(t('status.reactionFailed', { product: instances[i] }), 'err');
          clearReactionSel();
          return;
        }
        id = nextId++;
        atoms.set(id, { id, el, pos: { x: center.x, y: center.y, z: center.z } });
      }
      const yy = n === 1 ? 0 : 1 - (2 * j) / (n - 1);
      const rr = Math.sqrt(Math.max(0, 1 - yy * yy));
      const th = golden * j;
      atoms.get(id).pos = {
        x: center.x + Math.cos(th) * rr * 0.85,
        y: Math.max(-0.4, Math.min(5.2, center.y + yy * 0.85)),
        z: center.z + Math.sin(th) * rr * 0.85,
      };
      ids.push(id);
    }
    for (const [ai, bi, order, ionic] of tpl.bonds) {
      bonds.set(nextId, { id: nextId, a: ids[ai], b: ids[bi], order, ionic: !!ionic });
      nextId++;
    }
    const key = [...ids].sort((x, y) => x - y).join(',');
    if (tpl.charge) overrides.set(key, tpl.charge);
    newCompKeys.push({ key, center, i });
  }

  for (const [, arr] of pool) {
    for (const id of arr) atoms.delete(id);
  }

  clearReactionSel();
  selectedId = null;
  reanalyze();

  for (const { key, center, i } of newCompKeys) {
    if (i === mainIdx) { driftState.delete(key); continue; }
    const dir = new THREE.Vector3(center.x - cen.x, center.y - cen.y, center.z - cen.z).normalize();
    driftState.set(key, {
      v: dir.multiplyScalar(2.6 + Math.random() * 1.4).add(new THREE.Vector3(0, 0.7, 0)),
      axis: randUnit(),
      rate: 0.1 + Math.random() * 0.2,
    });
  }

  status(t('status.reactionDone', { cond: condLabel(rx.condition), eq: prettyEq(rx.equation) }), 'ok');
  showRxnOverlay(rx);
}

const mayhemParticles = [];

function executeMayhemEffect(rx, consumedIds, cen) {
  for (const id of consumedIds) atoms.delete(id);
  clearReactionSel();
  selectedId = null;
  reanalyze();

  const effectColors = {
    annihilate: 0xffffff,
    explode: 0xff4400,
    merge: 0xffd700,
    quantum: 0x00f0ff,
    decay: 0x00ff40,
    plasma: 0xcc44ff,
  };

  const color = effectColors[rx.effect] || 0xffffff;
  const count = rx.effect === 'explode' ? 60 : rx.effect === 'plasma' ? 50 : 30;

  for (let i = 0; i < count; i++) {
    const geo = new THREE.SphereGeometry(0.08 + Math.random() * 0.12, 6, 4);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(cen);
    const dir = randUnit();
    const speed = 1.5 + Math.random() * 4;
    scene.add(mesh);
    mayhemParticles.push({
      mesh, geo, mat,
      v: dir.multiplyScalar(speed),
      life: 1.0,
      decay: 0.4 + Math.random() * 0.8,
    });
  }

  if (rx.effect === 'explode') triggerScreenShake(0.4, 600);
  if (rx.effect === 'annihilate') triggerFlash(0xffffff, 500);
  if (rx.effect === 'plasma') triggerFlash(0x8800ff, 300);
  if (rx.effect === 'merge') {
    const geo = new THREE.SphereGeometry(0.5, 16, 12);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.9 });
    const orb = new THREE.Mesh(geo, mat);
    orb.position.copy(cen);
    scene.add(orb);
    mayhemParticles.push({
      mesh: orb, geo, mat,
      v: new THREE.Vector3(0, 0, 0),
      life: 1.0,
      decay: 0.3,
      grow: true,
    });
  }
  if (rx.effect === 'quantum') {
    for (let i = 0; i < 8; i++) {
      const geo = new THREE.SphereGeometry(0.15, 8, 6);
      const mat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.7 });
      const mesh = new THREE.Mesh(geo, mat);
      const a = Math.random() * Math.PI * 2;
      const r = 0.5 + Math.random() * 1.5;
      mesh.position.set(cen.x + Math.cos(a) * r, cen.y + (Math.random() - 0.5) * 2, cen.z + Math.sin(a) * r);
      scene.add(mesh);
      mayhemParticles.push({
        mesh, geo, mat,
        v: new THREE.Vector3(0, 0, 0),
        life: 1.0,
        decay: 0.5 + Math.random() * 0.5,
        flicker: true,
      });
    }
  }

  const effectLabels = {
    annihilate: 'ANNIHILATION!',
    explode: 'BOOM!',
    merge: 'ULTIMATE ALLOY!',
    quantum: 'SUPERPOSITION!',
    decay: 'DECAY!',
    plasma: 'PLASMA STORM!',
  };
  toast(effectLabels[rx.effect] || rx.effect);
  status(t('status.mayhemEffect', { effect: effectLabels[rx.effect], eq: prettyEq(rx.equation) }), 'ok');
  showRxnOverlay(rx);
}

function updateMayhemParticles(dt) {
  for (let i = mayhemParticles.length - 1; i >= 0; i--) {
    const p = mayhemParticles[i];
    p.life -= dt * p.decay;
    if (p.life <= 0) {
      scene.remove(p.mesh);
      p.geo.dispose();
      p.mat.dispose();
      mayhemParticles.splice(i, 1);
      continue;
    }
    p.mesh.position.addScaledVector(p.v, dt);
    p.v.multiplyScalar(1 - dt * 2);
    p.mat.opacity = p.life;
    if (p.grow) {
      const s = 0.5 + (1 - p.life) * 3;
      p.mesh.scale.setScalar(s);
    }
    if (p.flicker) {
      p.mesh.visible = Math.random() > 0.3;
      p.mesh.position.x += (Math.random() - 0.5) * 0.1;
      p.mesh.position.y += (Math.random() - 0.5) * 0.1;
      p.mesh.position.z += (Math.random() - 0.5) * 0.1;
    }
  }
}

let shakeIntensity = 0, shakeDuration = 0, shakeStart = 0;
const shakeOffset = new THREE.Vector3();
const shakeOrigPos = new THREE.Vector3();

function triggerScreenShake(intensity, durationMs) {
  shakeIntensity = intensity;
  shakeDuration = durationMs;
  shakeStart = performance.now();
  shakeOrigPos.copy(camera.position);
}

function updateScreenShake(now) {
  if (!shakeDuration) return;
  const elapsed = now - shakeStart;
  if (elapsed > shakeDuration) {
    shakeDuration = 0;
    camera.position.sub(shakeOffset);
    shakeOffset.set(0, 0, 0);
    return;
  }
  const t = 1 - elapsed / shakeDuration;
  const s = shakeIntensity * t;
  const newOx = (Math.random() - 0.5) * 2 * s;
  const newOy = (Math.random() - 0.5) * 2 * s;
  const newOz = (Math.random() - 0.5) * 2 * s;
  camera.position.sub(shakeOffset);
  shakeOffset.set(newOx, newOy, newOz);
  camera.position.add(shakeOffset);
}

let flashMesh = null;
function triggerFlash(color, durationMs) {
  if (flashMesh) {
    scene.remove(flashMesh);
    flashMesh.geometry.dispose();
    flashMesh.material.dispose();
  }
  const geo = new THREE.SphereGeometry(50, 8, 6);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, side: THREE.BackSide });
  flashMesh = new THREE.Mesh(geo, mat);
  flashMesh.position.copy(camera.position);
  scene.add(flashMesh);
  const start = performance.now();
  function fadeFlash() {
    const elapsed = performance.now() - start;
    const t = elapsed / durationMs;
    if (t >= 1) {
      scene.remove(flashMesh);
      flashMesh.geometry.dispose();
      flashMesh.material.dispose();
      flashMesh = null;
      return;
    }
    flashMesh.material.opacity = 0.6 * (1 - t);
    requestAnimationFrame(fadeFlash);
  }
  requestAnimationFrame(fadeFlash);
}

// ---------------------------------------------------------------------------
// Picking + pointer interaction
// ---------------------------------------------------------------------------
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

function setNDC(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
}

function pickAtom() {
  syncInstances();
  raycaster.setFromCamera(ndc, camera);
  let best = null, bestDist = Infinity;
  for (const mesh of [atomMeshM, atomMeshN]) {
    for (const h of raycaster.intersectObject(mesh)) {
      if (h.instanceId === undefined) continue;
      const id = mesh.userData.ids[h.instanceId];
      if (id === undefined) continue; // Defensive: skip if instance ID map is stale
      if (h.distance < bestDist) {
        bestDist = h.distance;
        best = id;
      }
    }
  }
  return best;
}

function pickBond() {
  syncInstances();
  raycaster.setFromCamera(ndc, camera);
  let best = null, bestDist = Infinity;
  for (const mesh of [bondMeshC, bondMeshI]) {
    for (const h of raycaster.intersectObject(mesh)) {
      if (h.instanceId === undefined) continue;
      if (h.distance < bestDist) {
        bestDist = h.distance;
        best = mesh.userData.ids[h.instanceId];
      }
    }
  }
  return best;
}

function onPointerDown(e) {
  lastPointerType = e.pointerType || 'mouse';
  if (e.button !== 0) return;
  setNDC(e);
  const hitId = pickAtom();
  downInfo = { x: e.clientX, y: e.clientY, atomId: hitId };
  if (hitId !== null && hitId !== undefined && atoms.has(hitId)) {
    e.stopImmediatePropagation();
    controls.enabled = false;
    selectAtom(hitId);
    const at = atoms.get(hitId);
    const n = camera.getWorldDirection(new THREE.Vector3()).negate();
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      n, new THREE.Vector3(at.pos.x, at.pos.y, at.pos.z));
    raycaster.setFromCamera(ndc, camera);
    const p = new THREE.Vector3();
    const hit = raycaster.ray.intersectPlane(plane, p);
    const off = hit ? p.sub(new THREE.Vector3(at.pos.x, at.pos.y, at.pos.z)) : new THREE.Vector3();
    drag = { id: hitId, plane, grabOffset: off, moved: false, snapId: null, snapLegal: false, snapMsg: '', snapUpgrade: false };
    invalidate();
  }
}

function onPointerMove(e) {
  setNDC(e);
  if (drag) {
    if (!drag.moved && downInfo && Math.hypot(e.clientX - downInfo.x, e.clientY - downInfo.y) > 4) drag.moved = true;
    if (!drag.moved) return;
    raycaster.setFromCamera(ndc, camera);
    const p = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(drag.plane, p)) return;
    p.sub(drag.grabOffset);
    const at = atoms.get(drag.id);
    at.pos.x = p.x;
    at.pos.y = Math.max(-0.4, Math.min(5.4, p.y));
    at.pos.z = p.z;
    targetPos.set(drag.id, { x: at.pos.x, y: at.pos.y, z: at.pos.z });

    let bestId = null, bestD = Infinity;
    for (const [oid, oat] of atoms) {
      if (oid === drag.id) continue;
      const d = Math.hypot(oat.pos.x - at.pos.x, oat.pos.y - at.pos.y, oat.pos.z - at.pos.z);
      const lim = (displayRadius(at.el) + displayRadius(oat.el)) * 1.45 + 0.25;
      if (d < lim && d < bestD) { bestD = d; bestId = oid; }
    }
    drag.snapId = bestId;
    if (bestId === null) {
      drag.snapLegal = false; drag.snapMsg = ''; drag.snapUpgrade = false;
    } else {
      const existing = [...bonds.values()].find(b =>
        (b.a === drag.id && b.b === bestId) || (b.b === drag.id && b.a === bestId));
      if (existing) {
        const up = upgradeCheck(atoms, bonds, existing);
        const ok = up.ok || window.__mol3d?._godMode;
        drag.snapUpgrade = ok;
        drag.snapLegal = ok;
        drag.snapMsg = ok
          ? t('snap.upgradeTo', { n: existing.order + 1 })
          : up.reason;
      } else {
        const chk = bondCheck(atoms, bonds, drag.id, bestId);
        const ok = chk.ok || window.__mol3d?._godMode;
        drag.snapLegal = ok;
        drag.snapMsg = ok
          ? (chk.type === 'ionic' ? t('snap.ionic') : t('snap.bond'))
          : chk.reason;
      }
    }
    snapTargetId = drag.snapId;
    snapLegal = drag.snapLegal;
    snapMsg = drag.snapMsg;
    updateGhost();
    invalidate();
    return;
  }
  if (e.target !== renderer.domElement) return;
  const h = pickAtom();
  if (h !== hoverId) {
    hoverId = h;
    renderer.domElement.style.cursor = h !== null ? 'grab' : '';
    invalidate();
  }
}

function updateGhost() {
  if (!drag || drag.snapId === null) { ghost.visible = false; return; }
  const a = atoms.get(drag.id), b = atoms.get(drag.snapId);
  _pa.set(a.pos.x, a.pos.y, a.pos.z);
  _pb.set(b.pos.x, b.pos.y, b.pos.z);
  _d.subVectors(_pb, _pa);
  const len = _d.length() || 0.0001;
  ghost.position.copy(_pa).addScaledVector(_d, 0.5);
  ghost.quaternion.setFromUnitVectors(_up, _d.divideScalar(len));
  ghost.scale.set(0.16, len, 0.16);
  ghostMat.color.setHex(snapLegal ? 0x3fb950 : 0xf85149);
  ghost.visible = true;
}

function onPointerUp(e) {
  trackDoubleTap(e);
  if (drag) {
    const d = drag;
    drag = null;
    snapTargetId = null;
    ghost.visible = false;
    try {
      if (d.moved) {
        if (d.snapId !== null) {
          const existing = [...bonds.values()].find(b =>
            (b.a === d.id && b.b === d.snapId) || (b.b === d.id && b.a === d.snapId));
          if (existing) {
            if (d.snapUpgrade) upgradeBond(existing.id);
            else status(trReason(d.snapMsg), 'err');
          } else {
            createBond(d.id, d.snapId);
          }
        }
        reanalyze(new Set([d.id]));
      }
    } finally {
      // Always re-enable controls, even if an error occurred during drag cleanup
      controls.enabled = true;
      invalidate();
    }
    return;
  }
  if (downInfo && Math.hypot(e.clientX - downInfo.x, e.clientY - downInfo.y) < 4 && downInfo.atomId === null) {
    setNDC(e);
    const bid = pickBond();
    if (bid !== null) {
      cycleBondOrder(bid);
    }
  }
}

// Touch devices may not fire dblclick; two quick taps on the same spot
// select/deselect the molecule for a reaction instead.
let tapT = 0, tapX = 0, tapY = 0;
function trackDoubleTap(e) {
  if ((e.pointerType || 'mouse') !== 'touch' || e.target !== renderer.domElement) return;
  const now = performance.now();
  if (tapT && now - tapT < 350 && Math.hypot(e.clientX - tapX, e.clientY - tapY) < 32) {
    tapT = 0;
    handleReactionPick(e);
  } else {
    tapT = now; tapX = e.clientX; tapY = e.clientY;
  }
}

renderer.domElement.addEventListener('dblclick', e => {
  if (lastPointerType === 'touch') return; // already handled by trackDoubleTap
  handleReactionPick(e);
});

function handleReactionPick(e) {
  setNDC(e);
  const hit = pickAtom();
  if (hit === null) {
    clearReactionSel();
    status(t('status.selCleared'));
    return;
  }
  const comp = componentOf(atoms, bonds, hit);
  const key = compKey(comp);
  if (reactionSel.has(key)) {
    reactionSel.delete(key);
    status(t('status.selRemoved'));
  } else {
    reactionSel.add(key);
    status(t('status.selAdded', { n: reactionSel.size }), 'info');
  }
  rebuildReactionSelIds();
  updateRxnPanel();
  invalidate();
}

// ---------------------------------------------------------------------------
// UI: periodic table, legend, inspector, lists
// ---------------------------------------------------------------------------
function buildPeriodicTable() {
  const wrap = document.getElementById('ptable');
  wrap.innerHTML = '';
  for (let z = 1; z <= 118; z++) {
    const el = ELEMENTS.find(e => e.z === z);
    const g = gridPos(z);
    const b = document.createElement('button');
    b.className = 'el';
    b.style.gridColumn = g.col;
    b.style.gridRow = g.row;
    b.style.borderColor = el.color;
    b.dataset.sym = el.sym;
    b.title = t('el.title', { name: elName(el), cat: catLabel(el.cat), max: el.maxBonds });
    b.innerHTML = `<span class="z">${z}</span><span class="s">${el.sym}</span>`;
    b.addEventListener('click', () => spawnAtom(el));
    wrap.appendChild(b);
  }
  const ph = document.createElement('div');
  ph.className = 'el ph';
  ph.style.gridColumn = '3 / 13';
  ph.style.gridRow = '8';
  ph.textContent = t('ptable.ph');
  wrap.appendChild(ph);
}

function buildLegend() {
  const legend = document.getElementById('legend');
  legend.innerHTML = '';
  for (const [cat, color] of Object.entries(CAT_COLOR)) {
    const s = document.createElement('span');
    s.className = 'lg';
    s.innerHTML = `<i style="background:${color}"></i>${catLabel(cat)}`;
    legend.appendChild(s);
  }
}

// InfiniteCraft-style pool: searchable chip list, periodic table as a toggle.
// Search matches Vietnamese names without diacritics (e.g. "natri", "oxicacbon").
const fold = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');

function renderPoolNames() {
  for (const b of document.querySelectorAll('#pool-list .el-chip')) {
    const el = elementBySym(b.dataset.sym);
    if (!el) continue;
    b.dataset.search = `${el.sym} ${el.name} ${el.z} ${elName(el)} ${fold(el.name)} ${fold(elName(el))}`.toLowerCase();
    b.title = t('el.title', { name: elName(el), cat: catLabel(el.cat), max: el.maxBonds });
    b.querySelector('.n').textContent = elName(el);
  }
  for (const b of document.querySelectorAll('#ptable .el[data-sym]')) {
    const el = elementBySym(b.dataset.sym);
    if (el) b.title = t('el.title', { name: elName(el), cat: catLabel(el.cat), max: el.maxBonds });
  }
}

function buildPool() {
  buildPeriodicTable();
  const wrap = document.getElementById('pool-list');
  const allElements = [...ELEMENTS];
  if (mayhemMode) allElements.push(...MAYHEM_ELEMENTS);
  allElements.push(...customElements);
  for (const el of allElements) {
    const b = document.createElement('button');
    b.className = 'el-chip';
    b.dataset.sym = el.sym;
    b.dataset.search = `${el.sym} ${el.name} ${el.z}`.toLowerCase();
    b.title = `${el.name} · ${el.cat} · max bonds ${el.maxBonds}`;
    const dot = document.createElement('i');
    dot.style.background = el.color;
    const s = document.createElement('span');
    s.className = 's';
    s.textContent = el.sym;
    const n = document.createElement('span');
    n.className = 'n';
    n.textContent = el.name;
    b.append(dot, s, n);
    
    // Add delete button for custom elements
    const isCustom = customElements.includes(el);
    if (isCustom) {
      const del = document.createElement('span');
      del.className = 'el-delete';
      del.textContent = '×';
      del.title = 'Delete custom element';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteCustomElement(el.sym);
      });
      b.appendChild(del);
      b.classList.add('custom-element');
    }
    
    b.addEventListener('click', () => spawnFromPool(el));
    wrap.appendChild(b);
  }
  renderPoolNames();
  if (!buildPool._listenersAttached) {
    buildPool._listenersAttached = true;
    const search = document.getElementById('pool-search');
    search.addEventListener('input', filterPool);
    search.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      const first = [...wrap.children].find(c => c.style.display !== 'none');
      if (first) first.click();
    });
    const viewBtn = document.getElementById('pool-view');
    viewBtn.addEventListener('click', () => {
      const listOn = !wrap.hidden;
      wrap.hidden = listOn;
      document.getElementById('ptable').hidden = !listOn;
      viewBtn.textContent = listOn ? t('pool.viewList') : t('pool.viewTable');
    });
  }
}

function rebuildPool() {
  const wrap = document.getElementById('pool-list');
  wrap.innerHTML = '';
  buildPool();
}

function filterPool() {
  const q = document.getElementById('pool-search').value.trim().toLowerCase();
  for (const c of document.querySelectorAll('#pool-list .el-chip'))
    c.style.display = !q || c.dataset.search.includes(q) ? '' : 'none';
}

function spawnFromPool(el) {
  spawnAtom(el);
  if (document.body.classList.contains('mobile')) closeMobileSheets();
}

function fmtCharge(ch) { return ch > 0 ? `+${ch}` : `${ch}`; }

function currentComp() {
  if (selectedId === null || !atoms.has(selectedId)) return null;
  const comp = lastComps.find(c => c.atoms.includes(selectedId));
  if (!comp) return null;
  return { comp, an: analyses[lastComps.indexOf(comp)] };
}

function updateInspector() {
  updateStoichPanel();
  const sel = document.getElementById('sel-info');
  const mol = document.getElementById('mol-info');
  const warn = document.getElementById('mol-warn');
  const bohrBtn = document.getElementById('bohr-toggle');
  const bohrContainer = document.getElementById('bohr-container');
  const cur = currentComp();
  if (!cur) {
    sel.innerHTML = `<span class="muted">${t('sel.empty')}</span>`;
    mol.innerHTML = `<span class="muted">${t('mol.empty')}</span>`;
    warn.style.display = 'none';
    bohrBtn.hidden = true;
    bohrContainer.hidden = true;
    bohrActive = false;
    bohrBtn.classList.remove('active');
    if (bohrAnimFrame) cancelAnimationFrame(bohrAnimFrame);
    return;
  }
  const at = atoms.get(selectedId);
  sel.innerHTML = `<b>${at.el.sym}</b> — ${elName(at.el)}<br />
    <span class="muted">${t('sel.stats', { cat: catLabel(at.el.cat), mass: at.el.mass, en: at.el.en ?? '?', max: at.el.maxBonds })}</span>`;
  bohrBtn.hidden = false;
  bohrContainer.hidden = !bohrActive;

  if (bohrActive) {
    drawBohrModel(at.el);
    updateBohrStats(at.el);
  }

  const { comp, an } = cur;
  if (comp.bonds.length === 0) {
    mol.innerHTML = `<span class="muted">${t('mol.freeAtom')}</span>`;
    warn.style.display = 'none';
    return;
  }
  const name = safeName(comp, an);
  const type = classifyMolecule(an.formula, an.charge, comp);
  const fHtml = `${prettyFormula(an.displayFormula || an.formula)}<span class="muted">${formulaWithCharge('', an.charge)}</span>`;
  mol.innerHTML = `<div class="mol-formula">${fHtml}</div><div id="mol-name">${name || t('mol.unnamed')}<span class="mol-type">${type.label}</span></div>
    <span class="muted">${t('mol.stats', { a: comp.atoms.length, b: comp.bonds.length })}</span>`;
  if (!an.feasible) {
    warn.style.display = 'block';
    warn.textContent = trReason(an.reason) || t('chem.lewis.charge');
  } else {
    // A received ionic electron that cannot pair (odd pool) means the
    // transfer is only partial — surface it instead of showing a silent +1.
    const partial = comp.atoms.find(id => {
      const p = an.per.get(id);
      if (!p || p.isMetal || !p.bonded || !p.ionU) return false;
      const V = atoms.get(id).el.valenceElectrons;
      return (V + p.ionU - p.covSum) % 2 !== 0;
    });
    if (partial) {
      warn.style.display = 'block';
      warn.textContent = t('chem.partialIonic', { sym: elName(atoms.get(partial).el) });
    } else {
      warn.style.display = 'none';
    }
  }
}

// ── Stoichiometry panel ──

const stoichBody = document.getElementById('stoich-body');
const stoichEmpty = document.getElementById('stoich-empty');
const stoichFormulaEl = document.getElementById('stoich-formula');
const stoichMolarEl = document.getElementById('stoich-molar');
const stoichCompEl = document.getElementById('stoich-comp');
const stoichNoteEl = document.getElementById('stoich-note');
const stoichG = document.getElementById('stoich-g');
const stoichMol = document.getElementById('stoich-mol');
const stoichN = document.getElementById('stoich-n');
let stoichFormula = null;

function updateStoichPanel() {
  const cur = currentComp();
  if (!cur) {
    stoichFormula = null;
    stoichBody.hidden = true;
    stoichEmpty.style.display = '';
    return;
  }
  const at = atoms.get(selectedId);
  let formula, fHtml, note = '';
  if (cur.comp.bonds.length === 0) {
    formula = at.el.sym;
    fHtml = prettyFormula(formula);
    note = t('stoich.freeAtom');
  } else {
    const { an } = cur;
    formula = an.formula;
    fHtml = `${prettyFormula(an.displayFormula || an.formula)}<span class="muted">${formulaWithCharge('', an.charge)}</span>`;
  }
  const changed = formula !== stoichFormula;
  stoichFormula = formula;
  const M = molarMass(formula);
  stoichEmpty.style.display = 'none';
  stoichBody.hidden = false;
  stoichFormulaEl.innerHTML = fHtml;
  stoichMolarEl.textContent = M === null ? '—' : t('stoich.molar', { m: fmtAmount(M) });
  const comp = compositionOf(formula);
  stoichCompEl.innerHTML = (comp ? comp.rows : []).map(r =>
    `<tr><td><b>${r.sym}</b> ${elName(r)}</td><td>${r.count}</td><td>${fmtAmount(r.atomicMass)}</td><td>${fmtAmount(r.subtotal)}</td><td>${fmtAmount(r.pct)}%</td></tr>`
  ).join('');
  stoichNoteEl.textContent = note;
  if (changed && M !== null) {
    stoichMol.value = '1';
    stoichG.value = fmtAmount(M);
    stoichN.value = fmtAmount(AVOGADRO);
  }
}

function initStoichPanel() {
  const num = (el) => { const v = parseFloat(el.value); return isFinite(v) && v >= 0 ? v : null; };
  stoichMol.addEventListener('input', () => {
    const M = molarMass(stoichFormula);
    const mol = num(stoichMol);
    if (M === null || mol === null) return;
    stoichG.value = fmtAmount(mol * M);
    stoichN.value = fmtAmount(mol * AVOGADRO);
  });
  stoichG.addEventListener('input', () => {
    const M = molarMass(stoichFormula);
    const g = num(stoichG);
    if (M === null || g === null) return;
    const mol = g / M;
    stoichMol.value = fmtAmount(mol);
    stoichN.value = fmtAmount(mol * AVOGADRO);
  });
  stoichN.addEventListener('input', () => {
    const M = molarMass(stoichFormula);
    const n = num(stoichN);
    if (M === null || n === null) return;
    const mol = n / AVOGADRO;
    stoichMol.value = fmtAmount(mol);
    stoichG.value = fmtAmount(mol * M);
  });
}

// ── Bohr Atom Model ──

const SHELL_NAMES = ['K', 'L', 'M', 'N', 'O', 'P', 'Q'];
const SHELL_CAP = [2, 8, 18, 32, 32, 18, 8];

function electronShells(z) {
  const shells = [];
  let remaining = z;
  for (let i = 0; i < SHELL_CAP.length && remaining > 0; i++) {
    const n = Math.min(remaining, SHELL_CAP[i]);
    shells.push(n);
    remaining -= n;
  }
  return shells;
}

let bohrActive = false;
let bohrAnimFrame = null;
let bohrAngle = 0;

function drawBohrModel(el) {
  const canvas = document.getElementById('bohr-canvas');
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const cx = w / 2, cy = h / 2;

  ctx.clearRect(0, 0, w, h);

  const shells = electronShells(el.z);
  const neutrons = Math.round(el.mass) - el.z;
  const maxR = Math.min(cx, cy) - 20;
  const shellR = shells.map((_, i) => 30 + (i * (maxR - 30) / Math.max(shells.length - 1, 1)));

  // Draw shell orbits
  ctx.strokeStyle = 'rgba(88, 166, 255, 0.15)';
  ctx.lineWidth = 1;
  for (const r of shellR) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Draw nucleus
  const nucleusR = 16;
  const grad = ctx.createRadialGradient(cx - 3, cy - 3, 2, cx, cy, nucleusR);
  grad.addColorStop(0, '#ff6b6b');
  grad.addColorStop(0.5, '#ee5a24');
  grad.addColorStop(1, '#c0392b');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, nucleusR, 0, Math.PI * 2);
  ctx.fill();

  // Nucleus label
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${el.z}p`, cx, cy - 5);
  ctx.font = '9px system-ui';
  ctx.fillText(`${neutrons}n`, cx, cy + 6);

  // Draw electrons on shells
  for (let s = 0; s < shells.length; s++) {
    const count = shells[s];
    const r = shellR[s];
    const speed = (0.3 + s * 0.15) * (s % 2 === 0 ? 1 : -1);

    for (let e = 0; e < count; e++) {
      const angle = bohrAngle * speed + (e * Math.PI * 2 / count);
      const ex = cx + Math.cos(angle) * r;
      const ey = cy + Math.sin(angle) * r;

      // Electron glow
      const eGrad = ctx.createRadialGradient(ex, ey, 0, ex, ey, 6);
      eGrad.addColorStop(0, 'rgba(88, 166, 255, 0.8)');
      eGrad.addColorStop(1, 'rgba(88, 166, 255, 0)');
      ctx.fillStyle = eGrad;
      ctx.beginPath();
      ctx.arc(ex, ey, 6, 0, Math.PI * 2);
      ctx.fill();

      // Electron dot
      ctx.fillStyle = '#58a6ff';
      ctx.beginPath();
      ctx.arc(ex, ey, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Shell labels
  ctx.fillStyle = 'rgba(139, 148, 158, 0.6)';
  ctx.font = '9px system-ui';
  ctx.textAlign = 'left';
  for (let s = 0; s < shells.length; s++) {
    ctx.fillText(`${SHELL_NAMES[s]}: ${shells[s]}`, cx + shellR[s] + 4, cy - 4);
  }
}

function animateBohr() {
  if (!bohrActive) return;
  bohrAngle += 0.02;
  const at = atoms.get(selectedId);
  if (at) drawBohrModel(at.el);
  bohrAnimFrame = requestAnimationFrame(animateBohr);
}

function updateBohrStats(el) {
  const stats = document.getElementById('bohr-stats');
  const shells = electronShells(el.z);
  const neutrons = Math.round(el.mass) - el.z;

  let shellHtml = shells.map((n, i) =>
    `<span class="shell-badge">${SHELL_NAMES[i]}: ${n}e⁻</span>`
  ).join('');

  stats.innerHTML = `
    <div><span class="stat-label">${t('bohr.atomic')}</span><br><span class="stat-value">${el.z}</span></div>
    <div><span class="stat-label">${t('bohr.mass')}</span><br><span class="stat-value">${el.mass}</span></div>
    <div><span class="stat-label">${t('bohr.protons')}</span><br><span class="stat-value">${el.z}</span></div>
    <div><span class="stat-label">${t('bohr.neutrons')}</span><br><span class="stat-value">${neutrons}</span></div>
    <div><span class="stat-label">${t('bohr.electrons')}</span><br><span class="stat-value">${el.z}</span></div>
    <div><span class="stat-label">${t('bohr.valence')}</span><br><span class="stat-value">${el.valenceElectrons}</span></div>
    <div class="shell-row"><span class="stat-label">${t('bohr.shells')}</span> ${shellHtml}</div>
  `;
}

function toggleBohr() {
  bohrActive = !bohrActive;
  const btn = document.getElementById('bohr-toggle');
  const container = document.getElementById('bohr-container');
  btn.classList.toggle('active', bohrActive);

  if (bohrActive) {
    container.hidden = false;
    const at = atoms.get(selectedId);
    if (at) {
      drawBohrModel(at.el);
      updateBohrStats(at.el);
      animateBohr();
    }
  } else {
    container.hidden = true;
    if (bohrAnimFrame) cancelAnimationFrame(bohrAnimFrame);
  }
}

document.getElementById('bohr-toggle').addEventListener('click', toggleBohr);

function updateMoleculeList() {
  const list = document.getElementById('mol-list');
  list.textContent = '';
  if (!lastComps.length) {
    list.textContent = t('list.empty');
    return;
  }
  let shown = 0;
  lastComps.forEach((comp, i) => {
    if (comp.bonds.length === 0) return;
    shown++;
    const an = analyses[i];
    const row = document.createElement('div');
    row.className = 'mol-row' + (selectedId !== null && comp.atoms.includes(selectedId) ? ' active' : '');
    const nm = document.createElement('span');
    nm.className = 'm-name';
    nm.textContent = safeName(comp, an) || prettyFormula(an.formula);
    const f = document.createElement('span');
    f.className = 'm-f';
    f.textContent = prettyFormula(an.displayFormula || an.formula) + formulaWithCharge('', an.charge);
    row.append(nm, f);
    row.addEventListener('click', () => selectAtom(comp.atoms[0]));

    const isos = isomerTemplates(an.formula);
    if (isos.length > 0) {
      const btn = document.createElement('button');
      btn.className = 'isomer-btn';
      btn.textContent = isVi() ? 'Đồng phân' : 'Isomers';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openIsomerDrawer(i);
      });
      row.appendChild(btn);
    }

    list.appendChild(row);
  });
  if (!shown) list.textContent = t('list.empty');
}

let isomerDrawerCompIdx = null;

function openIsomerDrawer(compIdx) {
  isomerDrawerCompIdx = compIdx;
  const an = analyses[compIdx];
  const drawer = document.getElementById('isomer-drawer');
  const title = document.getElementById('isomer-drawer-title');
  const listEl = document.getElementById('isomer-drawer-list');

  title.textContent = (isVi() ? 'Đồng phân của ' : 'Isomers of ') + prettyFormula(an.displayFormula || an.formula);
  listEl.textContent = '';

  const isos = isomerTemplates(an.formula);
  const currentFp = an.fingerprint;
  const curDisplay = an.displayFormula || an.formula;

  const fps = isos.map(iso => structuralFingerprint(iso.tpl.atoms, iso.tpl.bonds, iso.tpl.atoms.map((_, i) => i)));
  const exact = isos.findIndex((iso, k) => fps[k] === currentFp && (iso.displayFormula || an.formula) === curDisplay);
  const activeSet = new Set(exact >= 0
    ? [exact]
    : isos.map((_, k) => fps[k] === currentFp ? k : -1).filter(k => k >= 0));

  for (let k = 0; k < isos.length; k++) {
    const iso = isos[k];
    const item = document.createElement('div');
    item.className = 'isomer-item';
    if (activeSet.has(k)) item.classList.add('active');

    const info = document.createElement('div');
    info.className = 'isomer-item-info';
    const nameEl = document.createElement('div');
    nameEl.className = 'isomer-item-name';
    nameEl.textContent = iso.displayName || iso.key;
    const formulaEl = document.createElement('div');
    formulaEl.className = 'isomer-item-formula';
    formulaEl.textContent = iso.displayFormula || an.formula;
    info.append(nameEl, formulaEl);

    const cls = classifyMolecule(an.formula, iso.tpl.charge || 0, null);
    const badge = document.createElement('span');
    badge.className = 'isomer-badge ' + (cls.key || '');
    badge.textContent = cls.label;

    item.append(info, badge);
    item.addEventListener('click', () => swapToIsomer(compIdx, iso));
    listEl.appendChild(item);
  }

  if (isos.truncated) {
    const note = document.createElement('div');
    note.className = 'isomer-more-note';
    note.textContent = t('iso.more', { n: isos.length });
    listEl.appendChild(note);
  }

  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');

  const search = document.getElementById('isomer-search');
  search.value = '';
  filterIsomers('');
}

function closeIsomerDrawer() {
  const drawer = document.getElementById('isomer-drawer');
  drawer.classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');
  isomerDrawerCompIdx = null;
}

// Build a molecule from a template ({atoms:[sym], bonds:[[ai,bi,order,ionic]], charge})
// centered on (cx, cy, cz), using BFS layout with proper bond lengths.
// Returns the new atom ids (empty if no known element in tpl).
function buildMoleculeAt(tpl, cx, cy, cz) {
  const idMap = new Map();
  const newAtoms = [];
  const newAtomIds = [];
  for (let i = 0; i < tpl.atoms.length; i++) {
    const sym = tpl.atoms[i];
    const el = elementBySym(sym);
    if (!el) continue;
    const id = nextId++;
    idMap.set(i, id);
    newAtoms.push({ id, el, idx: i });
    newAtomIds.push(id);
  }
  if (!newAtoms.length) return { ids: [] };

  // Build adjacency list for the new structure
  const adjacency = new Map();
  for (const a of newAtoms) adjacency.set(a.id, []);
  for (const b of tpl.bonds) {
    const [ai, bi, order, ionic] = b;
    const aId = idMap.get(ai);
    const bId = idMap.get(bi);
    if (aId == null || bId == null) continue;
    adjacency.get(aId).push({ neighbor: bId, order });
    adjacency.get(bId).push({ neighbor: aId, order });
  }

  // Position atoms using BFS from first atom
  const positions = new Map();
  const visited = new Set();
  const root = newAtoms[0].id;
  positions.set(root, { x: cx, y: cy, z: cz });
  visited.add(root);

  const queue = [{ id: root, parentDir: null }];
  while (queue.length) {
    const { id, parentDir } = queue.shift();
    const neighbors = adjacency.get(id);
    if (!neighbors || neighbors.length === 0) continue;

    // Calculate directions for children
    const childCount = neighbors.filter(n => !visited.has(n.neighbor)).length;
    if (childCount === 0) continue;

    // Use Thomson-like distribution for directions
    const dirs = calculateDirections(childCount, parentDir);

    let dirIdx = 0;
    for (const { neighbor } of neighbors) {
      if (visited.has(neighbor)) continue;

      const atom = newAtoms.find(a => a.id === id);
      const neighborAtom = newAtoms.find(a => a.id === neighbor);
      const bl = bondLength(atom.el, neighborAtom.el, false);

      const dir = dirs[dirIdx++];
      const pos = positions.get(id);
      positions.set(neighbor, {
        x: pos.x + dir.x * bl,
        y: pos.y + dir.y * bl,
        z: pos.z + dir.z * bl
      });

      visited.add(neighbor);
      queue.push({ id: neighbor, parentDir: { x: -dir.x, y: -dir.y, z: -dir.z } });
    }
  }

  // Create atoms with calculated positions
  for (const a of newAtoms) {
    const pos = positions.get(a.id) || { x: cx, y: cy, z: cz };
    atoms.set(a.id, { id: a.id, el: a.el, pos });
  }

  // Create bonds
  for (const b of tpl.bonds) {
    const [ai, bi, order, ionic] = b;
    const aId = idMap.get(ai);
    const bId = idMap.get(bi);
    if (aId == null || bId == null) continue;
    const bid = nextId++;
    bonds.set(bid, { id: bid, a: aId, b: bId, order: order || 1, ionic: !!ionic });
  }

  return { ids: newAtomIds };
}

function swapToIsomer(compIdx, iso) {
  const comp = lastComps[compIdx];
  if (!comp) return;

  let cx = 0, cy = 0, cz = 0;
  for (const id of comp.atoms) {
    const at = atoms.get(id);
    cx += at.pos.x; cy += at.pos.y; cz += at.pos.z;
  }
  const n = comp.atoms.length;
  cx /= n; cy /= n; cz /= n;

  for (const id of comp.atoms) {
    atoms.delete(id);
    for (const [bid, b] of bonds) {
      if (b.a === id || b.b === id) bonds.delete(bid);
    }
  }

  const { ids: newAtomIds } = buildMoleculeAt(iso.tpl, cx, cy, cz);

  const key = compKey({ atoms: newAtomIds, bonds: [] });
  const prevKey = compKey(comp);
  if (iso.tpl.charge) overrides.set(key, iso.tpl.charge);
  else if (overrides.has(prevKey)) overrides.set(key, overrides.get(prevKey));
  if (iso.displayFormula) isoSel.set(key, iso.displayFormula);

  closeIsomerDrawer();
  reanalyze(new Set(newAtomIds));
}

// Calculate direction vectors for distributing children around a parent
function calculateDirections(count, parentDir) {
  const dirs = [];

  if (count === 1) {
    // Single child - opposite to parent or arbitrary direction
    if (parentDir) {
      dirs.push({ x: -parentDir.x, y: -parentDir.y, z: -parentDir.z });
    } else {
      dirs.push({ x: 1, y: 0, z: 0 });
    }
  } else if (count === 2) {
    // Two children - linear arrangement
    if (parentDir) {
      // Perpendicular to parent direction
      const perp = findPerpendicular(parentDir);
      dirs.push(perp);
      dirs.push({ x: -perp.x, y: -perp.y, z: -perp.z });
    } else {
      dirs.push({ x: 1, y: 0, z: 0 });
      dirs.push({ x: -1, y: 0, z: 0 });
    }
  } else if (count === 3) {
    // Three children - trigonal planar
    if (parentDir) {
      // Arrange in plane perpendicular to parent
      const perp1 = findPerpendicular(parentDir);
      const perp2 = cross(parentDir, perp1);
      for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 2;
        dirs.push({
          x: perp1.x * Math.cos(angle) + perp2.x * Math.sin(angle),
          y: perp1.y * Math.cos(angle) + perp2.y * Math.sin(angle),
          z: perp1.z * Math.cos(angle) + perp2.z * Math.sin(angle)
        });
      }
    } else {
      for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 2;
        dirs.push({ x: Math.cos(angle), y: Math.sin(angle), z: 0 });
      }
    }
  } else if (count === 4) {
    // Four children - tetrahedral
    const tetrahedral = [
      { x: 1, y: 1, z: 1 },
      { x: 1, y: -1, z: -1 },
      { x: -1, y: 1, z: -1 },
      { x: -1, y: -1, z: 1 }
    ];
    for (const d of tetrahedral) {
      const len = Math.sqrt(d.x * d.x + d.y * d.y + d.z * d.z);
      dirs.push({ x: d.x / len, y: d.y / len, z: d.z / len });
    }
  } else {
    // Generic case - distribute on sphere
    for (let i = 0; i < count; i++) {
      const phi = Math.acos(1 - 2 * (i + 0.5) / count);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      dirs.push({
        x: Math.sin(phi) * Math.cos(theta),
        y: Math.sin(phi) * Math.sin(theta),
        z: Math.cos(phi)
      });
    }
  }

  return dirs;
}

function findPerpendicular(v) {
  // Find a vector perpendicular to v
  if (Math.abs(v.x) < 0.9) {
    return normalize(cross(v, { x: 1, y: 0, z: 0 }));
  } else {
    return normalize(cross(v, { x: 0, y: 1, z: 0 }));
  }
}

function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}

function normalize(v) {
  const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (len === 0) return { x: 0, y: 0, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

document.getElementById('isomer-drawer-close').addEventListener('click', closeIsomerDrawer);
document.getElementById('isomer-search').addEventListener('input', e => filterIsomers(e.target.value));

function filterIsomers(query) {
  const listEl = document.getElementById('isomer-drawer-list');
  if (!listEl) return;
  const q = query.trim().toLowerCase();
  let visible = 0;
  for (const item of listEl.children) {
    if (!item.classList.contains('isomer-item')) continue;
    const match = !q || item.textContent.toLowerCase().includes(q);
    item.style.display = match ? '' : 'none';
    if (match) visible++;
  }
  const note = listEl.querySelector('.isomer-more-note');
  if (note) note.style.display = q ? 'none' : '';
  let none = document.getElementById('isomer-no-match');
  if (!none) {
    none = document.createElement('div');
    none.id = 'isomer-no-match';
    none.className = 'isomer-more-note';
    listEl.appendChild(none);
  }
  none.textContent = t('iso.none');
  none.style.display = visible === 0 && listEl.querySelector('.isomer-item') ? '' : 'none';
}

function chDisplay(c) {
  return prettyFormula(c.formula) + formulaWithCharge('', c.charge ?? 0);
}

function chName(c) { return (isVi() && c.vi) ? c.vi : (c.name || chDisplay(c)); }

function updateChallengeList() {
  const list = document.getElementById('ch-list');
  const prog = document.getElementById('ch-progress');
  prog.textContent = `${completed.size} / ${CHALLENGE_LIST.length}`;
  list.textContent = '';
  for (const c of CHALLENGE_LIST) {
    const row = document.createElement('div');
    row.className = 'ch' + (completed.has(`${c.formula}|${c.charge ?? 0}`) ? ' done' : '');
    const f = document.createElement('span');
    f.className = 'ch-f';
    f.textContent = chDisplay(c);
    const n = document.createElement('span');
    n.className = 'ch-n';
    n.textContent = chName(c);
    row.append(f, n);
    list.appendChild(row);
  }
}

function checkChallenges() {
  for (const c of CHALLENGE_LIST) {
    const key = `${c.formula}|${c.charge ?? 0}`;
    if (completed.has(key)) continue;
    const found = lastComps.some((comp, i) =>
      analyses[i].feasible &&
      (analyses[i].displayFormula === c.formula || analyses[i].formula === c.formula) &&
      (analyses[i].charge ?? 0) === (c.charge ?? 0));
    if (found) {
      completed.add(key);
      toast(t('toast.challenge', { name: chName(c) }));
      updateChallengeList();
    }
  }
}

// ---------------------------------------------------------------------------
// Status / toast
// ---------------------------------------------------------------------------
let statusTimer = null;
function status(msg, cls = 'info') {
  const el = document.getElementById('status-text');
  el.textContent = msg;
  el.className = cls;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { el.textContent = ''; }, 6000);
}

let toastTimer = null;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

// ---------------------------------------------------------------------------
// Selection + charge controls
// ---------------------------------------------------------------------------
function selectAtom(id) {
  selectedId = id;
  updateInspector();
  updateMoleculeList();
  updateDeleteBtn();
  invalidate();
}

function nudgeCharge(d) {
  const cur = currentComp();
  if (!cur || cur.comp.bonds.length === 0) { status(t('status.selectFirst')); return; }
  const key = compKey(cur.comp);
  const v = (overrides.has(key) ? overrides.get(key) : cur.an.charge) + d;
  if (Math.abs(v) > 6) { status(t('status.chargeLimit'), 'err'); return; }
  overrides.set(key, v);
  pushUndo({ type: 'snapshot', atoms: [...atoms.values()].map(snapAtom), bonds: [...bonds.values()].map(b => ({ ...b })), overrides: [...overrides], iso: [...isoSel], nextId: nextId });
  reanalyze();
  status(t('status.chargeSet', { v: fmtCharge(v) }), 'ok');
}

// ---------------------------------------------------------------------------
// Save / load
// ---------------------------------------------------------------------------
let saveTimer = null;
function save(immediate = false) {
  clearTimeout(saveTimer);
  const doSave = () => {
    try {
      localStorage.setItem('mol3d.v1', JSON.stringify({
        atoms: [...atoms.values()].map(a => ({ id: a.id, z: a.el.z, pos: a.pos })),
        bonds: [...bonds.values()].map(b => ({ id: b.id, a: b.a, b: b.b, order: b.order, ionic: b.ionic })),
        nextId,
        overrides: [...overrides],
        isoF: [...isoSel],
        fc: [...completed],
      }));
    } catch { /* storage full or unavailable: session-only */ }
  };
  if (immediate) {
    doSave();
  } else {
    saveTimer = setTimeout(doSave, 300);
  }
}

function load() {
  let data;
  try { data = JSON.parse(localStorage.getItem('mol3d.v1') || 'null'); } catch { data = null; }
  if (!data || !Array.isArray(data.atoms)) return;
  console.log('[LOAD] Loading', data.atoms.length, 'atoms and', (data.bonds || []).length, 'bonds');
  for (const a of data.atoms) {
    if (!a || !Number.isInteger(a.id) || !a.pos) continue;
    const el = ELEMENTS.find(e => e.z === a.z);
    if (!el) continue;
    atoms.set(a.id, { id: a.id, el, pos: { x: +a.pos.x || 0, y: +a.pos.y || 0, z: +a.pos.z || 0 } });
  }
  for (const b of Array.isArray(data.bonds) ? data.bonds : []) {
    if (b && Number.isInteger(b.id) && atoms.has(b.a) && atoms.has(b.b)) {
      bonds.set(b.id, { ...b });
      console.log('[LOAD] Restored bond', b.id, 'between atoms', b.a, 'and', b.b, 'order:', b.order);
    } else {
      console.warn('[LOAD] Failed to restore bond', b, '- atoms exist?', atoms.has(b?.a), atoms.has(b?.b));
    }
  }
  console.log('[LOAD] After load:', atoms.size, 'atoms,', bonds.size, 'bonds');
  // Track radioactive atoms from loaded state
  const now = performance.now();
  for (const [id, atom] of atoms) {
    trackRadioactiveAtom(id, atom, now);
  }
  for (const [k, v] of Array.isArray(data.overrides) ? data.overrides : []) {
    if (typeof k === 'string' && Number.isInteger(v)) overrides.set(k, v);
  }
  for (const [k, v] of Array.isArray(data.isoF) ? data.isoF : []) {
    if (typeof k === 'string' && typeof v === 'string') isoSel.set(k, v);
  }
  for (const k of Array.isArray(data.fc) ? data.fc : []) if (typeof k === 'string') completed.add(k);
  nextId = Number.isInteger(data.nextId) && data.nextId > 0
    ? data.nextId
    : Math.max(0, ...atoms.keys(), ...bonds.keys()) + 1;
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------
document.getElementById('btn-undo').addEventListener('click', undo);
document.getElementById('btn-delete').addEventListener('click', () => {
  if (selectedId !== null) removeAtom(selectedId);
});
document.getElementById('btn-duplicate').addEventListener('click', duplicateMolecule);
document.getElementById('btn-clear').addEventListener('click', clearAll);

const btnMenu = document.getElementById('btn-menu');
const menuDropdown = document.getElementById('menu-dropdown');
btnMenu.addEventListener('click', (e) => {
  e.stopPropagation();
  const expanded = btnMenu.getAttribute('aria-expanded') === 'true';
  btnMenu.setAttribute('aria-expanded', !expanded);
  menuDropdown.hidden = expanded;
});
document.addEventListener('click', e => {
  if (!btnMenu.contains(e.target) && !menuDropdown.contains(e.target)) {
    btnMenu.setAttribute('aria-expanded', 'false');
    menuDropdown.hidden = true;
  }
});

// ── Credits Modal ──
{
  const modal = document.getElementById('credits-modal');
  const closeBtn = document.getElementById('credits-close');
  const backdrop = modal.querySelector('.credits-backdrop');
  const openCredits = () => {
    modal.hidden = false;
    btnMenu.setAttribute('aria-expanded', 'false');
    menuDropdown.hidden = true;
  };
  const closeCredits = () => { modal.hidden = true; };
  document.getElementById('btn-credits').addEventListener('click', openCredits);
  closeBtn.addEventListener('click', closeCredits);
  backdrop.addEventListener('click', closeCredits);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !modal.hidden) closeCredits();
  });
}

// ── Mobile Console UI ──
const mobileConsole = document.getElementById('mobile-console');
const consoleOutput = document.getElementById('console-output');
const consoleInput = document.getElementById('console-input');
const consoleHistory = [];
let consoleHistoryIndex = -1;
let consoleSuggestions = [];
let suggestionIndex = -1;

const suggestionsDiv = document.createElement('div');
suggestionsDiv.className = 'console-suggestions';
suggestionsDiv.hidden = true;
consoleInput.parentElement.style.position = 'relative';
consoleInput.parentElement.insertBefore(suggestionsDiv, consoleInput);

const availableCommands = [
  '__mol3d.hacks.safeMode(true)',
  '__mol3d.hacks.safeMode(false)',
  '__mol3d.hacks.godMode()',
  '__mol3d.hacks.mortalMode()',
  '__mol3d.hacks.chaos(',
  '__mol3d.hacks.party()',
  '__mol3d.hacks.matrix()',
  '__mol3d.hacks.rainbow()',
  '__mol3d.hacks.disco()',
  '__mol3d.hacks.giant()',
  '__mol3d.hacks.tiny()',
  '__mol3d.hacks.explosion(',
  '__mol3d.hacks.implode()',
  '__mol3d.hacks.clone(',
  '__mol3d.hacks.dna(',
  '__mol3d.hacks.firework(',
  '__mol3d.hacks.blackHole()',
  '__mol3d.hacks.antiGravity()',
  '__mol3d.hacks.quantum()',
  '__mol3d.hacks.unlockAll()',
  '__mol3d.hacks.spawnMolecule(',
  '__mol3d.hacks.mirror()',
  '__mol3d.hacks.slowmo()',
  '__mol3d.hacks.fastforward()',
  '__mol3d.hacks.normalSpeed()',
  '__mol3d.spawnAtom(',
  '__mol3d.clearAll()',
  '__mol3d.undo()',
  '__mol3d.discoveries()',
];

function updateSuggestions(input) {
  if (!input.trim()) {
    suggestionsDiv.hidden = true;
    return;
  }
  const matches = availableCommands.filter(cmd => cmd.toLowerCase().includes(input.toLowerCase()));
  if (matches.length === 0) {
    suggestionsDiv.hidden = true;
    return;
  }
  suggestionsDiv.innerHTML = '';
  matches.slice(0, 5).forEach((match, idx) => {
    const item = document.createElement('div');
    item.className = 'suggestion-item' + (idx === suggestionIndex ? ' active' : '');
    item.textContent = match;
    item.addEventListener('click', () => {
      consoleInput.value = match;
      suggestionsDiv.hidden = true;
      consoleInput.focus();
    });
    suggestionsDiv.appendChild(item);
  });
  suggestionsDiv.hidden = false;
}

const originalConsole = {
  log: console.log.bind(console),
  error: console.error.bind(console),
  warn: console.warn.bind(console),
  info: console.info.bind(console),
};

function addConsoleEntry(type, args) {
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  const text = Array.from(args).map(arg => {
    if (typeof arg === 'object') {
      try { return JSON.stringify(arg, null, 2); } catch { return String(arg); }
    }
    return String(arg);
  }).join(' ');
  entry.textContent = text;
  consoleOutput.appendChild(entry);
  consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

console.log = function(...args) {
  originalConsole.log(...args);
  addConsoleEntry('log', args);
};

console.error = function(...args) {
  originalConsole.error(...args);
  addConsoleEntry('error', args);
};

console.warn = function(...args) {
  originalConsole.warn(...args);
  addConsoleEntry('warn', args);
};

console.info = function(...args) {
  originalConsole.info(...args);
  addConsoleEntry('info', args);
};

function executeConsoleCommand(cmd) {
  if (!cmd.trim()) return;
  consoleHistory.push(cmd);
  consoleHistoryIndex = consoleHistory.length;
  addConsoleEntry('info', [`> ${cmd}`]);
  try {
    const fn = new Function('return ' + cmd);
    const result = fn();
    if (result !== undefined) {
      addConsoleEntry('result', [result]);
    }
  } catch (e) {
    addConsoleEntry('error', [e.message]);
  }
}

document.getElementById('btn-console').addEventListener('click', () => {
  mobileConsole.hidden = !mobileConsole.hidden;
  if (!mobileConsole.hidden) {
    consoleInput.focus();
    btnMenu.setAttribute('aria-expanded', 'false');
    menuDropdown.hidden = true;
  }
});

document.getElementById('console-close').addEventListener('click', () => {
  mobileConsole.hidden = true;
});

document.getElementById('console-clear').addEventListener('click', () => {
  consoleOutput.innerHTML = '';
});

document.getElementById('console-run').addEventListener('click', () => {
  executeConsoleCommand(consoleInput.value);
  consoleInput.value = '';
});

consoleInput.addEventListener('input', () => {
  suggestionIndex = -1;
  updateSuggestions(consoleInput.value);
});

consoleInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    executeConsoleCommand(consoleInput.value);
    consoleInput.value = '';
    suggestionsDiv.hidden = true;
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (!suggestionsDiv.hidden && suggestionsDiv.children.length > 0) {
      suggestionIndex = Math.max(0, suggestionIndex - 1);
      updateSuggestions(consoleInput.value);
    } else if (consoleHistoryIndex > 0) {
      consoleHistoryIndex--;
      consoleInput.value = consoleHistory[consoleHistoryIndex];
    }
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (!suggestionsDiv.hidden && suggestionsDiv.children.length > 0) {
      suggestionIndex = Math.min(suggestionsDiv.children.length - 1, suggestionIndex + 1);
      updateSuggestions(consoleInput.value);
    } else if (consoleHistoryIndex < consoleHistory.length - 1) {
      consoleHistoryIndex++;
      consoleInput.value = consoleHistory[consoleHistoryIndex];
    } else {
      consoleHistoryIndex = consoleHistory.length;
      consoleInput.value = '';
    }
  } else if (e.key === 'Tab') {
    e.preventDefault();
    if (!suggestionsDiv.hidden && suggestionsDiv.children.length > 0) {
      const idx = suggestionIndex >= 0 ? suggestionIndex : 0;
      consoleInput.value = suggestionsDiv.children[idx].textContent;
      suggestionsDiv.hidden = true;
    }
  } else if (e.key === 'Escape') {
    suggestionsDiv.hidden = true;
  }
});

document.getElementById('btn-fc').addEventListener('click', () => {
  fcVisible = !fcVisible;
  document.getElementById('btn-fc').classList.toggle('on', fcVisible);
  invalidate();
});
document.getElementById('btn-mayhem').addEventListener('click', () => {
  mayhemMode = !mayhemMode;
  document.getElementById('btn-mayhem').classList.toggle('on', mayhemMode);
  document.getElementById('btn-import').hidden = !mayhemMode;
  rebuildPool();
  status(mayhemMode ? 'Mayhem mode ON — exotic elements unlocked!' : 'Mayhem mode OFF');
});

// Time control buttons
document.getElementById('btn-time-freeze').addEventListener('click', () => {
  toggleFreeze();
  status(timeFrozen ? '⏸ Time frozen' : '▶️ Time resumed');
});

document.getElementById('btn-time-speed').addEventListener('click', () => {
  cycleSpeed();
  status(`⏱ Time speed: ${timeSpeed}×`);
});

document.getElementById('btn-time-rewind').addEventListener('click', () => {
  const speeds = [100, 50, 10, 5, 2, 1];
  const idx = speeds.indexOf(timeSpeed);
  if (idx < speeds.length - 1) {
    timeSpeed = speeds[idx + 1];
  } else {
    timeSpeed = 1;
  }
  const btn = document.getElementById('btn-time-speed');
  if (btn) btn.textContent = `${timeSpeed}×`;
  const label = document.getElementById('time-speed-label');
  if (label) label.textContent = `${timeSpeed}×`;
  status(`⏪ Speed: ${timeSpeed}×`);
});

document.getElementById('btn-time-forward').addEventListener('click', () => {
  const speeds = [1, 2, 5, 10, 50, 100];
  const idx = speeds.indexOf(timeSpeed);
  if (idx < speeds.length - 1) {
    timeSpeed = speeds[idx + 1];
  }
  const btn = document.getElementById('btn-time-speed');
  if (btn) btn.textContent = `${timeSpeed}×`;
  const label = document.getElementById('time-speed-label');
  if (label) label.textContent = `${timeSpeed}×`;
  status(`⏩ Speed: ${timeSpeed}×`);
});

// Desktop sidebar tab switching
{
  const tabs = document.querySelectorAll('.sidebar-tab');
  const panels = document.querySelectorAll('.side-tab-panel');
  for (const tab of tabs) {
    tab.addEventListener('click', () => {
      const target = tab.dataset.panel;
      for (const t of tabs) t.classList.toggle('active', t === tab);
      for (const p of panels) p.classList.toggle('active', p.id === 'side-' + target);
    });
  }
}

document.getElementById('btn-tutorial').addEventListener('click', () => {
  showTutorial();
  document.getElementById('menu-dropdown').hidden = true;
  document.getElementById('btn-menu').setAttribute('aria-expanded', 'false');
});
document.getElementById('btn-import').addEventListener('click', () => {
  document.getElementById('custom-element-modal').hidden = false;
  document.getElementById('custom-name').focus();
});

document.getElementById('custom-close').addEventListener('click', () => {
  document.getElementById('custom-element-modal').hidden = true;
});

document.getElementById('custom-cancel').addEventListener('click', () => {
  document.getElementById('custom-element-modal').hidden = true;
});

document.getElementById('custom-anion').addEventListener('change', (e) => {
  document.getElementById('anion-charge-row').hidden = !e.target.checked;
});

document.getElementById('custom-element-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('custom-name').value.trim();
  const sym = document.getElementById('custom-sym').value.trim();
  const cat = document.getElementById('custom-cat').value;
  const maxBonds = parseInt(document.getElementById('custom-maxbonds').value) || 4;
  const mass = parseFloat(document.getElementById('custom-mass').value) || 100;
  const color = document.getElementById('custom-color').value;
  const canAnion = document.getElementById('custom-anion').checked;
  const anionCharge = canAnion ? (parseInt(document.getElementById('custom-anion-charge').value) || 1) : 0;

  if (!name || !sym) {
    status('Name and symbol are required');
    return;
  }

  if (elementBySym(sym)) {
    status(`Element "${sym}" already exists`);
    return;
  }

  const z = 300 + customElements.length;
  customElements.push({
    z,
    sym,
    name,
    mass,
    cat,
    en: null,
    maxBonds,
    anionCharge,
    charges: canAnion ? [anionCharge] : null,
    radius: 150,
    color,
  });

  rebuildPool();
  document.getElementById('custom-element-modal').hidden = true;
  document.getElementById('custom-element-form').reset();
  document.getElementById('anion-charge-row').hidden = true;
  status(`Created custom element: ${name} (${sym})`);
});

function deleteCustomElement(sym) {
  const idx = customElements.findIndex(e => e.sym === sym);
  if (idx === -1) return;
  const el = customElements[idx];
  customElements.splice(idx, 1);
  rebuildPool();
  status(`Deleted custom element: ${el.name} (${sym})`);
}

btnQuality.addEventListener('click', () => {
  const i = QUALITY_MODES.indexOf(qualityMode);
  applyMode(QUALITY_MODES[(i + 1) % QUALITY_MODES.length]);
  status(t('status.quality', { mode: modeLabel() }));
});
document.getElementById('btn-save-disc').addEventListener('click', saveDiscoveries);
document.getElementById('chg-minus').addEventListener('click', () => nudgeCharge(-1));
document.getElementById('chg-plus').addEventListener('click', () => nudgeCharge(1));
document.getElementById('chg-auto').addEventListener('click', () => {
  const cur = currentComp();
  if (!cur || cur.comp.bonds.length === 0) { status(t('status.selectFirst')); return; }
  overrides.delete(compKey(cur.comp));
  reanalyze();
  status(t('status.chargeAuto'));
});
document.getElementById('ch-reset').addEventListener('click', () => {
  completed.clear();
  updateChallengeList();
  save();
  status(t('status.chalReset'));
});
window.addEventListener('keydown', e => {
  if (e.target instanceof HTMLInputElement) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateMolecule(); }
  else if (e.key === 'Delete' || e.key === 'Backspace') {
    if (selectedId !== null) { removeAtom(selectedId); }
  } else if (e.key === 'Escape') {
    closeMobileSheets();
    clearReactionSel();
    selectAtom(null);
  }
});
document.getElementById('btn-fc').classList.add('on');

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------
const THEME_KEY = 'mol3d.theme';
const SCENE_THEMES = {
  dark: { bg: 0x0d1117, gridA: 0x30363d, gridB: 0x1d232a, meta: '#0d1117' },
  light: { bg: 0xf6f8fa, gridA: 0xc9d1d9, gridB: 0xdde3e9, meta: '#f6f8fa' },
};
const btnTheme = document.getElementById('btn-theme');

function applyTheme(mode) {
  const st = SCENE_THEMES[mode] || SCENE_THEMES.dark;
  document.documentElement.dataset.theme = mode === 'light' ? 'light' : 'dark';
  scene.background.set(st.bg);
  if (scene.fog) scene.fog.color.set(st.bg);
  scene.remove(grid);
  grid.geometry.dispose();
  grid = new THREE.GridHelper(60, 60, st.gridA, st.gridB);
  grid.position.y = -1.7;
  scene.add(grid);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', st.meta);
  btnTheme.textContent = t('btn.theme', { mode: t(mode === 'light' ? 'theme.light' : 'theme.dark') });
}

let themeMode = 'dark';
try {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'light' || saved === 'dark') themeMode = saved;
} catch { /* storage unavailable: session-only */ }
applyTheme(themeMode);
btnTheme.addEventListener('click', () => {
  themeMode = themeMode === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem(THEME_KEY, themeMode); } catch { /* session-only */ }
  applyTheme(themeMode);
  invalidate();
  status(t('status.theme', { mode: t(themeMode === 'light' ? 'theme.light' : 'theme.dark') }));
});

// ---------------------------------------------------------------------------
// Language
// ---------------------------------------------------------------------------
const btnLang = document.getElementById('btn-lang');
btnLang.textContent = getLang() === 'en' ? 'VI' : 'EN';
btnLang.addEventListener('click', () => {
  setLang(otherLang());
  btnLang.textContent = getLang() === 'en' ? 'VI' : 'EN';
  refreshTranslations();
  status(t('status.lang'));
});

function refreshTranslations() {
  applyStatic();
  updateQualityHud();
  btnTheme.textContent = t('btn.theme', { mode: t(themeMode === 'light' ? 'theme.light' : 'theme.dark') });
  const wrap = document.getElementById('pool-list');
  document.getElementById('pool-view').textContent = wrap.hidden ? t('pool.viewList') : t('pool.viewTable');
  const ph = document.querySelector('#ptable .el.ph');
  if (ph) ph.textContent = t('ptable.ph');
  buildLegend();
  renderPoolNames();
  for (const b of document.querySelectorAll('#rxn-conds button'))
    b.textContent = condLabel(b.dataset.cond);
  updateRxnPanel();
  updateInspector();
  updateMoleculeList();
  updateDiscList();
  updateChallengeList();
  if (bohrActive) {
    const at = atoms.get(selectedId);
    if (at) updateBohrStats(at.el);
  }
  invalidate();
}

// ---------------------------------------------------------------------------
// Mobile: bottom-sheet tabs + touch joystick
// ---------------------------------------------------------------------------
const SHEET_IDS = ['side-pool', 'side-info', 'side-dex'];
function closeMobileSheets() {
  for (const id of SHEET_IDS) document.getElementById(id)?.classList.remove('open');
  document.querySelectorAll('#mtabs button.on').forEach(b => b.classList.remove('on'));
}
{
  const tabs = document.getElementById('mtabs');
  const mq = window.matchMedia('(max-width: 860px)');
  const sync = () => {
    document.body.classList.toggle('mobile', mq.matches);
    if (!mq.matches) closeMobileSheets();
  };
  sync();
  mq.addEventListener('change', sync);
  tabs.addEventListener('click', e => {
    const btn = e.target.closest('button[data-tab]');
    if (!btn) return;
    const sheet = document.getElementById(btn.dataset.tab);
    const wasOpen = sheet.classList.contains('open');
    closeMobileSheets();
    if (!wasOpen) { sheet.classList.add('open'); btn.classList.add('on'); }
  });
}

{
  // Joystick appears on coarse-pointer devices and the first real touch.
  const enableJoy = () => document.body.classList.add('joy');
  if (window.matchMedia('(pointer: coarse)').matches) enableJoy();
  window.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') enableJoy(); });

  const base = document.getElementById('joy-stick');
  const knob = document.getElementById('joy-knob');
  let joyId = null;
  const joyMove = e => {
    const r = base.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const max = r.width / 2;
    const len = Math.hypot(dx, dy);
    if (len > max) { dx = dx / len * max; dy = dy / len * max; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    movement.setStick(dx / max, -dy / max);
  };
  base.addEventListener('pointerdown', e => {
    joyId = e.pointerId;
    try { base.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
    joyMove(e);
  });
  base.addEventListener('pointermove', e => { if (e.pointerId === joyId) joyMove(e); });
  const joyEnd = e => {
    if (e.pointerId !== joyId) return;
    joyId = null;
    knob.style.transform = '';
    movement.setStick(0, 0);
  };
  base.addEventListener('pointerup', joyEnd);
  base.addEventListener('pointercancel', joyEnd);

  for (const [id, v] of [['joy-up', 1], ['joy-down', -1]]) {
    const b = document.getElementById(id);
    b.addEventListener('pointerdown', e => { e.preventDefault(); movement.setVertical(v); });
    for (const t of ['pointerup', 'pointercancel', 'pointerleave'])
      b.addEventListener(t, () => movement.setVertical(0));
  }
}

// ---------------------------------------------------------------------------
// Render loop — on-demand: render only when something changed or is animating
// ---------------------------------------------------------------------------
let needsRender = true;
function invalidate() { needsRender = true; }

function updateLerp(dt) {
  const k = 1 - Math.exp(-dt * 9);
  let active = false;
  for (const [id, at] of atoms) {
    // Skip the atom being dragged — let the user control it directly
    if (drag && drag.id === id) continue;
    const t = targetPos.get(id);
    if (!t) continue;
    const dx = t.x - at.pos.x, dy = t.y - at.pos.y, dz = t.z - at.pos.z;
    if (dx * dx + dy * dy + dz * dz < 1e-6) continue;
    at.pos.x += dx * k;
    at.pos.y += dy * k;
    at.pos.z += dz * k;
    active = true;
  }
  return active;
}

let lastT = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  fpsSampler.frame(now);
  
  // Update simulation time (respects freeze and speed)
  updateSimulationTime(now);

  // Safety: if drag was cleared but controls stayed disabled, re-enable them
  if (!drag && !controls.enabled) {
    controls.enabled = true;
  }

  controls.update();
  let active = false;
  active = movement.update(dt) || active;
  active = updateDrift(dt) || active;
  active = updateLerp(dt) || active;
  updateRadioactiveDecay(now);
  if (decayTrack.size) active = true;
  updateMayhemParticles(dt);
  updateScreenShake(now);
  if (mayhemParticles.length) active = true;
  if (shakeDuration) active = true;
  if (spawnAnim.size) active = true;
  if (drag) active = true;
  autoTick(now);

  // Periodic SafeMode check (every ~1 second)
  if (window.__mol3d?.SafeMode && Math.floor(now / 1000) !== Math.floor((now - dt * 1000) / 1000)) {
    checkUnstableMolecules();
  }

  if (needsRender || active) {
    needsRender = false;
    syncInstances();
    updateSprites();
    renderer.render(scene, camera);
  }
}

// ── Console hack helpers ──
function computeInitialPositions(atomList) {
  const positions = [];
  const n = atomList.length;
  if (n === 1) {
    positions.push({ x: 0, y: 0, z: 0 });
  } else if (n === 2) {
    positions.push({ x: -0.75, y: 0, z: 0 });
    positions.push({ x: 0.75, y: 0, z: 0 });
  } else {
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const radius = Math.max(1.2, n * 0.25);
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 2;
      const radiusAtY = Math.sqrt(1 - y * y);
      const theta = goldenAngle * i;
      positions.push({
        x: Math.cos(theta) * radiusAtY * radius,
        y: y * radius,
        z: Math.sin(theta) * radiusAtY * radius
      });
    }
  }
  return positions;
}

function autoBondAtoms(atomIds) {
  const maxBondDist = 2.5;
  let bonded = true;
  while (bonded) {
    bonded = false;
    for (let i = 0; i < atomIds.length && !bonded; i++) {
      for (let j = i + 1; j < atomIds.length && !bonded; j++) {
        const aId = atomIds[i];
        const bId = atomIds[j];
        const a = atoms.get(aId);
        const b = atoms.get(bId);
        if (!a || !b) continue;
        const alreadyBonded = [...bonds.values()].some(
          bond => (bond.a === aId && bond.b === bId) || (bond.a === bId && bond.b === aId)
        );
        if (alreadyBonded) continue;
        const dist = Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y, a.pos.z - b.pos.z);
        if (dist > maxBondDist) continue;
        const chk = bondCheck(atoms, bonds, aId, bId);
        if (chk.ok || window.__mol3d?._godMode) {
          const id = nextId++;
          bonds.set(id, { id, a: aId, b: bId, order: 1, ionic: chk.type === 'ionic' });
          bonded = true;
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
window.__mol3d = {
  atoms, bonds, overrides,
  movement, camera, controls,
  SafeMode: true,
  _godMode: false,
  simulation,
  kinetics: { createSimulation, compileNetwork, parseRateExpr, rk4Step },
  analyses: () => analyses,
  comps: () => lastComps,
  spawnAtom, reanalyze, selectAtom, undo, clearAll,
  help: () => {
    console.log('%c🧪 Mol3D Console API', 'color: #4CAF50; font-weight: bold; font-size: 14px;');
    console.log('%cCore:', 'color: #2196F3; font-weight: bold;');
    console.log('  __mol3d.spawnAtom(el) — Spawn an atom (e.g., "C", "O", "H")');
    console.log('  __mol3d.clearAll() — Clear all atoms');
    console.log('  __mol3d.undo() — Undo last action');
    console.log('  __mol3d.selectAtom(id) — Select atom by ID');
    console.log('  __mol3d.reanalyze() — Re-analyze molecules');
    console.log('  __mol3d.discoveries() — List discoveries');
    console.log('  __mol3d.analyses() — Get current analyses');
    console.log('%cHacks:', 'color: #ff9800; font-weight: bold;');
    console.log('  __mol3d.hacks.chaos(count) — Spawn random atoms');
    console.log('  __mol3d.hacks.spawnMolecule(formula) — Spawn by formula (e.g., "C2H6O")');
    console.log('  __mol3d.hacks.dna(length) — Create DNA helix');
    console.log('  __mol3d.hacks.firework(count) — Explosion pattern');
    console.log('  __mol3d.hacks.party() — Dancing atoms');
    console.log('  __mol3d.hacks.godMode() / mortalMode() — Toggle validation');
    console.log('  __mol3d.hacks.explosion(force) / implode() — Position effects');
    console.log('  __mol3d.hacks.giant() / tiny() — Scale atoms');
    console.log('  __mol3d.hacks.matrix() / rainbow() / disco() — Visual effects');
    console.log('  __mol3d.hacks.blackHole() / antiGravity() / quantum() — Physics');
    console.log('  __mol3d.hacks.clone(times) — Clone selected atom');
    console.log('  __mol3d.hacks.mirror() — Mirror all atoms');
    console.log('  __mol3d.hacks.unlockAll() — Unlock all discoveries');
    console.log('  __mol3d.hacks.slowmo() / fastforward() / normalSpeed() — Time control');
    return 'API listed above';
  },
  screenPosOf: id => {
    const at = atoms.get(id);
    if (!at) return null;
    const v = new THREE.Vector3(at.pos.x, at.pos.y, at.pos.z).project(camera);
    const rect = renderer.domElement.getBoundingClientRect();
    return { x: (v.x + 1) / 2 * rect.width + rect.left, y: (-v.y + 1) / 2 * rect.height + rect.top };
  },
  devBond: (a, b) => createBond(a, b),
  devUpgrade: bid => upgradeBond(bid),
  reaction: {
    selectByFormula: f => {
      for (const c of lastComps) {
        const k = compKey(c);
        if (reactionSel.has(k)) continue;
        const i = lastComps.indexOf(c);
        if (analyses[i]?.displayFormula === f || analyses[i]?.formula === f) { reactionSel.add(k); rebuildReactionSelIds(); updateRxnPanel(); invalidate(); return true; }
      }
      return false;
    },
    pick: cond => {
      const fs = selectedFormulas();
      const rx = findReaction(fs, cond, selectedStructures());
      if (rx) { executeReaction(rx); return rx.equation; }
      const valid = conditionsFor(fs, selectedStructures());
      return valid.size ? `wrong-condition:${[...valid].join(',')}` : 'none';
    },
    clear: clearReactionSel,
  },
  setQuality: applyMode,
  quality: () => qualityMode,
  tierKey: () => TIER_ORDER[tierIndex],
  discoveries: () => [...discoveries],
  saveDiscoveries,
  driftVelocity: id => {
    const comp = componentOf(atoms, bonds, id);
    if (!comp) return null;
    const d = driftState.get(compKey(comp));
    return d ? { x: d.v.x, y: d.v.y, z: d.v.z } : null;
  },
  stepAnim: dt => {
    const a = updateDrift(dt);
    const l = updateLerp(dt);
    syncInstances();
    updateSprites();
    renderer.render(scene, camera);
    return { drift: a, lerp: l };
  },
  hacks: {
    unlimitedBonds: () => {
      window.__mol3d._godMode = true;
      console.log(`%c🔓 UNLIMITED BONDS ENABLED! Chemistry rules no longer apply.`, 'color: #ff9800; font-weight: bold; font-size: 14px;');
      console.log(`Warning: Molecules may become impossible. Use at your own risk!`);
      return 'God mode activated';
    },
    godMode: () => {
      window.__mol3d._godMode = true;
      console.log(`%c⚡ GOD MODE ACTIVATED!`, 'color: #ff0000; font-weight: bold; font-size: 16px; text-shadow: 2px 2px #000;');
      console.log(`All validation disabled. Spawn impossible molecules!`);
      return 'God mode on';
    },
    mortalMode: () => {
      window.__mol3d._godMode = false;
      console.log(`%c✓ Back to normal chemistry rules`, 'color: #4CAF50; font-weight: bold;');
      return 'God mode off';
    },
    clearScene: () => {
      clearAll();
      console.log(`%c Scene cleared`, 'color: #2196F3; font-weight: bold;');
      return 'Scene cleared';
    },
    safeMode: (on) => {
      window.__mol3d.SafeMode = on !== false;
      const state = window.__mol3d.SafeMode ? 'ON' : 'OFF';
      const color = window.__mol3d.SafeMode ? '#ffcc00' : '#4CAF50';
      console.log(`%c⚠ SAFE MODE: ${state}`, `color: ${color}; font-weight: bold; font-size: 14px;`);
      if (!window.__mol3d.SafeMode) {
        console.log('%c  Unstable molecule warnings disabled', 'color: #888;');
      } else {
        console.log('%c  Unstable molecule warnings enabled', 'color: #888;');
        // Re-check existing molecules when SafeMode is enabled
        checkUnstableMolecules();
      }
      return `Safe mode ${state}`;
    },
    chaos: (count = 20) => {
      console.log(`%c🌪 CHAOS MODE! Spawning ${count} random atoms...`, 'color: #9c27b0; font-weight: bold; font-size: 14px;');
      for (let i = 0; i < count; i++) {
        const el = ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)];
        spawnAtom(el);
      }
      return `Spawned ${count} random atoms`;
    },
    party: () => {
      console.log(`%c🎉 PARTY MODE! Let's dance!`, 'color: #e91e63; font-weight: bold; font-size: 16px;');
      let angle = 0;
      const interval = setInterval(() => {
        for (const [id, at] of atoms) {
          at.pos.x += Math.sin(angle + id) * 0.1;
          at.pos.y += Math.cos(angle + id) * 0.1;
        }
        angle += 0.2;
        reanalyze();
      }, 50);
      setTimeout(() => clearInterval(interval), 5000);
      return 'Party for 5 seconds!';
    },
    matrix: () => {
      console.log(`%c💚 MATRIX MODE - Welcome to the Matrix, Neo...`, 'color: #00ff00; font-weight: bold; font-size: 14px; font-family: monospace;');
      document.body.style.filter = 'hue-rotate(90deg) saturate(3) brightness(0.8)';
      setTimeout(() => document.body.style.filter = '', 10000);
      return 'Matrix mode for 10 seconds';
    },
    rainbow: () => {
      console.log(`%c🌈 RAINBOW MODE!`, 'color: #ff0000; font-weight: bold; font-size: 16px; text-shadow: 1px 1px #ff0, -1px -1px #0f0, 1px -1px #00f;');
      let hue = 0;
      const interval = setInterval(() => {
        document.body.style.filter = `hue-rotate(${hue}deg)`;
        hue = (hue + 10) % 360;
      }, 100);
      setTimeout(() => { clearInterval(interval); document.body.style.filter = ''; }, 10000);
      return 'Rainbow for 10 seconds';
    },
    giant: () => {
      console.log(`%c🦣 GIANT MODE!`, 'color: #795548; font-weight: bold; font-size: 16px;');
      for (const [id, at] of atoms) {
        at.pos.x *= 3;
        at.pos.y *= 3;
        at.pos.z *= 3;
      }
      reanalyze();
      return 'Atoms scaled 3x';
    },
    tiny: () => {
      console.log(`%c🔬 TINY MODE!`, 'color: #2196f3; font-weight: bold; font-size: 16px;');
      for (const [id, at] of atoms) {
        at.pos.x /= 3;
        at.pos.y /= 3;
        at.pos.z /= 3;
      }
      reanalyze();
      return 'Atoms scaled 1/3x';
    },
    explosion: (force = 5) => {
      console.log(`%c💥 EXPLOSION! Force: ${force}`, 'color: #ff5722; font-weight: bold; font-size: 16px;');
      for (const [id, at] of atoms) {
        const dx = at.pos.x || 0.1;
        const dy = at.pos.y || 0.1;
        const dz = at.pos.z || 0.1;
        const dist = Math.sqrt(dx*dx + dy*dy + dz*dz) || 1;
        at.pos.x += (dx / dist) * force;
        at.pos.y += (dy / dist) * force;
        at.pos.z += (dz / dist) * force;
      }
      reanalyze();
      return 'BOOM!';
    },
    implode: () => {
      console.log(`%c🕳️ IMPLODE! All atoms to center!`, 'color: #000000; font-weight: bold; font-size: 16px; background: #fff;');
      for (const [id, at] of atoms) {
        at.pos.x *= 0.1;
        at.pos.y *= 0.1;
        at.pos.z *= 0.1;
      }
      reanalyze();
      return 'Collapsed to center';
    },
    clone: (times = 5) => {
      if (selectedId === null) {
        console.error('No atom selected! Select an atom first.');
        return 'Error: no selection';
      }
      console.log(`%c👯 CLONING atom ${selectedId} x${times}!`, 'color: #00bcd4; font-weight: bold; font-size: 14px;');
      const orig = atoms.get(selectedId);
      for (let i = 0; i < times; i++) {
        const newAtom = spawnAtom(orig.el);
        const nat = atoms.get(newAtom);
        nat.pos.x = orig.pos.x + (Math.random() - 0.5) * 2;
        nat.pos.y = orig.pos.y + (Math.random() - 0.5) * 2;
        nat.pos.z = orig.pos.z + (Math.random() - 0.5) * 2;
      }
      reanalyze();
      return `Cloned ${times} times`;
    },
    dna: (length = 20) => {
      console.log(`%c🧬 DNA MODE! Creating helix with ${length} atoms...`, 'color: #3f51b5; font-weight: bold; font-size: 14px;');
      clearAll();
      const atomIds = [];
      for (let i = 0; i < length; i++) {
        const angle = (i / length) * Math.PI * 4;
        const el = i % 2 === 0 ? ELEMENTS.find(e => e.sym === 'C') : ELEMENTS.find(e => e.sym === 'O');
        const id = nextId++;
        const pos = {
          x: Math.cos(angle) * 2,
          y: i * 0.5,
          z: Math.sin(angle) * 2
        };
        atoms.set(id, { id, el, pos });
        atomIds.push(id);
      }
      for (let i = 0; i < atomIds.length - 1; i++) {
        const aId = atomIds[i];
        const bId = atomIds[i + 1];
        const chk = bondCheck(atoms, bonds, aId, bId);
        if (chk.ok || window.__mol3d?._godMode) {
          const id = nextId++;
          bonds.set(id, { id, a: aId, b: bId, order: 1, ionic: chk.type === 'ionic' });
        }
      }
      reanalyze();
      return `DNA helix created with ${atomIds.length} atoms and bonds`;
    },
    firework: (count = 30) => {
      console.log(`%c🎆 FIREWORK! Spawning ${count} atoms in explosion pattern...`, 'color: #ff9800; font-weight: bold; font-size: 14px;');
      const center = { x: 0, y: 0, z: 0 };
      for (let i = 0; i < count; i++) {
        const el = ELEMENTS[Math.floor(Math.random() * 5)];
        const id = spawnAtom(el);
        const at = atoms.get(id);
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        const r = 2 + Math.random() * 3;
        at.pos.x = center.x + r * Math.sin(phi) * Math.cos(theta);
        at.pos.y = center.y + r * Math.sin(phi) * Math.sin(theta);
        at.pos.z = center.z + r * Math.cos(phi);
      }
      reanalyze();
      return 'Firework!';
    },
    blackHole: () => {
      console.log(`%c🕳️ BLACK HOLE! All atoms attracted to center...`, 'color: #000; font-weight: bold; font-size: 16px; background: linear-gradient(45deg, #000, #333); padding: 5px;');
      let step = 0;
      const interval = setInterval(() => {
        for (const [id, at] of atoms) {
          at.pos.x *= 0.95;
          at.pos.y *= 0.95;
          at.pos.z *= 0.95;
        }
        reanalyze();
        step++;
        if (step > 50) clearInterval(interval);
      }, 100);
      return 'Black hole active for 5 seconds';
    },
    antiGravity: () => {
      console.log(`%c🚀 ANTI-GRAVITY! Atoms float upward!`, 'color: #00bcd4; font-weight: bold; font-size: 14px;');
      let step = 0;
      const interval = setInterval(() => {
        for (const [id, at] of atoms) {
          at.pos.y += 0.2;
        }
        reanalyze();
        step++;
        if (step > 50) clearInterval(interval);
      }, 100);
      return 'Anti-gravity for 5 seconds';
    },
    quantum: () => {
      console.log(`%c⚛️ QUANTUM MODE! Atoms teleport randomly!`, 'color: #9c27b0; font-weight: bold; font-size: 14px;');
      let step = 0;
      const interval = setInterval(() => {
        for (const [id, at] of atoms) {
          if (Math.random() < 0.3) {
            at.pos.x += (Math.random() - 0.5) * 2;
            at.pos.y += (Math.random() - 0.5) * 2;
            at.pos.z += (Math.random() - 0.5) * 2;
          }
        }
        reanalyze();
        step++;
        if (step > 30) clearInterval(interval);
      }, 200);
      return 'Quantum teleportation for 6 seconds';
    },
    unlockAll: () => {
      console.log(`%c🔓 UNLOCKING ALL DISCOVERIES!`, 'color: #ffd700; font-weight: bold; font-size: 16px;');
      for (const challenge of CHALLENGES) {
        if (!completed.has(challenge.formula)) {
          completed.add(challenge.formula);
          discoveries.push({ formula: challenge.formula, charge: 0, saved: true });
        }
      }
      updateDiscList();
      saveDiscoveries();
      return `Unlocked ${CHALLENGES.length} discoveries!`;
    },
    spawnMolecule: (formula) => {
      console.log(`%c🧪 Spawning molecule: ${formula}`, 'color: #4CAF50; font-weight: bold; font-size: 14px;');
      clearAll();
      const atomList = [];
      const regex = /([A-Z][a-z]?)(\d*)/g;
      let match;
      while ((match = regex.exec(formula)) !== null) {
        if (!match[1]) continue;
        const sym = match[1];
        const count = match[2] ? parseInt(match[2]) : 1;
        for (let i = 0; i < count; i++) atomList.push(sym);
      }
      if (atomList.length === 0) {
        console.error(`Could not parse formula: ${formula}`);
        return 'Parse error';
      }
      const atomIds = [];
      const positions = computeInitialPositions(atomList);
      for (let i = 0; i < atomList.length; i++) {
        const sym = atomList[i];
        const el = ELEMENTS.find(e => e.sym === sym);
        if (!el) {
          console.warn(`Element ${sym} not found, skipping`);
          continue;
        }
        const id = nextId++;
        const pos = positions[i] || { x: (i % 5) * 1.5 - 3, y: 0, z: Math.floor(i / 5) * 1.5 };
        atoms.set(id, { id, el, pos });
        atomIds.push(id);
      }
      autoBondAtoms(atomIds);
      reanalyze();
      const bondCount = [...bonds.values()].filter(b => atomIds.includes(b.a) && atomIds.includes(b.b)).length;
      return `Spawned ${formula} with ${atomIds.length} atoms and ${bondCount} bonds`;
    },
    mirror: () => {
      if (atoms.size === 0) {
        console.error('No atoms to mirror!');
        return 'Error: empty';
      }
      console.log(`%c🪞 MIRROR MODE! Creating mirror copy...`, 'color: #607d8b; font-weight: bold; font-size: 14px;');
      const originalAtoms = [...atoms.values()];
      for (const orig of originalAtoms) {
        const id = spawnAtom(orig.el);
        const at = atoms.get(id);
        at.pos.x = -orig.pos.x;
        at.pos.y = orig.pos.y;
        at.pos.z = orig.pos.z;
      }
      reanalyze();
      return 'Mirror created (X-axis flip)';
    },
    disco: () => {
      console.log(`%c🕺 DISCO MODE! Flashing colors!`, 'color: #ff00ff; font-weight: bold; font-size: 16px;');
      const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
      let i = 0;
      const interval = setInterval(() => {
        document.body.style.backgroundColor = colors[i % colors.length];
        i++;
      }, 200);
      setTimeout(() => { clearInterval(interval); document.body.style.backgroundColor = ''; }, 5000);
      return 'Disco for 5 seconds!';
    },
    slowmo: () => {
      console.log(`%c🐌 SLOW-MO MODE!`, 'color: #2196f3; font-weight: bold; font-size: 14px;');
      window.__mol3d._timeScale = 0.2;
      return 'Time scale: 0.2x';
    },
    fastforward: () => {
      console.log(`%c⚡ FAST-FORWARD MODE!`, 'color: #ff9800; font-weight: bold; font-size: 14px;');
      window.__mol3d._timeScale = 3.0;
      return 'Time scale: 3x';
    },
    normalSpeed: () => {
      window.__mol3d._timeScale = 1.0;
      console.log(`%c✓ Normal speed restored`, 'color: #4CAF50; font-weight: bold;');
      return 'Time scale: 1x';
    },
  },
  scene,
  renderer,
  ELEMENTS,
};
console.log(`%c🧪 Mol3D loaded! Type %c__mol3d.help()%c for console API`, 'color: #4CAF50; font-weight: bold;', 'color: #2196F3; font-weight: bold;', 'color: #4CAF50;');

applyStatic();
load();
loadDiscoveries();
buildPool();
buildLegend();
buildRxnPanel();
initStoichPanel();
updateChallengeList();
updateDiscList();
updateUndoBtn();
updateDeleteBtn();
updateQualityHud();
reanalyze();
requestAnimationFrame(frame);
// Safety: force initial render to ensure scene is visible
syncInstances();
renderer.render(scene, camera);
console.log('%c✓ Scene initialized', 'color: #4CAF50; font-weight: bold;', {
  atoms: atoms.size,
  bonds: bonds.size,
  camera: camera.position.toArray(),
});
initTutorial();

function updateUndoBtn() {
  document.getElementById('btn-undo').disabled = undoStack.length === 0;
}

function updateDeleteBtn() {
  const hasSel = selectedId !== null;
  document.getElementById('btn-delete').disabled = !hasSel;
  document.getElementById('btn-duplicate').disabled = !hasSel;
}

// ─ Background Music ──
const musicFiles = import.meta.glob('./assets/music/*.{mp3,wav,ogg,m4a}', { eager: true, import: 'default' });
const musicTracks = Object.entries(musicFiles).map(([path, url]) => {
  const name = path.split('/').pop().replace(/\.[^.]+$/, '');
  return { path: url, name };
}).sort((a, b) => a.name.localeCompare(b.name));

let currentTrackIndex = 0;
const audio = new Audio();
audio.style.display = 'none';
document.body.appendChild(audio);

function initBackgroundMusic() {
  if (musicTracks.length === 0) return;

  const volumeSlider = document.getElementById('volume-slider');
  const nowPlaying = document.getElementById('now-playing');
  const savedVol = (() => { try { return localStorage.getItem('mol3d.volume'); } catch { return null; } })();
  const initialVol = savedVol !== null ? Number(savedVol) : 50;
  audio.volume = initialVol / 100;
  if (volumeSlider) volumeSlider.value = initialVol;

  if (volumeSlider) {
    volumeSlider.addEventListener('input', () => {
      audio.volume = volumeSlider.value / 100;
      try { localStorage.setItem('mol3d.volume', volumeSlider.value); } catch { /* session-only */ }
    });
  }

  function updateNowPlaying() {
    if (nowPlaying && musicTracks[currentTrackIndex]) {
      nowPlaying.textContent = `"${musicTracks[currentTrackIndex].name}"`;
    }
  }

  audio.src = musicTracks[0].path;
  updateNowPlaying();

  audio.addEventListener('ended', () => {
    currentTrackIndex = (currentTrackIndex + 1) % musicTracks.length;
    audio.src = musicTracks[currentTrackIndex].path;
    updateNowPlaying();
    audio.play().catch(() => {});
  });

  const startMusic = () => {
    audio.play().catch(() => {});
    document.removeEventListener('click', startMusic);
    document.removeEventListener('keydown', startMusic);
    document.removeEventListener('touchstart', startMusic);
  };
  document.addEventListener('click', startMusic);
  document.addEventListener('keydown', startMusic);
  document.addEventListener('touchstart', startMusic);
}

// ─ Quest Mode AI Integration ──
(function initQuestMode() {
  const btnQuest = document.getElementById('btn-quest');
  const questPanel = document.getElementById('quest-panel');
  const questMessages = document.getElementById('quest-messages');
  const questInput = document.getElementById('quest-input');
  const questSend = document.getElementById('quest-send');
  const questClear = document.getElementById('quest-clear');
  const questClose = document.getElementById('quest-close');
  
  if (!btnQuest || !questPanel) return;
  
  const questHistory = [];
  
  btnQuest.addEventListener('click', async () => {
    // Check if Puter is available and user is authenticated
    if (typeof puter === 'undefined' || !puter.auth) {
      addQuestMessage('system', '❌ Puter.js not loaded. Please refresh the page.');
      questPanel.hidden = false;
      btnQuest.classList.add('active');
      return;
    }
    
    // Check if user is signed in
    const isSignedIn = await puter.auth.isSignedIn();
    
    if (!isSignedIn) {
      // User not signed in - show auth panel
      questPanel.hidden = false;
      btnQuest.classList.add('active');
      questMessages.innerHTML = '';
      addQuestMessage('system', '🔐 Sign in required to use AI Quest Guide');
      addQuestMessage('system', 'Click the button below to sign in with your Puter account (free):');
      
      const signInBtn = document.createElement('button');
      signInBtn.className = 'quest-signin-btn';
      signInBtn.textContent = '🔑 Sign in with Puter';
      signInBtn.style.cssText = 'background: var(--accent); color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px; margin: 16px auto; display: block;';
      signInBtn.onclick = async () => {
        try {
          await puter.auth.signIn();
          const nowSignedIn = await puter.auth.isSignedIn();
          if (nowSignedIn) {
            questMessages.innerHTML = '';
            addQuestMessage('system', '✅ Signed in successfully! AI Quest Guide is now available.');
            addQuestMessage('system', ' Ask me about chemistry, molecules, or reactions. Try: "Build water" or "Create methane"');
          }
        } catch (error) {
          addQuestMessage('system', '❌ Sign-in failed: ' + (error.message || 'Unknown error'));
        }
      };
      questMessages.appendChild(signInBtn);
      return;
    }
    
    // User is signed in - open quest panel normally
    questPanel.hidden = !questPanel.hidden;
    btnQuest.classList.toggle('active', !questPanel.hidden);
    if (!questPanel.hidden && questMessages.children.length === 0) {
      addQuestMessage('system', '🧪 AI Quest Guide activated! I can answer chemistry questions AND build molecules for you. Try: "Build water" or "Create methane"');
    }
  });
  
  questClose.addEventListener('click', () => {
    questPanel.hidden = true;
    btnQuest.classList.remove('active');
  });
  
  questClear.addEventListener('click', () => {
    questMessages.innerHTML = '';
    questHistory.length = 0;
    addQuestMessage('system', 'Chat cleared.');
  });
  
  questSend.addEventListener('click', sendQuestMessage);
  questInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendQuestMessage();
    }
  });
  
  function addQuestMessage(type, text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `quest-msg ${type}`;
    msgDiv.textContent = text;
    questMessages.appendChild(msgDiv);
    questMessages.scrollTop = questMessages.scrollHeight;
    return msgDiv;
  }
  
  function getSceneContext() {
    const context = {
      totalAtoms: atoms.size,
      totalBonds: bonds.size,
      discoveries: discoveries.length,
      recentDiscoveries: discoveries.slice(-5).map(d => d.formula || d.name)
    };
    
    if (discoveries.length > 0) {
      context.currentMolecules = discoveries.slice(-3).map(d => ({
        formula: d.formula,
        name: d.name,
        charge: d.charge || 0
      }));
    }
    
    return context;
  }
  
  function executeAIAction(action) {
    try {
      const { command, args } = action;
      
      switch (command) {
        case 'spawnAtom':
          if (window.__mol3d?.spawnAtom) {
            window.__mol3d.spawnAtom(args.element);
            return `✓ Spawned ${args.element} atom`;
          }
          break;
          
        case 'spawnMolecule':
          if (window.__mol3d?.hacks?.spawnMolecule) {
            window.__mol3d.hacks.spawnMolecule(args.formula);
            return `✓ Built ${args.formula} molecule`;
          }
          break;
          
        case 'clearScene':
          if (window.__mol3d?.hacks?.clearScene) {
            window.__mol3d.hacks.clearScene();
            return '✓ Cleared the scene';
          }
          break;
          
        case 'godMode':
          if (window.__mol3d?.hacks?.godMode) {
            window.__mol3d.hacks.godMode();
            return '⚡ God mode activated - no validation limits';
          }
          break;
          
        case 'mortalMode':
          if (window.__mol3d?.hacks?.mortalMode) {
            window.__mol3d.hacks.mortalMode();
            return '✓ Back to normal chemistry rules';
          }
          break;
      }
      
      return `⚠ Unknown action: ${command}`;
    } catch (error) {
      return `❌ Action failed: ${error.message}`;
    }
  }
  
  function parseAndExecuteActions(aiText) {
    const actionRegex = /\[ACTION:(\w+):([^\]]+)\]/g;
    let match;
    const results = [];
    
    while ((match = actionRegex.exec(aiText)) !== null) {
      const [, command, argsStr] = match;
      const args = {};
      
      argsStr.split(',').forEach(pair => {
        const [key, value] = pair.split('=').map(s => s.trim());
        if (key && value) args[key] = value;
      });
      
      const result = executeAIAction({ command, args });
      results.push(result);
    }
    
    return results;
  }
  
  async function sendQuestMessage() {
    const text = questInput.value.trim();
    if (!text) return;
    
    questInput.value = '';
    addQuestMessage('user', text);
    questHistory.push({ role: 'user', content: text });
    
    const typingMsg = addQuestMessage('typing', 'Thinking...');
    questSend.disabled = true;
    
    try {
      const context = getSceneContext();
      const systemPrompt = `You are an AI chemistry guide for a 3D molecule builder app. You can BOTH answer questions AND take actions to build molecules.

Current scene:
- Atoms: ${context.totalAtoms}
- Bonds: ${context.totalBonds}
- Discoveries: ${context.discoveries}
${context.currentMolecules ? `- Molecules: ${context.currentMolecules.map(m => m.formula).join(', ')}` : ''}

AVAILABLE ACTIONS (use when user asks you to build/create something):
- [ACTION:spawnMolecule:formula=H2O] - Build a complete molecule
- [ACTION:spawnAtom:element=O] - Add a single atom
- [ACTION:clearScene] - Clear all atoms
- [ACTION:godMode] - Disable validation (for impossible molecules)
- [ACTION:mortalMode] - Re-enable validation

RULES:
1. When asked to build/create a molecule, use [ACTION:spawnMolecule:formula=...] 
2. Explain what you're building and why
3. Keep responses under 3 sentences
4. Use actions when appropriate, but also explain the chemistry
5. If a molecule violates chemistry rules, warn the user and offer godMode

Examples:
User: "Build water"
You: "I'll create H₂O for you - oxygen forms 2 bonds with hydrogen.[ACTION:spawnMolecule:formula=H2O]"

User: "What's methane?"
You: "Methane (CH₄) is the simplest hydrocarbon - carbon bonded to 4 hydrogens in a tetrahedral shape. Want me to build it?[ACTION:spawnMolecule:formula=CH4]"`;

      const messages = [
        { role: 'system', content: systemPrompt },
        ...questHistory.slice(-10)
      ];

      const response = await puter.ai.chat(messages, { model: 'claude-3-haiku' });
      
      typingMsg.remove();
      
      const aiText = response?.message?.content || response?.toString() || 'I could not process that request.';
      
      const actionResults = parseAndExecuteActions(aiText);
      
      addQuestMessage('ai', aiText.replace(/\[ACTION:[^\]]+\]/g, '').trim());
      
      if (actionResults.length > 0) {
        actionResults.forEach(result => {
          addQuestMessage('system', result);
        });
      }
      
      questHistory.push({ role: 'assistant', content: aiText });
      
    } catch (error) {
      typingMsg.remove();
      console.error('Quest AI error:', error);
      addQuestMessage('ai', '❌ Error: ' + (error.message || 'Could not connect to AI service.'));
    } finally {
      questSend.disabled = false;
      questInput.focus();
    }
  }
})();

// ── HMR disposal ──
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    controls.dispose();
    renderer.dispose();
    if (renderer.domElement.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
  });
}

initBackgroundMusic();
