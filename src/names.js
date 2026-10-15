import { isMetal, elementBySym } from './elements.js';
import { formulaOf } from './chemistry.js';
import { isVi, elName } from './i18n.js';

// formula (Hill, no charge) + charge -> trivial name
const COMMON = {
  'H2O': 'Water', 'CO2': 'Carbon dioxide', 'CO': 'Carbon monoxide',
  'CH4': 'Methane', 'NH3': 'Ammonia', 'H2O2': 'Hydrogen peroxide',
  'SO2': 'Sulfur dioxide', 'SO3': 'Sulfur trioxide',
  'NO': 'Nitrogen monoxide', 'NO2': 'Nitrogen dioxide', 'N2O': 'Dinitrogen monoxide (laughing gas)',
  'N2O3': 'Dinitrogen trioxide', 'N2O4': 'Dinitrogen tetroxide', 'N2O5': 'Dinitrogen pentoxide',
  'SF6': 'Sulfur hexafluoride', 'PH3': 'Phosphine', 'SiO2': 'Silicon dioxide',
  'C2H6': 'Ethane', 'C2H4': 'Ethene', 'C2H2': 'Ethyne', 'C3H8': 'Propane',
  'C3H6': 'Propene', 'C3H4': 'Propyne', 'C4H10': 'Butane', 'C5H12': 'Pentane',
  'C6H6': 'Benzene', 'C6H12': 'Cyclohexane', 'C6H14': 'Hexane',
  'C2H6O': 'Ethanol (or dimethyl ether)', 'CH4O': 'Methanol',
  'CH2O': 'Methanal (formaldehyde)', 'CHCl3': 'Trichloromethane (chloroform)',
  'CCl4': 'Tetrachloromethane (carbon tetrachloride)', 'CS2': 'Carbon disulfide',
  'BF3': 'Boron trifluoride', 'BCl3': 'Boron trichloride', 'BH3': 'Borane',
  'NH4Cl': 'Ammonium chloride', 'SiH4': 'Silane', 'GeH4': 'Germane', 'AsH3': 'Arsine',
  'H2S': 'Hydrogen sulfide', 'HF': 'Hydrogen fluoride', 'HBr': 'Hydrogen bromide',
  'HI': 'Hydrogen iodide', 'HCl': 'Hydrogen chloride', 'H2': 'Hydrogen',
  'N2': 'Nitrogen', 'O2': 'Dioxygen', 'O3': 'Ozone', 'F2': 'Difluorine',
  'Cl2': 'Dichlorine', 'Br2': 'Dibromine', 'I2': 'Diiodine',
  'P4': 'Tetraphosphorus', 'S8': 'Cyclo-octasulfur',
  'PCl3': 'Phosphorus trichloride', 'PCl5': 'Phosphorus pentachloride',
  'XeF2': 'Xenon difluoride', 'XeF4': 'Xenon tetrafluoride', 'XeF6': 'Xenon hexafluoride',
  'XeO3': 'Xenon trioxide', 'XeO4': 'Xenon tetroxide', 'KrF2': 'Krypton difluoride',
  'N2H4': 'Hydrazine', 'H2O2': 'Hydrogen peroxide', 'NO2': 'Nitrogen dioxide',
};

// polyatomic ions: Hill formula + charge -> name
const POLYATOMIC = {
  'OH-1': 'Hydroxide', 'NH4+1': 'Ammonium', 'H3O+1': 'Hydronium',
  'NO3-1': 'Nitrate', 'NO2-1': 'Nitrite', 'CO3-2': 'Carbonate', 'HCO3-1': 'Hydrogen carbonate',
  'SO4-2': 'Sulfate', 'SO3-2': 'Sulfite', 'HSO4-1': 'Hydrogen sulfate',
  'PO4-3': 'Phosphate', 'PO3-3': 'Phosphite',
  'ClO-1': 'Hypochlorite', 'ClO2-1': 'Chlorite', 'ClO3-1': 'Chlorate', 'ClO4-1': 'Perchlorate',
  'BrO3-1': 'Bromate', 'IO3-1': 'Iodate', 'MnO4-1': 'Permanganate',
  'CrO4-2': 'Chromate', 'Cr2O7-2': 'Dichromate', 'CN-1': 'Cyanide',
  'O2-2': 'Peroxide', 'C2O4-2': 'Oxalate', 'CNS-1': 'Thiocyanate',
};

