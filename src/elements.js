// All 118 elements. Fields:
// z, s=symbol, n=name, m=mass, c=category, en=Pauling electronegativity (null=unknown),
// mb=max bond-order sum (covalent capacity; for metals = max ionic bond count),
// an=anion charge capacity (electrons accepted via ionic bonds; metals: 0),
// ch=common positive ionic charges (metals only), r=covalent radius (pm), col=Jmol color.
// Category codes: alkali alkaline transition post metalloid nonmetal halogen noble lanthanide actinide
const E = [
  [1,'H','Hydrogen',1.008,'nonmetal',2.20,1,1,null,31,'FFFFFF'],
  [2,'He','Helium',4.003,'noble',null,0,0,null,28,'D9FFFF'],
  [3,'Li','Lithium',6.94,'alkali',0.98,1,0,[1],128,'CC80FF'],
  [4,'Be','Beryllium',9.012,'alkaline',1.57,4,0,[2],96,'C2FF00'],
  [5,'B','Boron',10.81,'metalloid',2.04,4,3,null,84,'FFB5B5'],
  [6,'C','Carbon',12.011,'nonmetal',2.55,4,4,null,76,'909090'],
  [7,'N','Nitrogen',14.007,'nonmetal',3.04,4,3,null,71,'3050F8'],
  [8,'O','Oxygen',15.999,'nonmetal',3.44,3,2,null,66,'FF0D0D'],
  [9,'F','Fluorine',18.998,'halogen',3.98,1,1,null,57,'90E050'],
  [10,'Ne','Neon',20.180,'noble',null,0,0,null,58,'B3E3F5'],
  [11,'Na','Sodium',22.990,'alkali',0.93,1,0,[1],166,'AB5CF2'],
  [12,'Mg','Magnesium',24.305,'alkaline',1.31,2,0,[2],141,'8AFF00'],
  [13,'Al','Aluminium',26.982,'post',1.61,4,0,[3],121,'BFA6A6'],
  [14,'Si','Silicon',28.085,'metalloid',1.90,6,4,null,111,'F0C8A0'],
  [15,'P','Phosphorus',30.974,'nonmetal',2.19,6,3,null,107,'FF8000'],
  [16,'S','Sulfur',32.06,'nonmetal',2.58,6,2,null,105,'FFFF30'],
  [17,'Cl','Chlorine',35.45,'halogen',3.16,7,1,null,102,'1FF01F'],
  [18,'Ar','Argon',39.948,'noble',null,0,0,null,106,'80D1E3'],
  [19,'K','Potassium',39.098,'alkali',0.82,1,0,[1],203,'8F40D4'],
  [20,'Ca','Calcium',40.078,'alkaline',1.00,2,0,[2],176,'3DFF00'],
  [21,'Sc','Scandium',44.956,'transition',1.36,3,0,[3],170,'E6E6E6'],
  [22,'Ti','Titanium',47.867,'transition',1.54,4,0,[4,3],160,'BFC2C7'],
  [23,'V','Vanadium',50.942,'transition',1.63,5,0,[5,4,3],153,'A6A6AB'],
  [24,'Cr','Chromium',51.996,'transition',1.66,6,0,[3,6],139,'8A99C7'],
  [25,'Mn','Manganese',54.938,'transition',1.55,7,0,[2,7,4],145,'9C7AC7'],
  [26,'Fe','Iron',55.845,'transition',1.83,6,0,[2,3],140,'E06633'],
  [27,'Co','Cobalt',58.933,'transition',1.88,5,0,[2,3],126,'F090A0'],
  [28,'Ni','Nickel',58.693,'transition',1.91,4,0,[2,3],124,'50D050'],
  [29,'Cu','Copper',63.546,'transition',1.90,4,0,[2,1],132,'C88033'],
  [30,'Zn','Zinc',65.38,'transition',1.65,2,0,[2],122,'7D80B0'],
  [31,'Ga','Gallium',69.723,'post',1.81,4,0,[3],122,'C28F8F'],
  [32,'Ge','Germanium',72.630,'metalloid',2.01,6,4,null,120,'668F8F'],
  [33,'As','Arsenic',74.922,'metalloid',2.18,6,3,null,119,'BD80E3'],
  [34,'Se','Selenium',78.971,'nonmetal',2.55,6,2,null,120,'FFA100'],
  [35,'Br','Bromine',79.904,'halogen',2.96,7,1,null,120,'A62929'],
  [36,'Kr','Krypton',83.798,'noble',3.00,2,0,null,116,'5CB8D1'],
  [37,'Rb','Rubidium',85.468,'alkali',0.82,1,0,[1],220,'702EB0'],
  [38,'Sr','Strontium',87.62,'alkaline',0.95,2,0,[2],195,'00FF00'],
  [39,'Y','Yttrium',88.906,'transition',1.22,3,0,[3],190,'94FFFF'],
  [40,'Zr','Zirconium',91.224,'transition',1.33,4,0,[4],175,'94E0E0'],
  [41,'Nb','Niobium',92.906,'transition',1.60,5,0,[5],164,'73C2C9'],
  [42,'Mo','Molybdenum',95.95,'transition',2.16,6,0,[6,4],154,'54B5B5'],
  [43,'Tc','Technetium',98,'transition',1.90,7,0,[7],147,'3B9E9E'],
  [44,'Ru','Ruthenium',101.07,'transition',2.20,8,0,[3,4],146,'248F8F'],
  [45,'Rh','Rhodium',102.91,'transition',2.28,6,0,[3],142,'0A7D8C'],
  [46,'Pd','Palladium',106.42,'transition',2.20,4,0,[2,4],139,'006985'],
  [47,'Ag','Silver',107.87,'transition',1.93,3,0,[1],145,'C0C0C0'],
  [48,'Cd','Cadmium',112.41,'transition',1.69,2,0,[2],144,'FFD98F'],
  [49,'In','Indium',114.82,'post',1.78,3,0,[3,1],142,'A67573'],
  [50,'Sn','Tin',118.71,'post',1.96,4,0,[4,2],139,'668080'],
  [51,'Sb','Antimony',121.76,'metalloid',2.05,6,3,null,139,'9E63B5'],
  [52,'Te','Tellurium',127.60,'metalloid',2.10,6,2,null,138,'D47A00'],
  [53,'I','Iodine',126.90,'halogen',2.66,7,1,null,139,'940094'],
  [54,'Xe','Xenon',131.29,'noble',2.60,6,0,null,140,'429EB0'],
  [55,'Cs','Caesium',132.91,'alkali',0.79,1,0,[1],244,'57178F'],
  [56,'Ba','Barium',137.33,'alkaline',0.89,2,0,[2],215,'00C900'],
  [57,'La','Lanthanum',138.91,'lanthanide',1.10,3,0,[3],207,'70D4FF'],
  [58,'Ce','Cerium',140.12,'lanthanide',1.12,4,0,[3,4],204,'FFFC00'],
  [59,'Pr','Praseodymium',140.91,'lanthanide',1.13,4,0,[3],203,'D9FFC9'],
  [60,'Nd','Neodymium',144.24,'lanthanide',1.14,3,0,[3],201,'C7FFC7'],
  [61,'Pm','Promethium',145,'lanthanide',1.13,3,0,[3],199,'A3FFC7'],
  [62,'Sm','Samarium',150.36,'lanthanide',1.17,3,0,[3,2],198,'8FFFC7'],
  [63,'Eu','Europium',151.96,'lanthanide',1.20,3,0,[3,2],198,'61FFC7'],
  [64,'Gd','Gadolinium',157.25,'lanthanide',1.20,3,0,[3],196,'45FFC7'],
  [65,'Tb','Terbium',158.93,'lanthanide',1.20,4,0,[3,4],194,'30FFC7'],
  [66,'Dy','Dysprosium',162.50,'lanthanide',1.22,3,0,[3],192,'1FFFC9'],
  [67,'Ho','Holmium',164.93,'lanthanide',1.23,3,0,[3],192,'00FFC4'],
  [68,'Er','Erbium',167.26,'lanthanide',1.24,3,0,[3],189,'00E675'],
  [69,'Tm','Thulium',168.93,'lanthanide',1.25,3,0,[3,2],190,'00D452'],
  [70,'Yb','Ytterbium',173.05,'lanthanide',1.10,3,0,[3,2],187,'00BF38'],
  [71,'Lu','Lutetium',174.97,'lanthanide',1.27,3,0,[3],187,'00AB24'],
  [72,'Hf','Hafnium',178.49,'transition',1.30,4,0,[4],175,'4DC2FF'],
  [73,'Ta','Tantalum',180.95,'transition',1.50,5,0,[5],170,'4DA6FF'],
  [74,'W','Tungsten',183.84,'transition',2.36,6,0,[6,4],162,'2194D6'],
  [75,'Re','Rhenium',186.21,'transition',1.90,7,0,[7,4],159,'267DAB'],
  [76,'Os','Osmium',190.23,'transition',2.20,8,0,[8,4],159,'266696'],
  [77,'Ir','Iridium',192.22,'transition',2.20,6,0,[3,4],141,'175487'],
  [78,'Pt','Platinum',195.08,'transition',2.28,4,0,[4,2],136,'D0D0E0'],
  [79,'Au','Gold',196.97,'transition',2.54,5,0,[3,1],136,'FFD123'],
  [80,'Hg','Mercury',200.59,'transition',2.00,2,0,[2,1],132,'B8B8D0'],
  [81,'Tl','Thallium',204.38,'post',1.62,3,0,[1,3],145,'A6544D'],
  [82,'Pb','Lead',207.2,'post',2.33,4,0,[2,4],146,'575961'],
  [83,'Bi','Bismuth',208.98,'post',2.02,5,0,[3],148,'9E4B62'],
  [84,'Po','Polonium',209,'post',2.00,6,2,[4,2],140,'AB0C00'],
  [85,'At','Astatine',210,'halogen',2.20,7,1,null,150,'754F45'],
  [86,'Rn','Radon',222,'noble',2.20,2,0,null,150,'428296'],
  [87,'Fr','Francium',223,'alkali',0.70,1,0,[1],260,'420066'],
  [88,'Ra','Radium',226,'alkaline',0.90,2,0,[2],221,'007D00'],
  [89,'Ac','Actinium',227,'actinide',1.10,3,0,[3],215,'00ABFF'],
  [90,'Th','Thorium',232.04,'actinide',1.30,4,0,[4],206,'008AFF'],
  [91,'Pa','Protactinium',231.04,'actinide',1.50,5,0,[5],200,'00A1FF'],
  [92,'U','Uranium',238.03,'actinide',1.38,6,0,[6,4],196,'008FFF'],
  [93,'Np','Neptunium',237,'actinide',1.36,6,0,[5,4],190,'0080FF'],
  [94,'Pu','Plutonium',244,'actinide',1.28,6,0,[4,6],187,'006BFF'],
  [95,'Am','Americium',243,'actinide',1.13,6,0,[3,2],180,'545CF2'],
  [96,'Cm','Curium',247,'actinide',1.28,4,0,[3],169,'785CE3'],
  [97,'Bk','Berkelium',247,'actinide',1.30,4,0,[3,4],170,'8A4FE3'],
  [98,'Cf','Californium',251,'actinide',1.30,4,0,[3],190,'A136DA'],
  [99,'Es','Einsteinium',252,'actinide',1.30,3,0,[3],190,'B31BDA'],
  [100,'Fm','Fermium',257,'actinide',1.30,3,0,[3],190,'B31BBA'],
  [101,'Md','Mendelevium',258,'actinide',1.30,3,0,[3],190,'B30DA6'],
  [102,'No','Nobelium',259,'actinide',1.30,3,0,[2,3],190,'E006A0'],
  [103,'Lr','Lawrencium',266,'actinide',1.30,3,0,[3],190,'FF00CC'],
  [104,'Rf','Rutherfordium',267,'transition',null,4,0,[4],160,'CC0080'],
  [105,'Db','Dubnium',268,'transition',null,5,0,[5],160,'D6004D'],
  [106,'Sg','Seaborgium',269,'transition',null,6,0,[6],160,'C20000'],
  [107,'Bh','Bohrium',270,'transition',null,7,0,[7],160,'B60000'],
  [108,'Hs','Hassium',269,'transition',null,8,0,[8],160,'9E0000'],
  [109,'Mt','Meitnerium',278,'transition',null,6,0,[6],160,'820000'],
  [110,'Ds','Darmstadtium',281,'transition',null,6,0,[6],160,'75007D'],
  [111,'Rg','Roentgenium',282,'transition',null,6,0,[6],160,'660054'],
  [112,'Cn','Copernicium',285,'transition',null,2,0,[2],160,'5C004A'],
  [113,'Nh','Nihonium',286,'post',null,3,0,[1],170,'510A44'],
  [114,'Fl','Flerovium',289,'post',null,4,0,[2],180,'460D3B'],
  [115,'Mc','Moscovium',290,'post',null,3,0,[1,3],180,'3D1140'],
  [116,'Lv','Livermorium',293,'post',null,4,0,[2],180,'341244'],
  [117,'Ts','Tennessine',294,'halogen',null,3,1,null,180,'2A0B29'],
  [118,'Og','Oganesson',294,'noble',null,0,0,null,180,'1B0419'],
];

