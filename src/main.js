import '../style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ELEMENTS, CAT_COLOR, isMetalCat, gridPos, elementBySym as elementBySymBase } from './elements.js';
import {
  bondsOf, partnerId, bondCheck, upgradeCheck, componentsOf, componentOf,
  analyzeComponent, formulaWithCharge, prettyFormula, displayRadius, bondLength,
  structuralFingerprint, pairOrderCap,
} from './chemistry.js';
import { solveAll } from './vsepr.js';
import { nameMolecule, classifyMolecule, COMMON, COMMON_VI } from './names.js';
import { CHALLENGES } from './challenges.js';
import { MAYHEM_ELEMENTS, MAYHEM_REACTIONS, isMayhemElement, getMayhemElement } from './mayhem.js';
import { TIERS, TIER_ORDER, AutoThrottle, FpsSampler } from './quality.js';
import { createMovement } from './movement.js';
import {
  CONDITIONS, findReaction, conditionsFor, missingFor, productTemplate, isomerTemplates, parseFormula,
} from './reactions.js';
import { initLang, applyStatic, t, trReason, elName, catLabel, isVi, otherLang, setLang, getLang } from './i18n.js';
import { initTutorial, showTutorial } from './tutorial.js';
import { AVOGADRO, setElementLookup, molarMass, compositionOf, limitingAnalysis, fmtAmount } from './stoich.js';
import { createSimulation, compileNetwork, parseRateExpr, rk4Step } from './kinetics.js';
import { SimulationEngine, simulation } from './simulation.js';
import { questManager } from './quests.js';
import { rankManager, RANKS, isElementUnlocked, getUnlockedElementCount, checkDailyReward, claimDailyReward, getDailyStreak, isFeatureUnlocked, getRequiredRankForFeature } from './ranks.js';
import { tagFunctionalGroups, buildAdj, GROUP_TYPES } from './data/functional-groups.js';
import { ReactionVFXManager } from './ReactionVFXManager.js';
import { CatalystFX, isCatalystFormula, getCatalystData, drawEnergyDiagram } from './CatalystFX.js';
import { ElectricityFX } from './ElectricityFX.js';
import { DECOMPOSITION_RULES } from './data/decomposition-rules.js';

// Early button handler registration to prevent tree-shaking
setTimeout(() => {
  const xrayBtn = document.getElementById('btn-xray');
  if (xrayBtn && !xrayBtn.dataset.handlerAdded) {
    xrayBtn.dataset.handlerAdded = 'true';
    xrayBtn.addEventListener('click', () => {
      if (typeof isXRayActive !== 'undefined') {
        isXRayActive = !isXRayActive;
        if (typeof atomMatM !== 'undefined' && typeof atomMatN !== 'undefined') {
          if (isXRayActive) {
            atomMatM.transparent = true;
            atomMatM.opacity = 0.4;
            atomMatM.wireframe = true;
            atomMatN.transparent = true;
            atomMatN.opacity = 0.4;
            atomMatN.wireframe = true;
          } else {
            atomMatM.transparent = false;
            atomMatM.opacity = 1.0;
            atomMatM.wireframe = false;
            atomMatN.transparent = false;
            atomMatN.opacity = 1.0;
            atomMatN.wireframe = false;
          }
          atomMatM.needsUpdate = true;
          atomMatN.needsUpdate = true;
          if (typeof invalidate === 'function') invalidate();
        }
        xrayBtn.classList.toggle('on', isXRayActive);
        if (typeof status === 'function') {
          status(isXRayActive ? 'X-Ray mode enabled' : 'X-Ray mode disabled', 'info');
        }
      }
    });
  }
  
  const protonBtn = document.getElementById('btn-proton');
  if (protonBtn && !protonBtn.dataset.handlerAdded) {
    protonBtn.dataset.handlerAdded = 'true';
    protonBtn.addEventListener('click', () => {
      if (typeof protonGunActive !== 'undefined') {
        protonGunActive = !protonGunActive;
        protonBtn.classList.toggle('on', protonGunActive);
        if (typeof status === 'function') {
          status(protonGunActive ? 'Proton gun activated - Click atoms to shoot!' : 'Proton gun deactivated', 'info');
        }
      }
    });
  }
}, 100);
import { initMenu } from './menu.js';
import { network, MSG } from './networking.js';
import { playerSync } from './playerSync.js';
import { worldSync } from './worldSync.js';
import { chatManager } from './chat.js';
import { voiceChat } from './voiceChat.js';

function elementBySym(sym) {
  return elementBySymBase(sym) || getMayhemElement(sym) || customElements.find(e => e.sym === sym);
}

// ─ UI Scale-to-Fit ──
const REF_W = 1920;
const REF_H = 1080;
let uiZoom = 1;

function calcZoom() {
  const wRatio = window.innerWidth / REF_W;
  const hRatio = window.innerHeight / REF_H;
  uiZoom = Math.max(1, Math.min(wRatio, hRatio));
  document.documentElement.style.setProperty('--ui-zoom', uiZoom.toFixed(3));
}

calcZoom();
window.addEventListener('resize', calcZoom);

// ── Draggable Panels ──
const DRAGGABLES = ['left-sidebar', 'right-sidebar', 'bottom-bar'];
const dragState = { el: null, offsetX: 0, offsetY: 0 };

function initDraggable(id) {
  const el = document.getElementById(id);
  if (!el) return;

  const handle = el.querySelector('.drag-handle');
  if (!handle) return;

  handle.style.cursor = 'grab';

  const onDown = (e) => {
    const rect = el.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragState.el = el;
    dragState.offsetX = clientX - rect.left;
    dragState.offsetY = clientY - rect.top;
    el.style.position = 'fixed';
    el.style.zIndex = '100';
    handle.style.cursor = 'grabbing';
    e.preventDefault();
  };

  handle.addEventListener('mousedown', onDown);
  handle.addEventListener('touchstart', onDown, { passive: false });
}

function onDragMove(e) {
  if (!dragState.el) return;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  dragState.el.style.left = `${(clientX - dragState.offsetX) / uiZoom}px`;
  dragState.el.style.top = `${(clientY - dragState.offsetY) / uiZoom}px`;
}

function onDragEnd() {
  if (!dragState.el) return;
  const handle = dragState.el.querySelector('.drag-handle');
  if (handle) handle.style.cursor = 'grab';
  dragState.el = null;
}

window.addEventListener('mousemove', onDragMove);
window.addEventListener('touchmove', onDragMove, { passive: false });
window.addEventListener('mouseup', onDragEnd);
window.addEventListener('touchend', onDragEnd);

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

// Initialize draggable panels
DRAGGABLES.forEach(initDraggable);

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

// Player health system
let playerHealth = 100;
const MAX_HEALTH = 100;
const RADIATION_DAMAGE_RATE = 8; // HP per second per radioactive atom within range (increased for easier death)
const RADIATION_RANGE = 120; // units (half of 240x240 grid)
const EXPLOSION_DAMAGE_BASE = 25; // Increased from 10 for easier death
const EXPLOSION_DAMAGE_RANGE = 120; // units (half of 240x240 grid)
const GRID_SIZE = 240; // Grid dimensions
const GRID_HALF = GRID_SIZE / 2; // Half grid for boundary checks

// Clamp atom position to grid boundaries
function clampAtomToBounds(at) {
  at.pos.x = Math.max(-GRID_HALF, Math.min(GRID_HALF, at.pos.x));
  at.pos.y = Math.max(-GRID_HALF, Math.min(GRID_HALF, at.pos.y));
  at.pos.z = Math.max(-GRID_HALF, Math.min(GRID_HALF, at.pos.z));
}

// Game mode system
let gameMode = 'survival'; // 'creative' or 'survival'
let isPlayerDead = false;
let isXRayActive = false;
let protonGunActive = false;
let criticalTimerActive = false;
let criticalCountdown = 60.0;
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

// THE WORLD limits (survival mode only)
const WORLD_MAX_DURATION = 15000; // 15 seconds max freeze
const WORLD_COOLDOWN = 5000; // 5 seconds cooldown after resume
let worldFreezeStart = 0; // When the current freeze started
let worldCooldownEnd = 0; // When the cooldown ends
let worldTimerInterval = null;

function formatSimulationTime(seconds) {
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}

function updateTimeDisplay() {
  const display = document.getElementById('time-display');
  if (display) {
    if (timeFrozen && gameMode === 'survival') {
      // Show countdown in red for survival mode
      const elapsed = Date.now() - worldFreezeStart;
      const remaining = Math.max(0, Math.ceil((WORLD_MAX_DURATION - elapsed) / 1000));
      display.textContent = `FROZEN ${remaining}s`;
      display.style.color = '#f85149';
    } else {
      display.textContent = timeFrozen ? 'FROZEN' : formatSimulationTime(simulationTime);
      display.style.color = '';
    }
  }
  const label = document.getElementById('time-speed-label');
  if (label) {
    label.textContent = formatSpeed(timeSpeed);
  }
}

function canFreezeTime() {
  // In creative mode, always allow
  if (gameMode === 'creative') return true;
  // In survival mode, check cooldown
  return Date.now() >= worldCooldownEnd;
}

function startWorldTimer() {
  worldFreezeStart = Date.now();
  if (worldTimerInterval) clearInterval(worldTimerInterval);
  worldTimerInterval = setInterval(() => {
    if (!timeFrozen) {
      clearInterval(worldTimerInterval);
      worldTimerInterval = null;
      return;
    }
    const elapsed = Date.now() - worldFreezeStart;
    if (elapsed >= WORLD_MAX_DURATION) {
      // Auto-resume after 15 seconds
      clearInterval(worldTimerInterval);
      worldTimerInterval = null;
      resumeTime();
      status(' THE WORLD - Time limit reached', 'err');
    } else {
      updateTimeDisplay();
    }
  }, 100);
}

function resumeTime() {
  timeFrozen = false;
  document.body.classList.remove('time-stopped');
  const btn = document.getElementById('btn-modal-freeze');
  if (btn) {
    btn.classList.remove('frozen');
    btn.textContent = '❄️';
  }
  lastRealTime = performance.now();
  
  // Set cooldown for survival mode
  if (gameMode === 'survival') {
    worldCooldownEnd = Date.now() + WORLD_COOLDOWN;
    updateFreezeButtonCooldown();
  }
  
  updateTimeDisplay();

  // Trigger resume effect
  triggerTimeResume();

  // Broadcast time resume to other players
  if (network.roomId) {
    network.broadcast(null, 8, {
      playerId: network.playerId,
      timestamp: Date.now(),
    });
  }
}

function updateFreezeButtonCooldown() {
  const btn = document.getElementById('btn-modal-freeze');
  const modalBtn = document.getElementById('btn-modal-freeze');
  if (!btn) return;
  
  const updateBtn = (b) => {
    if (!b) return;
    const remaining = Math.max(0, worldCooldownEnd - Date.now());
    if (remaining > 0 && gameMode === 'survival') {
      b.disabled = true;
      b.classList.add('on-cooldown');
      b.title = `Cooldown: ${Math.ceil(remaining / 1000)}s`;
    } else {
      b.disabled = false;
      b.classList.remove('on-cooldown');
      b.title = '';
    }
  };
  
  updateBtn(btn);
  updateBtn(modalBtn);
  
  // Continue updating until cooldown expires
  if (Date.now() < worldCooldownEnd) {
    setTimeout(updateFreezeButtonCooldown, 100);
  }
}

function toggleFreeze() {
  // Check if we can freeze (survival mode cooldown)
  if (!canFreezeTime()) {
    const remaining = Math.ceil((worldCooldownEnd - Date.now()) / 1000);
    status(` Time freeze on cooldown: ${remaining}s`, 'err');
    return;
  }
  
  timeFrozen = !timeFrozen;
  document.body.classList.toggle('time-stopped', timeFrozen);
  const btn = document.getElementById('btn-modal-freeze');
  if (btn) {
    btn.classList.toggle('frozen', timeFrozen);
    btn.textContent = timeFrozen ? '▶️' : '❄️';
  }
  if (!timeFrozen) {
    lastRealTime = performance.now();
    if (worldTimerInterval) {
      clearInterval(worldTimerInterval);
      worldTimerInterval = null;
    }
  } else {
    // Starting freeze - start timer for survival mode
    if (gameMode === 'survival') {
      startWorldTimer();
    }
  }
  updateTimeDisplay();
  
  // Broadcast time freeze/resume to other players
  if (network.roomId) {
    network.broadcast(null, timeFrozen ? 7 : 8, {
      playerId: network.playerId,
      timestamp: Date.now(),
    });
  }
}

function cycleSpeed() {
  const speeds = [1, 2, 5, 10, 50, 100, 1000, 10000, 100000, 1e6, 1e7, 1e8, 1e9];
  const idx = speeds.indexOf(timeSpeed);
  timeSpeed = speeds[(idx + 1) % speeds.length];
  const btn = document.getElementById('btn-time-speed');
  if (btn) {
    btn.textContent = formatSpeed(timeSpeed);
    btn.classList.toggle('active', timeSpeed > 1);
  }
  const label = document.getElementById('time-speed-label');
  if (label) {
    label.textContent = formatSpeed(timeSpeed);
  }
  updateTimeDisplay();
  
  // Broadcast speed change to other players
  if (network.roomId) {
    network.broadcast(null, 9, {
      playerId: network.playerId,
      speed: timeSpeed,
      timestamp: Date.now(),
    });
  }
}

