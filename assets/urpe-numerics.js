(function (root) {
  'use strict';

  const R = 8.31446261815324; // Exact SI constants keep the two kinetic models consistent.
  const KB = 1.380649e-23;
  const PLANCK = 6.62607015e-34;
  const KNOWN = new Set(['measured', 'calculated', 'empirical']);
  const owns = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const absent = value => value === undefined || value === null;
  const finiteOrNull = value => Number.isFinite(value) ? value : null;

  function fail(message) { throw new Error('URPENumerics: ' + message); }
  function object(value, name) {
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
      fail(name + ' must be a plain object');
    }
  }
  function number(value, name, minimum = -Infinity, strict = false) {
    if (typeof value !== 'number' || !Number.isFinite(value) ||
        (strict ? value <= minimum : value < minimum)) {
      fail(name + ' must be finite' + (minimum === -Infinity ? '' :
        ' and ' + (strict ? 'greater than ' : 'at least ') + minimum));
    }
    return value;
  }
  function integer(value, name, minimum, maximum) {
    number(value, name, minimum);
    if (!Number.isSafeInteger(value) || value > maximum) {
      fail(name + ' must be an integer between ' + minimum + ' and ' + maximum);
    }
    return value;
  }
  function id(value, name) {
    if (typeof value !== 'string' || !value.trim() || value.length > 128) {
      fail(name + ' must be a nonempty string of at most 128 characters');
    }
    return value;
  }
  function provenance(value, name) {
    if (!absent(value) && value !== 'unknown' && !KNOWN.has(value)) {
      fail(name + ' must be measured, calculated, empirical, or unknown');
    }
    return KNOWN.has(value) ? value : 'unknown';
  }
  function source(value, name) {
    if (!absent(value) && typeof value !== 'string') fail(name + ' must be a string');
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }
  // The rate coefficient carries units of concentration^(1 - order) per second. The
  // exponent is a number, so it is printed above the line instead of after a caret.
  const SUP = { '-': '\u207B', '0': '\u2070', '1': '\u00B9', '2': '\u00B2', '3': '\u00B3', '4': '\u2074', '5': '\u2075', '6': '\u2076', '7': '\u2077', '8': '\u2078', '9': '\u2079', '.': '\u00B7' };
  function sup(value) {
    return String(value).split('').map(character => SUP[character] || character).join('');
  }
  function rateUnits(order) {
    if (order === 1) return 's\u207B\u00B9';
    if (order === 0) return 'mol\u00b7L\u207b\u00b9 s\u207B\u00B9';
    return '(mol\u00b7L\u207b\u00b9)' + sup(1 - order) + ' s\u207B\u00B9';
  }
  function exponential(logValue) {
    if (!Number.isFinite(logValue)) return null;
    const value = Math.exp(logValue);
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  function sum(values) {
    let total = 0;
    let correction = 0;
    for (const value of values) {
      const adjusted = value - correction;
      const next = total + adjusted;
      correction = (next - total) - adjusted;
      total = next;
    }
    return total;
  }

  // --- temperature dependence: the three-regime ladder ------------------------
  // ΔT = |T − the species reference temperature| decides how much heat-capacity
  // data an answer is entitled to demand, provided the path stays in one phase:
  //   ΔT ≤ ELLINGHAM_BAND     Ellingham: ΔG°(T) = ΔH° − T·ΔS° with both held at the
  //                           tabulated values. Over this band Cp·ΔT and
  //                           T·Cp·ln(T/Tref) cancel to well under the precision the
  //                           enthalpies are quoted at, so no Cp is demanded here.
  //   ΔT ≤ POLYNOMIAL_REGIME  Kirchhoff with a constant ΔCp°: H(T) = H(ref) + Cp(T−ref),
  //                           S(T) = S(ref) + Cp ln(T/ref).
  //   beyond, or whenever the path crosses a phase boundary, the published Cp°(T)
  //   polynomial is integrated over each interval and every boundary contributes
  //   ΔH_phase to the enthalpy and ΔH_phase/T_phase to the entropy. Adding both is
  //   what keeps ΔG° continuous through a transition: only its slope changes, which
  //   is the kink an Ellingham diagram shows at a melting or boiling point.
  // A species that ships polynomial data uses it as soon as the Ellingham band is
  // left, because the integral is the same arithmetic with better numbers and it
  // removes the discontinuity a constant-Cp truncation would introduce at 200 K.
  // Where a regime's data is absent the answer falls back to the next approximation
  // down and says so in `model`, rather than refusing to price a route: a species
  // with no Cp measurement at 1500 K is reported as an Ellingham extrapolation, not
  // silently passed off as an integration.
  const ELLINGHAM_BAND = 30;
  const POLYNOMIAL_REGIME = 200;
  const T_KINK = 1e-9; // interval edges are read from tables; do not split them twice

  // Shomate form: Cp° = A + B·t + C·t² + D·t³ + E/t² with t = T/1000 and Cp° in
  // J·mol⁻¹·K⁻¹. Both primitives below are exact, so no quadrature enters the
  // answer: ∫Cp°dT comes out in J·mol⁻¹ (the 1000 converts dt back to dT) and
  // ∫Cp°/T dT in J·mol⁻¹·K⁻¹.
  function shomateEnthalpy(piece, from, to) {
    const h = t => piece.A * t + piece.B * t * t / 2 + piece.C * t * t * t / 3 +
      piece.D * t * t * t * t / 4 - piece.E / t;
    return 1000 * (h(to / 1000) - h(from / 1000));
  }
  function shomateEntropy(piece, from, to) {
    const s = t => piece.A * Math.log(t) + piece.B * t + piece.C * t * t / 2 +
      piece.D * t * t * t / 3 - piece.E / (2 * t * t);
    return s(to / 1000) - s(from / 1000);
  }
  // Cp°(298.15 K) from a piece, used only to report which model a term used.
  function shomateCpAt(piece, T) {
    const t = T / 1000;
    return piece.A + piece.B * t + piece.C * t * t + piece.D * t * t * t + piece.E / (t * t);
  }

  function shomatePieces(list, name) {
    if (absent(list)) return null;
    if (!Array.isArray(list) || !list.length) fail(name + ' must be a nonempty array');
    return list.map((piece, i) => {
      object(piece, name + '[' + i + ']');
      for (const key of ['A', 'B', 'C', 'D', 'E']) number(piece[key], name + '[' + i + '].' + key);
      const from = number(piece.from, name + '[' + i + '].from (K)', 0, true);
      const to = number(piece.to, name + '[' + i + '].to (K)', 0, true);
      if (!(to > from)) fail(name + '[' + i + '] must satisfy to > from');
      return { from, to, A: piece.A, B: piece.B, C: piece.C, D: piece.D, E: piece.E };
    }).sort((x, y) => x.from - y.from);
  }

  // An interval is one phase of the substance, ordered by increasing temperature.
  // `to` closes it, `dH` (kJ·mol⁻¹) is the enthalpy absorbed entering it from the
  // interval below at that boundary, and Cp inside it comes from `cpPoly` where the
  // polynomial covers the stretch and from the constant `cp` where it does not.
  function phaseIntervals(term, name) {
    const direct = shomatePieces(term.cpPoly, name + '.cpPoly');
    const constant = absent(term.cp) ? null : number(term.cp, name + '.cp', 0);
    if (absent(term.cpIntervals)) {
      if (direct === null && constant === null) return null;
      return [{ phase: term.phase, from: 0, to: Infinity, dH: null, cpPoly: direct, cp: constant }];
    }
    if (!Array.isArray(term.cpIntervals) || !term.cpIntervals.length) {
      fail(name + '.cpIntervals must be a nonempty array');
    }
    let floor = 0;
    return term.cpIntervals.map((iv, i) => {
      object(iv, name + '.cpIntervals[' + i + ']');
      if (!['g', 'aq', 'l', 's'].includes(iv.phase)) fail(name + '.cpIntervals[' + i + '].phase is invalid');
      const from = i === 0 ? 0 : floor;
      const to = absent(iv.to) ? Infinity : number(iv.to, name + '.cpIntervals[' + i + '].to (K)', 0, true);
      if (!(to > from)) fail(name + '.cpIntervals[' + i + '] must rise above the interval below it');
      floor = to;
      const dH = absent(iv.dH) ? null : number(iv.dH, name + '.cpIntervals[' + i + '].dH (kJ·mol⁻¹)', 0);
      if (i > 0 && dH === null) fail(name + '.cpIntervals[' + i + '].dH is required above the first interval');
      const pieces = shomatePieces(iv.cpPoly, name + '.cpIntervals[' + i + '].cpPoly');
      const cp = absent(iv.cp) ? constant : number(iv.cp, name + '.cpIntervals[' + i + '].cp', 0);
      if (pieces === null && cp === null) {
        fail(name + '.cpIntervals[' + i + '] needs cpPoly or cp: nothing integrates inside it');
      }
      return { phase: iv.phase, from, to, dH, cpPoly: pieces, cp };
    });
  }

  // Integrate one interval between a and b. Polynomial pieces are used wherever
  // they reach; an uncovered stretch uses the interval's constant Cp, and a stretch
  // neither covers is returned as a gap for the caller to downgrade over.
  function intervalStretch(iv, a, b) {
    const out = { dH: 0, dS: 0, polynomial: false, constant: false, gaps: [] };
    const finish = (from, to) => {
      if (!(to > from)) return;
      if (iv.cp !== null) {
        out.dH += iv.cp * (to - from);
        out.dS += iv.cp * (Math.log(to) - Math.log(from));
        out.constant = true;
      } else out.gaps.push({ from, to });
    };
    if (b <= a) return out;
    if (!iv.cpPoly) { finish(a, b); return out; }
    let cursor = a;
    for (const piece of iv.cpPoly) {
      if (piece.to <= cursor + T_KINK) continue;
      if (piece.from > cursor) {
        finish(cursor, Math.min(piece.from, b));
        cursor = Math.min(piece.from, b);
        if (cursor >= b) break;
      }
      const from = Math.max(cursor, piece.from), to = Math.min(b, piece.to);
      if (to > from + T_KINK) {
        out.dH += shomateEnthalpy(piece, from, to);
        out.dS += shomateEntropy(piece, from, to);
        out.polynomial = true;
        cursor = to;
      }
      if (cursor >= b) break;
    }
    finish(cursor, b);
    return out;
  }

  // Walk the ladder from the reference temperature to T. Returns the signed
  // enthalpy (J·mol⁻¹) and entropy (J·mol⁻¹·K⁻¹) differences, the boundaries
  // crossed, and every stretch the supplied data could not integrate.
  function heatPath(intervals, Tref, T) {
    let reference = -1;
    for (let i = 0; i < intervals.length; i++) {
      if (Tref >= intervals[i].from && Tref < intervals[i].to) { reference = i; break; }
    }
    if (reference < 0) return { gap: 'the reference temperature lies outside the supplied phase intervals' };
    const lo = Math.min(Tref, T), highest = Math.max(Tref, T);
    // The walk covers exactly what the ladder publishes. A temperature above the
    // ladder's top still accumulates every interval below it and reports the
    // uncovered tail as a gap: discarding the whole correction would snap ΔG°(T)
    // back to its 298.15 K reference values the moment the top is passed.
    const ceiling = intervals[intervals.length - 1].to;
    const hi = Math.min(highest, ceiling);
    const sign = T >= Tref ? 1 : -1;
    const crossed = [];
    const gaps = [];
    let dH = 0, dS = 0, polynomial = false, constant = false;
    for (let i = 0; i < intervals.length; i++) {
      const iv = intervals[i];
      const from = Math.max(lo, iv.from), to = Math.min(hi, iv.to);
      if (to > from) {
        const stretch = intervalStretch(iv, from, to);
        dH += stretch.dH;
        dS += stretch.dS;
        polynomial = polynomial || stretch.polynomial;
        constant = constant || stretch.constant;
        for (const gap of stretch.gaps) gaps.push(gap);
      }
    }
    // A boundary strictly inside the path contributes its latent heat. Entropy
    // takes the same heat at the boundary temperature, which is why ΔG° through a
    // transition stays continuous and only changes slope. Going upward the substance
    // absorbs it; going downward the same crossing releases it.
    for (let i = 1; i < intervals.length; i++) {
      const boundary = intervals[i].from;
      if (!(boundary > lo + T_KINK && boundary < hi - T_KINK)) continue;
      if (intervals[i].dH === null) { gaps.push({ from: boundary, to: boundary, boundary: true }); continue; }
      const absorbed = sign > 0;
      crossed.push({
        temperature: boundary,
        dH: absorbed ? intervals[i].dH : -intervals[i].dH,
        from: absorbed ? intervals[i - 1].phase : intervals[i].phase,
        to: absorbed ? intervals[i].phase : intervals[i - 1].phase,
        absorbed
      });
      // Accumulated over the ascending span; the single `sign` in the return value
      // below turns the whole path around for cooling.
      dH += intervals[i].dH * 1000;
      dS += intervals[i].dH * 1000 / boundary;
    }
    if (highest > ceiling) gaps.push({ from: ceiling, to: highest });
    return { dH: dH * sign, dS: dS * sign, crossed, gaps, polynomial, constant, sign };
  }

  function thermo(terms, T, options = {}) {
    number(T, 'T (K)', 0, true);
    object(options, 'thermo options');
    if (!Array.isArray(terms) || !terms.length || terms.length > 4096) {
      fail('thermo terms must contain between 1 and 4096 entries');
    }
    for (const key of ['pStandard', 'cStandard']) {
      if (!absent(options[key])) number(options[key], 'options.' + key, 0, true);
    }
    const assumptions = [
      'dH and dG are kJ·mol⁻¹ of reaction; dS is J·mol⁻¹·K⁻¹; T is K.',
      'Activities and K are dimensionless; no activity coefficients are inferred.',
      'Temperature dependence follows the three-regime ladder documented under "Temperature model"; phase transitions are added only where the term ships them.',
      'Reference temperatures and standard states must be supplied; pressure standards apply to all phases, concentration standards to aqueous terms.'
    ];
    const missing = [];
    const note = message => { if (!missing.includes(message)) missing.push(message); };
    const prepared = Array.from(terms, (term, index) => {
      const name = 'terms[' + index + ']';
      object(term, name);
      number(term.nu, name + '.nu');
      if (term.nu === 0) fail(name + '.nu must be nonzero');
      if (!['g', 'aq', 'l', 's'].includes(term.phase)) fail(name + '.phase must be g, aq, l, or s');
      for (const key of ['hf', 's', 'cp', 'referenceTemperature', 'pStandard', 'cStandard', 'activity']) {
        if (!absent(term[key])) {
          const positive = ['referenceTemperature', 'pStandard', 'cStandard'].includes(key);
          const minimum = positive || key === 'cp' || key === 'activity' ? 0 : -Infinity;
          number(term[key], name + '.' + key, minimum, positive);
        }
      }
      const origin = provenance(term.provenance, name + '.provenance');
      const citation = source(term.source, name + '.source');
      const trusted = origin !== 'unknown' && citation !== null;
      if (!trusted) note(name + ': known provenance and nonempty source required');
      if (absent(term.referenceTemperature)) note(name + '.referenceTemperature');
      if (absent(term.hf)) note(name + '.hf');
      if (absent(term.s)) note(name + '.s');
      return { term, name, index, origin, trusted, intervals: phaseIntervals(term, name) };
    });

    let standardsKnown = true;
    for (const key of ['pStandard', 'cStandard']) {
      let standard = options[key];
      for (const { term, name } of prepared) {
        if (key === 'cStandard' && term.phase !== 'aq') continue;
        if (absent(term[key])) {
          standardsKnown = false;
          note(name + '.' + key);
        } else if (absent(standard)) {
          standard = term[key];
        } else if (standard !== term[key]) {
          standardsKnown = false;
          note('Incompatible ' + key + ': standard-state conversion data are not available');
        }
      }
      if (!absent(standard)) assumptions.push(key + ' = ' + standard + (key === 'pStandard' ? ' bar.' : ' mol·L⁻¹.'));
    }

    const enthalpies = [];
    const entropies = [];
    const references = new Set(prepared.map(({term}) => term.referenceTemperature).filter(value => !absent(value)));
    // Formation enthalpies at unlike reference temperatures use unlike elemental baselines.
    const commonReference = references.size <= 1;
    if (!commonReference) note('Incompatible formation-enthalpy reference temperatures: elemental reference corrections required');
    let hKnown = standardsKnown && commonReference;
    let sKnown = standardsKnown;
    let defaultPureActivity = false;
    let qKnown = true;
    let zeroReactant = false;
    let zeroProduct = false;
    const logarithms = [];
    // Which rung of the ladder each term was priced with, and what had to be left
    // out on that rung. The panels show this instead of a bare number so a value
    // carried 2000 K on tabulated enthalpies is never read as an integration.
    const model = {
      T, band: ELLINGHAM_BAND, polynomialRegime: POLYNOMIAL_REGIME,
      regime: 'standard state', maxAbsDT: 0, crossings: 0, terms: [], caveats: []
    };
    const caveat = message => { if (!model.caveats.includes(message)) model.caveats.push(message); };
    for (const { term, name, index, trusted, intervals } of prepared) {
      const refKnown = !absent(term.referenceTemperature);
      const usable = trusted && refKnown;
      let h = term.hf;
      let s = term.s;
      const entry = {
        index, reference: refKnown ? term.referenceTemperature : null,
        dT: refKnown ? Math.abs(T - term.referenceTemperature) : null,
        regime: 'standard state', basis: 'ΔfH° and S° as tabulated at the reference temperature',
        crossings: [], gaps: []
      };
      if (usable && entry.dT > 0) {
        const lo = Math.min(T, term.referenceTemperature), hi = Math.max(T, term.referenceTemperature);
        const crosses = intervals ? intervals.some((iv, i) =>
          i > 0 && iv.from > lo + T_KINK && iv.from < hi - T_KINK) : false;
        const demanded = crosses || entry.dT > POLYNOMIAL_REGIME ? 3 : entry.dT > ELLINGHAM_BAND ? 2 : 1;
        entry.regime = demanded === 1 ? 'Ellingham' : demanded === 2 ? 'Kirchhoff, constant ΔCp°' : 'Cp°(T) integration';
        if (demanded !== 1) {
          if (!intervals) {
            entry.regime = 'Ellingham (no Cp° published)';
            entry.basis = 'no heat capacity published: ΔH° and ΔS° held at their reference values';
            caveat(name + ': no measured heat capacity, so ΔG°(T) is an Ellingham extrapolation ' +
              entry.dT.toFixed(2) + ' K off its reference temperature.');
          } else {
            const path = heatPath(intervals, term.referenceTemperature, T);
            if (path.gap) {
              entry.regime = 'Ellingham (Cp° does not reach this far)';
              caveat(name + ' (' + (demanded === 3 ? 'Cp°(T) integration' : 'Kirchhoff') + '): ' + path.gap +
                ', so ΔH° and ΔS° stay at their reference values.');
              entry.basis = 'phase intervals do not span the path; reference values held';
            } else {
              if (!absent(h)) h += path.dH / 1000;
              if (!absent(s)) s += path.dS;
              entry.crossings = path.crossed;
              entry.gaps = path.gaps;
              model.crossings += path.crossed.length;
              // Report the arithmetic that actually ran, not the rung the shift asked
              // for: a 1500 K path over a species with only a constant Cp° is a
              // Kirchhoff correction, and calling it an integration would be a lie.
              entry.regime = path.polynomial ? 'Cp°(T) integration'
                : path.constant ? 'Kirchhoff, constant ΔCp°'
                : 'Ellingham (no Cp° published)';
              entry.basis = path.polynomial && path.constant
                ? 'Cp°(T) integrated where published, constant Cp° where the polynomial stops'
                : path.polynomial ? 'Shomate Cp°(T) integrated across every interval'
                : path.constant ? 'constant Cp° integrated across every interval'
                : 'no Cp° published above the reference temperature';
              for (const c of path.crossed) {
                caveat(name + ': crosses the ' + c.from + '→' + c.to +
                  ' boundary at ' + c.temperature.toFixed(2) + ' K, which ' +
                  (c.absorbed ? 'absorbs ' : 'releases ') + Math.abs(c.dH).toFixed(3) +
                  ' kJ·mol⁻¹ into the enthalpy and the same over ' + c.temperature.toFixed(2) +
                  ' K into the entropy.');
              }
              for (const g of path.gaps) {
                caveat(name + ': no Cp° data ' +
                  (g.boundary ? 'for the phase boundary at ' + g.from.toFixed(2) + ' K'
                    : 'from ' + g.from.toFixed(2) + ' to ' + g.to.toFixed(2) + ' K') +
                  ', so that stretch contributes nothing.');
              }
            }
          }
        }
        if (entry.dT > model.maxAbsDT) model.maxAbsDT = entry.dT;
      }
      if (Number.isFinite(entry.dT) && entry.dT > 373.15 && term.phase === 'aq') {
        caveat(name + ': the aqueous standard state is used above the boiling point of water at 1 bar.');
      }
      model.terms.push(entry);
      if (usable && !absent(h) && Number.isFinite(term.nu * h)) enthalpies.push(term.nu * h);
      else { hKnown = false; if (usable && !absent(h)) note(name + ': enthalpy arithmetic overflow'); }
      if (usable && !absent(s) && Number.isFinite(term.nu * s)) entropies.push(term.nu * s);
      else { sKnown = false; if (usable && !absent(s)) note(name + ': entropy arithmetic overflow'); }
      let activity = term.activity;
      if (absent(activity) && (term.phase === 'l' || term.phase === 's')) {
        activity = 1;
        defaultPureActivity = true;
      }
      if (absent(activity)) {
        qKnown = false;
        note(name + '.activity');
      } else if (activity === 0) {
        if (term.nu < 0) zeroReactant = true;
        else zeroProduct = true;
      } else {
        logarithms.push(term.nu * Math.log(activity));
      }
    }
    const regimes = new Set(model.terms.map(entry => entry.regime));
    model.regime = regimes.size === 1 ? [...regimes][0] : 'mixed: ' + [...regimes].sort().join(', ');
    if (model.maxAbsDT > 0) {
      assumptions.push('Temperature model: ΔT ≤ ' + ELLINGHAM_BAND +
        ' K in one phase uses the Ellingham form ΔG°(T)=ΔH°−T·ΔS° with both held at the reference; ' +
        'ΔT ≤ ' + POLYNOMIAL_REGIME + ' K uses Kirchhoff with a constant ΔCp°; beyond that, or across a ' +
        'phase boundary, Cp°(T) is integrated over each interval and each boundary adds ΔH_phase to H° and ' +
        'ΔH_phase/T_phase to S°. Where a species ships Cp°(T) it is used as soon as the Ellingham band is left.');
    }
    if (model.crossings) {
      assumptions.push('Phase transitions on the path: ' + model.crossings +
        ' boundary(ies) crossed. ΔG° is continuous through each because a transition at equilibrium carries zero Gibbs energy; only its slope changes.');
    }
    if (model.terms.some(entry => entry.regime.indexOf('Ellingham (no Cp° published)') === 0 && entry.dT > ELLINGHAM_BAND)) {
      assumptions.push('At least one species has no measured heat capacity: its ΔH° and ΔS° are carried flat, so its share of ΔG°(T) is an extrapolation, not an integration.');
    }
    if (T > 2000) {
      assumptions.push('Above 2000 K no thermal dissociation or ionization is modelled, so a species whose tabulated phase has ceased to exist is still priced as that species.');
    }
    if (defaultPureActivity) assumptions.push('Unspecified pure liquid/solid activities are unity.');
    const dH = hKnown ? finiteOrNull(sum(enthalpies)) : null;
    const dS = sKnown ? finiteOrNull(sum(entropies)) : null;
    if (hKnown && dH === null) note('Reaction enthalpy arithmetic overflow');
    if (sKnown && dS === null) note('Reaction entropy arithmetic overflow');
    const dG0 = dH !== null && dS !== null ? finiteOrNull(dH - (T / 1000) * dS) : null;
    if (dH !== null && dS !== null && dG0 === null) note('Standard Gibbs energy arithmetic overflow');
    const lnK = dG0 === null ? null : finiteOrNull((-dG0 / T) * (1000 / R));
    const K = lnK === null ? null : exponential(lnK);
    if (dG0 !== null && lnK === null) note('lnK arithmetic overflow');
    if (lnK !== null && K === null) note('K outside the positive finite floating-point range; use lnK');
    let lnQ = null;
    if (zeroReactant && zeroProduct) note('lnQ indeterminate: zero activities on both sides');
    else if (qKnown) {
      if (zeroReactant) lnQ = Infinity;
      else if (zeroProduct) lnQ = -Infinity;
      else {
        lnQ = finiteOrNull(sum(logarithms));
        if (lnQ === null) note('lnQ arithmetic overflow');
      }
    }
    let dG = null;
    if (dG0 !== null && lnQ !== null) {
      if (!Number.isFinite(lnQ)) dG = lnQ;
      else {
        dG = finiteOrNull(dG0 + (R / 1000) * T * lnQ);
        if (dG === null) note('Gibbs energy arithmetic overflow');
      }
    }
    const origins = new Set(prepared.map(entry => entry.trusted ? entry.origin : 'unknown'));
    const origin = origins.has('unknown') ? 'unknown' : origins.size === 1 ? [...origins][0] : 'mixed';
    return { dH, dS, dG0, dG, lnK, K, lnQ, model, provenance: origin, assumptions, missing };
  }

  function rate(parameters, T, order = 1) {
    object(parameters, 'rate parameters');
    number(T, 'T (K)', 0, true);
    number(order, 'reaction order');
    const model = parameters.model;
    if (!['arrhenius', 'eyring', 'constant'].includes(model)) {
      fail('rate model must be arrhenius, eyring, or constant');
    }
    const origin = provenance(parameters.provenance, 'rate provenance');
    const citation = source(parameters.source, 'rate source');
    const trusted = origin !== 'unknown' && citation !== null;
    const assumptions = ['Concentration basis is mol·L⁻¹; no catalyst effects are inferred.'];
    const result = {
      k: null, logK: null, units: rateUnits(order),
      barrier: null, provenance: trusted ? origin : 'unknown', source: citation, assumptions
    };
    if (!trusted) assumptions.push('Rate unavailable: known provenance and nonempty source required.');
    function coefficient(key, minimum = -Infinity, strict = false) {
      const value = parameters[key];
      if (!absent(value) && typeof value !== 'number') fail('rate.' + key + ' must be numeric');
      if (absent(value) || !Number.isFinite(value)) {
        assumptions.push('Rate unavailable: finite ' + key + ' required.');
        return null;
      }
      return number(value, 'rate.' + key, minimum, strict);
    }
    let logValue = null;
    let exactZero = false;
    if (model === 'arrhenius') {
      const A = coefficient('A', 0);
      const Ea = coefficient('Ea');
      result.barrier = { model, quantity: 'Eₐ', value: trusted && Ea !== null ? Ea / 1000 : null, units: 'kJ·mol⁻¹' };
      assumptions.push('Arrhenius apparent activation energy Ea is not a Gibbs activation barrier; A has the returned rate units.');
      if (A !== null && Ea !== null) {
        exactZero = A === 0;
        logValue = exactZero ? -Infinity : Math.log(A) - (Ea / T) / R;
      }
    } else if (model === 'eyring') {
      const dH = coefficient('dH');
      const dS = coefficient('dS');
      const kappa = absent(parameters.kappa) ? 1 : coefficient('kappa', 0);
      if (kappa !== null && kappa > 1) fail('rate.kappa must be at most 1');
      const cStandard = absent(parameters.cStandard) ? 1 : coefficient('cStandard', 0, true);
      if (absent(parameters.kappa)) assumptions.push('Transmission coefficient kappa defaults to 1.');
      if (absent(parameters.cStandard)) assumptions.push('cStandard defaults to 1 mol·L⁻¹.');
      assumptions.push('Eyring transition-state approximation with cStandard^(1-order); activation dH and dS are treated as temperature independent.');
      result.barrier = {
        model, quantity: 'ΔG‡', units: 'kJ·mol⁻¹',
        value: trusted && dH !== null && dS !== null ? finiteOrNull(dH / 1000 - (T / 1000) * dS) : null
      };
      if (dH !== null && dS !== null && kappa !== null && cStandard !== null) {
        exactZero = kappa === 0;
        logValue = exactZero ? -Infinity : Math.log(kappa) + Math.log(KB / PLANCK) + Math.log(T) +
          dS / R - (dH / T) / R + (1 - order) * Math.log(cStandard);
      }
    } else {
      const k = coefficient('k', 0);
      const temperature = coefficient('temperature', 0, true);
      assumptions.push('A constant rate is usable only at its supplied temperature; no extrapolation.');
      if (temperature !== null && temperature !== T) assumptions.push('Rate unavailable: supplied temperature differs from T.');
      if (k !== null && temperature === T && trusted) {
        result.k = k;
        result.logK = k === 0 ? -Infinity : Math.log(k);
      }
      return result;
    }
    if (trusted && logValue !== null) {
      if (exactZero) {
        result.k = 0;
        result.logK = -Infinity;
        assumptions.push('Exactly zero supplied prefactor/transmission coefficient; not numerical underflow.');
      } else {
        result.logK = finiteOrNull(logValue);
        result.k = result.logK === null ? null : exponential(result.logK);
        if (result.k === null) assumptions.push('Rate outside the positive finite floating-point range; finite logK is retained when available.');
      }
    }
    return result;
  }

  function simulate(network, options) {
    object(network, 'network');
    object(options, 'simulation options');
    const duration = number(options.duration, 'duration (s)', 0, true);
    const points = absent(options.points) ? 100 : integer(options.points, 'points', 2, 10001);
    const rtol = absent(options.rtol) ? 1e-6 : number(options.rtol, 'rtol', 0, true);
    const atol = absent(options.atol) ? 1e-10 : number(options.atol, 'atol (mol·L⁻¹)', 0, true);
    if (rtol > 1 || atol > 1) fail('rtol and atol must be at most 1');
    const maxSteps = absent(options.maxSteps) ? 50000 : integer(options.maxSteps, 'maxSteps', 1, 1000000);
    if (!absent(options.cancelled) && typeof options.cancelled !== 'function') fail('cancelled must be a function');
    if (!Array.isArray(network.species) || !network.species.length || network.species.length > 128) {
      fail('network.species must contain between 1 and 128 entries');
    }
    if (!Array.isArray(network.reactions) || network.reactions.length > 512) fail('network.reactions must be an array of at most 512 entries');
    if (network.species.length * points > 1000000) fail('requested output exceeds 1000000 concentration values');
    object(network.initial, 'network.initial');
    const indices = new Map();
    const elements = new Set();
    const species = Array.from(network.species, (entry, index) => {
      object(entry, 'species[' + index + ']');
      const name = id(entry.id, 'species id');
      if (indices.has(name)) fail('duplicate species id: ' + name);
      indices.set(name, index);
      object(entry.composition, 'composition of ' + name);
      const charge = integer(entry.charge, 'charge of ' + name, -1000, 1000);
      const composition = new Map();
      const entries = Object.entries(entry.composition);
      if (entries.length > 128) fail('composition of ' + name + ' exceeds 128 elements/isotopes');
      for (const [element, count] of entries) {
        id(element, 'element/isotope key');
        integer(count, 'composition count for ' + name + '/' + element, 0, 1000000);
        if (count > 0) { composition.set(element, count); elements.add(element); }
      }
      if (!composition.size && charge === 0) fail('species ' + name + ' must carry a declared element/isotope or charge');
      return { id: name, composition, charge };
    });
    if (elements.size > 128) fail('network exceeds 128 element/isotope keys');
    let y = new Float64Array(species.length);
    for (const [name, value] of Object.entries(network.initial)) {
      if (!indices.has(name)) fail('initial concentration references undefined species: ' + name);
      y[indices.get(name)] = number(value, 'initial concentration of ' + name, 0);
    }
    const reactionIds = new Set();
    const reactions = Array.from(network.reactions, (reaction, index) => {
      object(reaction, 'reactions[' + index + ']');
      const name = id(reaction.id, 'reaction id');
      if (reactionIds.has(name)) fail('duplicate reaction id: ' + name);
      reactionIds.add(name);
      const k = number(reaction.k, 'k of ' + name, 0);
      // An omitted reverse rate means a declared irreversible model, not an estimated rate.
      const reverseK = owns(reaction, 'reverseK') ? number(reaction.reverseK, 'reverseK of ' + name, 0) : null;
      function side(value, label) {
        object(value, name + '.' + label);
        const entries = Object.entries(value).map(([key, count]) => {
          if (!indices.has(key)) fail(name + ' references undefined species: ' + key);
          return [indices.get(key), integer(count, name + '.' + label + '.' + key, 1, 1000)];
        });
        if (sum(entries.map(entry => entry[1])) > 1000) fail(name + '.' + label + ' exceeds total stoichiometry 1000');
        return entries;
      }
      const reactants = side(reaction.reactants, 'reactants');
      const products = side(reaction.products, 'products');
      if (!reactants.length && !products.length) fail(name + ' must have participants');
      const delta = new Float64Array(species.length);
      for (const [i, count] of reactants) delta[i] -= count;
      for (const [i, count] of products) delta[i] += count;
      for (const element of elements) {
        const balance = sum(species.map((entry, i) => delta[i] * (entry.composition.get(element) || 0)));
        if (balance !== 0) fail(name + ' is unbalanced for element/isotope ' + element);
      }
      if (sum(species.map((entry, i) => delta[i] * entry.charge)) !== 0) fail(name + ' is charge unbalanced');
      return {
        reactants, products, logForward: k === 0 ? -Infinity : Math.log(k),
        logReverse: reverseK === null || reverseK === 0 ? -Infinity : Math.log(reverseK),
        delta: Array.from(delta, (value, i) => [i, value]).filter(entry => entry[1] !== 0)
      };
    });

    const assumptions = [
      'Closed, homogeneous, constant-volume batch; concentrations in mol·L⁻¹ and time in s.',
      'Supplied rate constants remain fixed; elementary mass action uses stoichiometric powers with no factorial factors.',
      'Omitted initial concentrations are zero; omitted reverseK declares irreversibility.',
      'Adaptive RK4 step doubling uses the two-half-step state and an error estimate divided by 15; every negative stage or trial is rejected, never clipped or renormalized.',
      'steps counts all attempted steps, including rejections; explicit integration may exhaust its budget on stiff systems.',
      'conservationError is the maximum over accepted states and conserved inventories of abs(current-initial)/max(1,abs(initial)); no conservation correction is applied.',
      'IEEE-754 arithmetic is used; fluxes below its representable range may underflow, and overflowing trials are rejected.'
    ];
    const inventoryRows = [...elements].map(element => species.map(entry => entry.composition.get(element) || 0));
    inventoryRows.push(species.map(entry => entry.charge));
    const inventory = state => inventoryRows.map(row => sum(row.map((value, i) => value * state[i])));
    const initialInventory = inventory(y);
    if (initialInventory.some(value => !Number.isFinite(value))) fail('initial conserved inventories exceed the finite numeric range');
    let conservationError = 0;
    let steps = 0;
    let t = 0;
    let status = 'complete';
    const times = [0];
    const concentrations = Object.create(null);
    species.forEach((entry, i) => { concentrations[entry.id] = [y[i]]; });
    function record() {
      if (times[times.length - 1] === t) return;
      times.push(t);
      species.forEach((entry, i) => concentrations[entry.id].push(y[i]));
    }
    function flux(logRate, side, state) {
      if (logRate === -Infinity) return 0;
      let logValue = logRate;
      for (const [i, power] of side) {
        if (state[i] === 0) return 0;
        logValue += power * Math.log(state[i]);
      }
      return Math.exp(logValue);
    }
    function derivative(state) {
      const result = new Float64Array(state.length);
      for (const reaction of reactions) {
        const forward = flux(reaction.logForward, reaction.reactants, state);
        const reverse = flux(reaction.logReverse, reaction.products, state);
        if (!Number.isFinite(forward) || !Number.isFinite(reverse)) return null;
        const net = forward - reverse;
        for (const [i, coefficient] of reaction.delta) result[i] += coefficient * net;
      }
      return result.every(Number.isFinite) ? result : null;
    }
    function stage(state, derivativeValue, h) {
      if (!derivativeValue) return null;
      const result = new Float64Array(state.length);
      for (let i = 0; i < state.length; i++) {
        result[i] = state[i] + h * derivativeValue[i];
        if (!Number.isFinite(result[i]) || result[i] < 0) return null;
      }
      return result;
    }
    function rk4(state, h) {
      const a = derivative(state);
      const second = stage(state, a, h / 2);
      if (!second) return null;
      const b = derivative(second);
      const third = stage(state, b, h / 2);
      if (!third) return null;
      const c = derivative(third);
      const fourth = stage(state, c, h);
      if (!fourth) return null;
      const d = derivative(fourth);
      if (!d) return null;
      const result = new Float64Array(state.length);
      for (let i = 0; i < state.length; i++) {
        result[i] = state[i] + h * (a[i] / 6 + b[i] / 3 + c[i] / 3 + d[i] / 6);
        if (!Number.isFinite(result[i]) || result[i] < 0) return null;
      }
      return result;
    }
    let h = duration / (points - 1);
    outer: for (let point = 1; point < points; point++) {
      const target = point === points - 1 ? duration : duration * (point / (points - 1));
      while (t < target) {
        if (options.cancelled && options.cancelled()) { status = 'cancelled'; break outer; }
        if (steps >= maxSteps) { status = 'step-limit'; break outer; }
        const remaining = target - t;
        const step = Math.min(h, remaining);
        if (!(step > 0) || t + step === t || step / 2 === 0) {
          status = 'step-limit';
          assumptions.push('Stopped because a positive time step/half-step is no longer representable.');
          break outer;
        }
        steps++;
        const whole = rk4(y, step);
        const firstHalf = whole ? rk4(y, step / 2) : null;
        const fine = firstHalf ? rk4(firstHalf, step / 2) : null;
        if (!fine) { h = step / 2; continue; }
        let error = 0;
        for (let i = 0; i < y.length; i++) {
          const scale = atol + rtol * Math.max(Math.abs(y[i]), Math.abs(fine[i]));
          error = Math.max(error, Math.abs(fine[i] - whole[i]) / scale / 15);
        }
        if (!Number.isFinite(error) || error > 1) {
          h = step * (Number.isFinite(error) ? Math.max(0.1, 0.9 * Math.pow(error, -0.2)) : 0.5);
          continue;
        }
        const currentInventory = inventory(fine);
        if (currentInventory.some(value => !Number.isFinite(value))) { h = step / 2; continue; }
        y = fine;
        t = step === remaining ? target : t + step;
        currentInventory.forEach((value, i) => {
          conservationError = Math.max(conservationError, Math.abs(value - initialInventory[i]) / Math.max(1, Math.abs(initialInventory[i])));
        });
        h = step * (error === 0 ? 4 : Math.min(4, Math.max(0.2, 0.9 * Math.pow(error, -0.2))));
      }
      record();
    }
    // Retaining the last accepted state avoids presenting a fabricated completed trajectory.
    record();
    return { times, concentrations, conservationError, steps, status, assumptions };
  }

  const api = Object.freeze({ thermo, rate, simulate });
  root.URPENumerics = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
