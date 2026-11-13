(function(root){
  'use strict';
  const C=root.URPECore;
  function record(formula,symbols,edges,data){return {formula,graph:symbols?C.normalize({atoms:symbols.split(' ').map((sym,i)=>({id:String(i),sym})),bonds:edges.map(([a,b,order])=>({a:String(a),b:String(b),order}))}):null,data:{referenceTemperature:298.15,pStandard:1,cStandard:1,phase:'g',provenance:'measured',...data}};}
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
})(globalThis);
