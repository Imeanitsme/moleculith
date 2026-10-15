import { bondsOf, partnerId, bondLength, displayRadius } from './chemistry.js';

// ---------------------------------------------------------------------------
// VSEPR geometry solver.
// Each bonding domain (bonded neighbour or lone pair) repels the others; lone
// pairs repel harder, which reproduces bent water, pyramidal ammonia,
// seesaw SF4, square-planar XeF4, etc. Solving is a small force-directed
// relaxation per connected component, with one atom pinned in place.
// ---------------------------------------------------------------------------

const V = {
  add: (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }),
  sub: (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }),
  scale: (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s }),
  dot: (a, b) => a.x * b.x + a.y * b.y + a.z * b.z,
  cross: (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }),
  len: a => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z),
  norm(a) { const l = this.len(a) || 1; return this.scale(a, 1 / l); },
};

// Distribute k unit vectors on a sphere by mutual repulsion (Thomson-style).
// weights[i] scales domain i's repulsion (lone pairs are "fatter").
function thomsonDirs(k, weights, pinned = null, iters = 120) {
  const dirs = [];
  // Golden-spiral seed
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < k; i++) {
    const y = 1 - (2 * i) / Math.max(1, k - 1);
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const th = golden * i;
    dirs.push({ x: Math.cos(th) * r, y, z: Math.sin(th) * r });
  }
  if (pinned) dirs[0] = V.norm(pinned);
  for (let it = 0; it < iters; it++) {
    const forces = dirs.map(() => ({ x: 0, y: 0, z: 0 }));
    for (let i = 0; i < k; i++) {
      for (let j = i + 1; j < k; j++) {
        const w = (weights[i] + weights[j]) / 2;
        const d = V.dot(dirs[i], dirs[j]);
        // Push apart: force along component of dirs[j] perpendicular to dirs[i]
        const perp = V.norm(V.sub(dirs[j], V.scale(dirs[i], d)));
        const f = w * Math.max(0.02, 1 - d * d);
        if (!pinned || pinned !== i) forces[i] = V.add(forces[i], V.scale(perp, f));
        if (!pinned || pinned !== j) forces[j] = V.add(forces[j], V.scale(V.neg(perp), f));
      }
    }
    for (let i = 0; i < k; i++) {
      if (pinned === i) continue;
      dirs[i] = V.norm(V.add(dirs[i], V.scale(forces[i], 0.25)));
    }
  }
  return dirs;
}
V.neg = a => V.scale(a, -1);

// Ideal pairwise angles between an atom's domains (radians). Depends only on
// (sigma, lp) so it is computed once per atom per solve.
function idealAngleMatrix(sigma, lp) {
  const k = sigma + lp;
  const weights = [...Array(sigma).fill(1), ...Array(lp).fill(1.6)];
  const dirs = thomsonDirs(k, weights);
  const M = [];
  for (let i = 0; i < k; i++) {
    M.push([]);
    for (let j = 0; j < k; j++) M[i].push(Math.acos(Math.max(-1, Math.min(1, V.dot(dirs[i], dirs[j])))));
  }
  return { M, k, isLp: i => i >= sigma };
}

