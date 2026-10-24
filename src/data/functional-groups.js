// Structural functional group tagger.
// Operates on { atoms: string[], bonds: [[i,j,order,ionic?]] } templates
// to identify functional groups by their local bonding environment.
// Used by organic reaction handlers to match and transform molecules
// without hardcoded formula checks.

export const GROUP_TYPES = {
  ALCOHOL: 'alcohol',
  PHENOL: 'phenol',
  ALDEHYDE: 'aldehyde',
  KETONE: 'ketone',
  CARBOXYL: 'carboxyl',
  ESTER: 'ester',
  ETHER: 'ether',
  AMINE_PRIMARY: 'amine_1',
  AMINE_SECONDARY: 'amine_2',
  AMINE_TERTIARY: 'amine_3',
  AMIDE: 'amide',
  ALKENE: 'alkene',
  ALKYNE: 'alkyne',
  ARYL: 'aryl',
  HALIDE: 'halide',
  NITRILE: 'nitrile',
  NITRO: 'nitro',
  THIOL: 'thiol',
  THIOETHER: 'thioether',
  ACYL_CHLORIDE: 'acyl_chloride',
  ANHYDRIDE: 'anhydride',
  EPOXIDE: 'epoxide',
};

// Build adjacency list: adj[i] = [{j, order, bondIdx}]
export function buildAdj(atoms, bonds) {
  const adj = atoms.map(() => []);
  for (let bi = 0; bi < bonds.length; bi++) {
    const [i, j, order] = bonds[bi];
    if (i >= atoms.length || j >= atoms.length) continue;
    adj[i].push({ j, order: order || 1, bondIdx: bi });
    adj[j].push({ i, order: order || 1, bondIdx: bi });
  }
  return adj;
}

// Count neighbors of atom i with a given element symbol
function neighborCount(adj, atoms, i, sym) {
  let count = 0;
  for (const nb of adj[i]) {
    const other = nb.j !== undefined ? nb.j : nb.i;
    if (atoms[other] === sym) count++;
  }
  return count;
}

// Get neighbor atom indices
function neighbors(adj, i) {
  return adj[i].map(nb => nb.j !== undefined ? nb.j : nb.i);
}

// Find bonds of a specific order from atom i
function bondsOfOrder(adj, i, order) {
  return adj[i].filter(nb => nb.order === order);
}

// Detect if atom i is part of an aromatic ring (6-membered carbon ring
// with alternating single/double bonds or all ~1.5 order)
function isArylCarbon(adj, atoms, i) {
  if (atoms[i] !== 'C') return false;
  const ring = findRing(adj, atoms, i, 6, ['C']);
  if (!ring) return false;
  let doubleCount = 0;
  for (let k = 0; k < ring.length; k++) {
    const a = ring[k];
    const b = ring[(k + 1) % ring.length];
    const bond = adj[a].find(nb => (nb.j === b || nb.i === b));
    if (bond && bond.order >= 2) doubleCount++;
    if (bond && Math.abs(bond.order - 1.5) < 0.1) doubleCount += 0.5;
  }
  return doubleCount >= 2.5;
}

// DFS ring finder: find a ring of size `size` containing atom `start`,
// optionally restricted to atoms matching `filterSyms`
function findRing(adj, atoms, start, size, filterSyms) {
  const filter = filterSyms ? new Set(filterSyms) : null;
  const path = [start];
  const visited = new Set([start]);

  function dfs(current, depth) {
    if (depth === size) {
      const closed = adj[current].some(nb => {
        const other = nb.j !== undefined ? nb.j : nb.i;
        return other === start && path.length === size;
      });
      return closed ? [...path] : null;
    }
    for (const nb of adj[current]) {
      const other = nb.j !== undefined ? nb.j : nb.i;
      if (visited.has(other)) continue;
      if (filter && !filter.has(atoms[other])) continue;
      if (depth < size - 1) {
        const canReachStart = canReach(adj, other, start, visited, size - depth - 1);
        if (!canReachStart) continue;
      }
      visited.add(other);
      path.push(other);
      const result = dfs(other, depth + 1);
      if (result) return result;
      path.pop();
      visited.delete(other);
    }
    return null;
  }

  return dfs(start, 1);
}