function formatSpeed(speed) {
  if (speed >= 1e9) return `${(speed/1e9).toFixed(0)}B×`;
  if (speed >= 1e6) return `${(speed/1e6).toFixed(0)}M×`;
  if (speed >= 1e3) return `${(speed/1e3).toFixed(0)}K×`;
  return `${speed}×`;
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
  98: 2.834e10,  // Cf-251: 898 years
  99: 4.080e5,   // Es-252: 472 days
  100: 3.240e4,  // Fm-257: 100.5 days
  101: 1.860e4,  // Md-258: 51.5 days
  102: 3.480e3,   // No-259: 58 minutes
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
    
    // Get position before transformation for explosion effects
    const pos = new THREE.Vector3(atom.pos.x, atom.pos.y, atom.pos.z);
    
    // Transform atom
    atom.el = newEl;
    decayTrack.delete(id);
    
    // Alpha decay explosion effect - break all bonds to this atom
    const isAlphaDecay = (oldEl.z - newEl.z) === 2;
    if (isAlphaDecay) {
      // Create explosion VFX
      reactionVFX.explode(pos, 1.5, new THREE.Color(0xff4400));
      applyExplosionDamage(pos, 1.5, 1);
      
      // Break all bonds connected to this atom
      const bondsToRemove = [];
      for (const [bid, b] of bonds) {
        if (b.a === id || b.b === id) {
          bondsToRemove.push(bid);
        }
      }
      for (const bid of bondsToRemove) {
        bonds.delete(bid);
      }
      
      // Push away nearby atoms
      for (const [otherId, otherAtom] of atoms) {
        if (otherId === id) continue;
        const otherPos = new THREE.Vector3(otherAtom.pos.x, otherAtom.pos.y, otherAtom.pos.z);
        const dist = pos.distanceTo(otherPos);
        if (dist < 3.0 && dist > 0.1) {
          const force = new THREE.Vector3().subVectors(otherPos, pos).normalize().multiplyScalar(2.0 / dist);
          otherAtom.pos.x += force.x;
          otherAtom.pos.y += force.y;
          otherAtom.pos.z += force.z;
        }
      }
      
      status(`☢ ${oldEl.name} underwent alpha decay → ${newEl.name} (bonds broken!)`, 'warn');
    } else {
      status(`☢ ${oldEl.name} decayed to ${newEl.name}`, 'warn');
    }
    
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
// Molecular decomposition kinetics. Every molecule already carries the rate
// constant shown in the inspector (k = A·e^(-Ea/RT), t½ = ln2/k); this rolls
// the first-order law each frame: P(split) = 1 - e^(-k·Δt_sim), where Δt_sim
// includes the time-speed multiplier and halts during THE WORLD freeze. No
// elapsed-time tracking is needed — the exponential distribution is
// memoryless, and removeBond() rebuilds the component list on every split.
function weakestBondIdOf(comp) {
  const atomSet = new Set(comp.atoms);
  let worstId = null, worstE = Infinity;
  for (const [bid, b] of bonds) {
    if (!atomSet.has(b.a) || !atomSet.has(b.b)) continue;
    const e = simulation.thermo.getBondDissociationEnergy(b, atoms);
    if (e < worstE) { worstE = e; worstId = bid; }
  }
  return worstId;
}

// Decomposition cascade control: prevent runaway chain reactions
let decompositionCount = 0;
let decompositionCountReset = 0;
const MAX_DECOMPOSITIONS_PER_SECOND = 3; // Cap decompositions to prevent lag

function updateMolecularDecay(now, realDt) {
  if (timeFrozen || lastComps.length === 0) return;
  const simDt = realDt * timeSpeed;
  if (simDt <= 0) return;

  // Reset decomposition counter every second
  if (now - decompositionCountReset > 1000) {
    decompositionCount = 0;
    decompositionCountReset = now;
  }

  // Hard cap: stop decomposing if we've hit the limit this second
  if (decompositionCount >= MAX_DECOMPOSITIONS_PER_SECOND) return;

  const victims = [];
  for (const comp of lastComps) {
    if (comp.bonds.length === 0) continue;
    const kin = comp.simulation && comp.simulation.kinetics;
    if (!kin || !isFinite(kin.rateConstant) || kin.rateConstant <= 0) continue;

    // Energy decay: child fragments from recent decompositions have lower probability
    // This prevents immediate chain reactions
    const age = now - (comp.decompositionTime || 0);
    const decayFactor = age < 500 ? 0.3 : 1.0; // 70% reduction for first 500ms

    if (Math.random() < (1 - Math.exp(-kin.rateConstant * simDt)) * decayFactor) {
      victims.push(comp);
    }
  }
  // One split per frame: removeBond triggers reanalyze and rebuilds lastComps,
  // so the other victims get re-rolled next frame.
  if (victims.length) {
    decompositionCount++;
    decomposeMolecule(victims[0], now);
  }
}

function updateHealth(now, dt) {
  if (timeFrozen || gameMode === 'creative') return;

  // Radiation damage from radioactive atoms (z > 82)
  const camPos = camera.position;
  let radiationDamage = 0;
  const processedMolecules = new Set(); // Track which molecules we've already processed

  for (const [id, atom] of atoms) {
    if (atom.el.z <= 82) continue; // Only radioactive elements

    // Get the molecule component this atom belongs to
    const comp = componentOf(atoms, bonds, id);
    const compKey = comp.atoms.sort().join(',');
    
    // Skip if we've already processed this molecule
    if (processedMolecules.has(compKey)) continue;
    processedMolecules.add(compKey);

    // Calculate molecule size (number of atoms)
    const moleculeSize = comp.atoms.length;
    
    // Calculate radioactivity level (count of radioactive atoms and their z values)
    let radioactiveCount = 0;
    let totalZ = 0;
    for (const atomId of comp.atoms) {
      const a = atoms.get(atomId);
      if (a && a.el.z > 82) {
        radioactiveCount++;
        totalZ += a.el.z;
      }
    }

    // Use the center of mass of the molecule for distance calculation
    let centerX = 0, centerY = 0, centerZ = 0;
    for (const atomId of comp.atoms) {
      const a = atoms.get(atomId);
      if (a) {
        centerX += a.pos.x;
        centerY += a.pos.y;
        centerZ += a.pos.z;
      }
    }
    centerX /= moleculeSize;
    centerY /= moleculeSize;
    centerZ /= moleculeSize;

    const dx = centerX - camPos.x;
    const dy = centerY - camPos.y;
    const dz = centerZ - camPos.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Scale hitbox (radiation range) based on molecule size and radioactivity
    // Bigger molecule = bigger hitbox, more radioactive atoms = bigger hitbox
    const sizeMultiplier = 1 + (moleculeSize - 1) * 0.15; // 15% larger per additional atom
    const radioactivityMultiplier = 1 + radioactiveCount * 0.3 + (totalZ - 82) * 0.01; // Higher z = more dangerous
    const effectiveRange = RADIATION_RANGE * sizeMultiplier * radioactivityMultiplier;

    if (dist < effectiveRange) {
      // Damage scales with proximity (closer = more damage)
      const proximityFactor = 1 - (dist / effectiveRange);
      
      // Scale damage rate based on molecule size and radioactivity
      // Bigger molecule = more damage, more radioactive = more damage
      const damageMultiplier = sizeMultiplier * radioactivityMultiplier;
      const damageRate = RADIATION_DAMAGE_RATE * damageMultiplier;
      
      radiationDamage += damageRate * proximityFactor * dt;
    }
  }

  if (radiationDamage > 0) {
    const oldHealth = playerHealth;
    playerHealth = Math.max(0, playerHealth - radiationDamage);
    updateHealthBar();

    // Warning messages
    if (oldHealth > 25 && playerHealth <= 25) {
      status(t('status.healthLow'), 'warn');
    }
    if (oldHealth > 0 && playerHealth <= 0) {
      triggerPlayerDeath();
    }
  }

  // Natural regeneration when no radiation (0.5 HP/sec)
  if (radiationDamage === 0 && playerHealth < MAX_HEALTH && !isPlayerDead) {
    playerHealth = Math.min(MAX_HEALTH, playerHealth + 0.5 * dt);
    updateHealthBar();
  }
}

function applyExplosionDamage(center, scale, moleculeSize = 1) {
  if (gameMode === 'creative') return; // No damage in creative mode

  const camPos = camera.position;
  const dx = center.x - camPos.x;
  const dy = center.y - camPos.y;
  const dz = center.z - camPos.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

  // Scale hitbox (damage range) based on explosion scale and molecule size
  // Bigger molecule = bigger hitbox
  const sizeMultiplier = 1 + (moleculeSize - 1) * 0.2; // 20% larger per additional atom
  const effectiveRange = EXPLOSION_DAMAGE_RANGE * scale * sizeMultiplier;
  
  if (dist < effectiveRange) {
    // Damage scales with proximity, explosion scale, and molecule size
    // Bigger molecule = more damage
    const proximityFactor = 1 - (dist / effectiveRange);
    const damage = EXPLOSION_DAMAGE_BASE * scale * sizeMultiplier * proximityFactor;
    playerHealth = Math.max(0, playerHealth - damage);
    updateHealthBar();

    if (playerHealth <= 0) {
      triggerPlayerDeath();
    }
  }
}

function triggerPlayerDeath() {
  if (isPlayerDead) return;
  isPlayerDead = true;
  status(t('status.healthZero'), 'error');
  
  // Death penalty: lose 20 stars — always show animation
  const oldRank = rankManager.getCurrentRank();
  rankManager.removeStars(20);
  const newRank = rankManager.getCurrentRank();
  triggerRankDownAnimation(newRank, 20, newRank.rankIndex < oldRank.rankIndex);
  
  showDeathScreen();
  
  // Broadcast death to other players
  if (network.roomId) {
    network.broadcast(null, 10, {
      playerId: network.playerId,
      timestamp: Date.now(),
    });
  }
}

function respawnPlayer() {
  isPlayerDead = false;
  playerHealth = MAX_HEALTH;
  updateHealthBar();
  hideDeathScreen();
  status(t('status.respawned'), 'ok');
}

function showDeathScreen() {
  const deathScreen = document.getElementById('death-screen');
  if (deathScreen) deathScreen.style.display = 'flex';
}

function hideDeathScreen() {
  const deathScreen = document.getElementById('death-screen');
  if (deathScreen) deathScreen.style.display = 'none';
}

function setGameMode(mode) {
  gameMode = mode;
  const healthBar = document.getElementById('health-bar-container');
  const deathScreen = document.getElementById('death-screen');
  const joyVert = document.getElementById('joy-vert');
  const joyJump = document.getElementById('joy-jump');

  if (mode === 'creative') {
    if (healthBar) healthBar.style.display = 'none';
    if (deathScreen) deathScreen.style.display = 'none';
    isPlayerDead = false;
    playerHealth = MAX_HEALTH;
    controls.minPolarAngle = 0.05;
    controls.maxPolarAngle = Math.PI - 0.05;
    controls.enabled = true;
    if (joyVert) joyVert.style.display = 'flex';
    if (joyJump) joyJump.classList.remove('visible');
    // Sync OrbitControls target to current camera position
    controls.target.copy(camera.position).add(new THREE.Vector3(0, 0, -2).applyQuaternion(camera.quaternion));
    status(t('status.creativeMode'), 'ok');
  } else {
    if (healthBar) healthBar.style.display = 'flex';
    controls.minPolarAngle = Math.PI * 0.1;
    controls.maxPolarAngle = Math.PI * 0.75;
    controls.enabled = false;
    if (joyVert) joyVert.style.display = 'none';
    if (joyJump) joyJump.classList.add('visible');
    status(t('status.survivalMode'), 'ok');
  }
  invalidate();
}

function updateHealthBar() {
  const fill = document.getElementById('health-bar-fill');
  const text = document.getElementById('health-text');
  if (fill && text) {
    const pct = (playerHealth / MAX_HEALTH) * 100;
    fill.style.width = pct + '%';
    text.textContent = Math.round(playerHealth);
  }
}

function decomposeMolecule(comp, now) {
  const an = analyses[lastComps.indexOf(comp)];
  const formula = (an && an.formula) || '?';

  // Guard: check if component's atoms still exist (prevents double-processing)
  if (!comp.atoms.every(id => atoms.has(id))) return;

  // Check if there's a rule-based decomposition for this molecule
  const parsed = parseFormula(formula);
  if (parsed && parsed.size > 0) {
    for (const rule of DECOMPOSITION_RULES) {
      if (rule.match(parsed, parsed)) {
        const productFormulas = rule.products(parsed, parsed);
        if (productFormulas && productFormulas.length >= 2) {
          // Stoichiometry guard: prevent molecule from decomposing to itself
          if (productFormulas.length === 1 && productFormulas[0] === formula) {
            console.warn(`[DECOMPOSITION] Blocked self-decomposition: ${formula} → ${formula}`);
            continue;
          }
          
          // Validate all product templates exist before deleting any atoms
          const templates = productFormulas.map(pf => productTemplate(pf));
          const allValid = templates.every(tpl => tpl && tpl.atoms && tpl.atoms.length > 0);
          if (!allValid) continue; // Fall through to bond-breaking if any template missing

          // Compute center before deletion
          const cen = new THREE.Vector3();
          for (const id of comp.atoms) {
            const p = atoms.get(id).pos;
            cen.x += p.x; cen.y += p.y; cen.z += p.z;
          }
          cen.divideScalar(comp.atoms.length);

          // Remove all atoms and bonds of this molecule
          for (const id of comp.atoms) {
            atoms.delete(id);
            for (const [bid, b] of bonds) {
              if (b.a === id || b.b === id) bonds.delete(bid);
            }
          }

          // Spawn product molecules
          for (let pi = 0; pi < productFormulas.length; pi++) {
            const tpl = templates[pi];
            const offset = new THREE.Vector3(
              (Math.random() - 0.5) * 2,
              (Math.random() - 0.5) * 2,
              (Math.random() - 0.5) * 2
            );
            buildMoleculeAt(tpl, cen.x + offset.x, cen.y + offset.y, cen.z + offset.z);
          }

          reactionVFX.explode(cen, 1.2, new THREE.Color(0xff6600));
          applyExplosionDamage(cen, 1.2, comp.atoms.length);
          status(t('status.decomposed', { formula }), 'warn');
          reanalyze();
          return;
        }
      }
    }
  }

  // Fallback to bond-breaking decomposition
  const bid = weakestBondIdOf(comp);
  if (bid === null) return;
  const cen = new THREE.Vector3();
  for (const id of comp.atoms) {
    const p = atoms.get(id).pos;
    cen.x += p.x; cen.y += p.y; cen.z += p.z;
  }
  cen.divideScalar(comp.atoms.length);
  reactionVFX.explode(cen, 0.9, new THREE.Color(0xff8830));
  applyExplosionDamage(cen, 0.9, comp.atoms.length);
  removeBond(bid, false);

  // Mark child fragments with decomposition time for energy decay
  const childComps = lastComps.filter(c =>
    c.atoms.some(id => comp.atoms.includes(id)) && c !== comp
  );
  for (const child of childComps) {
    child.decompositionTime = now;
  }

  const strays = lastComps
    .filter(c => c.atoms.length === 1 && c.bonds.length === 0 && comp.atoms.includes(c.atoms[0]))
    .map(c => c.atoms[0]);
  if (strays.length) stabilizeStrays(strays, now);
  else status(t('status.decomposed', { formula }), 'warn');
}

// ---------------------------------------------------------------------------
// Homeless-atom stabilization: cleavage must never strand a lone, unbonded
// atom. Each stray bonds to the nearest atom with spare valence using the
// app's own rules (bondCheck, pairOrderCap, upgradeCheck) — spreading single
// bonds to fresh partners before raising bond order (C + 2 O → O=C=O, not
// C≡O–O). Valence targets follow the octet rule for nonmetals (C=4, O=2,
// N=3, H=1) instead of the app's lenient maxBonds; metals bond ionically up
// to maxBonds. When the scene has no spare capacity left, hydrogen cappers
// are spawned to complete the valence (C→CH4, N→NH3, S→H2S, ...). Noble
// gases (maxBonds 0) are chemically stable monatomic and stay exempt.
const targetValenceOf = el => isMetalCat(el.cat)
  ? el.maxBonds
  : Math.max(0, Math.min(8 - (el.valenceElectrons || 0), el.maxBonds));
const usedOrderOf = id => bondsOf(atoms, bonds, id).reduce((s, b) => s + (b.order || 1), 0);
const freeValenceOf = id => Math.max(0, targetValenceOf(atoms.get(id).el) - usedOrderOf(id));
const bondBetween = (aId, bId) => bondsOf(atoms, bonds, aId).find(b => partnerId(b, aId) === bId);

function stabilizeStrays(strayIds, now) {
  const stabilized = [];
  for (const sid of strayIds) {
    const sEl = atoms.get(sid).el;
    if (sEl.maxBonds <= 0) continue;
    let guard = 0;
    while (freeValenceOf(sid) > 0 && guard++ < 12) {
      const sPos = atoms.get(sid).pos;
      const candidates = [...atoms.keys()]
        .filter(id => id !== sid && freeValenceOf(id) > 0)
        .sort((a, b) => {
          const pa = atoms.get(a).pos, pb = atoms.get(b).pos;
          return Math.hypot(pa.x - sPos.x, pa.y - sPos.y, pa.z - sPos.z)
               - Math.hypot(pb.x - sPos.x, pb.y - sPos.y, pb.z - sPos.z);
        });
      let acted = false;
      // Spread first: single bond to the nearest partner not yet bonded to.
      for (const pid of candidates) {
        if (bondBetween(sid, pid)) continue;
        const chk = bondCheck(atoms, bonds, sid, pid);
        if (!chk.ok) continue;
        const nb = nextId++;
        bonds.set(nb, { id: nb, a: sid, b: pid, order: 1, ionic: chk.type === 'ionic' });
        acted = true;
        break;
      }
      // No fresh partners left — raise the order of the nearest existing bond.
      if (!acted) {
        for (const pid of candidates) {
          const existing = bondBetween(sid, pid);
          if (!existing) continue;
          const nextOrder = existing.order + 1;
          if (nextOrder > pairOrderCap(sEl, atoms.get(pid).el)) continue;
          const up = upgradeCheck(atoms, bonds, { ...existing, order: nextOrder });
          if (!up.ok) continue;
          existing.order = nextOrder;
          acted = true;
          break;
        }
      }
      if (acted) continue;
      // No spare capacity anywhere in the scene: quench with hydrogen cappers.
      // Only available in atmosphere mode (vacuum has no free H2 to cap with).
      if (!atmosphere.enabled) break;
      // EXCEPTION: Don't create H cappers for elements that form stable structures
      // without hydrogen (O2, N2, F2, Cl2, graphite, diamond, fullerenes, etc.)
      if (sEl.sym === 'O' || sEl.sym === 'N' || sEl.sym === 'F' || sEl.sym === 'Cl' ||
          sEl.sym === 'Br' || sEl.sym === 'I' || sEl.sym === 'C') {
        break; // Leave the atom as-is, don't force hydrogen capping
      }
      const hEl = ELEMENTS.find(e => e.z === 1);
      const hid = nextId++;
      const ang = Math.random() * Math.PI * 2, rad = 0.8 + Math.random() * 0.5;
      atoms.set(hid, {
        id: hid, el: hEl,
        pos: { x: sPos.x + Math.cos(ang) * rad, y: sPos.y + (Math.random() - 0.5) * 0.6, z: sPos.z + Math.sin(ang) * rad },
      });
      spawnAnim.set(hid, now);
      const chk = bondCheck(atoms, bonds, sid, hid);
      if (!chk.ok) { atoms.delete(hid); spawnAnim.delete(hid); break; }
      const nb = nextId++;
      bonds.set(nb, { id: nb, a: sid, b: hid, order: 1, ionic: chk.type === 'ionic' });
    }
    if (freeValenceOf(sid) === 0) stabilized.push(sid);
  }
  if (!stabilized.length) return;
  reanalyze();
  const formulas = [...new Set(stabilized
    .map(sid => {
      const comp = lastComps.find(c => c.atoms.includes(sid));
      const idx = lastComps.indexOf(comp);
      return (idx >= 0 && analyses[idx] && analyses[idx].formula) || null;
    })
    .filter(Boolean))];
  if (formulas.length) status(t('status.stabilized', { formula: formulas.join(' + ') }), 'ok');
}

// ---------------------------------------------------------------------------
// Three.js scene
// ---------------------------------------------------------------------------
const sceneWrap = document.getElementById('scene-wrap');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));