// Solve one connected component. `per` is the lone-pair map from lewisAssign
// (atomId -> {lp, ...}); atoms missing from it are treated as having no LPs.
// Returns Map atomId -> {x,y,z}.
export function solveComponent(atoms, bonds, atomIds, pinnedId = null, per = new Map()) {
  const ids = atomIds;
  if (ids.length === 0) return new Map();
  const idSet = new Set(ids);

  // Bonded neighbours + lone pairs per atom
  const neigh = new Map(); // id -> [atomIds]
  const lpCount = new Map();
  for (const id of ids) {
    neigh.set(id, bondsOf(atoms, bonds, id).map(b => partnerId(b, id)).filter(p => idSet.has(p)));
    lpCount.set(id, per.get(id)?.lp ?? 0);
  }

  // Root: pinned atom, else highest connectivity
  let root = pinnedId && ids.includes(pinnedId) ? pinnedId : null;
  if (!root) {
    let best = -1;
    for (const id of ids) {
      const s = neigh.get(id).length;
      if (s > best || (s === best && id < root)) { best = s; root = id; }
    }
  }
  const target = new Map();
  for (const id of ids) target.set(id, { ...atoms.get(id).pos });
  target.set(root, { ...atoms.get(root).pos });

  // --- BFS initial placement -------------------------------------------------
  const parent = new Map();
  const parentDir = new Map(); // id -> unit vector from atom toward its parent
  const visited = new Set([root]);
  const queue = [root];
  while (queue.length) {
    const cur = queue.shift();
    const curPos = target.get(cur);
    const kids = neigh.get(cur).filter(n => !visited.has(n));
    const pinnedDir = parentDir.get(cur) || null;
    const domains = kids.length + lpCount.get(cur);
    if (domains === 0) continue;
    const weights = [
      ...kids.map(() => 1),
      ...Array(lpCount.get(cur)).fill(1.6),
    ];
    const dirs = thomsonDirs(domains, weights, pinnedDir);
    kids.forEach((kid, i) => {
      const dir = dirs[i];
      const ka = atoms.get(cur), kb = atoms.get(kid);
      const bl = bondLength(ka.el, kb.el, bondsOf(atoms, bonds, cur).find(b => partnerId(b, cur) === kid)?.ionic);
      target.set(kid, V.add(curPos, V.scale(dir, bl)));
      parent.set(kid, cur);
      parentDir.set(kid, V.scale(dir, -1));
      visited.add(kid);
      queue.push(kid);
    });
  }

  // --- Virtual lone-pair particles -------------------------------------------
  const LP_LEN = 0.55;
  const lpPos = new Map(); // atomId -> [{x,y,z}, ...]
  const lpAssigned = new Map(); // atomId -> [dirIdx...] (indices in that atom's domain list)
  for (const id of ids) {
    const n = lpCount.get(id);
    lpPos.set(id, []);
    lpAssigned.set(id, []);
    if (n === 0) continue;
    const sigma = neigh.get(id).length;
    const pinned = parentDir.get(id) || null;
    const dirs = thomsonDirs(sigma + n, [...Array(sigma).fill(1), ...Array(n).fill(1.6)], pinned);
    for (let i = 0; i < n; i++) {
      lpPos.get(id).push(V.add(target.get(id), V.scale(dirs[sigma + i], LP_LEN)));
    }
  }

  // Precompute ideal angle matrix per atom
  const ideal = new Map();
  for (const id of ids) {
    const sigma = neigh.get(id).length;
    ideal.set(id, idealAngleMatrix(sigma, lpCount.get(id)));
  }

  // --- Global relaxation ------------------------------------------------------
  const vel = new Map();
  for (const id of ids) vel.set(id, { x: 0, y: 0, z: 0 });

  const displayR = new Map();
  for (const id of ids) displayR.set(id, displayRadius(atoms.get(id).el));

  const bondList = [];
  for (const id of ids) {
    for (const b of bondsOf(atoms, bonds, id)) {
      if (idSet.has(b.a) && idSet.has(b.b) && b.a === id) {
        const a = atoms.get(b.a), bb = atoms.get(b.b);
        bondList.push({ a: b.a, b: b.b, len: bondLength(a.el, bb.el, b.ionic) });
      }
    }
  }

  const ITER = ids.length > 60 ? 120 : 320;
  for (let it = 0; it < ITER; it++) {
    const F = new Map();
    for (const id of ids) F.set(id, { x: 0, y: 0, z: 0 });
    const addF = (id, f) => { F.set(id, V.add(F.get(id), f)); };

    // 1. Bond springs
    for (const bl of bondList) {
      const pa = target.get(bl.a), pb = target.get(bl.b);
      const d = V.sub(pb, pa);
      const dist = V.len(d) || 0.001;
      const f = V.scale(V.norm(d), 0.5 * (dist - bl.len));
      addF(bl.a, f);
      addF(bl.b, V.neg(f));
    }

    // 2. Angle springs between domains at each atom
    for (const id of ids) {
      const c = target.get(id);
      const { M, k } = ideal.get(id);
      const ends = []; // domain endpoints (positions)
      for (const n of neigh.get(id)) ends.push(target.get(n));
      for (const lp of lpPos.get(id)) ends.push(lp);
      if (ends.length !== k) continue;
      for (let i = 0; i < k; i++) {
        for (let j = i + 1; j < k; j++) {
          const ui = V.norm(V.sub(ends[i], c));
          const uj = V.norm(V.sub(ends[j], c));
          let cosT = V.dot(ui, uj);
          cosT = Math.max(-1, Math.min(1, cosT));
          const theta = Math.acos(cosT);
          let dTheta = M[i][j] - theta;
          dTheta = Math.max(-0.5, Math.min(0.5, dTheta));
          if (Math.abs(dTheta) < 0.005) continue;
          // Tangents that move endpoints i and j apart (increase theta)
          const tI = V.norm(V.sub(uj, V.scale(ui, cosT)));
          const tJ = V.norm(V.sub(ui, V.scale(uj, cosT)));
          const mag = 0.12 * dTheta;
          const sigma = neigh.get(id).length;
          if (i >= sigma) {
            lpPos.get(id)[i - sigma] = V.add(lpPos.get(id)[i - sigma], V.scale(tI, mag * 2));
          } else {
            addF(neigh.get(id)[i], V.scale(tI, mag));
          }
          if (j >= sigma) {
            lpPos.get(id)[j - sigma] = V.add(lpPos.get(id)[j - sigma], V.scale(tJ, mag * 2));
          } else {
            addF(neigh.get(id)[j], V.scale(tJ, mag));
          }
        }
      }
    }

    // 3. Nonbonded repulsion (real atoms)
    const arr = [...ids];
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const a = arr[i], b = arr[j];
        if (bondList.some(bl => (bl.a === a && bl.b === b) || (bl.a === b && bl.b === a))) continue;
        const pa = target.get(a), pb = target.get(b);
        const cut = (displayR.get(a) + displayR.get(b)) * 1.25;
        const d = V.sub(pb, pa);
        const dist = V.len(d) || 0.001;
        if (dist < cut) {
          const f = V.scale(V.norm(d), 0.35 * (cut - dist) / cut);
          addF(a, V.neg(f));
          addF(b, f);
        }
      }
    }

    // Integrate
    for (const id of ids) {
      if (id === root) { vel.set(id, { x: 0, y: 0, z: 0 }); continue; }
      let v = V.scale(V.add(vel.get(id), V.scale(F.get(id), 0.3)), 0.78);
      vel.set(id, v);
      target.set(id, V.add(target.get(id), v));
    }

    // Re-project lone-pair particles onto their shells
    for (const id of ids) {
      const c = target.get(id);
      lpPos.set(id, lpPos.get(id).map(p => V.add(c, V.scale(V.norm(V.sub(p, c)), LP_LEN))));
    }
  }

  return target;
}

// Solve all components; returns Map atomId -> {x,y,z}
// `analyses` is parallel to `comps`: the analyzeComponent result (with .per)
// for each component.
export function solveAll(atoms, bonds, comps, analyses = [], pinnedIds = new Set()) {
  const out = new Map();
  comps.forEach((comp, i) => {
    if (comp.bonds.length === 0) return; // free atoms stay put
    const pin = [...pinnedIds].find(p => comp.atoms.includes(p)) || null;
    const t = solveComponent(atoms, bonds, comp.atoms, pin, analyses[i]?.per ?? new Map());
    for (const [k, v] of t) out.set(k, v);
  });
  return out;
}
