// Nuclear physics for MOLECULITH: binding energy, decay clocks and fission.
//
// One module answers every nuclear question the game asks, so the gun, the decay
// loop, the kinetics panel and the cinematic cannot disagree about a nucleus.
// Three layers, in order of authority:
//
//   1. Measured nuclide data. Half-lives and alpha Q values are tabulated per
//      (Z, A) below, and the two beta charts already shipped in beta-decay.js and
//      beta-plus.js are read live. A measured number is never replaced by a model.
//   2. The Bethe-Weizsacker semi-empirical mass formula, for binding energies and
//      for the Q value of a split nobody has measured.
//   3. A labelled model estimate, for nuclides past the measured tables. It is
//      reported as an estimate everywhere it is printed, never as data.
//
// Everything here is pure: no scene, no DOM, no storage. The callers own the
// atoms; this module owns the physics.
(function () {
  'use strict';

  var VERSION = '1.0.0';
  var LN2 = Math.LN2;
  var MEV_IN_J = 1.602176634e-13;
  var AVOGADRO = 6.02214076e23;
  var KTONNE_TNT_J = 4.184e12;
  var YEAR_S = 365.25 * 24 * 3600;
  var DAY_S = 86400;

  // Bethe-Weizsacker coefficients in MeV. The Coulomb term is written Z(Z-1), the
  // number of proton pairs that actually repel, and the asymmetry term (A-2Z)^2/A,
  // which is the same punishment as (N-Z)^2/A.
  var SEMF = { av: 15.75, as: 17.8, ac: 0.711, aa: 23.7, ap: 11.18 };

  // The alpha particle is far too light for a liquid drop: the formula above gives
  // it 22.9 MeV against a measured 28.296, and that 5.4 MeV error would sit in
  // every alpha Q value. Its binding is therefore the measured number.
  var B_ALPHA = 28.295674;
  var B_DEUTERON = 2.224566;
  var B_TRITON = 8.481798;
  var B_HE3 = 7.718043;

  function binding(z, a) {
    z = Math.round(z); a = Math.round(a);
    if (!(z > 0) || !(a >= z)) return 0;
    if (z === 1 && a === 1) return 0;
    if (z === 2 && a === 4) return B_ALPHA;
    if (z === 1 && a === 2) return B_DEUTERON;
    if (z === 1 && a === 3) return B_TRITON;
    if (z === 2 && a === 3) return B_HE3;
    var n = a - z;
    // Even-even nuclei are bound extra, odd-odd nuclei less, odd-A not at all.
    var pair = (z % 2 === 0 && n % 2 === 0) ? SEMF.ap / Math.sqrt(a)
      : (z % 2 === n % 2) ? -SEMF.ap / Math.sqrt(a) : 0;
    return SEMF.av * a - SEMF.as * Math.pow(a, 2 / 3) -
      SEMF.ac * z * (z - 1) / Math.pow(a, 1 / 3) -
      SEMF.aa * (a - 2 * z) * (a - 2 * z) / a + pair;
  }

  function bindingPerNucleon(z, a) {
    if (!(a > 0)) return 0;
    return binding(z, a) / a;
  }

  // ── Measured alpha emitters ───────────────────────────────────────────────
  // key Z*1000+A -> { t: total half-life in seconds, q: Q_alpha in MeV,
  //                 b: alpha branching fraction, comp: what the rest does }.
  // A nuclide with two doors keeps ONE total half-life and splits between them;
  // the partial half-life of a branch is t/b, which is what a kinetics network
  // needs. Values are the evaluated chart numbers (NUBASE/IAEA); the four natural
  // chains are complete enough that a uranium atom walks down to lead without
  // leaving the table.
  var ALPHA = {};
  function putA(z, a, t, q, branch, comp) {
    ALPHA[z * 1000 + a] = {
      t: t, q: q, b: branch === undefined ? 1 : branch,
      comp: branch === undefined || branch >= 1 ? null : (comp || 'betaMinus')
    };
  }
  // Thorium chain (4n)
  putA(90, 232, 1.405e10 * YEAR_S, 4.083);
  putA(90, 228, 1.9116 * YEAR_S, 5.520);
  putA(88, 224, 3.6319 * DAY_S, 5.789);
  putA(86, 220, 55.6, 6.405);
  putA(84, 216, 0.145, 6.906);
  putA(84, 212, 2.99e-7, 8.954);
  putA(83, 212, 60.55 * 60, 6.207, 0.3594);
  putA(84, 211, 0.516, 7.594);
  // Neptunium chain (4n+1)
  putA(93, 237, 2.144e6 * YEAR_S, 4.959);
  putA(92, 233, 1.592e5 * YEAR_S, 4.909);
  putA(90, 229, 7917 * YEAR_S, 5.168);
  putA(89, 225, 9.92 * DAY_S, 5.953);
  putA(87, 221, 4.8 * 60, 6.457);
  putA(85, 217, 3.23e-3, 7.201);
  putA(83, 213, 45.59 * 60, 6.003, 0.0214);
  putA(84, 213, 3.72e-6, 8.536);
  putA(83, 209, 2.01e19 * YEAR_S, 3.137);
  // Uranium chain (4n+2)
  putA(92, 238, 4.468e9 * YEAR_S, 4.270);
  putA(92, 234, 2.455e5 * YEAR_S, 4.859);
  putA(90, 230, 75380 * YEAR_S, 4.770);
  putA(88, 226, 1600 * YEAR_S, 4.871);
  putA(86, 222, 3.8235 * DAY_S, 5.590);
  putA(84, 218, 3.098 * 60, 6.115);
  putA(84, 214, 1.643e-4, 7.833);
  putA(84, 215, 1.781e-3, 7.529);
  putA(85, 219, 56, 6.342);
  putA(83, 211, 2.14 * 60, 6.750, 0.99724, 'ec');
  putA(84, 210, 138.376 * DAY_S, 5.407);
  // The pool places polonium at A = 209, the mass this build's element table
  // carries, so the nuclide a player actually holds is tabulated too.
  putA(84, 209, 125.2 * YEAR_S, 4.979);
  putA(84, 208, 2.898 * YEAR_S, 5.215);
  // Actinium chain (4n+3)
  putA(92, 235, 7.04e8 * YEAR_S, 4.678);
  putA(91, 231, 32760 * YEAR_S, 5.150);
  putA(89, 227, 21.772 * YEAR_S, 5.042, 0.0138);
  putA(90, 227, 18.68 * DAY_S, 6.146);
  putA(88, 223, 11.43 * DAY_S, 5.979);
  putA(86, 219, 3.96, 6.946);
  putA(85, 215, 0.1e-3, 8.178);
  // Transuranics the gun can actually build
  putA(92, 232, 68.9 * YEAR_S, 5.414);
  putA(92, 236, 2.342e7 * YEAR_S, 4.573);
  putA(94, 238, 87.7 * YEAR_S, 5.593);
  putA(94, 239, 24110 * YEAR_S, 5.245);
  putA(94, 240, 6561 * YEAR_S, 5.256);
  putA(94, 242, 3.75e5 * YEAR_S, 4.984);
  putA(94, 244, 8.08e7 * YEAR_S, 4.666);
  putA(95, 241, 432.6 * YEAR_S, 5.638);
  putA(95, 243, 7370 * YEAR_S, 5.439);
  putA(96, 242, 162.8 * DAY_S, 6.216);
  putA(96, 243, 29.1 * YEAR_S, 6.165);
  putA(96, 244, 18.1 * YEAR_S, 5.902);
  putA(96, 245, 8500 * YEAR_S, 5.623);
  putA(96, 246, 4730 * YEAR_S, 5.478);
  putA(96, 247, 1.56e7 * YEAR_S, 5.353);
  putA(96, 248, 3.48e5 * YEAR_S, 5.162, 0.0839, 'sf');
  putA(97, 247, 1380 * YEAR_S, 5.889);
  putA(98, 249, 351 * YEAR_S, 6.295);
  putA(98, 250, 13.08 * YEAR_S, 6.128);
  putA(98, 251, 898 * YEAR_S, 6.176);
  putA(98, 252, 2.645 * YEAR_S, 6.217, 0.9691, 'sf');
  putA(99, 252, 471.7 * DAY_S, 6.760);
  putA(99, 253, 20.47 * DAY_S, 6.739);
  putA(99, 254, 275.7 * DAY_S, 6.627);
  putA(100, 257, 100.5 * DAY_S, 6.864);
  putA(101, 258, 51.5 * DAY_S, 7.271);
  putA(85, 210, 8.1 * 3600, 5.631, 0.9982, 'ec');

  // ── Measured beta-minus emitters above lead ───────────────────────────────
  // The two shipped beta charts stop at Z = 82, so the heavy chain members that
  // beta decay are tabulated here. key -> { t: half-life s, shed: neutrons shed,
  // q: measured Q in MeV }. Several of these Q values are only tens of keV -
  // lead-210 at 63.5, radium-228 at 45.8, plutonium-241 at 20.8 - which is exactly
  // the scale the liquid drop gets wrong, so they are data rather than estimates.
  var HEAVY_BETA_MINUS = {};
  function putB(z, a, t, shed, q) {
    HEAVY_BETA_MINUS[z * 1000 + a] = { t: t, shed: shed || 0, q: typeof q === 'number' ? q : null };
  }
  putB(90, 231, 25.52 * 3600, 0, 0.3915);
  putB(90, 234, 24.10 * DAY_S, 0, 0.2741);
  putB(91, 233, 26.967 * DAY_S, 0, 0.5708);
  putB(91, 234, 6.70 * 3600, 0, 2.2740);
  putB(92, 237, 6.75 * DAY_S, 0, 0.5186);
  putB(92, 239, 23.45 * 60, 0, 1.2620);
  putB(93, 239, 2.356 * DAY_S, 0, 0.7223);
  putB(94, 241, 14.33 * YEAR_S, 0, 0.0208);
  putB(94, 243, 4.956 * 3600, 0, 0.5815);
  putB(95, 242, 16.02 * 3600, 0, 0.7675);
  putB(95, 244, 10.1 * 3600, 0, 1.9460);
  putB(96, 249, 64.15 * 60, 0, 0.9042);
  putB(97, 249, 330 * DAY_S, 0, 0.1236);
  putB(98, 253, 17.81 * DAY_S, 0, 0.2912);
  putB(89, 228, 6.15 * 3600, 0, 2.1237);
  putB(88, 225, 14.9 * DAY_S, 0, 0.3588);
  putB(88, 228, 5.75 * YEAR_S, 0, 0.0458);
  putB(87, 223, 22.00 * 60, 0, 1.1494);
  putB(83, 210, 5.012 * DAY_S, 0, 1.1612);
  putB(83, 214, 19.9 * 60, 0, 3.2706);
  putB(82, 210, 22.2 * YEAR_S, 0, 0.0635);
  putB(82, 214, 26.8 * 60, 0, 1.0236);
  putB(81, 208, 3.053 * 60, 0, 4.9984);

  function key(z, a) { return Math.round(z) * 1000 + Math.round(a); }

  function alphaData(z, a) { return ALPHA[key(z, a)] || null; }
  function heavyBetaData(z, a) { return HEAVY_BETA_MINUS[key(z, a)] || null; }

  // The reference nuclide the shipped element table was written against. A pool
  // atom carries no mass number until the gun writes one, so its decay is read
  // against the nuclide the half-life was measured for, not against a rounded
  // atomic weight that may itself be a radioactive isotope.
  var REFERENCE_A = {
    83: 209, 84: 209, 85: 210, 86: 222, 87: 223, 88: 226, 89: 227, 90: 232,
    91: 231, 92: 238, 93: 237, 94: 244, 95: 243, 96: 247, 97: 247, 98: 251,
    99: 252, 100: 257, 101: 258, 102: 259, 103: 266, 104: 267, 105: 268,
    106: 269, 107: 270, 108: 269, 109: 278, 110: 281, 111: 282, 112: 285,
    113: 286, 114: 289, 115: 290, 116: 293, 117: 294, 118: 294
  };

  function elementTable() {
    var A = window.__mol3d;
    return A && Array.isArray(A.ELEMENTS) ? A.ELEMENTS : null;
  }

  function elementOf(z) {
    var list = elementTable();
    if (!list) return null;
    for (var i = 0; i < list.length; i++) if (list[i].z === z) return list[i];
    return null;
  }

  function symbolOf(z) {
    var el = elementOf(z);
    return el ? el.sym : 'Z' + z;
  }

  function nameOf(z) {
    var el = elementOf(z);
    if (!el) return 'Z' + z;
    var i18n = window.__mol3d && window.__mol3d.i18n;
    if (i18n && typeof i18n.elName === 'function') {
      try { return i18n.elName(el); } catch (e) {}
    }
    return el.name || el.sym;
  }

  function nuclideLabel(z, a) { return symbolOf(z) + '-' + Math.round(a); }

  // ── Decay clocks ──────────────────────────────────────────────────────────

  function lambdaOf(halfLife) {
    if (!(halfLife > 0) || !isFinite(halfLife)) return 0;
    return LN2 / halfLife;
  }

  function meanLifeOf(halfLife) {
    if (!(halfLife > 0) || !isFinite(halfLife)) return 0;
    return halfLife / LN2;
  }

  // Fraction of a sample still undecayed after t seconds.
  function fractionLeft(halfLife, t) {
    if (!(halfLife > 0)) return 1;
    if (!(t > 0)) return 1;
    return Math.pow(2, -t / halfLife);
  }

  function remaining(n0, halfLife, t) { return n0 * fractionLeft(halfLife, t); }

  // Activity in becquerel: lambda * N. One mole of a nuclide is a real number of
  // nuclei, so this is the activity a chemist would measure, not a per-atom rate.
  function activity(nuclei, halfLife) { return lambdaOf(halfLife) * nuclei; }
  function molarActivity(halfLife) { return activity(AVOGADRO, halfLife); }

  // Q of a weak transition, from atomic masses. Writing the atom as Z hydrogen
  // masses plus N neutron masses minus the binding energy, the electrons cancel
  // and leave only these constants:
  //   beta-: Q = B(Z+1,A) - B(Z,A) + 0.782 MeV
  //   beta+: Q = B(Z-1,A) - B(Z,A) - 1.804 MeV   (two electron masses must be made)
  //   EC   : Q = B(Z-1,A) - B(Z,A) - 0.782 MeV
  // This is a decision procedure, not a measurement. An alpha Q is the difference
  // of two large smooth numbers and the drop reproduces it to a few tenths; a beta
  // Q is the difference of two nearly equal mass surfaces, and the shell
  // corrections the drop omits are the same size as the answer. Asked about
  // carbon-14 it returns -1.96 MeV and calls the most famous beta emitter in the
  // game stable. So it is used to choose a door for nuclides no chart names, and
  // never to print an energy beside a measured half-life.
  var MN_MH = 0.782347;
  var TWO_ME = 1.021998;

  function betaQ(kind, z, a) {
    z = Math.round(z); a = Math.round(a);
    if (!(a >= z) || z < 1) return null;
    if (kind === 'betaMinus') {
      if (z + 1 > a) return null;
      return binding(z + 1, a) - binding(z, a) + MN_MH;
    }
    if (z - 1 < 1) return null;
    var db = binding(z - 1, a) - binding(z, a);
    return kind === 'betaPlus' ? db - MN_MH - TWO_ME : db - MN_MH;
  }

  // Measured decay energies, the only ones this module will print next to a
  // measured half-life. key Z*1000+A -> { betaMinus, betaPlus, ec } in MeV.
  // A nuclide missing from here reports no energy at all rather than an estimate
  // that could have the wrong sign: '—' is honest, -1.96 MeV for carbon-14 is not.
  var DECAY_Q = {};
  function putQ(z, a, kind, q) {
    var k = Math.round(z) * 1000 + Math.round(a);
    if (!DECAY_Q[k]) DECAY_Q[k] = {};
    DECAY_Q[k][kind] = q;
  }
  function measuredQ(kind, z, a) {
    var rec = DECAY_Q[Math.round(z) * 1000 + Math.round(a)];
    return rec && typeof rec[kind] === 'number' ? rec[kind] : null;
  }
  // What a measured emitter is allowed to say about its energy.
  function weakQ(kind, z, a) {
    var q = measuredQ(kind, z, a);
    return { q: q, qSource: q === null ? 'unknown' : 'measured' };
  }

  // The textbook emitters a player can actually build, plus the weak doors of the
  // branching alpha emitters. Evaluated Q values (AME/NUBASE), in the same
  // convention betaQ uses: the energy the transition actually releases, so a
  // positron row is the atomic mass difference less the two electron masses it
  // has to create, not the mass difference itself.
  putQ(1, 3, 'betaMinus', 0.018590);
  putQ(6, 14, 'betaMinus', 0.156476);
  putQ(11, 24, 'betaMinus', 5.5157);
  putQ(15, 32, 'betaMinus', 1.7091);
  putQ(16, 35, 'betaMinus', 0.16727);
  putQ(19, 40, 'betaMinus', 1.3111);
  putQ(19, 40, 'ec', 1.5047);
  putQ(20, 45, 'betaMinus', 0.2569);
  putQ(26, 55, 'ec', 0.2310);
  putQ(27, 60, 'betaMinus', 2.8239);
  putQ(28, 63, 'betaMinus', 0.0669);
  putQ(38, 90, 'betaMinus', 0.5460);
  putQ(42, 99, 'betaMinus', 1.3573);
  putQ(53, 131, 'betaMinus', 0.9708);
  putQ(55, 137, 'betaMinus', 1.1756);
  putQ(36, 85, 'betaMinus', 0.6870);
  putQ(49, 115, 'betaMinus', 0.4950);
  putQ(6, 11, 'betaPlus', 0.9604);
  putQ(7, 13, 'betaPlus', 1.1984);
  putQ(8, 15, 'betaPlus', 1.7320);
  putQ(9, 18, 'betaPlus', 0.6335);
  putQ(11, 22, 'betaPlus', 1.8206);
  putQ(15, 30, 'betaPlus', 3.2100);
  putQ(6, 10, 'betaPlus', 2.6260);
  putQ(8, 14, 'betaPlus', 4.1220);
  putQ(83, 212, 'betaMinus', 2.2540);
  putQ(83, 213, 'betaMinus', 1.4270);
  putQ(89, 227, 'betaMinus', 0.0448);
  putQ(83, 211, 'ec', 0.5740);

  function branchOf(mode, frac, totalT, dz, da, q, qSource) {
    // A branch owns a fraction of the total decay constant, so its partial
    // half-life is the total divided by that fraction - longer, never shorter.
    var partial = frac > 0 ? totalT / frac : totalT;
    return {
      mode: mode, branch: frac, halfLife: partial, lambda: lambdaOf(partial),
      daughter: dz == null ? null : { z: dz, a: da }, q: q, qSource: qSource
    };
  }

  // The one question every caller asks: what does this nucleus do, and how fast.
  // Returns null for a stable nucleus. `source` says where the half-life came from
  // and `qSource` where the energy came from, so a panel can print "measured" and
  // "model" differently instead of pretending an estimate is data. `mode` and
  // `daughter` are the dominant branch; `branches` carries every open door.
  function clock(z, a) {
    z = Math.round(z);
    if (!(z > 0)) return null;
    if (!(a > 0)) a = REFERENCE_A[z] || Math.round(z * 2.5);
    a = Math.round(a);

    // Below lead the two measured charts own the answer, exactly as the game's
    // beta loop does: one nucleus, one rule, and the charts never name it twice.
    if (z <= 82) {
      var minus = window.__mol3dBeta;
      var plus = window.__mol3dBetaPlus;
      var d = minus && typeof minus.daughterOf === 'function' ? minus.daughterOf(z, a) : null;
      var kind = 'betaMinus';
      if (!d && plus && typeof plus.daughterOf === 'function') {
        d = plus.daughterOf(z, a);
        kind = 'betaPlus';
      }
      if (!d) return null;
      var wq = weakQ(kind, z, a);
      return finish(kind, d.halfLife, d.z, d.a, wq.q, 'measured', wq.qSource, null, d);
    }

    var hb = heavyBetaData(z, a);
    var al = alphaData(z, a);
    if (hb && (!al || al.b <= 0)) {
      return finish('betaMinus', hb.t, z + 1, a - hb.shed, hb.q,
        'measured', hb.q === null ? 'unknown' : 'measured', null, hb);
    }
    if (al && al.b > 0 && al.t > 0) {
      var q = al.q > 0 ? al.q : qAlpha(z, a);
      var qSource = al.q > 0 ? 'measured' : 'model';
      var branches = null;
      if (al.comp && al.b < 1) {
        branches = [branchOf('alpha', al.b, al.t, z - 2, a - 4, q, qSource)];
        if (al.comp === 'sf') {
          // Spontaneous fission has no single daughter; the caller draws a split.
          branches.push(branchOf('fission', 1 - al.b, al.t, null, null, null, 'unknown'));
        } else if (al.comp === 'ec') {
          var we = weakQ('ec', z, a);
          branches.push(branchOf('electronCapture', 1 - al.b, al.t, z - 1, a, we.q, we.qSource));
        } else {
          var wm = weakQ('betaMinus', z, a);
          branches.push(branchOf('betaMinus', 1 - al.b, al.t, z + 1, a, wm.q, wm.qSource));
        }
        branches.sort(function (p, r) { return r.branch - p.branch; });
        var top = branches[0];
        // Curium-248 mostly fissions, so the dominant door can have no daughter
        // at all. Reporting an alpha daughter for it would invent a transmutation
        // the nucleus does not perform.
        return finish(top.mode, al.t, top.daughter ? top.daughter.z : null,
          top.daughter ? top.daughter.a : null, top.q, 'measured', top.qSource, branches, al);
      }
      return finish('alpha', al.t, z - 2, a - 4, q, 'measured', qSource, null, al);
    }
    if (hb) {
      return finish('betaMinus', hb.t, z + 1, a - hb.shed, hb.q,
        'measured', hb.q === null ? 'unknown' : 'measured', null, hb);
    }

    // Past the tables the mass formula decides which door is open, and the shipped
    // element table supplies the clock. Both are labelled as models.
    var mode = legacyMode(z, a);
    if (!mode) return null;
    var t = legacyHalfLife(z);
    if (!(t > 0)) return null;
    if (mode === 'alpha') return finish('alpha', t, z - 2, a - 4, qAlpha(z, a), 'model', 'model', null, null);
    if (mode === 'betaPlus') return finish('betaPlus', t, z - 1, a, betaQ('betaPlus', z, a), 'model', 'model', null, null);
    if (mode === 'electronCapture') return finish('electronCapture', t, z - 1, a, betaQ('ec', z, a), 'model', 'model', null, null);
    return finish('betaMinus', t, z + 1, a, betaQ('betaMinus', z, a), 'model', 'model', null, null);
  }

  function finish(mode, halfLife, dz, da, q, source, qSource, branches, raw) {
    return {
      mode: mode, halfLife: halfLife, lambda: lambdaOf(halfLife),
      meanLife: meanLifeOf(halfLife), daughter: dz == null ? null : { z: dz, a: da },
      q: q, source: source, qSource: qSource, branches: branches, raw: raw || null
    };
  }

  // Which door a nucleus past the measured tables takes. Not a guess about odd
  // proton numbers: the formula is asked for all three Q values and the nucleus
  // takes an open one. Above polonium the alpha door is preferred when it is open,
  // because barrier penetration at these masses outruns a weak transition by many
  // orders of magnitude - which is why the measured actinides are alpha emitters.
  function legacyMode(z, a) {
    if (z <= 82) return null;
    if (!(a > 0)) a = REFERENCE_A[z] || Math.round(z * 2.5);
    var qa = qAlpha(z, a);
    var qm = betaQ('betaMinus', z, a);
    var qp = betaQ('betaPlus', z, a);
    if (qa > 0 && z >= 84) return 'alpha';
    if (qm > 0 && (qp === null || qm >= qp)) return 'betaMinus';
    if (qp > 0) return 'betaPlus';
    if (qm > 0) return 'betaMinus';
    if (qa > 0) return 'alpha';
    return null;
  }

  function legacyHalfLife(z) {
    var A = window.__mol3d;
    var table = A && A.decayHalfLives;
    if (table && table[z] > 0) return table[z];
    return REFERENCE_FALLBACK_T[z] || 0;
  }

  // The same evaluated numbers the bundle carries, so this module still answers
  // when it is loaded on a page that has not exposed its table.
  var REFERENCE_FALLBACK_T = {
    83: 6.34e26, 84: 1.196e7, 85: 29160, 86: 3.3e5, 87: 1320, 88: 5.049e10,
    89: 6.87e8, 90: 4.434e17, 91: 1.034e9, 92: 1.41e17, 93: 6.764e13,
    94: 2.55e15, 95: 2.304e11, 96: 4.944e8, 97: 4.32e6, 98: 2.834e10,
    99: 4.08e5, 100: 32400, 101: 18600, 102: 3480, 103: 110, 104: 42,
    105: 10, 106: 2.4, 107: 1.7, 108: 1.6, 109: 0.36, 110: 0.11,
    111: 0.036, 112: 0.29, 113: 0.02, 114: 2.6, 115: 0.065, 116: 0.06,
    117: 0.051, 118: 7e-4
  };

  // Which branch actually fires for one nucleus. A pure mode returns itself.
  function sampleBranch(z, a) {
    var c = clock(z, a);
    if (!c) return null;
    if (!c.branches || c.branches.length < 2) {
      return branchOf(c.mode, 1, c.halfLife, c.daughter ? c.daughter.z : null,
        c.daughter ? c.daughter.a : null, c.q, c.qSource);
    }
    var r = Math.random(), acc = 0;
    for (var i = 0; i < c.branches.length; i++) {
      acc += c.branches[i].branch;
      if (r < acc) return c.branches[i];
    }
    return c.branches[c.branches.length - 1];
  }

  function sampleMode(z, a) {
    var b = sampleBranch(z, a);
    return b ? b.mode : null;
  }

  // Q value of an alpha decay: the daughter and the alpha are more bound than the
  // parent by exactly this much. Positive means the decay can happen at all.
  function qAlpha(z, a) {
    z = Math.round(z); a = Math.round(a);
    var measured = alphaData(z, a);
    if (measured && measured.q > 0) return measured.q;
    if (!(z > 2) || !(a > 4)) return 0;
    return binding(z - 2, a - 4) + B_ALPHA - binding(z, a);
  }

  function alpha(z, a) {
    z = Math.round(z);
    if (!(a > 0)) a = REFERENCE_A[z] || Math.round(z * 2.5);
    a = Math.round(a);
    if (!(z > 2) || !(a > 4)) return null;
    var q = qAlpha(z, a);
    var c = clock(z, a);
    // The alpha door may be the minority one (bismuth-212 is mostly a beta
    // emitter). Its own partial half-life is what an alpha count would measure.
    var life = null, lam = 0, branch = 1;
    if (c) {
      if (c.mode === 'alpha') { life = c.halfLife; lam = c.lambda; }
      if (c.branches) {
        for (var i = 0; i < c.branches.length; i++) {
          if (c.branches[i].mode === 'alpha') {
            life = c.branches[i].halfLife; lam = c.branches[i].lambda;
            branch = c.branches[i].branch;
            break;
          }
        }
      }
    }
    var measured = alphaData(z, a);
    return {
      parent: { z: z, a: a }, daughter: { z: z - 2, a: a - 4 },
      alpha: { z: 2, a: 4 }, q: q,
      qSource: measured && measured.q > 0 ? 'measured' : 'model',
      // Two-body kinematics: momentum is equal and opposite, so the light alpha
      // carries away the fraction A_d/(A_d+4) of the energy and the heavy
      // daughter recoils with the rest.
      alphaEnergy: q * (a - 4) / a, daughterEnergy: q * 4 / a,
      halfLife: life, lambda: lam, branch: branch,
      totalHalfLife: c ? c.halfLife : null,
      source: c ? c.source : 'model'
    };
  }

  // A decay chain as a list of steps along the dominant branch, stopping at the
  // first stable nucleus. Each step carries every open door, so a panel can show
  // that bismuth-212 is mostly a beta emitter without hiding the alpha line.
  function chain(z, a, limit) {
    limit = limit || 24;
    var steps = [], seen = {};
    var cz = Math.round(z), ca = Math.round(a || REFERENCE_A[z] || z * 2.5);
    for (var i = 0; i < limit; i++) {
      var k = cz + ':' + ca;
      if (seen[k]) break;
      seen[k] = 1;
      var c = clock(cz, ca);
      if (!c) break;
      if (!c.daughter) {
        // A nucleus whose dominant door is a split leaves the chain: there is no
        // single daughter to walk to, and the fragments are drawn per event.
        steps.push({
          from: { z: cz, a: ca }, to: null, mode: c.mode, halfLife: c.halfLife,
          lambda: c.lambda, meanLife: c.meanLife, q: c.q, source: c.source,
          qSource: c.qSource, branches: c.branches
        });
        cz = 0; ca = 0;
        break;
      }
      steps.push({
        from: { z: cz, a: ca }, to: { z: c.daughter.z, a: c.daughter.a },
        mode: c.mode, halfLife: c.halfLife, lambda: c.lambda,
        meanLife: c.meanLife, q: c.q, source: c.source, qSource: c.qSource,
        branches: c.branches
      });
      cz = c.daughter.z; ca = c.daughter.a;
      if (cz <= 0 || ca <= 0) break;
    }
    return { steps: steps, end: { z: cz, a: ca }, stable: cz > 0 && !clock(cz, ca) };
  }

  // Radioactive decay is first-order kinetics, so a chain compiles into exactly
  // the network the game's RK4 solver already integrates: one species per
  // nuclide, one reaction per branch, k = the partial decay constant lambda_i.
  // Nothing nuclear is special-cased inside the solver. Branching is walked in
  // full, so the Bateman solution the solver produces is the real one - a
  // dominant-path-only network would quietly lose the minority daughters.
  function decayNetwork(z, a, opts) {
    opts = opts || {};
    z = Math.round(z);
    if (!(a > 0)) a = REFERENCE_A[z] || Math.round(z * 2.5);
    a = Math.round(a);
    var maxNodes = opts.limit || 40;
    var species = [], index = {}, reactions = [], visited = {};
    function add(zz, aa) {
      var id = nuclideLabel(zz, aa);
      if (index[id] === undefined) { index[id] = species.length; species.push(id); }
      return id;
    }
    var start = add(z, a);
    var queue = [{ z: z, a: a }];
    var nodes = 0;
    while (queue.length && nodes < maxNodes) {
      var cur = queue.shift();
      var vk = cur.z + ':' + cur.a;
      if (visited[vk]) continue;
      visited[vk] = 1;
      nodes++;
      var c = clock(cur.z, cur.a);
      if (!c) continue;
      var from = add(cur.z, cur.a);
      var doors = c.branches && c.branches.length
        ? c.branches
        : [branchOf(c.mode, 1, c.halfLife, c.daughter ? c.daughter.z : null,
          c.daughter ? c.daughter.a : null, c.q, c.qSource)];
      for (var i = 0; i < doors.length; i++) {
        var d = doors[i];
        if (!(d.lambda > 0)) continue;
        var label = nuclideLabel(cur.z, cur.a) + ' ' + d.mode;
        if (d.mode === 'fission' || !d.daughter) {
          // A split has no single daughter. It leaves the chain as a lumped
          // product sink, which is what a mass balance on the parent needs.
          var sink = opts.fissionSink || 'fission products';
          if (index[sink] === undefined) { index[sink] = species.length; species.push(sink); }
          reactions.push({
            reactants: [{ speciesId: from, stoichiometry: 1 }],
            products: [{ speciesId: sink, stoichiometry: 1 }],
            rateConstant: d.lambda, label: label
          });
          continue;
        }
        var to = add(d.daughter.z, d.daughter.a);
        var products = [{ speciesId: to, stoichiometry: 1 }];
        // An alpha step is ONE reaction with two products, not two reactions:
        // writing the helium as a separate decay of the same parent would consume
        // the parent twice and halve its half-life. Eight alphas from uranium-238
        // means eight helium atoms, which is where the helium in natural gas
        // actually comes from.
        if (d.mode === 'alpha') products.push({ speciesId: add(2, 4), stoichiometry: 1 });
        reactions.push({
          reactants: [{ speciesId: from, stoichiometry: 1 }],
          products: products,
          rateConstant: d.lambda, label: label,
          branch: d.branch, halfLife: d.halfLife, q: d.q, qSource: d.qSource, source: c.source
        });
        if (!visited[d.daughter.z + ':' + d.daughter.a]) queue.push({ z: d.daughter.z, a: d.daughter.a });
      }
    }
    var initial = {};
    initial[start] = opts.n0 === undefined ? 1 : opts.n0;
    return {
      species: species, reactions: reactions, initialConcentrations: initial,
      chain: chain(z, a, opts.chainLimit || 24), nodes: nodes
    };
  }

  // The network above is stiff. Uranium-238's chain runs from 4.5e9 years down to
  // 164 microseconds - seventeen orders of magnitude of rate in one system - and
  // an explicit RK4 step small enough for the polonium would need 1e22 steps to
  // reach the uranium. The game's integrator is correct and still cannot draw
  // this curve.
  //
  // Every reaction in it is first order in a single reactant, though, and that
  // system has a closed form: each population is a sum of exponentials whose
  // rates are the eigenvalues of its ancestors. This walks the network in
  // topological order and builds those sums exactly, so the answer at any time
  // costs one evaluation and no steps at all. It is the Bateman solution, not an
  // approximation to it, and it agrees with the RK4 solver wherever RK4 can run.
  //
  // A term is (c0 + c1*t + c2*t^2 ...) * exp(-rate*t). Feeding a parent term into
  // a daughter with a different rate keeps the polynomial degree and shifts the
  // coefficients; feeding it into a daughter with the SAME rate integrates the
  // polynomial, which is where the t*exp(-rate*t) of a degenerate chain comes
  // from. Rates are merged when they agree to one part in 1e9: measured
  // half-lives carry three or four significant figures, and two rates that close
  // would otherwise be subtracted to nothing and then divided by the remainder.
  var RATE_MERGE_TOL = 1e-9;

  function sameRate(x, y) {
    var scale = Math.max(Math.abs(x), Math.abs(y));
    if (scale === 0) return true;
    return Math.abs(x - y) / scale <= RATE_MERGE_TOL;
  }

  function chainSolver(z, a, opts) {
    opts = opts || {};
    var net = decayNetwork(z, a, opts);
    var species = net.species, S = species.length, i, j, n, q;
    var idx = {};
    for (i = 0; i < S; i++) idx[species[i]] = i;
    var lam = [], adj = [];
    for (i = 0; i < S; i++) { lam.push(0); adj.push([]); }
    var edges = [];
    for (i = 0; i < net.reactions.length; i++) {
      var r = net.reactions[i];
      var from = idx[r.reactants[0].speciesId];
      var k = r.rateConstant;
      if (!(k > 0)) continue;
      lam[from] += k;
      for (j = 0; j < r.products.length; j++) {
        var to = idx[r.products[j].speciesId];
        var kk = k * (r.products[j].stoichiometry || 1);
        edges.push({ from: from, to: to, k: kk });
        if (adj[from].indexOf(to) < 0) adj[from].push(to);
      }
    }

    // Alpha lowers A, but beta and capture leave it alone, so two isobars can feed
    // each other: Bi-211 captures to Pb-211 (0.276%) and Pb-211 beta-decays straight
    // back. That pair is the only cycle in the whole chart, and it is a real one.
    // Tarjan finds such groups; a group of two is diagonalised below into two
    // independent modes, which restores the acyclic walk without approximating.
    var comp = [], comps = [], tStack = [], onStack = [], tIndex = [], tLow = [], tNext = 0;
    for (i = 0; i < S; i++) { comp.push(-1); onStack.push(false); }
    function strong(v) {
      tIndex[v] = tLow[v] = tNext++;
      tStack.push(v); onStack[v] = true;
      for (var w = 0; w < adj[v].length; w++) {
        var u = adj[v][w];
        if (tIndex[u] === undefined) { strong(u); if (tLow[u] < tLow[v]) tLow[v] = tLow[u]; }
        else if (onStack[u] && tIndex[u] < tLow[v]) tLow[v] = tIndex[u];
      }
      if (tLow[v] === tIndex[v]) {
        var group = [], p;
        do { p = tStack.pop(); onStack[p] = false; comp[p] = comps.length; group.push(p); } while (p !== v);
        comps.push(group);
      }
    }
    for (i = 0; i < S; i++) if (tIndex[i] === undefined) strong(i);
    comps.reverse();
    for (i = 0; i < comps.length; i++) for (j = 0; j < comps[i].length; j++) comp[comps[i][j]] = i;

    // Each component becomes one node per independent mode. A lone species is its
    // own mode; a pair contributes the two eigenvectors of its 2x2 generator.
    var nlam = [], nfeeds = [], ncomp = [], nlocal = [], modeV = [], modeVi = [];
    var nodeOf = [], cyclic = false;
    for (i = 0; i < S; i++) nodeOf.push([]);
    for (var c = 0; c < comps.length; c++) {
      var g = comps[c];
      if (g.length === 1) {
        nodeOf[g[0]] = [{ node: nfeeds.length, w: 1 }];
        nlam.push(lam[g[0]]); nfeeds.push([]); ncomp.push(c); nlocal.push(0);
        modeV.push(null); modeVi.push(null);
        continue;
      }
      if (g.length !== 2) { cyclic = true; }
      var B = [[-lam[g[0]], 0], [0, -lam[g[1]]]];
      for (var e = 0; e < edges.length; e++) {
        var ed = edges[e];
        if (comp[ed.from] !== c || comp[ed.to] !== c || ed.from === ed.to) continue;
        B[ed.to === g[0] ? 0 : 1][ed.from === g[0] ? 0 : 1] += ed.k;
      }
      // Off-diagonals are rates, hence non-negative, so the discriminant
      // (a-d)^2 + 4bc cannot be negative and both eigenvalues are real.
      var tr = B[0][0] + B[1][1];
      var disc = Math.sqrt((B[0][0] - B[1][1]) * (B[0][0] - B[1][1]) + 4 * B[0][1] * B[1][0]);
      var mu = [(tr - disc) / 2, (tr + disc) / 2];
      var V = [[0, 0], [0, 0]], m;
      for (m = 0; m < 2; m++) {
        var vx, vy;
        if (Math.abs(B[0][1]) > 1e-300) { vx = B[0][1]; vy = mu[m] - B[0][0]; }
        else if (Math.abs(B[1][0]) > 1e-300) { vx = mu[m] - B[1][1]; vy = B[1][0]; }
        else { vx = m === 0 ? 1 : 0; vy = m === 0 ? 0 : 1; }
        var norm = Math.max(Math.abs(vx), Math.abs(vy)) || 1;
        V[0][m] = vx / norm; V[1][m] = vy / norm;
      }
      var detV = V[0][0] * V[1][1] - V[0][1] * V[1][0];
      if (!(Math.abs(detV) > 1e-12)) { cyclic = true; detV = detV < 0 ? -1e-12 : 1e-12; }
      var Vi = [[V[1][1] / detV, -V[0][1] / detV], [-V[1][0] / detV, V[0][0] / detV]];
      modeV.push(V); modeVi.push(Vi);
      for (m = 0; m < 2; m++) {
        var id = nfeeds.length;
        nlam.push(-mu[m]); nfeeds.push([]); ncomp.push(c); nlocal.push(m);
        for (var q2 = 0; q2 < 2; q2++) nodeOf[g[q2]].push({ node: id, w: V[q2][m] });
      }
    }
    // An external edge lands on a real species, so it is spread over that species'
    // modes by V on the way out and by V-inverse on the way in.
    var nindeg = [];
    for (i = 0; i < nfeeds.length; i++) nindeg.push(0);
    var nadj = [];
    for (i = 0; i < nfeeds.length; i++) nadj.push([]);
    for (var e2 = 0; e2 < edges.length; e2++) {
      var eg = edges[e2];
      if (comp[eg.from] === comp[eg.to] && comps[comp[eg.from]].length === 2) continue;
      var srcs = nodeOf[eg.from], dsts = nodeOf[eg.to];
      var Vi2 = modeVi[comp[eg.to]], lt = localOfReal(eg.to);
      for (var sa = 0; sa < srcs.length; sa++) {
        for (var da = 0; da < dsts.length; da++) {
          var weight = Vi2 ? Vi2[nlocal[dsts[da].node]][lt] : 1;
          var keff = eg.k * srcs[sa].w * weight;
          if (!(Math.abs(keff) > 0)) continue;
          nfeeds[dsts[da].node].push({ from: srcs[sa].node, k: keff });
          nindeg[dsts[da].node]++;
          if (nadj[srcs[sa].node].indexOf(dsts[da].node) < 0) nadj[srcs[sa].node].push(dsts[da].node);
        }
      }
    }
    function localOfReal(rr) { return comps[comp[rr]].indexOf(rr); }

    var order = [], ready = [];
    for (i = 0; i < nfeeds.length; i++) if (nindeg[i] === 0) ready.push(i);
    while (ready.length) {
      var cur = ready.shift();
      order.push(cur);
      for (j = 0; j < nadj[cur].length; j++) if (--nindeg[nadj[cur][j]] === 0) ready.push(nadj[cur][j]);
    }
    if (order.length !== nfeeds.length) {
      cyclic = true;
      for (i = 0; i < nfeeds.length; i++) if (order.indexOf(i) < 0) order.push(i);
    }

    var terms = [], nodeTerms = [];
    for (i = 0; i < S; i++) terms.push({ rates: [], polys: [] });
    for (i = 0; i < nfeeds.length; i++) nodeTerms.push({ rates: [], polys: [] });
    function rateSlot(list, v) {
      for (var p = 0; p < list.length; p++) if (sameRate(list[p], v)) return p;
      list.push(v);
      return list.length - 1;
    }
    function addTerm(dst, rate, poly) {
      var slot = rateSlot(dst.rates, rate);
      var p = dst.polys[slot];
      if (!p) p = dst.polys[slot] = [];
      for (var m = 0; m < poly.length; m++) p[m] = (p[m] || 0) + poly[m];
    }
    var startId = Object.keys(net.initialConcentrations)[0];
    var startIdx = idx[startId];
    var n0 = net.initialConcentrations[startId];
    if (!(n0 > 0)) n0 = 1;
    var seeded = [];
    for (i = 0; i < nfeeds.length; i++) seeded.push(false);
    var startNodes = nodeOf[startIdx], startVi = modeVi[comp[startIdx]], startLt = localOfReal(startIdx);
    for (i = 0; i < startNodes.length; i++) {
      var sn = startNodes[i].node;
      var w0 = startVi ? startVi[nlocal[sn]][startLt] : 1;
      addTerm(nodeTerms[sn], nlam[sn], [n0 * w0]);
      seeded[sn] = true;
    }

    for (var oi = 0; oi < order.length; oi++) {
      i = order[oi];
      if (seeded[i]) continue;
      var li = nlam[i], dst = nodeTerms[i];
      for (var f = 0; f < nfeeds[i].length; f++) {
        var feed = nfeeds[i][f];
        var src = nodeTerms[feed.from], kk = feed.k;
        for (q = 0; q < src.rates.length; q++) {
          var lp = src.rates[q], sp = src.polys[q];
          if (!sp) continue;
          var scaled = [];
          for (n = 0; n < sp.length; n++) scaled[n] = (sp[n] || 0) * kk;
          if (sameRate(lp, li)) {
            // y' + li*y = S(t)*exp(-li*t) => (y*exp(li*t))' = S(t).
            var anti = [0];
            for (n = 0; n < scaled.length; n++) anti[n + 1] = scaled[n] / (n + 1);
            addTerm(dst, li, anti);
          } else {
            // y = P(t)*exp(-lp*t) with P' + (li-lp)*P = S, solved top degree down.
            var delta = li - lp, deg = scaled.length - 1;
            var P = [];
            for (n = 0; n <= deg; n++) P.push(0);
            for (n = deg; n >= 0; n--) {
              var higher = n + 1 <= deg ? (n + 1) * P[n + 1] : 0;
              P[n] = ((scaled[n] || 0) - higher) / delta;
            }
            addTerm(dst, lp, P);
            // The daughter starts empty, so the homogeneous term cancels P(0).
            addTerm(dst, li, [-P[0]]);
          }
        }
      }
    }

    // Back to real populations: a lone species is its own mode, a pair is V times
    // its modes. Both are linear, so the exponential sums just add.
    for (i = 0; i < S; i++) {
      var nd = nodeOf[i], Vc = modeV[comp[i]], lt2 = localOfReal(i);
      for (var mm = 0; mm < nd.length; mm++) {
        var cw = Vc ? Vc[lt2][nlocal[nd[mm].node]] : 1;
        var nt = nodeTerms[nd[mm].node];
        for (var pp = 0; pp < nt.rates.length; pp++) {
          var poly2 = nt.polys[pp];
          if (!poly2) continue;
          var sc2 = [];
          for (n = 0; n < poly2.length; n++) sc2[n] = (poly2[n] || 0) * cw;
          addTerm(terms[i], nt.rates[pp], sc2);
        }
      }
    }

    var roundoff = 0;
    function at(t) {
      if (!(t >= 0)) t = 0;
      var out = [];
      for (var s = 0; s < S; s++) {
        var tm = terms[s], v = 0;
        for (var p = 0; p < tm.rates.length; p++) {
          var poly = tm.polys[p];
          if (!poly) continue;
          var e = Math.exp(-tm.rates[p] * t);
          if (e === 0) continue;
          var pv = 0, tp = 1;
          for (var m = 0; m < poly.length; m++) { pv += (poly[m] || 0) * tp; tp *= t; }
          v += pv * e;
        }
        if (v < 0) { roundoff = Math.max(roundoff, -v / n0); v = 0; }
        out.push(v);
      }
      return out;
    }

    var fastest = 0, parentRate = lam[startIdx];
    for (i = 0; i < S; i++) if (lam[i] > fastest) fastest = lam[i];
    var tMin = fastest > 0 ? 0.01 / fastest : 1;
    var tMax = parentRate > 0 ? 7 / parentRate : (fastest > 0 ? 7 / fastest : 1);
    if (!(tMax > tMin)) tMax = tMin * 1e3;
    return {
      species: species, lambdas: lam, n0: n0, start: startId,
      at: at, terms: terms, tMin: tMin, tMax: tMax,
      truncated: net.nodes >= (opts.limit || 40), cyclic: cyclic,
      network: net, roundoff: function () { return roundoff; }
    };
  }

  // ── Fission ───────────────────────────────────────────────────────────────

  // Beyond thorium only. Thorium-232 itself is fertile, not a fission source in
  // this build, and nothing at or below it splits.
  var FISSION_Z_MIN = 91;

  function fissionable(z, a) {
    z = Math.round(z);
    if (!(z >= FISSION_Z_MIN)) return false;
    if (!(a > 0)) a = REFERENCE_A[z] || Math.round(z * 2.5);
    if (!(a >= 2 * z)) return false;
    return true;
  }

  // Measured average prompt neutrons per fission. Thermal values for the fissile
  // actinides, spontaneous-fission values for the californium region.
  var NU_BAR = {
    '90-232': 2.21, '91-231': 2.30, '92-233': 2.49, '92-235': 2.43,
    '92-236': 2.40, '92-238': 2.78, '93-237': 2.72, '94-239': 2.88,
    '94-240': 2.88, '94-241': 2.94, '94-242': 2.95, '94-244': 3.05,
    '95-241': 3.10, '95-242': 3.20, '95-243': 3.25, '96-242': 3.30,
    '96-244': 2.72, '96-245': 3.10, '96-246': 3.00, '96-248': 3.10,
    '97-249': 3.20, '98-249': 3.40, '98-250': 3.50, '98-251': 3.50,
    '98-252': 3.76, '99-252': 3.60, '100-256': 3.80
  };

  function nuBar(z, a) {
    var v = NU_BAR[Math.round(z) + '-' + Math.round(a)];
    if (v > 0) return v;
    // A fit through the measured actinide averages: neutron excess drives the
    // prompt count, and it climbs gently with the fissility of the nucleus.
    var fit = 2.43 + 0.0135 * (a - 235) + 0.115 * (z - 92);
    return Math.min(6, Math.max(1, fit));
  }

  // One event emits an integer number of neutrons whose average is nu-bar.
  function sampleNu(z, a) {
    var mean = nuBar(z, a);
    var lo = Math.floor(mean);
    return lo + (Math.random() < mean - lo ? 1 : 0);
  }

  // The mass-yield curve. Two Gaussians for the asymmetric actinide split, a
  // single one where symmetric fission takes over, and a small valley component
  // in between. Uranium-235 is the textbook pair the design asks for: 95 and 140,
  // sigma 5, equal weights.
  var PEAK_SIGMA_LIGHT = 5, PEAK_SIGMA_HEAVY = 5;
  var FISSILITY_SYMMETRIC = 33, FISSILITY_ASYMMETRIC = 36;
  var VALLEY_WEIGHT = 0.012;

  function yieldModel(z, a) {
    z = Math.round(z); a = Math.round(a);
    var mean = nuBar(z, a);
    var left = Math.max(2, a - mean);
    var mid = left / 2;
    var fissility = z * z / a;
    // The double peak is fully developed by uranium and collapses toward
    // symmetry in the heaviest nuclei, where the measured curves are single-humped.
    var ramp = Math.min(1, Math.max(0, (fissility - FISSILITY_SYMMETRIC) /
      (FISSILITY_ASYMMETRIC - FISSILITY_SYMMETRIC)));
    if (z >= 100) ramp = Math.max(0, ramp - (z - 99) * 0.22);
    var separation = 45 * ramp;
    if (z === 92 && (a === 235 || a === 236)) {
      return {
        peaks: [
          { mu: 95, sigma: PEAK_SIGMA_LIGHT, w: 0.5 },
          { mu: 140, sigma: PEAK_SIGMA_HEAVY, w: 0.5 }
        ], valley: null, symmetric: false, fissility: fissility, mid: mid, measured: true
      };
    }
    var al = mid - separation / 2, ah = mid + separation / 2;
    var symmetric = separation < 6;
    var peaks = symmetric
      ? [{ mu: mid, sigma: 9, w: 1 }]
      : [
        { mu: al, sigma: PEAK_SIGMA_LIGHT, w: (1 - VALLEY_WEIGHT) / 2 },
        { mu: ah, sigma: PEAK_SIGMA_HEAVY, w: (1 - VALLEY_WEIGHT) / 2 }
      ];
    return {
      peaks: peaks,
      valley: symmetric ? null : { mu: mid, sigma: 9, w: VALLEY_WEIGHT },
      symmetric: symmetric, fissility: fissility, mid: mid, measured: false
    };
  }

  function gauss(x, mu, sigma) {
    var d = x - mu;
    return Math.exp(-(d * d) / (2 * sigma * sigma)) / (sigma * Math.sqrt(2 * Math.PI));
  }

  // Relative yield in percent, normalised so the whole curve sums to 200 %: two
  // fragments per fission, which is how a mass-yield curve is actually published.
  function yieldAt(z, a, mass) {
    var m = yieldModel(z, a);
    var parts = m.peaks.slice();
    if (m.valley) parts.push(m.valley);
    var area = 0;
    for (var i = 0; i < parts.length; i++) area += parts[i].w;
    var y = 0;
    for (var j = 0; j < parts.length; j++) y += parts[j].w * gauss(mass, parts[j].mu, parts[j].sigma);
    return (y / area) * 200;
  }

  function sampleMass(m) {
    var parts = m.peaks.slice();
    if (m.valley) parts.push(m.valley);
    var total = 0, i;
    for (i = 0; i < parts.length; i++) total += parts[i].w;
    var r = Math.random() * total, acc = 0, pick = parts[parts.length - 1];
    for (i = 0; i < parts.length; i++) {
      acc += parts[i].w;
      if (r <= acc) { pick = parts[i]; break; }
    }
    // Box-Muller: one normal deviate per draw, no rejection loop to bias the tail.
    var u = Math.random() || 1e-12, v = Math.random();
    var n = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return pick.mu + pick.sigma * n;
  }

  // Charge split by unchanged charge distribution: the fragments inherit the
  // parent's Z/A, which is what the measured isobaric yields show to within about
  // one proton. The rounding is corrected so the two charges still sum to Z.
  function splitCharge(z, a1, a2) {
    var total = a1 + a2;
    if (!(total > 0)) return null;
    var z1 = Math.round(z * a1 / total);
    z1 = Math.min(Math.max(1, z1), z - 1);
    var z2 = z - z1;
    if (z1 > a1 || z2 > a2 || z1 < 1 || z2 < 1) return null;
    return { z1: z1, z2: z2 };
  }

  // Measured total energy released per fission, MeV. The mass formula is a liquid
  // drop: it has no shell structure, and the heavy fragment peak sits exactly on
  // the Z=50 / N=82 closed shells it cannot see. So SEMF under-binds the fragments
  // and returns ~165-180 MeV where a calorimeter reads ~202. The SEMF number is
  // still the gate the design asks for - a split with Q <= 0 is re-rolled - and it
  // is reported as the prompt Q of that specific pair. Where the total has been
  // measured, that is what the world is paid, and it is labelled as measured.
  var FISSION_ENERGY = {
    '90-232': 194.0, '92-233': 197.9, '92-235': 202.5, '92-236': 202.5,
    '92-238': 205.9, '94-239': 207.1, '94-240': 207.6, '94-241': 210.8,
    '94-242': 211.3, '95-241': 212.0, '95-242': 213.1, '96-245': 214.0,
    '98-252': 219.0
  };
  // U-235 thermal: 169.1 MeV of the 202.5 leaves as fragment kinetic energy.
  var FRAGMENT_KE_FRACTION = 169.1 / 202.5;

  function fissionEnergy(z, a) {
    var v = FISSION_ENERGY[Math.round(z) + '-' + Math.round(a)];
    return v > 0 ? v : null;
  }

  // The compound nucleus. A neutron caught by U-235 makes U-236, and it is U-236
  // that splits: 236 = A_light + A_heavy + nu. Spontaneous fission skips the
  // capture and splits the nucleus as it stands.
  function compoundA(a, captured) { return Math.round(a) + (captured ? 1 : 0); }

  // The split itself. A mass is drawn from the yield curve, the complement is
  // fixed by conservation, and the pair is only accepted when the mass formula
  // says the reaction releases energy. Q <= 0 is re-rolled, never displayed.
  function sampleFission(z, a, opts) {
    opts = opts || {};
    z = Math.round(z);
    if (!(a > 0)) a = REFERENCE_A[z] || Math.round(z * 2.5);
    a = Math.round(a);
    if (!fissionable(z, a)) return null;
    var tries = opts.tries || 400;
    var model = yieldModel(z, a);
    var parentB = binding(z, a);
    var measuredTotal = fissionEnergy(z, a);
    for (var i = 0; i < tries; i++) {
      var nu = sampleNu(z, a);
      if (nu >= a - 2) continue;
      var drawn = Math.round(sampleMass(model));
      var a1 = drawn, a2 = a - nu - drawn;
      if (a1 < 4 || a2 < 4) continue;
      // The draw names one fragment; the lighter of the pair is the light one.
      var light = Math.min(a1, a2), heavy = Math.max(a1, a2);
      var ch = splitCharge(z, light, heavy);
      if (!ch) continue;
      var zl = a1 <= a2 ? ch.z1 : ch.z2;
      var zh = a1 <= a2 ? ch.z2 : ch.z1;
      if (zl > light || zh > heavy) continue;
      var q = binding(zl, light) + binding(zh, heavy) - parentB;
      if (!(q > 0)) continue;
      var total = measuredTotal === null ? q : measuredTotal;
      var ev = {
        parent: { z: z, a: a },
        light: { z: zl, a: light }, heavy: { z: zh, a: heavy },
        nu: nu, q: q, qSource: 'SEMF', tries: i + 1,
        energy: total, energySource: measuredTotal === null ? 'SEMF' : 'measured',
        qJ: total * MEV_IN_J,
        kjPerMol: total * MEV_IN_J * AVOGADRO / 1000,
        jPerKg: (1000 / a) * AVOGADRO * total * MEV_IN_J,
        model: model
      };
      ev.kilotonnes = ev.jPerKg / KTONNE_TNT_J;
      // Momentum is equal and opposite, so the lighter fragment is the faster
      // one and carries the larger share of the kinetic energy.
      ev.fragmentKinetic = total * FRAGMENT_KE_FRACTION;
      ev.lightEnergy = ev.fragmentKinetic * heavy / (light + heavy);
      ev.heavyEnergy = ev.fragmentKinetic * light / (light + heavy);
      // The first physically allowed draw is the event: re-rolling until the
      // biggest Q would bias the yield curve away from the measured one.
      return ev;
    }
    return null;
  }

  // ── The environment as a fission source ───────────────────────────────────

  // A formula parser that handles the nested groups the environment tab accepts.
  // Returns a map of symbol -> count, or null when the formula is not one.
  function parseFormula(text) {
    if (typeof text !== 'string' || !text.trim()) return null;
    var s = text.trim(), pos = 0, stack = [{}], ok = true;
    function readCount() {
      var m = /^\d+/.exec(s.slice(pos));
      if (!m) return 1;
      pos += m[0].length;
      return parseInt(m[0], 10);
    }
    function merge(dst, src, mult) {
      for (var k in src) if (Object.prototype.hasOwnProperty.call(src, k)) {
        dst[k] = (dst[k] || 0) + src[k] * mult;
      }
    }
    while (pos < s.length && ok) {
      var c = s[pos];
      if (c === '(' || c === '[') { pos++; stack.push({}); continue; }
      if (c === ')' || c === ']') {
        pos++;
        if (stack.length < 2) { ok = false; break; }
        var group = stack.pop();
        merge(stack[stack.length - 1], group, readCount());
        continue;
      }
      var m2 = /^([A-Z][a-z]?)/.exec(s.slice(pos));
      if (!m2) { ok = false; break; }
      pos += m2[0].length;
      var top = stack[stack.length - 1];
      top[m2[1]] = (top[m2[1]] || 0) + readCount();
    }
    if (!ok || stack.length !== 1) return null;
    var out = stack[0], n = 0;
    for (var k2 in out) n++;
    return n ? out : null;
  }

  function zOfSymbol(sym) {
    var list = elementTable();
    if (!list) return 0;
    for (var i = 0; i < list.length; i++) if (list[i].sym === sym) return list[i].z;
    return 0;
  }

  // Every element the environment currently holds, with the share of the gas
  // mixture it sits in. Reads the live atmosphere first (it is what the chemistry
  // actually sees) and falls back to the raw tab state.
  function environmentElements() {
    var A = window.__mol3d;
    if (!A) return [];
    var found = {}, gases = [];
    var atm = A.atmosphere;
    if (atm && atm.enabled && atm.composition && typeof atm.composition.forEach === 'function') {
      atm.composition.forEach(function (frac, formula) { gases.push({ formula: formula, share: frac }); });
    }
    if (!gases.length && A.environment && Array.isArray(A.environment.gases)) {
      var total = 0;
      A.environment.gases.forEach(function (g) { total += Math.max(0, Number(g.ratio) || 0); });
      A.environment.gases.forEach(function (g) {
        gases.push({ formula: g.formula, share: total > 0 ? (Number(g.ratio) || 0) / total : 0 });
      });
    }
    for (var i = 0; i < gases.length; i++) {
      var parts = parseFormula(gases[i].formula);
      if (!parts) continue;
      for (var sym in parts) {
        if (!Object.prototype.hasOwnProperty.call(parts, sym)) continue;
        var z = zOfSymbol(sym);
        if (!z) continue;
        if (!found[z]) found[z] = { z: z, sym: sym, share: 0, formulas: [] };
        found[z].share += gases[i].share;
        if (found[z].formulas.indexOf(gases[i].formula) === -1) found[z].formulas.push(gases[i].formula);
      }
    }
    var out = [];
    for (var k in found) out.push(found[k]);
    out.sort(function (a, b) { return b.z - a.z; });
    return out;
  }

  // The countdown belongs to an environment that is itself a fission source: a
  // gas mixture carrying an element beyond thorium. Loose atoms the player placed
  // by hand are not that, and they fission without a countdown.
  function environmentFissionSource() {
    var els = environmentElements();
    for (var i = 0; i < els.length; i++) {
      if (els[i].z >= FISSION_Z_MIN) {
        var a = REFERENCE_A[els[i].z] || Math.round(els[i].z * 2.5);
        return {
          z: els[i].z, a: a, sym: els[i].sym, share: els[i].share,
          formulas: els[i].formulas, label: nuclideLabel(els[i].z, a)
        };
      }
    }
    return null;
  }

  function formatLife(seconds) {
    var book = window.__mol3dBeta || window.__mol3dBetaPlus;
    if (book && typeof book.formatLife === 'function') return book.formatLife(seconds);
    if (!(seconds > 0) || !isFinite(seconds)) return '—';
    var units = [[YEAR_S, 'y'], [DAY_S, 'd'], [3600, 'h'], [60, 'min'], [1, 's'],
      [1e-3, 'ms'], [1e-6, 'µs'], [1e-9, 'ns']];
    for (var i = 0; i < units.length; i++) {
      if (seconds >= units[i][0]) {
        var v = seconds / units[i][0];
        return (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)) + ' ' + units[i][1];
      }
    }
    return seconds.toExponential(2) + ' s';
  }

  function formatEnergy(mev) {
    // An unknown or non-positive Q is not zero energy; printing "0 MeV" for it
    // would be a measured-looking number the physics never produced.
    if (mev == null || !isFinite(mev) || mev === 0) return '—';
    if (mev < 0) return '−' + formatEnergy(-mev);
    if (mev >= 1e6) return (mev / 1e6).toFixed(2) + ' TeV';
    if (mev >= 1e3) return (mev / 1e3).toFixed(2) + ' GeV';
    if (mev >= 1) return mev.toFixed(3) + ' MeV';
    if (mev >= 1e-3) return (mev * 1e3).toFixed(2) + ' keV';
    return (mev * 1e6).toFixed(2) + ' eV';
  }

  window.__nuclear = {
    version: VERSION,
    SEMF: SEMF,
    constants: {
      LN2: LN2, MEV_IN_J: MEV_IN_J, AVOGADRO: AVOGADRO,
      KTONNE_TNT_J: KTONNE_TNT_J, YEAR_S: YEAR_S, B_ALPHA: B_ALPHA
    },
    binding: binding,
    bindingPerNucleon: bindingPerNucleon,
    qAlpha: qAlpha,
    betaQ: betaQ,
    alpha: alpha,
    clock: clock,
    sampleMode: sampleMode,
    sampleBranch: sampleBranch,
    chain: chain,
    decayNetwork: decayNetwork,
    chainSolver: chainSolver,
    lambdaOf: lambdaOf,
    meanLifeOf: meanLifeOf,
    fractionLeft: fractionLeft,
    remaining: remaining,
    activity: activity,
    molarActivity: molarActivity,
    fissionable: fissionable,
    FISSION_Z_MIN: FISSION_Z_MIN,
    fissionEnergy: fissionEnergy,
    compoundA: compoundA,
    nuBar: nuBar,
    yieldModel: yieldModel,
    yieldAt: yieldAt,
    splitCharge: splitCharge,
    sampleFission: sampleFission,
    environmentElements: environmentElements,
    environmentFissionSource: environmentFissionSource,
    parseFormula: parseFormula,
    referenceA: function (z) { return REFERENCE_A[z] || null; },
    hasAlphaData: function (z, a) { return !!alphaData(z, a); },
    hasBetaData: function (z, a) { return !!heavyBetaData(z, a); },
    measuredAlphaCount: function () { return Object.keys(ALPHA).length; },
    measuredBetaCount: function () { return Object.keys(HEAVY_BETA_MINUS).length; },
    nuclideLabel: nuclideLabel,
    symbolOf: symbolOf,
    nameOf: nameOf,
    formatLife: formatLife,
    formatEnergy: formatEnergy
  };
})();