const camera = new THREE.PerspectiveCamera(50, sceneWrap.clientWidth / sceneWrap.clientHeight, 0.1, 200);
camera.position.set(0, 4.2, 10.5);

function updateRendererSize() {
  const cssW = sceneWrap.clientWidth;
  const cssH = sceneWrap.clientHeight;
  renderer.domElement.style.width = `${cssW}px`;
  renderer.domElement.style.height = `${cssH}px`;
  renderer.setSize(cssW * uiZoom, cssH * uiZoom, false);
  camera.aspect = cssW / cssH;
  camera.updateProjectionMatrix();
}

updateRendererSize();
sceneWrap.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d1117);
scene.fog = new THREE.Fog(0x0d1117, 34, 80);

// Initialize player and world synchronization
playerSync.init(scene);
playerSync.setWorldStateProvider(getWorldState);
worldSync.init();

// Handle incoming time control messages from other players
network.onMessage = (peerId, msgType, payload) => {
  const data = payload[0];
  console.log('[NETWORK] Received message:', msgType, 'from:', peerId, 'data:', data);
  
  // Handle player position updates (for playerSync)
  if (msgType === 0 && data) {
    playerSync.handlePositionUpdate(peerId, payload);
    return;
  }
  
  if (!data) return;
  
  if (msgType === 7) {
    // Another player froze time - apply locally
    if (!timeFrozen) {
      timeFrozen = true;
      document.body.classList.add('time-stopped');
      const btn = document.getElementById('btn-modal-freeze');
      if (btn) {
        btn.classList.add('frozen');
        btn.textContent = '▶️';
      }
      // Start timer for survival mode (sync with host)
      if (gameMode === 'survival') {
        startWorldTimer();
      }
      updateTimeDisplay();
      triggerTheWorld();
      status(' Time frozen by another player', 'ok');
    }
  } else if (msgType === 8) {
    // Another player resumed time - apply locally
    if (timeFrozen) {
      timeFrozen = false;
      document.body.classList.remove('time-stopped');
      const btn = document.getElementById('btn-modal-freeze');
      if (btn) {
        btn.classList.remove('frozen');
        btn.textContent = '❄️';
      }
      lastRealTime = performance.now();
      if (worldTimerInterval) {
        clearInterval(worldTimerInterval);
        worldTimerInterval = null;
      }
      updateTimeDisplay();
      triggerTimeResume();
      status(' Time resumed by another player', 'ok');
    }
  } else if (msgType === 9) {
    // Another player changed speed - apply locally
    if (data.speed && data.speed !== timeSpeed) {
      timeSpeed = data.speed;
      const btn = document.getElementById('btn-time-speed');
      if (btn) {
        btn.textContent = formatSpeed(timeSpeed);
        btn.classList.toggle('active', timeSpeed > 1);
      }
      const label = document.getElementById('time-speed-label');
      if (label) {
        label.textContent = formatSpeed(timeSpeed);
      }
      updateTimeDisplay();
      status(` Speed changed to ${formatSpeed(timeSpeed)} by another player`, 'ok');
    }
  } else if (msgType === 10) {
    // Another player died - mark them as dead
    if (data && data.playerId) {
      const remotePlayer = playerSync.remotePlayers.get(data.playerId);
      if (remotePlayer) {
        remotePlayer.isDead = true;
        remotePlayer.updateVisuals();
        status(`${remotePlayer.username} has died`, 'err');
      }
    }
  } else if (msgType === 11) {
    // Another player was revived
    if (data && data.playerId) {
      // If this is the local player, respawn
      if (data.playerId === network.playerId && isPlayerDead) {
        respawnPlayer();
        status(`You were revived by another player`, 'ok');
      } else {
        // Update remote player
        const remotePlayer = playerSync.remotePlayers.get(data.playerId);
        if (remotePlayer) {
          remotePlayer.isDead = false;
          remotePlayer.updateVisuals();
          status(`${remotePlayer.username} has been revived`, 'ok');
        }
      }
    }
  } else if (msgType === 12) {
    if (data && data.id) {
      const at = atoms.get(data.id);
      if (at) {
        at.pos = { x: data.x, y: data.y, z: data.z };
        needsRender = true;
      }
    }
  } else if (msgType === 13) {
    if (data && data.id) {
      if (!bonds.has(data.id)) {
        bonds.set(data.id, { id: data.id, a: data.a, b: data.b, order: data.order, ionic: data.ionic });
        needsRender = true;
      }
    }
  } else if (msgType === 14) {
    if (data && data.id) {
      if (bonds.delete(data.id)) {
        needsRender = true;
      }
    }
  } else if (msgType === 15) {
    if (data && data.key !== undefined) {
      overrides.set(data.key, data.charge);
      needsRender = true;
    }
  } else if (msgType === 16) {
    if (data && data.id) {
      if (!atoms.has(data.id)) {
        atoms.set(data.id, { id: data.id, el: data.el, pos: { x: data.x, y: data.y, z: data.z } });
        needsRender = true;
      }
    }
  } else if (msgType === 17) {
    if (data && data.id) {
      if (atoms.delete(data.id)) {
        // Remove any bonds connected to this atom
        for (const [bid, b] of bonds) {
          if (b.a === data.id || b.b === data.id) bonds.delete(bid);
        }
        needsRender = true;
      }
    }
  } else if (msgType === 18) {
    // Reaction already happened on host, sync is for visual consistency
    // The individual atom/bond changes will arrive via other messages
    if (data && data.equation) {
      status(`Reaction: ${data.equation}`, 'ok');
    }
  } else if (msgType === 19) {
    if (data) {
      applyWorldSync(data);
    }
  }
};

scene.add(new THREE.HemisphereLight(0xffffff, 0x33404f, 1.05));
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(6, 10, 8);
scene.add(sun);
const fill = new THREE.DirectionalLight(0x88aaff, 0.4);
fill.position.set(-6, 4, -6);
scene.add(fill);

let grid = new THREE.GridHelper(GRID_SIZE, GRID_SIZE, 0x30363d, 0x1d232a);
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
controls.maxPolarAngle = Math.PI * 0.75;
controls.minPolarAngle = Math.PI * 0.1;
controls.addEventListener('change', invalidate);
const movement = createMovement({ camera, controls, getGameMode: () => gameMode, isPlayerDead: () => isPlayerDead });

// Mouse drag look for camera (survival mode, desktop)
// Only start camera drag if not dragging an atom
movement.initMouseLook(renderer.domElement, () => drag === null);

// Touch-based look for mobile (survival mode)
movement.initTouchLook(renderer.domElement);
window.addEventListener('pointermove', onPointerMove);
window.addEventListener('pointerup', onPointerUp);
window.addEventListener('pointercancel', onPointerUp);
window.addEventListener('pointerleave', onPointerUp);
window.addEventListener('resize', () => {
  updateRendererSize();
  invalidate();
});

// Observe scene-wrap size changes (when panels toggle)
if (window.ResizeObserver) {
  const sceneResizeObserver = new ResizeObserver(() => {
    updateRendererSize();
    invalidate();
  });
  sceneResizeObserver.observe(sceneWrap);
}

// ---------------------------------------------------------------------------
// VFX Managers
// ---------------------------------------------------------------------------
const reactionVFX = new ReactionVFXManager(scene, camera);
const catalystFX = new CatalystFX(scene);
const electricityFX = new ElectricityFX(scene);

// ---------------------------------------------------------------------------
// Player Avatar
// ---------------------------------------------------------------------------
function createPlayerAvatar() {
  const avatar = new THREE.Group();

  // Pill-shaped body (capsule)
  const bodyGeo = new THREE.CapsuleGeometry(0.4, 0.8, 8, 16);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x4a90e2,
    roughness: 0.6,
    metalness: 0.2,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.8;
  avatar.add(body);

  // Head (sphere)
  const headGeo = new THREE.SphereGeometry(0.35, 16, 12);
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xffdbac,
    roughness: 0.7,
    metalness: 0.1,
  });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 1.75;
  avatar.add(head);

  // Position avatar at origin (will follow camera in game loop)
  avatar.position.set(0, 0, 0);

  return avatar;
}

const playerAvatar = createPlayerAvatar();
scene.add(playerAvatar);

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

