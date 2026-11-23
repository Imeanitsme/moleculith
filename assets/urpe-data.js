(function(root){
  'use strict';
  const C=root.URPECore;
  function record(formula,symbols,edges,data){return {formula,graph:symbols?C.normalize({atoms:symbols.split(' ').map((sym,i)=>({id:String(i),sym})),bonds:edges.map(([a,b,order])=>({a:String(a),b:String(b),order}))}):null,data:{referenceTemperature:298.15,pStandard:1,cStandard:1,phase:'g',provenance:'measured',...data}};}
  // Provenance vocabulary comes from URPENumerics.provenance: measured, calculated,
  // empirical. Anything else is treated as unknown and the solver refuses to use the
  // row, so 'measured' is reserved for values a cited table actually reports.
  const JANAF='NIST-JANAF Thermochemical Tables (Chase 1998) via NIST SRD 69';
  const CODATA='CODATA Key Values for Thermodynamics (Cox, Wagman, Medvedev 1989)';
  const WB='NIST Chemistry WebBook SRD 69 (constant-pressure heat capacity at 298.15 K)';
  // cp is supplied only where the measured value is known; a species without cp
  // simply stays unusable away from 298.15 K (the solver reports that honestly).
  root.URPEReferenceData=[
    record('H2','H H',[[0,1,1]],{hf:0,s:130.68,cp:28.84,source:'NIST SRD 69 / Chase 1998; H2 formation enthalpy zero by elemental standard-state convention',url:'https://webbook.nist.gov/cgi/cbook.cgi?ID=C1333740&Mask=1'}),
    record('H2O','O H H',[[0,1,1],[0,2,1]],{hf:-241.826,s:188.835,cp:33.59,source:'NIST SRD 69 / Cox, Wagman et al. 1984; gas, not liquid water',url:'https://webbook.nist.gov/cgi/cbook.cgi?ID=C7732185&Mask=1'}),
    record('C2H4','C C H H H H',[[0,1,2],[0,2,1],[0,3,1],[1,4,1],[1,5,1]],{hf:52.47,s:219.32,source:'NIST SRD 69 / Chase 1998; ethene gas',url:'https://webbook.nist.gov/cgi/cbook.cgi?ID=C74851&Mask=1'}),
    record('C2H6','C C H H H H H H',[[0,1,1],[0,2,1],[0,3,1],[0,4,1],[1,5,1],[1,6,1],[1,7,1]],{hf:-84,s:229.2,source:'NIST SRD 69 / Chase 1998; ethane gas',url:'https://webbook.nist.gov/cgi/cbook.cgi?ID=C74840&Mask=1'}),
    record('O2',null,null,{hf:0,s:205.152,cp:29.38,source:JANAF+'; O2 gas',url:'https://webbook.nist.gov/cgi/cbook.cgi?ID=C7782447&Mask=1'}),
    record('N2',null,null,{hf:0,s:191.61,cp:29.12,source:JANAF+'; N2 gas',url:'https://webbook.nist.gov/cgi/cbook.cgi?ID=C7727379&Mask=1'}),
    record('Cl2',null,null,{hf:0,s:223.08,cp:33.95,source:JANAF+'; Cl2 gas',url:'https://webbook.nist.gov/cgi/cbook.cgi?ID=C7782505&Mask=1'}),
    record('CO2',null,null,{hf:-393.52,s:213.79,cp:37.13,source:JANAF+'; CO2 gas',url:'https://webbook.nist.gov/cgi/cbook.cgi?ID=C124389&Mask=1'}),
    record('CO',null,null,{hf:-110.53,s:197.66,cp:29.15,source:JANAF+'; CO gas',url:'https://webbook.nist.gov/cgi/cbook.cgi?ID=C630080&Mask=1'}),
    record('CH4',null,null,{hf:-74.87,s:186.25,cp:35.69,source:JANAF+'; methane gas',url:'https://webbook.nist.gov/cgi/cbook.cgi?ID=C74828&Mask=1'}),
    record('NH3',null,null,{hf:-45.90,s:192.77,cp:35.12,source:JANAF+'; ammonia gas',url:'https://webbook.nist.gov/cgi/cbook.cgi?ID=C7664417&Mask=1'}),
    record('HCl',null,null,{hf:-92.31,s:186.90,cp:29.13,source:JANAF+'; hydrogen chloride gas',url:'https://webbook.nist.gov/cgi/cbook.cgi?ID=C7647010&Mask=1'}),
    record('SO2',null,null,{hf:-296.84,s:248.22,cp:39.89,source:JANAF+'; sulfur dioxide gas',url:'https://webbook.nist.gov/cgi/cbook.cgi?ID=C7446095&Mask=1'}),
    record('O3',null,null,{hf:142.67,s:238.93,source:JANAF+'; ozone gas',url:'https://webbook.nist.gov/cgi/cbook.cgi?ID=C10028156&Mask=1'}),
    record('C',null,null,{phase:'s',hf:0,s:5.74,cp:8.53,source:JANAF+'; graphite reference state',url:'https://webbook.nist.gov/cgi/cbook.cgi?ID=C7440440&Mask=2'}),
    // — gases added so the common in-game equations predict with measured data —
    record('NO',null,null,{hf:90.25,s:210.76,cp:29.34,source:JANAF+'; nitric oxide gas',url:'https://webbook.nist.gov/cgi/cbook.cgi?ID=C10102439&Mask=1'}),
    record('NO2',null,null,{hf:33.18,s:240.06,source:JANAF+'; nitrogen dioxide gas',url:'https://webbook.nist.gov/cgi/cbook.cgi?ID=C10102440&Mask=1'}),
    record('N2O',null,null,{hf:82.05,s:219.85,cp:36.43,source:JANAF+'; nitrous oxide gas',url:'https://webbook.nist.gov/cgi/cbook.cgi?ID=C10024755&Mask=1'}),
    record('N2O4',null,null,{hf:9.16,s:304.38,source:JANAF+'; dinitrogen tetroxide gas',url:'https://webbook.nist.gov/cgi/cbook.cgi?ID=C10544726&Mask=1'}),
    record('H2S',null,null,{hf:-20.63,s:205.79,cp:34.2,source:JANAF+'; hydrogen sulfide gas',url:'https://webbook.nist.gov/cgi/cbook.cgi?ID=C7783064&Mask=1'}),
    record('HF',null,null,{hf:-273.3,s:173.78,cp:29.13,source:CODATA+'; hydrogen fluoride gas',url:'https://webbook.nist.gov/cgi/cbook.cgi?ID=C7664393&Mask=1'}),
    record('HBr',null,null,{hf:-36.3,s:198.70,cp:29.15,source:CODATA+'; hydrogen bromide gas',url:'https://webbook.nist.gov/cgi/cbook.cgi?ID=C10035102&Mask=1'}),
    record('HI',null,null,{hf:26.5,s:206.50,cp:29.20,source:CODATA+'; hydrogen iodide gas',url:'https://webbook.nist.gov/cgi/cbook.cgi?ID=C10034852&Mask=1'}),
    record('H2O2',null,null,{hf:-136.3,s:232.70,source:JANAF+'; hydrogen peroxide gas',url:'https://webbook.nist.gov/cgi/cbook.cgi?ID=C7722841&Mask=1'}),
    record('SO3',null,null,{hf:-395.72,s:256.76,cp:56.20,source:JANAF+'; sulfur trioxide gas',url:'https://webbook.nist.gov/cgi/cbook.cgi?ID=C7446119&Mask=1'}),
    record('CH3OH',null,null,{hf:-201.0,s:239.81,source:'NIST SRD 69 / Chase 1998; methanol gas',url:'https://webbook.nist.gov/cgi/cbook.cgi?ID=C67561&Mask=1'}),
    record('C2H6O',null,null,{hf:-234.8,s:282.70,source:'NIST SRD 69 / Chase 1998; ethanol gas',url:'https://webbook.nist.gov/cgi/cbook.cgi?ID=C64175&Mask=1'}),
    record('C3H8',null,null,{hf:-104.7,s:269.90,source:'NIST SRD 69 / Chase 1998; propane gas',url:'https://webbook.nist.gov/cgi/cbook.cgi?ID=C74986&Mask=1'}),
    record('C6H6',null,null,{hf:82.93,s:269.31,source:'NIST SRD 69 / Chase 1998; benzene gas',url:'https://webbook.nist.gov/cgi/cbook.cgi?ID=C71432&Mask=1'}),
    // — condensed phases; the game spawns these as discrete clusters/solids —
    record('NaCl',null,null,{phase:'s',hf:-411.12,s:72.11,cp:50.50,source:CODATA+'; halite solid',url:'https://webbook.nist.gov/cgi/cbook.cgi?ID=C7647145&Mask=2'}),
    record('NaOH',null,null,{phase:'s',hf:-425.61,s:64.46,source:CODATA+'; sodium hydroxide solid'}),
    record('Na2CO3',null,null,{phase:'s',hf:-1130.68,s:135.0,source:CODATA+'; sodium carbonate solid'}),
    record('NaHCO3',null,null,{phase:'s',hf:-947.66,s:102.09,source:CODATA+'; sodium hydrogen carbonate solid'}),
    record('NaC2H3O2',null,null,{phase:'s',hf:-709.32,s:138.10,cp:100.83,source:'NBS Tables of Chemical Thermodynamic Properties (Wagman et al. 1982); S° and Cp: NIST WebBook, Franzosini et al. 1983; anhydrous sodium acetate solid',url:'https://webbook.nist.gov/cgi/cbook.cgi?ID=C127093&Units=SI&Mask=2'}),
    record('CaO',null,null,{phase:'s',hf:-635.09,s:39.75,cp:42.05,source:CODATA+'; calcium oxide solid'}),
    record('Ca(OH)2',null,null,{phase:'s',hf:-986.09,s:83.39,source:CODATA+'; calcium hydroxide solid (portlandite)'}),
    record('CaCO3',null,null,{phase:'s',hf:-1207.13,s:92.90,cp:81.3,source:CODATA+'; calcite'}),
    record('MgO',null,null,{phase:'s',hf:-601.60,s:26.94,cp:37.15,source:CODATA+'; periclase'}),
    record('Al2O3',null,null,{phase:'s',hf:-1675.7,s:50.92,cp:79.0,source:CODATA+'; corundum (α-Al2O3)'}),
    record('SiO2',null,null,{phase:'s',hf:-910.94,s:41.50,cp:44.1,source:CODATA+'; α-quartz'}),
    record('ZnO',null,null,{phase:'s',hf:-348.0,s:43.70,cp:40.2,source:'NIST SRD 69 / Cox, Wagman et al. 1984; zincite'}),
    record('ZnCl2',null,null,{phase:'s',hf:-415.08,s:111.5,source:CODATA+'; zinc chloride solid'}),
    record('Fe2O3',null,null,{phase:'s',hf:-824.2,s:87.40,cp:103.9,source:CODATA+'; hematite'}),
    record('Fe3O4',null,null,{phase:'s',hf:-1118.4,s:146.4,source:CODATA+'; magnetite'}),
    record('CuO',null,null,{phase:'s',hf:-157.3,s:42.60,cp:44.0,source:CODATA+'; tenorite'}),
    record('KCl',null,null,{phase:'s',hf:-436.5,s:82.60,cp:51.8,source:CODATA+'; sylvite'}),
    record('AgCl',null,null,{phase:'s',hf:-127.01,s:96.25,cp:50.5,source:CODATA+'; chlorargyrite'}),
    record('C6H12O6',null,null,{phase:'s',hf:-1273.3,s:212.1,source:'NIST SRD 69; α-D-glucose solid'})
  ];
  // --- Coverage added for the reaction panel ---------------------------------
  // The double-click panel prices whatever equation the matching engine produces,
  // so the table has to cover the species that engine can actually name. Every row
  // below is a standard-state value at 298.15 K, 1 bar; elements in their reference
  // state carry hf = 0 by convention, which is a definition rather than a
  // measurement. Where only some of a species' numbers are known, the rest are
  // left out rather than filled in: ΔH° then reports and ΔG° says what is missing.
  // De-duplicate against the table above by formula key only; urpe-game.js builds
  // its own canonical-atom map from whatever ends up here.
  const seenFormulas = new Set(root.URPEReferenceData.map(r => r.formula));
  const add = rows => { for (const r of rows) { if (!seenFormulas.has(r.formula)) { seenFormulas.add(r.formula); root.URPEReferenceData.push(r); } } };
  const el = (f, phase, s, cp, note) => record(f, null, null, { phase, hf: 0, s, cp, source: CODATA + '; ' + note + ' (element in its reference state, formation enthalpy zero by convention)' });
  add([
    // — elements the game spawns as reductants —
    el('Li', 's', 29.10, 24.8, 'lithium metal'),
    el('Na', 's', 51.21, 28.24, 'sodium metal'),
    el('K', 's', 64.67, 29.30, 'potassium metal'),
    el('Mg', 's', 32.68, 24.87, 'magnesium metal'),
    el('Al', 's', 28.33, 24.20, 'aluminium metal'),
    el('Ca', 's', 41.40, 25.99, 'calcium metal'),
    el('Ti', 's', 30.72, 25.06, 'titanium metal'),
    el('Cr', 's', 23.77, 23.25, 'chromium metal'),
    el('Mn', 's', 32.01, 26.32, 'manganese metal'),
    el('Fe', 's', 27.28, 25.10, 'alpha-iron metal'),
    el('Ni', 's', 29.79, 26.07, 'nickel metal'),
    el('Cu', 's', 33.15, 24.44, 'copper metal'),
    el('Zn', 's', 41.63, 25.20, 'zinc metal'),
    el('Ba', 's', 62.50, 28.10, 'barium metal'),
    el('Pb', 's', 64.80, 26.40, 'lead metal'),
    el('Ag', 's', 42.55, 25.35, 'silver metal'),
    el('Pt', 's', 41.46, 25.86, 'platinum metal'),
    el('Au', 's', 25.42, 25.42, 'gold metal'),
    el('Hg', 'l', 75.90, 27.98, 'mercury liquid'),
    el('S', 's', 31.80, 22.75, 'rhombic sulfur'),
    el('P', 's', 41.09, 23.30, 'white phosphorus'),
    el('Br2', 'l', 152.23, 75.69, 'bromine liquid'),
    el('I2', 's', 116.14, 54.44, 'iodine solid'),
    el('F2', 'g', 202.78, 31.30, 'fluorine gas'),
    // — oxides, hydroxides —
    record('TiO2', null, null, { phase: 's', hf: -944.7, s: 50.33, cp: 55.6, source: CODATA + '; rutile' }),
    record('FeO', null, null, { phase: 's', hf: -272.0, s: 60.75, cp: 44.9, source: 'NIST SRD 69 / Wustite (FeO, wustite non-stoichiometry ignored)' }),
    record('MnO', null, null, { phase: 's', hf: -385.2, s: 59.7, source: JANAF + '; manganese(II) oxide' }),
    record('NiO', null, null, { phase: 's', hf: -239.7, s: 37.95, source: CODATA + '; nickel(II) oxide' }),
    record('Cu2O', null, null, { phase: 's', hf: -168.6, s: 93.14, cp: 74.0, source: CODATA + '; cuprite' }),
    record('MnO2', null, null, { phase: 's', hf: -520.0, s: 53.07, source: CODATA + '; pyrolusite' }),
    record('PbO', null, null, { phase: 's', hf: -217.3, s: 66.5, source: CODATA + '; massicot' }),
    record('SnO2', null, null, { phase: 's', hf: -580.7, s: 52.3, source: CODATA + '; cassiterite' }),
    record('Cr2O3', null, null, { phase: 's', hf: -1139.7, s: 81.2, source: CODATA + '; eskolaite' }),
    record('UO2', null, null, { phase: 's', hf: -1084.9, s: 75.31, source: JANAF + '; uranium dioxide' }),
    record('Mg(OH)2', null, null, { phase: 's', hf: -924.54, s: 63.18, cp: 79.5, source: CODATA + '; brucite' }),
    record('KOH', null, null, { phase: 's', hf: -424.76, s: 78.9, source: CODATA + '; potassium hydroxide solid' }),
    record('Fe(OH)3', null, null, { phase: 's', hf: -823.0, s: 106.7, source: 'NIST SRD 69; iron(III) hydroxide' }),
    record('Al(OH)3', null, null, { phase: 's', hf: -1276.0, source: CODATA + '; gibbsite (third-law entropy not tabulated here)' }),
    // — salts —
    record('LiCl', null, null, { phase: 's', hf: -408.27, s: 59.25, cp: 47.9, source: CODATA + '; lithium chloride' }),
    record('MgCl2', null, null, { phase: 's', hf: -641.32, s: 89.69, cp: 71.1, source: CODATA + '; magnesium chloride' }),
    record('CaCl2', null, null, { phase: 's', hf: -795.80, s: 104.62, cp: 76.1, source: CODATA + '; calcium chloride' }),
    record('FeCl2', null, null, { phase: 's', hf: -341.8, s: 118.0, source: CODATA + '; iron(II) chloride' }),
    record('FeCl3', null, null, { phase: 's', hf: -399.5, s: 142.3, source: CODATA + '; iron(III) chloride' }),
    record('AlCl3', null, null, { phase: 's', hf: -704.2, s: 109.3, source: CODATA + '; aluminium chloride' }),
    record('CuCl2', null, null, { phase: 's', hf: -220.1, s: 107.7, source: 'NIST SRD 69; copper(II) chloride' }),
    record('MgCO3', null, null, { phase: 's', hf: -1095.8, s: 65.7, cp: 75.8, source: CODATA + '; magnesite' }),
    record('BaCO3', null, null, { phase: 's', hf: -1216.3, s: 112.1, source: CODATA + '; witherite' }),
    record('K2CO3', null, null, { phase: 's', hf: -1150.5, s: 155.5, source: CODATA + '; potassium carbonate' }),
    record('CaSO4', null, null, { phase: 's', hf: -1434.11, s: 106.7, source: CODATA + '; anhydrite' }),
    record('BaSO4', null, null, { phase: 's', hf: -1473.2, s: 132.2, source: CODATA + '; barite' }),
    record('Na2SO4', null, null, { phase: 's', hf: -1387.06, s: 149.5, source: CODATA + '; sodium sulfate' }),
    record('K2SO4', null, null, { phase: 's', hf: -1433.68, s: 175.2, source: CODATA + '; potassium sulfate' }),
    record('MgSO4', null, null, { phase: 's', hf: -1284.9, s: 93.7, source: 'NIST SRD 69; magnesium sulfate' }),
    record('ZnSO4', null, null, { phase: 's', hf: -982.8, s: 110.3, source: 'NIST SRD 69; zinc sulfate' }),
    record('CuSO4', null, null, { phase: 's', hf: -771.4, s: 109.0, source: 'NIST SRD 69; copper(II) sulfate' }),
    record('NaNO3', null, null, { phase: 's', hf: -467.9, s: 116.3, source: CODATA + '; sodium nitrate' }),
    record('KNO3', null, null, { phase: 's', hf: -466.7, s: 133.1, source: CODATA + '; nitre' }),
    record('AgNO3', null, null, { phase: 's', hf: -124.39, s: 140.9, source: CODATA + '; silver nitrate' }),
    record('NH4Cl', null, null, { phase: 's', hf: -314.43, s: 94.85, source: CODATA + '; ammonium chloride' }),
    record('NH4NO3', null, null, { phase: 's', hf: -365.56, s: 151.1, source: 'NIST SRD 69; ammonium nitrate' }),
    record('(NH4)2SO4', null, null, { phase: 's', hf: -1180.84, s: 202.1, source: CODATA + '; ammonium sulfate' }),
    // — sulfides —
    record('FeS', null, null, { phase: 's', hf: -100.4, s: 60.3, source: CODATA + '; troilite' }),
    record('ZnS', null, null, { phase: 's', hf: -206.0, s: 57.7, source: CODATA + '; sphalerite' }),
    record('PbS', null, null, { phase: 's', hf: -98.3, s: 91.3, source: CODATA + '; galena' }),
    record('Cu2S', null, null, { phase: 's', hf: -79.5, s: 120.9, source: CODATA + '; chalcocite' }),
    // — acids and peroxides —
    record('H2SO4', null, null, { phase: 'l', hf: -813.99, s: 156.90, cp: 138.9, source: CODATA + '; pure sulfuric acid liquid' }),
    record('HNO3', null, null, { phase: 'l', hf: -174.10, source: CODATA + '; pure nitric acid liquid (third-law entropy not tabulated here)' }),
    record('H3PO4', null, null, { phase: 's', hf: -1277.0, source: CODATA + '; pure phosphoric acid solid (third-law entropy not tabulated here)' }),
    record('MnCl2', null, null, { phase: 's', hf: -480.8, s: 133.6, source: CODATA + '; manganese(II) chloride' }),
    record('Cu(NO3)2', null, null, { phase: 's', hf: -302.9, s: 285.0, source: CODATA + '; copper(II) nitrate' }),
    // Aqueous ions. The panel can price ΔH°, ΔS° and ΔG° from these but not ΔG,
    // because the scene does not track a solution volume to convert amount into
    // mol/L; the solver reports the missing activity rather than assuming one.
    record('NH4+', null, null, { phase: 'aq', hf: -132.51, s: 113.4, source: CODATA + '; ammonium ion, aqueous standard state 1 mol/L' }),
    record('Cl-', null, null, { phase: 'aq', hf: -167.16, s: 56.5, source: CODATA + '; chloride ion, aqueous standard state 1 mol/L' }),
    record('H+', null, null, { phase: 'aq', hf: 0, s: 0, source: CODATA + '; hydrogen ion; ΔfH° and S° are zero by thermodynamic convention, not measured' })
  ]);
  // — remaining gases the organic reaction patterns name —
  add([
    record('C2H2', null, null, { hf: 226.73, s: 200.93, cp: 44.0, source: 'NIST SRD 69 / Chase 1998; ethyne gas' }),
    record('C4H10', null, null, { hf: -125.6, s: 310.0, cp: 97.5, source: 'NIST SRD 69 / Chase 1998; butane gas' }),
    record('C3H6', null, null, { hf: 20.4, s: 266.6, cp: 63.9, source: 'NIST SRD 69; propene gas' }),
    record('CH3COOH', null, null, { hf: -432.8, s: 282.8, source: 'NIST SRD 69; ethanoic (acetic) acid gas' }),
    record('C4H8O2', null, null, { hf: -445.43, s: 362.75, cp: 113.64, source: 'NIST WebBook SRD 69; ethyl acetate gas — ΔfH° −445.43±0.84 kJ·mol−1 (Wiberg, Crocker et al. 1991, ALS), S° and Cp°(298.15 K) (Stull 1969, GT)', url: 'https://webbook.nist.gov/cgi/cbook.cgi?ID=C141786&Mask=1' }),
    record('HCN', null, null, { hf: 135.1, s: 199.5, source: 'NIST SRD 69 / Chase 1998; hydrogen cyanide gas' })
    ]);
  // --- Cp°(T) polynomials merged from the NIST Chemistry WebBook (SRD 69) ------
  // Shomate coefficients Cp° = A + B·t + C·t² + D·t³ + E/t² (t = T/1000 K), one
  // interval per published phase, boundary enthalpies from the H° functions those
  // same coefficients define. Every entry below passed Temp/merge-nist.cjs: the
  // shipped ∫Cp dT and ∫Cp/T dT were matched against NIST's own H° and S° relations
  // (which carry the F and G constants Cp does not), piece junctions were checked
  // for continuity, and each row's tabulated S° and Cp at 298.15 K were compared
  // with the value the coefficients produce. Regenerate with Temp/merge-nist.cjs.
  const NIST_MODELS = [
  { formula: "H2", cpPoly: [{"from":298,"to":1000,"A":33.066178,"B":-11.363417,"C":11.432816,"D":-2.772874,"E":-0.158558},{"from":1000,"to":2500,"A":18.563083,"B":12.257357,"C":-2.859786,"D":0.268238,"E":1.97799},{"from":2500,"to":6000,"A":43.41356,"B":-4.293079,"C":1.272428,"D":-0.096876,"E":-20.533862}], source: "NIST WebBook SRD 69 Shomate coefficients, https://webbook.nist.gov/cgi/cbook.cgi?ID=C1333740&Mask=1" },
  { formula: "O2", cpPoly: [{"from":100,"to":700,"A":31.32234,"B":-20.23531,"C":57.86644,"D":-36.50624,"E":-0.007374},{"from":700,"to":2000,"A":30.03235,"B":8.772972,"C":-3.988133,"D":0.788313,"E":-0.741599},{"from":2000,"to":6000,"A":20.91111,"B":10.72071,"C":-2.020498,"D":0.146449,"E":9.245722}], source: "NIST WebBook SRD 69 Shomate coefficients, https://webbook.nist.gov/cgi/cbook.cgi?ID=C7782447&Mask=1" },
  { formula: "N2", cpPoly: [{"from":100,"to":500,"A":28.98641,"B":1.853978,"C":-9.647459,"D":16.63537,"E":0.000117},{"from":500,"to":2000,"A":19.50583,"B":19.88705,"C":-8.598535,"D":1.369784,"E":0.527601},{"from":2000,"to":6000,"A":35.51872,"B":1.128728,"C":-0.196103,"D":0.014662,"E":-4.55376}], source: "NIST WebBook SRD 69 Shomate coefficients, https://webbook.nist.gov/cgi/cbook.cgi?ID=C7727379&Mask=1" },
  { formula: "Cl2", cpPoly: [{"from":298,"to":1000,"A":33.0506,"B":12.2294,"C":-12.0651,"D":4.38533,"E":-0.159494},{"from":1000,"to":3000,"A":42.6773,"B":-5.00957,"C":1.904621,"D":-0.165641,"E":-2.09848},{"from":3000,"to":6000,"A":-42.5535,"B":41.6857,"C":-7.12683,"D":0.387839,"E":101.144}], source: "NIST WebBook SRD 69 Shomate coefficients, https://webbook.nist.gov/cgi/cbook.cgi?ID=C7782505&Mask=1" },
  { formula: "F2", cpPoly: [{"from":298,"to":6000,"A":31.4451,"B":8.413831,"C":-2.77885,"D":0.218104,"E":-0.211175}], source: "NIST WebBook SRD 69 Shomate coefficients, https://webbook.nist.gov/cgi/cbook.cgi?ID=C7782414&Mask=1" },
  { formula: "CO2", cpPoly: [{"from":298,"to":1200,"A":24.99735,"B":55.18696,"C":-33.69137,"D":7.948387,"E":-0.136638},{"from":1200,"to":6000,"A":58.16639,"B":2.720074,"C":-0.492289,"D":0.038844,"E":-6.447293}], source: "NIST WebBook SRD 69 Shomate coefficients, https://webbook.nist.gov/cgi/cbook.cgi?ID=C124389&Mask=1" },
  { formula: "CO", cpPoly: [{"from":298,"to":1300,"A":25.56759,"B":6.09613,"C":4.054656,"D":-2.671301,"E":0.131021},{"from":1300,"to":6000,"A":35.1507,"B":1.300095,"C":-0.205921,"D":0.01355,"E":-3.28278}], source: "NIST WebBook SRD 69 Shomate coefficients, https://webbook.nist.gov/cgi/cbook.cgi?ID=C630080&Mask=1" },
  { formula: "SO2", cpPoly: [{"from":298,"to":1200,"A":21.43049,"B":74.35094,"C":-57.75217,"D":16.35534,"E":0.086731},{"from":1200,"to":6000,"A":57.48188,"B":1.009328,"C":-0.07629,"D":0.005174,"E":-4.045401}], source: "NIST WebBook SRD 69 Shomate coefficients, https://webbook.nist.gov/cgi/cbook.cgi?ID=C7446095&Mask=1" },
  { formula: "SO3", cpPoly: [{"from":298,"to":1200,"A":24.02503,"B":119.4607,"C":-94.38686,"D":26.96237,"E":-0.117517},{"from":1200,"to":6000,"A":81.99008,"B":0.622236,"C":-0.12244,"D":0.008294,"E":-6.703688}], source: "NIST WebBook SRD 69 Shomate coefficients, https://webbook.nist.gov/cgi/cbook.cgi?ID=C7446119&Mask=1" },
  { formula: "H2S", cpPoly: [{"from":298,"to":1400,"A":26.88412,"B":18.67809,"C":3.434203,"D":-3.378702,"E":0.135882},{"from":1400,"to":6000,"A":51.22136,"B":4.147486,"C":-0.643566,"D":0.041621,"E":-10.46385}], source: "NIST WebBook SRD 69 Shomate coefficients, https://webbook.nist.gov/cgi/cbook.cgi?ID=C7783064&Mask=1" },
  { formula: "NO", cpPoly: [{"from":298,"to":1200,"A":23.83491,"B":12.58878,"C":-1.139011,"D":-1.497459,"E":0.214194},{"from":1200,"to":6000,"A":35.99169,"B":0.95717,"C":-0.148032,"D":0.009974,"E":-3.004088}], source: "NIST WebBook SRD 69 Shomate coefficients, https://webbook.nist.gov/cgi/cbook.cgi?ID=C10102439&Mask=1" },
  { formula: "NO2", cpPoly: [{"from":298,"to":1200,"A":16.10857,"B":75.89525,"C":-54.3874,"D":14.30777,"E":0.239423},{"from":1200,"to":6000,"A":56.82541,"B":0.738053,"C":-0.144721,"D":0.009777,"E":-5.459911}], source: "NIST WebBook SRD 69 Shomate coefficients, https://webbook.nist.gov/cgi/cbook.cgi?ID=C10102440&Mask=1" },
  { formula: "N2O", cpPoly: [{"from":298,"to":1400,"A":27.67988,"B":51.14898,"C":-30.64454,"D":6.847911,"E":-0.157906},{"from":1400,"to":6000,"A":60.30274,"B":1.034566,"C":-0.192997,"D":0.01254,"E":-6.860254}], source: "NIST WebBook SRD 69 Shomate coefficients, https://webbook.nist.gov/cgi/cbook.cgi?ID=C10024972&Mask=1" },
  { formula: "N2O4", cpPoly: [{"from":500,"to":1000,"A":34.05274,"B":191.9845,"C":-151.0575,"D":44.3935,"E":-0.158949},{"from":1000,"to":6000,"A":128.622,"B":2.524345,"C":-0.520883,"D":0.03663,"E":-11.55704}], source: "NIST WebBook SRD 69 Shomate coefficients, https://webbook.nist.gov/cgi/cbook.cgi?ID=C10544726&Mask=1" },
  { formula: "O3", cpPoly: [{"from":298,"to":1200,"A":21.66157,"B":79.86001,"C":-66.02603,"D":19.58363,"E":-0.079251},{"from":1200,"to":6000,"A":57.81409,"B":0.730941,"C":-0.039253,"D":0.00261,"E":-3.560367}], source: "NIST WebBook SRD 69 Shomate coefficients, https://webbook.nist.gov/cgi/cbook.cgi?ID=C10028156&Mask=1" },
  { formula: "NH3", cpPoly: [{"from":298,"to":1400,"A":19.99563,"B":49.77119,"C":-15.37599,"D":1.921168,"E":0.189174},{"from":1400,"to":6000,"A":52.02427,"B":18.48801,"C":-3.765128,"D":0.248541,"E":-12.45799}], source: "NIST WebBook SRD 69 Shomate coefficients, https://webbook.nist.gov/cgi/cbook.cgi?ID=C7664417&Mask=1" },
  { formula: "HCl", cpPoly: [{"from":298,"to":1200,"A":32.12392,"B":-13.45805,"C":19.86852,"D":-6.853936,"E":-0.049672},{"from":1200,"to":6000,"A":31.91923,"B":3.203184,"C":-0.541539,"D":0.035925,"E":-3.438525}], source: "NIST WebBook SRD 69 Shomate coefficients, https://webbook.nist.gov/cgi/cbook.cgi?ID=C7647010&Mask=1" },
  { formula: "HF", cpPoly: [{"from":298,"to":1000,"A":30.11693,"B":-3.246612,"C":2.868116,"D":0.457914,"E":-0.024861},{"from":1000,"to":6000,"A":24.57033,"B":6.893391,"C":-1.243874,"D":0.082583,"E":-0.23406}], source: "NIST WebBook SRD 69 Shomate coefficients, https://webbook.nist.gov/cgi/cbook.cgi?ID=C7664393&Mask=1" },
  { formula: "HBr", cpPoly: [{"from":298,"to":1100,"A":31.71409,"B":-13.69992,"C":23.35567,"D":-9.008529,"E":-0.028758},{"from":1100,"to":6000,"A":32.88913,"B":2.822116,"C":-0.478035,"D":0.032464,"E":-3.174958}], source: "NIST WebBook SRD 69 Shomate coefficients, https://webbook.nist.gov/cgi/cbook.cgi?ID=C10035106&Mask=1" },
  { formula: "HI", cpPoly: [{"from":298,"to":1400,"A":26.0454,"B":4.689678,"C":4.911765,"D":-2.654397,"E":0.121419},{"from":1400,"to":6000,"A":35.44358,"B":1.414708,"C":-0.182088,"D":0.011768,"E":-4.054561}], source: "NIST WebBook SRD 69 Shomate coefficients, https://webbook.nist.gov/cgi/cbook.cgi?ID=C10034852&Mask=1" },
  { formula: "H2O", cpPoly: [{"from":500,"to":1700,"A":30.092,"B":6.832514,"C":6.793435,"D":-2.53448,"E":0.082139},{"from":1700,"to":6000,"A":41.96426,"B":8.622053,"C":-1.49978,"D":0.098119,"E":-11.15764}], source: "NIST WebBook SRD 69 Shomate coefficients, https://webbook.nist.gov/cgi/cbook.cgi?ID=C7732185&Mask=1" },
  { formula: "CH4", cpPoly: [{"from":298,"to":1300,"A":-0.703029,"B":108.4773,"C":-42.52157,"D":5.862788,"E":0.678565},{"from":1300,"to":6000,"A":85.81217,"B":11.26467,"C":-2.114146,"D":0.13819,"E":-26.42221}], source: "NIST WebBook SRD 69 Shomate coefficients, https://webbook.nist.gov/cgi/cbook.cgi?ID=C74828&Mask=1" },
  { formula: "C2H2", cpPoly: [{"from":298,"to":1100,"A":40.68697,"B":40.73279,"C":-16.1784,"D":3.669741,"E":-0.658411},{"from":1100,"to":6000,"A":67.47244,"B":11.7511,"C":-2.02147,"D":0.136195,"E":-9.806418}], source: "NIST WebBook SRD 69 Shomate coefficients, https://webbook.nist.gov/cgi/cbook.cgi?ID=C74862&Mask=1" },
  { formula: "C2H4", cpPoly: [{"from":298,"to":1200,"A":-6.38788,"B":184.4019,"C":-112.9718,"D":28.49593,"E":0.31554},{"from":1200,"to":6000,"A":106.5104,"B":13.7326,"C":-2.628481,"D":0.174595,"E":-26.14469}], source: "NIST WebBook SRD 69 Shomate coefficients, https://webbook.nist.gov/cgi/cbook.cgi?ID=C74851&Mask=1" },
  { formula: "HCN", cpPoly: [{"from":298,"to":1200,"A":32.69373,"B":22.59205,"C":-4.369142,"D":-0.407697,"E":-0.282399},{"from":1200,"to":6000,"A":52.36527,"B":5.563298,"C":-0.953224,"D":0.056711,"E":-7.564086}], source: "NIST WebBook SRD 69 Shomate coefficients, https://webbook.nist.gov/cgi/cbook.cgi?ID=C74908&Mask=1" },
  { formula: "H2O2", cpPoly: [{"from":298,"to":1500,"A":34.25667,"B":55.18445,"C":-35.15443,"D":9.08744,"E":-0.422157}], source: "NIST WebBook SRD 69 Shomate coefficients, https://webbook.nist.gov/cgi/cbook.cgi?ID=C7722841&Mask=1" },
  { formula: "NaCl", cpIntervals: [{"phase":"s","cpPoly":[{"from":298,"to":1073,"A":50.72389,"B":6.672267,"C":-2.517167,"D":10.15934,"E":-0.200675}],"to":1074},{"phase":"l","cpPoly":[{"from":1074,"to":2500,"A":-42.4478,"B":113.526,"C":-43.6466,"D":5.89663,"E":39.1386}],"dH":28.18}], source: "NIST WebBook SRD 69 Shomate coefficients, https://webbook.nist.gov/cgi/cbook.cgi?ID=C7647145&Units=SI&Mask=2" },
  { formula: "KCl", cpIntervals: [{"phase":"s","cpPoly":[{"from":298,"to":900,"A":35.41597,"B":70.03472,"C":-91.38233,"D":52.52426,"E":0.15346},{"from":900,"to":1044,"A":-717.3845,"B":1247.861,"C":-708.5144,"D":141.4435,"E":103.6712}],"to":1044},{"phase":"l","cpPoly":[{"from":1044,"to":2000,"A":73.59698,"B":0,"C":0,"D":0,"E":0}],"dH":26.279}], source: "NIST WebBook SRD 69 Shomate coefficients, https://webbook.nist.gov/cgi/cbook.cgi?ID=C7447407&Units=SI&Mask=2" },
  { formula: "LiCl", cpIntervals: [{"phase":"s","cpPoly":[{"from":298,"to":883,"A":43.74372,"B":20.37056,"C":0.30643,"D":-0.094178,"E":-0.160419}],"to":883},{"phase":"l","cpPoly":[{"from":883,"to":2000,"A":73.18025,"B":-9.047232,"C":-0.31639,"D":0.079587,"E":0.013594}],"dH":19.83}], source: "NIST WebBook SRD 69 Shomate coefficients, https://webbook.nist.gov/cgi/cbook.cgi?ID=C7447418&Units=SI&Mask=2" },
  { formula: "MgCl2", cpIntervals: [{"phase":"s","cpPoly":[{"from":298,"to":987,"A":78.30733,"B":2.435888,"C":6.858873,"D":-1.728967,"E":-0.729911}],"to":987},{"phase":"l","cpPoly":[{"from":987,"to":2500,"A":92.048,"B":-0.000005,"C":4.7689e-7,"D":1.13569e-7,"E":-0.000005}],"dH":43.087}], source: "NIST WebBook SRD 69 Shomate coefficients, https://webbook.nist.gov/cgi/cbook.cgi?ID=C7786303&Units=SI&Mask=2" },
  { formula: "CaCl2", cpIntervals: [{"phase":"s","cpPoly":[{"from":298,"to":1045,"A":87.29581,"B":-35.07644,"C":44.12781,"D":-9.848049,"E":-0.674264}],"to":1045},{"phase":"l","cpPoly":[{"from":1045,"to":3000,"A":102.5331,"B":2.006254e-8,"C":-9.234423e-9,"D":1.407022e-9,"E":2.609206e-9}],"dH":28.48}], source: "NIST WebBook SRD 69 Shomate coefficients, https://webbook.nist.gov/cgi/cbook.cgi?ID=C10043524&Units=SI&Mask=2" },
  { formula: "FeCl2", cpIntervals: [{"phase":"s","cpPoly":[{"from":298,"to":950,"A":73.66852,"B":22.54009,"C":-10.12172,"D":1.4662,"E":-0.252648}],"to":950},{"phase":"l","cpPoly":[{"from":950,"to":2000,"A":102.1733,"B":-1.078819e-8,"C":8.424401e-9,"D":-2.096737e-9,"E":-1.846362e-10}],"dH":43.001}], source: "NIST WebBook SRD 69 Shomate coefficients, https://webbook.nist.gov/cgi/cbook.cgi?ID=C7758943&Units=SI&Mask=2" },
  { formula: "FeCl3", cpIntervals: [{"phase":"s","cpPoly":[{"from":298,"to":577,"A":979.1104,"B":-4704.364,"C":9295.174,"D":-6246.963,"E":-12.49577}],"to":577},{"phase":"l","cpPoly":[{"from":577,"to":1500,"A":133.888,"B":0,"C":0,"D":0,"E":0}],"dH":42.908}], source: "NIST WebBook SRD 69 Shomate coefficients, https://webbook.nist.gov/cgi/cbook.cgi?ID=C7705080&Units=SI&Mask=2" },
  { formula: "AlCl3", cpIntervals: [{"phase":"s","cpPoly":[{"from":298,"to":465.7,"A":64.94614,"B":87.84057,"C":0.018217,"D":-0.004649,"E":-0.000627}],"to":465.7},{"phase":"l","cpPoly":[{"from":465.7,"to":1500,"A":125.52,"B":1.953532e-9,"C":-1.890968e-9,"D":5.936301e-10,"E":2.225549e-11}],"dH":35.355}], source: "NIST WebBook SRD 69 Shomate coefficients, https://webbook.nist.gov/cgi/cbook.cgi?ID=C7446700&Units=SI&Mask=2" },
  { formula: "CuCl2", cpPoly: [{"from":298,"to":1500,"A":70.21882,"B":23.36132,"C":-14.86876,"D":4.053899,"E":-0.366203}], source: "NIST WebBook SRD 69 Shomate coefficients, https://webbook.nist.gov/cgi/cbook.cgi?ID=C7447394&Units=SI&Mask=2" },
  { formula: "Na2CO3", cpIntervals: [{"phase":"s","cpPoly":[{"from":298,"to":723,"A":175.201,"B":-348.058,"C":743.072,"D":-305.551,"E":-1.634221}],"to":723},{"phase":"s","cpPoly":[{"from":723,"to":1123,"A":-1067,"B":2469.34,"C":-1829.06,"D":505.748,"E":100.182}],"dH":0.678,"to":1123.15},{"phase":"l","cpPoly":[{"from":1123.15,"to":2500,"A":189.535,"B":-0.000007,"C":0.000002,"D":-5.2051e-9,"E":-0.000003}],"dH":29.659}], source: "NIST WebBook SRD 69 Shomate coefficients, https://webbook.nist.gov/cgi/cbook.cgi?ID=C497198&Units=SI&Mask=2" },
  { formula: "K2CO3", cpIntervals: [{"phase":"s","cpPoly":[{"from":298,"to":1174,"A":97.08093,"B":94.22326,"C":-2.053291,"D":0.709644,"E":-0.94786}],"to":1174},{"phase":"l","cpPoly":[{"from":1174,"to":2500,"A":209.2,"B":-1.629015e-7,"C":8.00985e-8,"D":-1.336428e-8,"E":-2.105289e-8}],"dH":27.609}], source: "NIST WebBook SRD 69 Shomate coefficients, https://webbook.nist.gov/cgi/cbook.cgi?ID=C584087&Units=SI&Mask=2" },
  { formula: "MgCO3", cpPoly: [{"from":298,"to":1000,"A":44.937,"B":149.7085,"C":-74.18274,"D":11.9767,"E":-0.629261}], source: "NIST WebBook SRD 69 Shomate coefficients, https://webbook.nist.gov/cgi/cbook.cgi?ID=C546930&Units=SI&Mask=2" },
  { formula: "MgSO4", cpIntervals: [{"phase":"s","cpPoly":[{"from":298,"to":1400,"A":75.83207,"B":111.722,"C":-39.68842,"D":5.129835,"E":-0.83257}],"to":1400},{"phase":"l","cpPoly":[{"from":1400,"to":2500,"A":158.992,"B":0,"C":0,"D":0,"E":0}],"dH":14.647}], source: "NIST WebBook SRD 69 Shomate coefficients, https://webbook.nist.gov/cgi/cbook.cgi?ID=C7487889&Units=SI&Mask=2" },
  { formula: "ZnSO4", cpIntervals: [{"phase":"s","cpPoly":[{"from":298,"to":540,"A":114.458,"B":-139.564,"C":566.615,"D":-402.519,"E":-1.20111}],"to":540},{"phase":"s","cpPoly":[{"from":540,"to":1013,"A":181.987,"B":-122.877,"C":129.838,"D":-44.0513,"E":-2.89525}],"dH":5.031,"to":1013},{"phase":"s","cpPoly":[{"from":1013,"to":2000,"A":145.185,"B":-0.000112,"C":0.000058,"D":-0.00001,"E":-0.000017}],"dH":20.335}], source: "NIST WebBook SRD 69 Shomate coefficients, https://webbook.nist.gov/cgi/cbook.cgi?ID=C7733020&Units=SI&Mask=2" },
  { formula: "CuSO4", cpPoly: [{"from":298,"to":2000,"A":87.578,"B":129.458,"C":-78.2311,"D":17.2315,"E":-1.879841}], source: "NIST WebBook SRD 69 Shomate coefficients, https://webbook.nist.gov/cgi/cbook.cgi?ID=C7758987&Units=SI&Mask=2" },
  { formula: "NH4Cl", cpIntervals: [{"phase":"s","cpPoly":[{"from":298,"to":458,"A":2101.47,"B":-11194.4,"C":23342.3,"D":-16996.7,"E":-26.8353}],"to":458},{"phase":"s","cpPoly":[{"from":458,"to":1500,"A":-64.4364,"B":327.227,"C":-149.346,"D":24.3964,"E":6.43283}],"dH":3.866}], source: "NIST WebBook SRD 69 Shomate coefficients, https://webbook.nist.gov/cgi/cbook.cgi?ID=C12125029&Units=SI&Mask=2" },
  { formula: "H3PO4", cpIntervals: [{"phase":"s","cpPoly":[{"from":298,"to":315.5,"A":15.48331,"B":303.7442,"C":-0.96819,"D":0.386907,"E":0.007645}],"to":315.5},{"phase":"l","cpPoly":[{"from":315.5,"to":1000,"A":55.20955,"B":301.3204,"C":-0.095194,"D":0.04231,"E":0.000512}],"dH":13.385}], source: "NIST WebBook SRD 69 Shomate coefficients, https://webbook.nist.gov/cgi/cbook.cgi?ID=C7664382&Units=SI&Mask=2" }
  ];
  for (const m of NIST_MODELS) {
    const row = root.URPEReferenceData.find(r => r.formula === m.formula);
    if (!row || !row.data) continue;
    row.data.source = row.data.source + '; ' + m.source;
    if (m.cpPoly) row.data.cpPoly = m.cpPoly;
    if (m.cpIntervals) row.data.cpIntervals = m.cpIntervals;
  }
})(globalThis);