export const ELEMENTS = E.map(([z,s,n,m,c,en,mb,an,ch,r,col]) => ({
  z, sym: s, name: n, mass: m, cat: c, en, maxBonds: mb, anionCharge: an,
  charges: ch, radius: r, color: '#' + col,
  valenceElectrons: valenceOf(z),
}));

function valenceOf(z) {
  if (z === 1) return 1;
  if (z === 2) return 2;
  const table = {3:1,4:2,5:3,6:4,7:5,8:6,9:7,10:8,11:1,12:2,13:3,14:4,15:5,16:6,17:7,18:8};
  if (table[z]) return table[z];
  const group = groupOf(z);
  if (group >= 13 && group <= 18) return group - 10;
  return 0; // transition metals, lanthanides, actinides: d/f electrons, covalent LP not modeled
}

export function groupOf(z) {
  if (z === 1) return 1;
  if (z === 2) return 18;
  if (z >= 3 && z <= 4) return z - 2;
  if (z >= 5 && z <= 10) return z + 8;
  if (z >= 11 && z <= 12) return z - 10;
  if (z >= 13 && z <= 18) return z;
  if (z >= 19 && z <= 20) return z - 18;
  if (z >= 21 && z <= 30) return z - 18;
  if (z >= 31 && z <= 36) return z - 18;
  if (z >= 37 && z <= 38) return z - 36;
  if (z >= 39 && z <= 48) return z - 36;
  if (z >= 49 && z <= 54) return z - 36;
  if (z >= 55 && z <= 56) return z - 54;
  if (z >= 72 && z <= 80) return z - 68;
  if (z >= 81 && z <= 86) return z - 68;
  if (z >= 87 && z <= 88) return z - 86;
  if (z >= 104 && z <= 112) return z - 100;
  if (z >= 113 && z <= 118) return z - 100;
  return 3; // lanthanides/actinides nominal
}