function updateCatalystTracking() {
  const currentCatalystKeys = new Set();

  for (let i = 0; i < lastComps.length; i++) {
    const comp = lastComps[i];
    const an = analyses[i];
    if (!an) continue;
    const formula = an.formula;
    if (!isCatalystFormula(formula)) continue;

    const key = compKey(comp);
    currentCatalystKeys.add(key);

    if (catalystFX.auras.has(key)) continue;

    const catData = getCatalystData(formula);
    if (!catData) continue;

    const center = new THREE.Vector3();
    for (const id of comp.atoms) {
      const p = atoms.get(id).pos;
      center.x += p.x; center.y += p.y; center.z += p.z;
    }
    center.divideScalar(comp.atoms.length);

    catalystFX.registerCatalyst(key, center, catData);
  }

  for (const id of [...catalystFX.auras.keys()]) {
    if (!currentCatalystKeys.has(id)) {
      catalystFX.removeCatalyst(id);
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
    const formulaToName = an.displayFormula || an.formula;
    const name = nameMolecule(comp.atoms.map(id => atoms.get(id)), comp.bonds, formulaToName, an.charge, an.per);
    if (isVi()) {
      const enName = COMMON[formulaToName] || null;
      const viName = name || COMMON_VI[formulaToName] || null;
      if (enName && viName && enName !== viName) return `${enName} (${viName})`;
      return viName || enName || null;
    }
    if (!name) {
      return COMMON[formulaToName] || null;
    }
    return name || null;
  } catch (e) {
    console.error('safeName error:', e);
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
        // Regenerate name based on new displayFormula
        const newFormula = existing.displayFormula || existing.formula;
        existing.name = nameMolecule(comp.atoms.map(id => atoms.get(id)), comp.bonds, newFormula, existing.charge, an.per) || null;
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
    
    // Check quest completion
    questManager.checkDiscovery(an.formula);
    
    // Award star for discovery
    const rankInfo = rankManager.addStars(1);
    updateRankWidget();
  }
  updateDiscList();
}

function loadDiscoveries() {
  try {
    const arr = JSON.parse(localStorage.getItem(DISC_KEY) || '[]');
    for (const d of arr) {
      if (!d || !d.formula) continue;
      d.saved = true;
      // Regenerate name if missing (for old discoveries or after naming fixes)
      if (!d.name && d.tpl) {
        const tpl = d.tpl;
        // Create fake atom objects from template
        const fakeAtoms = tpl.atoms.map((sym, i) => ({
          id: i,
          el: elementBySymBase(sym),
        }));
        const fakeBonds = tpl.bonds.map(([a, b, order, ionic]) => ({
          a, b, order, ionic: !!ionic,
        }));
        const fakeComp = { atoms: fakeAtoms, bonds: fakeBonds };
        const fakeAn = {
          feasible: true,
          formula: d.formula,
          displayFormula: d.displayFormula,
          charge: d.charge ?? 0,
          per: null,
        };
        d.name = safeName(fakeComp, fakeAn);
      }
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
    f.textContent = prettyFormula(d.displayFormula || d.formula) + formulaWithCharge('', d.charge ?? 0);
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
  worldSync.broadcastBondAdd(bonds.get(id));
  return true;
}

function removeBond(bid, undoable = true) {
  const b = bonds.get(bid);
  if (!b) return;
  const compBefore = componentOf(atoms, bonds, b.a);
  const oldKey = compKey(compBefore);
  const ov = overrides.get(oldKey);
  bonds.delete(bid);
  worldSync.broadcastBondRemove(bid);
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
  worldSync.broadcastAtomRemove(id);
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
  worldSync.broadcastBondAdd(b);
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
  const atomData = { id, el, pos };
  clampAtomToBounds(atomData);
  atoms.set(id, atomData);
  worldSync.broadcastAtomAdd(atoms.get(id));
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
  const atmosphereGases = atmosphere.enabled ? [...atmosphere.composition.keys()] : [];
  const seen = new Set();
  const matched = [];
  for (const c of CONDITIONS) {
    const rx = findReaction(formulas, c.key, selectedStructures(), atmosphereGases);
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
  const atmosphereGases = atmosphere.enabled ? [...atmosphere.composition.keys()] : [];
  const rx = findReaction(formulas, cond, selectedStructures(), atmosphereGases);
  if (rx) { executeReaction(rx); return; }
  const valid = conditionsFor(formulas, selectedStructures(), atmosphereGases);
  if (!valid.size) { status(t('status.noReaction'), 'err'); return; }
  if (valid.has(cond)) {
    const more = missingFor(formulas, cond, atmosphereGases);
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
  
  // Track catalysts only during reaction execution
  updateCatalystTracking();
  
  const formulas = selComps.map(c => {
    const an = analyses[lastComps.indexOf(c)];
    return an ? (an.displayFormula || an.formula) : '';
  });
  const atmosphereGases = atmosphere.enabled ? [...atmosphere.composition.keys()] : [];
  const structs = selComps.map(c => structureTplOf(c, analyses[lastComps.indexOf(c)]).tpl);
  if (!findReaction(formulas, rx.condition, structs, atmosphereGases)) {
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
    catalystFX.dispose();
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
  
  // Clean up catalyst auras after reaction
  catalystFX.dispose();

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
  
  // Trigger reaction effects
  if (rx.condition === 'spark' || rx.condition === 'heat') {
    // Exothermic reactions get explosion effect
    reactionVFX.explode(cen, 0.8, new THREE.Color(0xff6600));
    applyExplosionDamage(cen, 0.8, consumedIds.length);
    triggerExplosionEffect(cen, 0.8);
  }
  if (rx.condition === 'uv') {
    // UV reactions get beam effect
    const sourcePos = cen.clone().add(new THREE.Vector3(0, 3, 0));
    const targetPositions = newCompKeys.map(c => c.center.clone());
    triggerUVBeamEffect(sourcePos, targetPositions);
  }
  if (rx.condition === 'electricity') {
    // Electrolysis reactions get lightning arcs
    const arcCount = Math.min(newCompKeys.length, 4);
    for (let i = 0; i < arcCount; i++) {
      const target = newCompKeys[i].center.clone();
      const start = cen.clone().add(new THREE.Vector3(0, 2, 0));
      electricityFX.strike(start, target, {
        intensity: 1.2,
        segments: 6,
        branches: 2,
        sparks: true,
        sparkCount: 15,
      });
    }
    triggerScreenShake(0.2, 300);
  }
  
  // Check quest completion for reaction type
  if (rx.type) {
    questManager.checkReaction(rx.type);
  }
  
  // Broadcast full world sync after reaction (reactions are complex atomic operations)
  worldSync.sendWorldSync(getWorldState);
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

  if (rx.effect === 'explode') {
    triggerScreenShake(0.4, 600);
    reactionVFX.explode(cen, 1.2, new THREE.Color(color));
    applyExplosionDamage(cen, 1.2, consumedIds.length);
  }
  if (rx.effect === 'annihilate') {
    triggerFlash(0xffffff, 500);
    reactionVFX.explode(cen, 2.0, new THREE.Color(0xffffff));
    applyExplosionDamage(cen, 2.0, consumedIds.length);
  }
  if (rx.effect === 'plasma') {
    triggerFlash(0x8800ff, 300);
    reactionVFX.exothermicGlow(cen, 1.5, new THREE.Color(0x8800ff));
  }
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

// ── Reaction Effects Engine ──

const reactionParticles = [];
const uvBeams = [];

/**
 * Trigger explosion burst effect for exothermic reactions
 * High-velocity particle emitters with screen flash and camera shake
 */
function triggerExplosionEffect(center, intensity = 1.0) {
  const count = Math.floor(40 * intensity);
  const colors = [0xff4400, 0xff6600, 0xff8800, 0xffaa00, 0xffcc00];

  for (let i = 0; i < count; i++) {
    const geo = new THREE.SphereGeometry(0.06 + Math.random() * 0.1, 6, 4);
    const color = colors[Math.floor(Math.random() * colors.length)];
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(center);
    const dir = randUnit();
    const speed = (2 + Math.random() * 5) * intensity;
    scene.add(mesh);
    reactionParticles.push({
      mesh, geo, mat,
      v: dir.multiplyScalar(speed),
      life: 1.0,
      decay: 0.6 + Math.random() * 0.8,
      gravity: true,
    });
  }

  // Smoke particles (slower, darker)
  for (let i = 0; i < Math.floor(15 * intensity); i++) {
    const geo = new THREE.SphereGeometry(0.15 + Math.random() * 0.2, 6, 4);
    const mat = new THREE.MeshBasicMaterial({ color: 0x444444, transparent: true, opacity: 0.6 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(center).add(new THREE.Vector3(
      (Math.random() - 0.5) * 0.5,
      (Math.random() - 0.5) * 0.5,
      (Math.random() - 0.5) * 0.5
    ));
    scene.add(mesh);
    reactionParticles.push({
      mesh, geo, mat,
      v: new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.5 + Math.random() * 0.5, (Math.random() - 0.5) * 0.5),
      life: 1.0,
      decay: 0.2 + Math.random() * 0.3,
      expand: true,
    });
  }

  // Screen flash
  triggerFlash(0xff6600, 300 * intensity);
  // Camera shake
  triggerScreenShake(0.3 * intensity, 500 * intensity);
}

/**
 * Trigger UV light beam effect for photolysis reactions
 * Raycasting lines with additive blending
 */
function triggerUVBeamEffect(source, targets) {
  const beamColor = 0x8800ff;
  const beamCount = targets.length;

  for (let i = 0; i < beamCount; i++) {
    const target = targets[i];
    const points = [source.clone(), target.clone()];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: beamColor,
      transparent: true,
      opacity: 0.8,
      linewidth: 2,
      blending: THREE.AdditiveBlending,
    });
    const line = new THREE.Line(geometry, material);
    scene.add(line);

    // Glow sphere at target
    const glowGeo = new THREE.SphereGeometry(0.3, 12, 8);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xaa44ff,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.copy(target);
    scene.add(glow);

    uvBeams.push({
      line, geometry, material,
      glow, glowGeo, glowMat,
      life: 1.0,
      decay: 0.5,
      pulse: true,
    });
  }

  // UV flash at source
  const flashGeo = new THREE.SphereGeometry(0.4, 12, 8);
  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xcc66ff,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
  });
  const flash = new THREE.Mesh(flashGeo, flashMat);
  flash.position.copy(source);
  scene.add(flash);

  reactionParticles.push({
    mesh: flash, geo: flashGeo, mat: flashMat,
    v: new THREE.Vector3(0, 0, 0),
    life: 1.0,
    decay: 1.5,
    expand: true,
  });
}

/**
 * Update reaction effect particles and beams
 */
function updateReactionEffects(dt) {
  // Update explosion/smoke particles
  for (let i = reactionParticles.length - 1; i >= 0; i--) {
    const p = reactionParticles[i];
    p.life -= dt * p.decay;
    if (p.life <= 0) {
      scene.remove(p.mesh);
      p.geo.dispose();
      p.mat.dispose();
      reactionParticles.splice(i, 1);
      continue;
    }
    p.mesh.position.addScaledVector(p.v, dt);
    if (p.gravity) {
      p.v.y -= dt * 3; // gravity
    }
    p.v.multiplyScalar(1 - dt * 2);
    p.mat.opacity = p.life;
    if (p.expand) {
      const s = 1 + (1 - p.life) * 2;
      p.mesh.scale.setScalar(s);
    }
  }

  // Update UV beams
  for (let i = uvBeams.length - 1; i >= 0; i--) {
    const b = uvBeams[i];
    b.life -= dt * b.decay;
    if (b.life <= 0) {
      scene.remove(b.line);
      b.geometry.dispose();
      b.material.dispose();
      scene.remove(b.glow);
      b.glowGeo.dispose();
      b.glowMat.dispose();
      uvBeams.splice(i, 1);
      continue;
    }
    b.material.opacity = b.life * 0.8;
    b.glowMat.opacity = b.life * 0.6;
    if (b.pulse) {
      const pulse = 0.8 + Math.sin(performance.now() * 0.01) * 0.2;
      b.glow.scale.setScalar(pulse);
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
    clampAtomToBounds(at);
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
      const at = atoms.get(d.id);
      if (at) worldSync.broadcastAtomMove(d.id, at.pos);
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
  
  // Check if clicking on a remote player
  const remotePlayer = pickRemotePlayer(e);
  if (remotePlayer && remotePlayer.isDead && !isPlayerDead) {
    // Show revive modal for dead remote player
    showReviveModal(remotePlayer);
    return;
  }
  
  handleReactionPick(e);
});

function pickRemotePlayer(e) {
  setNDC(e);
  raycaster.setFromCamera(ndc, camera);
  
  // Collect all remote player meshes
  const meshes = [];
  playerSync.remotePlayers.forEach(player => {
    if (!player.isDead) return; // Only allow clicking dead players
    player.mesh.traverse(child => {
      if (child.isMesh) {
        child.userData.remotePlayer = player;
        meshes.push(child);
      }
    });
  });
  
  const intersects = raycaster.intersectObjects(meshes, false);
  if (intersects.length > 0) {
    return intersects[0].object.userData.remotePlayer;
  }
  return null;
}

function showReviveModal(remotePlayer) {
  const modal = document.getElementById('revive-modal');
  const nameEl = document.getElementById('revive-player-name');
  
  if (modal && nameEl) {
    nameEl.textContent = remotePlayer.username;
    modal.hidden = false;
    modal.style.display = 'flex';
    
    // Store the player to revive
    modal.dataset.targetPlayerId = remotePlayer.peerId;
  }
}

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
  const rankInfo = rankManager.getCurrentRank();
  for (let z = 1; z <= 118; z++) {
    const el = ELEMENTS.find(e => e.z === z);
    const g = gridPos(z);
    const b = document.createElement('button');
    const unlocked = isElementUnlocked(z, rankInfo);
    b.className = 'el' + (unlocked ? '' : ' locked');
    b.style.gridColumn = g.col;
    b.style.gridRow = g.row;
    b.style.borderColor = unlocked ? el.color : '#555';
    b.dataset.sym = el.sym;
    b.dataset.z = z;
    b.title = unlocked 
      ? t('el.title', { name: elName(el), cat: catLabel(el.cat), max: el.maxBonds })
      : `🔒 ${t('rank.locked')} — ${t('rank.requires')} ${RANKS.find(r => getUnlockedElementCount({rank: r}) >= z)?.name || ''}`;
    b.innerHTML = unlocked 
      ? `<span class="z">${z}</span><span class="s">${el.sym}</span>`
      : `<span class="lock">🔒</span><span class="s">${el.sym}</span>`;
    b.addEventListener('click', () => {
      if (!isElementUnlocked(z, rankManager.getCurrentRank())) {
        status(`🔒 ${t('rank.elementLocked')}`, 'err');
        return;
      }
      spawnAtom(el);
    });
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
  const rankInfo = rankManager.getCurrentRank();
  for (const b of document.querySelectorAll('#pool-list .el-chip')) {
    const el = elementBySym(b.dataset.sym);
    if (!el) continue;
    const unlocked = isElementUnlocked(el.z || 0, rankInfo);
    b.dataset.search = `${el.sym} ${el.name} ${el.z} ${elName(el)} ${fold(el.name)} ${fold(elName(el))}`.toLowerCase();
    b.title = unlocked
      ? t('el.title', { name: elName(el), cat: catLabel(el.cat), max: el.maxBonds })
      : `🔒 ${t('rank.locked')}`;
    b.querySelector('.n').textContent = elName(el);
  }
  for (const b of document.querySelectorAll('#ptable .el[data-sym]')) {
    const el = elementBySym(b.dataset.sym);
    if (el) {
      const unlocked = isElementUnlocked(el.z || 0, rankInfo);
      b.title = unlocked
        ? t('el.title', { name: elName(el), cat: catLabel(el.cat), max: el.maxBonds })
        : `🔒 ${t('rank.locked')}`;
    }
  }
}

function buildPool() {
  buildPeriodicTable();
  const wrap = document.getElementById('pool-list');
  const allElements = [...ELEMENTS];
  if (mayhemMode) allElements.push(...MAYHEM_ELEMENTS);
  allElements.push(...customElements);
  const rankInfo = rankManager.getCurrentRank();
  for (const el of allElements) {
    const b = document.createElement('button');
    const unlocked = el.z ? isElementUnlocked(el.z, rankInfo) : true;
    b.className = 'el-chip' + (unlocked ? '' : ' locked');
    b.dataset.sym = el.sym;
    b.dataset.search = `${el.sym} ${el.name} ${el.z}`.toLowerCase();
    b.title = unlocked
      ? `${el.name} · ${el.cat} · max bonds ${el.maxBonds}`
      : `🔒 ${t('rank.locked')} — ${t('rank.requires')} ${RANKS.find(r => getUnlockedElementCount({rank: r}) >= (el.z || 0))?.name || ''}`;
    const dot = document.createElement('i');
    dot.style.background = unlocked ? el.color : '#555';
    const s = document.createElement('span');
    s.className = 's';
    s.textContent = el.sym;
    const n = document.createElement('span');
    n.className = 'n';
    n.textContent = el.name;
    b.append(dot, s, n);
    
    // Add lock icon for locked elements
    if (!unlocked) {
      const lock = document.createElement('span');
      lock.className = 'el-lock';
      lock.textContent = '🔒';
      b.appendChild(lock);
    }
    
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
    
    b.addEventListener('click', () => {
      if (!isElementUnlocked(el.z || 0, rankManager.getCurrentRank())) {
        status(`🔒 ${t('rank.elementLocked')}`, 'err');
        return;
      }
      spawnFromPool(el);
    });
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

/**
 * Build a template object from a component for functional group detection
 * Returns { atoms: string[], bonds: [[i, j, order, ionic]] }
 */
function buildTemplateFromComponent(comp) {
  if (!comp || comp.atoms.length === 0) return null;
  
  // Map atom IDs to indices
  const idToIdx = new Map();
  const atomSymbols = [];
  for (let i = 0; i < comp.atoms.length; i++) {
    const at = atoms.get(comp.atoms[i]);
    if (!at) return null;
    idToIdx.set(comp.atoms[i], i);
    atomSymbols.push(at.el.sym);
  }
  
  // Build bonds array with indices
  const bondTuples = [];
  for (const b of comp.bonds) {
    const ai = idToIdx.get(b.a);
    const bi = idToIdx.get(b.b);
    if (ai !== undefined && bi !== undefined) {
      bondTuples.push([ai, bi, b.order || 1, b.ionic || false]);
    }
  }
  
  return { atoms: atomSymbols, bonds: bondTuples };
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
    // Also reset kinetics panel
    if (kineticsBody) kineticsBody.hidden = true;
    if (kineticsEmpty) kineticsEmpty.style.display = '';
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
  
  // Build template for functional group detection
  const tpl = buildTemplateFromComponent(comp);
  const groups = tpl ? tagFunctionalGroups(tpl) : [];
  const groupLabels = {
    [GROUP_TYPES.ALCOHOL]: '🧪 Alcohol (-OH)',
    [GROUP_TYPES.PHENOL]: '🧪 Phenol (Ar-OH)',
    [GROUP_TYPES.ALDEHYDE]: '🧪 Aldehyde (-CHO)',
    [GROUP_TYPES.KETONE]: '🧪 Ketone (C=O)',
    [GROUP_TYPES.CARBOXYL]: '🧪 Carboxyl (-COOH)',
    [GROUP_TYPES.ESTER]: '🧪 Ester (-COO-)',
    [GROUP_TYPES.ETHER]: '🧪 Ether (-O-)',
    [GROUP_TYPES.AMINE_PRIMARY]: '🧪 Primary Amine (-NH₂)',
    [GROUP_TYPES.AMINE_SECONDARY]: '🧪 Secondary Amine (-NH-)',
    [GROUP_TYPES.AMINE_TERTIARY]: '🧪 Tertiary Amine (-N<)',
    [GROUP_TYPES.AMIDE]: '🧪 Amide (-CONH-)',
    [GROUP_TYPES.ALKENE]: '🧪 Alkene (C=C)',
    [GROUP_TYPES.ALKYNE]: '🧪 Alkyne (C≡C)',
    [GROUP_TYPES.ARYL]: '🧪 Aryl (aromatic ring)',
    [GROUP_TYPES.HALIDE]: '🧪 Halide (C-X)',
    [GROUP_TYPES.NITRILE]: '🧪 Nitrile (-C≡N)',
    [GROUP_TYPES.NITRO]: '🧪 Nitro (-NO₂)',
    [GROUP_TYPES.THIOL]: '🧪 Thiol (-SH)',
    [GROUP_TYPES.EPOXIDE]: '🧪 Epoxide (cyclic ether)',
  };
  
  let groupHtml = '';
  if (groups.length > 0) {
    const uniqueGroups = [...new Set(groups.map(g => g.group))];
    groupHtml = `<div class="mol-groups">${uniqueGroups.map(g => 
      `<span class="group-tag">${groupLabels[g] || g}</span>`
    ).join('')}</div>`;
  }
  
  mol.innerHTML = `<div class="mol-formula">${fHtml}</div><div id="mol-name">${name || t('mol.unnamed')}<span class="mol-type">${type.label}</span></div>
    <span class="muted">${t('mol.stats', { a: comp.atoms.length, b: comp.bonds.length })}</span>${groupHtml}`;
  if (!an.feasible) {
    warn.style.display = 'block';
    warn.textContent = trReason(an.reason) || t('chem.lewis.charge');
  } else {
    // A received ionic electron that cannot pair (odd pool) means the
    // transfer is only partial — surface it instead of showing a silent +1.
    const partial = comp.atoms.find(id => {
      const p = an.per.get(id);
      if (!p || p.isMetal || !p.bonded || !p.ionU) return false;
      const at = atoms.get(id);
      const V = calcValenceFromShells(at.el.z);
      return (V + p.ionU - p.covSum) % 2 !== 0;
    });
    if (partial) {
      warn.style.display = 'block';
      warn.textContent = t('chem.partialIonic', { sym: elName(atoms.get(partial).el) });
    } else {
      warn.style.display = 'none';
    }
  }
  
  // Update kinetics panel
  updateKineticsPanel(comp, an);
}

// ─ Kinetics panel ──

const kineticsBody = document.getElementById('kinetics-body');
const kineticsEmpty = document.getElementById('kinetics-empty');
const kineticTempEl = document.getElementById('kinetic-temp');
const kineticEaEl = document.getElementById('kinetic-ea');
const kineticRateEl = document.getElementById('kinetic-rate');
const kineticHalflifeEl = document.getElementById('kinetic-halflife');
const kineticDecompEl = document.getElementById('kinetic-decomp');
const kineticsCanvas = document.getElementById('kinetics-canvas');

function updateKineticsPanel(comp, an) {
  if (!comp || comp.bonds.length === 0 || !an) {
    kineticsBody.hidden = true;
    kineticsEmpty.style.display = '';
    return;
  }
  
  // Get simulation analysis for this component
  const simAnalysis = comp.simulation;
  if (!simAnalysis) {
    kineticsBody.hidden = true;
    kineticsEmpty.style.display = '';
    return;
  }
  
  kineticsBody.hidden = false;
  kineticsEmpty.style.display = 'none';
  
  const temp = simAnalysis.kinetics.temperature || 298.15;
  const ea = simAnalysis.kinetics.activationEnergy || 200;
  const rateConstant = simAnalysis.kinetics.rateConstant;
  const halfLife = simAnalysis.kinetics.halfLife;
  const decompProb = simAnalysis.kinetics.decompositionProbability;
  
  kineticTempEl.textContent = `${temp.toFixed(1)} K`;
  kineticEaEl.textContent = `${ea.toFixed(1)} kJ/mol`;
  kineticRateEl.textContent = rateConstant ? `${rateConstant.toExponential(2)} s¹` : '—';
  kineticHalflifeEl.textContent = halfLife ? formatTime(halfLife) : '—';
  kineticDecompEl.textContent = `${(decompProb * 100).toFixed(1)}%`;
  
  // Draw decay graph
  drawKineticsGraph(ea, temp);
}

function formatTime(seconds) {
  if (seconds < 0.001) return `${(seconds * 1000000).toFixed(1)} μs`;
  if (seconds < 1) return `${(seconds * 1000).toFixed(1)} ms`;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)} min`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)} h`;
  if (seconds < 3.156e7) return `${(seconds / 86400).toFixed(1)} d`;
  const y = seconds / 3.156e7;
  return y < 1e4 ? `${y.toFixed(1)} y` : `${y.toExponential(1)} y`;
}

function drawKineticsGraph(ea, temp) {
  if (!kineticsCanvas) return;
  const ctx = kineticsCanvas.getContext('2d');
  const width = kineticsCanvas.width;
  const height = kineticsCanvas.height;
  
  // Get theme colors
  const styles = getComputedStyle(document.documentElement);
  const accentColor = styles.getPropertyValue('--accent').trim() || '#4a9eff';
  const borderColor = styles.getPropertyValue('--border').trim() || 'rgba(60, 120, 200, 0.25)';
  const textColor = styles.getPropertyValue('--muted').trim() || '#5a7090';
  const bgColor = styles.getPropertyValue('--panel-2').trim() || 'rgba(14, 22, 40, 0.92)';
  
  ctx.clearRect(0, 0, width, height);
  
  // Calculate rate constant
  const R = 8.314e-3; // kJ/(mol·K)
  const A = 1e13; // Pre-exponential factor (s⁻¹)
  const k = A * Math.exp(-ea / (R * temp));
  
  // Graph dimensions with padding
  const pad = { left: 45, right: 15, top: 20, bottom: 35 };
  const graphW = width - pad.left - pad.right;
  const graphH = height - pad.top - pad.bottom;
  const numTicks = 4; // Number of intervals for grid and labels
  
  // Draw grid lines
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 0.5;
  ctx.setLineDash([2, 3]);
  
  // Horizontal grid (concentration levels)
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (graphH * i / 4);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();
  }
  
  // Vertical grid (time markers) - match the 4 ticks
  for (let i = 0; i <= numTicks; i++) {
    const x = pad.left + (graphW * i / numTicks);
    ctx.beginPath();
    ctx.moveTo(x, pad.top);
    ctx.lineTo(x, height - pad.bottom);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  
  // Draw axes with thicker lines
  ctx.strokeStyle = textColor;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top);
  ctx.lineTo(pad.left, height - pad.bottom);
  ctx.lineTo(width - pad.right, height - pad.bottom);
  ctx.stroke();
  
  // Draw axis ticks and labels
  ctx.fillStyle = textColor;
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  
  // X-axis ticks (time) - show only 4 labels to avoid crowding
  const maxTime = 5 / k; // Show 5 half-lives worth
  for (let i = 0; i <= numTicks; i++) {
    const x = pad.left + (graphW * i / numTicks);
    const t = (maxTime * i / numTicks);
    ctx.beginPath();
    ctx.moveTo(x, height - pad.bottom);
    ctx.lineTo(x, height - pad.bottom + 3);
    ctx.stroke();
    const label = formatTimeShort(t);
    ctx.fillText(label, x, height - pad.bottom + 14);
  }
  
  // Y-axis ticks (concentration %)
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (graphH * i / 4);
    const pct = 100 - (i * 25);
    ctx.beginPath();
    ctx.moveTo(pad.left - 3, y);
    ctx.lineTo(pad.left, y);
    ctx.stroke();
    ctx.fillText(`${pct}%`, pad.left - 5, y + 3);
  }
  
  // Draw curve with gradient fill
  const timeScale = maxTime / graphW;
  
  // Create gradient for fill
  const gradient = ctx.createLinearGradient(0, pad.top, 0, height - pad.bottom);
  gradient.addColorStop(0, accentColor + '40'); // 25% opacity at top
  gradient.addColorStop(1, accentColor + '05'); // 2% opacity at bottom
  
  // Fill area under curve
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(pad.left, height - pad.bottom);
  
  for (let x = 0; x <= graphW; x++) {
    const t = x * timeScale;
    const concentration = Math.exp(-k * t);
    const y = pad.top + graphH * (1 - concentration);
    ctx.lineTo(pad.left + x, y);
  }
  
  ctx.lineTo(pad.left + graphW, height - pad.bottom);
  ctx.closePath();
  ctx.fill();
  
  // Draw curve line with glow effect
  ctx.shadowColor = accentColor;
  ctx.shadowBlur = 8;
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  
  for (let x = 0; x <= graphW; x++) {
    const t = x * timeScale;
    const concentration = Math.exp(-k * t);
    const y = pad.top + graphH * (1 - concentration);
    
    if (x === 0) ctx.moveTo(pad.left, y);
    else ctx.lineTo(pad.left + x, y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
  
  // Draw half-life marker
  const halfLife = Math.LN2 / k;
  const halfLifeX = pad.left + (halfLife / maxTime) * graphW;
  if (halfLifeX < width - pad.right) {
    ctx.strokeStyle = accentColor + '80';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(halfLifeX, pad.top);
    ctx.lineTo(halfLifeX, height - pad.bottom);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Label
    ctx.fillStyle = accentColor;
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('t½', halfLifeX, pad.top - 5);
  }
  
  // Axis labels
  ctx.fillStyle = textColor;
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Time', width / 2, height - 5);
  
  ctx.save();
  ctx.translate(12, height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('Concentration', 0, 0);
  ctx.restore();
}

function formatTimeShort(seconds) {
  if (seconds < 1e-9) return '0';
  if (seconds < 1e-6) return `${(seconds * 1e9).toFixed(0)}ns`;
  if (seconds < 1e-3) return `${(seconds * 1e6).toFixed(0)}μs`;
  if (seconds < 1) return `${(seconds * 1e3).toFixed(0)}ms`;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`;
  if (seconds < 3.15e7) return `${(seconds / 86400).toFixed(1)}d`;
  if (seconds < 3.15e10) return `${(seconds / 3.15e7).toFixed(1)}y`;
  // Use scientific notation for very large numbers
  const exp = Math.floor(Math.log10(seconds));
  const mantissa = seconds / Math.pow(10, exp);
  return `${mantissa.toFixed(1)}e${exp}s`;
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

/**
 * Calculate valence electrons dynamically from electron shells
 * For main group elements: outermost shell electrons
 * For transition metals/lanthanides/actinides: outermost s + d/f electrons
 */
function calcValenceFromShells(z) {
  const shells = electronShells(z);
  if (shells.length === 0) return 0;
  
  // For H and He
  if (z <= 2) return shells[0];
  
  // For main group elements (s and p blocks)
  const outermost = shells[shells.length - 1];
  
  // For transition metals, include d electrons from previous shell
  if (z >= 21 && z <= 30) {
    const dElectrons = shells.length >= 2 ? shells[shells.length - 2] : 0;
    return outermost + dElectrons;
  }
  
  // For lanthanides/actinides, include f electrons
  if ((z >= 57 && z <= 71) || (z >= 89 && z <= 103)) {
    // Actinides commonly show +3, +4, +5, +6 oxidation states
    // Use outermost s + d + f electrons for bonding capacity
    const fElectrons = shells.length >= 3 ? shells[shells.length - 3] : 0;
    const dElectrons = shells.length >= 2 ? shells[shells.length - 2] : 0;
    return Math.min(outermost + dElectrons + fElectrons, 8);
  }
  
  // For other transition metals (period 4-6 d-block)
  if (z >= 39 && z <= 48 || z >= 72 && z <= 80) {
    const dElectrons = shells.length >= 2 ? shells[shells.length - 2] : 0;
    return outermost + dElectrons;
  }
  
  return outermost;
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
  const valence = calcValenceFromShells(el.z);

  let shellHtml = shells.map((n, i) =>
    `<span class="shell-badge">${SHELL_NAMES[i]}: ${n}e⁻</span>`
  ).join('');

  stats.innerHTML = `
    <div><span class="stat-label">${t('bohr.atomic')}</span><br><span class="stat-value">${el.z}</span></div>
    <div><span class="stat-label">${t('bohr.mass')}</span><br><span class="stat-value">${el.mass}</span></div>
    <div><span class="stat-label">${t('bohr.protons')}</span><br><span class="stat-value">${el.z}</span></div>
    <div><span class="stat-label">${t('bohr.neutrons')}</span><br><span class="stat-value">${neutrons}</span></div>
    <div><span class="stat-label">${t('bohr.electrons')}</span><br><span class="stat-value">${el.z}</span></div>
    <div><span class="stat-label">${t('bohr.valence')}</span><br><span class="stat-value">${valence}</span></div>
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
        openIsomerPanel(i);
      });
      row.appendChild(btn);
    }

    list.appendChild(row);
  });
  if (!shown) list.textContent = t('list.empty');
}

let isomerPanelCompIdx = null;

function openIsomerPanel(compIdx) {
  isomerPanelCompIdx = compIdx;
  const an = analyses[compIdx];
  const panel = document.getElementById('isomer-panel');
  const title = document.getElementById('isomer-panel-title');
  const input = document.getElementById('isomer-input');
  const result = document.getElementById('isomer-result');

  title.textContent = (isVi() ? 'Kiểm tra đồng phân của ' : 'Validate isomer of ') + prettyFormula(an.displayFormula || an.formula);
  input.value = '';
  result.innerHTML = '';
  result.className = 'isomer-result';

  panel.classList.add('open');
  panel.setAttribute('aria-hidden', 'false');
  input.focus();
}

function closeIsomerPanel() {
  const panel = document.getElementById('isomer-panel');
  panel.classList.remove('open');
  panel.setAttribute('aria-hidden', 'true');
  isomerPanelCompIdx = null;
}

// Parse a condensed formula (e.g., "C2H5OH", "CH3CH2CH3") to an atom ordering
// with heavy atoms first, then hydrogens (matching the app's isomer template format)
function parseCondensedToOrdering(formula) {
  const counts = parseFormula(formula);
  if (counts.size === 0) return null;
  
  // Extract heavy atoms (non-H) in the order they appear in the formula
  const heavyAtoms = [];
  const re = /([A-Z][a-z]?)(\d*)/g;
  let m;
  while ((m = re.exec(formula)) !== null) {
    const sym = m[1];
    const count = m[2] ? parseInt(m[2]) : 1;
    if (sym !== 'H') {
      for (let i = 0; i < count; i++) heavyAtoms.push(sym);
    }
  }
  
  // Add all hydrogens at the end
  const hCount = counts.get('H') || 0;
  for (let i = 0; i < hCount; i++) heavyAtoms.push('H');
  
  return heavyAtoms;
}

// Check if two atom orderings match (same elements in same order)
function orderingsMatch(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function checkIsomer() {
  if (isomerPanelCompIdx === null) return;
  const an = analyses[isomerPanelCompIdx];
  const input = document.getElementById('isomer-input');
  const result = document.getElementById('isomer-result');
  const query = input.value.trim();

  if (!query) {
    result.innerHTML = '<div class="isomer-error">Please enter an arrangement</div>';
    return;
  }

  const isos = isomerTemplates(an.formula);
  const queryUpper = query.toUpperCase();

  // Find matching isomer by display formula or key
  let match = isos.find(iso => {
    const df = (iso.displayFormula || an.formula).toUpperCase();
    const key = (iso.key || '').toUpperCase();
    return df === queryUpper || key === queryUpper;
  });

  // If no direct match, try parsing as a condensed formula (e.g., "C2H5OH", "CH3CH2CH3")
  if (!match) {
    try {
      const queryCounts = parseFormula(query);
      const moleculeCounts = parseFormula(an.formula);
      // Compare element counts
      const sameFormula = queryCounts.size === moleculeCounts.size &&
        [...queryCounts.entries()].every(([sym, count]) => moleculeCounts.get(sym) === count);
      if (sameFormula) {
        // Molecular formula matches — try to match the atom ordering
        const queryOrdering = parseCondensedToOrdering(query);
        if (queryOrdering) {
          // Find isomer whose atom ordering matches
          match = isos.find(iso => {
            if (!iso.tpl || !iso.tpl.atoms) return false;
            return orderingsMatch(iso.tpl.atoms, queryOrdering);
          });
        }
        // If still no match, accept the first isomer (fallback)
        if (!match) match = isos[0];
      }
    } catch (e) {
      // parseFormula failed — not a valid formula
    }
  }

  if (!match) {
    result.innerHTML = `<div class="isomer-error">Invalid arrangement. Valid isomers: ${isos.map(i => i.displayFormula || an.formula).join(', ')}</div>`;
    return;
  }

  // Show the valid isomer
  const cls = classifyMolecule(an.formula, match.tpl.charge || 0, null);
  result.innerHTML = `
    <div class="isomer-valid">
      <div class="isomer-valid-name">${match.displayName || match.key}</div>
      <div class="isomer-valid-formula">${match.displayFormula || an.formula}</div>
      <span class="isomer-badge ${cls.key || ''}">${cls.label}</span>
      <button class="isomer-apply-btn">Apply</button>
    </div>
  `;

  const applyBtn = result.querySelector('.isomer-apply-btn');
  applyBtn.addEventListener('click', () => {
    swapToIsomer(isomerPanelCompIdx, match);
    closeIsomerPanel();
  });
}

document.getElementById('isomer-panel-close').addEventListener('click', closeIsomerPanel);
document.getElementById('isomer-check-btn').addEventListener('click', checkIsomer);
document.getElementById('isomer-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') checkIsomer();
});

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
    const atomData = { id: a.id, el: a.el, pos };
    clampAtomToBounds(atomData);
    atoms.set(a.id, atomData);
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

  closeIsomerPanel();
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
  worldSync.broadcastChargeSet(key, v);
  pushUndo({ type: 'snapshot', atoms: [...atoms.values()].map(snapAtom), bonds: [...bonds.values()].map(b => ({ ...b })), overrides: [...overrides], iso: [...isoSel], nextId: nextId });
  reanalyze();
  status(t('status.chargeSet', { v: fmtCharge(v) }), 'ok');
}