// Irregular acid stems: "sulfate" -> "sulfuric acid", "cyanide" -> "hydrocyanic acid".
const ACID_EN = {
  'sulfate': 'sulfuric', 'sulfite': 'sulfurous',
  'phosphate': 'phosphoric', 'phosphite': 'phosphorous',
  'cyanide': 'hydrocyanic',
};

const PREFIX = ['mono', 'di', 'tri', 'tetra', 'penta', 'hexa', 'hepta', 'octa', 'nona', 'deca'];
const ANION_ROOT = {
  O: 'oxide', F: 'fluoride', Cl: 'chloride', Br: 'bromide', I: 'iodide', At: 'astatide',
  S: 'sulfide', Se: 'selenide', Te: 'telluride', N: 'nitride', P: 'phosphide',
  As: 'arsenide', Sb: 'antimonide', C: 'carbide', Si: 'silicide', B: 'boride',
  Ge: 'germanide', H: 'hydride', Po: 'polonide', Ts: 'tennesside', Lv: 'livermoride',
};
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

// Vietnamese mirrors (used when the app language is VI). Nomenclature follows
// the common textbook style; rare species may differ slightly in spelling.
const COMMON_VI = {
  'H2O': 'Nước', 'CO2': 'Cacbon dioxit', 'CO': 'Cacbon monooxit',
  'CH4': 'Metan', 'NH3': 'Amoniac', 'H2O2': 'Hiđro peroxit',
  'SO2': 'Lưu huỳnh dioxit', 'SO3': 'Lưu huỳnh trioxit',
  'NO': 'Nitơ monooxit', 'NO2': 'Nitơ dioxit', 'N2O': 'Đinitơ monooxit (khí cười)',
  'N2O3': 'Đinitơ trioxit', 'N2O4': 'Đinitơ tetraoxit', 'N2O5': 'Đinitơ pentaoxit',
  'SF6': 'Lưu huỳnh hexaflorua', 'PH3': 'Photphin', 'SiO2': 'Silic dioxit',
  'C2H6': 'Etan', 'C2H4': 'Eten', 'C2H2': 'Etin', 'C3H8': 'Propan',
  'C3H6': 'Propen', 'C3H4': 'Propin', 'C4H10': 'Butan', 'C5H12': 'Pentan',
  'C6H6': 'Benzên', 'C6H12': 'Cyclohexan', 'C6H14': 'Hexan',
  'C2H6O': 'Etanol (hoặc dimetyl ete)', 'CH4O': 'Metanol',
  'CH2O': 'Methanal (fomanđehit)', 'CHCl3': 'Triclorometan (cloroform)',
  'CCl4': 'Tetraclorometan (cacbon tetraclorua)', 'CS2': 'Cacbon disunfua',
  'BF3': 'Bo triflorua', 'BCl3': 'Bo triclorua', 'BH3': 'Boran',
  'NH4Cl': 'Amoni clorua', 'SiH4': 'Silan', 'GeH4': 'German', 'AsH3': 'Arsin',
  'H2S': 'Hiđro sunfua', 'HF': 'Hiđro florua', 'HBr': 'Hiđro bromua',
  'HI': 'Hiđro iodua', 'HCl': 'Hiđro clorua', 'H2': 'Hiđro',
  'N2': 'Nitơ', 'O2': 'Đioxi', 'O3': 'Ozôn', 'F2': 'Điflo',
  'Cl2': 'Điclo', 'Br2': 'Đibrom', 'I2': 'Điiod',
  'P4': 'Tetraphotpho', 'S8': 'Cyclo-octasunfua',
  'PCl3': 'Photpho triclorua', 'PCl5': 'Photpho pentaclorua',
  'XeF2': 'Xenon diflorua', 'XeF4': 'Xenon tetraflorua', 'XeF6': 'Xenon hexaflorua',
  'XeO3': 'Xenon trioxit', 'XeO4': 'Xenon tetraoxit', 'KrF2': 'Krypton diflorua',
  'N2H4': 'Hiđrazin',
};

