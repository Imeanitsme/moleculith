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
    record('HCN', null, null, { hf: 135.1, s: 199.5, source: 'NIST SRD 69 / Chase 1998; hydrogen cyanide gas' })
  ]);
})(globalThis);
