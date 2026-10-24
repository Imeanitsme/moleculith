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
import { createSimulation, compileNetwork, parseRateExpr, rk4Step, arrheniusK, temperatureSweep, R_GAS, DEFAULT_TEMPERATURE } from './kinetics.js';
import { ALL_NETWORKS } from './data/reaction-networks.js';
import { renderBlueprint, renderReactionBlueprint, BLUEPRINT_MODES, BLUEPRINT_GRID, ELECTRON_CONFIGS } from './blueprint.js';

setElementLookup(elementBySym);

// Tolerate hand-edited challenge entries: skip malformed ones with a warning
// instead of breaking the Dex.
const CHALLENGE_LIST = CHALLENGES.filter(c => {
  if (c && typeof c.formula === 'string' && c.formula.trim()) return true;
  console.warn('challenges.js: skipping malformed entry', c);
  return false;
});

initLang();

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
let blueprintMode = false;
let blueprintTool = 'select';
let blueprintViewMode = 'structural';
let blueprintDragAtom = null;
let blueprintDragOffset = { x: 0, y: 0 };
let blueprintAtomPositions = new Map();
let blueprintSelectedAtoms = new Set();
let blueprintBrackets = new Map();
let blueprintPan = { x: 0, y: 0 };
let blueprintZoom = 1.0;
let blueprintIsPanning = false;
let blueprintPanStart = { x: 0, y: 0 };
let blueprintCurrentElement = 'C';
let blueprintBondDrag = null; // { startAtom, startX, startY } for drag-to-bond
let blueprintCanvasAtoms = new Map(); // atoms created in BluePrint mode (separate from 3D scene)
let blueprintCanvasBonds = new Map(); // bonds created in BluePrint mode
let blueprintNextId = 10000; // ID counter for canvas atoms
let blueprintGridSnap = true;
let blueprintAutoHydrogen = false;
let blueprintUndoStack = [];
let blueprintRedoStack = [];
let blueprintMouseDownPlaced = false;
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
atomMeshM.instanceCount = 0;
atomMeshN.instanceCount = 0;
bondMeshC.instanceCount = 0;
bondMeshI.instanceCount = 0;
atomMeshM.visible = false;
atomMeshN.visible = false;
bondMeshC.visible = false;
bondMeshI.visible = false;
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
  atomMeshM.instanceCount = mi;
  atomMeshN.instanceCount = ni;
  atomMeshM.visible = mi > 0;
  atomMeshN.visible = ni > 0;
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
  bondMeshC.instanceCount = ci;
  bondMeshI.instanceCount = ii;
  bondMeshC.visible = ci > 0;
  bondMeshI.visible = ii > 0;
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

