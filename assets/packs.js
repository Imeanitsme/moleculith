/* FC-style pack opening. Rewards are rolled and written as a 'pack' transaction
   before the cinematic starts, so closing the tab mid-animation still delivers. */
(function () {
  'use strict';

  function econ() { return window.__mol3dEcon || null; }
  function shop() { return window.__mol3dShop || null; }
  function lang() { var e = econ(); return e ? e.lang() : (localStorage.getItem('mol3d.lang') || 'vi'); }
  function L(v) { return v == null ? '' : typeof v === 'string' ? v : (v[lang()] || v.en || ''); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  // Internal ids stay stable for saved transactions; the names are stability tiers.
  // `color` is the neon hue the dark shell (and every cinematic) is built around;
  // `ink` is the same hue read at the lightness a 150-250 luminance panel demands,
  // because #2dd4a7 at 11px on a white card measures 1.6:1. Only the shop tab uses
  // `ink` — the pack and gift cinematics stay dark by design.
  var RARITIES = [
    { id: 'common', color: '#8fa3b8', ink: '#4c5a6b', glow: '#d3dde8', icon: 'shield', name: { en: 'Stable', vi: 'Bền' } },
    { id: 'uncommon', color: '#38bdf8', ink: '#0369a1', glow: '#a5e3ff', icon: 'droplet', name: { en: 'Reactive', vi: 'Hoạt động' } },
    { id: 'rare', color: '#2dd4a7', ink: '#0b6b53', glow: '#a2f5dc', icon: 'flask-conical', name: { en: 'Catalytic', vi: 'Xúc tác' } },
    { id: 'epic', color: '#b6f23a', ink: '#4d6b00', glow: '#e4ff9e', icon: 'radiation', name: { en: 'Radioactive', vi: 'Phóng xạ' } },
    { id: 'legendary', color: '#ff8a1f', ink: '#8a4b06', glow: '#ffd09a', icon: 'flame', name: { en: 'Fissile', vi: 'Phân hạch' } },
    { id: 'mythical', color: '#e040fb', ink: '#861b9e', glow: '#f7b3ff', icon: 'orbit', name: { en: 'Antimatter', vi: 'Phản vật chất' } }
  ];
  var RIDX = {}; RARITIES.forEach(function (r, i) { RIDX[r.id] = i; });
  // Rarity hue handed to the shop tab as custom properties, so CSS — not an inline
  // colour — decides which of the two the surface paints.
  function rr(r) { return '--rr:' + r.color + ';--rr-ink:' + r.ink; }

  // Drop rates shown in the tab are read from this same table.
  var PACKS = [
    { id: 'basic', cost: 100, n: 3, hue: '#3b5568', icon: 'test-tube', name: { en: 'Test Tube Kit', vi: 'Bộ Ống nghiệm' }, rates: [65, 22, 9, 3, 0.9, 0.1] },
    { id: 'molecular', cost: 250, n: 5, hue: '#0e6b8a', icon: 'flask-conical', name: { en: 'Molecule Kit', vi: 'Bộ Phân tử' }, rates: [45, 30, 15, 7, 2.5, 0.5] },
    { id: 'advanced', cost: 500, n: 5, hue: '#0f7a62', icon: 'beaker', name: { en: 'Reactor Crate', vi: 'Thùng Lò phản ứng' }, rates: [20, 35, 25, 14, 5, 1] },
    { id: 'elite', cost: 1000, n: 7, hue: '#5d7a12', icon: 'radiation', name: { en: 'Isotope Vault', vi: 'Kho Đồng vị' }, rates: [0, 35, 35, 20, 8, 2] },
    { id: 'jackpot', cost: 2500, n: 10, hue: '#8a1fa0', icon: 'orbit', name: { en: 'Supernova Core', vi: 'Lõi Siêu tân tinh' }, rates: [0, 20, 35, 28, 13, 4] },
    // A secret crate: never rendered on the shelf below. While the hourly King
    // event runs, His Event tab in the shop sells it (see events.js).
    { id: 'king', cost: 5000, n: 12, hue: '#8f1010', bg: 'linear-gradient(150deg,#8f1010 0%,#e01b24 40%,#ffd23f 100%)', icon: 'crown', name: { en: 'King Pack', vi: 'King Pack' }, rates: [0, 0, 18, 42, 30, 10], king: true }
  ];
  function packBg(p) { return p.bg || 'linear-gradient(150deg,' + p.hue + ',#031417)'; }

  function stars(n, r) { return { id: 'stars-' + n, kind: 'stars', rarity: r, value: n, icon: 'star', name: { en: n + ' Stars', vi: n + ' Sao' }, desc: { en: 'Added to your balance.', vi: 'Cộng vào số dư.' } }; }
  function atom(sym, z, n, r, v) { return { id: 'atom-' + sym + '-' + n, kind: 'atom', z: z, count: n, sym: sym, rarity: r, value: v, icon: 'atom', name: { en: n + ' × ' + sym + ' atoms', vi: n + ' × nguyên tử ' + sym }, desc: { en: 'Added to your element stock.', vi: 'Thêm vào kho nguyên tố.' } }; }
  function mol(f, en, vi, r, v, icon) { return { id: 'mol-' + f, kind: 'molecule', formula: f, sym: f, rarity: r, value: v, icon: icon || 'hexagon', name: { en: en, vi: vi }, desc: { en: 'A molecule card: its atoms go to your stock, and the card can summon ' + f + ' into the scene.', vi: 'Thẻ phân tử: nguyên tử vào kho, thẻ có thể triệu hồi ' + f + ' vào cảnh.' } }; }
  function boost(pct, uses, r, v) { return { id: 'boost-' + pct + '-' + uses, kind: 'boost', rate: 1 - pct / 100, uses: uses, hours: 2, rarity: r, value: v, icon: 'badge-percent', name: { en: 'Catalyst −' + pct + '% ×' + uses, vi: 'Chất xúc tác −' + pct + '% ×' + uses }, desc: { en: 'Your next ' + uses + ' shop purchases within 2 h cost ' + pct + '% less.', vi: uses + ' lần mua tiếp theo trong 2 giờ rẻ hơn ' + pct + '%.' } }; }
  function ammo(n, r, v) { return { id: 'ammo-proton-' + n, kind: 'ammo', ammo: 'proton', count: n, rarity: r, value: v, icon: 'crosshair', name: { en: n + ' proton rounds', vi: n + ' viên proton' }, desc: { en: 'Ammo for the Proton gun.', vi: 'Đạn cho súng Proton.' } }; }
  function feat(id, icon, en, vi, r, v) { return { id: 'feat-' + id, kind: 'feature', feature: id, rarity: r, value: v, icon: icon, name: { en: en, vi: vi }, desc: { en: 'Unlocks the feature. Already owned: pays 35% of its value in stars.', vi: 'Mở khóa tính năng. Nếu đã có: trả 35% giá trị bằng sao.' } }; }
  function title(id, icon, en, vi, r, v) { return { id: 'title-' + id, kind: 'title', rarity: r, value: v, icon: icon, name: { en: en, vi: vi }, desc: { en: 'A collectible title shown in your lab collection. Duplicates pay 35% of its value.', vi: 'Danh hiệu sưu tầm hiển thị trong bộ sưu tập. Trùng lặp trả 35% giá trị.' } }; }
  // k: 1 marks loot that only the King Pack holds - the three exclusive titles and
  // the bulk stacks. rollPack() hides these from every ordinary crate.
  function kg(it) { it.k = 1; return it; }

  var POOL = {
    common: [stars(3, 'common'), stars(5, 'common'), stars(8, 'common'), atom('H', 1, 5, 'common', 5), atom('C', 6, 3, 'common', 6), atom('O', 8, 3, 'common', 6), atom('N', 7, 3, 'common', 6)],
    uncommon: [stars(15, 'uncommon'), stars(20, 'uncommon'), atom('Na', 11, 3, 'uncommon', 12), atom('Cl', 17, 3, 'uncommon', 12), atom('S', 16, 3, 'uncommon', 12), mol('H2O', 'Water', 'Nước', 'uncommon', 15, 'droplets'), mol('CO2', 'Carbon dioxide', 'Cacbon đioxit', 'uncommon', 18, 'cloud'), mol('NH3', 'Ammonia', 'Amoniac', 'uncommon', 18, 'wind'), ammo(10, 'uncommon', 10), boost(10, 2, 'uncommon', 15)],
    rare: [stars(40, 'rare'), stars(60, 'rare'), mol('CH4', 'Methane', 'Metan', 'rare', 40, 'flame-kindling'), mol('C2H5OH', 'Ethanol', 'Etanol', 'rare', 60, 'wine'), atom('Fe', 26, 3, 'rare', 45), atom('Cu', 29, 3, 'rare', 45), boost(20, 3, 'rare', 50), title('apprentice', 'graduation-cap', 'Lab Apprentice', 'Học việc Phòng thí nghiệm', 'rare', 40),
      kg(atom('C', 6, 60, 'rare', 180)), kg(atom('Fe', 26, 15, 'rare', 270))],
    epic: [stars(120, 'epic'), atom('Ag', 47, 3, 'epic', 120), atom('Au', 79, 2, 'epic', 140), boost(35, 3, 'epic', 130), mol('C6H6', 'Benzene', 'Benzen', 'epic', 120, 'hexagon'), title('chemist', 'flask-round', 'Master Chemist', 'Bậc thầy Hóa học', 'epic', 120),
      kg(atom('Ag', 47, 15, 'epic', 405)), kg(stars(600, 'epic')), kg(title('crowned', 'crown', 'The Crowned', 'Kẻ Đội Vương Miện', 'epic', 450))],
    legendary: [stars(350, 'legendary'), feat('xray', 'scan-eye', 'X-ray Vision', 'Tầm nhìn X-quang', 'legendary', 300), feat('timeSpeed', 'fast-forward', 'Time Speed', 'Tăng tốc Thời gian', 'legendary', 350), mol('C6H12O6', 'Glucose', 'Glucozơ', 'legendary', 300, 'candy'), title('nobel', 'medal', 'Nobel Laureate', 'Chủ nhân Nobel', 'legendary', 350),
      kg(atom('U', 92, 12, 'legendary', 960)), kg(atom('Au', 79, 20, 'legendary', 780)), kg(mol('C8H10N4O2', 'Caffeine', 'Caffeine', 'legendary', 600, 'coffee')), kg(title('sovereign', 'gem', 'Sovereign of Matter', 'Chúa tể Vật chất', 'legendary', 1400))],
    mythical: [stars(1500, 'mythical'), feat('mayhem', 'flame', 'Mayhem Mode', 'Chế độ Hỗn loạn', 'mythical', 1200), feat('timeStop', 'clock', 'Time Stop', 'Ngưng đọng Thời gian', 'mythical', 1200), feat('proton', 'crosshair', 'Proton Gun', 'Súng Proton', 'mythical', 1500), title('alchemist', 'crown', 'Mythic Alchemist', 'Giả kim Thần thoại', 'mythical', 1500),
      kg(stars(3000, 'mythical')), kg(atom('Og', 118, 20, 'mythical', 1200)), kg(boost(60, 10, 'mythical', 900)), kg(title('watched', 'eye', 'He Has Seen You', 'Hắn Đã Thấy Bạn', 'mythical', 3200))]
  };
  var BY_ID = {}; Object.keys(POOL).forEach(function (k) { POOL[k].forEach(function (it) { BY_ID[it.id] = it; }); });
  var KING_TITLES = ['title-crowned', 'title-sovereign', 'title-watched'].map(function (id) { return BY_ID[id]; });
  var KIND_ICON = { stars: 'star', atom: 'atom', molecule: 'hexagon', boost: 'badge-percent', ammo: 'crosshair', feature: 'lock-open', title: 'award' };
  function iconOf(it) { var p = BY_ID[it.id]; return (p && p.icon) || KIND_ICON[it.kind] || 'box'; }
  function ic(name, cls) { return '<i data-lucide="' + esc(name) + '" class="pk-lc' + (cls ? ' ' + cls : '') + '"></i>'; }
  function lucideIn(root) { if (root && window.lucide && window.lucide.createIcons) { try { window.lucide.createIcons({ nameAttr: 'data-lucide', root: root }); } catch (e) {} } }

  var STR = {
    en: { tab: 'Lab Crates', open: 'OPEN', items: '{n} samples', rates: 'Stability odds', preview: 'Possible contents', poor: 'Not enough stars ({p} needed)', claimAll: 'COLLECT ALL', back: 'BACK TO SHOP', skip: 'Skip', claimed: 'Collected!', dup: 'Duplicate +{c}★', delivered: 'Recovered an unopened crate: {n} sample(s) delivered.', collection: 'Lab collection', none: 'Nothing collected yet.', summon: 'Summon', fixed: 'Fixed price – discounts and events do not apply.', note: 'Rolls use crypto randomness in your browser; like all saves here it is client-side only.', sfx: 'SFX', music: 'Music', mute: 'Mute', gpName: 'Gift Pack', gpWord: 'A gift is opening…', gpSub: 'From a gift code', gpWorth: 'worth {n}★', gpTotal: 'Total worth {n}★', gpLanded: 'Already added to your crate and collection.', gpGo: 'CONTINUE' },
    vi: { tab: 'Thùng thí nghiệm', open: 'MỞ', items: '{n} mẫu', rates: 'Tỉ lệ độ bền', preview: 'Nội dung có thể có', poor: 'Không đủ sao (cần {p})', claimAll: 'THU THẬP TẤT CẢ', back: 'QUAY LẠI CỬA HÀNG', skip: 'Bỏ qua', claimed: 'Đã thu thập!', dup: 'Trùng +{c}★', delivered: 'Đã khôi phục một thùng chưa mở: giao {n} mẫu.', collection: 'Bộ sưu tập phòng thí nghiệm', none: 'Chưa sưu tầm gì.', summon: 'Triệu hồi', fixed: 'Giá cố định – không áp dụng giảm giá hay sự kiện.', note: 'Kết quả dùng ngẫu nhiên mật mã trong trình duyệt; như mọi dữ liệu lưu ở đây, chỉ phía máy khách.', sfx: 'Hiệu ứng', music: 'Nhạc', mute: 'Tắt tiếng', gpName: 'Gift Pack', gpWord: 'Đang mở quà…', gpSub: 'Từ mã quà tặng', gpWorth: 'giá trị {n}★', gpTotal: 'Tổng giá trị {n}★', gpLanded: 'Đã cộng vào kho và bộ sưu tập của bạn.', gpGo: 'TIẾP TỤC', kingNote: 'Rương của Vua mở đúng :00 mỗi giờ, trong 10 phút.', kingExcl: 'Kèm 1 danh hiệu độc quyền.' }
  };
  function S(k, p) { var s = (STR[lang()] || STR.en)[k] || STR.en[k] || k; for (var key in (p || {})) s = s.split('{' + key + '}').join(String(p[key])); return s; }

  // The King Pack is on the shelf only while the hourly King event is running.
  function kingLive() {
    var e = econ(), ev = e && e.event();
    return !!(ev && ev.kind === 'king' && ev.ends > Date.now());
  }

  /* ── audio ── */
  var AKEY = 'mol3d.packs.audio';
  var audio = (function () { try { return Object.assign({ sfx: 0.8, music: 0.5, mute: false }, JSON.parse(localStorage.getItem(AKEY) || '{}')); } catch (e) { return { sfx: 0.8, music: 0.5, mute: false }; } })();
  function saveAudio() { try { localStorage.setItem(AKEY, JSON.stringify(audio)); } catch (e) {} }
  var ctx = null, musicNodes = [];
  function ac() { if (!ctx) { var A = window.AudioContext || window.webkitAudioContext; if (!A) return null; ctx = new A(); } if (ctx.state === 'suspended') ctx.resume(); return ctx; }
  function tone(freq, dur, type, vol, slide, delay) {
    if (audio.mute || !(audio.sfx > 0)) return;
    var c = ac(); if (!c) return;
    var t = c.currentTime + (delay || 0), o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, (vol || 0.2) * audio.sfx), t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol, delay) {
    if (audio.mute || !(audio.sfx > 0)) return;
    var c = ac(); if (!c) return;
    var len = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    var s = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 1800; s.buffer = b; g.gain.value = (vol || 0.4) * audio.sfx;
    s.connect(f); f.connect(g); g.connect(c.destination); s.start(c.currentTime + (delay || 0));
  }
  function musicStart() {
    musicStop();
    if (audio.mute || !(audio.music > 0)) return;
    var c = ac(); if (!c) return;
    var master = c.createGain(); master.gain.setValueAtTime(0.0001, c.currentTime);
    master.gain.exponentialRampToValueAtTime(0.06 * audio.music, c.currentTime + 1.5); master.connect(c.destination);
    [55, 82.5, 110, 164.8].forEach(function (f, i) {
      var o = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain();
      o.type = i % 2 ? 'triangle' : 'sawtooth'; o.frequency.value = f;
      lfo.frequency.value = 0.15 + i * 0.07; lg.gain.value = f * 0.01; lfo.connect(lg); lg.connect(o.frequency);
      o.connect(master); o.start(); lfo.start(); musicNodes.push(o, lfo);
    });
    musicNodes.push(master);
  }
  function musicStop() {
    var c = ctx;
    musicNodes.forEach(function (n) {
      try { if (n.stop) n.stop(c ? c.currentTime + 0.3 : 0); else if (c) n.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.3); } catch (e) {}
    });
    musicNodes = [];
  }
  var SFX = {
    open: function () { tone(220, 0.25, 'square', 0.12, 440); },
    land: function () { noise(0.25, 0.5); tone(80, 0.35, 'sine', 0.4, 40); },
    charge: function (ms) { tone(110, ms / 1000, 'sawtooth', 0.12, 880); tone(165, ms / 1000, 'sine', 0.1, 1320); },
    crack: function () { noise(0.6, 0.7); tone(60, 0.6, 'sine', 0.5, 30); },
    energy: function (ri) { for (var i = 0; i <= ri; i++) tone(330 * Math.pow(1.26, i), 0.5, 'triangle', 0.12, null, i * 0.08); },
    reveal: function (ri) {
      var base = [262, 294, 330, 392, 440, 523][ri];
      [1, 1.25, 1.5, 2].forEach(function (m, i) { tone(base * m, 0.7 + ri * 0.15, ri >= 4 ? 'sawtooth' : 'triangle', 0.1 + ri * 0.02, null, i * 0.09); });
      if (ri >= 4) { noise(1.2, 0.3, 0.1); tone(1046, 1.4, 'sine', 0.08, 2093, 0.35); }
    },
    flip: function (ri) { tone(600 + ri * 120, 0.12, 'square', 0.06, 1200 + ri * 200); },
    claim: function () { [523, 659, 784, 1046].forEach(function (f, i) { tone(f, 0.3, 'triangle', 0.12, null, i * 0.07); }); },
    gpPop: function () { tone(150, 0.22, 'sine', 0.3, 330); noise(0.16, 0.2); },
    // Paper tearing is a long, uneven rip: broadband noise under a creak that
    // slides down while the tear runs across the box.
    gpTear: function () { noise(0.55, 0.5); tone(760, 0.5, 'sawtooth', 0.05, 150); tone(240, 0.45, 'triangle', 0.06, 110, 0.08); },
    gpHeld: function (ms) { tone(120, ms / 1000, 'sawtooth', 0.07, 520); },
    gpFly: function (i) { tone(480 + i * 55, 0.2, 'triangle', 0.09, 960 + i * 55); },
    gpDone: function () { [392, 523, 659, 784, 1046].forEach(function (f, i) { tone(f, 0.35, 'triangle', 0.1, null, i * 0.06); }); noise(0.4, 0.15, 0.05); }
  };

  /* ── rolls ── */
  function rollPack(p) {
    var e = econ(), out = [];
    var hold = {};
    RARITIES.forEach(function (r) { hold[r.id] = POOL[r.id].filter(function (it) { return p.king || !it.k; }); });
    for (var i = 0; i < p.n; i++) {
      var r = e.weighted(RARITIES.map(function (x, k) { return { w: p.rates[k], id: x.id }; }));
      var it = e.pick(hold[r.id]);
      out.push(Object.assign({}, it, { name: it.name, desc: it.desc }));
    }
    // One of the twelve is always an exclusive title, so the crate is never just stars.
    if (p.king) out[out.length - 1] = Object.assign({}, e.pick(KING_TITLES));
    out.sort(function (a, b) { return RIDX[a.rarity] - RIDX[b.rarity]; });
    return out;
  }
  // econ stores names as strings; keep both languages by storing the localized object.
  function bestOf(items) { var b = 0; items.forEach(function (it) { b = Math.max(b, RIDX[it.rarity] || 0); }); return b; }

  /* ── styles ── */
  function injectStyles() {
    if (document.getElementById('pk-styles')) return;
    var css = [
      '.pk-wrap{display:flex;flex-direction:column;gap:10px;padding:4px 2px}',
      '.pk-note{font-size:11px;opacity:.7;line-height:1.35}',
      '.pk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}',
      '.pk-card{position:relative;border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:10px;background:rgba(10,16,30,.6);display:flex;flex-direction:column;align-items:center;gap:6px}',
      '.pk-3d{perspective:500px;height:118px;display:flex;align-items:center;justify-content:center}',
      '.pk-box{width:72px;height:102px;border-radius:8px;transform:rotateY(-18deg) rotateX(6deg);transform-style:preserve-3d;animation:pkFloat 3.2s ease-in-out infinite;box-shadow:6px 8px 18px rgba(0,0,0,.55),inset 0 0 0 2px rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font-size:30px;position:relative;overflow:hidden;transition:transform .3s}',
      '.pk-box:after{content:"";position:absolute;inset:-40%;background:linear-gradient(115deg,transparent 40%,rgba(255,255,255,.45) 50%,transparent 60%);animation:pkShine 3.5s linear infinite}',
      '.pk-card:hover .pk-box{transform:rotateY(0) rotateX(0) translateY(-8px) scale(1.06)}',
      '@keyframes pkFloat{0%,100%{translate:0 0}50%{translate:0 -6px}}',
      '@keyframes pkShine{from{transform:translateX(-60%)}to{transform:translateX(60%)}}',
      '.pk-name{font-weight:700;font-size:13px;text-align:center}',
      '.pk-meta{font-size:11px;opacity:.75}',
      '.pk-buy{width:100%;padding:7px 0;border-radius:8px;border:0;font-weight:800;cursor:pointer;color:#04131a;background:linear-gradient(#5eead4,#0891b2)}',
      '.pk-buy[disabled]{filter:grayscale(1);opacity:.5;cursor:not-allowed}',
      '.pk-lc{width:1.05em;height:1.05em;vertical-align:-0.18em;margin-right:4px;stroke-width:2.2}',
      '.pk-box>svg,.pk-box>svg.lucide{width:44%;height:44%;stroke-width:1.6}',
      '#pk-cine .pack>svg.lucide{width:42%;height:42%;stroke-width:1.5}',
      '.pk-c .ic svg.lucide{width:1.35em;height:1.35em;margin:0 auto;display:block;stroke-width:2}',
      '.pk-c.big .ic svg.lucide{width:1.25em;height:1.25em}',
      '.pk-c .sy{display:block;font-size:.42em;font-weight:800;letter-spacing:.5px;opacity:.9;line-height:1.1}',
      '.pk-more{font-size:11px;background:none;border:0;color:#9cc6ff;cursor:pointer;text-decoration:underline}',
      '.pk-det{width:100%;font-size:11px;display:none}.pk-card.open .pk-det{display:block}',
      '.pk-det table{width:100%;border-collapse:collapse}.pk-det td{padding:1px 2px}.pk-det td:last-child{text-align:right}',
      '.pk-det ul{margin:4px 0 0;padding-left:14px;max-height:120px;overflow:auto}',
      '.pk-coll{display:flex;flex-wrap:wrap;gap:6px}',
      '.pk-chip{font-size:11px;border-radius:8px;padding:4px 7px;border:1px solid;display:flex;gap:5px;align-items:center}',
      '.pk-chip button{font-size:10px;padding:1px 5px;border-radius:5px;border:0;cursor:pointer}',
      /* The rarity hue reaches these rows through custom properties, so the shell's
         theme picks the lightness: the neon hue on dark, its readable twin on light.
         Where no hue is set (the percentage column) the fallback keeps inheritance. */
      '.pk-det td,.pk-det li{color:var(--rr,inherit)}',
      '.pk-chip{border-color:var(--rr,inherit)}',
      /* Light shell: the shop tab is app chrome, so its card, link and pack art
         follow the theme. The cinematic above it does not — it is a dark theatre. */
      'html[data-theme=light] .pk-card{background:rgba(255,255,255,.66);border-color:rgba(0,120,180,.26)}',
      'html[data-theme=light] .pk-box{color:#f6fbfe}',
      'html[data-theme=light] .pk-more{color:var(--rz-ink,#0369a1)}',
      'html[data-theme=light] .pk-det td,html[data-theme=light] .pk-det li{color:var(--rr-ink,var(--rr,inherit))}',
      'html[data-theme=light] .pk-chip{border-color:var(--rr-ink,var(--rr,inherit))}',
      '#pk-cine{position:fixed;inset:0;z-index:100000;background:radial-gradient(ellipse at center,#07222b 0%,#01060a 75%);overflow:hidden;display:flex;align-items:center;justify-content:center;font-family:inherit;color:#fff;--rc:#9aa7b8;--rg:#cfd8e3}',
      '#pk-cine .rays{position:absolute;inset:-50%;background:repeating-conic-gradient(from 0deg,rgba(255,255,255,.06) 0 6deg,transparent 6deg 18deg);animation:pkSpin 30s linear infinite;opacity:0;transition:opacity 1s}',
      '#pk-cine.s0 .rays,#pk-cine.s1 .rays{opacity:.6}#pk-cine.s2 .rays{opacity:1;background:repeating-conic-gradient(from 0deg,color-mix(in srgb,var(--rc) 30%,transparent) 0 6deg,transparent 6deg 18deg)}',
      '@keyframes pkSpin{to{transform:rotate(360deg)}}',
      '#pk-cine .floor{position:absolute;bottom:-20%;left:-20%;right:-20%;height:55%;background:linear-gradient(transparent,rgba(45,212,191,.13)),repeating-linear-gradient(90deg,rgba(94,234,212,.16) 0 1px,transparent 1px 60px),repeating-linear-gradient(0deg,rgba(94,234,212,.10) 0 1px,transparent 1px 60px);transform:perspective(500px) rotateX(70deg)}',
      '#pk-cine .stage{position:relative;width:min(92vw,900px);height:min(86vh,640px);display:flex;align-items:center;justify-content:center}',
      '#pk-cine .pack{position:absolute;width:150px;height:212px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:60px;box-shadow:0 0 30px rgba(0,0,0,.6),inset 0 0 0 3px rgba(255,255,255,.25);transform:translateY(-120vh) rotate(-12deg);overflow:hidden}',
      '#pk-cine .pack .lbl{position:absolute;bottom:12px;font-size:13px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}',
      '#pk-cine.s1 .pack{transition:transform .9s cubic-bezier(.2,1.5,.4,1);transform:translateY(0) rotate(0)}',
      '#pk-cine.s2 .pack{transform:none;animation:pkShake .09s linear infinite;box-shadow:0 0 calc(var(--ch,0)*90px) var(--rc),inset 0 0 0 3px var(--rg)}',
      '@keyframes pkShake{0%{translate:-2px 1px}50%{translate:2px -1px}100%{translate:-1px -2px}}',
      '#pk-cine .piece{position:absolute;width:75px;height:106px;border-radius:8px;opacity:0}',
      '#pk-cine.s3 .pack{opacity:0}',
      '#pk-cine.s3 .piece{opacity:1;animation:pkFly 1s ease-out forwards}',
      '@keyframes pkFly{from{transform:translate(0,0) rotate(0)}to{transform:translate(var(--dx),var(--dy)) rotate(var(--dr));opacity:0}}',
      '#pk-cine .burst{position:absolute;width:20px;height:20px;border-radius:50%;background:radial-gradient(circle,#fff,var(--rg) 30%,var(--rc) 55%,transparent 70%);opacity:0}',
      '#pk-cine.s3 .burst,#pk-cine.s4 .burst{animation:pkBurst 1.6s ease-out forwards}',
      '@keyframes pkBurst{0%{opacity:1;transform:scale(1)}60%{opacity:.9;transform:scale(60)}100%{opacity:0;transform:scale(80)}}',
      '#pk-cine .spark{position:absolute;width:4px;height:4px;border-radius:50%;background:var(--rg);box-shadow:0 0 8px var(--rc);animation:pkSpark 1.4s ease-out forwards}',
      '@keyframes pkSpark{to{transform:translate(var(--dx),var(--dy));opacity:0}}',
      '#pk-cine .rname{position:absolute;font-size:clamp(34px,8vw,84px);font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:var(--rg);text-shadow:0 0 30px var(--rc),0 0 60px var(--rc);opacity:0;transform:scale(.4)}',
      '#pk-cine.s5 .rname{transition:all .6s cubic-bezier(.2,1.6,.4,1);opacity:1;transform:scale(1)}',
      '#pk-cine.r5.s5 .rname{animation:pkMyth 1.2s linear infinite}@keyframes pkMyth{0%{filter:hue-rotate(0)}100%{filter:hue-rotate(360deg)}}',
      '#pk-cine .hero{position:absolute;opacity:0;perspective:900px}',
      '#pk-cine.s6 .hero{opacity:1}',
      '.pk-c{width:130px;height:180px;position:relative;transform-style:preserve-3d;transition:transform .8s cubic-bezier(.3,1.4,.5,1)}',
      '.pk-c.big{width:200px;height:280px}',
      '.pk-c .f,.pk-c .b{position:absolute;inset:0;border-radius:12px;backface-visibility:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:10px;text-align:center}',
      '.pk-c .b{background:repeating-linear-gradient(45deg,#0f2a2e 0 8px,#0a1f24 8px 16px);border:2px solid var(--c)}',
      '.pk-c .f{transform:rotateY(180deg);background:linear-gradient(160deg,color-mix(in srgb,var(--c) 55%,#0a0f1e),#0a0f1e 70%);border:2px solid var(--c);box-shadow:0 0 22px var(--c)}',
      '.pk-c.flip{transform:rotateY(180deg)}',
      '.pk-c .ic{font-size:34px;font-weight:900;line-height:1}.pk-c.big .ic{font-size:54px}',
      '.pk-c .nm{font-weight:800;font-size:13px}.pk-c.big .nm{font-size:18px}',
      '.pk-c .rr{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--c)}',
      '.pk-c .ds{font-size:10px;opacity:.75}',
      '.pk-c .dp{position:absolute;top:6px;right:6px;font-size:10px;background:#5eead4;color:#04131a;border-radius:6px;padding:1px 5px;font-weight:800}',
      '.pk-c .dp svg.lucide{width:.9em;height:.9em;vertical-align:-0.15em;margin-right:2px;stroke-width:2.6}',
      '#pk-cine .line{position:absolute;inset:0;display:flex;flex-wrap:wrap;align-content:center;justify-content:center;gap:10px;opacity:0;pointer-events:none;padding:10px;overflow:auto}',
      '#pk-cine.s7 .line,#pk-cine.s8 .line{opacity:1;pointer-events:auto}',
      '#pk-cine.s8 .line{align-content:flex-start;padding-top:60px;padding-bottom:90px}',
      '#pk-cine .line .pk-c{transform:translateY(40px) scale(.8);opacity:0;transition:transform .5s,opacity .5s}',
      '#pk-cine .line .pk-c.in{opacity:1;transform:none}#pk-cine .line .pk-c.in.flip{transform:rotateY(180deg)}',
      '#pk-cine .bar{position:absolute;bottom:16px;left:0;right:0;display:none;justify-content:center;gap:12px}',
      '#pk-cine.s8 .bar{display:flex}',
      '#pk-cine .bar button{padding:12px 22px;border-radius:10px;border:0;font-weight:900;cursor:pointer;font-size:14px}',
      '#pk-cine .bar .ca{background:linear-gradient(#5eead4,#0891b2);color:#04131a}#pk-cine .bar .bk{background:#17333d;color:#d7f6f2}',
      '#pk-cine .bar button[disabled]{opacity:.5}',
      '#pk-cine .top{position:absolute;top:10px;right:10px;left:10px;display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:11px;z-index:3}',
      '#pk-cine .top label{display:flex;align-items:center;gap:4px}#pk-cine .top input[type=range]{width:70px}',
      '#pk-cine .skip{background:rgba(255,255,255,.12);color:#fff;border:0;border-radius:8px;padding:6px 12px;cursor:pointer;font-weight:700}',
      '#pk-cine .msg{position:absolute;top:44px;left:0;right:0;text-align:center;font-weight:800;color:#5eead4}',
      '@media (max-width:600px){.pk-c{width:96px;height:136px}.pk-c .ic{font-size:24px}.pk-c .nm{font-size:11px}.pk-c .ds{display:none}.pk-c.big{width:160px;height:224px}#pk-cine .pack{width:120px;height:170px}#pk-cine .top input[type=range]{width:46px}}',
      '@media (prefers-reduced-motion:reduce){#pk-cine .rays,.pk-box,.pk-box:after{animation:none}}',

      /* ── Gift Pack opening: black screen, the box rises, its top tears off, the
         contents fly out and stack on the right while the empty wrap slides left.
         Crimson wrap and gold ribbon: a present, not a crate. ── */
      '#gp-cine{position:fixed;inset:0;z-index:100001;background:#04010a;color:#fff;font-family:inherit;overflow:hidden;display:flex;align-items:center;justify-content:center;--w1:#6d0d20;--w2:#e53357;--rib:#ffd76a;--rib2:#fff3c4}',
      '#gp-cine .gp-veil{position:absolute;inset:0;background:#000;z-index:6;pointer-events:none;opacity:1;transition:opacity .9s ease-out}',
      '#gp-cine.gp-open .gp-veil{opacity:0}',
      '#gp-cine .gp-word{position:absolute;top:44%;left:0;right:0;text-align:center;font-size:clamp(14px,3.2vw,21px);font-weight:900;letter-spacing:.32em;text-transform:uppercase;color:#f7e9c8;opacity:0;transition:opacity .6s;z-index:7;text-shadow:0 0 22px rgba(255,154,104,.55)}',
      '#gp-cine.gp-worded .gp-word{opacity:1}',
      '#gp-cine.gp-open .gp-word{opacity:0}',
      '#gp-cine .gp-glow{position:absolute;left:50%;top:50%;width:min(140vw,1200px);height:min(140vw,1200px);transform:translate(-50%,-50%);background:radial-gradient(circle,rgba(255,154,104,.34) 0,rgba(160,32,64,.16) 38%,transparent 66%);opacity:0;transition:opacity 1.1s}',
      '#gp-cine.gp-lit .gp-glow{opacity:1;animation:gpBreathe 2.8s ease-in-out infinite}',
      '@keyframes gpBreathe{0%,100%{opacity:.72}50%{opacity:1}}',
      '#gp-cine .gp-conf{position:absolute;inset:0;pointer-events:none;overflow:hidden}',
      '#gp-cine .gp-bit{position:absolute;top:-14vh;width:7px;height:12px;border-radius:2px;background:var(--bc);opacity:0}',
      '#gp-cine.gp-lit .gp-bit{animation:gpFall var(--dur) linear var(--del) forwards}',
      '@keyframes gpFall{0%{opacity:0;transform:translateY(0) rotate(0)}12%{opacity:.95}100%{opacity:0;transform:translate(var(--dx),124vh) rotate(var(--rot))}}',
      '#gp-cine .gp-stage{position:relative;width:min(94vw,1020px);height:min(84vh,600px)}',
      '#gp-cine .gp-pack{position:absolute;left:50%;top:50%;width:178px;height:244px;transform:translate(-50%,-50%) translateY(120vh) rotate(9deg)}',
      '#gp-cine.gp-rise .gp-pack{animation:gpRise .95s cubic-bezier(.2,1.45,.35,1) both}',
      '@keyframes gpRise{from{transform:translate(-50%,-50%) translateY(120vh) rotate(9deg)}to{transform:translate(-50%,-50%) rotate(0)}}',
      '#gp-cine .gp-face{position:absolute;inset:0;background:linear-gradient(150deg,var(--w2),var(--w1) 72%);box-shadow:inset 0 0 0 2px rgba(255,255,255,.14);overflow:hidden}',
      '#gp-cine .gp-lid{filter:brightness(1.07);z-index:2}',
      '#gp-cine .gp-under .gp-striph{top:62%}',
      '#gp-cine .gp-stripv{position:absolute;left:44%;width:12%;top:0;bottom:0;background:linear-gradient(90deg,var(--rib2),var(--rib));box-shadow:0 0 12px rgba(255,215,106,.5)}',
      '#gp-cine .gp-striph{position:absolute;top:14%;height:12%;left:0;right:0;background:linear-gradient(180deg,var(--rib2),var(--rib));box-shadow:0 0 12px rgba(255,215,106,.45)}',
      '#gp-cine .gp-bow{position:absolute;left:50%;top:5%;width:46%;height:19%;transform:translateX(-50%);background:radial-gradient(circle at 30% 40%,var(--rib2),var(--rib) 62%,#c79a2b);border-radius:50% 50% 42% 42%;box-shadow:0 0 14px rgba(255,215,106,.6)}',
      '#gp-cine .gp-lbl{position:absolute;left:6px;right:6px;bottom:8%;text-align:center;font-size:10px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.6)}',
      '#gp-cine .gp-hole{position:absolute;left:6%;right:6%;top:28%;height:13%;border-radius:50%;background:radial-gradient(ellipse at center,#1c0509 0%,#4a0d1d 75%);box-shadow:inset 0 3px 9px rgba(0,0,0,.85);opacity:0;transition:opacity .35s;z-index:1}',
      '#gp-cine.gp-tear .gp-hole,#gp-cine.gp-end .gp-hole{opacity:1}',
      '#gp-cine.gp-tear .gp-under{animation:gpJolt .45s ease-out both}',
      '@keyframes gpJolt{0%{transform:none}35%{transform:translateY(5px)}100%{transform:none}}',
      '#gp-cine.gp-tear .gp-lid{animation:gpTear 1s cubic-bezier(.35,.55,.3,1) both}',
      '@keyframes gpTear{0%{transform:none;filter:brightness(1.07)}18%{transform:translateY(-3px) rotate(-1.5deg);filter:brightness(1.25)}100%{transform:translate(-8vw,-46vh) rotate(-32deg) scale(.94);filter:brightness(1.1);opacity:0}}',
      '#gp-cine.gp-left .gp-pack{animation:gpSlideLeft 1s cubic-bezier(.3,.9,.3,1) both}',
      '@keyframes gpSlideLeft{from{transform:translate(-50%,-50%) rotate(0)}to{transform:translate(-50%,-50%) translate(-31vw,-2vh) scale(.58) rotate(-9deg)}}',
      '#gp-cine .gp-list{position:absolute;left:53%;top:6%;right:1.5%;bottom:12%;display:flex;flex-direction:column;gap:8px;overflow:auto;padding:2px 6px 2px 2px;opacity:0;transition:opacity .45s;z-index:5}',
      '#gp-cine.gp-fly .gp-list{opacity:1}',
      '#gp-cine .gp-cap{font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--rib);flex:0 0 auto}',
      '#gp-cine .gp-row{display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:12px;background:linear-gradient(100deg,rgba(255,255,255,.12),rgba(255,255,255,.035));border:1px solid var(--c);border-left-width:5px;box-shadow:0 8px 20px rgba(0,0,0,.5);opacity:0;flex:0 0 auto}',
      '#gp-cine.gp-fly .gp-row{animation:gpOut .62s cubic-bezier(.22,.9,.3,1) var(--del) both}',
      '@keyframes gpOut{0%{opacity:0;transform:translate(var(--sx),var(--sy)) scale(.34) rotate(-14deg)}18%{opacity:1}70%{transform:translate(calc(var(--sx) * .14),calc(var(--sy) * .14)) scale(1.05) rotate(-2deg)}100%{opacity:1;transform:none}}',
      '#gp-cine .gp-ic{width:28px;height:28px;border-radius:9px;display:flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--c) 28%,#0b0409);color:var(--c);flex:0 0 auto}',
      '#gp-cine .gp-ic svg{width:17px;height:17px;stroke-width:2.2}',
      '#gp-cine .gp-tx{min-width:0;flex:1}',
      '#gp-cine .gp-tx b{display:block;font-size:13px;line-height:1.3;overflow-wrap:anywhere}',
      '#gp-cine .gp-tx em{display:block;font-style:normal;font-size:10px;opacity:.8}',
      '#gp-cine .gp-sy{font-size:16px;font-weight:900;color:var(--c);flex:0 0 auto;min-width:22px;text-align:right}',
      '#gp-cine .gp-foot{font-size:10px;opacity:.75;padding:2px 4px 0;flex:0 0 auto}',
      '#gp-cine .gp-top{position:absolute;top:10px;left:12px;right:12px;display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:11px;z-index:7}',
      '#gp-cine .gp-brand{display:flex;align-items:center;gap:6px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:var(--rib)}',
      '#gp-cine .gp-brand svg{width:15px;height:15px}',
      '#gp-cine .gp-skip{background:rgba(255,255,255,.14);color:#fff;border:0;border-radius:8px;padding:6px 12px;cursor:pointer;font-weight:700;font-size:11px}',
      '#gp-cine .gp-bar{position:absolute;bottom:14px;left:0;right:0;display:none;justify-content:center;gap:12px;z-index:7}',
      '#gp-cine.gp-done .gp-bar,#gp-cine.gp-end .gp-bar{display:flex}',
      '#gp-cine .gp-bar button{padding:12px 26px;border-radius:10px;border:0;font-weight:900;cursor:pointer;font-size:14px;background:linear-gradient(var(--rib2),var(--rib));color:#3a2405;box-shadow:0 6px 20px rgba(255,215,106,.3)}',
      '#gp-cine.gp-end .gp-veil,#gp-cine.gp-end .gp-word,#gp-cine.gp-end .gp-lid,#gp-cine.gp-end .gp-conf{display:none}',
      '#gp-cine.gp-end .gp-list{opacity:1}',
      '#gp-cine.gp-end .gp-row{opacity:1;animation:none}',
      '#gp-cine.gp-end .gp-pack{transform:translate(-50%,-50%) translate(-31vw,-2vh) scale(.58) rotate(-9deg)}',
      '@media (max-width:720px){#gp-cine .gp-pack{width:132px;height:182px}#gp-cine .gp-list{left:47%;top:9%;bottom:14%}#gp-cine .gp-row{padding:6px 8px;gap:7px}#gp-cine .gp-tx b{font-size:11px}#gp-cine .gp-tx em{font-size:9px}#gp-cine .gp-ic{width:22px;height:22px}#gp-cine .gp-ic svg{width:14px;height:14px}#gp-cine .gp-sy{font-size:13px}#gp-cine.gp-end .gp-pack{transform:translate(-50%,-50%) translate(-26vw,-4vh) scale(.5) rotate(-9deg)}}',
      '@media (max-width:720px){@keyframes gpSlideLeft{from{transform:translate(-50%,-50%) rotate(0)}to{transform:translate(-50%,-50%) translate(-26vw,-4vh) scale(.5) rotate(-9deg)}}}',
      '@media (prefers-reduced-motion:reduce){#gp-cine .gp-bit,#gp-cine.gp-lit .gp-glow{animation:none}}'
    ].join('\n');
    var st = document.createElement('style'); st.id = 'pk-styles'; st.textContent = css; document.head.appendChild(st);
  }

  /* ── shop tab ── */
  var busy = false;
  function cardHtml(it, big, delivered) {
    var r = RARITIES[RIDX[it.rarity] || 0];
    var dup = delivered && delivered.dup ? '<span class="dp">' + ic('repeat') + esc(S('dup', { c: delivered.compensation })) + '</span>' : '';
    var icon = ic(iconOf(it)) + (it.sym ? '<span class="sy">' + esc(it.sym) + '</span>' : '');
    return '<div class="pk-c' + (big ? ' big' : '') + '" style="--c:' + r.color + '"><div class="b"></div><div class="f">' + dup +
      '<div class="ic">' + icon + '</div><div class="nm">' + esc(L(it.name)) + '</div><div class="rr">' + ic(r.icon) + esc(L(r.name)) + '</div><div class="ds">' + esc(L(it.desc)) + '</div></div></div>';
  }
  function renderTab() {
    injectStyles();
    var e = econ(), bal = e ? e.balance() : 0;
    var root = document.createElement('div'); root.className = 'pk-wrap';
    var h = '<div class="pk-note">' + esc(S('fixed')) + '</div><div class="pk-grid">';
    PACKS.forEach(function (p) {
      if (p.king) return;
      var rows = RARITIES.map(function (r, i) { return p.rates[i] > 0 ? '<tr><td style="' + rr(r) + '">' + ic(r.icon) + esc(L(r.name)) + '</td><td>' + p.rates[i] + '%</td></tr>' : ''; }).join('');
      var prev = RARITIES.map(function (r, i) { return p.rates[i] > 0 ? POOL[r.id].filter(function (it) { return !it.k; }).map(function (it) { return '<li style="' + rr(r) + '">' + ic(iconOf(it)) + esc(L(it.name)) + '</li>'; }).join('') : ''; }).join('');
      h += '<div class="pk-card" data-pack="' + p.id + '"><div class="pk-3d"><div class="pk-box" style="background:' + packBg(p) + '">' + ic(p.icon) + '</div></div>' +
        '<div class="pk-name">' + esc(L(p.name)) + '</div><div class="pk-meta">' + esc(S('items', { n: p.n })) + '</div>' +
        '<button class="pk-buy" data-open="' + p.id + '"' + (bal < p.cost || busy ? ' disabled title="' + esc(S('poor', { p: p.cost })) + '"' : '') + '>' + esc(S('open')) + ' · ' + p.cost + '★</button>' +
        '<button class="pk-more" data-more="1">' + esc(S('rates')) + ' / ' + esc(S('preview')) + '</button>' +
        '<div class="pk-det"><table>' + rows + '</table><ul>' + prev + '</ul></div></div>';
    });
    h += '</div><div class="pk-name" style="text-align:left">' + esc(S('collection')) + '</div><div class="pk-coll">';
    var inv = e ? e.inventory().filter(function (x) { return x.kind === 'title' || x.kind === 'molecule'; }) : [];
    if (!inv.length) h += '<span class="pk-note">' + esc(S('none')) + '</span>';
    inv.forEach(function (x) {
      var r = RARITIES[RIDX[x.rarity] || 0];
      h += '<span class="pk-chip" style="' + rr(r) + '">' + ic(iconOf(x)) + esc(L(x.name)) + ' ×' + x.n +
        (x.kind === 'molecule' ? ' <button data-redeem="' + esc(x.id) + '">' + esc(S('summon')) + '</button>' : '') + '</span>';
    });
    h += '</div><div class="pk-note">' + esc(S('note')) + '</div>';
    root.innerHTML = h;
    lucideIn(root);
    root.addEventListener('click', function (ev) {
      var t = ev.target;
      if (t.dataset.more) { t.closest('.pk-card').classList.toggle('open'); return; }
      if (t.dataset.open) { openPack(t.dataset.open); return; }
      if (t.dataset.redeem) { var res = econ().redeem(t.dataset.redeem); if (shop()) shop().rerender(); if (!res.ok && window.__mol3dStatus) window.__mol3dStatus(res.reason); }
    });
    return root;
  }
  function tabSig() { var e = econ(); return [lang(), busy, e ? Math.floor(e.balance()) : 0, e ? e.inventory().length : 0, e ? e.inventory().reduce(function (n, x) { return n + x.n; }, 0) : 0].join('|'); }

  /* ── cinematic ── */
  var cine = null;
  function openPack(packId) {
    var e = econ(), p = PACKS.filter(function (x) { return x.id === packId; })[0];
    if (!e || !p || busy || gp) return;
    if (p.king && !kingLive()) return;
    if (e.balance() < p.cost) return;
    var items = rollPack(p);
    var rewards = items.map(function (it) {
      return { id: it.id, kind: it.kind, name: L(it.name), rarity: it.rarity, icon: it.icon, desc: L(it.desc), value: it.value, count: it.count, z: it.z, ammo: it.ammo, feature: it.feature, rate: it.rate, uses: it.uses, hours: it.hours, formula: it.formula, data: { pack: p.id, i18n: { name: it.name, desc: it.desc } } };
    });
    var res = e.purchase({ id: e.uid('pack'), kind: 'pack', cost: p.cost, rewards: rewards, meta: { pack: p.id } });
    if (!res.ok) return;
    busy = true;
    if (shop()) shop().rerender();
    play(p, items, res.tx.id);
  }

  function play(p, items, txId) {
    injectStyles();
    var best = bestOf(items), br = RARITIES[best], timers = [], claimed = false;
    var el = document.createElement('div'); el.id = 'pk-cine'; el.className = 's0 r' + best;
    el.style.setProperty('--rc', br.color); el.style.setProperty('--rg', br.glow);
    var pieces = '';
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (q) {
      pieces += '<div class="piece" style="background:' + packBg(p) + ';--dx:' + (q[0] * 45) + 'vw;--dy:' + (q[1] * 45) + 'vh;--dr:' + (q[0] * 200) + 'deg;translate:' + (q[0] * 38) + 'px ' + (q[1] * 53) + 'px"></div>';
    });
    el.innerHTML = '<div class="rays"></div><div class="floor"></div>' +
      '<div class="top"><div style="display:flex;gap:10px;flex-wrap:wrap">' +
      '<label>' + ic('volume2') + esc(S('sfx')) + '<input type="range" min="0" max="1" step="0.05" data-a="sfx" value="' + audio.sfx + '"></label>' +
      '<label>' + ic('music') + esc(S('music')) + '<input type="range" min="0" max="1" step="0.05" data-a="music" value="' + audio.music + '"></label>' +
      '<label><input type="checkbox" data-a="mute"' + (audio.mute ? ' checked' : '') + '>' + esc(S('mute')) + '</label></div>' +
      '<button class="skip">' + esc(S('skip')) + ic('skip-forward') + '</button></div><div class="msg"></div>' +
      '<div class="stage"><div class="pack" style="background:' + packBg(p) + '">' + ic(p.icon) + '<span class="lbl">' + esc(L(p.name)) + '</span></div>' + pieces +
      '<div class="burst"></div><div class="rname">' + ic(br.icon) + esc(L(br.name)) + '</div>' +
      '<div class="hero">' + cardHtml(items[items.length - 1], true) + '</div>' +
      '<div class="line">' + items.map(function (it) { return cardHtml(it); }).join('') + '</div></div>' +
      '<div class="bar"><button class="ca">' + ic('check-check') + esc(S('claimAll')) + '</button><button class="bk">' + ic('arrow-left') + esc(S('back')) + '</button></div>';
    document.body.appendChild(el);
    lucideIn(el);
    cine = el;

    el.querySelector('.top').addEventListener('input', function (ev) {
      var k = ev.target.dataset.a; if (!k) return;
      audio[k] = k === 'mute' ? ev.target.checked : Number(ev.target.value);
      saveAudio();
      if (k !== 'sfx') { if (audio.mute || !(audio.music > 0)) musicStop(); else if (!musicNodes.length && stage < 8) musicStart(); }
    });

    var stage = 0;
    function set(n) { stage = n; el.className = 's' + n + ' r' + best; }
    function at(ms, fn) { timers.push(setTimeout(fn, ms)); }
    function sparks(count) {
      var st = el.querySelector('.stage');
      for (var i = 0; i < count; i++) {
        var s = document.createElement('div'); s.className = 'spark';
        var a = Math.random() * Math.PI * 2, d = 150 + Math.random() * 350;
        s.style.setProperty('--dx', Math.cos(a) * d + 'px'); s.style.setProperty('--dy', Math.sin(a) * d + 'px');
        st.appendChild(s); setTimeout(function (x) { x.remove(); }.bind(null, s), 1500);
      }
    }
    function lineup(fast) {
      var cards = el.querySelectorAll('.line .pk-c');
      cards.forEach(function (c, i) {
        var go = function () { c.classList.add('in'); setTimeout(function () { c.classList.add('flip'); if (!fast) SFX.flip(RIDX[items[i].rarity]); }, fast ? 0 : 220); };
        if (fast) go(); else at(i * 260, go);
      });
    }
    function results() { timers.forEach(clearTimeout); timers = []; set(8); lineup(true); musicStop(); }

    musicStart(); SFX.open();
    at(1200, function () { set(1); });
    at(2000, SFX.land);
    var chargeMs = 2400 + best * 250;
    at(2800, function () {
      set(2); SFX.charge(chargeMs);
      var t0 = performance.now();
      (function ramp() { if (stage !== 2) return; var k = Math.min(1, (performance.now() - t0) / chargeMs); el.style.setProperty('--ch', k * (0.3 + best * 0.14)); requestAnimationFrame(ramp); })();
    });
    var tBreak = 2800 + chargeMs;
    at(tBreak, function () { set(3); SFX.crack(); sparks(30 + best * 15); });
    at(tBreak + 1000, function () { set(4); SFX.energy(best); sparks(20 + best * 20); });
    at(tBreak + 2400, function () { set(5); SFX.reveal(best); });
    at(tBreak + 4000, function () { set(6); });
    at(tBreak + 4300, function () { el.querySelector('.hero .pk-c').classList.add('flip'); SFX.flip(best); sparks(25); });
    at(tBreak + 6400, function () { set(7); lineup(false); });
    at(tBreak + 6400 + items.length * 260 + 900, results);

    function finish(toShop) {
      if (!claimed) {
        claimed = true;
        var r = econ().claim(txId);
        if (r.ok) {
          SFX.claim();
          (r.granted || []).forEach(function (g, i) {
            if (g && g.dup) { var c = el.querySelectorAll('.line .pk-c')[i]; if (c) c.querySelector('.f').insertAdjacentHTML('afterbegin', '<span class="dp">' + ic('repeat') + esc(S('dup', { c: g.compensation })) + '</span>'); }
          });
          lucideIn(el);
        }
        el.querySelector('.msg').textContent = S('claimed');
        el.querySelector('.ca').disabled = true;
      }
      if (toShop) close();
    }
    function close() {
      timers.forEach(clearTimeout); timers = []; musicStop();
      if (!claimed) { claimed = true; econ().claim(txId); }
      el.remove(); cine = null; busy = false;
      if (shop()) { shop().showTab('packs'); shop().rerender(); }
    }
    el.querySelector('.skip').addEventListener('click', function () { if (stage < 8) results(); else close(); });
    el.querySelector('.ca').addEventListener('click', function () { finish(false); });
    el.querySelector('.bk').addEventListener('click', function () { finish(true); });
  }

  /* ── recovery: a pack paid for but never claimed is delivered on the next load ── */
  function recover() {
    var e = econ();
    var open = e.pending().filter(function (t) { return t.kind === 'pack'; });
    if (!open.length) return;
    var n = 0;
    open.forEach(function (t) { var r = e.claim(t.id); if (r.ok) n += (r.granted || []).length; });
    if (!n) return;
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;left:50%;top:70px;transform:translateX(-50%);z-index:99999;background:#0c2a30;color:#5eead4;padding:10px 16px;border-radius:10px;font-weight:700;box-shadow:0 6px 20px rgba(0,0,0,.5);max-width:90vw;text-align:center;border:1px solid rgba(94,234,212,.35)';
    d.textContent = S('delivered', { n: n });
    document.body.appendChild(d);
    setTimeout(function () { d.remove(); }, 6000);
  }

  /* ── Gift Pack: what a redeemed code actually paid, opened as a present ── */
  var gp = null;

  function elementByZ(z) {
    var g = null;
    try { g = window.__mol3d || null; } catch (e) { return null; }
    var list = (g && g.ELEMENTS) || [];
    for (var i = 0; i < list.length; i++) if (list[i].z === z) return list[i];
    return null;
  }

  // A row is coloured by how much it is worth, on the same scale a crate roll
  // pays it, so a gift reads at the height of the pack that could have given it.
  function tierOf(v) {
    return v >= 1000 ? 'mythical' : v >= 300 ? 'legendary' : v >= 110 ? 'epic' :
      v >= 40 ? 'rare' : v >= 10 ? 'uncommon' : 'common';
  }

  // The sender's wording is the receiver's wording: the gift module already owns
  // the one line that describes a row, so the pack never invents its own text and
  // the two sides of one gift cannot drift. Its own copy is bilingual, so asking
  // it in this language answers in this language.
  function giftLabel(row, fallback) {
    var f = null;
    try { f = window.__mol3dStarGift.contents.label; } catch (e) { f = null; }
    if (typeof f === 'function') {
      try {
        var t = f(Object.assign({}, row, { n: row.got }));
        if (t) return String(t);
      } catch (e) { }
    }
    return fallback;
  }

  function giftCards(payload) {
    var sh = shop(), out = [];
    if (payload.stars > 0) {
      var s = stars(payload.stars, tierOf(payload.stars));
      out.push({ icon: 'star', rarity: s.rarity, value: payload.stars, sym: '★', name: L(s.name) });
    }
    (payload.delivered || []).forEach(function (d) {
      if (!d || !(d.got > 0)) return;
      if (d.k === 'atom') {
        var unit = sh && sh.unitPrice ? sh.unitPrice(d.z) : 0;
        var v = unit * d.got;
        var el = elementByZ(d.z) || {};
        var sym = d.sym || el.sym || String(d.z);
        out.push({ icon: 'atom', rarity: tierOf(v), value: v, sym: sym, name: giftLabel(d, d.got + ' × ' + sym) });
      } else {
        var cat = BY_ID[d.id];
        out.push({
          icon: (cat && cat.icon) || d.icon || 'award',
          rarity: RIDX[d.rarity] == null ? ((cat && cat.rarity) || 'common') : d.rarity,
          value: (d.value || 0) * d.got, sym: '',
          name: giftLabel(d, L((cat && cat.name) || d.name || { en: d.id, vi: d.id }))
        });
      }
    });
    return out;
  }

  function rowHtml(c) {
    var r = RARITIES[RIDX[c.rarity] || 0];
    return '<div class="gp-row" style="--c:' + r.color + '">' +
      '<span class="gp-ic">' + ic(c.icon) + '</span>' +
      '<span class="gp-tx"><b>' + esc(c.name) + '</b><em>' + ic(r.icon) + esc(L(r.name)) +
      (c.value > 0 ? ' · ' + esc(S('gpWorth', { n: c.value })) : '') + '</em></span>' +
      '<span class="gp-sy">' + esc(c.sym || '') + '</span></div>';
  }

  var CONF = ['#ffd76a', '#fff3c4', '#e53357', '#ff9a68', '#ffffff'];
  function confHtml(n) {
    var s = '<div class="gp-conf">';
    for (var i = 0; i < n; i++) {
      s += '<span class="gp-bit" style="left:' + (Math.random() * 100).toFixed(2) + 'vw;--dx:' +
        (Math.random() * 26 - 13).toFixed(1) + 'vw;--rot:' + (Math.random() * 900 - 450).toFixed(0) +
        'deg;--dur:' + (2.6 + Math.random() * 3.4).toFixed(2) + 's;--del:' + (Math.random() * 2.4).toFixed(2) +
        's;--bc:' + CONF[i % CONF.length] + '"></span>';
    }
    return s + '</div>';
  }

  // A tear is not a straight cut. The lid and the box are one ragged line, so the
  // piece that flies away interlocks exactly with the edge it came off.
  function seamPoints(y) {
    var pts = [], steps = 16;
    for (var i = 0; i <= steps; i++) {
      var jag = (i === 0 || i === steps) ? 0 : (Math.random() * 2 - 1) * 2.4;
      pts.push((i * 100 / steps).toFixed(2) + '% ' + (y + jag).toFixed(2) + '%');
    }
    return pts;
  }
  var RIB = '<i class="gp-stripv"></i><i class="gp-striph"></i>';

  function giftOpen(payload) {
    if (gp || cine) return false;
    payload = payload || {};
    var cards = giftCards(payload);
    if (!cards.length) return false;
    injectStyles();

    var seam = seamPoints(30);
    var lidClip = 'polygon(0% 0%, ' + seam.join(', ') + ', 100% 0%)';
    var underClip = 'polygon(' + seam.slice().reverse().join(', ') + ', 100% 100%, 0% 100%)';
    var total = cards.reduce(function (n, c) { return n + (c.value || 0); }, 0);

    var el = document.createElement('div');
    el.id = 'gp-cine';
    el.className = 'gp-cine gp-worded';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', S('gpName'));
    el.innerHTML = '<div class="gp-glow"></div>' + confHtml(26) +
      '<div class="gp-stage"><div class="gp-pack">' +
      '<div class="gp-face gp-under" style="clip-path:' + underClip + '">' + RIB + '<span class="gp-lbl">' + esc(S('gpName')) + '</span></div>' +
      '<div class="gp-hole"></div>' +
      '<div class="gp-face gp-lid" style="clip-path:' + lidClip + '">' + RIB + '<span class="gp-bow"></span></div>' +
      '</div></div>' +
      '<div class="gp-list"><div class="gp-cap">' + esc(S('gpSub')) + '</div>' +
      cards.map(rowHtml).join('') +
      '<div class="gp-foot">' + esc(S('gpTotal', { n: total })) + ' · ' + esc(S('gpLanded')) + '</div></div>' +
      '<div class="gp-top"><span class="gp-brand">' + ic('gift') + esc(S('gpName')) + '</span>' +
      '<button class="gp-skip" type="button">' + esc(S('skip')) + ic('skip-forward') + '</button></div>' +
      '<div class="gp-word">' + esc(S('gpWord')) + '</div>' +
      '<div class="gp-bar"><button class="gp-go" type="button">' + ic('check-check') + esc(S('gpGo')) + '</button></div>' +
      '<div class="gp-veil"></div>';

    var timers = [];
    function at(ms, fn) { timers.push(setTimeout(fn, ms)); }
    function cls(c) { el.classList.add(c); }
    function ended() { return el.className.indexOf('gp-end') >= 0; }
    function close() {
      timers.forEach(clearTimeout); timers = [];
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('visibilitychange', onVis);
      el.remove(); gp = null;
      if (shop()) shop().rerender();
    }
    // Skipping lands everything at rest in one frame: same final picture, no
    // second wait, and the payout was already made before this screen opened.
    function settle() {
      timers.forEach(clearTimeout); timers = [];
      el.className = 'gp-cine gp-open gp-lit gp-fly gp-end';
      el.querySelector('.gp-go').focus();
    }
    function onKey(ev) {
      if (ev.key !== 'Escape') return;
      ev.stopPropagation(); ev.preventDefault();
      if (ended()) close(); else settle();
    }
    // A background tab freezes CSS animations but not the timer clock, so a gift
    // opened out of sight would be left torn mid-air with nothing moving. It shows
    // the finished pack instead, which is the same picture the animation ends on.
    function onVis() { if (document.visibilityState !== 'visible' && !ended()) settle(); }

    document.body.appendChild(el);
    lucideIn(el);
    gp = el;
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('visibilitychange', onVis);

    var rows = Array.prototype.slice.call(el.querySelectorAll('.gp-row'));
    // The cards fly out of the mouth of the box. Where the box will stand is read
    // from its own layout box, not from a painted rect: while it is animating a
    // rect would report wherever the animation happens to have got to.
    function measure() {
      var st = el.querySelector('.gp-stage').getBoundingClientRect();
      var pack = el.querySelector('.gp-pack');
      var ph = pack.offsetHeight, pw = pack.offsetWidth;
      if (!ph || !st.width) return;
      var mx = st.left + st.width / 2;
      var my = st.top + st.height / 2 - ph / 2 + ph * 0.3;
      rows.forEach(function (r, i) {
        var b = r.getBoundingClientRect();
        r.style.setProperty('--sx', Math.round(mx - (b.left + b.width / 2)) + 'px');
        r.style.setProperty('--sy', Math.round(my - (b.top + b.height / 2)) + 'px');
        r.style.setProperty('--del', (i * 0.14).toFixed(2) + 's');
      });
    }

    SFX.gpHeld(760);
    at(900, function () { cls('gp-open'); cls('gp-lit'); cls('gp-rise'); SFX.gpPop(); });
    at(1950, function () { SFX.gpHeld(480); });
    at(2400, function () { cls('gp-tear'); SFX.gpTear(); });
    at(2720, function () { measure(); cls('gp-fly'); rows.forEach(function (r, i) { at(i * 140, function () { SFX.gpFly(i); }); }); });
    var land = 3340 + rows.length * 140;
    at(land, function () { el.classList.remove('gp-rise'); cls('gp-left'); cls('gp-done'); SFX.gpDone(); el.querySelector('.gp-go').focus(); });

    el.querySelector('.gp-skip').addEventListener('click', function () { if (ended()) close(); else settle(); });
    el.querySelector('.gp-go').addEventListener('click', close);
    if (document.visibilityState !== 'visible') settle();
    return true;
  }

  function attach(tries) {
    var e = econ(), sh = shop();
    if (!e || !sh || typeof sh.registerTab !== 'function') { if (tries < 80) setTimeout(function () { attach(tries + 1); }, 300); return; }
    injectStyles();
    sh.registerTab({ id: 'packs', order: 30, label: function () { return S('tab'); }, render: renderTab, sig: tabSig });
    e.on('balance', function () { if (!cine) sh.rerender(); });
    e.on('inventory', function () { if (!cine) sh.rerender(); });
    window.addEventListener('mol3d:lang', function () { sh.rerender(); });
    window.addEventListener('pagehide', musicStop);
    recover();
    window.__mol3dPacks = {
      packs: PACKS.map(function (p) { return { id: p.id, cost: p.cost, items: p.n, secret: !!p.king, rates: RARITIES.reduce(function (o, r, i) { o[r.id] = p.rates[i]; return o; }, {}) }; }),
      pool: POOL, rarities: RARITIES.map(function (r) { return r.id; }),
      open: openPack, roll: function (id) { return rollPack(PACKS.filter(function (x) { return x.id === id; })[0]); },
      isOpening: function () { return !!cine; },
      openGift: giftOpen
    };
    // The gift code redeem calls this once the stars, elements and titles have
    // already been paid, so the animation can only ever show what is real.
    window.__mol3dGiftPack = giftOpen;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { attach(0); });
  else attach(0);
})();
