// CatalystFX.js — Catalyst mechanics: activation energy reduction, rate acceleration,
// pulsating aura rendering, and energy diagram visualization.

import * as THREE from 'three';

const R_GAS = 8.314e-3; // kJ/(mol·K)

const CATALYST_DB = [
  { formula: 'Pt',   name: 'Platinum',        color: 0xF59E0B, deltaEa: 40, reactions: ['*'] },
  { formula: 'Pd',   name: 'Palladium',        color: 0xF59E0B, deltaEa: 35, reactions: ['*'] },
  { formula: 'Ni',   name: 'Nickel',           color: 0x10B981, deltaEa: 30, reactions: ['*'] },
  { formula: 'Fe',   name: 'Iron',             color: 0x10B981, deltaEa: 25, reactions: ['*'] },
  { formula: 'MnO2', name: 'Manganese dioxide',color: 0x10B981, deltaEa: 50, reactions: ['H2O2'] },
  { formula: 'V2O5', name: 'Vanadium pentoxide',color: 0xF59E0B, deltaEa: 45, reactions: ['SO2'] },
  { formula: 'H2SO4',name: 'Sulfuric acid',    color: 0xF59E0B, deltaEa: 35, reactions: ['*'] },
  { formula: 'NaOH', name: 'Sodium hydroxide', color: 0x10B981, deltaEa: 20, reactions: ['*'] },
  { formula: 'Cu',   name: 'Copper',           color: 0xF59E0B, deltaEa: 28, reactions: ['*'] },
  { formula: 'Ag',   name: 'Silver',           color: 0xF59E0B, deltaEa: 22, reactions: ['*'] },
  { formula: 'Rh',   name: 'Rhodium',          color: 0xF59E0B, deltaEa: 42, reactions: ['*'] },
  { formula: 'Ru',   name: 'Ruthenium',        color: 0xF59E0B, deltaEa: 38, reactions: ['*'] },
  { formula: 'Al2O3',name: 'Alumina',          color: 0x10B981, deltaEa: 20, reactions: ['*'] },
  { formula: 'TiO2', name: 'Titanium dioxide', color: 0x10B981, deltaEa: 30, reactions: ['*'] },
  { formula: 'Zn',   name: 'Zinc',             color: 0x10B981, deltaEa: 18, reactions: ['*'] },
  { formula: 'Cr',   name: 'Chromium',         color: 0x10B981, deltaEa: 24, reactions: ['*'] },
  { formula: 'Co',   name: 'Cobalt',           color: 0xF59E0B, deltaEa: 26, reactions: ['*'] },
  { formula: 'Enzyme',name: 'Enzyme',          color: 0x10B981, deltaEa: 60, reactions: ['*'] },
];

const CATALYST_FORMULAS = new Set(CATALYST_DB.map(c => c.formula));

export function isCatalystFormula(formula) {
  return CATALYST_FORMULAS.has(formula);
}

export function getCatalystData(formula) {
  return CATALYST_DB.find(c => c.formula === formula) || null;
}

export function getReactionSphereRadius(catalyst) {
  return 3.0 + (catalyst.deltaEa / 60) * 2;
}

export class CatalystFX {
  constructor(scene) {
    this.scene = scene;
    this.auras = new Map();
    this.active = false;
  }

  registerCatalyst(compId, position, catalystData) {
    if (this.auras.has(compId)) return;

    const color = new THREE.Color(catalystData.color);
    const radius = getReactionSphereRadius(catalystData);

    const geo = new THREE.SphereGeometry(radius, 24, 18);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(position);
    this.scene.add(mesh);

    const innerGeo = new THREE.SphereGeometry(radius * 0.6, 16, 12);
    const innerMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    innerMesh.position.copy(position);
    this.scene.add(innerMesh);

    this.auras.set(compId, {
      mesh, geo, mat,
      innerMesh, innerGeo, innerMat,
      baseColor: color,
      radius,
      deltaEa: catalystData.deltaEa,
      omega: 2 + (catalystData.deltaEa / 60) * 4,
      elapsed: Math.random() * Math.PI * 2,
    });

    this.active = true;
  }

  updatePosition(compId, position) {
    const aura = this.auras.get(compId);
    if (!aura) return;
    aura.mesh.position.copy(position);
    aura.innerMesh.position.copy(position);
  }

  removeCatalyst(compId) {
    const aura = this.auras.get(compId);
    if (!aura) return;
    this.scene.remove(aura.mesh);
    this.scene.remove(aura.innerMesh);
    aura.geo.dispose();
    aura.mat.dispose();
    aura.innerGeo.dispose();
    aura.innerMat.dispose();
    this.auras.delete(compId);
    this.active = this.auras.size > 0;
  }

  getEffectiveEa(baseEa, catalystDeltaEa) {
    return Math.max(30, baseEa - catalystDeltaEa);
  }

  getRateMultiplier(eaUncat, eaCat, temp) {
    if (eaCat >= eaUncat) return 1;
    const kUncat = Math.exp(-eaUncat / (R_GAS * temp));
    const kCat = Math.exp(-eaCat / (R_GAS * temp));
    return kCat / kUncat;
  }

  findNearbyCatalysts(position, radius = 5.0) {
    const results = [];
    for (const [id, aura] of this.auras) {
      const dist = position.distanceTo(aura.mesh.position);
      if (dist <= aura.radius) {
        results.push({ id, dist, deltaEa: aura.deltaEa });
      }
    }
    results.sort((a, b) => a.dist - b.dist);
    return results;
  }

