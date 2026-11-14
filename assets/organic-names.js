// Structure-derived IUPAC-style nomenclature for organic molecules.
//
// Why this file exists: the namer in the main bundle derives names from the
// molecular FORMULA (a common-name table, plus a hydrocarbon-only branch). Two
// structural isomers therefore collapse onto one name: ethanol and dimethyl
// ether both read as "C2H6O"-ish, propan-1-ol and propan-2-ol are
// indistinguishable, and the binary-inorganic fall-through leaks into organic
// results. This module names from the BOND GRAPH instead: it picks the parent
// structure by graph traversal, finds the principal characteristic group with a
// substitutive priority ladder, and derives locants from connectivity. The same
// structure always yields the same string no matter how the atoms were ordered
// when the graph was built, which is what makes isomer families come out
// distinct and duplicates come out identical.
//
// Contract with the caller (the bundle owns the fallback, this file never does):
//   window.__organicNames.isOrganic(atomsLike, bondsLike) -> boolean
//   window.__organicNames.name(moleculeLike[, bondsLike])  -> object | null
//   window.__organicNames.nameFromGraph(nodes, edges)      -> object | null
// `null` means "I cannot name this from structure, use the old namer". Anything
// outside the supported scope (heterocycles, fused rings, anhydrides, metals,
// charges, multiple fragments, > 22 carbons, exotic elements) returns null
// rather than guessing, so the app never displays a wrong name.
//
// Names are English only. Vietnamese is the app's i18n layer's job, and the
// strings returned here are meant to be passed through it as-is.
//
// Loadable without a bundler for testing:
//   global.window = {}; eval(fs.readFileSync('assets/organic-names.js','utf8'));
//   window.__organicNames.nameFromGraph(nodes, edges);
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Constant tables (deliberately duplicated rather than imported: this file has
  // to run standalone in the page without reaching into bundle internals).
  // ---------------------------------------------------------------------------

  var VERSION = '1.0.0';

  // Parent-hydride stems, index 0 == one carbon.
  var STEM = ['meth', 'eth', 'prop', 'but', 'pent', 'hex', 'hept', 'oct', 'non',
    'dec', 'undec', 'dodec', 'tridec', 'tetradec', 'pentadec', 'hexadec',
    'heptadec', 'octadec', 'nonadec', 'icos', 'henicos', 'docos'];

  // Multiplicative prefixes: index == how many of the same thing.
  var MULT = ['', '', 'di', 'tri', 'tetra', 'penta', 'hexa', 'hepta', 'octa',
    'nona', 'deca', 'undeca', 'dodeca'];

  var HALO_PREFIX = { F: 'fluoro', Cl: 'chloro', Br: 'bromo', I: 'iodo' };
  // Acid-halide second word: "ethanoyl chloride", not "ethanoyl chloro".
  var HALO_SALT = { F: 'fluoride', Cl: 'chloride', Br: 'bromide', I: 'iodide' };

  // Heavy elements this namer can put a name together for. Anything else makes
  // name() return null so the inorganic namer keeps working.
  var NAMABLE = { C: 1, N: 1, O: 1, S: 1, F: 1, Cl: 1, Br: 1, I: 1 };

  // Elements isMetal() would call non-metal, used when the caller hands us bare
  // symbols and we cannot read el.cat. Metalloids are NOT metals there, so they
  // are listed here too; anything absent from this table is assumed metallic.
  var NONMETAL = {
    H: 1, He: 1, Li: 1, Be: 1, B: 1, C: 1, N: 1, O: 1, F: 1, Ne: 1, Na: 1,
    Mg: 1, Al: 1, Si: 1, P: 1, S: 1, Cl: 1, Ar: 1, K: 1, Ca: 1, Ge: 1, As: 1,
    Se: 1, Br: 1, Kr: 1, Sn: 1, Sb: 1, Te: 1, I: 1, Xe: 1, Po: 1, At: 1,
    Rn: 1, Fl: 1, Mc: 1, Lv: 1, Ts: 1, Og: 1
  };
  // Mirrors the bundle's isMetalCat() category list.
  var METAL_CAT = {
    alkali: 1, alkaline: 1, transition: 1, post: 1, lanthanide: 1, actinide: 1
  };

  // Carbon-containing species that classifyMolecule() refuses to call organic:
  // carbon oxides, carbon disulfide, hydrocyanic acid, carbonic acid and the
  // carbonate/bicarbonate cores, plus carbide/cyanide style salts (those always
  // carry a metal, which the metal gate below already rejects).
  var INORGANIC_CARDS = {
    'CO': 1, 'CO2': 1, 'C3O2': 1, 'CS2': 1, 'COS': 1, 'CSe2': 1,
    'HCN': 1, 'CHN': 1, 'HNC': 1, 'H2CO3': 1, 'HCO3': 1, 'CO3': 1,
    'CH2O3': 1, 'C2O3': 1, 'CO4': 1, 'C2O4': 1
  };

  // Substitutive suffix ladder, highest first. Every entry states how the suffix
  // attaches: `terminal` groups own position 1 of the parent chain (so they carry
  // no locant), `cyclicOk` groups may hang straight off a ring carbon.
  var SUFFIX_ORDER = ['acid', 'ester', 'acylhalide', 'amide', 'nitrile',
    'aldehyde', 'ketone', 'hydroxyl', 'thiol', 'amine'];
  var SUFFIX_INFO = {
    acid: { terminal: true, text: 'oic acid', cls: 'carboxylic acid', fg: 'carboxyl (-COOH)' },
    ester: { terminal: true, text: 'oate', cls: 'ester', fg: 'ester (-COO-)' },
    acylhalide: { terminal: true, text: 'oyl', cls: 'acid halide', fg: 'acyl halide (-COX)' },
    amide: { terminal: true, text: 'amide', cls: 'amide', fg: 'amide (-CONH2)' },
    nitrile: { terminal: true, text: 'nitrile', cls: 'nitrile', fg: 'nitrile (-C#N)' },
    aldehyde: { terminal: true, text: 'al', cls: 'aldehyde', fg: 'formyl (-CHO)' },
    ketone: { terminal: false, text: 'one', cls: 'ketone', fg: 'carbonyl (>C=O)' },
    hydroxyl: { terminal: false, text: 'ol', cls: 'alcohol', fg: 'hydroxyl (-OH)' },
    thiol: { terminal: false, text: 'thiol', cls: 'thiol', fg: 'sulfhydryl (-SH)' },
    amine: { terminal: false, text: 'amine', cls: 'amine', fg: 'amino (-NH2)' }
  };
  // Prefix used when a group of this kind is NOT the principal characteristic
  // group (i.e. it loses to something higher on the ladder).
  var GROUP_PREFIX = {
    acid: 'carboxy', aldehyde: 'formyl', ketone: 'oxo', hydroxyl: 'hydroxy',
    thiol: 'sulfanyl', amine: 'amino', nitrile: 'cyano', oxo: 'oxo',
    nitro: 'nitro', ether: 'oxy'
  };
  // Aromatic retained parents: suffix kind -> retained name, plus the strictly
  // substitutive alternative that goes in the `systematic` field.
  var ARENES = {
    none: { name: 'benzene', sys: 'benzene' },
    hydroxyl: { name: 'phenol', sys: 'hydroxybenzene' },
    amine: { name: 'aniline', sys: 'benzenamine' },
    thiol: { name: 'benzenethiol', sys: 'benzenethiol' },
    acid: { name: 'benzoic acid', sys: 'benzenecarboxylic acid' },
    aldehyde: { name: 'benzaldehyde', sys: 'benzenecarbaldehyde' },
    ketone: { name: 'acetophenone', sys: '1-phenylethan-1-one' },
    nitrile: { name: 'benzonitrile', sys: 'benzenecarbonitrile' },
    amide: { name: 'benzamide', sys: 'benzenecarboxamide' },
    acylhalide: { name: 'benzoyl', sys: 'benzene carbonyl' },
    ester: { name: 'benzoate', sys: 'benzenecarboxylate' },
    methyl: { name: 'toluene', sys: 'methylbenzene' },
    methoxy: { name: 'anisole', sys: 'methoxybenzene' }
  };
  // Ring parents when a suffix-bearing group hangs off the ring rather than off
  // a chain: "cyclohexanecarboxylic acid".
  var RING_ANCHOR_SUFFIX = {
    acid: 'carboxylic acid', aldehyde: 'carbaldehyde', nitrile: 'carbonitrile',
    amide: 'carboxamide', acylhalide: null, ester: 'carboxylate'
  };

  // Multiplicative prefixes for bracketed (composite) substituent names.
  var BIS = ['', '', 'bis', 'tris', 'tetrakis', 'pentakis', 'hexakis'];
  // Immutable stand-in for "nothing blocked", keeps hot loops allocation-free.
  var EMPTY_SET = new Set();

  var HARD_ATOM_CAP = 140;
  var MAX_RING = 8;
  var RING_CYCLE_CAP = 200000;
  var CANDIDATE_CAP = 900;

  // ---------------------------------------------------------------------------
  // Small helpers
  // ---------------------------------------------------------------------------

  function symOf(el) {
    if (!el) return null;
    if (typeof el === 'string') return el;
    return el.sym || el.symbol || el.s || el.sign || null;
  }

  function stemFor(n) {
    return n >= 1 && n <= STEM.length ? STEM[n - 1] : null;
  }

  function multWord(k) {
    return k >= 2 && k < MULT.length ? MULT[k] : null;
  }

  function cmpNum(a, b) { return a - b; }

  // Lexicographic comparison of ascending numeric arrays (lowest-set rule).
  function cmpLocants(a, b) {
    var m = Math.max(a.length, b.length);
    for (var i = 0; i < m; i++) {
      var x = i < a.length ? a[i] : 1e9;
      var y = i < b.length ? b[i] : 1e9;
      if (x !== y) return x < y ? -1 : 1;
    }
    return 0;
  }

  // Score comparison for parents: `max` entries are bigger-is-better, `tuples`
  // (locant sets) are lower-is-better, applied in IUPAC rule order.
  function cmpCandidate(a, b) {
    for (var i = 0; i < a.max.length; i++) {
      if (a.max[i] !== b.max[i]) return a.max[i] > b.max[i] ? -1 : 1;
    }
    for (var j = 0; j < Math.max(a.tuples.length, b.tuples.length); j++) {
      var x = a.tuples[j] || [1e9];
      var y = b.tuples[j] || [1e9];
      var c = cmpLocants(x, y);
      if (c !== 0) return c;
    }
    return 0;
  }

  function lowerFirst(ch) { return ch.toLowerCase(); }

  // Alphabetisation key of a prefix: the first LETTER of the complete substituent
  // name, ignoring leading locants and punctuation. Multiplicative prefixes that
  // belong to a composite name ("dimethylamino") are part of the name and count.
  function alphaKeyOf(name) {
    var stripped = String(name).replace(/^[^A-Za-z]+/, '');
    return stripped.length ? lowerFirst(stripped.charAt(0)) : '~';
  }

  function isHetero(sym) { return sym !== 'C' && sym !== 'H'; }

  // ---------------------------------------------------------------------------
  // Input coercion: atoms / bonds / graph shapes
  // ---------------------------------------------------------------------------

  function toList(x) {
    if (x === null || x === undefined) return null;
    if (Array.isArray(x)) return x;
    if (typeof Map !== 'undefined' && x instanceof Map) return Array.from(x.values());
    if (typeof Set !== 'undefined' && x instanceof Set) return Array.from(x);
    if (typeof x !== 'string' && typeof x[Symbol.iterator] === 'function') return Array.from(x);
    if (typeof x === 'object') {
      var keys = Object.keys(x);
      // Plain object used as an id -> record dictionary.
      if (keys.length && keys.every(function (k) {
        var v = x[k];
        return v && (v.el || symOf(v) || typeof v === 'string');
      })) return keys.map(function (k) { return x[k]; });
    }
    return null;
  }

  // atomsLike may be: a Map/array of {id, el} records, an array of symbol
  // strings (the isomer engine's template shape), or anything iterable of those.
  function coerceAtoms(x) {
    var list = toList(x);
    if (!list) return null;
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var rec = list[i];
      var sym = null;
      var key = '@' + i;
      if (typeof rec === 'string') {
        sym = rec;
      } else if (rec && typeof rec === 'object') {
        sym = symOf(rec.el !== undefined && rec.el !== null ? rec.el : rec);
        if (rec.id !== undefined && rec.id !== null) key = rec.id;
      }
      if (!sym) return null;
      out.push({ key: key, sym: String(sym).charAt(0).toUpperCase() + String(sym).slice(1) });
    }
    return out;
  }

  // bondsLike may be a Map/array of {a, b, order, ionic} or of [i, j, order, ionic].
  function coerceBonds(x) {
    var list = toList(x);
    if (!list) return null;
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      var a, z, order, ionic = false;
      if (Array.isArray(b)) {
        a = b[0]; z = b[1]; order = b.length > 2 ? b[2] : 1;
        ionic = b.length > 3 ? !!b[3] : false;
      } else if (b && typeof b === 'object') {
        a = b.a !== undefined ? b.a : b.from;
        z = b.b !== undefined ? b.b : b.to;
        order = b.order !== undefined ? b.order : b.multiplicity;
        ionic = !!b.ionic;
      } else {
        return null;
      }
      if (a === undefined || z === undefined) return null;
      out.push({ a: a, b: z, order: order, ionic: ionic });
    }
    return out;
  }

  function resolveEndpoint(v, keyToIdx, n) {
    if (keyToIdx.has(v)) return keyToIdx.get(v);
    // Numeric ids that also work as positional indices (the bundle's
    // generateIsomerName() fakes atoms with id === array index).
    if (typeof v === 'number' && v >= 0 && v < n) return v;
    return -1;
  }

  // Build the working graph. Returns null when the input is not a single,
  // neutral, covalently connected molecule we can reason about.
  function buildGraph(atomsLike, bondsLike) {
    var atoms = coerceAtoms(atomsLike);
    if (!atoms || !atoms.length) return null;
    if (atoms.length > HARD_ATOM_CAP) return null;
    var n = atoms.length;
    var sym = new Array(n);
    var keyToIdx = new Map();
    for (var i = 0; i < n; i++) {
      sym[i] = atoms[i].sym;
      if (!keyToIdx.has(atoms[i].key)) keyToIdx.set(atoms[i].key, i);
    }
    var bonds = coerceBonds(bondsLike);
    if (!bonds) return null;

    // Merge parallel bond records into one bond-order per pair; an ionic contact
    // means a salt, which is the inorganic namer's job.
    var orderMap = new Map();
    for (var e = 0; e < bonds.length; e++) {
      if (bonds[e].ionic) return null;
      var a = resolveEndpoint(bonds[e].a, keyToIdx, n);
      var b = resolveEndpoint(bonds[e].b, keyToIdx, n);
      if (a < 0 || b < 0 || a === b) return null;
      var o = bonds[e].order;
      o = (o === undefined || o === null || o === '') ? 1 : Number(o);
      if (!isFinite(o) || o <= 0 || o > 3.6) return null;
      // Aromatic delocalised contacts (1.5) are kept as-is; anything else is
      // quantised to an integral order.
      var frac = Math.abs(o - 1.5) < 0.01;
      if (!frac) o = Math.max(1, Math.min(3, Math.round(o)));
      var key = a < b ? a + ':' + b : b + ':' + a;
      var prev = orderMap.get(key);
      if (prev === undefined) orderMap.set(key, o);
      else if (Math.abs(prev - o) > 0.01) orderMap.set(key, Math.max(prev, o));
      else orderMap.set(key, Math.max(prev, o));
    }

    // Adjacency without hydrogens (the naming skeleton) + explicit H counts.
    var adj = new Array(n);
    for (i = 0; i < n; i++) adj[i] = [];
    var hCount = new Array(n);
    for (i = 0; i < n; i++) hCount[i] = 0;
    var uf = new Array(n);
    for (i = 0; i < n; i++) uf[i] = i;
    function find(x) { while (uf[x] !== x) { uf[x] = uf[uf[x]]; x = uf[x]; } return x; }
    orderMap.forEach(function (o, key) {
      var p = key.split(':');
      var x = +p[0], y = +p[1];
      if (sym[x] !== 'H' && sym[y] !== 'H') {
        adj[x].push({ to: y, order: o });
        adj[y].push({ to: x, order: o });
      } else if (sym[x] === 'H') hCount[y] += 1;
      else hCount[x] += 1;
      var rx = find(x), ry = find(y);
      if (rx !== ry) uf[rx] = ry;
    });
    for (i = 0; i < n; i++) adj[i].sort(function (m, k) { return m.to - k.to; });

    var heavy = [];
    for (i = 0; i < n; i++) if (sym[i] !== 'H') heavy.push(i);

    // One connected fragment only: a mixture is not one molecule.
    var root = n ? find(0) : -1;
    for (i = 1; i < n; i++) if (find(i) !== root) return null;

    var counts = {};
    var hasMetal = false;
    for (i = 0; i < n; i++) {
      counts[sym[i]] = (counts[sym[i]] || 0) + 1;
    }

    return {
      n: n, sym: sym, adj: adj, hCount: hCount, heavy: heavy, counts: counts,
      order: function (x, y) {
        var key = x < y ? x + ':' + y : y + ':' + x;
        return orderMap.get(key) || 0;
      },
      bonded: function (x, y) { return x !== y && find(x) === find(y); },
      hill: hillOf(counts)
    };
  }

  function hillOf(counts) {
    var keys = Object.keys(counts);
    var ordered;
    if (counts.C) {
      ordered = ['C'];
      if (counts.H) ordered.push('H');
      ordered = ordered.concat(keys.filter(function (k) { return k !== 'C' && k !== 'H'; }).sort());
    } else {
      ordered = keys.slice().sort();
    }
    var out = '';
    for (var i = 0; i < ordered.length; i++) {
      var k = ordered[i];
      out += k + (counts[k] > 1 ? counts[k] : '');
    }
    return out;
  }

  // Pull {atoms, bonds} out of whatever container the caller hands over: the
  // live window.__mol3d object, a {atoms, bonds} literal, [atoms, bonds], a Map
  // of atoms plus a second argument, or an isomer-template pair.
  function pickParts(spec, bondsArg) {
    if (spec === null || spec === undefined) return null;
    if (Array.isArray(spec) && bondsArg !== undefined) {
      return { atoms: spec, bonds: bondsArg };
    }
    if (spec && typeof spec === 'object' && !Array.isArray(spec) && !(typeof Map !== 'undefined' && spec instanceof Map)) {
      if (spec.atoms !== undefined || spec.bonds !== undefined) {
        return {
          atoms: spec.atoms,
          bonds: bondsArg !== undefined ? bondsArg : spec.bonds,
          charge: spec.charge
        };
      }
      if (spec.nodes !== undefined || spec.edges !== undefined) {
        return { nodes: spec.nodes, edges: bondsArg !== undefined ? bondsArg : spec.edges };
      }
    }
    return { atoms: spec, bonds: bondsArg };
  }

  // ---------------------------------------------------------------------------
  // Organic / inorganic decision, mirroring the bundle's classifyMolecule() so
  // the two never disagree about what counts as an organic carbon compound.
  // ---------------------------------------------------------------------------

  function elementIsMetal(sym, atomsLike) {
    if (NONMETAL[sym]) return false;
    // When records are available, trust the bundle's own category field.
    var list = toList(atomsLike);
    if (list) {
      for (var i = 0; i < list.length; i++) {
        var rec = list[i];
        var el = rec && typeof rec === 'object' ? (rec.el && typeof rec.el === 'object' ? rec.el : rec) : null;
        if (!el || symOf(el) !== sym) continue;
        if (el.cat) return METAL_CAT[el.cat] === true;
      }
    }
    return true;
  }

  function isOrganic(atomsLike, bondsLike) {
    if (atomsLike && typeof atomsLike === 'object' && !Array.isArray(atomsLike) &&
      atomsLike.atoms !== undefined && bondsLike === undefined) {
      atomsLike = atomsLike.atoms;
    }
    var atoms = coerceAtoms(atomsLike);
    if (!atoms) return false;
    var counts = {};
    for (var i = 0; i < atoms.length; i++) counts[atoms[i].sym] = (counts[atoms[i].sym] || 0) + 1;
    return organicFromCounts(counts, atomsLike);
  }

  function organicFromCounts(counts, atomsLike) {
    if (!counts.C) return false;
    var syms = Object.keys(counts);
    for (var s = 0; s < syms.length; s++) {
      if (elementIsMetal(syms[s], atomsLike)) return false;
    }
    var formula = hillOf(counts);
    if (INORGANIC_CARDS[formula]) return false;
    var hasH = !!counts.H, hasO = !!counts.O, hasN = !!counts.N, hasS = !!counts.S;
    // Hydrocarbons are organic whatever the bundle's classification key says.
    if (hasH && syms.length === 2 && counts.C && counts.H) return true;
    // Cyanides / binary C-N phases, C-N-O and C-N-S phases with no hydrogen,
    // carbides and pure carbon clusters: all excluded by classifyMolecule().
    if (!hasH && !hasO && !hasS && hasN && syms.length === 2) return false;
    if (!hasH && hasN && hasO && !hasS && syms.length === 3) return false;
    if (!hasH && hasN && hasS && !hasO && syms.length === 3) return false;
    if (!hasH && !hasO && !hasN && !hasS) return false;
    // Only carbon and oxygen (CO, CO2, C3O2 and friends).
    if (hasO && syms.length === 2) return false;
    return true;
  }

  // ---------------------------------------------------------------------------
  // Rings: chordless cycles up to MAX_RING, then the aromatic test
  // ---------------------------------------------------------------------------

  function findRings(G) {
    var rings = [];
    var seen = new Set();
    var nodes = G.heavy;
    var budget = RING_CYCLE_CAP;
    for (var s = 0; s < nodes.length; s++) {
      var start = nodes[s];
      // Only walk through atoms with a higher index than `start`: every cycle is
      // then generated exactly once, from its lowest-index member.
      var path = [start];
      var onPath = new Set();
      onPath.add(start);
      (function dfs(cur) {
        if (budget-- < 0) return;
        var nb = G.adj[cur];
        for (var k = 0; k < nb.length; k++) {
          var nxt = nb[k].to;
          if (nxt === start) {
            if (path.length >= 3) {
              var sig = path.slice().sort(cmpNum).join(',');
              if (!seen.has(sig) && chordless(G, path)) {
                seen.add(sig);
                rings.push(path.slice());
              }
            }
            continue;
          }
          if (nxt < start || onPath.has(nxt) || path.length >= MAX_RING) continue;
          onPath.add(nxt);
          path.push(nxt);
          dfs(nxt);
          path.pop();
          onPath.delete(nxt);
        }
      })(start);
    }
    return rings;
  }

  function chordless(G, ring) {
    var set = new Set(ring);
    for (var i = 0; i < ring.length; i++) {
      var nb = G.adj[ring[i]];
      for (var k = 0; k < nb.length; k++) {
        if (set.has(nb[k].to) && nb[k].to !== ring[(i + 1) % ring.length] &&
          nb[k].to !== ring[(i + ring.length - 1) % ring.length]) return false;
      }
    }
    return true;
  }

  // Benzene test: a six-carbon ring in which every ring carbon keeps exactly one
  // slot for a substituent (H or the group). That excludes cyclohexane (two
  // slots) and accepts the Kekule, the all-single-bond shorthand and the 1.5
  // delocalised drawings alike.
  function isAromaticRing(G, ring) {
    if (ring.length !== 6) return false;
    var inRing = new Set(ring);
    for (var i = 0; i < ring.length; i++) if (G.sym[ring[i]] !== 'C') return false;
    var doubles = 0, frac = 0, singles = 0;
    for (i = 0; i < 6; i++) {
      var a = ring[i], b = ring[(i + 1) % 6];
      var o = G.order(a, b);
      if (!o) return false;
      if (Math.abs(o - 1.5) < 0.01) frac++;
      else if (o >= 2) doubles++;
      else singles++;
    }
    var kekule = false;
    if (doubles === 3) {
      kekule = true;
      for (i = 0; i < 6; i++) {
        var o1 = G.order(ring[i], ring[(i + 1) % 6]);
        var o2 = G.order(ring[(i + 1) % 6], ring[(i + 2) % 6]);
        if (o1 >= 2 && o2 >= 2) kekule = false;
      }
    }
    if (!(kekule || singles === 6 || frac === 6)) return false;
    for (i = 0; i < 6; i++) {
      var c = ring[i];
      var exo = G.adj[c].filter(function (e) { return !inRing.has(e.to); });
      if (exo.length > 1) return false;
      for (var k = 0; k < exo.length; k++) if (exo[k].order > 1) return false;
      if (G.hCount[c] + exo.length !== 1) return false;
    }
    return true;
  }

  // ---------------------------------------------------------------------------
  // Functional-group tagging. Passes run in suffix-priority order and consume
  // the atoms they claim, so a -COOH is never also read as an alcohol + a
  // ketone and a halo from an acid chloride never leaks into the prefix list.
  // ---------------------------------------------------------------------------

  function detectGroups(G) {
    var consumed = new Set();
    var out = [];
    function claim(g) {
      for (var i = 0; i < g.atoms.length; i++) consumed.add(g.atoms[i]);
      out.push(g);
    }
    function free(i) { return !consumed.has(i); }
    function nbrs(i) { return G.adj[i]; }
    function heavyNbr(i) { return G.adj[i]; }
    function symAt(i) { return G.sym[i]; }

    // C(=O)-O-H / C(=O)-O-C / C(=O)-X / C(=O)-N share one scan of carbonyls.
    var carbonyls = [];
    for (var q = 0; q < G.heavy.length; q++) {
      var c = G.heavy[q];
      if (symAt(c) !== 'C' || !free(c)) continue;
      var dblO = nbrs(c).filter(function (e) { return e.order >= 2 && symAt(e.to) === 'O'; });
      if (dblO.length !== 1) continue;
      var oD = dblO[0].to;
      var rest = nbrs(c).filter(function (e) { return e.to !== oD; });
      carbonyls.push({ c: c, oD: oD, rest: rest });
    }

    // 1. carboxylic acid
    for (q = 0; q < carbonyls.length; q++) {
      var k1 = carbonyls[q];
      if (!free(k1.c) || !free(k1.oD)) continue;
      // A carboxyl carbon has three sigma partners: =O, -O(H) and one skeleton
      // arm. Formic acid is the case where that arm is a hydrogen instead.
      if (G.hCount[k1.c] > 1 || (G.hCount[k1.c] === 1 && k1.rest.length > 1)) continue;
      var oh = k1.rest.filter(function (e) {
        return e.order === 1 && symAt(e.to) === 'O' && free(e.to) &&
          G.adj[e.to].length === 1 && G.hCount[e.to] >= 1;
      });
      var otherHetero = k1.rest.filter(function (e) {
        return isHetero(symAt(e.to));
      });
      if (oh.length === 1 && otherHetero.length === 1) {
        claim({ kind: 'acid', atoms: [k1.c, k1.oD, oh[0].to], attach: [k1.c], terminal: true });
      }
    }

    // 2. ester  (C(=O)O-R); an O bridging two carbonyls is an anhydride -> give up
    for (q = 0; q < carbonyls.length; q++) {
      var k2 = carbonyls[q];
      if (!free(k2.c) || !free(k2.oD)) continue;
      if (G.hCount[k2.c] > 1 || (G.hCount[k2.c] === 1 && k2.rest.length > 1)) continue;
      var or = k2.rest.filter(function (e) {
        return e.order === 1 && symAt(e.to) === 'O' && free(e.to);
      });
      if (!or.length) continue;
      var carbonylNeighbours = k2.rest.filter(function (e) {
        return symAt(e.to) === 'C' && free(e.to) && carbonyls.some(function (z) { return z.c === e.to; });
      });
      if (carbonylNeighbours.length) return null; // anhydride / imide territory
      var alkylSide = null, ok = false;
      for (var t = 0; t < or.length; t++) {
        var oAtom = or[t].to;
        var beyond = G.adj[oAtom].filter(function (e) { return e.to !== k2.c; });
        if (beyond.length === 1 && symAt(beyond[0].to) === 'C' && free(beyond[0].to) &&
          G.hCount[oAtom] === 0) {
          if (ok) return null; // more than one O-alkyl arm: carbonate
          ok = true;
          alkylSide = beyond[0].to;
        } else if (beyond.length === 0) {
          ok = false;
          break;
        } else if (beyond.length > 1) {
          return null;
        }
      }
      if (ok && alkylSide !== null) {
        var oSel = or.filter(function (e) {
          return G.adj[e.to].some(function (z) { return z.to === alkylSide; });
        })[0].to;
        claim({
          kind: 'ester', atoms: [k2.c, k2.oD, oSel], attach: [k2.c], terminal: true,
          alkylRoot: alkylSide
        });
      }
    }

    // 3. acid halide
    for (q = 0; q < carbonyls.length; q++) {
      var k3 = carbonyls[q];
      if (!free(k3.c) || !free(k3.oD)) continue;
      var hx = k3.rest.filter(function (e) {
        return e.order === 1 && HALO_PREFIX[symAt(e.to)] && free(e.to);
      });
      if (hx.length === 1) {
        claim({
          kind: 'acylhalide', atoms: [k3.c, k3.oD, hx[0].to], attach: [k3.c],
          terminal: true, halSym: symAt(hx[0].to)
        });
      }
    }

    // 4. amide
    for (q = 0; q < carbonyls.length; q++) {
      var k4 = carbonyls[q];
      if (!free(k4.c) || !free(k4.oD)) continue;
      var am = k4.rest.filter(function (e) {
        return e.order === 1 && symAt(e.to) === 'N' && free(e.to) &&
          G.adj[e.to].filter(function (z) { return z.to !== k4.c; }).length <= 2;
      });
      var heteroCount = k4.rest.filter(function (e) { return isHetero(symAt(e.to)); }).length;
      if (am.length === 1 && heteroCount === 1) {
        claim({
          kind: 'amide', atoms: [k4.c, k4.oD, am[0].to], attach: [k4.c], terminal: true,
          nAtom: am[0].to
        });
      }
    }

    // 5. nitrile: -C#N with the nitrile carbon carrying no hydrogen and exactly
    // one skeleton arm (HCN itself is inorganic and never reaches this code).
    for (q = 0; q < G.heavy.length; q++) {
      var cn = G.heavy[q];
      if (symAt(cn) !== 'C' || !free(cn)) continue;
      var trip = nbrs(cn).filter(function (e) { return e.order === 3 && symAt(e.to) === 'N'; });
      if (trip.length === 1 && nbrs(cn).length === 2 && nbrs(trip[0].to).length === 1 &&
        G.hCount[cn] === 0) {
        claim({
          kind: 'nitrile', atoms: [cn, trip[0].to], attach: [cn], terminal: true
        });
      }
    }

    // 6/7. aldehyde then ketone on the remaining carbonyls
    for (q = 0; q < carbonyls.length; q++) {
      var k6 = carbonyls[q];
      if (!free(k6.c) || !free(k6.oD)) continue;
      if (G.hCount[k6.c] >= 1 && k6.rest.every(function (e) { return symAt(e.to) === 'C'; })) {
        claim({ kind: 'aldehyde', atoms: [k6.c, k6.oD], attach: [k6.c], terminal: true });
      } else if (k6.rest.length === 2 && k6.rest.every(function (e) { return symAt(e.to) === 'C'; }) &&
        G.hCount[k6.c] === 0) {
        claim({
          kind: 'ketone', atoms: [k6.c, k6.oD], attach: [k6.c],
          rootAtom: k6.oD, terminal: false
        });
      } else if (k6.rest.every(function (e) { return symAt(e.to) === 'C'; })) {
        // sp2 carbon with a lone =O and <=1 carbon arm and no H: keep it as oxo
        claim({ kind: 'oxo', atoms: [k6.c, k6.oD], attach: [k6.c], rootAtom: k6.oD });
      }
    }

    // 8. alcohol (also accepts a terminal monovalent O with the H implicit)
    for (q = 0; q < G.heavy.length; q++) {
      var o8 = G.heavy[q];
      if (symAt(o8) !== 'O' || !free(o8)) continue;
      var nb8 = nbrs(o8);
      if (nb8.length !== 1 || nb8[0].order !== 1) continue;
      if (symAt(nb8[0].to) !== 'C' || !free(nb8[0].to)) continue;
      claim({
        kind: 'hydroxyl', atoms: [o8], attach: [nb8[0].to], terminal: false, rootAtom: o8
      });
    }

    // 9. thiol
    for (q = 0; q < G.heavy.length; q++) {
      var s9 = G.heavy[q];
      if (symAt(s9) !== 'S' || !free(s9)) continue;
      var nb9 = nbrs(s9);
      if (nb9.length === 1 && nb9[0].order === 1 && symAt(nb9[0].to) === 'C' &&
        (G.hCount[s9] >= 1 || free(nb9[0].to))) {
        claim({
          kind: 'thiol', atoms: [s9], attach: [nb9[0].to], terminal: false, rootAtom: s9
        });
      } else if (nb9.length === 2 && nb9.every(function (e) { return e.order === 1 && symAt(e.to) === 'C'; })) {
        claim({
          kind: 'sulfide', atoms: [s9], rootAtom: s9,
          arms: nb9.map(function (e) { return e.to; }),
          attach: nb9.map(function (e) { return e.to; }), terminal: false
        });
      }
    }

    // 10. nitro before amine: N with two O arms is not an amine
    for (q = 0; q < G.heavy.length; q++) {
      var n10 = G.heavy[q];
      if (symAt(n10) !== 'N' || !free(n10)) continue;
      var nb10 = nbrs(n10);
      var oArms = nb10.filter(function (e) { return symAt(e.to) === 'O'; });
      var cArms = nb10.filter(function (e) { return symAt(e.to) === 'C'; });
      if (oArms.length === 2 && cArms.length === 1 && G.hCount[n10] === 0 &&
        nb10.length === 3 && oArms.every(function (e) { return free(e.to); })) {
        claim({
          kind: 'nitro', atoms: [n10].concat(oArms.map(function (e) { return e.to; })),
          rootAtom: n10, attach: [cArms[0].to]
        });
      }
    }

    // 11. amine
    for (q = 0; q < G.heavy.length; q++) {
      var n11 = G.heavy[q];
      if (symAt(n11) !== 'N' || !free(n11)) continue;
      var nb11 = nbrs(n11);
      if (!nb11.every(function (e) { return e.order === 1; })) continue;
      if (!nb11.every(function (e) { return symAt(e.to) === 'C'; })) continue;
      if (!nb11.length) continue;
      if (G.hCount[n11] > 2) continue;
      var amineArms = nb11.map(function (e) { return e.to; })
        .filter(function (x) { return free(x); });
      if (!amineArms.length) continue;
      claim({
        kind: 'amine', atoms: [n11], rootAtom: n11,
        arms: amineArms, attach: amineArms, terminal: false
      });
    }

    // 12. ether (a suffix candidate never; always an alkoxy prefix)
    for (q = 0; q < G.heavy.length; q++) {
      var o12 = G.heavy[q];
      if (symAt(o12) !== 'O' || !free(o12)) continue;
      var nb12 = nbrs(o12);
      if (nb12.length === 2 && nb12.every(function (e) { return e.order === 1 && symAt(e.to) === 'C'; })) {
        claim({
          kind: 'ether', atoms: [o12], rootAtom: o12,
          arms: nb12.map(function (e) { return e.to; })
        });
      }
    }

    return { groups: out, consumed: consumed };
  }

  // ---------------------------------------------------------------------------
  // Substituent (prefix) naming
  // ---------------------------------------------------------------------------

  // Component of the graph reachable from `root` while avoiding `blocked`.
  function componentOf(G, root, blocked) {
    var out = [];
    var seen = new Set();
    var stack = [root];
    seen.add(root);
    while (stack.length) {
      var cur = stack.pop();
      out.push(cur);
      var nb = G.adj[cur];
      for (var i = 0; i < nb.length; i++) {
        var nxt = nb[i].to;
        if (seen.has(nxt) || blocked.has(nxt)) continue;
        seen.add(nxt);
        stack.push(nxt);
      }
    }
    out.sort(cmpNum);
    return out;
  }

  // Hydrocarbon skeleton text for a linear chain of `len` atoms with the given
  // double/triple locants. `withTerminalE` keeps the closing 'e' of -ane/-ene/
  // -yne, which the elision rules then work against.
  function hydrideBase(len, enes, ynes, opts) {
    opts = opts || {};
    var stem = stemFor(len);
    if (!stem) return null;
    var cyclo = opts.cyclo ? 'cyclo' : '';
    if (!enes.length && !ynes.length) return cyclo + stem + 'ane';
    var addA = (enes.length > 1 || ynes.length > 1) && stem !== 'meth' && stem !== 'eth';
    var base = cyclo + stem + (addA ? 'a' : '');
    var text = base;
    var showLocants = opts.elideUnsatLocants !== true;
    if (enes.length) {
      var em = enes.length > 1 ? multWord(enes.length) : '';
      if (em === null) return null;
      text += (showLocants ? '-' + enes.slice().sort(cmpNum).join(',') + '-' : '') + em + 'ene';
    }
    if (ynes.length) {
      var ym = ynes.length > 1 ? multWord(ynes.length) : '';
      if (ym === null) return null;
      text += (showLocants ? '-' + ynes.slice().sort(cmpNum).join(',') + '-' : '') + ym + 'yne';
    }
    return text;
  }

  // Hydrocarbon skeleton text -> substituent stem: "methane" -> "methyl",
  // "ethene" -> "ethenyl", "cyclohexane" -> "cyclohexyl".
  function ylFromHydride(base) {
    if (/ane$/.test(base)) return base.slice(0, -3) + 'yl';
    return (/e$/.test(base) ? base.slice(0, -1) : base) + 'yl';
  }

  // locants may be empty (unambiguous) -> "butan-1-ol" vs "ethanol".
  function joinSuffix(base, locants, mult, text) {
    var full = (mult || '') + text;
    var stem = base;
    var vowel = /^[aeiou]/.test(full);
    if (vowel && /e$/.test(stem)) stem = stem.slice(0, -1);
    if (!locants.length) return stem + full;
    return stem + '-' + locants.join(',') + '-' + full;
  }

  // Name an acyclic carbon/heteroatom branch rooted at `root`, treated as an
  // alkyl-type substituent. Attachment atom is position 1 by construction.
  function alkylBranchName(G, root, blocked, ctx) {
    var comp = componentOf(G, root, blocked);
    for (var i = 0; i < comp.length; i++) {
      if (!NAMABLE[G.sym[comp[i]]]) return null;
    }
    // A ring as a substituent: phenyl / cyclohexyl, with its own prefixes.
    var ringOfRoot = null;
    if (ctx && ctx.ringsByAtom.has(root)) ringOfRoot = ctx.ringsByAtom.get(root);
    if (ringOfRoot) return ringBranchName(G, root, ringOfRoot, blocked, ctx);
    // A chain substituent never runs through a ring: the ring atoms hanging off
    // it come back as their own prefixes (phenyl, cyclohexyl) further down.
    comp = comp.filter(function (a) { return !ctx.ringAtoms.has(a); });

    // Longest path starting at the attachment point.
    var best = null;
    var allowed = new Set(comp);
    var paths = [];
    (function walk(cur, path) {
      if (paths.length > CANDIDATE_CAP) return;
      var extended = false;
      var nb = G.adj[cur];
      for (var k = 0; k < nb.length; k++) {
        var nxt = nb[k].to;
        if (!allowed.has(nxt) || path.indexOf(nxt) >= 0) continue;
        extended = true;
        path.push(nxt);
        walk(nxt, path);
        path.pop();
      }
      if (!extended) paths.push(path.slice());
    })(root, [root]);
    if (!paths.length) return null;

    for (i = 0; i < paths.length; i++) {
      var name = substituentChainName(G, paths[i], blocked, ctx, comp);
      if (!name) continue;
      if (!best || cmpNamePrefer(name, best) < 0) best = name;
    }
    return best;
  }

  function cmpNamePrefer(a, b) {
    // Prefer the longer skeleton, then the more unsaturated, then fewer side
    // branches, then the alphabetically first name for determinism.
    if (a.len !== b.len) return a.len > b.len ? -1 : 1;
    if (a.unsat !== b.unsat) return a.unsat > b.unsat ? -1 : 1;
    if (a.nSub !== b.nSub) return a.nSub < b.nSub ? -1 : 1;
    return a.name < b.name ? -1 : (a.name > b.name ? 1 : 0);
  }

  function substituentChainName(G, chain, blocked, ctx, comp) {
    var set = new Set(chain);
    var enes = [], ynes = [];
    for (var i = 0; i + 1 < chain.length; i++) {
      var o = G.order(chain[i], chain[i + 1]);
      if (o >= 3) ynes.push(i + 1);
      else if (o === 2) enes.push(i + 1);
      else if (Math.abs(o - 1.5) < 0.01) enes.push(i + 1);
    }
    var omit = chain.length <= 3 && enes.length + ynes.length === 1 &&
      (enes[0] === 1 || ynes[0] === 1);
    var base = hydrideBase(chain.length, enes, ynes, { elideUnsatLocants: omit });
    if (!base) return null;
    var prefixes = [];
    for (i = 0; i < chain.length; i++) {
      var nb = G.adj[chain[i]];
      for (var k = 0; k < nb.length; k++) {
        var nxt = nb[k].to;
        if (set.has(nxt) || blocked.has(nxt)) continue;
        var sub = substituentAt(G, nxt, set, blocked, ctx, true);
        if (!sub) return null;
        prefixes.push({ name: sub.name, locant: i + 1, complex: sub.complex });
      }
    }
    var txt = formatPrefixList(prefixes, chain.length === 1);
    if (txt === null) return null;
    // The point of attachment is C1 of a substituent, so its '1-yl' locant is
    // only spelled out when the chain carries no prefixes at all.
    var full = txt + ylFromHydride(base);
    return {
      name: full, len: chain.length, unsat: enes.length + ynes.length,
      nSub: prefixes.length, complex: prefixes.length > 0
    };
  }

  // A ring used as a substituent: phenyl / substituted phenyl / cyclohexyl.
  function ringBranchName(G, root, ring, blocked, ctx) {
    var inRing = new Set(ring);
    var arom = ctx.aromaticSet.has(ring.join(','));
    var len = ring.length;
    var stem = stemFor(len);
    if (!stem) return null;
    var enes = [];
    if (!arom) {
      for (var i = 0; i < len; i++) {
        var o = G.order(ring[i], ring[(i + 1) % len]);
        if (o >= 2 || Math.abs(o - 1.5) < 0.01) enes.push(i + 1);
      }
    }
    // Ring substituent numbering: walk forward (dir 0) or backward (dir 1) from
    // the attachment point, which is position 1 in both cases.
    var startIdx = ring.indexOf(root);
    if (startIdx < 0) return null;
    var step = [1, -1];
    function ringAt(k) { return ring[((startIdx + step[dir] * k) % len + len) % len]; }
    var bestTxt = null;
    for (var dir = 0; dir < 2; dir++) {
      if (dir === 1 && len === enes.length && arom) continue;
      var pos = new Map();
      for (i = 0; i < len; i++) {
        var atom = ringAt(i);
        pos.set(atom, i + 1);
      }
      var prefs = [];
      var eLoc = [];
      for (i = 0; i < len; i++) {
        var a = ringAt(i);
        var nb = G.adj[a];
        for (var k = 0; k < nb.length; k++) {
          var nxt = nb[k].to;
          if (inRing.has(nxt) || blocked.has(nxt)) continue;
          var sub = substituentAt(G, nxt, inRing, blocked, ctx, true);
          if (!sub) return null;
          prefs.push({ name: sub.name, locant: pos.get(a), complex: sub.complex });
        }
      }
      if (!arom) {
        for (i = 0; i < len; i++) {
          var a2 = ringAt(i);
          var b2 = ringAt(i + 1);
          var o2 = G.order(a2, b2);
          if (o2 >= 2 || Math.abs(o2 - 1.5) < 0.01) {
            eLoc.push(Math.min(pos.get(a2), pos.get(b2)));
          }
        }
      }
      var base;
      if (arom) {
        base = 'phenyl';
      } else {
        var hydro = hydrideBase(len, eLoc, [], { cyclo: true });
        if (!hydro) return null;
        base = ylFromHydride(hydro);
      }
      var txt = formatPrefixList(prefs, false) + base;
      if (bestTxt === null || txt < bestTxt) bestTxt = txt;
    }
    return {
      name: bestTxt, len: len, unsat: arom ? 3 : enes.length,
      nSub: 0, complex: prefsHaveDigits(bestTxt)
    };
  }

  function prefsHaveDigits(s) { return /[0-9,]/.test(s); }

  function halogenName(sym) { return HALO_PREFIX[sym] || null; }

  // Prefix descriptor for the branch that starts at `root`, off parent atom set
  // `parentSet`. `inner` marks recursive calls from inside another substituent.
  function substituentAt(G, root, parentSet, blocked, ctx, inner) {
    var g = ctx.groupRootMap.get(root);
    if (g) return groupPrefixName(G, g, parentSet, blocked, ctx, inner);
    var s = G.sym[root];
    if (HALO_PREFIX[s]) return { name: HALO_PREFIX[s], complex: false };
    if (!NAMABLE[s]) return null;
    if (s === 'C' || s === 'N' || s === 'O' || s === 'S') {
      // Heteroatom roots that were not tagged as a group.
      if (s === 'C') return alkylBranchName(G, root, union(parentSet, blocked), ctx);
      if (s === 'O') {
        var nbO = G.adj[root].filter(function (e) { return !parentSet.has(e.to) && !blocked.has(e.to); });
        if (nbO.length === 0) return G.order(root, parentEntry(G, root, parentSet)) === 2
          ? { name: 'oxo', complex: false } : { name: 'hydroxy', complex: false };
        if (nbO.length === 1 && nbO[0].order === 1) {
          var child = alkylBranchName(G, nbO[0].to, union(parentSet, new Set([root])), ctx);
          if (!child) return null;
          return { name: child.name.replace(/yl$/, '') + 'oxy', complex: child.complex };
        }
        return null;
      }
      if (s === 'S') {
        var nbS = G.adj[root].filter(function (e) { return !parentSet.has(e.to) && !blocked.has(e.to); });
        if (nbS.length === 0) return { name: G.order(root, parentEntry(G, root, parentSet)) === 2 ? 'thioxo' : 'sulfanyl', complex: false };
        if (nbS.length === 1) {
          var kid = alkylBranchName(G, nbS[0].to, union(parentSet, new Set([root])), ctx);
          if (!kid) return null;
          return { name: kid.name.replace(/yl$/, '') + 'sulfanyl', complex: kid.complex };
        }
        return null;
      }
      if (s === 'N') return aminoPrefixName(G, root, parentSet, blocked, ctx, []);
    }
    return null;
  }

  function parentEntry(G, atom, parentSet) {
    var nb = G.adj[atom];
    for (var i = 0; i < nb.length; i++) if (parentSet.has(nb[i].to)) return nb[i].to;
    return -1;
  }

  function union(a, b) {
    var out = new Set(a);
    b.forEach(function (x) { out.add(x); });
    return out;
  }

  // -NH2 / -NHR / -NR2 as a prefix: amino / alkylamino / dialkylamino.
  function aminoPrefixName(G, nAtom, parentSet, blocked, ctx, extraBlocked) {
    var arms = G.adj[nAtom].filter(function (e) {
      return !parentSet.has(e.to) && !blocked.has(e.to) &&
        (extraBlocked || []).indexOf(e.to) < 0;
    });
    if (!arms.length) return { name: 'amino', complex: false };
    var names = [];
    for (var i = 0; i < arms.length; i++) {
      if (!NAMABLE[G.sym[arms[i].to]]) return null;
      if (G.sym[arms[i].to] !== 'C') return null;
      var kid = alkylBranchName(G, arms[i].to, union(parentSet, new Set([nAtom])), ctx);
      if (!kid) return null;
      names.push({ name: kid.name.replace(/yl$/, ''), complex: kid.complex });
    }
    names.sort(function (a, b) { return a.name < b.name ? -1 : 1; });
    if (names.length === 1) {
      return { name: names[0].name + 'amino', complex: names[0].complex };
    }
    var m = multWord(names.length);
    if (!m) return null;
    var same = names.every(function (x) { return x.name === names[0].name; });
    if (same) return { name: m + names[0].name + 'amino', complex: names[0].complex };
    return null;
  }

  // Prefix text for a tagged group that lost the suffix contest.
  function groupPrefixName(G, g, parentSet, blocked, ctx, inner) {
    switch (g.kind) {
      case 'hydroxyl': return { name: 'hydroxy', complex: false };
      case 'thiol': return { name: 'sulfanyl', complex: false };
      case 'nitro': return { name: 'nitro', complex: false };
      case 'oxo': return { name: 'oxo', complex: false };
      case 'acid': return { name: 'carboxy', complex: false };
      case 'aldehyde': return { name: 'formyl', complex: false };
      case 'nitrile': return { name: 'cyano', complex: false };
      case 'amine': return aminoPrefixName(G, g.rootAtom, parentSet, blocked, ctx, []);
      case 'sulfide': {
        var otherS = pickArm(G, g.arms, parentSet);
        if (otherS === null) return null;
        var kidS = alkylBranchName(G, otherS, union(parentSet, new Set([g.rootAtom])), ctx);
        if (!kidS) return null;
        // A thioether keeps the full alkyl name: "ethylsulfanyl", not "eth-".
        return { name: kidS.name + 'sulfanyl', complex: kidS.complex };
      }
      case 'ether': {
        var other = pickArm(G, g.arms, parentSet);
        if (other === null) return null;
        var kid = alkylBranchName(G, other, union(parentSet, new Set([g.rootAtom])), ctx);
        if (!kid) return null;
        return { name: kid.name.replace(/yl$/, '') + 'oxy', complex: kid.complex };
      }
      case 'ketone': {
        // Carbonyl carbon inside the parent -> oxo; outside -> acyl-type prefix.
        if (parentSet.has(g.attach[0])) return { name: 'oxo', complex: false };
        var arms = G.adj[g.attach[0]].filter(function (e) {
          return !parentSet.has(e.to) && e.to !== g.atoms[1];
        });
        if (arms.length !== 1) return null;
        var kidk = alkylBranchName(G, arms[0].to, union(parentSet, new Set(g.atoms)), ctx);
        if (!kidk) return null;
        var stemk = kidk.name.replace(/yl$/, '');
        if (stemk === 'methyl') return { name: 'acetyl', complex: false };
        if (stemk === 'ethenyl' || stemk === 'vinyl') return { name: 'formyl', complex: false };
        return { name: stemk + 'carbonyl', complex: kidk.complex };
      }
      case 'ester': {
        var kid2 = alkylBranchName(G, g.alkylRoot, union(parentSet, new Set(g.atoms)), ctx);
        if (!kid2) return null;
        return { name: kid2.name.replace(/yl$/, '') + 'oxycarbonyl', complex: kid2.complex };
      }
      case 'acylhalide': {
        return { name: (HALO_PREFIX[g.halSym] || '').replace(/o$/, '') + 'carbonyl', complex: false };
      }
      case 'amide': {
        var arms3 = G.adj[g.nAtom].filter(function (e) { return !parentSet.has(e.to) && e.to !== g.attach[0]; });
        if (!arms3.length) return { name: 'carbamoyl', complex: false };
        return null;
      }
      default:
        return null;
    }
  }

  // For a two-armed group (ether, sulfide): the arm that is not the parent side.
  function pickArm(G, arms, parentSet) {
    var inParent = arms.filter(function (a) { return parentSet.has(a); });
    var out = arms.filter(function (a) { return !parentSet.has(a); });
    if (arms.length === 2 && inParent.length === 1 && out.length === 1) return out[0];
    if (arms.length === 2 && inParent.length === 0 && out.length === 2) return out[0];
    return null;
  }

  // ---------------------------------------------------------------------------
  // Parent selection and name assembly
  // ---------------------------------------------------------------------------

  // Collect every group's atoms plus ring atoms that must stay out of a chain.
  function buildContext(G) {
    var det = detectGroups(G);
    if (!det) return null;
    var rings = findRings(G);
    var aromaticList = [];
    var aromaticSet = new Set();
    var ringsByAtom = new Map();
    for (var i = 0; i < rings.length; i++) {
      // Heterocycles, fused and spiro systems are out of scope: bail to null so
      // the caller keeps using the old namer instead of showing a wrong name.
      for (var t = 0; t < rings[i].length; t++) {
        if (G.sym[rings[i][t]] !== 'C') return null;
        var a = rings[i][t];
        if (ringsByAtom.has(a)) return null;
        ringsByAtom.set(a, rings[i]);
      }
      if (isAromaticRing(G, rings[i])) {
        aromaticList.push(rings[i]);
        aromaticSet.add(rings[i].join(','));
      }
    }
    var groupRootMap = new Map();
    for (i = 0; i < det.groups.length; i++) {
      var g = det.groups[i];
      var root = g.rootAtom !== undefined ? g.rootAtom : g.atoms[0];
      if (!groupRootMap.has(root)) groupRootMap.set(root, g);
    }
    var ringAtoms = new Set();
    rings.forEach(function (r) { r.forEach(function (a) { ringAtoms.add(a); }); });
    return {
      groups: det.groups, consumed: det.consumed, rings: rings,
      aromatic: aromaticList, aromaticSet: aromaticSet,
      ringsByAtom: ringsByAtom, groupRootMap: groupRootMap, ringAtoms: ringAtoms
    };
  }

  function chooseSuffixKind(groups) {
    for (var p = 0; p < SUFFIX_ORDER.length; p++) {
      for (var i = 0; i < groups.length; i++) {
        if (groups[i].kind === SUFFIX_ORDER[p]) return SUFFIX_ORDER[p];
      }
    }
    return null;
  }

  // All simple paths inside a set of allowed nodes, by endpoint pair (the graph
  // induced by `allowed` is a forest for chain parents, so one path per pair).
  function enumerateChains(G, allowed) {
    var nodes = [];
    allowed.forEach(function (a) { nodes.push(a); });
    nodes.sort(cmpNum);
    var out = [];
    for (var s = 0; s < nodes.length; s++) {
      // BFS from each start over allowed nodes only; every reached node yields
      // exactly one path in a tree.
      var prev = new Map();
      var queue = [nodes[s]];
      prev.set(nodes[s], -1);
      while (queue.length) {
        var cur = queue.shift();
        out.push(pathOf(prev, cur));
        var nb = G.adj[cur];
        for (var k = 0; k < nb.length; k++) {
          var nxt = nb[k].to;
          if (!allowed.has(nxt) || prev.has(nxt)) continue;
          prev.set(nxt, cur);
          queue.push(nxt);
        }
      }
      if (out.length > CANDIDATE_CAP * 4) break;
    }
    // Keep maximal-ish candidates: drop nothing, the scorer does the work.
    return out;
  }

  function pathOf(prev, end) {
    var out = [];
    var cur = end;
    while (cur !== -1 && cur !== undefined) {
      out.push(cur);
      cur = prev.get(cur);
    }
    out.reverse();
    return out;
  }

  // Chain candidates for a molecule with rings: chains live in the forest that
  // hangs off the ring atoms, so ring atoms themselves are not chain members
  // (their ring is chosen as parent instead, or they come back as -phenyl).
  function chainAllowedSet(G, ctx, suffixKind, suffixGroups) {
    var allowed = new Set();
    var terminalCarbons = new Set();
    for (var i = 0; i < ctx.groups.length; i++) {
      var g = ctx.groups[i];
      if (!g.terminal || g.kind === suffixKind) continue;
      // Carbonyl/nitrile carbons of a group that is only a prefix stay out of
      // the parent chain: -COOH reads as "carboxy", -CN as "cyano".
      if (['acid', 'ester', 'acylhalide', 'amide', 'nitrile', 'aldehyde'].indexOf(g.kind) >= 0) {
        terminalCarbons.add(g.attach[0]);
      }
    }
    for (i = 0; i < G.heavy.length; i++) {
      var a = G.heavy[i];
      if (G.sym[a] !== 'C') continue;
      if (ctx.ringAtoms.has(a)) continue;
      if (terminalCarbons.has(a)) continue;
      allowed.add(a);
    }
    return allowed;
  }

  // Is the suffix compatible with an aromatic ring parent? Only when the group
  // hangs directly off the ring (phenol, aniline, benzoic acid, ...).
  function arylSuffixOk(G, ctx, suffixKind, suffixGroups, ring) {
    if (!suffixKind) return true;
    var inRing = new Set(ring);
    if (suffixKind === 'ketone') return false;
    if (suffixKind === 'amine' || suffixKind === 'hydroxyl' || suffixKind === 'thiol') {
      return suffixGroups.some(function (g) { return g.attach.some(function (a) { return inRing.has(a); }); });
    }
    // terminal group carbon outside the ring, attached to exactly one atom: the
    // ring carbon -> benzoic acid / benzaldehyde / benzonitrile / benzamide
    if (SUFFIX_INFO[suffixKind] && SUFFIX_INFO[suffixKind].terminal) {
      return suffixGroups.every(function (g) {
        if (g.attach.length !== 1) return false;
        var c = g.attach[0];
        if (inRing.has(c)) return false;
        var nb = G.adj[c].filter(function (e) {
          return ctx.consumed.has(e.to) && !inRing.has(e.to) ? false : true;
        });
        var carbonNb = G.adj[c].filter(function (e) { return G.sym[e.to] === 'C'; });
        return carbonNb.length === 1 && inRing.has(carbonNb[0].to);
      });
    }
    return false;
  }
  // Alphabetical, multiplicative, locanted prefix text:
  // "2-bromo-3-chloro", "2,2-dimethyl", "N-ethyl", "4-(1-methylethyl)".
  // Multiplicative prefixes never affect alphabetisation, so the ordering key is
  // the first letter of the bare substituent name.
  function formatPrefixList(items, omitNumericLocants) {
    if (!items.length) return '';
    var byName = new Map();
    for (var i = 0; i < items.length; i++) {
      if (!byName.has(items[i].name)) byName.set(items[i].name, []);
      byName.get(items[i].name).push(items[i]);
    }
    var groups = [];
    byName.forEach(function (list, name) {
      var locs = list.map(function (x) { return x.locant; });
      var numeric = locs.every(function (x) { return typeof x === 'number'; });
      var complex = list.some(function (x) { return x.complex; }) || /[0-9,]/.test(name);
      groups.push({
        name: name,
        locants: numeric ? locs.slice().sort(cmpNum) : locs.slice().sort(),
        count: locs.length,
        numeric: numeric,
        alpha: alphaKeyOf(name),
        complex: complex
      });
    });
    groups.sort(function (a, b) {
      if (a.alpha !== b.alpha) return a.alpha < b.alpha ? -1 : 1;
      if (a.numeric !== b.numeric) return a.numeric ? -1 : 1;
      if (a.numeric) {
        var c = cmpLocants(a.locants, b.locants);
        if (c !== 0) return c;
      }
      return a.name < b.name ? -1 : (a.name > b.name ? 1 : 0);
    });
    var parts = [];
    for (i = 0; i < groups.length; i++) {
      var gr = groups[i];
      var m = '';
      if (gr.count > 1) {
        // Bracketed (composite) substituent names take bis/tris/tetrakis.
        m = gr.complex ? (BIS[gr.count] || null) : multWord(gr.count);
        if (!m) return null;
      }
      var body = m + (gr.complex ? '(' + gr.name + ')' : gr.name);
      var show = !(omitNumericLocants && gr.numeric);
      parts.push((show ? gr.locants.join(',') + '-' : '') + body);
    }
    return parts.join('-');
  }

  // ---------------------------------------------------------------------------
  // Parent / suffix resolution
  // ---------------------------------------------------------------------------

  // A suffix group is usable on this parent when its attachment atom belongs to
  // the parent skeleton. Terminal groups (-COOH, -CHO, -CN, -CONH2, -COX, esters)
  // additionally have to own position 1 of a chain, or hang off exactly one ring
  // carbon with no other carbon arm: the benzoic acid / cyclohexanecarboxylic
  // acid pattern, where the group carbon is not a skeletal atom at all.
  function usableSuffix(G, suffixGroups, parentSet, pos, ring) {
    var out = [];
    for (var i = 0; i < suffixGroups.length; i++) {
      var g = suffixGroups[i];
      if (!g.attach || !g.attach.length) continue;
      var inParent = g.attach.filter(function (a) { return parentSet.has(a); });
      if (g.terminal) {
        if (ring) {
          if (inParent.length) { out.push(g); continue; }
          var arm = G.adj[g.attach[0]].filter(function (e) { return parentSet.has(e.to); });
          var otherC = G.adj[g.attach[0]].filter(function (e) {
            return G.sym[e.to] === 'C' && !parentSet.has(e.to);
          });
          if (arm.length === 1 && !otherC.length) out.push(g);
        } else if (inParent.length) {
          // A terminal group owns an end of the chain: position 1, or the last
          // position when the chain runs the other way (dioic acids, dialdehydes).
          var p = pos.get(inParent[0]);
          if (p === 1 || p === parentSet.size) out.push(g);
        }
      } else if (inParent.length) out.push(g);
    }
    return out;
  }

  // Locants of the principal characteristic group on this parent, used for
  // numbering (lowest locants) and therefore including the terminal groups that
  // own a chain end or hang off a ring carbon.
  function suffixLocants(G, usable, parentSet, pos) {
    var out = [];
    for (var i = 0; i < usable.length; i++) {
      var g = usable[i];
      for (var k = 0; k < g.attach.length; k++) {
        if (parentSet.has(g.attach[k])) { out.push(pos.get(g.attach[k])); continue; }
        if (!g.terminal) continue;
        // Terminal group outside the parent: score the ring atom carrying it.
        var arm = G.adj[g.attach[0]].filter(function (e) { return parentSet.has(e.to); });
        if (arm.length === 1) out.push(pos.get(arm[0].to));
      }
    }
    return out.sort(cmpNum);
  }

  function atomSetOfGroups(groups) {
    var s = new Set();
    for (var i = 0; i < groups.length; i++) {
      if (!groups[i]) continue;
      for (var t = 0; t < groups[i].atoms.length; t++) s.add(groups[i].atoms[t]);
      if (groups[i].rootAtom !== undefined) s.add(groups[i].rootAtom);
    }
    return s;
  }

  // Double and triple bonds inside the chosen parent. An aromatic ring carries
  // no spelled-out unsaturation at all: "benzene", never "cyclohexa-1,3,5-triene".
  function readUnsaturation(G, cand, enes, ynes) {
    var i, n = cand.parent.length;
    if (cand.ring) {
      if (cand.arom) return;
      for (i = 0; i < n; i++) {
        var o = G.order(cand.parent[i], cand.parent[(i + 1) % n]);
        if (o >= 3) ynes.push(cand.pos.get(cand.parent[i]));
        else if (o === 2 || Math.abs(o - 1.5) < 0.01) enes.push(cand.pos.get(cand.parent[i]));
      }
      return;
    }
    for (i = 0; i + 1 < n; i++) {
      var o2 = G.order(cand.parent[i], cand.parent[i + 1]);
      if (o2 >= 3) ynes.push(i + 1);
      else if (o2 === 2 || Math.abs(o2 - 1.5) < 0.01) enes.push(i + 1);
    }
  }

  function attachmentPoints(G, parentSet, claimed, pos) {
    var out = [];
    var list = Array.from(parentSet).sort(cmpNum);
    for (var i = 0; i < list.length; i++) {
      var nb = G.adj[list[i]];
      for (var k = 0; k < nb.length; k++) {
        if (parentSet.has(nb[k].to) || claimed.has(nb[k].to)) continue;
        out.push(pos.get(list[i]));
        break;
      }
    }
    return out.sort(cmpNum);
  }

  // Numbering score. The `max` tuple is bigger-is-better (suffix membership,
  // skeletal length, unsaturation, number of prefix-bearing atoms), the `tuples`
  // of locant sets are lower-is-better and applied in IUPAC rule order.
  function orientationScore(G, ctx, cand, suffixGroups) {
    var parentSet = new Set(cand.parent);
    var usable = usableSuffix(G, suffixGroups, parentSet, cand.pos, !!cand.ring);
    var enes = [], ynes = [], i;
    var suffLoc = suffixLocants(G, usable, parentSet, cand.pos);
    readUnsaturation(G, cand, enes, ynes);
    var prefLoc = attachmentPoints(G, parentSet, atomSetOfGroups(usable), cand.pos);
    return {
      max: [usable.length, cand.parent.length, enes.length + ynes.length, prefLoc.length],
      tuples: [suffLoc.slice().sort(cmpNum), enes.concat(ynes).slice().sort(cmpNum), prefLoc]
    };
  }

  // Ring numbering: try every legitimate position 1 (the suffix-bearing carbon
  // first, otherwise every substituted ring atom) in both directions. All the
  // numberings that tie on score are returned, so the caller can break the tie
  // on the assembled name and stay independent of the atom input order.
  function bestRingOrientation(G, ctx, ring, suffixGroups, suffixKind) {
    var inRing = new Set(ring);
    var starts = [];
    var i, k;
    if (suffixKind) {
      for (i = 0; i < suffixGroups.length; i++) {
        var g = suffixGroups[i];
        if (!g.attach.length) continue;
        if (g.terminal) {
          if (inRing.has(g.attach[0])) {
            if (starts.indexOf(g.attach[0]) < 0) starts.push(g.attach[0]);
          } else {
            var arm = G.adj[g.attach[0]].filter(function (e) { return inRing.has(e.to); });
            var otherC = G.adj[g.attach[0]].filter(function (e) {
              return G.sym[e.to] === 'C' && !inRing.has(e.to);
            });
            if (arm.length === 1 && !otherC.length && starts.indexOf(arm[0].to) < 0) {
              starts.push(arm[0].to);
            }
          }
        } else {
          for (k = 0; k < g.attach.length; k++) {
            if (inRing.has(g.attach[k]) && starts.indexOf(g.attach[k]) < 0) starts.push(g.attach[k]);
          }
        }
      }
    }
    if (!starts.length) {
      for (i = 0; i < ring.length; i++) {
        if (G.adj[ring[i]].some(function (e) { return !inRing.has(e.to); })) starts.push(ring[i]);
      }
    }
    if (!starts.length) starts.push(ring[0]);
    var best = null;
    var tied = [];
    var step = [1, -1];
    for (i = 0; i < starts.length; i++) {
      var sIdx = ring.indexOf(starts[i]);
      if (sIdx < 0) continue;
      for (var dir = 0; dir < 2; dir++) {
        var ordered = [];
        var pos = new Map();
        for (k = 0; k < ring.length; k++) {
          var atom = ring[((sIdx + step[dir] * k) % ring.length + ring.length) % ring.length];
          ordered.push(atom);
          pos.set(atom, k + 1);
        }
        var cand = { parent: ordered, pos: pos, ring: true, arom: ctx.aromaticSet.has(ring.join(',')) };
        cand.score = orientationScore(G, ctx, cand, suffixGroups);
        var c = best === null ? -1 : cmpCandidate(cand.score, best.score);
        if (c < 0) { best = cand; tied = [cand]; }
        else if (c === 0) tied.push(cand);
      }
    }
    return tied.length ? tied : null;
  }

  // Does a terminal group hang straight off a ring carbon? (benzoic acid yes,
  // phenylacetic acid no - that one is named as a chain.)
  function anchoredToRings(G, g, ringAtoms) {
    if (!g.attach.length) return false;
    var c = g.attach[0];
    if (ringAtoms.has(c)) return true;
    var arm = G.adj[c].filter(function (e) { return ringAtoms.has(e.to); });
    var otherC = G.adj[c].filter(function (e) { return G.sym[e.to] === 'C' && !ringAtoms.has(e.to); });
    return arm.length === 1 && !otherC.length;
  }

  // Every substituent hanging off the chosen parent, as {name, locant, complex}.
  // Atoms of the groups acting as the suffix are skipped: they are already in the
  // suffix text, and losing suffix candidates stay visible for this walk, so a
  // second -OH reads as "hydroxy" and a ketone beaten by an acid reads as "oxo".
  function collectPrefixes(G, ctx, parentSet, pos, suffixKind, usable) {
    var keep = atomSetOfGroups(usable);
    var prefixes = [];
    var list = Array.from(parentSet).sort(cmpNum);
    var i, k;
    for (i = 0; i < list.length; i++) {
      var nb = G.adj[list[i]];
      for (k = 0; k < nb.length; k++) {
        var nxt = nb[k].to;
        if (parentSet.has(nxt) || keep.has(nxt)) continue;
        var sub = substituentAt(G, nxt, parentSet, EMPTY_SET, ctx, false);
        if (!sub) return null;
        prefixes.push({ name: sub.name, locant: pos.get(list[i]), complex: !!sub.complex });
      }
    }
    if (suffixKind === 'amide' || suffixKind === 'amine') {
      for (i = 0; i < usable.length; i++) {
        var g = usable[i];
        var nAtom = g.kind === 'amide' ? g.nAtom : g.rootAtom;
        if (nAtom === undefined) continue;
        var arms = G.adj[nAtom].filter(function (e) {
          return !parentSet.has(e.to) && !keep.has(e.to) && G.sym[e.to] === 'C';
        });
        var seen = new Set();
        for (k = 0; k < arms.length; k++) {
          if (seen.has(arms[k].to)) continue;
          seen.add(arms[k].to);
          var kid = alkylBranchName(G, arms[k].to, union(parentSet, new Set([nAtom])), ctx);
          if (!kid) return null;
          prefixes.push({ name: kid.name, locant: 'N', complex: !!kid.complex });
        }
      }
    }
    return prefixes;
  }

  // One fully numbered parent, assembled into a name.
  function assembleName(G, ctx, sel) {
    var parentSet = new Set(sel.parent);
    var suffixKind = sel.suffixKind;
    var info = suffixKind ? SUFFIX_INFO[suffixKind] : null;
    var usable = usableSuffix(G, sel.suffixGroups, parentSet, sel.pos, !!sel.ring);
    var enes = [], ynes = [], i, k;
    readUnsaturation(G, sel, enes, ynes);
    var prefixes = collectPrefixes(G, ctx, parentSet, sel.pos, suffixKind, usable);
    if (!prefixes) return null;

    var suffLoc = [];
    for (i = 0; i < usable.length; i++) {
      if (usable[i].terminal) continue;
      for (k = 0; k < usable[i].attach.length; k++) {
        if (parentSet.has(usable[i].attach[k])) suffLoc.push(sel.pos.get(usable[i].attach[k]));
      }
    }
    suffLoc.sort(cmpNum);
    var suffCount = 0;
    for (i = 0; i < usable.length; i++) {
      if (usable[i].terminal) suffCount++;
      else suffCount += usable[i].attach.filter(function (a) { return parentSet.has(a); }).length;
    }
    var mult = suffCount > 1 ? multWord(suffCount) : '';
    if (suffCount > 1 && mult === null) return null;
    // Terminal group on a ring parent: "cyclohexanecarboxylic acid".
    var ringAnchor = !!(sel.ring && info && info.terminal);

    // Redundant locants are dropped only where a single position exists: a one
    // or two carbon chain with nothing else on it, an unsubstituted ring, a
    // mono-substituted ring with no characteristic group. More than one suffix
    // group always needs its locants ("ethane-1,2-diol").
    var oneSpot = suffCount <= 1;
    var omitSuffixLocants = oneSpot && (
      (!sel.ring && sel.parent.length <= 2) ||
      (sel.ring && suffLoc.length <= 1 && prefixes.length === 0 && !enes.length && !ynes.length) ||
      ringAnchor);
    var numericPrefix = prefixes.every(function (p) { return typeof p.locant === 'number'; });
    var noUnsat = !enes.length && !ynes.length;
    var omitPrefixLocants = !numericPrefix ? false : (
      (!sel.ring && sel.parent.length <= 1) ||
      (!sel.ring && sel.parent.length === 2 && prefixes.length === 1 && !suffixKind) ||
      (sel.ring && prefixes.length === 1 && !suffixKind && noUnsat) ||
      (sel.arom && prefixes.length === 1 && !suffixKind));
    var elideUnsat = false;
    if (!sel.arom && enes.length + ynes.length === 1) {
      var loc = enes.length ? enes[0] : ynes[0];
      if (!sel.ring && loc === 1 && sel.parent.length <= 3) elideUnsat = true;
      if (sel.ring && prefixes.length === 0 && suffLoc.length === 0) elideUnsat = true;
    }

    var nameCore, sysCore;
    var polySpots = null;
    if (suffCount > 1 && (sel.ring || sel.arom)) {
      // On a ring parent every locant has to be shown and the numbering must
      // start on one of the characteristic groups.
      polySpots = suffixLocants(G, usable, parentSet, sel.pos);
      if (!polySpots.length || polySpots[0] !== 1) return null;
    }

    if (sel.arom) {
      if (suffCount > 1) {
        // The retained mono parents (phenol, aniline, benzoic acid) cannot
        // carry two groups, so fall back to the substitutive benzene series:
        // "benzene-1,2-diol", "benzene-1,3-dicarboxylic acid".
        var aromAnchor = ringAnchor ? RING_ANCHOR_SUFFIX[suffixKind] : null;
        if (ringAnchor && !aromAnchor) return null;
        nameCore = 'benzene-' + polySpots.join(',') + '-' + mult +
          (ringAnchor ? aromAnchor : info.text);
        sysCore = nameCore;
      } else {
        var ret = retainedArene(suffixKind, prefixes);
        if (!ret) return null;
        if (ret.drop) {
          prefixes = prefixes.filter(function (p) { return p.name !== ret.drop; });
        }
        nameCore = ret.name;
        sysCore = ret.sys;
      }
    } else {
      var base = hydrideBase(sel.parent.length, enes, ynes, {
        cyclo: !!sel.ring, elideUnsatLocants: elideUnsat
      });
      if (!base) return null;
      if (!suffixKind) {
        nameCore = base;
      } else if (ringAnchor) {
        var anchorText = RING_ANCHOR_SUFFIX[suffixKind];
        if (!anchorText) return null;
        nameCore = suffCount > 1
          ? base + '-' + polySpots.join(',') + '-' + mult + anchorText
          : base + anchorText;
      } else {
        nameCore = joinSuffix(base, omitSuffixLocants ? [] : suffLoc, mult, info.text);
      }
      sysCore = nameCore;
    }

    var prefixText = formatPrefixList(prefixes, omitPrefixLocants);
    if (prefixText === null) return null;
    var name = prefixText + nameCore;
    var systematic = prefixText + sysCore;
    if (suffixKind === 'acylhalide') {
      var saltWord = HALO_SALT[sel.acylHalSym];
      if (!saltWord) return null;
      name += ' ' + saltWord;
      systematic += ' ' + saltWord;
    }
    if (suffixKind === 'ester') {
      if (!sel.esterAlkyl) return null;
      name = sel.esterAlkyl + ' ' + name;
      systematic = sel.esterAlkyl + ' ' + systematic;
    }
    if (!name) return null;
    return {
      name: cap(name),
      systematic: cap(systematic),
      className: classify(sel, suffixKind, prefixes, enes, ynes, !!sel.ring, !!sel.arom),
      functionalGroup: functionalGroupLabel(suffixKind, prefixes, enes, ynes, !!sel.arom)
    };
  }

  // Retained aromatic parents. Toluene and anisole only apply to the
  // mono-substituted ring; once a characteristic group is present the
  // phenol / aniline / benzoic acid series takes over.
  function retainedArene(suffixKind, prefixes) {
    if (suffixKind) {
      var e = ARENES[suffixKind];
      if (!e) return null;
      return { name: e.name, sys: e.name };
    }
    if (prefixes.length === 1) {
      if (prefixes[0].name === 'methyl') {
        return { name: ARENES.methyl.name, sys: ARENES.methyl.sys, drop: 'methyl' };
      }
      if (prefixes[0].name === 'methoxy') {
        return { name: ARENES.methoxy.name, sys: ARENES.methoxy.sys, drop: 'methoxy' };
      }
    }
    return ARENES.none;
  }

  function classify(sel, suffixKind, prefixes, enes, ynes, isRing, arom) {
    if (suffixKind) {
      if (arom && suffixKind === 'hydroxyl') return 'phenol';
      if (arom && suffixKind === 'amine') return 'aromatic amine';
      return SUFFIX_INFO[suffixKind].cls;
    }
    var names = prefixes.map(function (p) { return p.name; });
    var halo = ['fluoro', 'chloro', 'bromo', 'iodo'];
    if (names.indexOf('nitro') >= 0) return 'nitro compound';
    if (names.some(function (x) { return /[a-z]sulfanyl$/.test(x); })) return 'thioether';
    if (names.some(function (x) { return /oxy$/.test(x); })) return 'ether';
    if (names.some(function (x) { return halo.indexOf(x) >= 0; })) {
      return arom ? 'haloarene' : (isRing ? 'cycloalkyl halide' : 'haloalkane');
    }
    if (arom) return 'arene';
    if (ynes.length) return isRing ? 'cycloalkyne' : 'alkyne';
    if (enes.length) return isRing ? 'cycloalkene' : 'alkene';
    if (isRing) return 'cycloalkane';
    return 'alkane';
  }

  function functionalGroupLabel(suffixKind, prefixes, enes, ynes, arom) {
    var labels = [];
    if (arom) labels.push('aromatic ring');
    if (suffixKind) labels.push(SUFFIX_INFO[suffixKind].fg);
    var names = prefixes.map(function (p) { return p.name; });
    if (names.indexOf('nitro') >= 0) labels.push('nitro (-NO2)');
    if (names.some(function (x) { return /oxy$/.test(x) && x.indexOf('oxo') !== 0; })) {
      labels.push('ether (C-O-C)');
    }
    if (names.indexOf('sulfanyl') >= 0) labels.push('sulfhydryl (-SH)');
    if (names.some(function (x) { return /[a-z]sulfanyl$/.test(x); })) {
      labels.push('thioether (C-S-C)');
    }
    if (names.some(function (x) { return ['fluoro', 'chloro', 'bromo', 'iodo'].indexOf(x) >= 0; })) {
      labels.push('halo (C-X)');
    }
    if (names.indexOf('hydroxy') >= 0) labels.push('hydroxyl (-OH)');
    if (names.indexOf('oxo') >= 0 && !suffixKind) labels.push('carbonyl (>C=O)');
    if (names.indexOf('amino') >= 0) labels.push('amino (-NH2)');
    if (!labels.length) {
      if (ynes.length) return 'carbon-carbon triple bond';
      if (enes.length) return 'carbon-carbon double bond';
      return 'none (hydrocarbon)';
    }
    return labels.join('; ');
  }

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // ── PHASE 1/2 VALIDITY GATES (structure ⇄ formula consistency) ──────────────
  // These turn "I picked a parent and printed a name" into "I proved the name can
  // describe THIS molecule". A candidate is refused (nameGraph returns null, the
  // bundle then falls back to its safe canonical string) unless every gate holds.

  // Maximum covalence per element (neutral closed-shell). Nitrogen carries 5 for
  // nitro-N-oxide style, sulfur 6 for sulfones; anything over the cap is hypervalent
  // for this namer and cannot be named honestly.
  var VALENCE_CAP = { C: 4, N: 5, O: 3, S: 6, F: 1, Cl: 1, Br: 1, I: 1 };

  // Index of hydrogen deficiency straight from the molecular formula:
  //   IHD = (2C + 2 + N − H − X) / 2   (O and S are ignored: they do not change it).
  function formulaIHD(counts) {
    var C = counts.C || 0;
    var N = counts.N || 0;
    var mono = (counts.H || 0) + (counts.F || 0) + (counts.Cl || 0) + (counts.Br || 0) + (counts.I || 0);
    return (2 * C + 2 + N - mono) / 2;
  }

  // Rings + π-bonds implied by the BOND GRAPH: rings = cyclomatic number of the
  // heavy-atom skeleton, π = Σ(order − 1) (so a Kekulé/aromatic 1.5 contact counts
  // as half a double bond). Must match formulaIHD or the drawn bonds contradict the
  // atom counts (the "1-methylcycloprop-2-yne" class of bug).
  function graphUnsat(G) {
    var edges = 0, pi = 0, seen = new Set();
    for (var a = 0; a < G.heavy.length; a++) {
      var u = G.heavy[a], nb = G.adj[u];
      for (var q = 0; q < nb.length; q++) {
        var v = nb[q].to;
        var key = u < v ? u + ':' + v : v + ':' + u;
        if (seen.has(key)) continue;
        seen.add(key);
        edges++;
        var o = nb[q].order;
        if (o > 1) pi += o - 1;
      }
    }
    // connected heavy skeleton assumed (buildGraph already enforces one fragment).
    var rings = edges - G.heavy.length + 1;
    return { rings: rings, pi: pi, total: rings + pi };
  }

  // A triple bond cannot sit inside a ring smaller than eight atoms (the linear
  // sp carbon cannot span the geometry), and a ring's π must respect valence caps.
  function smallRingTripleBond(G, rings) {
    for (var r = 0; r < rings.length; r++) {
      var ring = rings[r];
      if (ring.length >= 8) continue;
      for (var m = 0; m < ring.length; m++) {
        var x = ring[m], y = ring[(m + 1) % ring.length];
        if (G.order(x, y) >= 2.6) return true;
      }
    }
    return false;
  }

  // Every heavy atom's summed bond order (hydrogens count 1 each) must stay within
  // its valence cap; a carbon with five bonds or an oxygen with three is rejected.
  function hypervalent(G) {
    for (var i = 0; i < G.heavy.length; i++) {
      var at = G.heavy[i], c = VALENCE_CAP[G.sym[at]];
      if (c === undefined) continue;
      var sum = G.hCount[at], nb = G.adj[at];
      for (var q = 0; q < nb.length; q++) sum += nb[q].order;
      if (sum > c + 0.001) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // Top-level naming
  // ---------------------------------------------------------------------------

  function nameGraph(G) {
    if (!G) return null;
    var counts = G.counts;
    if (!counts.C) return null;
    for (var i = 0; i < G.heavy.length; i++) {
      if (!NAMABLE[G.sym[G.heavy[i]]]) return null;
    }
    if ((counts.C || 0) > STEM.length) return null;

    // A linkage between two non-carbon skeleton atoms is not a carbon chain, and
    // the rules below would name it as one: CH3-O-O-CH3 came back as
    // "Ethoxymethane", whose own formula is not the molecule's. Nitro-type
    // groups (a carbon-bonded N carrying terminal O) are the family actually
    // implemented, so every other hetero-hetero join is refused, not guessed.
    function carbonNeighbour(at) {
      var nb = G.adj[at];
      for (var p = 0; p < nb.length; p++) if (G.sym[nb[p].to] === 'C') return true;
      return false;
    }
    function terminalO(at) { return G.sym[at] === 'O' && G.adj[at].length === 1; }
    for (i = 0; i < G.heavy.length; i++) {
      var hA = G.heavy[i];
      if (G.sym[hA] === 'C') continue;
      var nbrA = G.adj[hA];
      for (var q = 0; q < nbrA.length; q++) {
        var hB = nbrA[q].to;
        if (G.sym[hB] === 'C') continue;
        var nitroPair = (G.sym[hA] === 'N' && carbonNeighbour(hA) && terminalO(hB)) ||
          (G.sym[hB] === 'N' && carbonNeighbour(hB) && terminalO(hA));
        if (!nitroPair) return null;
      }
    }

    // An oxygen with one single bond and no hydrogen is neither a hydroxyl nor a
    // carbonyl: CH3-C(O)(-H2)-O-H was being named "Ethane-1,1-diol", which claims
    // a hydrogen this molecule does not have. Neutral closed-shell chemistry puts
    // that oxygen on a charge (carboxylate) or on nitrogen (nitro, above), and the
    // charged case never reaches this function, so the shape is refused.
    for (i = 0; i < G.heavy.length; i++) {
      var oAtom2 = G.heavy[i];
      if (G.sym[oAtom2] !== 'O') continue;
      var oNbrs = G.adj[oAtom2];
      if (oNbrs.length !== 1 || G.hCount[oAtom2] !== 0) continue;
      var oPartner = oNbrs[0].to;
      if (G.order(oAtom2, oPartner) !== 1) continue;
      if (G.sym[oPartner] === 'N') continue;
      return null;
    }

    var ctx = buildContext(G);
    if (!ctx) return null;

    // PHASE 1 — valence: reject hypervalent / impossible atoms before naming.
    if (hypervalent(G)) return null;
    // PHASE 2 — IHD gate: the bonds in the graph must account for exactly the
    // degree of unsaturation the formula demands, and no impossible cycloalkyne.
    var wantIHD = formulaIHD(counts);
    var have = graphUnsat(G);
    if (Math.abs(have.total - wantIHD) > 0.001) return null;
    if (smallRingTripleBond(G, ctx.rings)) return null;

    var suffixKind = chooseSuffixKind(ctx.groups);
    var suffixGroups = suffixKind
      ? ctx.groups.filter(function (g) { return g.kind === suffixKind; })
      : [];
    var info = suffixKind ? SUFFIX_INFO[suffixKind] : null;
    var acylHalSym = suffixKind === 'acylhalide' ? suffixGroups[0].halSym : null;
    var esterAlkyl = null;
    if (suffixKind === 'ester') {
      // The alcohol side of an ester is a separate word, never a prefix. When
      // one molecule carries several ester groups they must all be the same
      // simple alkyl ("dimethyl butanedioate"); anything else is left to the
      // formula namer.
      var blockedEst = atomSetOfGroups(suffixGroups);
      var alkylWords = [];
      var sameAlkyl = true;
      for (var qe = 0; qe < suffixGroups.length; qe++) {
        var kide = alkylBranchName(G, suffixGroups[qe].alkylRoot, blockedEst, ctx);
        if (!kide) return null;
        if (qe && (kide.name !== alkylWords[0] || kide.complex)) sameAlkyl = false;
        alkylWords.push(kide.name);
      }
      if (!sameAlkyl) return null;
      if (alkylWords.length > 1) {
        var alkMult = multWord(alkylWords.length);
        if (alkMult === null) return null;
        esterAlkyl = alkMult + alkylWords[0];
      } else {
        esterAlkyl = alkylWords[0];
      }
    }

    var candidates = [];
    var j, k;

    // 1. aromatic ring parents (benzene series and its retained names)
    if (ctx.aromatic.length && arylSuffixOk(G, ctx, suffixKind, suffixGroups, ctx.aromatic[0])) {
      for (i = 0; i < ctx.aromatic.length; i++) {
        if (!arylSuffixOk(G, ctx, suffixKind, suffixGroups, ctx.aromatic[i])) continue;
        var ori = bestRingOrientation(G, ctx, ctx.aromatic[i], suffixGroups, suffixKind);
        if (!ori) continue;
        for (j = 0; j < ori.length; j++) candidates.push(ori[j]);
      }
    }

    // 2. saturated / unsaturated carbocyclic parents. The ring wins when it
    // carries the principal characteristic group, or when it is at least as
    // crowded as the longest chain available.
    if (!candidates.length && !ctx.aromatic.length && ctx.rings.length) {
      var biggestRing = 0;
      for (i = 0; i < ctx.rings.length; i++) biggestRing = Math.max(biggestRing, ctx.rings[i].length);
      var suffixOnRing = suffixGroups.some(function (g) {
        return g.attach.some(function (a) { return ctx.ringAtoms.has(a); });
      });
      var suffixAnchored = suffixGroups.some(function (g) {
        return g.terminal && anchoredToRings(G, g, ctx.ringAtoms);
      });
      var chainLen = longestChainLen(G, ctx, suffixKind, suffixGroups);
      var ringWins = suffixOnRing || suffixAnchored || !suffixKind
        ? (suffixOnRing || suffixAnchored || biggestRing >= chainLen)
        : false;
      if (ringWins) {
        for (i = 0; i < ctx.rings.length; i++) {
          if (ctx.rings[i].length !== biggestRing) continue;
          var ori2 = bestRingOrientation(G, ctx, ctx.rings[i], suffixGroups, suffixKind);
          if (!ori2) continue;
          for (j = 0; j < ori2.length; j++) candidates.push(ori2[j]);
        }
      }
    }

    // 3. chain parents. Every simple path of the acyclic carbon forest is a
    // candidate, in both numbering directions; the score picks the parent.
    var allowed = chainAllowedSet(G, ctx, suffixKind, suffixGroups);
    if (allowed.size) {
      var paths = enumerateChains(G, allowed);
      for (i = 0; i < paths.length; i++) {
        var P = paths[i];
        if (!P.length) continue;
        var two = [P];
        if (P.length > 1) two.push(P.slice().reverse());
        for (j = 0; j < two.length; j++) {
          var chain = two[j];
          var pos = new Map();
          for (k = 0; k < chain.length; k++) pos.set(chain[k], k + 1);
          var cand = { parent: chain, pos: pos, ring: false, arom: false };
          cand.score = orientationScore(G, ctx, cand, suffixGroups);
          candidates.push(cand);
        }
      }
    }

    if (!candidates.length) return null;
    candidates.sort(function (a, b) {
      var c = cmpCandidate(a.score, b.score);
      if (c !== 0) return c;
      var sa = a.parent.join(','), sb = b.parent.join(',');
      return sa < sb ? -1 : (sa > sb ? 1 : 0);
    });
    var top = candidates[0].score;
    var best = null;
    var limit = Math.min(candidates.length, 120);
    for (i = 0; i < limit; i++) {
      if (cmpCandidate(candidates[i].score, top) !== 0) break;
      var c2 = candidates[i];
      var built = assembleName(G, ctx, {
        parent: c2.parent,
        pos: c2.pos,
        ring: !!c2.ring,
        arom: !!c2.arom,
        suffixKind: suffixKind,
        suffixGroups: suffixGroups,
        esterAlkyl: esterAlkyl,
        acylHalSym: acylHalSym
      });
      if (!built) continue;
      // Equal-scoring parents must agree; picking the alphabetically first name
      // is what makes the result independent of the atom input order.
      if (!best || built.name < best.name) best = built;
    }
    if (!best) return null;
    best.class = best.className;
    delete best.className;
    return best;
  }

  function longestChainLen(G, ctx, suffixKind, suffixGroups) {
    var allowed = chainAllowedSet(G, ctx, suffixKind, suffixGroups);
    var best = 0;
    var paths = enumerateChains(G, allowed);
    for (var i = 0; i < paths.length; i++) {
      if (paths[i].length > best) best = paths[i].length;
    }
    return best;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  function graphFrom(spec, bondsArg) {
    var parts = pickParts(spec, bondsArg);
    if (!parts) return null;
    if (parts.nodes) return buildGraph(parts.nodes, parts.edges);
    if (parts.charge !== undefined && parts.charge !== null && parts.charge !== 0) return null;
    return buildGraph(parts.atoms, parts.bonds === undefined ? [] : parts.bonds);
  }

  function name(moleculeLike, bondsArg) {
    try {
      var G = graphFrom(moleculeLike, bondsArg);
      if (!G) return null;
      var counts = G.counts;
      if (!organicFromCounts(counts, moleculeLike)) return null;
      return nameGraph(G);
    } catch (err) {
      return null;
    }
  }

  function nameFromGraph(nodes, edges) {
    try {
      var G = buildGraph(nodes, edges);
      if (!G) return null;
      if (!organicFromCounts(G.counts, null)) return null;
      return nameGraph(G);
    } catch (err) {
      return null;
    }
  }

  function isOrganicEntry(atomsLike, bondsLike) {
    try {
      return isOrganic(atomsLike, bondsLike);
    } catch (err) {
      return false;
    }
  }

  var api = {
    version: VERSION,
    isOrganic: isOrganicEntry,
    name: name,
    nameFromGraph: nameFromGraph,
    // Exposed for the app's debug panels and tests.
    stems: STEM.slice(),
    supportedElements: Object.keys(NAMABLE)
  };

  var target = (typeof window !== 'undefined') ? window
    : (typeof globalThis !== 'undefined' ? globalThis : null);
  if (target) target.__organicNames = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();