// ---------------------------------------------------------------------------
// World state sync for multiplayer
// ---------------------------------------------------------------------------
function getWorldState() {
  const atomsArr = [];
  for (const a of atoms.values()) {
    atomsArr.push({ id: a.id, el: a.el.sym, x: a.pos.x, y: a.pos.y, z: a.pos.z });
  }
  const bondsArr = [];
  for (const b of bonds.values()) {
    bondsArr.push({ id: b.id, a: b.a, b: b.b, order: b.order, ionic: b.ionic });
  }
  const overridesArr = [];
  for (const [k, v] of overrides) {
    overridesArr.push([k, v]);
  }
  return { atoms: atomsArr, bonds: bondsArr, overrides: overridesArr, nextId };
}

function applyWorldSync(data) {
  if (!data) return;
  
  atoms.clear();
  bonds.clear();
  overrides.clear();
  
  if (data.atoms) {
    for (const a of data.atoms) {
      const el = elementBySym(a.el);
      if (el) {
        atoms.set(a.id, { id: a.id, el, pos: { x: a.x, y: a.y, z: a.z } });
      }
    }
  }
  
  if (data.bonds) {
    for (const b of data.bonds) {
      bonds.set(b.id, { id: b.id, a: b.a, b: b.b, order: b.order, ionic: b.ionic });
    }
  }
  
  if (data.overrides) {
    for (const [k, v] of data.overrides) {
      overrides.set(k, v);
    }
  }
  
  if (typeof data.nextId === 'number') {
    nextId = Math.max(nextId, data.nextId);
  }
  
  selectedId = null;
  hoverId = null;
  reanalyze();
  needsRender = true;
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
  '__mol3d.hacks.setStars(',
  '__mol3d.hacks.addStars(',
  '__mol3d.hacks.removeStars(',
  '__mol3d.hacks.debugRank()',
  '__mol3d.hacks.adminExport()',
  '__mol3d.hacks.triggerDeath()',
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
  const rankInfo = rankManager.getCurrentRank();
  if (!isFeatureUnlocked('console', rankInfo)) {
    const req = getRequiredRankForFeature('console');
    status(t('rank.featureLocked', { rank: req?.name || 'Further Beyond' }), 'err');
    return;
  }
  mobileConsole.hidden = !mobileConsole.hidden;
  if (!mobileConsole.hidden) {
    consoleInput.focus();
    btnMenu.setAttribute('aria-expanded', 'false');
    menuDropdown.hidden = true;
  }
});

