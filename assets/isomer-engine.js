/*
 * isomer-engine.js  --  MOLECULITH isomer enumeration engine
 *
 * Standalone browser script (no ESM, no bundler, no external deps).
 * Exposes window.__isomerEngine with:
 *     enumerate(formula, options) -> { formula, items, complete, reason, truncated, stats }
 *     groupsOf(isomer)            -> [functional group labels]
 *     compare(formula, graphA, graphB) -> { same, relation }
 *     fromScene(atoms, bonds)     -> { formula, graph }  (maps -> graph)
 *
 * Method: pure graph enumeration over a fixed element multiset. Hydrogens are
 * implicit (never a node), so a state is (heavy atoms, bond orders) and the H
 * count of every atom is derived as valence - used. Duplicate-free output is
 * guaranteed by canonicalising each partial state (individualisation-refinement
 * certificates) and memoising those keys; canonical keys are byte-for-byte
 * deterministic and independent of input order.
 *
 * Every search is bounded by a hard atom cap plus state / canonicalisation /
 * wall-clock budgets. When a budget cuts the search the result is reported as
 * complete:false, truncated:true with a reason - completeness is never claimed
 * unless the search actually finished.
 *
 * Load with <script src="assets/isomer-engine.js"></script> before the app.
 */
(function () {
  'use strict';

  var VERSION = '1.0.0';

  var CLOCK = (typeof performance !== 'undefined' && performance && performance.now)
    ? function () { return performance.now(); }
    : function () { return Date.now(); };

  /* ------------------------------------------------------------------ *
   * Hard budgets. The engine is deliberately conservative: it returns
   * partial answers fast instead of grinding (see historic UI freeze).
   * ------------------------------------------------------------------ */
  var LIMITS = {
    MAX_HEAVY_ATOMS: 14,   /* formulas with more heavy atoms -> complete:false, reason:"too large" */
    MAX_ATOMS: 40,         /* heavy + implicit hydrogen count guard */
    MAX_H: 80,
    RESULT_CAP: 1200,      /* isomers kept per call */
    LIST_CAP: 900,         /* items returned per call */
    DEADLINE_MS: 1000,     /* wall clock for the search phase of enumerate() */
    ENRICH_MS: 320,        /* extra wall clock for naming/stereo/class work after it */
    STATE_CAP: 9000000,    /* growth-DFS states visited */
    CANON_CAP: 60000000,   /* canonicalisation work units */
    MEMO_CAP: 1500000,     /* partial-state memo keys */
    RING_MIN: 3,
    RING_MAX: 6,
    NAME_CAP: 400000,
    HARD_HEAVY_ATOMS: 18,  /* absolute ceiling: above this nothing is attempted */
    HARD_TOTAL_ATOMS: 60,
    HARD_H: 100
  };

  /* rules the engine never bends - reported verbatim in stats.excluded */
  var EXCLUSIONS = [
    'hydrogens are implicit and are never graph nodes; h = valence - used valence',
    'neutral closed-shell molecules only: no charges, no radicals, no hypervalent atoms (C/Si 4, N/P 3, O/S/Se 2, halogen/B 1) - nitro, azide, sulfoxide, sulfone, N-oxide and phosphate patterns are therefore unreachable',
    'no halogen-halogen (X-X) bonds',
    'no multiple bonds between two atoms of the same element unless that element is C or Si (so no N=N, O=O, S=S diazene/peroxide-type unsaturation)',
    'no metals and no ionic formulas',
    'ring sizes restricted to the RING_MIN..RING_MAX window (3..6 by default); larger rings and cages whose fundamental cycles exceed it are not generated',
    'tautomers ARE generated and flagged with the class "tautomer" and stats.tautomersIncluded - nothing is silently dropped',
    'stereoisomers are not emitted as separate items; each item carries geometric/chiralCenters flags instead'
  ];

  var TAXONOMY = ['chain', 'position', 'functional', 'tautomer', 'ring', 'geometric', 'optical'];

  function Budget(deadline, stateCap, canonCap) {
    this.t0 = CLOCK();
    this.deadline = deadline;
    this.stateCap = stateCap;
    this.canonCap = canonCap;
    this.states = 0;
    this.units = 0;
    this.exceeded = null;
  }
  Budget.prototype.elapsed = function () { return CLOCK() - this.t0; };
  Budget.prototype.bump = function (n) { this.states += (n || 1); };
  Budget.prototype.work = function (n) { this.units += (n || 1); };
  Budget.prototype.out = function (phase) {
    if (this.exceeded) return true;
    if (this.units > this.canonCap) {
      this.exceeded = 'canonicalisation budget exceeded while ' + phase;
    } else if (this.states > this.stateCap) {
      this.exceeded = 'search-state budget exceeded while ' + phase;
    } else if (this.elapsed() > this.deadline) {
      this.exceeded = 'time budget (' + this.deadline + ' ms) exceeded while ' + phase;
    }
    return !!this.exceeded;
  };

  /* ------------------------------------------------------------------ *
   * Element table: symbol -> [valence (max covalent bonds, no hypervalence),
   * atomic number, atomic mass]. Valences match the sandbox element data so
   * enumerated structures and hand-built scenes agree.
   * ------------------------------------------------------------------ */
  var VAL = {}, ZOF = {}, MASS = {};
  var NONMETAL = {};
  (function () {
    var rows = [
      ['H', 1, 1, 1.008], ['He', 0, 2, 4.0026], ['Li', 1, 3, 6.94], ['Be', 2, 4, 9.0122],
      ['B', 3, 5, 10.81], ['C', 4, 6, 12.011], ['N', 3, 7, 14.007], ['O', 2, 8, 15.999],
      ['F', 1, 9, 18.998], ['Ne', 0, 10, 20.18], ['Na', 1, 11, 22.99], ['Mg', 2, 12, 24.305],
      ['Al', 3, 13, 26.982], ['Si', 4, 14, 28.085], ['P', 3, 15, 30.974], ['S', 2, 16, 32.06],
      ['Cl', 1, 17, 35.45], ['Ar', 0, 18, 39.948], ['K', 1, 19, 39.098], ['Ca', 2, 20, 40.078],
      ['Sc', 3, 21, 44.956], ['Ti', 4, 22, 47.867], ['V', 5, 23, 50.942], ['Cr', 6, 24, 51.996],
      ['Mn', 4, 25, 54.938], ['Fe', 3, 26, 55.845], ['Co', 3, 27, 58.933], ['Ni', 2, 28, 58.693],
      ['Cu', 2, 29, 63.546], ['Zn', 2, 30, 65.38], ['Ga', 3, 31, 69.723], ['Ge', 4, 32, 72.63],
      ['As', 3, 33, 74.922], ['Se', 2, 34, 78.971], ['Br', 1, 35, 79.904], ['Kr', 0, 36, 83.798],
      ['Rb', 1, 37, 85.468], ['Sr', 2, 38, 87.62], ['Y', 3, 39, 88.906], ['Zr', 4, 40, 91.224],
      ['Nb', 5, 41, 92.906], ['Mo', 6, 42, 95.95], ['Tc', 7, 43, 98], ['Ru', 4, 44, 101.07],
      ['Rh', 4, 45, 102.91], ['Pd', 4, 46, 106.42], ['Ag', 2, 47, 107.87], ['Cd', 2, 48, 112.41],
      ['In', 3, 49, 114.82], ['Sn', 4, 50, 118.71], ['Sb', 3, 51, 121.76], ['Te', 2, 52, 127.6],
      ['I', 1, 53, 126.9], ['Xe', 0, 54, 131.29], ['Cs', 1, 55, 132.91], ['Ba', 2, 56, 137.33],
      ['La', 3, 57, 138.91], ['Ce', 4, 58, 140.12], ['W', 6, 74, 183.84], ['Pt', 4, 78, 195.08],
      ['Au', 3, 79, 196.97], ['Hg', 2, 80, 200.59], ['Tl', 3, 81, 204.38], ['Pb', 4, 82, 207.2],
      ['Bi', 3, 83, 208.98], ['Po', 2, 84, 209], ['At', 1, 85, 210], ['Rn', 0, 86, 222],
      ['Fr', 1, 87, 223], ['Ra', 2, 88, 226]
    ];
    var nonmetal = 'H B C N O F Si P S Cl Se Br I At Te As'.split(' ');
    for (var i = 0; i < rows.length; i++) {
      VAL[rows[i][0]] = rows[i][1];
      ZOF[rows[i][0]] = rows[i][2];
      MASS[rows[i][0]] = rows[i][3];
    }
    for (var j = 0; j < nonmetal.length; j++) NONMETAL[nonmetal[j]] = 1;
  })();

  var HALO = { F: 1, Cl: 1, Br: 1, I: 1, At: 1 };
  var CHAL = { O: 1, S: 1, Se: 1, Te: 1 };
  var SKEL = { C: 1, Si: 1, B: 1, P: 1 };

  /* ------------------------------------------------------------------ *
   * Formula parsing: C2H6O, CH3COOH, C6H12O6, (CH3)2CO, Fe3O4 ...
   * Supports nested parentheses and bracket groups with multipliers.
   * ------------------------------------------------------------------ */
  var SYM_RE = /^([A-Z][a-z]?)/;

  function parseFormula(text) {
    var res = {
      ok: false, error: null, input: String(text == null ? '' : text).trim(),
      counts: {}, symbols: [], heavy: {}, heavyTotal: 0, nH: 0, totalValence: 0,
      totalOrder: null, dbe: null, mass: 0, metal: null
    };
    var s = res.input.replace(/\s+/g, '').replace(/[·\*].*$/, '');
    if (!s) { res.error = 'empty formula'; return res; }
    var stack = [{}], cur = stack[0], i = 0, bad = false, guard = 0;
    while (i < s.length && !bad && ++guard < 4000) {
      var ch = s.charAt(i);
      if (ch === '(' || ch === '[') { stack.push({}); cur = stack[stack.length - 1]; i++; continue; }
      if (ch === ')' || ch === ']') {
        if (stack.length === 1) { bad = 'unbalanced parenthesis'; break; }
        var done = stack.pop(); cur = stack[stack.length - 1]; i++;
        var m = /^\d+/.exec(s.slice(i));
        var mult = m ? parseInt(m[0], 10) : 1;
        if (m) i += m[0].length;
        if (mult === 0) { bad = 'zero multiplier'; break; }
        for (var k in done) cur[k] = (cur[k] || 0) + done[k] * mult;
        continue;
      }
      var em = SYM_RE.exec(s.slice(i));
      if (!em) { bad = 'unexpected character "' + ch + '"'; break; }
      var sym = em[1];
      if (!(sym in VAL)) { bad = 'unknown element "' + sym + '"'; break; }
      i += sym.length;
      var nm = /^\d+/.exec(s.slice(i));
      var cnt = nm ? parseInt(nm[0], 10) : 1;
      if (nm) i += nm[0].length;
      cur[sym] = (cur[sym] || 0) + cnt;
    }
    if (bad) { res.error = bad; return res; }
    if (stack.length !== 1) { res.error = 'unbalanced parenthesis'; return res; }
    for (var sym2 in cur) {
      if (cur[sym2] > 0) {
        res.counts[sym2] = cur[sym2];
        if (VAL[sym2] === 0) { res.error = 'noble gases do not form stable neutral molecules here'; return res; }
      }
    }
    var keys = Object.keys(res.counts).sort(function (a, b) { return ZOF[a] - ZOF[b]; });
    if (!keys.length) { res.error = 'no atoms'; return res; }
    res.symbols = keys;
    var tv = 0, hv = 0, mass = 0, metal = null;
    for (var t = 0; t < keys.length; t++) {
      var e = keys[t], n = res.counts[e];
      mass += MASS[e] * n;
      if (e !== 'H') { tv += VAL[e] * n; res.heavy[e] = n; hv += n; if (!NONMETAL[e]) metal = metal || e; }
    }
    res.nH = res.counts.H || 0;
    res.heavyTotal = hv;
    res.totalValence = tv;
    res.mass = Math.round(mass * 1000) / 1000;
    res.metal = metal;
    if (hv === 0) { res.error = 'formula has no heavy atom centre'; return res; }
    if ((tv - res.nH) % 2 !== 0) { res.error = 'impossible hydrogen count: total valence minus H is odd'; return res; }
    if (res.nH > tv) { res.error = 'more hydrogens than available valence'; return res; }
    if (hv > LIMITS.HARD_HEAVY_ATOMS) { res.error = 'too large'; return res; }
    if (hv + res.nH > LIMITS.HARD_TOTAL_ATOMS) { res.error = 'too large'; return res; }
    if (res.nH > LIMITS.HARD_H) { res.error = 'too large'; return res; }
    res.totalOrder = (tv - res.nH) / 2;         /* sum of all bond orders */
    res.dbe = res.totalOrder - (hv > 0 ? hv - 1 : 0); /* degrees of unsaturation */
    if (res.totalOrder < hv - 1) { res.error = 'not enough valence to connect the skeleton'; return res; }
    res.ok = true;
    return res;
  }

  /* Hill-order formula string from an element count map */
  function formulaString(counts) {
    var out = '', e, rest = [];
    if (counts.C) out += 'C' + (counts.C > 1 ? counts.C : '');
    if (counts.H) out += 'H' + (counts.H > 1 ? counts.H : '');
    for (e in counts) if (e !== 'C' && e !== 'H') rest.push(e);
    if (!counts.C) { rest = Object.keys(counts).sort(); }
    rest.sort();
    for (var i = 0; i < rest.length; i++) {
      out += rest[i] + (counts[rest[i]] > 1 ? counts[rest[i]] : '');
    }
    return out;
  }
  var ZVAL = {}, ZSYM = {};
  (function () { for (var s in VAL) { ZVAL[ZOF[s]] = VAL[s]; ZSYM[ZOF[s]] = s; } })();

  /* ------------------------------------------------------------------ *
   * Graph view.  n = atoms in view, s = row stride of adj (the live
   * generator keeps one big array and only shrinks the view, so partial
   * states cost no allocation), z = atomic numbers, adj = bond orders.
   * Hydrogens are implicit: h[i] = valence[i] - sum of incident orders.
   * ------------------------------------------------------------------ */
  function Graph(n, z, adj, s) { this.n = n; this.z = z; this.adj = adj; this.s = s || n; }
  Graph.prototype.at = function (i, j) { return this.adj[i * this.s + j]; };
  Graph.prototype.put = function (i, j, v) {
    this.adj[i * this.s + j] = v; this.adj[j * this.s + i] = v;
  };
  Graph.prototype.used = function (i) {
    var t = 0, row = i * this.s;
    for (var j = 0; j < this.n; j++) t += this.adj[row + j];
    return t;
  };
  Graph.prototype.neighbours = function (i) {
    var out = [], row = i * this.s;
    for (var j = 0; j < this.n; j++) if (this.adj[row + j]) out.push(j);
    return out;
  };
  Graph.prototype.hydrogens = function () {
    var hv = new Array(this.n);
    for (var i = 0; i < this.n; i++) hv[i] = ZVAL[this.z[i]] - this.used(i);
    return hv;
  };
  Graph.prototype.copy = function () {
    var a = new Int8Array(this.n * this.n), i, j;
    for (i = 0; i < this.n; i++) for (j = 0; j < this.n; j++) a[i * this.n + j] = this.adj[i * this.s + j];
    var z = [];
    for (var t = 0; t < this.n; t++) z.push(this.z[t]);
    return new Graph(this.n, z, a, this.n);
  };

  /* map an array of signature strings to integer classes, ordered by the
   * sorted signature text so that numbering is isomorphism invariant */
  function remap(sigs) {
    var n = sigs.length, idx = new Array(n), i;
    for (i = 0; i < n; i++) idx[i] = i;
    idx.sort(function (a, b) { return sigs[a] === sigs[b] ? 0 : (sigs[a] < sigs[b] ? -1 : 1); });
    var color = new Array(n), cls = -1, prev = null;
    for (i = 0; i < n; i++) {
      var k = idx[i];
      if (prev === null || sigs[k] !== prev) { cls++; prev = sigs[k]; }
      color[k] = cls;
    }
    return color;
  }

  function initColors(g, hv) {
    var n = g.n, s = g.s, z = g.z, adj = g.adj, sigs = new Array(n);
    for (var i = 0; i < n; i++) {
      var parts = [], row = i * s;
      for (var j = 0; j < n; j++) {
        var o = adj[row + j];
        if (o) parts.push(z[j] * 4 + o);
      }
      parts.sort(numAsc);
      sigs[i] = chr(z[i] + 2048) + chr(hv[i] + 4096) + codes(parts);
    }
    return remap(sigs);
  }

  function numAsc(a, b) { return a - b; }

  /* single-character encodings keep signature building allocation-free-ish */
  function chr(x) { return String.fromCharCode(((x % 65536) + 65536) % 65536); }
  function codes(arr) {
    var out = '';
    for (var t = 0; t < arr.length; t++) out += chr(arr[t] + 256);
    return out;
  }
  function classCount(color) {
    var m = -1;
    for (var i = 0; i < color.length; i++) if (color[i] > m) m = color[i];
    return m + 1;
  }

  /* Weisfeiler-Lehman style colour refinement until the partition is stable.
   * Refinement only ever splits cells, so an unchanged cell count means the
   * partition is stable. */
  function refine(g, color, budget) {
    var n = g.n, s = g.s, adj = g.adj, cells = -1;
    for (var round = 0; round <= n + 1; round++) {
      if (budget) { budget.work(n); if (budget.out('canonicalising')) break; }
      var sigs = new Array(n);
      for (var i = 0; i < n; i++) {
        var parts = [], row = i * s;
        for (var j = 0; j < n; j++) {
          var o = adj[row + j];
          if (o) parts.push(color[j] * 4 + o);
        }
        parts.sort(numAsc);
        sigs[i] = chr(color[i] + 128) + codes(parts);
      }
      var nc = remap(sigs);
      var k = classCount(nc);
      var stop = k === cells;
      cells = k;
      color = nc;
      if (stop) break;
    }
    return color;
  }

  /* cells of a colouring, ordered by colour value */
  function cells(n, color) {
    var map = {}, out = [];
    for (var i = 0; i < n; i++) {
      var c = color[i];
      if (!map[c]) { map[c] = []; out.push(map[c]); }
      map[c].push(i);
    }
    out.sort(function (a, b) { return color[a[0]] - color[b[0]]; });
    return out;
  }

  /* canonical certificate for a fully discrete colouring */
  function certificate(g, hv, color) {
    var n = g.n, s = g.s, z = g.z, adj = g.adj, ord = [], i;
    for (i = 0; i < n; i++) ord.push(i);
    ord.sort(function (a, b) { return color[a] - color[b] || a - b; });
    var a1 = new Array(n), b1 = new Array(n), tri = [];
    for (i = 0; i < n; i++) {
      a1[i] = String.fromCharCode(z[ord[i]]);
      b1[i] = String.fromCharCode(97 + Math.max(0, Math.min(25, hv[ord[i]])));
    }
    for (i = 0; i < n; i++) {
      var row = ord[i] * s;
      for (var j = i + 1; j < n; j++) tri.push(String.fromCharCode(48 + adj[row + ord[j]]));
    }
    return { key: a1.join('') + '_' + b1.join('') + '_' + tri.join(''), ord: ord };
  }

  /* depth-first individualisation / refinement search for the canonical form */
  function canonSearch(g, hv, color, depth, best, budget) {
    if (budget && budget.units > budget.canonCap) return;
    color = refine(g, color, budget);
    if (budget && budget.out('canonicalising')) return;
    var cs = cells(g.n, color), target = null;
    for (var c = 0; c < cs.length; c++) if (cs[c].length > 1) { target = cs[c]; break; }
    if (!target) {
      var cert = certificate(g, hv, color);
      budget && budget.work(g.n * 6);
      if (!best.key || cert.key < best.key) { best.key = cert.key; best.ord = cert.ord; }
      return;
    }
    for (var t = 0; t < target.length; t++) {
      var nx = color.slice();
      nx[target[t]] = -1000 - depth;
      canonSearch(g, hv, nx, depth + 1, best, budget);
    }
  }

  /* public canonicalisation: deterministic key + canonical vertex order */
  function canonicalOf(g, budget, seedColor) {
    if (!g.n) return { key: '', ord: [], color: [] };
    var hv = g.hydrogens();
    var color = seedColor ? seedColor.slice() : initColors(g, hv);
    var best = { key: null, ord: null };
    canonSearch(g, hv, color, 0, best, budget);
    if (best.key === null) {
      /* budget blown mid-labeling: fall back to the refined certificate.
       * Still deterministic, and the caller marks the run as truncated. */
      var cert = certificate(g, hv, refine(g, color, budget));
      return { key: cert.key, ord: cert.ord, partial: true };
    }
    return best;
  }

  /* rooted canonical key: the root is individualised, so vertices in the same
   * orbit share a key and genuinely different branches never do */
  function rootedKey(g, hv, root, budget) {
    var color = initColors(g, hv);
    color[root] = -1000;
    var best = { key: null, ord: null };
    canonSearch(g, hv, color, 1, best, budget);
    return best.key;
  }

  /* substituent keys around an atom, sorted lowest to highest priority */
  function branchKeys(g, hv, i, budget) {
    var keys = [], nb = g.neighbours(i);
    for (var t = 0; t < nb.length; t++) {
      keys.push({ v: nb[t], key: rootedKey(g, hv, nb[t], budget) });
    }
    keys.sort(function (a, b) {
      return a.key === b.key ? a.v - b.v : (a.key < b.key ? -1 : 1);
    });
    return keys;   /* index 0 = lowest CIP-like priority */
  }

  /* hop distance between two atoms (Infinity when not connected) */
  function pathLength(g, from, to, maxHops) {
    var n = g.n, s = g.s, adj = g.adj;
    if (from === to) return 0;
    var seen = new Int8Array(n), dist = new Int32Array(n), q = [from];
    seen[from] = 1;
    for (var head = 0; head < q.length; head++) {
      var u = q[head], d = dist[u];
      if (u === to) return d;
      if (d >= maxHops) continue;
      var row = u * s;
      for (var v = 0; v < n; v++) {
        if (adj[row + v] && !seen[v]) { seen[v] = 1; dist[v] = d + 1; q.push(v); }
      }
    }
    return seen[to] ? dist[to] : Infinity;
  }

  /* size of the ring a new edge would close, 0 when it is a bridge */
  function cycleSize(g, u, v) {
    var L = pathLength(g, u, v, 1000000);
    return L === Infinity ? 0 : L + 1;
  }
  function num(v, dflt, lo, hi) {
    var x = (typeof v === 'number' && isFinite(v)) ? v : dflt;
    return Math.max(lo, Math.min(hi, x));
  }

  /* chemistry policy filters, applied to every bond the generator creates */
  function bondAllowed(z1, z2, order, opts) {
    var s1 = ZSYM[z1], s2 = ZSYM[z2];
    if (order < 1 || order > 3) return false;
    if (opts && opts.allowMulti === false && order > 1) return false;
    if (HALO[s1] && HALO[s2]) return false;                       /* no X-X backbone */
    if (HALO[s1] || HALO[s2]) return order === 1;                 /* halogens stay monovalent */
    if (order > 1 && z1 === z2 && z1 !== 6 && z1 !== 14) return false; /* no N=N, O=O, S=S */
    if (opts.rejectHomonuclearTriple && order === 3 && z1 === z2) return false;
    return true;
  }

  /* ------------------------------------------------------------------ *
   * Growth search.  A state is (k atoms placed, E = total bond order).
   * Move A attaches the next atom to one placed atom with order 1..3;
   * move B inserts or upgrades an edge between two placed atoms.  Every
   * connected multigraph has such a construction path (spanning tree plus
   * the non-tree edges), so the search is exhaustive, and isomorphic
   * states are collapsed through a memo of canonical partial keys, so each
   * constitutional isomer is emitted exactly once.
   * ------------------------------------------------------------------ */
  function grow(ctx, k, E) {
    var B = ctx.budget;
    if (B.exceeded) { ctx.stop = ctx.stop || B.exceeded; return; }
    B.bump(1);
    if (k === ctx.n && E === ctx.T) { record(ctx, k); return; }

    var view = null;
    if (ctx.useMemo && k > 0) {
      view = new Graph(k, ctx.z, ctx.adj, ctx.n);
      var c = canonicalOf(view, B);
      if (c.partial || c.key === null) {
        ctx.useMemo = false;                 /* keys are not trustworthy any more */
        ctx.stats.canonIncomplete = true;
      } else {
        if (ctx.memo[c.key]) { ctx.stats.memoHits++; return; }
        if (ctx.memoSize < ctx.memoCap) { ctx.memo[c.key] = 1; ctx.memoSize++; }
        else { ctx.useMemo = false; ctx.stats.memoOverflow = true; }
      }
      if (B.exceeded) { ctx.stop = ctx.stop || B.exceeded; return; }
    } else if (!view) {
      view = new Graph(k, ctx.z, ctx.adj, ctx.n);
    }

    /* ---- move A: place the next atom ------------------------------------ */
    if (k < ctx.n && E + (ctx.n - k - 1) <= ctx.T) {
      if (k === 0) {
        for (var f = 0; f < ctx.elems.length; f++) {
          var ef = ctx.elems[f];
          if (!ef.left) continue;
          ef.left--; ctx.z[0] = ef.z; ctx.val[0] = ef.v;
          grow(ctx, 1, 0);
          ef.left++; ctx.z[0] = 0; ctx.val[0] = 0;
          if (ctx.stop) return;
        }
        return;
      }
      for (var t = 0; t < ctx.elems.length; t++) {
        var el = ctx.elems[t];
        if (!el.left) continue;
        for (var x = 0; x < k; x++) {
          var tgtSpare = ctx.val[x] - ctx.used[x];
          var hi = Math.min(3, el.v, tgtSpare);
          for (var o = 1; o <= hi; o++) {
            if (E + o + (ctx.n - k - 1) > ctx.T) break;
            if (!bondAllowed(el.z, ctx.z[x], o, ctx.opts)) { ctx.stats.bondPruned++; continue; }
            var idx = k * ctx.n + x;
            ctx.adj[idx] = o; ctx.adj[x * ctx.n + k] = o;
            ctx.used[k] = o; ctx.used[x] += o; ctx.z[k] = el.z; ctx.val[k] = el.v; el.left--;
            grow(ctx, k + 1, E + o);
            el.left++; ctx.z[k] = 0; ctx.val[k] = 0; ctx.used[x] -= o; ctx.used[k] = 0;
            ctx.adj[idx] = 0; ctx.adj[x * ctx.n + k] = 0;
            if (ctx.stop) return;
          }
        }
      }
    }

    /* ---- move B: insert or upgrade an edge between placed atoms --------- */
    if (k >= 2 && E < ctx.T) {
      for (var i = 0; i < k; i++) {
        for (var j = i + 1; j < k; j++) {
          var cur = ctx.adj[i * ctx.n + j];
          var lim = Math.min(3 - cur, ctx.val[i] - ctx.used[i], ctx.val[j] - ctx.used[j]);
          for (var d = 1; d <= lim; d++) {
            if (E + d > ctx.T) break;
            if (!bondAllowed(ctx.z[i], ctx.z[j], cur + d, ctx.opts)) { ctx.stats.bondPruned++; break; }
            if (cur === 0) {
              var csz = cycleSize(view, i, j);
              if (csz > ctx.maxRing || (csz > 0 && !ctx.opts.includeRings)) { ctx.stats.ringPruned++; continue; }
            }
            var id2 = i * ctx.n + j;
            ctx.adj[id2] = cur + d; ctx.adj[j * ctx.n + i] = cur + d;
            ctx.used[i] += d; ctx.used[j] += d;
            grow(ctx, k, E + d);
            ctx.used[i] -= d; ctx.used[j] -= d; ctx.adj[id2] = cur; ctx.adj[j * ctx.n + i] = cur;
            if (ctx.stop) return;
          }
        }
      }
    }
  }

  function record(ctx, n) {
    var g = new Graph(n, ctx.z, ctx.adj, n);
    var c = canonicalOf(g, ctx.budget);
    if (ctx.budget.exceeded && c.key === null) { ctx.stop = ctx.stop || ctx.budget.exceeded; return; }
    if (c.partial) ctx.stats.canonIncomplete = true;
    if (ctx.seen[c.key]) { ctx.stats.duplicates++; return; }
    ctx.seen[c.key] = 1;
    ctx.stats.canonicalised++;
    if (ctx.found.length >= ctx.resultCap) {
      ctx.stop = 'result cap of ' + ctx.resultCap + ' isomers reached';
      ctx.stats.resultCapHit = true;
      return;
    }
    ctx.found.push({ key: c.key, ord: c.ord, g: g.copy(), partial: !!c.partial });
  }

  function enumerate(formula, options) {
    options = options || {};
    var p = parseFormula(formula);
    var maxHeavy = num(options.maxAtoms, LIMITS.MAX_HEAVY_ATOMS, 1, LIMITS.HARD_HEAVY_ATOMS);
    var ringMax = num(options.maxRing, LIMITS.RING_MAX, 0, 12);
    var ringMin = num(options.minRing, LIMITS.RING_MIN, 0, ringMax);
    var resultCap = num(options.maxResults, LIMITS.RESULT_CAP, 4, 5000);
    var listCap = num(options.limit, LIMITS.LIST_CAP, 1, LIMITS.RESULT_CAP);
    var hard = p.error === 'too large';
    var deadline = num(options.deadlineMs, hard ? 350 : LIMITS.DEADLINE_MS, 20, 20000);
    var enrichMs = num(options.enrichMs, hard ? 120 : LIMITS.ENRICH_MS, 20, 20000);
    var stateCap = num(options.stateCap, LIMITS.STATE_CAP, 1000, 50000000);
    var canonCap = num(options.canonCap, LIMITS.CANON_CAP, 1000, 40000000);
    var budget = new Budget(deadline, stateCap, canonCap);
    var stats = {
      states: 0, memoHits: 0, memoSize: 0, canonicalised: 0, duplicates: 0,
      bondPruned: 0, ringPruned: 0, memoOverflow: false, resultCapHit: false,
      canonIncomplete: false, elapsedMs: 0, dbe: p.dbe, mass: p.mass,
      enrichStopped: false, stereoIncomplete: false, namingIncomplete: false,
      tautomerPassIncomplete: false,
      heavyAtoms: p.heavyTotal, hydrogens: p.nH, totalOrder: p.totalOrder,
      elements: p.counts, limits: {
        maxHeavyAtoms: maxHeavy, deadlineMs: deadline, enrichMs: enrichMs,
        stateCap: stateCap, canonCap: canonCap, resultCap: resultCap,
        listCap: listCap, ringMin: ringMin, ringMax: ringMax
      },
      rings: { min: ringMin, max: ringMax },
      tautomersIncluded: options.tautomers !== false,
      taxonomy: TAXONOMY.slice(),
      excluded: EXCLUSIONS.slice(),
      classCounts: {}, groupCounts: {}, families: {}
    };
    var out = {
      formula: Object.keys(p.counts).length ? formulaString(p.counts) : String(formula || ''),
      input: p.input, items: [], complete: false, truncated: false,
      reason: '', stats: stats
    };

    if (!p.ok) {
      out.complete = false;
      if (hard) {
        out.truncated = true;
        out.reason = 'too large: ' + p.heavyTotal + ' heavy atoms / ' + p.nH +
          ' hydrogens exceed the hard ceiling (' + LIMITS.HARD_HEAVY_ATOMS +
          ' heavy, ' + LIMITS.HARD_TOTAL_ATOMS + ' total). Nothing was enumerated.';
      } else {
        out.reason = 'invalid formula: ' + p.error;
      }
      out.stats.elapsedMs = Math.round(budget.elapsed() * 10) / 10;
      return out;
    }
    if (p.metal) {
      out.complete = false;
      out.reason = 'metal-containing formulas are out of scope (no ionic or organometallic bonding model): ' + p.metal;
      out.stats.elapsedMs = Math.round(budget.elapsed() * 10) / 10;
      return out;
    }

    var elems = [], sym;
    for (sym in p.heavy) elems.push({ sym: sym, z: ZOF[sym], v: VAL[sym], left: p.heavy[sym] });
    elems.sort(function (a, b) { return a.z - b.z; });

    var n = p.heavyTotal, T = p.totalOrder;
    var val = new Int32Array(n), z = new Int32Array(n), used = new Int32Array(n);
    var adj = new Int8Array(n * n);
    var norm = {
      includeRings: options.includeRings !== false,
      allowMulti: options.multipleBonds !== false,
      tautomers: options.tautomers !== false,
      stereo: options.stereo !== false,
      naming: options.name !== false,
      rejectHomonuclearTriple: !!options.rejectHomonuclearTriple
    };
    var ctx = {
      n: n, T: T, elems: elems, z: z, adj: adj, used: used, val: val,
      opts: norm, budget: budget, stats: stats,
      memo: Object.create(null), memoSize: 0, memoCap: LIMITS.MEMO_CAP,
      useMemo: n > 2, seen: Object.create(null),
      found: [], resultCap: resultCap, maxRing: ringMax, stop: null
    };
    grow(ctx, 0, 0);
    stats.states = budget.states;
    stats.memoSize = ctx.memoSize;
    stats.elapsedMs = Math.round(budget.elapsed() * 10) / 10;

    var overBudget = n > maxHeavy;
    var cut = !!ctx.stop;
    out.truncated = cut || overBudget;
    out.complete = !cut && !overBudget && !stats.canonIncomplete && !stats.memoOverflow;
    if (cut) {
      out.reason = ctx.stop + ' - ' + ctx.found.length +
        ' isomer(s) confirmed, the rest of the space was NOT searched, so this list is partial';
    } else if (overBudget) {
      out.reason = 'too large for an exhaustive search: ' + n + ' heavy atoms exceed the ' +
        maxHeavy + '-atom budget, only a partial set (first ' + ctx.found.length +
        ' isomers found) is reported';
    } else if (stats.canonIncomplete) {
      out.reason = 'canonical labelling ran out of budget, so duplicate suppression was relaxed';
    } else if (stats.memoOverflow) {
      out.reason = 'memo table overflowed, search continued without state de-duplication';
    } else {
      out.reason = 'exhaustive within the documented rules (' + n + ' heavy atoms, ' +
        'bond order sum ' + T + ', degrees of unsaturation ' + p.dbe +
        ', rings ' + ringMin + '-' + ringMax + ')';
    }
    finalize(out, ctx, stats, listCap, options, enrichMs);
    return out;
  }
  /* ------------------------------------------------------------------ *
   * Structural analysis: rings, functional groups, stereo elements.
   * ------------------------------------------------------------------ */
  function totalOrder(g) {
    var t = 0;
    for (var i = 0; i < g.n; i++) for (var j = i + 1; j < g.n; j++) t += g.adj[i * g.s + j];
    return t;
  }

  /* spanning-tree ring analysis: fundamental cycles, ring atoms, ring sizes */
  function ringInfo(g) {
    var n = g.n, sizes = [], inRing = new Int8Array(n), tree = [], extra = [];
    if (!n) return { sizes: sizes, inRing: inRing, count: 0, atoms: [] };
    var seen = new Int8Array(n), par = new Int32Array(n), dep = new Int32Array(n), q = [0];
    for (var i = 0; i < n; i++) par[i] = -1;
    seen[0] = 1;
    for (var head = 0; head < q.length; head++) {
      var u = q[head];
      for (var v = 0; v < n; v++) {
        if (!g.adj[u * g.s + v]) continue;
        if (!seen[v]) { seen[v] = 1; par[v] = u; dep[v] = dep[u] + 1; q.push(v); tree.push([u, v]); }
        else if (par[u] !== v && par[v] !== u && u < v) extra.push([u, v]);
      }
    }
    for (var e = 0; e < extra.length; e++) {
      var a = extra[e][0], b = extra[e][1], path = [];
      var da = {}, x = a;
      while (x >= 0) { da[x] = 1; x = par[x]; }
      var y = b, common = -1;
      while (y >= 0) { if (da[y]) { common = y; break; } y = par[y]; }
      // The walk counts every ring atom exactly once: the two arms up to the
      // shared ancestor, then that ancestor itself. Seeding len at 1 alongside
      // the closing ++ made every ring read one atom too large, so a
      // cyclobutane claimed a 5-ring and singleRing refused to return its
      // cycle - the whole ring rendering and ring naming fell through.
      var len = 0;
      x = a; while (x !== common) { len++; inRing[x] = 1; x = par[x]; }
      y = b; while (y !== common) { len++; inRing[y] = 1; y = par[y]; }
      inRing[common] = 1; len++;
      sizes.push(len);
    }
    sizes.sort(function (p, r) { return p - r; });
    var atoms = [];
    for (var t = 0; t < n; t++) if (inRing[t]) atoms.push(t);
    return { sizes: sizes, inRing: inRing, count: extra.length, atoms: atoms };
  }

  /* the ring a set of atoms forms, when the whole molecule is one ring */
  function singleRing(g, ri) {
    if (ri.count !== 1 || ri.sizes.length !== 1) return null;
    var start = ri.atoms[0], order = [start], prev = -1, cur = start;
    for (var step = 0; step < ri.sizes[0]; step++) {
      var nxt = -1;
      for (var v = 0; v < g.n; v++) {
        if (v !== prev && g.adj[cur * g.s + v] && ri.inRing[v]) { nxt = v; break; }
      }
      if (nxt < 0) break;
      prev = cur; cur = nxt;
      if (cur === start) break;
      order.push(cur);
    }
    return order.length === ri.sizes[0] ? order : null;
  }

  /* 6- or 5-ring with the right alternating pattern (benzene / furan type) */
  function isAromatic(g, hv, ring) {
    if (!ring || (ring.length !== 6 && ring.length !== 5)) return false;
    var doubles = 0, i;
    for (i = 0; i < ring.length; i++) {
      var a = ring[i], b = ring[(i + 1) % ring.length];
      if (g.adj[a * g.s + b] === 2) doubles++;
      if (g.adj[a * g.s + b] === 3) return false;
    }
    var need = ring.length === 6 ? 3 : 2;
    if (doubles !== need) return false;
    for (i = 0; i < ring.length; i++) {
      var at = ring[i], z = g.z[at], h = hv[at];
      var ringDoubles = 0;
      for (var j = 0; j < ring.length; j++) {
        var o = g.adj[at * g.s + ring[j]];
        if (o === 2) ringDoubles++;
        if (o === 3) return false;
      }
      if (z === 8 || z === 16) { if (ringDoubles > 0 || h !== 0) return false; }        /* furan-type O */
      else if (z === 7) { if (ringDoubles > 1 || (ringDoubles === 0 && h !== 0)) return false; }
      else if (z === 6) { if (ringDoubles !== 1) return false; }
      else return false;
    }
    return true;
  }

  var PRINCIPAL_RANK = {
    'carboxylic acid': 100, ester: 96, nitrile: 92, aldehyde: 88, ketone: 84,
    alcohol: 78, phenol: 78, thiol: 72, amine: 68, 'primary amine': 68,
    'secondary amine': 68, 'tertiary amine': 68, alkene: 40, alkyne: 38
  };

  /* functional group detection; also feeds the namer */
  function detectGroups(g, hv, ri, budget) {
    var n = g.n, recs = [], labels = [], i, j;
    function push(type, atoms, extra) {
      recs.push({ type: type, atoms: atoms, extra: extra || null });
    }
    var used = new Int32Array(n), deg = new Int32Array(n), nb = [];
    for (i = 0; i < n; i++) {
      var list = [], row = i * g.s, u = 0;
      for (j = 0; j < n; j++) { var o = g.adj[row + j]; if (o) { list.push({ v: j, o: o }); u += o; } }
      used[i] = u; deg[i] = list.length; nb[i] = list;
    }
    function nbrOf(i, order) {
      var out = [];
      for (var t = 0; t < nb[i].length; t++) if (nb[i][t].o === order) out.push(nb[i][t].v);
      return out;
    }
    var aromSet = new Int8Array(n), aromaticRings = [];
    var ring = singleRing(g, ri);
    var arom = isAromatic(g, hv, ring);
    if (arom) {
      aromaticRings.push(ring.slice());
      for (i = 0; i < ring.length; i++) aromSet[ring[i]] = 1;
    }

    var esterSeen = new Int8Array(n);
    for (i = 0; i < n; i++) {
      var z = g.z[i], sym = ZSYM[z];
      var dblO = [], dblC = [], dblN = [], dblS = [], tri = [];
      for (j = 0; j < nb[i].length; j++) {
        var e = nb[i][j], ez = g.z[e.v];
        if (e.o === 3) { tri.push(e); continue; }
        if (e.o === 2) {
          if (ez === 8 || ez === 16) dblO.push(e.v);
          else if (ez === 7) dblN.push(e.v);
          else if (ez === 6 || ez === 14) dblC.push(e.v);
          else dblS.push(e.v);
        }
      }
      if (z === 6 || z === 14) {
        if (dblO.length) {
          var ohOn = -1, oEtherOn = -1;
          for (j = 0; j < nb[i].length; j++) {
            var w = nb[i][j];
            if (w.o !== 1) continue;
            var wz = g.z[w.v];
            if (wz === 8 || wz === 16) {
              var cnt = 0, oth = -1;
              for (var q = 0; q < n; q++) if (q !== i && g.adj[w.v * g.s + q]) { cnt++; oth = q; }
              if (hv[w.v] === 1 && cnt === 0) ohOn = w.v;
              else if (cnt === 1 && oth !== i) oEtherOn = w.v;
            }
          }
          if (ohOn >= 0) push('carboxylic acid', [i, dblO[0], ohOn]);
          else if (oEtherOn >= 0) { push('ester', [i, dblO[0], oEtherOn]); esterSeen[i] = 1; }
          else if (hv[i] > 0) push('aldehyde', [i, dblO[0]]);
          else push('ketone', [i, dblO[0]]);
        }
        for (j = 0; j < tri.length; j++) {
          var tz = g.z[tri[j].v];
          if (tz === 7) push('nitrile', [i, tri[j].v]);
          else if (tz === 6 || tz === 14) push('alkyne', [i, tri[j].v]);
        }
        for (j = 0; j < dblC.length; j++) {
          if (dblC[j] > i) push('alkene', [i, dblC[j]]);
        }
        for (j = 0; j < dblN.length; j++) push('imine', [i, dblN[j]]);
        for (j = 0; j < dblS.length; j++) push('thional', [i, dblS[j]]);
      }
      if ((z === 8 || z === 16) && !dblO.length) {
        var hyd = hv[i], acyl = false, nCarb = 0;
        for (j = 0; j < nb[i].length; j++) {
          var v2 = nb[i][j].v;
          if (g.z[v2] === 6 || g.z[v2] === 14) nCarb++;
          for (var d = 0; d < nb[v2].length; d++) {
            var dv = nb[v2][d].v;
            if (nb[v2][d].o === 2 && (g.z[dv] === 8 || g.z[dv] === 16)) acyl = true;
          }
        }
        if (hyd === 1) push(z === 8 ? (aromSet[i] ? 'phenol' : 'alcohol') : 'thiol', [i]);
        else if (hyd === 0 && nCarb === 2 && !acyl) push(z === 8 ? 'ether' : 'sulfide', [i]);
      }
      if (z === 7 && used[i] <= 3) {
        var nH = hv[i], nOther = 0;
        for (j = 0; j < nb[i].length; j++) {
          var nz = g.z[nb[i][j].v];
          if (!(nz === 6 || nz === 14) && nb[i][j].o === 1) nOther++;
        }
        if (nH === 2) push('primary amine', [i]);
        else if (nH === 1) push('secondary amine', [i]);
        else if (nH === 0 && used[i] === 3 && nOther === 0) push('tertiary amine', [i]);
      }
      if (HALO[sym]) push(sym === 'F' ? 'fluoro' : sym === 'Cl' ? 'chloro' : sym === 'Br' ? 'bromo' : 'iodo', [i]);
    }
    if (arom) {
      var allC = true;
      for (i = 0; i < ring.length; i++) if (g.z[ring[i]] !== 6) allC = false;
      push(allC ? 'arene' : 'heteroarene', ring.slice());
    }
    var map = {};
    for (i = 0; i < recs.length; i++) if (recs[i].type && !map[recs[i].type]) { map[recs[i].type] = 1; labels.push(recs[i].type); }
    labels.sort();
    var best = null;
    for (i = 0; i < recs.length; i++) {
      var r = PRINCIPAL_RANK[recs[i].type] || 0;
      if (r > 0 && (!best || r > (PRINCIPAL_RANK[best.type] || 0))) best = recs[i];
    }
    if (ri.count > 0) {
      var carboc = true;
      for (i = 0; i < ri.atoms.length; i++) if (g.z[ri.atoms[i]] === 6 || g.z[ri.atoms[i]] === 14) continue; else carboc = false;
      labels.push(carboc ? 'carbocycle' : 'heterocycle');
      labels.sort();
    } else if (!labels.length) {
      labels.push('alkane');
    }
    return {
      labels: labels, records: recs, principal: best, aromatic: arom, ring: ring, ri: ri,
      used: used, deg: deg, nb: nb, signature: labels.join('|')
    };
  }
  /* canonicalisation with an explicit hydrogen vector (used for skeleton and
   * framework keys, where hydrogens must not influence the labelling) */
  function canonicalWithHv(g, hv, budget) {
    if (!g.n) return { key: '', ord: [] };
    var color = initColors(g, hv);
    var best = { key: null, ord: null };
    canonSearch(g, hv, color, 0, best, budget);
    if (best.key === null) {
      var cert = certificate(g, hv, refine(g, color, budget));
      return { key: cert.key, ord: cert.ord, partial: true };
    }
    return best;
  }

  /* connectivity key: same atoms and same connections, bond orders ignored */
  function skeletonKey(g, budget) {
    var n = g.n, a = new Int8Array(n * n), zero = new Array(n), i, j;
    for (i = 0; i < n; i++) {
      zero[i] = 0;
      for (j = 0; j < n; j++) a[i * n + j] = g.adj[i * g.s + j] ? 1 : 0;
    }
    var copy = new Graph(n, g.z, a, n);
    var r = canonicalWithHv(copy, zero, budget);
    return { key: r.key, ord: r.ord };
  }

  /* ------------------------------------------------------------------ *
   * Stereo elements.
   *   geometric: a C=C / C=N whose two ends each carry two different
   *              substituents (compared by rooted branch keys, never by
   *              element symbols) and that is not locked inside a ring
   *              smaller than 8.
   *   optical:   a tetrahedral C/Si whose four branch keys are pairwise
   *              different.  Amines are left out: N inverts at room
   *              temperature, so the centre is not configurationally
   *              stable (reported in stats.labileNitrogen).
   * ------------------------------------------------------------------ */
  function ligandsOf(g, hv, i, exclude) {
    var out = [];
    for (var v = 0; v < g.n; v++) {
      if (v === exclude) continue;
      var o = g.adj[i * g.s + v];
      if (o) out.push({ v: v, order: o });
    }
    if (hv[i] > 0) out.push({ v: -1 - hv[i], order: 0, h: hv[i] });
    return out;
  }

  /* two different ligands on one end of a double bond, looking from i away
   * from its double-bond partner j */
  function stereogenicEnd(g, hv, i, j, budget) {
    if (hv[i] > 1) return false;
    var list = [];
    for (var v = 0; v < g.n; v++) {
      if (v !== j && g.adj[i * g.s + v]) list.push(v);
    }
    if (hv[i] === 1) return list.length === 1;                 /* H vs one heavy group */
    if (list.length !== 2) return false;
    var k1 = rootedKey(g, hv, list[0], budget);
    var k2 = rootedKey(g, hv, list[1], budget);
    return k1 !== null && k1 !== k2;
  }

  function stereoOf(g, hv, ri, budget, flags) {
    var res = {
      geometric: false, optical: false, doubleBonds: [], chiralCenters: [],
      labileNitrogen: 0, axial: false
    };
    var n = g.n, i, j;
    var biggestRing = ri.sizes.length ? ri.sizes[ri.sizes.length - 1] : 0;
    for (i = 0; i < n; i++) {
      for (j = i + 1; j < n; j++) {
        if (g.adj[i * g.s + j] !== 2) continue;
        var zi = g.z[i], zj = g.z[j];
        var pair = (zi === 6 && (zj === 6 || zj === 7 || zj === 8 || zj === 16)) ||
                   (zj === 6 && (zi === 7 || zi === 8 || zi === 16));
        if (!pair) continue;
        if (ri.inRing[i] && ri.inRing[j] && biggestRing < 8) continue;  /* cis-only ring alkene */
        if (stereogenicEnd(g, hv, i, j, budget) && stereogenicEnd(g, hv, j, i, budget)) {
          res.geometric = true;
          res.doubleBonds.push({ a: i, b: j });
        }
        if (budget.exceeded) { flags.incomplete = true; return res; }
      }
    }
    for (i = 0; i < n; i++) {
      var zc = g.z[i];
      if (zc !== 6 && zc !== 14) continue;
      var usedI = 0, degI = 0;
      for (j = 0; j < n; j++) {
        var oo = g.adj[i * g.s + j];
        if (oo) { usedI += oo; degI++; }
      }
      if (usedI !== 4 || degI + hv[i] !== 4) continue;   /* sp3 with four sigma bonds */
      if (hv[i] > 1) continue;
      var keys = branchKeys(g, hv, i, budget);
      if (budget.exceeded) { flags.incomplete = true; return res; }
      var seenK = {}, dup = false;
      for (j = 0; j < keys.length; j++) {
        if (hv[i] === 1 && keys.length !== 3) continue;
        if (seenK[keys[j].key]) dup = true;
        seenK[keys[j].key] = 1;
      }
      if (hv[i] === 1 && keys.length === 3 && !dup) res.chiralCenters.push(i);
      else if (hv[i] === 0 && keys.length === 4 && !dup) res.chiralCenters.push(i);
    }
    for (i = 0; i < n; i++) {
      if (g.z[i] !== 7 || hv[i] !== 1) continue;
      var d = 0;
      for (j = 0; j < n; j++) if (g.adj[i * g.s + j]) d++;
      if (d !== 2) continue;
      var nk = branchKeys(g, hv, i, budget);
      if (nk.length === 3 && nk[0].key !== nk[1].key && nk[1].key !== nk[2].key && nk[0].key !== nk[2].key) {
        res.labileNitrogen++;
      }
    }
    res.optical = res.chiralCenters.length > 0;
    return res;
  }

  /* ------------------------------------------------------------------ *
   * Condensed structure: CH3-CH2-OH, CH3-C(=O)-OH, (CH3)2CH-OH ...
   * ------------------------------------------------------------------ */
  function subtreeSize(g, i, blocked, depth) {
    if (depth <= 0) return 0;
    var t = 1;
    for (var v = 0; v < g.n; v++) {
      if (v !== blocked && g.adj[i * g.s + v]) t += subtreeSize(g, v, i, depth - 1);
    }
    return t;
  }

  function atomHead(g, hv, i) {
    var sym = ZSYM[g.z[i]], h = hv[i];
    if (HALO[sym]) return sym;
    if (sym === 'O' || sym === 'S' || sym === 'Se' || sym === 'Te') return h === 1 ? 'OH' : (h === 2 ? 'H2O' : sym);
    return sym + (h === 1 ? 'H' : h > 1 ? 'H' + h : '');
  }

  function renderBranch(g, hv, i, blocked, depth, inPath) {
    var subs = [], t;
    for (var v = 0; v < g.n; v++) {
      if (v === blocked) continue;
      // Atoms already written as the main chain are not substituents. A ring
      // closure is the case that matters: without this test the atom closing the
      // ring restated the whole cycle as nested brackets, so cyclobutane read as
      // CH2-CH2-CH2-CH2(CH2(CH2(CH2(CH2(...))))) instead of a four-membered ring.
      if (inPath && inPath[v]) continue;
      var o = g.adj[i * g.s + v];
      if (o) subs.push({ v: v, o: o, size: inPath[v] ? -1 : subtreeSize(g, v, i, 6) });
    }
    var head = atomHead(g, hv, i);
    if (depth <= 0 && subs.length) return head;
    /* the longest substituent continues the chain; the rest go in brackets */
    subs.sort(function (a, b) { return b.size - a.size || a.v - b.v; });
    var chain = null, rest = [];
    for (t = 0; t < subs.length; t++) {
      if (!chain && subs[t].o === 1 && subs[t].size > 0) chain = subs[t];
      else rest.push(subs[t]);
    }
    var out = head;
    for (t = 0; t < rest.length; t++) {
      var r = rest[t];
      var mark = r.o === 2 ? '=' : r.o === 3 ? '#' : '';
      if (r.v < 0) continue;
      out += '(' + mark + (mark ? atomHead(g, hv, r.v) : renderBranch(g, hv, r.v, i, depth - 1, inPath)) + ')';
    }
    if (chain) out += '-' + renderBranch(g, hv, chain.v, i, depth - 1, inPath);
    return out;
  }

  function condensed(g, hv, parent, isRing) {
    if (!parent || !parent.length) {
      var cnt = {};
      for (var i = 0; i < g.n; i++) {
        var s = ZSYM[g.z[i]];
        cnt[s] = (cnt[s] || 0) + 1;
      }
      return formulaString(cnt);
    }
    var inPath = new Int8Array(g.n), parts = [];
    for (var p = 0; p < parent.length; p++) inPath[parent[p]] = 1;
    for (p = 0; p < parent.length; p++) {
      var a = parent[p], nb = -1, order = 1;
      var prev = p > 0 ? parent[p - 1] : -1;
      if (p + 1 < parent.length) { nb = parent[p + 1]; order = g.adj[a * g.s + nb]; }
      var branchSubs = [], head = atomHead(g, hv, a);
      for (var v = 0; v < g.n; v++) {
        // Both path neighbours are written as the chain itself. Skipping only the
        // next one made every atom restate the atom before it as a branch, so
        // ethanol read as CH3-CH2(CH3)-OH(CH2(CH3)).
        if (v === a || v === nb || v === prev || !g.adj[a * g.s + v]) continue;
        if (isRing && (v === parent[0] || v === parent[parent.length - 1]) && p !== 0 && p !== parent.length - 1) continue;
        if (isRing && p === 0 && v === parent[parent.length - 1]) continue;
        if (isRing && p === parent.length - 1 && v === parent[0]) continue;
        branchSubs.push({ v: v, o: g.adj[a * g.s + v], size: inPath[v] ? -1 : subtreeSize(g, v, a, 6) });
      }
      branchSubs.sort(function (x, y) { return y.size - x.size || x.v - y.v; });
      var txt = head;
      for (var b = 0; b < branchSubs.length; b++) {
        var sb = branchSubs[b];
        var mk = sb.o === 2 ? '=' : sb.o === 3 ? '#' : '';
        txt += '(' + mk + (mk ? atomHead(g, hv, sb.v) : renderBranch(g, hv, sb.v, a, 5, inPath)) + ')';
      }
      parts.push(txt);
      if (nb >= 0) parts.push(order === 2 ? '=' : order === 3 ? '#' : '-');
    }
    var joined = parts.join('') + (isRing ? ' (ring)' : '');
    return (isRing ? 'ring: ' : '') + joined;
  }
  /* ------------------------------------------------------------------ *
   * Nomenclature.  Substitutive names for the common organic families
   * (acyclic and monocyclic).  Anything the rules do not cover (fused or
   * bridged polycyclics, exotic heterocycles) returns null and the caller
   * falls back to the condensed formula, so no wrong name is ever shown.
   * ------------------------------------------------------------------ */
  var ANS = ['', 'meth', 'eth', 'prop', 'but', 'pent', 'hex', 'hept', 'oct', 'non', 'dec',
    'undec', 'dodec', 'tridec', 'tetradec', 'pentadec'];
  var NUMPFX = ['', '', 'di', 'tri', 'tetra', 'penta', 'hexa', 'hepta', 'octa', 'nona', 'deca'];
  var CYCLO = { 3: 'cyclopropane', 4: 'cyclobutane', 5: 'cyclopentane', 6: 'cyclohexane', 7: 'cycloheptane' };
  var HETRO = {
    '3:O': 'oxirane', '3:N': 'aziridine', '3:S': 'thiirane',
    '4:O': 'oxetane', '4:N': 'azetidine', '4:S': 'thietane',
    '5:O': 'oxolane', '5:N': 'pyrrolidine', '5:S': 'thiolane',
    '6:O': 'oxane', '6:N': 'piperidine', '6:S': 'thiane',
    '5:OO': '1,3-dioxolane', '6:OO': '1,4-dioxane', '5:NN': 'imidazolidine',
    '6:NN': 'pyridazine', '6:NNN': '1,3,5-triazinane'
  };
  var AROMA = { '6:C': 'benzene', '5:N': 'pyrrole', '5:O': 'furan', '5:S': 'thiophene', '6:N': 'pyridine' };
  var HALO_PREFIX = { F: 'fluoro', Cl: 'chloro', Br: 'bromo', I: 'iodo', At: 'astato' };
  var SUFFIX = {
    'carboxylic acid': ['oic', ' acid', 100], nitrile: ['', 'nitrile', 92],
    aldehyde: ['', 'al', 88], ketone: ['one', '', 84], alcohol: ['ol', '', 78],
    phenol: ['ol', '', 78], thiol: ['thiol', '', 72], 'primary amine': ['amine', '', 68],
    'secondary amine': ['amine', '', 68], 'tertiary amine': ['amine', '', 68],
    alkene: ['ene', '', 40], alkyne: ['yne', '', 38]
  };

  function carbonOf(z) { return z === 6 || z === 14; }

  /* longest / best simple path under a scorer; capped so naming can never hang */
  function bestPath(g, budget, limit, scorer) {
    var best = null, bestScore = null, visits = 0;
    var mask = new Int8Array(g.n), path = [];
    function dfs(u) {
      if (++visits > limit || budget.out('naming')) return;
      path.push(u); mask[u] = 1;
      var sc = scorer(path);
      if (!bestScore || cmpVec(sc, bestScore) > 0) { bestScore = sc; best = path.slice(); }
      for (var v = 0; v < g.n; v++) {
        if (!mask[v] && g.adj[u * g.s + v]) dfs(v);
      }
      mask[u] = 0; path.pop();
    }
    for (var s = 0; s < g.n; s++) dfs(s);
    return best ? { path: best, score: bestScore, visits: visits } : null;
  }

  function cmpVec(a, b) {
    for (var i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
    }
    return 0;
  }

  function alkylRoot(count) { return ANS[Math.min(count, ANS.length - 1)]; }

  /* name of a branch hanging off atom v, viewed from `from` (alkyl groups,
   * alkoxy groups, acyl groups ...).  Returns { name, carbons }. */
  function branchName(g, hv, v, from, budget, limit) {
    var atoms = [], stack = [v], seen = new Int8Array(g.n);
    seen[v] = 1;
    if (from >= 0) seen[from] = 1;
    while (stack.length) {
      var u = stack.pop();
      atoms.push(u);
      if (atoms.length > limit) break;
      for (var w = 0; w < g.n; w++) {
        if (!seen[w] && g.adj[u * g.s + w]) { seen[w] = 1; stack.push(w); }
      }
    }
    return branchCore(g, hv, v, -1, atoms, budget, limit);
  }

  function branchCore(g, hv, root, parentIdx, allowed, budget, limit) {
    var isC = carbonOf(g.z[root]);
    var i;
    if (!isC) {
      /* hetero-branch: hydroxy, alkoxy, amino, sulfanyl, halogen */
      var sym = ZSYM[g.z[root]];
      if (haloSym(sym)) return { name: HALO_PREFIX[sym], hetero: true };
      if (sym === 'O') {
        if (hv[root] === 1) return { name: 'hydroxy', hetero: true };
        var sub = otherOf(g, root, parentIdx);
        if (sub < 0) return { name: 'oxo', hetero: true };
        var r = branchCore(g, hv, sub, root, subtree(g, sub, root), budget, limit);
        return { name: r.name.replace(/yl$/, '') + 'oxy', hetero: true };
      }
      if (sym === 'S') {
        if (hv[root] === 1) return { name: 'sulfanyl', hetero: true };
        var ssub = otherOf(g, root, parentIdx);
        if (ssub < 0) return { name: 'thioxo', hetero: true };
        var rs = branchCore(g, hv, ssub, root, subtree(g, ssub, root), budget, limit);
        return { name: rs.name.replace(/yl$/, '') + 'sulfanyl', hetero: true };
      }
      if (sym === 'N') {
        if (hv[root] >= 1 && singleDegree(g, root)) return { name: 'amino', hetero: true };
        var nsub = othersOf(g, root, parentIdx);
        if (!nsub.length) return { name: 'imino', hetero: true };
        var rn = branchCore(g, hv, nsub[0], root, subtree(g, nsub[0], root), budget, limit);
        return { name: 'N-' + rn.name.replace(/yl$/, 'yl') + 'amino', hetero: true };
      }
      return { name: sym.toLowerCase(), hetero: true };
    }
    /* carbon branch: longest chain from the attachment point */
    var carbons = allowed.filter(function (a) { return carbonOf(g.z[a]); });
    if (!carbons.length) return { name: 'carbon', hetero: false, carbons: 0 };
    var path = longestCarbonChain(g, root, parentIdx, carbons, budget, limit);
    var usedInChain = {}, i;
    for (i = 0; i < path.length; i++) usedInChain[path[i]] = 1;
    var pfx = [];
    /* substituents on the chain (the attachment point itself keeps locant 1) */
    for (i = 1; i < path.length; i++) {
      var atom = path[i], kids = [];
      for (var w = 0; w < g.n; w++) {
        if (w === path[i - 1] || usedInChain[w]) continue;
        if (g.adj[atom * g.s + w]) kids.push(w);
      }
      kids.sort(function (a, b) { return subtree(g, a, atom).length - subtree(g, b, atom).length; });
      for (var k = 0; k < kids.length; k++) {
        var kb = branchCore(g, hv, kids[k], atom, subtree(g, kids[k], atom), budget, limit);
        pfx.push({ loc: i + 1, name: kb.name, hetero: kb.hetero });
      }
    }
    var base = alkylRoot(path.length) + 'yl';
    var tally = {};
    pfx.sort(function (a, b) { return a.loc - b.loc || (a.name < b.name ? -1 : 1); });
    for (i = 0; i < pfx.length; i++) {
      var key = pfx[i].name;
      if (!tally[key]) tally[key] = { locs: [], hetero: pfx[i].hetero };
      tally[key].locs.push(pfx[i].loc);
    }
    var parts = [], names = Object.keys(tally).sort();
    for (i = 0; i < names.length; i++) {
      var ent = tally[names[i]];
      parts.push(ent.locs.join(',') + '-' + (NUMPFX[ent.locs.length] || '') + names[i]);
    }
    var pre = parts.length ? parts.join('-') + '-' : '';
    return { name: pre + base, hetero: false, carbons: path.length, chain: path };
  }

  function haloSym(s) { return !!HALO[s]; }

  function otherOf(g, i, exclude) {
    for (var v = 0; v < g.n; v++) if (v !== exclude && g.adj[i * g.s + v]) return v;
    return -1;
  }
  function othersOf(g, i, exclude) {
    var out = [];
    for (var v = 0; v < g.n; v++) if (v !== exclude && g.adj[i * g.s + v]) out.push(v);
    return out;
  }
  function singleDegree(g, i) {
    var d = 0, u = 0;
    for (var v = 0; v < g.n; v++) { var o = g.adj[i * g.s + v]; if (o) { d++; u += o; } }
    return d === 1 && u === 1;
  }
  function subtree(g, from, block) {
    var out = [], stack = [from], seen = new Int8Array(g.n);
    seen[from] = 1; seen[block] = 1;
    while (stack.length) {
      var u = stack.pop();
      out.push(u);
      for (var w = 0; w < g.n; w++) {
        if (!seen[w] && g.adj[u * g.s + w]) { seen[w] = 1; stack.push(w); }
      }
    }
    return out;
  }
  function longestCarbonChain(g, root, parentIdx, carbons, budget, limit) {
    var isC = {};
    for (var i = 0; i < carbons.length; i++) isC[carbons[i]] = 1;
    var best = [root];
    var mask = new Int8Array(g.n);
    mask[parentIdx >= 0 ? parentIdx : root] = 1;
    var path = [], visits = 0;
    function dfs(u) {
      if (++visits > limit || budget.out('naming')) return;
      path.push(u);
      if (path.length > best.length) best = path.slice();
      for (var v = 0; v < g.n; v++) {
        if (isC[v] && !mask[v] && g.adj[u * g.s + v]) { mask[v] = 1; dfs(v); mask[v] = 0; }
      }
      path.pop();
    }
    mask[root] = 1;
    dfs(root);
    mask[root] = 0;
    return best;
  }
  /* parent hydride with unsaturation inserted */
  function coreName(base, ene, yne, hasSuffix) {
    var total = ene.length + yne.length;
    if (!total) return hasSuffix ? base + 'an' : base + 'ane';
    var mult = (ene.length > 1 || yne.length > 1 || (ene.length && yne.length));
    var stem = mult ? base + 'a' : base;
    var loc = [];
    if (ene.length) loc.push(ene.join(',') + '-' + (ene.length > 1 ? NUMPFX[ene.length] : '') + 'ene');
    if (yne.length) loc.push(yne.join(',') + '-' + (yne.length > 1 ? NUMPFX[yne.length] : '') + 'yne');
    var core = stem + '-' + loc.join('-');
    if (hasSuffix) core = core.replace(/ene$/, 'en').replace(/yne$/, 'yn');
    return core;
  }

  function locantSet(arr) { return arr.slice().sort(function (a, b) { return a - b; }); }

  function ringKeyOf(g, ring, hv) {
    var het = [];
    for (var i = 0; i < ring.length; i++) {
      var s = ZSYM[g.z[ring[i]]];
      if (!carbonOf(g.z[ring[i]])) het.push(s === 'N' ? 'N' : s);
    }
    het.sort();
    return ring.length + ':' + het.join('');
  }

  /* esters: alkyl part + acyl part */
  function esterName(g, hv, an, budget) {
    var rec = an.principal, c = rec.atoms[0], ob = rec.atoms[2];
    if (!carbonOf(g.z[c])) return null;
    var alkyl = -1;
    for (var v = 0; v < g.n; v++) if (v !== c && g.adj[ob * g.s + v]) { alkyl = v; break; }
    if (alkyl < 0) return null;
    var alk = branchCore(g, hv, alkyl, ob, subtree(g, alkyl, ob), budget, 400);
    var acylCarbons = subtree(g, c, ob).filter(function (a) { return carbonOf(g.z[a]); });
    var chain = longestCarbonChain(g, c, ob, acylCarbons, budget, 4000);
    var ene = [], yne = [];
    for (var t = 0; t < chain.length - 1; t++) {
      var o = g.adj[chain[t] * g.s + chain[t + 1]];
      if (o === 2) ene.push(t + 1);
      if (o === 3) yne.push(t + 1);
    }
    var core = coreName(alkylRoot(chain.length), ene, yne, true);
    return alk.name.replace(/yl$/, '') + ' ' + core + 'oate';
  }

  function singleName(g, hv) {
    var sym = ZSYM[g.z[0]], h = hv[0];
    if (sym === 'C') return h === 4 ? 'methane' : h === 2 ? 'methylidene' : 'carbon (CH' + h + ')';
    if (sym === 'N') return h === 3 ? 'azane (ammonia)' : 'amine (' + h + 'H)';
    if (sym === 'O') return h === 2 ? 'oxidane (water)' : 'hydroxyl';
    if (sym === 'S') return h === 2 ? 'sulfane (hydrogen sulfide)' : 'sulfanyl';
    if (HALO[sym]) return h === 1 ? sym + 'ane' : sym;
    if (sym === 'P') return h === 3 ? 'phosphane (phosphine)' : 'phosphanyl';
    if (sym === 'Si') return h === 4 ? 'silane' : 'silyl';
    return sym + (h ? 'H' + h : '');
  }

  /* ------------------------------------------------------------------ *
   * Substitutive name for acyclic and monocyclic structures.
   * ------------------------------------------------------------------ */
  function suffixKindOf(type) {
    if (type === 'carboxylic acid') return 'acid';
    if (type === 'nitrile') return 'nitrile';
    if (type === 'aldehyde') return 'al';
    if (type === 'ketone') return 'one';
    if (type === 'alcohol' || type === 'phenol') return 'ol';
    if (type === 'thiol') return 'thiol';
    if (/amine$/.test(type)) return 'amine';
    return null;
  }

  function anchorOf(g, rec) {
    var a0 = rec.atoms[0];
    if (carbonOf(g.z[a0])) return a0;
    var bestC = -1;
    for (var v = 0; v < g.n; v++) {
      if (g.adj[a0 * g.s + v] && carbonOf(g.z[v])) {
        if (bestC < 0 || ZVAL[g.z[v]] - usedOf(g, v) >= ZVAL[g.z[bestC]] - usedOf(g, bestC)) bestC = v;
      }
    }
    return bestC;
  }

  function usedOf(g, i) {
    var t = 0;
    for (var v = 0; v < g.n; v++) t += g.adj[i * g.s + v];
    return t;
  }

  function recordsOfType(an, type) {
    var out = [];
    for (var i = 0; i < an.records.length; i++) if (an.records[i].type === type) out.push(an.records[i]);
    return out;
  }

  function multiply(list, text) {
    return (list.length > 1 ? NUMPFX[list.length] : '') + text;
  }

  // The substitutive name comes first from the organic namer that ships beside this
  // engine (assets/organic-names.js): it works the bond graph with the full
  // priority ladder, so ethanol and methoxymethane get two different, correct
  // names. This file's own builder below is the fallback for the graphs that namer
  // refuses - the heterocycles and fused rings outside its scope - and it never
  // names inorganic structures, which singleName keeps doing.
  function externalName(g, hv, budget) {
    var namer = (typeof window !== 'undefined' && window.__organicNames) || null;
    if (!namer || typeof namer.nameFromGraph !== 'function') return null;
    if (budget.out('naming')) return null;
    var nodes = [], edges = [], i, j;
    var hid = g.n;
    for (i = 0; i < g.n; i++) {
      nodes.push({ id: i, sym: ZSYM[g.z[i]] });
      for (j = 0; j < hv[i]; j++) {
        hid++;
        nodes.push({ id: hid, sym: 'H' });
        edges.push([i, hid, 1]);
      }
    }
    for (i = 0; i < g.n; i++) {
      for (j = i + 1; j < g.n; j++) {
        var o = g.adj[i * g.s + j];
        if (o) edges.push([i, j, o]);
      }
    }
    var r = null;
    try {
      r = namer.nameFromGraph(nodes, edges);
    } catch (err) {
      return null;
    }
    return r && typeof r.name === 'string' && r.name ? r.name : null;
  }

  // One list, one capital: the app shows every molecule name with a leading upper
  // case letter, whichever engine produced the string.
  function capFirst(s) {
    return typeof s === 'string' && s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }

  function nameIsomer(g, hv, an, budget) {
    if (budget.out('naming')) return null;
    var ri = an.ri, n = g.n, i, j;
    if (n === 1) return singleName(g, hv);
    if (ri.count > 1) return null;
    if (an.principal && an.principal.type === 'ester') return esterName(g, hv, an, budget);

    var pr = an.principal;
    var kind = pr ? suffixKindOf(pr.type) : null;
    var anchors = [], consumed = {};
    if (pr) {
      var recs = recordsOfType(an, pr.type);
      for (i = 0; i < recs.length; i++) {
        var anc = anchorOf(g, recs[i]);
        if (anc < 0) return null;
        anchors.push({ atom: anc, rec: recs[i] });
        for (j = 0; j < recs[i].atoms.length; j++) {
          var ra = recs[i].atoms[j];
          if (ra !== anc && !carbonOf(g.z[ra])) consumed[ra] = 1;
        }
      }
    }

    var isRing = ri.count === 1 && !!an.ring && ri.sizes[0] >= 3 && ri.sizes[0] <= 7;
    var parent = null;
    if (isRing) parent = an.ring.slice();
    else if (ri.count === 0) {
      var needAtoms = anchors.map(function (a) { return a.atom; });
      var scored = bestPath(g, budget, 9000, function (p) {
        var set = {}, t, covers = 0, carbons = 0, het = 0, unsat = 0;
        for (t = 0; t < p.length; t++) set[p[t]] = 1;
        for (t = 0; t < needAtoms.length; t++) if (set[needAtoms[t]]) covers++;
        for (t = 0; t < p.length; t++) {
          if (carbonOf(g.z[p[t]])) carbons++; else if (!consumed[p[t]]) het++;
        }
        for (t = 0; t < p.length - 1; t++) if (g.adj[p[t] * g.s + p[t + 1]] > 1) unsat++;
        return [covers === needAtoms.length ? 1 : 0, covers, carbons, -het, p.length, unsat];
      });
      if (!scored) return null;
      parent = scored.path;
    } else return null;
    if (!parent.length) return null;

    var inParent = {};
    for (i = 0; i < parent.length; i++) inParent[parent[i]] = 1;

    /* ring-attached -COOH / -CHO / -CN: the carbon stays outside the ring and
     * the suffix becomes carboxylic acid / carbaldehyde / carbonitrile */
    var ringExtra = null;
    if (isRing) {
      for (i = 0; i < anchors.length; i++) {
        if (inParent[anchors[i].atom]) continue;
        var kk = kind;
        if (kk === 'acid') ringExtra = 'carboxylic acid';
        else if (kk === 'al') ringExtra = 'carbaldehyde';
        else if (kk === 'nitrile') ringExtra = 'carbonitrile';
        else if (kk === 'one' || kk === 'ol') return null;
        else return null;
        consumed[anchors[i].atom] = 1;
        for (j = 0; j < anchors[i].rec.atoms.length; j++) consumed[anchors[i].rec.atoms[j]] = 1;
        anchors.splice(i, 1); i--;
      }
    } else {
      for (i = 0; i < anchors.length; i++) if (!inParent[anchors[i].atom]) return null;
    }

    /* substituents on the parent */
    var prefixes = [];
    for (i = 0; i < parent.length; i++) {
      var a = parent[i];
      for (j = 0; j < g.n; j++) {
        if (!g.adj[a * g.s + j] || inParent[j] || consumed[j]) continue;
        var bn = branchCore(g, hv, j, a, subtree(g, j, a), budget, 900);
        if (!bn.name) return null;
        prefixes.push({ atom: a, tag: null, name: bn.name });
      }
    }
    /* groups that hang off a consumed heteroatom (N-methyl, O-acetyl ...) */
    var ck = Object.keys(consumed);
    for (i = 0; i < ck.length; i++) {
      var ca = +ck[i];
      if (inParent[ca]) continue;
      var host = -1;
      for (j = 0; j < g.n; j++) if (g.adj[ca * g.s + j] && inParent[j]) { host = j; break; }
      if (host < 0) continue;
      var tag = g.z[ca] === 7 ? 'N' : (g.z[ca] === 8 || g.z[ca] === 16) ? 'O' : (g.z[ca] === 15 ? 'P' : null);
      if (!tag) continue;
      for (j = 0; j < g.n; j++) {
        if (!g.adj[ca * g.s + j] || inParent[j] || consumed[j]) continue;
        var b2 = branchCore(g, hv, j, ca, subtree(g, j, ca), budget, 900);
        if (!b2.name) return null;
        prefixes.push({ atom: host, tag: tag, name: b2.name });
      }
    }

    /* unsaturation inside the parent */
    var unsatRecs = [];
    for (i = 0; i < an.records.length; i++) {
      var r = an.records[i];
      if ((r.type === 'alkene' || r.type === 'alkyne') && inParent[r.atoms[0]] && inParent[r.atoms[1]]) {
        unsatRecs.push(r);
      }
    }

    /* numbering: every orientation, lowest locant set wins */
    var orientations = [];
    if (isRing) {
      for (i = 0; i < parent.length; i++) {
        orientations.push(rotate(parent, i, 1));
        orientations.push(rotate(parent, i, -1));
      }
    } else {
      orientations.push(parent.slice());
      orientations.push(parent.slice().reverse());
    }
    var pick = null;
    for (i = 0; i < orientations.length; i++) {
      if (budget.out('numbering')) return null;
      var or = orientations[i], map = {}, t;
      for (t = 0; t < or.length; t++) map[or[t]] = t + 1;
      var sl = [], ok = true;
      for (t = 0; t < anchors.length; t++) {
        if (map[anchors[t].atom] === undefined) { ok = false; break; }
        sl.push(map[anchors[t].atom]);
      }
      if (!ok) continue;
      sl.sort(function (x, y) { return x - y; });
      var ul = [];
      for (t = 0; t < unsatRecs.length; t++) {
        ul.push(Math.min(map[unsatRecs[t].atoms[0]], map[unsatRecs[t].atoms[1]]));
      }
      ul.sort(function (x, y) { return x - y; });
      var pf = [];
      for (t = 0; t < prefixes.length; t++) {
        var pre = prefixes[t];
        if (map[pre.atom] === undefined) continue;
        pf.push({ loc: pre.tag ? pre.tag + '-' : '' + map[pre.atom], name: pre.name, sortKey: pre.name });
      }
      pf.sort(function (x, y) {
        var nx = x.sortKey.replace(/^[0-9,\-]+/, ''), ny = y.sortKey.replace(/^[0-9,\-]+/, '');
        if (nx !== ny) return nx < ny ? -1 : 1;
        return x.sortKey < y.sortKey ? -1 : x.sortKey > y.sortKey ? 1 : 0;
      });
      var heteroRing = 0;
      if (isRing) for (t = 0; t < or.length; t++) if (!carbonOf(g.z[or[t]])) heteroRing++;
      var score = [
        heteroRing ? locOfHetero(or, g) : 0,
        sl.length ? maxNum(sl) : 0, sumOf(sl),
        ul.length ? minOf(ul) : 0, sumOf(ul),
        sumOf(numericLocs(pf)), joinOf(numericLocs(pf))
      ];
      if (!pick || cmpVec2(score, pick.score) < 0) {
        pick = { score: score, or: or, map: map, suffixLocs: sl, unsatLocs: ul, prefixes: pf };
      }
    }
    if (!pick) return null;

    /* ---- assemble the name ---- */
    var grouped = {}, order = [];
    for (i = 0; i < pick.prefixes.length; i++) {
      var pp = pick.prefixes[i];
      var bare = pp.name.replace(/^[0-9,\-]+/, '');
      var locTxt = pp.loc === '0' || pp.loc === '' ? bare : pp.name;
      var id = pp.loc.slice(-1) === '-' ? pp.loc + bare : pp.name;
      var gk = (pp.loc.match(/^[A-Z]-/) ? pp.loc : '') + bare + (pp.loc.match(/^[A-Z]-/) ? '' : '');
      if (!grouped[bare + '|' + (pp.loc.match(/^[A-Z]-/) ? pp.loc : '')]) {
        grouped[bare + '|' + (pp.loc.match(/^[A-Z]-/) ? pp.loc : '')] = { locs: [], tag: pp.loc.match(/^[A-Z]-/) ? pp.loc : '', name: bare };
      }
      grouped[bare + '|' + (pp.loc.match(/^[A-Z]-/) ? pp.loc : '')].locs.push(pp.loc.replace(/^[A-Z]-/, ''));
    }
    var gkeys = Object.keys(grouped);
    gkeys.sort(function (x, y) {
      var a1 = grouped[x], a2 = grouped[y];
      if (a1.name !== a2.name) return a1.name < a2.name ? -1 : 1;
      return x < y ? -1 : 1;
    });
    var pre = [];
    for (i = 0; i < gkeys.length; i++) {
      var ent = grouped[gkeys[i]];
      pre.push(ent.tag + ent.locs.join(',') + '-' + multiply(ent.locs, ent.name));
    }
    var preTxt = pre.length ? pre.join('-') + '-' : '';

    var head, suffixTxt = '';
    var carbCount = 0;
    for (i = 0; i < pick.or.length; i++) if (carbonOf(g.z[pick.or[i]])) carbCount++;
    var ene = [], yne = [];
    for (i = 0; i < unsatRecs.length; i++) {
      var loc = Math.min(pick.map[unsatRecs[i].atoms[0]], pick.map[unsatRecs[i].atoms[1]]);
      if (g.adj[unsatRecs[i].atoms[0] * g.s + unsatRecs[i].atoms[1]] === 3) yne.push(loc); else ene.push(loc);
    }
    ene.sort(function (x, y) { return x - y; });
    yne.sort(function (x, y) { return x - y; });
    var sl = pick.suffixLocs;
    var keepE = sl.length > 1;
    if (isRing) {
      var rk = ringKeyOf(g, pick.or, hv);
      // CYCLO is a carbocycle table. Reaching for it when the ring is not all
      // carbon named 1,3-dioxetane "cyclobutane", so an unmapped heterocycle is
      // left unnamed and shown as its formula instead.
      var carbRing = carbCount === pick.or.length;
      var base = an.aromatic ? (AROMA[rk] || (ri.sizes[0] === 6 && carbRing ? 'benzene' : null))
        : (HETRO[rk] || (carbRing ? CYCLO[ri.sizes[0]] : null) || null);
      if (!base) return null;
      if (an.aromatic) {
        head = base;
        if (ringExtra) head = base.replace(/e$/, '') + ringExtra;
        else if (kind === 'ol' && ri.sizes[0] === 6 && !carbCount && pick.prefixes.length === 0 && sl.length === 1) head = 'phenol';
        else if (kind && sl.length) {
          var st = suffixTextOf(kind);
          if (st) head = base + '-' + sl.join(',') + '-' + multiply(sl, st);
        }
      } else {
        var hyd = base.replace(/ane$/, '').replace(/e$/, '');
        var anForm = base.replace(/e$/, '');
        var hasUnsat = ene.length || yne.length;
        if (hasUnsat && !/ane$/.test(base)) return null;   /* unsure heterocycle unsaturation */
        head = hasUnsat ? base.replace(/ane$/, '') + '-' + ene.concat(yne).join(',') + '-' +
          multiply(ene.concat(yne), ene.length && yne.length ? 'en-yne' : (yne.length ? 'yne' : 'ene'))
          : anForm;
        if (ringExtra) head = (hasUnsat ? head : anForm) + ringExtra;
        else if (kind) {
          var st2 = suffixTextOf(kind);
          if (st2) head = head + (sl.length ? '-' + sl.join(',') : '') + '-' + multiply(sl, st2);
          else if (!hasUnsat) head = base;
        } else if (!hasUnsat) head = base;
        if (keepE && kind) head = head;
      }
    } else {
      var stem = alkylRoot(carbCount);
      if (!stem) return null;
      if (kind === 'acid') head = coreName(stem, ene, yne, true) + 'oic acid';
      else if (kind === 'al') head = coreName(stem, ene, yne, true) + 'al';
      else if (kind === 'nitrile') head = coreName(stem, ene, yne, true) + (ene.length || yne.length ? '' : 'e') + 'nitrile';
      else if (kind) head = coreName(stem, ene, yne, true) + (sl.length ? '-' + sl.join(',') : '') + '-' + multiply(sl, suffixTextOf(kind));
      else head = coreName(stem, ene, yne, false);
    }
    if (ringExtra && !isRing) return null;
    if (kind === 'acid' || kind === 'al' || kind === 'nitrile') {
      /* locants are implied by the suffix carbon itself */
    }
    var full = (preTxt + head).replace(/--+/g, '-');
    if (!/[a-z]/.test(full)) return null;
    return full;
  }

  function suffixTextOf(kind) {
    if (kind === 'one') return 'one';
    if (kind === 'ol') return 'ol';
    if (kind === 'thiol') return 'thiol';
    if (kind === 'amine') return 'amine';
    return '';
  }

  function numericLocs(pf) {
    var out = [];
    for (var i = 0; i < pf.length; i++) {
      var v = parseInt(pf[i].loc, 10);
      if (!isNaN(v)) out.push(v);
    }
    out.sort(function (a, b) { return a - b; });
    return out;
  }
  function sumOf(a) { var t = 0; for (var i = 0; i < a.length; i++) t += a[i]; return t; }
  function maxNum(a) { var m = 0; for (var i = 0; i < a.length; i++) m = Math.max(m, a[i]); return m; }
  function minOf(a) { var m = 999; for (var i = 0; i < a.length; i++) m = Math.min(m, a[i]); return m; }
  function joinOf(a) { return a.join(','); }
  function locOfHetero(or, g) {
    for (var i = 0; i < or.length; i++) if (!carbonOf(g.z[or[i]])) return i + 1;
    return 0;
  }

  function rotate(arr, start, dir) {
    var out = [], n = arr.length;
    for (var i = 0; i < n; i++) {
      out.push(dir > 0 ? arr[(start + i) % n] : arr[(start - i + n) % n]);
    }
    return out;
  }

  function cmpVec2(a, b) {
    for (var i = 0; i < a.length; i++) {
      var x = typeof a[i] === 'number' ? a[i] : 0, y = typeof b[i] === 'number' ? b[i] : 0;
      if (x !== y) return x < y ? -1 : 1;
      if (a[i] !== b[i]) return String(a[i]) < String(b[i]) ? -1 : 1;
    }
    return 0;
  }
  function sumLoc(a) { var t = 0; for (var i = 0; i < a.length; i++) t += a[i]; return t; }
  function maxLoc(a) { var m = 0; for (var i = 0; i < a.length; i++) m = Math.max(m, a[i]); return m; }
  function minLoc(a) { var m = 999; for (var i = 0; i < a.length; i++) m = Math.min(m, a[i]); return m; }
  function joinLoc(a) { return a.join(','); }
  function countsOf(g, hv) {
    var c = {}, i;
    for (i = 0; i < g.n; i++) {
      var s = ZSYM[g.z[i]];
      c[s] = (c[s] || 0) + 1;
    }
    var h = 0;
    for (i = 0; i < g.n; i++) h += hv[i];
    if (h) c.H = (c.H || 0) + h;
    return c;
  }

  /* 1,3 and 1,2 hydrogen shifts expressed purely as bond-order changes, so the
   * formula and the heavy skeleton are preserved by construction */
  function tautomerMoves(g, opts) {
    var out = [], n = g.n, i, j, k;
    function hvAt(a) { return ZVAL[g.z[a]] - usedOf(g, a); }
    // Prototropy needs a heteroatom at one end of the shift. Without this test a
    // 1,3-H walk along a hydrocarbon turned but-1-ene into a "tautomer" of
    // but-2-ene, when that pair is position isomerism and nothing tautomerises.
    function het(a) { return g.z[a] !== 1 && ZSYM[g.z[a]] !== 'C'; }
    for (i = 0; i < n; i++) {
      for (j = 0; j < n; j++) {
        var o = g.adj[i * g.s + j];
        if (!o) continue;
        if (o >= 2 && hvAt(j) >= 1 && (het(i) || het(j))) {
          /* 1,2 shift: H from j to i, bond order down */
          var a = new Graph(n, g.z, g.adj.slice(), n);
          a.put(i, j, o - 1);
          if (bondAllowed(g.z[i], g.z[j], o - 1, opts) || o - 1 === 1) out.push(a);
        }
        for (k = 0; k < n; k++) {
          if (k === i || k === j) continue;
          var o2 = g.adj[j * g.s + k];
          if (o2 < 2) continue;
          if (hvAt(i) < 1) continue;
          if (!het(i) && !het(k)) continue;
          var b = new Graph(n, g.z, g.adj.slice(), n);
          b.put(i, j, o + 1); b.put(j, k, o2 - 1);
          if (o + 1 > 3) continue;
          if (!bondAllowed(g.z[i], g.z[j], o + 1, opts)) continue;
          out.push(b);
        }
      }
    }
    return out;
  }

  /* --------------------- cross-isomer relationship classes -------------- */
  function assignClasses(items, opts, stats, budget, cut) {
    var i, j, k;
    var bySkeleton = {}, bySignature = {}, allSig = {}, allSkel = {};
    for (i = 0; i < items.length; i++) {
      var it = items[i];
      (bySkeleton[it.skeleton] || (bySkeleton[it.skeleton] = [])).push(it);
      (bySignature[it.groupSignature] || (bySignature[it.groupSignature] = [])).push(it);
      allSig[it.groupSignature] = 1;
      allSkel[it.skeleton] = 1;
    }
    /* tautomers first, so the class is not swallowed by "position" */
    var tautoPairs = 0;
    if (opts.tautomers !== false && !cut) {
      var keySet = {};
      for (i = 0; i < items.length; i++) keySet[items[i].key] = items[i];
      for (i = 0; i < items.length; i++) {
        if (budget.out('tautomer linking')) {
          stats.tautomerPassIncomplete = true;
          cut = true;
          break;
        }
        var src = items[i], moves = tautomerMoves(src.graphRef, opts);
        for (j = 0; j < moves.length; j++) {
          var c = canonicalOf(moves[j], budget);
          if (c.partial) { stats.canonIncomplete = true; continue; }
          var partner = keySet[c.key];
          if (partner && partner !== src) {
            if (src.tautomerOf.indexOf(partner.key) < 0) src.tautomerOf.push(partner.key);
            if (partner.tautomerOf.indexOf(src.key) < 0) partner.tautomerOf.push(src.key);
            tautoPairs++;
          }
        }
      }
    }
    stats.tautomerPairs = tautoPairs;
    var hasOpenChain = false, hasCyclic = false;
    for (i = 0; i < items.length; i++) {
      if (items[i].ringCount > 0) hasCyclic = true; else hasOpenChain = true;
    }
    var pairWork = 0;
    for (i = 0; i < items.length; i++) {
      var a = items[i], cls = {};
      if (a.tautomerOf.length) cls.tautomer = 1;
      if (a.geometric) cls.geometric = 1;
      if (a.chiralCenters.length || a.optical) cls.optical = 1;
      if (hasCyclic && hasOpenChain && a.ringCount > 0) cls.ring = 1;
      if (hasCyclic && hasOpenChain && a.ringCount === 0) cls.ring = 1;
      var sameSkel = bySkeleton[a.skeleton] || [];
      for (j = 0; j < sameSkel.length; j++) {
        if (sameSkel[j] === a) continue;
        if (sameSkel[j].groupSignature === a.groupSignature) {
          if (!sameSkel[j].tautomerOf.length || a.tautomerOf.indexOf(sameSkel[j].key) < 0) cls.position = 1;
        }
      }
      for (var s in allSig) if (s !== a.groupSignature) cls.functional = 1;
      /* chain classification is the only quadratic pass: give it a work counter
       * so a huge list cannot turn the tail of a call into a freeze */
      if (!cut) {
        for (k = 0; k < items.length; k++) {
          var b = items[k];
          if (b === a || b.skeleton === a.skeleton) continue;
          if (b.groupSignature === a.groupSignature && b.ringCount === a.ringCount) cls.chain = 1;
          if (++pairWork % 8192 === 0 && budget.out('classifying')) {
            cut = true;
            stats.classPassIncomplete = true;
            break;
          }
        }
      }
      a.classes = TAXONOMY.filter(function (t) { return !!cls[t]; });
      stats.classCounts[a.classes.join('+') || 'none'] = (stats.classCounts[a.classes.join('+') || 'none'] || 0) + 1;
    }
    for (i = 0; i < items.length; i++) {
      var sg = items[i].groupSignature || 'unclassified';
      stats.families[sg] = (stats.families[sg] || 0) + 1;
      var gl = items[i].functionalGroups;
      for (j = 0; j < gl.length; j++) stats.groupCounts[gl[j]] = (stats.groupCounts[gl[j]] || 0) + 1;
    }
    return cut;
  }

  /* ------------------------------------------------------------------ *
   * Turn raw enumerated graphs into the reported isomer records.
   * ------------------------------------------------------------------ */
  function finalize(out, ctx, stats, listCap, options, enrichMs) {
    var found = ctx.found, i, j;
    found.sort(function (a, b) { return a.key === b.key ? 0 : (a.key < b.key ? -1 : 1); });
    /* enrichment (groups, stereo, names, classes) gets its own wall clock so a
     * truncated search can still label what it confirmed - and so no call ever
     * runs past the search deadline + this allowance */
    var budget = new Budget(num(enrichMs, LIMITS.ENRICH_MS, 20, 20000), 1e12, LIMITS.CANON_CAP);
    var items = [], cheap = false, NO_STEREO = {
      geometric: false, optical: false, chiralCenters: [], doubleBonds: [], labileNitrogen: 0
    };
    for (i = 0; i < found.length; i++) {
      if (!cheap && budget.out('enriching')) {
        cheap = true;
        stats.enrichStopped = true;
        out.truncated = true;
        out.complete = false;
        out.reason = (out.reason ? out.reason + '; ' : '') + budget.exceeded +
          ' - enrichment stopped, later isomers carry condensed formulas instead of names';
      }
      var f = found[i], g = f.g, hv = g.hydrogens();
      var ri = ringInfo(g);
      var an = detectGroups(g, hv, ri, budget);
      var flags = { incomplete: false };
      var st = (cheap || options.stereo === false)
        ? NO_STEREO
        : stereoOf(g, hv, ri, budget, flags);
      var sk = cheap ? { key: '', ord: null } : skeletonKey(g, budget);
      var ord = f.ord || [], counter = {}, idOf = {}, nodes = [], edges = [];
      for (j = 0; j < g.n; j++) {
        var atom = ord[j], sym = ZSYM[g.z[atom]];
        counter[sym] = (counter[sym] || 0) + 1;
        var id = sym + counter[sym];
        idOf[atom] = id;
        nodes.push({ id: id, el: sym, index: j + 1, h: hv[atom], elZ: g.z[atom] });
      }
      for (j = 0; j < g.n; j++) {
        for (var p = j + 1; p < g.n; p++) {
          var o = g.adj[ord[j] * g.s + ord[p]];
          if (o) edges.push({ a: idOf[ord[j]], b: idOf[ord[p]], order: o, ia: j + 1, ib: p + 1 });
        }
      }
      var dbl = false, trip = false;
      for (j = 0; j < edges.length; j++) {
        if (edges[j].order === 2) dbl = true;
        if (edges[j].order === 3) trip = true;
      }
      var chir = st.chiralCenters.length
        ? st.chiralCenters.map(function (a2) { return idOf[a2]; })
        : [];
      var parent = null, isRingName = false;
      if (ri.count === 1 && an.ring) { parent = an.ring.slice(); isRingName = true; }
      else if (ri.count === 0) {
        var bp = bestPath(g, budget, cheap ? 300 : 4000, function (q) {
          var c = 0;
          for (var t = 0; t < q.length; t++) if (carbonOf(g.z[q[t]])) c++;
          return [c, q.length];
        });
        if (bp) parent = bp.path;
      }
      var cond = condensed(g, hv, parent, isRingName);
      var fullFormula = formulaString(countsOf(g, hv));
      var nm = (cheap || options.name === false) ? null : capFirst(
        externalName(g, hv, budget) || nameIsomer(g, hv, an, budget));
      if (flags.incomplete && !stats.stereoIncomplete) {
        stats.stereoIncomplete = true;
        out.complete = false;
        out.reason = (out.reason ? out.reason + '; ' : '') +
          'stereo analysis ran out of budget, so geometric/chiral flags are only partly reliable';
      }
      stats.labileNitrogen = (stats.labileNitrogen || 0) + st.labileNitrogen;
      items.push({
        key: f.key,
        formula: formulaString(countsOf(g, hv)),
        graph: { nodes: nodes, edges: edges },
        displayName: nm || fullFormula,
        named: !!nm,
        condensed: cond,
        classes: [],
        functionalGroups: an.labels,
        ringCount: ri.count,
        ringSizes: ri.sizes,
        hasDoubleBond: dbl,
        hasTripleBond: trip,
        chiralCenters: chir,
        geometric: st.geometric,
        geometricBonds: st.doubleBonds.map(function (d) { return { a: idOf[d.a], b: idOf[d.b] }; }),
        optical: !!st.optical,
        aromatic: !!an.aromatic,
        skeleton: sk.key,
        groupSignature: an.signature,
        tautomerOf: [],
        canonical: true,
        graphRef: g,
        hvRef: hv,
        budgetRef: budget
      });
      if (items.length >= 5000) break;
    }
    if (assignClasses(items, options, stats, budget, cheap)) {
      out.complete = false;
      out.reason = (out.reason ? out.reason + '; ' : '') +
        'enrichment budget exceeded while relating isomers to each other, so tautomer/chain/position classes are only partly assigned';
    }
    stats.enumerated = items.length;
    stats.named = items.filter(function (x) { return x.named; }).length;
    stats.geometric = items.filter(function (x) { return x.geometric; }).length;
    stats.optical = items.filter(function (x) { return x.chiralCenters.length > 0; }).length;
    /* found[] stays in key order so the enumeration itself is deterministic, but
     * the truncation has to keep the entries a player can act on: an aromatic ring
     * or a real name beats a 40th copy of "C6H6". Without this benzene sorted last
     * of 217 C6H6 isomers and vanished from a capped list. Key order is preserved
     * inside each rank, so the same input still gives the same output. */
    items.sort(function (x, y) {
      return (y.aromatic ? 1 : 0) - (x.aromatic ? 1 : 0) ||
        (y.named ? 1 : 0) - (x.named ? 1 : 0);
    });
    var keep = items.slice(0, listCap);
    for (i = 0; i < items.length; i++) {
      delete items[i].graphRef; delete items[i].hvRef; delete items[i].budgetRef;
    }
    out.items = keep;
    if (items.length > keep.length) {
      out.truncated = true;
      out.complete = false;
      out.reason = (out.reason ? out.reason + '; ' : '') +
        'list capped at ' + listCap + ' of ' + items.length + ' enumerated isomers';
    }
    stats.items = keep.length;
    return out;
  }
  /* ------------------------------------------------------------------ *
   * Graph spec -> internal graph.  Accepts {nodes:[{id,el}],edges:[{a,b,
   * order}]} with a/b as ids or 1-based indices, or the sandbox scene
   * shape through fromScene().  Hydrogens must stay implicit.
   * ------------------------------------------------------------------ */
  function graphToInternal(spec, options) {
    options = options || {};
    var res = { ok: false, error: null, g: null, hv: null };
    if (!spec || !spec.nodes || !spec.edges) { res.error = 'graph needs nodes and edges'; return res; }
    var ids = [], z = [], pos = [], i, j;
    for (i = 0; i < spec.nodes.length; i++) {
      var nd = spec.nodes[i];
      var sym = typeof nd.el === 'string' ? nd.el : (nd.el && nd.el.symbol) || nd.symbol;
      if (!sym) { res.error = 'node ' + i + ' has no element'; return res; }
      if (!(sym in VAL)) { res.error = 'unknown element ' + sym; return res; }
      if (sym === 'H' && !options.keepHydrogens) { res.error = 'hydrogens must be implicit (node ' + nd.id + ')'; return res; }
      if (VAL[sym] === 0) { res.error = 'element ' + sym + ' is not bondable'; return res; }
      ids.push(String(nd.id === undefined ? i : nd.id));
      z.push(ZOF[sym]);
      pos.push(nd.pos || null);
    }
    var n = ids.length;
    if (!n) { res.error = 'no atoms'; return res; }
    if (n > LIMITS.HARD_HEAVY_ATOMS) { res.error = 'too many atoms (' + n + ')'; return res; }
    var indexOf = {};
    for (i = 0; i < n; i++) indexOf[ids[i]] = i;
    var adj = new Int8Array(n * n), seenEdge = {};
    for (i = 0; i < spec.edges.length; i++) {
      var ed = spec.edges[i];
      var a = typeof ed.a === 'number' ? (indexOf[String(ed.a)] === undefined ? (ed.a >= n ? -1 : ed.a) : indexOf[String(ed.a)]) : indexOf[String(ed.a)];
      var b = typeof ed.b === 'number' ? (indexOf[String(ed.b)] === undefined ? (ed.b >= n ? -1 : ed.b) : indexOf[String(ed.b)]) : indexOf[String(ed.b)];
      if (a === undefined || b === undefined || a < 0 || b < 0 || a >= n || b >= n) { res.error = 'edge ' + i + ' refers to an unknown atom'; return res; }
      if (a === b) { res.error = 'edge ' + i + ' is a self loop'; return res; }
      var ord = ed.order === undefined ? 1 : ed.order;
      if (!(ord >= 1 && ord <= 3)) { res.error = 'edge ' + i + ' has an invalid order'; return res; }
      var ek = Math.min(a, b) + ':' + Math.max(a, b);
      if (seenEdge[ek]) { res.error = 'duplicate edge ' + ek; return res; }
      seenEdge[ek] = 1;
      adj[a * n + b] = ord; adj[b * n + a] = ord;
    }
    for (i = 0; i < n; i++) {
      var u = usedOf({ n: n, s: n, adj: adj, z: z }, i);
      if (u > ZVAL[z[i]]) { res.error = ZSYM[z[i]] + (ids[i] !== undefined ? ' ' + ids[i] : '') + ' exceeds its valence (' + u + '/' + ZVAL[z[i]] + ')'; return res; }
      if (u === 0 && n > 1) { res.error = 'atom ' + ids[i] + ' is disconnected'; return res; }
    }
    var rg = new Graph(n, z, adj, n);
    if (n > 1) {
      var reach = new Int8Array(n), q = [0];
      reach[0] = 1;
      for (var head = 0; head < q.length; head++) {
        for (j = 0; j < n; j++) if (rg.adj[q[head] * n + j] && !reach[j]) { reach[j] = 1; q.push(j); }
      }
      for (i = 0; i < n; i++) if (!reach[i]) { res.error = 'structure is not a single connected molecule'; return res; }
    }
    var hasPos = true;
    for (i = 0; i < n; i++) if (!pos[i]) { hasPos = false; break; }
    rg.pos = hasPos ? pos : null;
    res.ok = true;
    res.g = rg;
    res.hv = rg.hydrogens();
    res.ids = ids;
    return res;
  }

  /* signed volume of four ligands (priority order 1,2,3,4) -> R/S */
  function centerDescriptor(c, p1, p2, p3, p4) {
    function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
    function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
    function cross(a, b) {
      return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    }
    var v1 = sub(p1, p4), v2 = sub(p2, p4), v3 = sub(p3, p4);
    var s = dot(v1, cross(v2, v3));
    if (!isFinite(s) || Math.abs(s) < 1e-9) return null;
    return s > 0 ? 'R' : 'S';
  }

  /* same side / opposite side across a double bond -> Z / E */
  function bondDescriptor(pa, pb, la, lb) {
    function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
    function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
    function cross(a, b) {
      return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    }
    var axis = sub(pb, pa);
    var s = dot(cross(axis, sub(la, pa)), cross(axis, sub(lb, pa)));
    if (!isFinite(s) || Math.abs(s) < 1e-9) return null;
    return s > 0 ? 'Z' : 'E';
  }

  /* stereo fingerprint: identical topologies with different 3D arrangement
   * differ here, which is what makes geometric / optical relations visible */
  function stereoFingerprint(g, hv, budget) {
    var fp = { centers: [], bonds: [], any: false };
    if (!g.pos) return fp;
    var ri = ringInfo(g), flags = { incomplete: false };
    var st = stereoOf(g, hv, ri, budget, flags);
    var i, j;
    for (i = 0; i < st.chiralCenters.length; i++) {
      var c = st.chiralCenters[i];
      var keys = branchKeys(g, hv, c, budget);
      var lig = keys.map(function (k) { return k.v; });
      if (hv[c] === 1) {
        /* the implicit hydrogen is the lowest priority ligand: use a point
         * opposite to the sum of the three heavy ligand vectors */
        var p0 = g.pos[c], sx = 0, sy = 0, sz = 0;
        for (j = 0; j < lig.length; j++) {
          sx += g.pos[lig[j]][0] - p0[0]; sy += g.pos[lig[j]][1] - p0[1]; sz += g.pos[lig[j]][2] - p0[2];
        }
        lig = lig.slice();
        g.pos[c + '_h'] = [p0[0] - sx, p0[1] - sy, p0[2] - sz];
        var desc = centerDescriptor(p0, g.pos[lig[2]], g.pos[lig[1]], g.pos[lig[0]], g.pos[c + '_h']);
        if (desc) { fp.centers.push({ atom: c, value: desc }); fp.any = true; }
        delete g.pos[c + '_h'];
      } else if (lig.length === 4) {
        var d2 = centerDescriptor(g.pos[c], g.pos[lig[3]], g.pos[lig[2]], g.pos[lig[1]], g.pos[lig[0]]);
        if (d2) { fp.centers.push({ atom: c, value: d2 }); fp.any = true; }
      }
    }
    for (i = 0; i < st.doubleBonds.length; i++) {
      var db = st.doubleBonds[i];
      var la = -1, lb = -1;
      for (j = 0; j < g.n; j++) {
        if (j !== db.b && g.adj[db.a * g.s + j]) la = la < 0 ? j : la;
        if (j !== db.a && g.adj[db.b * g.s + j]) lb = lb < 0 ? j : lb;
      }
      if (la < 0 || lb < 0) continue;
      var dv = bondDescriptor(g.pos[db.a], g.pos[db.b], g.pos[la], g.pos[lb]);
      if (dv) { fp.bonds.push({ a: db.a, b: db.b, value: dv }); fp.any = true; }
    }
    return fp;
  }

  function compare(formula, graphA, graphB) {
    var out = { same: false, relation: 'invalid', detail: null };
    var optsA = {}, optsB = {};
    var A = graphToInternal(graphA, optsA), B = graphToInternal(graphB, optsB);
    if (!A.ok || !B.ok) {
      out.detail = { errors: [A.ok ? null : A.error, B.ok ? null : B.error] };
      return out;
    }
    var budget = new Budget(LIMITS.DEADLINE_MS, LIMITS.STATE_CAP, LIMITS.CANON_CAP);
    var ka = canonicalOf(A.g, budget), kb = canonicalOf(B.g, budget);
    var fa = formulaString(countsOf(A.g, A.hv)), fb = formulaString(countsOf(B.g, B.hv));
    out.detail = { formulaA: fa, formulaB: fb, keyA: ka.key, keyB: kb.key };
    if (formula) {
      var pf = parseFormula(formula);
      if (!pf.ok) { out.detail.error = 'formula: ' + pf.error; return out; }
      var want = formulaString(pf.counts);
      if (want !== fa || want !== fb) {
        out.detail.error = 'formula mismatch (asked ' + want + ', got ' + fa + ' / ' + fb + ')';
        return out;
      }
    } else if (fa !== fb) {
      out.detail.error = 'the two graphs have different formulas (' + fa + ' vs ' + fb + ')';
      return out;
    }
    var sa = skeletonKey(A.g, budget), sb = skeletonKey(B.g, budget);
    if (ka.key === kb.key) {
      if (!(A.g.pos && B.g.pos)) {
        out.same = true; out.relation = 'identical';
        out.detail.note = 'no coordinates supplied, so stereochemistry could not be compared';
        return out;
      }
      var fpa = stereoFingerprint(A.g, A.hv, budget), fpb = stereoFingerprint(B.g, B.hv, budget);
      var keyOf = function (fp) {
        var c = fp.centers.map(function (x) { return x.atom + ':' + x.value; }).sort().join(',');
        var b = fp.bonds.map(function (x) { return x.a + '-' + x.b + ':' + x.value; }).sort().join(',');
        return { c: c, b: b };
      };
      var x1 = keyOf(fpa), x2 = keyOf(fpb);
      var centerDiff = x1.c !== x2.c, bondDiff = x1.b !== x2.b;
      out.detail.stereoA = x1; out.detail.stereoB = x2;
      if (!centerDiff && !bondDiff) { out.same = true; out.relation = 'identical'; }
      else if (bondDiff && !centerDiff) out.relation = 'geometric';
      else if (centerDiff && !bondDiff) out.relation = 'optical';
      else { out.relation = 'geometric'; out.detail.diastereomer = true; }
      out.same = out.relation === 'identical';
      return out;
    }
    out.relation = 'constitutional';
    out.detail.sameConnectivity = sa.key === sb.key;
    if (sa.key === sb.key) out.detail.note = 'same heavy skeleton, different bond orders or hydrogen positions';
    return out;
  }

  /* ------------------------------------------------------------------ *
   * Sandbox bridge: window.__mol3d.atoms / .bonds (Maps) -> graph spec.
   * Hydrogen atoms are folded into the implicit count.
   * ------------------------------------------------------------------ */
  function fromScene(atoms, bonds, options) {
    options = options || {};
    var res = { ok: false, error: null, formula: '', graph: null, elements: null };
    var list = [];
    function pushEntry(x) { if (x) list.push(x); }
    if (atoms && typeof atoms.forEach === 'function' && typeof atoms.get === 'function') {
      atoms.forEach(function (v) { pushEntry(v); });
    } else if (Array.isArray(atoms)) atoms.forEach(pushEntry);
    else if (atoms && typeof atoms === 'object') Object.keys(atoms).forEach(function (k) { pushEntry(atoms[k]); });
    var blist = [];
    function pushBond(x) { if (x) blist.push(x); }
    if (bonds && typeof bonds.forEach === 'function' && typeof bonds.get === 'function') {
      bonds.forEach(function (v) { pushBond(v); });
    } else if (Array.isArray(bonds)) bonds.forEach(pushBond);
    else if (bonds && typeof bonds === 'object') Object.keys(bonds).forEach(function (k) { pushBond(bonds[k]); });

    var nodes = [], dropped = 0;
    for (var i = 0; i < list.length; i++) {
      var a = list[i];
      var sym = (a.el && a.el.symbol) || a.el || a.symbol;
      if (!sym) continue;
      var id = String(a.id === undefined ? i : a.id);
      if (sym === 'H') { dropped++; continue; }
      var p = a.pos || null;
      var xyz = null;
      if (p) {
        if (Array.isArray(p)) xyz = [ +p[0], +p[1], +p[2] ];
        else if (typeof p === 'object' && 'x' in p) xyz = [+p.x, +p.y, +p.z];
      }
      nodes.push({ id: id, el: sym, pos: xyz });
    }
    var keep = {};
    for (i = 0; i < nodes.length; i++) keep[nodes[i].id] = 1;
    var edges = [], seen = {};
    for (i = 0; i < blist.length; i++) {
      var b = blist[i];
      var sa = String(b.a === undefined ? b.from : b.a), sb2 = String(b.b === undefined ? b.to : b.b);
      if (!keep[sa] || !keep[sb2] || sa === sb2) continue;
      var kk = sa < sb2 ? sa + ':' + sb2 : sb2 + ':' + sa;
      if (seen[kk]) continue;
      seen[kk] = 1;
      edges.push({ a: sa, b: sb2, order: b.order === undefined ? 1 : b.order });
    }
    var conv = graphToInternal({ nodes: nodes, edges: edges }, options);
    if (!conv.ok) { res.error = conv.error; res.graph = { nodes: nodes, edges: edges }; return res; }
    var counts = countsOf(conv.g, conv.hv);
    if (dropped) counts.H = (counts.H || 0) + dropped;
    res.ok = true;
    res.graph = { nodes: nodes, edges: edges };
    res.formula = formulaString(counts);
    res.elements = counts;
    res.hydrogens = conv.hv.reduce(function (x, y) { return x + y; }, 0) + dropped;
    return res;
  }

  /* functional groups of a single isomer (or of any graph spec) */
  function groupsOf(isomer) {
    if (!isomer) return [];
    if (isomer.functionalGroups && (!isomer.graph)) return isomer.functionalGroups.slice();
    var spec = isomer.graph ? isomer.graph : isomer;
    var conv = graphToInternal(spec, {});
    if (!conv.ok) return [];
    var budget = new Budget(LIMITS.DEADLINE_MS, LIMITS.STATE_CAP, LIMITS.CANON_CAP);
    var ri = ringInfo(conv.g);
    var an = detectGroups(conv.g, conv.hv, ri, budget);
    return an.labels.slice();
  }

  function canonicalKey(graph) {
    var conv = graphToInternal(graph && graph.graph ? graph.graph : graph, {});
    if (!conv.ok) return null;
    var budget = new Budget(LIMITS.DEADLINE_MS, LIMITS.STATE_CAP, LIMITS.CANON_CAP);
    return canonicalOf(conv.g, budget).key;
  }

  function config(overrides) {
    if (overrides && typeof overrides === 'object') {
      for (var k in overrides) if (k in LIMITS) LIMITS[k] = overrides[k];
    }
    var copy = {};
    for (var l in LIMITS) copy[l] = LIMITS[l];
    return copy;
  }

  var api = {
    VERSION: VERSION,
    LIMITS: LIMITS,
    EXCLUSIONS: EXCLUSIONS,
    TAXONOMY: TAXONOMY,
    config: config,
    parseFormula: parseFormula,
    formulaString: formulaString,
    valenceOf: function (sym) { return sym in VAL ? VAL[sym] : null; },
    enumerate: enumerate,
    groupsOf: groupsOf,
    compare: compare,
    fromScene: fromScene,
    canonicalKey: canonicalKey,
    nameOf: function (graph) {
      var conv = graphToInternal(graph && graph.graph ? graph.graph : graph, {});
      if (!conv.ok) return null;
      var budget = new Budget(LIMITS.DEADLINE_MS, LIMITS.STATE_CAP, LIMITS.CANON_CAP);
      var ri = ringInfo(conv.g);
      var an = detectGroups(conv.g, conv.hv, ri, budget);
      return capFirst(externalName(conv.g, conv.hv, budget) || nameIsomer(conv.g, conv.hv, an, budget));
    },
    isomerOf: function (graph) {
      var conv = graphToInternal(graph && graph.graph ? graph.graph : graph, {});
      if (!conv.ok) return { ok: false, error: conv.error };
      var budget = new Budget(LIMITS.DEADLINE_MS, LIMITS.STATE_CAP, LIMITS.CANON_CAP);
      var ri = ringInfo(conv.g);
      var an = detectGroups(conv.g, conv.hv, ri, budget);
      var c = canonicalOf(conv.g, budget);
      var flags = { incomplete: false };
      var st = stereoOf(conv.g, conv.hv, ri, budget, flags);
      return {
        ok: true, key: c.key, formula: formulaString(countsOf(conv.g, conv.hv)),
        groups: an.labels, ringCount: ri.count, ringSizes: ri.sizes,
        geometric: st.geometric, chiralCenters: st.chiralCenters.length,
        name: nameIsomer(conv.g, conv.hv, an, budget)
      };
    }
  };

  var target = (typeof window !== 'undefined') ? window : (typeof globalThis !== 'undefined' ? globalThis : this);
  target.__isomerEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();

