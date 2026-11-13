(function () {
  'use strict';
  const L = (en, vi) => ({ en, vi });
  const lessons = [
    {
      id: 'atom', title: L('Meet an atom', 'Làm quen với nguyên tử'), concept: 'atom',
      objective: L('Place a hydrogen atom and inspect its nucleus.', 'Đặt một nguyên tử hydrogen và xem hạt nhân.'),
      steps: L('Open the element pool, search H, then drag Hydrogen into empty space. Select it in the live atom list below and press Inspect. You can close this panel while placing atoms.', 'Mở kho nguyên tố, tìm H, rồi kéo Hydrogen vào chỗ trống. Chọn nó trong danh sách nguyên tử thật bên dưới và nhấn Xem. Bạn có thể thu gọn bảng này khi đặt nguyên tử.'),
      hint: L('H is the symbol for hydrogen. Its atomic number is 1: one proton. If your stock is empty, open Supplies and buy one H; no lesson requires a paid advanced tool.', 'H là ký hiệu của hydrogen. Số hiệu nguyên tử 1 nghĩa là có một proton. Nếu hết kho, mở Vật tư và mua một H; bài học không đòi hỏi công cụ nâng cao phải mua.'),
      explanation: L('An atom has a tiny nucleus surrounded by electrons. The nucleus contains protons and, for most isotopes, neutrons. Ordinary hydrogen-1 has no neutron. The screen model is not drawn to physical scale.', 'Nguyên tử có hạt nhân nhỏ và các electron xung quanh. Hạt nhân chứa proton và thường có neutron; hydrogen-1 không có neutron. Hình trên màn hình không theo tỷ lệ kích thước thật.'),
      question: L('What determines which element an atom is?', 'Điều gì xác định một nguyên tử thuộc nguyên tố nào?'),
      answers: [L('Number of protons', 'Số proton'), L('Its screen colour', 'Màu trên màn hình'), L('Its position', 'Vị trí')], correct: 0,
      checks: [L('Inspect a hydrogen atom in the scene', 'Xem một nguyên tử hydrogen trong cảnh')]
    },
    {
      id: 'elements', title: L('Elements are identities', 'Nguyên tố là danh tính'), concept: 'element',
      objective: L('Compare hydrogen and oxygen without changing their nuclei.', 'So sánh hydrogen và oxygen mà không đổi hạt nhân.'),
      steps: L('Keep your H. Search O in the pool and drag Oxygen into the scene. Use Inspect on one H and one O. Place them apart for now; bonding does not change their element.', 'Giữ H. Tìm O trong kho rồi kéo Oxygen vào cảnh. Nhấn Xem cho một H và một O. Tạm đặt cách xa nhau; liên kết không làm đổi nguyên tố.'),
      hint: L('Use the live atom list, not a picture in the glossary. H has Z = 1 and O has Z = 8. Inspect each once.', 'Dùng danh sách nguyên tử thật, không phải hình trong từ điển. H có Z = 1, O có Z = 8. Xem từng nguyên tử một lần.'),
      explanation: L('An element is a kind of atom defined by proton count, Z. Isotopes have the same Z but different neutron counts. Ordinary chemical reactions rearrange atoms; they do not turn oxygen into hydrogen.', 'Nguyên tố được xác định bởi số proton Z. Các đồng vị có cùng Z nhưng khác số neutron. Phản ứng hóa học thông thường sắp xếp lại nguyên tử, không biến oxygen thành hydrogen.'),
      question: L('Does bonding H to O change O into a new element?', 'Liên kết H với O có biến O thành nguyên tố mới không?'),
      answers: [L('Yes', 'Có'), L('No; its proton count stays 8', 'Không; số proton vẫn là 8')], correct: 1,
      checks: [L('Inspect H', 'Xem H'), L('Inspect O', 'Xem O')]
    },
    {
      id: 'electrons', title: L('Meet the electrons', 'Làm quen với electron'), concept: 'electron',
      objective: L('Read the electron-shell model for a neutral oxygen atom.', 'Đọc mô hình lớp electron của oxygen trung hòa.'),
      steps: L('Inspect an O atom. Read the neutral-atom shell diagram below: the inner shell holds 2 electrons and the next holds 6. This is a teaching diagram, not electron trajectories.', 'Xem một nguyên tử O. Đọc sơ đồ lớp của nguyên tử trung hòa bên dưới: lớp trong có 2 electron, lớp tiếp có 6. Đây là sơ đồ học tập, không phải quỹ đạo chuyển động electron.'),
      hint: L('Count the outer dots, not all dots. Neutral O has 8 electrons in total. Ions and bonded atoms need more detailed electronic descriptions.', 'Đếm các chấm ngoài cùng, không phải tất cả. O trung hòa có tổng cộng 8 electron. Ion và nguyên tử trong liên kết cần mô tả điện tử chi tiết hơn.'),
      explanation: L('Electron configurations describe how electrons occupy orbitals. A shell diagram groups these orbitals by principal energy level. Valence electrons help explain bonding; the octet rule is useful, not universal.', 'Cấu hình electron mô tả sự phân bố trong orbital. Sơ đồ lớp nhóm các orbital theo mức năng lượng chính. Electron hóa trị giúp giải thích liên kết; quy tắc bát tử hữu ích nhưng không phổ quát.'),
      question: L('How many outer-shell electrons does neutral O have?', 'O trung hòa có bao nhiêu electron lớp ngoài cùng?'),
      answers: [L('2', '2'), L('8', '8'), L('6', '6')], correct: 2,
      checks: [L('Inspect O and its shell diagram', 'Xem O và sơ đồ lớp electron')]
    },
    {
      id: 'bond', title: L('Make your first bond', 'Tạo liên kết đầu tiên'), concept: 'bond',
      objective: L('Build H₂ using two real hydrogen atoms.', 'Tạo H₂ từ hai nguyên tử hydrogen thật'),
      steps: L('Drag two H atoms near each other. They can bond automatically when conditions allow. Alternatively choose the two H IDs below and press Bond. Check the scene when the H–H link appears.', 'Kéo hai H gần nhau. Chúng có thể tự liên kết nếu điều kiện phù hợp. Hoặc chọn hai mã H bên dưới rồi nhấn Liên kết. Kiểm tra cảnh khi xuất hiện H–H.'),
      hint: L('Choose two different atoms. Hydrogen normally makes one single covalent bond in this exercise. If an H already belongs to water, place another H instead.', 'Chọn hai nguyên tử khác nhau. Trong bài này hydrogen thường tạo một liên kết cộng hóa trị đơn. Nếu H đã thuộc phân tử nước, hãy đặt H khác.'),
      explanation: L('A covalent bond involves shared electron density. A single bond is represented by one line and one shared electron pair in a Lewis model. The ball-and-stick model does not show the full electron distribution.', 'Liên kết cộng hóa trị liên quan đến mật độ electron dùng chung. Mô hình Lewis dùng một nét và một cặp electron chung cho liên kết đơn. Mô hình cầu–que không biểu diễn toàn bộ phân bố electron.'),
      question: L('What does the line in H–H represent?', 'Nét trong H–H biểu diễn gì?'),
      answers: [L('A covalent bond', 'Liên kết cộng hóa trị'), L('A new element', 'Nguyên tố mới')], correct: 0,
      checks: [L('One connected H₂ with one single bond', 'Một H₂ nối bằng một liên kết đơn')]
    },
    {
      id: 'water', title: L('Build water', 'Tạo nước'), concept: 'molecule',
      objective: L('Connect two H atoms to one O atom.', 'Nối hai H với một O'),
      steps: L('Place one O and two H. Bond each H to O, not to the other H. The result should look like H–O–H. Use the Bond controls if dragging is difficult.', 'Đặt một O và hai H. Nối mỗi H với O, không nối H với H. Kết quả có dạng H–O–H. Dùng nút Liên kết nếu thao tác kéo khó.'),
      hint: L('O is the centre with two single bonds. Use new H atoms if the old ones already form H₂. The checker verifies connectivity and bond orders, not only the formula.', 'O ở giữa với hai liên kết đơn. Dùng H mới nếu các H cũ đã tạo H₂. Bộ kiểm tra xét cách nối và bậc liên kết, không chỉ công thức.'),
      explanation: L('Water is a molecule: a connected group of atoms. H₂O means two hydrogen atoms and one oxygen atom. Bonding these atoms in the sandbox is a construction exercise, not a claim that isolated atoms can be handled like this in a real lab.', 'Nước là phân tử: một nhóm nguyên tử liên kết với nhau. H₂O gồm hai hydrogen và một oxygen. Ghép nguyên tử trong mô phỏng là bài tập xây dựng, không có nghĩa phòng thí nghiệm thật thao tác nguyên tử như vậy.'),
      question: L('How many atoms are in one H₂O molecule?', 'Một phân tử H₂O có bao nhiêu nguyên tử?'),
      answers: [L('2', '2'), L('3', '3'), L('1', '1')], correct: 1,
      checks: [L('H–O–H with two single bonds', 'H–O–H với hai liên kết đơn')]
    },
    {
      id: 'formula', title: L('Read a molecular formula', 'Đọc công thức phân tử'), concept: 'formula',
      objective: L('Build and read CO₂: O=C=O.', 'Tạo và đọc CO₂: O=C=O'),
      steps: L('Place C and two O. Bond C to each O. Select each bond in the list below and set its order to 2. Inspect the completed molecule and compare its atom counts with CO₂.', 'Đặt C và hai O. Nối C với từng O. Chọn từng liên kết trong danh sách bên dưới và đặt bậc 2. Xem phân tử hoàn chỉnh và so sánh số nguyên tử với CO₂.'),
      hint: L('C needs two double bonds here: O=C=O. A missing subscript means one atom. A formula alone cannot specify all connectivity.', 'Ở đây C có hai liên kết đôi: O=C=O. Không có chỉ số dưới nghĩa là một nguyên tử. Chỉ công thức chưa xác định mọi cách nối.'),
      explanation: L('The subscript counts atoms of the element immediately before it. CO₂ has one C and two O, whereas 2 CO₂ means two complete molecules. Double bonds contribute two to bond-order sums.', 'Chỉ số dưới đếm nguyên tử của nguyên tố ngay trước nó. CO₂ có một C và hai O; 2 CO₂ nghĩa là hai phân tử. Liên kết đôi đóng góp 2 vào tổng bậc liên kết.'),
      question: L('What does the ₂ in CO₂ count?', 'Số ₂ trong CO₂ đếm gì?'),
      answers: [L('Carbon atoms', 'Nguyên tử carbon'), L('Whole molecules', 'Toàn bộ phân tử'), L('Oxygen atoms', 'Nguyên tử oxygen')], correct: 2,
      checks: [L('One C with two double-bonded O neighbours', 'Một C nối đôi với hai O')]
    },
    {
      id: 'geometry', title: L('Molecules have shape', 'Phân tử có hình dạng'), concept: 'geometry',
      objective: L('Build methane and examine it from another angle.', 'Tạo methane và xem từ góc khác'),
      steps: L('Place C and four H, with one single bond from C to each H. Rotate the actual 3D camera by dragging empty space. Check the scene after rotating; four bonds should point into three dimensions.', 'Đặt C và bốn H; nối đơn C với từng H. Kéo chỗ trống để xoay camera 3D thật. Kiểm tra cảnh sau khi xoay; bốn liên kết hướng trong không gian ba chiều.'),
      hint: L('CH₄ has no lone pair on neutral carbon. An ideal tetrahedron has H–C–H angles near 109.5°. This lesson checks the live geometry, allowing small simulation distortions.', 'CH₄ trung hòa không có cặp electron tự do trên C. Tứ diện lý tưởng có góc H–C–H khoảng 109,5°. Bài kiểm tra hình học thật và cho phép sai lệch nhỏ của mô phỏng.'),
      explanation: L('VSEPR predicts shapes from repulsion among electron domains. Four bonding domains around methane carbon give a tetrahedral shape, not a flat cross. The model is approximate.', 'VSEPR dự đoán hình dạng từ lực đẩy giữa các miền electron. Bốn miền liên kết quanh C trong methane cho hình tứ diện, không phải dấu cộng phẳng. Đây là mô hình gần đúng.'),
      question: L('What is methane’s approximate shape?', 'Methane có hình dạng gần đúng nào?'),
      answers: [L('Tetrahedral', 'Tứ diện'), L('Flat square', 'Vuông phẳng'), L('Linear', 'Thẳng')], correct: 0,
      checks: [L('CH₄ with tetrahedral live geometry', 'CH₄ có hình tứ diện trong cảnh'), L('Rotate the scene camera', 'Xoay camera cảnh')]
    },
    {
      id: 'isomers', title: L('Same formula, different connections', 'Cùng công thức, khác cách nối'), concept: 'isomer',
      objective: L('Build ethanol and dimethyl ether, both C₂H₆O.', 'Tạo ethanol và dimethyl ether, đều là C₂H₆O'),
      steps: L('Build CH₃–CH₂–O–H (ethanol), then Check scene. Next build CH₃–O–CH₃ (dimethyl ether) and Check again. You may keep both or build one at a time. BluePrint is available for drawing before sending to 3D.', 'Tạo CH₃–CH₂–O–H (ethanol), rồi Kiểm tra cảnh. Tiếp theo tạo CH₃–O–CH₃ (dimethyl ether) và kiểm tra lại. Có thể giữ cả hai hoặc tạo lần lượt. BluePrint cho phép vẽ trước khi đưa vào 3D.'),
      hint: L('Use only single bonds. Ethanol: C–C–O–H; give the first C three H and the second C two H. Ether: C–O–C; give each C three H. Both carbons need four bonds and O needs two.', 'Chỉ dùng liên kết đơn. Ethanol: C–C–O–H; thêm ba H vào C đầu, hai H vào C sau. Ether: C–O–C; thêm ba H vào mỗi C. Mỗi C cần bốn liên kết, O cần hai.'),
      explanation: L('Constitutional isomers share a formula but differ in connectivity. Ethanol has an O–H group; dimethyl ether has oxygen between two carbons. Rotating one molecule does not make it a new isomer.', 'Đồng phân cấu tạo cùng công thức nhưng khác cách nối. Ethanol có nhóm O–H; dimethyl ether có O giữa hai C. Xoay một phân tử không tạo đồng phân mới.'),
      question: L('Why are these different isomers?', 'Vì sao chúng là hai đồng phân khác nhau?'),
      answers: [L('Different screen orientation', 'Khác hướng trên màn hình'), L('Different atom connectivity', 'Khác cách nối nguyên tử')], correct: 1,
      checks: [L('Observe valid ethanol in the scene', 'Quan sát ethanol hợp lệ trong cảnh'), L('Observe valid dimethyl ether', 'Quan sát dimethyl ether hợp lệ')]
    },
    {
      id: 'reaction', title: L('Atoms rearrange in reactions', 'Nguyên tử sắp xếp lại khi phản ứng'), concept: 'reaction',
      objective: L('Use the game’s water-electrolysis reaction.', 'Dùng phản ứng điện phân nước của trò chơi'),
      steps: L('Build two separate H₂O molecules. Press Select water, then Run electrolysis below. This selects real molecules and calls the existing reaction system with electricity; it consumes the selected water. Observe H₂ and O₂ products. Use only the simulation, not household electricity or real chemicals.', 'Tạo hai phân tử H₂O riêng. Nhấn Chọn nước, rồi Chạy điện phân bên dưới. Thao tác chọn phân tử thật và dùng hệ phản ứng hiện có với điện; nước được chọn sẽ bị tiêu thụ. Quan sát sản phẩm H₂ và O₂. Chỉ thực hiện trong mô phỏng, không dùng điện gia dụng hay hóa chất thật.'),
      hint: L('The equation is 2 H₂O → 2 H₂ + O₂. Select water automatically below, or double-click molecules and choose electricity in the reaction panel. Electricity supplies energy; spontaneous does not mean instantaneous.', 'Phương trình là 2 H₂O → 2 H₂ + O₂. Dùng nút chọn nước bên dưới, hoặc nhấp đúp phân tử và chọn điện trong bảng phản ứng. Điện cung cấp năng lượng; tự diễn biến không có nghĩa tức thời.'),
      explanation: L('A balanced chemical equation conserves atoms and charge. Electrolysis needs electrical work. This game uses a reaction model, not a detailed electrochemical cell with electrodes and electrolyte.', 'Phương trình cân bằng bảo toàn nguyên tử và điện tích. Điện phân cần công điện. Trò chơi dùng mô hình phản ứng, không phải pin điện hóa chi tiết với điện cực và chất điện ly.'),
      question: L('What is conserved in this chemical reaction?', 'Điều gì được bảo toàn trong phản ứng hóa học này?'),
      answers: [L('Each element’s atom count and total charge', 'Số nguyên tử mỗi nguyên tố và tổng điện tích'), L('The number of molecules must stay fixed', 'Số phân tử luôn giữ nguyên')], correct: 0,
      checks: [L('Run actual water electrolysis and observe its products', 'Chạy điện phân nước thật trong mô phỏng và quan sát sản phẩm')]
    },
    {
      id: 'independent', title: L('Your own investigation', 'Tự khám phá'), concept: 'experiment',
      objective: L('Plan, build, observe, and explain a new molecule.', 'Lên kế hoạch, tạo, quan sát và giải thích phân tử mới'),
      steps: L('Write and record a prediction below, then build a new connected, neutral molecule with at least three atoms using H, C, N or O and their usual valences. This introductory checker does not assess other elements or ions. It must not already exist when you record the prediction. NH₃ is a good first choice: N bonded to three H. Check your structure, inspect an atom in it, and record what happened.', 'Viết và ghi dự đoán bên dưới, rồi tạo phân tử trung hòa mới có ít nhất ba nguyên tử H, C, N hoặc O với hóa trị thông thường. Bộ kiểm tra nhập môn này không đánh giá nguyên tố khác hay ion. Phân tử đó chưa được có lúc ghi dự đoán. NH₃ là lựa chọn phù hợp: N nối với ba H. Kiểm tra cấu trúc, xem một nguyên tử trong đó, rồi ghi điều quan sát được.'),
      hint: L('Prediction example: “I expect N with three H to form a pyramid.” Build and inspect it, then describe whether the observation agreed. A result that differs from a prediction is useful evidence, not failure.', 'Ví dụ dự đoán: “Tôi nghĩ N với ba H tạo hình chóp.” Tạo và xem, rồi ghi kết quả có phù hợp không. Kết quả khác dự đoán cũng là bằng chứng hữu ích, không phải thất bại.'),
      explanation: L('Scientific investigation separates predictions, observations, and explanations. A stable-looking sandbox model is not proof of real-world stability or a safe synthesis. Use the science guide and reaction workspace to check model assumptions.', 'Nghiên cứu khoa học phân biệt dự đoán, quan sát và giải thích. Hình ổn định trong mô phỏng không chứng minh độ bền thật hay quy trình tổng hợp an toàn. Dùng hướng dẫn khoa học và bảng dự đoán phản ứng để xem giả định mô hình.'),
      question: L('Does a molecule appearing in the game prove it can be safely made?', 'Phân tử xuất hiện trong trò chơi có chứng minh nó có thể được tạo an toàn không?'),
      answers: [L('Yes', 'Có'), L('No; model limits and real evidence matter', 'Không; cần xét giới hạn mô hình và bằng chứng thật')], correct: 1,
      checks: [L('Record a prediction before building', 'Ghi dự đoán trước khi tạo'), L('Build and inspect a new valid molecule', 'Tạo và xem phân tử mới hợp lệ'), L('Record your observation', 'Ghi quan sát')]
    }
  ];
  const glossary = [
    ['atom', L('Atom', 'Nguyên tử'), lessons[0].explanation, 'H: Z = 1', 'quantum'],
    ['element', L('Element & isotope', 'Nguyên tố & đồng vị'), lessons[1].explanation, '¹H, ²H: Z = 1', 'nuclear'],
    ['electron', L('Electrons & valence', 'Electron & hóa trị'), lessons[2].explanation, 'O: 1s² 2s² 2p⁴ → 2, 6', 'quantum'],
    ['bond', L('Covalent bond', 'Liên kết cộng hóa trị'), lessons[3].explanation, 'H–H; O=O; N≡N', 'stability'],
    ['molecule', L('Molecule', 'Phân tử'), lessons[4].explanation, 'H–O–H', 'stability'],
    ['formula', L('Formula & coefficient', 'Công thức & hệ số'), lessons[5].explanation, '2 H₂O = 4 H + 2 O (atom counts)', 'reactions'],
    ['geometry', L('Molecular geometry / VSEPR', 'Hình học phân tử / VSEPR'), lessons[6].explanation, 'CH₄: ~109.5°; CO₂: 180°', 'quantum'],
    ['isomer', L('Isomer', 'Đồng phân'), lessons[7].explanation, 'CH₃CH₂OH ≠ CH₃OCH₃', 'organic'],
    ['reaction', L('Reaction & conservation', 'Phản ứng & bảo toàn'), lessons[8].explanation, '2 H₂O → 2 H₂ + O₂', 'reactions'],
    ['experiment', L('Prediction versus evidence', 'Dự đoán và bằng chứng'), lessons[9].explanation, 'Prediction → observation → explanation', 'analytical'],
    ['charge', L('Ion & formal charge', 'Ion & điện tích hình thức'), L('An ion has a net electric charge. Formal charge is a bookkeeping assignment in a Lewis structure, not a measured partial charge on an atom.', 'Ion có điện tích tổng khác không. Điện tích hình thức là cách phân chia electron trong cấu trúc Lewis, không phải điện tích riêng phần đo được.'), 'Na⁺ + Cl⁻: total charge 0', 'redox'],
    ['energy', L('Enthalpy & Gibbs energy', 'Enthalpy & năng lượng Gibbs'), L('Enthalpy tracks heat at constant pressure. Gibbs energy describes thermodynamic driving force at fixed temperature and pressure. A negative reaction Gibbs energy does not tell you the reaction speed.', 'Enthalpy liên quan đến nhiệt ở áp suất không đổi. Năng lượng Gibbs mô tả động lực nhiệt động ở nhiệt độ và áp suất xác định. Gibbs phản ứng âm không cho biết tốc độ phản ứng.'), 'ΔG = ΔH − TΔS', 'thermodynamics'],
    ['rate', L('Activation barrier & catalyst', 'Rào cản hoạt hóa & chất xúc tác'), L('A reaction needs a pathway. An activation barrier can make an energetically favourable reaction slow. A catalyst supplies a different pathway; it does not change the equilibrium constant at a fixed temperature.', 'Phản ứng cần cơ chế. Rào cản hoạt hóa có thể làm phản ứng thuận lợi về năng lượng vẫn chậm. Chất xúc tác tạo đường phản ứng khác; không đổi hằng số cân bằng ở nhiệt độ cố định.'), 'k = A exp(−Ea/RT)', 'kinetics'],
    ['equilibrium', L('Equilibrium', 'Cân bằng'), L('At dynamic equilibrium forward and reverse rates are equal, not necessarily concentrations. Activities are dimensionless measures of effective concentration relative to a standard state.', 'Ở cân bằng động, tốc độ thuận và nghịch bằng nhau, không nhất thiết nồng độ bằng nhau. Hoạt độ là đại lượng không thứ nguyên của nồng độ hiệu dụng so với trạng thái chuẩn.'), 'ΔG = ΔG° + RT ln Q', 'equilibrium']
  ];
  window.MolLearningContent = { lessons, glossary };
})();