function canReach(adj, from, target, visited, maxDepth) {
  if (maxDepth <= 0) return false;
  for (const nb of adj[from]) {
    const other = nb.j !== undefined ? nb.j : nb.i;
    if (other === target) return true;
    if (visited.has(other)) continue;
    if (canReach(adj, other, target, visited, maxDepth - 1)) return true;
  }
  return false;
}

// Count carbon substitution degree (how many C neighbors a C has)
function carbonSubstitution(adj, atoms, i) {
  return neighbors(adj, i).filter(j => atoms[j] === 'C').length;
}

// Tag all functional groups found in a template.
// Returns [{ group: GROUP_TYPES.*, atomIndices: number[] }]
export function tagFunctionalGroups(tpl) {
  if (!tpl || !tpl.atoms || !tpl.bonds) return [];
  const { atoms, bonds } = tpl;
  const adj = buildAdj(atoms, bonds);
  const tags = [];
  const seen = new Set();

  function addTag(group, indices) {
    const key = group + ':' + indices.sort().join(',');
    if (!seen.has(key)) {
      seen.add(key);
      tags.push({ group, atomIndices: indices });
    }
  }

  for (let i = 0; i < atoms.length; i++) {
    const sym = atoms[i];
    const nbs = neighbors(adj, i);

    // ── Alcohol: C-OH (sp3 C bonded to O, O bonded to H) ──
    if (sym === 'O' && neighborCount(adj, atoms, i, 'H') === 1) {
      const cNeighbors = nbs.filter(j => atoms[j] === 'C');
      if (cNeighbors.length === 1) {
        const c = cNeighbors[0];
        if (isArylCarbon(adj, atoms, c)) {
          addTag(GROUP_TYPES.PHENOL, [c, i, ...nbs.filter(j => atoms[j] === 'H')]);
        } else {
          const hNeighbors = nbs.filter(j => atoms[j] === 'H');
          addTag(GROUP_TYPES.ALCOHOL, [c, i, ...hNeighbors]);
        }
      }
    }

    // ── Carbonyl: C=O ──
    if (sym === 'C') {
      const doubleO = bondsOfOrder(adj, i, 2).filter(nb => {
        const other = nb.j !== undefined ? nb.j : nb.i;
        return atoms[other] === 'O';
      });
      if (doubleO.length === 1) {
        const oIdx = doubleO[0].j !== undefined ? doubleO[0].j : doubleO[0].i;
        const cNeighbors = neighbors(adj, i).filter(j => atoms[j] === 'C' && j !== oIdx);
        const hNeighbors = neighbors(adj, i).filter(j => atoms[j] === 'H');

        // Aldehyde: C=O with at least one H on the carbon
        if (hNeighbors.length >= 1 && cNeighbors.length <= 1) {
          addTag(GROUP_TYPES.ALDEHYDE, [i, oIdx, ...hNeighbors.slice(0, 1)]);
        }
        // Ketone: C=O with two C neighbors
        else if (cNeighbors.length >= 2) {
          addTag(GROUP_TYPES.KETONE, [i, oIdx, ...cNeighbors.slice(0, 2)]);
        }

        // Carboxyl: C=O + C-OH
        const singleO = bondsOfOrder(adj, i, 1).filter(nb => {
          const other = nb.j !== undefined ? nb.j : nb.i;
          return atoms[other] === 'O';
        });
        for (const so of singleO) {
          const soIdx = so.j !== undefined ? so.j : so.i;
          if (neighborCount(adj, atoms, soIdx, 'H') === 1) {
            addTag(GROUP_TYPES.CARBOXYL, [i, oIdx, soIdx]);
            break;
          }
        }

        // Ester: C=O + C-O-C
        for (const so of singleO) {
          const soIdx = so.j !== undefined ? so.j : so.i;
          if (neighborCount(adj, atoms, soIdx, 'H') === 0 &&
              neighborCount(adj, atoms, soIdx, 'C') >= 1) {
            addTag(GROUP_TYPES.ESTER, [i, oIdx, soIdx]);
            break;
          }
        }

        // Acyl chloride: C=O + C-Cl
        const clNeighbors = neighbors(adj, i).filter(j => atoms[j] === 'Cl');
        if (clNeighbors.length >= 1) {
          addTag(GROUP_TYPES.ACYL_CHLORIDE, [i, oIdx, clNeighbors[0]]);
        }
      }

      // Nitrile: C#N
      const tripleN = bondsOfOrder(adj, i, 3).filter(nb => {
        const other = nb.j !== undefined ? nb.j : nb.i;
        return atoms[other] === 'N';
      });
      if (tripleN.length === 1) {
        const nIdx = tripleN[0].j !== undefined ? tripleN[0].j : tripleN[0].i;
        addTag(GROUP_TYPES.NITRILE, [i, nIdx]);
      }
    }

    // ── Ether: C-O-C (O bonded to two C's, no H on O) ──
    if (sym === 'O' && neighborCount(adj, atoms, i, 'H') === 0) {
      const cNeighbors = nbs.filter(j => atoms[j] === 'C');
      if (cNeighbors.length === 2) {
        const hasCarbonyl = cNeighbors.some(c =>
          bondsOfOrder(adj, c, 2).some(nb => {
            const other = nb.j !== undefined ? nb.j : nb.i;
            return atoms[other] === 'O';
          })
        );
        if (!hasCarbonyl) {
          addTag(GROUP_TYPES.ETHER, [cNeighbors[0], i, cNeighbors[1]]);
        }
      }
    }

    // ── Amines ──
    if (sym === 'N') {
      const cNeighbors = nbs.filter(j => atoms[j] === 'C');
      const hNeighbors = nbs.filter(j => atoms[j] === 'H');
      if (cNeighbors.length === 1 && hNeighbors.length >= 1) {
        addTag(GROUP_TYPES.AMINE_PRIMARY, [i, cNeighbors[0], ...hNeighbors]);
      } else if (cNeighbors.length === 2) {
        addTag(GROUP_TYPES.AMINE_SECONDARY, [i, ...cNeighbors]);
      } else if (cNeighbors.length >= 3) {
        addTag(GROUP_TYPES.AMINE_TERTIARY, [i, ...cNeighbors.slice(0, 3)]);
      }
    }

    // ── Amide: C(=O)-NHx ──
    if (sym === 'N') {
      const cNeighbors = nbs.filter(j => atoms[j] === 'C');
      for (const c of cNeighbors) {
        const hasCarbonyl = bondsOfOrder(adj, c, 2).some(nb => {
          const other = nb.j !== undefined ? nb.j : nb.i;
          return atoms[other] === 'O';
        });
        if (hasCarbonyl) {
          addTag(GROUP_TYPES.AMIDE, [c, ...neighbors(adj, c).filter(j => atoms[j] === 'O'), i]);
          break;
        }
      }
    }

    // ── Alkene: C=C ──
    if (sym === 'C') {
      const doubleC = bondsOfOrder(adj, i, 2).filter(nb => {
        const other = nb.j !== undefined ? nb.j : nb.i;
        return atoms[other] === 'C';
      });
      for (const dc of doubleC) {
        const j = dc.j !== undefined ? dc.j : dc.i;
        if (j > i) {
          if (!isArylCarbon(adj, atoms, i) && !isArylCarbon(adj, atoms, j)) {
            addTag(GROUP_TYPES.ALKENE, [i, j]);
          }
        }
      }
    }

    // ── Alkyne: C#C ──
    if (sym === 'C') {
      const tripleC = bondsOfOrder(adj, i, 3).filter(nb => {
        const other = nb.j !== undefined ? nb.j : nb.i;
        return atoms[other] === 'C';
      });
      for (const tc of tripleC) {
        const j = tc.j !== undefined ? tc.j : tc.i;
        if (j > i) addTag(GROUP_TYPES.ALKYNE, [i, j]);
      }
    }

    // ── Halide: C-X (X = F, Cl, Br, I) ──
    if (sym === 'C') {
      for (const nb of nbs) {
        if (['F', 'Cl', 'Br', 'I'].includes(atoms[nb])) {
          addTag(GROUP_TYPES.HALIDE, [i, nb]);
        }
      }
    }

    // ── Thiol: C-SH ──
    if (sym === 'S' && neighborCount(adj, atoms, i, 'H') >= 1) {
      const cNeighbors = nbs.filter(j => atoms[j] === 'C');
      if (cNeighbors.length >= 1) {
        addTag(GROUP_TYPES.THIOL, [cNeighbors[0], i]);
      }
    }

    // ── Nitro: N(=O)-O or N(+)(=O)(-O-) ──
    if (sym === 'N') {
      const doubleO = bondsOfOrder(adj, i, 2).filter(nb => {
        const other = nb.j !== undefined ? nb.j : nb.i;
        return atoms[other] === 'O';
      });
      const singleO = bondsOfOrder(adj, i, 1).filter(nb => {
        const other = nb.j !== undefined ? nb.j : nb.i;
        return atoms[other] === 'O';
      });
      if (doubleO.length >= 1 && singleO.length >= 1) {
        const cNeighbors = nbs.filter(j => atoms[j] === 'C');
        if (cNeighbors.length >= 1) {
          addTag(GROUP_TYPES.NITRO, [i, ...cNeighbors.slice(0, 1)]);
        }
      }
    }

    // ── Epoxide: C-O-C in a 3-membered ring ──
    if (sym === 'O') {
      const cNeighbors = nbs.filter(j => atoms[j] === 'C');
      if (cNeighbors.length === 2) {
        const [c1, c2] = cNeighbors;
        const c1c2Bond = adj[c1].some(nb => {
          const other = nb.j !== undefined ? nb.j : nb.i;
          return other === c2;
        });
        if (c1c2Bond) {
          addTag(GROUP_TYPES.EPOXIDE, [c1, i, c2]);
        }
      }
    }
  }

  // ── Aryl: detect full aromatic ring ──
  const arylRings = new Set();
  for (let i = 0; i < atoms.length; i++) {
    if (atoms[i] === 'C' && isArylCarbon(adj, atoms, i)) {
      const ring = findRing(adj, atoms, i, 6, ['C']);
      if (ring) {
        const key = ring.slice().sort().join(',');
        if (!arylRings.has(key)) {
          arylRings.add(key);
          addTag(GROUP_TYPES.ARYL, ring);
        }
      }
    }
  }

  return tags;
}