const POLYATOMIC_VI = {
  'OH-1': 'Hidroxit', 'NH4+1': 'Amoni', 'H3O+1': 'Hidroni',
  'NO3-1': 'Nitrat', 'NO2-1': 'Nitrit', 'CO3-2': 'Cacbonat', 'HCO3-1': 'Hiđrocacbonat',
  'SO4-2': 'Sunfat', 'SO3-2': 'Sunfit', 'HSO4-1': 'Hiđrosunfat',
  'PO4-3': 'Photphat', 'PO3-3': 'Photphit',
  'ClO-1': 'Hypoclorit', 'ClO2-1': 'Clorit', 'ClO3-1': 'Clorat', 'ClO4-1': 'Perclorat',
  'BrO3-1': 'Bromat', 'IO3-1': 'Iodat', 'MnO4-1': 'Permanaganat',
  'CrO4-2': 'Cromat', 'Cr2O7-2': 'Đicromat', 'CN-1': 'Xianua',
  'O2-2': 'Peroxit', 'C2O4-2': 'Oxalat', 'CNS-1': 'Thiocyanat',
};

const ANION_ROOT_VI = {
  O: 'oxit', F: 'florua', Cl: 'clorua', Br: 'bromua', I: 'iodua', At: 'astatua',
  S: 'sunfua', Se: 'selenua', Te: 'telurua', N: 'nitrua', P: 'photphua',
  As: 'asenua', Sb: 'antimonua', C: 'cacbua', Si: 'silicua', B: 'borua',
  Ge: 'germanua', H: 'hiđrua', Po: 'polonua', Ts: 'tennessua', Lv: 'livermorua',
};

const PREFIX_VI = ['mono', 'đi', 'tri', 'tetra', 'penta', 'hexa', 'hepta', 'octa', 'nona', 'deca'];
const BASE_EN = ['meth', 'eth', 'prop', 'but', 'pent', 'hex', 'hept', 'oct', 'non', 'dec'];
const BASE_VI = ['met', 'et', 'prop', 'but', 'pent', 'hex', 'hept', 'oct', 'non', 'dec'];
const LOWER_EL_VI = {
  C: 'cacbon', H: 'hiđro', N: 'nitơ', O: 'oxi', S: 'lưu huỳnh', P: 'photpho',
  F: 'flo', Cl: 'clo', Br: 'brôm', I: 'iot', Se: 'selen', Si: 'silic',
  B: 'bo', As: 'asen', Te: 'tellur',
};
// Irregular acid stems: "sunfat" -> "axit sunfuric", "xianua" -> "axit xianhidric".
const ACID_VI = {
  'sunfat': 'sunfuric', 'sunfit': 'sunfurơ',
  'nitrat': 'nitric', 'nitrit': 'nitrơ',
  'photphat': 'photphoric', 'photphit': 'photphơ',
  'hypoclorit': 'hypoclorơ', 'clorit': 'clorơ',
  'hiđrosunfat': 'sunfuric', 'xianua': 'xianhidric',
};

function prefix(n) { return (isVi() ? PREFIX_VI : PREFIX)[n - 1] || `${n}`; }

