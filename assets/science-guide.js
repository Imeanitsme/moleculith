// Science Guide - In-depth explanations of chemistry/physics phenomena (bilingual EN/VI)
(function() {
  'use strict';

  const LANG_KEY = 'mol3d.lang';

  function L(en, vi) { return { en: en, vi: vi }; }

  function lang() {
    let v = 'vi';
    try { v = localStorage.getItem(LANG_KEY) || 'vi'; } catch (e) { v = 'vi'; }
    return v === 'en' ? 'en' : 'vi';
  }

  function tx(pair) {
    if (!pair) return '';
    const l = lang();
    return pair[l] !== undefined ? pair[l] : pair.en;
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function ic(name, cls) { return '<i data-lucide="' + name + '" class="sg-lc' + (cls ? ' ' + cls : '') + '"></i>'; }
  function lucideIn(root) { if (root && window.lucide && window.lucide.createIcons) { try { window.lucide.createIcons({ nameAttr: 'data-lucide', root }); } catch (e) {} } }

  const UI = {
    guideTitle: L('Science Guide', 'Cẩm nang khoa học'),
    welcomeH: L('Welcome to the Science Guide!', 'Chào mừng đến với Cẩm nang khoa học!'),
    welcomeP1: L('Select a topic from the menu to learn about the chemistry and physics happening in the lab.', 'Chọn một chủ đề trong danh mục để tìm hiểu về hóa học và vật lý đang diễn ra trong phòng thí nghiệm.'),
    welcomeP2: L('Every phenomenon is simulated with real scientific principles!', 'Mọi hiện tượng đều được mô phỏng theo các nguyên lý khoa học thực tế!'),
    menuBtn: L('Science Guide', 'Cẩm nang khoa học'),
    navPrev: L('Previous topics', 'Chủ đề trước'),
    navNext: L('Next topics', 'Chủ đề tiếp'),
    panelTitle: L('Science', 'Khoa học'),
    labTitle: L('Decay Lab', 'Phòng thí nghiệm phân rã'),
    labHint: L('Pick a decay below. Each one throws the real particle out of the nucleus.', 'Chọn một kiểu phân rã bên dưới. Mỗi kiểu ném đúng loại hạt thật ra khỏi hạt nhân.'),
    labReadout: L('Parent', 'Hạt nhân mẹ'),
    labDaughter: L('Daughter', 'Hạt nhân con'),
    labEmits: L('Emits', 'Phát ra'),
    labConserve: L('A and Z balanced', 'A và Z cân bằng')
  };

  const GUIDES = {
    reactions: {
      icon: 'flask-round',
      title: L('Chemical Reactions', 'Phản ứng hóa học'),
      sections: [
        {
          heading: L('What is a Chemical Reaction?', 'Phản ứng hóa học là gì?'),
          content: L('A chemical reaction transforms reactants into products by breaking and forming bonds. Atoms rearrange, but are never created or destroyed — conservation of mass!', 'Phản ứng hóa học biến đổi chất phản ứng thành sản phẩm bằng cách phá vỡ và hình thành liên kết. Các nguyên tử sắp xếp lại nhưng không được tạo ra hay mất đi — đó là định luật bảo toàn khối lượng!')
        },
        {
          heading: L('Reaction Types in the Lab', 'Các kiểu phản ứng trong phòng thí nghiệm'),
          content: L('<b>Synthesis:</b> A + B → AB (e.g., 2H₂ + O₂ → 2H₂O)<br><br><b>Decomposition:</b> AB → A + B (e.g., 2H₂O → 2H₂ + O₂)<br><br><b>Single Replacement:</b> A + BC → AC + B (e.g., Zn + 2HCl → ZnCl₂ + H₂)<br><br><b>Double Replacement:</b> AB + CD → AD + CB (e.g., AgNO₃ + NaCl → AgCl↓ + NaNO₃)<br><br><b>Combustion:</b> Fuel + O₂ → CO₂ + H₂O (e.g., CH₄ + 2O₂ → CO₂ + 2H₂O)<br><br><b>Acid-Base:</b> HA + BOH → BA + H₂O (e.g., HCl + NaOH → NaCl + H₂O)', '<b>Tổng hợp:</b> A + B → AB (ví dụ: 2H₂ + O₂ → 2H₂O)<br><br><b>Phân hủy:</b> AB → A + B (ví dụ: 2H₂O → 2H₂ + O₂)<br><br><b>Thế:</b> A + BC → AC + B (ví dụ: Zn + 2HCl → ZnCl₂ + H₂)<br><br><b>Trao đổi:</b> AB + CD → AD + CB (ví dụ: AgNO₃ + NaCl → AgCl↓ + NaNO₃)<br><br><b>Cháy:</b> Nhiên liệu + O₂ → CO₂ + H₂O (ví dụ: CH₄ + 2O₂ → CO₂ + 2H₂O)<br><br><b>Axit-bazơ:</b> HA + BOH → BA + H₂O (ví dụ: HCl + NaOH → NaCl + H₂O)')
        },
        {
          heading: L('Triggering Reactions', 'Kích hoạt phản ứng'),
          content: L('Double-click a molecule to attempt a reaction. The system checks:<br>• Available reactants nearby<br>• Stoichiometric balance<br>• Thermodynamic feasibility<br>• Activation energy (temperature-dependent)', 'Nháy đúp vào một phân tử để thử phản ứng. Hệ thống kiểm tra:<br>• Chất phản ứng có sẵn ở gần<br>• Cân bằng định lượng<br>• Khả năng xảy ra về nhiệt động lực học<br>• Năng lượng hoạt hóa (phụ thuộc nhiệt độ)')
        },
        {
          heading: L('Stoichiometry', 'Hệ số định lượng'),
          content: L('Every reaction is balanced. If you combine 2 H₂ molecules with 1 O₂, you get exactly 2 H₂O — no atoms lost, no extras created. The engine enforces conservation laws automatically.', 'Mọi phản ứng đều được cân bằng. Kết hợp 2 phân tử H₂ với 1 phân tử O₂ sẽ tạo ra đúng 2 phân tử H₂O — không mất nguyên tử, không thừa nguyên tử. Engine tự động thực thi các định luật bảo toàn.')
        }
      ]
    },

    kinetics: {
      icon: 'timer',
      title: L('Chemical Kinetics', 'Động hóa học'),
      sections: [
        {
          heading: L('Reaction Rates', 'Tốc độ phản ứng'),
          content: L('Kinetics studies how fast reactions occur. Rate depends on:<br>• <b>Concentration:</b> More reactants = more collisions = faster rate<br>• <b>Temperature:</b> Higher temp = more energetic collisions<br>• <b>Catalysts:</b> Lower activation energy without being consumed<br>• <b>Surface area:</b> Exposed atoms react faster', 'Động hóa học nghiên cứu tốc độ xảy ra phản ứng. Tốc độ phụ thuộc vào:<br>• <b>Nồng độ:</b> Nhiều chất phản ứng = va chạm nhiều hơn = nhanh hơn<br>• <b>Nhiệt độ:</b> Nhiệt độ cao hơn = va chạm mạnh hơn<br>• <b>Xúc tác:</b> Giảm năng lượng hoạt hóa mà không bị tiêu hao<br>• <b>Diện tích bề mặt:</b> Nguyên tử phơi ra phản ứng nhanh hơn')
        },
        {
          heading: L('Arrhenius Equation', 'Phương trình Arrhenius'),
          content: L('The rate constant k follows: <b>k = A·e^(-Ea/RT)</b><br><br>Where:<br>• A = frequency factor (collision rate)<br>• Ea = activation energy (J/mol)<br>• R = gas constant (8.314 J/mol·K)<br>• T = temperature (Kelvin)<br><br>Higher T exponentially increases reaction rate!', 'Hằng số tốc độ k tuân theo: <b>k = A·e^(-Ea/RT)</b><br><br>Trong đó:<br>• A = thừa số tần số (tốc độ va chạm)<br>• Ea = năng lượng hoạt hóa (J/mol)<br>• R = hằng số khí (8.314 J/mol·K)<br>• T = nhiệt độ (Kelvin)<br><br>Nhiệt độ tăng thì tốc độ phản ứng tăng theo hàm mũ!')
        },
        {
          heading: L('Temperature Effects', 'Ảnh hưởng của nhiệt độ'),
          content: L('In the lab, increasing temperature:<br>• Speeds up molecular motion (dancing atoms)<br>• Increases collision frequency<br>• More molecules overcome activation barrier<br>• Reaction rate roughly doubles per 10°C rise<br><br>Use the Environment tab to heat things up and watch reactions accelerate!', 'Trong phòng thí nghiệm, khi nhiệt độ tăng:<br>• Chuyển động phân tử nhanh hơn (nguyên tử nhảy múa)<br>• Tần số va chạm tăng<br>• Nhiều phân tử vượt qua rào cản hoạt hóa hơn<br>• Tốc độ phản ứng tăng gần gấp đôi mỗi 10°C<br><br>Mở tab Môi trường để đun nóng và xem phản ứng tăng tốc!')
        },
        {
          heading: L('Time Control', 'Điều khiển thời gian'),
          content: L('The time slider (1× to 1 billion×) lets you observe slow kinetics in real-time or fast reactions in slow-motion. At extreme speeds, you can trigger THE WORLD effect — a cinematic time-freeze!', 'Thanh trượt thời gian (1× đến 1 tỷ×) cho phép quan sát phản ứng chậm theo thời gian thực hoặc phản ứng nhanh theo chuyển động chậm. Ở tốc độ cực đại, bạn có thể kích hoạt hiệu ứng THE WORLD — đóng băng thời gian đầy kịch tính!')
        }
      ]
    },

    stability: {
      icon: 'scale',
      title: L('Molecular Stability', 'Độ bền phân tử'),
      sections: [
        {
          heading: L('Bond Energy', 'Năng lượng liên kết'),
          content: L('Every bond has an energy — the strength holding atoms together. Stronger bonds = more stable molecules.<br><br>Examples:<br>• C≡C triple bond: 839 kJ/mol (very strong)<br>• C=C double bond: 614 kJ/mol<br>• C-C single bond: 347 kJ/mol<br>• H-H bond: 436 kJ/mol', 'Mỗi liên kết đều có năng lượng — lực giữ các nguyên tử với nhau. Liên kết càng bền thì phân tử càng ổn định.<br><br>Ví dụ:<br>• Liên kết ba C≡C: 839 kJ/mol (rất bền)<br>• Liên kết đôi C=C: 614 kJ/mol<br>• Liên kết đơn C-C: 347 kJ/mol<br>• Liên kết H-H: 436 kJ/mol')
        },
        {
          heading: L('Octet Rule', 'Quy tắc octet'),
          content: L('Atoms are most stable with 8 valence electrons (full outer shell). They bond to achieve this:<br>• Hydrogen wants 2 electrons (1 bond)<br>• Carbon wants 8 electrons (4 bonds)<br>• Nitrogen wants 8 electrons (3 bonds)<br>• Oxygen wants 8 electrons (2 bonds)<br><br>Unbonded \'stray\' atoms will drift toward partners to satisfy the octet!', 'Nguyên tử bền nhất khi có 8 electron hóa trị (lớp ngoài cùng đầy). Chúng tạo liên kết để đạt điều đó:<br>• Hydro cần 2 electron (1 liên kết)<br>• Carbon cần 8 electron (4 liên kết)<br>• Nitrogen cần 8 electron (3 liên kết)<br>• Oxygen cần 8 electron (2 liên kết)<br><br>Các nguyên tử tự do sẽ trôi về phía bạn ghép để thỏa mãn quy tắc octet!')
        },
        {
          heading: L('Unstable Molecules', 'Phân tử không bền'),
          content: L('Some molecules are thermodynamically unstable:<br>• <b>O₃ (Ozone):</b> Decays to 3/2 O₂ over time<br>• <b>H₂O₂ (Peroxide):</b> Decomposes to H₂O + 1/2 O₂<br>• <b>N₄:</b> Explodes into 2 N₂ (releases massive energy)<br><br>The engine auto-decomposes cursed molecules into stable products!', 'Một số phân tử không bền về nhiệt động lực học:<br>• <b>O₃ (ozone):</b> Phân hủy thành 3/2 O₂ theo thời gian<br>• <b>H₂O₂ (peroxit):</b> Phân hủy thành H₂O + 1/2 O₂<br>• <b>N₄:</b> Nổ thành 2 N₂ (giải phóng năng lượng lớn)<br><br>Engine tự phân hủy các phân tử kém bền thành sản phẩm bền!')
        },
        {
          heading: L('Atmosphere Mode', 'Chế độ khí quyển'),
          content: L('When atmosphere is enabled, stray atoms automatically bond with environmental gases (O₂, N₂, CO₂, etc.). This simulates real-world reactivity — exposed atoms don\'t stay lonely for long!', 'Khi bật khí quyển, các nguyên tử tự do sẽ liên kết với khí môi trường (O₂, N₂, CO₂, v.v.). Điều này mô phỏng phản ứng ngoài thực tế — nguyên tử phơi ra không cô đơn lâu!')
        }
      ]
    },

    nuclear: {
      icon: 'radiation',
      title: L('Nuclear Physics', 'Vật lý hạt nhân'),
      sections: [
        {
          heading: L('Radioactive Decay', 'Phân rã phóng xạ'),
          content: L('Elements with Z > 82 (beyond Lead) are radioactive. Their nuclei are unstable and decay over time:<br>• <b>Alpha decay:</b> Emits He nucleus (2p + 2n), Z decreases by 2<br>• <b>Beta decay:</b> Neutron → Proton + electron, Z increases by 1<br>• <b>Gamma decay:</b> Emits high-energy photon, no Z change<br><br>Watch Uranium (Z=92) decay into lighter elements!', 'Các nguyên tố có Z > 82 (sau Chì) là phóng xạ. Hạt nhân không bền và phân rã theo thời gian:<br>• <b>Phân rã alpha:</b> Phát ra hạt nhân He (2p + 2n), Z giảm 2<br>• <b>Phân rã beta:</b> Notron → proton + electron, Z tăng 1<br>• <b>Phân rã gamma:</b> Phát ra photon năng lượng cao, Z không đổi<br><br>Hãy xem Urani (Z=92) phân rã thành các nguyên tố nhẹ hơn!')
        },
        {
          heading: L('Critical Mass', 'Khối lượng tới hạn'),
          content: L('When a radioactive atom goes critical, you\'ll see a red countdown timer. The atom is about to undergo fission!<br><br>Get away before it explodes. Nuclear fission:<br>• Breaks all nearby bonds (shockwave)<br>• Transmutes the element (Z decreases)<br>• Releases massive energy (E = mc²)<br>• Damages your health (radiation exposure)', 'Khi một nguyên tử phóng xạ đạt tới hạn, bạn sẽ thấy đồng hồ đếm ngược màu đỏ. Nguyên tử sắp phân hạch!<br><br>Hãy tránh xa trước khi nó phát nổ. Phân hạch hạt nhân:<br>• Phá mọi liên kết lân cận (sóng xung kích)<br>• Biến đổi nguyên tố (Z giảm)<br>• Giải phóng năng lượng khổng lồ (E = mc²)<br>• Gây hại cho sức khỏe (nhiễm xạ)')
        },
        {
          heading: L('Chain Reactions', 'Phản ứng dây chuyền'),
          content: L('Fission releases neutrons that can trigger nearby radioactive atoms. This creates a chain reaction:<br>1 atom fissions → releases neutrons → hits 2-3 atoms → they fission → exponential cascade!<br><br>In Dense Plasma state, chain reactions are suppressed to prevent endless HP loss.', 'Phân hạch giải phóng notron có thể kích hoạt các nguyên tử phóng xạ lân cận, tạo thành phản ứng dây chuyền:<br>1 nguyên tử phân hạch → phát notron → trúng 2-3 nguyên tử → chúng phân hạch → chuỗi tăng theo hàm mũ!<br><br>Ở trạng thái Plasma đặc, phản ứng dây chuyền bị chặn để tránh mất HP vô hạn.')
        },
        {
          heading: L('Radiation Damage', 'Tác hại của bức xạ'),
          content: L('Radioactive atoms emit radiation that damages you based on distance (inverse-square law):<br><b>Dose ∝ 1/r²</b><br><br>Double the distance = 1/4 the radiation. Stay far from Uranium, Plutonium, and other heavy elements!', 'Nguyên tử phóng xạ phát bức xạ gây hại theo khoảng cách (định luật nghịch đảo bình phương):<br><b>Liều ∝ 1/r²</b><br><br>Gấp đôi khoảng cách = một phần tư bức xạ. Hãy đứng xa Urani, Plutoni và các nguyên tố nặng khác!')
        }
      ]
    },

    decay: {
      icon: 'radiation',
      title: L('Decay Particles & Lab', 'Hạt phân rã & Phòng thí nghiệm'),
      sections: [
        {
          heading: L('What Actually Leaves the Nucleus', 'Thứ thực sự rời khỏi hạt nhân'),
          content: L(
            "A decay does not throw out an atom — it throws out a particle. The lab paints each one in the colour of its own physics:<br><br>" +
            "<b style=\"color:#ff4433\">Alpha (α):</b> a bare helium nucleus — strictly 2 protons + 2 neutrons, no electron cloud — with a glowing red trail.<br>" +
            "<b style=\"color:#2ae4ff\">Beta-minus (β⁻):</b> a fast electron, bright cyan with a cyan trail, thrown out together with a tiny teal antineutrino at a different angle.<br>" +
            "<b style=\"color:#ff8033\">Beta-plus (β⁺):</b> a positron, warm orange with an orange trail, paired with a tiny teal neutrino.<br>" +
            "<b style=\"color:#8b9bb4\">Gamma (γ):</b> a photon — no charge, no mass, no visible track.<br><br>" +
            "Electron capture is the exception that proves the rule: the nucleus takes an electron <i>in</i>, so nothing charged comes out — only a neutrino.",
            "Một lần phân rã không ném ra nguyên tử — nó ném ra hạt. Phòng thí nghiệm vẽ mỗi hạt bằng đúng màu của vật lý đó:<br><br>" +
            "<b style=\"color:#ff4433\">Alpha (α):</b> hạt nhân heli trần — đúng 2 proton + 2 neutron, không có mây electron — kèm vệt đỏ phát sáng.<br>" +
            "<b style=\"color:#2ae4ff\">Beta trừ (β⁻):</b> một electron nhanh, xanh cyan sáng, kèm vệt cyan, bay ra cùng một phản neutrino nhỏ màu xanh ngọc theo hướng khác.<br>" +
            "<b style=\"color:#ff8033\">Beta cộng (β⁺):</b> một positron, màu cam ấm, kèm vệt cam, đi cùng một neutrino nhỏ màu xanh ngọc.<br>" +
            "<b style=\"color:#8b9bb4\">Gamma (γ):</b> photon — không điện tích, không khối lượng, không để lại vệt.<br><br>" +
            "Bắt electron là ngoại lệ chứng minh quy tắc: hạt nhân <i>nhận</i> electron vào, nên không có hạt mang điện nào bay ra — chỉ có neutrino."
          )
        },
        {
          heading: L('The Five Equations', 'Năm phương trình'),
          content: L(
            "<b>α:</b> <sup>A</sup><sub>Z</sub>X → <sup>A−4</sup><sub>Z−2</sub>Y + <sup>4</sup><sub>2</sub>He<br><br>" +
            "<b>β⁻:</b> <sup>A</sup><sub>Z</sub>X → <sup>A</sup><sub>Z+1</sub>Y + e⁻ + ν̄<sub>e</sub><br><br>" +
            "<b>β⁺:</b> <sup>A</sup><sub>Z</sub>X → <sup>A</sup><sub>Z−1</sub>Y + e⁺ + ν<sub>e</sub><br><br>" +
            "<b>EC:</b> <sup>A</sup><sub>Z</sub>X + e⁻ → <sup>A</sup><sub>Z−1</sub>Y + ν<sub>e</sub><br><br>" +
            "<b>γ:</b> X* → X + γ<br><br>" +
            "Read the numbers, not the letters: charge and nucleon count are conserved in every line. In β⁻ a neutron becomes a proton, so Z rises by one while A stays put — the electron and antineutrino carry the missing charge and lepton number.",
            "<b>α:</b> <sup>A</sup><sub>Z</sub>X → <sup>A−4</sup><sub>Z−2</sub>Y + <sup>4</sup><sub>2</sub>He<br><br>" +
            "<b>β⁻:</b> <sup>A</sup><sub>Z</sub>X → <sup>A</sup><sub>Z+1</sub>Y + e⁻ + ν̄<sub>e</sub><br><br>" +
            "<b>β⁺:</b> <sup>A</sup><sub>Z</sub>X → <sup>A</sup><sub>Z−1</sub>Y + e⁺ + ν<sub>e</sub><br><br>" +
            "<b>EC:</b> <sup>A</sup><sub>Z</sub>X + e⁻ → <sup>A</sup><sub>Z−1</sub>Y + ν<sub>e</sub><br><br>" +
            "<b>γ:</b> X* → X + γ<br><br>" +
            "Hãy đọc các con số, không phải chữ cái: điện tích và số nucleon được bảo toàn ở mọi dòng. Trong β⁻, một neutron biến thành proton nên Z tăng một còn A giữ nguyên — electron và phản neutrino mang phần điện tích và số lepton còn thiếu."
          )
        },
        {
          heading: L('What Each Particle Is Used For', 'Mỗi hạt được dùng để làm gì'),
          content: L(
            "<b style=\"color:#ff4433\">α (helium nucleus):</b> americium-241 ionises air inside smoke detectors; alpha emitters power RTGs on deep-space probes (Pu-238). Stopped by paper and dead skin — but lethal if inhaled.<br><br>" +
            "<b style=\"color:#2ae4ff\">β⁻ (electron):</b> strontium-90 treats surface eye disease, electron beams weld and sterilise, beta gauges measure paper and foil thickness. Stopped by a few millimetres of metal; fast electrons also make X-rays (bremsstrahlung).<br><br>" +
            "<b style=\"color:#ff8033\">β⁺ (positron):</b> PET scanners track positron-emitting tracers (F-18). Each positron annihilates with an electron and fires two 511 keV photons back-to-back — that pair is the image. Also probes defects in metals.<br><br>" +
            "<b style=\"color:#2ee6c8\">ν / ν̄ (neutrinos):</b> reactor antineutrinos monitor plutonium content without opening the core; solar and supernova neutrinos are our only direct look inside a star. About 10¹⁴ pass through you every second and almost nothing stops them.<br><br>" +
            "<b style=\"color:#8b9bb4\">γ (photon):</b> radiotherapy, Tc-99m imaging, sterilising medical equipment and food. Needs lead or concrete, not paper.",
            "<b style=\"color:#ff4433\">α (hạt nhân heli):</b> americium-241 ion hóa không khí trong đầu báo khói; nguồn alpha cấp điện cho RTG trên tàu vũ trụ xa (Pu-238). Bị chặn bởi giấy và lớp sừng chết — nhưng gây chết người nếu hít vào.<br><br>" +
            "<b style=\"color:#2ae4ff\">β⁻ (electron):</b> strontium-90 điều trị bệnh bề mặt mắt, chùm electron hàn và tiệt trùng, máy đo beta đo độ dày giấy và lá kim loại. Bị chặn bởi vài milimét kim loại; electron nhanh còn tạo tia X (bức xạ hãm).<br><br>" +
            "<b style=\"color:#ff8033\">β⁺ (positron):</b> máy PET theo dõi chất đánh dấu phát positron (F-18). Mỗi positron hủy cặp với electron và bắn ra hai photon 511 keV ngược chiều — chính cặp đó tạo nên hình ảnh. Còn dùng để dò khuyết tật trong kim loại.<br><br>" +
            "<b style=\"color:#2ee6c8\">ν / ν̄ (neutrino):</b> phản neutrino từ lò phản ứng giám sát lượng plutoni mà không cần mở lõi; neutrino Mặt Trời và siêu tân tinh là cách duy nhất nhìn trực tiếp vào trong một ngôi sao. Khoảng 10¹⁴ hạt xuyên qua bạn mỗi giây và gần như không gì chặn được.<br><br>" +
            "<b style=\"color:#8b9bb4\">γ (photon):</b> xạ trị, chụp hình bằng Tc-99m, tiệt trùng thiết bị y tế và thực phẩm. Cần chì hoặc bê tông, không phải giấy."
          )
        },
        {
          heading: L('Interactive Decay Lab', 'Phòng thí nghiệm phân rã tương tác'),
          content: L(
            "Fire each decay and watch what the nucleus really emits. The colours here are the same colours the 3D scene uses, so what you learn on this canvas is what you see on the table.<br><br>Every emission conserves A and Z: watch the counters under the canvas.",
            "Bắn từng kiểu phân rã và xem hạt nhân thực sự phát ra gì. Màu ở đây là đúng màu cảnh 3D dùng, nên điều bạn học trên khung vẽ này chính là điều bạn thấy trên bàn thí nghiệm.<br><br>Mọi lần phát xạ đều bảo toàn A và Z: hãy theo dõi bộ đếm dưới khung vẽ."
          ),
          interactive: 'decay'
        }
      ]
    },

    phases: {
      icon: 'thermometer',
      title: L('Phase Transitions', 'Chuyển pha'),
      sections: [
        {
          heading: L('Matter States', 'Các trạng thái vật chất'),
          content: L('Extreme temperature and pressure trigger phase transitions — the state of matter itself changes!<br><br>The lab has 5 matter states:<br>• <b>Standard:</b> Normal conditions (298K, 1 atm)<br>• <b>Supercritical:</b> T > 647K, P > 218 atm<br>• <b>Compressed Mantle:</b> T 1000-4000K, P ≥ 1000 atm<br>• <b>Dilute Plasma:</b> T ≥ 5000K, P < 100 atm<br>• <b>Dense Plasma:</b> T ≥ 5000K, P ≥ 1500 atm', 'Nhiệt độ và áp suất cực đoan gây ra chuyển pha — trạng thái vật chất thay đổi!<br><br>Phòng thí nghiệm có 5 trạng thái:<br>• <b>Chuẩn:</b> Điều kiện thường (298K, 1 atm)<br>• <b>Siêu tới hạn:</b> T > 647K, P > 218 atm<br>• <b>Lõi nén:</b> T 1000-4000K, P ≥ 1000 atm<br>• <b>Plasma loãng:</b> T ≥ 5000K, P < 100 atm<br>• <b>Plasma đặc:</b> T ≥ 5000K, P ≥ 1500 atm')
        },
        {
          heading: L('Supercritical Fluid', 'Lưu chất siêu tới hạn'),
          content: L('Above the critical point (647K, 218 atm for water), liquid and gas phases merge into a supercritical fluid. It has:<br>• Gas-like viscosity (flows easily)<br>• Liquid-like density (dissolves things)<br>• Corrodes bonds over time<br><br>Supercritical CO₂ is used to decaffeinate coffee!', 'Vượt điểm tới hạn (647K, 218 atm đối với nước), pha lỏng và pha khí hòa thành lưu chất siêu tới hạn. Nó có:<br>• Độ nhớt như khí (dễ chảy)<br>• Mật độ như lỏng (hòa tan tốt)<br>• Ăn mòn liên kết theo thời gian<br><br>CO₂ siêu tới hạn được dùng để khử caffein trong cà phê!')
        },
        {
          heading: L('Plasma States', 'Trạng thái plasma'),
          content: L('<b>Dilute Plasma (T ≥ 5000K, P < 100 atm):</b><br>Gas ionizes into charged particles. Triggers explosive blast pushing all atoms outward!<br><br><b>Dense Plasma (T ≥ 5000K, P ≥ 1500 atm):</b><br>Maximum energy state. Hyper-conductive lightning arcs between atoms. Auto-reactions suppressed to prevent chain reaction HP loss.', '<b>Plasma loãng (T ≥ 5000K, P < 100 atm):</b><br>Khí bị ion hóa thành các hạt mang điện. Gây vụ nổ đẩy mọi nguyên tử ra ngoài!<br><br><b>Plasma đặc (T ≥ 5000K, P ≥ 1500 atm):</b><br>Trạng thái năng lượng tối đa. Tia sét dẫn điện cực mạnh phóng giữa các nguyên tử. Phản ứng tự động bị chặn để tránh mất HP do dây chuyền.')
        },
        {
          heading: L('Compressed Mantle', 'Lõi bị nén'),
          content: L('At T 1000-4000K and P ≥ 1000 atm, matter is crushed under extreme pressure. Like Earth\'s mantle, atoms are squeezed together, causing crush damage. Bonds strain under the pressure!', 'Ở T 1000-4000K và P ≥ 1000 atm, vật chất bị nghiền dưới áp suất cực lớn. Giống như lớp manti của Trái Đất, các nguyên tử bị ép sát nhau gây sát thương do nén. Liên kết bị căng dưới áp lực!')
        }
      ]
    },

    decomposition: {
      icon: 'sparkles',
      title: L('Decomposition Kinetics', 'Động học phân hủy'),
      sections: [
        {
          heading: L('Thermal Decomposition', 'Phân hủy nhiệt'),
          content: L('Heat breaks molecules apart. The rate follows first-order kinetics:<br><b>d[A]/dt = -k[A]</b><br><br>Where k depends on temperature (Arrhenius equation). Higher temp = faster decomposition!<br><br>Examples:<br>• CaCO₃ → CaO + CO₂ (limestone decomposition)<br>• 2H₂O₂ → 2H₂O + O₂ (peroxide breakdown)', 'Nhiệt phá vỡ phân tử. Tốc độ theo động học bậc một:<br><b>d[A]/dt = -k[A]</b><br><br>Với k phụ thuộc nhiệt độ (phương trình Arrhenius). Nhiệt độ cao = phân hủy nhanh hơn!<br><br>Ví dụ:<br>• CaCO₃ → CaO + CO₂ (phân hủy đá vôi)<br>• 2H₂O₂ → 2H₂O + O₂ (phân hủy peroxit)'),
        },
        {
          heading: L('Molecular Decay System', 'Hệ phân rã phân tử'),
          content: L('The engine continuously checks molecular stability:<br>1. Identifies \'homeless\' atoms (no bonds)<br>2. Finds \'hungry\' atoms (incomplete octet)<br>3. Attempts to stabilize via bonding<br>4. Decomposes unstable molecules into products<br><br>This runs every frame, simulating real-time chemistry!', 'Engine liên tục kiểm tra độ bền phân tử:<br>1. Nhận diện nguyên tử "không nhà" (không liên kết)<br>2. Tìm nguyên tử "đói" (octet chưa đủ)<br>3. Thử làm bền bằng cách tạo liên kết<br>4. Phân hủy phân tử không bền thành sản phẩm<br><br>Chạy mỗi khung hình, mô phỏng hóa học theo thời gian thực!')
        },
        {
          heading: L('No-Homeless Stabilization', 'Không bỏ rơi nguyên tử'),
          content: L('Stray atoms (no bonds) will:<br>1. Drift toward nearby candidates (REACTIVE_RADIUS = 8)<br>2. Upgrade existing bonds (single → double → triple)<br>3. Form new bonds to satisfy valence<br>4. Accept atmosphere gas cappers (H, O, N, etc.)<br><br>Atoms never sit idle — they\'re always seeking stability!', 'Các nguyên tử tự do sẽ:<br>1. Trôi về phía ứng viên gần đó (REACTIVE_RADIUS = 8)<br>2. Nâng cấp liên kết sẵn có (đơn → đôi → ba)<br>3. Tạo liên kết mới để thỏa mãn hóa trị<br>4. Nhận nguyên tử chẹn từ khí quyển (H, O, N, v.v.)<br><br>Nguyên tử không bao giờ ngồi yên — chúng luôn tìm sự ổn định!')
        },
        {
          heading: L('Decomposition Products', 'Sản phẩm phân hủy'),
          content: L('When molecules decompose, they form thermodynamically stable products:<br>• Carbonates → Metal oxide + CO₂<br>• Peroxides → Water + O₂<br>• Nitrates → Nitrite + O₂<br>• Ammonium salts → NH₃ + Acid<br><br>The engine knows thousands of decomposition pathways!', 'Khi phân hủy, phân tử tạo sản phẩm bền về nhiệt động:<br>• Carbonat → oxit kim loại + CO₂<br>• Peroxit → nước + O₂<br>• Nitrat → nitrit + O₂<br>• Muối amoni → NH₃ + axit<br><br>Engine biết hàng nghìn con đường phân hủy!')
        }
      ]
    },
    redox: {
      icon: 'zap',
      title: L('Redox Chemistry', 'Hóa học oxi hóa - khử'),
      sections: [
        {
          heading: L('Oxidation-Reduction', 'Oxi hóa - khử'),
          content: L('Redox reactions transfer electrons:<br>• <b>Oxidation:</b> Loss of electrons (oxidation number increases)<br>• <b>Reduction:</b> Gain of electrons (oxidation number decreases)<br><br>Mnemonic: <b>OIL RIG</b> — Oxidation Is Loss, Reduction Is Gain', 'Phản ứng oxi hóa - khử là sự chuyển electron:<br>• <b>Oxi hóa:</b> Mất electron (số oxi hóa tăng)<br>• <b>Khử:</b> Nhận electron (số oxi hóa giảm)<br><br>Cách nhớ: chất khử bị oxi hóa, chất oxi hóa bị khử — electron luôn được bảo toàn.')
        },
        {
          heading: L('Oxidation Numbers', 'Số oxi hóa'),
          content: L('Rules for assigning oxidation states:<br>1. Free elements: 0 (e.g., Na, O₂, H₂)<br>2. Monatomic ions: equal to charge (e.g., Na⁺ = +1)<br>3. Oxygen: usually -2 (except peroxides: -1)<br>4. Hydrogen: +1 with nonmetals, -1 with metals<br>5. Fluorine: always -1<br>6. Sum equals molecular charge', 'Quy tắc gán số oxi hóa:<br>1. Nguyên tố tự do: 0 (ví dụ Na, O₂, H₂)<br>2. Ion đơn nguyên tử: bằng điện tích (ví dụ Na⁺ = +1)<br>3. Oxygen: thường -2 (trừ peroxit: -1)<br>4. Hydrogen: +1 với phi kim, -1 với kim loại<br>5. Fluorine: luôn -1<br>6. Tổng bằng điện tích của phân tử')
        },
        {
          heading: L('Balancing Redox Reactions', 'Cân bằng phản ứng oxi hóa - khử'),
          content: L('The engine uses the half-reaction method:<br>1. Split into oxidation and reduction halves<br>2. Balance atoms (except O and H)<br>3. Balance O with H₂O<br>4. Balance H with H⁺<br>5. Balance charge with electrons<br>6. Equalize electron transfer<br>7. Add halves and simplify<br><br>All done automatically — stoichiometrically perfect!', 'Engine dùng phương pháp cân bằng theo ion - electron:<br>1. Tách thành quá trình oxi hóa và khử<br>2. Cân bằng nguyên tử (trừ O và H)<br>3. Cân bằng O bằng H₂O<br>4. Cân bằng H bằng H⁺<br>5. Cân bằng điện tích bằng electron<br>6. Bằng số electron trao đổi<br>7. Cộng lại và rút gọn<br><br>Tự động hoàn toàn — định lượng chính xác!')
        },
        {
          heading: L('Examples', 'Ví dụ'),
          content: L('<b>Combustion:</b> CH₄ + 2O₂ → CO₂ + 2H₂O<br>(C oxidized from -4 to +4, O reduced from 0 to -2)<br><br><b>Rusting:</b> 4Fe + 3O₂ → 2Fe₂O₃<br>(Fe oxidized from 0 to +3, O reduced from 0 to -2)<br><br><b>Battery:</b> Zn + Cu²⁺ → Zn²⁺ + Cu<br>(Zn oxidized, Cu²⁺ reduced)', '<b>Cháy:</b> CH₄ + 2O₂ → CO₂ + 2H₂O<br>(C oxi hóa từ -4 lên +4, O khử từ 0 xuống -2)<br><br><b>Gỉ sắt:</b> 4Fe + 3O₂ → 2Fe₂O₃<br>(Fe oxi hóa từ 0 lên +3, O khử từ 0 xuống -2)<br><br><b>Pin:</b> Zn + Cu²⁺ → Zn²⁺ + Cu<br>(Zn bị oxi hóa, Cu²⁺ bị khử)')
        }
      ]
    },

    environment: {
      icon: 'globe',
      title: L('Environmental Effects', 'Hiệu ứng môi trường'),
      sections: [
        {
          heading: L('Temperature', 'Nhiệt độ'),
          content: L('Temperature (Kelvin) affects:<br>• <b>Molecular motion:</b> Higher T = faster dancing atoms<br>• <b>Reaction rates:</b> Exponential increase (Arrhenius)<br>• <b>Phase transitions:</b> Melting, boiling, plasma<br>• <b>Decomposition:</b> Heat breaks bonds<br><br>Range: 1K (near absolute zero) to 6000K (stellar core)!', 'Nhiệt độ (Kelvin) ảnh hưởng đến:<br>• <b>Chuyển động phân tử:</b> T cao = nguyên tử nhảy múa nhanh hơn<br>• <b>Tốc độ phản ứng:</b> Tăng theo hàm mũ (Arrhenius)<br>• <b>Chuyển pha:</b> Nóng chảy, sôi, plasma<br>• <b>Phân hủy:</b> Nhiệt phá vỡ liên kết<br><br>Phạm vi: 1K (gần độ không tuyệt đối) đến 6000K (lõi sao)!')
        },
        {
          heading: L('Pressure', 'Áp suất'),
          content: L('Pressure (atmospheres) affects:<br>• <b>Gas reactions:</b> Higher P = more collisions<br>• <b>Boiling points:</b> Higher P = higher boiling temp<br>• <b>Phase states:</b> Compressed mantle, supercritical fluid<br>• <b>Equilibrium:</b> Shifts toward fewer gas moles<br><br>Range: 0.000001 atm (vacuum) to 2000 atm (ocean trench)!', 'Áp suất (atm) ảnh hưởng đến:<br>• <b>Phản ứng khí:</b> P cao = va chạm nhiều hơn<br>• <b>Nhiệt độ sôi:</b> P cao = sôi ở nhiệt độ cao hơn<br>• <b>Trạng thái pha:</b> Lõi nén, lưu chất siêu tới hạn<br>• <b>Cân bằng:</b> Chuyển dịch về phía ít mol khí hơn<br><br>Phạm vi: 0,000001 atm (chân không) đến 2000 atm (vực biển)!')
        },
        {
          heading: L('Atmosphere Composition', 'Thành phần khí quyển'),
          content: L('Add gases to the environment:<br>• O₂ (oxygen) — combustion, oxidation<br>• N₂ (nitrogen) — inert diluent, ammonia synthesis<br>• CO₂ (carbon dioxide) — photosynthesis, carbonation<br>• H₂ (hydrogen) — reduction, fuel<br>• Cl₂ (chlorine) — disinfection, halogenation<br>• H₂O (water vapor) — hydration, hydrolysis<br><br>These act as bonus reactants in auto-bonding!', 'Thêm khí vào môi trường:<br>• O₂ (oxi) — cháy, oxi hóa<br>• N₂ (nitơ) — khí trơ pha loãng, tổng hợp amoniac<br>• CO₂ (cacbon đioxit) — quang hợp, cacbonat hóa<br>• H₂ (hydro) — khử, nhiên liệu<br>• Cl₂ (clo) — khử trùng, halogen hóa<br>• H₂O (hơi nước) — hydrat hóa, thủy phân<br><br>Chúng đóng vai trò chất phản ứng bổ sung khi tự liên kết!')
        },
        {
          heading: L('Atmosphere Mode', 'Chế độ khí quyển'),
          content: L('Toggle atmosphere from the Menu. When enabled:<br>• Stray atoms auto-bond with environmental gases<br>• Hydrogen capping fills incomplete octets<br>• Oxidation happens automatically<br>• Simulates real-world air reactivity<br><br>Turn it off for vacuum conditions (no auto-reactions)!', 'Bật/tắt khí quyển trong Menu. Khi bật:<br>• Nguyên tử tự do liên kết với khí môi trường<br>• Hydro chẹn lấp đầy octet còn thiếu<br>• Oxi hóa xảy ra tự động<br>• Mô phỏng phản ứng với không khí thực tế<br><br>Tắt đi để có điều kiện chân không (không phản ứng tự động)!')
        }
      ]
    },

    organic: {
      icon: 'hexagon',
      title: L('Organic Chemistry', 'Hóa học hữu cơ'),
      sections: [
        {
          heading: L('Carbon Chemistry', 'Hóa học của carbon'),
          content: L('Organic molecules contain carbon skeletons with functional groups:<br>• <b>Alkanes:</b> C-C single bonds (methane, ethane)<br>• <b>Alkenes:</b> C=C double bonds (ethene, propene)<br>• <b>Alkynes:</b> C≡C triple bonds (ethyne, propyne)<br>• <b>Aromatics:</b> Benzene rings (phenyl, toluene)', 'Phân tử hữu cơ có khung carbon với các nhóm chức:<br>• <b>Ankan:</b> Liên kết đơn C-C (metan, etan)<br>• <b>Anken:</b> Liên kết đôi C=C (etilen, propilen)<br>• <b>Alkin:</b> Liên kết ba C≡C (axetilen, propin)<br>• <b>Aromatic:</b> Vòng benzen (phenyl, toluen)')
        },
        {
          heading: L('Functional Groups', 'Nhóm chức'),
          content: L('Reactive groups that define molecule behavior:<br>• <b>Hydroxyl (-OH):</b> Alcohols (methanol, ethanol)<br>• <b>Carbonyl (C=O):</b> Aldehydes, ketones<br>• <b>Carboxyl (-COOH):</b> Organic acids (acetic acid)<br>• <b>Amino (-NH₂):</b> Amines, amino acids<br>• <b>Ester (-COO-):</b> Fragrances, fats', 'Các nhóm chức quyết định tính chất phân tử:<br>• <b>Hydroxyl (-OH):</b> Alcohol (metanol, etanol)<br>• <b>Carbonyl (C=O):</b> Anđehit, xeton<br>• <b>Carboxyl (-COOH):</b> Axit hữu cơ (axit axetic)<br>• <b>Amino (-NH₂):</b> Amin, amino axit<br>• <b>Ester (-COO-):</b> Hương liệu, chất béo')
        },
        {
          heading: L('Organic Reactions', 'Phản ứng hữu cơ'),
          content: L('<b>Esterification:</b> Acid + Alcohol → Ester + Water<br>(CH₃COOH + C₂H₅OH → CH₃COOC₂H₅ + H₂O)<br><br><b>Hydrolysis:</b> Ester + Water → Acid + Alcohol<br>(reverse of esterification)<br><br><b>Addition:</b> Alkene + X₂ → Dihaloalkane<br>(C₂H₄ + Br₂ → C₂H₄Br₂)<br><br><b>Combustion:</b> Hydrocarbon + O₂ → CO₂ + H₂O', '<b>Este hóa:</b> Axit + Rượu → Este + Nước<br>(CH₃COOH + C₂H₅OH → CH₃COOC₂H₅ + H₂O)<br><br><b>Thủy phân:</b> Este + Nước → Axit + Rượu<br>(phản ứng ngược của este hóa)<br><br><b>Cộng:</b> Anken + X₂ → Đihalogenan<br>(C₂H₄ + Br₂ → C₂H₄Br₂)<br><br><b>Cháy:</b> Hidrocacbon + O₂ → CO₂ + H₂O')
        },
        {
          heading: L('Isomers', 'Đồng phân'),
          content: L('Same formula, different structure:<br>• <b>Structural isomers:</b> Different connectivity (butane vs isobutane)<br>• <b>Geometric isomers:</b> Different spatial arrangement (cis vs trans)<br>• <b>Optical isomers:</b> Mirror images (L vs D forms)<br><br>The Isomer Inspector shows all possible arrangements for a formula!', 'Cùng công thức, khác cấu trúc:<br>• <b>Đồng phân cấu tạo:</b> Cách nối khác nhau (butan và isobutan)<br>• <b>Đồng phân hình học:</b> Sắp xếp không gian khác (cis và trans)<br>• <b>Đồng phân quang học:</b> Ảnh qua gương (dạng L và D)<br><br>Công cụ Kiểm tra đồng phân liệt kê mọi cách sắp xếp của một công thức!')
        }
      ]
    },

    thermodynamics: {
      icon: 'flame',
      title: L('Thermodynamics', 'Nhiệt động lực học'),
      sections: [
        {
          heading: L('Energy Changes', 'Biến thiên năng lượng'),
          content: L('Every reaction involves energy:<br>• <b>Exothermic:</b> Releases heat (ΔH < 0)<br>  Example: Combustion, neutralization<br>• <b>Endothermic:</b> Absorbs heat (ΔH > 0)<br>  Example: Decomposition, photosynthesis<br><br>The engine calculates enthalpy changes from bond energies!', 'Mọi phản ứng đều kèm năng lượng:<br>• <b>Tỏa nhiệt:</b> Giải phóng nhiệt (ΔH < 0)<br>  Ví dụ: cháy, trung hòa<br>• <b>Thu nhiệt:</b> Hấp thụ nhiệt (ΔH > 0)<br>  Ví dụ: phân hủy, quang hợp<br><br>Engine tính biến thiên enthalpy từ năng lượng liên kết!')
        },
        {
          heading: L('Enthalpy (H)', 'Enthalpy (H)'),
          content: L('Total heat content of a system. Change in enthalpy (ΔH) determines if reaction releases or absorbs heat.<br><br>ΔH = Σ(bond energies broken) - Σ(bond energies formed)<br><br>If ΔH < 0: Exothermic (releases heat)<br>If ΔH > 0: Endothermic (absorbs heat)', 'Tổng nội nhiệt của hệ. Biến thiên enthalpy (ΔH) quyết định phản ứng tỏa hay thu nhiệt.<br><br>ΔH = Σ(năng lượng liên kết phá) - Σ(năng lượng liên kết tạo)<br><br>ΔH < 0: tỏa nhiệt<br>ΔH > 0: thu nhiệt')
        },
        {
          heading: L('Entropy (S)', 'Entropy (S)'),
          content: L('Measure of disorder/randomness. Reactions favor increased entropy (ΔS > 0).<br><br>• Gas formation: ΔS > 0 (more disorder)<br>• Solid formation: ΔS < 0 (more order)<br>• Dissolution: ΔS > 0 (particles spread out)<br><br>Example: 2H₂O₂(l) → 2H₂O(l) + O₂(g) increases entropy!', 'Thước đo độ mất trật tự. Phản ứng ưu tiên entropy tăng (ΔS > 0).<br><br>• Sinh khí: ΔS > 0 (mất trật tự hơn)<br>• Sinh rắn: ΔS < 0 (trật tự hơn)<br>• Hòa tan: ΔS > 0 (hạt dàn trải)<br><br>Ví dụ: 2H₂O₂(l) → 2H₂O(l) + O₂(g) làm tăng entropy!')
        },
        {
          heading: L('Gibbs Free Energy', 'Năng lượng tự do Gibbs'),
          content: L('Determines reaction spontaneity:<br><b>ΔG = ΔH - TΔS</b><br><br>• ΔG < 0: Spontaneous (happens automatically)<br>• ΔG > 0: Non-spontaneous (requires energy input)<br>• ΔG = 0: Equilibrium (no net change)<br><br>The engine checks ΔG before allowing reactions!', 'Xác định tính tự diễn biến:<br><b>ΔG = ΔH - TΔS</b><br><br>• ΔG < 0: tự diễn biến<br>• ΔG > 0: không tự diễn biến (cần cung cấp năng lượng)<br>• ΔG = 0: cân bằng (không thay đổi ròng)<br><br>Engine kiểm tra ΔG trước khi cho phép phản ứng!')
        }
      ]
    },

    quantum: {
      icon: 'atom',
      title: L('Quantum Mechanics', 'Cơ học lượng tử'),
      sections: [
        {
          heading: L('Wavefunctions and Orbitals', 'Hàm sóng và orbital'),
          content: L('Electrons are not planets orbiting a nucleus — they are standing waves described by a wavefunction ψ. |ψ|² gives the probability of finding the electron at a point, which is why the lab draws fuzzy electron clouds instead of fixed rings.<br><br>Each orbital holds two electrons with opposite spin.', 'Electron không phải hành tinh quay quanh hạt nhân — chúng là sóng dừng được mô tả bởi hàm sóng ψ. |ψ|² cho xác suất tìm thấy electron tại một điểm, nên phòng thí nghiệm vẽ đám mây electron mờ thay vì vòng tròn cố định.<br><br>Mỗi orbital chứa tối đa hai electron với spin ngược chiều.')
        },
        {
          heading: L('The Four Quantum Numbers', 'Bốn số lượng tử'),
          content: L('• <b>n</b> (principal): shell and energy, n = 1, 2, 3…<br>• <b>ℓ</b> (azimuthal): shape, 0…n-1 → s, p, d, f<br>• <b>mℓ</b> (magnetic): orientation, -ℓ…+ℓ<br>• <b>ms</b> (spin): +½ or -½<br><br>Pauli exclusion: no two electrons in an atom share all four numbers. That single rule builds the whole periodic table.', '• <b>n</b> (chính): lớp và năng lượng, n = 1, 2, 3…<br>• <b>ℓ</b> (phụ): hình dạng, 0…n-1 → s, p, d, f<br>• <b>mℓ</b> (từ): định hướng, -ℓ…+ℓ<br>• <b>ms</b> (spin): +½ hoặc -½<br><br>Nguyên lý loại trừ Pauli: không có hai electron trong cùng nguyên tử có cả bốn số giống nhau. Chỉ một quy tắc đó tạo nên toàn bộ bảng tuần hoàn.')
        },
        {
          heading: L('Quantized Light', 'Ánh sáng lượng tử hóa'),
          content: L('Atoms absorb and emit only photons whose energy matches a gap between levels:<br><b>E = hf = hc/λ</b><br><br>That is why every element has a unique line spectrum — a fingerprint. Use the X-ray view in the lab to see inner-shell transitions of heavy elements.', 'Nguyên tử chỉ hấp thụ và phát ra photon có năng lượng đúng bằng hiệu giữa hai mức:<br><b>E = hf = hc/λ</b><br><br>Vì vậy mỗi nguyên tố có một phổ vạch riêng — dấu vân tay của nó. Dùng chế độ tia X trong phòng thí nghiệm để xem các chuyển mức lớp trong của nguyên tố nặng.')
        },
        {
          heading: L('Tunnelling and Uncertainty', 'Hiệu ứng đường ngầm và bất định'),
          content: L('Heisenberg: Δx·Δp ≥ ħ/2. You can never know an electron\'s exact position and momentum together, so "orbit" is replaced by probability.<br><br>Tunnelling lets particles cross energy barriers they classically could not — it drives alpha decay, and it is why some reactions in the lab fire at temperatures where the classical barrier looks impassable.', 'Heisenberg: Δx·Δp ≥ ħ/2. Không thể biết chính xác đồng thời vị trí và động lượng của electron, nên "quỹ đạo" được thay bằng xác suất.<br><br>Hiệu ứng đường ngầm cho phép hạt vượt qua rào thế năng mà cổ điển không thể — nó gây ra phân rã alpha và khiến một số phản ứng trong phòng thí nghiệm vẫn xảy ra ở nhiệt độ mà rào thế cổ điển dường như không thể vượt.')
        }
      ]
    },

    equilibrium: {
      icon: 'arrow-left-right',
      title: L('Chemical Equilibrium', 'Cân bằng hóa học'),
      sections: [
        {
          heading: L('A Dynamic Balance', 'Cân bằng động'),
          content: L('At equilibrium the reaction has not stopped — forward and reverse rates are equal, so concentrations stay constant while molecules keep interconverting.<br><br>For aA + bB ⇌ cC + dD:<br><b>Kc = [C]ᶜ[D]ᵈ / ([A]ᵃ[B]ᵇ)</b>', 'Ở trạng thái cân bằng, phản ứng không dừng lại — tốc độ thuận bằng tốc độ nghịch, nên nồng độ không đổi trong khi phân tử vẫn chuyển hóa qua lại.<br><br>Với aA + bB ⇌ cC + dD:<br><b>Kc = [C]ᶜ[D]ᵈ / ([A]ᵃ[B]ᵇ)</b>')
        },
        {
          heading: L('Le Châtelier\'s Principle', 'Nguyên lý Le Châtelier'),
          content: L('Stress a system and it shifts to relieve the stress:<br>• Add reactant → shift right<br>• Remove product → shift right<br>• Raise pressure → shift toward fewer gas moles<br>• Raise temperature → shift in the endothermic direction<br>• Add catalyst → no shift, only faster arrival<br><br>The Environment tab lets you apply every one of these stresses live.', 'Khi tác động lên hệ, cân bằng chuyển dịch theo chiều chống lại tác động đó:<br>• Thêm chất phản ứng → chuyển thuận<br>• Bớt sản phẩm → chuyển thuận<br>• Tăng áp suất → về phía ít mol khí<br>• Tăng nhiệt độ → về chiều thu nhiệt<br>• Thêm xúc tác → không dịch chuyển, chỉ cân bằng đến nhanh hơn<br><br>Tab Môi trường cho phép bạn áp dụng trực tiếp từng tác động này.')
        },
        {
          heading: L('Reaction Quotient Q', 'Thương số phản ứng Q'),
          content: L('Compare Q with K to predict direction:<br>• Q < K → net forward<br>• Q > K → net reverse<br>• Q = K → at equilibrium<br><br>ΔG = RT ln(Q/K), so a position away from K is exactly a store of free energy — the driving force of every battery and every living cell.', 'So sánh Q với K để đoán hướng:<br>• Q < K → phản ứng thuận ưu thế<br>• Q > K → phản ứng nghịch ưu thế<br>• Q = K → cân bằng<br><br>ΔG = RT ln(Q/K), nên một trạng thái lệch khỏi K chính là năng lượng tự do được tích trữ — động lực của mọi pin và mọi tế bào sống.')
        },
        {
          heading: L('Industrial Trade-offs', 'Đánh đổi trong công nghiệp'),
          content: L('Haber process: N₂ + 3H₂ ⇌ 2NH₃, ΔH = -92 kJ/mol.<br>Cold favours yield, slow favours patience. Industry compromises at ~450 °C, ~200 atm over an iron catalyst: acceptable rate, acceptable yield.<br><br>The same compromise appears in the lab — high temperature speeds reactions but pushes equilibria apart from the product side.', 'Quy trình Haber: N₂ + 3H₂ ⇌ 2NH₃, ΔH = -92 kJ/mol.<br>Lạnh thì thuận lợi về hiệu suất, chậm thì đòi hỏi kiên nhẫn. Công nghiệp thỏa hiệp ở ~450 °C, ~200 atm với xúc tác sắt: tốc độ chấp nhận được, hiệu suất chấp nhận được.<br><br>Chính sự thỏa hiệp đó xuất hiện trong phòng thí nghiệm — nhiệt độ cao làm phản ứng nhanh hơn nhưng đẩy cân bằng ra xa phía sản phẩm.')
        }
      ]
    },

    photochem: {
      icon: 'sun',
      title: L('Photochemistry', 'Quang hóa học'),
      sections: [
        {
          heading: L('Photons as Reactants', 'Photon như chất phản ứng'),
          content: L('A molecule can only be excited by light it actually absorbs. One photon, one molecule, one quantum of energy:<br><b>E = hc/λ ≈ 1240 / λ(nm) eV</b><br><br>400 nm violet ≈ 3.1 eV, 700 nm red ≈ 1.8 eV. A typical bond is 3-4 eV, so visible light rarely breaks bonds directly — ultraviolet does.', 'Phân tử chỉ bị kích thích bởi ánh sáng mà nó thực sự hấp thụ. Một photon, một phân tử, một lượng tử năng lượng:<br><b>E = hc/λ ≈ 1240 / λ(nm) eV</b><br><br>400 nm tím ≈ 3,1 eV, 700 nm đỏ ≈ 1,8 eV. Một liên kết thường 3-4 eV, nên ánh sáng nhìn thấy hiếm khi phá trực tiếp liên kết — tia tử ngoại thì có.')
        },
        {
          heading: L('Excitation and Relaxation', 'Kích thích và hồi phục'),
          content: L('Absorption lifts an electron to an antibonding orbital within ~10⁻¹⁵ s. The excited molecule then chooses:<br>• emit a photon (fluorescence, phosphorescence)<br>• shed heat (internal conversion)<br>• transfer energy to a neighbour<br>• react (photochemistry)<br><br>What it chooses sets the quantum yield: products formed ÷ photons absorbed.', 'Hấp thụ nâng electron lên orbital phản liên kết trong khoảng ~10⁻¹⁵ s. Sau đó phân tử kích thích sẽ chọn:<br>• phát ra photon (huỳnh quang, lân quang)<br>• tỏa nhiệt (chuyển đổi nội)<br>• truyền năng lượng cho phân tử bên cạnh<br>• phản ứng (quang hóa)<br><br>Lựa chọn đó quyết định hiệu suất lượng tử: số sản phẩm chia cho số photon hấp thụ.')
        },
        {
          heading: L('Photolysis and Ozone', 'Quang phân hủy và ozone'),
          content: L('UV splits molecules that are stable in the dark:<br>• Cl₂ + hν → 2 Cl• (radical chain chlorination)<br>• O₂ + hν (< 240 nm) → 2 O•, then O• + O₂ → O₃<br>• O₃ + hν (UV-B) → O₂ + O• — the cycle that shields life from UV<br><br>Chlorofluorocarbons hijack this cycle: one Cl atom destroys ~10⁴ ozone molecules before it leaves the stratosphere.', 'Tia UV cắt những phân tử bền trong bóng tối:<br>• Cl₂ + hν → 2 Cl• (clo hóa gốc tự do)<br>• O₂ + hν (< 240 nm) → 2 O•, rồi O• + O₂ → O₃<br>• O₃ + hν (UV-B) → O₂ + O• — chu trình bảo vệ sự sống khỏi tia UV<br><br>CFC phá vỡ chu trình này: một nguyên tử Cl phá ~10⁴ phân tử ozone trước khi rời tầng bình lưu.')
        },
        {
          heading: L('Vision, Fireflies, Photography', 'Thị giác, đom đóm, nhiếp ảnh'),
          content: L('Life runs on photochemistry: 11-cis-retinal photoisomerises in the eye; luciferin oxidises in a firefly with ~40% quantum yield — cold light with almost no waste; AgBr in film darkens where photons strike.<br><br>Chemiluminescence is the same energy landscape reached by chemistry instead of light, which is why a glow stick needs no batteries.', 'Sự sống vận hành bằng quang hóa: 11-cis-retinal đồng phân hóa trong mắt; luciferin oxy hóa ở đom đóm với hiệu suất lượng tử ~40% — ánh sáng lạnh gần như không tốn nhiệt; AgBr trong phim tối lại nơi photon đập vào.<br><br>Hóa phát quang là cùng một cảnh năng lượng nhưng đạt được bằng phản ứng hóa học thay vì ánh sáng, đó là lý do bút phát quang không cần pin.')
        }
      ]
    },
    surface: {
      icon: 'layers',
      title: L('Surface Chemistry', 'Hóa học bề mặt'),
      sections: [
        {
          heading: L('Why Surfaces Matter', 'Vì sao bề mặt quan trọng'),
          content: L('Reactions happen where atoms meet. A cube 1 cm across has 6 cm² of surface; crush it to 1 µm powder and the same mass exposes about 60 m² — a ten-thousand-fold gain.<br><br>Rate is proportional to exposed sites, which is why dust explodes while a block of coal merely burns.', 'Phản ứng xảy ra ở nơi các nguyên tử gặp nhau. Một khối lập phương cạnh 1 cm có bề mặt 6 cm²; nghiền thành bột 1 µm thì cùng khối lượng đó phơi ra khoảng 60 m² — tăng hàng vạn lần.<br><br>Tốc độ tỉ lệ với số vị trí phơi ra, đó là lý do bụi phát nổ trong khi một tảng than chỉ cháy.')
        },
        {
          heading: L('Adsorption: Physisorption vs Chemisorption', 'Hấp phụ: vật lý và hóa học'),
          content: L('<b>Physisorption</b> — van der Waals only, 5-40 kJ/mol, multilayer, reversible, favoured by low temperature.<br><b>Chemisorption</b> — real bonds form, 80-400 kJ/mol, monolayer, often needs activation energy, can be irreversible.<br><br>Charcoal trapping odour is physisorption; hydrogen sticking to platinum is chemisorption.', '<b>Hấp phụ vật lý</b> — chỉ lực van der Waals, 5-40 kJ/mol, nhiều lớp, thuận nghịch, thuận lợi ở nhiệt độ thấp.<br><b>Hấp phụ hóa học</b> — liên kết thật được hình thành, 80-400 kJ/mol, một lớp, thường cần năng lượng hoạt hóa, có thể không thuận nghịch.<br><br>Than hoạt tính giữ mùi là hấp phụ vật lý; hydro bám trên platinum là hấp phụ hóa học.')
        },
        {
          heading: L('The Langmuir Isotherm', 'Đẳng nhiệt Langmuir'),
          content: L('Assume a fixed number of identical sites, one molecule per site, no interaction between neighbours. At equilibrium the fraction covered is:<br><b>θ = KP / (1 + KP)</b><br><br>Low pressure → θ rises linearly. High pressure → θ saturates near 1: the surface is full and extra gas can only wait.<br><br>The surface-chemistry simulation in Teacher Mode plots exactly this curve.', 'Giả sử số vị trí cố định và đồng nhất, mỗi vị trí giữ một phân tử, các phân tử lân cận không tương tác. Khi cân bằng, phần bề mặt bị phủ là:<br><b>θ = KP / (1 + KP)</b><br><br>Áp suất thấp → θ tăng tuyến tính. Áp suất cao → θ bão hòa gần 1: bề mặt đã đầy, khí thêm phải chờ.<br><br>Mô phỏng hóa học bề mặt trong Chế độ giáo viên vẽ chính xác đường cong này.')
        },
        {
          heading: L('Heterogeneous Catalysis', 'Xúc tác dị thể'),
          content: L('A catalyst offers an alternative route with a lower barrier and is regenerated. On a catalytic converter, CO, NO and unburnt hydrocarbons adsorb onto Pt/Rh sites, react, then desorb as CO₂, N₂ and H₂O — thousands of turnovers per second.<br><br>Catalysts lower Ea for both directions, so they speed the approach to equilibrium without moving it. The lab shows this as a glowing catalyst aura plus a lowered energy diagram.', 'Xúc tác mở một con đường khác có rào thế thấp hơn và được tái sinh. Trong bộ chuyển đổi xúc tác, CO, NO và hydrocacbon chưa cháy hấp phụ lên vị trí Pt/Rh, phản ứng rồi giải hấp thành CO₂, N₂ và H₂O — hàng nghìn vòng mỗi giây.<br><br>Xúc tác hạ Ea cho cả hai chiều, nên nó làm cân bằng đến nhanh hơn mà không dịch chuyển cân bằng. Phòng thí nghiệm thể hiện điều đó bằng quầng sáng xúc tác và giản đồ năng lượng thấp hơn.')
        }
      ]
    },

    analytical: {
      icon: 'gauge',
      title: L('Analytical Chemistry', 'Hóa phân tích'),
      sections: [
        {
          heading: L('Titration', 'Chuẩn độ'),
          content: L('A solution of known concentration (titrant) is added until the reaction is complete — the equivalence point, signalled by an indicator or a pH meter.<br><br>For a monoprotic acid: <b>n(acid) = C(base) × V(base)</b><br><br>The curve has four regions: acidic buffer, steep jump at equivalence, basic buffer. A weak acid starts higher and its jump is shorter than a strong acid\'s.', 'Dung dịch đã biết nồng độ (dung dịch chuẩn) được nhỏ vào đến khi phản ứng hoàn tất — điểm tương đương, nhận biết bằng chỉ báo hoặc máy đo pH.<br><br>Với axit một nấc: <b>n(axit) = C(bazơ) × V(bazơ)</b><br><br>Đường chuẩn có bốn vùng: môi trường axit, vùng nhảy vọt tại điểm tương đương, môi trường bazơ. Axit yếu bắt đầu ở pH cao hơn và phần nhảy vọt ngắn hơn axit mạnh.')
        },
        {
          heading: L('Beer-Lambert Law', 'Định luật Beer-Lambert'),
          content: L('How much light a solution removes grows with concentration and path length:<br><b>A = εcl</b> and <b>A = -log₁₀(T)</b><br><br>Measure A for a set of standards, get a straight line, then read unknowns off it. That is a calibration curve — the backbone of quantitative analysis.<br><br>Deviations appear at high concentration, where solute particles shield each other.', 'Lượng ánh sáng dung dịch hấp thụ tỉ lệ với nồng độ và chiều dài đường đi:<br><b>A = εcl</b> và <b>A = -log₁₀(T)</b><br><br>Đo A của một dãy dung dịch chuẩn, được đường thẳng, rồi suy ra mẫu chưa biết. Đó là đường chuẩn — xương sống của phân tích định lượng.<br><br>Sai lệch xuất hiện ở nồng độ cao, khi các hạt tan che chắn lẫn nhau.')
        },
        {
          heading: L('Spectroscopy', 'Quang phổ'),
          content: L('IR: bonds vibrate at characteristic frequencies — O-H near 3300 cm⁻¹, C=O near 1700 cm⁻¹, C≡N near 2250 cm⁻¹. Missing a peak is as informative as having one.<br><br>UV-Visible: electronic transitions, coloured solutions absorb the complement of what you see.<br>Atomic emission: each element lights up with its own line pattern, the same physics as the lab\'s element spectra.', 'Hồng ngoại: liên kết dao động ở tần số đặc trưng — O-H quanh 3300 cm⁻¹, C=O quanh 1700 cm⁻¹, C≡N quanh 2250 cm⁻¹. Vắng một peak cũng cung cấp thông tin như có nó.<br><br>UV-Vis: chuyển mức electron, dung dịch có màu hấp thụ phần bù của màu bạn nhìn thấy.<br>Phát xạ nguyên tử: mỗi nguyên tố sáng lên với mẫu vạch riêng, cùng vật lý với phổ nguyên tố trong phòng thí nghiệm.')
        },
        {
          heading: L('Sensitivity and Error', 'Độ nhạy và sai số'),
          content: L('Detection limit ≈ 3σ of the blank; quantification limit ≈ 10σ. Below that you can say "not detected", never "zero".<br><br>Parts per million is mg/kg for solids, mg/L for dilute water. ppb is one drop in an Olympic pool.<br><br>Accuracy measures the mean vs truth, precision measures the spread — a badly calibrated instrument can be precise and wrong at the same time.', 'Giới hạn phát hiện ≈ 3σ của mẫu trắng; giới hạn định lượng ≈ 10σ. Dưới ngưỡng đó chỉ được nói "không phát hiện", không bao giờ nói "bằng không".<br><br>ppm là mg/kg với chất rắn, mg/L với nước loãng. ppb tương đương một giọt trong hồ bơi Olympic.<br><br>Độ đúng đo giá trị trung bình so với thực, độ chụm đo độ tản mác — một thiết bị lệch chuẩn vẫn có thể chụm mà sai.')
        }
      ]
    },

    green: {
      icon: 'recycle',
      title: L('Green Chemistry', 'Hóa học xanh'),
      sections: [
        {
          heading: L('Atom Economy', 'Kinh tế nguyên tử'),
          content: L('How much of every reactant atom ends up inside the product?<br><b>Atom economy = (M desired product ÷ Σ M reactants) × 100%</b><br><br>Addition reactions score 100%. Substitutions throw away half their mass. Ibuprofen\'s old Boots route used six steps at ~40% atom economy; the BHC catalytic route does it in three steps at ~77% and recovers the by-product.', 'Bao nhiêu nguyên tử của chất phản ứng nằm lại trong sản phẩm?<br><b>Kinh tế nguyên tử = (M sản phẩm mong muốn ÷ Σ M chất phản ứng) × 100%</b><br><br>Phản ứng cộng đạt 100%. Phản ứng thế vứt đi nửa khối lượng. Quy trình cũ sản xuất ibuprofen (Boots) dùng sáu bước với kinh tế nguyên tử ~40%; quy trình xúc tác BHC làm trong ba bước, ~77% và thu hồi được phụ phẩm.')
        },
        {
          heading: L('The Twelve Principles', 'Mười hai nguyên lý'),
          content: L('Prevention beats treatment · atom economy · less-hazardous synthesis · safer solvents · energy efficiency · renewable feedstocks · avoid derivatives · catalysis · design for degradation · real-time analysis · inherently safer chemistry · accident prevention.<br><br>Catalysis appears twice in spirit: one enzyme molecule turns over millions of times, a stoichiometric reagent is used once and thrown away.', 'Ngăn ngừa hơn chữa chạy · kinh tế nguyên tử · tổng hợp ít nguy hại · dung môi an toàn hơn · hiệu quả năng lượng · nguyên liệu tái tạo · hạn chế dẫn xuất hóa · xúc tác · thiết kế để phân hủy · phân tích thời gian thực · hóa học cố hữu an toàn hơn · phòng ngừa tai nạn.<br><br>Xúc tác xuất hiện hai lần về tinh thần: một phân tử enzyme xúc tác hàng triệu lần, còn thuốc thử theo định lượng chỉ dùng một lần rồi bỏ.')
        },
        {
          heading: L('Solvents and Waste', 'Dung môi và chất thải'),
          content: L('In pharmaceutical manufacture solvent is often more than 80% of total mass flow. Water, supercritical CO₂, ionic liquids and solvent-free mechanochemistry are the alternatives.<br><br>The E-factor counts kilograms of waste per kilogram of product: bulk petrochemicals ~0.1, pharmaceuticals 25-100. The lab\'s supercritical state is one of those greener media.', 'Trong sản xuất dược phẩm, dung môi thường chiếm hơn 80% tổng dòng vật chất. Nước, CO₂ siêu tới hạn, chất lỏng ion và hóa học cơ học không dung môi là các lựa chọn thay thế.<br><br>Hệ số E đếm số kg chất thải cho mỗi kg sản phẩm: hóa dầu khối lượng ~0,1; dược phẩm 25-100. Trạng thái siêu tới hạn trong phòng thí nghiệm là một trong những môi trường xanh hơn đó.')
        },
        {
          heading: L('Design for Degradation', 'Thiết kế để phân hủy'),
          content: L('A useful molecule should return to harmless fragments when its job is done. DDT and CFCs persist; esters hydrolyse, alcohols oxidise to CO₂ and water.<br><br>Hard versus soft detergents is the classic lesson: branched alkylbenzene sulfonates foamed in rivers until straight-chain versions proved biodegradable.<br><br>The decomposition engine in this lab is a working model of that idea — unstable structures keep breaking toward stable products.', 'Một phân tử hữu ích nên trở về các mảnh vô hại khi hoàn thành nhiệm vụ. DDT và CFC tồn lưu; este thủy phân, ancol oxy hóa thành CO₂ và nước.<br><br>Bài học kinh điển là chất giặt rửa cứng và mềm: ankylbenzen sunfonat phân nhánh tạo bọt trên sông cho đến khi dạng mạch thẳng được chứng minh là phân hủy sinh học.<br><br>Engine phân hủy trong phòng thí nghiệm này là mô hình sống của ý tưởng đó — cấu trúc không bền luôn phân hủy về phía sản phẩm bền.')
        }
      ]
    },

    biochem: {
      icon: 'test-tubes',
      title: L('Biochemistry', 'Hóa sinh'),
      sections: [
        {
          heading: L('Enzymes as Catalysts', 'Enzyme là xúc tác'),
          content: L('An enzyme binds substrate in an active site, stabilises the transition state and can lower Ea by 10⁶-10¹² times. It cannot change ΔG, so an impossible reaction stays impossible — only faster routes are offered.<br><br>Specificity comes from shape and chemistry: hexokinase fits glucose, not fructose.', 'Enzyme liên kết cơ chất tại trung tâm hoạt động, làm bền trạng thái chuyển tiếp và có thể hạ Ea tới 10⁶-10¹² lần. Nó không thay đổi ΔG, nên phản ứng bất biến vẫn bất khả thi — enzyme chỉ mở đường nhanh hơn.<br><br>Tính đặc hiệu đến từ hình dạng và hóa học: hexokinase khớp với glucose chứ không phải fructose.')
        },
        {
          heading: L('Michaelis-Menten Kinetics', 'Động học Michaelis-Menten'),
          content: L('<b>v = Vmax·[S] / (Km + [S])</b><br><br>Km is the substrate concentration at half Vmax — a low Km means tight binding. Vmax = kcat·[E]total, so the rate saturates once every enzyme is busy.<br><br><b>Competitive</b> inhibition raises the apparent Km but leaves Vmax reachable; <b>non-competitive</b> cuts Vmax and leaves Km alone. The enzyme simulation in Teacher Mode draws both curves.', '<b>v = Vmax·[S] / (Km + [S])</b><br><br>Km là nồng độ cơ chất để đạt nửa Vmax — Km nhỏ nghĩa là liên kết chặt. Vmax = kcat·[E]tổng, nên tốc độ bão hòa khi mọi enzyme đều bận.<br><br>Ức chế <b>cạnh tranh</b> làm Km biểu kiến tăng nhưng vẫn đạt Vmax; ức chế <b>không cạnh tranh</b> cắt Vmax và giữ nguyên Km. Mô phỏng enzyme trong Chế độ giáo viên vẽ cả hai đường.')
        },
        {
          heading: L('Energy Currency', 'Đơn vị năng lượng'),
          content: L('ATP ↔ ADP + Pi carries about -30.5 kJ/mol under cellular conditions — small enough to hand energy to a reaction, large enough to be useful. Coupling an unfavorable step to ATP hydrolysis makes the sum negative, and ΔG decides.<br><br>Glucose gives ~30-32 ATP when fully oxidised to CO₂ and H₂O; fermentation recovers only 2 and leaves the rest in ethanol or lactate.', 'ATP ↔ ADP + Pi mang khoảng -30,5 kJ/mol trong điều kiện tế bào — đủ nhỏ để trao năng lượng cho phản ứng, đủ lớn để hữu dụng. Ghép một bước bất lợi với thủy phân ATP làm tổng ΔG âm, và ΔG là trọng tài.<br><br>Glucose cho ~30-32 ATP khi oxy hóa hoàn toàn thành CO₂ và H₂O; lên men chỉ thu được 2 và để phần còn lại trong ethanol hoặc lactat.')
        },
        {
          heading: L('pH, Temperature and Denaturation', 'pH, nhiệt độ và biến tính'),
          content: L('Proteins hold their shape with hydrogen bonds, salt bridges and hydrophobic packing. Each enzyme has an optimum pH and temperature; beyond them the structure unfolds and the active site is lost — denaturation.<br><br>Buffers resist pH change because a weak acid and its conjugate base soak up added H⁺ or OH⁻. Blood keeps pH 7.35-7.45 with the H₂CO₃/HCO₃⁻ pair.<br><br>Heat everything too far in this lab and the same physics applies: bonds break, structures collapse, products simplify.', 'Protein giữ hình dạng bằng liên kết hydro, cầu muối và hiệu ứng kỵ nước. Mỗi enzyme có pH và nhiệt độ tối ưu; vượt qua thì cấu trúc mở tung và trung tâm hoạt động mất — đó là biến tính.<br><br>Dung dịch đệm chống đổi pH vì một axit yếu cùng bazơ liên hợp của nó hấp thụ H⁺ hoặc OH⁻ thêm vào. Máu giữ pH 7,35-7,45 bằng cặp H₂CO₃/HCO₃⁻.<br><br>Đun quá nóng trong phòng thí nghiệm này, cũng chính vật lý đó áp dụng: liên kết đứt, cấu trúc sụp, sản phẩm đơn giản hơn.')
        }
      ]
    }
  };

  let guidePanel = null;
  let currentGuide = null;
  let lastLang = null;
  let infoLang = null;

  // ── Interactive decay lab ───────────────────────────────────────────────────
  // Five decays, one canvas. The numbers are the physics; the colours are the
  // same ones the 3D scene uses, so a reader learns the palette here before they
  // ever see it on the table. Each daughter is computed from its own equation
  // rather than hardcoded, which is what lets the A/Z counters be an honest
  // conservation check instead of decoration.
  const DECAY_LAB = {
    alpha: {
      color: '#ff4433', label: 'α',
      parent: { z: 92, a: 238 },
      daughter: function (p) { return { z: p.z - 2, a: p.a - 4 }; },
      particles: [{ kind: 'alpha', color: '#ff4433', glow: '#ff5a3c', r: 9, speed: 0.34, angle: 0.15 }]
    },
    betaMinus: {
      color: '#2ae4ff', label: 'β⁻',
      parent: { z: 55, a: 137 },
      daughter: function (p) { return { z: p.z + 1, a: p.a }; },
      particles: [
        { kind: 'electron', color: '#2ae4ff', glow: '#9df7ff', r: 6, speed: 0.62, angle: -0.25 },
        { kind: 'neutrino', color: '#2ee6c8', glow: '#b5fff3', r: 3, speed: 0.78, angle: 0.75 }
      ]
    },
    betaPlus: {
      color: '#ff8033', label: 'β⁺',
      parent: { z: 9, a: 18 },
      daughter: function (p) { return { z: p.z - 1, a: p.a }; },
      particles: [
        { kind: 'positron', color: '#ff8033', glow: '#ffc49a', r: 6, speed: 0.62, angle: -0.25 },
        { kind: 'neutrino', color: '#2ee6c8', glow: '#b5fff3', r: 3, speed: 0.78, angle: 0.75 }
      ]
    },
    ec: {
      color: '#8b9bb4', label: 'EC',
      parent: { z: 26, a: 55 },
      daughter: function (p) { return { z: p.z - 1, a: p.a }; },
      particles: [
        { kind: 'neutrino', color: '#2ee6c8', glow: '#b5fff3', r: 3, speed: 0.8, angle: 0.1 }
      ]
    },
    gamma: {
      color: '#8b9bb4', label: 'γ',
      parent: { z: 27, a: 60 },
      daughter: function (p) { return { z: p.z, a: p.a }; },
      particles: [{ kind: 'photon', color: '#e8eef7', glow: '#ffffff', r: 5, speed: 0.95, angle: 0.4 }]
    }
  };

  const LAB_EMIT_TEXT = {
    alpha: L('⁴He nucleus (2p + 2n) + energy', 'hạt nhân ⁴He (2p + 2n) + năng lượng'),
    betaMinus: L('e⁻ + ν̄e', 'e⁻ + ν̄e'),
    betaPlus: L('e⁺ + νe', 'e⁺ + νe'),
    ec: L('νe only — the electron went in', 'chỉ νe — electron đi vào'),
    gamma: L('γ photon', 'photon γ')
  };

  function elSymbol(z) {
    const list = window.__mol3d && window.__mol3d.ELEMENTS;
    if (Array.isArray(list)) {
      const hit = list.find(function (e) { return e.z === z; });
      if (hit && hit.sym) return hit.sym;
    }
    return 'X' + z;
  }

  function subScript(n) {
    const map = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
    return String(n).split('').map(function (c) { return map[c] || c; }).join('');
  }
  function nuclideText(n) { return '<sup>' + n.a + '</sup>' + subScript(n.z) + esc(elSymbol(n.z)); }

  function hexAlpha(hex, a) {
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  let lab = null;

  function decayLabHtml() {
    const rows = Object.keys(DECAY_LAB).map(function (key) {
      return '<button type="button" class="dl-btn" data-decay="' + key + '" style="--dl-c:' + DECAY_LAB[key].color + '">' + esc(DECAY_LAB[key].label) + '</button>';
    }).join('');
    return '' +
      '<div class="decay-lab">' +
        '<div class="dl-head">' + ic('atom') + '<span>' + esc(tx(UI.labTitle)) + '</span></div>' +
        '<p class="dl-hint">' + esc(tx(UI.labHint)) + '</p>' +
        '<canvas class="dl-canvas" aria-label="' + esc(tx(UI.labTitle)) + '"></canvas>' +
        '<div class="dl-buttons">' + rows + '</div>' +
        '<div class="dl-readout">' +
          '<div class="dl-col"><span>' + esc(tx(UI.labReadout)) + '</span><b class="dl-parent">—</b></div>' +
          '<div class="dl-col"><span>' + esc(tx(UI.labDaughter)) + '</span><b class="dl-daughter">—</b></div>' +
          '<div class="dl-col"><span>' + esc(tx(UI.labEmits)) + '</span><b class="dl-emits">—</b></div>' +
        '</div>' +
        '<div class="dl-balance" aria-live="polite"></div>' +
      '</div>';
  }

  function paintDecayLab(state, card) {
    const d = DECAY_LAB[state.key];
    const p = d.parent;
    const dg = d.daughter(p);
    card.querySelector('.dl-parent').innerHTML = nuclideText(p);
    card.querySelector('.dl-daughter').innerHTML = nuclideText(dg);
    card.querySelector('.dl-emits').textContent = tx(LAB_EMIT_TEXT[state.key]);
    // A and Z are the whole check: a decay that failed to balance would show up
    // here before any reader had to trust the drawing.
    const da = p.a - dg.a;
    const dz = p.z - dg.z;
    const emits = state.key === 'alpha' ? { a: 4, z: 2 }
      : state.key === 'betaMinus' ? { a: 0, z: -1 }
        : state.key === 'betaPlus' ? { a: 0, z: 1 }
          : state.key === 'gamma' ? { a: 0, z: 0 }
            : { a: 0, z: 1 };
    const ok = da === emits.a && dz === emits.z;
    const box = card.querySelector('.dl-balance');
    box.className = 'dl-balance ' + (ok ? 'ok' : 'bad');
    box.innerHTML = ic(ok ? 'check-circle-2' : 'alert-triangle') +
      '<span>ΔA = ' + da + ' · ΔZ = ' + dz + ' · ' + esc(tx(UI.labConserve)) + '</span>';
    lucideIn(box);
  }

  function bindDecayLab(host) {
    const card = host.querySelector('.decay-lab');
    if (!card) return;
    const canvas = card.querySelector('.dl-canvas');
    if (!canvas) return;
    if (lab) stopLab();

    const state = {
      w: 0, h: 0, ctx: null, key: 'alpha',
      raf: 0, flying: [], last: 0, emitAt: 0
    };
    lab = state;

    function nucleusPos() { return { x: state.w * 0.33, y: state.h * 0.5 }; }

    function paint() { paintDecayLab(state, card); }

    function launch() {
      const d = DECAY_LAB[state.key];
      const at = nucleusPos();
      const span = Math.max(state.w, 1);
      state.flying = d.particles.map(function (p) {
        return {
          p: p,
          x: at.x, y: at.y,
          vx: Math.cos(p.angle) * p.speed * span,
          vy: Math.sin(p.angle) * p.speed * span
        };
      });
      state.emitAt = performance.now();
      if (!state.raf) { state.last = performance.now(); state.raf = requestAnimationFrame(step); }
    }

    function drawNucleus(ctx, glowBoost) {
      const at = nucleusPos();
      ctx.save();
      const g = ctx.createRadialGradient(at.x, at.y, 0, at.x, at.y, 52);
      g.addColorStop(0, 'rgba(255,70,50,' + (0.34 + glowBoost * 0.36) + ')');
      g.addColorStop(1, 'rgba(255,70,50,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(at.x, at.y, 52, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + 0.4;
        const rr = i < 5 ? 9 : 13;
        ctx.beginPath();
        ctx.arc(at.x + Math.cos(a) * rr, at.y + Math.sin(a) * rr, 5, 0, Math.PI * 2);
        ctx.fillStyle = i < 5 ? '#ff3d3d' : '#c9d3dc';
        ctx.fill();
      }
      ctx.restore();
    }

    function drawTrail(ctx, f) {
      const p = f.p;
      const v = Math.hypot(f.vx, f.vy) || 1;
      const ux = f.vx / v, uy = f.vy / v;
      for (let i = 1; i <= 9; i++) {
        const back = i * (p.r * 1.5 + 2.2);
        ctx.beginPath();
        ctx.arc(f.x - ux * back, f.y - uy * back, Math.max(1, p.r * (1 - i / 11)), 0, Math.PI * 2);
        ctx.fillStyle = hexAlpha(p.color, (1 - i / 10) * 0.5);
        ctx.fill();
      }
    }

    function drawParticle(ctx, f) {
      const p = f.p;
      drawTrail(ctx, f);
      if (p.kind === 'photon') {
        const v = Math.hypot(f.vx, f.vy) || 1;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(f.x - (f.vx / v) * 14, f.y - (f.vy / v) * 14);
        ctx.lineTo(f.x, f.y);
        ctx.stroke();
        return;
      }
      const rg = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, p.r * 2.8);
      rg.addColorStop(0, hexAlpha(p.glow, 0.85));
      rg.addColorStop(1, hexAlpha(p.color, 0));
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(f.x, f.y, p.r * 2.8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(f.x, f.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color; ctx.fill();
      if (p.kind === 'alpha') {
        // The bare nucleus reads as two red protons and two grey neutrons.
        ctx.beginPath(); ctx.arc(f.x - 3.4, f.y - 3.4, 3.1, 0, Math.PI * 2); ctx.fillStyle = '#ff5a4a'; ctx.fill();
        ctx.beginPath(); ctx.arc(f.x + 3.4, f.y + 3.4, 3.1, 0, Math.PI * 2); ctx.fillStyle = '#c9d3dc'; ctx.fill();
      }
    }

    function step(now) {
      if (lab !== state || !state.ctx) { state.raf = 0; return; }
      const dt = Math.min(0.05, Math.max(0, (now - state.last) / 1000));
      state.last = now;
      const ctx = state.ctx;
      ctx.clearRect(0, 0, state.w, state.h);
      drawNucleus(ctx, state.flying.length ? 1 : 0);
      for (let i = state.flying.length - 1; i >= 0; i--) {
        const f = state.flying[i];
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        if (f.x < -60 || f.x > state.w + 60 || f.y < -60 || f.y > state.h + 60) { state.flying.splice(i, 1); continue; }
        drawParticle(ctx, f);
      }
      state.raf = state.flying.length ? requestAnimationFrame(step) : 0;
    }

    card.addEventListener('click', function (event) {
      const btn = event.target.closest('.dl-btn');
      if (btn) {
        state.key = btn.dataset.decay;
        card.querySelectorAll('.dl-btn').forEach(function (b) { b.classList.toggle('active', b === btn); });
        paint();
        launch();
        return;
      }
      if (event.target === canvas) launch();
    });

    state.resize = function () {
      if (lab !== state) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      state.w = rect.width;
      state.h = rect.height;
      state.ctx = canvas.getContext('2d');
      state.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      step(performance.now());
    };

    const first = card.querySelector('.dl-btn');
    if (first) first.classList.add('active');
    paint();
    state.resize();
    launch();
    window.addEventListener('resize', state.resize);
  }

  function stopLab() {
    if (!lab) return;
    if (lab.raf) cancelAnimationFrame(lab.raf);
    lab.raf = 0;
    lab.flying = [];
    if (lab.resize) window.removeEventListener('resize', lab.resize);
    lab = null;
  }

  function createGuidePanel() {
    if (guidePanel) return guidePanel;

    guidePanel = document.createElement('div');
    guidePanel.id = 'science-guide-panel';
    guidePanel.innerHTML = `
      <div class="guide-card">
        <div class="guide-header">
          <div class="guide-title">${ic("microscope")}${esc(tx(UI.guideTitle))}</div>
          <button class="guide-close" id="guide-close-btn" aria-label="close">${ic("x")}</button>
        </div>
        <div class="guide-nav-bar">
          <button class="guide-nav-arrow" id="guide-nav-prev" type="button">&#8249;</button>
          <div class="guide-nav" id="guide-nav"></div>
          <button class="guide-nav-arrow" id="guide-nav-next" type="button">&#8250;</button>
        </div>
        <div class="guide-content" id="guide-content" tabindex="0">
          <div class="guide-welcome">
            <h2>${tx(UI.welcomeH)}</h2>
            <p>${tx(UI.welcomeP1)}</p>
            <p>${tx(UI.welcomeP2)}</p>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(guidePanel);
    lucideIn(guidePanel);

    const closeBtn = guidePanel.querySelector('#guide-close-btn');
    closeBtn.addEventListener('click', closeGuide);

    // One row of tabs is the only layout that keeps the reading area tall enough,
    // so the row itself has to be scrollable: a plain mouse wheel reports deltaY
    // and would otherwise be ignored by a horizontal-only container.
    const navEl = guidePanel.querySelector('#guide-nav');
    navEl.addEventListener('wheel', (event) => {
      const canScroll = navEl.scrollWidth - navEl.clientWidth;
      if (canScroll <= 0 || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      event.preventDefault();
      navEl.scrollLeft += event.deltaY;
    }, { passive: false });

    // The arrows are the visible affordance for the same horizontal scroll, so
    // touch and mouse readers both get an obvious way to reach the last tabs.
    guidePanel.querySelector('#guide-nav-prev').addEventListener('click', () => stepNav(-1));
    guidePanel.querySelector('#guide-nav-next').addEventListener('click', () => stepNav(1));
    navEl.addEventListener('scroll', updateNavArrows, { passive: true });
    labelNavArrows();

    lastLang = lang();
    buildNav();
    return guidePanel;
  }

  function labelNavArrows() {
    if (!guidePanel) return;
    const map = [['#guide-nav-prev', UI.navPrev], ['#guide-nav-next', UI.navNext]];
    for (const [sel, label] of map) {
      const btn = guidePanel.querySelector(sel);
      if (!btn) continue;
      btn.setAttribute('aria-label', tx(label));
      btn.title = tx(label);
    }
  }

  // A fixed page step would leave the tabs that straddle the edge permanently
  // unreachable, so the pivot is always a tab that is not fully visible yet and
  // the strip moves exactly far enough to bring it flush with the far edge of
  // the view: the largest step that cannot pass a tab over in that direction.
  function stepNav(dir) {
    if (!guidePanel) return;
    const navEl = guidePanel.querySelector('#guide-nav');
    if (!navEl || navEl.clientWidth === 0) return;
    const box = navEl.getBoundingClientRect();
    const btns = Array.from(navEl.querySelectorAll('.guide-nav-btn'));
    if (dir > 0) {
      const pivot = btns.find(b => b.getBoundingClientRect().right > box.right + 1);
      if (!pivot) return;
      const shift = pivot.getBoundingClientRect().left - box.left;
      if (shift <= 0) return;
      navEl.scrollTo({ left: navEl.scrollLeft + shift, behavior: 'smooth' });
    } else {
      const hidden = btns.filter(b => b.getBoundingClientRect().left < box.left - 1);
      const pivot = hidden[hidden.length - 1];
      if (!pivot) return;
      const shift = pivot.getBoundingClientRect().right - box.right;
      if (shift >= 0) return;
      navEl.scrollTo({ left: navEl.scrollLeft + shift, behavior: 'smooth' });
    }
  }

  function updateNavArrows() {
    if (!guidePanel) return;
    const bar = guidePanel.querySelector('.guide-nav-bar');
    const navEl = guidePanel.querySelector('#guide-nav');
    if (!bar || !navEl) return;
    // Nothing is measurable while the overlay is hidden, and writing a state
    // learned from zero-width layout would hide the arrows permanently.
    if (navEl.clientWidth === 0) return;
    bar.classList.toggle('no-overflow', navEl.scrollWidth - navEl.clientWidth <= 4);
    bar.querySelector('#guide-nav-prev').disabled = navEl.scrollLeft <= 2;
    bar.querySelector('#guide-nav-next').disabled = navEl.scrollLeft + navEl.clientWidth >= navEl.scrollWidth - 2;
  }

  function buildNav() {
    const nav = guidePanel.querySelector('#guide-nav');
    nav.innerHTML = '';
    for (const [key, guide] of Object.entries(GUIDES)) {
      const btn = document.createElement('button');
      btn.className = 'guide-nav-btn';
      btn.dataset.guide = key;
      btn.innerHTML = ic(guide.icon) + esc(tx(guide.title));
      if (key === currentGuide) btn.classList.add('active');
      btn.addEventListener('click', () => showGuide(key));
      nav.appendChild(btn);
    }
    lucideIn(nav);
    updateNavArrows();
    centerActiveTab();
  }

  // The active tab is the one the reader is looking at; keeping it in the visible
  // part of the strip is what makes the off-screen tabs reachable by tapping the
  // edge ones and scrolling, rather than hunting for a thin scrollbar.
  function centerActiveTab() {
    const navEl = guidePanel.querySelector('#guide-nav');
    const btn = guidePanel.querySelector('.guide-nav-btn.active');
    if (!navEl || !btn) return;
    const navBox = navEl.getBoundingClientRect();
    const btnBox = btn.getBoundingClientRect();
    navEl.scrollTo({
      left: navEl.scrollLeft + (btnBox.left + btnBox.right - navBox.left - navBox.right) / 2,
      behavior: 'smooth'
    });
  }

  function showGuide(key) {
    const guide = GUIDES[key];
    if (!guide) return;

    currentGuide = key;
    createGuidePanel();
    // The strip metrics are only meaningful once the panel is laid out, so the
    // arrows are measured here rather than while the overlay is still display:none.
    guidePanel.style.display = 'flex';

    const nav = guidePanel.querySelectorAll('.guide-nav-btn');
    nav.forEach(btn => btn.classList.toggle('active', btn.dataset.guide === key));

    const content = guidePanel.querySelector('#guide-content');
    let html = `<h2>${ic(guide.icon)}${esc(tx(guide.title))}</h2>`;

    for (const section of guide.sections) {
      html += `
        <div class="guide-section">
          <h3>${tx(section.heading)}</h3>
          <div class="guide-text">${tx(section.content)}</div>
          ${section.interactive === 'decay' ? decayLabHtml() : ''}
        </div>
      `;
    }

    stopLab();
    content.innerHTML = html;
    lucideIn(content);
    if (guide.sections.some(s => s.interactive === 'decay')) bindDecayLab(content);
    content.scrollTop = 0;
    updateNavArrows();
    centerActiveTab();
    lastLang = lang();
  }

  function closeGuide() {
    // A running canvas loop behind a hidden overlay is pure battery, and the
    // panel can be reopened on a different topic that has no lab at all.
    stopLab();
    if (guidePanel) {
      guidePanel.style.display = 'none';
    }
    currentGuide = null;
  }

  function openGuide() {
    createGuidePanel();
    guidePanel.style.display = 'flex';
    updateNavArrows();
    if (currentGuide) centerActiveTab();
    syncLanguage();
  }

  // Re-render in place when the app language changes (the bundle stores it in
  // 'mol3d.lang' and fires 'mol3d:lang'; polling covers builds that do neither).
  function syncLanguage() {
    const l = lang();
    relabelInfo(l);
    if (l === lastLang || !guidePanel) return;
    lastLang = l;
    const title = guidePanel.querySelector('.guide-title');
    if (title) { title.innerHTML = ic('microscope') + esc(tx(UI.guideTitle)); lucideIn(title); }
    labelNavArrows();
    if (!currentGuide) {
      const welcome = guidePanel.querySelector('.guide-welcome');
      if (welcome) {
        welcome.innerHTML = `<h2>${tx(UI.welcomeH)}</h2><p>${tx(UI.welcomeP1)}</p><p>${tx(UI.welcomeP2)}</p>`;
      }
    } else {
      showGuide(currentGuide);
    }
    buildNav();
  }

  // The INFO sidebar keeps its own two labels in step with the app language even
  // before the guide panel has ever been opened.
  function relabelInfo(l) {
    if (l === infoLang) return;
    infoLang = l;
    const heading = document.getElementById('science-panel-title');
    if (heading) heading.textContent = tx(UI.panelTitle);
    const btn = document.getElementById('btn-science-guide');
    if (btn) { btn.innerHTML = ic('microscope') + esc(tx(UI.menuBtn)); lucideIn(btn); }
  }

  // The feature entries belong to the INFO sidebar tab, never to the app menu.
  // Older pages without the section get it appended to the same tab.
  function infoHost() {
    let host = document.getElementById('science-entries');
    if (host) return host;
    const info = document.getElementById('side-info');
    if (!info) return null;
    const panel = document.createElement('section');
    panel.className = 'panel';
    panel.id = 'science-panel';
    const heading = document.createElement('h2');
    heading.id = 'science-panel-title';
    heading.textContent = tx(UI.panelTitle);
    host = document.createElement('div');
    host.id = 'science-entries';
    panel.appendChild(heading);
    panel.appendChild(host);
    info.appendChild(panel);
    return host;
  }

  function addGuideButton() {
    if (document.getElementById('btn-science-guide')) return;
    const host = infoHost();
    if (!host) return;
    const btn = document.createElement('button');
    btn.id = 'btn-science-guide';
    btn.className = 'science-entry';
    btn.innerHTML = ic('microscope') + esc(tx(UI.menuBtn));
    lucideIn(btn);
    btn.addEventListener('click', () => {
      openGuide();
    });
    host.insertBefore(btn, host.firstChild);
    infoLang = lang();
    lastLang = lang();
  }

  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .sg-lc{width:1em;height:1em;vertical-align:-0.18em;margin-right:5px;stroke-width:2.2}
      .guide-close .sg-lc,.guide-close svg{width:1.1em;height:1.1em;margin:0}
      #science-entries {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      #science-entries .science-entry {
        display: block;
        width: 100%;
        padding: 6px 12px;
        font-size: 12px;
        text-align: center;
        background: var(--accent-soft);
        color: var(--accent);
        border: 1px solid var(--accent);
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      #science-entries .science-entry:hover {
        background: var(--accent);
        color: var(--bg);
      }
      #science-guide-panel {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        z-index: 10000;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      }
      /* The guide has always worn its own rose-and-navy palette rather than the
         app's cyan one, so it declares that palette as scoped variables and swaps
         the set for light theme. Tapping the app's --accent directly would repaint
         the guide cyan in dark mode, which is not what the theme toggle promises. */
      #science-guide-panel {
        --g-panel-a: #1a1a2e;
        --g-panel-b: #16213e;
        --g-line: #0f3460;
        --g-fill: rgba(15, 52, 96, 0.3);
        --g-fill-faint: rgba(15, 52, 96, 0.2);
        --g-fill-strong: rgba(15, 52, 96, 0.5);
        --g-accent: #e94560;
        --g-accent-soft: #ff6b6b;
        --g-accent-fill: rgba(233, 69, 96, 0.3);
        --g-on-accent: white;
        --g-muted: #a8dadc;
        --g-text: #f1faee;
      }
      html[data-theme="light"] #science-guide-panel {
        --g-panel-a: #ffffff;
        --g-panel-b: #eef1f8;
        --g-line: rgba(20, 40, 80, 0.24);
        --g-fill: rgba(30, 60, 110, 0.07);
        --g-fill-faint: rgba(30, 60, 110, 0.05);
        --g-fill-strong: rgba(30, 60, 110, 0.13);
        --g-accent: #c2264b;
        --g-accent-soft: #d9575f;
        --g-accent-fill: rgba(194, 38, 75, 0.14);
        --g-on-accent: #ffffff;
        --g-muted: #46617a;
        --g-text: #16233a;
      }
      .guide-card {
        background: linear-gradient(135deg, var(--g-panel-a) 0%, var(--g-panel-b) 100%);
        border: 2px solid var(--g-line);
        border-radius: 12px;
        width: 90%;
        max-width: 800px;
        height: 85%;
        max-height: 85%;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      }
      .guide-header {
        display: flex;
        flex-shrink: 0;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 2px solid var(--g-line);
        background: var(--g-fill);
        border-radius: 10px 10px 0 0;
      }
      .guide-title {
        font-size: 20px;
        font-weight: bold;
        color: var(--g-accent);
      }
      .guide-close {
        background: var(--g-accent);
        border: none;
        color: var(--g-on-accent);
        width: 32px;
        height: 32px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 18px;
        transition: all 0.2s;
      }
      .guide-close:hover {
        background: var(--g-accent-soft);
        transform: scale(1.1);
      }
      .guide-nav-bar {
        display: flex;
        align-items: center;
        flex-shrink: 0;
        gap: 6px;
        padding: 0 8px;
        border-bottom: 1px solid var(--g-line);
        background: var(--g-fill-faint);
      }
      .guide-nav-bar.no-overflow .guide-nav-arrow {
        display: none;
      }
      .guide-nav-arrow {
        flex-shrink: 0;
        width: 30px;
        padding: 5px 0;
        background: var(--g-fill-strong);
        border: 1px solid var(--g-line);
        border-radius: 6px;
        color: var(--g-muted);
        font-size: 18px;
        line-height: 1.1;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .guide-nav-arrow:hover:not(:disabled) {
        background: var(--g-accent-fill);
        border-color: var(--g-accent);
      }
      .guide-nav-arrow:disabled {
        opacity: 0.3;
        cursor: default;
      }
      .guide-nav {
        display: flex;
        flex-wrap: nowrap;
        flex: 1;
        min-width: 0;
        gap: 8px;
        padding: 12px 6px;
        background: transparent;
        overflow-x: auto;
        overflow-y: hidden;
        overscroll-behavior-x: contain;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: thin;
        scrollbar-color: var(--g-line) var(--g-fill-faint);
      }
      .guide-nav-btn {
        flex-shrink: 0;
        background: var(--g-fill-strong);
        border: 1px solid var(--g-line);
        color: var(--g-muted);
        padding: 8px 14px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
        white-space: nowrap;
        transition: all 0.2s;
      }
      .guide-nav-btn:hover {
        background: var(--g-accent-fill);
        border-color: var(--g-accent);
      }
      .guide-nav-btn.active {
        background: var(--g-accent);
        border-color: var(--g-accent);
        color: var(--g-on-accent);
      }
      .guide-content {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior-y: contain;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: thin;
        scrollbar-color: var(--g-accent) var(--g-fill-faint);
        padding: 20px;
        color: var(--g-text);
      }
      .guide-content:focus {
        outline: none;
      }
      .guide-content:focus-visible {
        outline: 1px solid var(--g-accent);
        outline-offset: -4px;
      }
      .guide-content h2 {
        color: var(--g-accent);
        margin: 0 0 20px 0;
        font-size: 24px;
      }
      .guide-section {
        background: var(--g-fill);
        border: 1px solid var(--g-line);
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 16px;
      }
      .guide-section h3 {
        color: var(--g-muted);
        margin: 0 0 12px 0;
        font-size: 17px;
      }
      .guide-text {
        line-height: 1.7;
        color: var(--g-text);
        font-size: 14px;
      }
      .guide-text b {
        color: var(--g-accent);
      }
      .guide-welcome {
        text-align: center;
        padding: 40px 20px;
      }
      .guide-welcome h2 {
        color: var(--g-accent);
        font-size: 28px;
        margin-bottom: 16px;
      }
      .guide-welcome p {
        color: var(--g-muted);
        font-size: 16px;
        line-height: 1.6;
        margin: 12px 0;
      }
      .guide-nav::-webkit-scrollbar {
        height: 6px;
      }
      .guide-nav::-webkit-scrollbar-thumb {
        background: var(--g-line);
        border-radius: 3px;
      }
      .guide-content::-webkit-scrollbar {
        width: 8px;
      }
      .guide-content::-webkit-scrollbar-track {
        background: var(--g-fill-faint);
        border-radius: 4px;
      }
      .guide-content::-webkit-scrollbar-thumb {
        background: var(--g-accent);
        border-radius: 4px;
      }
      /* The decay lab is a canvas on the guide's own palette. Height is in
         aspect-ratio, not pixels, so the same card works from a phone to a
         desktop without the trace ever being clipped. */
      .decay-lab {
        margin-top: 14px;
        border: 1px solid var(--g-line);
        border-radius: 8px;
        background: var(--g-fill-faint);
        padding: 12px;
      }
      .dl-head {
        display: flex;
        align-items: center;
        gap: 6px;
        color: var(--g-accent);
        font-weight: 600;
        font-size: 14px;
      }
      .dl-hint {
        margin: 6px 0 10px;
        color: var(--g-muted);
        font-size: 12.5px;
        line-height: 1.5;
      }
      .dl-canvas {
        display: block;
        width: 100%;
        aspect-ratio: 16 / 7;
        min-height: 120px;
        border-radius: 6px;
        background: radial-gradient(circle at 33% 50%, rgba(255, 60, 50, 0.10), transparent 62%), var(--g-fill);
        border: 1px solid var(--g-line);
        cursor: pointer;
        touch-action: manipulation;
      }
      .dl-buttons {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 10px;
      }
      .dl-btn {
        flex: 1 1 auto;
        min-width: 74px;
        padding: 6px 8px;
        font-size: 12px;
        font-weight: 600;
        color: var(--g-muted);
        background: var(--g-fill-strong);
        border: 1px solid var(--g-line);
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .dl-btn:hover { border-color: var(--dl-c); color: var(--dl-c); }
      .dl-btn.active {
        background: var(--dl-c);
        border-color: var(--dl-c);
        color: #0b1220;
      }
      .dl-readout {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
        margin-top: 10px;
      }
      .dl-col {
        display: flex;
        flex-direction: column;
        gap: 3px;
        padding: 7px 9px;
        background: var(--g-fill);
        border: 1px solid var(--g-line);
        border-radius: 6px;
        min-width: 0;
      }
      .dl-col span {
        font-size: 10.5px;
        letter-spacing: 0.03em;
        text-transform: uppercase;
        color: var(--g-muted);
      }
      .dl-col b {
        font-size: 14px;
        color: var(--g-text);
        overflow-wrap: anywhere;
      }
      .dl-balance {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 8px;
        font-size: 12px;
        padding: 6px 9px;
        border-radius: 6px;
        border: 1px solid transparent;
      }
      .dl-balance.ok { color: #35d39a; background: rgba(53, 211, 154, 0.09); border-color: rgba(53, 211, 154, 0.35); }
      .dl-balance.bad { color: #ff6b6b; background: rgba(255, 107, 107, 0.09); border-color: rgba(255, 107, 107, 0.35); }
      html[data-theme="light"] .dl-balance.ok { color: #0f7a52; background: rgba(15, 122, 82, 0.08); }
      html[data-theme="light"] .dl-balance.bad { color: #b02a2a; background: rgba(176, 42, 42, 0.08); }
      html[data-theme="light"] .dl-btn.active { color: #ffffff; }
      @media (max-width: 520px) {
        .dl-readout { grid-template-columns: 1fr 1fr; }
        .dl-readout .dl-col:last-child { grid-column: 1 / -1; }
        .dl-canvas { aspect-ratio: 4 / 3; }
      }
      @media (max-width: 768px) {
        .guide-card {
          width: 95%;
          height: 90%;
          max-height: 90%;
        }
        .guide-nav-bar {
          padding: 0 6px;
        }
        .guide-nav-arrow {
          width: 26px;
          font-size: 16px;
        }
        .guide-nav {
          gap: 6px;
          padding: 10px 4px;
        }
        .guide-nav-btn {
          padding: 6px 10px;
          font-size: 12px;
        }
        .guide-content {
          padding: 14px;
        }
        .guide-section {
          padding: 12px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function init() {
    injectStyles();
    const checkInfo = setInterval(() => {
      if (document.getElementById('side-info')) {
        clearInterval(checkInfo);
        addGuideButton();
      }
    }, 500);

    window.addEventListener('mol3d:lang', syncLanguage);
    window.addEventListener('resize', updateNavArrows);
    window.addEventListener('storage', function(e) {
      if (e.key === LANG_KEY) syncLanguage();
    });
    setInterval(syncLanguage, 400);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.ScienceGuide = {
    open: openGuide,
    show: showGuide,
    close: closeGuide,
    refresh: syncLanguage,
    get lang() { return lang(); },
    GUIDES
  };

})();