// Return to Lobby button (multiplayer only)
const btnReturnLobby = document.getElementById('btn-return-lobby');
if (btnReturnLobby) {
  btnReturnLobby.addEventListener('click', () => {
    window.location.href = 'index.html';
  });
}

// Export/Import Progress System
document.getElementById('btn-export').addEventListener('click', () => {
  try {
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      scene: {
        atoms: [...atoms.values()].map(a => ({ id: a.id, z: a.el.z, pos: a.pos })),
        bonds: [...bonds.values()].map(b => ({ id: b.id, a: b.a, b: b.b, order: b.order, ionic: b.ionic })),
        nextId,
      },
      discoveries: discoveries.map(d => ({ ...d })),
      completed: [...completed],
      overrides: [...overrides],
      isoSel: [...isoSel],
      rank: { totalStars: rankManager.totalStars, currentRank: rankManager.getCurrentRank() },
      quests: { stars: questManager.getStars(), completed: [...questManager.completedQuests] },
      player: {
        health: playerHealth,
        cameraPosition: camera.position.toArray(),
        cameraTarget: controls.target.toArray(),
      },
      settings: {
        theme: document.documentElement.dataset.theme || 'dark',
        lang: getLang(),
        quality: qualityMode,
      },
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chemistry_progress_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    status(t('status.exported', { count: discoveries.length }), 'ok');
    btnMenu.setAttribute('aria-expanded', 'false');
    menuDropdown.hidden = true;
  } catch (err) {
    console.error('Export failed:', err);
    status(t('status.exportFailed', { error: err.message }), 'err');
  }
});

document.getElementById('btn-import-progress').addEventListener('click', () => {
  document.getElementById('import-file-input').click();
  btnMenu.setAttribute('aria-expanded', 'false');
  menuDropdown.hidden = true;
});

document.getElementById('import-file-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target.result);

      // Validate schema
      if (!data.version || !data.scene || !Array.isArray(data.scene.atoms)) {
        throw new Error('Invalid file format');
      }

      // Clear current state
      clearAll();

      // Restore scene
      for (const a of data.scene.atoms) {
        if (!a || !Number.isInteger(a.id) || !a.pos) continue;
        const el = ELEMENTS.find(e => e.z === a.z);
        if (!el) continue;
        atoms.set(a.id, { id: a.id, el, pos: { x: +a.pos.x || 0, y: +a.pos.y || 0, z: +a.pos.z || 0 } });
      }
      for (const b of Array.isArray(data.scene.bonds) ? data.scene.bonds : []) {
        if (b && Number.isInteger(b.id) && atoms.has(b.a) && atoms.has(b.b)) {
          bonds.set(b.id, { ...b });
        }
      }
      if (data.scene.nextId) nextId = data.scene.nextId;

      // Restore discoveries
      if (Array.isArray(data.discoveries)) {
        discoveries.length = 0;
        for (const d of data.discoveries) {
          discoveries.push({ ...d });
        }
      }

      // Restore completed challenges
      if (Array.isArray(data.completed)) {
        completed.clear();
        for (const c of data.completed) completed.add(c);
      }

      // Restore overrides and isoSel
      if (Array.isArray(data.overrides)) {
        overrides.clear();
        for (const [k, v] of data.overrides) {
          if (typeof k === 'string' && Number.isInteger(v)) overrides.set(k, v);
        }
      }
      if (Array.isArray(data.isoSel)) {
        isoSel.clear();
        for (const [k, v] of data.isoSel) {
          if (typeof k === 'string' && typeof v === 'string') isoSel.set(k, v);
        }
      }

      // Restore rank and quests
      if (data.rank) {
        if (typeof data.rank.totalStars === 'number') {
          rankManager.totalStars = data.rank.totalStars;
          rankManager.saveProgress();
          rankManager.emit('starsChanged', { totalStars: rankManager.totalStars, rank: rankManager.getCurrentRank() });
          updateRankWidget();
          rebuildPool();
        }
      }
      if (data.quests) {
        if (typeof data.quests.stars === 'number') {
          questManager.stars = data.quests.stars;
        }
        if (Array.isArray(data.quests.completed)) {
          questManager.completedQuests.clear();
          for (const qid of data.quests.completed) {
            if (typeof qid === 'string') questManager.completedQuests.add(qid);
          }
        }
        questManager.saveProgress();
      }

      // Restore player state
      if (data.player) {
        if (typeof data.player.health === 'number') {
          playerHealth = Math.max(0, Math.min(MAX_HEALTH, data.player.health));
          updateHealthBar();
        }
        if (Array.isArray(data.player.cameraPosition) && data.player.cameraPosition.length === 3) {
          camera.position.fromArray(data.player.cameraPosition);
        }
        if (Array.isArray(data.player.cameraTarget) && data.player.cameraTarget.length === 3) {
          controls.target.fromArray(data.player.cameraTarget);
        }
      }

      // Restore settings
      if (data.settings) {
        if (data.settings.theme) {
          themeMode = data.settings.theme;
          applyTheme(themeMode);
          try { localStorage.setItem(THEME_KEY, themeMode); } catch { /* session-only */ }
        }
        if (data.settings.lang) setLang(data.settings.lang);
      }

      reanalyze();
      save(true);
      status(t('status.imported', { atoms: atoms.size, discoveries: discoveries.length }), 'ok');
    } catch (err) {
      console.error('Import failed:', err);
      status(t('status.importFailed', { error: err.message }), 'err');
    }
  };
  reader.readAsText(file);
  e.target.value = ''; // Reset input
});

// Respawn button handler
document.getElementById('btn-respawn').addEventListener('click', () => {
  respawnPlayer();
});

// Revive button handler
document.getElementById('btn-revive').addEventListener('click', () => {
  const modal = document.getElementById('revive-modal');
  const targetPlayerId = modal?.dataset.targetPlayerId;
  
  if (targetPlayerId && network.roomId) {
    // Broadcast revive to all players
    network.broadcast(null, 11, {
      playerId: targetPlayerId,
      reviverId: network.playerId,
      timestamp: Date.now(),
    });
    
    // Update local state
    const remotePlayer = playerSync.remotePlayers.get(targetPlayerId);
    if (remotePlayer) {
      remotePlayer.isDead = false;
      remotePlayer.updateVisuals();
      status(`Revived ${remotePlayer.username}`, 'ok');
    }
  }
  
  // Hide modal
  if (modal) {
    modal.hidden = true;
    modal.style.display = 'none';
  }
});

// Game mode toggle button
const btnGameMode = document.getElementById('btn-game-mode');
if (btnGameMode) {
  btnGameMode.addEventListener('click', () => {
    const newMode = gameMode === 'survival' ? 'creative' : 'survival';
    setGameMode(newMode);
    btnGameMode.textContent = newMode === 'survival' ? t('btn.gameMode.survival') : t('btn.gameMode.creative');
  });
}

// Game mode toggle (add to menu or keyboard shortcut)
// For now, use console command or add a button to the menu
window.setGameMode = setGameMode; // Expose for console access

// Expose X-ray and Proton Gun functions for inline HTML handlers
window.isXRayActive = false;
window.protonGunActive = false;
window.toggleXRayVisuals = function() {
  if (window.isXRayActive) {
    atomMatM.transparent = true;
    atomMatM.opacity = 0.4;
    atomMatM.wireframe = true;
    atomMatN.transparent = true;
    atomMatN.opacity = 0.4;
    atomMatN.wireframe = true;
  } else {
    atomMatM.transparent = false;
    atomMatM.opacity = 1.0;
    atomMatM.wireframe = false;
    atomMatN.transparent = false;
    atomMatN.opacity = 1.0;
    atomMatN.wireframe = false;
  }
  atomMatM.needsUpdate = true;
  atomMatN.needsUpdate = true;
  invalidate();
  status(window.isXRayActive ? 'X-Ray mode enabled' : 'X-Ray mode disabled', 'info');
};
window.toggleProtonGun = function() {
  window.protonGunActive = !window.protonGunActive;
  status(window.protonGunActive ? 'Proton gun activated - Click atoms to shoot!' : 'Proton gun deactivated', 'info');
};

// Set initial UI state for default survival mode
const joyJumpInit = document.getElementById('joy-jump');
if (joyJumpInit) joyJumpInit.classList.add('visible');
const joyVertInit = document.getElementById('joy-vert');
if (joyVertInit) joyVertInit.style.display = 'none';

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
  const rankInfo = rankManager.getCurrentRank();
  if (!isFeatureUnlocked('mayhem', rankInfo)) {
    const req = getRequiredRankForFeature('mayhem');
    status(t('rank.featureLocked', { rank: req?.name || 'Experienced' }), 'err');
    return;
  }
  mayhemMode = !mayhemMode;
  document.getElementById('btn-mayhem').classList.toggle('on', mayhemMode);
  document.getElementById('btn-import').hidden = !mayhemMode;
  rebuildPool();
  status(mayhemMode ? 'Mayhem mode ON — exotic elements unlocked!' : 'Mayhem mode OFF');
});


// ─ Time Control Modal & Effects ──
const SPEED_LEVELS = [1, 2, 5, 10, 50, 100, 1000, 10000, 100000, 1e6, 1e7, 1e8, 1e9];

function playSFX(id) {
  const audio = document.getElementById(id);
  if (audio) {
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }
}

function updateAnalogClock() {
  const totalSeconds = simulationTime;
  const hours = (totalSeconds / 3600) % 12;
  const minutes = (totalSeconds / 60) % 60;
  const seconds = totalSeconds % 60;

  const hourHand = document.querySelector('.hour-hand');
  const minuteHand = document.querySelector('.minute-hand');
  const secondHand = document.querySelector('.second-hand');

  if (hourHand) hourHand.style.transform = `rotate(${hours * 30}deg)`;
  if (minuteHand) minuteHand.style.transform = `rotate(${minutes * 6}deg)`;
  if (secondHand) secondHand.style.transform = `rotate(${seconds * 6}deg)`;
}

function openTimeModal() {
  const modal = document.getElementById('time-modal');
  if (modal) {
    modal.hidden = false;
    updateAnalogClock();
    updateSpeedSlider();
  }
}

function closeTimeModal() {
  const modal = document.getElementById('time-modal');
  if (modal) modal.hidden = true;
}

function updateSpeedSlider() {
  const slider = document.getElementById('time-speed-range');
  const value = document.getElementById('time-speed-value');
  if (slider && value) {
    const idx = SPEED_LEVELS.indexOf(timeSpeed);
    slider.value = idx >= 0 ? idx : 0;
    value.textContent = formatSpeed(timeSpeed);
  }
}

document.getElementById('btn-time-menu').addEventListener('click', () => {
  console.log('Time menu clicked');
  openTimeModal();
});
document.getElementById('time-modal-close').addEventListener('click', closeTimeModal);

document.getElementById('time-speed-range').addEventListener('input', (e) => {
  const idx = parseInt(e.target.value);
  if (idx >= 0 && idx < SPEED_LEVELS.length) {
    timeSpeed = SPEED_LEVELS[idx];
    updateSpeedSlider();
    updateTimeDisplay();
    status(`⏱ Speed: ${formatSpeed(timeSpeed)}`);
  }
});

document.getElementById('btn-modal-freeze').addEventListener('click', () => {
  toggleFreeze();
  if (timeFrozen) {
    triggerTheWorld();
  } else {
    triggerTimeResume();
  }
  status(timeFrozen ? ' Time frozen' : '▶️ Time resumed');
});

document.getElementById('btn-modal-rewind').addEventListener('click', () => {
  const idx = SPEED_LEVELS.indexOf(timeSpeed);
  if (idx > 0) {
    timeSpeed = SPEED_LEVELS[idx - 1];
    updateSpeedSlider();
    updateTimeDisplay();
    status(` Speed: ${formatSpeed(timeSpeed)}`);
  }
});

document.getElementById('btn-modal-forward').addEventListener('click', () => {
  const idx = SPEED_LEVELS.indexOf(timeSpeed);
  if (idx < SPEED_LEVELS.length - 1) {
    triggerMadeInHeaven(SPEED_LEVELS[idx + 1]);
  }
});

// ── THE WORLD Effect ──
function triggerTheWorld() {
  console.log('[THE WORLD] triggerTheWorld called');
  playSFX('sfx-timestop');

  const overlay = document.getElementById('time-effect-overlay');
  const sphere = overlay.querySelector('.effect-sphere');
  const flash = overlay.querySelector('.effect-flash');
  const sceneWrap = document.getElementById('scene-wrap');
  console.log('[THE WORLD] overlay:', !!overlay, 'sphere:', !!sphere, 'sceneWrap:', !!sceneWrap);

  overlay.hidden = false;
  sphere.classList.remove('expanding', 'contracting');
  flash.classList.remove('flash', 'release');

  void sphere.offsetWidth;

  sphere.classList.add('expanding');
  setTimeout(() => flash.classList.add('flash'), 200);

  sceneWrap.classList.remove('the-world-releasing');
  sceneWrap.classList.add('the-world-active');

  setTimeout(() => {
    sphere.classList.remove('expanding');
    flash.classList.remove('flash', 'release');
    overlay.hidden = true;
    sceneWrap.classList.remove('the-world-releasing');
    if (!timeFrozen) sceneWrap.classList.remove('the-world-active');
  }, 1500);
}

