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
      'dH and dG are kJ/mol of reaction; dS is J/mol/K; T is K.',
      'Activities and K are dimensionless; no activity coefficients or phase changes are inferred.',
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
      return { term, name, origin, trusted };
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
      if (!absent(standard)) assumptions.push(key + ' = ' + standard + (key === 'pStandard' ? ' bar.' : ' mol/L.'));
    }

    const enthalpies = [];
    const entropies = [];
    const references = new Set(prepared.map(({term}) => term.referenceTemperature).filter(value => !absent(value)));
    // Formation enthalpies at unlike reference temperatures use unlike elemental baselines.
    const commonReference = references.size <= 1;
    if (!commonReference) note('Incompatible formation-enthalpy reference temperatures: elemental reference corrections required');
    let hKnown = standardsKnown && commonReference;
    let sKnown = standardsKnown;
    let hasCpCorrection = false;
    let defaultPureActivity = false;
    let qKnown = true;
    let zeroReactant = false;
    let zeroProduct = false;
    const logarithms = [];
    for (const { term, name, trusted } of prepared) {
      const refKnown = !absent(term.referenceTemperature);
      const correctionNeeded = refKnown && T !== term.referenceTemperature;
      const correctionKnown = !correctionNeeded || !absent(term.cp);
      if (!correctionKnown) note(name + '.cp required away from its reference temperature');
      const usable = trusted && refKnown && correctionKnown;
      let h = term.hf;
      let s = term.s;
      if (usable && correctionNeeded) {
        hasCpCorrection = true;
        if (!absent(h)) h += (term.cp / 1000) * (T - term.referenceTemperature);
        // Subtracting logarithms avoids overflowing the temperature ratio.
        if (!absent(s)) s += term.cp * (Math.log(T) - Math.log(term.referenceTemperature));
      }
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
    if (hasCpCorrection) assumptions.push('Constant species Cp approximation: H(T)=H(ref)+Cp(T-ref), S(T)=S(ref)+Cp ln(T/ref); supplied Cp validity and absence of phase transitions are caller responsibilities.');
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
    return { dH, dS, dG0, dG, lnK, K, lnQ, provenance: origin, assumptions, missing };
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
    const assumptions = ['Concentration basis is mol/L; no catalyst effects are inferred.'];
    const result = {
      k: null, logK: null, units: '(mol/L)^(' + (1 - order) + ') s^-1',
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
      result.barrier = { model, quantity: 'Ea', value: trusted && Ea !== null ? Ea / 1000 : null, units: 'kJ/mol' };
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
      if (absent(parameters.cStandard)) assumptions.push('cStandard defaults to 1 mol/L.');
      assumptions.push('Eyring transition-state approximation with cStandard^(1-order); activation dH and dS are treated as temperature independent.');
      result.barrier = {
        model, quantity: 'dG‡', units: 'kJ/mol',
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
    const atol = absent(options.atol) ? 1e-10 : number(options.atol, 'atol (mol/L)', 0, true);
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
      'Closed, homogeneous, constant-volume batch; concentrations in mol/L and time in s.',
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
