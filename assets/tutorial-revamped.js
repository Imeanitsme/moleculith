// Tutorial System - Flying Assistant (GIF + Dialog Bubble Only)
// Comprehensive guide covering ALL game features
(function() {
  'use strict';

  var TUTORIAL_KEY = 'mol3d.tutorial.completed.v6';
  var USER_NAME_KEY = 'mol3d.user.name';

  var tutorialActive = false;
  var phase = 0;
  var step = 0;
  var userName = localStorage.getItem(USER_NAME_KEY) || 'Scientist';
  var assistantName = 'ARIA';

  var container, assistantEl, dialogEl;
  var spotlightRing, clickIndicator;
  var typeInterval = null;
  var waitInterval = null;
  var currentFullText = '';
  var currentCharIndex = 0;
  var resizeHandler = null;
  var longPressTimer = null;

  var PHASES = [
    {
      "id": "setup",
      "name": "Introduction",
      "steps": [
        {
          "text": "Hello! I'm {assistant}, your chemistry AI assistant.",
          "action": "show"
        },
        {
          "text": "What should I call you?",
          "action": "nameInput"
        },
        {
          "text": "Nice to meet you, {user}! Let me show you around the lab.",
          "action": "next"
        },
        {
          "text": "I'll walk you through every feature — the scene, controls, chemistry, and more. Ready?",
          "action": "next"
        }
      ]
    },
    {
      "id": "scene",
      "name": "The Lab",
      "steps": [
        {
          "text": "Welcome to the lab, {user}! This 3D scene is your workspace.",
          "action": "next"
        },
        {
          "text": "Use WASD or arrow keys to orbit the camera. Scroll to zoom in and out.",
          "action": "next"
        },
        {
          "text": "On mobile, use the joystick on the right side to look around.",
          "action": "next"
        },
        {
          "text": "Click and drag on empty space to rotate the view freely.",
          "action": "next"
        }
      ]
    },
    {
      "id": "pool",
      "name": "Element Pool",
      "steps": [
        {
          "target": "#side-pool",
          "text": "This is your element pool — all 118 elements organized by category.",
          "action": "highlight"
        },
        {
          "target": "#pool-search",
          "text": "Use the search bar to quickly find any element by name or symbol.",
          "action": "highlight"
        },
        {
          "target": "#pool-view",
          "text": "Toggle between the chip list and the full periodic table view.",
          "action": "highlight"
        },
        {
          "target": "#pool-list",
          "text": "Drag any element into the 3D scene to place it. Try Hydrogen (H)!",
          "action": "waitForSpawn",
          "threshold": 1
        },
        {
          "text": "Great job! Atoms appear exactly where you drop them.",
          "action": "next"
        },
        {
          "text": "Select an atom and open the Info tab to find the Bohr Model button — it shows a clean 2D orbital diagram.",
          "action": "next"
        }
      ]
    },
    {
      "id": "bonding",
      "name": "Bonding & Reactions",
      "steps": [
        {
          "target": "#pool-list",
          "text": "Drag a second atom near the first one. They'll bond automatically when close enough!",
          "action": "waitForSpawn",
          "threshold": 2
        },
        {
          "text": "Atoms bond based on their valence electrons. Hydrogen wants 1 bond, Oxygen wants 2, Carbon wants 4.",
          "action": "next"
        },
        {
          "text": "Click a bond (the line between atoms) to cycle its order: single → double → triple → back.",
          "action": "next"
        },
        {
          "text": "Drag atoms apart to break bonds. Unbonded atoms will drift and seek new partners.",
          "action": "next"
        },
        {
          "text": "Double-click a molecule to trigger reactions. The game detects acids, bases, redox, combustion, and more!",
          "action": "next"
        },
        {
          "text": "Every reaction is stoichiometrically balanced. Try combining H and O to make water!",
          "action": "next"
        }
      ]
    },
    {
      "id": "time",
      "name": "Time Controls",
      "steps": [
        {
          "target": "#time-display",
          "text": "This is the simulation clock. It tracks elapsed time in the lab.",
          "action": "highlight"
        },
        {
          "target": "#btn-time-menu",
          "text": "Open Time Control to adjust simulation speed.",
          "action": "highlight"
        },
        {
          "target": "#time-speed-range",
          "text": "Drag the slider to speed up or slow down time — from 1× to 1 billion×!",
          "action": "highlight"
        },
        {
          "target": "#btn-modal-freeze",
          "text": "Freeze stops time completely. Molecules hang in space.",
          "action": "highlight"
        },
        {
          "target": "#btn-modal-rewind",
          "text": "The Slow Down button decreases time speed. Click it repeatedly to go from 1 billion× back down to 1×.",
          "action": "highlight"
        },
        {
          "text": "At extreme speeds, you can trigger THE WORLD — a cinematic time-freeze effect with a purple shockwave!",
          "action": "next"
        },
        {
          "text": "Temperature affects molecule movement. Higher temp = faster dancing atoms!",
          "action": "next"
        }
      ]
    },
    {
      "id": "environment",
      "name": "Environment",
      "steps": [
        {
          "target": "#env-temp-display",
          "text": "This shows the current temperature in Kelvin. Default is 298K (room temp).",
          "action": "highlight"
        },
        {
          "target": "#env-pressure-display",
          "text": "And this is the pressure in atmospheres. Default is 1 atm.",
          "action": "highlight"
        },
        {
          "target": "#btn-env-menu",
          "text": "Open Environment Control to change temperature, pressure, and gas composition.",
          "action": "highlight"
        },
        {
          "target": "#env-temp-range",
          "text": "Drag the temperature slider. Heat affects reaction rates and molecular motion.",
          "action": "highlight"
        },
        {
          "target": "#env-pressure-range",
          "text": "Adjust pressure to influence gas-phase reactions and boiling points.",
          "action": "highlight"
        },
        {
          "target": "#env-gas-add",
          "text": "Add gases to the environment — O₂, N₂, CO₂, and more. These act as bonus reactants!",
          "action": "highlight"
        },
        {
          "target": "#btn-atmosphere",
          "text": "Toggle Atmosphere mode from the Menu. It adds auto H-capping and environmental reactions.",
          "action": "highlight"
        }
      ]
    },
    {
      "id": "phase",
      "name": "Phase Diagram",
      "steps": [
        {
          "text": "Extreme temperature and pressure trigger phase transitions — the matter state changes!",
          "action": "next"
        },
        {
          "text": "Dense Plasma: T ≥ 5000K and P ≥ 1500 atm. Maximum damage and hyper-conductive lightning arcs!",
          "action": "next"
        },
        {
          "text": "Dilute Plasma: T ≥ 5000K and P < 100 atm. Triggers an explosive blast pushing all atoms outward!",
          "action": "next"
        },
        {
          "text": "Compressed Mantle: T 1000-4000K and P ≥ 1000 atm. Crush damage from extreme pressure!",
          "action": "next"
        },
        {
          "text": "Supercritical Fluid: T > 647K and P > 218 atm. Bonds corrode and break over time!",
          "action": "next"
        },
        {
          "text": "Watch the phase indicator near the temperature display to see the current state.",
          "action": "next"
        }
      ]
    },
    {
      "id": "health",
      "name": "Health & Radiation",
      "steps": [
        {
          "target": "#health-bar-container",
          "text": "This is your health bar. It starts at 100 HP.",
          "action": "highlight"
        },
        {
          "text": "Radioactive elements (Z > 82, like Uranium and Plutonium) emit radiation that damages you!",
          "action": "next"
        },
        {
          "text": "The closer you are to a radioactive atom, the more damage you take — following the inverse-square law.",
          "action": "next"
        },
        {
          "text": "Elements beyond Lead are unstable. They'll decay over time, transmuting into lighter elements.",
          "action": "next"
        },
        {
          "text": "When a heavy atom goes critical, you'll see a red countdown timer. Get away before it explodes!",
          "action": "next"
        },
        {
          "text": "Nuclear decay breaks nearby bonds and creates shockwaves. Real physics!",
          "action": "next"
        },
        {
          "target": "#death-screen",
          "text": "If your health reaches zero, you die. Hit Respawn to come back.",
          "action": "highlight"
        }
      ]
    },
    {
      "id": "xray",
      "name": "X-Ray & Bohr Mode",
      "steps": [
        {
          "target": "#btn-xray",
          "text": "X-Ray mode reveals the internal structure of atoms — nucleus and electron shells!",
          "action": "highlight"
        },
        {
          "text": "You'll see the proton/neutron nucleus at the center, surrounded by electron cloud layers.",
          "action": "next"
        },
        {
          "text": "Each shell corresponds to an energy level: K, L, M, N, O, P, Q.",
          "action": "next"
        },
        {
          "target": "#bohr-toggle",
          "text": "When you select an atom, the Bohr toggle appears showing a clean 2D orbital diagram.",
          "action": "highlight"
        },
        {
          "text": "In the Format panel, you can toggle individual electron shells on/off for clarity.",
          "action": "next"
        },
        {
          "text": "Press X as a shortcut to toggle X-Ray mode anytime!",
          "action": "next"
        }
      ]
    },
    {
      "id": "nuclear",
      "name": "Proton Gun & Fission",
      "steps": [
        {
          "target": "#btn-proton",
          "text": "The Proton Gun lets you shoot protons into atoms, transmuting them into heavier elements!",
          "action": "highlight"
        },
        {
          "text": "Aim at any atom and click to add a proton. Hydrogen becomes Helium, Carbon becomes Nitrogen, etc.",
          "action": "next"
        },
        {
          "text": "Shoot a proton into an element with Z > 82 and you'll trigger nuclear fission!",
          "action": "next"
        },
        {
          "text": "Fission creates a massive white explosion, breaks all nearby bonds, and splits the atom into lighter elements.",
          "action": "next"
        },
        {
          "text": "The damage follows real inverse-square physics — distance is your best friend during fission!",
          "action": "next"
        }
      ]
    },
    {
      "id": "rank",
      "name": "Rank & Shop",
      "steps": [
        {
          "target": "#side-dex",
          "text": "Switch to the DEX tab to see your rank widget. You start as New Creation with 0 stars.",
          "action": "highlight"
        },
        {
          "text": "Earn stars by discovering new molecules. Each discovery awards stars based on complexity!",
          "action": "next"
        },
        {
          "text": "Every 5 stars = 1 grade up. 5 grades = 1 rank up. There are 6 ranks total.",
          "action": "next"
        },
        {
          "text": "Higher ranks unlock more elements. New Creation gets H through Ca; Further Beyond gets all 118!",
          "action": "next"
        },
        {
          "text": "The final rank, Further Beyond, has unlimited grades. Keep exploring to climb higher!",
          "action": "next"
        },
        {
          "target": "#shop-rope",
          "text": "Pull the rope on the left side to open the Shop. Spend stars to buy elements and features.",
          "action": "highlight"
        },
        {
          "text": "Be careful — spending stars can downgrade your rank if you fall below the threshold!",
          "action": "next"
        }
      ]
    },
    {
      "id": "tools",
      "name": "Tools & Panels",
      "steps": [
        {
          "target": "#btn-fc",
          "text": "The Format panel controls formal charges and the atom grid outline.",
          "action": "highlight"
        },
        {
          "text": "Use +/−/Auto charge buttons to set ionic charges on selected atoms.",
          "action": "next"
        },
        {
          "target": "#side-info",
          "text": "The Info tab shows molecule details: name, formula, geometry, molar mass, and bonds.",
          "action": "highlight"
        },
        {
          "text": "It also includes stoichiometry calculations and reaction kinetics charts!",
          "action": "next"
        },
        {
          "target": "#side-dex",
          "text": "The Dex tab tracks all your discoveries and challenge progress.",
          "action": "highlight"
        },
        {
          "text": "Use the Isomer Inspector to validate molecular arrangements — it checks structural formulas!",
          "action": "next"
        },
        {
          "target": "#btn-undo",
          "text": "Undo (Ctrl+Z) reverses your last action. Duplicate (Ctrl+D) copies selected atoms.",
          "action": "highlight"
        },
        {
          "target": "#btn-delete",
          "text": "Delete removes selected atoms. Clear wipes the entire scene.",
          "action": "highlight"
        }
      ]
    },
    {
      "id": "features",
      "name": "Special Features",
      "steps": [
        {
          "target": "#btn-mayhem",
          "text": "Mayhem mode enables chaotic reactions — explosions, lightning, and wild chemistry!",
          "action": "highlight"
        },
        {
          "target": "#btn-console",
          "text": "The Console gives admin commands: setStars(), debugRank(), adminExport(), and more.",
          "action": "highlight"
        },
        {
          "target": "#btn-quest",
          "text": "Quest mode connects you to an AI assistant that gives challenges and answers chemistry questions.",
          "action": "highlight"
        },
        {
          "text": "Multiplayer lets you host or join rooms via PeerJS. Build molecules together in real-time!",
          "action": "next"
        },
        {
          "text": "In multiplayer, you get voice chat, text chat, and shared world state synchronization.",
          "action": "next"
        },
        {
          "target": "#btn-game-mode",
          "text": "Toggle between Survival (health + radiation) and Creative (unlimited, no danger) modes.",
          "action": "highlight"
        }
      ]
    },
    {
      "id": "settings",
      "name": "Settings & Preferences",
      "steps": [
        {
          "target": "#btn-menu",
          "text": "The main menu has all your settings and utilities.",
          "action": "highlight"
        },
        {
          "target": "#btn-theme",
          "text": "Toggle between Dark and Light themes.",
          "action": "highlight"
        },
        {
          "target": "#btn-lang",
          "text": "Switch language between English and Tiếng Việt.",
          "action": "highlight"
        },
        {
          "target": "#btn-quality",
          "text": "Graphics quality: Low, Medium, High, or Ultra High. Adjust for your device!",
          "action": "highlight"
        },
        {
          "text": "Low quality reduces particles and simplifies rendering. Ultra High enables all visual effects.",
          "action": "next"
        },
        {
          "target": "#btn-export",
          "text": "Export Progress saves your rank, discoveries, and settings to a JSON file.",
          "action": "highlight"
        },
        {
          "target": "#btn-import-progress",
          "text": "Import Progress loads a saved file. Note: import is one-shot — you can only do it once!",
          "action": "highlight"
        },
        {
          "target": "#btn-tutorial",
          "text": "Replay this tutorial anytime from the menu.",
          "action": "highlight"
        }
      ]
    },
    {
      "id": "conclusion",
      "name": "Ready!",
      "steps": [
        {
          "text": "That's everything, {user}! You now know the full lab.",
          "action": "next"
        },
        {
          "text": "Quick recap: drag elements to build, click bonds to upgrade, double-click for reactions.",
          "action": "next"
        },
        {
          "text": "Watch out for radiation, control time and temperature, and unlock all 118 elements!",
          "action": "next"
        },
        {
          "text": "The lab is yours. Experiment, discover, and have fun, {user}!",
          "action": "complete"
        }
      ]
    }
  ];

  var STR_VI = {
    "Hello! I'm {assistant}, your chemistry AI assistant.": "Xin chào! Tôi là {assistant}, trợ lý AI hóa học của bạn.",
    "What should I call you?": "Tôi nên gọi bạn là gì?",
    "Nice to meet you, {user}! Let me show you around the lab.": "Rất vui được gặp bạn, {user}! Để tôi dẫn bạn tham quan phòng thí nghiệm.",
    "I'll walk you through every feature — the scene, controls, chemistry, and more. Ready?": "Tôi sẽ hướng dẫn bạn từng tính năng — cảnh, điều khiển, hóa học và hơn thế. Sẵn sàng chứ?",
    "Welcome to the lab, {user}! This 3D scene is your workspace.": "Chào mừng đến phòng thí nghiệm, {user}! Cảnh 3D này là không gian làm việc của bạn.",
    "Use WASD or arrow keys to orbit the camera. Scroll to zoom in and out.": "Dùng WASD hoặc phím mũi tên để xoay camera. Cuộn để phóng to/thu nhỏ.",
    "On mobile, use the joystick on the right side to look around.": "Trên di động, dùng cần điều khiển bên phải để quan sát.",
    "Click and drag on empty space to rotate the view freely.": "Nhấn và kéo vùng trống để xoay góc nhìn tự do.",
    "This is your element pool — all 118 elements organized by category.": "Đây là kho nguyên tố — đầy đủ 118 nguyên tố phân loại theo nhóm.",
    "Use the search bar to quickly find any element by name or symbol.": "Dùng thanh tìm kiếm để tìm nhanh nguyên tố theo tên hoặc ký hiệu.",
    "Toggle between the chip list and the full periodic table view.": "Chuyển đổi giữa danh sách chip và bảng tuần hoàn đầy đủ.",
    "Drag any element into the 3D scene to place it. Try Hydrogen (H)!": "Kéo bất kỳ nguyên tố nào vào cảnh 3D để đặt. Hãy thử Hidro (H)!",
    "Great job! Atoms appear exactly where you drop them.": "Tuyệt vời! Nguyên tử xuất hiện đúng chỗ bạn thả.",
    "Select an atom and open the Info tab to find the Bohr Model button — it shows a clean 2D orbital diagram.": "Chọn một nguyên tử và mở tab Thông tin để tìm nút Mô hình Bohr — nó hiển thị sơ đồ quỹ đạo 2D sạch.",
    "Drag a second atom near the first one. They'll bond automatically when close enough!": "Kéo nguyên tử thứ hai đến gần nguyên tử đầu tiên. Chúng sẽ tự động liên kết khi đủ gần!",
    "Atoms bond based on their valence electrons. Hydrogen wants 1 bond, Oxygen wants 2, Carbon wants 4.": "Nguyên tử liên kết dựa trên electron hóa trị. H muốn 1 liên kết, O muốn 2, C muốn 4.",
    "Click a bond (the line between atoms) to cycle its order: single → double → triple → back.": "Nhấn vào liên kết (đường nối giữa các nguyên tử) để đổi bậc: đơn → đôi → ba → lại.",
    "Drag atoms apart to break bonds. Unbonded atoms will drift and seek new partners.": "Kéo các nguyên tử ra xa để phá liên kết. Các nguyên tử không liên kết sẽ trôi và tìm bạn mới.",
    "Double-click a molecule to trigger reactions. The game detects acids, bases, redox, combustion, and more!": "Nhấn đôi vào phân tử để kích hoạt phản ứng. Game nhận diện axit, bazơ, oxi hóa khử, cháy và hơn thế!",
    "Every reaction is stoichiometrically balanced. Try combining H and O to make water!": "Mọi phản ứng đều được cân bằng. Hãy thử kết hợp H và O để tạo nước!",
    "This is the simulation clock. It tracks elapsed time in the lab.": "Đây là đồng hồ mô phỏng. Nó theo dõi thời gian trong phòng thí nghiệm.",
    "Open Time Control to adjust simulation speed.": "Mở Điều khiển thời gian để điều chỉnh tốc độ.",
    "Drag the slider to speed up or slow down time — from 1× to 1 billion×!": "Kéo thanh trượt để tăng hoặc giảm tốc độ — từ 1× đến 1 tỷ lần!",
    "Freeze stops time completely. Molecules hang in space.": "Đóng bºng dừng thời gian hoàn toàn. Các phân tử lưng chừg trong không gian.",
    "The Slow Down button decreases time speed. Click it repeatedly to go from 1 billion× back down to 1×.": "Nút Làm chậm giảm tốc độ thời gian. Nhấn nhiều lần để giảm từ 1 tỷ× xuống 1×.",
    "At extreme speeds, you can trigger THE WORLD — a cinematic time-freeze effect with a purple shockwave!": "Ở tốc độ cực cao, bạn có thể kích hoạt THE WORLD — hiệu ứng đóng bºng điện ảnh với sóng xung kích tím!",
    "Temperature affects molecule movement. Higher temp = faster dancing atoms!": "Nhiệt độ ảnh hưởng chuyển động phân tử. Nhiệt cao hơn = nguyên tử nhày nhanh hơn!",
    "This shows the current temperature in Kelvin. Default is 298K (room temp).": "Đây hiển thị nhiệt độ hiện tại theo Kelvin. Mặc định là 298K (nhiệt độ phòng).",
    "And this is the pressure in atmospheres. Default is 1 atm.": "Và đây là áp suất tính bằng atm. Mặc định là 1 atm.",
    "Open Environment Control to change temperature, pressure, and gas composition.": "Mở Điều khiển môi trường để đổi nhiệt độ, áp suất và thành phần khí.",
    "Drag the temperature slider. Heat affects reaction rates and molecular motion.": "Kéo thanh nhiệt độ. Nhiệt ảnh hưởng tốc độ phản ứng và chuyển động phân tử.",
    "Adjust pressure to influence gas-phase reactions and boiling points.": "Điều chỉnh áp suất để ảnh hưởng phản ứng khí và điểm sôi.",
    "Add gases to the environment — O₂, N₂, CO₂, and more. These act as bonus reactants!": "Thêm khí vào môi trường — O₂, N₂, CO₂ và hơn thế. Chúng làm tác nhân bổ sung!",
    "Toggle Atmosphere mode from the Menu. It adds auto H-capping and environmental reactions.": "Bật/tắt chế độ Khí quyển từ Menu. Nó thêm tự động thêm H và phản ứng môi trường.",
    "Extreme temperature and pressure trigger phase transitions — the matter state changes!": "Nhiệt độ và áp suất cực đoan kích hoạt chuyển pha — trạng thái vật chất thay đổi!",
    "Dense Plasma: T ≥ 5000K and P ≥ 1500 atm. Maximum damage and hyper-conductive lightning arcs!": "Plasma Đặc: T ≥ 5000K và P ≥ 1500 atm. Sát thương tối đa và vòng sét dẫn điện!",
    "Dilute Plasma: T ≥ 5000K and P < 100 atm. Triggers an explosive blast pushing all atoms outward!": "Plasma Loãng: T ≥ 5000K và P < 100 atm. Kích hoạt vụ nổ đẩy tất cả nguyên tử ra ngoài!",
    "Compressed Mantle: T 1000-4000K and P ≥ 1000 atm. Crush damage from extreme pressure!": "Lớp nén: T 1000-4000K và P ≥ 1000 atm. Sát thương nén từ áp suất cực đoan!",
    "Supercritical Fluid: T > 647K and P > 218 atm. Bonds corrode and break over time!": "Chất lỏng siêu tới hạn: T > 647K và P > 218 atm. Liên kết ăn mòn và phá vỡ theo thời gian!",
    "Watch the phase indicator near the temperature display to see the current state.": "Xem chỉ báo pha gần hiển thị nhiệt độ để biết trạng thái hiện tại.",
    "This is your health bar. It starts at 100 HP.": "Đây là thanh máu. Bắt đầu với 100 HP.",
    "Radioactive elements (Z > 82, like Uranium and Plutonium) emit radiation that damages you!": "Các nguyên tố phóng xạ (Z > 82, như Uran và Plutoni) phát bức xạ gây sát thương!",
    "The closer you are to a radioactive atom, the more damage you take — following the inverse-square law.": "Càng gần nguyên tử phóng xạ, bạn càng bị sát thương nhiều — theo định luật nghịch đảo bình phương.",
    "Elements beyond Lead are unstable. They'll decay over time, transmuting into lighter elements.": "Các nguyên tố sau Chì không ổn định. Chúng sẽ phân rã theo thời gian, biến đổi thành nguyên tố nhẹ hơn.",
    "When a heavy atom goes critical, you'll see a red countdown timer. Get away before it explodes!": "Khi nguyên tử nặng trở nên tối hạn, bạn sẽ thấy đồng hồ đếm ngược đỏ. Hãy tránh xa trước khi nõ!",
    "Nuclear decay breaks nearby bonds and creates shockwaves. Real physics!": "Phân rã hạ nhân phá vỡ liên kết gần và tạo sóng xung kích. Vật lý thực!",
    "If your health reaches zero, you die. Hit Respawn to come back.": "Nếu máu về 0, bạn chết. Nhấn Hồi sinh để trở lại.",
    "X-Ray mode reveals the internal structure of atoms — nucleus and electron shells!": "Chế độ Tia X tiết lộ cấu trúc nội tại nguyên tử — hạ nhân và lớp electron!",
    "You'll see the proton/neutron nucleus at the center, surrounded by electron cloud layers.": "Bạn sẽ thấy hạ nhân proton/neutron ở giữa, bao quanh bởi các lớp mây electron.",
    "Each shell corresponds to an energy level: K, L, M, N, O, P, Q.": "Mỗi lớp tương ứng mộc năng lượng: K, L, M, N, O, P, Q.",
    "When you select an atom, the Bohr toggle appears showing a clean 2D orbital diagram.": "Khi chọn một nguyên tử, nút Bohr xuất hiện hiển thị sơ đồ quỹ đạo 2D sạch.",
    "In the Format panel, you can toggle individual electron shells on/off for clarity.": "Trong bảng Định dạng, bạn có thể bật/tắt từng lớp electron để dễ nhìn.",
    "Press X as a shortcut to toggle X-Ray mode anytime!": "Nhấn X làm phím tắt để bật/tắt chế độ Tia X bất cứ lúc nào!",
    "The Proton Gun lets you shoot protons into atoms, transmuting them into heavier elements!": "Súng Proton cho phép bắn proton vào nguyên tử, biến đổi chúng thành nguyên tố nặng hơn!",
    "Aim at any atom and click to add a proton. Hydrogen becomes Helium, Carbon becomes Nitrogen, etc.": "Nhắm vào bất kỳ nguyên tử nào và nhấn để thêm proton. H thành He, C thành N, v.v.",
    "Shoot a proton into an element with Z > 82 and you'll trigger nuclear fission!": "Bắn proton vào nguyên tố có Z > 82 và bạn sẽ kích hoạt phân hạch nhân!",
    "Fission creates a massive white explosion, breaks all nearby bonds, and splits the atom into lighter elements.": "Phân hạch tạo vụ nổ trắng lớn, phá mọi liên kết gần và tách nguyên tử thành các nguyên tử nhẹ hơn.",
    "The damage follows real inverse-square physics — distance is your best friend during fission!": "Sát thương theo vật lý nghịch đảo bình phương thực — khoảng cách là bạn tốt nhất khi phân hạch!",
    "Switch to the DEX tab to see your rank widget. You start as New Creation with0 sao.": "Chuyển sang tab DEX để thấy hệm xếp hạng. Bạn bắt đầu là Tạo Mới với 0 sao.",
    "Earn stars by discovering new molecules. Each discovery awards stars based on complexity!": "Kiếm sao bằng cách khám phá phân tử mới. Mỗi khám phá thưởng sao theo độ phức tạp!",
    "Every 5 stars = 1 grade up. 5 grades = 1 rank up. There are 6 ranks total.": "Mỗi 5 sao = 1 hạng lên. 5 hạng = 1 cấp lên. Tổng cộng có 6 cấp.",
    "Higher ranks unlock more elements. New Creation gets H through Ca; Further Beyond gets all 118!": "Cấp cao hơn mở khóa nhiều nguyên tố hơn. Tạo Mới được H đến Ca; Vượt Xa Hơn được tất cả 118!",
    "The final rank, Further Beyond, has unlimited grades. Keep exploring to climb higher!": "Cấp cuối, Vượt Xa Hơn, có hạng không giới hạn. Hãy khám phá để leo cao hơn!",
    "Pull the rope on the left side to open the Shop. Spend stars to buy elements and features.": "Kéo dây thừng bên trái để mở Cửa hàng. Dùng sao để mua nguyên tố và tính năng.",
    "Be careful — spending stars can downgrade your rank if you fall below the threshold!": "Cẩn thận — tiêu sao có thể hạ cấp nếu bạn xuống dưới ngưỡng!",
    "The Format panel controls formal charges and the atom grid outline.": "Bảng Định dạng điều khiển điện tích hình thức và viền lười nguyên tử.",
    "Use +/−/Auto charge buttons to set ionic charges on selected atoms.": "Dùng nút điện tích +/−/Tự động để đặt điện tích ion cho nguyên tử được chọn.",
    "The Info tab shows molecule details: name, formula, geometry, molar mass, and bonds.": "Tab Thông tin hiển thị chi tiết phân tử: tên, công thức, hình học, khối lượng mol và liên kết.",
    "It also includes stoichiometry calculations and reaction kinetics charts!": "Nó cũng bao gồm tính toán hóa học và biểu đồ động học phản ứng!",
    "The Dex tab tracks all your discoveries and challenge progress.": "Tab Dex theo dõi tất cả khám phá và tiến độ thách thức.",
    "Use the Isomer Inspector to validate molecular arrangements — it checks structural formulas!": "Dùng Trình kiểm tra Đồng phân để xác nhận sắp xếp phân tử — nó kiểm tra công thức cấu tạo!",
    "Undo (Ctrl+Z) reverses your last action. Duplicate (Ctrl+D) copies selected atoms.": "Hoàn tác (Ctrl+Z) đảo ngược hành động cuối. Nhân đôi (Ctrl+D) sao chép nguyên tử được chọn.",
    "Delete removes selected atoms. Clear wipes the entire scene.": "Xóa loại bỏ nguyên tử được chọn. Dọn sạch toàn bộ cảnh.",
    "Mayhem mode enables chaotic reactions — explosions, lightning, and wild chemistry!": "Chế độ Hỗn loạn bật các phản ứng hỗn loạn — vỡ nổ, sét và hóa học dồi!",
    "The Console gives admin commands: setStars(), debugRank(), adminExport(), and more.": "Bảng điều khiển cung cấp lệnh admin: setStars(), debugRank(), adminExport() và hơn thế.",
    "Quest mode connects you to an AI assistant that gives challenges and answers chemistry questions.": "Chế độ Nhiệm vụ kết nối trợ lý AI đưa thách thức và trả lời câu hỏi hóa học.",
    "Multiplayer lets you host or join rooms via PeerJS. Build molecules together in real-time!": "Chơi nhiều người cho phép tạo hoặc tham gia phòng qua PeerJS. Xây phân tử cùng nhau thời gian thực!",
    "In multiplayer, you get voice chat, text chat, and shared world state synchronization.": "Trong chơi nhiều người, bạn có trò chuyện thoại, trò chuyện văn bản và đồng bộ trạng thái thế giới.",
    "Toggle between Survival (health + radiation) and Creative (unlimited, no danger) modes.": "Chuyển đổi giữa Sinh tồn (máu + bức xạ) và Sáng tạo (không giới hạn, không nguy hiểm).",
    "The main menu has all your settings and utilities.": "Menu chính có tất cả cài đặt và tiện ích.",
    "Toggle between Dark and Light themes.": "Chuyển đổi giữa giao diện Tối và Sáng.",
    "Switch language between English and Tiếng Việt.": "Chuyển ngôn ngữ giữa Tiếng Việt và English.",
    "Graphics quality: Low, Medium, High, or Ultra High. Adjust for your device!": "Chất lượng đồ họa: Thấp, Trung bình, Cao hoặc Cực cao. Điều chỉnh cho thiết bị của bạn!",
    "Low quality reduces particles and simplifies rendering. Ultra High enables all visual effects.": "Thấp giảm hạt và đơn giản hóa kỹ thuật rendering. Cực cao bật tất cả hiệu ứng thị giác.",
    "Export Progress saves your rank, discoveries, and settings to a JSON file.": "Xuất tiến độ lưu cấp, khám phá và cài đặt vào tệp JSON.",
    "Import Progress loads a saved file. Note: import is one-shot — you can only do it once!": "Nhập tiến độ tải tệp đã lưu. Lưu ý: nhập chỏ được một lần duy nhất!",
    "Replay this tutorial anytime from the menu.": "Phát lại hướng dẫn này bất cứ lúc nào từ menu.",
    "That's everything, {user}! You now know the full lab.": "Đó là tất cả, {user}! Bạn đã biết toàn bộ phòng thí nghiệm.",
    "Quick recap: drag elements to build, click bonds to upgrade, double-click for reactions.": "Tóm lại: kéo nguyên tố để xây, nhấn liên kết để nâng cấp, nhấn đôi để phản ứng.",
    "Watch out for radiation, control time and temperature, and unlock all 118 elements!": "Cẩn thận bức xạ, điều khiển thời gian và nhiệt độ, và mở khóa tất cả 118 nguyên tố!",
    "The lab is yours. Experiment, discover, and have fun, {user}!": "Phòng thí nghiệm là của bạn. Hãy thí nghiệm, khám phá và vui vẻ, {user}!",
    "Enter your name": "Nhập tên của bạn",
    "Continue": "Tiếp tục",
    "Waiting...": "Đang chờ...",
    "Finish": "Hoàn thành",
    "Next": "Tiếp",
    "Skip All": "Bỏ qua tất cả",
    "Tutorial complete! Welcome to the lab,": "Hoàn tất hướng dẫn! Chào mừng đến phòng thí nghiệm,"
  };

  function langVi() {
    var i18n = window.__mol3d && window.__mol3d.i18n;
    if (i18n && typeof i18n.getLang === 'function') return i18n.getLang() === 'vi';
    try { return localStorage.getItem('mol3d.lang') === 'vi'; } catch (e) { return false; }
  }

  function L(text) {
    if (!langVi()) return text;
    var direct = STR_VI[text];
    if (direct) return direct;
    for (var en in STR_VI) {
      if (text.indexOf(en) === 0) return STR_VI[en] + text.slice(en.length);
    }
    return text;
  }

  function showStatus(msg) {
    var el = document.getElementById('status-text');
    if (el) { el.textContent = msg; el.className = 'info'; }
  }

  function fmt(text) {
    return L(text).replace(/\{assistant\}/g, assistantName).replace(/\{user\}/g, userName);
  }

  function clearWait() {
    if (waitInterval) { clearInterval(waitInterval); waitInterval = null; }
  }

  function clearType() {
    if (typeInterval) { clearInterval(typeInterval); typeInterval = null; }
  }

  function shouldShow() { return !localStorage.getItem(TUTORIAL_KEY); }

  function createUI() {
    container = document.createElement('div');
    container.id = 'tut-container';
    container.className = 'tut-no-transition';

    dialogEl = document.createElement('div');
    dialogEl.id = 'tut-dialog';
    dialogEl.innerHTML = '<div class="tut-dialog-tail"></div><div class="tut-dialog-body" id="tut-body-text"></div><div class="tut-dialog-actions" id="tut-actions"></div>';

    assistantEl = document.createElement('div');
    assistantEl.id = 'tut-assistant';
    assistantEl.innerHTML = '<img class="tut-assistant-img" src="./assets/TutorialAssets/Assistant.gif" alt="ARIA" />';

    container.appendChild(dialogEl);
    container.appendChild(assistantEl);
    document.body.appendChild(container);

    assistantEl.addEventListener('pointerdown', function() {
      longPressTimer = setTimeout(function() { complete(); }, 600);
    });
    assistantEl.addEventListener('pointerup', function() { clearTimeout(longPressTimer); });
    assistantEl.addEventListener('pointerleave', function() { clearTimeout(longPressTimer); });

    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        container.classList.remove('tut-no-transition');
      });
    });
  }

  function destroyUI() {
    clearType();
    clearWait();
    clearTimeout(longPressTimer);
    hideHighlight();
    var dying = container;
    if (dying && dying.parentNode) {
      dying.classList.remove('tut-visible');
      dying.classList.add('tut-fade-out');
      setTimeout(function() { if (dying.parentNode) dying.remove(); }, 500);
    }
    if (spotlightRing && spotlightRing.parentNode) spotlightRing.remove();
    if (clickIndicator && clickIndicator.parentNode) clickIndicator.remove();
    container = assistantEl = dialogEl = spotlightRing = clickIndicator = null;
  }

  function positionContainer(targetSelector) {
    if (!container) return;
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    container.style.visibility = 'hidden';
    container.style.display = 'flex';
    var cw = container.offsetWidth;
    var ch = container.offsetHeight;
    var assistantH = assistantEl ? (assistantEl.offsetHeight || 56) : 56;
    container.style.visibility = '';
    if (targetSelector) {
      var target = document.querySelector(targetSelector);
      if (target) {
        var rect = target.getBoundingClientRect();
        var gap = 12;
        var spaceAbove = rect.top;
        var spaceBelow = vh - rect.bottom;
        var targetCX = rect.left + rect.width / 2;
        if (spaceAbove >= ch + gap + 10 || spaceAbove >= spaceBelow) {
          var topPos = Math.max(8, rect.top - gap - ch);
          container.style.top = topPos + 'px';
        } else {
          var topPos2 = rect.bottom + gap;
          if (topPos2 + ch > vh - 8) topPos2 = Math.max(8, vh - ch - 8);
          container.style.top = topPos2 + 'px';
        }
        var leftPos = Math.max(8, Math.min(targetCX - cw / 2, vw - cw - 8));
        container.style.left = leftPos + 'px';
        return;
      }
    }
    var assistantCenterY = vh * 0.62;
    var topCenter = Math.max(8, Math.min(assistantCenterY - assistantH - (ch - assistantH) / 2, vh - ch - 8));
    container.style.top = topCenter + 'px';
    var leftCenter = Math.max(8, Math.min((vw - cw) / 2, vw - cw - 8));
    container.style.left = leftCenter + 'px';
  }

  function typewriterWrite(element, text, speed, callback) {
    clearType();
    currentFullText = text;
    currentCharIndex = 0;
    element.textContent = '';
    typeInterval = setInterval(function() {
      if (currentCharIndex < currentFullText.length) {
        element.textContent += currentFullText.charAt(currentCharIndex);
        currentCharIndex++;
      } else {
        clearType();
        if (callback) callback();
      }
    }, speed || 22);
  }

  function skipTypewriter(element) {
    clearType();
    element.textContent = currentFullText;
    currentCharIndex = currentFullText.length;
  }

  function highlightTarget(selector) {
    var target = document.querySelector(selector);
    if (!target) { hideHighlight(); return; }
    var rect = target.getBoundingClientRect();
    var pad = 8;
    if (!spotlightRing) {
      spotlightRing = document.createElement('div');
      spotlightRing.id = 'tut-spotlight-ring';
      document.body.appendChild(spotlightRing);
    }
    spotlightRing.style.left = (rect.left - pad) + 'px';
    spotlightRing.style.top = (rect.top - pad) + 'px';
    spotlightRing.style.width = (rect.width + pad * 2) + 'px';
    spotlightRing.style.height = (rect.height + pad * 2) + 'px';
    spotlightRing.style.display = 'block';
    if (!clickIndicator) {
      clickIndicator = document.createElement('div');
      clickIndicator.id = 'tut-click-indicator';
      clickIndicator.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/></svg>';
      document.body.appendChild(clickIndicator);
    }
    clickIndicator.style.left = (rect.left + rect.width / 2 - 14) + 'px';
    clickIndicator.style.top = (rect.top - pad - 36) + 'px';
    clickIndicator.style.display = 'block';
    target.classList.add('tut-pulse-target');
    if (!resizeHandler) {
      resizeHandler = function() {
        if (!tutorialActive) return;
        var cur = PHASES[phase] && PHASES[phase].steps[step];
        if (cur) {
          if (cur.target) highlightTarget(cur.target);
          positionContainer(cur.target || null);
        }
      };
      window.addEventListener('resize', resizeHandler);
    }
  }

  function hideHighlight() {
    if (spotlightRing) spotlightRing.style.display = 'none';
    if (clickIndicator) clickIndicator.style.display = 'none';
    document.querySelectorAll('.tut-pulse-target').forEach(function(el) { el.classList.remove('tut-pulse-target'); });
    if (resizeHandler) { window.removeEventListener('resize', resizeHandler); resizeHandler = null; }
  }

  function setBodyText(text) {
    var body = dialogEl.querySelector('#tut-body-text');
    if (body) body.textContent = text;
  }

  function setActions(html) {
    var actions = dialogEl.querySelector('#tut-actions');
    if (actions) actions.innerHTML = html;
  }

  function getPhaseLabel() {
    return (phase + 1) + '/' + PHASES.length + ' \u00b7 ' + PHASES[phase].name;
  }

  function buildActionsHTML(extra) {
    return '<button class="tut-btn tut-btn-skip" id="tut-skip-btn">' + L('Skip All') + '</button>' +
      '<span class="tut-phase-label">' + getPhaseLabel() + '</span>' +
      (extra || '<button class="tut-btn" id="tut-next-btn">' + L('Next') + '</button>');
  }

  function wireNextBtn(s) {
    var btn = document.getElementById('tut-next-btn');
    if (btn) {
      btn.addEventListener('click', function() {
        if (s.action === 'highlight' && s.target) {
          var tgt = document.querySelector(s.target);
          if (tgt) tgt.click();
        }
        advance();
      });
    }
  }

  function wireSkipBtn() {
    var btn = document.getElementById('tut-skip-btn');
    if (btn) btn.addEventListener('click', complete);
  }

  function renderStep() {
    if (phase >= PHASES.length) { complete(); return; }
    var p = PHASES[phase];
    var s = p.steps[step];
    if (!s) { nextPhase(); return; }
    var text = fmt(s.text);
    var isWaiting = s.action === 'waitForSpawn';
    var isComplete = s.action === 'complete';
    var isNameInput = s.action === 'nameInput';
    setBodyText(text);
    if (s.target) {
      setTimeout(function() { highlightTarget(s.target); }, 50);
    } else {
      hideHighlight();
    }
    positionContainer(s.target || null);
    container.classList.add('tut-visible');
    var bodyEl = dialogEl.querySelector('#tut-body-text');
    var actionsEl = dialogEl.querySelector('#tut-actions');
    if (isNameInput) {
      typewriterWrite(bodyEl, text, 20, function() {
        setActions('<input type="text" class="tut-name-input" id="tut-name-input" placeholder="' + L('Enter your name') + '" value="' + userName + '" /><button class="tut-btn" id="tut-continue-btn">' + L('Continue') + '</button>');
        var input = document.getElementById('tut-name-input');
        var contBtn = document.getElementById('tut-continue-btn');
        if (input) input.focus();
        if (contBtn) {
          contBtn.addEventListener('click', function() {
            if (input && input.value.trim()) {
              userName = input.value.trim();
              localStorage.setItem(USER_NAME_KEY, userName);
            }
            advance();
          });
        }
        if (input) {
          input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') contBtn.click();
          });
        }
      });
    } else if (isWaiting) {
      typewriterWrite(bodyEl, text, 20, function() {
        setActions('<button class="tut-btn tut-btn-wait" id="tut-next-btn" disabled>' + L('Waiting...') + '</button>');
        waitForAction(s.threshold);
      });
    } else if (isComplete) {
      typewriterWrite(bodyEl, text, 20, function() {
        setActions('<button class="tut-btn tut-btn-finish" id="tut-next-btn">' + L('Finish') + '</button>');
        document.getElementById('tut-next-btn').addEventListener('click', complete);
      });
    } else {
      typewriterWrite(bodyEl, text, 20, function() {
        setActions(buildActionsHTML());
        wireNextBtn(s);
        wireSkipBtn();
      });
    }
    dialogEl.onclick = function(e) {
      if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
      if (typeInterval) {
        skipTypewriter(bodyEl);
        if (!isNameInput && !isWaiting && !isComplete) {
          if (!actionsEl.querySelector('#tut-next-btn')) {
            setActions(buildActionsHTML());
            wireNextBtn(s);
            wireSkipBtn();
          }
        } else if (isComplete && !actionsEl.querySelector('#tut-next-btn')) {
          setActions('<button class="tut-btn tut-btn-finish" id="tut-next-btn">' + L('Finish') + '</button>');
          document.getElementById('tut-next-btn').addEventListener('click', complete);
        }
      }
    };
  }

  function waitForAction(threshold) {
    clearWait();
    var needed = threshold || 1;
    waitInterval = setInterval(function() {
      if (window.__mol3d && window.__mol3d.atoms && window.__mol3d.atoms.size >= needed) {
        clearWait();
        var btn = document.getElementById('tut-next-btn');
        if (btn) {
          btn.disabled = false;
          btn.classList.remove('tut-btn-wait');
          btn.textContent = L('Next');
          btn.addEventListener('click', advance);
        }
      }
    }, 300);
  }

  function advance() {
    step++;
    if (step >= PHASES[phase].steps.length) nextPhase();
    else renderStep();
  }

  function nextPhase() {
    phase++;
    step = 0;
    if (phase >= PHASES.length) complete();
    else renderStep();
  }

  function complete() {
    localStorage.setItem(TUTORIAL_KEY, 'true');
    tutorialActive = false;
    destroyUI();
    showStatus(L('Tutorial complete! Welcome to the lab,') + ' ' + userName + '!');
  }

  function start() {
    if (tutorialActive) return;
    tutorialActive = true;
    phase = 0;
    step = 0;
    createUI();
    renderStep();
  }

  function replay() {
    localStorage.removeItem(TUTORIAL_KEY);
    clearWait();
    if (container && container.parentNode) container.remove();
    container = assistantEl = dialogEl = null;
    tutorialActive = false;
    phase = 0;
    step = 0;
    start();
  }

  function injectStyles() {
    if (document.getElementById('tut-styles-v6')) return;
    var s = document.createElement('style');
    s.id = 'tut-styles-v6';
    s.textContent = [
      '#tut-container {',
      '  position:fixed; z-index:9999;',
      '  display:flex; flex-direction:column; align-items:center;',
      '  gap:0; pointer-events:none;',
      '  visibility:hidden;',
      '  transition: left 0.65s cubic-bezier(0.34,1.56,0.64,1),',
      '              top 0.65s cubic-bezier(0.34,1.56,0.64,1),',
      '              opacity 0.45s ease;',
      '  opacity:0;',
      '}',
      '#tut-container.tut-no-transition { transition:none !important; }',
      '#tut-container.tut-visible { opacity:1; visibility:visible; }',
      '#tut-container.tut-fade-out { opacity:0; visibility:hidden; pointer-events:none; }',
      '#tut-dialog {',
      '  position:relative; pointer-events:auto;',
      '  background:linear-gradient(145deg, rgba(8,14,30,0.96), rgba(12,20,40,0.94));',
      '  border:1px solid rgba(0,212,255,0.25);',
      '  border-radius:18px;',
      '  padding:clamp(12px,2.5vw,18px) clamp(14px,3vw,20px);',
      '  width:clamp(240px,70vw,420px); max-width:calc(100vw - 24px);',
      '  box-shadow:0 12px 40px rgba(0,0,0,0.7), 0 0 1px rgba(0,212,255,0.4), 0 0 30px rgba(0,212,255,0.06);',
      '  display:flex; flex-direction:column; gap:10px;',
      '  font-family:"Segoe UI",system-ui,-apple-system,sans-serif;',
      '  backdrop-filter:blur(16px);',
      '  animation:tutDialogIn 0.3s cubic-bezier(0.16,1,0.3,1);',
      '}',
      '@keyframes tutDialogIn { from { opacity:0; transform:scale(0.95); } to { opacity:1; transform:scale(1); } }',
      '.tut-dialog-tail {',
      '  position:absolute; bottom:-9px; left:50%; transform:translateX(-50%);',
      '  width:0; height:0;',
      '  border-left:9px solid transparent; border-right:9px solid transparent;',
      '  border-top:9px solid rgba(10,17,35,0.96);',
      '}',
      '.tut-dialog-body {',
      '  color:rgba(224,240,255,0.95); font-size:clamp(12px,2.5vw,14px);',
      '  line-height:1.55; min-height:1.6em; word-wrap:break-word;',
      '}',
      '.tut-dialog-actions {',
      '  display:flex; gap:8px; justify-content:space-between; align-items:center;',
      '  padding-top:2px; flex-wrap:wrap;',
      '}',
      '.tut-phase-label {',
      '  font-size:10px; color:rgba(0,212,255,0.5); letter-spacing:1px; text-transform:uppercase;',
      '  flex:1; text-align:center; pointer-events:none;',
      '}',
      '.tut-btn {',
      '  padding:clamp(6px,1.2vw,8px) clamp(14px,2.5vw,20px);',
      '  background:linear-gradient(135deg, rgba(0,212,255,0.15), rgba(0,255,136,0.08));',
      '  border:1px solid rgba(0,212,255,0.35);',
      '  border-radius:8px; color:#00d4ff; font-weight:600; cursor:pointer;',
      '  font-size:clamp(11px,2vw,12px); transition:all 0.25s cubic-bezier(0.4,0,0.2,1);',
      '  letter-spacing:0.5px; text-transform:uppercase; pointer-events:auto;',
      '}',
      '.tut-btn:hover {',
      '  background:linear-gradient(135deg, rgba(0,212,255,0.25), rgba(0,255,136,0.15));',
      '  border-color:rgba(0,212,255,0.6); box-shadow:0 0 14px rgba(0,212,255,0.2);',
      '  transform:translateY(-1px);',
      '}',
      '.tut-btn:active { transform:translateY(0); }',
      '.tut-btn-wait { opacity:0.35; cursor:not-allowed; transform:none !important; box-shadow:none !important; }',
      '.tut-btn-skip {',
      '  background:transparent; border-color:rgba(255,255,255,0.15); color:rgba(255,255,255,0.4);',
      '  font-size:10px; padding:4px 10px;',
      '}',
      '.tut-btn-skip:hover { border-color:rgba(255,255,255,0.3); color:rgba(255,255,255,0.6); box-shadow:none !important; }',
      '.tut-btn-finish {',
      '  background:linear-gradient(135deg, rgba(0,255,136,0.15), rgba(0,212,255,0.08));',
      '  border-color:rgba(0,255,136,0.4); color:#00ff88;',
      '}',
      '.tut-btn-finish:hover {',
      '  background:linear-gradient(135deg, rgba(0,255,136,0.25), rgba(0,212,255,0.15));',
      '  border-color:rgba(0,255,136,0.6); box-shadow:0 0 14px rgba(0,255,136,0.2);',
      '}',
      '.tut-name-input {',
      '  flex:1; min-width:100px;',
      '  padding:clamp(6px,1.2vw,8px) clamp(10px,2vw,12px);',
      '  background:rgba(0,20,40,0.6); border:1px solid rgba(0,212,255,0.2);',
      '  border-radius:8px; color:#e0f0ff; font-size:clamp(11px,2vw,13px);',
      '  outline:none; transition:border-color 0.2s, box-shadow 0.2s;',
      '  pointer-events:auto;',
      '}',
      '.tut-name-input:focus { border-color:rgba(0,212,255,0.5); box-shadow:0 0 10px rgba(0,212,255,0.12); }',
      '#tut-assistant {',
      '  display:flex; flex-direction:column; align-items:center;',
      '  pointer-events:auto; cursor:pointer; margin-top:4px;',
      '  animation:tutAssistantBob 3s ease-in-out infinite;',
      '}',
      '@keyframes tutAssistantBob {',
      '  0%,100% { transform:translateY(0); }',
      '  50% { transform:translateY(-5px); }',
      '}',
      '.tut-assistant-img {',
      '  width:clamp(44px,9vw,56px); height:clamp(44px,9vw,56px);',
      '  border-radius:50%; object-fit:cover;',
      '  border:2px solid rgba(0,212,255,0.5);',
      '  box-shadow:0 0 16px rgba(0,212,255,0.35), 0 0 4px rgba(0,255,136,0.2);',
      '  transition:transform 0.2s, box-shadow 0.2s;',
      '}',
      '#tut-assistant:hover .tut-assistant-img {',
      '  transform:scale(1.08);',
      '  box-shadow:0 0 24px rgba(0,212,255,0.5), 0 0 6px rgba(0,255,136,0.3);',
      '}',
      '#tut-spotlight-ring {',
      '  position:fixed; border:2px solid #00d4ff; border-radius:12px;',
      '  box-shadow:0 0 20px #00d4ff, 0 0 40px rgba(0,212,255,0.3), inset 0 0 16px rgba(0,212,255,0.1);',
      '  z-index:9997; pointer-events:none; display:none;',
      '  transition:all 0.35s cubic-bezier(0.4,0,0.2,1);',
      '  animation:tutRingPulse 2s ease-in-out infinite;',
      '}',
      '#tut-click-indicator {',
      '  position:fixed; z-index:9997; pointer-events:none; display:none;',
      '  color:#00d4ff; animation:tutBounce 1.2s ease-in-out infinite;',
      '  filter:drop-shadow(0 0 8px rgba(0,212,255,0.8));',
      '}',
      '@keyframes tutRingPulse {',
      '  0%,100% { box-shadow:0 0 20px #00d4ff, 0 0 40px rgba(0,212,255,0.3), inset 0 0 16px rgba(0,212,255,0.1); }',
      '  50% { box-shadow:0 0 30px #00d4ff, 0 0 60px rgba(0,212,255,0.45), inset 0 0 24px rgba(0,212,255,0.18); }',
      '}',
      '@keyframes tutBounce {',
      '  0%,100% { transform:translateY(0); opacity:1; }',
      '  50% { transform:translateY(8px); opacity:0.6; }',
      '}',
      '@keyframes tutPulseTarget {',
      '  0%,100% { box-shadow:0 0 0 0 rgba(0,212,255,0.5); }',
      '  50% { box-shadow:0 0 0 12px rgba(0,212,255,0); }',
      '}',
      '.tut-pulse-target { animation:tutPulseTarget 1.8s ease-in-out infinite !important; }'
    ].join('\n');
    document.head.appendChild(s);
  }

  function init() {
    injectStyles();
    var tutorialBtn = document.getElementById('btn-tutorial');
    if (tutorialBtn) {
      tutorialBtn.addEventListener('click', function() {
        replay();
        var menu = document.getElementById('menu-dropdown');
        if (menu) menu.hidden = true;
      });
    }
    window.addEventListener('mol3d:lang', function() {
      if (!tutorialActive || !container) return;
      renderStep();
    });
    window.__tutorial = {
      start: start,
      replay: replay,
      isActive: function() { return tutorialActive; },
      shouldShow: shouldShow
    };
    setTimeout(function() { if (shouldShow()) start(); }, 2000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
