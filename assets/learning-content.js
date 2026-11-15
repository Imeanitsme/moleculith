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
  // Concept dictionary, written in Vietnamese first and then carried into
  // English by hand. Three layers per group: `terms` is the technical
  // vocabulary, `formal` is the definition a learner needs when they ask
  // "but what is it exactly?" (shown as the advanced layer and as each term's
  // tooltip), and `metaphor` is the picture a beginner holds on to first.
  // `keys` keeps the older concept ids pointing at the right group.
  const concepts = [
    {
      id: 'atom-isotope', keys: ['atom', 'element', 'molecule'],
      title: L('1 · Atom and isotope', '1 · Nguyên tử và đồng vị'),
      terms: L('Atom · Nucleus · Proton · Neutron · Electron · Atomic number (Z) · Isotope',
        'Nguyên tử · Hạt nhân · Proton · Neutron · Electron · Số hiệu nguyên tử (Z) · Đồng vị'),
      formal: L('An atom is a tiny nucleus of positively charged protons and uncharged neutrons (hydrogen-¹H has no neutron at all), ringed by negatively charged electrons. The atomic number Z, the proton count, is the only thing that fixes which element an atom is. Isotopes are atoms of one element: same Z, different neutron count, so a different mass number A = Z + N. A chemical reaction only rearranges the bonds between atoms; it never turns one element into another, because the nucleus is untouched.',
        'Nguyên tử gồm một hạt nhân rất nhỏ chứa proton mang điện dương và neutron không mang điện (riêng hydrogen-¹H hoàn toàn không có neutron), được bao quanh bởi các electron mang điện âm. Số hiệu nguyên tử Z, tức số proton, là đại lượng duy nhất xác định nguyên tố; các đồng vị của cùng một nguyên tố có cùng Z nhưng khác số neutron nên khác số khối A = Z + N. Phản ứng hóa học chỉ sắp xếp lại các liên kết giữa những nguyên tử, không biến đổi hạt nhân và không biến nguyên tố này thành nguyên tố khác.'),
      metaphor: L('Atoms are the basic Lego bricks that everything is built from. The nucleus sits stuck in the middle like a marble while the electrons buzz around it like a swarm of bees. Isotopes are twins: the same personality, the same element, but a different weight because they carry a different number of neutrons.',
        'Nguyên tử là những viên gạch Lego cơ bản cấu tạo nên mọi vật chất. Hạt nhân nằm lì ở giữa như viên bi, còn electron bay lượn xung quanh như một bầy ong. Đồng vị là những anh em sinh đôi cùng tính cách (cùng nguyên tố) nhưng nặng nhẹ khác nhau vì số neutron khác nhau.'),
      example: '¹H: Z = 1, N = 0 · ²H: Z = 1, N = 1 · A = Z + N',
      topic: 'nuclear'
    },
    {
      id: 'electron-bond', keys: ['electron', 'bond'],
      title: L('2 · Electron configuration and the covalent bond', '2 · Cấu hình electron và liên kết cộng hóa trị'),
      terms: L('Electron shell · Orbital · Valence electron · Octet rule · Covalent bond · Lewis model · Ball-and-stick model',
        'Vỏ electron · Orbital (ô-bi-tan) · Electron hóa trị · Quy tắc bát tử · Liên kết cộng hóa trị · Mô hình Lewis · Mô hình cầu–que'),
      formal: L('Electrons occupy orbitals in order of increasing energy, and the outermost shell holds the valence electrons; these are what decide how an atom behaves chemically. A covalent bond forms when two atoms share one or more electron pairs, so electron density builds up between the two nuclei and holds them together. The Lewis model draws each shared pair as one line: H–H is one pair, O=O two, N≡N three. The ball-and-stick model then shows the nuclei and the bonds, but not the electron cloud itself.',
        'Electron phân bố trong các orbital theo mức năng lượng tăng dần; lớp ngoài cùng chứa electron hóa trị và chính các electron hóa trị quyết định tính chất hóa học của nguyên tử. Liên kết cộng hóa trị hình thành khi hai nguyên tử dùng chung một hay nhiều cặp electron, làm mật độ electron tập trung giữa hai hạt nhân và giữ chúng lại gần nhau. Mô hình Lewis biểu diễn mỗi cặp electron chung bằng một nét gạch: H–H là một cặp, O=O hai cặp, N≡N ba cặp. Mô hình cầu–que sau đó cho thấy hạt nhân và liên kết, nhưng không cho thấy đám mây electron.'),
      metaphor: L('A covalent bond is shared cooking: each atom puts electrons into a common pot instead of trying to take the other one’s. And every line drawn in H–H is only a symbol on paper, not a real string tied between two atoms.',
        'Liên kết cộng hóa trị là màn “góp gạo thổi cơm chung”: mỗi nguyên tử góp electron vào dùng chung thay vì giành hẳn phần của nhau. Mỗi nét gạch trong H–H chỉ là sơ đồ tượng trưng trên giấy, không phải sợi dây thật thắt giữa hai nguyên tử.'),
      example: 'O: 1s² 2s² 2p⁴ → 2, 6 · H–H · O=O · N≡N',
      topic: 'stability'
    },
    {
      id: 'geometry-isomer', keys: ['formula', 'geometry', 'isomer'],
      title: L('3 · Molecular geometry and isomers', '3 · Hình học phân tử và đồng phân'),
      terms: L('Molecular geometry · VSEPR model · Electron domain · Regular tetrahedron · Bond angle · Constitutional isomer',
        'Hình học phân tử · Mô hình VSEPR · Miền electron · Tứ diện đều · Góc liên kết · Đồng phân cấu tạo'),
      formal: L('VSEPR predicts a shape from the repulsion between the electron domains around a central atom: the domains spread as far apart as they can. Four bonding domains, as in CH₄, give a regular tetrahedron with H–C–H ≈ 109.5°; two domains, as in CO₂, give a straight line at 180°. Constitutional isomers share one molecular formula but connect the atoms in a different order — ethanol CH₃CH₂OH and dimethyl ether CH₃OCH₃ are both C₂H₆O. Rotating a molecule in space never makes a new isomer out of it.',
        'Mô hình VSEPR dự đoán hình dạng phân tử dựa trên lực đẩy giữa các miền electron quanh nguyên tử trung tâm: các miền luôn xếp xa nhau hết mức có thể. Bốn miền liên kết như trong CH₄ tạo hình tứ diện đều với góc H–C–H ≈ 109,5°; hai miền như trong CO₂ tạo dạng thẳng hàng với góc 180°. Đồng phân cấu tạo là những chất cùng công thức phân tử nhưng khác trật tự liên kết, ví dụ ethanol CH₃CH₂OH và dimethyl ether CH₃OCH₃ đều có công thức C₂H₆O. Chỉ xoay phân tử trong không gian không bao giờ tạo ra đồng phân mới.'),
      metaphor: L('Think of the balloon rule: the electron clusters around one atom are balloons tied to the same knot, and they push each other as far apart as they can go, which is exactly why molecules have three-dimensional shapes. Isomers are one box of Lego bricks built into two different houses.',
        'Hãy nghĩ theo quy tắc bóng bay: các cụm electron quanh một nguyên tử giống như những quả bóng buộc chung một gốc, chúng đẩy nhau ra xa hết mức có thể, và đó chính là lý do phân tử có hình khối ba chiều. Đồng phân giống như cùng một bộ mảnh ghép Lego nhưng lắp thành hai ngôi nhà khác nhau.'),
      example: L('CH₄: ≈ 109.5° · CO₂: 180° · C₂H₆O = CH₃CH₂OH ≠ CH₃OCH₃',
        'CH₄: ≈ 109,5° · CO₂: 180° · C₂H₆O = CH₃CH₂OH ≠ CH₃OCH₃'),
      topic: 'quantum'
    },
    {
      id: 'ion-conservation', keys: ['charge', 'reaction'],
      title: L('4 · Ions, formal charge and conservation', '4 · Ion, điện tích hình thức và định luật bảo toàn'),
      terms: L('Ion · Formal charge · Partial charge (δ⁺/δ⁻) · Law of conservation of mass · Law of conservation of charge',
        'Ion · Điện tích hình thức · Điện tích riêng phần (δ⁺/δ⁻) · Định luật bảo toàn khối lượng · Định luật bảo toàn điện tích'),
      formal: L('An ion is an atom or a group of atoms whose total charge is not zero: it loses electrons to become a cation, or gains them to become an anion. Formal charge is a bookkeeping convention that divides the electrons in a Lewis structure so you can compare which way of writing a molecule is more stable; it is not a charge you can measure on a single atom, and it is not the partial charge δ⁺/δ⁻ that a polar bond produces. A balanced chemical equation has to conserve two things at once: the atom count of every element and the total charge.',
        'Ion là nguyên tử hoặc nhóm nguyên tử có tổng điện tích khác 0: mất electron thì thành cation, nhận thêm electron thì thành anion. Điện tích hình thức là quy ước phân chia electron trong công thức Lewis để đánh giá cách viết nào bền hơn; đó không phải điện tích thật đo được trên từng nguyên tử, và cũng khác với điện tích riêng phần δ⁺/δ⁻ sinh ra do liên kết phân cực. Một phương trình hóa học đã cân bằng phải đồng thời bảo toàn số nguyên tử của từng nguyên tố và bảo toàn tổng điện tích.'),
      metaphor: L('A chemical reaction is taking an old Lego model apart and rebuilding it as something new: no brick simply vanishes and no brick simply appears. Formal charge is only how we keep the notebook tidy, not a scale that weighs the real charge on an atom.',
        'Phản ứng hóa học giống như tháo rời đồ Lego cũ ra rồi xếp lại thành đồ mới: không viên gạch nào tự nhiên biến mất và cũng không viên gạch nào tự nhiên sinh ra. Điện tích hình thức chỉ là cách ta ghi sổ cho gọn, không phải cái cân đo được điện tích thật của từng nguyên tử.'),
      example: 'Na⁺ + Cl⁻: Σq = 0 · 2 H₂ + O₂ → 2 H₂O',
      topic: 'redox'
    },
    {
      id: 'thermo', keys: ['energy'],
      title: L('5 · Thermodynamics: enthalpy and Gibbs energy', '5 · Nhiệt động lực học: enthalpy và năng lượng Gibbs'),
      terms: L('Enthalpy (ΔH) · Gibbs free energy (ΔG) · Entropy (ΔS) · Exothermic reaction · Endothermic reaction · Spontaneous direction',
        'Enthalpy (ΔH) · Năng lượng tự do Gibbs (ΔG) · Entropy (ΔS) · Phản ứng tỏa nhiệt · Phản ứng thu nhiệt · Chiều tự phát'),
      formal: L('Enthalpy is the heat a system exchanges at constant pressure: ΔH < 0 is exothermic, ΔH > 0 is endothermic. Entropy measures how spread out the energy of the system is. Gibbs free energy combines the two, ΔG = ΔH − TΔS, and tells you the spontaneous direction at a fixed temperature and pressure: with ΔG < 0 the process can run forward on its own. Note carefully what this does not say — ΔG < 0 says nothing about how fast the process runs, only that it is energetically downhill.',
        'Enthalpy là đại lượng đặc trưng cho nhiệt lượng mà hệ trao đổi ở áp suất không đổi: ΔH < 0 là tỏa nhiệt, ΔH > 0 là thu nhiệt. Entropy đo mức độ phân tán năng lượng của hệ. Năng lượng tự do Gibbs kết hợp hai đại lượng này qua ΔG = ΔH − TΔS và cho biết chiều tự phát của quá trình ở nhiệt độ, áp suất xác định: ΔG < 0 thì quá trình có khả năng tự xảy ra theo chiều thuận. Điều nó không nói là tốc độ — ΔG < 0 chỉ trả lời “có tự xảy ra về mặt năng lượng hay không”, chứ không trả lời “xảy ra nhanh hay chậm”.'),
      metaphor: L('Enthalpy is a heat wallet: an endothermic change pays money out, an exothermic one puts money back in. Gibbs energy is a boulder on a slope — ΔG < 0 means it is positioned to roll down, yet it can sit where it is for centuries if nothing gives it a push.',
        'Enthalpy giống như cái ví nhiệt lượng: phản ứng thu nhiệt phải chi tiền, phản ứng tỏa nhiệt thì được hoàn tiền. Năng lượng Gibbs giống như một hòn đá nằm trên dốc — ΔG < 0 nghĩa là hòn đá đang ở thế lăn xuống, nhưng nó vẫn có thể nằm im hàng thế kỷ nếu không có gì đẩy nó đi.'),
      example: L('ΔG = ΔH − TΔS · ΔG < 0: spontaneous · ΔH < 0: exothermic',
        'ΔG = ΔH − TΔS · ΔG < 0: tự phát · ΔH < 0: tỏa nhiệt'),
      topic: 'thermodynamics'
    },
    {
      id: 'kinetics', keys: ['rate', 'equilibrium'],
      title: L('6 · Kinetics and catalysts', '6 · Động hóa học và chất xúc tác'),
      terms: L('Activation barrier (Eₐ) · Arrhenius equation · Reaction mechanism · Catalyst · Equilibrium constant (K)',
        'Rào cản hoạt hóa (Eₐ) · Phương trình Arrhenius · Cơ chế phản ứng · Chất xúc tác · Hằng số cân bằng (K)'),
      formal: L('However favourable a reaction is in energy terms, it still has to cross the activation barrier Eₐ to reach the transition state. The Arrhenius equation k = A · exp(−Eₐ/(R·T)) shows how sharply the rate constant k rises when the temperature T goes up or the barrier comes down. A reaction mechanism is the sequence of elementary steps by which the reactants actually become the products. A catalyst opens a different route with a lower Eₐ, so the reaction runs faster; it is not used up, and at a fixed temperature it does not change the equilibrium constant K or the position of equilibrium.',
        'Dù có lợi về năng lượng đến đâu, một phản ứng vẫn phải vượt qua rào cản hoạt hóa Eₐ để tới trạng thái chuyển tiếp. Phương trình Arrhenius k = A · exp(−Eₐ/(R·T)) cho thấy hằng số tốc độ k tăng mạnh thế nào khi nhiệt độ T tăng lên hoặc rào cản Eₐ hạ xuống. Cơ chế phản ứng là chuỗi các giai đoạn sơ cấp mà qua đó chất đầu thực sự biến thành sản phẩm. Chất xúc tác mở một con đường khác có Eₐ thấp hơn nên phản ứng chạy nhanh hơn; bản thân nó không bị tiêu hao và ở nhiệt độ cố định, nó không làm thay đổi hằng số cân bằng K cũng như vị trí cân bằng.'),
      metaphor: L('Eₐ is a high mountain pass between reactants and products: even though the far side is lower and more attractive, you still have to climb before you can cross. A catalyst is a tunnel through the mountain — same two valleys, same difference in height between them, only nobody has to reach the summit any more.',
        'Eₐ là con dốc cao ngăn cách chất đầu và sản phẩm: dù bên kia dốc thấp hơn và hấp dẫn hơn, muốn sang thì vẫn phải leo lên trước. Chất xúc tác là đường hầm xuyên núi — vẫn hai thung lũng ấy, vẫn cùng một mức chênh lệch năng lượng giữa hai đầu, chỉ là không ai phải leo tới đỉnh nữa.'),
      example: 'k = A · exp(−Eₐ/(R·T)) · R = 8.314 J·mol⁻¹·K⁻¹ · ΔG° = −R·T·ln K',
      topic: 'kinetics'
    },
    {
      id: 'method', keys: ['experiment'],
      title: L('7 · Method and the limits of the model', '7 · Phương pháp và giới hạn của mô hình'),
      terms: L('Prediction · Observation · Explanation · Simulation model',
        'Dự đoán · Quan sát · Giải thích · Mô hình mô phỏng'),
      formal: L('Work with the sandbox in the order the scientific method uses: predict (say what you expect and why), observe (record what the scene actually does), then explain (compare the two and name the model assumption behind any gap). A simulation can only show that a structure is consistent with the rules it was built on. It does not show that the substance is stable in a bottle, and it is certainly not evidence that making it would be safe.',
        'Làm việc với mô phỏng theo đúng chuỗi của phương pháp khoa học: Dự đoán (nêu trước kết quả mong đợi kèm lý do) → Quan sát (ghi nhận điều thực sự xảy ra trong cảnh) → Giải thích (so sánh hai vế và chỉ ra giả định mô hình nào đứng sau khác biệt). Mô hình mô phỏng chỉ chứng minh một cấu trúc nhất quán với các quy tắc mà nó được lập trình; nó không chứng minh chất đó bền ngoài thực tế, và càng không phải bằng chứng cho quy trình tổng hợp ra nó là an toàn.'),
      metaphor: L('A simulation is a jigsaw puzzle on a screen: it teaches you why the pieces fit together, not how to handle them by hand in a real laboratory.',
        'Mô phỏng giống như trò chơi ghép hình trên màn hình: nó giúp bạn hiểu nguyên lý vì sao các mảnh khớp nhau, chứ không phải cách thao tác trực tiếp bằng tay trong phòng thí nghiệm thật.'),
      example: L('Predict → Observe → Explain', 'Dự đoán → Quan sát → Giải thích'),
      topic: 'analytical'
    }
  ];
  window.MolLearningContent = { lessons, concepts };
})();