function triggerTimeResume() {
  console.log('[TIME RESUME] triggerTimeResume called');
  playSFX('sfx-timeresume');

  const overlay = document.getElementById('time-effect-overlay');
  const sphere = overlay.querySelector('.effect-sphere');
  const flash = overlay.querySelector('.effect-flash');
  const sceneWrap = document.getElementById('scene-wrap');
  console.log('[TIME RESUME] overlay:', !!overlay, 'sphere:', !!sphere);

  overlay.hidden = false;
  sphere.classList.remove('expanding', 'contracting');
  flash.classList.remove('flash', 'release');

  void sphere.offsetWidth;

  sphere.classList.add('contracting');
  setTimeout(() => flash.classList.add('flash', 'release'), 300);

  sceneWrap.classList.add('the-world-releasing');

  setTimeout(() => {
    sphere.classList.remove('contracting');
    flash.classList.remove('flash', 'release');
    overlay.hidden = true;
    sceneWrap.classList.remove('the-world-releasing');
    if (!timeFrozen) sceneWrap.classList.remove('the-world-active');
  }, 1500);
}

// ── Made in Heaven Effect ──
function triggerMadeInHeaven(targetSpeed) {
  playSFX('sfx-acceleration');

  const startSpeed = timeSpeed;
  const duration = 2000;
  const startTime = performance.now();

  function accelerate(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);

    const speedRange = Math.log10(targetSpeed) - Math.log10(startSpeed);
    const currentLog = Math.log10(startSpeed) + speedRange * eased;
    timeSpeed = Math.pow(10, currentLog);

    updateTimeDisplay();
    updateSpeedSlider();

    if (progress < 1) {
      requestAnimationFrame(accelerate);
    } else {
      timeSpeed = targetSpeed;
      updateTimeDisplay();
      updateSpeedSlider();
      status(`⏩ Speed: ${formatSpeed(timeSpeed)}`);
    }
  }

  requestAnimationFrame(accelerate);
}

// Update analog clock every frame
const origUpdateSimulationTime = updateSimulationTime;
updateSimulationTime = function(now) {
  origUpdateSimulationTime(now);
  if (!document.getElementById('time-modal').hidden) {
    updateAnalogClock();
  }
};

// ── Atmosphere / Environment System ──
const atmosphere = {
  enabled: false,
  composition: new Map([
    ['N2', 0.78],
    ['O2', 0.21],
    ['Ar', 0.009],
    ['CO2', 0.0004],
  ]),
};

function toggleAtmosphere() {
  atmosphere.enabled = !atmosphere.enabled;
  const btn = document.getElementById('btn-atmosphere');
  if (btn) {
    btn.textContent = t('btn.atmosphere', { mode: atmosphere.enabled ? t('status.on') : t('status.off') });
  }
  status(atmosphere.enabled ? '🌍 Atmosphere ON — O2, N2, Ar, CO2 present' : ' Atmosphere OFF — vacuum');
}

document.getElementById('btn-atmosphere').addEventListener('click', toggleAtmosphere);

