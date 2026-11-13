/* Random global events. A check runs every five minutes of wall-clock time with a
   20% trigger chance; the next check time is persisted, so a reload or a closed
   tab resumes on the same schedule. Everything is client-side: the schedule, the
   dice and the payouts live in this browser and are tamper-evident at best, not
   server-verified. Every payout goes through the economy's transaction log with a
   deterministic id, so a reward or penalty can land at most once. */
(function () {
  'use strict';
  if (window.__mol3dEvents) return;

  var KEY = 'mol3d.events.v1';
  var CHECK_MS = 5 * 60 * 1000;
  var CHANCE = 0.2;
  var MAX_CATCHUP = 48;
  var MIN = 60 * 1000;

  var DEFS = {
    peak: { dur: 5 * MIN, icon: 'badge-percent',
      name: { en: 'PEAK DISCOUNT', vi: 'SIÊU GIẢM GIÁ' },
      desc: { en: 'PEAK DISCOUNT IS LIVE! EVERYTHING IS CHEAPER!', vi: 'SIÊU GIẢM GIÁ ĐANG DIỄN RA! MỌI THỨ ĐỀU RẺ HƠN!' } },
    assembly: { dur: 8 * MIN, icon: 'atom',
      name: { en: 'MOLECULE ASSEMBLY CHALLENGE', vi: 'THỬ THÁCH LẮP RÁP PHÂN TỬ' },
      desc: { en: 'Build 10 molecules bond by bond. +10★ per correct round, −5★ per failed round, +100★ for all 10.', vi: 'Lắp 10 phân tử từng liên kết. +10★ mỗi vòng đúng, −5★ mỗi vòng sai, +100★ nếu đúng cả 10.' } },
    rush: { dur: 3 * MIN, icon: 'zap',
      name: { en: 'STAR RUSH', vi: 'CƠN SỐT SAO' },
      desc: { en: '2× Stars from discoveries and quests.', vi: 'Nhận gấp đôi sao từ khám phá và nhiệm vụ.' } },
    overload: { dur: 2 * MIN, icon: 'radiation',
      name: { en: 'ATOMIC OVERLOAD', vi: 'QUÁ TẢI NGUYÊN TỬ' },
      desc: { en: 'Atoms are popping up everywhere — tap them for 2–5★ each (max 30).', vi: 'Nguyên tử xuất hiện khắp nơi — chạm để nhận 2–5★ mỗi cái (tối đa 30).' } },
    market: { dur: 4 * MIN, icon: 'venetian-mask',
      name: { en: 'BLACK MARKET', vi: 'CHỢ ĐEN' },
      desc: { en: 'A shady dealer offers 20–70% off a rotating selection. Event tab in the shop.', vi: 'Một tay buôn mờ ám giảm 20–70% cho vài món ngẫu nhiên. Xem tab Sự kiện trong cửa hàng.' } },
    golden: { dur: 3 * MIN, icon: 'hexagon',
      name: { en: 'GOLDEN MOLECULE', vi: 'PHÂN TỬ VÀNG' },
      desc: { en: 'A golden molecule appears now and then. First catch +50★, later catches +10★.', vi: 'Thỉnh thoảng một phân tử vàng xuất hiện. Bắt lần đầu +50★, các lần sau +10★.' } },
    // Not part of the dice: the King's window is fixed to the clock (see kingSlot).
    king: { dur: 10 * MIN, icon: 'crown',
      name: { en: 'HE HAS SEEN YOUR PATIENCE!', vi: 'HẮN ĐÃ THẤY SỰ KIÊN NHẪN CỦA NGƯỠI!' },
      desc: { en: 'For 10 minutes every hour: refund crate elements at 1.5× value and open his crate, 5000★, in the Event tab of the shop.', vi: '10 phút mỗi giờ: hoàn nguyên tố trong kho lấy 1.5× giá trị và mở rương của Người, 5000★, ở tab Sự kiện trong cửa hàng.' } }
  };
  var KING_PERIOD = 60 * MIN;
  var KING_DUR = DEFS.king.dur;
  var KING_RATE = 1.5;
  // The 1.5× is a gift, not a money printer: buying at face and refunding at 1.5×
  // would compound without limit, so the extra half is capped per window. Refunds
  // past the cap still pay full face value, and the tab says so.
  var KING_BONUS_CAP = 2500;
  var KINDS = Object.keys(DEFS).filter(function (k) { return k !== 'king'; });

  var STR = {
    en: {
      status: 'EVENT STATUS', none: 'No event is active', next: 'Next event check in',
      chance: 'Every 5 minutes there is a 20% chance that one event starts.',
      left: 'Time left', progress: 'Your progress', started: 'EVENT STARTED', ended: 'EVENT ENDED',
      endedMsg: 'Normal prices and gameplay are back. Everything you earned is kept.',
      resumed: 'Event in progress', close: 'Close', open: 'Open',
      tab: 'Event', local: 'Local save — the schedule and rewards run in this browser and are not server-verified.',
      round: 'Round {n}/10', streak: 'Streak {n}', build: 'Build', submit: 'Check structure', reset: 'Clear bonds',
      skip: 'Give up round', correct: 'Correct! +{n}★', wrong: 'Not the right structure. −{n}★',
      bonus: 'All 10 correct! +{n}★ bonus', done: 'Challenge finished: {c}/10 correct.',
      hintAsm: 'Tap an atom, then another, to add a bond. Tap the same pair again to raise the order (up to triple, then removed). Tap a bond line to lower it.',
      valence: 'Bonds used / normal valence', collected: 'Collected {n}/{m}', golden: 'Golden catches {n}',
      rushEarned: 'Extra stars from the rush: {n}', buy: 'Buy', bought: 'Sold out', expires: 'Offers expire in',
      poor: 'Not enough stars', play: 'Play the challenge', earned: 'Earned {n}★',
      noEvShop: 'No event shop right now. Black Market offers and the King’s desk appear here during those events.',
      issueDisc: 'Some atoms are not connected.', issueVal: 'An atom has the wrong number of bonds for its normal valence.',
      issueIso: 'Valid bonding, but a different arrangement (isomer) from the target.',
      el: '{n} × {s} atoms', ammo: '{n} × {k} ammo', feat: 'Feature: {f}',
      kingCry: 'HE HAS SEEN YOUR PATIENCE!', kingDesk: 'REFUND DESK',
      kingRate: 'Every atom in your crate refunds at {r}× its shelf price while the window is open. Bonus left: {c}★',
      kingSpent: 'The bonus is used up for this window: further refunds pay shelf value.',
      kingEmpty: 'Your crate holds no atoms to refund.',
      kingEach: '{u}★ each', kingAll: 'ALL', kingSellAll: 'Refund the whole crate',
      kingPack: 'King Pack · {c}★', kingPaid: 'Refunded {n} × {s} for {v}★',
      kingPaidAll: 'Refunded {n} atoms from the crate for {v}★',
      kingProg: '{n} atoms refunded · {v}★ paid · bonus {b}/{c}★ used',
      kingCrate: 'HIS CRATE', kingCrateNote: 'Never on the crate shelf — it is only here, and only while He watches.',
      kingCrateItems: '{n} samples · 1 exclusive title', kingOpen: 'OPEN'
    },
    vi: {
      status: 'TRẠNG THÁI SỰ KIỆN', none: 'Không có sự kiện nào', next: 'Lần kiểm tra sự kiện tới sau',
      chance: 'Cứ 5 phút có 20% khả năng một sự kiện bắt đầu.',
      left: 'Thời gian còn lại', progress: 'Tiến độ của bạn', started: 'SỰ KIỆN BẮT ĐẦU', ended: 'SỰ KIỆN KẾT THÚC',
      endedMsg: 'Giá và lối chơi đã trở lại bình thường. Mọi phần thưởng bạn kiếm được vẫn giữ nguyên.',
      resumed: 'Sự kiện đang diễn ra', close: 'Đóng', open: 'Mở',
      tab: 'Sự kiện', local: 'Lưu cục bộ — lịch và phần thưởng chạy trong trình duyệt này, không được máy chủ xác thực.',
      round: 'Vòng {n}/10', streak: 'Chuỗi {n}', build: 'Lắp', submit: 'Kiểm tra cấu trúc', reset: 'Xóa liên kết',
      skip: 'Bỏ vòng này', correct: 'Chính xác! +{n}★', wrong: 'Chưa đúng cấu trúc. −{n}★',
      bonus: 'Đúng cả 10! Thưởng thêm +{n}★', done: 'Thử thách kết thúc: đúng {c}/10.',
      hintAsm: 'Chạm một nguyên tử rồi nguyên tử khác để nối. Chạm lại cặp đó để tăng bậc (tối đa ba, rồi xóa). Chạm vào đường liên kết để giảm bậc.',
      valence: 'Số liên kết / hóa trị thường', collected: 'Đã nhặt {n}/{m}', golden: 'Đã bắt {n} lần',
      rushEarned: 'Sao thêm từ sự kiện: {n}', buy: 'Mua', bought: 'Đã bán', expires: 'Ưu đãi hết hạn sau',
      poor: 'Không đủ sao', play: 'Chơi thử thách', earned: 'Đã nhận {n}★',
      noEvShop: 'Hiện chưa có cửa hàng sự kiện. Ưu đãi Chợ Đen và quầy của Người sẽ xuất hiện ở đây khi các sự kiện đó diễn ra.',
      issueDisc: 'Có nguyên tử chưa được nối.', issueVal: 'Có nguyên tử sai số liên kết so với hóa trị thường.',
      issueIso: 'Liên kết hợp lệ nhưng là cách sắp xếp khác (đồng phân) với mục tiêu.',
      el: '{n} × nguyên tử {s}', ammo: '{n} × đạn {k}', feat: 'Tính năng: {f}',
      kingCry: 'HẮN ĐÃ THẤY SỰ KIÊN NHẪN CỦA NGƯỠI!', kingDesk: 'QUẦY HOÀN TRẢ',
      kingRate: 'Mỗi nguyên tử trong kho hoàn lại gấp {r}× giá niêm phong khi sự kiện mở. Phần thưởng còn: {c}★',
      kingSpent: 'Đã hết phần thưởng tăng thêm trong lần mở này: các lần hoàn sau trả đúng giá niêm phong.',
      kingEmpty: 'Kho của bạn không còn nguyên tố nào để hoàn.',
      kingEach: '{u}★ mỗi nguyên tử', kingAll: 'TẤT CẢ', kingSellAll: 'Hoàn toàn bộ kho',
      kingPack: 'King Pack · {c}★', kingPaid: 'Đã hoàn {n} × {s} lấy {v}★',
      kingPaidAll: 'Đã hoàn {n} nguyên tử trong kho lấy {v}★',
      kingProg: 'đã hoàn {n} nguyên tử · trả {v}★ · dùng {b}/{c}★ thưởng',
      kingCrate: 'RƯƠNG CỦA NGƯỜI', kingCrateNote: 'Chưa bao giờ bày ở kệ thùng — chỉ có ở đây, và chỉ khi Người đang ngắm.',
      kingCrateItems: '{n} mẫu · kèm 1 danh hiệu độc quyền', kingOpen: 'MỞ'
    }
  };

  function econ() { return window.__mol3dEcon || null; }
  function shop() { return window.__mol3dShop || null; }
  function lang() { try { return localStorage.getItem('mol3d.lang') === 'en' ? 'en' : 'vi'; } catch (e) { return 'vi'; } }
  function S(k) { return STR[lang()][k] || STR.en[k] || k; }
  function sf(k, p) { var s = S(k); for (var x in p) s = s.split('{' + x + '}').join(String(p[x])); return s; }
  function L(v) { return v ? (v[lang()] || v.en || '') : ''; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function clock(ms) { var e = econ(); return e ? e.clock(ms) : Math.ceil(ms / 1000) + 's'; }
  function rand() { var e = econ(); return e ? e.rand() : Math.random(); }
  function randInt(a, b) { return a + Math.floor(rand() * (b - a + 1)); }

  /* ── persistence ── */
  var st = { next: 0, last: '', king: 0, prog: {} };
  function load() {
    try {
      var d = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (d && typeof d === 'object') {
        st.next = Number(d.next) || 0;
        st.last = typeof d.last === 'string' ? d.last : '';
        st.king = Number(d.king) || 0;
        st.prog = d.prog && typeof d.prog === 'object' ? d.prog : {};
      }
    } catch (e) {}
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }
  function prog(ev) {
    if (!ev) return {};
    if (!st.prog[ev.id]) {
      st.prog = {};
      st.prog[ev.id] = { round: 0, streak: 0, correct: 0, results: [], collected: 0, golden: 0, rush: 0, earned: 0, layout: null, kingUnits: 0, kingBonus: 0, kingPaid: 0 };
    }
    return st.prog[ev.id];
  }

  /* ── exactly-once money ── */
  function award(txId, amount, reason) {
    var e = econ();
    if (!e || !(amount > 0) || e.tx(txId)) return 0;
    var r = e.purchase({ id: txId, kind: 'event', cost: 0, meta: { reason: reason },
      rewards: [{ id: 'stars', kind: 'stars', value: amount, name: { en: 'Stars', vi: 'Sao' } }] });
    if (!r.ok) return 0;
    e.claim(txId);
    return amount;
  }
  function penalty(txId, amount) {
    var e = econ();
    if (!e || e.tx(txId)) return 0;
    // Never below zero: the penalty is capped at what the player actually holds.
    var cost = Math.max(0, Math.min(amount, Math.floor(e.balance())));
    var r = e.purchase({ id: txId, kind: 'event-penalty', cost: cost, rewards: [] });
    if (r.ok) e.claim(txId);
    return r.ok ? cost : 0;
  }

  /* ── audio ── */
  var ac = null;
  function ctx() {
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (ac.state === 'suspended') ac.resume().catch(function () {});
    return ac;
  }
  function vol() { var s = document.getElementById('volume-slider'); return s ? Math.max(0, Math.min(1, Number(s.value) / 100)) : 0.5; }
  function tone(f, d, type, g, at) {
    var c = ctx(); if (!c) return;
    var t = c.currentTime + (at || 0), o = c.createOscillator(), a = c.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    a.gain.setValueAtTime(0.0001, t);
    a.gain.exponentialRampToValueAtTime(Math.max(0.0002, (g || 0.15) * vol()), t + 0.02);
    a.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(a); a.connect(c.destination); o.start(t); o.stop(t + d + 0.05);
  }
  var SOUNDS = {
    peak: function () { [784, 988, 1175, 1568].forEach(function (f, i) { tone(f, 0.35, 'triangle', 0.18, i * 0.09); }); },
    assembly: function () { [392, 523, 659].forEach(function (f, i) { tone(f, 0.3, 'square', 0.08, i * 0.12); }); },
    rush: function () { for (var i = 0; i < 6; i++) tone(880 + i * 140, 0.12, 'sine', 0.14, i * 0.05); },
    overload: function () { tone(110, 0.6, 'sawtooth', 0.12); tone(220, 0.5, 'square', 0.06, 0.1); },
    market: function () { tone(146, 0.7, 'sawtooth', 0.12); tone(155, 0.7, 'sawtooth', 0.1, 0.05); tone(98, 0.9, 'sine', 0.18, 0.2); },
    golden: function () { [1047, 1319, 1568, 2093].forEach(function (f, i) { tone(f, 0.5, 'sine', 0.14, i * 0.07); }); },
    // A regal minor fanfare over a rumble: he does not arrive cheerfully.
    king: function () { [392, 370, 311, 262].forEach(function (f, i) { tone(f, 0.6, 'sawtooth', 0.09, i * 0.16); }); tone(65, 2.0, 'sine', 0.16); tone(98, 1.4, 'triangle', 0.07, 0.3); },
    kingSell: function () { tone(523, 0.14, 'triangle', 0.14); tone(784, 0.2, 'triangle', 0.12, null, 0.07); },
    end: function () { [659, 523, 392].forEach(function (f, i) { tone(f, 0.25, 'triangle', 0.1, i * 0.1); }); },
    good: function () { tone(880, 0.12, 'sine', 0.16); tone(1320, 0.18, 'sine', 0.14, 0.08); },
    bad: function () { tone(180, 0.3, 'square', 0.1); },
    pop: function () { tone(randInt(600, 1200), 0.09, 'triangle', 0.14); }
  };
  function play(k) { try { SOUNDS[k] && SOUNDS[k](); } catch (e) {} }

  /* ── styles ── */
  function injectStyles() {
    if (document.getElementById('ev-styles')) return;
    var s = document.createElement('style');
    s.id = 'ev-styles';
    s.textContent = [
      '#ev-toast{position:fixed;left:50%;top:calc(64px * var(--ui-scale,1));transform:translate(-50%,-20px);opacity:0;z-index:9500;pointer-events:none;',
      ' min-width:min(92vw,300px);max-width:min(92vw,520px);padding:12px 18px;border-radius:14px;text-align:center;color:#fff;',
      ' background:rgba(8,14,28,.94);border:2px solid var(--ev-c,#00d4ff);box-shadow:0 0 28px var(--ev-c,#00d4ff);transition:all .45s cubic-bezier(.2,1.4,.4,1);}',
      '#ev-toast.show{opacity:1;transform:translate(-50%,0);}',
      '#ev-toast .ev-t-k{font-size:11px;letter-spacing:2px;opacity:.75;font-weight:800;}',
      '#ev-toast .ev-t-n{font-size:clamp(16px,3.2vw,24px);font-weight:900;letter-spacing:1px;color:var(--ev-c);text-shadow:0 0 12px var(--ev-c);}',
      '#ev-toast .ev-t-d{font-size:13px;margin-top:4px;opacity:.92;}',
      '#ev-toast .ev-t-c{font-size:13px;margin-top:6px;font-weight:800;font-variant-numeric:tabular-nums;}',
      '[data-ev-kind]{--ev-c:#00d4ff;}',
      '[data-ev-kind="peak"],[data-ev-kind="golden"]{--ev-c:#ffcc33;}',
      '[data-ev-kind="assembly"]{--ev-c:#00ffc8;}[data-ev-kind="rush"]{--ev-c:#ffe066;}',
      '[data-ev-kind="overload"]{--ev-c:#7cff4d;}[data-ev-kind="market"]{--ev-c:#d23cff;}[data-ev-kind="end"]{--ev-c:#8aa0b8;}',
      '#ev-status{position:fixed;right:12px;top:calc(60px * var(--ui-scale,1));z-index:9400;width:min(92vw,340px);max-height:70vh;overflow:auto;',
      ' background:var(--panel-bg,rgba(10,16,30,.96));color:var(--text,#e6f1ff);border:1px solid var(--ev-c,#00d4ff);border-radius:12px;',
      ' box-shadow:0 10px 40px rgba(0,0,0,.5);padding:12px 14px;font-size:13px;}',
      // --panel-bg has never existed, so the fallback above was silently a dark
      // panel in both themes while --text flipped to ink: 1.2:1. The status console
      // is app chrome, so it takes the real shell tokens; the neon accent keeps its
      // role through --ev-ink, which only exists on the light shell.
      'html[data-theme="light"] #ev-status{background:rgba(255,255,255,.88);border-color:var(--ev-ink,var(--ev-c))}',
      'html[data-theme="light"] [data-ev-kind]{--ev-ink:#0369a1}',
      'html[data-theme="light"] [data-ev-kind="peak"],html[data-theme="light"] [data-ev-kind="golden"]{--ev-ink:#8a5a00}',
      'html[data-theme="light"] [data-ev-kind="assembly"]{--ev-ink:#0b6b53}',
      'html[data-theme="light"] [data-ev-kind="rush"]{--ev-ink:#7a5a00}',
      'html[data-theme="light"] [data-ev-kind="overload"]{--ev-ink:#2f6b12}',
      'html[data-theme="light"] [data-ev-kind="market"]{--ev-ink:#861b9e}',
      'html[data-theme="light"] [data-ev-kind="end"]{--ev-ink:#4a5a72}',
      'html[data-theme="light"] [data-ev-kind="king"]{--ev-ink:#9d1b1b}',
      '#ev-status[hidden],#ev-asm[hidden]{display:none;}',
      '#ev-status h3{margin:0 0 8px;font-size:12px;letter-spacing:2px;color:var(--ev-ink,var(--ev-c));display:flex;justify-content:space-between;align-items:center;}',
      '#ev-status .ev-big{font-size:17px;font-weight:900;color:var(--ev-ink,var(--ev-c));}',
      '.ev-lc{width:1em;height:1em;vertical-align:-0.15em;stroke-width:2.4}',
      '#ev-status .ev-clock{font-size:22px;font-weight:900;font-variant-numeric:tabular-nums;margin:4px 0;}',
      '#ev-status .ev-note{font-size:11px;opacity:.65;margin-top:8px;}',
      '.ev-x{background:none;border:0;color:inherit;font-size:18px;cursor:pointer;line-height:1;padding:2px 6px;}',
      '.ev-btn{font:inherit;font-weight:800;border-radius:8px;padding:6px 12px;cursor:pointer;border:1px solid var(--ev-ink,var(--ev-c,#00d4ff));',
      ' background:rgba(0,212,255,.12);color:inherit;}',
      '.ev-btn:disabled{opacity:.45;cursor:default;}',
      '#ev-layer{position:fixed;inset:0;pointer-events:none;z-index:9300;overflow:hidden;}',
      '.ev-atom{position:absolute;pointer-events:auto;border:0;border-radius:50%;cursor:pointer;color:#fff;font-weight:900;',
      ' display:flex;align-items:center;justify-content:center;box-shadow:0 0 16px currentColor,inset -6px -8px 14px rgba(0,0,0,.35);',
      ' animation:evPop .35s cubic-bezier(.2,1.6,.4,1),evBob 1.6s ease-in-out .35s infinite alternate;}',
      '.ev-atom span{color:#fff;text-shadow:0 1px 3px #000;}',
      '.ev-gold{position:absolute;pointer-events:auto;cursor:pointer;border:0;background:none;width:76px;height:76px;padding:0;',
      ' filter:drop-shadow(0 0 14px #ffcc33) drop-shadow(0 0 30px #ffaa00);animation:evPop .4s ease-out,evSpin 4s linear infinite;}',
      '@keyframes evPop{from{transform:scale(0)}to{transform:scale(1)}}',
      '@keyframes evBob{from{translate:0 -4px}to{translate:0 4px}}',
      '@keyframes evSpin{to{rotate:360deg}}',
      '.ev-spark{position:absolute;width:6px;height:6px;border-radius:50%;pointer-events:none;transition:transform .6s ease-out,opacity .6s ease-out;}',
      '.ev-fly{position:fixed;z-index:9600;pointer-events:none;color:#ffd84a;font-size:18px;text-shadow:0 0 8px #ffb300;',
      ' transition:transform .9s cubic-bezier(.5,-.2,.6,1),opacity .9s;}',
      '.ev-gain{position:absolute;pointer-events:none;font-weight:900;color:#ffe066;text-shadow:0 0 6px #000;transition:all .9s ease-out;}',
      /* golden shop during Peak Discount */
      'body[data-ev-kind="peak"] #shop-panel{border-color:#ffcc33 !important;box-shadow:0 0 40px rgba(255,204,51,.55),inset 0 0 60px rgba(255,190,40,.12) !important;',
      ' background-image:radial-gradient(circle at 20% 10%,rgba(255,214,90,.18),transparent 45%),radial-gradient(circle at 80% 90%,rgba(255,170,0,.16),transparent 50%) !important;}',
      'body[data-ev-kind="peak"] #shop-panel .ec-p[data-src="peak"] .ec-badge{animation:evFlash .8s steps(2) infinite;background:#ffcc33 !important;color:#2a1a00 !important;}',
      'body[data-ev-kind="market"] #shop-panel{border-color:#d23cff !important;box-shadow:0 0 34px rgba(210,60,255,.45) !important;}',
      '@keyframes evFlash{50%{opacity:.35}}',
      '.ev-shop-banner{position:relative;overflow:hidden;margin:8px 12px 0;padding:8px 12px;border-radius:10px;text-align:center;font-weight:900;letter-spacing:.5px;}',
      '.ev-shop-banner[data-k="peak"]{color:#2a1a00;background:linear-gradient(90deg,#b8860b,#ffd84a,#fff3b0,#ffd84a,#b8860b);background-size:200% 100%;animation:evShine 2.4s linear infinite;}',
      '.ev-shop-banner[data-k="market"]{color:#ffd6f4;background:linear-gradient(135deg,#140014,#3a0030,#1d0040);border:1px solid #ff2a6d;}',
      '.ev-shop-banner .ev-sb-c{display:block;font-size:12px;font-variant-numeric:tabular-nums;opacity:.85;}',
      '.ev-shop-banner i{position:absolute;width:4px;height:4px;border-radius:50%;background:#fff;opacity:.8;animation:evRise 2s linear infinite;pointer-events:none;}',
      '@keyframes evShine{to{background-position:-200% 0}}',
      '@keyframes evRise{from{transform:translateY(30px);opacity:0}30%{opacity:.9}to{transform:translateY(-20px);opacity:0}}',
      /* event shop tab */
      '.ev-tab{padding:10px 12px;display:flex;flex-direction:column;gap:10px;}',
      '.ev-tab[data-k="market"]{background:linear-gradient(160deg,#0b0010,#1a0420 60%,#0b0010);border-radius:12px;color:#f3d9ff;}',
      /* Three surfaces are deliberate night skins — the black market, the King's
         desk and his crate. Their own inks are literal, but the price chips, badges
         and icons they embed read the shell tokens, and on the light shell those
         tokens are ink: 2.8:1 on near-black. So the tokens are pinned here too,
         which keeps each skin byte-identical in both themes. */
      'html[data-theme="light"] .ev-tab[data-k="market"]{color-scheme:dark;--text:#f3d9ff;--muted:#c2a3d8;--amber:#ffcf6a;',
      ' --ok-text:#7ee2a8;--err-text:#ff9ab5;--accent:#e464ff;--ev-ink:#f36ad5;--panel:rgba(14,4,22,.92);--panel-2:rgba(26,8,34,.94);--border:rgba(210,60,255,.3);}',
      'html[data-theme="light"] .ev-king,html[data-theme="light"] .ev-kpack{color-scheme:dark;--text:#ffe9d6;--muted:#d9ad84;--amber:#ffd23f;',
      ' --ok-text:#8ef0b6;--err-text:#ff9a9a;--accent:#ffd23f;--ev-ink:#ffd23f;--panel:rgba(26,2,4,.92);--panel-2:rgba(42,6,8,.94);--border:rgba(255,210,63,.32);}',
      '.ev-offers{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;}',
      '.ev-offer{border:1px solid #7a1fa2;border-radius:10px;padding:8px;display:flex;flex-direction:column;gap:6px;',
      ' background:linear-gradient(160deg,rgba(255,42,109,.12),rgba(130,40,255,.14));}',
      '.ev-offer .ev-off{align-self:flex-start;background:#ff2a6d;color:#fff;font-weight:900;font-size:11px;border-radius:99px;padding:1px 7px;}',
      '.ev-offer .ev-btn{border-color:#ff2a6d;background:rgba(255,42,109,.18);}',
      /* assembly */
      // The assembly console is a game board, not app chrome: neon mint on near
      // black, in both shells. Its inks are therefore pinned here rather than read
      // from --text, which would flip to ink on the light shell and sit on black.
      '#ev-asm{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:9450;width:min(96vw,460px);max-height:92vh;overflow:auto;',
      ' background:rgba(8,14,26,.97);color:#e6f1ff;border:2px solid #00ffc8;border-radius:14px;padding:10px 12px;',
      ' box-shadow:0 0 40px rgba(0,255,200,.25);--ev-c:#00ffc8;--ev-ink:#00ffc8;--text:#e6f1ff;--muted:#9fb2c8;}',
      '#ev-asm .ev-asm-h{display:flex;justify-content:space-between;align-items:center;font-weight:900;}',
      '#ev-asm .ev-target{font-size:26px;font-weight:900;text-align:center;color:#00ffc8;margin:2px 0;}',
      '#ev-asm svg{width:100%;height:auto;display:block;background:rgba(0,0,0,.25);border-radius:10px;touch-action:manipulation;}',
      '#ev-asm .ev-row{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-top:8px;}',
      '#ev-asm .ev-msg{min-height:20px;text-align:center;font-weight:800;margin-top:6px;}',
      '#ev-asm .ev-hint{font-size:11px;opacity:.7;margin-top:6px;}',
      '#ev-asm .ev-dots{display:flex;gap:4px;justify-content:center;margin-top:4px;}',
      '#ev-asm .ev-dots b{width:10px;height:10px;border-radius:50%;background:rgba(255,255,255,.15);}',
      '#ev-asm .ev-dots b[data-r="1"]{background:#00ff88;}#ev-asm .ev-dots b[data-r="0"]{background:#ff3366;}',
      '.hud-chip[data-ev="peak"],.hud-chip[data-ev="golden"]{color:#ffcc33;border-color:rgba(255,204,51,.6);}',
      '.hud-chip[data-ev="market"]{color:#ff6ad5;border-color:rgba(210,60,255,.6);}',
      '.hud-chip[data-ev="rush"]{color:#ffe066;border-color:rgba(255,224,102,.6);animation:evFlash 1.2s ease-in-out infinite;}',
      /* the King: the red gradient line, and the refund desk behind it */
      '[data-ev-kind="king"]{--ev-c:#ff3b3b;}',
      // The King's chip used to put near-black ink on a red-to-gold ramp: 2:1 at the
      // red end. His colours stay, but the ink now sits on the dark half only.
      '.hud-chip.hud-event[data-ev="king"]{background:linear-gradient(120deg,#3f0404,#a81219);color:#ffd23f;border-color:#ffd23f;}',
      // z-index 61: over the scene, under the shop (rig 62) and under every dialog.
      '#ev-king{position:fixed;left:0;right:0;top:var(--top-h,56px);z-index:61;cursor:pointer;text-align:center;',
      ' padding:calc(5px * var(--ui-scale,1)) calc(10px * var(--ui-scale,1));color:#fff2c4;',
      ' background:linear-gradient(90deg,#2b0005,#8f1010 14%,#e01b24 34%,#ff6b1a 47%,#ffd23f 50%,#ff6b1a 53%,#e01b24 66%,#8f1010 86%,#2b0005);',
      ' background-size:220% 100%;animation:evKing 4.5s linear infinite;border-bottom:2px solid #ffd23f;',
      ' box-shadow:0 8px 30px rgba(224,27,36,.5);}',
      '#ev-king .ev-k-cry{display:block;font-weight:900;letter-spacing:calc(1.5px * var(--ui-scale,1));',
      ' font-size:calc(13px * var(--ui-scale,1));text-shadow:0 1px 2px rgba(60,0,0,.85);}',
      '#ev-king .ev-k-sub{display:block;font-size:calc(10.5px * var(--ui-scale,1));font-weight:700;color:#3a0505;}',
      '#ev-king .ev-k-c{display:block;font-size:calc(10.5px * var(--ui-scale,1));font-weight:900;color:#2b0005;font-variant-numeric:tabular-nums;}',
      '@keyframes evKing{to{background-position:-220% 0}}',
      // The line sits where the health bar and FPS chip live: move them down by the
      // height the line actually measured, which grows when the text wraps on a phone.
      'body[data-ev-kind="king"] .health-bar-container,body[data-ev-kind="king"] #fps-chip{top:calc(var(--top-h,56px) + var(--king-h,54px) + 8px);}',
      // Opaque, not translucent over the shop panel: these are night skins, and a
      // 40% red wash over a light panel turns to mud under a gold heading. The stops
      // are the colours the old alphas composited to on the dark shell.
      '.ev-king{display:flex;flex-direction:column;gap:6px;border:1px solid #e01b24;border-radius:10px;padding:8px;',
      ' background:linear-gradient(160deg,#3d1418,#150103 78%);}',
      '.ev-king-h{font-weight:900;letter-spacing:1.5px;color:#ffd23f;}',
      '.ev-king-note{font-size:calc(11px * var(--ui-scale,1));opacity:.92;}',
      '.ev-rf-list{display:flex;flex-direction:column;gap:4px;max-height:min(44vh,320px);overflow:auto;}',
      '.ev-rf{display:flex;align-items:center;gap:6px;border:1px solid rgba(255,210,63,.28);border-radius:8px;padding:4px 6px;}',
      '.ev-rf-s{min-width:2.2em;font-weight:900;color:#ffd23f;}',
      '.ev-rf-m{flex:1 1 auto;min-width:0;font-size:calc(11px * var(--ui-scale,1));overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.ev-rf-b{display:flex;gap:3px;flex:none;}',
      '.ev-rf .ev-btn,.ev-rf-all .ev-btn{padding:calc(6px * var(--ui-scale,1)) calc(9px * var(--ui-scale,1));',
      ' min-width:var(--tap,38px);font-size:calc(11px * var(--ui-scale,1));border-color:#e01b24;background:rgba(224,27,36,.2);}',
      '.ev-rf-all{display:flex;gap:6px;flex-wrap:wrap;}',
      // His crate, sold only here: the black market card's shape in the King's own
      // red and gold, so it reads as an event offer rather than shop stock.
      '.ev-kpack{display:flex;flex-direction:column;gap:6px;border:1px solid #ffd23f;border-radius:10px;padding:8px;',
      ' background:linear-gradient(150deg,#550f17,#3c1621 46%,#42331f);}',
      '.ev-kpack-h{display:flex;align-items:center;gap:6px;font-weight:900;letter-spacing:1.5px;color:#ffd23f;}',
      '.ev-kpack-h svg.lucide{width:1em;height:1em;margin:0;}',
      '.ev-kpack-note{font-size:calc(11px * var(--ui-scale,1));opacity:.85;font-style:italic;}',
      '.ev-kpack-meta{display:flex;align-items:center;gap:5px;font-size:calc(11.5px * var(--ui-scale,1));font-weight:700;color:#fff2c4;}',
      '.ev-kpack-meta svg.lucide{width:1em;height:1em;margin:0;}',
      '.ev-kpack-buy{align-self:flex-start;border:0;background:linear-gradient(#ffd23f,#e01b24);color:#2a0306;',
      ' font-weight:900;padding:calc(7px * var(--ui-scale,1)) calc(12px * var(--ui-scale,1));',
      ' min-width:var(--tap,38px);font-size:calc(12px * var(--ui-scale,1));}',
      '.ev-kpack-buy:disabled{filter:grayscale(.8);opacity:.55;cursor:not-allowed;}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ── notifications ── */
  var toastTimer = 0;
  function ic(n) { return n ? '<i data-lucide="' + n + '" class="ev-lc"></i> ' : ''; }
  function lucideIn(root) { if (root && window.lucide && window.lucide.createIcons) { try { window.lucide.createIcons({ nameAttr: 'data-lucide', root: root }); } catch (e) {} } }
  function toast(kind, head, name, desc, countdownEnds) {
    var t = document.getElementById('ev-toast');
    if (!t) { t = document.createElement('div'); t.id = 'ev-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.dataset.evKind = kind;
    t.innerHTML = '<div class="ev-t-k">' + esc(head) + '</div><div class="ev-t-n">' + name + '</div>' +
      '<div class="ev-t-d">' + esc(desc) + '</div>' + (countdownEnds ? '<div class="ev-t-c" data-ends="' + countdownEnds + '"></div>' : '');
    lucideIn(t);
    t.offsetWidth;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 6500);
    paintClocks();
  }

  /* ── status panel ── */
  var statusEl = null;
  function openStatus() {
    injectStyles();
    if (!statusEl) {
      statusEl = document.createElement('div');
      statusEl.id = 'ev-status';
      statusEl.setAttribute('role', 'dialog');
      document.body.appendChild(statusEl);
      statusEl.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('[data-ev-act]');
        if (!b) return;
        var a = b.dataset.evAct;
        if (a === 'close') statusEl.hidden = true;
        else if (a === 'asm') openAssembly();
        else if (a === 'shop' && shop()) shop().showTab('events');
      });
    }
    statusEl.hidden = false;
    renderStatus();
  }
  function progressText(ev) {
    var p = prog(ev), k = ev.kind;
    if (k === 'assembly') return sf('round', { n: Math.min(10, p.round + 1) }) + ' · ' + sf('streak', { n: p.streak }) + ' · ' + sf('earned', { n: p.earned });
    if (k === 'overload') return sf('collected', { n: p.collected, m: OVERLOAD_CAP }) + ' · ' + sf('earned', { n: p.earned });
    if (k === 'golden') return sf('golden', { n: p.golden }) + ' · ' + sf('earned', { n: p.earned });
    if (k === 'rush') return sf('rushEarned', { n: p.rush });
    if (k === 'king') return sf('kingProg', { n: p.kingUnits || 0, v: p.kingPaid || 0, b: p.kingBonus || 0, c: KING_BONUS_CAP });
    if (k === 'market') { var m = econ() && econ().market(); return m ? m.items.length + ' offers' : ''; }
    return '';
  }
  function renderStatus() {
    if (!statusEl || statusEl.hidden) return;
    var ev = econ() && econ().event();
    statusEl.dataset.evKind = ev ? ev.kind : 'end';
    var html = '<h3><span>' + esc(S('status')) + '</span><button class="ev-x" data-ev-act="close" aria-label="' + esc(S('close')) + '">\u00d7</button></h3>';
    if (ev) {
      var d = DEFS[ev.kind] || {};
      html += '<div class="ev-big">' + ic(d.icon) + esc(L(d.name)) + '</div>' +
        '<div>' + esc(L(d.desc)) + '</div>' +
        '<div class="ev-clock" data-ends="' + ev.ends + '"></div><div style="opacity:.7">' + esc(S('left')) + '</div>' +
        '<div style="margin-top:8px"><b>' + esc(S('progress')) + ':</b> <span data-ev-prog>' + esc(progressText(ev)) + '</span></div>';
      if (ev.kind === 'assembly') html += '<div style="margin-top:8px"><button class="ev-btn" data-ev-act="asm">' + esc(S('play')) + '</button></div>';
      if (ev.kind === 'market' || ev.kind === 'peak' || ev.kind === 'king') html += '<div style="margin-top:8px"><button class="ev-btn" data-ev-act="shop">' + esc(S('open')) + ' \u2192 ' + esc(S('tab')) + '</button></div>';
    } else {
      html += '<div class="ev-big">' + esc(S('none')) + '</div><div style="margin-top:6px">' + esc(S('next')) + '</div>' +
        '<div class="ev-clock" data-ends="' + st.next + '"></div><div>' + esc(S('chance')) + '</div>';
    }
    html += '<div class="ev-note">' + esc(S('local')) + '</div>';
    statusEl.innerHTML = html; lucideIn(statusEl);
    paintClocks();
  }
  function paintClocks() {
    var now = Date.now();
    document.querySelectorAll('[data-ends]').forEach(function (n) {
      if (n.closest('#ev-toast, #ev-status, #ev-king, .ev-shop-banner, .ev-tab')) n.textContent = clock(Number(n.dataset.ends) - now);
    });
    var p = statusEl && statusEl.querySelector('[data-ev-prog]');
    var ev = econ() && econ().event();
    if (p && ev) p.textContent = progressText(ev);
  }

  /* ── scheduler ── */
  function eligible() {
    return KINDS.filter(function (k) {
      if (k === st.last) return false;
      if (k === 'assembly' && !window.URPECore) return false;
      if (k === 'market' && !shop()) return false;
      return true;
    });
  }
  function begin(kind, startTs, quiet, endsAt) {
    var e = econ(), d = DEFS[kind];
    if (!e || !d || e.event()) return null;
    var ends = Math.min(endsAt > 0 ? endsAt : Infinity, startTs + d.dur);
    if (ends <= Date.now()) return null;
    var id = 'ev-' + kind + '-' + startTs;
    if (kind === 'market') e.setMarket({ ends: ends, items: marketItems() });
    st.last = kind;
    save();
    e.setEvent({ id: id, kind: kind, name: d.name, desc: d.desc, ends: ends });
    if (!quiet) announceStart();
    return id;
  }
  /* ── the King: a window on the clock, not a dice roll ──
     The hour itself is the schedule, so the event is there whether this tab was
     open or not: 10 minutes from every :00. A random event still running when the
     window opens is stood down — being guaranteed is the whole point. */
  function kingSlot(now) {
    var start = Math.floor(now / KING_PERIOD) * KING_PERIOD;
    return now - start < KING_DUR ? start : 0;
  }
  function kingTick() {
    var e = econ();
    if (!e) return;
    var now = Date.now(), cur = e.event(), slot = kingSlot(now);
    if (cur && cur.kind === 'king') return;
    if (!slot || st.king === slot) return;
    if (cur) e.clearEvent();
    st.king = slot;
    save();
    begin('king', slot, false, slot + KING_DUR);
  }
  function kingWindow() {
    var now = Date.now(), slot = kingSlot(now);
    return {
      live: !!slot, rate: KING_RATE, bonusCap: KING_BONUS_CAP,
      ends: slot ? slot + KING_DUR : 0,
      next: slot ? slot + KING_DUR : Math.floor(now / KING_PERIOD) * KING_PERIOD + KING_PERIOD
    };
  }
  function check() {
    var e = econ();
    if (!e) return;
    var now = Date.now();
    if (!st.next) { st.next = now + CHECK_MS; save(); e.setNextCheck(st.next); return; }
    if (now < st.next) return;
    var c = st.next, n = 0;
    // Missed checks are replayed in order; only one that would still be running
    // now can start, and no check fires while another event is live.
    if ((now - c) / CHECK_MS > MAX_CATCHUP) c += Math.floor((now - c) / CHECK_MS - MAX_CATCHUP) * CHECK_MS;
    while (c <= now && n++ < MAX_CATCHUP + 2) {
      var live = e.event();
      if (!live && !kingSlot(c) && rand() < CHANCE) {
        var pool = eligible();
        var kind = pool[Math.floor(rand() * pool.length)];
        if (kind && c + DEFS[kind].dur > now) begin(kind, c, false);
      }
      c += CHECK_MS;
    }
    st.next = c;
    save();
    e.setNextCheck(st.next);
    renderStatus();
  }

  /* ── event lifecycle ── */
  var active = null;
  function announceStart() {
    var ev = econ().event();
    if (!ev) return;
    var d = DEFS[ev.kind];
    // The King says it himself, in the red line across the screen; a toast there
    // would only sit on top of it for the first six seconds.
    if (ev.kind === 'king') { play('king'); return; }
    toast(ev.kind, S('started'), ic(d.icon) + esc(L(d.name)), L(d.desc), ev.ends);
    play(ev.kind);
  }
  function applyEvent(ev) {
    if (active && (!ev || active.id !== ev.id)) teardown(active);
    if (!ev) { delete document.body.dataset.evKind; return; }
    if (active && active.id === ev.id) return;
    active = { id: ev.id, kind: ev.kind };
    document.body.dataset.evKind = ev.kind;
    if (ev.kind === 'overload') startOverload(ev);
    if (ev.kind === 'golden') startGolden(ev);
    if (ev.kind === 'assembly') openAssembly();
    kingBand();
    shopBanner();
    if (shop()) shop().rerender();
    renderStatus();
  }
  function teardown(a) {
    stopSpawner();
    var layer = document.getElementById('ev-layer');
    if (layer) layer.innerHTML = '';
    var asm = document.getElementById('ev-asm');
    if (asm) asm.hidden = true;
    delete document.body.dataset.evKind;
    active = null;
    kingBand();
    shopBanner();
    if (shop()) shop().rerender();
    toast('end', S('ended'), L((DEFS[a.kind] || {}).name), S('endedMsg'), 0);
    play('end');
    renderStatus();
  }

  /* ── shop banner (Peak / Black Market) ── */
  function shopBanner() {
    var panel = document.getElementById('shop-panel');
    if (!panel) return;
    var old = panel.querySelector('.ev-shop-banner');
    var ev = econ() && econ().event();
    if (!ev || (ev.kind !== 'peak' && ev.kind !== 'market')) { if (old) old.remove(); return; }
    if (old && old.dataset.id === ev.id) return;
    if (old) old.remove();
    var b = document.createElement('div');
    b.className = 'ev-shop-banner';
    b.dataset.k = ev.kind;
    b.dataset.id = ev.id;
    var sparks = '';
    for (var i = 0; i < 14; i++) sparks += '<i style="left:' + randInt(2, 98) + '%;top:' + randInt(20, 90) + '%;animation-delay:' + (rand() * 2).toFixed(2) + 's"></i>';
    b.innerHTML = sparks + esc(ev.kind === 'peak' ? L(DEFS.peak.desc) : L(DEFS.market.name) + ' — ' + L(DEFS.market.desc)) +
      '<span class="ev-sb-c" data-ends="' + ev.ends + '"></span>';
    var tabs = panel.querySelector('.shop-tabs');
    if (tabs && tabs.parentNode === panel) panel.insertBefore(b, tabs.nextSibling); else panel.insertBefore(b, panel.firstChild);
    paintClocks();
  }

  /* ── the King: the red line, and the desk behind it ── */
  var bandEl = null;
  var kingSeq = 0;
  function kingOn() {
    var ev = econ() && econ().event();
    return ev && ev.kind === 'king' && ev.ends > Date.now() ? ev : null;
  }
  function kingBand() {
    var ev = kingOn();
    if (!ev) {
      if (bandEl) bandEl.remove();
      bandEl = null;
      document.documentElement.style.removeProperty('--king-h');
      document.documentElement.style.removeProperty('--king-on');
      return;
    }
    injectStyles();
    if (!bandEl) {
      bandEl = document.createElement('div');
      bandEl.id = 'ev-king';
      bandEl.setAttribute('role', 'button');
      bandEl.tabIndex = 0;
      var go = function () { var sh = shop(); if (sh) sh.showTab('events'); };
      bandEl.addEventListener('click', go);
      bandEl.addEventListener('keydown', function (x) {
        if (x.key === 'Enter' || x.key === ' ' || x.key === 'Spacebar') { x.preventDefault(); go(); }
      });
      document.body.appendChild(bandEl);
      window.addEventListener('resize', kingMeasure);
    }
    // He says the same thing in both languages: the cry is a name, not a sentence.
    bandEl.setAttribute('aria-label', S('kingCry'));
    bandEl.innerHTML = '<span class="ev-k-cry">' + esc(S('kingCry')) + '</span>' +
      '<span class="ev-k-sub">' + esc(L(DEFS.king.desc)) + '</span>' +
      '<span class="ev-k-c" data-ends="' + ev.ends + '"></span>';
    lucideIn(bandEl);
    kingMeasure();
    paintClocks();
  }
  function kingMeasure() {
    if (!bandEl) return;
    var st = document.documentElement.style;
    st.setProperty('--king-h', bandEl.offsetHeight + 'px');
    // A unitless flag for the shell: the banner is the shop handle while it is
    // up, so the rope retracts instead of hanging across his headline.
    st.setProperty('--king-on', '1');
  }
  // The shelf value of a row is exact; the extra half is what the capped bonus
  // can still add, so the estimate the desk shows is the payout the player gets.
  function kingEstimate(p, base) {
    var bonus = Math.max(0, Math.min(KING_BONUS_CAP - (p.kingBonus || 0), Math.round(base * (KING_RATE - 1))));
    return { pay: base + bonus, bonus: bonus };
  }
  function kingSell(z, want) {
    var e = econ(), sh = shop(), ev = kingOn();
    if (!e || !sh || !ev || !(z > 0)) return null;
    var rows = sh.crateList(), row = null;
    for (var i = 0; i < rows.length; i++) if (rows[i].z === z) row = rows[i];
    if (!row) return null;
    var taken = sh.shipStock(z, Math.max(1, Math.min(Math.floor(want), row.n)));
    if (!taken) return null;
    var p = prog(ev);
    var base = Math.max(0, Math.round(sh.unitPrice(z) * taken));
    var est = kingEstimate(p, base);
    if (!award(ev.id + ':rf:' + z + ':' + Date.now() + ':' + (kingSeq++), est.pay, 'king-refund')) {
      sh.grantStock(z, taken);
      return null;
    }
    p.kingBonus = (p.kingBonus || 0) + est.bonus;
    p.kingUnits = (p.kingUnits || 0) + taken;
    p.kingPaid = (p.kingPaid || 0) + est.pay;
    save();
    flyStars(1);
    return { n: taken, z: z, sym: row.sym, pay: est.pay, base: base, bonus: est.bonus };
  }
  function kingRefund(z, n) {
    var r = kingSell(z, n);
    if (!r) { play('bad'); return; }
    play('kingSell');
    toast('king', S('kingDesk'), sf('kingPaid', { n: r.n, s: r.sym, v: r.pay }),
      r.bonus > 0 ? '' : S('kingSpent'), 0);
    kingRerender();
  }
  function kingSellAll() {
    var sh = shop(), ev = kingOn();
    if (!sh || !ev) return;
    var rows = sh.crateList(), atoms = 0, stars = 0;
    for (var i = 0; i < rows.length; i++) {
      var r = kingSell(rows[i].z, rows[i].n);
      if (r) { atoms += r.n; stars += r.pay; }
    }
    if (!atoms) { play('bad'); return; }
    play('kingSell');
    toast('king', S('kingDesk'), sf('kingPaidAll', { n: atoms, v: stars }), '', 0);
    kingRerender();
  }
  function kingRerender() {
    var sh = shop();
    if (sh) sh.rerender();
    kingBand();
    renderStatus();
  }
  /* His crate is a secret: packs.js keeps it out of the Lab Crates shelf, and the
     only place it can be bought is this desk, while the window is open. The price
     and sample count are read from the pack definition so the desk can never quote
     a number the purchase itself would not charge. */
  function kingCrateDef() {
    var p = window.__mol3dPacks;
    var list = p && p.packs ? p.packs : [];
    for (var i = 0; i < list.length; i++) if (list[i].secret) return list[i];
    return null;
  }
  function kingCrateHtml() {
    var e = econ(), def = kingCrateDef();
    if (!def) return '';
    var ok = !!kingOn() && (e ? e.balance() : 0) >= def.cost;
    return '<div class="ev-kpack"><div class="ev-kpack-h">' + ic('crown') + esc(S('kingCrate')) + '</div>' +
      '<div class="ev-kpack-note">' + esc(S('kingCrateNote')) + '</div>' +
      '<div class="ev-kpack-meta">' + ic('package') + esc(sf('kingPack', { c: def.cost })) +
      ' · ' + esc(sf('kingCrateItems', { n: def.items })) + '</div>' +
      '<button class="ev-btn ev-kpack-buy" data-rf-pack' +
      (ok ? '' : ' disabled title="' + esc(S('poor')) + '"') + '>' + esc(S('kingOpen')) + ' · ' + def.cost + '\u2605</button></div>';
  }
  function buyKingPack() {
    var e = econ(), p = window.__mol3dPacks, def = kingCrateDef();
    if (!e || !p || !p.open || !def || !kingOn()) { play('bad'); return; }
    if (e.balance() < def.cost) { play('bad'); toast('king', S('kingCrate'), S('poor'), '', 0); return; }
    p.open(def.id);
  }
  function kingDeskHtml(ev) {
    var sh = shop(), p = prog(ev);
    var left = Math.max(0, KING_BONUS_CAP - (p.kingBonus || 0));
    var html = '<div class="ev-king"><div class="ev-king-h">' + ic('crown') + esc(S('kingDesk')) + '</div>' +
      '<div class="ev-king-note">' + esc(sf(left > 0 ? 'kingRate' : 'kingSpent', { r: KING_RATE, c: left })) + '</div>' +
      kingCrateHtml();
    if (!sh) return html + '</div>';
    var rows = sh.crateList();
    if (!rows.length) {
      html += '<div class="ev-king-note">' + esc(S('kingEmpty')) + '</div>';
    } else {
      html += '<div class="ev-rf-list">';
      rows.forEach(function (row) {
        var est = kingEstimate(p, Math.round(row.unit * row.n));
        html += '<div class="ev-rf"><span class="ev-rf-s">' + esc(row.sym) + '</span>' +
          '<span class="ev-rf-m">' + esc(sf('el', { n: row.n, s: row.name })) + ' · ' + esc(sf('kingEach', { u: row.unit })) +
          ' \u2192 ' + est.pay + '\u2605</span>' +
          '<span class="ev-rf-b"><button class="ev-btn" data-rf="' + row.z + ':1">1</button>' +
          (row.n > 1 ? '<button class="ev-btn" data-rf="' + row.z + ':' + Math.min(10, row.n) + '">10</button>' +
            '<button class="ev-btn" data-rf="' + row.z + ':' + row.n + '">' + esc(S('kingAll')) + '</button>' : '') +
          '</span></div>';
      });
      html += '</div><div class="ev-rf-all"><button class="ev-btn" data-rf-all>' + ic('repeat') + esc(S('kingSellAll')) + '</button></div>';
    }
    html += '<div class="ev-king-note">' + esc(sf('kingProg', {
      n: p.kingUnits || 0, v: p.kingPaid || 0, b: p.kingBonus || 0, c: KING_BONUS_CAP })) + '</div>';
    return html + '</div>';
  }

  /* ── Star Rush ── */
  function flyStars(n, from) {
    var target = document.querySelector('#mol-hud .hud-stars');
    if (!target) return;
    var tr = target.getBoundingClientRect();
    var fx = from ? from.x : innerWidth / 2, fy = from ? from.y : innerHeight / 2;
    for (var i = 0; i < Math.min(8, Math.max(1, n)); i++) {
      (function (i) {
        var s = document.createElement('div');
        s.className = 'ev-fly';
        s.textContent = '\u2605';
        s.style.left = (fx + randInt(-30, 30)) + 'px';
        s.style.top = (fy + randInt(-30, 30)) + 'px';
        document.body.appendChild(s);
        setTimeout(function () {
          var r = s.getBoundingClientRect();
          s.style.transform = 'translate(' + (tr.left + tr.width / 2 - r.left) + 'px,' + (tr.top + tr.height / 2 - r.top) + 'px) scale(.5)';
          s.style.opacity = '0.2';
        }, 30 + i * 60);
        setTimeout(function () { s.remove(); }, 1100 + i * 60);
      })(i);
    }
  }
  var rushSeq = 0;
  function onGameplayStars(e) {
    var ev = econ() && econ().event();
    if (!ev || ev.kind !== 'rush') return;
    var v = Math.floor(Number(e.detail && e.detail.value) || 0);
    if (!(v > 0)) return;
    var p = prog(ev);
    var got = award(ev.id + ':rush:' + Date.now() + ':' + (rushSeq++), v, 'rush');
    p.rush += got;
    save();
    flyStars(got);
    paintClocks();
  }

  /* ── spawner layer (Atomic Overload, Golden Molecule) ── */
  var spawnTimer = 0;
  function layer() {
    var l = document.getElementById('ev-layer');
    if (!l) { l = document.createElement('div'); l.id = 'ev-layer'; document.body.appendChild(l); }
    return l;
  }
  function stopSpawner() { if (spawnTimer) clearTimeout(spawnTimer); spawnTimer = 0; }
  function burst(x, y, color, n) {
    var l = layer();
    for (var i = 0; i < n; i++) {
      var p = document.createElement('div');
      p.className = 'ev-spark';
      p.style.left = x + 'px'; p.style.top = y + 'px'; p.style.background = color;
      p.style.boxShadow = '0 0 8px ' + color;
      l.appendChild(p);
      (function (p) {
        var a = rand() * Math.PI * 2, r = 30 + rand() * 50;
        requestAnimationFrame(function () { p.style.transform = 'translate(' + Math.cos(a) * r + 'px,' + Math.sin(a) * r + 'px)'; p.style.opacity = '0'; });
        setTimeout(function () { p.remove(); }, 700);
      })(p);
    }
  }
  function gainText(x, y, txt) {
    var g = document.createElement('div');
    g.className = 'ev-gain';
    g.textContent = txt;
    g.style.left = x + 'px'; g.style.top = y + 'px';
    layer().appendChild(g);
    requestAnimationFrame(function () { g.style.transform = 'translateY(-40px)'; g.style.opacity = '0'; });
    setTimeout(function () { g.remove(); }, 1000);
  }
  function spot(size) {
    // Keep clear of the top bar and the bottom pool so nothing hides a control.
    var top = 90, bottom = Math.max(top + 40, innerHeight - 170);
    return { x: randInt(16, Math.max(20, innerWidth - size - 16)), y: randInt(top, bottom - size) };
  }

  var OVERLOAD_CAP = 30;
  var ATOM_LOOKS = [
    { s: 'H', c: '#e8eef5', size: 40 }, { s: 'C', c: '#4a4a4a', size: 50 }, { s: 'N', c: '#3050f8', size: 50 },
    { s: 'O', c: '#ff2a2a', size: 50 }, { s: 'Na', c: '#ab5cf2', size: 56 }, { s: 'Cl', c: '#1ff01f', size: 54 },
    { s: 'Fe', c: '#e06633', size: 56 }, { s: 'Au', c: '#ffd123', size: 58 }, { s: 'U', c: '#00ff8f', size: 60 }
  ];
  function startOverload(ev) {
    stopSpawner();
    var p = prog(ev);
    (function next() {
      var cur = econ().event();
      if (!cur || cur.id !== ev.id || p.collected >= OVERLOAD_CAP) return;
      var look = ATOM_LOOKS[Math.floor(rand() * ATOM_LOOKS.length)];
      var pos = spot(look.size);
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'ev-atom';
      b.style.cssText = 'left:' + pos.x + 'px;top:' + pos.y + 'px;width:' + look.size + 'px;height:' + look.size + 'px;color:' + look.c +
        ';background:radial-gradient(circle at 32% 30%,#fff 0,' + look.c + ' 35%,#000 130%);';
      b.innerHTML = '<span>' + look.s + '</span>';
      b.setAttribute('aria-label', look.s);
      b.addEventListener('click', function () {
        if (b.dataset.done) return;
        b.dataset.done = '1';
        var c = econ().event();
        if (!c || c.id !== ev.id || p.collected >= OVERLOAD_CAP) { b.remove(); return; }
        var v = randInt(2, 5);
        var got = award(ev.id + ':a' + p.collected, v, 'overload');
        p.collected += 1; p.earned += got; save();
        var r = b.getBoundingClientRect();
        burst(r.left + r.width / 2, r.top + r.height / 2, look.c, 12);
        gainText(r.left, r.top, '+' + got + '\u2605');
        play('pop');
        b.remove();
        paintClocks();
      });
      layer().appendChild(b);
      setTimeout(function () { b.remove(); }, 4200);
      spawnTimer = setTimeout(next, randInt(900, 1800));
    })();
  }

  var GOLD_SVG = '<svg viewBox="0 0 100 100" width="76" height="76"><defs><radialGradient id="evg" cx="35%" cy="30%"><stop offset="0" stop-color="#fff8d0"/>' +
    '<stop offset=".45" stop-color="#ffcc33"/><stop offset="1" stop-color="#8a5a00"/></radialGradient></defs>' +
    '<g stroke="#ffe680" stroke-width="5"><line x1="50" y1="50" x2="20" y2="25"/><line x1="50" y1="50" x2="82" y2="28"/><line x1="50" y1="50" x2="50" y2="88"/></g>' +
    '<circle cx="50" cy="50" r="18" fill="url(#evg)"/><circle cx="20" cy="25" r="11" fill="url(#evg)"/><circle cx="82" cy="28" r="11" fill="url(#evg)"/><circle cx="50" cy="88" r="10" fill="url(#evg)"/></svg>';
  var GOLD_MAX = 5;
  function startGolden(ev) {
    stopSpawner();
    var p = prog(ev);
    function show() {
      var cur = econ().event();
      if (!cur || cur.id !== ev.id || p.golden >= GOLD_MAX) return;
      var pos = spot(76);
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'ev-gold';
      b.style.left = pos.x + 'px'; b.style.top = pos.y + 'px';
      b.innerHTML = GOLD_SVG;
      b.setAttribute('aria-label', L(DEFS.golden.name));
      b.addEventListener('click', function () {
        if (b.dataset.done) return;
        b.dataset.done = '1';
        // Single-player: each appearance is the player's own; the first catch pays
        // the 50★ "first collector" prize and later appearances pay 10★.
        var v = p.golden === 0 ? 50 : 10;
        var got = award(ev.id + ':g' + p.golden, v, 'golden');
        p.golden += 1; p.earned += got; save();
        var r = b.getBoundingClientRect();
        burst(r.left + 38, r.top + 38, '#ffd84a', 26);
        gainText(r.left, r.top, '+' + got + '\u2605');
        flyStars(got > 20 ? 8 : 3, { x: r.left + 38, y: r.top + 38 });
        play('golden');
        b.remove();
        paintClocks();
      });
      layer().appendChild(b);
      setTimeout(function () { b.remove(); }, 7000);
      spawnTimer = setTimeout(show, randInt(22000, 36000));
    }
    spawnTimer = setTimeout(show, p.golden ? randInt(6000, 15000) : randInt(3000, 9000));
  }

  /* ── Black Market ── */
  var MARKET_EL = [1, 6, 7, 8, 11, 12, 13, 16, 17, 19, 20, 26, 29, 30, 47, 79, 92];
  function marketItems() {
    var sh = shop(), cat = sh && sh.catalogue, out = [], pool = [];
    if (!cat) return out;
    MARKET_EL.forEach(function (z) { pool.push({ id: 'el:' + z, base: cat.unitPrice(z) * 5 }); });
    (cat.ammo || ['proton', 'neutron']).forEach(function (a) {
      var k = typeof a === 'string' ? a : a.id;
      if (k) pool.push({ id: 'ammo:' + k, base: cat.ammoPrice * 20 });
    });
    cat.features.forEach(function (f) { if (!sh.ownsFeature(f.id)) pool.push({ id: 'feat:' + f.id, base: sh.priceOf(f.price, f.min) }); });
    for (var i = pool.length - 1; i > 0; i--) { var j = Math.floor(rand() * (i + 1)); var t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
    pool.slice(0, 6).forEach(function (it) {
      if (!(it.base > 0)) return;
      var off = randInt(20, 70);
      out.push({ id: it.id, base: it.base, rate: Math.round((1 - off / 100) * 100) / 100 });
    });
    return out;
  }
  function offerLabel(id) {
    var p = id.split(':'), a = window.__mol3d, sh = shop();
    if (p[0] === 'el') {
      var z = Number(p[1]), el = a && a.ELEMENTS && a.ELEMENTS.find(function (x) { return x.z === z; });
      return sf('el', { n: 5, s: el ? el.sym : 'Z' + z });
    }
    if (p[0] === 'ammo') return sf('ammo', { n: 20, k: p[1] });
    return sf('feat', { f: sh ? sh.featureName(p[1]) : p[1] });
  }
  function offerReward(id) {
    var p = id.split(':');
    if (p[0] === 'el') return { id: id, kind: 'atom', z: Number(p[1]), count: 5 };
    if (p[0] === 'ammo') return { id: id, kind: 'ammo', ammo: p[1], count: 20 };
    return { id: id, kind: 'feature', feature: p[1], value: 0 };
  }
  function buyOffer(id) {
    var e = econ(), ev = e && e.event(), m = e && e.market();
    if (!ev || ev.kind !== 'market' || !m) return;
    var it = m.items.find(function (x) { return x.id === id; });
    if (!it) return;
    var txId = ev.id + ':m:' + id;
    if (e.tx(txId)) return;
    var cost = e.quote(it.base, { marketId: id }).final;
    var r = e.purchase({ id: txId, kind: 'market', cost: cost, rewards: [offerReward(id)] });
    if (!r.ok) { play('bad'); toast('market', L(DEFS.market.name), S('poor'), '', 0); return; }
    e.claim(txId);
    play('good');
    if (shop()) shop().rerender();
  }

  /* ── event shop tab ── */
  function renderTab() {
    var wrap = document.createElement('div');
    wrap.className = 'ev-tab';
    var e = econ(), ev = e && e.event();
    wrap.dataset.k = ev ? ev.kind : '';
    if (!ev) {
      wrap.innerHTML = '<b>' + esc(S('none')) + '</b><div>' + esc(S('next')) + ' <span data-ends="' + st.next + '"></span></div>' +
        '<div>' + esc(S('chance')) + '</div><div style="opacity:.7">' + esc(S('noEvShop')) + '</div>';
      return wrap;
    }
    var d = DEFS[ev.kind];
    var html = '<div style="font-weight:900;font-size:16px">' + ic(d.icon) + esc(L(d.name)) + '</div><div>' + esc(L(d.desc)) + '</div>' +
      '<div>' + esc(S('left')) + ': <b data-ends="' + ev.ends + '"></b></div>';
    if (ev.kind === 'market' && e.market()) {
      html += '<div class="ev-offers">';
      e.market().items.forEach(function (it) {
        var sold = !!e.tx(ev.id + ':m:' + it.id);
        html += '<div class="ev-offer"><span class="ev-off">-' + Math.round((1 - it.rate) * 100) + '%</span>' +
          '<div style="font-weight:800">' + esc(offerLabel(it.id)) + '</div>' +
          '<div>' + e.priceHtml(it.base, { marketId: it.id, detail: true }) + '</div>' +
          '<button class="ev-btn" data-offer="' + esc(it.id) + '"' + (sold ? ' disabled' : '') + '>' + esc(sold ? S('bought') : S('buy')) + '</button></div>';
      });
      html += '</div>';
    } else if (ev.kind === 'assembly') {
      html += '<button class="ev-btn" data-ev-play>' + esc(S('play')) + '</button>';
    } else if (ev.kind === 'king') {
      html += kingDeskHtml(ev);
    } else {
      html += '<div>' + esc(S('progress')) + ': ' + esc(progressText(ev)) + '</div>';
    }
    html += '<div style="font-size:11px;opacity:.6">' + esc(S('local')) + '</div>';
    wrap.innerHTML = html; lucideIn(wrap);
    wrap.addEventListener('click', function (x) {
      var o = x.target.closest('[data-offer]');
      if (o && !o.disabled) buyOffer(o.dataset.offer);
      if (x.target.closest('[data-ev-play]')) openAssembly();
      var rf = x.target.closest('[data-rf]');
      if (rf) { var v = rf.dataset.rf.split(':'); kingRefund(Number(v[0]), Number(v[1])); }
      if (x.target.closest('[data-rf-all]')) kingSellAll();
      if (x.target.closest('[data-rf-pack]')) buyKingPack();
    });
    setTimeout(paintClocks, 0);
    return wrap;
  }
  function tabSig() {
    var e = econ(), ev = e && e.event();
    var sold = ev && ev.kind === 'market' && e.market() ? e.market().items.filter(function (it) { return e.tx(ev.id + ':m:' + it.id); }).length : 0;
    var sh = ev && ev.kind === 'king' ? shop() : null;
    var crate = sh ? sh.crateList().reduce(function (a, r) { return a + r.n; }, 0) : 0;
    var p = ev && ev.kind === 'king' ? prog(ev) : {};
    return (ev ? ev.id : '-') + ':' + sold + ':' + lang() +
      ':' + crate + ':' + (p.kingBonus || 0) + ':' + (e ? Math.floor(e.balance()) : 0);
  }

  /* ── Molecule Assembly Challenge ── */
  function mol(syms, bonds) {
    return { atoms: syms.split(' ').map(function (s, i) { return { id: 'a' + i, sym: s }; }),
      bonds: bonds.map(function (b) { return { a: 'a' + b[0], b: 'a' + b[1], order: b[2] || 1 }; }) };
  }
  var TARGETS = [
    { f: 'H\u2082O', g: mol('O H H', [[0, 1], [0, 2]]) },
    { f: 'CO\u2082', g: mol('C O O', [[0, 1, 2], [0, 2, 2]]) },
    { f: 'NH\u2083', g: mol('N H H H', [[0, 1], [0, 2], [0, 3]]) },
    { f: 'CH\u2084', g: mol('C H H H H', [[0, 1], [0, 2], [0, 3], [0, 4]]) },
    { f: 'H\u2082O\u2082', g: mol('O O H H', [[0, 1], [0, 2], [1, 3]]) },
    { f: 'C\u2082H\u2086', g: mol('C C H H H H H H', [[0, 1], [0, 2], [0, 3], [0, 4], [1, 5], [1, 6], [1, 7]]) },
    { f: 'C\u2082H\u2084', g: mol('C C H H H H', [[0, 1, 2], [0, 2], [0, 3], [1, 4], [1, 5]]) },
    { f: 'C\u2082H\u2082', g: mol('C C H H', [[0, 1, 3], [0, 2], [1, 3]]) },
    { f: 'C\u2083H\u2088', g: mol('C C C H H H H H H H H', [[0, 1], [1, 2], [0, 3], [0, 4], [0, 5], [1, 6], [1, 7], [2, 8], [2, 9], [2, 10]]) },
    // Ethanol, not dimethyl ether: the graph check rejects the C–O–C isomer.
    { f: 'C\u2082H\u2085OH', g: mol('C C O H H H H H H', [[0, 1], [1, 2], [2, 3], [0, 4], [0, 5], [0, 6], [1, 7], [1, 8]]) }
  ];
  var VAL = { H: 1, C: 4, N: 3, O: 2 };
  var COLOR = { H: '#e8eef5', C: '#555', N: '#3a5cff', O: '#ff3b3b' };
  var asm = null, built = null, sel = null, asmMsg = '', asmTone = '';

  function layoutFor(ev, round) {
    var p = prog(ev);
    if (p.layout && p.layout.round === round) return p.layout.order;
    var n = TARGETS[round].g.atoms.length, order = [];
    for (var i = 0; i < n; i++) order.push(i);
    for (var k = n - 1; k > 0; k--) { var j = Math.floor(rand() * (k + 1)); var t = order[k]; order[k] = order[j]; order[j] = t; }
    p.layout = { round: round, order: order };
    save();
    return order;
  }
  function openAssembly() {
    var ev = econ() && econ().event();
    if (!ev || ev.kind !== 'assembly') return;
    injectStyles();
    if (!asm) {
      asm = document.createElement('div');
      asm.id = 'ev-asm';
      asm.setAttribute('role', 'dialog');
      document.body.appendChild(asm);
      asm.addEventListener('click', onAsmClick);
    }
    asm.hidden = false;
    var p = prog(ev);
    if (!built || built.round !== p.round || built.ev !== ev.id) { built = { ev: ev.id, round: p.round, bonds: [] }; sel = null; }
    renderAssembly();
  }
  function atomPos(n, i) {
    var cx = 200, cy = 130, r = n <= 3 ? 70 : n <= 5 ? 90 : 105;
    var a = -Math.PI / 2 + i * 2 * Math.PI / n;
    return { x: cx + r * Math.cos(a) * 1.35, y: cy + r * Math.sin(a) };
  }
  function bondAt(a, b) {
    for (var i = 0; i < built.bonds.length; i++) {
      var x = built.bonds[i];
      if ((x.a === a && x.b === b) || (x.a === b && x.b === a)) return x;
    }
    return null;
  }
  function renderAssembly() {
    var ev = econ() && econ().event();
    if (!asm || !ev || ev.kind !== 'assembly') return;
    var p = prog(ev);
    var html = '<div class="ev-asm-h"><span>\u269B ' + esc(L(DEFS.assembly.name)) + '</span><button class="ev-x" data-a="close" aria-label="' + esc(S('close')) + '">\u00d7</button></div>';
    html += '<div class="ev-dots">';
    for (var r = 0; r < 10; r++) html += '<b' + (p.results[r] !== undefined ? ' data-r="' + (p.results[r] ? 1 : 0) + '"' : '') + '></b>';
    html += '</div>';
    if (p.round >= 10) {
      html += '<div class="ev-target">' + esc(sf('done', { c: p.correct })) + '</div><div class="ev-msg">' + esc(asmMsg) + '</div>';
      asm.innerHTML = html;
      return;
    }
    var t = TARGETS[p.round], order = layoutFor(ev, p.round), n = t.g.atoms.length;
    html += '<div style="display:flex;justify-content:space-between;font-size:12px;opacity:.8"><span>' + esc(sf('round', { n: p.round + 1 })) + '</span><span>' +
      esc(sf('streak', { n: p.streak })) + ' · <span data-ends="' + ev.ends + '"></span></span></div>';
    html += '<div class="ev-target">' + esc(S('build')) + ': ' + t.f + '</div>';
    var svg = '<svg viewBox="0 0 400 270" role="img">';
    var used = {};
    built.bonds.forEach(function (b) {
      used[b.a] = (used[b.a] || 0) + b.order; used[b.b] = (used[b.b] || 0) + b.order;
      var pa = atomPos(n, order.indexOf(b.a)), pb = atomPos(n, order.indexOf(b.b));
      var dx = pb.x - pa.x, dy = pb.y - pa.y, len = Math.hypot(dx, dy) || 1, ox = -dy / len * 5, oy = dx / len * 5;
      for (var k = 0; k < b.order; k++) {
        var off = k - (b.order - 1) / 2;
        svg += '<line x1="' + (pa.x + ox * off) + '" y1="' + (pa.y + oy * off) + '" x2="' + (pb.x + ox * off) + '" y2="' + (pb.y + oy * off) + '" stroke="#9fe" stroke-width="3"/>';
      }
      svg += '<line data-bond="' + b.a + '-' + b.b + '" x1="' + pa.x + '" y1="' + pa.y + '" x2="' + pb.x + '" y2="' + pb.y + '" stroke="transparent" stroke-width="18" style="cursor:pointer"/>';
    });
    order.forEach(function (idx, slot) {
      var at = t.g.atoms[idx], pos = atomPos(n, slot), s = at.sym, rr = s === 'H' ? 15 : 20;
      var u = used[idx] || 0, full = u === VAL[s];
      svg += '<g data-atom="' + idx + '" style="cursor:pointer">' +
        '<circle cx="' + pos.x + '" cy="' + pos.y + '" r="' + (rr + 6) + '" fill="transparent"/>' +
        '<circle cx="' + pos.x + '" cy="' + pos.y + '" r="' + rr + '" fill="' + COLOR[s] + '" stroke="' + (sel === idx ? '#ffe066' : full ? '#00ff88' : '#fff') + '" stroke-width="' + (sel === idx ? 4 : 2) + '"/>' +
        '<text x="' + pos.x + '" y="' + (pos.y + 5) + '" text-anchor="middle" font-size="15" font-weight="900" fill="' + (s === 'H' ? '#123' : '#fff') + '">' + s + '</text>' +
        '<text x="' + (pos.x + rr) + '" y="' + (pos.y - rr) + '" font-size="11" font-weight="800" fill="' + (u > VAL[s] ? '#ff6688' : full ? '#00ff88' : '#ccd') + '">' + u + '/' + VAL[s] + '</text></g>';
    });
    svg += '</svg>';
    html += svg;
    html += '<div class="ev-msg" style="color:' + (asmTone === 'good' ? '#00ff88' : asmTone === 'bad' ? '#ff6688' : 'inherit') + '">' + esc(asmMsg) + '</div>';
    html += '<div class="ev-row"><button class="ev-btn" data-a="submit">' + esc(S('submit')) + '</button><button class="ev-btn" data-a="reset">' + esc(S('reset')) + '</button>' +
      '<button class="ev-btn" data-a="skip">' + esc(S('skip')) + '</button></div>';
    html += '<div class="ev-hint">' + esc(S('hintAsm')) + ' ' + esc(S('valence')) + '.</div>';
    asm.innerHTML = html;
    paintAsmClock();
  }
  function paintAsmClock() {
    if (!asm) return;
    var n = asm.querySelector('[data-ends]');
    if (n) n.textContent = clock(Number(n.dataset.ends) - Date.now());
  }
  function onAsmClick(e) {
    var ev = econ() && econ().event();
    var a = e.target.closest('[data-a]');
    if (a && a.dataset.a === 'close') { asm.hidden = true; return; }
    if (!ev || ev.kind !== 'assembly') return;
    var p = prog(ev);
    if (p.round >= 10) return;
    if (a) {
      if (a.dataset.a === 'reset') { built.bonds = []; sel = null; asmMsg = ''; }
      else if (a.dataset.a === 'submit') judge(ev, false);
      else if (a.dataset.a === 'skip') judge(ev, true);
      renderAssembly();
      return;
    }
    var bl = e.target.closest('[data-bond]');
    if (bl) {
      var ids = bl.dataset.bond.split('-').map(Number), b = bondAt(ids[0], ids[1]);
      if (b) { b.order -= 1; if (b.order <= 0) built.bonds.splice(built.bonds.indexOf(b), 1); }
      sel = null; renderAssembly(); return;
    }
    var g = e.target.closest('[data-atom]');
    if (!g) return;
    var idx = Number(g.dataset.atom);
    if (sel === null) sel = idx;
    else if (sel === idx) sel = null;
    else {
      var x = bondAt(sel, idx);
      if (!x) built.bonds.push({ a: sel, b: idx, order: 1 });
      else if (x.order < 3) x.order += 1;
      else built.bonds.splice(built.bonds.indexOf(x), 1);
      sel = null;
      play('pop');
    }
    renderAssembly();
  }
  function judge(ev, gaveUp) {
    var p = prog(ev), round = p.round, t = TARGETS[round];
    var ok = false, why = '';
    if (!gaveUp) {
      var C = window.URPECore;
      var mine = { atoms: t.g.atoms.map(function (x) { return { id: x.id, sym: x.sym }; }),
        bonds: built.bonds.map(function (b) { return { a: 'a' + b.a, b: 'a' + b.b, order: b.order }; }) };
      try {
        var v = C.validate(mine);
        var connected = C.components(C.normalize(mine)).length === 1;
        if (!connected) why = S('issueDisc');
        else if (v.status !== 'valid') why = S('issueVal');
        else {
          // Graph isomorphism with bond orders, not the formula: ethanol and
          // dimethyl ether share C2H6O but only one of them passes.
          ok = C.sameGraph(C.normalize(t.g), v.graph) === true;
          if (!ok) why = S('issueIso');
        }
      } catch (err) { why = S('issueVal'); }
    }
    var txBase = ev.id + ':r' + round;
    if (ok) {
      var got = award(txBase, 10, 'assembly');
      p.correct += 1; p.streak += 1; p.earned += got;
      asmMsg = sf('correct', { n: got }); asmTone = 'good';
      play('good');
      flyStars(3);
    } else {
      var lost = penalty(txBase, 5);
      p.streak = 0; p.earned -= lost;
      asmMsg = sf('wrong', { n: lost }) + (why ? ' ' + why : ''); asmTone = 'bad';
      play('bad');
    }
    p.results[round] = ok;
    p.round += 1;
    if (p.round >= 10) {
      if (p.correct === 10 && p.streak === 10) {
        var b = award(ev.id + ':bonus', 100, 'assembly-bonus');
        p.earned += b;
        if (b) { asmMsg = sf('bonus', { n: b }); flyStars(8); play('golden'); }
      }
      save();
      setTimeout(function () { var c = econ().event(); if (c && c.id === ev.id) econ().clearEvent(); }, 4000);
    }
    built = { ev: ev.id, round: p.round, bonds: [] };
    sel = null;
    save();
  }

  /* ── wiring ── */
  function tick() {
    kingTick();
    check();
    kingMeasure();
    paintClocks();
    paintAsmClock();
    var ev = econ() && econ().event();
    if ((ev ? ev.id : null) !== (active ? active.id : null)) applyEvent(ev);
    if (ev && (ev.kind === 'peak' || ev.kind === 'market')) shopBanner();
  }
  function attach(tries) {
    var e = econ(), sh = shop();
    if (!e || !sh || typeof sh.registerTab !== 'function') {
      if (tries < 100) setTimeout(function () { attach(tries + 1); }, 300);
      return;
    }
    load();
    injectStyles();
    if (!st.next) st.next = Date.now() + CHECK_MS;
    save();
    e.setNextCheck(st.next);
    sh.registerTab({ id: 'events', order: 40, label: function () { return S('tab'); }, render: renderTab, sig: tabSig });
    e.on('event', function (d) {
      var ev = d && d.event;
      var m = e.market();
      if (ev && ev.kind === 'market' && (!m || !m.items.length || m.ends < Date.now())) e.setMarket({ ends: ev.ends, items: marketItems() });
      applyEvent(ev || null);
    });
    window.addEventListener('mol3d:gameplay-stars', onGameplayStars);
    window.addEventListener('mol3d:lang', function () { renderStatus(); renderAssembly(); if (shop()) shop().rerender(); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) tick(); });
    var running = e.event();
    if (running) {
      applyEvent(running);
      var d = DEFS[running.kind];
      if (d) toast(running.kind, S('resumed'), ic(d.icon) + esc(L(d.name)), L(d.desc), running.ends);
    }
    setInterval(tick, 1000);
    tick();
    window.__mol3dEvents = {
      version: 1, checkMs: CHECK_MS, chance: CHANCE,
      kinds: KINDS.map(function (k) { return { kind: k, durationMs: DEFS[k].dur }; }),
      openStatus: openStatus,
      openAssembly: openAssembly,
      nextCheck: function () { return st.next; },
      active: function () { return econ().event(); },
      kingWindow: kingWindow,
      targets: TARGETS.length
    };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { attach(0); });
  else attach(0);
})();