function reanalyze(pinnedIds = new Set()) {
  lastComps = componentsOf(atoms, bonds);
  const keySet = new Set(lastComps.map(compKey));
  for (const k of [...overrides.keys()]) if (!keySet.has(k)) overrides.delete(k);
  for (const k of [...isoSel.keys()]) if (!keySet.has(k)) isoSel.delete(k);
  for (const k of [...reactionSel]) if (!keySet.has(k)) reactionSel.delete(k);
  rebuildReactionSelIds();
  updateRxnPanel();
  analyses = lastComps.map(c => analyzeComponent(atoms, bonds, c, overrides.has(compKey(c)) ? overrides.get(compKey(c)) : null));
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
  const hasAtoms = atoms.size > 0 || (blueprintMode && blueprintCanvasAtoms.size > 0);
  document.getElementById('hint').style.display = hasAtoms ? 'none' : 'flex';
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
  if (!chk.ok) { status(trReason(chk.reason), 'err'); return false; }
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
    if (chk.ok) {
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
  if (!up.ok) { status(trReason(up.reason), 'err'); return; }
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
  save(true);
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
        drag.snapUpgrade = up.ok;
        drag.snapLegal = up.ok;
        drag.snapMsg = up.ok
          ? t('snap.upgradeTo', { n: existing.order + 1 })
          : up.reason;
      } else {
        const chk = bondCheck(atoms, bonds, drag.id, bestId);
        drag.snapLegal = chk.ok;
        drag.snapMsg = chk.ok
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
  if (blueprintMode) {
    blueprintCurrentElement = el.sym;
    updateBlueprintElementDisplay();
    status(`Element: ${el.sym} (${el.name}) — click on canvas to place`);
    if (document.body.classList.contains('mobile')) closeMobileSheets();
    return;
  }
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

// Mobile Console
const mobileConsole = document.getElementById('mobile-console');
const consoleOutput = document.getElementById('console-output');
const consoleInput = document.getElementById('console-input');
const consoleHistory = [];
let consoleHistoryIndex = -1;
let consoleSuggestions = [];
let suggestionIndex = -1;

// Create suggestions dropdown
const suggestionsDiv = document.createElement('div');
suggestionsDiv.className = 'console-suggestions';
suggestionsDiv.hidden = true;
consoleInput.parentElement.style.position = 'relative';
consoleInput.parentElement.insertBefore(suggestionsDiv, consoleInput);

// Available commands for autocomplete
const availableCommands = [
  '__mol3d.help()',
  '__mol3d.status()',
  '__mol3d.listAtoms()',
  '__mol3d.listBonds()',
  '__mol3d.findElement(',
  '__mol3d.analyses()',
  '__mol3d.comps()',
  '__mol3d.discoveries()',
  '__mol3d.spawnAtom(',
  '__mol3d.removeAtom(',
  '__mol3d.selectAtom(',
  '__mol3d.devBond(',
  '__mol3d.devUpgrade(',
  '__mol3d.clearAll()',
  '__mol3d.undo()',
  '__mol3d.export()',
  '__mol3d.import(',
  '__mol3d.reset()',
  '__mol3d.setQuality(',
  '__mol3d.reanalyze()',
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

// Override console methods to capture output
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
    // Execute with window context to access __mol3d
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

// BluePrint mode toggle
document.getElementById('btn-blueprint-mode').addEventListener('click', () => {
  blueprintMode = !blueprintMode;
  document.getElementById('btn-blueprint-mode').classList.toggle('active', blueprintMode);
  document.getElementById('blueprint-toolbar').hidden = !blueprintMode;
  document.getElementById('blueprint-canvas').style.display = blueprintMode ? 'block' : 'none';
  renderer.domElement.style.display = blueprintMode ? 'none' : 'block';
  
  const modeIndicator = document.getElementById('mode-indicator');
  if (blueprintMode) {
    modeIndicator.textContent = 'BluePrint';
    modeIndicator.classList.add('blueprint');
    document.title = 'Molecule Builder BluePrint';
    initBlueprintCanvas();
    clearBlueprintCanvas();
    renderBlueprintScene();
  } else {
    modeIndicator.textContent = '3D';
    modeIndicator.classList.remove('blueprint');
    document.title = 'Molecule Builder 3D';
  }
  
  status(blueprintMode ? 'BluePrint mode ON — 2D molecule builder' : 'BluePrint mode OFF — 3D visualization');
  invalidate();
});

// BluePrint toolbar handlers
function updateBlueprintElementDisplay() {
  const display = document.getElementById('bp-element-display');
  if (display) display.textContent = blueprintCurrentElement;
}

document.getElementById('bp-select').addEventListener('click', () => setBlueprintTool('select'));
document.getElementById('bp-eraser').addEventListener('click', () => setBlueprintTool('eraser'));
document.getElementById('bp-bracket').addEventListener('click', () => setBlueprintTool('bracket'));
document.getElementById('bp-bond-single').addEventListener('click', () => setBlueprintTool('bond-single'));
document.getElementById('bp-bond-double').addEventListener('click', () => setBlueprintTool('bond-double'));
document.getElementById('bp-bond-triple').addEventListener('click', () => setBlueprintTool('bond-triple'));
document.getElementById('bp-bond-coordinate').addEventListener('click', () => setBlueprintTool('bond-coordinate'));
document.getElementById('bp-electron').addEventListener('click', () => setBlueprintTool('electron'));
document.getElementById('bp-to-3d').addEventListener('click', () => exportBlueprintTo3D());
document.getElementById('bp-export-png').addEventListener('click', () => exportBlueprintPNG());
document.getElementById('bp-clear').addEventListener('click', () => clearBlueprintCanvas());
document.getElementById('bp-undo').addEventListener('click', () => blueprintUndo());
document.getElementById('bp-redo').addEventListener('click', () => blueprintRedo());
document.getElementById('bp-clean').addEventListener('click', () => blueprintCleanLayout());
document.getElementById('bp-center').addEventListener('click', () => blueprintZoomToFit());
document.getElementById('bp-mode-structural').addEventListener('click', () => setBlueprintViewMode('structural'));
document.getElementById('bp-mode-bohr').addEventListener('click', () => setBlueprintViewMode('bohr'));

document.getElementById('bp-grid').addEventListener('click', () => {
  blueprintGridSnap = !blueprintGridSnap;
  document.getElementById('bp-grid').classList.toggle('active', blueprintGridSnap);
  status(`Grid snap: ${blueprintGridSnap ? 'ON' : 'OFF'}`);
});

document.getElementById('bp-add-h').addEventListener('click', () => {
  blueprintAutoHydrogen = !blueprintAutoHydrogen;
  document.getElementById('bp-add-h').classList.toggle('active', blueprintAutoHydrogen);
  if (blueprintAutoHydrogen) {
    blueprintAddHydrogens();
    status('Auto-added hydrogens to satisfy valences');
  } else {
    status('Auto-hydrogen OFF');
  }
});

function setBlueprintTool(tool) {
  blueprintTool = tool;
  blueprintSelectedAtoms.clear();
  document.querySelectorAll('.bp-tool').forEach(btn => btn.classList.remove('active'));
  const toolBtn = document.getElementById(`bp-${tool}`);
  if (toolBtn) toolBtn.classList.add('active');

  const toolNames = {
    'select': 'Select — click atom to select, drag to move. Click bond to cycle order.',
    'eraser': 'Eraser — click atom or bond to delete',
    'bracket': 'Brackets — click transition metal for auto-detect, or click 2 atoms for manual group',
    'bond-single': 'Single bond — drag from atom to atom',
    'bond-double': 'Double bond — drag from atom to atom',
    'bond-triple': 'Triple bond — drag from atom to atom',
    'bond-coordinate': 'Coordinate bond — drag from donor to acceptor',
    'electron': 'Electron shells — click atom to show configuration',
  };
  status(toolNames[tool] || `Tool: ${tool}`);
  const canvas = document.getElementById('blueprint-canvas');
  if (canvas) canvas.style.cursor = tool === 'eraser' ? 'crosshair' : 'default';
}

function setBlueprintViewMode(mode) {
  blueprintViewMode = mode;
  document.querySelectorAll('[id^="bp-mode-"]').forEach(btn => btn.classList.remove('active'));
  const modeBtn = document.getElementById(`bp-mode-${mode}`);
  if (modeBtn) modeBtn.classList.add('active');
  renderBlueprintScene();
  status(`View: ${mode}`);
}

function autoDetectCoordinationComplexes() {
  const transitionMetals = new Set(['Fe', 'Cu', 'Zn', 'Ag', 'Au', 'Pt', 'Pd', 'Ni', 'Co', 'Cr', 'Mn', 'V', 'Ti', 'Mo', 'W', 'Ru', 'Rh', 'Ir', 'Os']);

  for (const [id, atom] of blueprintCanvasAtoms) {
    if (!transitionMetals.has(atom.el.sym)) continue;

    const ligandIds = new Set();
    for (const [, bond] of blueprintCanvasBonds) {
      if (bond.a === id) ligandIds.add(bond.b);
      if (bond.b === id) ligandIds.add(bond.a);
    }

    if (ligandIds.size > 0) {
      const groupAtoms = [id, ...ligandIds];
      const groupKey = groupAtoms.sort((a, b) => a - b).join(',');
      blueprintBrackets.set(groupKey, groupAtoms);
    }
  }
}

function initBlueprintCanvas() {
  const canvas = document.getElementById('blueprint-canvas');
  const wrap = document.getElementById('scene-wrap');
  canvas.width = wrap.clientWidth;
  canvas.height = wrap.clientHeight;
  
  canvas.addEventListener('mousedown', handleBlueprintMouseDown);
  canvas.addEventListener('mousemove', handleBlueprintMouseMove);
  canvas.addEventListener('mouseup', handleBlueprintMouseUp);
  canvas.addEventListener('click', handleBlueprintClick);
  canvas.addEventListener('wheel', handleBlueprintWheel, { passive: false });
}

function handleBlueprintMouseDown(e) {
  const canvas = document.getElementById('blueprint-canvas');
  const rect = canvas.getBoundingClientRect();
  const screenX = e.clientX - rect.left;
  const screenY = e.clientY - rect.top;
  
  // Middle mouse button or space+click for panning
  if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
    blueprintIsPanning = true;
    blueprintPanStart = { x: e.clientX - blueprintPan.x, y: e.clientY - blueprintPan.y };
    canvas.style.cursor = 'grabbing';
    e.preventDefault();
    return;
  }
  
  // Convert screen to canvas coordinates
  const canvasX = (screenX - blueprintPan.x) / blueprintZoom;
  const canvasY = (screenY - blueprintPan.y) / blueprintZoom;
  
  const clickedAtom = findBlueprintCanvasAtomAt(canvasX, canvasY);
  blueprintMouseDownPlaced = false;

  if (blueprintTool === 'eraser') {
    if (clickedAtom) {
      blueprintPushUndo();
      for (const [bondId, bond] of blueprintCanvasBonds) {
        if (bond.a === clickedAtom.id || bond.b === clickedAtom.id) blueprintCanvasBonds.delete(bondId);
      }
      blueprintCanvasAtoms.delete(clickedAtom.id);
      blueprintAtomPositions.delete(clickedAtom.id);
      blueprintSelectedAtoms.delete(clickedAtom.id);
      status(`Erased ${clickedAtom.el.sym}`);
    } else {
      const clickedBond = findBlueprintCanvasBondAt(canvasX, canvasY);
      if (clickedBond) {
        blueprintPushUndo();
        blueprintCanvasBonds.delete(clickedBond.id);
        status('Erased bond');
      }
    }
  } else if (blueprintTool === 'select') {
    if (clickedAtom) {
      blueprintDragAtom = clickedAtom;
      const pos = blueprintAtomPositions.get(clickedAtom.id);
      blueprintDragOffset = { x: canvasX - pos.x, y: canvasY - pos.y };
    } else {
      const snappedX = blueprintGridSnap ? Math.round(canvasX / 40) * 40 : canvasX;
      const snappedY = blueprintGridSnap ? Math.round(canvasY / 40) * 40 : canvasY;
      placeBlueprintAtom(snappedX, snappedY);
      blueprintMouseDownPlaced = true;
    }
  } else if (blueprintTool.startsWith('bond-')) {
    if (clickedAtom) {
      // Start drag-to-bond from this atom
      blueprintBondDrag = { startAtom: clickedAtom, startX: canvasX, startY: canvasY };
    } else {
      // Click on empty space with bond tool - place atom and start bond
      const newAtom = placeBlueprintAtom(canvasX, canvasY);
      if (newAtom) {
        blueprintBondDrag = { startAtom: newAtom, startX: canvasX, startY: canvasY };
        blueprintMouseDownPlaced = true;
      }
    }
  } else if (blueprintTool === 'bracket') {
    if (clickedAtom) {
      toggleBlueprintBracket(clickedAtom);
    }
  } else if (blueprintTool === 'electron') {
    if (clickedAtom) {
      showBlueprintElectrons(clickedAtom);
    }
  }
  
  renderBlueprintScene();
}

function handleBlueprintMouseMove(e) {
  if (blueprintIsPanning) {
    blueprintPan.x = e.clientX - blueprintPanStart.x;
    blueprintPan.y = e.clientY - blueprintPanStart.y;
    renderBlueprintScene();
    return;
  }
  
  if (blueprintDragAtom && blueprintTool === 'select') {
    const canvas = document.getElementById('blueprint-canvas');
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const canvasX = (screenX - blueprintPan.x) / blueprintZoom;
    const canvasY = (screenY - blueprintPan.y) / blueprintZoom;

    let finalX = canvasX - blueprintDragOffset.x;
    let finalY = canvasY - blueprintDragOffset.y;
    if (blueprintGridSnap) {
      finalX = Math.round(finalX / 40) * 40;
      finalY = Math.round(finalY / 40) * 40;
    }

    blueprintAtomPositions.set(blueprintDragAtom.id, { x: finalX, y: finalY });
    renderBlueprintScene();
  }
  
  if (blueprintBondDrag) {
    renderBlueprintScene();
    // Draw preview bond line
    const canvas = document.getElementById('blueprint-canvas');
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    
    const startPos = blueprintAtomPositions.get(blueprintBondDrag.startAtom.id);
    ctx.save();
    ctx.translate(blueprintPan.x, blueprintPan.y);
    ctx.scale(blueprintZoom, blueprintZoom);
    ctx.strokeStyle = '#58a6ff';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(startPos.x, startPos.y);
    const endX = (screenX - blueprintPan.x) / blueprintZoom;
    const endY = (screenY - blueprintPan.y) / blueprintZoom;
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
}

function handleBlueprintMouseUp(e) {
  if (blueprintIsPanning) {
    blueprintIsPanning = false;
    const canvas = document.getElementById('blueprint-canvas');
    canvas.style.cursor = 'default';
    return;
  }
  
  if (blueprintDragAtom && blueprintTool === 'select') {
    blueprintDragAtom = null;
  }
  
  if (blueprintBondDrag) {
    const canvas = document.getElementById('blueprint-canvas');
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const canvasX = (screenX - blueprintPan.x) / blueprintZoom;
    const canvasY = (screenY - blueprintPan.y) / blueprintZoom;
    
    const endAtom = findBlueprintCanvasAtomAt(canvasX, canvasY);
    
    if (endAtom && endAtom.id !== blueprintBondDrag.startAtom.id) {
      // Create bond between start and end atoms
      createBlueprintBond(blueprintBondDrag.startAtom.id, endAtom.id);
    } else if (!blueprintMouseDownPlaced) {
      // Only place new atom if one wasn't already placed in mousedown
      let snappedX = canvasX;
      let snappedY = canvasY;
      if (blueprintGridSnap) {
        snappedX = Math.round(snappedX / 40) * 40;
        snappedY = Math.round(snappedY / 40) * 40;
      }
      const newAtom = placeBlueprintAtom(snappedX, snappedY);
      if (newAtom) {
        createBlueprintBond(blueprintBondDrag.startAtom.id, newAtom.id);
      }
    }
    
    blueprintBondDrag = null;
    renderBlueprintScene();
  }
}

function handleBlueprintWheel(e) {
  e.preventDefault();
  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  blueprintZoom = Math.max(0.3, Math.min(3.0, blueprintZoom * delta));
  renderBlueprintScene();
}

function handleBlueprintClick(e) {
  const canvas = document.getElementById('blueprint-canvas');
  const rect = canvas.getBoundingClientRect();
  const screenX = e.clientX - rect.left;
  const screenY = e.clientY - rect.top;

  const canvasX = (screenX - blueprintPan.x) / blueprintZoom;
  const canvasY = (screenY - blueprintPan.y) / blueprintZoom;
  const clickedAtom = findBlueprintCanvasAtomAt(canvasX, canvasY);

  if (!clickedAtom) {
    if (blueprintTool === 'select') {
      const clickedBond = findBlueprintCanvasBondAt(canvasX, canvasY);
      if (clickedBond) {
        let newOrder;
        if (clickedBond.order === 0) newOrder = 'delete';
        else if (clickedBond.order === 1) newOrder = 2;
        else if (clickedBond.order === 2) newOrder = 3;
        else if (clickedBond.order === 3) newOrder = 2;

        if (newOrder === 'delete') {
          blueprintPushUndo();
          blueprintCanvasBonds.delete(clickedBond.id);
          status('Bond removed');
        } else {
          const testBond = { ...clickedBond, order: newOrder };
          const up = upgradeCheck(blueprintCanvasAtoms, blueprintCanvasBonds, testBond);
          if (!up.ok) { status(trReason(up.reason), 'err'); renderBlueprintScene(); return; }
          blueprintPushUndo();
          clickedBond.order = newOrder;
          status(`Bond → ${newOrder === 2 ? 'double' : 'triple'}`);
        }
        renderBlueprintScene();
        return;
      }
    }
    blueprintSelectedAtoms.clear();
    renderBlueprintScene();
    return;
  }

  switch (blueprintTool) {
    case 'select':
      if (e.ctrlKey || e.metaKey) {
        if (blueprintSelectedAtoms.has(clickedAtom.id)) {
          blueprintSelectedAtoms.delete(clickedAtom.id);
        } else {
          blueprintSelectedAtoms.add(clickedAtom.id);
        }
      } else {
        blueprintSelectedAtoms.clear();
        blueprintSelectedAtoms.add(clickedAtom.id);
        selectAtom(clickedAtom.id);
      }
      break;
      
    case 'bracket':
      toggleBlueprintBracket(clickedAtom);
      break;

    case 'electron':
      showBlueprintElectrons(clickedAtom);
      break;
  }
  
  renderBlueprintScene();
}

function findBond(atomId1, atomId2) {
  for (const [bondId, bond] of bonds) {
    if ((bond.a === atomId1 && bond.b === atomId2) ||
        (bond.a === atomId2 && bond.b === atomId1)) {
      return bond;
    }
  }
  return null;
}

function toggleBlueprintBracket(atom) {
  const isTransitionMetal = ['Fe', 'Cu', 'Zn', 'Ag', 'Au', 'Pt', 'Pd', 'Ni', 'Co', 'Cr', 'Mn', 'V', 'Ti', 'Mo', 'W', 'Ru', 'Rh', 'Ir', 'Os'].includes(atom.el.sym);

  if (isTransitionMetal) {
    const ligandIds = new Set();
    for (const [, bond] of blueprintCanvasBonds) {
      if (bond.a === atom.id) ligandIds.add(bond.b);
      if (bond.b === atom.id) ligandIds.add(bond.a);
    }

    if (ligandIds.size > 0) {
      const groupAtoms = [atom.id, ...ligandIds];
      const groupKey = groupAtoms.sort((a, b) => a - b).join(',');

      if (blueprintBrackets.has(groupKey)) {
        blueprintBrackets.delete(groupKey);
        status('Coordination complex bracket removed');
      } else {
        blueprintBrackets.set(groupKey, groupAtoms);
        status(`Coordination complex: [${atom.el.sym}(${ligandIds.size} ligands)]`);
      }
      return;
    }
  }

  if (blueprintSelectedAtoms.has(atom.id)) {
    blueprintSelectedAtoms.delete(atom.id);
  } else {
    blueprintSelectedAtoms.add(atom.id);
  }

  if (blueprintSelectedAtoms.size >= 2) {
    const groupKey = [...blueprintSelectedAtoms].sort((a, b) => a - b).join(',');
    if (blueprintBrackets.has(groupKey)) {
      blueprintBrackets.delete(groupKey);
      status('Bracket group removed');
    } else {
      blueprintBrackets.set(groupKey, [...blueprintSelectedAtoms]);
      status(`Bracket group: ${blueprintSelectedAtoms.size} atoms`);
    }
    blueprintSelectedAtoms.clear();
  } else {
    status(`Selected ${blueprintSelectedAtoms.size}/2 atoms for bracket`);
  }
}

function showBlueprintElectrons(atom) {
  status(`Electron config: ${atom.el.sym} - ${ELECTRON_CONFIGS[atom.el.sym]?.join(', ') || 'Unknown'}`);
}

function findBlueprintCanvasAtomAt(canvasX, canvasY) {
  const atomRadius = 20;
  
  for (const [id, atom] of blueprintCanvasAtoms) {
    const pos = blueprintAtomPositions.get(id);
    if (!pos) continue;
    
    const dx = pos.x - canvasX;
    const dy = pos.y - canvasY;
    if (dx * dx + dy * dy < atomRadius * atomRadius) {
      return atom;
    }
  }
  return null;
}

function placeBlueprintAtom(x, y) {
  const el = elementBySym(blueprintCurrentElement);
  if (!el) return null;

  blueprintPushUndo();
  const id = blueprintNextId++;
  const atom = { id, el, pos: { x: 0, y: 0, z: 0 } };
  blueprintCanvasAtoms.set(id, atom);
  blueprintAtomPositions.set(id, { x, y });

  status(`Placed ${el.sym} on canvas`);
  return atom;
}

function findBlueprintCanvasBond(id1, id2) {
  for (const [bondId, bond] of blueprintCanvasBonds) {
    if ((bond.a === id1 && bond.b === id2) || (bond.a === id2 && bond.b === id1)) {
      return bond;
    }
  }
  return null;
}

function createBlueprintBond(id1, id2) {
  if (id1 === id2) return;
  const existing = findBlueprintCanvasBond(id1, id2);
  const targetOrder = blueprintTool === 'bond-single' ? 1 :
                      blueprintTool === 'bond-double' ? 2 :
                      blueprintTool === 'bond-triple' ? 3 :
                      blueprintTool === 'bond-coordinate' ? 0 : 1;

  const a1 = blueprintCanvasAtoms.get(id1);
  const a2 = blueprintCanvasAtoms.get(id2);
  if (!a1 || !a2) return;

  if (existing) {
    if (existing.order === targetOrder) {
      blueprintPushUndo();
      blueprintCanvasBonds.delete(existing.id);
      status('Bond removed');
    } else {
      if (targetOrder > 0) {
        const testBond = { ...existing, order: targetOrder };
        const up = upgradeCheck(blueprintCanvasAtoms, blueprintCanvasBonds, testBond);
        if (!up.ok) { status(trReason(up.reason), 'err'); return; }
      }
      blueprintPushUndo();
      existing.order = targetOrder;
      status(`Bond order: ${targetOrder === 0 ? 'coordinate' : targetOrder}`);
    }
  } else {
    const chk = bondCheck(blueprintCanvasAtoms, blueprintCanvasBonds, id1, id2);
    if (!chk.ok) { status(trReason(chk.reason), 'err'); return; }

    if (targetOrder > 1) {
      const tempBond = { id: -1, a: id1, b: id2, order: targetOrder, ionic: false };
      const up = upgradeCheck(blueprintCanvasAtoms, blueprintCanvasBonds, tempBond);
      if (!up.ok) { status(trReason(up.reason), 'err'); return; }
    }

    blueprintPushUndo();
    const bondId = blueprintNextId++;
    blueprintCanvasBonds.set(bondId, { id: bondId, a: id1, b: id2, order: targetOrder, ionic: false });
    const sym1 = a1.el.sym;
    const sym2 = a2.el.sym;
    status(`Bond: ${sym1} ${targetOrder === 0 ? '←' : targetOrder === 1 ? '─' : targetOrder === 2 ? '═' : '≡'} ${sym2}`);
  }
}

function exportBlueprintTo3D() {
  if (blueprintCanvasAtoms.size === 0) {
    status('Nothing to export — place atoms on the canvas first', 'err');
    return;
  }
  
  // Map canvas atom IDs to 3D scene atom IDs
  const idMap = new Map();
  const canvasCenter = { x: 0, y: 0 };
  
  // Calculate center of canvas atoms
  for (const [id] of blueprintCanvasAtoms) {
    const pos = blueprintAtomPositions.get(id);
    if (pos) { canvasCenter.x += pos.x; canvasCenter.y += pos.y; }
  }
  canvasCenter.x /= blueprintCanvasAtoms.size || 1;
  canvasCenter.y /= blueprintCanvasAtoms.size || 1;
  
  // Create 3D atoms from canvas atoms
  for (const [canvasId, atom] of blueprintCanvasAtoms) {
    const pos = blueprintAtomPositions.get(canvasId);
    const x3d = (pos ? pos.x - canvasCenter.x : 0) / 40;
    const z3d = (pos ? -(pos.y - canvasCenter.y) : 0) / 40;
    const id3d = spawnAtom(atom.el);
    if (id3d !== undefined) {
      const a = atoms.get(id3d);
      if (a) { a.pos.x = x3d; a.pos.y = 0; a.pos.z = z3d; }
      idMap.set(canvasId, id3d);
    }
  }
  
  // Create 3D bonds from canvas bonds
  for (const [canvasBondId, bond] of blueprintCanvasBonds) {
    const id3dA = idMap.get(bond.a);
    const id3dB = idMap.get(bond.b);
    if (id3dA !== undefined && id3dB !== undefined) {
      createBond(id3dA, id3dB);
      // Set bond order
      if (bond.order !== 1) {
        const newBond = findBond(id3dA, id3dB);
        if (newBond) setBondOrder(newBond.id, bond.order === 0 ? 1 : bond.order);
      }
    }
  }
  
  // Clear canvas
  clearBlueprintCanvas();
  
  // Switch to 3D mode
  blueprintMode = false;
  document.getElementById('btn-blueprint-mode').classList.remove('active');
  document.getElementById('blueprint-toolbar').hidden = true;
  document.getElementById('blueprint-canvas').style.display = 'none';
  document.getElementById('mode-indicator').textContent = '3D';
  document.getElementById('mode-indicator').classList.remove('blueprint');
  document.title = 'Molecule Builder 3D';
  renderer.domElement.style.display = 'block';
  
  invalidate();
  status('Exported to 3D scene!');
}

function clearBlueprintCanvas() {
  blueprintPushUndo();
  blueprintCanvasAtoms.clear();
  blueprintCanvasBonds.clear();
  blueprintAtomPositions.clear();
  blueprintSelectedAtoms.clear();
  blueprintBrackets.clear();
  blueprintPan = { x: 0, y: 0 };
  blueprintZoom = 1.0;
  blueprintUndoStack = [];
  blueprintRedoStack = [];
  renderBlueprintScene();
  status('Canvas cleared');
}

function blueprintPushUndo() {
  const state = {
    atoms: new Map(),
    bonds: new Map(),
    positions: new Map(),
    brackets: new Map(),
  };
  for (const [id, atom] of blueprintCanvasAtoms) {
    state.atoms.set(id, { id, el: atom.el, pos: { ...atom.pos } });
  }
  for (const [id, bond] of blueprintCanvasBonds) {
    state.bonds.set(id, { id, a: bond.a, b: bond.b, order: bond.order, ionic: bond.ionic });
  }
  for (const [id, pos] of blueprintAtomPositions) {
    state.positions.set(id, { ...pos });
  }
  for (const [key, val] of blueprintBrackets) {
    state.brackets.set(key, [...val]);
  }
  blueprintUndoStack.push(state);
  blueprintRedoStack = [];
  if (blueprintUndoStack.length > 50) blueprintUndoStack.shift();
}

function blueprintRestoreState(state) {
  blueprintCanvasAtoms.clear();
  blueprintCanvasBonds.clear();
  blueprintAtomPositions.clear();
  blueprintBrackets.clear();
  for (const [id, atom] of state.atoms) blueprintCanvasAtoms.set(id, { ...atom, el: atom.el, pos: { ...atom.pos } });
  for (const [id, bond] of state.bonds) blueprintCanvasBonds.set(id, { ...bond });
  for (const [id, pos] of state.positions) blueprintAtomPositions.set(id, { ...pos });
  for (const [key, val] of state.brackets) blueprintBrackets.set(key, [...val]);
}

function blueprintUndo() {
  if (blueprintUndoStack.length === 0) { status('Nothing to undo', 'err'); return; }
  const current = {
    atoms: new Map(), bonds: new Map(), positions: new Map(), brackets: new Map(),
  };
  for (const [id, atom] of blueprintCanvasAtoms) current.atoms.set(id, { id, el: atom.el, pos: { ...atom.pos } });
  for (const [id, bond] of blueprintCanvasBonds) current.bonds.set(id, { id, a: bond.a, b: bond.b, order: bond.order, ionic: bond.ionic });
  for (const [id, pos] of blueprintAtomPositions) current.positions.set(id, { ...pos });
  for (const [key, val] of blueprintBrackets) current.brackets.set(key, [...val]);
  blueprintRedoStack.push(current);
  const prev = blueprintUndoStack.pop();
  blueprintRestoreState(prev);
  renderBlueprintScene();
  status('Undo');
}

function blueprintRedo() {
  if (blueprintRedoStack.length === 0) { status('Nothing to redo', 'err'); return; }
  const current = {
    atoms: new Map(), bonds: new Map(), positions: new Map(), brackets: new Map(),
  };
  for (const [id, atom] of blueprintCanvasAtoms) current.atoms.set(id, { id, el: atom.el, pos: { ...atom.pos } });
  for (const [id, bond] of blueprintCanvasBonds) current.bonds.set(id, { id, a: bond.a, b: bond.b, order: bond.order, ionic: bond.ionic });
  for (const [id, pos] of blueprintAtomPositions) current.positions.set(id, { ...pos });
  for (const [key, val] of blueprintBrackets) current.brackets.set(key, [...val]);
  blueprintUndoStack.push(current);
  const next = blueprintRedoStack.pop();
  blueprintRestoreState(next);
  renderBlueprintScene();
  status('Redo');
}

function blueprintCleanLayout() {
  if (blueprintCanvasAtoms.size === 0) return;
  blueprintPushUndo();
  const bondLen = 80;
  const placed = new Set();
  const queue = [];
  const startId = blueprintCanvasAtoms.keys().next().value;
  queue.push(startId);
  placed.add(startId);
  blueprintAtomPositions.set(startId, { x: 0, y: 0 });

  while (queue.length > 0) {
    const currentId = queue.shift();
    const currentPos = blueprintAtomPositions.get(currentId);
    const neighbors = [];
    for (const [, bond] of blueprintCanvasBonds) {
      if (bond.a === currentId && !placed.has(bond.b)) { neighbors.push(bond.b); placed.add(bond.b); blueprintAtomPositions.set(bond.b, { x: 0, y: 0 }); queue.push(bond.b); }
      if (bond.b === currentId && !placed.has(bond.a)) { neighbors.push(bond.a); placed.add(bond.a); blueprintAtomPositions.set(bond.a, { x: 0, y: 0 }); queue.push(bond.a); }
    }
    const count = neighbors.length;
    if (count === 0) continue;
    const existingNeighbors = [];
    for (const [, bond] of blueprintCanvasBonds) {
      if (bond.a === currentId && placed.has(bond.b) && bond.b !== currentId) existingNeighbors.push(bond.b);
      if (bond.b === currentId && placed.has(bond.a) && bond.a !== currentId) existingNeighbors.push(bond.a);
    }
    let baseAngle = 0;
    if (existingNeighbors.length > 0) {
      const lastPlaced = existingNeighbors.find(id => blueprintAtomPositions.has(id));
      if (lastPlaced !== undefined) {
        const lp = blueprintAtomPositions.get(lastPlaced);
        baseAngle = Math.atan2(lp.y - currentPos.y, lp.x - currentPos.x) + Math.PI;
      }
    }
    const spread = count === 1 ? 0 : (2 * Math.PI) / count;
    const startAngle = count === 1 ? baseAngle : baseAngle - spread * (count - 1) / 2;
    neighbors.forEach((nId, i) => {
      const angle = startAngle + i * spread;
      blueprintAtomPositions.set(nId, {
        x: Math.round((currentPos.x + Math.cos(angle) * bondLen) / 40) * 40,
        y: Math.round((currentPos.y + Math.sin(angle) * bondLen) / 40) * 40,
      });
    });
  }

  for (const [id] of blueprintCanvasAtoms) {
    if (!placed.has(id)) {
      const angle = Math.random() * Math.PI * 2;
      blueprintAtomPositions.set(id, { x: Math.round(Math.cos(angle) * 200 / 40) * 40, y: Math.round(Math.sin(angle) * 200 / 40) * 40 });
    }
  }
  blueprintZoomToFit();
  status('Layout cleaned');
}

function blueprintZoomToFit() {
  if (blueprintCanvasAtoms.size === 0) {
    blueprintPan = { x: 0, y: 0 };
    blueprintZoom = 1.0;
    renderBlueprintScene();
    return;
  }
  const canvas = document.getElementById('blueprint-canvas');
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [id] of blueprintCanvasAtoms) {
    const pos = blueprintAtomPositions.get(id);
    if (!pos) continue;
    minX = Math.min(minX, pos.x); minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x); maxY = Math.max(maxY, pos.y);
  }
  if (minX === Infinity) return;
  const padding = 80;
  const w = maxX - minX + padding * 2 || 1;
  const h = maxY - minY + padding * 2 || 1;
  const zoomX = canvas.width / w;
  const zoomY = canvas.height / h;
  blueprintZoom = Math.min(zoomX, zoomY, 3.0);
  blueprintZoom = Math.max(blueprintZoom, 0.3);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  blueprintPan.x = canvas.width / 2 - centerX * blueprintZoom;
  blueprintPan.y = canvas.height / 2 - centerY * blueprintZoom;
  renderBlueprintScene();
}

function blueprintAddHydrogens() {
  blueprintPushUndo();
  const prevElement = blueprintCurrentElement;
  blueprintCurrentElement = 'H';
  const toAdd = [];
  for (const [id, atom] of blueprintCanvasAtoms) {
    const pos = blueprintAtomPositions.get(id);
    if (!pos) continue;
    let bondSum = 0;
    for (const [, bond] of blueprintCanvasBonds) {
      if (bond.a === id || bond.b === id) bondSum += Math.max(bond.order, 1);
    }
    const needed = atom.el.maxBonds - bondSum;
    if (needed <= 0) continue;
    const hEl = elementBySym('H');
    if (!hEl) continue;
    const existingBonds = [];
    for (const [, bond] of blueprintCanvasBonds) {
      if (bond.a === id) existingBonds.push(bond.b);
      if (bond.b === id) existingBonds.push(bond.a);
    }
    const spread = (2 * Math.PI) / Math.max(needed, existingBonds.length + needed);
    let startAngle = 0;
    if (existingBonds.length > 0) {
      const firstNeighbor = blueprintAtomPositions.get(existingBonds[0]);
      if (firstNeighbor) startAngle = Math.atan2(firstNeighbor.y - pos.y, firstNeighbor.x - pos.x) + Math.PI;
    }
    for (let i = 0; i < needed; i++) {
      const angle = startAngle + (i + 1) * spread;
      const hx = Math.round((pos.x + Math.cos(angle) * 80) / 40) * 40;
      const hy = Math.round((pos.y + Math.sin(angle) * 80) / 40) * 40;
      toAdd.push({ x: hx, y: hy, parentId: id });
    }
  }
  for (const h of toAdd) {
    const hAtom = placeBlueprintAtom(h.x, h.y);
    if (hAtom) {
      createBlueprintBond(h.parentId, hAtom.id);
    }
  }
  blueprintCurrentElement = prevElement;
  updateBlueprintElementDisplay();
  renderBlueprintScene();
  if (toAdd.length > 0) status(`Added ${toAdd.length} hydrogen atoms`);
  else status('No hydrogens needed');
}

function exportBlueprintPNG() {
  const srcCanvas = document.getElementById('blueprint-canvas');
  const link = document.createElement('a');
  link.download = 'molecule-blueprint.png';
  link.href = srcCanvas.toDataURL('image/png');
  link.click();
  status('Exported PNG');
}

function findBlueprintCanvasBondAt(canvasX, canvasY) {
  const threshold = 10;
  for (const [bondId, bond] of blueprintCanvasBonds) {
    const pos1 = blueprintAtomPositions.get(bond.a);
    const pos2 = blueprintAtomPositions.get(bond.b);
    if (!pos1 || !pos2) continue;
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) continue;
    let t = ((canvasX - pos1.x) * dx + (canvasY - pos1.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const projX = pos1.x + t * dx;
    const projY = pos1.y + t * dy;
    const distSq = (canvasX - projX) ** 2 + (canvasY - projY) ** 2;
    if (distSq < threshold * threshold) return bond;
  }
  return null;
}

function renderBlueprintScene() {
  if (!blueprintMode) return;
  
  const canvas = document.getElementById('blueprint-canvas');
  const ctx = canvas.getContext('2d');
  
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Apply pan and zoom transformations
  ctx.save();
  ctx.translate(blueprintPan.x, blueprintPan.y);
  ctx.scale(blueprintZoom, blueprintZoom);
  
  // Draw grid
  drawBlueprintGrid(ctx, canvas);
  
  // Draw brackets first (behind everything)
  drawBlueprintBrackets(ctx);
  
  // Draw bonds
  drawBlueprintBonds(ctx);
  
  // Draw atoms
  drawBlueprintAtoms(ctx);
  
  // Draw electron shells if in bohr mode or electron tool active
  if (blueprintViewMode === 'bohr' || blueprintTool === 'electron') {
    drawBlueprintElectrons(ctx);
  }
  
  // Draw selection highlights
  drawBlueprintSelection(ctx);
  
  ctx.restore();
}

function drawBlueprintGrid(ctx, canvas) {
  if (!blueprintGridSnap) return;
  ctx.strokeStyle = 'rgba(88, 166, 255, 0.08)';
  ctx.lineWidth = 1;

  const gridSize = 40;
  const startX = Math.floor(-blueprintPan.x / blueprintZoom / gridSize) * gridSize - gridSize;
  const startY = Math.floor(-blueprintPan.y / blueprintZoom / gridSize) * gridSize - gridSize;
  const endX = startX + canvas.width / blueprintZoom + gridSize * 2;
  const endY = startY + canvas.height / blueprintZoom + gridSize * 2;

  for (let x = startX; x <= endX; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, startY);
    ctx.lineTo(x, endY);
    ctx.stroke();
  }
  for (let y = startY; y <= endY; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
    ctx.stroke();
  }
}

function drawBlueprintBrackets(ctx) {
  for (const [groupKey, atomIds] of blueprintBrackets) {
    // Calculate bounding box of all atoms in the group
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    for (const atomId of atomIds) {
      const pos = blueprintAtomPositions.get(atomId);
      if (!pos) continue;
      
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x);
      maxY = Math.max(maxY, pos.y);
    }
    
    if (minX === Infinity) continue;
    
    // Add padding
    const padding = 40;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;
    
    // Draw bracket rectangle
    ctx.strokeStyle = '#ffa657';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
    ctx.setLineDash([]);
    
    // Draw bracket symbols on left and right
    const bracketHeight = maxY - minY;
    const bracketWidth = 15;
    const midY = (minY + maxY) / 2;
    
    ctx.strokeStyle = '#ffa657';
    ctx.lineWidth = 4;
    ctx.setLineDash([]);
    
    // Left bracket [
    ctx.beginPath();
    ctx.moveTo(minX - bracketWidth, minY);
    ctx.lineTo(minX - bracketWidth - 10, minY);
    ctx.lineTo(minX - bracketWidth - 10, maxY);
    ctx.lineTo(minX - bracketWidth, maxY);
    ctx.stroke();
    
    // Right bracket ]
    ctx.beginPath();
    ctx.moveTo(maxX + bracketWidth, minY);
    ctx.lineTo(maxX + bracketWidth + 10, minY);
    ctx.lineTo(maxX + bracketWidth + 10, maxY);
    ctx.lineTo(maxX + bracketWidth, maxY);
    ctx.stroke();
  }
}