export function periodOf(z) {
  if (z <= 2) return 1;
  if (z <= 10) return 2;
  if (z <= 18) return 3;
  if (z <= 36) return 4;
  if (z <= 54) return 5;
  if (z <= 86) return 6;
  return 7;
}

// Grid position for the periodic-table UI (18 columns).
export function gridPos(z) {
  if (z >= 57 && z <= 71) return { col: z - 57 + 3, row: 9 };   // lanthanides row
  if (z >= 89 && z <= 103) return { col: z - 89 + 3, row: 10 }; // actinides row
  const p = periodOf(z);
  const g = groupOf(z);
  return { col: g, row: p };
}

export const CAT_LABEL = {
  alkali: 'Alkali metal', alkaline: 'Alkaline earth', transition: 'Transition metal',
  post: 'Post-transition metal', metalloid: 'Metalloid', nonmetal: 'Reactive nonmetal',
  halogen: 'Halogen', noble: 'Noble gas', lanthanide: 'Lanthanide', actinide: 'Actinide',
  exotic: 'Exotic',
};

export const CAT_COLOR = {
  alkali: '#ff8a80', alkaline: '#ffb74d', transition: '#ffd54f', post: '#aed581',
  metalloid: '#4db6ac', nonmetal: '#64b5f6', halogen: '#ba68c8', noble: '#f06292',
  lanthanide: '#f48fb1', actinide: '#ffab91', exotic: '#e040fb',
};

export const isMetalCat = c => ['alkali','alkaline','transition','post','lanthanide','actinide'].includes(c);
export const isMetal = el => isMetalCat(el.cat);
// Noble gases that do form compounds (only with F or O)
export const nobleReactive = new Set([36, 54, 86]);
export const nobleInertPartner = el => el.cat === 'noble' && !nobleReactive.has(el.z);
export const nobleAllowedPartner = other => other.sym === 'F' || other.sym === 'O';

export function elementBySym(sym) {
  return ELEMENTS.find(e => e.sym === sym);
}