  update(dt) {
    if (this.auras.size === 0) return false;

    for (const [, aura] of this.auras) {
      aura.elapsed += dt * aura.omega;
      const pulse = 0.5 + 0.3 * Math.sin(aura.elapsed);
      aura.mat.opacity = pulse * 0.2;
      aura.innerMat.opacity = pulse * 0.12;

      const breathe = 1 + 0.05 * Math.sin(aura.elapsed * 0.7);
      aura.mesh.scale.setScalar(breathe);
      aura.innerMesh.scale.setScalar(breathe * 0.95);

      aura.innerMesh.rotation.y += dt * 0.3;
      aura.innerMesh.rotation.x += dt * 0.15;
    }

    return true;
  }

  dispose() {
    for (const [id] of this.auras) {
      this.removeCatalyst(id);
    }
  }
}

// ── Energy Diagram (2D Canvas) ──

export function drawEnergyDiagram(canvas, eaUncat, eaCat, dH) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  const styles = getComputedStyle(document.documentElement);
  const textColor = styles.getPropertyValue('--muted').trim() || '#5a7090';
  const borderColor = styles.getPropertyValue('--border').trim() || 'rgba(60,120,200,0.25)';

  ctx.clearRect(0, 0, w, h);

  const pad = { left: 35, right: 15, top: 20, bottom: 25 };
  const gw = w - pad.left - pad.right;
  const gh = h - pad.top - pad.bottom;

  const maxE = Math.max(eaUncat, eaCat, Math.abs(dH)) * 1.3;
  const eToY = (e) => pad.top + gh * (1 - e / maxE);
  const xToX = (frac) => pad.left + gw * frac;

  // Grid
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 0.5;
  ctx.setLineDash([2, 3]);
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (gh * i / 4);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(w - pad.right, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Axes
  ctx.strokeStyle = textColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top);
  ctx.lineTo(pad.left, h - pad.bottom);
  ctx.lineTo(w - pad.right, h - pad.bottom);
  ctx.stroke();

  // Y-axis label
  ctx.fillStyle = textColor;
  ctx.font = '8px monospace';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const val = (maxE * (4 - i) / 4).toFixed(0);
    const y = pad.top + (gh * i / 4);
    ctx.fillText(`${val}`, pad.left - 4, y + 3);
  }

  // Energy axis label
  ctx.save();
  ctx.translate(8, h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.font = '8px sans-serif';
  ctx.fillText('Energy (kJ/mol)', 0, 0);
  ctx.restore();

  // Reaction progress label
  ctx.textAlign = 'center';
  ctx.font = '8px sans-serif';
  ctx.fillText('Reaction Progress', w / 2, h - 4);

  // Draw uncatalyzed path (solid red curve)
  ctx.strokeStyle = '#f85149';
  ctx.lineWidth = 2;
  ctx.beginPath();
  const reactantE = 0;
  const tsE = eaUncat;
  const productE = dH < 0 ? 0 : dH;
  const prodE = Math.max(0, reactantE + dH);

  for (let x = 0; x <= gw; x++) {
    const frac = x / gw;
    let e;
    if (frac < 0.35) {
      e = reactantE;
    } else if (frac < 0.5) {
      const t = (frac - 0.35) / 0.15;
      e = reactantE + (tsE - reactantE) * smoothstep(t);
    } else if (frac < 0.65) {
      const t = (frac - 0.5) / 0.15;
      e = tsE + (prodE - tsE) * smoothstep(t);
    } else {
      e = prodE;
    }
    const px = xToX(frac);
    const py = eToY(e);
    if (x === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // Draw catalyzed path (dotted green curve)
  if (eaCat < eaUncat) {
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    const catTsE = eaCat;

    for (let x = 0; x <= gw; x++) {
      const frac = x / gw;
      let e;
      if (frac < 0.35) {
        e = reactantE;
      } else if (frac < 0.5) {
        const t = (frac - 0.35) / 0.15;
        e = reactantE + (catTsE - reactantE) * smoothstep(t);
      } else if (frac < 0.65) {
        const t = (frac - 0.5) / 0.15;
        e = catTsE + (prodE - catTsE) * smoothstep(t);
      } else {
        e = prodE;
      }
      const px = xToX(frac);
      const py = eToY(e);
      if (x === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Legend
  ctx.font = 'bold 8px sans-serif';
  const legX = w - pad.right - 75;
  const legY = pad.top + 4;

  ctx.strokeStyle = '#f85149';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(legX, legY + 4);
  ctx.lineTo(legX + 14, legY + 4);
  ctx.stroke();
  ctx.fillStyle = '#f85149';
  ctx.textAlign = 'left';
  ctx.fillText('Uncatalyzed', legX + 18, legY + 7);

  if (eaCat < eaUncat) {
    ctx.strokeStyle = '#10B981';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(legX, legY + 18);
    ctx.lineTo(legX + 14, legY + 18);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#10B981';
    ctx.fillText('Catalyzed', legX + 18, legY + 21);
  }

  // Ea annotations
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  const peakX = xToX(0.5);
  ctx.fillStyle = '#f85149';
  ctx.fillText(`Ea=${eaUncat.toFixed(0)}`, peakX, eToY(eaUncat) - 6);

  if (eaCat < eaUncat) {
    ctx.fillStyle = '#10B981';
    ctx.fillText(`Ea=${eaCat.toFixed(0)}`, peakX + 20, eToY(eaCat) - 6);
  }
}

function smoothstep(t) {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
}

export { CATALYST_DB, CATALYST_FORMULAS };