// Desktop sidebar tab switching (toggleable - multiple panels can be open)
{
  const tabs = document.querySelectorAll('.sidebar-tab');
  for (const tab of tabs) {
    tab.addEventListener('click', () => {
      const panel = document.getElementById('side-' + tab.dataset.panel);
      const willOpen = !panel.classList.contains('active');
      panel.classList.toggle('active', willOpen);
      tab.classList.toggle('active', willOpen);
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
  const key = compKey(cur.comp);
  overrides.delete(key);
  worldSync.broadcastChargeSet(key, undefined);
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
  grid = new THREE.GridHelper(GRID_SIZE, GRID_SIZE, st.gridA, st.gridB);
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
function syncSheetButtons() {
  for (const id of SHEET_IDS) {
    const sheet = document.getElementById(id);
    const btn = document.querySelector(`#mtabs button[data-tab="${id}"]`);
    if (sheet && btn) {
      btn.classList.toggle('on', sheet.classList.contains('active') || sheet.classList.contains('open'));
    }
  }
}
function closeMobileSheets() {
  for (const id of SHEET_IDS) document.getElementById(id)?.classList.remove('open');
  syncSheetButtons();
}
{
  const tabs = document.getElementById('mtabs');
  const mq = window.matchMedia('(max-width: 640px)');
  const sync = () => {
    document.body.classList.toggle('mobile', mq.matches);
    if (!mq.matches) closeMobileSheets();
    syncSheetButtons();
  };
  sync();
  mq.addEventListener('change', sync);
  tabs.addEventListener('click', e => {
    const btn = e.target.closest('button[data-tab]');
    if (!btn) return;
    const sheet = document.getElementById(btn.dataset.tab);
    const willOpen = !sheet.classList.contains('active') && !sheet.classList.contains('open');
    sheet.classList.toggle('open', willOpen);
    sheet.classList.toggle('active', willOpen);
    btn.classList.toggle('on', willOpen);
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

  const jumpBtn = document.getElementById('joy-jump');
  if (jumpBtn) {
    jumpBtn.addEventListener('pointerdown', e => {
      e.preventDefault();
      movement.jump();
    });
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
let lastPlayerPos = { x: 0, y: 2, z: 0 };
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  fpsSampler.frame(now);
  
  // Update simulation time (respects freeze and speed)
  updateSimulationTime(now);

  // Safety: if drag was cleared but controls stayed disabled, re-enable them (creative mode only)
  if (!drag && !controls.enabled && gameMode !== 'survival') {
    controls.enabled = true;
  }

  // In survival mode, disable OrbitControls entirely (we position camera directly)
  const survivalCam = gameMode === 'survival';
  controls.enabled = !survivalCam;
  if (!survivalCam) {
    controls.update();
  }

  let active = false;
  active = movement.update(dt) || active;
  
  // Sync player avatar with player position
  if (gameMode === 'survival') {
    const playerPos = movement.getPlayerPos();
    playerAvatar.position.set(playerPos.x, playerPos.y, playerPos.z);
  } else {
    playerAvatar.position.set(camera.position.x, camera.position.y - 1.8, camera.position.z);
  }
  
  // Rotate avatar to face camera direction
  const camDir = new THREE.Vector3();
  camera.getWorldDirection(camDir);
  const angle = Math.atan2(camDir.x, camDir.z);
  playerAvatar.rotation.y = angle;
  
  if (!timeFrozen) active = updateDrift(dt) || active;
  active = updateLerp(dt) || active;
  updateRadioactiveDecay(now);
  if (decayTrack.size) active = true;
  updateMolecularDecay(now, dt);
  updateHealth(now, dt);
  updateCriticalTimer(dt);
  updateMayhemParticles(dt);
  updateReactionEffects(dt);
  updateScreenShake(now);
  if (reactionVFX.update(dt)) active = true;
  if (catalystFX.update(dt)) active = true;
  if (electricityFX.update(dt)) active = true;
  if (mayhemParticles.length) active = true;
  if (reactionParticles.length || uvBeams.length) active = true;
  if (shakeDuration) active = true;
  if (spawnAnim.size) active = true;
  if (drag) active = true;
  
  // Update remote player positions
  playerSync.update(now);
  if (playerSync.getPlayerCount() > 0) active = true;
  
  // Send local player position to network
  if (network.roomId) {
    const pos = gameMode === 'survival' ? movement.getPlayerPos() : camera.position;
    const camRot = gameMode === 'survival' ? movement.getYaw() : controls.getAzimuthalAngle();
    
    // Calculate velocity from position change
    const velocity = {
      x: dt > 0 ? (pos.x - lastPlayerPos.x) / dt : 0,
      y: dt > 0 ? (pos.y - lastPlayerPos.y) / dt : 0,
      z: dt > 0 ? (pos.z - lastPlayerPos.z) / dt : 0,
    };
    lastPlayerPos = { x: pos.x, y: pos.y, z: pos.z };
    
    playerSync.updateLocalPlayer(
      { x: pos.x, y: pos.y, z: pos.z },
      camRot,
      velocity
    );
  }
  
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
  vfx: { reactionVFX, catalystFX, electricityFX },
  atomMatM, atomMatN,
  atomMeshM, atomMeshN,
  renderer, ELEMENTS,
  invalidate,
  analyses: () => analyses,
  comps: () => lastComps,
  spawnAtom, reanalyze, selectAtom, undo, clearAll,
  stabilize: ids => stabilizeStrays(Array.isArray(ids) ? ids : [ids], performance.now()),
  triggerDeath: triggerPlayerDeath,
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
    console.log('%cAdmin Debug:', 'color: #ff0000; font-weight: bold;');
    console.log('  __mol3d.hacks.setStars(n) — Set total stars to n');
    console.log('  __mol3d.hacks.addStars(n) — Add n stars');
    console.log('  __mol3d.hacks.removeStars(n) — Remove n stars');
    console.log('  __mol3d.hacks.debugRank() — Log detailed rank info');
    console.log('  __mol3d.hacks.adminExport() — Download debug JSON');
    console.log('  __mol3d.hacks.triggerDeath() — Test death animation');
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
      const atmosphereGases = atmosphere.enabled ? [...atmosphere.composition.keys()] : [];
      const rx = findReaction(fs, cond, selectedStructures(), atmosphereGases);
      if (rx) { executeReaction(rx); return rx.equation; }
      const valid = conditionsFor(fs, selectedStructures(), atmosphereGases);
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
    triggerDeath: () => {
      triggerPlayerDeath();
      return 'Death triggered';
    },
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
    // Admin debug commands - added 2026-11-01
    setStars: (n) => {
      if (typeof n !== 'number' || n < 0) return 'Usage: setStars(number)';
      rankManager.totalStars = n;
      rankManager.saveProgress();
      rankManager.emit('starsChanged', { totalStars: n, rank: rankManager.getCurrentRank() });
      updateRankWidget();
      rebuildPool();
      console.log(`%c⭐ Stars set to ${n}`, 'color: #ffd700; font-weight: bold;');
      return `Stars: ${n}`;
    },
    addStars: (n) => {
      if (typeof n !== 'number' || n <= 0) return 'Usage: addStars(number)';
      const result = rankManager.addStars(n);
      updateRankWidget();
      rebuildPool();
      console.log(`%c⭐ Added ${n} stars. Total: ${result.totalStars}`, 'color: #4CAF50; font-weight: bold;');
      return `Added ${n} stars. Total: ${result.totalStars}`;
    },
    removeStars: (n) => {
      if (typeof n !== 'number' || n <= 0) return 'Usage: removeStars(number)';
      const result = rankManager.removeStars(n);
      updateRankWidget();
      rebuildPool();
      console.log(`%c⭐ Removed ${n} stars. Total: ${result.totalStars}`, 'color: #ff5722; font-weight: bold;');
      return `Removed ${n} stars. Total: ${result.totalStars}`;
    },
    debugRank: () => {
      const rank = rankManager.getCurrentRank();
      const info = {
        totalStars: rankManager.totalStars,
        rank: rank.rank.name,
        rankIndex: rank.rankIndex,
        grade: rank.grade,
        gradeRoman: rank.gradeRoman,
        starsInGrade: rank.starsInGrade,
        nextGradeStars: rank.nextGradeStars,
        isMaxGrade: rank.isMaxGrade,
        image: rank.rank.image,
      };
      console.log('%c═══ RANK DEBUG INFO ═══', 'color: #2196F3; font-weight: bold; font-size: 14px;');
      console.table(info);
      console.log('%cQuest Stars:', 'color: #4CAF50; font-weight: bold;', questManager.getStars());
      console.log('%cCompleted Quests:', 'color: #4CAF50; font-weight: bold;', [...questManager.completedQuests]);
      console.log('%cPlayer Health:', 'color: #ff5722; font-weight: bold;', playerHealth);
      console.log('%cDiscoveries:', 'color: #9c27b0; font-weight: bold;', discoveries.length);
      return info;
    },
    adminExport: () => {
      const rank = rankManager.getCurrentRank();
      const exportData = {
        _debug: {
          exportedAt: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href,
        },
        version: '1.0',
        scene: {
          atoms: [...atoms.values()].map(a => ({ id: a.id, z: a.el.z, sym: a.el.sym, pos: a.pos })),
          bonds: [...bonds.values()].map(b => ({ id: b.id, a: b.a, b: b.b, order: b.order, ionic: b.ionic })),
          nextId,
        },
        discoveries: discoveries.map(d => ({ ...d })),
        completed: [...completed],
        overrides: [...overrides],
        isoSel: [...isoSel],
        rank: {
          totalStars: rankManager.totalStars,
          currentRank: rank,
          raw: { ...rankManager },
        },
        quests: {
          stars: questManager.getStars(),
          completed: [...questManager.completedQuests],
          raw: { ...questManager },
        },
        player: {
          health: playerHealth,
          isDead: isPlayerDead,
          cameraPosition: camera.position.toArray(),
          cameraTarget: controls.target.toArray(),
        },
        settings: {
          theme: document.documentElement.dataset.theme || 'dark',
          lang: getLang(),
          quality: qualityMode,
          gameMode: gameMode,
        },
        localStorage: {
          rank: localStorage.getItem('mol3d.rank'),
          quests: localStorage.getItem('mol3d.quests'),
          theme: localStorage.getItem('mol3d.theme'),
          volume: localStorage.getItem('mol3d.volume'),
        },
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `admin_debug_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      console.log('%c📁 Admin debug export downloaded', 'color: #2196F3; font-weight: bold; font-size: 14px;');
      return 'Admin export downloaded';
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
initMenu();
chatManager.init();
voiceChat.init();

// URL parameters are handled by menu.js - removed duplicate handling to prevent double-join attempts

function updateUndoBtn() {
  document.getElementById('btn-undo').disabled = undoStack.length === 0;
}

function updateDeleteBtn() {
  const hasSel = selectedId !== null;
  document.getElementById('btn-delete').disabled = !hasSel;
  document.getElementById('btn-duplicate').disabled = !hasSel;
}

// ─ Background Music ──
const musicTracks = [
  { file: 'Fragments by @AERØHEAD 🇺🇸.mp3', name: 'Fragments by @AERØHEAD 🇺🇸' },
  { file: 'Imphenzia - Discovery Of Planet X.mp3', name: 'Imphenzia - Discovery Of Planet X' },
  { file: 'IN MEMORIAM by Onycs 🇫🇷.mp3', name: 'IN MEMORIAM by Onycs 🇫🇷' },
  { file: 'No.10 A New Beginning.mp3', name: 'No.10 A New Beginning' },
  { file: 'Travis Fitzsimmons - Painting The Solar System.mp3', name: 'Travis Fitzsimmons - Painting The Solar System' },
].sort((a, b) => a.name.localeCompare(b.name));

function getMusicPath(filename) {
  const base = ['.', 'music'].join('/');
  return [base, filename].join('/');
}

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

  audio.src = getMusicPath(musicTracks[0].file);
  updateNowPlaying();

  audio.addEventListener('ended', () => {
    currentTrackIndex = (currentTrackIndex + 1) % musicTracks.length;
    audio.src = getMusicPath(musicTracks[currentTrackIndex].file);
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

      const response = await puter.ai.chat(messages, { model: 'claude-3-haiku-20240307' });
      
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

// ── Rank Widget ──

function updateRankWidget() {
  const rankInfo = rankManager.getCurrentRank();
  const titleEl = document.getElementById('rank-title');
  const starsEl = document.getElementById('rank-stars');
  const shieldEl = document.getElementById('rank-shield');
  const gradeEl = document.getElementById('rank-grade');

  if (titleEl) titleEl.textContent = rankInfo.rank.name;
  if (starsEl) starsEl.textContent = `${rankInfo.totalStars} ★`;
  if (shieldEl) {
    shieldEl.style.backgroundImage = `url('${rankInfo.rank.image}')`;
    shieldEl.style.backgroundSize = 'cover';
    shieldEl.style.backgroundPosition = 'center';
    shieldEl.classList.toggle('sparkle', !!rankInfo.rank.sparkle);
  }
  if (gradeEl) {
    gradeEl.textContent = rankInfo.gradeRoman;
    gradeEl.style.color = rankInfo.rank.textColor;
  }
  
  // Update feature lock indicators
  const mayhemBtn = document.getElementById('btn-mayhem');
  const consoleBtn = document.getElementById('btn-console');
  if (mayhemBtn) mayhemBtn.classList.toggle('feature-locked', !isFeatureUnlocked('mayhem', rankInfo));
  if (consoleBtn) consoleBtn.classList.toggle('feature-locked', !isFeatureUnlocked('console', rankInfo));
}

function triggerRankUpAnimation(rankInfo) {
  const overlay = document.getElementById('rankup-overlay');
  const shield = document.getElementById('rankup-shield');
  const grade = document.getElementById('rankup-grade');
  const label = document.getElementById('rankup-label');
  const confetti = document.getElementById('rankup-confetti');

  if (!overlay) return;

  // Set shield appearance
  shield.style.backgroundImage = `url('${rankInfo.rank.image}')`;
  shield.style.backgroundSize = 'cover';
  shield.style.backgroundPosition = 'center';
  shield.classList.toggle('sparkle', !!rankInfo.rank.sparkle);
  grade.textContent = rankInfo.gradeRoman;
  grade.style.color = rankInfo.rank.textColor;

  // Set label
  if (rankInfo.isRankUp !== false) {
    label.textContent = `Rank Up! ${rankInfo.rank.name}`;
  } else {
    label.textContent = `Grade ${rankInfo.gradeRoman}!`;
  }

  // Generate confetti
  confetti.innerHTML = '';
  const colors = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff6bff', '#ff9f45'];
  for (let i = 0; i < 30; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    const angle = (i / 30) * Math.PI * 2;
    const dist = 80 + Math.random() * 120;
    const tx = Math.cos(angle) * dist;
    const ty = Math.sin(angle) * dist;
    const color = colors[i % colors.length];
    const rot = Math.random() * 720;
    piece.style.cssText = `
      background: ${color};
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
      animation-name: confettiBurst;
      --tx: ${tx}px;
      --ty: ${ty}px;
      --rot: ${rot}deg;
    `;
    // Override the animation with custom endpoint
    piece.style.animation = `confettiBurstCustom 1.5s ease-out 0.8s both`;
    piece.style.setProperty('--tx', `${tx}px`);
    piece.style.setProperty('--ty', `${ty}px`);
    piece.style.setProperty('--rot', `${rot}deg`);
    confetti.appendChild(piece);
  }

  // Show overlay
  overlay.hidden = false;

  // Hide after animation
  setTimeout(() => {
    overlay.hidden = true;
    confetti.innerHTML = '';
  }, 3000);
}

// Listen for grade-up events
rankManager.on('gradeUp', (data) => {
  triggerRankUpAnimation(data.newRank);
  updateRankWidget();
  // Rebuild pool to update locked/unlocked elements
  const poolWrap = document.getElementById('pool-list');
  if (poolWrap) {
    poolWrap.innerHTML = '';
    buildPool();
  }
});

// Listen for grade-down events (death penalty — rank actually changed)
rankManager.on('gradeDown', (data) => {
  updateRankWidget();
  // Rebuild pool to update locked/unlocked elements
  const poolWrap = document.getElementById('pool-list');
  if (poolWrap) {
    poolWrap.innerHTML = '';
    buildPool();
  }
});

function triggerRankDownAnimation(rankInfo, starsLost, isRankDown) {
  const overlay = document.getElementById('rankup-overlay');
  const shield = document.getElementById('rankup-shield');
  const grade = document.getElementById('rankup-grade');
  const label = document.getElementById('rankup-label');
  const confetti = document.getElementById('rankup-confetti');

  if (!overlay) return;

  // Set shield appearance for current rank
  shield.style.backgroundImage = `url('${rankInfo.rank.image}')`;
  shield.style.backgroundSize = 'cover';
  shield.style.backgroundPosition = 'center';
  shield.classList.toggle('sparkle', !!rankInfo.rank.sparkle);
  grade.textContent = rankInfo.gradeRoman;
  grade.style.color = rankInfo.rank.textColor;

  // Set label
  if (isRankDown) {
    label.textContent = `Rank Down! -${starsLost} Stars`;
  } else {
    label.textContent = `-${starsLost} Stars`;
  }
  label.style.color = '#ff4444';

  // Clear confetti (no celebration for rank down)
  confetti.innerHTML = '';

  // Add rank-down class for different animation
  overlay.classList.add('rank-down');
  overlay.hidden = false;

  // Hide after animation
  setTimeout(() => {
    overlay.hidden = true;
    overlay.classList.remove('rank-down');
    confetti.innerHTML = '';
    label.style.color = '';
  }, 2500);

  // Update widget and pool
  updateRankWidget();
  const poolWrap = document.getElementById('pool-list');
  if (poolWrap && isRankDown) {
    poolWrap.innerHTML = '';
    buildPool();
  }
}

// Initialize rank widget on load
updateRankWidget();

// Check for daily reward on load
{
  const reward = checkDailyReward();
  if (reward) {
    const popup = document.getElementById('daily-reward-popup');
    const dayEl = document.getElementById('daily-reward-day');
    const starsEl = document.getElementById('daily-reward-stars');
    const closeBtn = document.getElementById('daily-reward-close');
    const claimBtn = document.getElementById('daily-reward-claim');
    
    if (popup && dayEl && starsEl) {
      dayEl.textContent = reward.streak;
      starsEl.textContent = reward.stars;
      popup.hidden = false;
      
      const closePopup = () => { popup.hidden = true; };
      closeBtn?.addEventListener('click', closePopup);
      
      claimBtn?.addEventListener('click', () => {
        const result = claimDailyReward();
        if (result) {
          status(t('rank.dailyClaimed', { stars: result.stars }), 'ok');
          updateRankWidget();
        }
        closePopup();
      });
    }
  }
}

// ── Tutorial System ──
const TUTORIAL_KEY = 'mol3d.tutorial.completed';
const ASSISTANT_NAME_KEY = 'mol3d.assistant.name';
const USER_NAME_KEY = 'mol3d.user.name';

let tutorialActive = false;
let tutorialPhase = 0;
let tutorialStep = 0;
let assistantName = localStorage.getItem(ASSISTANT_NAME_KEY) || 'Chem-Bot';
let userName = localStorage.getItem(USER_NAME_KEY) || 'Scientist';

const TUTORIAL_PHASES = [
  {
    id: 'setup',
    name: 'Assistant Setup',
    steps: [
      { target: null, text: `Hello! I'm {assistant}, your chemistry assistant! What should I call you?`, action: 'showNameInput' },
      { target: null, text: `Nice to meet you, {user}! Let me show you around the lab.`, action: 'next' },
    ]
  },
  {
    id: 'basics',
    name: 'Foundations',
    steps: [
      { target: '#left-sidebar', text: `This is your element pool, {user}. Drag elements into the scene to start building!`, action: 'highlight' },
      { target: '#btn-spawn-h', text: `Try spawning a Hydrogen atom by clicking here.`, action: 'waitForClick' },
      { target: null, text: `Great! Atoms are the building blocks of all matter.`, action: 'next' },
    ]
  },
  {
    id: 'bonding',
    name: 'Bonding & Reactions',
    steps: [
      { target: null, text: `Now let's learn about bonds! Spawn another H atom.`, action: 'waitForSpawn' },
      { target: null, text: `Drag atoms close together to form bonds. Try making H₂!`, action: 'waitForBond' },
      { target: null, text: `Excellent! You just created your first molecule!`, action: 'next' },
    ]
  },
  {
    id: 'metrics',
    name: 'Observation',
    steps: [
      { target: '#right-sidebar', text: `Use the sidebar tools to inspect your molecules.`, action: 'highlight' },
      { target: '#rank-widget', text: `Earn stars by discovering new molecules and completing quests!`, action: 'highlight' },
      { target: null, text: `You're ready to explore chemistry on your own, {user}!`, action: 'complete' },
    ]
  }
];

function shouldShowTutorial() {
  return !localStorage.getItem(TUTORIAL_KEY);
}

function startTutorial() {
  if (!shouldShowTutorial()) return;
  tutorialActive = true;
  tutorialPhase = 0;
  tutorialStep = 0;
  showTutorialStep();
}

function showTutorialStep() {
  if (!tutorialActive) return;
  const phase = TUTORIAL_PHASES[tutorialPhase];
  if (!phase) {
    completeTutorial();
    return;
  }
  const step = phase.steps[tutorialStep];
  if (!step) {
    nextTutorialPhase();
    return;
  }
  
  const text = step.text.replace('{assistant}', assistantName).replace('{user}', userName);
  
  // Remove previous tutorial highlights
  document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));
  document.querySelectorAll('.tutorial-tooltip').forEach(el => el.remove());
  
  if (step.target) {
    const targetEl = document.querySelector(step.target);
    if (targetEl) {
      targetEl.classList.add('tutorial-highlight');
      showTutorialTooltip(targetEl, text, step.action);
    }
  } else {
    showTutorialDialog(text, step.action);
  }
}

function showTutorialTooltip(targetEl, text, action) {
  const tooltip = document.createElement('div');
  tooltip.className = 'tutorial-tooltip';
  tooltip.innerHTML = `
    <div class="tutorial-text">${text}</div>
    <button class="tutorial-btn" onclick="handleTutorialAction('${action}')">Got it!</button>
  `;
  
  const rect = targetEl.getBoundingClientRect();
  tooltip.style.position = 'fixed';
  tooltip.style.left = `${rect.right + 10}px`;
  tooltip.style.top = `${rect.top}px`;
  tooltip.style.zIndex = '10000';
  
  document.body.appendChild(tooltip);
}

function showTutorialDialog(text, action) {
  const dialog = document.createElement('div');
  dialog.className = 'tutorial-dialog';
  dialog.innerHTML = `
    <div class="tutorial-avatar">🤖</div>
    <div class="tutorial-content">
      <div class="tutorial-name">${assistantName}</div>
      <div class="tutorial-text">${text}</div>
      ${action === 'showNameInput' ? '<input type="text" class="tutorial-name-input" placeholder="Enter your name" />' : ''}
      <button class="tutorial-btn" onclick="handleTutorialAction('${action}')">${action === 'showNameInput' ? 'Continue' : 'Next'}</button>
    </div>
  `;
  
  document.body.appendChild(dialog);
  
  if (action === 'showNameInput') {
    const input = dialog.querySelector('.tutorial-name-input');
    input.value = userName;
    input.focus();
  }
}

window.handleTutorialAction = function(action) {
  document.querySelectorAll('.tutorial-tooltip').forEach(el => el.remove());
  document.querySelectorAll('.tutorial-dialog').forEach(el => el.remove());
  
  if (action === 'showNameInput') {
    const input = document.querySelector('.tutorial-name-input');
    if (input && input.value.trim()) {
      userName = input.value.trim();
      localStorage.setItem(USER_NAME_KEY, userName);
    }
    tutorialStep++;
    showTutorialStep();
  } else if (action === 'next' || action === 'highlight') {
    tutorialStep++;
    showTutorialStep();
  } else if (action === 'complete') {
    completeTutorial();
  } else if (action === 'waitForClick' || action === 'waitForSpawn' || action === 'waitForBond') {
    // These actions wait for user interaction, handled elsewhere
    tutorialStep++;
  }
}

function nextTutorialPhase() {
  tutorialPhase++;
  tutorialStep = 0;
  showTutorialStep();
}

function completeTutorial() {
  tutorialActive = false;
  localStorage.setItem(TUTORIAL_KEY, 'true');
  document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));
  document.querySelectorAll('.tutorial-tooltip, .tutorial-dialog').forEach(el => el.remove());
  status(`Tutorial complete! Welcome to the lab, ${userName}!`, 'ok');
}

function replayTutorial() {
  localStorage.removeItem(TUTORIAL_KEY);
  startTutorial();
}

// ── X-Ray Mode System ──
// Expose functions globally
window.replayTutorial = replayTutorial;
window.startTutorial = startTutorial;

// X-ray keybind (X key)
window.addEventListener('keydown', (e) => {
  if (e.key === 'x' || e.key === 'X') {
    if (!e.ctrlKey && !e.altKey && !e.metaKey) {
      const activeEl = document.activeElement;
      const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
      if (!isInput) {
        e.preventDefault();
        document.getElementById('btn-xray')?.click();
      }
    }
  }
});

// ── Proton Gun & Nuclear Fission System ──
function toggleProtonGun() {
  protonGunActive = !protonGunActive;
  status(protonGunActive ? 'Proton gun activated - Click to shoot!' : 'Proton gun deactivated', 'info');
}

function shootProton(event) {
  if (!protonGunActive) return;
  
  const rect = renderer.domElement.getBoundingClientRect();
  const mouse = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  );
  
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);
  
  // Find atoms in the path
  const atomPositions = [];
  for (const [id, atom] of atoms) {
    atomPositions.push({ id, pos: new THREE.Vector3(atom.pos.x, atom.pos.y, atom.pos.z) });
  }
  
  let closestAtom = null;
  let closestDist = Infinity;
  
  for (const atom of atomPositions) {
    const dist = raycaster.ray.distanceToPoint(atom.pos);
    const atomRadius = displayRadius(ELEMENTS[atom.id % ELEMENTS.length]);
    if (dist < atomRadius && atom.pos.distanceTo(camera.position) < closestDist) {
      closestDist = atom.pos.distanceTo(camera.position);
      closestAtom = atom;
    }
  }
  
  if (closestAtom && closestAtom.id >= 82) {
    triggerNuclearFission(closestAtom.id);
  }
}

function triggerNuclearFission(atomId) {
  const atom = atoms.get(atomId);
  if (!atom || atom.el.z <= 82) return;
  
  // Start critical timer
  if (!criticalTimerActive) {
    criticalTimerActive = true;
    criticalCountdown = 60.0;
    status('⚠ CRITICAL REACTION INITIATED - 60s countdown started!', 'error');
  }
  
  // Fission: split into two lighter elements
  const newZ1 = Math.floor(atom.el.z / 2);
  const newZ2 = atom.el.z - newZ1;
  const el1 = ELEMENTS[newZ1];
  const el2 = ELEMENTS[newZ2];
  
  if (!el1 || !el2) return;
  
  const pos = { x: atom.pos.x, y: atom.pos.y, z: atom.pos.z };
  
  // Remove original atom
  atoms.delete(atomId);
  for (const [bid, b] of bonds) {
    if (b.a === atomId || b.b === atomId) bonds.delete(bid);
  }
  
  // Spawn fission products
  const id1 = nextId++;
  const id2 = nextId++;
  atoms.set(id1, { id: id1, el: el1, pos: { x: pos.x + 0.5, y: pos.y, z: pos.z } });
  atoms.set(id2, { id: id2, el: el2, pos: { x: pos.x - 0.5, y: pos.y, z: pos.z } });
  
  // Visual effects
  reactionVFX.explode(new THREE.Vector3(pos.x, pos.y, pos.z), 2.0, new THREE.Color(0xff0000));
  
  status(`☢ ${atom.el.name} underwent fission → ${el1.name} + ${el2.name}`, 'warn');
  reanalyze();
}

function updateCriticalTimer(dt) {
  if (!criticalTimerActive) return;
  
  criticalCountdown -= dt;
  
  if (criticalCountdown <= 0) {
    triggerNuclearWhiteout();
  }
}

function triggerNuclearWhiteout() {
  criticalTimerActive = false;
  status('☢ CRITICAL MASS ACHIEVED - INITIATING RESET', 'error');
  
  // Create whiteout effect
  const whiteout = document.createElement('div');
  whiteout.style.cssText = `
    position: fixed;
    inset: 0;
    background: white;
    z-index: 99999;
    opacity: 0;
    transition: opacity 1.5s ease-in;
    pointer-events: none;
  `;
  document.body.appendChild(whiteout);
  
  // Fade to white
  requestAnimationFrame(() => {
    whiteout.style.opacity = '1';
  });
  
  // Reset after whiteout
  setTimeout(() => {
    clearAll();
    whiteout.style.opacity = '0';
    setTimeout(() => whiteout.remove(), 1500);
    status('✓ System reset to ground zero', 'ok');
  }, 1500);
}

// Proton gun click handler
renderer.domElement.addEventListener('click', shootProton);

// Initialize tutorial on load
setTimeout(() => {
  if (shouldShowTutorial()) {
    startTutorial();
  }
}, 2000);

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