function drawBlueprintBonds(ctx) {
  for (const [bondId, bond] of blueprintCanvasBonds) {
    const pos1 = blueprintAtomPositions.get(bond.a);
    const pos2 = blueprintAtomPositions.get(bond.b);
    if (!pos1 || !pos2) continue;
    
    const order = bond.order;
    ctx.strokeStyle = '#58a6ff';
    
    if (order === 0) {
      // Coordinate bond - dashed line with arrow
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pos1.x, pos1.y);
      ctx.lineTo(pos2.x, pos2.y);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Arrowhead
      const angle = Math.atan2(pos2.y - pos1.y, pos2.x - pos1.x);
      const arrowSize = 10;
      ctx.beginPath();
      ctx.moveTo(pos2.x, pos2.y);
      ctx.lineTo(pos2.x - arrowSize * Math.cos(angle - Math.PI/6), pos2.y - arrowSize * Math.sin(angle - Math.PI/6));
      ctx.lineTo(pos2.x - arrowSize * Math.cos(angle + Math.PI/6), pos2.y - arrowSize * Math.sin(angle + Math.PI/6));
      ctx.closePath();
      ctx.fillStyle = '#58a6ff';
      ctx.fill();
    } else {
      const offset = order === 1 ? 0 : order === 2 ? 4 : 6;
      ctx.lineWidth = order === 1 ? 2 : order === 2 ? 2 : 2;
      
      if (order === 1) {
        ctx.beginPath();
        ctx.moveTo(pos1.x, pos1.y);
        ctx.lineTo(pos2.x, pos2.y);
        ctx.stroke();
      } else {
        // Multiple parallel lines
        const angle = Math.atan2(pos2.y - pos1.y, pos2.x - pos1.x);
        const perpX = -Math.sin(angle) * 3;
        const perpY = Math.cos(angle) * 3;
        
        for (let i = 0; i < order; i++) {
          const off = (i - (order - 1) / 2) * 6;
          ctx.beginPath();
          ctx.moveTo(pos1.x + perpX * off / 3, pos1.y + perpY * off / 3);
          ctx.lineTo(pos2.x + perpX * off / 3, pos2.y + perpY * off / 3);
          ctx.stroke();
        }
      }
    }
  }
}

