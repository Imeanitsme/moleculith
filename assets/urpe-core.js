(function (root) {
  'use strict';
  const ELEMENTS = 'H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og'.split(' ');
  const Z = Object.fromEntries(ELEMENTS.map((e, i) => [e, i + 1]));
  const VALENCE = { H:{0:1,1:0,'-1':0}, C:{0:4,1:3,'-1':3}, N:{0:3,1:4,'-1':2}, O:{0:2,1:3,'-1':1}, F:{0:1,'-1':0}, Cl:{0:1,'-1':0}, Br:{0:1,'-1':0}, I:{0:1,'-1':0} };
  const VE = {H:1,C:4,N:5,O:6,F:7,Cl:7,Br:7,I:7};
  const EN = {H:2.20,C:2.55,N:3.04,O:3.44,F:3.98,Cl:3.16,Br:2.96,I:2.66};
  const HAL = new Set(['F','Cl','Br','I']);
  const clone = g => ({atoms:g.atoms.map(a=>({...a,pos:a.pos?.slice()})),bonds:g.bonds.map(b=>({...b}))});
  const pair = (a,b) => JSON.stringify([a,b].sort());
  const label = a => [a.sym,a.isotope??'',a.charge,a.radical].join(':');
  function normalize(raw) {
    if (!raw || !Array.isArray(raw.atoms) || !Array.isArray(raw.bonds) || !raw.atoms.length || raw.atoms.length>64 || raw.bonds.length>160) throw Error('graph-size');
    const ids=new Set();
    const atoms=raw.atoms.map(a=>{
      if(!a || !['string','number'].includes(typeof a.id) || !Z[a.sym])throw Error('atom-identity');
      const id=String(a.id);
      if(!/^[A-Za-z0-9_:-]+$/.test(id) || id.length>80 || ids.has(id))throw Error('duplicate-atom');ids.add(id);
      const charge=a.charge??0,radical=a.radical??0,isotope=a.isotope??null;
      if(!Number.isInteger(charge)||Math.abs(charge)>8||!Number.isInteger(radical)||radical<0||radical>4)throw Error('electronic-state');
      if(isotope!==null&&(!Number.isInteger(isotope)||isotope<Z[a.sym]||isotope>400))throw Error('isotope');
      if(a.z!==undefined&&a.z!==Z[a.sym])throw Error('element-z-mismatch');
      return {id,sym:a.sym,z:Z[a.sym],charge,radical,isotope,pos:Array.isArray(a.pos)&&a.pos.length===3&&a.pos.every(Number.isFinite)?a.pos.slice():null};
    });
    const seen=new Set();
    const bonds=raw.bonds.map(b=>{
      const a=String(b.a),c=String(b.b),key=pair(a,c);
      if(!ids.has(a)||!ids.has(c)||a===c||seen.has(key))throw Error('bond-connectivity');seen.add(key);
      if(!Number.isInteger(b.order)||b.order<1||b.order>3)throw Error('bond-order');
      return {a,b:c,order:b.order,ionic:b.ionic===true};
    });
    return {atoms,bonds};
  }
  function index(g) {
    const atoms=new Map(g.atoms.map(a=>[a.id,a])),near=new Map(g.atoms.map(a=>[a.id,[]]));
    for(const b of g.bonds){near.get(b.a).push({id:b.b,bond:b});near.get(b.b).push({id:b.a,bond:b});}
    return {atoms,near};
  }
  function validate(raw) {
    let g;try{g=normalize(raw);}catch(e){return {status:'invalid',issues:[e.message]};}
    const {near}=index(g),issues=[],unsupported=[];
    if(g.bonds.some(b=>b.ionic))unsupported.push('ionic-representation');
    for(const a of g.atoms){
      const sum=near.get(a.id).reduce((n,v)=>n+v.bond.order,0),expected=VALENCE[a.sym]?.[a.charge];
      if(expected===undefined){unsupported.push('valence-domain:'+a.sym+':'+a.charge);continue;}
      if(a.radical>1){unsupported.push('multiple-unpaired-electrons');continue;}
      if(sum+a.radical!==expected)issues.push('valence:'+a.id);
      const nonbond=VE[a.sym]-a.charge-sum;
      if(nonbond<a.radical||(nonbond-a.radical)%2!==0||2*sum+nonbond>(a.sym==='H'?2:8))issues.push('electron-count:'+a.id);
    }
    return {status:issues.length?'invalid':unsupported.length?'unsupported':'valid',issues:[...new Set([...issues,...unsupported])],graph:g};
  }
  function components(g) {
    const {near}=index(g),seen=new Set(),out=[];
    for(const at of g.atoms){
      if(seen.has(at.id))continue;
      const stack=[at.id],ids=new Set();seen.add(at.id);
      while(stack.length){const id=stack.pop();ids.add(id);for(const n of near.get(id))if(!seen.has(n.id)){seen.add(n.id);stack.push(n.id);}}
      out.push({atoms:g.atoms.filter(a=>ids.has(a.id)),bonds:g.bonds.filter(b=>ids.has(b.a))});
    }
    return out;
  }
  function composition(g) {
    const out={};for(const a of g.atoms){const k=a.isotope===null?a.sym:a.sym+'['+a.isotope+']';out[k]=(out[k]||0)+1;}return out;
  }
  function charge(g){return g.atoms.reduce((n,a)=>n+a.charge,0);}
  function electrons(g){return g.atoms.reduce((n,a)=>n+a.z-a.charge,0);}
  function conserved(a,b) {
    if(a.atoms.length!==b.atoms.length||charge(a)!==charge(b)||electrons(a)!==electrons(b))return false;
    const old=new Map(a.atoms.map(at=>[at.id,at]));
    return b.atoms.every(at=>{const before=old.get(at.id);return before&&before.sym===at.sym&&before.isotope===at.isotope&&before.z===at.z;});
  }
  function formula(g) {
    const c={};for(const a of g.atoms)c[a.sym]=(c[a.sym]||0)+1;
    let keys=Object.keys(c).sort();if(c.C)keys=['C',...(c.H?['H']:[]),...keys.filter(k=>k!=='C'&&k!=='H')];
    const q=charge(g),rad=g.atoms.reduce((n,a)=>n+a.radical,0);
    return keys.map(k=>k+(c[k]===1?'':c[k])).join('')+(q?'^'+(Math.abs(q)===1?'':Math.abs(q))+(q>0?'+':'-'):'')+(rad?'·'+(rad>1?rad:''):'');
  }
  function signature(g) {
    return g.atoms.map(a=>a.id+'='+label(a)).sort().join('|')+';'+g.bonds.map(b=>pair(b.a,b.b)+':'+b.order+':'+b.ionic).sort().join('|');
  }
  function sameGraph(a,b,budget=30000) {
    if(a.atoms.length!==b.atoms.length||a.bonds.length!==b.bonds.length)return false;
    const ia=index(a),ib=index(b),colors=(g,ix)=>new Map(g.atoms.map(at=>[at.id,label(at)+'/'+ix.near.get(at.id).map(n=>n.bond.order+':'+n.bond.ionic+':'+label(ix.atoms.get(n.id))).sort().join(',')]));
    const ca=colors(a,ia),cb=colors(b,ib),options=new Map();
    for(const at of a.atoms){const opts=b.atoms.filter(bt=>ca.get(at.id)===cb.get(bt.id)).map(bt=>bt.id);if(!opts.length)return false;options.set(at.id,opts);}
    const order=a.atoms.map(at=>at.id).sort((x,y)=>options.get(x).length-options.get(y).length||ia.near.get(y).length-ia.near.get(x).length);
    const mapped=new Map(),used=new Set();let visits=0,exhausted=false;
    const edge=(ix,x,y)=>{const b=ix.near.get(x).find(n=>n.id===y)?.bond;return b?b.order+':'+b.ionic:'';};
    function match(k){
      if(++visits>budget){exhausted=true;return false;}if(k===order.length)return true;
      const x=order[k];for(const y of options.get(x)){
        if(used.has(y))continue;let okay=true;
        for(const [px,py] of mapped)if(edge(ia,x,px)!==edge(ib,y,py)){okay=false;break;}
        if(!okay)continue;mapped.set(x,y);used.add(y);if(match(k+1))return true;mapped.delete(x);used.delete(y);if(exhausted)return false;
      }return false;
    }
    const equal=match(0);return equal?true:exhausted?null:false;
  }
  function analyze(g) {
    const {atoms,near}=index(g),sites=[],oxidation={},cycles=new Set();
    for(const a of g.atoms){
      const ns=near.get(a.id),sum=ns.reduce((n,x)=>n+x.bond.order,0);
      let ox=a.charge,known=EN[a.sym]!==undefined;
      for(const n of ns){const e=EN[atoms.get(n.id).sym];if(e===undefined)known=false;else ox+=Math.sign(e-EN[a.sym])*n.bond.order;}
      oxidation[a.id]=known?ox:null;
      if(a.radical)sites.push({kind:'radical',ids:[a.id]});
      if(a.charge<0)sites.push({kind:'nucleophile',ids:[a.id]});
      if(a.charge>0)sites.push({kind:'cation',ids:[a.id]});
      if(a.sym==='N'&&a.charge===0&&sum===3&&ns.every(n=>n.bond.order===1))sites.push({kind:'amine',ids:[a.id]});
      if(a.sym==='O'&&ns.some(n=>atoms.get(n.id).sym==='H'))sites.push({kind:'hydroxyl',ids:[a.id]});
      if(a.sym==='C')for(const n of ns){const other=atoms.get(n.id);if(n.bond.order===2&&other.sym==='O')sites.push({kind:'carbonyl',ids:[a.id,n.id]});if(n.bond.order===2&&other.sym==='C'&&a.id<n.id)sites.push({kind:'alkene',ids:[a.id,n.id]});if(n.bond.order===1&&HAL.has(other.sym))sites.push({kind:'carbon-halogen',ids:[a.id,n.id]});}
    }
    // Alternating six-carbon rings are protected, not a universal aromaticity assignment.
    for(const at of g.atoms.filter(a=>a.sym==='C')){
      function walk(path,orders){
        const last=path[path.length-1];
        for(const n of near.get(last)){
          if(atoms.get(n.id).sym!=='C')continue;
          if(n.id===at.id&&path.length===6){const os=[...orders,n.bond.order];if(os.every((o,i)=>(o===1||o===2)&&o!==os[(i+1)%6]))cycles.add(path.slice().sort().join('|'));}
          else if(path.length<6&&!path.includes(n.id)&&(n.bond.order===1||n.bond.order===2))walk([...path,n.id],[...orders,n.bond.order]);
        }
      }
      walk([at.id],[]);
    }
    const aromaticAtoms=[...new Set([...cycles].flatMap(c=>c.split('|')))];
    return {sites,oxidation,aromaticAtoms,aromaticity:'alternating-six-carbon-rings-only',rings:g.bonds.length-g.atoms.length+components(g).length,charge:charge(g),electrons:electrons(g),composition:composition(g),geometry:g.atoms.every(a=>a.pos)?'input-coordinates-not-transition-state':'unknown'};
  }
  function editsBetween(before,after) {
    const old=new Map(before.bonds.map(b=>[pair(b.a,b.b),b])),next=new Map(after.bonds.map(b=>[pair(b.a,b.b),b])),out=[];
    for(const [k,b] of old)if(!next.has(k))out.push({kind:'break',a:b.a,b:b.b,from:b.order,to:0});else if(next.get(k).order!==b.order)out.push({kind:'order',a:b.a,b:b.b,from:b.order,to:next.get(k).order});
    for(const [k,b] of next)if(!old.has(k))out.push({kind:'form',a:b.a,b:b.b,from:0,to:b.order});
    after.atoms.forEach(a=>{const old=before.atoms.find(b=>b.id===a.id);if(a.charge!==old.charge||a.radical!==old.radical)out.push({kind:'electrons',atom:a.id,chargeFrom:old.charge,chargeTo:a.charge,radicalFrom:old.radical,radicalTo:a.radical});});return out;
  }
  function* transforms(g,options={}) {
    const {atoms,near}=index(g),aromatic=new Set(analyze(g).aromaticAtoms),max=options.maxEdits??2500;let tried=0;
    const has=(x,y)=>near.get(x).some(n=>n.id===y);
    function change(rule,remove,add,modify=[],orders=[],assumptions=[]) {
      if(++tried>max){if(tried===max+1)options.onLimit?.();return null;}
      const n=clone(g),rm=new Set(remove.map(b=>pair(b.a,b.b)));n.bonds=n.bonds.filter(b=>!rm.has(pair(b.a,b.b)));
      for(const [a,b,order] of add){if(a===b||n.bonds.some(e=>pair(e.a,e.b)===pair(a,b)))return null;n.bonds.push({a,b,order,ionic:false});}
      for(const [a,b,order] of orders){const e=n.bonds.find(e=>pair(e.a,e.b)===pair(a,b));if(!e)return null;e.order=order;}
      for(const [id,q,r] of modify){const a=n.atoms.find(a=>a.id===id);a.charge+=q;a.radical+=r;}
      if(validate(n).status!=='valid'||!conserved(g,n))return null;
      return {graph:n,rule,edits:editsBetween(g,n),assumptions:['graph-hypothesis','barrier-unknown','stereochemistry-unresolved',...assumptions]};
    }
    const emit=function*(x){if(x)yield x;};
    for(const bond of g.bonds){
      if(tried>max)return;
      const a=atoms.get(bond.a),b=atoms.get(bond.b);
      if(bond.order!==1||aromatic.has(a.id)&&aromatic.has(b.id))continue;
      if(options.radicals&&a.radical===0&&b.radical===0)yield*emit(change('homolysis',[bond],[],[[a.id,0,1],[b.id,0,1]],[],['energy-source-and-spin-unresolved']));
      if(options.ions&&a.charge===0&&b.charge===0&&!a.radical&&!b.radical&&Math.abs(EN[a.sym]-EN[b.sym])>=0.35){
        const neg=EN[a.sym]>EN[b.sym]?a:b,pos=neg===a?b:a;
        if(['N','O',...HAL].includes(neg.sym))yield*emit(change('heterolysis',[bond],[],[[neg.id,-1,0],[pos.id,1,0]],[],['solvation-required']));
      }
    }
    if(options.radicals)for(let i=0;i<g.atoms.length;i++)for(let j=i+1;j<g.atoms.length;j++){
      const a=g.atoms[i],b=g.atoms[j];if(a.radical===1&&b.radical===1&&!has(a.id,b.id))yield*emit(change('radical-combination',[],[[a.id,b.id,1]],[[a.id,0,-1],[b.id,0,-1]],[],['spin-and-encounter-unresolved']));
    }
    if(options.ions){
      const acceptors=g.atoms.filter(a=>!a.radical&&((a.charge===-1&&['N','O',...HAL].includes(a.sym))||(a.charge===0&&['N','O'].includes(a.sym))));
      for(const h of g.atoms.filter(a=>a.sym==='H'&&!a.radical)){
        const hn=near.get(h.id),donor=hn.length===1?atoms.get(hn[0].id):null;
        if(h.charge===1&&hn.length===0)for(const ac of acceptors)yield*emit(change('proton-association',[],[[h.id,ac.id,1]],[[h.id,-1,0],[ac.id,1,0]],[],['acid-base-equilibrium-unresolved']));
        if(!donor||!['N','O',...HAL].includes(donor.sym)||hn[0].bond.order!==1)continue;
        for(const ac of acceptors)if(ac.id!==donor.id&&!has(ac.id,h.id))yield*emit(change('proton-transfer',[hn[0].bond],[[h.id,ac.id,1]],[[donor.id,-1,0],[ac.id,1,0]],[],['pKa-and-solvation-unknown']));
      }
      for(const c of g.atoms.filter(a=>a.sym==='C'&&!a.charge&&!a.radical&&!aromatic.has(a.id))){
        const ns=near.get(c.id);if(ns.some(n=>n.bond.order!==1)||ns.filter(n=>atoms.get(n.id).sym==='C').length>2)continue;
        for(const leaving of ns.filter(n=>HAL.has(atoms.get(n.id).sym)&&atoms.get(n.id).charge===0))for(const nu of acceptors.filter(a=>a.charge===-1)){
          if(nu.id===leaving.id||has(nu.id,c.id))continue;
          yield*emit(change('substitution',[leaving.bond],[[c.id,nu.id,1]],[[leaving.id,-1,0],[nu.id,1,0]],[],['SN2-like-topology-not-verified-mechanism','solvent-and-sterics-unresolved']));
        }
      }
      for(const c of g.atoms.filter(a=>a.sym==='C'&&a.charge===1))for(const neighbor of near.get(c.id)){
        if(atoms.get(neighbor.id).sym!=='C'||neighbor.bond.order!==1)continue;
        for(const n of near.get(neighbor.id))if(atoms.get(n.id).sym==='H'&&n.bond.order===1)yield*emit(change('hydride-shift',[n.bond],[[c.id,n.id,1]],[[c.id,-1,0],[neighbor.id,1,0]],[],['carbocation-rearrangement-barrier-unknown']));
      }
      if(options.radicals)for(let i=0;i<g.atoms.length;i++)for(let j=0;j<g.atoms.length;j++){
        const a=g.atoms[i],b=g.atoms[j];if(i===j||a.radical!==1||b.radical!==1||a.charge||b.charge)continue;
        yield*emit(change('electron-transfer',[],[],[[a.id,1,-1],[b.id,-1,-1]],[],['redox-potentials-and-solvation-unknown']));
      }
    }
    for(const pi of g.bonds.filter(b=>b.order===2&&atoms.get(b.a).sym==='C'&&atoms.get(b.b).sym==='C'&&!aromatic.has(b.a)&&!aromatic.has(b.b))){
      for(const xy of g.bonds.filter(b=>b.order===1&&!([b.a,b.b].some(id=>id===pi.a||id===pi.b)))){
        const x=atoms.get(xy.a),y=atoms.get(xy.b);
        if(x.charge||y.charge||x.radical||y.radical)continue;
        const allowed=(x.sym==='H'&&['H','N','O',...HAL].includes(y.sym))||(y.sym==='H'&&['N','O',...HAL].includes(x.sym))||(HAL.has(x.sym)&&HAL.has(y.sym));
        if(!allowed)continue;
        for(const ends of [[pi.a,pi.b],[pi.b,pi.a]])yield*emit(change('addition',[xy],[[ends[0],x.id,1],[ends[1],y.id,1]],[],[[pi.a,pi.b,1]],['regioselectivity-and-catalysis-unresolved']));
      }
    }
    for(const cc of g.bonds.filter(b=>b.order===1&&atoms.get(b.a).sym==='C'&&atoms.get(b.b).sym==='C'&&!aromatic.has(b.a)&&!aromatic.has(b.b))){
      for(const [a,b] of [[cc.a,cc.b],[cc.b,cc.a]]){
        for(const hn of near.get(a).filter(n=>atoms.get(n.id).sym==='H'&&n.bond.order===1))for(const xn of near.get(b).filter(n=>['N','O',...HAL].includes(atoms.get(n.id).sym)&&n.bond.order===1)){
          if(has(hn.id,xn.id))continue;
          yield*emit(change('elimination',[hn.bond,xn.bond],[[hn.id,xn.id,1]],[],[[a,b,2]],['leaving-group-activation-and-conformation-unresolved']));
        }
      }
    }
    for(const co of g.bonds.filter(b=>b.order===2&&[atoms.get(b.a).sym,atoms.get(b.b).sym].sort().join('')==='CO')){
      const c=atoms.get(co.a).sym==='C'?co.a:co.b,o=c===co.a?co.b:co.a;
      for(const cn of near.get(c).filter(n=>atoms.get(n.id).sym==='C'&&n.bond.order===1&&!aromatic.has(n.id)))for(const hn of near.get(cn.id).filter(n=>atoms.get(n.id).sym==='H'&&n.bond.order===1))yield*emit(change('tautomerization',[hn.bond],[[o,hn.id,1]],[],[[c,o,1],[c,cn.id,2]],['net-proton-shift-not-elementary-step','acid-base-catalysis-unresolved']));
    }
  }
  async function predict(raw,options={}) {
    const check=validate(raw);
    if(check.status!=='valid')return {status:check.status,issues:check.issues,states:[],edges:[],species:[],candidates:[]};
    const start=check.graph,maxStates=Math.min(160,Math.max(2,options.maxStates??80)),maxDepth=Math.min(3,Math.max(1,options.depth??2));
    if(!Number.isInteger(maxStates)||!Number.isInteger(maxDepth))throw Error('search-limits');
    const species=[],states=[],edges=[],seen=new Map();let examined=0,truncated=false;
    function register(g){for(const s of species)if(sameGraph(s.graph,g)===true)return s.id;const id='S'+(species.length+1);species.push({id,formula:formula(g),graph:clone(g),analysis:analyze(g)});return id;}
    function bag(g){const b={};for(const c of components(g)){const id=register(c);b[id]=(b[id]||0)+1;}return b;}
    function bagKey(b){return Object.keys(b).sort().map(k=>k+':'+b[k]).join('|');}
    function add(g,depth,parent,via){const id=states.length,b=bag(g),s={id,graph:g,depth,parent,via,species:b};states.push(s);seen.set(signature(g),id);return s;}
    add(start,0,null,null);
    const cancel=()=>options.cancelled?.()===true;
    for(let cursor=0;cursor<states.length;cursor++){
      if(cancel())return finish('cancelled');
      const s=states[cursor];if(s.depth>=maxDepth)continue;
      for(const t of transforms(s.graph,{ions:options.ions!==false,radicals:options.radicals===true,maxEdits:1500,onLimit:()=>{truncated=true;}})){
        if(species.length>500)return finish('bounded');
        examined++;if(examined%20===0){options.onProgress?.({states:states.length,examined});await new Promise(r=>setTimeout(r,0));if(cancel())return finish('cancelled');}
        let target=seen.get(signature(t.graph));
        if(target===s.id||bagKey(bag(t.graph))===bagKey(s.species))continue;
        if(target===undefined){if(states.length>=maxStates){truncated=true;continue;}target=add(t.graph,s.depth+1,s.id,t.rule).id;}
        if(!edges.some(e=>e.from===s.id&&e.to===target&&e.rule===t.rule))edges.push({id:'R'+(edges.length+1),from:s.id,to:target,rule:t.rule,edits:t.edits,assumptions:t.assumptions});
        if(examined>=5000){truncated=true;return finish('bounded');}
      }
    }
    return finish(truncated?'bounded':'complete');
    function finish(status){const used=new Set(states.flatMap(s=>Object.keys(s.species))),unique=new Set([bagKey(states[0].species)]);return {status,issues:[],species:species.filter(s=>used.has(s.id)),states,edges,candidates:states.filter(s=>{const key=bagKey(s.species);if(unique.has(key))return false;unique.add(key);return true;}).map(s=>({state:s.id,depth:s.depth,rule:s.via,products:s.species,confidence:'graph-valid-only',thermodynamics:'unknown',kinetics:'unknown'})),examined,limits:{maxStates,maxDepth},assumptions:['closed-atom-inventory','explicit-hydrogens-required','limited-main-group-valence-model','no-transition-state-optimization','no-stereochemical-selectivity','no-solvent-or-catalyst-model','no-ab-initio-backend','bounded-not-exhaustive']};}
  }
  const api={normalize,validate,components,composition,charge,electrons,conserved,formula,signature,sameGraph,analyze,editsBetween,transforms,predict,elements:Z};
  root.URPECore=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
