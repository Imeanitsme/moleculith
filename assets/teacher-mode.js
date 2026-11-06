// Teacher Mode - Full Chemistry Education System (Bilingual EN/VI)
(function() {
  'use strict';

  // ---------- Internationalization ----------
  const I18N = {
    en: {
      title: "Chemistry Teaching Lab",
      back: "Back to Menu",
      lessons: "Lessons",
      progress: "Progress",
      simulation: "Interactive Simulation",
      reset: "Reset",
      play: "▶ Play",
      pause: "⏸ Pause",
      knowledgeCheck: "Knowledge Check",
      submitAnswer: "Submit Answer",
      periodicTable: "Periodic Table",
      calculator: "Calculator",
      constants: "Constants",
      calcPlaceholder: "e.g., H2O molar mass",
      calculate: "Calculate",
      gasConstant: "R (gas constant)",
      avogadro: "Nₐ (Avogadro)",
      planck: "h (Planck)",
      yourProgress: "Your Progress",
      lessonsCompleted: "Lessons Completed",
      quizzesPassed: "Quizzes Passed",
      averageScore: "Average Score",
      selectAnswer: "Please select an answer",
      correct: "Correct!",
      incorrect: "Incorrect.",
      enterFormula: "Enter a formula (e.g., H2O)",
      unknownElement: "Unknown element:",
      invalidFormula: "Invalid formula",
      molarMass: "Molar mass:",
      atomsIn: "atoms",
      atomOne: "atom",
      gPerMol: "g/mol",
      langBtn: "Tiếng Việt",
      lesson: "Lesson",
      min: "min",
      completed: "Completed",
      markDone: "Mark as Complete",
      question: "Question",
      of: "of",
      noSim: "This topic has no simulation.",
      courseIntro: "A complete chemistry course: lessons, live simulations and knowledge checks. Pick a topic from the menu above.",
      courseTopics: "Topics",
      courseProgress: "Course progress",
      startFirst: "Open your first topic",
      totalLessons: "Total lessons",
      simulations: "Live simulations",
      quizItems: "Quiz questions",
      languages: "Languages",
      paramTitle: "Parameters",
      time: "Time",
      elapsed: "Elapsed",
      score: "Score",
      wellDone: "Well done.",
      reviewText: "Review the lesson and try again.",
      overview: "Course Overview",
      atomic: "Atomic Structure",
      bonding: "Chemical Bonding",
      reactions: "Reactions & Stoichiometry",
      thermo: "Thermochemistry",
      kinetics: "Kinetics & Equilibrium",
      solutions: "Solutions",
      "acid-base": "Acid-Base Chemistry",
      electro: "Electrochemistry",
      organic: "Organic Chemistry",
      nuclear: "Nuclear Chemistry",
      spectroscopy: "Spectroscopy",
      "gas-laws": "Gas Laws",
      crystal: "Crystal Structures",
      quantum: "Quantum Mechanics",
      equilibrium: "Chemical Equilibrium",
      photochem: "Photochemistry",
      surface: "Surface Chemistry",
      analytical: "Analytical Chemistry",
      green: "Green Chemistry",
      biochem: "Biochemistry"
    },
    vi: {
      title: "Phòng dạy Hóa học",
      back: "Quay lại Menu",
      lessons: "Bài học",
      progress: "Tiến độ",
      simulation: "Mô phỏng tương tác",
      reset: "Đặt lại",
      play: "▶ Chạy",
      pause: "⏸ Tạm dừng",
      knowledgeCheck: "Kiểm tra kiến thức",
      submitAnswer: "Nộp câu trả lời",
      periodicTable: "Bảng tuần hoàn",
      calculator: "Máy tính",
      constants: "Hằng số",
      calcPlaceholder: "vd: khối lượng mol H2O",
      calculate: "Tính",
      gasConstant: "R (hằng số khí)",
      avogadro: "Nₐ (Avogadro)",
      planck: "h (Planck)",
      yourProgress: "Tiến độ của bạn",
      lessonsCompleted: "Bài đã hoàn thành",
      quizzesPassed: "Bài kiểm tra đạt",
      averageScore: "Điểm trung bình",
      selectAnswer: "Vui lòng chọn câu trả lời",
      correct: "Đúng!",
      incorrect: "Sai.",
      enterFormula: "Nhập công thức (vd: H2O)",
      unknownElement: "Nguyên tố không rõ:",
      invalidFormula: "Công thức không hợp lệ",
      molarMass: "Khối lượng mol:",
      atomsIn: "nguyên tử",
      atomOne: "nguyên tử",
      gPerMol: "g/mol",
      langBtn: "English",
      lesson: "Bài",
      min: "phút",
      completed: "Hoàn thành",
      markDone: "Đánh dấu hoàn thành",
      question: "Câu",
      of: "trên",
      noSim: "Chủ đề này không có mô phỏng.",
      courseIntro: "Khóa hóa học hoàn chỉnh: bài học, mô phỏng trực tiếp và kiểm tra kiến thức. Chọn chủ đề ở menu phía trên.",
      courseTopics: "Chủ đề",
      courseProgress: "Tiến độ khóa học",
      startFirst: "Mở chủ đề đầu tiên",
      totalLessons: "Tổng số bài",
      simulations: "Mô phỏng trực tiếp",
      quizItems: "Câu hỏi kiểm tra",
      languages: "Ngôn ngữ",
      paramTitle: "Thông số",
      time: "Thời gian",
      elapsed: "Đã trôi qua",
      score: "Điểm",
      wellDone: "Xuất sắc.",
      reviewText: "Hãy xem lại bài học và thử lại.",
      overview: "Tổng quan khóa học",
      atomic: "Cấu trúc nguyên tử",
      bonding: "Liên kết hóa học",
      reactions: "Phản ứng & Tỷ lượng",
      thermo: "Hóa nhiệt học",
      kinetics: "Động học & Cân bằng",
      solutions: "Dung dịch",
      "acid-base": "Hóa học Axit-Bazơ",
      electro: "Điện hóa học",
      organic: "Hóa học hữu cơ",
      nuclear: "Hóa học hạt nhân",
      spectroscopy: "Phổ học",
      "gas-laws": "Định luật khí",
      crystal: "Cấu trúc tinh thể",
      quantum: "Cơ học lượng tử",
      equilibrium: "Cân bằng hóa học",
      photochem: "Quang hóa học",
      surface: "Hóa học bề mặt",
      analytical: "Hóa học phân tích",
      green: "Hóa học xanh",
      biochem: "Hóa sinh"
    }
  };

  let currentLang = localStorage.getItem('tm-lang') || 'en';
  if (currentLang !== 'vi') currentLang = 'en';

  function t(key) {
    const L = I18N[currentLang];
    return (L && L[key]) || I18N.en[key] || key;
  }

  // Resolve a bilingual content object {en, vi}
  function c(obj) {
    if (typeof obj === 'string') return obj;
    if (!obj) return '';
    return obj[currentLang] || obj.en || '';
  }

  function tc(topicKey) { return t(topicKey); }

  function L(en, vi) { return { en: en, vi: vi }; }

  // ---------- Reference data ----------
  // Full element table: [symbol, Z, standard atomic weight, English name, Vietnamese name]
  const EL = [
    ['H', 1, 1.008, 'Hydrogen', 'Hydro'], ['He', 2, 4.0026, 'Helium', 'Heli'], ['Li', 3, 6.94, 'Lithium', 'Lithi'],
    ['Be', 4, 9.0122, 'Beryllium', 'Beri'], ['B', 5, 10.81, 'Boron', 'Bo'], ['C', 6, 12.011, 'Carbon', 'Cacbon'],
    ['N', 7, 14.007, 'Nitrogen', 'Nitơ'], ['O', 8, 15.999, 'Oxygen', 'Oxi'], ['F', 9, 18.998, 'Fluorine', 'Flo'],
    ['Ne', 10, 20.18, 'Neon', 'Neon'], ['Na', 11, 22.99, 'Sodium', 'Natri'], ['Mg', 12, 24.305, 'Magnesium', 'Magiê'],
    ['Al', 13, 26.9815, 'Aluminium', 'Nhôm'], ['Si', 14, 28.085, 'Silicon', 'Silic'], ['P', 15, 30.974, 'Phosphorus', 'Phốtpho'],
    ['S', 16, 32.06, 'Sulfur', 'Lưu huỳnh'], ['Cl', 17, 35.45, 'Chlorine', 'Clo'], ['Ar', 18, 39.948, 'Argon', 'Argon'],
    ['K', 19, 39.098, 'Potassium', 'Kali'], ['Ca', 20, 40.078, 'Calcium', 'Canxi'], ['Sc', 21, 44.956, 'Scandium', 'Scandi'],
    ['Ti', 22, 47.867, 'Titanium', 'Titan'], ['V', 23, 50.942, 'Vanadium', 'Vanadi'], ['Cr', 24, 51.996, 'Chromium', 'Crom'],
    ['Mn', 25, 54.938, 'Manganese', 'Mangan'], ['Fe', 26, 55.845, 'Iron', 'Sắt'], ['Co', 27, 58.933, 'Cobalt', 'Coban'],
    ['Ni', 28, 58.693, 'Nickel', 'Niken'], ['Cu', 29, 63.546, 'Copper', 'Đồng'], ['Zn', 30, 65.38, 'Zinc', 'Kẽm'],
    ['Ga', 31, 69.723, 'Gallium', 'Gali'], ['Ge', 32, 72.63, 'Germanium', 'Germani'], ['As', 33, 74.922, 'Arsenic', 'Asen'],
    ['Se', 34, 78.971, 'Selenium', 'Selen'], ['Br', 35, 79.904, 'Bromine', 'Brom'], ['Kr', 36, 83.798, 'Krypton', 'Kripton'],
    ['Rb', 37, 85.468, 'Rubidium', 'Rubidi'], ['Sr', 38, 87.62, 'Strontium', 'Stronti'], ['Y', 39, 88.906, 'Yttrium', 'Ytri'],
    ['Zr', 40, 91.224, 'Zirconium', 'Ziroi'], ['Nb', 41, 92.906, 'Niobium', 'Niobi'], ['Mo', 42, 95.95, 'Molybdenum', 'Molipden'],
    ['Tc', 43, 98, 'Technetium', 'Tecneti'], ['Ru', 44, 101.07, 'Ruthenium', 'Rutheni'], ['Rh', 45, 102.91, 'Rhodium', 'Rhođi'],
    ['Pd', 46, 106.42, 'Palladium', 'Paladi'], ['Ag', 47, 107.87, 'Silver', 'Bạc'], ['Cd', 48, 112.41, 'Cadmium', 'Catmi'],
    ['In', 49, 114.82, 'Indium', 'Indi'], ['Sn', 50, 118.71, 'Tin', 'Thiếc'], ['Sb', 51, 121.76, 'Antimony', 'Antimon'],
    ['Te', 52, 127.6, 'Tellurium', 'Telu'], ['I', 53, 126.9, 'Iodine', 'Iot'], ['Xe', 54, 131.29, 'Xenon', 'Xenon'],
    ['Cs', 55, 132.91, 'Caesium', 'Xesi'], ['Ba', 56, 137.33, 'Barium', 'Bari'], ['La', 57, 138.91, 'Lanthanum', 'Lanatan'],
    ['Ce', 58, 140.12, 'Cerium', 'Xeri'], ['Pr', 59, 140.91, 'Praseodymium', 'Praseodim'], ['Nd', 60, 144.24, 'Neodymium', 'Neodim'],
    ['Pm', 61, 145, 'Promethium', 'Promethi'], ['Sm', 62, 150.36, 'Samarium', 'Samari'], ['Eu', 63, 151.96, 'Europium', 'Europi'],
    ['Gd', 64, 157.25, 'Gadolinium', 'Gadolini'], ['Tb', 65, 158.93, 'Terbium', 'Terbi'], ['Dy', 66, 162.5, 'Dysprosium', 'Disprosi'],
    ['Ho', 67, 164.93, 'Holmium', 'Holsi'], ['Er', 68, 167.26, 'Erbium', 'Ecbi'], ['Tm', 69, 168.93, 'Thulium', 'Tuli'],
    ['Yb', 70, 173.05, 'Ytterbium', 'Ytterbi'], ['Lu', 71, 174.97, 'Lutetium', 'Luteti'], ['Hf', 72, 178.49, 'Hafnium', 'Hafi'],
    ['Ta', 73, 180.95, 'Tantalum', 'Tantal'], ['W', 74, 183.84, 'Tungsten', 'Vonfam'], ['Re', 75, 186.21, 'Rhenium', 'Rheni'],
    ['Os', 76, 190.23, 'Osmium', 'Osmi'], ['Ir', 77, 192.22, 'Iridium', 'Iridi'], ['Pt', 78, 195.08, 'Platinum', 'Platin'],
    ['Au', 79, 196.97, 'Gold', 'Vàng'], ['Hg', 80, 200.59, 'Mercury', 'Thủy ngân'], ['Tl', 81, 204.38, 'Thallium', 'Tali'],
    ['Pb', 82, 207.2, 'Lead', 'Chì'], ['Bi', 83, 208.98, 'Bismuth', 'Bitmut'], ['Po', 84, 209, 'Polonium', 'Poloni'],
    ['At', 85, 210, 'Astatine', 'Astatin'], ['Rn', 86, 222, 'Radon', 'Radon'], ['Fr', 87, 223, 'Francium', 'Franxi'],
    ['Ra', 88, 226, 'Radium', 'Radi'], ['Ac', 89, 227, 'Actinium', 'Actini'], ['Th', 90, 232.04, 'Thorium', 'Thori'],
    ['Pa', 91, 231.04, 'Protactinium', 'Protactini'], ['U', 92, 238.03, 'Uranium', 'Urani'], ['Np', 93, 237, 'Neptunium', 'Neptuni'],
    ['Pu', 94, 244, 'Plutonium', 'Plutoni'], ['Am', 95, 243, 'Americium', 'Americi'], ['Cm', 96, 247, 'Curium', 'Curi'],
    ['Bk', 97, 247, 'Berkelium', 'Benkeli'], ['Cf', 98, 251, 'Californium', 'Kalifoni'], ['Es', 99, 252, 'Einsteinium', 'Einstaini'],
    ['Fm', 100, 257, 'Fermium', 'Fermi'], ['Md', 101, 258, 'Mendelevium', 'Mendeleyev'], ['No', 102, 259, 'Nobelium', 'Nobel'],
    ['Lr', 103, 262, 'Lawrencium', 'Lawrenci'], ['Rf', 104, 267, 'Rutherfordium', 'Rutherford'], ['Db', 105, 268, 'Dubnium', 'Dubni'],
    ['Sg', 106, 269, 'Seaborgium', 'Seaborgi'], ['Bh', 107, 270, 'Bohrium', 'Bohri'], ['Hs', 108, 277, 'Hassium', 'Hasium'],
    ['Mt', 109, 278, 'Meitnerium', 'Meitneri'], ['Ds', 110, 281, 'Darmstadtium', 'Darmstadti'], ['Rg', 111, 282, 'Roentgenium', 'Rontgen'],
    ['Cn', 112, 285, 'Copernicium', 'Copernici'], ['Nh', 113, 286, 'Nihonium', 'Nihoni'], ['Fl', 114, 289, 'Flerovium', 'Flerovi'],
    ['Mc', 115, 290, 'Moscovium', 'Moscovi'], ['Lv', 116, 293, 'Livermorium', 'Livermori'], ['Ts', 117, 294, 'Tennessine', 'Tenesin'],
    ['Og', 118, 294, 'Oganesson', 'Oganeson']
  ];

  const MOLAR_MASS = {}, ELEMENT_Z = {}, ELEMENT_NAMES = {};
  for (let e = 0; e < EL.length; e++) {
    MOLAR_MASS[EL[e][0]] = EL[e][2];
    ELEMENT_Z[EL[e][0]] = EL[e][1];
    ELEMENT_NAMES[EL[e][0]] = L(EL[e][3], EL[e][4]);
  }

  function getElementName(sym) {
    return ELEMENT_NAMES[sym] ? c(ELEMENT_NAMES[sym]) : sym;
  }

  // [group, row] of the real 18-column table; rows 9 and 10 hold the f-block.
  function cellPosition(z) {
    if (z <= 2) return [z === 1 ? 1 : 18, 1];
    if (z <= 4) return [z - 2, 2];
    if (z <= 10) return [z + 8, 2];
    if (z <= 12) return [z - 10, 3];
    if (z <= 18) return [z, 3];
    if (z <= 36) return [z - 18, 4];
    if (z <= 54) return [z - 36, 5];
    if (z === 55 || z === 56) return [z - 54, 6];
    if (z <= 71) return [z - 54, 9];
    if (z <= 86) return [z - 68, 6];
    if (z === 87 || z === 88) return [z - 86, 7];
    if (z <= 103) return [z - 86, 10];
    return [z - 100, 7];
  }

  function blockOf(z) {
    if (z === 2) return 's';
    if (z >= 57 && z <= 71) return 'f';
    if (z >= 89 && z <= 103) return 'f';
    const g = cellPosition(z)[0];
    if (g <= 2) return 's';
    if (g <= 12) return 'd';
    return 'p';
  }

  // ---------- Lesson data: 20 topics + overview, fully bilingual ----------
  const LESSONS = {

    atomic: {
      color: '#e94560',
      sim: 'atom-builder',
      lessons: [
        {
          title: L('The Nucleus: Protons and Neutrons', 'Hạt nhân: Proton và Neutron'),
          duration: 8,
          body: L(`
<h3>Composition of the atom</h3>
<p>An atom is a dense, positively charged nucleus surrounded by electrons. Almost all of its mass sits in the nucleus.</p>
<ul>
<li><b>Proton</b> — charge +1e, mass 1.6726×10⁻²⁷ kg. The count defines the element (atomic number Z).</li>
<li><b>Neutron</b> — charge 0, mass 1.6749×10⁻²⁷ kg. The count defines the isotope.</li>
<li><b>Electron</b> — charge −1e, mass 9.109×10⁻³¹ kg, about 1/1836 of a proton.</li>
</ul>
<div class="formula">A = Z + N&nbsp;&nbsp;&nbsp;mass number = protons + neutrons</div>
<p>Atoms are neutral when electrons equal protons. Gain or lose electrons and the atom becomes an ion.</p>
<div class="example">Carbon-14: Z = 6, N = 8, and 6 electrons when neutral. It is the same element as carbon-12 but a different isotope.</div>`, `
<h3>Thành phần của nguyên tử</h3>
<p>Nguyên tử gồm một hạt nhân đặc, tích điện dương, được bao quanh bởi các electron. Gần như toàn bộ khối lượng tập trung ở hạt nhân.</p>
<ul>
<li><b>Proton</b> — điện tích +1e, khối lượng 1,6726×10⁻²⁷ kg. Số proton xác định nguyên tố (số hiệu nguyên tử Z).</li>
<li><b>Neutron</b> — điện tích 0, khối lượng 1,6749×10⁻²⁷ kg. Số neutron xác định đồng vị.</li>
<li><b>Electron</b> — điện tích −1e, khối lượng 9,109×10⁻³¹ kg, bằng khoảng 1/1836 proton.</li>
</ul>
<div class="formula">A = Z + N&nbsp;&nbsp;&nbsp;số khối = số proton + số neutron</div>
<p>Nguyên tử trung hòa khi số electron bằng số proton. Nhận hoặc mất electron sẽ trở thành ion.</p>
<div class="example">Carbon-14: Z = 6, N = 8, trung hòa có 6 electron. Cùng nguyên tố với carbon-12 nhưng là đồng vị khác.</div>`)
        },
        {
          title: L('Electrons in Shells', 'Electron trong các lớp vỏ'),
          duration: 10,
          body: L(`
<h3>Energy levels</h3>
<p>Electrons occupy quantised shells labelled n = 1, 2, 3… Shell n holds at most 2n² electrons.</p>
<div class="formula">n = 1 → 2 e⁻&nbsp;&nbsp;|&nbsp;&nbsp;n = 2 → 8 e⁻&nbsp;&nbsp;|&nbsp;&nbsp;n = 3 → 18 e⁻</div>
<p>Within a shell are subshells s, p, d, f holding 2, 6, 10 and 14 electrons. Filling follows increasing energy (Aufbau), maximum spin pairing first (Hund), and no two electrons share all four quantum numbers (Pauli).</p>
<div class="example">Sodium (Z = 11): 1s² 2s² 2p⁶ 3s¹ — one valence electron, which is why Na⁺ is so common.</div>
<p>The outermost electrons determine chemistry; the nucleus determines identity.</p>`, `
<h3>Mức năng lượng</h3>
<p>Electron chiếm các lớp lượng tử hóa n = 1, 2, 3… Lớp n chứa tối đa 2n² electron.</p>
<div class="formula">n = 1 → 2 e⁻&nbsp;&nbsp;|&nbsp;&nbsp;n = 2 → 8 e⁻&nbsp;&nbsp;|&nbsp;&nbsp;n = 3 → 18 e⁻</div>
<p>Trong mỗi lớp có các phân lớp s, p, d, f chứa lần lượt 2, 6, 10 và 14 electron. Thứ tự điền theo năng lượng tăng dần (Aufbau), ưu tiên spin song song tối đa (Hund), và không có hai electron nào có cùng bốn số lượng tử (Pauli).</p>
<div class="example">Natri (Z = 11): 1s² 2s² 2p⁶ 3s¹ — một electron hóa trị, vì vậy Na⁺ rất phổ biến.</div>
<p>Electron lớp ngoài cùng quyết định tính chất hóa học; hạt nhân quyết định danh tính nguyên tố.</p>`)
        },
        {
          title: L('Periodic Trends', 'Tuần hoàn biến thiên tuần hoàn'),
          duration: 9,
          body: L(`
<h3>Why the table is shaped like it is</h3>
<p>Rows (periods) fill shells; columns (groups) share valence-electron count, so they share chemistry.</p>
<ul>
<li><b>Atomic radius</b> increases down a group, decreases across a period.</li>
<li><b>Ionisation energy</b> and <b>electronegativity</b> do the opposite: up and to the right.</li>
<li><b>Metallic character</b> grows toward the lower left; fluorine is the most electronegative element, francium the least.</li>
</ul>
<div class="formula">Z_eff ≈ Z − S&nbsp;&nbsp;(effective nuclear charge after shielding)</div>
<p>Down a group, added shells shield the nucleus; across a period, protons are added without new shielding, so the pull tightens.</p>`, `
<h3>Vì sao bảng có hình dạng như vậy</h3>
<p>Chu kỳ điền thêm lớp; nhóm có cùng số electron hóa trị nên có tính chất tương tự nhau.</p>
<ul>
<li><b>Bán kính nguyên tử</b> tăng xuống dưới, giảm sang phải.</li>
<li><b>Năng lượng ion hóa</b> và <b>độ âm điện</b> ngược lại: tăng lên trên và sang phải.</li>
<li><b>Tính kim loại</b> tăng về góc dưới-trái; flo có độ âm điện lớn nhất, franhi nhỏ nhất.</li>
</ul>
<div class="formula">Z_eff ≈ Z − S&nbsp;&nbsp;(điện tích hạt nhân hiệu dụng sau khi chắn)</div>
<p>Xuống dưới, thêm lớp chắn hạt nhân; sang phải, thêm proton mà không thêm lớp chắn nên lực hút mạnh hơn.</p>`)
        }
      ],
      quiz: [
        {
          q: L('An atom has 11 protons, 12 neutrons and 11 electrons. What is its mass number?',
               'Một nguyên tử có 11 proton, 12 neutron và 11 electron. Số khối là bao nhiêu?'),
          opts: [L('11', '11'), L('23', '23'), L('12', '12'), L('34', '34')],
          a: 1,
          ex: L('Mass number A = Z + N = 11 + 12 = 23. This is sodium-23.',
                'Số khối A = Z + N = 11 + 12 = 23. Đây là natri-23.')
        },
        {
          q: L('Which particle determines the identity of an element?',
               'Hạt nào xác định danh tính của một nguyên tố?'),
          opts: [L('Neutron', 'Neutron'), L('Electron', 'Electron'), L('Proton', 'Proton'), L('Any of them', 'Bất kỳ hạt nào')],
          a: 2,
          ex: L('The proton number (atomic number Z) defines the element.',
                'Số proton (số hiệu nguyên tử Z) xác định nguyên tố.')
        },
        {
          q: L('Ionisation energy generally increases in which direction?',
               'Năng lượng ion hóa thường tăng theo hướng nào?'),
          opts: [L('Down and left', 'Xuống dưới và sang trái'), L('Up and right', 'Lên trên và sang phải'),
                 L('Straight down a group', 'Thẳng xuống một nhóm'), L('It never varies', 'Không thay đổi')],
          a: 1,
          ex: L('Larger Z_eff and smaller radius hold electrons tighter: up and to the right.',
                'Z_eff lớn hơn và bán kính nhỏ hơn giữ electron chặt hơn: lên trên và sang phải.')
        }
      ]
    },

    bonding: {
      color: '#4caf50',
      sim: 'bond-builder',
      lessons: [
        {
          title: L('Ionic Bonds: Transfer of Electrons', 'Liên kết ion: chuyển electron'),
          duration: 8,
          body: L(`
<h3>Opposite charges attract</h3>
<p>A metal with a low ionisation energy hands electrons to a non-metal with a high electron affinity. Both reach a noble-gas configuration and become ions.</p>
<div class="formula">Na → Na⁺ + e⁻&nbsp;&nbsp;&nbsp;Cl + e⁻ → Cl⁻&nbsp;&nbsp;&nbsp;Na⁺ + Cl⁻ → NaCl</div>
<p>The resulting lattice is held by Coulomb attraction, which is non-directional — that is why ionic compounds form crystals, not molecules.</p>
<ul>
<li>High melting points, hard but brittle.</li>
<li>Non-conductive as solids; conductive when molten or dissolved, because ions move.</li>
</ul>`, `
<h3>Điện tích trái dấu hút nhau</h3>
<p>Kim loại có năng lượng ion hóa thấp nhường electron cho phi kim có ái lực electron cao. Cả hai đạt cấu hình khí hiếm và trở thành ion.</p>
<div class="formula">Na → Na⁺ + e⁻&nbsp;&nbsp;&nbsp;Cl + e⁻ → Cl⁻&nbsp;&nbsp;&nbsp;Na⁺ + Cl⁻ → NaCl</div>
<p>Mạng tinh thể được giữ bởi lực hút Coulomb, lực này không định hướng — vì vậy hợp chất ion tạo tinh thể chứ không tạo phân tử rời rạc.</p>
<ul>
<li>Nóng chảy ở nhiệt độ cao, cứng nhưng giòn.</li>
<li>Rắn không dẫn điện; nóng chảy hoặc hòa tan thì dẫn điện vì ion di chuyển.</li>
</ul>`)
        },
        {
          title: L('Covalent Bonds: Shared Pairs', 'Liên kết cộng hóa trị: cặp electron chung'),
          duration: 10,
          body: L(`
<h3>Sharing instead of transferring</h3>
<p>When two atoms have similar electronegativity, neither can take the electron, so they share a pair. Overlapping orbitals concentrate electron density between the nuclei.</p>
<ul>
<li><b>Nonpolar</b> (ΔEN ≈ 0): H₂, Cl₂ — density shared evenly.</li>
<li><b>Polar</b> (ΔEN 0.4–1.7): HCl, H₂O — one end partially negative (δ−), the other δ+.</li>
<li><b>Multiple bonds</b>: one σ plus one or two π bonds. A C=C double bond is shorter and stronger than C–C but not twice as strong.</li>
</ul>
<div class="formula">ΔEN &gt; 1.7 ≈ ionic&nbsp;&nbsp;|&nbsp;&nbsp;0.4 &lt; ΔEN &lt; 1.7 polar covalent&nbsp;&nbsp;|&nbsp;&nbsp;ΔEN &lt; 0.4 nonpolar</div>
<p>Sharing is quantised: an atom forms as many covalent bonds as it has unpaired electrons, which is why carbon makes four.</p>`, `
<h3>Chia sẻ thay vì chuyển</h3>
<p>Khi hai nguyên tử có độ âm điện gần nhau, không bên nào lấy được electron, nên chúng chia sẻ một cặp. Orbital xen kẽ tập trung mật độ electron giữa hai hạt nhân.</p>
<ul>
<li><b>Không phân cực</b> (ΔEN ≈ 0): H₂, Cl₂ — mật độ chia đều.</li>
<li><b>Phân cực</b> (ΔEN 0,4–1,7): HCl, H₂O — một đầu tích điện âm một phần (δ−), đầu kia δ+.</li>
<li><b>Liên kết bội</b>: một σ cộng một hoặc hai π. Liên đôi C=C ngắn và mạnh hơn C–C nhưng không mạnh gấp đôi.</li>
</ul>
<div class="formula">ΔEN &gt; 1,7 ≈ ion&nbsp;&nbsp;|&nbsp;&nbsp;0,4 &lt; ΔEN &lt; 1,7 cộng hóa trị phân cực&nbsp;&nbsp;|&nbsp;&nbsp;ΔEN &lt; 0,4 không phân cực</div>
<p>Số liên kết cộng hóa trị bằng số electron độc thân, vì vậy cacbon tạo bốn liên kết.</p>`)
        },
        {
          title: L('Metallic Bonds and Intermolecular Forces', 'Liên kết kim loại và lực giữa phân tử'),
          duration: 9,
          body: L(`
<h3>Two more ways to hold matter together</h3>
<p><b>Metallic bonding</b>: valence electrons delocalise into a "sea" that binds positive cores. Mobile electrons explain conductivity and shine; non-directional bonding explains malleability.</p>
<p><b>Intermolecular forces</b> are weaker than bonds but control boiling points:</p>
<ul>
<li>London dispersion — instant dipoles, present in everything, stronger with more electrons.</li>
<li>Dipole–dipole — permanent polar molecules align.</li>
<li>Hydrogen bonding — H bound to N, O or F attracted to a lone pair. Water's high boiling point, ice's open lattice and DNA base-pairing all come from it.</li>
</ul>
<div class="example">HF boils far above HCl despite lower mass: hydrogen bonding wins.</div>`, `
<h3>Hai cách khác để giữ vật chất</h3>
<p><b>Liên kết kim loại</b>: electron hóa trị giải tỏa thành "biển electron" liên kết các lõi dương. Electron tự do giải thích tính dẫn điện và ánh kim; liên kết không định hướng giải thích tính dát mỏng.</p>
<p><b>Lực giữa phân tử</b> yếu hơn liên kết nhưng quyết định nhiệt độ sôi:</p>
<ul>
<li>Tán xạ London — lưỡng cực tức thời, có trong mọi chất, mạnh hơn khi nhiều electron.</li>
<li>Lưỡng cực–lưỡng cực — phân tử phân cực vĩnh cửu xếp thẳng hàng.</li>
<li>Liên kết hydro — H liên kết với N, O hoặc F bị hút bởi cặp electron tự do. Nước sôi cao, đá nổi và cặp base trong DNA đều đến từ liên kết này.</li>
</ul>
<div class="example">HF sôi cao hơn hẳn HCl dù khối lượng nhỏ hơn: liên kết hydro thắng thế.</div>`)
        }
      ],
      quiz: [
        {
          q: L('Which property best identifies an ionic compound?',
               'Tính chất nào nhận biết hợp chất ion rõ nhất?'),
          opts: [L('Low melting point', 'Nhiệt độ nóng chảy thấp'),
                 L('Conducts when molten', 'Dẫn điện khi nóng chảy'),
                 L('Always a gas', 'Luôn là khí'),
                 L('Soft and waxy', 'Mềm và sáp')],
          a: 1,
          ex: L('Mobile ions carry current only in the melt or solution.',
                'Ion di chuyển chỉ mang dòng điện khi nóng chảy hoặc hòa tan.')
        },
        {
          q: L('A C=O bond in CO₂ is best described as:', 'Liên kết C=O trong CO₂ là:'),
          opts: [L('One σ and one π', 'Một σ và một π'), L('Two σ', 'Hai σ'),
                 L('Two π', 'Hai π'), L('Ionic', 'Ion')],
          a: 0,
          ex: L('Every double bond is one sigma plus one pi bond.',
                'Mọi liên kết đôi gồm một sigma và một pi.')
        },
        {
          q: L('Why does water boil at a far higher temperature than H₂S?',
               'Vì sao nước sôi cao hơn nhiều so với H₂S?'),
          opts: [L('Higher molar mass', 'Khối lượng mol lớn hơn'),
                 L('Hydrogen bonding', 'Liên kết hydro'),
                 L('Ionic character', 'Tính ion'),
                 L('More protons', 'Nhiều proton hơn')],
          a: 1,
          ex: L('O is electronegative enough for strong H-bonds; S is not.',
                'O đủ âm điện để tạo liên kết hydro mạnh; S thì không.')
        }
      ]
    },

    reactions: {
      color: '#2196f3',
      sim: 'balance-equation',
      lessons: [
        {
          title: L('Balancing Equations', 'Cân bằng phương trình'),
          duration: 8,
          body: L(`
<h3>Conservation of mass</h3>
<p>Atoms are never created or destroyed in a chemical reaction, so each element must appear equally on both sides. Coefficients scale whole formula units; subscripts are identity and must never be edited.</p>
<div class="example">C₂H₆ combustion: 2 C₂H₆ + 7 O₂ → 4 CO₂ + 6 H₂O. Check: C 4=4, H 12=12, O 14=14.</div>
<p>Method: balance the most constrained element first, leave free oxygen or hydrogen for last, then clear any fraction by doubling every coefficient.</p>`, `
<h3>Bảo toàn khối lượng</h3>
<p>Phản ứng hóa học không sinh ra hay phá hủy nguyên tử, nên mỗi nguyên tố phải có số nguyên tử bằng nhau hai bên. Hệ số nhân toàn bộ đơn vị công thức; chỉ số dưới là danh tính và không được sửa.</p>
<div class="example">Đốt cháy C₂H₆: 2 C₂H₆ + 7 O₂ → 4 CO₂ + 6 H₂O. Kiểm tra: C 4=4, H 12=12, O 14=14.</div>
<p>Phương pháp: cân bằng nguyên tố bị ràng buộc nhất trước, để oxygen/hydrogen tự do cuối cùng, rồi nhân đôi mọi hệ số nếu còn phân số.</p>`)
        },
        {
          title: L('The Mole and Stoichiometry', 'Mol và tỷ lượng'),
          duration: 11,
          body: L(`
<h3>Counting atoms by weighing them</h3>
<p>One mole contains exactly 6.02214076×10²³ entities (Avogadro's constant Nₐ). Molar mass in g/mol numerically equals atomic or formula mass in u.</p>
<div class="formula">n = m / M&nbsp;&nbsp;&nbsp;n = N / Nₐ&nbsp;&nbsp;&nbsp;n = C·V&nbsp;&nbsp;&nbsp;gas at STP: n = V / 22.4 L</div>
<p>Balanced coefficients are mole ratios. Read the equation as "2 molecules of hydrogen per 1 of oxygen", then scale to any amount.</p>
<div class="example">How much CaO from 100 g CaCO₃? M(CaCO₃)=100.1 g/mol → 0.999 mol. 1:1 ratio, M(CaO)=56.1 g/mol → 56.0 g.</div>
<p>The <b>limiting reagent</b> is the reactant exhausted first; everything else is in excess and cannot react further.</p>`, `
<h3>Đếm nguyên tử bằng cách cân</h3>
<p>Một mol chứa đúng 6,02214076×10²³ thực thể (hằng số Avogadro Nₐ). Khối lượng mol theo g/mol bằng giá trị khối lượng nguyên tử hay công thức tính theo u.</p>
<div class="formula">n = m / M&nbsp;&nbsp;&nbsp;n = N / Nₐ&nbsp;&nbsp;&nbsp;n = C·V&nbsp;&nbsp;&nbsp;khí ở đktc: n = V / 22,4 L</div>
<p>Hệ số cân bằng chính là tỉ lệ mol. Hãy đọc "2 phân tử hydro với 1 phân tử oxi" rồi nhân lên mọi lượng.</p>
<div class="example">Bao nhiêu CaO từ 100 g CaCO₃? M(CaCO₃)=100,1 g/mol → 0,999 mol. Tỉ lệ 1:1, M(CaO)=56,1 g/mol → 56,0 g.</div>
<p><b>Chất giới hạn</b> là chất hết trước; các chất khác dư và không phản ứng tiếp được.</p>`)
        },
        {
          title: L('Reaction Types and Yield', 'Loại phản ứng và hiệu suất'),
          duration: 9,
          body: L(`
<h3>Five patterns cover most chemistry</h3>
<ul>
<li><b>Synthesis</b>: A + B → AB.</li>
<li><b>Decomposition</b>: AB → A + B.</li>
<li><b>Single replacement</b>: A + BC → AC + B; governed by the activity series.</li>
<li><b>Double replacement</b>: AB + CD → AD + CB; usually driven by a precipitate, gas or water.</li>
<li><b>Combustion</b>: fuel + O₂ → oxides, releasing heat and light.</li>
</ul>
<div class="formula">% yield = (actual / theoretical) × 100</div>
<p>Theoretical yield comes from the limiting reagent and perfect conversion. Real work always loses some material, so yield below 100% is normal — above it means a weighing or purity error.</p>`, `
<h3>Năm mô hình bao trùm phần lớn hóa học</h3>
<ul>
<li><b>Tổng hợp</b>: A + B → AB.</li>
<li><b>Phân hủy</b>: AB → A + B.</li>
<li><b>Thế đơn</b>: A + BC → AC + B; theo dãy hoạt động hóa học.</li>
<li><b>Thế đôi</b>: AB + CD → AD + CB; thường tạo kết tủa, khí hoặc nước.</li>
<li><b>Cháy</b>: nhiên liệu + O₂ → oxit, tỏa nhiệt và phát sáng.</li>
</ul>
<div class="formula">Hiệu suất % = (lượng thực / lượng lý thuyết) × 100</div>
<p>Lượng lý thuyết tính từ chất giới hạn với chuyển hóa hoàn toàn. Thực hành luôn hao hụt, nên hiệu suất dưới 100% là bình thường — trên 100% nghĩa là sai cân hoặc độ tinh khiết.</p>`)
        }
      ],
      quiz: [
        {
          q: L('Balance: _ Fe + _ O₂ → _ Fe₂O₃', 'Cân bằng: _ Fe + _ O₂ → _ Fe₂O₃'),
          opts: [L('2, 3, 2', '2, 3, 2'), L('4, 3, 2', '4, 3, 2'), L('3, 2, 3', '3, 2, 3'), L('1, 1, 1', '1, 1, 1')],
          a: 1,
          ex: L('4 Fe + 3 O₂ → 2 Fe₂O₃ gives Fe 4=4 and O 6=6.',
                '4 Fe + 3 O₂ → 2 Fe₂O₃ cho Fe 4=4 và O 6=6.')
        },
        {
          q: L('2 mol H₂ react with 2 mol O₂ by 2 H₂ + O₂ → 2 H₂O. The limiting reagent is:',
               '2 mol H₂ phản ứng với 2 mol O₂ theo 2 H₂ + O₂ → 2 H₂O. Chất giới hạn là:'),
          opts: [L('O₂', 'O₂'), L('H₂', 'H₂'), L('Neither', 'Không chất nào'), L('Water', 'Nước')],
          a: 1,
          ex: L('H₂ needs only 1 mol of O₂, so H₂ runs out first.',
                'H₂ chỉ cần 1 mol O₂ nên H₂ hết trước.')
        },
        {
          q: L('A reaction should give 50.0 g but gives 41.0 g. The percent yield is:',
               'Phản ứng lẽ ra cho 50,0 g nhưng chỉ được 41,0 g. Hiệu suất là:'),
          opts: [L('82%', '82%'), L('122%', '122%'), L('41%', '41%'), L('90%', '90%')],
          a: 0,
          ex: L('41.0 / 50.0 × 100 = 82%.', '41,0 / 50,0 × 100 = 82%.')
        }
      ]
    },

    thermo: {
      color: '#ff7043',
      sim: 'calorimetry',
      lessons: [
        {
          title: L('Energy, Enthalpy and Heat', 'Năng lượng, enthalpy và nhiệt'),
          duration: 10,
          body: L(`
<h3>Heat is energy in transit</h3>
<p>The internal energy U of a system is the sum of all microscopic kinetic and potential energies. At constant pressure the heat exchanged equals the enthalpy change H = U + pV.</p>
<div class="formula">q = m · c · ΔT</div>
<ul>
<li><b>Exothermic</b>: ΔH &lt; 0, surroundings warm up (combustion, neutralisation).</li>
<li><b>Endothermic</b>: ΔH &gt; 0, surroundings cool down (photosynthesis, dissolving NH₄NO₃).</li>
</ul>
<div class="example">Heat 250 g water by 20 K: q = 0.250 × 4184 × 20 = 20.9 kJ.</div>`, `
<h3>Nhiệt là năng lượng truyền đi</h3>
<p>Năng lượng trong U của hệ là tổng động năng và thế năng vi mô. Ở áp suất không đổi, nhiệt trao đổi bằng biến thiên enthalpy H = U + pV.</p>
<div class="formula">q = m · c · ΔT</div>
<ul>
<li><b>Tỏa nhiệt</b>: ΔH &lt; 0, môi trường nóng lên (cháy, trung hòa).</li>
<li><b>Thu nhiệt</b>: ΔH &gt; 0, môi trường lạnh đi (quang hợp, hòa tan NH₄NO₃).</li>
</ul>
<div class="example">Đun 250 g nước nóng lên 20 K: q = 0,250 × 4184 × 20 = 20,9 kJ.</div>`)
        },
        {
          title: L('Hess’s Law and Bond Energy', 'Định luật Hess và năng lượng liên kết'),
          duration: 9,
          body: L(`
<h3>State functions do not care about the route</h3>
<p>Enthalpy is a state function: if a reaction can be written as a sum of steps, ΔH for the whole equals the sum of the ΔH values, with sign flipped when a step is reversed.</p>
<div class="example">C + ½O₂ → CO, ΔH = −110.5 kJ; CO + ½O₂ → CO₂, ΔH = −283.0 kJ. Add them: C + O₂ → CO₂, ΔH = −393.5 kJ.</div>
<p>Alternatively estimate from bonds: break reactant bonds (energy in), form product bonds (energy out).</p>
<div class="formula">ΔH ≈ Σ E(bonds broken) − Σ E(bonds formed)</div>
<p>Combustion is exothermic because the C=O and O–H bonds formed are stronger than the bonds broken.</p>`, `
<h3>Hàm trạng thái không phụ thuộc con đường</h3>
<p>Enthalpy là hàm trạng thái: nếu phản ứng viết được thành tổng các bước, ΔH toàn bộ bằng tổng các ΔH, đảo dấu khi đảo chiều một bước.</p>
<div class="example">C + ½O₂ → CO, ΔH = −110,5 kJ; CO + ½O₂ → CO₂, ΔH = −283,0 kJ. Cộng lại: C + O₂ → CO₂, ΔH = −393,5 kJ.</div>
<p>Hoặc ước lượng từ liên kết: phá liên kết chất đầu (thu năng lượng), tạo liên kết sản phẩm (tỏa năng lượng).</p>
<div class="formula">ΔH ≈ Σ E(liên kết phá) − Σ E(liên kết tạo)</div>
<p>Phản ứng cháy tỏa nhiệt vì liên kết C=O và O–H tạo ra mạnh hơn liên kết bị phá.</p>`)
        },
        {
          title: L('Entropy and Spontaneity', 'Entropy và tính tự diễn biến'),
          duration: 10,
          body: L(`
<h3>Why some exothermic reactions never happen</h3>
<p>Entropy S measures how widely energy is dispersed over accessible microstates. It rises when solids melt, liquids vaporise, or molecule count grows.</p>
<div class="formula">ΔG = ΔH − TΔS&nbsp;&nbsp;&nbsp;ΔG &lt; 0 spontaneous, ΔG &gt; 0 non-spontaneous, ΔG = 0 equilibrium</div>
<div class="example">Ice melts above 0 °C although melting is endothermic: at high T the TΔS term wins.</div>
<p>Four sign combinations follow: (−,+) always spontaneous; (+,−) never; (−,−) spontaneous at low T; (+,+) spontaneous at high T. Temperature is the referee.</p>`, `
<h3>Vì sao một số phản ứng tỏa nhiệt không xảy ra</h3>
<p>Entropy S đo mức năng lượng phân tán trên các trạng thái vi mô. S tăng khi rắn nóng chảy, lỏng bay hơi hoặc số phân tử tăng.</p>
<div class="formula">ΔG = ΔH − TΔS&nbsp;&nbsp;&nbsp;ΔG &lt; 0 tự diễn biến, ΔG &gt; 0 không tự, ΔG = 0 cân bằng</div>
<div class="example">Đá tan trên 0 °C dù quá trình thu nhiệt: ở nhiệt độ cao, số hạng TΔS thắng.</div>
<p>Bốn tổ hợp dấu: (−,+) luôn tự diễn biến; (+,−) không bao giờ; (−,−) tự diễn biến khi lạnh; (+,+) tự diễn biến khi nóng. Nhiệt độ là trọng tài.</p>`)
        }
      ],
      quiz: [
        {
          q: L('Melting 100 g ice needs q with c = 4184 J/(kg·K), ΔT = 20 K for the water. q is about:',
               'Nung 100 g nước đá (đã tan) với c = 4184 J/(kg·K), ΔT = 20 K. q xấp xỉ:'),
          opts: [L('8.4 kJ', '8,4 kJ'), L('837 kJ', '837 kJ'), L('84 kJ', '84 kJ'), L('0.84 kJ', '0,84 kJ')],
          a: 0,
          ex: L('q = 0.1 × 4184 × 20 = 8368 J.', 'q = 0,1 × 4184 × 20 = 8368 J.')
        },
        {
          q: L('A reaction has ΔH &gt; 0 and ΔS &gt; 0. It is spontaneous:',
               'Phản ứng có ΔH &gt; 0 và ΔS &gt; 0. Tự diễn biến:'),
          opts: [L('At low temperature', 'Ở nhiệt độ thấp'), L('At high temperature', 'Ở nhiệt độ cao'),
                 L('Always', 'Luôn luôn'), L('Never', 'Không bao giờ')],
          a: 1,
          ex: L('ΔG = ΔH − TΔS only turns negative once TΔS exceeds ΔH.',
                'ΔG = ΔH − TΔS chỉ âm khi TΔS vượt ΔH.')
        },
        {
          q: L('If step 1 is ΔH = −200 kJ and step 2 is ΔH = +50 kJ, the overall ΔH is:',
               'Bước 1 có ΔH = −200 kJ, bước 2 có ΔH = +50 kJ. Tổng ΔH là:'),
          opts: [L('−250 kJ', '−250 kJ'), L('−150 kJ', '−150 kJ'), L('+150 kJ', '+150 kJ'), L('−100 kJ', '−100 kJ')],
          a: 1,
          ex: L('Hess’s law: add the steps, −200 + 50 = −150 kJ.',
                'Định luật Hess: cộng các bước, −200 + 50 = −150 kJ.')
        }
      ]
    },

    kinetics: {
      color: '#ab47bc',
      sim: 'reaction-rate',
      lessons: [
        {
          title: L('Rate Laws and Collision Theory', 'Tốc độ phản ứng và thuyết va chạm'),
          duration: 10,
          body: L(`
<h3>How fast, and why</h3>
<p>Reaction rate is the change in concentration per unit time. Rates come from molecular collisions that carry enough energy and the right orientation.</p>
<div class="formula">v = k [A]^m [B]^n&nbsp;&nbsp;&nbsp;(orders m, n are measured, not read off the equation)</div>
<p>Overall order is m + n. Doubling [A] and watching the rate quadruple means second order in A.</p>
<ul>
<li>Higher concentration or pressure → more collisions per second.</li>
<li>Higher temperature → far more collisions above the activation energy.</li>
<li>Catalyst → a new pathway with lower activation energy; it is not consumed.</li>
</ul>`, `
<h3>Tốc độ và nguyên nhân</h3>
<p>Tốc độ phản ứng là biến thiên nồng độ theo thời gian. Tốc độ đến từ các va chạm đủ năng lượng và đúng hướng.</p>
<div class="formula">v = k [A]^m [B]^n&nbsp;&nbsp;&nbsp;(bậc m, n phải đo, không đọc từ phương trình)</div>
<p>Bậc tổng là m + n. Tăng [A] gấp đôi mà tốc độ tăng gấp bốn nghĩa là bậc hai theo A.</p>
<ul>
<li>Nồng độ hoặc áp suất cao hơn → nhiều va chạm hơn mỗi giây.</li>
<li>Nhiệt độ cao hơn →Nhiều va chạm vượt năng lượng hoạt hóa hơn hẳn.</li>
<li>Chất xúc tác → con đường mới với năng lượng hoạt hóa thấp hơn, không bị tiêu thụ.</li>
</ul>`)
        },
        {
          title: L('Activation Energy and the Arrhenius Equation', 'Năng lượng hoạt hóa và phương trình Arrhenius'),
          duration: 9,
          body: L(`
<h3>The barrier every reaction must cross</h3>
<p>Reactants must reach a high-energy transition state. The minimum energy required is the activation energy Ea.</p>
<div class="formula">k = A · e^(−Ea / RT)</div>
<p>A is the collision frequency and orientation factor. Because Ea appears in an exponent, a small temperature rise produces a large rate jump.</p>
<div class="example">Rule of thumb: near room temperature many reactions roughly double per 10 K.</div>
<div class="formula">ln(k₂/k₁) = (Ea / R) · (1/T₁ − 1/T₂)</div>
<p>Plot ln k against 1/T: the slope is −Ea/R, which is how Ea is measured.</p>`, `
<h3>Rào cản mọi phản ứng phải vượt</h3>
<p>Chất đầu phải đạt trạng thái chuyển tiếp năng lượng cao. Năng lượng tối thiểu cần thiết là năng lượng hoạt hóa Ea.</p>
<div class="formula">k = A · e^(−Ea / RT)</div>
<p>A là tần số va chạm và hệ số định hướng. Vì Ea nằm ở số mũ, tăng nhiệt độ nhỏ làm tốc độ nhảy vọt.</p>
<div class="example">Kinh nghiệm: gần nhiệt độ phòng, nhiều phản ứng tăng gấp đôi mỗi 10 K.</div>
<div class="formula">ln(k₂/k₁) = (Ea / R) · (1/T₁ − 1/T₂)</div>
<p>Vẽ ln k theo 1/T: hệ số góc là −Ea/R, đây là cách đo Ea.</p>`)
        },
        {
          title: L('Equilibrium and Le Chatelier', 'Cân bằng và nguyên lý Le Chatelier'),
          duration: 11,
          body: L(`
<h3>Two opposite rates becoming equal</h3>
<p>In a closed vessel the forward and reverse reactions both run. When their rates match, concentrations stop changing: dynamic equilibrium.</p>
<div class="formula">Kc = [C]^c [D]^d / ([A]^a [B]^b)&nbsp;&nbsp;&nbsp;pure solids and liquids are omitted</div>
<p>K &gt;&gt; 1 favours products; K &lt;&lt; 1 favours reactants. A catalyst speeds both directions equally and never changes K.</p>
<p><b>Le Chatelier</b>: stress the system and it shifts to relieve it — more reactant pushes right, higher pressure favours fewer gas moles, heating favours the endothermic direction.</p>
<div class="example">Haber process N₂ + 3 H₂ ⇌ 2 NH₃: high pressure helps (4 gas moles → 2), but the reaction is exothermic, so temperature is a compromise between yield and rate.</div>`, `
<h3>Hai tốc độ ngược nhau trở nên bằng nhau</h3>
<p>Trong bình kín, phản ứng thuận và nghịch cùng chạy. Khi tốc độ bằng nhau, nồng độ không đổi: cân bằng động.</p>
<div class="formula">Kc = [C]^c [D]^d / ([A]^a [B]^b)&nbsp;&nbsp;&nbsp;bỏ qua rắn và lỏng nguyên chất</div>
<p>K &gt;&gt; 1 ngả về sản phẩm; K &lt;&lt; 1 ngả về chất đầu. Xúc tác tăng cả hai chiều như nhau và không đổi K.</p>
<p><b>Le Chatelier</b>: hệ chịu tác động sẽ dịch chuyển để chống lại tác động — thêm chất đầu dịch phải, tăng áp suất ngả về phía ít mol khí, tăng nhiệt ngả về chiều thu nhiệt.</p>
<div class="example">Tổng hợp amoniac N₂ + 3 H₂ ⇌ 2 NH₃: áp suất cao có lợi (4 mol khí → 2), nhưng phản ứng tỏa nhiệt nên nhiệt độ là thỏa hiệp giữa hiệu suất và tốc độ.</div>`)
        }
      ],
      quiz: [
        {
          q: L('Doubling [A] quadruples the rate. The order in A is:',
               'Tăng [A] gấp đôi làm tốc độ tăng gấp bốn. Bậc theo A là:'),
          opts: [L('0', '0'), L('1', '1'), L('2', '2'), L('3', '3')],
          a: 2,
          ex: L('Rate ∝ [A]² because 2² = 4.', 'Tốc độ ∝ [A]² vì 2² = 4.')
        },
        {
          q: L('A catalyst increases rate by:', 'Chất xúc tác tăng tốc độ bằng cách:'),
          opts: [L('Raising the temperature', 'Tăng nhiệt độ'),
                 L('Lowering the activation energy', 'Giảm năng lượng hoạt hóa'),
                 L('Consuming a reactant', 'Tiêu thụ chất đầu'),
                 L('Changing Kc', 'Thay đổi Kc')],
          a: 1,
          ex: L('It opens a lower-energy pathway and is regenerated.',
                'Nó mở con đường năng lượng thấp hơn và được tái sinh.')
        },
        {
          q: L('For N₂ + 3H₂ ⇌ 2NH₃, increasing pressure shifts the equilibrium:',
               'Với N₂ + 3H₂ ⇌ 2NH₃, tăng áp suất làm cân bằng dịch:'),
          opts: [L('Left', 'Trái'), L('Right', 'Phải'), L('No shift', 'Không dịch'), L('Stops the reaction', 'Dừng phản ứng')],
          a: 1,
          ex: L('Fewer gas moles on the right (2 vs 4) relieves the pressure.',
                'Phía phải ít mol khí hơn (2 so với 4) nên giảm áp suất.')
        }
      ]
    },

    solutions: {
      color: '#26c6da',
      sim: 'solution-prep',
      lessons: [
        {
          title: L('Concentration Units', 'Đơn vị nồng độ'),
          duration: 9,
          body: L(`
<h3>How much solute, in how much solvent</h3>
<p>"Like dissolves like": polar solutes dissolve in polar solvents because solvent–solute attractions repay the energy needed to separate the particles.</p>
<div class="formula">Molarity M = mol solute / L solution&nbsp;&nbsp;&nbsp;molality m = mol / kg solvent</div>
<ul>
<li>Molarity changes with temperature (the volume expands); molality does not.</li>
<li>Dilution always conserves moles: <b>M₁V₁ = M₂V₂</b>.</li>
<li>ppm ≈ mg solute per litre of dilute water solution.</li>
</ul>
<div class="example">To make 250 mL of 0.200 M NaCl: 0.250 × 0.200 = 0.0500 mol = 2.92 g.</div>`, `
<h3>Bao nhiêu chất tan, trong bao nhiêu dung môi</h3>
<p>"Tan trong chất tan giống nhau": chất phân cực tan trong dung môi phân cực vì lực hút dung môi–chất tan bù lại năng lượng tách các hạt.</p>
<div class="formula">Nồng độ mol M = số mol / thể tích dung dịch (L)&nbsp;&nbsp;&nbsp;nồng độ molan m = mol / kg dung môi</div>
<ul>
<li>M thay đổi theo nhiệt độ (thể tích giãn nở); molan thì không.</li>
<li>Pha loãng luôn bảo toàn số mol: <b>M₁V₁ = M₂V₂</b>.</li>
<li>ppm ≈ mg chất tan trên lít dung dịch loãng.</li>
</ul>
<div class="example">Pha 250 mL NaCl 0,200 M: 0,250 × 0,200 = 0,0500 mol = 2,92 g.</div>`)
        },
        {
          title: L('Solubility and Colligative Properties', 'Độ tan và tính chất colligative'),
          duration: 10,
          body: L(`
<h3>Counting particles, not identity</h3>
<p>Solute particles change vapour pressure, boiling point, freezing point and osmotic pressure in proportion to their number, regardless of what they are.</p>
<div class="formula">ΔTb = i·Kb·m&nbsp;&nbsp;&nbsp;ΔTf = i·Kf·m&nbsp;&nbsp;&nbsp;π = i·M·R·T</div>
<p>i is the van ’t Hoff factor — the number of particles each formula unit gives. NaCl ideally gives i = 2, CaCl₂ gives 3, glucose stays 1.</p>
<div class="example">Salt on icy roads works because ΔTf pushes the freezing point below 0 °C.</div>
<p>Gases become less soluble as temperature rises; solids usually more. Pressure raises gas solubility (Henry’s law) but hardly affects solids.</p>`, `
<h3>Đếm hạt, không đếm danh tính</h3>
<p>Hạt chất tan làm thay đổi áp suất hơi, nhiệt độ sôi, nhiệt độ đông đặc và áp suất thẩm thấu theo số lượng, bất kể bản chất.</p>
<div class="formula">ΔTb = i·Kb·m&nbsp;&nbsp;&nbsp;ΔTf = i·Kf·m&nbsp;&nbsp;&nbsp;π = i·M·R·T</div>
<p>i là hệ số van ’t Hoff — số hạt mỗi đơn vị công thức tạo ra. NaCl lý tưởng i = 2, CaCl₂ bằng 3, glucose bằng 1.</p>
<div class="example">Rắc muối lên đường đóng băng vì ΔTf hạ điểm đông dưới 0 °C.</div>
<p>Khí kém tan hơn khi nhiệt độ tăng; rắn thường tan nhiều hơn. Áp suất tăng độ tan của khí (định luật Henry) nhưng gần như không ảnh hưởng rắn.</p>`)
        }
      ],
      quiz: [
        {
          q: L('Diluting 50 mL of 2.0 M to 250 mL gives:', 'Pha loãng 50 mL dung dịch 2,0 M thành 250 mL thu được:'),
          opts: [L('0.4 M', '0,4 M'), L('2.0 M', '2,0 M'), L('10 M', '10 M'), L('0.1 M', '0,1 M')],
          a: 0,
          ex: L('M₂ = 2.0 × 50 / 250 = 0.4 M.', 'M₂ = 2,0 × 50 / 250 = 0,4 M.')
        },
        {
          q: L('Which has the lowest freezing point at equal molality?',
               'Ở cùng molan, chất nào đông đặc thấp nhất?'),
          opts: [L('Glucose', 'Glucose'), L('NaCl', 'NaCl'), L('CaCl₂', 'CaCl₂'), L('All equal', 'Như nhau')],
          a: 2,
          ex: L('CaCl₂ gives 3 particles, the largest ΔTf.', 'CaCl₂ cho 3 hạt, ΔTf lớn nhất.')
        },
        {
          q: L('Molarity differs from molality because molarity uses:',
               'Khác giữa M và molan: nồng độ mol dùng:'),
          opts: [L('kg of solvent', 'kg dung môi'), L('L of solution', 'L dung dịch'),
                 L('g of solute only', 'g chất tan'), L('temperature only', 'nhiệt độ')],
          a: 1,
          ex: L('Volume expands with temperature, so molarity does too.',
                'Thể tích giãn theo nhiệt độ nên M cũng thay đổi.')
        }
      ]
    },

    "acid-base": {
      color: '#ef5350',
      sim: 'ph-calc',
      lessons: [
        {
          title: L('pH, Kw and Strength', 'pH, Kw và độ mạnh'),
          duration: 9,
          body: L(`
<h3>The logarithmic scale</h3>
<p>Water auto-ionises: 2 H₂O ⇌ H₃O⁺ + OH⁻, with Kw = [H₃O⁺][OH⁻] = 1.0×10⁻¹⁴ at 25 °C.</p>
<div class="formula">pH = −log[H₃O⁺]&nbsp;&nbsp;&nbsp;pOH = −log[OH⁻]&nbsp;&nbsp;&nbsp;pH + pOH = 14</div>
<p>A <b>strong</b> acid dissociates completely, so [H⁺] equals its analytical concentration. A <b>weak</b> acid dissociates partly and needs Ka.</p>
<div class="example">0.010 M HCl gives pH 2.00. 0.010 M CH₃COOH with Ka = 1.8×10⁻⁵ gives [H⁺] = √(Ka·C) ≈ 4.2×10⁻⁴, pH 3.37.</div>`, `
<h3>Thang logarithmic</h3>
<p>Nước tự ion hóa: 2 H₂O ⇌ H₃O⁺ + OH⁻, với Kw = [H₃O⁺][OH⁻] = 1,0×10⁻¹⁴ ở 25 °C.</p>
<div class="formula">pH = −log[H₃O⁺]&nbsp;&nbsp;&nbsp;pOH = −log[OH⁻]&nbsp;&nbsp;&nbsp;pH + pOH = 14</div>
<p>Axit <b>mạnh</b> phân ly hoàn toàn nên [H⁺] bằng nồng độ phân tích. Axit <b>yếu</b> phân ly một phần, cần Ka.</p>
<div class="example">HCl 0,010 M cho pH 2,00. CH₃COOH 0,010 M với Ka = 1,8×10⁻⁵ cho [H⁺] = √(Ka·C) ≈ 4,2×10⁻⁴, pH 3,37.</div>`)
        },
        {
          title: L('Equilibria of Weak Acids', 'Cân bằng của axit yếu'),
          duration: 10,
          body: L(`
<h3>Ka, Kb and the ICE table</h3>
<p>Write Initial, Change, Equilibrium concentrations and substitute into the equilibrium expression.</p>
<div class="formula">Ka = [H⁺][A⁻] / [HA]&nbsp;&nbsp;&nbsp;Ka · Kb = Kw for a conjugate pair</div>
<p>Smaller pKa means a stronger acid. A weak acid’s conjugate base is weakly basic, which is why sodium acetate solutions are slightly alkaline.</p>
<div class="example">Ethanoic acid pKa = 4.76, so at pH 4.76 exactly half of it is deprotonated.</div>
<p><b>Buffers</b> resist pH change because a weak acid and its conjugate base are both present. Henderson–Hasselbalch:</p>
<div class="formula">pH = pKa + log([A⁻]/[HA])</div>`, `
<h3>Ka, Kb và bảng ICE</h3>
<p>Viết nồng độ ban đầu, biến thiên và cân bằng rồi thế vào biểu thức cân bằng.</p>
<div class="formula">Ka = [H⁺][A⁻] / [HA]&nbsp;&nbsp;&nbsp;Ka · Kb = Kw cho một cặp liên hợp</div>
<p>pKa nhỏ hơn nghĩa là axit mạnh hơn. Base liên hợp của axit yếu là base yếu, nên dung dịch natri acetat hơi kiềm.</p>
<div class="example">Axit ethanoic pKa = 4,76, tại pH 4,76 đúng một nửa lượng axit đã cho proton.</div>
<p><b>Dung dịch đệm</b> chống đổi pH vì có mặt cả axit yếu và base liên hợp. Henderson–Hasselbalch:</p>
<div class="formula">pH = pKa + log([A⁻]/[HA])</div>`)
        },
        {
          title: L('Neutralisation and Titrations', 'Trung hòa và chuẩn độ'),
          duration: 9,
          body: L(`
<h3>Counting to the equivalence point</h3>
<p>Acid + base → salt + water. At equivalence, moles of H⁺ delivered equal moles of OH⁻ delivered.</p>
<div class="formula">n(H⁺) = n(OH⁻)&nbsp;&nbsp;&nbsp;C_a V_a = C_b V_b (1:1 stoichiometry)</div>
<p>Strong–strong titrations end at pH 7. Weak–strong end above 7 because the conjugate base hydrolyses. Choose the indicator so its colour-change range brackets the equivalence pH.</p>
<div class="example">25.00 mL of vinegar needs 31.5 mL of 0.100 M NaOH, so the acid content is 0.126 M.</div>`, `
<h3>Đếm tới điểm tương đương</h3>
<p>Axit + base → muối + nước. Tại điểm tương đương, số mol H⁺ bằng số mol OH⁻.</p>
<div class="formula">n(H⁺) = n(OH⁻)&nbsp;&nbsp;&nbsp;C_a V_a = C_b V_b (tỉ lệ 1:1)</div>
<p>Chuẩn độ mạnh–mạnh kết thúc ở pH 7. Yếu–mạnh kết thúc trên 7 vì base liên hợp thủy phân. Chọn chỉ thị có khoảng đổi màu bao quanh pH tương đương.</p>
<div class="example">25,00 mL giấm cần 31,5 mL NaOH 0,100 M, nên nồng độ axit là 0,126 M.</div>`)
        }
      ],
      quiz: [
        {
          q: L('What is the pH of 0.001 M HCl?', 'pH của HCl 0,001 M là bao nhiêu?'),
          opts: [L('1', '1'), L('3', '3'), L('7', '7'), L('11', '11')],
          a: 1,
          ex: L('Strong acid, [H⁺] = 10⁻³, so pH = 3.', 'Axit mạnh, [H⁺] = 10⁻³ nên pH = 3.')
        },
        {
          q: L('A solution has pH = pKa of its acid. Then:', 'Dung dịch có pH = pKa của axit. Khi đó:'),
          opts: [L('[A⁻] = [HA]', '[A⁻] = [HA]'), L('all acid is HA', 'toàn bộ là HA'),
                 L('all acid is A⁻', 'toàn bộ là A⁻'), L('pH = 0', 'pH = 0')],
          a: 0,
          ex: L('log([A⁻]/[HA]) = 0 only when the ratio is 1.',
                'log([A⁻]/[HA]) = 0 chỉ khi tỉ lệ bằng 1.')
        },
        {
          q: L('The salt of a weak acid and strong base in water is:',
               'Muối của axit yếu và bazơ mạnh trong nước có tính:'),
          opts: [L('acidic', 'axit'), L('neutral', 'trung tính'), L('basic', 'bazơ'), L('amphoteric only', 'lưỡng tính')],
          a: 2,
          ex: L('The conjugate base hydrolyses to produce OH⁻.',
                'Base liên hợp thủy phân sinh ra OH⁻.')
        }
      ]
    }
  };

  // ---------- Topics 8–13 ----------
  Object.assign(LESSONS, {

    electro: {
      color: '#5c6bc0',
      sim: 'galvanic-cell',
      lessons: [
        {
          title: L('Oxidation States and Redox', 'Số oxi hóa và phản ứng oxi hóa–khử'),
          duration: 9,
          body: L(`
<h3>Electron bookkeeping</h3>
<p>Oxidation is loss of electrons, reduction is gain. The mnemonic OIL-GIR holds: Oxidation Is Loss, Reduction Is Gain.</p>
<ul>
<li>Free elements have oxidation state 0.</li>
<li>O is −2 (peroxides −1, with F positive); H is +1 with non-metals, −1 in metal hydrides.</li>
<li>Sum of oxidation states equals the charge on the species.</li>
</ul>
<div class="example">In MnO₄⁻: 4(−2) = −8, total −1, so Mn = +7.</div>
<p>The species that is oxidised is the <b>reducing agent</b>; the one reduced is the <b>oxidising agent</b>. Electrons lost always equal electrons gained — balance redox by matching those counts.</p>`, `
<h3>Sổ sách electron</h3>
<p>Oxi hóa là mất electron, khử là nhận electron.</p>
<ul>
<li>Đơn chất có số oxi hóa 0.</li>
<li>O là −2 (peoxit −1, khi ở với F thì dương); H là +1 với phi kim, −1 trong hydride kim loại.</li>
<li>Tổng số oxi hóa bằng điện tích của tiểu phân.</li>
</ul>
<div class="example">Trong MnO₄⁻: 4(−2) = −8, tổng −1, nên Mn = +7.</div>
<p>Chất bị oxi hóa là <b>chất khử</b>; chất bị khử là <b>chất oxi hóa</b>. Electron mất luôn bằng electron nhận — cân bằng phản ứng oxi hóa–khử theo số electron.</p>`)
        },
        {
          title: L('Standard Electrode Potentials', 'Thế điện cực chuẩn'),
          duration: 11,
          body: L(`
<h3>Measuring the urge to take electrons</h3>
<p>Each half-cell has a reduction potential measured against the standard hydrogen electrode, defined as 0.00 V. Values are intensive: doubling the coefficient does not change E°.</p>
<div class="formula">E°cell = E°(cathode, reduced) − E°(anode, oxidised)</div>
<div class="example">Zn|Zn²⁺ (−0.76 V) and Cu|Cu²⁺ (+0.34 V): E°cell = 0.34 − (−0.76) = 1.10 V. Zinc is the anode and dissolves.</div>
<p>Positive E°cell means a spontaneous cell. Couple it to free energy:</p>
<div class="formula">ΔG° = −nFE°cell&nbsp;&nbsp;&nbsp;E°cell = (RT/nF)·ln K</div>
<p>F = 96485 C/mol is Faraday’s constant and n the moles of electrons transferred.</p>`, `
<h3>Đo xu hướng nhận electron</h3>
<p>Mỗi nửa pin có thế khử đo so với điện cực hydro chuẩn, quy ước là 0,00 V. Giá trị là đại lượng cường độ: nhân đôi hệ số không làm đổi E°.</p>
<div class="formula">E°pin = E°(catot, bị khử) − E°(anot, bị oxi hóa)</div>
<div class="example">Zn|Zn²⁺ (−0,76 V) và Cu|Cu²⁺ (+0,34 V): E°pin = 0,34 − (−0,76) = 1,10 V. Kẽm là anot và tan ra.</div>
<p>E°pin dương nghĩa là pin tự diễn biến. Hệ thức với năng lượng tự do:</p>
<div class="formula">ΔG° = −nFE°pin&nbsp;&nbsp;&nbsp;E°pin = (RT/nF)·ln K</div>
<p>F = 96485 C/mol là hằng số Faraday, n là số mol electron trao đổi.</p>`)
        },
        {
          title: L('Electrolysis and the Nernst Equation', 'Điện phân và phương trình Nernst'),
          duration: 10,
          body: L(`
<h3>Forcing the non-spontaneous, and real cells</h3>
<p>An electrolytic cell runs a cell backward: electrical work drives a reaction with negative E°. Molten NaCl gives sodium at the cathode and chlorine at the anode; aqueous NaCl gives hydrogen and chlorine because water is easier to reduce than Na⁺.</p>
<p>Concentration changes shift potentials. The Nernst equation quantifies it at 25 °C:</p>
<div class="formula">E = E° − (0.0592 / n) · log Q</div>
<div class="example">A Zn–Cu cell with [Cu²⁺] ten times [Zn²⁺] gains 0.0296 V over the standard value.</div>
<p>As a battery discharges, Q grows, E falls, and E = 0 exactly when the cell reaches equilibrium — a flat battery is an equilibrated one.</p>`, `
<h3>Ép phản ứng không tự diễn biến, và pin thực</h3>
<p>Pin điện phân chạy ngược pin: công điện kéo phản ứng có E° âm. NaCl nóng chảy cho natri ở catot và clo ở anot; NaCl trong nước cho hydro và clo vì nước dễ khử hơn Na⁺.</p>
<p>Nồng độ thay đổi làm thế dịch chuyển. Phương trình Nernst ở 25 °C:</p>
<div class="formula">E = E° − (0,0592 / n) · log Q</div>
<div class="example">Pin Zn–Cu với [Cu²⁺] gấp mười [Zn²⁺] tăng 0,0296 V so với giá trị chuẩn.</div>
<p>Khi pin phóng điện, Q tăng, E giảm, và E = 0 đúng lúc pin đạt cân bằng — pin hết là pin đã cân bằng.</p>`)
        }
      ],
      quiz: [
        {
          q: L('In a galvanic cell, oxidation always occurs at the:',
               'Trong pin điện hóa, oxi hóa luôn xảy ra ở:'),
          opts: [L('Cathode', 'Catot'), L('Anode', 'Anot'), L('Salt bridge', 'Cầu muối'), L('Wire', 'Dây dẫn')],
          a: 1,
          ex: L('Anode = where oxidation happens, in every electrochemical cell.',
                'Anot là nơi xảy ra oxi hóa, trong mọi pin điện hóa.')
        },
        {
          q: L('E° = −0.76 V for Zn²⁺/Zn and +0.34 V for Cu²⁺/Cu. E°cell is:',
               'E° = −0,76 V cho Zn²⁺/Zn và +0,34 V cho Cu²⁺/Cu. E°pin là:'),
          opts: [L('−1.10 V', '−1,10 V'), L('+1.10 V', '+1,10 V'), L('−0.42 V', '−0,42 V'), L('+0.42 V', '+0,42 V')],
          a: 1,
          ex: L('0.34 − (−0.76) = 1.10 V, spontaneous.', '0,34 − (−0,76) = 1,10 V, tự diễn biến.')
        },
        {
          q: L('The oxidation state of chromium in Cr₂O₇²⁻ is:',
               'Số oxi hóa của crom trong Cr₂O₇²⁻ là:'),
          opts: [L('+3', '+3'), L('+6', '+6'), L('+7', '+7'), L('+2', '+2')],
          a: 1,
          ex: L('7(−2) = −14; total −2, so 2 Cr = +12, each +6.',
                '7(−2) = −14; tổng −2 nên 2 Cr = +12, mỗi Cr +6.')
        }
      ]
    },

    organic: {
      color: '#66bb6a',
      sim: 'functional-groups',
      lessons: [
        {
          title: L('Carbon Scaffolds and Nomenclature', 'Khung cacbon và danh pháp'),
          duration: 10,
          body: L(`
<h3>Four bonds, endless skeletons</h3>
<p>Carbon forms four covalent bonds and chains with itself, giving an enormous family of compounds. Naming follows IUPAC: find the longest chain, number from the end nearest the first substituent, then list groups alphabetically with locants.</p>
<div class="example">CH₃–CH(CH₃)–CH₂–CH₃ is 2-methylbutane, not 3-methylbutane.</div>
<ul>
<li><b>Alkanes</b> CₙH₂ₙ₊₂ — only single bonds, sp³, tetrahedral.</li>
<li><b>Alkenes</b> CₙH₂ₙ — one C=C, sp², planar, allow cis/trans isomerism.</li>
<li><b>Alkynes</b> CₙH₂ₙ₋₂ — one C≡C, sp, linear.</li>
<li><b>Aromatics</b> — cyclic, planar, conjugated with 4n+2 π electrons; benzene is the prototype.</li>
</ul>`, `
<h3>Bốn liên kết, vô hạn khung</h3>
<p>Cacbon tạo bốn liên kết cộng hóa trị và chuỗi với chính nó, sinh ra họ hợp chất khổng lồ. Danh pháp IUPAC: tìm mạch dài nhất, đánh số từ đầu gần nhóm thế đầu tiên, kể các nhóm theo thứ tự alphabet kèm vị trí.</p>
<div class="example">CH₃–CH(CH₃)–CH₂–CH₃ là 2-methylbutan, không phải 3-methylbutan.</div>
<ul>
<li><b>Alkan</b> CₙH₂ₙ₊₂ — chỉ liên kết đơn, sp³, tứ diện.</li>
<li><b>Alken</b> CₙH₂ₙ — một C=C, sp², phẳng, có đồng phân cis/trans.</li>
<li><b>Alkin</b> CₙH₂ₙ₋₂ — một C≡C, sp, thẳng.</li>
<li><b>Aromatic</b> — vòng, phẳng, liên hợp với 4n+2 electron π; benzen là nguyên mẫu.</li>
</ul>`)
        },
        {
          title: L('Functional Groups', 'Nhóm chức'),
          duration: 11,
          body: L(`
<p>A functional group fixes the chemistry of whatever molecule carries it.</p>
<ul>
<li><b>Alcohol</b> –OH: polar, hydrogen-bonds, weak acid, oxidises to carbonyls.</li>
<li><b>Aldehyde</b> –CHO and <b>ketone</b> C=O: carbonyl chemistry, nucleophilic addition.</li>
<li><b>Carboxylic acid</b> –COOH: genuinely acidic (pKa ≈ 4–5), forms esters.</li>
<li><b>Ester</b> –COO–: fruity smells, hydrolyses back to acid plus alcohol.</li>
<li><b>Amine</b> –NH₂: basic, smells fishy, key in amino acids.</li>
<li><b>Halogenoalkane</b> C–X: site of substitution and elimination.</li>
</ul>
<div class="example">Ethanol (M = 46) boils at 78 °C while propanal (M = 58) boils at 49 °C: the –OH group hydrogen-bonds, the C=O cannot donate.</div>`, `
<p>Nhóm chức quyết định tính chất của mọi phân tử mang nó.</p>
<ul>
<li><b>Rượu</b> –OH: phân cực, tạo liên kết hydro, axit yếu, oxi hóa thành carbonyl.</li>
<li><b>Andehit</b> –CHO và <b>xeton</b> C=O: hóa học carbonyl, cộng nucleophin.</li>
<li><b>Axit cacboxylic</b> –COOH: axit thật sự (pKa ≈ 4–5), tạo este.</li>
<li><b>Este</b> –COO–: mùi quả, thủy phân trở lại axit và rượu.</li>
<li><b>Amin</b> –NH₂: bazơ, mùi tanh, có trong amino acid.</li>
<li><b>Dẫn xuất halogen</b> C–X: vị trí thế và tách.</li>
</ul>
<div class="example">Ethanol (M = 46) sôi 78 °C còn propanal (M = 58) sôi 49 °C: nhóm –OH tạo liên kết hydro, C=O không cho được.</div>`)
        },
        {
          title: L('Isomerism and Reaction Mechanisms', 'Đồng phân và cơ chế phản ứng'),
          duration: 10,
          body: L(`
<h3>Same atoms, different molecules</h3>
<p>Isomers share a molecular formula but differ in connectivity or arrangement, and they are different substances with different properties.</p>
<ul>
<li><b>Structural</b>: chain, position and functional-group isomers.</li>
<li><b>Stereo</b>: cis/trans (E/Z) across double bonds; optical isomers that are non-superimposable mirror images, like hands.</li>
</ul>
<div class="example">C₄H₁₀ has two structural isomers: butane and 2-methylpropane.</div>
<p>Organic reactions are drawn with curly arrows showing where an electron pair moves. Substitution replaces (CH₄ + Cl₂ → CH₃Cl + HCl under UV), elimination removes to make a double bond, addition breaks one.</p>
<p>Alkenes decolourise bromine water by electrophilic addition; alkanes do not — a classic test.</p>`, `
<h3>Cùng nguyên tử, khác phân tử</h3>
<p>Đồng phân có cùng công thức phân tử nhưng khác cách nối hoặc sắp xếp, và là những chất khác nhau với tính chất khác nhau.</p>
<ul>
<li><b>Cấu tạo</b>: mạch, vị trí và nhóm chức.</li>
<li><b>Lập thể</b>: cis/trans (E/Z) quanh nối đôi; đồng phân quang học là ảnh gương không chồng khít như hai bàn tay.</li>
</ul>
<div class="example">C₄H₁₀ có hai đồng phân cấu tạo: butan và 2-methylpropan.</div>
<p>Cơ chế hữu cơ vẽ bằng mũi cong chỉ chiều dịch chuyển cặp electron. Thế (CH₄ + Cl₂ → CH₃Cl + HCl dưới ánh sáng), tách tạo nối đôi, cộng phá nối đôi.</p>
<p>Alken làm mất màu nước brom theo cơ chế cộng electrophin; alkan thì không — phép thử kinh điển.</p>`)
        }
      ],
      quiz: [
        {
          q: L('The general formula of a non-cyclic alkene with one double bond is:',
               'Công thức chung của anken mạch hở có một nối đôi:'),
          opts: [L('CₙH₂ₙ₊₂', 'CₙH₂ₙ₊₂'), L('CₙH₂ₙ', 'CₙH₂ₙ'), L('CₙH₂ₙ₋₂', 'CₙH₂ₙ₋₂'), L('CₙHₙ', 'CₙHₙ')],
          a: 1,
          ex: L('One double bond removes two hydrogens from the alkane formula.',
                'Một nối đôi bớt hai hydro so với ankan.')
        },
        {
          q: L('Which functional group makes a compound a carboxylic acid?',
               'Nhóm chức nào khiến hợp chất là axit cacboxylic?'),
          opts: [L('–OH', '–OH'), L('–COOH', '–COOH'), L('–CHO', '–CHO'), L('–NH₂', '–NH₂')],
          a: 1,
          ex: L('The carboxyl group –COOH defines the family.',
                'Nhóm carboxyl –COOH định nghĩa cả họ hợp chất.')
        },
        {
          q: L('Two compounds with the same formula but mirror-image 3D shapes are:',
               'Hai hợp chất cùng công thức nhưng hình 3D đối gương là:'),
          opts: [L('Structural isomers', 'Đồng phân cấu tạo'), L('Optical isomers', 'Đồng phân quang học'),
                 L('Isotopes', 'Đồng vị'), L('Allotropes', 'Dạng thù hình')],
          a: 1,
          ex: L('Non-superimposable mirror images are enantiomers.',
                'Ảnh gương không chồng khít là đối quang.')
        }
      ]
    },

    nuclear: {
      color: '#fdd835',
      sim: 'radioactive-decay',
      lessons: [
        {
          title: L('Radioactive Decay Modes', 'Các kiểu phân rã phóng xạ'),
          duration: 10,
          body: L(`
<h3>Unstable nuclei shed particles</h3>
<p>Beyond lead (Z &gt; 82) no nucleus is stable. Nuclei with too many neutrons, too few, or too much mass decay by characteristic routes.</p>
<ul>
<li><b>Alpha (α)</b>: emits ⁴He nucleus. A drops by 4, Z by 2. Stopped by paper, dangerous when inhaled.</li>
<li><b>Beta-minus (β⁻)</b>: a neutron becomes a proton plus an electron. Z rises by 1, A unchanged.</li>
<li><b>Beta-plus (β⁺)</b>: a proton becomes a neutron plus a positron; used in PET scans.</li>
<li><b>Gamma (γ)</b>: an excited nucleus releases a photon. Neither A nor Z changes; very penetrating.</li>
</ul>
<div class="formula">²³⁸U → ²³⁴Th + ⁴He&nbsp;&nbsp;&nbsp;¹⁴C → ¹⁴N + e⁻</div>
<p>Both mass number and atomic number balance in every nuclear equation — that is how you predict the daughter.</p>`, `
<h3>Hạt nhân không bền giải phóng hạt</h3>
<p>Sau chì (Z &gt; 82) không có hạt nhân bền. Hạt nhân thừa neutron, thiếu neutron hoặc quá nặng phân rã theo các kiểu đặc trưng.</p>
<ul>
<li><b>Alpha (α)</b>: phát ra hạt ⁴He. A giảm 4, Z giảm 2. Giấy chặn được, nguy hiểm khi hít phải.</li>
<li><b>Beta trừ (β⁻)</b>: neutron biến thành proton và electron. Z tăng 1, A không đổi.</li>
<li><b>Beta cộng (β⁺)</b>: proton biến thành neutron và positron; dùng trong chụp PET.</li>
<li><b>Gamma (γ)</b>: hạt nhân kích thích phát photon. Không đổi A lẫn Z; xuyên rất sâu.</li>
</ul>
<div class="formula">²³⁸U → ²³⁴Th + ⁴He&nbsp;&nbsp;&nbsp;¹⁴C → ¹⁴N + e⁻</div>
<p>Mọi phương trình hạt nhân bảo toàn cả số khối lẫn điện tích — đó là cách dự đoán hạt nhân con.</p>`)
        },
        {
          title: L('Half-life and Kinetics of Decay', 'Chu kỳ bán rã và động học phân rã'),
          duration: 9,
          body: L(`
<h3>First-order, unstoppable</h3>
<p>Decay is a random process for one nucleus but perfectly statistical for many. The number left follows first-order kinetics with a constant half-life unaffected by temperature, pressure or chemistry.</p>
<div class="formula">N = N₀ (½)^(t / t½)&nbsp;&nbsp;&nbsp;λ = ln 2 / t½&nbsp;&nbsp;&nbsp;activity = λN</div>
<div class="example">Carbon-14 (t½ = 5730 yr): a sample with 25% of modern ¹⁴C is two half-lives old, about 11460 years.</div>
<p>Activity is measured in becquerel (one decay per second). Radiometric dating works because the parent isotope’s half-life is known and constant.</p>`, `
<h3>Bậc một, không thể ngăn</h3>
<p>Phân rã là ngẫu nhiên với một hạt nhân nhưng hoàn toàn thống kê với nhiều hạt nhân. Số còn lại tuân động học bậc một với chu kỳ bán rã không đổi, không phụ thuộc nhiệt độ, áp suất hay hóa học.</p>
<div class="formula">N = N₀ (½)^(t / t½)&nbsp;&nbsp;&nbsp;λ = ln 2 / t½&nbsp;&nbsp;&nbsp;hoạt độ = λN</div>
<div class="example">Carbon-14 (t½ = 5730 năm): mẫu còn 25% ¹⁴C hiện đại nghĩa là hai chu kỳ, khoảng 11460 năm.</div>
<p>Hoạt độ đo bằng becquerel (một phân rã mỗi giây). Phương pháp đồng vị phóng xạ hoạt động vì chu kỳ bán rã của đồng vị mẹ đã biết và không đổi.</p>`)
        },
        {
          title: L('Fission, Fusion and Binding Energy', 'Phân hạch, nhiệt hạch và năng lượng liên kết'),
          duration: 10,
          body: L(`
<h3>Why iron is the summit</h3>
<p>Nuclear binding energy per nucleon peaks near iron-56. Heavy nuclei gain stability by splitting; light nuclei gain it by merging. Both moves release energy.</p>
<div class="formula">E = Δm · c²&nbsp;&nbsp;&nbsp;(Δm = mass defect)</div>
<div class="example">²³⁵U + n → ¹⁴¹Ba + ⁹²Kr + 3 n releases about 200 MeV and sustains a chain reaction.</div>
<p>Fusion powers stars: ²H + ³H → ⁴He + n releases 17.6 MeV, but needs enormous temperature to overcome Coulomb repulsion. Fusion per kilogram of fuel outperforms fission by an order of magnitude and leaves no long-lived waste.</p>`, `
<h3>Vì sao sắt là đỉnh</h3>
<p>Năng lượng liên kết theo nucleon đạt cực đại gần sắt-56. Hạt nhân nặng tách ra để bền hơn; hạt nhân nhẹ kết hợp để bền hơn. Cả hai đều tỏa năng lượng.</p>
<div class="formula">E = Δm · c²&nbsp;&nbsp;&nbsp;(Δm = độ hụt khối)</div>
<div class="example">²³⁵U + n → ¹⁴¹Ba + ⁹²Kr + 3 n giải phóng khoảng 200 MeV và duy trì phản ứng dây chuyền.</div>
<p>Nhiệt hạch cung cấp năng lượng cho sao: ²H + ³H → ⁴He + n tỏa 17,6 MeV, nhưng cần nhiệt độ khổng lồ để thắng lực đẩy Coulomb. Tính theo kilogam nhiên liệu, nhiệt hạch hơn phân hạch khoảng một bậc và không để lại rác phóng xạ lâu bền.</p>`)
        }
      ],
      quiz: [
        {
          q: L('²³⁸U emits an alpha particle. The daughter is:', '²³⁸U phát ra hạt alpha. Hạt nhân con là:'),
          opts: [L('²³⁴Th', '²³⁴Th'), L('²³⁸Np', '²³⁸Np'), L('²⁴²Pu', '²⁴²Pu'), L('²³⁴Pa', '²³⁴Pa')],
          a: 0,
          ex: L('A − 4 = 234, Z − 2 = 90, which is thorium.', 'A − 4 = 234, Z − 2 = 90 là thori.')
        },
        {
          q: L('After three half-lives, what fraction of a sample remains?',
               'Sau ba chu kỳ bán rã, mẫu còn lại bao nhiêu phần?'),
          opts: [L('1/2', '1/2'), L('1/4', '1/4'), L('1/8', '1/8'), L('1/16', '1/16')],
          a: 2,
          ex: L('(1/2)³ = 1/8.', '(1/2)³ = 1/8.')
        },
        {
          q: L('Which radiation is the most penetrating?', 'Bức xạ nào xuyên sâu nhất?'),
          opts: [L('Alpha', 'Alpha'), L('Beta', 'Beta'), L('Gamma', 'Gamma'), L('All equal', 'Như nhau')],
          a: 2,
          ex: L('Gamma photons need thick lead or concrete.',
                'Photon gamma cần chì hoặc bê tông dày.')
        }
      ]
    },

    spectroscopy: {
      color: '#7e57c2',
      sim: 'ir-spectrum',
      lessons: [
        {
          title: L('Electromagnetic Absorption', 'Hấp thụ bức xạ điện từ'),
          duration: 9,
          body: L(`
<h3>Molecules have quantised steps</h3>
<p>A molecule absorbs light only when the photon energy exactly matches a gap between allowed states. Three gaps matter at ordinary energies:</p>
<div class="formula">E = h·ν = h·c/λ&nbsp;&nbsp;&nbsp;wavenumber ν̃ = 1/λ (cm⁻¹)</div>
<ul>
<li><b>Rotational</b> — microwave/far-IR; small energy steps.</li>
<li><b>Vibrational</b> — mid-IR, 4000–400 cm⁻¹; the workhorse of organic identification.</li>
<li><b>Electronic</b> — UV/visible; large gaps, hence colour.</li>
</ul>
<p>IR absorption also requires the vibration to change the dipole moment, which is why homonuclear molecules such as N₂ and O₂ are IR-silent.</p>`, `
<h3>Phân tử có các bậc năng lượng lượng tử hóa</h3>
<p>Phân tử chỉ hấp thụ photon khi năng lượng đúng bằng khoảng giữa hai trạng thái cho phép. Ở năng lượng thông thường có ba khoảng quan trọng:</p>
<div class="formula">E = h·ν = h·c/λ&nbsp;&nbsp;&nbsp;số sóng ν̃ = 1/λ (cm⁻¹)</div>
<ul>
<li><b>Quay</b> — vi sóng/hồng ngoại xa; bậc năng lượng nhỏ.</li>
<li><b>Dao động</b> — hồng ngoại giữa, 4000–400 cm⁻¹; công cụ chính nhận diện chất hữu cơ.</li>
<li><b>Điện tử</b> — UV/ khả kiến; khoảng lớn, tạo ra màu sắc.</li>
</ul>
<p>Hấp thụ IR còn yêu cầu dao động làm đổi momen lưỡng cực, nên phân tử cùng nguyên tử như N₂, O₂ không có phổ IR.</p>`)
        },
        {
          title: L('Reading an IR Spectrum', 'Đọc phổ hồng ngoại'),
          duration: 11,
          body: L(`
<h3>Functional groups have addresses</h3>
<p>Bond strength and reduced mass set the vibration frequency; stronger bonds and lighter atoms vibrate higher:</p>
<div class="formula">ν̃ ∝ √(k / μ)</div>
<ul>
<li>O–H alcohol: broad 3200–3600 cm⁻¹.</li>
<li>N–H: 3300–3500 cm⁻¹, sharper.</li>
<li>C–H sp³ ≈ 2900, sp² ≈ 3000–3100, sp ≈ 3300 cm⁻¹.</li>
<li>C=O: strong, 1650–1750 cm⁻¹ — the single most useful band.</li>
<li>C≡N ≈ 2250; C=C aromatic ≈ 1500 and 1600 cm⁻¹.</li>
</ul>
<div class="example">A broad 3400 band plus nothing at 1710 says alcohol. A sharp 1715 band says a carbonyl, and adding a very broad 2500–3300 absorption makes it a carboxylic acid.</div>
<p>The region below 1500 cm⁻¹ is the fingerprint region: unique to each molecule, used to confirm identity against a reference library.</p>`, `
<h3>Nhóm chức có địa chỉ riêng</h3>
<p>Độ bền liên kết và khối lượng giảm định tần số dao động; liên kết mạnh và nguyên tử nhẹ dao động ở số sóng cao hơn:</p>
<div class="formula">ν̃ ∝ √(k / μ)</div>
<ul>
<li>O–H rượu: dải rộng 3200–3600 cm⁻¹.</li>
<li>N–H: 3300–3500 cm⁻¹, nhọn hơn.</li>
<li>C–H sp³ ≈ 2900, sp² ≈ 3000–3100, sp ≈ 3300 cm⁻¹.</li>
<li>C=O: mạnh, 1650–1750 cm⁻¹ — dải hữu ích nhất.</li>
<li>C≡N ≈ 2250; C=C thơm ≈ 1500 và 1600 cm⁻¹.</li>
</ul>
<div class="example">Dải rộng 3400 và không có gì ở 1710 nghĩa là rượu. Đỉnh nhọn 1715 nghĩa là carbonyl; thêm dải rất rộng 2500–3300 thành axit cacboxylic.</div>
<p>Vùng dưới 1500 cm⁻¹ là vùng vân tay: đặc trưng cho từng phân tử, dùng để xác nhận danh tính theo thư viện chuẩn.</p>`)
        },
        {
          title: L('NMR and Mass Spectrometry', 'NMR và khối phổ'),
          duration: 10,
          body: L(`
<h3>Two more structural tools</h3>
<p><b>NMR</b>: nuclei with spin align in a magnetic field and absorb at a frequency set by their electronic environment. Chemical shift in ppm records the environment; peak splitting follows the n+1 rule; integrated area counts the hydrogens.</p>
<div class="example">Ethanol shows three signals: a 3H triplet near 1.2 ppm, a 2H quartet near 3.7 ppm, and a 1H broad OH peak.</div>
<p><b>Mass spectrometry</b> ionises molecules and separates fragments by mass-to-charge. The molecular ion gives the molar mass; isotope patterns flag elements — chlorine gives M and M+2 in a 3:1 ratio, bromine in 1:1.</p>
<p>Together with IR, these three techniques let a structure be deduced from milligram quantities.</p>`, `
<h3>Hai công cụ cấu trúc nữa</h3>
<p><b>NMR</b>: hạt nhân có spin sắp xếp trong từ trường và hấp thụ ở tần số do môi trường electron quyết định. Dịch chuyển hóa học (ppm) ghi lại môi trường; tách peak theo quy tắc n+1; diện tích tích phân đếm số hydro.</p>
<div class="example">Ethanol cho ba tín hiệu: triplet 3H gần 1,2 ppm, quartet 2H gần 3,7 ppm, và peak OH rộng 1H.</div>
<p><b>Khối phổ</b> ion hóa phân tử và tách mảnh theo tỉ lệ khối lượng/điện tích. Ion phân tử cho khối lượng mol; mẫu đồng vị đánh dấu nguyên tố — clo cho M và M+2 tỉ lệ 3:1, brom tỉ lệ 1:1.</p>
<p>Cùng với IR, ba kỹ thuật này cho phép suy ra cấu trúc từ vài miligam mẫu.</p>`)
        }
      ],
      quiz: [
        {
          q: L('A strong absorption near 1715 cm⁻¹ indicates:', 'Hấp thụ mạnh gần 1715 cm⁻¹ chỉ ra:'),
          opts: [L('O–H', 'O–H'), L('C=O', 'C=O'), L('C–H', 'C–H'), L('N≡N', 'N≡N')],
          a: 1,
          ex: L('Carbonyl stretching is the strongest mid-IR band.',
                'Dao động hóa trị carbonyl là dải mạnh nhất trong hồng ngoại giữa.')
        },
        {
          q: L('Why is N₂ invisible in an IR spectrum?', 'Vì sao N₂ không hiện trong phổ IR?'),
          opts: [L('Too heavy', 'Quá nặng'), L('No dipole change on vibration', 'Dao động không đổi momen lưỡng cực'),
                 L('It absorbs UV instead', 'Hấp thụ UV'), L('It is paramagnetic', 'Thuận từ')],
          a: 1,
          ex: L('IR activity requires a changing dipole moment.',
                'Hoạt tính IR cần momen lưỡng cực thay đổi.')
        },
        {
          q: L('An NMR signal split into four lines means the neighbouring protons number:',
               'Một tín hiệu NMR tách thành bốn vạch nghĩa là số proton lân cận là:'),
          opts: [L('2', '2'), L('3', '3'), L('4', '4'), L('1', '1')],
          a: 1,
          ex: L('The n+1 rule: quartet means three neighbours.',
                'Quy tắc n+1: quartet nghĩa là ba proton lân cận.')
        }
      ]
    },

    "gas-laws": {
      color: '#29b6f6',
      sim: 'gas-law',
      lessons: [
        {
          title: L('Pressure, Volume and the Ideal Gas Law', 'Áp suất, thể tích và định luật khí lý tưởng'),
          duration: 10,
          body: L(`
<h3>Four variables, one equation</h3>
<p>Gas pressure is momentum delivered per unit area by molecular collisions. Heating raises the average kinetic energy, so collisions strike harder and more often.</p>
<ul>
<li>Boyle (constant T): pV = const — squeezing raises pressure.</li>
<li>Charles (constant p): V ∝ T — warm gas expands.</li>
<li>Gay-Lussac (constant V): p ∝ T.</li>
<li>Avogadro: equal volumes hold equal numbers of molecules.</li>
</ul>
<div class="formula">pV = nRT&nbsp;&nbsp;&nbsp;R = 8.314 J/(mol·K)</div>
<div class="example">One mole at 298 K and 1 atm occupies V = nRT/p = 24.5 L. At STP (273 K) it is 22.4 L.</div>
<p>Temperature must be in kelvin: T(K) = T(°C) + 273.15.</p>`, `
<h3>Bốn biến, một phương trình</h3>
<p>Áp suất khí là động lượng va chạm truyền lên một đơn vị diện tích. Đun nóng làm tăng động năng trung bình nên va chạm mạnh hơn và thường xuyên hơn.</p>
<ul>
<li>Boyle (nhiệt độ không đổi): pV = hằng số — nén làm tăng áp suất.</li>
<li>Charles (áp suất không đổi): V ∝ T — khí nóng giãn ra.</li>
<li>Gay-Lussac (thể tích không đổi): p ∝ T.</li>
<li>Avogadro: thể tích bằng nhau chứa số phân tử bằng nhau.</li>
</ul>
<div class="formula">pV = nRT&nbsp;&nbsp;&nbsp;R = 8,314 J/(mol·K)</div>
<div class="example">Một mol ở 298 K và 1 atm chiếm V = nRT/p = 24,5 L. Ở đktc (273 K) là 22,4 L.</div>
<p>Nhiệt độ phải tính theo kelvin: T(K) = T(°C) + 273,15.</p>`)
        },
        {
          title: L('Mixtures, Kinetic Theory and Real Gases', 'Hỗn hợp, thuyết động học và khí thực'),
          duration: 10,
          body: L(`
<h3>What the model leaves out</h3>
<p>Each gas in a mixture contributes its own <b>partial pressure</b>; the total is the sum, and the fraction equals the mole fraction.</p>
<div class="formula">p_total = Σ p_i&nbsp;&nbsp;&nbsp;p_i = x_i · p_total</div>
<div class="example">Collected over water, hydrogen at 100 kPa total with 3.2 kPa water vapour is really 96.8 kPa of H₂.</div>
<p>Kinetic theory gives the link between temperature and molecular speed:</p>
<div class="formula">⟨KE⟩ = (3/2) kT&nbsp;&nbsp;&nbsp;v_rms = √(3RT / M)</div>
<p>Light molecules move faster: at the same temperature helium travels about 2.7 times faster than oxygen.</p>
<p>Real gases depart from ideality at high pressure and low temperature, where molecule volume and attraction matter. Compressed CO₂ even liquefies — the ideal law cannot describe that.</p>`, `
<h3>Mô hình bỏ sót điều gì</h3>
<p>Mỗi khí trong hỗn hợp đóng góp <b>áp suất riêng phần</b> của nó; tổng bằng tổng các thành phần, và tỉ lệ bằng tỉ lệ mol.</p>
<div class="formula">p_total = Σ p_i&nbsp;&nbsp;&nbsp;p_i = x_i · p_total</div>
<div class="example">Thu khí hydro trên nước ở tổng áp 100 kPa với hơi nước 3,2 kPa thì hydro thực sự là 96,8 kPa.</div>
<p>Thuyết động học nối nhiệt độ với tốc độ phân tử:</p>
<div class="formula">⟨KE⟩ = (3/2) kT&nbsp;&nbsp;&nbsp;v_rms = √(3RT / M)</div>
<p>Phân tử nhẹ chuyển động nhanh hơn: cùng nhiệt độ, heli chạy nhanh hơn oxi khoảng 2,7 lần.</p>
<p>Khí thực lệch khỏi lý tưởng khi áp suất cao và nhiệt độ thấp, vì thể tích phân tử và lực hút trở nên quan trọng. CO₂ nén thậm chí hóa lỏng — định luật khí lý tưởng không mô tả được.</p>`)
        }
      ],
      quiz: [
        {
          q: L('A 2.0 L sample at 100 kPa is compressed to 0.5 L at constant T. New pressure:',
               'Mẫu 2,0 L ở 100 kPa bị nén còn 0,5 L không đổi nhiệt độ. Áp suất mới:'),
          opts: [L('25 kPa', '25 kPa'), L('100 kPa', '100 kPa'), L('400 kPa', '400 kPa'), L('200 kPa', '200 kPa')],
          a: 2,
          ex: L('Boyle: p₂ = 100 × 2.0 / 0.5 = 400 kPa.', 'Boyle: p₂ = 100 × 2,0 / 0,5 = 400 kPa.')
        },
        {
          q: L('Moles of gas in 10.0 L at 1.00 atm and 273 K is about:',
               'Số mol khí trong 10,0 L ở 1,00 atm và 273 K xấp xỉ:'),
          opts: [L('0.446', '0,446'), L('2.24', '2,24'), L('10.0', '10,0'), L('22.4', '22,4')],
          a: 0,
          ex: L('n = pV/RT = 10.0 / 22.4 = 0.446 mol.', 'n = pV/RT = 10,0 / 22,4 = 0,446 mol.')
        },
        {
          q: L('Doubling absolute temperature of a fixed gas amount at fixed volume:',
               'Gấp đôi nhiệt độ tuyệt đối của một lượng khí ở thể tích không đổi:'),
          opts: [L('doubles pressure', 'gấp đôi áp suất'), L('halves pressure', 'nửa áp suất'),
                 L('no change', 'không đổi'), L('doubles volume', 'gấp đôi thể tích')],
          a: 0,
          ex: L('From pV = nRT with V and n fixed, p ∝ T.',
                'Từ pV = nRT với V và n cố định, p ∝ T.')
        }
      ]
    },

    crystal: {
      color: '#8d6e63',
      sim: 'crystal-lattice',
      lessons: [
        {
          title: L('Unit Cells and Packing', 'Ô đơn vị và cách xếp chặt'),
          duration: 10,
          body: L(`
<h3>The smallest repeating box</h3>
<p>A crystal is a unit cell repeated in three dimensions. Corners contribute 1/8 of an atom to a cell, faces 1/2, edges 1/4 and interiors a whole atom.</p>
<ul>
<li><b>Simple cubic</b>: 1 atom per cell, 52% filled, coordination 6.</li>
<li><b>Body-centred cubic (BCC)</b>: 2 atoms, 68% filled, coordination 8 — iron, sodium.</li>
<li><b>Face-centred cubic (FCC)</b>: 4 atoms, 74% filled, coordination 12 — copper, aluminium; the densest possible packing of equal spheres.</li>
<li><b>Hexagonal close-packed</b>: also 74% but a different stacking sequence.</li>
</ul>
<div class="formula">FCC: 4r = a√2&nbsp;&nbsp;&nbsp;BCC: 4r = a√3&nbsp;&nbsp;&nbsp;density = (atoms per cell × M) / (Nₐ a³)</div>`, `
<h3>Hộp lặp lại nhỏ nhất</h3>
<p>Tinh thể là ô đơn vị lặp lại trong không gian ba chiều. Góc góp 1/8 nguyên tử, mặt góp 1/2, cạnh góp 1/4, bên trong góp nguyên.</p>
<ul>
<li><b>Lập phương đơn giản</b>: 1 nguyên tử mỗi ô, lấp 52%, phối trí 6.</li>
<li><b>Lập phương tâm khối (BCC)</b>: 2 nguyên tử, lấp 68%, phối trí 8 — sắt, natri.</li>
<li><b>Lập phương tâm diện (FCC)</b>: 4 nguyên tử, lấp 74%, phối trí 12 — đồng, nhôm; xếp chặt nhất của các hình cầu bằng nhau.</li>
<li><b>Lục giác xếp chặt</b>: cũng 74% nhưng thứ tự xếp khác.</li>
</ul>
<div class="formula">FCC: 4r = a√2&nbsp;&nbsp;&nbsp;BCC: 4r = a√3&nbsp;&nbsp;&nbsp;khối lượng riêng = (số nguyên tử × M) / (Nₐ a³)</div>`)
        },
        {
          title: L('Ionic Solids and Lattice Energy', 'Chất rắn ion và năng lượng mạng'),
          duration: 10,
          body: L(`
<h3>Why MgO melts at 2800 °C and NaCl at 801 °C</h3>
<p>Lattice energy is the energy released when gaseous ions assemble into a crystal. Coulomb’s law explains the trend:</p>
<div class="formula">E ∝ (Q₁ Q₂) / (r₊ + r₋)</div>
<p>Doubled charges and smaller ions make a far stronger lattice. Mg²⁺O²⁻ has four times the charge product of Na⁺Cl⁻ with shorter distances, hence its enormous melting point.</p>
<p>Structures are chosen by the radius ratio, which sets how many anions can touch one cation: 0.414–0.732 gives the rock-salt (6:6) arrangement seen in NaCl; 0.732 and above gives caesium chloride (8:8).</p>
<div class="example">Born–Haber cycles recover lattice energy from measurable quantities: sublimation, ionisation, dissociation, electron affinity and formation enthalpy.</div>`, `
<h3>Vì sao MgO nóng chảy ở 2800 °C còn NaCl ở 801 °C</h3>
<p>Năng lượng mạng là năng lượng tỏa ra khi ion ở pha khí tập hợp thành tinh thể. Định luật Coulomb giải thích quy luật:</p>
<div class="formula">E ∝ (Q₁ Q₂) / (r₊ + r₋)</div>
<p>Điện tích gấp đôi và ion nhỏ hơn tạo mạng mạnh hơn nhiều. Mg²⁺O²⁻ có tích điện tích gấp bốn Na⁺Cl⁻ và khoảng cách ngắn hơn, nên nhiệt độ nóng chảy rất cao.</p>
<p>Cấu trúc chọn theo tỉ số bán kính, xác định số anion tiếp xúc một cation: 0,414–0,732 cho kiểu muối ăn (6:6) như NaCl; từ 0,732 trở lên cho CsCl (8:8).</p>
<div class="example">Chu trình Born–Haber thu năng lượng mạng từ các đại lượng đo được: thăng hoa, ion hóa, phân ly, ái lực electron và enthalpy tạo thành.</div>`)
        }
      ],
      quiz: [
        {
          q: L('How many atoms belong to one FCC unit cell?', 'Một ô FCC chứa bao nhiêu nguyên tử?'),
          opts: [L('1', '1'), L('2', '2'), L('4', '4'), L('8', '8')],
          a: 2,
          ex: L('8 corners × ⅛ + 6 faces × ½ = 4.', '8 góc × ⅛ + 6 mặt × ½ = 4.')
        },
        {
          q: L('Which lattice energy is larger?', 'Mạng tinh thể nào có năng lượng lớn hơn?'),
          opts: [L('NaCl', 'NaCl'), L('MgO', 'MgO'), L('KBr', 'KBr'), L('They are equal', 'Như nhau')],
          a: 1,
          ex: L('2+ and 2− charges with small ions dominate.',
                'Điện tích 2+/2− cùng ion nhỏ chiếm ưu thế.')
        },
        {
          q: L('The packing efficiency of a body-centred cubic cell is about:',
               'Hiệu suất xếp chặt của ô lập phương tâm khối xấp xỉ:'),
          opts: [L('52%', '52%'), L('68%', '68%'), L('74%', '74%'), L('91%', '91%')],
          a: 1,
          ex: L('BCC fills 68%; FCC and HCP reach 74%.',
                'BCC lấp 68%; FCC và HCP đạt 74%.')
        }
      ]
    }
  });

  // ---------- Topics 14–20 (new) ----------
  Object.assign(LESSONS, {

    quantum: {
      color: '#00acc1',
      sim: 'quantum-numbers',
      lessons: [
        {
          title: L('Wavefunctions and Quantum Numbers', 'Hàm sóng và số lượng tử'),
          duration: 11,
          body: L(`
<h3>Electrons are waves</h3>
<p>De Broglie gave every particle a wavelength, and Schrödinger’s equation turns that wave into allowed states. An electron in an atom is described by a wavefunction ψ; |ψ|² is the probability density of finding it at a point.</p>
<div class="formula">λ = h / (m·v)&nbsp;&nbsp;&nbsp;Ĥψ = E·ψ</div>
<p>Four quantum numbers label each state uniquely:</p>
<ul>
<li><b>n</b> (1, 2, 3…) principal — energy and size.</li>
<li><b>l</b> (0 … n−1) azimuthal — shape: s, p, d, f.</li>
<li><b>mₗ</b> (−l … +l) magnetic — orientation.</li>
<li><b>mₛ</b> (±½) spin.</li>
</ul>
<p>Born together: shell n has n² orbitals, holding 2n² electrons. Pauli’s exclusion principle — no two electrons share all four numbers — is what builds the periodic table.</p>`, `
<h3>Electron là sóng</h3>
<p>De Broglie gán mọi hạt một bước sóng, còn phương trình Schrödinger biến sóng đó thành các trạng thái cho phép. Electron trong nguyên tử được mô tả bằng hàm sóng ψ; |ψ|² là mật độ xác suất tìm thấy nó tại một điểm.</p>
<div class="formula">λ = h / (m·v)&nbsp;&nbsp;&nbsp;Ĥψ = E·ψ</div>
<p>Bốn số lượng tử định danh mỗi trạng thái một cách duy nhất:</p>
<ul>
<li><b>n</b> (1, 2, 3…) chính — năng lượng và kích thước.</li>
<li><b>l</b> (0 … n−1) phụ — hình dạng: s, p, d, f.</li>
<li><b>mₗ</b> (−l … +l) từ — định hướng.</li>
<li><b>mₛ</b> (±½) spin.</li>
</ul>
<p>Lớp n có n² orbital, chứa 2n² electron. Nguyên lý loại trừ Pauli — không hai electron cùng bốn số — là nền tảng của bảng tuần hoàn.</p>`)
        },
        {
          title: L('Orbitals, Shapes and Uncertainty', 'Orbital, hình dạng và bất định'),
          duration: 10,
          body: L(`
<h3>Where probability goes to zero</h3>
<p>An orbital is a region holding about 90% of the electron density. s orbitals are spheres, p orbitals are dumbbells with a nodal plane through the nucleus, d orbitals are mostly four-lobed.</p>
<div class="formula">Δx · Δp ≥ ħ / 2</div>
<p>Heisenberg’s principle is not a measurement flaw: an electron confined to a small region simply has no well-defined momentum. That is why "orbit" is replaced by "orbital".</p>
<p>Nodes matter energetically. More nodes means more curvature of ψ, hence higher kinetic energy: within a shell the order is s &lt; p &lt; d &lt; f, and penetration toward the nucleus explains why 4s fills before 3d.</p>
<div class="example">Hydrogen’s ground state has no angular nodes; its first excited states (2s, 2p) each have one.</div>`, `
<h3>Nơi xác suất bằng không</h3>
<p>Orbital là vùng chứa khoảng 90% mật độ electron. Orbital s là hình cầu, p là hình tạ có mặt nút đi qua hạt nhân, d thường có bốn thùy.</p>
<div class="formula">Δx · Δp ≥ ħ / 2</div>
<p>Nguyên lý Heisenberg không phải sai số đo lường: electron bị giam trong vùng nhỏ đơn giản là không có động lượng xác định. Vì vậy "quỹ đạo" được thay bằng "orbital".</p>
<p>Số nút quyết định năng lượng. Nhiều nút nghĩa là ψ cong nhiều hơn, động năng cao hơn: trong cùng một lớp thứ tự là s &lt; p &lt; d &lt; f, và khả năng xuyên thấu về phía hạt nhân giải thích vì sao 4s điền trước 3d.</p>
<div class="example">Trạng thái cơ bản của hydro không có nút góc; các trạng thái kích thích đầu (2s, 2p) mỗi cái có một nút.</div>`)
        },
        {
          title: L('Atomic Spectra and Energy Levels', 'Phổ nguyên tử và mức năng lượng'),
          duration: 9,
          body: L(`
<h3>Evidence for quantisation</h3>
<p>Excited atoms emit light only at specific wavelengths, producing line spectra. For hydrogen the lines fit the Rydberg formula exactly.</p>
<div class="formula">1/λ = R_H (1/n₁² − 1/n₂²)&nbsp;&nbsp;&nbsp;R_H = 1.097×10⁷ m⁻¹</div>
<div class="example">The red Hα line (n = 3 → 2) sits at 656 nm; the Balmer series as a whole defines visible hydrogen.</div>
<p>Each line is a photon carrying away the difference between two levels: E = h·ν. Flame tests and atomic emission spectroscopy use the same physics to identify elements, and the colours of neon signs and sodium street lamps are atomic spectra you can see on the street.</p>`, `
<h3>Bằng chứng cho lượng tử hóa</h3>
<p>Nguyên tử kích thích chỉ phát ánh sáng ở một số bước sóng nhất định, tạo phổ vạch. Với hydro, các vạch khớp chính xác công thức Rydberg.</p>
<div class="formula">1/λ = R_H (1/n₁² − 1/n₂²)&nbsp;&nbsp;&nbsp;R_H = 1,097×10⁷ m⁻¹</div>
<div class="example">Vạch đỏ Hα (n = 3 → 2) ở 656 nm; dãy Balmer xác định vùng khả kiến của hydro.</div>
<p>Mỗi vạch là một photon mang đi hiệu hai mức năng lượng: E = h·ν. Phép thử ngọn lửa và phổ phát xạ nguyên tử dùng cùng vật lý để nhận diện nguyên tố; màu của đèn neon và đèn natri đường phố là phổ nguyên tử nhìn thấy được.</p>`)
        }
      ],
      quiz: [
        {
          q: L('How many orbitals are in the subshell with l = 2?', 'Phân lớp l = 2 có bao nhiêu orbital?'),
          opts: [L('3', '3'), L('5', '5'), L('7', '7'), L('10', '10')],
          a: 1,
          ex: L('mₗ runs from −2 to +2, giving five orbitals.',
                'mₗ chạy từ −2 đến +2, cho năm orbital.')
        },
        {
          q: L('Which set of quantum numbers is forbidden?', 'Bộ số lượng tử nào bị cấm?'),
          opts: [L('n=3, l=1, mₗ=0', 'n=3, l=1, mₗ=0'), L('n=2, l=2, mₗ=1', 'n=2, l=2, mₗ=1'),
                 L('n=4, l=0, mₗ=0', 'n=4, l=0, mₗ=0'), L('n=1, l=0, mₗ=0', 'n=1, l=0, mₗ=0')],
          a: 1,
          ex: L('l must be smaller than n, so l = 2 with n = 2 cannot exist.',
                'l phải nhỏ hơn n nên l = 2 với n = 2 không tồn tại.')
        },
        {
          q: L('Line spectra prove that:', 'Phổ vạch chứng minh rằng:'),
          opts: [L('light is continuous', 'ánh sáng liên tục'),
                 L('atomic energy levels are quantised', 'mức năng lượng nguyên tử lượng tử hóa'),
                 L('electrons have mass', 'electron có khối lượng'),
                 L('atoms are indivisible', 'nguyên tử không phân chia')],
          a: 1,
          ex: L('Only discrete gaps can give discrete photon energies.',
                'Chỉ khoảng năng lượng rời rạc mới cho năng lượng photon rời rạc.')
        }
      ]
    },

    equilibrium: {
      color: '#ffca28',
      sim: 'equilibrium-demo',
      lessons: [
        {
          title: L('The Equilibrium Constant', 'Hằng số cân bằng'),
          duration: 10,
          body: L(`
<h3>One number, many starting points</h3>
<p>At a fixed temperature every mixture of a reversible reaction settles so that the same ratio of concentrations holds, no matter which side you started from.</p>
<div class="formula">a A + b B ⇌ c C + d D&nbsp;&nbsp;&nbsp;Kc = [C]^c[D]^d / [A]^a[B]^b</div>
<p>Rules: pure solids and liquids are omitted; coefficients become exponents; reversing the reaction gives 1/K; multiplying coefficients by n raises K to the power n. Only temperature changes K.</p>
<div class="example">If Kc = 4.0 × 10⁻³, reactants dominate at equilibrium — the reaction barely proceeds.</div>
<p>Compare Q (the same expression with current concentrations) with K to predict the direction: Q &lt; K shifts right, Q &gt; K shifts left, Q = K is at equilibrium.</p>`, `
<h3>Một con số, nhiều điểm khởi đầu</h3>
<p>Ở nhiệt độ cố định, mọi hỗn hợp của phản ứng thuận nghịch đều ổn định sao cho cùng một tỉ số nồng độ được thỏa, bất kể bắt đầu từ phía nào.</p>
<div class="formula">a A + b B ⇌ c C + d D&nbsp;&nbsp;&nbsp;Kc = [C]^c[D]^d / [A]^a[B]^b</div>
<p>Quy tắc: bỏ rắn và lỏng nguyên chất; hệ số thành số mũ; đảo phản ứng cho 1/K; nhân hệ số với n thì K mũ n. Chỉ nhiệt độ làm đổi K.</p>
<div class="example">Nếu Kc = 4,0 × 10⁻³ thì chất đầu áp đảo tại cân bằng — phản ứng hầu như không tiến hành.</div>
<p>So sánh Q (biểu thức trên với nồng độ hiện tại) với K để dự đoán chiều: Q &lt; K dịch phải, Q &gt; K dịch trái, Q = K là cân bằng.</p>`)
        },
        {
          title: L('Solving Equilibrium Problems', 'Giải bài toán cân bằng'),
          duration: 11,
          body: L(`
<h3>ICE and the 5% shortcut</h3>
<p>Tabulate Initial, Change and Equilibrium concentrations using one unknown x tied together by the stoichiometry, then substitute into K and solve.</p>
<div class="example">A ⇌ B with Kc = 0.10 and [A]₀ = 1.00 M: x/(1−x) = 0.10 gives x = 0.091 M.</div>
<p>When K is very small, x is negligible compared with the initial concentration and the quadratic collapses. Check afterwards that x is under 5% of the starting value; if not, solve properly.</p>
<div class="formula">Kp = Kc (RT)^Δn(gas)&nbsp;&nbsp;&nbsp;Δn = moles gas products − reactants</div>
<p>For gas reactions Kp and Kc differ only by this factor, so a reaction with no change in gas moles has Kp = Kc.</p>`, `
<h3>ICE và mẹo 5%</h3>
<p>Lập bảng Ban đầu, Biến thiên, Cân bằng dùng một ẩn x gắn theo tỷ lượng, rồi thế vào K và giải.</p>
<div class="example">A ⇌ B với Kc = 0,10 và [A]₀ = 1,00 M: x/(1−x) = 0,10 cho x = 0,091 M.</div>
<p>Khi K rất nhỏ, x không đáng kể so với nồng độ ban đầu và phương trình bậc hai đơn giản hóa. Kiểm tra lại x dưới 5% giá trị đầu; nếu không, phải giải đầy đủ.</p>
<div class="formula">Kp = Kc (RT)^Δn(khí)&nbsp;&nbsp;&nbsp;Δn = mol khí sản phẩm − chất đầu</div>
<p>Với phản ứng khí, Kp và Kc chỉ khác nhau thừa số này, nên phản ứng không đổi số mol khí có Kp = Kc.</p>`)
        },
        {
          title: L('Shifting Equilibria in Industry', 'Dịch chuyển cân bằng trong công nghiệp'),
          duration: 9,
          body: L(`
<h3>Yield versus rate is an engineering choice</h3>
<p>Le Chatelier tells which way an equilibrium moves, but the reaction still has to be fast enough to be useful. Industrial chemistry is the compromise between the two.</p>
<div class="example">Haber: N₂ + 3H₂ ⇌ 2NH₃, ΔH = −92 kJ. Cold and high pressure favour ammonia; about 450 °C and 200 atm with an iron catalyst is the practical optimum.</div>
<div class="example">Contact process: 2SO₂ + O₂ ⇌ 2SO₃, exothermic, so ~450 °C, 2 atm and V₂O₅; excess air pushes the equilibrium right.</div>
<ul>
<li>Catalyst: no shift, faster arrival at equilibrium.</li>
<li>Inert gas at constant volume: no shift.</li>
<li>Removing a product as it forms: drives the reaction further than K alone suggests.</li>
</ul>`, `
<h3>Hiệu suất đối đầu tốc độ là lựa chọn kỹ thuật</h3>
<p>Le Chatelier cho biết cân bằng dịch thế nào, nhưng phản ứng vẫn phải đủ nhanh để hữu ích. Hóa công nghiệp là điểm thỏa hiệp giữa hai thứ.</p>
<div class="example">Haber: N₂ + 3H₂ ⇌ 2NH₃, ΔH = −92 kJ. Lạnh và áp suất cao có lợi cho amoniac; khoảng 450 °C, 200 atm với xúc tác sắt là tối ưu thực tế.</div>
<div class="example">Phương pháp tiếp xúc: 2SO₂ + O₂ ⇌ 2SO₃, tỏa nhiệt, nên ~450 °C, 2 atm và V₂O₅; không khí dư đẩy cân bằng sang phải.</div>
<ul>
<li>Xúc tác: không dịch chuyển, chỉ đạt cân bằng nhanh hơn.</li>
<li>Khí trơ ở thể tích không đổi: không dịch.</li>
<li>Loại sản phẩm khi vừa tạo thành: đưa phản ứng đi xa hơn K đơn thuần.</li>
</ul>`)
        }
      ],
      quiz: [
        {
          q: L('Doubling the coefficients of a reaction with equilibrium constant K gives:',
               'Gấp đôi hệ số của phản ứng có hằng số cân bằng K cho:'),
          opts: [L('2K', '2K'), L('K²', 'K²'), L('√K', '√K'), L('K/2', 'K/2')],
          a: 1,
          ex: L('Every exponent doubles, so the whole expression squares.',
                'Mọi số mũ nhân đôi nên biểu thức bình phương.')
        },
        {
          q: L('For N₂O₄ ⇌ 2NO₂, Kp and Kc differ by:', 'Với N₂O₄ ⇌ 2NO₂, Kp và Kc khác nhau bởi:'),
          opts: [L('(RT)⁻¹', '(RT)⁻¹'), L('(RT)¹', '(RT)¹'), L('(RT)²', '(RT)²'), L('They are equal', 'Bằng nhau')],
          a: 1,
          ex: L('Δn = 2 − 1 = 1, so Kp = Kc·RT.', 'Δn = 2 − 1 = 1 nên Kp = Kc·RT.')
        },
        {
          q: L('Adding a catalyst to a system at equilibrium:',
               'Thêm xúc tác vào hệ đang cân bằng:'),
          opts: [L('shifts right', 'dịch phải'), L('shifts left', 'dịch trái'),
                 L('no shift', 'không dịch'), L('stops the reaction', 'dừng phản ứng')],
          a: 2,
          ex: L('It accelerates both directions equally, leaving K untouched.',
                'Xúc tác tăng cả hai chiều như nhau, K không đổi.')
        }
      ]
    },

    photochem: {
      color: '#26a69a',
      sim: 'photoelectric',
      lessons: [
        {
          title: L('Photons, Excitation and the Quantum Yield', 'Photon, kích thích và hiệu suất lượng tử'),
          duration: 10,
          body: L(`
<h3>Chemistry started by light</h3>
<p>A molecule absorbs one photon at a time (Grotthuss–Draper law), and only if the photon energy matches an electronic gap. The excited molecule can then relax by heat, fluorescence, phosphorescence, or chemistry.</p>
<div class="formula">E = h·ν = h·c/λ&nbsp;&nbsp;&nbsp;1 mol of 400 nm photons carries 300 kJ</div>
<p>The quantum yield Φ counts how many events occur per photon absorbed:</p>
<div class="formula">Φ = molecules reacted / photons absorbed</div>
<p>Φ near 1 is a chain reaction propagating after one photon; Φ far below 1 means deactivation wins. Fluorescence emits within nanoseconds; phosphorescence involves a spin-forbidden triplet state and can glow for minutes.</p>
<div class="example">H₂ + Cl₂ in the dark is inert. One photon splits Cl₂ into two radicals and a chain of over a million molecules reacts — Φ ≈ 10⁶.</div>`, `
<h3>Hóa học khởi đầu bằng ánh sáng</h3>
<p>Phân tử hấp thụ từng photon một (định luật Grotthuss–Draper), và chỉ khi năng lượng photon khớp với khoảng mức điện tử. Phân tử kích thích có thể hồi phục bằng nhiệt, huỳnh quang, lân quang, hoặc phản ứng hóa học.</p>
<div class="formula">E = h·ν = h·c/λ&nbsp;&nbsp;&nbsp;1 mol photon 400 nm mang 300 kJ</div>
<p>Hiệu suất lượng tử Φ đếm số sự kiện trên mỗi photon hấp thụ:</p>
<div class="formula">Φ = số phân tử phản ứng / số photon hấp thụ</div>
<p>Φ gần 1 là phản ứng dây chuyền lan truyền sau một photon; Φ rất nhỏ nghĩa là quá trình tắt chiếm ưu thế. Huỳnh quang phát trong vài nano giây; lân quang liên quan trạng thái triplet cấm về spin và có thể phát sáng nhiều phút.</p>
<div class="example">H₂ + Cl₂ trong tối trơ. Một photon tách Cl₂ thành hai gốc và dây chuyền hơn một triệu phân tử phản ứng — Φ ≈ 10⁶.</div>`)
        },
        {
          title: L('Photosynthesis and Photochemistry in Nature', 'Quang hợp và quang hóa trong tự nhiên'),
          duration: 9,
          body: L(`
<h3>Storing sunlight in bonds</h3>
<p>Chlorophyll absorbs red and blue light and reflects green. The excited pigment passes an electron down a chain, splitting water, building a proton gradient and finally fixing CO₂ into carbohydrate.</p>
<div class="formula">6 CO₂ + 6 H₂O + light → C₆H₁₂O₆ + 6 O₂&nbsp;&nbsp;&nbsp;ΔG° ≈ +2870 kJ/mol</div>
<p>This is the strongly endergonic reaction that light makes possible — the reverse of combustion.</p>
<p>Other natural and everyday photochemistry: vitamin D synthesis in skin from UVB, retinal isomerisation that starts vision, silver halide darkening in film, and the UV degradation of plastics and dyes.</p>
<div class="example">Ozone in the upper atmosphere forms when UV splits O₂; the same radiation then destroys it. Chlorine radicals from CFCs tip that balance toward loss.</div>`, `
<h3>Lưu trữ ánh sáng trong liên kết</h3>
<p>Diệp lục hấp thụ ánh sáng đỏ và xanh, phản xạ xanh lục. Sắc tố kích thích chuyển electron xuống chuỗi truyền, tách nước, tạo gradient proton và cuối cùng cố định CO₂ thành carbohydrate.</p>
<div class="formula">6 CO₂ + 6 H₂O + ánh sáng → C₆H₁₂O₆ + 6 O₂&nbsp;&nbsp;&nbsp;ΔG° ≈ +2870 kJ/mol</div>
<p>Đây là phản ứng thu năng lượng mạnh mà ánh sáng làm cho khả thi — ngược của phản ứng cháy.</p>
<p>Quang hóa tự nhiên và đời thường khác: tổng hợp vitamin D trong da từ UVB, đồng phân hóa retinal khởi đầu thị giác, bạc halogenua sẫm màu trên phim, và phân hủy nhựa, thuốc nhuộm dưới tia UV.</p>
<div class="example">Ozon tầng trên khí hình thành khi UV tách O₂; cùng bức xạ đó lại phá hủy nó. Gốc clo từ CFC làm cân bằng nghiêng về phía mất ozon.</div>`)
        }
      ],
      quiz: [
        {
          q: L('A photon of shorter wavelength carries:', 'Photon có bước sóng ngắn hơn mang:'),
          opts: [L('less energy', 'năng lượng thấp hơn'), L('more energy', 'năng lượng cao hơn'),
                 L('the same energy', 'cùng năng lượng'), L('no energy', 'không năng lượng')],
          a: 1,
          ex: L('E = hc/λ, so energy rises as wavelength falls.', 'E = hc/λ nên năng lượng tăng khi bước sóng giảm.')
        },
        {
          q: L('Phosphorescence glows longer than fluorescence because:',
               'Lân quang phát sáng lâu hơn huỳnh quang vì:'),
          opts: [L('bigger molecules', 'phân tử lớn hơn'),
                 L('a spin-forbidden transition', 'chuyển dời cấm về spin'),
                 L('higher temperature', 'nhiệt độ cao hơn'),
                 L('more photons', 'nhiều photon hơn')],
          a: 1,
          ex: L('Intersystem crossing to a triplet state makes decay slow.',
                'Vượt hệ sang trạng thái triplet làm phân rã chậm.')
        },
        {
          q: L('Quantum yield Φ = 10⁶ suggests:', 'Hiệu suất lượng tử Φ = 10⁶ chỉ ra:'),
          opts: [L('a chain reaction', 'phản ứng dây chuyền'), L('no reaction', 'không phản ứng'),
                 L('a catalyst', 'xúc tác'), L('equilibrium', 'cân bằng')],
          a: 0,
          ex: L('One photon triggering many reactions is the signature of propagation.',
                'Một photon khơi mào nhiều phản ứng là dấu hiệu lan truyền.')
        }
      ]
    },

    surface: {
      color: '#ff8a65',
      sim: 'adsorption',
      lessons: [
        {
          title: L('Adsorption, Surface Area and Isotherms', 'Hấp phụ, diện tích bề mặt và đẳng nhiệt'),
          duration: 10,
          body: L(`
<h3>Atoms with unfinished business</h3>
<p>Surface atoms have unsatisfied bonds, so a surface grabs passing molecules. <b>Adsorption</b> holds them on the surface; <b>absorption</b> takes them into the bulk. Activated carbon works by the first, a sponge by the second.</p>
<div class="formula">Fractional coverage θ = KP / (1 + KP)&nbsp;&nbsp;(Langmuir, one layer, equal sites)</div>
<p>At low pressure coverage grows linearly; at high pressure sites saturate and θ approaches 1. A plot of P/θ against P gives a straight line whose slope and intercept yield the monolayer capacity and the affinity constant.</p>
<ul>
<li><b>Physisorption</b> — van der Waals only, weak, multilayer, reversible.</li>
<li><b>Chemisorption</b> — real chemical bonds, strong, one layer, often needs activation energy.</li>
</ul>
<div class="example">One gram of activated carbon exposes roughly 1000 m² of surface — the reason it can hold a visible mass of gas.</div>`, `
<h3>Nguyên tử chưa hoàn thành liên kết</h3>
<p>Nguyên tử bề mặt còn liên kết dở nên bề mặt giữ các phân tử đi qua. <b>Hấp phụ</b> giữ trên bề mặt; <b>hấp thụ</b> đưa vào khối. Than hoạt tính dùng cơ chế thứ nhất, miếng bọt biển dùng cơ chế thứ hai.</p>
<div class="formula">Độ phủ θ = KP / (1 + KP)&nbsp;&nbsp;(Langmuir, một lớp, các vị trí như nhau)</div>
<p>Áp suất thấp độ phủ tăng tuyến tính; áp suất cao các vị trí bão hòa và θ tiến tới 1. Vẽ P/θ theo P cho đường thẳng; hệ số góc và chặn cho dung lượng một lớp và hằng số ái lực.</p>
<ul>
<li><b>Hấp phụ vật lý</b> — chỉ lực van der Waals, yếu, đa lớp, thuận nghịch.</li>
<li><b>Hấp phụ hóa học</b> — liên kết hóa học thật, mạnh, một lớp, thường cần năng lượng hoạt hóa.</li>
</ul>
<div class="example">Một gam than hoạt tính có diện tích bề mặt khoảng 1000 m² — lý do nó giữ được lượng khí nhìn thấy được.</div>`)
        },
        {
          title: L('Catalysis at Surfaces', 'Xúc tác trên bề mặt'),
          duration: 10,
          body: L(`
<h3>Five steps of a heterogeneous reaction</h3>
<p>Reactants diffuse to the surface, adsorb, react through surface intermediates, desorb, and diffuse away. Blocking any step stops the reaction — which is how a poison such as lead or sulfur kills a catalytic converter.</p>
<div class="example">Haber catalyst: N₂ chemisorbs on iron, the strong N≡N bond weakens, hydrogen atoms add stepwise, and NH₃ leaves.</div>
<p>Enzymes are the same physics with exquisite selectivity: the active site binds the transition state far tighter than the substrate, which is exactly what lowers activation energy.</p>
<div class="formula">rate ∝ θ(A)·θ(B)&nbsp;&nbsp;— too weak an adsorbate leaves before reacting, too strong an one never leaves</div>
<p>This trade-off is the Sabatier principle and explains the volcano-shaped activity chart across metals.</p>
<p>Nanoparticles are the extreme of surface chemistry: at 5 nm, a third of the atoms sit on the surface, so gold — inert in bulk — becomes a working oxidation catalyst.</p>`, `
<h3>Năm bước của phản ứng dị thể</h3>
<p>Chất đầu khuếch tán tới bề mặt, hấp phụ, phản ứng qua trung gian bề mặt, giải hấp, rồi khuếch tán ra. Chặn bất kỳ bước nào sẽ dừng phản ứng — đó là cách chì hay lưu huỳnh đầu độc bộ chuyển đổi xúc tác.</p>
<div class="example">Xúc tác Haber: N₂ hấp phụ hóa học trên sắt, liên kết N≡N suy yếu, hydro cộng dần từng bước, và NH₃ rời đi.</div>
<p>Enzyme cũng là vật lý đó nhưng chọn lọc tuyệt đối: vị trí hoạt động gắn trạng thái chuyển tiếp chặt hơn cơ chất nhiều, đó chính xác là cách giảm năng lượng hoạt hóa.</p>
<div class="formula">tốc độ ∝ θ(A)·θ(B)&nbsp;&nbsp;— hấp phụ quá yếu thì rời đi trước khi phản ứng, quá mạnh thì không bao giờ rời đi</div>
<p>Đánh đổi này là nguyên lý Sabatier và giải thích biểu đồ hoạt tính hình núi lửa theo từng kim loại.</p>
<p>Hạt nano là cực hạn của hóa bề mặt: ở 5 nm, một phần ba nguyên tử nằm trên bề mặt, nên vàng — trơ ở dạng khối — trở thành xúc tác oxi hóa hiệu quả.</p>`)
        }
      ],
      quiz: [
        {
          q: L('Chemisorption differs from physisorption because it involves:',
               'Hấp phụ hóa học khác hấp phụ vật lý vì liên quan:'),
          opts: [L('van der Waals forces', 'lực van der Waals'), L('chemical bonds', 'liên kết hóa học'),
                 L('dissolution', 'hòa tan'), L('condensation', 'ngưng tụ')],
          a: 1,
          ex: L('Electron sharing or transfer makes it strong and specific.',
                'Chia sẻ hoặc chuyển electron làm nó mạnh và đặc thù.')
        },
        {
          q: L('In the Langmuir model, as pressure becomes very large, coverage θ tends to:',
               'Trong mô hình Langmuir, khi áp suất rất lớn, độ phủ θ tiến tới:'),
          opts: [L('0', '0'), L('KP', 'KP'), L('1', '1'), L('∞', '∞')],
          a: 2,
          ex: L('θ = KP/(1+KP) → 1 when all sites are filled.',
                'θ = KP/(1+KP) → 1 khi mọi vị trí đã đầy.')
        },
        {
          q: L('The Sabatier principle says a good catalyst binds the reactant:',
               'Nguyên lý Sabatier nói xúc tác tốt liên kết chất đầu:'),
          opts: [L('as strongly as possible', 'mạnh nhất có thể'), L('as weakly as possible', 'yếu nhất có thể'),
                 L('at an intermediate strength', 'ở mức trung bình'), L('only by physisorption', 'chỉ bằng hấp phụ vật lý')],
          a: 2,
          ex: L('Too weak never reacts; too strong never desorbs.',
                'Quá yếu không phản ứng; quá mạnh không giải hấp.')
        }
      ]
    },

    analytical: {
      color: '#4fc3f7',
      sim: 'titration',
      lessons: [
        {
          title: L('Volumetric Analysis and the Titration Curve', 'Phân tích thể tích và đường chuẩn độ'),
          duration: 11,
          body: L(`
<h3>Measuring by reacting completely</h3>
<p>A standard solution of known concentration is delivered to the analyte until stoichiometric equivalence. An indicator or a pH meter reports the end point, and volume plus concentration converts directly to moles.</p>
<div class="formula">C_analyte = C_titrant · V_titrant × (a/b) / V_analyte</div>
<p>Titration curves have characteristic shapes. Strong acid versus strong base is flat then vertical near pH 7. Weak acid versus strong base starts higher, has a buffer region, and the half-equivalence pH equals the pKa.</p>
<div class="example">At half-neutralisation, [A⁻] = [HA], so Henderson–Hasselbalch reduces to pH = pKa. Read pKa straight off the curve.</div>
<p>The steep jump must contain the indicator transition range, otherwise the end point lies outside the vertical part and the result is meaningless.</p>`, `
<h3>Đo bằng cách phản ứng hoàn toàn</h3>
<p>Dung dịch chuẩn có nồng độ đã biết được nhỏ vào chất cần phân tích tới tương đương tỷ lượng. Chỉ thị hoặc máy đo pH báo điểm cuối, và thể tích cùng nồng độ đổi trực tiếp thành số mol.</p>
<div class="formula">C_chất phân tích = C_chuẩn · V_chuẩn × (a/b) / V_chất phân tích</div>
<p>Đường chuẩn độ có hình dạng đặc trưng. Axit mạnh với bazơ mạnh: phẳng rồi đứng gần pH 7. Axit yếu với bazơ mạnh: bắt đầu cao hơn, có vùng đệm, và pH tại nửa tương đương bằng pKa.</p>
<div class="example">Tại nửa trung hòa, [A⁻] = [HA], nên Henderson–Hasselbalch rút thành pH = pKa. Đọc pKa ngay trên đường cong.</div>
<p>Phần nhảy vọt phải chứa khoảng đổi màu của chỉ thị, nếu không điểm cuối nằm ngoài phần đứng và kết quả vô nghĩa.</p>`)
        },
        {
          title: L('Accuracy, Precision and Error', 'Độ đúng, độ chính xác và sai số'),
          duration: 9,
          body: L(`
<h3>Two different qualities of a measurement</h3>
<ul>
<li><b>Accuracy</b> — closeness to the true value; limited by systematic error (bad calibration, drifting balance).</li>
<li><b>Precision</b> — repeatability; limited by random error, reduced by averaging.</li>
</ul>
<div class="formula">relative error = |experimental − true| / true × 100%</div>
<p>Significant figures carry the honest resolution of the instrument. In multiplication the answer keeps the fewest significant figures; in addition it keeps the fewest decimal places.</p>
<div class="example">25.00 mL from a burette has four significant figures; 25 mL from a measuring cylinder has two. They are not the same measurement.</div>
<p>Calibration curves from standards, blanks to subtract background, and replicate analysis for a standard deviation are the three habits of reliable quantitative work.</p>`, `
<h3>Hai tính chất khác nhau của phép đo</h3>
<ul>
<li><b>Độ đúng</b> — gần giá trị thật; giới hạn bởi sai số hệ thống (hiệu chuẩn kém, cân trôi).</li>
<li><b>Độ chính xác</b> — khả năng lặp lại; giới hạn bởi sai số ngẫu nhiên, giảm bằng trung bình.</li>
</ul>
<div class="formula">sai số tương đối = |thực nghiệm − thật| / thật × 100%</div>
<p>Chữ số có nghĩa mang độ phân giải trung thực của dụng cụ. Nhân chia giữ số chữ số có nghĩa ít nhất; cộng trừ giữ số thập phân ít nhất.</p>
<div class="example">25,00 mL từ buret có bốn chữ số có nghĩa; 25 mL từ ống đong có hai. Đó không phải cùng một phép đo.</div>
<p>Đường chuẩn từ các dung dịch chuẩn, mẫu trắng để trừ nền, và phân tích lặp để có độ lệch chuẩn là ba thói quen của công tác định lượng đáng tin cậy.</p>`)
        },
        {
          title: L('Chromatography and Spectrophotometry', 'Sắc ký và quang phổ kế'),
          duration: 9,
          body: L(`
<h3>Separate, then measure</h3>
<p><b>Chromatography</b> splits a mixture between a mobile phase and a stationary phase. Components that prefer the stationary phase travel slower, so a single injection becomes a series of peaks.</p>
<div class="formula">retention time t_R identifies · peak area quantifies</div>
<p>Increasing column length or the partition coefficient improves separation but costs time. In gas chromatography volatility dominates; in HPLC it is polarity.</p>
<p><b>Spectrophotometry</b> measures how much light a solution absorbs at a chosen wavelength:</p>
<div class="formula">A = ε · l · c&nbsp;&nbsp;(Beer–Lambert law)</div>
<div class="example">A colourimeter calibrated with five standard solutions can read the concentration of an unknown in seconds — the same principle inside a pool-test kit.</div>
<p>Beer’s law fails at high concentrations, where absorbing particles shade one another.</p>`, `
<h3>Tách ra rồi đo</h3>
<p><b>Sắc ký</b> chia hỗn hợp giữa pha động và pha tĩnh. Cấu tử ưa pha tĩnh đi chậm hơn, nên một lần bơm thành loạt peak.</p>
<div class="formula">thời gian lưu t_R để nhận diện · diện tích peak để định lượng</div>
<p>Tăng chiều dài cột hoặc hệ số phân bố cải thiện tách nhưng tốn thời gian. Sắc ký khí phụ thuộc độ bay hơi; HPLC phụ thuộc độ phân cực.</p>
<p><b>Quang phổ kế</b> đo lượng ánh sáng dung dịch hấp thụ ở bước sóng chọn trước:</p>
<div class="formula">A = ε · l · c&nbsp;&nbsp;(định luật Beer–Lambert)</div>
<div class="example">Máy so màu hiệu chuẩn bằng năm dung dịch chuẩn đọc nồng độ mẫu chưa biết trong vài giây — cùng nguyên lý trong bộ test hồ bơi.</div>
<p>Định luật Beer sai ở nồng độ cao, khi các hạt hấp thụ che lẫn nhau.</p>`)
        }
      ],
      quiz: [
        {
          q: L('At the half-equivalence point of a weak-acid titration:',
               'Tại điểm nửa tương đương của chuẩn độ axit yếu:'),
          opts: [L('pH = 7', 'pH = 7'), L('pH = pKa', 'pH = pKa'), L('pH = 14 − pKa', 'pH = 14 − pKa'),
                 L('the solution is neutral', 'dung dịch trung tính')],
          a: 1,
          ex: L('[A⁻] = [HA] makes the log term zero.', '[A⁻] = [HA] làm số hạng log bằng 0.')
        },
        {
          q: L('Doubling the path length in Beer’s law changes absorbance by:',
               'Gấp đôi chiều dài đường đi trong định luật Beer làm độ hấp thụ:'),
          opts: [L('halve', 'nửa'), L('double', 'gấp đôi'), L('quadruple', 'gấp bốn'), L('not change', 'không đổi')],
          a: 1,
          ex: L('A = εlc is linear in l.', 'A = εlc tuyến tính theo l.')
        },
        {
          q: L('High precision but low accuracy usually means:',
               'Độ chính xác cao nhưng độ đúng thấp thường do:'),
          opts: [L('random error', 'sai số ngẫu nhiên'), L('a systematic error', 'sai số hệ thống'),
                 L('too few trials', 'quá ít lần đo'), L('a wrong indicator', 'chỉ thị sai')],
          a: 1,
          ex: L('Repeatable but offset results point to calibration.',
                'Kết quả lặp lại nhưng lệch chỉ ra vấn đề hiệu chuẩn.')
        }
      ]
    },

    green: {
      color: '#9ccc65',
      sim: 'atom-economy',
      lessons: [
        {
          title: L('The Twelve Principles', 'Mười hai nguyên lý'),
          duration: 9,
          body: L(`
<h3>Design, not clean-up</h3>
<p>Green chemistry, formalised by Anastas and Warner in 1998, prevents waste instead of treating it. The twelve principles are a design checklist:</p>
<ul>
<li>Prevent waste; maximise atom economy; design safer chemicals and syntheses.</li>
<li>Use renewable feedstocks; avoid derivatisation (protecting groups); use catalysts, not stoichiometric reagents.</li>
<li>Design for degradation; keep analysis real-time; choose solvents and conditions for energy efficiency and inherent safety.</li>
</ul>
<div class="example">Ibuprofen: the 1960s Boots route gave 40% yield in six steps with stoichiometric aluminium chloride. The 1990s BHC route gives 77% in three steps with a palladium catalyst and nearly every atom in the product.</div>
<p>Substitution of a solvent matters as much: supercritical CO₂, water, and ionic liquids replace chlorinated solvents in many processes.</p>`, `
<h3>Thiết kế, không phải xử lý</h3>
<p>Hóa học xanh, do Anastas và Warner hệ thống hóa năm 1998, ngăn chất thải thay vì xử lý nó. Mười hai nguyên lý là danh sách kiểm tra thiết kế:</p>
<ul>
<li>Ngăn chất thải; tối đa kinh tế nguyên tử; thiết kế hóa chất và tổng hợp an toàn hơn.</li>
<li>Dùng nguyên liệu tái tạo; tránh dẫn xuất hóa (nhóm bảo vệ); dùng xúc tác thay thuốc thử theo tỷ lượng.</li>
<li>Thiết kế để phân hủy; phân tích theo thời gian thực; chọn dung môi và điều kiện tiết kiệm năng lượng và an toàn vốn có.</li>
</ul>
<div class="example">Ibuprofen: quy trình Boots thập niên 1960 cho hiệu suất 40% qua sáu bước với AlCl₃ theo tỷ lượng. Quy trình BHC thập niên 1990 cho 77% trong ba bước với xúc tác palladi và gần như mọi nguyên tử đều vào sản phẩm.</div>
<p>Thay dung môi cũng quan trọng không kém: CO₂ siêu tới hạn, nước và chất lỏng ion thay dung môi clo hóa trong nhiều quy trình.</p>`)
        },
        {
          title: L('Atom Economy and E-factor', 'Kinh tế nguyên tử và hệ số E'),
          duration: 10,
          body: L(`
<h3>Two honest scorecards</h3>
<p>Yield measures how well a reaction ran. <b>Atom economy</b> measures whether the equation itself wastes atoms:</p>
<div class="formula">atom economy = (M of desired product / Σ M of all products) × 100</div>
<p>Addition reactions reach 100% because nothing is discarded. Substitution loses a fragment. Elimination loses a whole molecule, so it scores lowest of the three.</p>
<div class="example">Making CH₃Cl from CH₄ + Cl₂ gives HCl as a by-product: 50.5 / 84.5 ≈ 60% atom economy. Adding HCl to ethene would be 100%.</div>
<p>The E-factor counts kilograms of waste per kilogram of product. Bulk chemicals run near 0.1, fine chemicals 1–50, and pharmaceuticals often above 100 — most of it solvent.</p>
<p>A green process improves yield, atom economy and E-factor together; improving only yield while generating more waste is not progress.</p>`, `
<h3>Hai bảng điểm trung thực</h3>
<p>Hiệu suất đo phản ứng chạy tốt tới đâu. <b>Kinh tế nguyên tử</b> đo bản thân phương trình có lãng phí nguyên tử không:</p>
<div class="formula">kinh tế nguyên tử = (M sản phẩm mong muốn / Σ M mọi sản phẩm) × 100</div>
<p>Phản ứng cộng đạt 100% vì không bỏ gì. Phản ứng thế mất một mảnh. Phản ứng tách mất cả phân tử nên điểm thấp nhất trong ba loại.</p>
<div class="example">Điều chế CH₃Cl từ CH₄ + Cl₂ thải HCl: 50,5 / 84,5 ≈ 60% kinh tế nguyên tử. Cộng HCl vào ethene sẽ đạt 100%.</div>
<p>Hệ số E đếm kg chất thải trên kg sản phẩm. Hóa chất khối lượng chạy quanh 0,1, hóa chất tinh 1–50, và dược phẩm thường trên 100 — phần lớn là dung môi.</p>
<p>Quy trình xanh cải thiện đồng thời hiệu suất, kinh tế nguyên tử và hệ số E; chỉ tăng hiệu suất mà sinh thêm chất thải không phải tiến bộ.</p>`)
        }
      ],
      quiz: [
        {
          q: L('Which reaction type has 100% atom economy?', 'Loại phản ứng nào có kinh tế nguyên tử 100%?'),
          opts: [L('Substitution', 'Thế'), L('Elimination', 'Tách'), L('Addition', 'Cộng'), L('Combustion', 'Cháy')],
          a: 2,
          ex: L('Addition puts every reactant atom into the product.',
                'Phản ứng cộng đưa mọi nguyên tử chất đầu vào sản phẩm.')
        },
        {
          q: L('Catalysis supports green chemistry because the catalyst:',
               'Xúc tác hỗ trợ hóa học xanh vì nó:'),
          opts: [L('is consumed each cycle', 'bị tiêu thụ mỗi vòng'),
                 L('is regenerated and avoids stoichiometric waste', 'được tái sinh và tránh chất thải tỷ lượng'),
                 L('raises the yield above 100%', 'nâng hiệu suất trên 100%'),
                 L('changes the equilibrium constant', 'đổi hằng số cân bằng')],
          a: 1,
          ex: L('One catalytic site turns over thousands of molecules.',
                'Một vị trí xúc tác xử lý hàng nghìn phân tử.')
        },
        {
          q: L('The E-factor measures:', 'Hệ số E đo:'),
          opts: [L('energy per mole', 'năng lượng mỗi mol'), L('kg waste per kg product', 'kg chất thải mỗi kg sản phẩm'),
                 L('efficiency of catalysis', 'hiệu quả xúc tác'), L('environmental pH', 'pH môi trường')],
          a: 1,
          ex: L('Total mass of waste divided by mass of product.',
                'Tổng khối lượng chất thải chia khối lượng sản phẩm.')
        }
      ]
    },

    biochem: {
      color: '#f06292',
      sim: 'enzyme-kinetics',
      lessons: [
        {
          title: L('Enzymes and Michaelis–Menten Kinetics', 'Enzyme và động học Michaelis–Menten'),
          duration: 11,
          body: L(`
<h3>Catalysis with a lock and key</h3>
<p>Enzymes bind substrate at an active site, forming an ES complex, then release product. Binding is specific and it pays energy back by stabilising the transition state, which is how rate enhancements of 10¹² are reached.</p>
<div class="formula">v = Vmax · [S] / (Km + [S])</div>
<p>Vmax is the rate at full saturation and equals kcat·[E]total. Km is the substrate concentration at half Vmax and reports affinity: a low Km means tight binding.</p>
<div class="example">At [S] = Km the enzyme runs at exactly half its maximum rate — the definition used to measure Km.</div>
<p>Plot 1/v against 1/[S] (Lineweaver–Burk) to read Vmax and Km from the intercepts. Competitive inhibitors raise the apparent Km but leave Vmax reachable; non-competitive inhibitors lower Vmax because some enzyme is taken out of service.</p>`, `
<h3>Xúc tác theo mô hình khóa và chìa</h3>
<p>Enzyme gắn cơ chất tại vị trí hoạt động tạo phức ES rồi phóng thích sản phẩm. Gắn kết có tính đặc hiệu và hoàn năng lượng bằng cách ổn định trạng thái chuyển tiếp — đó là cách đạt mức tăng tốc 10¹².</p>
<div class="formula">v = Vmax · [S] / (Km + [S])</div>
<p>Vmax là tốc độ khi bão hòa hoàn toàn và bằng kcat·[E]tổng. Km là nồng độ cơ chất tại nửa Vmax, phản ánh ái lực: Km nhỏ nghĩa là gắn chặt.</p>
<div class="example">Tại [S] = Km enzyme chạy đúng một nửa tốc độ tối đa — định nghĩa dùng để đo Km.</div>
<p>Vẽ 1/v theo 1/[S] (Lineweaver–Burk) để đọc Vmax và Km từ các giao điểm. Ức chế cạnh tranh làm Km biểu kiến tăng nhưng vẫn đạt Vmax; ức chế không cạnh tranh làm Vmax giảm vì một phần enzyme bị loại khỏi vòng.</p>`)
        },
        {
          title: L('Biomolecules and Metabolism', 'Sinh phân tử và chuyển hóa'),
          duration: 10,
          body: L(`
<h3>Four polymers that do the work</h3>
<ul>
<li><b>Carbohydrates</b> — (CH₂O)ₙ, glucose is the fuel; cellulose and starch are polymers of the same monomer joined differently.</li>
<li><b>Lipids</b> — fats and membranes; long hydrocarbon chains store about twice the energy per gram of carbohydrate.</li>
<li><b>Proteins</b> — amino acid chains folded into shape; structure sets function, and denaturing destroys both.</li>
<li><b>Nucleic acids</b> — DNA stores information in base pairs, RNA carries and translates it.</li>
</ul>
<div class="formula">ATP + H₂O → ADP + Pi&nbsp;&nbsp;&nbsp;ΔG ≈ −30 kJ/mol</div>
<p>ATP is the currency that couples exergonic and endergonic steps. Glucose oxidation releases about 2870 kJ/mol, harvested in roughly 30 ATP rather than dumped as heat.</p>
<div class="example">Digestion is the reverse chemistry: hydrolysis breaks each polymer back to monomers so the body can rebuild them its own way.</div>`, `
<h3>Bốn polyme làm việc</h3>
<ul>
<li><b>Carbohydrate</b> — (CH₂O)ₙ, glucose là nhiên liệu; cellulose và tinh bột là polyme của cùng một monome nối khác cách.</li>
<li><b>Lipid</b> — mỡ và màng sinh chất; chuỗi hydrocarbon dài chứa năng lượng gấp khoảng hai lần carbohydrate theo gam.</li>
<li><b>Protein</b> — chuỗi amino acid cuộn thành cấu trúc; cấu trúc quyết định chức năng, biến tính phá cả hai.</li>
<li><b>Axit nucleic</b> — DNA lưu thông tin trong các cặp base, RNA truyền tải và dịch mã.</li>
</ul>
<div class="formula">ATP + H₂O → ADP + Pi&nbsp;&nbsp;&nbsp;ΔG ≈ −30 kJ/mol</div>
<p>ATP là đồng tiền nối bước tỏa năng lượng với bước thu năng lượng. Oxi hóa glucose giải phóng khoảng 2870 kJ/mol, thu được trong chừng 30 ATP thay vì xả ra thành nhiệt.</p>
<div class="example">Tiêu hóa là hóa học ngược: thủy phân phá mỗi polyme về monome để cơ thể xây lại theo cách riêng.</div>`)
        }
      ],
      quiz: [
        {
          q: L('When [S] equals Km, the reaction rate is:', 'Khi [S] bằng Km, tốc độ phản ứng là:'),
          opts: [L('Vmax', 'Vmax'), L('Vmax/2', 'Vmax/2'), L('2·Vmax', '2·Vmax'), L('zero', 'bằng 0')],
          a: 1,
          ex: L('v = Vmax·Km/(Km+Km) = Vmax/2.', 'v = Vmax·Km/(Km+Km) = Vmax/2.')
        },
        {
          q: L('A competitive inhibitor changes the kinetics by:', 'Chất ức chế cạnh tranh thay đổi động học bằng:'),
          opts: [L('lowering Vmax', 'giảm Vmax'), L('raising apparent Km', 'tăng Km biểu kiến'),
                 L('destroying the enzyme', 'phá enzyme'), L('raising Vmax', 'tăng Vmax')],
          a: 1,
          ex: L('More substrate out-competes it, so Vmax stays reachable.',
                'Thêm cơ chất thắng cạnh tranh nên vẫn đạt Vmax.')
        },
        {
          q: L('ATP drives endergonic reactions by:', 'ATP thúc đẩy phản ứng thu năng lượng bằng:'),
          opts: [L('raising temperature', 'tăng nhiệt độ'), L('coupling its hydrolysis', 'nối với thủy phân của nó'),
                 L('acting as a reductant', 'làm chất khử'), L('lowering Km', 'giảm Km')],
          a: 1,
          ex: L('The combined ΔG of the couple is negative.', 'ΔG tổng của cặp phản ứng âm.')
        }
      ]
    }
  });

  // ---------- Topic order & DOM ----------
  const TOPIC_ORDER = ['atomic', 'bonding', 'reactions', 'thermo', 'kinetics', 'solutions',
    'acid-base', 'electro', 'organic', 'nuclear', 'spectroscopy', 'gas-laws', 'crystal',
    'quantum', 'equilibrium', 'photochem', 'surface', 'analytical', 'green', 'biochem'];

  const $ = function(id) { return document.getElementById(id); };

  const els = {
    back: $('btn-back'), lang: $('btn-lang'), selector: $('topic-selector'),
    progressBtn: $('btn-progress'), nav: $('lesson-nav'), content: $('lesson-content'),
    simArea: $('simulation-area'), reset: $('btn-reset'), play: $('btn-play'),
    pause: $('btn-pause'), canvas: $('simulation-canvas'), params: $('sim-params'),
    assessment: $('assessment-panel'), quiz: $('quiz-container'), submit: $('btn-submit-answer'),
    feedback: $('feedback-area'), ptable: $('mini-ptable'), calcInput: $('calc-input'),
    calcBtn: $('btn-calculate'), calcResult: $('calc-result'), modal: $('progress-modal'),
    statLessons: $('stat-lessons'), statQuizzes: $('stat-quizzes'), statScore: $('stat-score'),
    progressCanvas: $('progress-canvas'), headerTitle: document.querySelector('.header-left h1'),
    sidebarTitle: document.querySelector('.sidebar-header h2'),
    simTitle: document.querySelector('.sim-header h3'),
    assessTitle: document.querySelector('.assessment-panel h3'),
    refTitles: document.querySelectorAll('.ref-section h3')
  };

  const ctx = els.canvas ? els.canvas.getContext('2d') : null;

  let currentTopic = 'overview';
  let currentLessonIndex = 0;
  let selectedAnswer = -1;
  let quizAnswered = false;

  const progress = { lessonsCompleted: 0, quizzesPassed: 0, scores: [] };
  const doneLessons = {};
  const doneQuizzes = {};

  function saveProgress() {
    try {
      localStorage.setItem('tm-progress', JSON.stringify({
        progress: progress, doneLessons: doneLessons, doneQuizzes: doneQuizzes, lang: currentLang
      }));
    } catch (e) { /* storage unavailable */ }
  }

  function loadProgress() {
    try {
      const raw = localStorage.getItem('tm-progress');
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d && d.progress) {
        progress.lessonsCompleted = d.progress.lessonsCompleted || 0;
        progress.quizzesPassed = d.progress.quizzesPassed || 0;
        progress.scores = d.progress.scores || [];
      }
      if (d && d.doneLessons) Object.assign(doneLessons, d.doneLessons);
      if (d && d.doneQuizzes) Object.assign(doneQuizzes, d.doneQuizzes);
    } catch (e) { /* ignore corrupt state */ }
  }

  function totalLessons() {
    let n = 0;
    for (const k in LESSONS) n += LESSONS[k].lessons.length;
    return n;
  }

  function totalQuizQuestions() {
    let n = 0;
    for (const k in LESSONS) n += LESSONS[k].quiz.length;
    return n;
  }

  // ---------- Canvas helpers ----------
  function fitCanvas() {
    if (!els.canvas) return;
    const host = els.canvas.parentElement;
    const w = Math.max(320, host.clientWidth - 8);
    const h = Math.max(220, Math.min(360, host.clientHeight || 300));
    const dpr = window.devicePixelRatio || 1;
    if (ctx && ctx.W === w && ctx.H === h) return;
    els.canvas.width = Math.round(w * dpr);
    els.canvas.height = Math.round(h * dpr);
    els.canvas.style.width = w + 'px';
    els.canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.W = w;
    ctx.H = h;
  }

  function clearCanvas() {
    fitCanvas();
    ctx.fillStyle = '#0b0b16';
    ctx.fillRect(0, 0, ctx.W, ctx.H);
  }

  function label(text, x, y, color, size, align) {
    ctx.fillStyle = color || '#e8e8f0';
    ctx.font = (size || 12) + 'px "Segoe UI", sans-serif';
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
    ctx.textAlign = 'left';
  }

  function box(x, y, w, h, stroke, fill) {
    if (fill) { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); }
    ctx.strokeStyle = stroke || '#3a3a5c';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
  }

  function sphere(x, y, r, color) {
    const g = ctx.createRadialGradient(x - r / 3, y - r / 3, r / 8, x, y, r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.35, color);
    g.addColorStop(1, shade(color, -0.5));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.max(0, Math.min(255, Math.round(r + 255 * amt)));
    g = Math.max(0, Math.min(255, Math.round(g + 255 * amt)));
    b = Math.max(0, Math.min(255, Math.round(b + 255 * amt)));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function legend(items, x, y) {
    for (let i = 0; i < items.length; i++) {
      ctx.fillStyle = items[i].c;
      ctx.beginPath();
      ctx.arc(x + 6, y + i * 16, 5, 0, Math.PI * 2);
      ctx.fill();
      label(items[i].t, x + 17, y + i * 16, '#a8dadc', 11);
    }
  }

  // ---------- Rendering ----------
  function renderNav() {
    if (!els.nav) return;
    const topic = LESSONS[currentTopic];
    if (!topic) { els.nav.innerHTML = ''; return; }
    let html = '';
    for (let i = 0; i < topic.lessons.length; i++) {
      const ls = topic.lessons[i];
      const done = doneLessons[currentTopic + ':' + i];
      const cls = 'lesson-item' + (i === currentLessonIndex ? ' active' : '') + (done ? ' completed' : '');
      html += '<div class="' + cls + '" data-lesson="' + i + '">' +
        '<div class="lesson-title">' + (i + 1) + '. ' + c(ls.title) + '</div>' +
        '<div class="lesson-duration">' + (done ? t('completed') : ls.duration + ' ' + t('min')) + '</div>' +
        '</div>';
    }
    els.nav.innerHTML = html;
    Array.prototype.forEach.call(els.nav.querySelectorAll('.lesson-item'), function(el) {
      el.addEventListener('click', function() {
        currentLessonIndex = parseInt(el.getAttribute('data-lesson'), 10);
        renderLesson();
        renderNav();
      });
    });
  }

  function renderLesson() {
    if (!els.content) return;
    const topic = LESSONS[currentTopic];
    if (!topic) return;
    const ls = topic.lessons[currentLessonIndex] || topic.lessons[0];
    const accent = topic.color;
    els.content.innerHTML =
      '<h2 style="color:' + accent + '">' + tc(currentTopic) + '</h2>' +
      '<h3 style="margin-top:2px">' + c(ls.title) + '</h3>' +
      '<div style="font-size:11px;opacity:.6;margin-bottom:10px">' +
      t('lesson') + ' ' + (currentLessonIndex + 1) + ' / ' + topic.lessons.length +
      ' &nbsp;·&nbsp; ' + ls.duration + ' ' + t('min') + '</div>' +
      c(ls.body) +
      '<button class="btn-primary" id="btn-mark-done" style="margin-top:14px">' + t('markDone') + '</button>';
    const mb = $('btn-mark-done');
    if (mb) {
      mb.addEventListener('click', function() {
        const key = currentTopic + ':' + currentLessonIndex;
        if (!doneLessons[key]) {
          doneLessons[key] = true;
          progress.lessonsCompleted++;
          saveProgress();
        }
        renderNav();
      });
    }
  }

  function renderOverview() {
    if (!els.content) return;
    const donePct = totalLessons() ? Math.round(100 * progress.lessonsCompleted / totalLessons()) : 0;
    let rows = '';
    for (let i = 0; i < TOPIC_ORDER.length; i++) {
      const k = TOPIC_ORDER[i];
      const tp = LESSONS[k];
      if (!tp) continue;
      let done = 0;
      for (let j = 0; j < tp.lessons.length; j++) if (doneLessons[k + ':' + j]) done++;
      rows += '<div class="constant-item" data-topic="' + k + '" style="cursor:pointer">' +
        '<span class="const-name"><span style="color:' + tp.color + '">●</span> ' + tc(k) + '</span>' +
        '<span class="const-value">' + done + '/' + tp.lessons.length + '</span></div>';
    }
    els.content.innerHTML =
      '<h2 style="color:#e94560">' + t('overview') + '</h2>' +
      '<p>' + t('courseIntro') + '</p>' +
      '<div class="progress-stats" style="grid-template-columns:repeat(3,1fr)">' +
      '<div class="stat-card"><div class="stat-value">' + TOPIC_ORDER.length + '</div><div class="stat-label">' + t('courseTopics') + '</div></div>' +
      '<div class="stat-card"><div class="stat-value">' + totalLessons() + '</div><div class="stat-label">' + t('totalLessons') + '</div></div>' +
      '<div class="stat-card"><div class="stat-value">' + donePct + '%</div><div class="stat-label">' + t('courseProgress') + '</div></div>' +
      '</div>' +
      '<div class="constants-list" style="margin-top:14px">' + rows + '</div>';
    Array.prototype.forEach.call(els.content.querySelectorAll('[data-topic]'), function(el) {
      el.addEventListener('click', function() {
        loadTopic(el.getAttribute('data-topic'));
      });
    });
    if (els.nav) els.nav.innerHTML = '<div style="padding:10px;font-size:12px;opacity:.7">' + t('startFirst') + '</div>';
  }

  function renderQuiz() {
    if (!els.quiz) return;
    const topic = LESSONS[currentTopic];
    selectedAnswer = -1;
    quizAnswered = false;
    if (!topic) { els.quiz.innerHTML = ''; return; }
    let html = '';
    for (let i = 0; i < topic.quiz.length; i++) {
      const q = topic.quiz[i];
      html += '<div class="quiz-question"><div style="font-weight:600;margin-bottom:8px">' +
        t('question') + ' ' + (i + 1) + ': ' + c(q.q) + '</div><div class="quiz-options" data-q="' + i + '">';
      for (let j = 0; j < q.opts.length; j++) {
        html += '<div class="quiz-option" data-q="' + i + '" data-opt="' + j + '">' + c(q.opts[j]) + '</div>';
      }
      html += '</div></div>';
    }
    els.quiz.innerHTML = html;
    if (els.feedback) { els.feedback.textContent = ''; els.feedback.className = 'feedback-area'; }
    if (els.submit) els.submit.disabled = false;
    Array.prototype.forEach.call(els.quiz.querySelectorAll('.quiz-option'), function(el) {
      el.addEventListener('click', function() {
        if (quizAnswered) return;
        const qi = parseInt(el.getAttribute('data-q'), 10);
        const oi = parseInt(el.getAttribute('data-opt'), 10);
        Array.prototype.forEach.call(els.quiz.querySelectorAll('.quiz-option[data-q="' + qi + '"]'), function(o) {
          o.classList.remove('selected');
        });
        el.classList.add('selected');
        selectedAnswers[qi] = oi;
      });
    });
  }

  const selectedAnswers = {};

  function gradeQuiz() {
    const topic = LESSONS[currentTopic];
    if (!topic || quizAnswered) return;
    if (Object.keys(selectedAnswers).length === 0) {
      if (els.feedback) {
        els.feedback.className = 'feedback-area incorrect';
        els.feedback.textContent = t('selectAnswer');
      }
      return;
    }
    let correct = 0;
    for (let i = 0; i < topic.quiz.length; i++) {
      const q = topic.quiz[i];
      const picked = selectedAnswers[i];
      const opts = els.quiz.querySelectorAll('.quiz-option[data-q="' + i + '"]');
      Array.prototype.forEach.call(opts, function(el, j) {
        el.classList.remove('selected');
        if (j === q.a) el.classList.add('correct');
        else if (j === picked) el.classList.add('incorrect');
      });
      if (picked === q.a) correct++;
    }
    const pct = Math.round(100 * correct / topic.quiz.length);
    progress.scores.push(pct);
    const key = currentTopic + ':quiz';
    if (pct >= 60 && !doneQuizzes[key]) {
      doneQuizzes[key] = true;
      progress.quizzesPassed++;
    }
    saveProgress();
    quizAnswered = true;
    if (els.submit) els.submit.disabled = true;
    if (els.feedback) {
      let notes = '';
      for (let i = 0; i < topic.quiz.length; i++) {
        notes += (i + 1) + '. ' + c(topic.quiz[i].ex) + '  ';
      }
      els.feedback.className = 'feedback-area ' + (pct >= 60 ? 'correct' : 'incorrect');
      els.feedback.textContent = t(pct >= 60 ? 'correct' : 'incorrect') + ' ' +
        t('score') + ': ' + correct + ' ' + t('of') + ' ' + topic.quiz.length + ' (' + pct + '%). ' +
        (pct >= 60 ? t('wellDone') : t('reviewText')) + ' ' + notes;
    }
    for (const k in selectedAnswers) delete selectedAnswers[k];
  }

  // ---------- Simulation registry ----------
  const C = { accent: '#e94560', green: '#4caf50', blue: '#2196f3', yellow: '#ffeb3b',
    dim: '#a8dadc', red: '#f44336', purple: '#9575cd', grid: '#24243f', text: '#e8e8f0' };

  function slider(id, text, min, max, step, val, unit) {
    return '<div class="param-control"><label for="' + id + '">' + text +
      ' <span class="param-value" id="val-' + id + '">' + val + (unit || '') + '</span></label>' +
      '<input type="range" id="' + id + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '"></div>';
  }

  function drop(id, text, opts) {
    let h = '<div class="param-control"><label for="' + id + '">' + text + '</label><select id="' + id + '" style="width:100%;background:#1a1a2e;color:#e8e8f0;border:1px solid #3a3a5c;border-radius:6px;padding:6px">';
    for (let i = 0; i < opts.length; i++) h += '<option value="' + opts[i].v + '">' + opts[i].l + '</option>';
    return h + '</select></div>';
  }

  const simState = { playing: false, time: 0, raf: 0, last: 0 };
  let params = {};

  function readParams() {
    params = {};
    const inputs = els.params ? els.params.querySelectorAll('input, select') : [];
    Array.prototype.forEach.call(inputs, function(inp) {
      let v = inp.value;
      if (inp.type === 'range' || inp.type === 'number') v = parseFloat(v) || 0;
      params[inp.id] = v;
      const out = $('val-' + inp.id);
      if (out && inp.type === 'range') {
        const u = out.getAttribute('data-unit') || (out.textContent.match(/[^\d.\-+]+$/) || [''])[0];
        out.textContent = v + (u || '');
      }
    });
    params.time = simState.time;
  }

  function currentSim() {
    const topic = LESSONS[currentTopic];
    return (topic && SIMS[topic.sim]) ? SIMS[topic.sim] : null;
  }

  function drawSim() {
    if (!ctx) return;
    const sim = currentSim();
    if (!sim) return;
    readParams();
    clearCanvas();
    try { sim.d(ctx, params); } catch (e) { /* a broken draw must not kill the page */ }
  }

  function loadSim() {
    const sim = currentSim();
    if (!els.params) return;
    stopLoop();
    if (!sim) {
      els.params.innerHTML = '';
      els.simArea.style.display = 'none';
      return;
    }
    els.simArea.style.display = '';
    els.params.innerHTML = sim.p();
    Array.prototype.forEach.call(els.params.querySelectorAll('input, select'), function(inp) {
      inp.addEventListener('input', drawSim);
      inp.addEventListener('change', drawSim);
    });
    simState.time = 0;
    simState.playing = false;
    drawSim();
  }

  function loop(ts) {
    if (!simState.playing) return;
    if (!simState.last) simState.last = ts;
    simState.time += Math.min(0.1, (ts - simState.last) / 1000);
    simState.last = ts;
    drawSim();
    simState.raf = requestAnimationFrame(loop);
  }

  function stopLoop() {
    simState.playing = false;
    simState.last = 0;
    if (simState.raf) cancelAnimationFrame(simState.raf);
    simState.raf = 0;
  }

  // ---------- Draw routines ----------
  function drawAtomBuilder(ctx, p) {
    const cx = ctx.W * 0.42, cy = ctx.H * 0.5;
    const protons = Math.round(p['param-protons'] || 1);
    const neutrons = Math.round(p['param-neutrons'] || 0);
    const electrons = Math.round(p['param-electrons'] || protons);
    const syms = ['H', 'He', 'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne', 'Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'K', 'Ca', 'Fe', 'Cu', 'Zn'];
    const sym = syms[protons - 1] || ('Z' + protons);

    // nucleus: packed nucleons
    const nucleons = protons + neutrons;
    const nr = 6 + Math.sqrt(nucleons) * 3.2;
    let placed = 0;
    for (let ring = 0; placed < protons; ring++) {
      const cap = ring === 0 ? 1 : Math.max(1, Math.floor(2 * Math.PI * ring * 6 / 9));
      for (let i = 0; i < cap && placed < protons; i++) {
        const a = (i / cap) * Math.PI * 2 + ring;
        const r = ring === 0 ? 0 : ring * 7;
        sphere(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 5, C.red);
        placed++;
      }
    }
    for (let ring = 0; placed < nucleons; ring++) {
      const cap = ring === 0 ? 2 : Math.max(1, Math.floor(2 * Math.PI * ring * 6 / 9));
      for (let i = 0; i < cap && placed < nucleons; i++) {
        const a = (i / cap) * Math.PI * 2 + ring * 0.7;
        const r = ring === 0 ? 5 : ring * 7;
        sphere(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 5, '#7b8bb5');
        placed++;
      }
    }
    label('+' + protons, cx, cy, '#fff', 11, 'center');

    // shells, 2n² capacity
    let left = electrons;
    for (let n = 1; n <= 4 && left > 0; n++) {
      const cap = 2 * n * n;
      const cnt = Math.min(cap, left);
      const r = 44 + n * 26;
      ctx.strokeStyle = C.grid;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < cnt; i++) {
        const a = (i / cnt) * Math.PI * 2 + simState.time * (0.6 / n);
        sphere(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 4.5, C.yellow);
      }
      label('n=' + n + ' (' + cnt + ')', cx + r + 4, cy - r * 0.7, C.dim, 10);
      left -= cnt;
    }

    const charge = protons - electrons;
    label(sym, 14, 22, C.accent, 26);
    label('Z = ' + protons + '   N = ' + neutrons + '   A = ' + (protons + neutrons), 14, 48, C.text, 12);
    label(charge === 0 ? 'neutral atom' : (charge > 0 ? 'cation ' + charge + '+' : 'anion ' + (-charge) + '−'),
      14, 66, charge === 0 ? C.green : C.purple, 12);
    legend([{ c: C.red, t: 'proton' }, { c: '#7b8bb5', t: 'neutron' }, { c: C.yellow, t: 'electron' }], ctx.W - 90, 20);
  }

  function drawIonicBond(ctx, p) {
    const cx = ctx.W / 2, cy = ctx.H / 2 - 8;
    const metal = p['param-metal'] || 'Na';
    const nonmetal = p['param-nonmetal'] || 'Cl';
    const mShell = { Na: [2, 8, 1], K: [2, 8, 8, 1], Li: [2, 1], Mg: [2, 8, 2], Ca: [2, 8, 8, 2] }[metal] || [2, 8, 1];
    const nShell = { Cl: [2, 8, 7], F: [2, 7], O: [2, 6], Br: [2, 8, 18, 7], S: [2, 8, 6] }[nonmetal] || [2, 8, 7];
    const give = mShell[mShell.length - 1];
    const need = 8 - nShell[nShell.length - 1];
    const done = p['param-progress'] !== undefined ? p['param-progress'] : 100;
    const frac = Math.max(0, Math.min(1, done / 100));

    function atom(x, shells, name, tone) {
      ctx.strokeStyle = C.grid;
      ctx.beginPath(); ctx.arc(x, cy, 30 + shells.length * 9, 0, Math.PI * 2); ctx.stroke();
      label(name, x, cy, tone, 15, 'center');
      for (let s = 0; s < shells.length; s++) {
        const r = 16 + s * 9;
        for (let i = 0; i < shells[s]; i++) {
          const a = (i / shells[s]) * Math.PI * 2;
          ctx.fillStyle = C.yellow;
          ctx.beginPath(); ctx.arc(x + Math.cos(a) * r, cy + Math.sin(a) * r, 2.6, 0, Math.PI * 2); ctx.fill();
        }
      }
    }

    const mx = cx - 120, nx = cx + 120;
    atom(mx, mShell.slice(0, mShell.length - 1).concat([0]), metal, C.blue);
    atom(nx, nShell, nonmetal, C.green);

    // transfer arrows
    for (let i = 0; i < give; i++) {
      const t = Math.min(1, frac * give - i);
      if (t <= 0) continue;
      const x = mx + (nx - mx) * t;
      const y = cy - 46 - i * 8 + Math.sin(t * Math.PI) * -14;
      ctx.fillStyle = C.yellow;
      ctx.beginPath(); ctx.arc(x, y, 3.4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = C.dim; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(mx + 40, cy - 50); ctx.lineTo(nx - 40, cy - 50); ctx.stroke();
    ctx.setLineDash([]);

    label(metal + ' → ' + metal + '⁺ + ' + give + 'e⁻', 14, ctx.H - 40, C.text, 12);
    label(nonmetal + ' + ' + give + 'e⁻ → ' + nonmetal + '⁻', 14, ctx.H - 22, C.text, 12);
    label(frac >= 1 ? 'ionic lattice: ' + metal + nonmetal : 'electron transfer ' + Math.round(frac * 100) + '%',
      ctx.W - 14, ctx.H - 22, frac >= 1 ? C.green : C.yellow, 12, 'right');
  }

  function drawCovalentBond(ctx, p) {
    const cx = ctx.W / 2, cy = ctx.H / 2;
    const mol = p['param-molecule'] || 'H2O';
    const data = {
      H2: { a: ['H', 'H'], sh: 1, d: 1 }, Cl2: { a: ['Cl', 'Cl'], sh: 7, d: 1 },
      H2O: { a: ['H', 'O', 'H'], sh: 6, d: 1 }, CO2: { a: ['O', 'C', 'O'], sh: 4, d: 2 },
      CH4: { a: ['H', 'C', 'H', 'H', 'H'], sh: 4, d: 1 }, NH3: { a: ['H', 'N', 'H', 'H'], sh: 5, d: 1 },
      O2: { a: ['O', 'O'], sh: 6, d: 2 }, N2: { a: ['N', 'N'], sh: 5, d: 3 }
    }[mol] || { a: ['H', 'H'], sh: 1, d: 1 };

    const central = data.a.length > 2 ? 1 : -1;
    const en = { H: 2.20, C: 2.55, N: 3.04, O: 3.44, F: 3.98, Cl: 3.16, Br: 2.96, S: 2.58, I: 2.66 };
    let dEN = 0;
    if (central >= 0) {
      for (let i = 0; i < data.a.length; i++) {
        if (i === central) continue;
        dEN = Math.max(dEN, Math.abs((en[data.a[i]] || 0) - (en[data.a[central]] || 0)));
      }
    } else dEN = 0;

    const spread = mol === 'CH4' || mol === 'NH3' ? 70 : 78;
    if (central >= 0) {
      const c = data.a[central];
      sphere(cx, cy, 26, c === 'C' ? '#6b6b8a' : (c === 'O' ? C.red : (c === 'N' ? C.blue : C.purple)));
      label(c, cx, cy, '#fff', 15, 'center');
      const ang = (data.a.length - 1);
      for (let i = 0; i < ang; i++) {
        const a = -Math.PI / 2 + i * (Math.PI * 2 / ang);
        const x = cx + Math.cos(a) * spread, y = cy + Math.sin(a) * spread * 0.75;
        ctx.strokeStyle = C.dim; ctx.lineWidth = 2 + data.d;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke();
        ctx.lineWidth = 1;
        sphere(x, y, 18, C.accent);
        label(data.a[i === 0 ? 0 : i + 1], x, y, '#fff', 13, 'center');
      }
    } else {
      for (let k = 0; k < 2; k++) {
        const x = cx + (k ? spread : -spread);
        sphere(x, cy, 26, k ? C.green : C.accent);
        label(data.a[k], x, cy, '#fff', 15, 'center');
      }
      for (let b = 0; b < data.d; b++) {
        ctx.strokeStyle = C.dim; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cx - 34, cy + (b - (data.d - 1) / 2) * 7);
        ctx.lineTo(cx + 34, cy + (b - (data.d - 1) / 2) * 7); ctx.stroke();
      }
      ctx.lineWidth = 1;
    }

    // shared pair density
    ctx.fillStyle = 'rgba(255,235,59,0.18)';
    ctx.beginPath(); ctx.ellipse(cx, cy, 30, 18, 0, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < data.d * 2; i++) {
      const a = simState.time * 1.6 + i * Math.PI / data.d;
      ctx.fillStyle = C.yellow;
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 22, cy + Math.sin(a) * 11, 3, 0, Math.PI * 2); ctx.fill();
    }

    const kind = dEN < 0.4 ? 'nonpolar covalent' : (dEN < 1.7 ? 'polar covalent' : 'ionic');
    label(mol + '  ·  ' + data.d + ' bond order  ·  ΔEN ≈ ' + dEN.toFixed(2), 14, 22, C.text, 13);
    label(kind, 14, 42, dEN < 0.4 ? C.blue : (dEN < 1.7 ? C.yellow : C.red), 13);
    if (dEN >= 0.4 && dEN < 1.7) label('δ+ / δ− across the bond', 14, 60, C.dim, 11);
  }

  function drawBalanceEquation(ctx, p) {
    const eq = String(p['param-equation'] || '2 H2 + O2 -> 2 H2O');
    const cx = ctx.W / 2;
    label('Balancing check', cx, 20, C.dim, 11, 'center');
    const parts = eq.split(/->|→/);
    const side = [parts[0] || '', parts[1] || ''];
    const count = [];
    for (let s = 0; s < 2; s++) {
      const map = {};
      side[s].split('+').forEach(function(term) {
        const m = term.trim().match(/^(\d*)\s*([A-Za-z][a-z]?\d*)/);
        if (!m) return;
        const coef = m[1] ? parseInt(m[1], 10) : 1;
        const body = m[2];
        const re = /([A-Z][a-z]?)(\d*)/g;
        let g;
        while ((g = re.exec(body)) !== null) {
          map[g[1]] = (map[g[1]] || 0) + coef * (g[2] ? parseInt(g[2], 10) : 1);
        }
      });
      count.push(map);
    }
    const keys = Object.keys(count[0]).concat(Object.keys(count[1]).filter(function(k) { return !count[0][k] && count[0][k] !== 0; }));
    const uniq = keys.filter(function(k, i) { return keys.indexOf(k) === i; });
    let y = 60;
    let allOK = true;
    uniq.forEach(function(el) {
      const a = count[0][el] || 0, b = count[1][el] || 0;
      const ok = a === b;
      if (!ok) allOK = false;
      label(el, cx - 90, y, C.text, 13);
      label(a + ' / ' + b, cx + 10, y, ok ? C.green : C.red, 13, 'center');
      ctx.fillStyle = ok ? C.green : C.red;
      ctx.beginPath(); ctx.arc(cx + 80, y, 4, 0, Math.PI * 2); ctx.fill();
      y += 24;
    });
    label(side[0].trim() + '   →   ' + side[1].trim(), cx, ctx.H - 34, C.text, 12, 'center');
    label(allOK ? 'balanced: mass is conserved' : 'NOT balanced — adjust the coefficients',
      cx, ctx.H - 14, allOK ? C.green : C.red, 12, 'center');
  }

  function drawCalorimetry(ctx, p) {
    const cx = ctx.W / 2, cy = ctx.H / 2 + 10;
    const mass = (parseFloat(p['param-mass']) || 100) / 1000;
    const c = parseFloat(p['param-specific']) || 4184;
    const dT = parseFloat(p['param-deltat']) || 10;
    const q = mass * c * dT;
    const liquid = Math.min(0.8, 0.25 + mass * 0.35);

    box(cx - 70, cy - 70, 140, 140, C.dim, '#141428');
    ctx.fillStyle = 'rgba(33,150,243,' + (0.35 + dT / 100) + ')';
    ctx.fillRect(cx - 64, cy + 64 - 128 * liquid, 128, 128 * liquid);
    // thermometer
    box(cx + 82, cy - 70, 12, 120, C.dim, '#0b0b16');
    const th = Math.max(0.05, Math.min(1, (dT + 20) / 120));
    ctx.fillStyle = C.red;
    ctx.fillRect(cx + 84, cy + 46 - 116 * th, 8, 116 * th);
    label('°C', cx + 88, cy - 78, C.dim, 10, 'center');
    // stirrer
    ctx.strokeStyle = C.purple;
    ctx.beginPath(); ctx.moveTo(cx - 40, cy - 90); ctx.lineTo(cx - 40, cy + 30); ctx.stroke();

    for (let i = 0; i < 8; i++) {
      const t = (simState.time * 0.6 + i / 8) % 1;
      ctx.fillStyle = 'rgba(255,255,255,' + (0.25 * (1 - t)) + ')';
      ctx.beginPath();
      ctx.arc(cx - 40 + (i % 4) * 22, cy + 40 - t * 90, 3 + t * 4, 0, Math.PI * 2);
      ctx.fill();
    }

    label('q = m·c·ΔT', 14, 22, C.accent, 15);
    label('m = ' + mass.toFixed(3) + ' kg', 14, 46, C.text, 12);
    label('c = ' + c + ' J/(kg·K)', 14, 64, C.text, 12);
    label('ΔT = ' + dT + ' K', 14, 82, C.text, 12);
    label('q = ' + (q / 1000).toFixed(2) + ' kJ', 14, 106, C.green, 15);
    label(q > 0 ? 'absorbed by the water' : 'released', 14, 126, C.dim, 11);
  }

  function drawReactionRate(ctx, p) {
    const x0 = 46, y0 = ctx.H - 40, w = ctx.W - 70, h = ctx.H - 76;
    const Ea = parseFloat(p['param-ea']) || 60;
    const T = parseFloat(p['param-temp']) || 298;
    const k = Math.exp(-Ea * 1000 / (8.314 * T));
    const A = 1e9;
    const rate = A * k;
    ctx.strokeStyle = C.grid;
    box(x0, y0 - h, w, h, C.grid);
    label('progress →', x0 + w / 2, ctx.H - 20, C.dim, 11, 'center');
    label('concentration', 12, y0 - h / 2, C.dim, 11, 'left');

    const tmax = 100;
    const half = Math.max(0.5, 30 / (rate * 1e5));
    // reactant and product curves
    ctx.strokeStyle = C.red; ctx.beginPath();
    for (let i = 0; i <= 100; i++) {
      const t = i / 100 * tmax;
      const x = x0 + w * (t / tmax);
      const y = y0 - h * Math.exp(-t / half);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    ctx.strokeStyle = C.green; ctx.beginPath();
    for (let i = 0; i <= 100; i++) {
      const t = i / 100 * tmax;
      const x = x0 + w * (t / tmax);
      const y = y0 - h * (1 - Math.exp(-t / half));
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();

    // marker at elapsed time
    const tt = Math.min(tmax, simState.time * 12);
    const px = x0 + w * (tt / tmax);
    ctx.strokeStyle = C.yellow; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(px, y0 - h); ctx.lineTo(px, y0); ctx.stroke(); ctx.setLineDash([]);
    label('[A]', x0 + w - 4, y0 - h * Math.exp(-tt / half), C.red, 11, 'right');
    label('[P]', x0 + w - 4, y0 - h * (1 - Math.exp(-tt / half)), C.green, 11, 'right');

    // energy profile inset
    const bx = ctx.W - 150, by = 24, bw = 130, bh = 70;
    box(bx, by, bw, bh, C.grid, 'rgba(0,0,0,0.35)');
    ctx.strokeStyle = C.blue; ctx.beginPath();
    ctx.moveTo(bx + 6, by + bh - 16);
    ctx.lineTo(bx + 40, by + 12);
    ctx.lineTo(bx + bw - 6, by + bh - 34);
    ctx.stroke();
    label('Ea = ' + Ea + ' kJ/mol', bx + 6, by + bh + 14, C.text, 11);
    label('T = ' + T + ' K', bx + 6, by - 12, C.text, 11);
    label('k = ' + rate.toExponential(2) + ' s⁻¹', 14, ctx.H - 60, C.yellow, 12);
  }

  function drawSolutionPrep(ctx, p) {
    const cx = ctx.W / 2, cy = ctx.H / 2 + 10;
    const M = parseFloat(p['param-molarity']) || 0.5;
    const V = parseFloat(p['param-volume']) || 250;
    const mol = M * V / 1000;
    const gram = mol * (parseFloat(p['param-mm']) || 58.44);

    // volumetric flask
    ctx.strokeStyle = C.dim; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy - 90); ctx.lineTo(cx - 10, cy - 46);
    ctx.lineTo(cx - 52, cy + 26); ctx.quadraticCurveTo(cx - 56, cy + 62, cx - 20, cy + 66);
    ctx.lineTo(cx + 20, cy + 66); ctx.quadraticCurveTo(cx + 56, cy + 62, cx + 52, cy + 26);
    ctx.lineTo(cx + 10, cy - 46); ctx.lineTo(cx + 10, cy - 90);
    ctx.stroke(); ctx.lineWidth = 1;
    ctx.strokeStyle = C.yellow;
    ctx.beginPath(); ctx.moveTo(cx - 26, cy - 4); ctx.lineTo(cx + 26, cy - 4); ctx.stroke();
    const fill = Math.max(0, Math.min(1, (parseFloat(p['param-fill']) || 100) / 100));
    if (fill > 0) {
      ctx.fillStyle = 'rgba(38,198,218,0.4)';
      const top = cy + 62 - fill * 66;
      ctx.beginPath();
      ctx.moveTo(cx - 50, cy + 26);
      ctx.lineTo(cx + 50, cy + 26);
      ctx.lineTo(cx + 20, cy + 64); ctx.lineTo(cx - 20, cy + 64);
      ctx.closePath(); ctx.fill();
      if (fill > 0.75) { ctx.fillRect(cx - 8, cy - 4 - (fill - 0.75) * 40, 16, (fill - 0.75) * 40); }
    }

    const n = Math.min(60, Math.round(mol * 200));
    for (let i = 0; i < n; i++) {
      const a = i * 2.39996, r = 4 + 11 * Math.sqrt(i);
      const x = cx + Math.cos(a) * r * 1.6, y = cy + 34 + Math.sin(a) * r * 0.5;
      if (y < cy + 62 && y > cy - 4) {
        ctx.fillStyle = 'rgba(233,69,96,0.9)';
        ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2); ctx.fill();
      }
    }

    label('n = M × V', 14, 22, C.accent, 15);
    label(M.toFixed(3) + ' mol/L × ' + V + ' mL', 14, 46, C.text, 12);
    label('= ' + mol.toFixed(4) + ' mol', 14, 64, C.blue, 13);
    label('= ' + gram.toFixed(3) + ' g of solute', 14, 82, C.green, 13);
    label('meniscus at the mark: ' + Math.round(fill * 100) + '%', cx, ctx.H - 14, fill > 0.97 && fill < 1.0 ? C.green : C.yellow, 11, 'center');
  }

  function drawPHCalc(ctx, p) {
    const conc = parseFloat(p['param-conc']) || 0.01;
    const Ka = Math.pow(10, -(parseFloat(p['param-pka']) || 4.76));
    const strong = (p['param-kind'] || 'weak') === 'strong';
    let h;
    if (strong) h = conc;
    else h = (-Ka + Math.sqrt(Ka * Ka + 4 * Ka * conc)) / 2;
    const pH = -Math.log10(h);
    const pOH = 14 - pH;
    const alpha = strong ? 1 : h / conc;

    const barX = 30, barW = ctx.W - 60, barY = 40;
    const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    grad.addColorStop(0, '#d32f2f'); grad.addColorStop(0.5, '#43a047'); grad.addColorStop(1, '#283593');
    ctx.fillStyle = grad;
    ctx.fillRect(barX, barY, barW, 26);
    for (let i = 0; i <= 14; i++) {
      const x = barX + barW * i / 14;
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath(); ctx.moveTo(x, barY); ctx.lineTo(x, barY + 26); ctx.stroke();
      label(String(i), x, barY + 38, C.dim, 10, 'center');
    }
    const px = barX + barW * Math.max(0, Math.min(14, pH)) / 14;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(px, barY - 4); ctx.lineTo(px - 6, barY - 16); ctx.lineTo(px + 6, barY - 16); ctx.closePath(); ctx.fill();

    // beaker
    const bx = ctx.W / 2, by = ctx.H - 26;
    ctx.strokeStyle = C.dim;
    ctx.beginPath(); ctx.moveTo(bx - 50, by - 70); ctx.lineTo(bx - 50, by); ctx.lineTo(bx + 50, by); ctx.lineTo(bx + 50, by - 70); ctx.stroke();
    const tone = pH < 7 ? 'rgba(211,47,47,' : (pH > 7 ? 'rgba(40,53,147,' : 'rgba(67,160,71,');
    ctx.fillStyle = tone + '0.45)';
    ctx.fillRect(bx - 49, by - 52, 98, 51);
    for (let i = 0; i < 14; i++) {
      const t = (simState.time * 0.5 + i / 14) % 1;
      ctx.fillStyle = tone + (0.9 - t * 0.5) + ')';
      ctx.beginPath(); ctx.arc(bx - 40 + (i * 29) % 80, by - 4 - t * 46, 2.2, 0, Math.PI * 2); ctx.fill();
    }

    label('pH = ' + pH.toFixed(2), 14, ctx.H - 74, pH < 7 ? C.red : (pH > 7 ? C.blue : C.green), 20);
    label('pOH = ' + pOH.toFixed(2), 14, ctx.H - 50, C.text, 12);
    label('[H⁺] = ' + h.toExponential(2) + ' M', 14, ctx.H - 32, C.text, 12);
    label(strong ? 'strong: fully dissociated' : 'α = ' + (alpha * 100).toFixed(1) + '% dissociated', 14, ctx.H - 14, C.dim, 11);
  }

  function drawGalvanicCell(ctx, p) {
    const cy = ctx.H / 2 + 6;
    const an = p['param-anode'] || 'Zn';
    const cat = p['param-cathode'] || 'Cu';
    const E = { Zn: -0.76, Fe: -0.44, Ni: -0.25, Sn: -0.14, Pb: -0.13, H: 0, Cu: 0.34, Ag: 0.80 };
    const e0 = E[cat] - E[an];
    const x1 = ctx.W * 0.26, x2 = ctx.W * 0.74;

    function halfCell(x, sym, col) {
      // electrode
      ctx.fillStyle = col; ctx.fillRect(x - 6, cy - 74, 12, 100);
      ctx.strokeStyle = C.dim;
      ctx.beginPath();
      ctx.moveTo(x - 40, cy - 50); ctx.lineTo(x - 40, cy + 40);
      ctx.lineTo(x + 40, cy + 40); ctx.lineTo(x + 40, cy - 50);
      ctx.stroke();
      ctx.fillStyle = 'rgba(38,198,218,0.25)';
      ctx.fillRect(x - 39, cy - 40, 78, 79);
      label(sym + (col === C.red ? ' → ' + sym + '²⁺ + 2e⁻' : '²⁺ + 2e⁻ → ' + sym), x, cy + 58, C.dim, 10, 'center');
      label('E° = ' + (E[sym]).toFixed(2) + ' V', x, cy - 86, C.text, 11, 'center');
    }
    halfCell(x1, an, C.red);
    halfCell(x2, cat, C.green);

    // wire + salt bridge
    ctx.strokeStyle = C.yellow; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x1, cy - 74); ctx.lineTo(x1, cy - 104); ctx.lineTo(x2, cy - 104); ctx.lineTo(x2, cy - 74); ctx.stroke();
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const t = ((simState.time * 0.8 + i / 6) % 1);
      const x = x1 + (x2 - x1) * t;
      ctx.fillStyle = C.yellow;
      ctx.beginPath(); ctx.arc(x, cy - 104, 3, 0, Math.PI * 2); ctx.fill();
    }
    label('e⁻ flow', (x1 + x2) / 2, cy - 116, C.yellow, 11, 'center');
    box((x1 + x2) / 2 - 16, cy - 34, 32, 66, C.purple, 'rgba(149,117,205,0.25)');
    label('salt bridge', (x1 + x2) / 2, cy + 44, C.purple, 10, 'center');

    label('V', vpos, cy - 104, C.text, 12, 'center');
    label(e0.toFixed(2) + ' V', (x1 + x2) / 2, cy + 74, e0 > 0 ? C.green : C.red, 16, 'center');
    label(an + ' is the anode (oxidation); ' + cat + ' is the cathode (reduction)',
      ctx.W / 2, 20, C.dim, 11, 'center');
    label(e0 > 0 ? 'spontaneous: ΔG° = −nFE° < 0' : 'non-spontaneous, needs electrolysis',
      ctx.W / 2, ctx.H - 12, e0 > 0 ? C.green : C.red, 11, 'center');
  }

  function drawFunctionalGroup(ctx, p) {
    const grp = p['param-group'] || 'alcohol';
    const cx = ctx.W / 2, cy = ctx.H / 2 - 10;
    const data = {
      alcohol: { g: '–OH', col: C.red, ex: 'CH₃CH₂OH ethanol', note: 'hydrogen bonds, weak acid' },
      aldehyde: { g: '–CHO', col: C.yellow, ex: 'CH₃CHO ethanal', note: 'oxidises to a carboxylic acid' },
      ketone: { g: 'C=O', col: C.yellow, ex: 'CH₃COCH₃ propanone', note: 'carbonyl, no oxidation to acid' },
      acid: { g: '–COOH', col: C.green, ex: 'CH₃COOH ethanoic acid', note: 'pKa ≈ 4.76, turns litmus red' },
      ester: { g: '–COO–', col: C.purple, ex: 'CH₃COOC₂H₅ ethyl ethanoate', note: 'fruity smell, hydrolysis' },
      amine: { g: '–NH₂', col: C.blue, ex: 'CH₃NH₂ methylamine', note: 'basic, pKb ≈ 3.3' },
      alkene: { g: 'C=C', col: C.accent, ex: 'CH₂=CH₂ ethene', note: 'decolourises bromine water' },
      halide: { g: '–Br', col: '#8d6e63', ex: 'CH₃Br bromomethane', note: 'site of nucleophilic substitution' }
    }[grp] || { g: '–?', col: C.dim, ex: '', note: '' };

    ctx.strokeStyle = C.dim; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - 120, cy); ctx.lineTo(cx - 40, cy); ctx.stroke();
    ctx.lineWidth = 1;
    sphere(cx + 10, cy, 30, data.col);
    label(data.g, cx + 10, cy, '#0b0b16', 15, 'center');
    label('R', cx - 140, cy, C.text, 16, 'left');
    ctx.strokeStyle = C.dim;
    ctx.beginPath(); ctx.moveTo(cx + 40, cy); ctx.lineTo(cx + 110, cy); ctx.stroke();
    label('R′', cx + 118, cy, C.text, 14, 'left');

    label(grp, 14, 22, data.col, 20);
    label(data.ex, 14, 48, C.text, 13);
    label(data.note, 14, 68, C.dim, 12);
    label('general formula: R' + data.g, 14, ctx.H - 16, C.dim, 11);
  }

  function drawRadioactiveDecay(ctx, p) {
    const t12 = parseFloat(p['param-halflife']) || 10;
    const mode = p['param-mode'] || 'alpha';
    const tmax = Math.max(t12 * 4, 1);
    const tt = Math.min(tmax, simState.time * (tmax / 20));
    const frac = Math.pow(0.5, tt / t12);
    const x0 = 44, y0 = ctx.H - 44, w = ctx.W - 74, h = ctx.H - 96;

    box(x0, y0 - h, w, h, C.grid);
    label('N/N₀', 14, y0 - h, C.dim, 10);
    label('t', x0 + w, y0 + 14, C.dim, 10);
    ctx.strokeStyle = C.green; ctx.beginPath();
    for (let i = 0; i <= 120; i++) {
      const t = tmax * i / 120;
      const y = Math.pow(0.5, t / t12);
      const x = x0 + w * (i / 120);
      i ? ctx.lineTo(x, y0 - h * y) : ctx.moveTo(x, y0 - h * y);
    }
    ctx.stroke();
    // half-life guides
    for (let n = 0; n <= 4; n++) {
      const yv = Math.pow(0.5, n);
      if (yv < 0.02) break;
      const x = x0 + w * (t12 * n / tmax);
      ctx.strokeStyle = 'rgba(255,235,59,0.25)'; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y0 - h * yv);
      ctx.lineTo(x0, y0 - h * yv); ctx.stroke(); ctx.setLineDash([]);
      label(n + '·t½', x + 2, y0 - h * yv - 8, C.yellow, 9);
    }
    const cxp = x0 + w * (tt / tmax);
    ctx.strokeStyle = C.accent;
    ctx.beginPath(); ctx.moveTo(cxp, y0); ctx.lineTo(cxp, y0 - h * frac); ctx.stroke();

    // decay particles
    const N0 = 40;
    for (let i = 0; i < N0; i++) {
      const seed = i * 9301 + 49297;
      const life = ((seed % 1000) / 1000) * t12 * 2;
      if (life < tt) {
        ctx.fillStyle = 'rgba(120,120,150,0.4)';
        ctx.beginPath(); ctx.arc(x0 + 8 + (i * 13) % w, y0 - h - 16, 3, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = C.blue;
        ctx.beginPath(); ctx.arc(x0 + 8 + (i * 13) % w, y0 - h - 16, 3, 0, Math.PI * 2); ctx.fill();
      }
    }

    const Z = 92, A = 238;
    let sym = 'U', dA = 0, dZ = 0;
    if (mode === 'alpha') { dA = -4; dZ = -2; sym = 'Th'; }
    else if (mode === 'beta') { dA = 0; dZ = 1; sym = 'Np'; }
    else { dA = 0; dZ = 0; sym = 'U'; }
    label(A + ' → ' + (A + dA) + 'X  (' + mode + ')', 14, 22, C.text, 13);
    label(mode === 'alpha' ? '⁴He emitted: A −4, Z −2' :
      mode === 'beta' ? 'e⁻ emitted: neutron → proton, Z +1' : 'photon emitted: A and Z unchanged',
      14, 40, C.dim, 11);
    label('t = ' + tt.toFixed(1) + '   N/N₀ = ' + frac.toFixed(3), ctx.W - 12, 22, C.yellow, 12, 'right');
    label('t½ = ' + t12 + '  λ = ' + (0.693 / t12).toFixed(4), ctx.W - 12, 40, C.green, 12, 'right');
  }

  function drawIRSpectrum(ctx, p) {
    const wn = parseFloat(p['param-focus']) || 1700;
    const x0 = 40, y0 = ctx.H - 34, w = ctx.W - 60, h = ctx.H - 70;
    box(x0, y0 - h, w, h, C.grid);
    const lo = 400, hi = 4000;
    function X(v) { return x0 + w * (hi - v) / (hi - lo); }
    const bands = [
      { c: 3350, w: 320, d: 0.85, t: 'O–H broad' },
      { c: 2930, w: 60, d: 0.35, t: 'C–H sp³' },
      { c: 2250, w: 40, d: 0.3, t: 'C≡N' },
      { c: 1715, w: 45, d: 0.9, t: 'C=O' },
      { c: 1600, w: 40, d: 0.3, t: 'C=C' },
      { c: 1250, w: 70, d: 0.5, t: 'C–O' }
    ];
    ctx.strokeStyle = C.blue; ctx.beginPath();
    for (let i = 0; i <= 300; i++) {
      const v = hi - (hi - lo) * i / 300;
      let tr = 1;
      for (let b = 0; b < bands.length; b++) {
        const d = (v - bands[b].c) / bands[b].w;
        tr -= bands[b].d * Math.exp(-d * d);
      }
      tr = Math.max(0.02, tr);
      const x = X(v), y = y0 - h * tr;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();

    const fx = X(wn);
    ctx.strokeStyle = C.accent;
    ctx.beginPath(); ctx.moveTo(fx, y0 - h); ctx.lineTo(fx, y0); ctx.stroke();
    for (let v = 500; v < hi; v += 500) label(String(v), X(v), y0 + 12, C.dim, 9, 'center');
    label('wavenumber cm⁻¹', x0 + w / 2, y0 + 26, C.dim, 10, 'center');
    label('transmittance', 12, y0 - h / 2, C.dim, 10, 'left');

    let near = bands[0], bd = 1e9;
    for (let b = 0; b < bands.length; b++) {
      const d = Math.abs(wn - bands[b].c);
      if (d < bd) { bd = d; near = bands[b]; }
    }
    label('cursor ' + wn + ' cm⁻¹', 14, 20, C.text, 12);
    label('nearest band: ' + near.t + ' (' + near.c + ')', 14, 38, Math.abs(wn - near.c) < near.w ? C.green : C.yellow, 13);
    label('ν̃ ∝ √(k/μ): stronger bond or lighter atom → higher wavenumber', 14, 56, C.dim, 10);
  }

  function drawGasLaw(ctx, p) {
    const T = parseFloat(p['param-temp']) || 300;
    const V = parseFloat(p['param-volume']) || 1;
    const n = parseFloat(p['param-moles']) || 1;
    const P = n * 8.314 * T / (V * 24.94);
    const x0 = 24, y0 = 24, w = ctx.W * 0.5, h = ctx.H - 48;
    box(x0, y0, w, h, C.dim, 'rgba(255,255,255,0.02)');

    const vrms = Math.sqrt(3 * 8.314 * T / 0.032);
    const speedScale = vrms / 500;
    if (!drawGasLaw.parts) {
      drawGasLaw.parts = [];
      for (let i = 0; i < 70; i++) {
        drawGasLaw.parts.push({ x: Math.random(), y: Math.random(), a: Math.random() * Math.PI * 2 });
      }
    }
    const dt = simState.playing ? 0.016 : 0;
    for (let i = 0; i < drawGasLaw.parts.length; i++) {
      const q = drawGasLaw.parts[i];
      q.x += Math.cos(q.a) * speedScale * dt * 0.9 / (V * 1.4);
      q.y += Math.sin(q.a) * speedScale * dt * 0.9 / (V * 1.4);
      if (q.x < 0.01 || q.x > 0.99) { q.a = Math.PI - q.a; q.x = Math.max(0.01, Math.min(0.99, q.x)); }
      if (q.y < 0.01 || q.y > 0.99) { q.a = -q.a; q.y = Math.max(0.01, Math.min(0.99, q.y)); }
      const px = x0 + w * q.x, py = y0 + h * q.y;
      const hot = Math.min(1, (T - 100) / 500);
      ctx.fillStyle = 'rgb(' + Math.round(120 + 135 * hot) + ',' + Math.round(150 - 60 * hot) + ',' + Math.round(230 - 170 * hot) + ')';
      ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill();
    }

    const bx = ctx.W * 0.56, by = 30;
    label('pV = nRT', bx, by, C.accent, 16);
    label('n = ' + n.toFixed(2) + ' mol', bx, by + 26, C.text, 12);
    label('T = ' + T + ' K (' + (T - 273).toFixed(0) + ' °C)', bx, by + 44, C.text, 12);
    label('V = ' + V.toFixed(2) + ' L', bx, by + 62, C.text, 12);
    label('p = ' + P.toFixed(2) + ' atm', bx, by + 84, C.green, 15);
    label('v_rms(O₂) = ' + vrms.toFixed(0) + ' m/s', bx, by + 106, C.yellow, 12);
    label('⟨KE⟩ = ' + (1.5 * 8.314 * T / 1000).toFixed(2) + ' kJ/mol', bx, by + 124, C.dim, 11);
  }

  function drawCrystalLattice(ctx, p) {
    const kind = p['param-lattice'] || 'fcc';
    const cx = ctx.W * 0.36, cy = ctx.H / 2;
    const s = 46;
    const rot = simState.time * 0.4;
    const ang = kind === 'bcc' ? 0.6 : 0.5;

    const corners = [];
    for (let i = 0; i < 8; i++) {
      corners.push([(i & 1 ? 1 : -1) * s, (i & 2 ? 1 : -1) * s * ang, (i & 4 ? 1 : -1) * s]);
    }
    const faces = [[s, 0, 0], [-s, 0, 0], [0, 0, s], [0, 0, -s], [s * 0, s * ang, 0], [0, -s * ang, 0]];
    const edges = [];
    for (let i = 0; i < 12; i++) {
      const a = corners[i % 8], b = corners[(i * 3 + 1) % 8];
      edges.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]);
    }
    function proj(v) {
      const x = v[0] * Math.cos(rot) - v[2] * Math.sin(rot);
      const z = v[0] * Math.sin(rot) + v[2] * Math.cos(rot);
      return [cx + x, cy + v[1] - z * 0.28, z];
    }
    const edgesPairs = [];
    for (let i = 0; i < 8; i++) {
      for (let j = i + 1; j < 8; j++) {
        let d = 0;
        for (let k = 0; k < 3; k++) d += Math.abs(corners[i][k] - corners[j][k]) > 1 ? 1 : 0;
        if (d === 1) edgesPairs.push([corners[i], corners[j]]);
      }
    }
    ctx.strokeStyle = C.grid;
    for (let e = 0; e < edgesPairs.length; e++) {
      const a = proj(edgesPairs[e][0]), b = proj(edgesPairs[e][1]);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    const pts = corners.slice();
    if (kind === 'bcc') pts.push([0, 0, 0]);
    if (kind === 'fcc') pts.push(faces[0], faces[1], faces[2], faces[3], faces[4], faces[5]);
    if (kind === 'nacl') {
      for (let f = 0; f < 6; f++) pts.push(faces[f]);
      pts.push([0, 0, 0]);
    }
    pts.map(proj).sort(function(a, b) { return a[2] - b[2]; }).forEach(function(v) {
      const r = 9 + v[2] * 0.02;
      const col = kind === 'nacl' && v === null ? C.blue : (v[2] > 0 ? C.accent : '#5c6bc0');
      sphere(v[0], v[1], Math.max(6, r), kind === 'nacl' ? (v[2] > 0 ? C.red : C.purple) : C.blue);
    });

    const info = {
      simple: { atoms: 1, eff: '52%', cn: 6, ex: 'Po' },
      bcc: { atoms: 2, eff: '68%', cn: 8, ex: 'α-Fe, Na, K' },
      fcc: { atoms: 4, eff: '74%', cn: 12, ex: 'Cu, Al, Au' },
      hcp: { atoms: 6, eff: '74%', cn: 12, ex: 'Mg, Zn, Ti' },
      nacl: { atoms: 4, eff: '—', cn: 6, ex: 'NaCl, MgO' }
    }[kind] || { atoms: 4, eff: '74%', cn: 12, ex: 'Cu' };

    const bx = ctx.W * 0.6;
    label(kind.toUpperCase(), bx, 30, C.accent, 18);
    label('atoms per unit cell: ' + info.atoms, bx, 56, C.text, 12);
    label('coordination number: ' + info.cn, bx, 74, C.text, 12);
    label('packing efficiency: ' + info.eff, bx, 92, C.green, 12);
    label('examples: ' + info.ex, bx, 110, C.dim, 11);
    label(kind === 'nacl' ? 'red = anion, purple = cation' : 'corner ⅛ + face ½ + body 1', bx, 132, C.dim, 10);
    label('r(a) relations: FCC 4r = a√2, BCC 4r = a√3', 14, ctx.H - 12, C.dim, 10);
  }

  function drawQuantumNumbers(ctx, p) {
    const n = Math.round(parseFloat(p['param-n']) || 2);
    const lmax = n - 1;
    const l = Math.min(lmax, Math.round(parseFloat(p['param-l']) || 0));
    const lmax2 = l;
    const ml = Math.max(-lmax2, Math.min(lmax2, Math.round(parseFloat(p['param-ml']) || 0)));
    const cx = ctx.W * 0.34, cy = ctx.H / 2;
    const names = ['s', 'p', 'd', 'f', 'g'];

    // probability cloud for the chosen orbital
    const R = 78;
    const lobes = l === 0 ? 1 : (l === 1 ? 2 : (l === 2 ? (Math.abs(ml) === 2 ? 4 : 2) : 6));
    const tilt = l === 1 ? (ml === 0 ? Math.PI / 2 : (ml === -1 ? 0 : Math.PI / 3)) : 0;
    for (let k = 0; k < lobes; k++) {
      const a = tilt + k * Math.PI * 2 / lobes + (l === 1 ? Math.PI / 2 : 0);
      const rr = l === 0 ? R * 0.8 : R * 0.55;
      const ox = cx + Math.cos(a) * (l === 0 ? 0 : R * 0.42);
      const oy = cy + Math.sin(a) * (l === 0 ? 0 : R * 0.42);
      const g = ctx.createRadialGradient(ox, oy, 2, ox, oy, rr);
      g.addColorStop(0, 'rgba(33,150,243,0.75)');
      g.addColorStop(1, 'rgba(33,150,243,0)');
      ctx.fillStyle = g;
      ctx.save();
      ctx.translate(ox, oy); ctx.rotate(a); ctx.scale(1.5, 0.8); ctx.translate(-ox, -oy);
      ctx.beginPath(); ctx.arc(ox, oy, rr, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = C.accent;
    ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();
    label('nucleus', cx + 8, cy + 10, C.dim, 9);

    // node count rings
    const radialNodes = n - 1 - l;
    for (let i = 0; i <= radialNodes; i++) {
      ctx.strokeStyle = 'rgba(255,235,59,0.35)';
      ctx.beginPath(); ctx.arc(cx, cy, 16 + i * 22, 0, Math.PI * 2); ctx.stroke();
    }

    const bx = ctx.W * 0.56;
    label('Quantum state', bx, 24, C.accent, 15);
    label('n = ' + n + '  → shell ' + 'KLMNO'.charAt(n - 1) + '  (energy and size)', bx, 50, C.text, 12);
    label('l = ' + l + '   → ' + names[l] + ' subshell (' + (l + 1) + ' orbitals)', bx, 70, C.blue, 12);
    label('mₗ = ' + ml + '   → orientation ' + (ml === 0 ? 'along z' : (ml > 0 ? '+' + ml : String(ml))), bx, 90, C.purple, 12);
    label('mₛ = ±½ (two electrons per orbital)', bx, 110, C.yellow, 12);
    label('angular nodes = l = ' + l, bx, 138, C.text, 11);
    label('radial nodes = n−1−l = ' + radialNodes, bx, 156, C.text, 11);
    label('total nodes = n−1 = ' + (n - 1), bx, 174, C.green, 11);
    label('electrons in shell n: 2n² = ' + 2 * n * n, bx, 198, C.dim, 11);
    if (l >= n) label('forbidden: l must be < n', bx, 220, C.red, 12);

    // energy ladder
    const lx = ctx.W - 60;
    for (let i = 1; i <= 5; i++) {
      const y = ctx.H - 24 - (i - 1) * 22;
      ctx.strokeStyle = i === n ? C.accent : C.grid;
      ctx.beginPath(); ctx.moveTo(lx - 22, y); ctx.lineTo(lx + 22, y); ctx.stroke();
      label('n=' + i, lx + 26, y, i === n ? C.accent : C.dim, 9);
    }
  }

  function drawEquilibriumDemo(ctx, p) {
    const K = parseFloat(p['param-K']) || 1;
    const A0 = parseFloat(p['param-A0']) || 1;
    // A ⇌ B, forward kf, reverse kr, with K = kf/kr
    const kf = 0.05, kr = kf / K;
    const tmax = 60;
    const tt = Math.min(tmax, simState.time * 6);
    // analytic solution for first-order interconversion
    const tot = A0;
    const eqB = tot * K / (1 + K);
    const x = eqB * (1 - Math.exp(-(kf + kr) * tt));
    const A = tot - x, B = x;

    const x0 = 40, y0 = ctx.H - 40, w = ctx.W - 70, h = ctx.H - 92;
    box(x0, y0 - h, w, h, C.grid);
    const scale = Math.max(tot, 1.0001);
    ctx.strokeStyle = C.green; ctx.beginPath();
    for (let i = 0; i <= 120; i++) {
      const t = tmax * i / 120;
      const xb = (tot * K / (1 + K)) * (1 - Math.exp(-(kf + kr) * t));
      const px = x0 + w * (i / 120);
      i ? ctx.lineTo(px, y0 - h * xb / scale) : ctx.moveTo(px, y0 - h * xb / scale);
    }
    ctx.stroke();
    ctx.strokeStyle = C.red; ctx.beginPath();
    for (let i = 0; i <= 120; i++) {
      const t = tmax * i / 120;
      const xb = (tot * K / (1 + K)) * (1 - Math.exp(-(kf + kr) * t));
      const px = x0 + w * (i / 120);
      i ? ctx.lineTo(px, y0 - h * (tot - xb) / scale) : ctx.moveTo(px, y0 - h * (tot - xb) / scale);
    }
    ctx.stroke();
    ctx.strokeStyle = C.yellow; ctx.setLineDash([3, 4]);
    const px = x0 + w * (tt / tmax);
    ctx.beginPath(); ctx.moveTo(px, y0); ctx.lineTo(px, y0 - h); ctx.stroke(); ctx.setLineDash([]);

    // particle boxes
    const N = 40;
    for (let i = 0; i < N; i++) {
      const isB = i < Math.round(N * (B / scale));
      const seed = i * 9301 + 49297;
      const bx = ctx.W - 130 + (i % 5) * 22 + Math.sin(simState.time + i) * 2;
      const by = 30 + Math.floor(i / 5) * 18;
      ctx.fillStyle = isB ? C.green : C.red;
      ctx.beginPath(); ctx.arc(bx, by, 5, 0, Math.PI * 2); ctx.fill();
    }

    const Q = B / Math.max(A, 1e-9);
    label('A ⇌ B', 14, 22, C.accent, 16);
    label('K = kf/kr = ' + K.toFixed(2), 14, 46, C.text, 12);
    label('[A] = ' + A.toFixed(3) + ' M', 14, 70, C.red, 12);
    label('[B] = ' + B.toFixed(3) + ' M', 14, 88, C.green, 12);
    label('Q = ' + Q.toFixed(3) + (Math.abs(Q - K) / K < 0.05 ? '  ≈ K: at equilibrium' : (Q < K ? '  < K: shifting right' : '  > K: shifting left')),
      14, ctx.H - 16, Math.abs(Q - K) / K < 0.05 ? C.yellow : C.dim, 12);
    label('v_fwd = ' + (kf * A).toFixed(4), x0 + w + 4, y0 - h * 0.6, C.red, 10);
    label('v_rev = ' + (kr * B).toFixed(4), x0 + w + 4, y0 - h * 0.5, C.green, 10);
  }

  function drawPhotoelectric(ctx, p) {
    const lam = parseFloat(p['param-wavelength']) || 400;
    const phi = parseFloat(p['param-workfn']) || 2.1;
    const hPlanck = 6.62607015e-34, cLight = 2.99792458e8, eCharge = 1.602176634e-19;
    const E = hPlanck * cLight / (lam * 1e-10) / eCharge; // eV
    const Kmax = E - phi;
    const lam0 = 1240 / phi;
    const intensity = parseFloat(p['param-intensity']) || 50;

    const mx = ctx.W * 0.62, my = ctx.H - 60;
    // metal plate
    ctx.fillStyle = '#8d93a8'; ctx.fillRect(mx - 10, my - 70, 20, 90);
    ctx.fillStyle = '#5b6172'; ctx.fillRect(mx + 10, my + 18, 150, 8);
    label('cathode', mx, my + 40, C.dim, 10, 'center');
    label('collector', mx + 120, my - 78, C.dim, 10, 'center');

    // incoming photon
    const hue = lam < 450 ? '#7e57c2' : (lam < 495 ? '#29b6f6' : (lam < 590 ? '#ffee58' : (lam < 620 ? '#ff9800' : '#ef5350')));
    const t = (simState.time * 0.8) % 1;
    if (lam >= 100) {
      ctx.strokeStyle = hue; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i <= 60; i++) {
        const x = mx - 200 + i * (190 / 60);
        const y = my - 100 + Math.sin(i * 0.6 + t * 6) * (6 + 900 / lam * 0.06);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke(); ctx.lineWidth = 1;
      ctx.fillStyle = hue;
      ctx.beginPath(); ctx.arc(mx - 190 + t * 180, my - 100, 5, 0, Math.PI * 2); ctx.fill();
    }

    // emitted electrons only if above threshold
    if (Kmax > 0) {
      const count = Math.round(intensity / 12);
      for (let i = 0; i < count; i++) {
        const te = (simState.time * (0.6 + Kmax * 0.35) + i / count) % 1;
        const x = mx + 12 + te * 118;
        const y = my - 24 - Math.sin(te * Math.PI) * (10 + Kmax * 12);
        ctx.fillStyle = C.yellow;
        ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.strokeStyle = C.green;
      ctx.beginPath(); ctx.moveTo(mx - 5, my - 78); ctx.lineTo(mx - 5, my - 60); ctx.stroke();
      label('current ∝ intensity', mx + 60, my - 60, C.dim, 10);
    } else {
      label('no emission: hf < φ', mx + 40, my - 40, C.red, 12);
    }

    label('λ = ' + lam + ' nm', 14, 24, hue, 14);
    label('E = hc/λ = ' + E.toFixed(3) + ' eV', 14, 48, C.text, 12);
    label('φ = ' + phi.toFixed(2) + ' eV', 14, 66, C.text, 12);
    label('K_max = hf − φ = ' + (Kmax > 0 ? Kmax.toFixed(3) + ' eV' : '0 (below threshold)'),
      14, 90, Kmax > 0 ? C.green : C.red, 13);
    label('threshold λ₀ = 1240/φ = ' + lam0.toFixed(0) + ' nm', 14, 110, C.yellow, 12);
    label(Kmax > 0 ? 'stopping voltage V₀ = K_max/e = ' + Kmax.toFixed(3) + ' V' : 'raise E or lower φ to emit',
      14, ctx.H - 16, C.dim, 11);
  }

  function drawAdsorption(ctx, p) {
    const K = parseFloat(p['param-K']) || 0.05;
    const P = parseFloat(p['param-P']) || 10;
    const area = parseFloat(p['param-area']) || 500;
    const theta = K * P / (1 + K * P);
    const bx = ctx.W * 0.4, by = ctx.H - 40;

    // surface of adsorbent
    ctx.fillStyle = '#3b3b55';
    ctx.fillRect(bx - 130, by - 14, 260, 30);
    const sites = 20;
    for (let i = 0; i < sites; i++) {
      const x = bx - 120 + i * (240 / (sites - 1));
      const occupied = i < Math.round(sites * theta);
      ctx.strokeStyle = occupied ? C.green : C.grid;
      ctx.beginPath(); ctx.moveTo(x, by - 14); ctx.lineTo(x, by - 22); ctx.stroke();
      if (occupied) {
        sphere(x, by - 30, 6, C.blue);
      }
    }
    // free molecules above
    const free = Math.round((1 - theta) * 22);
    for (let i = 0; i < free; i++) {
      const ph = (simState.time * 0.4 + i * 0.37) % 1;
      const x = bx - 120 + (i * 53) % 240;
      const y = by - 60 - ((i * 71) % 60) - ph * 8;
      sphere(x, y, 5, '#7986cb');
    }

    // isotherm plot
    const x0 = ctx.W - 190, y0 = ctx.H - 44, w = 170, h = ctx.H - 90;
    box(x0, y0 - h, w, h, C.grid);
    ctx.strokeStyle = C.accent; ctx.beginPath();
    for (let i = 0; i <= 100; i++) {
      const pp = 40 * i / 100;
      const th = K * pp / (1 + K * pp);
      const x = x0 + w * (i / 100);
      i ? ctx.lineTo(x, y0 - h * th) : ctx.moveTo(x, y0 - h * th);
    }
    ctx.stroke();
    const mxp = x0 + w * (P / 40);
    ctx.strokeStyle = C.yellow;
    ctx.beginPath(); ctx.moveTo(mxp, y0); ctx.lineTo(mxp, y0 - h * theta); ctx.stroke();
    ctx.fillStyle = C.yellow;
    ctx.beginPath(); ctx.arc(mxp, y0 - h * theta, 3.5, 0, Math.PI * 2); ctx.fill();
    label('θ', x0 - 12, y0 - h / 2, C.dim, 10);
    label('P', x0 + w / 2, y0 + 14, C.dim, 10, 'center');

    label('Langmuir isotherm', 14, 22, C.accent, 15);
    label('θ = KP / (1 + KP)', 14, 44, C.text, 12);
    label('P = ' + P.toFixed(1) + ' bar, K = ' + K.toFixed(3) + ' bar⁻¹', 14, 66, C.text, 12);
    label('θ = ' + theta.toFixed(3) + '  (' + Math.round(theta * 100) + '% of sites covered)', 14, 88, C.green, 13);
    label('surface area = ' + area + ' m²/g', 14, 108, C.blue, 12);
    label('adsorbed amount ∝ θ × area', 14, 126, C.dim, 11);
    label(theta > 0.9 ? 'monolayer saturated — multilayer would begin (BET regime)' : 'coverage rises steeply at low P',
      14, ctx.H - 14, theta > 0.9 ? C.yellow : C.dim, 11);
  }

  function drawTitration(ctx, p) {
    const Ca = parseFloat(p['param-Ca']) || 0.1;
    const Va = parseFloat(p['param-Va']) || 25;
    const Cb = parseFloat(p['param-Cb']) || 0.1;
    const pKa = parseFloat(p['param-pka']) || 4.76;
    const strongAcid = (p['param-kind'] || 'weak') === 'strong';
    const Ve = parseFloat(p['param-Ve']) || 0;
    const Veq = Ca * Va / Cb;
    const V = Math.min(Veq * 2, Ve);

    // pH curve
    const x0 = 40, y0 = ctx.H - 36, w = ctx.W * 0.55, h = ctx.H - 70;
    box(x0, y0 - h, w, h, C.grid);
    function pHat(v) {
      const na = Ca * Va / 1000, nb = Cb * v / 1000;
      const tot = (Va + v) / 1000;
      if (strongAcid) {
        if (Math.abs(nb - na) < 1e-9) return 7;
        const ex = Math.abs(na - nb) / tot;
        return na > nb ? -Math.log10(ex) : 14 + Math.log10(ex);
      }
      if (nb < na) {
        if (nb < 1e-12) {
          const Ka = Math.pow(10, -pKa);
          return -Math.log10((-Ka + Math.sqrt(Ka * Ka + 4 * Ka * na / tot)) / 2);
        }
        return pKa + Math.log10(nb / (na - nb));
      }
      if (Math.abs(nb - na) < 1e-9) {
        const Ka = Math.pow(10, -pKa), C = na / tot;
        const Kb = 1e-14 / Ka;
        return 14 + Math.log10(Math.sqrt(Kb * C));
      }
      const ex = (nb - na) / tot;
      return 14 + Math.log10(ex);
    }
    ctx.strokeStyle = C.blue; ctx.beginPath();
    for (let i = 0; i <= 200; i++) {
      const v = Veq * 2 * i / 200;
      const ph = pHat(v);
      const x = x0 + w * (i / 200);
      const y = y0 - h * Math.max(0, Math.min(14, ph)) / 14;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    for (let i = 0; i <= 14; i += 7) {
      const y = y0 - h * i / 14;
      ctx.strokeStyle = C.grid; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + w, y); ctx.stroke();
      label('pH ' + i, x0 - 6, y, C.dim, 9, 'right');
    }
    const cxp = x0 + w * (V / (Veq * 2));
    const php = pHat(V);
    ctx.strokeStyle = C.yellow; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(cxp, y0); ctx.lineTo(cxp, y0 - h * php / 14); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = C.accent;
    ctx.beginPath(); ctx.arc(cxp, y0 - h * php / 14, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = C.green; ctx.setLineDash([2, 3]);
    const xe = x0 + w * 0.5;
    ctx.beginPath(); ctx.moveTo(xe, y0); ctx.lineTo(xe, y0 - h); ctx.stroke(); ctx.setLineDash([]);
    label('V_eq = ' + Veq.toFixed(2) + ' mL', xe + 4, y0 - h + 10, C.green, 10);

    // burette
    const bxx = ctx.W - 90;
    box(bxx - 14, 26, 28, 120, C.dim, 'rgba(38,198,218,0.25)');
    const drop = Math.max(0, 1 - V / (Veq * 2));
    ctx.fillStyle = 'rgba(38,198,218,0.6)';
    ctx.fillRect(bxx - 13, 26 + 118 * (1 - drop), 26, 118 * drop);
    ctx.strokeStyle = C.dim;
    ctx.beginPath(); ctx.moveTo(bxx, 146); ctx.lineTo(bxx, 168); ctx.stroke();
    if (V > 0 && simState.playing) {
      const tt = (simState.time * 3) % 1;
      ctx.fillStyle = C.blue;
      ctx.beginPath(); ctx.arc(bxx, 168 + tt * 30, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    label(Cb.toFixed(3) + ' M base', bxx - 30, 20, C.dim, 10);

    label(strongAcid ? 'strong acid vs strong base' : 'weak acid vs strong base', 14, 22, C.accent, 14);
    label('V added = ' + V.toFixed(2) + ' mL', 14, 46, C.text, 12);
    label('pH = ' + php.toFixed(3), 14, 68, C.blue, 16);
    if (!strongAcid) label('at half-equivalence: pH = pKa = ' + pKa.toFixed(2), 14, 90, C.yellow, 12);
    label(Math.abs(V - Veq) < 0.15 ? 'AT EQUIVALENCE POINT' : (V < Veq ? 'acid in excess' : 'base in excess'),
      14, ctx.H - 14, Math.abs(V - Veq) < 0.15 ? C.green : C.dim, 12);
  }

  function drawAtomEconomy(ctx, p) {
    const mode = p['param-mode'] || 'addition';
    const data = {
      addition: { eq: 'CH₂=CH₂ + HBr → CH₃CH₂Br', w: [28, 81], p: [109], note: 'every atom ends in the product' },
      substitution: { eq: 'CH₄ + Cl₂ → CH₃Cl + HCl', w: [16, 71], p: [50.5, 36.5], note: 'one fragment is discarded' },
      elimination: { eq: 'C₂H₅Br → C₂H₄ + HBr', w: [109], p: [28, 81], note: 'a whole molecule is lost' },
      rearrangement: { eq: 'cyclopropane → propene', w: [42], p: [42], note: 'isomerisation wastes nothing' }
    }[mode] || { eq: '', w: [1], p: [1], note: '' };

    const totalP = data.p.reduce(function(a, b) { return a + b; }, 0);
    const ae = 100 * data.p[0] / totalP;
    const cx = ctx.W / 2;

    let x = 24;
    ctx.strokeStyle = C.dim;
    label('reactants', 14, 30, C.dim, 11);
    for (let i = 0; i < data.w.length; i++) {
      const wid = Math.max(24, data.w[i] * 1.1);
      box(x, 40, wid, 34, C.blue, 'rgba(33,150,243,0.3)');
      label(data.w[i].toFixed(1), x + wid / 2, 57, C.text, 10, 'center');
      x += wid + 8;
    }
    label('→', ctx.W / 2 - 4, 22, C.yellow, 14, 'center');
    x = 24;
    label('products (desired first)', 14, ctx.H / 2 + 24, C.dim, 11);
    for (let i = 0; i < data.p.length; i++) {
      const wid = Math.max(24, data.p[i] * 1.1);
      const wanted = i === 0;
      box(x, ctx.H / 2 + 34, wid, 34, wanted ? C.green : C.red, wanted ? 'rgba(76,175,80,0.35)' : 'rgba(244,67,54,0.25)');
      label(data.p[i].toFixed(1), x + wid / 2, ctx.H / 2 + 51, C.text, 10, 'center');
      x += wid + 8;
    }

    // gauge
    const gy = ctx.H - 54, gw = ctx.W - 60;
    box(30, gy, gw, 20, C.grid);
    ctx.fillStyle = ae > 90 ? C.green : (ae > 60 ? C.yellow : C.red);
    ctx.fillRect(30, gy, gw * ae / 100, 20);
    label(ae.toFixed(1) + '% atom economy', 30 + gw / 2, gy - 12, C.text, 13, 'center');
    label(data.eq, cx, 96, C.accent, 13, 'center');
    label(data.note, cx, 114, C.dim, 11, 'center');
    label('AE = M(desired) / Σ M(products) × 100', 14, ctx.H - 14, C.dim, 10);
  }

  function drawEnzymeKinetics(ctx, p) {
    const Vmax = parseFloat(p['param-Vmax']) || 100;
    const Km = parseFloat(p['param-Km']) || 5;
    const S = parseFloat(p['param-S']) || 5;
    const I = parseFloat(p['param-I']) || 0;
    const type = p['param-inhibit'] || 'none';
    const Kmapp = type === 'competitive' ? Km * (1 + I / 2) : Km;
    const Vmaxapp = type === 'noncompetitive' ? Vmax / (1 + I / 2) : Vmax;
    const v = Vmaxapp * S / (Kmapp + S);

    const x0 = 40, y0 = ctx.H - 40, w = ctx.W - 74, h = ctx.H - 90;
    box(x0, y0 - h, w, h, C.grid);
    label('v', x0 - 12, y0 - h, C.dim, 10);
    label('[S]', x0 + w / 2, ctx.H - 18, C.dim, 10, 'center');
    const Smax = Km * 6;
    ctx.strokeStyle = C.blue; ctx.beginPath();
    for (let i = 0; i <= 140; i++) {
      const s = Smax * i / 140;
      const vv = Vmaxapp * s / (Kmapp + s);
      const x = x0 + w * (i / 140), y = y0 - h * vv / Vmax;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    ctx.strokeStyle = C.yellow; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(x0, y0 - h * Vmaxapp / Vmax); ctx.lineTo(x0 + w, y0 - h * Vmaxapp / Vmax); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x0 + w * (Kmapp / Smax), y0); ctx.lineTo(x0 + w * (Kmapp / Smax), y0 - h * Vmaxapp / Vmax / 2); ctx.stroke();
    ctx.setLineDash([]);
    const mx = x0 + w * Math.min(1, S / Smax);
    const myy = y0 - h * v / Vmax;
    ctx.fillStyle = C.accent;
    ctx.beginPath(); ctx.arc(mx, myy, 4.5, 0, Math.PI * 2); ctx.fill();

    // ES complex animation
    const ex = ctx.W - 60, ey = 40;
    for (let i = 0; i < 3; i++) {
      const t = (simState.time * 0.5 + i / 3) % 1;
      const bound = t < 0.5;
      const x = ex + (bound ? (0.5 - t) * 40 : (t - 0.5) * 40);
      ctx.fillStyle = bound ? C.green : C.blue;
      ctx.beginPath(); ctx.arc(x, ey + i * 26, 6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = C.dim;
    ctx.beginPath(); ctx.arc(ex, ey + 26, 20, 0.4, 2.7); ctx.stroke();
    label('E + S ⇌ ES → E + P', ex - 54, ey + 62, C.dim, 10);

    label('Michaelis–Menten', 14, 22, C.accent, 15);
    label('v = Vmax·[S] / (Km + [S])', 14, 44, C.text, 12);
    label('Vmax(app) = ' + Vmaxapp.toFixed(1) + '   Km(app) = ' + Kmapp.toFixed(2), 14, 66, C.yellow, 12);
    label('[S] = ' + S.toFixed(2) + ' → v = ' + v.toFixed(2) + ' (' + Math.round(100 * v / Vmax) + '% of Vmax)', 14, 86, C.green, 12);
    label(type === 'none' ? 'no inhibitor' : type + ' inhibition, [I] = ' + I.toFixed(1),
      14, ctx.H - 14, type === 'none' ? C.dim : C.red, 12);
    if (type === 'competitive') label('out-competed by more substrate: Vmax preserved, Km raised', 14, ctx.H - 32, C.dim, 10);
    if (type === 'noncompetitive') label('enzyme taken out of service: Vmax lowered', 14, ctx.H - 32, C.dim, 10);
  }

  function drawElectronConfig(ctx, p) {
    const z = Math.max(1, Math.min(20, Math.round(parseFloat(p['param-z']) || 6)));
    const order = ['1s', '2s', '2p', '3s', '3p', '4s', '3d'];
    const cap = [2, 2, 6, 2, 6, 2, 10];
    let left = z;
    const fill = [];
    for (let i = 0; i < order.length && left > 0; i++) {
      const n = Math.min(cap[i], left);
      fill.push({ name: order[i], n: n, cap: cap[i] });
      left -= n;
    }
    const str = fill.map(function(f) { return f.name + (f.n > 1 ? '<sup>' + f.n + '</sup>' : ''); }).join(' ');
    label('Z = ' + z, 14, 22, C.accent, 15);
    for (let i = 0; i < fill.length; i++) {
      const f = fill[i];
      const x = 20 + (i % 4) * 100, yy = 60 + Math.floor(i / 4) * 62;
      box(x, yy, 88, 48, C.grid, 'rgba(0,0,0,0.25)');
      label(f.name, x + 44, yy + 12, C.text, 12, 'center');
      const cells = Math.ceil(f.cap / 2);
      for (let j = 0; j < cells; j++) {
        const exx = x + 10 + j * 14;
        ctx.strokeStyle = C.dim;
        ctx.beginPath(); ctx.moveTo(exx, yy + 40); ctx.lineTo(exx, yy + 24); ctx.stroke();
        const cnt = Math.max(0, Math.min(2, f.n - j * 2));
        if (cnt >= 1) { ctx.fillStyle = C.yellow; ctx.beginPath(); ctx.arc(exx - 3, yy + 32, 3, 0, Math.PI * 2); ctx.fill(); }
        if (cnt >= 2) { ctx.fillStyle = C.blue; ctx.beginPath(); ctx.arc(exx + 3, yy + 32, 3, 0, Math.PI * 2); ctx.fill(); }
      }
    }
    const shells = [0, 0, 0, 0];
    for (let i = 0; i < fill.length; i++) {
      const n = parseInt(fill[i].name[0], 10) - 1;
      shells[n] += fill[i].n;
    }
    label('configuration: ' + str.replace(/<sup>|<\/sup>/g, ''), 14, ctx.H - 58, C.text, 12);
    label('shells: ' + shells.filter(function(s) { return s > 0; }).join(', '), 14, ctx.H - 38, C.dim, 12);
    label('valence electrons: ' + shells.filter(function(s) { return s > 0; }).slice(-1)[0], 14, ctx.H - 18, C.green, 12);
    label('Aufbau order fills ' + order.slice(0, 5).join(', ') + ' with Hund pairing inside each subshell', 14, ctx.H - 78, C.dim, 10);
    if (z === 24 || z === 29) label('exception: ' + (z === 24 ? 'Cr is 3d⁵4s¹' : 'Cu is 3d¹⁰4s¹') + ' (half/full d subshell is favoured)', 14, ctx.H - 98, C.yellow, 11);
  }

  // ---------- Simulation registry (replaces the old switch statements) ----------
  const SIMS = {
    'atom-builder': {
      p: function() {
        return slider('param-protons', t('protons'), 1, 22, 1, 6) +
          slider('param-neutrons', t('neutrons'), 0, 30, 1, 6) +
          slider('param-electrons', t('electronsLabel'), 0, 22, 1, 6) +
          drop('param-model', t('model'), [
            { v: 'atom', l: t('modelAtom') },
            { v: 'config', l: t('modelConfig') }
          ]);
      },
      d: function(ctx, p) {
        if (p['param-model'] === 'config') {
          const z = Math.round(p['param-protons'] || 6);
          drawElectronConfig(ctx, { 'param-z': z });
        } else drawAtomBuilder(ctx, p);
      }
    },
    'bond-builder': {
      p: function() {
        return drop('param-bondtype', t('bondKind'), [
            { v: 'ionic', l: t('bondIonic') }, { v: 'covalent', l: t('bondCovalent') }
          ]) +
          drop('param-metal', t('metal'), [
            { v: 'Na', l: 'Na' }, { v: 'K', l: 'K' }, { v: 'Li', l: 'Li' }, { v: 'Mg', l: 'Mg' }, { v: 'Ca', l: 'Ca' }
          ]) +
          drop('param-nonmetal', t('nonmetal'), [
            { v: 'Cl', l: 'Cl' }, { v: 'F', l: 'F' }, { v: 'O', l: 'O' }, { v: 'Br', l: 'Br' }, { v: 'S', l: 'S' }
          ]) +
          drop('param-molecule', t('molecule'), [
            { v: 'H2', l: 'H₂' }, { v: 'O2', l: 'O₂' }, { v: 'N2', l: 'N₂' }, { v: 'Cl2', l: 'Cl₂' },
            { v: 'H2O', l: 'H₂O' }, { v: 'CO2', l: 'CO₂' }, { v: 'CH4', l: 'CH₄' }, { v: 'NH3', l: 'NH₃' }
          ]) +
          slider('param-progress', t('transfer'), 0, 100, 5, 100, '%');
      },
      d: function(ctx, p) {
        if (p['param-bondtype'] === 'ionic') drawIonicBond(ctx, p); else drawCovalentBond(ctx, p);
      }
    },
    'balance-equation': {
      p: function() {
        return '<div class="param-control"><label for="param-equation">' + t('equation') + '</label>' +
          '<input type="text" id="param-equation" value="2 H2 + O2 -> 2 H2O" style="width:100%;background:#1a1a2e;color:#e8e8f0;border:1px solid #3a3a5c;border-radius:6px;padding:6px"></div>';
      },
      d: drawBalanceEquation
    },
    'calorimetry': {
      p: function() {
        return slider('param-mass', t('mass'), 10, 500, 5, 100, ' g') +
          slider('param-specific', t('specific'), 300, 5000, 50, 4184) +
          slider('param-deltat', t('deltaT'), -40, 100, 1, 20, ' K');
      },
      d: drawCalorimetry
    },
    'reaction-rate': {
      p: function() {
        return slider('param-ea', t('ea'), 10, 200, 5, 60, ' kJ/mol') +
          slider('param-temp', t('tempK'), 200, 800, 10, 298, ' K');
      },
      d: drawReactionRate
    },
    'solution-prep': {
      p: function() {
        return slider('param-molarity', t('molarity'), 0.01, 2, 0.01, 0.5, ' M') +
          slider('param-volume', t('volume'), 50, 1000, 10, 250, ' mL') +
          slider('param-mm', t('molarMassParam'), 10, 200, 1, 58.44, ' g/mol') +
          slider('param-fill', t('fill'), 0, 100, 1, 100, '%');
      },
      d: drawSolutionPrep
    },
    'ph-calc': {
      p: function() {
        return drop('param-kind', t('acidKind'), [{ v: 'strong', l: t('strong') }, { v: 'weak', l: t('weak') }]) +
          slider('param-conc', t('conc'), 0.0001, 1, 0.0001, 0.01, ' M') +
          slider('param-pka', t('pKa'), 0, 12, 0.1, 4.8);
      },
      d: drawPHCalc
    },
    'galvanic-cell': {
      p: function() {
        return drop('param-anode', t('anode'), [
            { v: 'Zn', l: 'Zn' }, { v: 'Fe', l: 'Fe' }, { v: 'Ni', l: 'Ni' }, { v: 'Sn', l: 'Sn' }, { v: 'Pb', l: 'Pb' }
          ]) +
          drop('param-cathode', t('cathode'), [
            { v: 'Cu', l: 'Cu' }, { v: 'Ag', l: 'Ag' }, { v: 'H', l: 'H' }, { v: 'Ni', l: 'Ni' }, { v: 'Fe', l: 'Fe' }
          ]);
      },
      d: drawGalvanicCell
    },
    'functional-groups': {
      p: function() {
        return drop('param-group', t('group'), [
            { v: 'alcohol', l: t('gAlcohol') }, { v: 'aldehyde', l: t('gAldehyde') }, { v: 'ketone', l: t('gKetone') },
            { v: 'acid', l: t('gAcid') }, { v: 'ester', l: t('gEster') }, { v: 'amine', l: t('gAmine') },
            { v: 'alkene', l: t('gAlkene') }, { v: 'halide', l: t('gHalide') }
          ]);
      },
      d: drawFunctionalGroup
    },
    'radioactive-decay': {
      p: function() {
        return slider('param-halflife', t('halfLife'), 1, 60, 1, 10) +
          drop('param-mode', t('decayMode'), [
            { v: 'alpha', l: 'α' }, { v: 'beta', l: 'β⁻' }, { v: 'gamma', l: 'γ' }
          ]);
      },
      d: drawRadioactiveDecay
    },
    'ir-spectrum': {
      p: function() {
        return slider('param-focus', t('wavenumber'), 400, 4000, 10, 1700, ' cm⁻¹');
      },
      d: drawIRSpectrum
    },
    'gas-law': {
      p: function() {
        return slider('param-temp', t('tempK'), 100, 800, 10, 300, ' K') +
          slider('param-volume', t('volume'), 0.5, 10, 0.5, 1, ' L') +
          slider('param-moles', t('moles'), 0.1, 5, 0.1, 1, ' mol');
      },
      d: drawGasLaw
    },
    'crystal-lattice': {
      p: function() {
        return drop('param-lattice', t('lattice'), [
            { v: 'simple', l: 'SC' }, { v: 'bcc', l: 'BCC' }, { v: 'fcc', l: 'FCC' },
            { v: 'hcp', l: 'HCP' }, { v: 'nacl', l: 'NaCl' }
          ]);
      },
      d: drawCrystalLattice
    },
    'quantum-numbers': {
      p: function() {
        return slider('param-n', 'n', 1, 5, 1, 3) +
          slider('param-l', 'l', 0, 4, 1, 1) +
          slider('param-ml', 'mₗ', -4, 4, 1, 0);
      },
      d: drawQuantumNumbers
    },
    'equilibrium-demo': {
      p: function() {
        return slider('param-K', 'K', 0.05, 20, 0.05, 1) +
          slider('param-A0', '[A]₀', 0.1, 2, 0.1, 1, ' M');
      },
      d: drawEquilibriumDemo
    },
    'photoelectric': {
      p: function() {
        return slider('param-wavelength', t('wavelength'), 100, 800, 10, 400, ' nm') +
          slider('param-workfn', t('workFn'), 1.0, 5.0, 0.1, 2.1, ' eV') +
          slider('param-intensity', t('intensity'), 1, 100, 1, 50, '%');
      },
      d: drawPhotoelectric
    },
    'adsorption': {
      p: function() {
        return slider('param-P', 'P', 0, 40, 0.5, 10, ' bar') +
          slider('param-K', 'K', 0.005, 1, 0.005, 0.05, ' bar⁻¹') +
          slider('param-area', t('surfaceArea'), 50, 1500, 50, 500, ' m²/g');
      },
      d: drawAdsorption
    },
    'titration': {
      p: function() {
        return drop('param-kind', t('acidKind'), [{ v: 'weak', l: t('weak') }, { v: 'strong', l: t('strong') }]) +
          slider('param-Ca', t('acidConc'), 0.01, 1, 0.01, 0.1, ' M') +
          slider('param-Va', t('acidVol'), 10, 50, 1, 25, ' mL') +
          slider('param-Cb', t('baseConc'), 0.01, 1, 0.01, 0.1, ' M') +
          slider('param-pka', t('pKa'), 2, 10, 0.1, 4.76) +
          slider('param-Ve', t('added'), 0, 60, 0.1, 0, ' mL');
      },
      d: drawTitration
    },
    'atom-economy': {
      p: function() {
        return drop('param-mode', t('reactionType'), [
            { v: 'addition', l: t('rAddition') }, { v: 'substitution', l: t('rSubstitution') },
            { v: 'elimination', l: t('rElimination') }, { v: 'rearrangement', l: t('rRearrangement') }
          ]);
      },
      d: drawAtomEconomy
    },
    'enzyme-kinetics': {
      p: function() {
        return slider('param-Vmax', 'Vmax', 10, 200, 5, 100) +
          slider('param-Km', 'Km', 0.5, 20, 0.5, 5) +
          slider('param-S', '[S]', 0, 30, 0.5, 5) +
          drop('param-inhibit', t('inhibitor'), [
            { v: 'none', l: t('none') }, { v: 'competitive', l: t('competitive') }, { v: 'noncompetitive', l: t('noncompetitive') }
          ]) +
          slider('param-I', '[I]', 0, 10, 0.5, 0);
      },
      d: drawEnzymeKinetics
    }
  };

  // ---------- Extra UI strings ----------
  const EXTRA = {
    en: {
      protons: 'Protons (Z)', neutrons: 'Neutrons (N)', electronsLabel: 'Electrons',
      model: 'View', modelAtom: 'Atom model', modelConfig: 'Electron configuration',
      bondKind: 'Bond type', bondIonic: 'Ionic (transfer)', bondCovalent: 'Covalent (sharing)',
      metal: 'Metal', nonmetal: 'Non-metal', molecule: 'Molecule', transfer: 'Transfer progress',
      equation: 'Equation (use -> between sides)', mass: 'Mass of water', specific: 'Specific heat c',
      deltaT: 'Temperature change', ea: 'Activation energy Ea', tempK: 'Temperature',
      molarity: 'Molarity', volume: 'Volume', molarMassParam: 'Solute molar mass', fill: 'Fill level',
      acidKind: 'Acid type', conc: 'Concentration', pKa: 'pKa', anode: 'Anode', cathode: 'Cathode',
      group: 'Functional group', gAlcohol: 'Alcohol –OH', gAldehyde: 'Aldehyde –CHO', gKetone: 'Ketone C=O',
      gAcid: 'Carboxylic acid –COOH', gEster: 'Ester –COO–', gAmine: 'Amine –NH₂', gAlkene: 'Alkene C=C',
      gHalide: 'Halide C–X', halfLife: 'Half-life', decayMode: 'Decay mode', wavenumber: 'Cursor wavenumber',
      moles: 'Amount n', lattice: 'Lattice', wavelength: 'Wavelength λ', workFn: 'Work function φ',
      intensity: 'Intensity', surfaceArea: 'Surface area', acidConc: 'Acid concentration',
      acidVol: 'Acid volume', baseConc: 'Titrant concentration', added: 'Burette volume added',
      reactionType: 'Reaction type', rAddition: 'Addition', rSubstitution: 'Substitution',
      rElimination: 'Elimination', rRearrangement: 'Rearrangement', inhibitor: 'Inhibitor',
      none: 'None', competitive: 'Competitive', noncompetitive: 'Non-competitive'
    },
    vi: {
      protons: 'Proton (Z)', neutrons: 'Neutron (N)', electronsLabel: 'Electron',
      model: 'Chế độ xem', modelAtom: 'Mô hình nguyên tử', modelConfig: 'Cấu hình electron',
      bondKind: 'Loại liên kết', bondIonic: 'Ion (cho nhận)', bondCovalent: 'Cộng hóa trị (chia sẻ)',
      metal: 'Kim loại', nonmetal: 'Phi kim', molecule: 'Phân tử', transfer: 'Tiến trình chuyển',
      equation: 'Phương trình (dùng -> ngăn hai vế)', mass: 'Khối lượng nước', specific: 'Nhiệt dung riêng c',
      deltaT: 'Độ thay đổi nhiệt độ', ea: 'Năng lượng hoạt hóa Ea', tempK: 'Nhiệt độ',
      molarity: 'Nồng độ mol', volume: 'Thể tích', molarMassParam: 'Khối lượng mol chất tan', fill: 'Mức rót',
      acidKind: 'Loại axit', conc: 'Nồng độ', pKa: 'pKa', anode: 'Anot', cathode: 'Catot',
      group: 'Nhóm chức', gAlcohol: 'Rượu –OH', gAldehyde: 'Andehit –CHO', gKetone: 'Xeton C=O',
      gAcid: 'Axit cacboxylic –COOH', gEster: 'Este –COO–', gAmine: 'Amin –NH₂', gAlkene: 'Anken C=C',
      gHalide: 'Dẫn xuất halogen C–X', halfLife: 'Chu kỳ bán rã', decayMode: 'Kiểu phân rã',
      wavenumber: 'Số sóng tại con trỏ', moles: 'Lượng n', lattice: 'Mạng tinh thể',
      wavelength: 'Bước sóng λ', workFn: 'Công thoát φ', intensity: 'Cường độ',
      surfaceArea: 'Diện tích bề mặt', acidConc: 'Nồng độ axit', acidVol: 'Thể tích axit',
      baseConc: 'Nồng độ dung dịch chuẩn', added: 'Thể tích đã nhỏ', reactionType: 'Loại phản ứng',
      rAddition: 'Phản ứng cộng', rSubstitution: 'Phản ứng thế', rElimination: 'Phản ứng tách',
      rRearrangement: 'Phản ứng sắp xếp lại', inhibitor: 'Chất ức chế', none: 'Không',
      competitive: 'Cạnh tranh', noncompetitive: 'Không cạnh tranh'
    }
  };
  for (const k in EXTRA.en) { I18N.en[k] = EXTRA.en[k]; I18N.vi[k] = EXTRA.vi[k]; }

  // ---------- Topic loading ----------
  function loadTopic(key) {
    currentTopic = key;
    currentLessonIndex = 0;
    for (const k in selectedAnswers) delete selectedAnswers[k];
    if (els.selector && els.selector.value !== key) els.selector.value = key;
    if (key === 'overview') {
      renderOverview();
      if (els.simArea) els.simArea.style.display = 'none';
      if (els.assessment) els.assessment.style.display = 'none';
      if (els.quiz) els.quiz.innerHTML = '';
      if (els.params) els.params.innerHTML = '';
      return;
    }
    if (!LESSONS[key]) { renderOverview(); return; }
    if (els.assessment) els.assessment.style.display = '';
    renderNav();
    renderLesson();
    loadSim();
    renderQuiz();
  }

  // ---------- Language ----------
  function updateAllLanguage() {
    document.documentElement.lang = currentLang;
    if (els.lang) { els.lang.textContent = t('langBtn'); els.lang.setAttribute('title', currentLang === 'en' ? 'Chuyển sang tiếng Việt' : 'Switch to English'); }
    if (els.headerTitle) els.headerTitle.textContent = t('title');
    if (els.back) els.back.setAttribute('title', t('back'));
    if (els.sidebarTitle) els.sidebarTitle.textContent = t('lessons');
    if (els.progressBtn) els.progressBtn.textContent = t('progress');
    if (els.simTitle) els.simTitle.textContent = t('simulation');
    if (els.reset) els.reset.textContent = t('reset');
    if (els.play) els.play.textContent = t('play');
    if (els.pause) els.pause.textContent = t('pause');
    if (els.assessTitle) els.assessTitle.textContent = t('knowledgeCheck');
    if (els.submit) els.submit.textContent = t('submitAnswer');
    if (els.calcInput) els.calcInput.placeholder = t('calcPlaceholder');
    if (els.calcBtn) els.calcBtn.textContent = t('calculate');

    if (els.refTitles && els.refTitles.length >= 3) {
      els.refTitles[0].textContent = t('periodicTable');
      els.refTitles[1].textContent = t('calculator');
      els.refTitles[2].textContent = t('constants');
    }
    const names = ['gasConstant', 'avogadro', 'planck'];
    Array.prototype.forEach.call(document.querySelectorAll('.const-name'), function(el, i) {
      if (names[i]) el.textContent = t(names[i]);
    });
    const statLabels = document.querySelectorAll('.stat-label');
    const sl = ['lessonsCompleted', 'quizzesPassed', 'averageScore'];
    Array.prototype.forEach.call(statLabels, function(el, i) { if (sl[i]) el.textContent = t(sl[i]); });
    const pm = document.querySelector('#progress-modal h2');
    if (pm) pm.textContent = t('yourProgress');

    if (els.selector) {
      const wanted = ['overview'].concat(TOPIC_ORDER);
      els.selector.innerHTML = wanted.map(function(k) {
        return '<option value="' + k + '">' + tc(k) + '</option>';
      }).join('');
      els.selector.value = currentTopic;
    }
    drawPeriodicTable();
    loadTopic(currentTopic);
  }

  // ---------- Reference panel ----------

  function drawPeriodicTable() {
    if (!els.ptable) return;
    let html = '';
    for (let k = 0; k < EL.length; k++) {
      const sym = EL[k][0], z = EL[k][1];
      const pos = cellPosition(z);
      html += '<div class="ptable-cell bl-' + blockOf(z) + '" style="grid-column:' + pos[0] +
        ';grid-row:' + pos[1] + '" data-sym="' + sym + '" title="' + getElementName(sym) + ' — Z ' + z +
        ', ' + EL[k][2] + ' ' + t('gPerMol') + '">' +
        '<span class="pt-z">' + z + '</span><span class="pt-sym">' + sym + '</span></div>';
    }
    html += '<div class="ptable-gap" style="grid-column:3;grid-row:6">57&ndash;71</div>' +
      '<div class="ptable-gap" style="grid-column:3;grid-row:7">89&ndash;103</div>';
    els.ptable.innerHTML = html;
    Array.prototype.forEach.call(els.ptable.querySelectorAll('.ptable-cell'), function(el) {
      el.addEventListener('click', function() {
        if (els.calcInput) {
          els.calcInput.value = el.getAttribute('data-sym');
          calculate();
        }
      });
    });
  }

  function calculate() {
    if (!els.calcInput || !els.calcResult) return;
    const raw = els.calcInput.value.trim();
    if (!raw) {
      els.calcResult.textContent = t('enterFormula');
      els.calcResult.style.color = C.dim;
      return;
    }
    const massMatch = raw.match(/^(\d+(?:\.\d+)?)\s*(?:g|gram|grams?)\s*(?:of\s+)?(.+)$/i);
    if (massMatch) {
      const g = parseFloat(massMatch[1]);
      const res = molarMass(massMatch[2]);
      if (res.mass > 0) {
        els.calcResult.textContent = g + ' g ' + massMatch[2].trim() + ' = ' + (g / res.mass).toFixed(4) +
          ' mol  (' + res.mass.toFixed(3) + ' ' + t('gPerMol') + ')';
        els.calcResult.style.color = C.green;
        return;
      }
    }
    const res = molarMass(raw);
    if (res.mass > 0) {
      const syms = Object.keys(res.counts);
      if (syms.length === 1 && res.counts[syms[0]] === 1) {
        els.calcResult.textContent = getElementName(syms[0]) + ' (' + syms[0] + ', Z=' + ELEMENT_Z[syms[0]] + ') — ' +
          res.mass.toFixed(3) + ' ' + t('gPerMol');
      } else {
        const breakdown = syms.map(function(s) { return s + ' ' + res.counts[s]; }).join(', ');
        const n = totalAtoms(res.counts);
        els.calcResult.textContent = raw + ' — ' + t('molarMass') + ' ' + res.mass.toFixed(3) +
          ' ' + t('gPerMol') + '  ·  ' + n + ' ' + (n === 1 ? t('atomOne') : t('atomsIn')) + ' (' + breakdown + ')';
      }
      els.calcResult.style.color = C.green;
    } else if (res.unknown) {
      els.calcResult.textContent = t('unknownElement') + ' ' + res.unknown;
      els.calcResult.style.color = C.red;
    } else {
      els.calcResult.textContent = t('invalidFormula') + ': ' + raw;
      els.calcResult.style.color = C.red;
    }
  }

  function totalAtoms(counts) {
    let n = 0;
    for (const sym in counts) n += counts[sym];
    return n;
  }

  // One formula unit: {sym: count}. Bracket groups multiply their contents.
  function parseSpecies(str) {
    let i = 0;
    let unknown = null;

    function group(depth) {
      const counts = {};
      while (i < str.length) {
        const ch = str[i];
        if (ch === '(' || ch === '[') {
          i++;
          const inner = group(depth + 1);
          if (inner === null) return null;
          let num = '';
          while (i < str.length && str[i] >= '0' && str[i] <= '9') num += str[i++];
          const mult = num ? parseInt(num, 10) : 1;
          for (const k in inner) counts[k] = (counts[k] || 0) + inner[k] * mult;
        } else if (ch === ')' || ch === ']') {
          if (depth === 0) { unknown = ch; return null; }
          i++;
          return counts;
        } else if (ch >= 'A' && ch <= 'Z') {
          const two = str[i] + (i + 1 < str.length && str[i + 1] >= 'a' && str[i + 1] <= 'z' ? str[i + 1] : '');
          if (!(two in MOLAR_MASS)) { unknown = two; return null; }
          i += two.length;
          let num = '';
          while (i < str.length && str[i] >= '0' && str[i] <= '9') num += str[i++];
          counts[two] = (counts[two] || 0) + (num ? parseInt(num, 10) : 1);
        } else {
          unknown = ch >= 'a' && ch <= 'z' ? '' : ch;
          return null;
        }
      }
      if (depth > 0) { unknown = '('; return null; }
      return counts;
    }

    const counts = group(0);
    if (counts === null) return { counts: null, unknown: unknown };
    let mass = 0;
    for (const k in counts) mass += MOLAR_MASS[k] * counts[k];
    return { counts: counts, mass: mass, unknown: null };
  }

  // Handles nested groups and hydrates: Ca(OH)2, Al2(SO4)3, CuSO4·5H2O, Na2CO3·10H2O
  function molarMass(formula) {
    const src = String(formula).trim();
    if (!src) return { mass: 0, unknown: null, counts: null };
    const parts = src.split(/[·•.]/);
    let total = 0;
    const counts = {};
    for (let p = 0; p < parts.length; p++) {
      let text = parts[p].replace(/[\s+−\-]/g, '');
      if (!text) continue;
      let mult = 1;
      const lead = text.match(/^(\d+)(?=[A-Za-z(\[])/);
      if (lead) {
        mult = parseInt(lead[1], 10);
        text = text.slice(lead[1].length);
      }
      if (/^\d/.test(text) || !/[A-Za-z]/.test(text)) return { mass: 0, unknown: null, counts: null };
      const r = parseSpecies(text);
      if (r.unknown !== null) return { mass: 0, unknown: r.unknown || null, counts: null };
      total += r.mass * mult;
      for (const k in r.counts) counts[k] = (counts[k] || 0) + r.counts[k] * mult;
    }
    if (total <= 0) return { mass: 0, unknown: null, counts: null };
    return { mass: total, unknown: null, counts: counts };
  }

  // ---------- Progress ----------
  function openProgress() {
    if (!els.modal) return;
    els.modal.hidden = false;
    if (els.statLessons) els.statLessons.textContent = progress.lessonsCompleted + ' / ' + totalLessons();
    if (els.statQuizzes) els.statQuizzes.textContent = progress.quizzesPassed + ' / ' + totalQuizQuizzes();
    if (els.statScore) {
      const avg = progress.scores.length ?
        Math.round(progress.scores.reduce(function(a, b) { return a + b; }, 0) / progress.scores.length) : 0;
      els.statScore.textContent = avg + '%';
    }
    drawProgressChart();
  }

  function totalQuizQuizzes() {
    let n = 0;
    for (const k in LESSONS) { if (k) n += 1; }
    return n;
  }

  function drawProgressChart() {
    if (!els.progressCanvas) return;
    const host = els.progressCanvas.parentElement;
    const w = Math.max(260, host.clientWidth - 8), h = 180;
    const dpr = window.devicePixelRatio || 1;
    els.progressCanvas.width = w * dpr;
    els.progressCanvas.height = h * dpr;
    els.progressCanvas.style.width = w + 'px';
    els.progressCanvas.style.height = h + 'px';
    const g = els.progressCanvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#0b0b16';
    g.fillRect(0, 0, w, h);
    const bw = (w - 30) / TOPIC_ORDER.length;
    for (let i = 0; i < TOPIC_ORDER.length; i++) {
      const k = TOPIC_ORDER[i], tp = LESSONS[k];
      if (!tp) continue;
      let done = 0;
      for (let j = 0; j < tp.lessons.length; j++) if (doneLessons[k + ':' + j]) done++;
      const ratio = done / tp.lessons.length;
      g.fillStyle = ratio > 0 ? tp.color : '#24243f';
      const bh = ratio * (h - 46);
      g.fillRect(15 + i * bw, h - 26 - bh, bw - 3, Math.max(2, bh));
      g.fillStyle = '#6a6a8a';
      g.font = '8px sans-serif';
      g.textAlign = 'center';
      g.fillText(String(i + 1), 15 + i * bw + bw / 2, h - 12);
    }
    g.strokeStyle = '#3a3a5c';
    g.beginPath(); g.moveTo(15, h - 26); g.lineTo(w - 15, h - 26); g.stroke();
    g.fillStyle = '#a8dadc'; g.font = '10px sans-serif'; g.textAlign = 'left';
    g.fillText(t('courseTopics'), 15, 14);
  }

  // ---------- Events & boot ----------
  function bind() {
    if (els.back) els.back.addEventListener('click', function() {
      if (history.length > 1) history.back();
      else window.location.href = 'index.html';
    });
    if (els.lang) els.lang.addEventListener('click', function() {
      currentLang = currentLang === 'en' ? 'vi' : 'en';
      try { localStorage.setItem('tm-lang', currentLang); } catch (e) { /* ignore */ }
      saveProgress();
      updateAllLanguage();
    });
    if (els.selector) els.selector.addEventListener('change', function() { loadTopic(els.selector.value); });
    if (els.reset) els.reset.addEventListener('click', function() {
      stopLoop();
      simState.time = 0;
      const inputs = els.params ? els.params.querySelectorAll('input[type="range"]') : [];
      Array.prototype.forEach.call(inputs, function(inp) {
        if (inp.defaultValue !== undefined) inp.value = inp.defaultValue;
      });
      drawSim();
    });
    if (els.play) els.play.addEventListener('click', function() {
      if (simState.playing) return;
      simState.playing = true;
      simState.last = 0;
      simState.raf = requestAnimationFrame(loop);
    });
    if (els.pause) els.pause.addEventListener('click', function() { stopLoop(); drawSim(); });
    if (els.submit) els.submit.addEventListener('click', gradeQuiz);
    if (els.progressBtn) els.progressBtn.addEventListener('click', openProgress);
    if (els.calcBtn) els.calcBtn.addEventListener('click', calculate);
    if (els.calcInput) els.calcInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') calculate();
    });
    Array.prototype.forEach.call(document.querySelectorAll('.modal-close'), function(b) {
      b.addEventListener('click', function() { if (els.modal) els.modal.hidden = true; });
    });
    if (els.modal) els.modal.addEventListener('click', function(e) {
      if (e.target === els.modal) els.modal.hidden = true;
    });
    window.addEventListener('resize', function() {
      if (currentTopic !== 'overview') drawSim();
      if (els.modal && !els.modal.hidden) drawProgressChart();
    });
  }

  loadProgress();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  function boot() {
    updateAllLanguage();
    bind();
    const start = new URLSearchParams(location.search).get('topic');
    if (start && LESSONS[start]) loadTopic(start);
    fitCanvas();
  }
})();