function drawBlueprintAtoms(ctx) {
  const CPK = {
    'alkali': '#ff6b6b', 'alkaline': '#ffa657', 'transition': '#d2a8ff',
    'post-transition': '#79c0ff', 'metalloid': '#56d364', 'reactive-nonmetal': '#3fb950',
    'halogen': '#a5d6ff', 'noble': '#bc8cff', 'lanthanide': '#f0883e',
    'actinide': '#db6d28', 'exotic': '#8b949e',
  };

  for (const [id, atom] of blueprintCanvasAtoms) {
    const pos = blueprintAtomPositions.get(id);
    if (!pos) continue;

    const isSelected = blueprintSelectedAtoms.has(id);
    const catColor = CPK[atom.el.cat] || '#ffffff';

    ctx.fillStyle = isSelected ? '#ffa657' : catColor;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 20, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = isSelected ? '#ffa657' : '#30363d';
    ctx.lineWidth = isSelected ? 3 : 2;
    ctx.stroke();

    const isDark = ['transition', 'lanthanide', 'actinide', 'exotic'].includes(atom.el.cat);
    ctx.fillStyle = isDark && !isSelected ? '#ffffff' : '#000000';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(atom.el.sym, pos.x, pos.y);
  }
}

function drawBlueprintElectrons(ctx) {
  for (const [id, atom] of blueprintCanvasAtoms) {
    const pos = blueprintAtomPositions.get(id);
    if (!pos) continue;
    
    const config = ELECTRON_CONFIGS[atom.el.sym] || [0];
    
    // Draw electron shells
    for (let shell = 0; shell < config.length; shell++) {
      const radius = 30 + shell * 15;
      ctx.strokeStyle = 'rgba(88, 166, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      
      // Draw electrons on shell
      const electrons = config[shell];
      for (let e = 0; e < electrons; e++) {
        const angle = (e / electrons) * Math.PI * 2 - Math.PI / 2;
        const ex = pos.x + Math.cos(angle) * radius;
        const ey = pos.y + Math.sin(angle) * radius;
        
        ctx.fillStyle = '#58a6ff';
        ctx.beginPath();
        ctx.arc(ex, ey, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function drawBlueprintSelection(ctx) {
  for (const atomId of blueprintSelectedAtoms) {
    const pos = blueprintAtomPositions.get(atomId);
    if (!pos) continue;
    
    ctx.strokeStyle = '#ffa657';
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 25, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function exportBlueprint() {
  const canvas = document.getElementById('blueprint-canvas');
  const dataURL = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.download = `blueprint-${Date.now()}.png`;
  link.href = dataURL;
  link.click();
  status('Blueprint exported as PNG');
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
  if (blueprintMode) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); blueprintUndo(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); blueprintRedo(); return; }
    if (e.key.toLowerCase() === 'v') { setBlueprintTool('select'); return; }
    if (e.key.toLowerCase() === 'e') { setBlueprintTool('eraser'); return; }
    if (e.key === '1') { setBlueprintTool('bond-single'); return; }
    if (e.key === '2') { setBlueprintTool('bond-double'); return; }
    if (e.key === '3') { setBlueprintTool('bond-triple'); return; }
    if (e.key === '4') { setBlueprintTool('bond-coordinate'); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (blueprintSelectedAtoms.size > 0) {
        blueprintPushUndo();
        for (const atomId of blueprintSelectedAtoms) {
          for (const [bondId, bond] of blueprintCanvasBonds) {
            if (bond.a === atomId || bond.b === atomId) blueprintCanvasBonds.delete(bondId);
          }
          blueprintCanvasAtoms.delete(atomId);
          blueprintAtomPositions.delete(atomId);
        }
        blueprintSelectedAtoms.clear();
        renderBlueprintScene();
      }
      return;
    }
  }
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
const SHEET_IDS = ['left', 'tab-info', 'tab-dex'];
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

  // Safety: if drag was cleared but controls stayed disabled, re-enable them
  if (!drag && !controls.enabled) {
    controls.enabled = true;
  }

  controls.update();
  let active = false;
  active = movement.update(dt) || active;
  active = updateDrift(dt) || active;
  active = updateLerp(dt) || active;
  updateMayhemParticles(dt);
  updateScreenShake(now);
  if (mayhemParticles.length) active = true;
  if (shakeDuration) active = true;
  if (spawnAnim.size) active = true;
  if (drag) active = true;
  autoTick(now);

  if (needsRender || active) {
    needsRender = false;
    syncInstances();
    updateSprites();
    renderer.render(scene, camera);
  }
}

// ---------------------------------------------------------------------------
// Helper functions for console hack commands
// ---------------------------------------------------------------------------
function computeInitialPositions(atomList) {
  // Place atoms in a reasonable 3D arrangement
  // First atom at center, others distributed around it
  const positions = [];
  const n = atomList.length;
  if (n === 1) {
    positions.push({ x: 0, y: 0, z: 0 });
  } else if (n === 2) {
    positions.push({ x: -0.75, y: 0, z: 0 });
    positions.push({ x: 0.75, y: 0, z: 0 });
  } else {
    // Distribute atoms in 3D space using fibonacci sphere
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
  // Auto-bond atoms based on proximity and valence rules
  // Try to create bonds between nearby atoms
  const maxBondDist = 2.5; // Maximum distance for automatic bonding
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
        // Check if already bonded
        const alreadyBonded = [...bonds.values()].some(
          bond => (bond.a === aId && bond.b === bId) || (bond.a === bId && bond.b === aId)
        );
        if (alreadyBonded) continue;
        // Check distance
        const dist = Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y, a.pos.z - b.pos.z);
        if (dist > maxBondDist) continue;
        // Try to create bond
        const chk = bondCheck(atoms, bonds, aId, bId);
        if (chk.ok) {
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
  kinetics: { createSimulation, compileNetwork, parseRateExpr, rk4Step, arrheniusK, temperatureSweep, R_GAS, DEFAULT_TEMPERATURE, networks: ALL_NETWORKS },
  blueprint: { renderBlueprint, renderReactionBlueprint, BLUEPRINT_MODES, BLUEPRINT_GRID, ELECTRON_CONFIGS },
  analyses: () => analyses,
  comps: () => lastComps,
  spawnAtom, reanalyze, selectAtom, undo, clearAll,
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
  help: () => {
    console.log(`%c🧪 Mol3D Console API`, 'font-size: 16px; font-weight: bold; color: #4CAF50;');
    console.log(`%cState & Inspection:`, 'font-weight: bold; color: #2196F3;');
    console.log(`  __mol3d.status() - Show current app state`);
    console.log(`  __mol3d.listAtoms() - List all atoms`);
    console.log(`  __mol3d.listBonds() - List all bonds`);
    console.log(`  __mol3d.findElement(sym) - Find atoms by element (e.g., 'C', 'O')`);
    console.log(`  __mol3d.analyses() - Get current analyses`);
    console.log(`  __mol3d.comps() - Get current components`);
    console.log(`  __mol3d.discoveries() - Get discovered molecules`);
    console.log(`%cManipulation:`, 'font-weight: bold; color: #2196F3;');
    console.log(`  __mol3d.spawnAtom(el) - Spawn atom (pass element object or symbol)`);
    console.log(`  __mol3d.removeAtom(id) - Remove atom by ID`);
    console.log(`  __mol3d.selectAtom(id) - Select atom by ID`);
    console.log(`  __mol3d.devBond(a, b) - Create bond between atom IDs`);
    console.log(`  __mol3d.devUpgrade(bid) - Upgrade bond order`);
    console.log(`  __mol3d.clearAll() - Clear all atoms and bonds`);
    console.log(`  __mol3d.undo() - Undo last action`);
    console.log(`%cImport/Export:`, 'font-weight: bold; color: #2196F3;');
    console.log(`  __mol3d.export() - Export state as JSON`);
    console.log(`  __mol3d.import(json) - Import state from JSON`);
    console.log(`%cUtilities:`, 'font-weight: bold; color: #2196F3;');
    console.log(`  __mol3d.reset() - Clear and reload page`);
    console.log(`  __mol3d.setQuality(mode) - Set quality: 'low', 'med', 'high', 'auto'`);
    console.log(`  __mol3d.reanalyze() - Force reanalyze`);
    console.log(`%cThree.js Debug:`, 'font-weight: bold; color: #2196F3;');
    console.log(`  __mol3d.scene - Access Three.js scene`);
    console.log(`  __mol3d.renderer - Access renderer`);
    console.log(`  __mol3d.camera - Access camera`);
    console.log(`  __mol3d.ELEMENTS - Access element data array`);
    console.log(`%c🔥 HACK COMMANDS (use __mol3d.hacks.*):`, 'font-weight: bold; color: #ff5722;');
    console.log(`  __mol3d.hacks.godMode() - Disable all chemistry validation`);
    console.log(`  __mol3d.hacks.mortalMode() - Re-enable validation`);
    console.log(`  __mol3d.hacks.chaos(count) - Spawn random atoms (default: 20)`);
    console.log(`  __mol3d.hacks.party() - Make atoms dance for 5s`);
    console.log(`  __mol3d.hacks.matrix() - Matrix visual effect for 10s`);
    console.log(`  __mol3d.hacks.rainbow() - Rainbow colors for 10s`);
    console.log(`  __mol3d.hacks.disco() - Disco flashing for 5s`);
    console.log(`  __mol3d.hacks.giant() - Scale atoms 3x`);
    console.log(`  __mol3d.hacks.tiny() - Scale atoms 1/3x`);
    console.log(`  __mol3d.hacks.explosion(force) - Push atoms apart`);
    console.log(`  __mol3d.hacks.implode() - Pull atoms to center`);
    console.log(`  __mol3d.hacks.clone(times) - Clone selected atom`);
    console.log(`  __mol3d.hacks.dna(length) - Create DNA helix`);
    console.log(`  __mol3d.hacks.firework(count) - Explosion pattern`);
    console.log(`  __mol3d.hacks.blackHole() - Attract to center for 5s`);
    console.log(`  __mol3d.hacks.antiGravity() - Float upward for 5s`);
    console.log(`  __mol3d.hacks.quantum() - Random teleportation for 6s`);
    console.log(`  __mol3d.hacks.unlockAll() - Unlock all discoveries`);
    console.log(`  __mol3d.hacks.spawnMolecule(formula) - Spawn specific molecule`);
    console.log(`  __mol3d.hacks.mirror() - Create mirror copy`);
    console.log(`  __mol3d.hacks.slowmo() - 0.2x time scale`);
    console.log(`  __mol3d.hacks.fastforward() - 3x time scale`);
    console.log(`  __mol3d.hacks.normalSpeed() - Reset time scale`);
  },
  status: () => {
    const info = {
      atoms: atoms.size,
      bonds: bonds.size,
      mode: blueprintMode ? 'BluePrint' : '3D',
      quality: qualityMode,
      tier: TIER_ORDER[tierIndex],
      discoveries: discoveries.length,
      selected: selectedId,
      hover: hoverId,
      fps: Math.round(fpsSampler.fps),
    };
    console.log(`%c🧪 Mol3D Status`, 'font-size: 14px; font-weight: bold; color: #4CAF50;');
    console.table(info);
    return info;
  },
  listAtoms: () => {
    const list = [...atoms.values()].map(a => ({
      id: a.id,
      element: a.el.sym,
      name: a.el.name,
      x: a.pos.x.toFixed(2),
      y: a.pos.y.toFixed(2),
      z: a.pos.z.toFixed(2),
    }));
    console.table(list);
    return list;
  },
  listBonds: () => {
    const list = [...bonds.values()].map(b => ({
      id: b.id,
      from: b.a,
      to: b.b,
      order: b.order,
      ionic: b.ionic ? 'yes' : 'no',
    }));
    console.table(list);
    return list;
  },
  findElement: (sym) => {
    const found = [...atoms.values()].filter(a => a.el.sym === sym.toUpperCase());
    console.log(`Found ${found.length} ${sym} atom(s):`);
    console.table(found.map(a => ({ id: a.id, element: a.el.sym, pos: a.pos })));
    return found;
  },
  removeAtom: (id) => {
    if (!atoms.has(id)) {
      console.error(`Atom ${id} not found`);
      return false;
    }
    removeAtom(id);
    console.log(`Removed atom ${id}`);
    return true;
  },
  export: () => {
    const data = {
      atoms: [...atoms.values()].map(a => ({ id: a.id, z: a.el.z, pos: a.pos })),
      bonds: [...bonds.values()].map(b => ({ id: b.id, a: b.a, b: b.b, order: b.order, ionic: b.ionic })),
      nextId,
      overrides: [...overrides],
      isoF: [...isoSel],
      fc: [...completed],
    };
    const json = JSON.stringify(data, null, 2);
    console.log('Exported state:');
    console.log(json);
    return data;
  },
  import: (json) => {
    try {
      const data = typeof json === 'string' ? JSON.parse(json) : json;
      if (!data.atoms || !Array.isArray(data.atoms)) {
        console.error('Invalid data format');
        return false;
      }
      clearAll();
      for (const a of data.atoms) {
        const el = ELEMENTS.find(e => e.z === a.z);
        if (el) atoms.set(a.id, { id: a.id, el, pos: { x: +a.pos.x || 0, y: +a.pos.y || 0, z: +a.pos.z || 0 } });
      }
      for (const b of data.bonds || []) {
        if (atoms.has(b.a) && atoms.has(b.b)) bonds.set(b.id, { ...b });
      }
      nextId = data.nextId || Math.max(0, ...atoms.keys(), ...bonds.keys()) + 1;
      reanalyze();
      console.log(`Imported ${atoms.size} atoms and ${bonds.size} bonds`);
      return true;
    } catch (e) {
      console.error('Import failed:', e);
      return false;
    }
  },
  reset: () => {
    localStorage.clear();
    location.reload();
  },
  // ─ Bizarre/Hack Commands ─
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
      // Create bonds between adjacent atoms
      for (let i = 0; i < atomIds.length - 1; i++) {
        const aId = atomIds[i];
        const bId = atomIds[i + 1];
        const chk = bondCheck(atoms, bonds, aId, bId);
        if (chk.ok) {
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
      // Parse formula to get atoms (e.g., "C2H6O" -> ["C", "C", "H", "H", "H", "H", "H", "H", "O"])
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
      // Place atoms in a reasonable initial arrangement
      // Central atom first (the one with highest typical valence), others around it
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
      // Auto-bond: connect atoms based on proximity and valence rules
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