function acidVi(ion) {
  const k = ion.toLowerCase();
  if (ACID_VI[k]) return 'axit ' + ACID_VI[k];
  if (k.endsWith('at')) return 'axit ' + k.replace(/at$/, 'ic');
  if (k.endsWith('it')) return 'axit ' + k.replace(/it$/, 'ơ');
  if (k.endsWith('ua')) return 'axit ' + k.replace(/ua$/, 'hidric');
  return 'axit ' + k;
}

function lowerElVi(sym) { return LOWER_EL_VI[sym] || sym.toLowerCase(); }

// Name a covalent cluster (no ionic bonds). atoms: [{el}], charge: int, bonds: [{a,b,order}]
export function nameCovalent(atoms, charge, bonds) {
  const vi = isVi();
  const common = vi ? COMMON_VI : COMMON;
  const poly = vi ? POLYATOMIC_VI : POLYATOMIC;
  const formula = hillOf(atoms);
  if (charge === 0 && common[formula]) return common[formula];

  const ionKey = `${formula}${charge > 0 ? '+' + charge : charge}`;
  if (poly[ionKey]) return poly[ionKey];

  const syms = new Set(atoms.map(a => a.el.sym));

  // Hydrocarbon naming
  if (syms.size === 2 && syms.has('C') && syms.has('H')) {
    const n = atoms.filter(a => a.el.sym === 'C').length;
    const h = atoms.filter(a => a.el.sym === 'H').length;
    if (n >= 1 && n <= 10) {
      const base = (vi ? BASE_VI : BASE_EN)[n - 1];
      if (h === 2 * n + 2) return cap(base + (vi ? 'an' : 'ane'));
      if (h === 2 * n) {
        if (bonds.some(b => b.order === 3)) return cap(base + (vi ? 'in' : 'yne'));
        return cap(base + (vi ? 'en' : 'ene'));
      }
      if (h === 2 * n - 2) return cap(bonds.some(b => b.order === 3) ? base + (vi ? 'in' : 'yne') : base + (vi ? 'ađien' : 'diene'));
    }
  }

  // Acid: neutral HnX where X is a polyatomic ion with charge -n
  if (charge === 0) {
    const hCount = atoms.filter(a => a.el.sym === 'H').length;
    if (hCount > 0) {
      const rest = atoms.filter(a => a.el.sym !== 'H');
      const restFormula = hillOf(rest);
      const restKey = `${restFormula}-${hCount}`;
      if (poly[restKey] && rest.length > 1) {
        if (vi) return cap(acidVi(poly[restKey]));
        const ionName = poly[restKey].toLowerCase();
        if (ACID_EN[ionName]) return cap(ACID_EN[ionName] + ' acid');
        if (ionName.endsWith('ate')) return cap(ionName.replace(/ate$/, 'ic') + ' acid');
        if (ionName.endsWith('ite')) return cap(ionName.replace(/ite$/, 'ous') + ' acid');
        if (ionName.endsWith('ide')) return cap('hydro' + ionName.replace(/ide$/, 'ic') + ' acid');
      }
    }
  }

  // Binary covalent: prefixes + -ide/-ua (second element = higher electronegativity)
  if (atoms.every(a => !isMetal(a.el)) && new Set(atoms.map(a => a.el.sym)).size === 2) {
    const count = new Map();
    for (const a of atoms) count.set(a.el.sym, (count.get(a.el.sym) || 0) + 1);
    const [first, second] = [...count.keys()].sort((x, y) => enOf(atoms, x) - enOf(atoms, y));
    const parts = [];
    parts.push((count.get(first) === 1 && first !== 'C' ? '' : prefix(count.get(first))) + (vi ? lowerElVi(first) : lowerEl(first)));
    const root = vi ? (ANION_ROOT_VI[second] || second.toLowerCase() + 'ua') : (ANION_ROOT[second] || second.toLowerCase() + 'ide');
    parts.push(prefix(count.get(second)) + root);
    return cap(parts.join(' '));
  }
  return null;
}

