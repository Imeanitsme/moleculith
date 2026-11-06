// How to Play - the guide button that lives next to the shop rope.
// Every number in the panel is read from the live shop/rank APIs, so the guide
// can never drift away from the prices a player is actually charged.
(function () {
  'use strict';

  var SECTIONS = ['about', 'build', 'react', 'stars', 'shop', 'modes', 'keys'];

  var STR = {
    en: {
      tab: 'How to Play',
      title: 'How to Play',
      subtitle: 'MOLECULITH',
      balance: 'Balance',
      rank: 'Rank',
      close: 'Close',
      about: 'What is this?',
      build: 'Build & interact',
      react: 'Reactions',
      stars: 'Stars & rank',
      shop: 'Rope Shop',
      modes: 'Modes & health',
      keys: 'Controls',
      lead: {
        about: 'A 3D sandbox where you build real molecules and the game checks them against actual chemistry. Nothing here is canned animation: shapes, bonds, reactions and decay are all calculated.',
        build: 'Atoms are physical objects. Everything you do to them has a chemical consequence.',
        react: 'Select two or more molecules, choose a condition, and the engine balances the equation before anything moves.',
        stars: 'Stars are your only currency. They rank you up and they pay for everything in the shop.',
        shop: 'The rope at the top of the screen is the shop. Pull it, or press the ? button beside it.',
        modes: 'Two ways to play the same world.'
      },
      rows: {
        discovery: 'Discover a new molecule',
        daily: 'Daily reward (streak)',
        quest: 'Finish a quest',
        spend: 'Buy anything in the shop',
        grade: 'Stars per grade',
        grades: 'Grades per rank',
        lastRank: 'The final rank never ends',
        freeEls: 'Elements you always own',
        elementTier: 'Element pack',
        feature: 'Feature',
        dynTitle: 'Percent pricing',
        dynEach: 'each item now costs a share of your balance',
        upTo: 'up to Z =',
        owned: 'owned',
        locked: 'locked'
      },
      bullets: {
        about: [
          'Drag elements from the pool, bond them, and the app solves the 3D shape with VSEPR.',
          'Reactions run on real rules: solubility, redox half-equations, pKa, organic mechanisms.',
          'Everything you stabilise is logged in the Discoveries panel and can be spawned back later.',
          'There is a first-visit tutorial, and the INFO tab holds a full science guide for the theory.'
        ],
        build: [
          'Drag an element chip from the pool onto the scene: the atom lands exactly where you drop it.',
          'Drag one atom onto another to bond them. The ghost line is green when the bond is legal and red when chemistry forbids it.',
          'Click an existing bond to cycle its order: single, double, triple, then back down to single, and one more click deletes it.',
          'Click an atom to inspect it, right-click (or long-press) to remove it.',
          'Locked elements show a padlock. Dragging one tells you where to buy it instead of placing it.',
          'Double-click two or more molecules to mark them for a reaction; the reaction panel then offers the conditions that actually work.'
        ],
        react: [
          'Every reaction keeps the atom count and the total charge identical on both sides. If a product could not be built, the reactants are left untouched.',
          'Conditions include room temperature, heat, spark, electricity, UV, catalyst and light. The panel only lists the ones valid for your exact selection.',
          'Products scatter apart and drift on their own; the largest molecule stays at the reaction centre.',
          'Unstable molecules decay over time on real kinetics, and molecules in air react with the atmosphere as an extra reactant.',
          'Stray unbonded atoms keep hunting for partners and fill their octet before they settle.',
          'SafeMode blocks reactions you would not survive in a real lab; it re-checks the scene the moment you turn it on.'
        ],
        stars: [
          'Your star total is simultaneously your rank and your wallet, so a big purchase can drop you a grade.',
          'There is no command, cheat or shortcut that grants stars at no cost.',
          'Rank-ups unlock nothing by themselves. They are a badge of progress; the shop sells the actual access.'
        ],
        shop: [
          'Pull the cord (or press the ? button next to it) to open the shop; the panel slides down from the rope.',
          'Elements are sold in packs by atomic number. Anything up to Z = 20 is free forever, and each pack opens the range above it.',
          'Features are sold individually: X-ray vision, the proton gun, time control, time stop, Mayhem reactions and the Developer Console.',
          'Above 2000 stars, prices stop being fixed and become a share of your balance, so stars keep a use late in the game.',
          'The Console costs 2000 stars and never goes below that, however rich you are.'
        ],
        modes: [
          'Creative: free flying camera, no health, no death, orbit controls always available.',
          'Survival: first-person walk with gravity, health bar, and radiation damage from unstable nuclei and reaction blasts.',
          'The mode button in the menu switches between them; the label always shows the mode you are in.',
          'In Survival you respawn at full health; anything that killed you is still in the scene, so move away first.',
          'Radioactive elements (Z above 82) decay toward lead, breaking bonds and releasing explosions as they go.'
        ],
        keys: [
          'W A S D or arrow keys: move. Q / E: down / up. Shift: sprint.',
          'Mouse drag on empty space: orbit the camera. Wheel: zoom.',
          'Ctrl+Z: undo the last change, including whole reactions.',
          'Esc: close the panel you have open.',
          'Touch: joystick bottom-left, look-by-drag on the scene, long-press to remove.'
        ]
      },
      tipWord: 'Tip',
      tips: {
        about: 'The INFO tab and the first-visit tutorial go deeper — this panel only explains how the game works.',
        build: 'Bonds are refused, not faked: if the ghost line turns red, that molecule cannot exist.',
        react: 'A reaction that cannot be balanced is refused outright and leaves the reactants untouched.',
        stars: 'Spend carefully — the same stars are your rank, so a big purchase can demote you.',
        shop: 'The shop only opens from the rope; the ? button is a shortcut to the same panel.',
        modes: 'In Survival the hazards are the chemistry itself: radiation, blasts and hot reactions.',
        keys: 'On a phone the bottom tabs hold the same panels and the joystick replaces WASD.'
      }
    },
    vi: {
      tab: 'Cách chơi',
      title: 'Cách Chơi',
      subtitle: 'PHÂN TỬ SỐ',
      balance: 'Số dư',
      rank: 'Hạng',
      close: 'Đóng',
      about: 'Trò này là gì?',
      build: 'Lắp ráp & tương tác',
      react: 'Phản ứng',
      stars: 'Sao & hạng',
      shop: 'Cửa hàng Dây thừng',
      modes: 'Chế độ & máu',
      keys: 'Điều khiển',
      lead: {
        about: 'Một thế giới 3D nơi bạn lắp các phân tử thật và trò chơi đối chiếu chúng với hóa học thực. Không có gì ở đây là hiệu ứng sắp sẵn: hình dạng, liên kết, phản ứng và phân rã đều được tính toán.',
        build: 'Nguyên tử là vật thể thật. Mỗi thao tác của bạn đều kéo theo hệ quả hóa học.',
        react: 'Chọn hai hay nhiều phân tử, chọn điều kiện, và bộ máy sẽ cân bằng phương trình trước khi bất cứ gì dịch chuyển.',
        stars: 'Sao là đơn vị tiền tệ duy nhất. Sao thăng hạng cho bạn và cũng trả tiền cho mọi thứ trong cửa hàng.',
        shop: 'Sợi dây trên đỉnh màn hình chính là cửa hàng. Kéo nó, hoặc bấm nút ? bên cạnh.',
        modes: 'Hai cách chơi trên cùng một thế giới.'
      },
      rows: {
        discovery: 'Khám phá phân tử mới',
        daily: 'Phần thưởng hằng ngày (chuỗi ngày)',
        quest: 'Hoàn thành nhiệm vụ',
        spend: 'Mua bất cứ gì trong cửa hàng',
        grade: 'Sao mỗi bậc',
        grades: 'Số bậc mỗi hạng',
        lastRank: 'Hạng cuối không có điểm dừng',
        freeEls: 'Nguyên tố luôn thuộc về bạn',
        elementTier: 'Gói nguyên tố',
        feature: 'Tính năng',
        dynTitle: 'Giá theo phần trăm',
        dynEach: 'mỗi món giờ tốn một phần số dư của bạn',
        upTo: 'tới Z =',
        owned: 'đã sở hữu',
        locked: 'chưa mua'
      },
      bullets: {
        about: [
          'Kéo nguyên tố từ khay, liên kết chúng lại, trò chơi tự giải hình dạng 3D theo thuyết VSEPR.',
          'Phản ứng chạy theo luật thật: độ tan, phương trình nửa oxi hóa - khử, pKa, cơ chế hóa hữu cơ.',
          'Mọi phân tử ổn định đều được ghi vào sổ Khám phá và có thể gọi lại bất cứ lúc nào.',
          'Có phần hướng dẫn lần đầu, và tab INFO chứa trọn bộ cẩm nang khoa học về lý thuyết.'
        ],
        build: [
          'Kéo một ô nguyên tố từ khay thả vào khung cảnh: nguyên tử nằm đúng chỗ bạn thả.',
          'Kéo nguyên tử này vào nguyên tử khác để tạo liên kết. Đường ghost màu xanh lục khi liên kết hợp lệ, màu đỏ khi hóa học cấm.',
          'Bấm vào liên kết có sẵn để đổi bậc liên kết: đơn, đôi, ba, rồi ngược lại về đơn, thêm một lần bấm nữa sẽ xóa nó.',
          'Bấm vào nguyên tử để xem chi tiết; chuột phải (hoặc nhấn giữ) để xóa.',
          'Nguyên tố bị khóa hiển thị ổ khóa. Kéo thử sẽ cho biết nơi mua thay vì thả nguyên tử vào.',
          'Nháy đúp hai hay nhiều phân tử để đánh dấu phản ứng; bảng phản ứng sau đó chỉ liệt kê những điều kiện thật sự dùng được.'
        ],
        react: [
          'Mọi phản ứng giữ nguyên số nguyên tử và tổng điện tích hai bên. Nếu không dựng được sản phẩm, chất phản ứng được giữ nguyên.',
          'Điều kiện gồm: nhiệt độ phòng, đun nóng, tia lửa, điện phân, tia UV, xúc tác và ánh sáng. Bảng chỉ liệt kê điều kiện đúng với lựa chọn của bạn.',
          'Sản phẩm văng ra xa và tự trôi; phân tử lớn nhất ở lại tâm phản ứng.',
          'Phân tử không bền tự phân rã theo động học thật, và trong không khí thì khí quyển tham gia như một chất phản ứng bổ sung.',
          'Nguyên tử lẻ loi tiếp tục tìm bạn liên kết và lấp đủ lớp octet trước khi ổn định.',
          'Chế độ An toàn chặn những phản ứng mà ngoài đời bạn không trụ nổi; vừa bật là nó kiểm tra lại cả khung cảnh.'
        ],
        stars: [
          'Tổng sao vừa là hạng vừa là ví tiền của bạn, nên một món lớn có thể khiến bạn tụt bậc.',
          'Không có lệnh, cheat hay đường tắt nào tặng sao mà không mất giá.',
          'Lên hạng tự nó không mở khóa gì cả. Đó là tấm huy chương tiến bộ; cửa hàng mới bán quyền dùng thật.'
        ],
        shop: [
          'Kéo sợi dây (hoặc bấm nút ? cạnh dây) để mở cửa hàng; bảng sẽ trượt xuống theo dây.',
          'Nguyên tố bán theo gói tính theo số hiệu nguyên tử. Mọi thứ tới Z = 20 miễn phí vĩnh viễn, mỗi gói mở thêm dải phía trên.',
          'Tính năng bán lẻ: Tia X, Súng proton, Tăng tốc thời gian, Đóng băng thời gian, Phản ứng hỗn loạn và Console lập trình viên.',
          'Trên 2000 sao, giá không còn cố định mà trở thành một phần số dư của bạn, để sao vẫn có đất dùng về cuối game.',
          'Console lập trình viên luôn giá 2000 sao và không bao giờ rẻ hơn, dù bạn giàu tới đâu.'
        ],
        modes: [
          'Sáng tạo: camera bay tự do, không máu, không chết, luôn có orbit.',
          'Sống còn: đi góc nhìn thứ nhất có trọng lực, có thanh máu, và nhiễm xạ từ hạt nhân không bền cùng vụ nổ phản ứng.',
          'Nút chế độ trong menu chuyển qua lại; nhãn luôn hiển thị chế độ bạn đang ở.',
          'Ở Sống còn bạn hồi sinh đầy máu; thứ đã giết bạn vẫn còn trong khung cảnh, nên hãy tránh ra trước.',
          'Nguyên tố phóng xạ (Z trên 82) phân rã về chì, làm đứt liên kết và sinh vụ nổ trên đường đi.'
        ],
        keys: [
          'W A S D hoặc phím mũi tên: di chuyển. Q / E: xuống / lên. Shift: chạy nhanh.',
          'Kéo chuột trên vùng trống: xoay camera. Con lăn: thu phóng.',
          'Ctrl+Z: hoàn tác thay đổi cuối, kể cả toàn bộ một phản ứng.',
          'Esc: đóng bảng đang mở.',
          'Cảm ứng: cần ảo góc dưới trái, kéo để nhìn trên khung cảnh, nhấn giữ để xóa.'
        ]
      },
      tipWord: 'Mẹo',
      tips: {
        about: 'Tab INFO và phần hướng dẫn lần đầu đi sâu hơn — bảng này chỉ giải thích cách trò chơi vận hành.',
        build: 'Liên kết bị từ chối chứ không giả vờ: đường ghost đỏ nghĩa là phân tử đó không tồn tại được.',
        react: 'Phản ứng không cân bằng được sẽ bị hủy ngay, và các chất tham gia giữ nguyên vị trí.',
        stars: 'Chi tiêu cẩn thận — số sao cũng là hạng của bạn, nên một cú mua lớn có thể làm bạn rớt bậc.',
        shop: 'Cửa hàng chỉ mở từ sợi dây; nút ? chỉ là lối tắt tới đúng bảng đó.',
        modes: 'Trong chế độ Sống còn, mối nguy chính là hóa học: nhiễm xạ, vụ nổ và phản ứng tỏa nhiệt.',
        keys: 'Trên điện thoại, các tab dưới đáy chứa cùng những bảng này và cần ảo thay cho WASD.'
      }
    }
  };

  var rig = null, btn = null, overlay = null, openSection = 'about', lastLang = null;

  function shop() { return window.__mol3dShop || null; }
  function api() { return window.__mol3d || null; }

  function lang() {
    var a = api();
    var l = a && a.i18n ? a.i18n.getLang() : 'en';
    return l === 'vi' ? 'vi' : 'en';
  }

  function S() { return STR[lang()]; }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // Star curve derived from the live rank manager rather than hardcoded, so the
  // guide follows the game if the economy is retuned.
  function starCurve() {
    var a = api();
    var rm = a && a.progression ? a.progression.rankManager : null;
    var perGrade = 5, total = 0, rank = null;
    try {
      rank = rm.getCurrentRank();
      total = rank.totalStars;
      perGrade = rank.starsInGrade + rank.nextGradeStars || 5;
    } catch (e) { /* fall back to the documented default */ }
    return { perGrade: perGrade, total: total, rank: rank };
  }

  function bulletList(items) {
    return '<ul class="htp-list">' + items.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul>';
  }

  function row(label, value, cls) {
    return '<div class="htp-row' + (cls ? ' ' + cls : '') + '"><span>' + esc(label) + '</span><b>' + value + '</b></div>';
  }

  function sectionAbout() {
    var s = S();
    return '<p class="htp-lead">' + esc(s.lead.about) + '</p>' + bulletList(s.bullets.about);
  }

  function sectionBuild() {
    var s = S();
    return '<p class="htp-lead">' + esc(s.lead.build) + '</p>' + bulletList(s.bullets.build);
  }

  function sectionReact() {
    var s = S();
    return '<p class="htp-lead">' + esc(s.lead.react) + '</p>' + bulletList(s.bullets.react);
  }

  function sectionStars() {
    var s = S();
    var curve = starCurve();
    var a = api();
    var ranks = a && a.progression ? a.progression.ranks() : [];
    var rows = '';
    rows += row(s.rows.discovery, '+1 ★');
    rows += row(s.rows.daily, '+1…+5 ★');
    rows += row(s.rows.quest, '+1…+5 ★');
    rows += row(s.rows.spend, '−★', 'htp-neg');
    rows += '<div class="htp-sep"></div>';
    rows += row(s.rows.grade, curve.perGrade + ' ★');
    var ladder = ranks.map(function (r) {
      var g = r.grades === Infinity ? '∞' : r.grades;
      var label = lang() === 'vi' && r.vi ? r.vi : r.name;
      return '<span class="htp-pip">' + esc(label) + ' <i>' + g + '</i></span>';
    }).join('<span class="htp-arrow">→</span>');
    rows += '<div class="htp-ladder">' + ladder + '</div>';
    rows += '<div class="htp-sep"></div>';
    rows += row(s.rows.lastRank, '✓', 'htp-own');
    return '<p class="htp-lead">' + esc(s.lead.stars) + '</p>' +
      '<div class="htp-table">' + rows + '</div>' + bulletList(s.bullets.stars);
  }

  // Names mirror the shop's own labels so the guide and the price list never read
  // differently; the shop does not publish them through its API.
  var FEAT_NAMES = {
    en: {
      xray: 'X-Ray Vision', proton: 'Proton Gun', timeSpeed: 'Time Acceleration',
      timeStop: 'Time Stop', mayhem: 'Mayhem Reactions', console: 'Developer Console'
    },
    vi: {
      xray: 'Tia X', proton: 'Súng proton', timeSpeed: 'Tăng tốc thời gian',
      timeStop: 'Đóng băng thời gian', mayhem: 'Phản ứng hỗn loạn', console: 'Console lập trình viên'
    }
  };

  function sectionShop() {
    var s = S();
    var sh = shop();
    if (!sh || !sh.catalogue) return '<p class="htp-lead">' + esc(s.lead.shop) + '</p>';
    var cat = sh.catalogue;
    var names = FEAT_NAMES[lang()];
    var rows = row(s.rows.freeEls, 'Z 1–' + cat.freeMaxZ, 'htp-own');
    rows += '<div class="htp-sep"></div>';
    rows += '<div class="htp-group">' + esc(s.rows.elementTier) + '</div>';
    cat.tiers.slice(1).forEach(function (t, i) {
      rows += row('Z ' + (cat.tiers[i].maxZ + 1) + '–' + t.maxZ, sh.priceOf(t.price) + ' ★');
    });
    rows += '<div class="htp-sep"></div>';
    rows += '<div class="htp-group">' + esc(s.rows.feature) + '</div>';
    cat.features.forEach(function (f) {
      var owned = sh.ownsFeature(f.id);
      var label = names[f.id] || f.id;
      rows += row(label, owned ? esc(s.rows.owned) : sh.priceOf(f.price, f.min) + ' ★', owned ? 'htp-own' : '');
    });
    if (sh.isDynamic()) {
      rows += '<div class="htp-note">' + esc(s.rows.dynTitle) + ' · ' + esc(s.rows.dynEach) + '</div>';
    }
    return '<p class="htp-lead">' + esc(s.lead.shop) + '</p>' +
      '<div class="htp-table">' + rows + '</div>' + bulletList(s.bullets.shop);
  }

  function sectionModes() {
    var s = S();
    return '<p class="htp-lead">' + esc(s.lead.modes) + '</p>' + bulletList(s.bullets.modes);
  }

  function sectionKeys() {
    var s = S();
    return bulletList(s.bullets.keys);
  }

  var RENDERERS = {
    about: sectionAbout, build: sectionBuild, react: sectionReact,
    stars: sectionStars, shop: sectionShop, modes: sectionModes, keys: sectionKeys
  };

  function icon(name, fallback) {
    return '<i data-lucide="' + name + '" class="htp-icon">' + esc(fallback) + '</i>';
  }

  var ICONS = {
    about: ['flask-conical', '⚗'], build: ['hand', '✋'], react: ['zap', '⚡'],
    stars: ['star', '★'], shop: ['shopping-bag', '🛍'], modes: ['shield', '🛡'], keys: ['keyboard', '⌨']
  };

  function bodyHtml() {
    var s = S();
    var tip = s.tips[openSection] || s.tips.about;
    var tabs = SECTIONS.map(function (id) {
      var label = esc(s[id]);
      return '<button type="button" class="htp-tab' + (id === openSection ? ' on' : '') + '" data-sec="' + id +
        '" role="tab" aria-selected="' + (id === openSection) + '" title="' + label + '" aria-label="' + label + '">' +
        icon(ICONS[id][0], ICONS[id][1]) + '<span>' + label + '</span></button>';
    }).join('');
    return '<div class="htp-tabs" role="tablist">' + tabs + '</div>' +
      '<div class="htp-body" id="htp-body">' + RENDERERS[openSection]() +
      '<p class="htp-tip"><b>' + esc(s.tipWord) + '</b> · ' + esc(tip) + '</p></div>';
  }

  function headHtml() {
    var s = S();
    var sh = shop();
    var bal = sh ? sh.balance() : 0;
    var rankLabel = sh && sh.rankLabel ? sh.rankLabel() : '';
    return '<div class="htp-head">' +
      '<div class="htp-title-wrap"><span class="htp-title">' + esc(s.title) + '</span>' +
      '<span class="htp-subtitle">' + esc(s.subtitle) + '</span></div>' +
      '<span class="htp-chip">' + esc(s.rank) + ' <b>' + esc(rankLabel) + '</b></span>' +
      '<span class="htp-chip htp-balance">' + bal + ' ★</span>' +
      '<button type="button" class="htp-close" aria-label="' + esc(s.close) + '">×</button></div>';
  }

  function paint() {
    if (!overlay) return;
    overlay.innerHTML = '<div class="htp-card">' + headHtml() + bodyHtml() + '</div>';
    if (window.lucide && window.lucide.createIcons) {
      try { window.lucide.createIcons({ nameAttr: 'data-lucide', root: overlay.querySelector('.htp-card') }); } catch (e) { /* glyphs stay */ }
    }
    bindCard();
  }

  function bindCard() {
    overlay.querySelectorAll('.htp-tab').forEach(function (b) {
      b.addEventListener('click', function () {
        openSection = b.dataset.sec;
        paint();
      });
    });
    overlay.querySelector('.htp-close').addEventListener('click', close);
  }

  function isOpen() { return !!(overlay && overlay.classList.contains('show')); }

  function open(sec) {
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'htp-overlay';
      overlay.setAttribute('aria-hidden', 'true');
      overlay.innerHTML = '<div class="htp-card"></div>';
      document.body.appendChild(overlay);
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) close();
      });
    }
    if (sec) openSection = sec;
    lastLang = lang();
    paint();
    overlay.classList.add('show');
    overlay.setAttribute('aria-hidden', 'false');
    if (btn) btn.setAttribute('aria-expanded', 'true');
  }

  function close() {
    if (!overlay) return;
    overlay.classList.remove('show');
    overlay.setAttribute('aria-hidden', 'true');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  function styles() {
    return [
      '#htp-btn{pointer-events:auto;position:absolute;top:10px;width:30px;height:30px;flex:none;',
      '  right:calc(50% + (var(--rope-w, 132px) / 2) + 8px);border-radius:50%;cursor:pointer;',
      '  border:1px solid var(--border);background:var(--panel);color:var(--accent);',
      '  font:inherit;font-weight:800;font-size:15px;line-height:1;display:flex;align-items:center;justify-content:center;',
      '  box-shadow:0 6px 16px rgba(0,0,0,.4);transition:border-color .2s,transform .2s,color .2s;}',
      '#htp-btn:hover{border-color:var(--accent);transform:translateY(-1px);}',
      '#htp-btn::after{content:"?";}',
      '#shop-rig.open #htp-btn,#shop-rig.dragging #htp-btn{opacity:0;pointer-events:none;}',
      '@media (max-width:640px){#htp-btn{width:26px;height:26px;font-size:13px;top:8px;}}',
      '#htp-overlay{position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;',
      '  padding:18px;background:rgba(4,8,18,.62);backdrop-filter:blur(4px);',
      '  opacity:0;visibility:hidden;transition:opacity .24s,visibility 0s linear .24s;}',
      '#htp-overlay.show{opacity:1;visibility:visible;transition:opacity .24s,visibility 0s;}',
      '.htp-card{width:min(720px,96vw);max-height:min(86vh,760px);display:flex;flex-direction:column;',
      '  background:var(--panel);border:1px solid var(--border);border-radius:18px;overflow:hidden;',
      '  box-shadow:0 26px 70px rgba(0,0,0,.6);transform:translateY(10px) scale(.985);transition:transform .26s;}',
      '#htp-overlay.show .htp-card{transform:none;}',
      '.htp-head{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid var(--border);flex:none;}',
      '.htp-title-wrap{display:flex;flex-direction:column;gap:1px;min-width:0;}',
      '.htp-title{font-weight:800;font-size:15px;letter-spacing:.3px;}',
      '.htp-subtitle{font-size:10px;color:var(--muted);}',
      '.htp-chip{margin-left:auto;font-size:10px;font-weight:700;color:var(--muted);white-space:nowrap;}',
      '.htp-chip b{color:var(--text);}',
      '.htp-balance{margin-left:8px;font-family:Consolas,Monaco,monospace;color:var(--accent);',
      '  padding:3px 9px;border-radius:9px;background:var(--accent-soft);}',
      '.htp-close{width:26px;height:26px;flex:none;border-radius:9px;border:1px solid var(--border);',
      '  background:transparent;color:var(--muted);cursor:pointer;font-size:15px;line-height:1;}',
      '.htp-close:hover{color:var(--text);border-color:var(--accent);}',
      '.htp-tabs{display:flex;flex-wrap:wrap;gap:6px;padding:9px 12px 0;flex:none;}',
      '.htp-tab{display:flex;align-items:center;gap:5px;padding:6px 10px;border-radius:11px 11px 0 0;',
      '  border:1px solid var(--border);border-bottom:none;background:transparent;color:var(--muted);',
      '  cursor:pointer;font:inherit;font-size:11px;font-weight:600;}',
      '.htp-tab:hover{color:var(--text);}',
      '.htp-tab.on{color:var(--text);background:var(--panel-2);}',
      '.htp-icon{font-style:normal;width:14px;height:14px;display:inline-flex;align-items:center;',
      '  justify-content:center;flex:none;font-size:11px;}',
      'svg.htp-icon{width:14px;height:14px;stroke:currentColor;}',
      '.htp-body{flex:1;overflow-y:auto;padding:12px 16px 16px;touch-action:pan-y;-webkit-overflow-scrolling:touch;}',
      '.htp-lead{margin:0 0 10px;font-size:12.5px;line-height:1.55;color:var(--text);opacity:.92;}',
      '.htp-list{margin:0;padding-left:18px;}',
      '.htp-list li{font-size:12px;line-height:1.62;margin-bottom:7px;color:var(--text);opacity:.88;}',
      '.htp-table{display:flex;flex-direction:column;gap:4px;margin:0 0 12px;',
      '  background:var(--panel-2);border:1px solid var(--border);border-radius:13px;padding:10px 12px;}',
      '.htp-row{display:flex;align-items:baseline;gap:12px;font-size:11.5px;}',
      '.htp-row span{color:var(--muted);flex:1;min-width:0;}',
      '.htp-row b{font-family:Consolas,Monaco,monospace;font-size:11.5px;color:var(--text);white-space:nowrap;}',
      '.htp-neg b{color:var(--err);}',
      '.htp-own b{color:var(--ok);}',
      '.htp-sep{height:1px;background:var(--border);margin:6px 0;}',
      '.htp-group{font-size:10px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:var(--accent);opacity:.8;}',
      '.htp-note{font-size:10px;font-weight:600;color:#ffcf5c;}',
      '.htp-ladder{display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin-top:4px;}',
      '.htp-pip{display:inline-flex;align-items:center;gap:4px;font-size:10px;color:var(--text);',
      '  border:1px solid var(--border);border-radius:8px;padding:3px 7px;background:var(--panel);}',
      '.htp-pip i{font-style:normal;color:var(--accent);font-weight:800;}',
      '.htp-arrow{color:var(--muted);font-size:10px;}',
      '.htp-tip{margin:14px 0 0;font-size:11px;color:var(--muted);line-height:1.5;padding:8px 11px;',
      '  border-left:2px solid var(--accent);background:var(--panel-2);border-radius:0 10px 10px 0;}',
      '.htp-tip b{color:var(--accent);font-weight:800;font-size:9.5px;letter-spacing:.7px;text-transform:uppercase;}',
      '@media (max-width:640px){',
      '  #htp-overlay{padding:10px;}',
      '  .htp-card{max-height:92vh;}',
      '  .htp-tab span{display:none;}',
      '  .htp-tab.on span{display:inline;}',
      '  .htp-tab{padding:7px 9px;}',
      '  .htp-body{padding:10px 12px 14px;}',
      '  .htp-chip:not(.htp-balance){display:none;}',
      '  .htp-balance{margin-left:auto;font-size:11px;padding:3px 8px;}',
      '}'
    ].join('\n');
  }

  function mount() {
    if (document.getElementById('htp-styles')) return;
    var st = document.createElement('style');
    st.id = 'htp-styles';
    st.textContent = styles();
    document.head.appendChild(st);

    // The button lives inside the rope rig so it always sits beside the cord and
    // moves with it when the layout switches to mobile.
    rig = document.getElementById('shop-rig');
    if (!rig) { setTimeout(mount, 200); return; }
    btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'htp-btn';
    btn.title = S().tab;
    btn.setAttribute('aria-label', S().tab);
    btn.setAttribute('aria-expanded', 'false');
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (isOpen()) close(); else open();
    });
    rig.appendChild(btn);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen()) { e.stopPropagation(); close(); }
    });

    // Language and shop state are owned by other scripts; redraw on demand so the
    // guide never shows a stale price or a stale translation.
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (t && typeof t.closest === 'function' && t.closest('#btn-lang')) {
        setTimeout(function () {
          btn.title = S().tab;
          btn.setAttribute('aria-label', S().tab);
          if (isOpen()) paint();
        }, 0);
      }
    }, true);

    setInterval(function () {
      if (!isOpen()) return;
      var l = lang();
      if (l !== lastLang) { lastLang = l; paint(); }
    }, 500);
  }

  window.__mol3dGuide = {
    open: open,
    close: close,
    isOpen: isOpen,
    render: paint,
    sections: function () { return SECTIONS.slice(); }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