// Convenience: check if template has a specific functional group
export function hasFunctionalGroup(tpl, groupType) {
  return tagFunctionalGroups(tpl).some(t => t.group === groupType);
}

// Find the first match of a specific group type
export function findGroup(tpl, groupType) {
  return tagFunctionalGroups(tpl).find(t => t.group === groupType) || null;
}

// Classify alcohol carbon as primary (1°), secondary (2°), or tertiary (3°)
export function alcoholClass(tpl, alcoholTag) {
  if (!alcoholTag || alcoholTag.group !== GROUP_TYPES.ALCOHOL) return null;
  const adj = buildAdj(tpl.atoms, tpl.bonds);
  const oIdx = alcoholTag.atomIndices.find(j => tpl.atoms[j] === 'O');
  const cIdx = neighbors(adj, oIdx).find(j => tpl.atoms[j] === 'C');
  if (cIdx === undefined) return null;
  const cNeighbors = neighbors(adj, cIdx).filter(j => tpl.atoms[j] === 'C');
  if (cNeighbors.length === 0) return 'methyl';
  if (cNeighbors.length === 1) return 'primary';
  if (cNeighbors.length === 2) return 'secondary';
  return 'tertiary';
}

// Classify haloalkane carbon for SN1/SN2 prediction
export function haloalkaneClass(tpl, halideTag) {
  if (!halideTag || halideTag.group !== GROUP_TYPES.HALIDE) return null;
  const adj = buildAdj(tpl.atoms, tpl.bonds);
  const cIdx = halideTag.atomIndices.find(j => tpl.atoms[j] === 'C');
  if (cIdx === undefined) return null;
  const cNeighbors = neighbors(adj, cIdx).filter(j => tpl.atoms[j] === 'C');
  if (cNeighbors.length === 0) return 'methyl';
  if (cNeighbors.length === 1) return 'primary';
  if (cNeighbors.length === 2) return 'secondary';
  return 'tertiary';
}