// Name a full molecule that may contain ionic bonds.
// atoms: [{id, el}], bonds: [{a, b, order, ionic}], per: atomId -> {fc} from lewisAssign.
export function nameMolecule(atoms, bonds, formula, charge, per = null) {
  const hasIonic = bonds.some(b => b.ionic);
  if (!hasIonic) {
    const covName = nameCovalent(atoms, charge, bonds);
    return covName;
  }

  // Split into ionic fragments: remove ionic bonds, then connected components
  const covBonds = bonds.filter(b => !b.ionic);
  const adj = new Map(atoms.map(a => [a.id, []]));
  for (const b of covBonds) {
    adj.get(b.a).push({ other: b.b, order: b.order });
    adj.get(b.b).push({ other: b.a, order: b.order });
  }

  const frags = [];
  const seen = new Set();
  for (const at of atoms) {
    if (seen.has(at.id)) continue;
    const frag = [];
    const stack = [at.id];
    seen.add(at.id);
    while (stack.length) {
      const cur = stack.pop();
      frag.push(cur);
      for (const { other } of adj.get(cur)) {
        if (!seen.has(other)) { seen.add(other); stack.push(other); }
      }
    }
    frags.push(frag);
  }

  const cations = [], anions = [];
  for (const frag of frags) {
    const fragAtoms = frag.map(id => atoms.find(a => a.id === id));
    const fragBonds = covBonds.filter(b => frag.includes(b.a) && frag.includes(b.b));
    let ch = 0;
    for (const fa of fragAtoms) {
      if (per) { ch += per.get(fa.id)?.fc ?? 0; continue; }
      const ionU = bonds.filter(b => b.ionic && (b.a === fa.id || b.b === fa.id)).reduce((s, b) => s + b.order, 0);
      if (isMetal(fa.el)) ch += ionU;
      else {
        const covSum = fragBonds.filter(b => b.a === fa.id || b.b === fa.id).reduce((s, b) => s + b.order, 0);
        const rem = fa.el.valenceElectrons + ionU - covSum;
        const lp = Math.max(0, Math.floor(rem / 2));
        ch += fa.el.valenceElectrons - 2 * lp - covSum;
      }
    }
    const entry = { atoms: fragAtoms, bonds: fragBonds, charge: ch };
    (ch > 0 ? cations : anions).push(entry);
  }

  const nameParts = [];
  const cationCounts = new Map();
  for (const c of cations) {
    if (c.atoms.length === 1 && isMetal(c.atoms[0].el)) {
      const el = c.atoms[0].el;
      const q = c.charge;
      const roman = el.charges && el.charges.length > 1 ? `(${ROMAN[q] || q})` : '';
      const key = 'cat:' + el.sym + roman;
      cationCounts.set(key, (cationCounts.get(key) || 0) + 1);
      nameParts.push({ key, name: elName(el) + roman });
    } else {
      const nm = nameCovalent(c.atoms, c.charge, c.bonds);
      const key = 'cat:' + (nm || hillOf(c.atoms) + c.charge);
      cationCounts.set(key, (cationCounts.get(key) || 0) + 1);
      nameParts.push({ key, name: nm ? nm.toLowerCase() : `ion ${hillOf(c.atoms)}` });
    }
  }
  const anionCounts = new Map();
  for (const an of anions) {
    let nm;
    if (an.atoms.length === 1) {
      const el = an.atoms[0].el;
      nm = isVi() ? (ANION_ROOT_VI[el.sym] || el.name.toLowerCase() + 'ua') : (ANION_ROOT[el.sym] || el.name.toLowerCase() + 'ide');
    } else {
      nm = nameCovalent(an.atoms, an.charge, an.bonds);
      nm = nm ? nm.toLowerCase() : `ion ${hillOf(an.atoms)}`;
    }
    const key = 'an:' + nm;
    anionCounts.set(key, (anionCounts.get(key) || 0) + 1);
  }

  // Compose without multiplicity prefixes — ionic stoichiometry is implied by charge
  const cationPart = [...cationCounts.entries()]
    .map(([key]) => nameParts.find(p => p.key === key).name)
    .join(' ');
  const anionPart = [...anionCounts.entries()]
    .map(([key]) => key.slice(3))
    .join(' ');

  const name = cap(`${cationPart} ${anionPart}`.trim());
  if (charge !== 0) return `${name} (${isVi() ? 'điện tích' : 'net charge'} ${charge > 0 ? '+' : ''}${charge})`;
  return name;
}

function enOf(atoms, sym) {
  const a = atoms.find(at => at.el.sym === sym);
  return a.el.en ?? 0;
}
function lowerEl(sym) {
  const map = { C: 'carbon', H: 'hydrogen', N: 'nitrogen', O: 'oxygen', S: 'sulfur', P: 'phosphorus', F: 'fluorine', Cl: 'chlorine', Br: 'bromine', I: 'iodine', Se: 'selenium', Si: 'silicon', B: 'boron', As: 'arsenic', Te: 'tellurium', H2: 'hydrogen' };
  return map[sym] || sym.toLowerCase();
}
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function hillOf(atoms) { return formulaOf(atoms.map(a => a.el)); }

function parseFormula(f) {
  const counts = new Map();
  const re = /([A-Z][a-z]?)(\d*)/g;
  let m;
  while ((m = re.exec(f)) !== null) {
    if (!m[1]) continue;
    const n = m[2] ? parseInt(m[2]) : 1;
    counts.set(m[1], (counts.get(m[1]) || 0) + n);
  }
  return counts;
}

export function classifyMolecule(formula, charge, comp) {
  const counts = parseFormula(formula);
  const syms = [...counts.keys()];
  const hasMetal = syms.some(s => {
    const el = elementBySym(s);
    return el && isMetal(el);
  });
  const hasH = counts.has('H');
  const hasO = counts.has('O');
  const hasC = counts.has('C');
  const hasN = counts.has('N');

  if (syms.length === 1) return { key: 'element', label: isVi() ? 'Nguyên tố' : 'Element' };

  if (formula === 'H2O') return { key: 'oxide', label: isVi() ? 'Oxit' : 'Oxide' };

  if (hasC && counts.get('H') > 0 && syms.filter(s => s !== 'C' && s !== 'H').length === 0) {
    const c = counts.get('C') || 1;
    const h = counts.get('H') || 0;
    if (h === 2 * c + 2) return { key: 'alkane', label: isVi() ? 'Ankan' : 'Alkane' };
    if (h === 2 * c) return { key: 'alkene', label: isVi() ? 'Anken' : 'Alkene' };
    if (h === 2 * c - 2) return { key: 'alkyne', label: isVi() ? 'Ankin' : 'Alkyne' };
    return { key: 'organic', label: isVi() ? 'Hữu cơ' : 'Organic' };
  }

  // Inorganic carbon exceptions — contain C but are NOT organic.
  // Checked before the general organic branch to prevent misclassification.
  if (hasC && !hasMetal) {
    if (formula === 'CO' || formula === 'CO2' || formula === 'C3O2') {
      // carbon oxides → fall through to oxide classification
    } else if (formula === 'CS2') {
      // carbon disulfide → fall through to binary classification
    } else if (formula === 'HCN' || formula === 'CHN') {
      return { key: 'acid', label: isVi() ? 'Axit' : 'Acid' };
    } else if (!hasH && !hasO && !hasS && hasN && syms.length === 2) {
      return { key: 'binary', label: isVi() ? 'Hợp chất nhị nguyên' : 'Binary compound' };
    } else if (!hasH && hasN && hasO && !hasS && syms.length === 3) {
      return { key: 'compound', label: isVi() ? 'Hợp chất' : 'Compound' };
    } else if (!hasH && hasN && hasS && !hasO && syms.length === 3) {
      return { key: 'compound', label: isVi() ? 'Hợp chất' : 'Compound' };
    } else if (hasC && !hasH && !hasO && !hasN && !hasS) {
      // pure carbon clusters (C2, C3) → element-like
    } else {
      const cN = counts.get('C') || 1;
    const hN = counts.get('H') || 0;
    const oN = counts.get('O') || 0;
    const nN = counts.get('N') || 0;
    const halSyms = syms.filter(s => s === 'F' || s === 'Cl' || s === 'Br' || s === 'I');
    const nonCHO = syms.filter(s => s !== 'C' && s !== 'H' && s !== 'O' && s !== 'N' && s !== 'F' && s !== 'Cl' && s !== 'Br' && s !== 'I');

    if (hasO && nonCHO.length === 0) {
      if (oN === 1 && hN === 2 * cN + 2 && !hasN)
        return { key: 'alcohol', label: isVi() ? 'Ancol' : 'Alcohol' };
      if (oN === 1 && hN === 2 * cN && !hasN) {
        if (cN < 3) return { key: 'aldehyde', label: isVi() ? 'Anđehit' : 'Aldehyde' };
        return { key: 'ketone', label: isVi() ? 'Xeton' : 'Ketone' };
      }
      if (oN === 2 && hN === 2 * cN && !hasN)
        return { key: 'carboxylicAcid', label: isVi() ? 'Axit cacboxylic' : 'Carboxylic acid' };
    }

    if (hasN && !hasO && nonCHO.length === 0 && nN === 1 && hN === 2 * cN + 3)
      return { key: 'amine', label: isVi() ? 'Amin' : 'Amine' };

    if (halSyms.length > 0 && nonCHO.length === 0 && !hasO && !hasN)
      return { key: 'haloalkane', label: isVi() ? 'Dẫn xuất halogen' : 'Haloalkane' };

    if (!(hasO && syms.length === 2))
      return { key: 'organic', label: isVi() ? 'Hữu cơ' : 'Organic' };
    }
  }

  if (hasMetal && hasO && hasH) {
    return { key: 'base', label: isVi() ? 'Bazơ' : 'Base' };
  }

  if (hasH && syms.length >= 2 && !hasMetal) {
    const nonH = syms.filter(s => s !== 'H');
    if (nonH.length === 1 && (nonH[0] === 'F' || nonH[0] === 'Cl' || nonH[0] === 'Br' || nonH[0] === 'I')) {
      return { key: 'acid', label: isVi() ? 'Axit' : 'Acid' };
    }
    if (nonH.some(s => s === 'S' || s === 'N' || s === 'P')) {
      return { key: 'acid', label: isVi() ? 'Axit' : 'Acid' };
    }
  }

  if (hasO && syms.length === 2) {
    const other = syms.find(s => s !== 'O');
    const otherEl = elementBySym(other);
    if (otherEl && isMetal(otherEl)) return { key: 'basicOxide', label: isVi() ? 'Oxit bazơ' : 'Basic oxide' };
    return { key: 'acidicOxide', label: isVi() ? 'Oxit axit' : 'Acidic oxide' };
  }

  if (hasO && hasH && !hasMetal) {
    return { key: 'acid', label: isVi() ? 'Axit' : 'Acid' };
  }

  if (hasMetal && hasO && !hasH) {
    return { key: 'basicOxide', label: isVi() ? 'Oxit bazơ' : 'Basic oxide' };
  }

  if (hasMetal) {
    return { key: 'salt', label: isVi() ? 'Muối' : 'Salt' };
  }

  if (syms.length === 2 && !hasMetal) {
    return { key: 'binary', label: isVi() ? 'Hợp chất nhị nguyên' : 'Binary compound' };
  }

  return { key: 'compound', label: isVi() ? 'Hợp chất' : 'Compound' };
}
