/* MOLECULITH Price Multiplier Wheel.
   A shop category that sells a PRICE MULTIPLIER, not a discount: the economy
   core computes FINAL = BASE x ACTIVE MULTIPLIER, so a slot below 1x makes
   things cheaper and a slot above 1x makes them dearer. Both directions are
   real and both are shown with their true odds.

   The outcome is rolled with crypto.getRandomValues and written into a
   transaction BEFORE the disc moves. The animation only reveals a decision
   that is already on disk, so a reload mid-spin delivers the multiplier
   (economy.resumePending claims every non-pack transaction) and can never
   charge twice or re-roll.

   SECURITY: entirely client-side, like the rest of the economy. The odds table
   and the roll ship in the page, so this is tamper-evident, not anti-cheat. */
(function () {
  'use strict';
  if (window.__mol3dWheel) return;

  var COST = 50;
  var TURNS_MIN = 5;
  var TURNS_VAR = 3;
  var DUR_MIN = 5600;
  var DUR_VAR = 1900;
  var SOUND_KEY = 'mol3d.wheel.sound';

  /* w is a whole percent; the twelve weights sum to 100, so the printed odds
     are the odds the roll actually uses. Expected multiplier 1.606 — the house
     edge is stated in the panel rather than hidden behind a "discount" label. */
  var SEGMENTS = [
    { m: 0.1,  w: 1,  fill: '#00ffc8', ink: '#04121c', tier: 'jackpot' },
    { m: 0.25, w: 3,  fill: '#00e6a2', ink: '#04121c', tier: 'great' },
    { m: 0.5,  w: 9,  fill: '#25cf8c', ink: '#04121c', tier: 'good' },
    { m: 0.75, w: 14, fill: '#57b877', ink: '#04121c', tier: 'good' },
    { m: 1,    w: 22, fill: '#39566f', ink: '#dceaf7', tier: 'flat' },
    { m: 1.25, w: 15, fill: '#b9932f', ink: '#1d1500', tier: 'warn' },
    { m: 1.5,  w: 12, fill: '#d9862c', ink: '#1d1000', tier: 'warn' },
    { m: 2,    w: 10, fill: '#e0663a', ink: '#fff2ec', tier: 'bad' },
    { m: 3,    w: 7,  fill: '#e04a4a', ink: '#fff0f0', tier: 'bad' },
    { m: 5,    w: 4,  fill: '#d62f63', ink: '#fff0f4', tier: 'worse' },
    { m: 7.5,  w: 2,  fill: '#b81f6e', ink: '#ffeef7', tier: 'worse' },
    { m: 10,   w: 1,  fill: '#ff1744', ink: '#fff5f7', tier: 'worst' }
  ];
  /* Slot order around the disc: cheap and dear alternate so the rim reads as a
     gamble instead of a gradient, and the two 1% slots sit apart. */
  var ORDER = [4, 7, 2, 9, 0, 5, 3, 10, 1, 6, 8, 11];
  var SLOTS = ORDER.map(function (i) { return SEGMENTS[i]; });
  var STEP = 360 / SLOTS.length;

  var STR = {
    en: {
      tab: 'Multiplier',
      title: 'Price Multiplier Wheel',
      lead: 'One spin sets the multiplier every shop price is multiplied by. Below ×1 is cheaper, above ×1 is dearer — the odds are printed below.',
      leadShort: 'Multiplies every shop price. Below ×1 cheaper, above ×1 dearer.',
      spin: 'SPIN',
      spinning: 'SPINNING',
      cost: '{n} ★',
      hubHint: 'Spin the wheel for {n} ★',
      active: 'Active multiplier',
      uses: 'Purchases left',
      none: 'No multiplier — prices are normal.',
      stackNow: 'Running: {a} · {n} purchases left. Another spin multiplies into it and does NOT refill the count.',
      stackIdle: 'A fresh activation grants {n} eligible purchases. Each buy spends one; after the last, prices return to ×1.',
      resultGood: '{m} — prices drop to {p}% of normal for {n} purchases.',
      resultFlat: '×1 — no change. Nothing was activated.',
      resultBad: '{m} — prices rise to {p}% of normal for {n} purchases.',
      resultStack: '{before} × {spun} = {m} · {n} purchases left (count not refilled).',
      jackpot: 'JACKPOT — ×0.1! Everything costs a tenth for {n} purchases.',
      worst: '×10 — the worst slot. Everything costs ten times as much for {n} purchases.',
      poor: 'Not enough stars — a spin costs {n} ★.',
      restored: 'Your interrupted spin was already delivered: {m}.',
      prices: 'Live prices',
      pricesHint: 'Every product in the shop, quoted by the same calculator the checkout uses.',
      atom: 'atom',
      ammo: 'Ammo (each)',
      odds: 'True odds',
      oddsGood: '−{p}% price',
      oddsFlat: 'unchanged',
      oddsBad: '+{p}% price',
      ev: 'Expected multiplier {m} · {good}% cheaper · {flat}% unchanged · {bad}% dearer',
      history: 'Recent spins',
      histEmpty: 'No spins yet.',
      owned: 'Owned',
      pending: 'delivered',
      reset: 'Drop multiplier',
      resetArm: 'Confirm — back to ×1?',
      resetDone: 'Multiplier cleared. Prices are normal again.',
      sound: 'Sound',
      soundOn: 'Sound on',
      soundOff: 'Sound off',
      localNote: 'Local save · tamper-evident, not server-verified',
      close: 'Close',
      wait: 'Wait for the disc to stop.'
    },
    vi: {
      tab: 'Hệ số giá',
      title: 'Vòng quay hệ số giá',
      lead: 'Mỗi lượt quay đặt hệ số nhân cho mọi giá trong cửa hàng. Dưới ×1 là rẻ hơn, trên ×1 là đắt hơn — tỉ lệ thật được in bên dưới.',
      leadShort: 'Nhân mọi giá trong cửa hàng. Dưới ×1 rẻ hơn, trên ×1 đắt hơn.',
      spin: 'QUAY',
      spinning: 'ĐANG QUAY',
      cost: '{n} ★',
      hubHint: 'Quay vòng với {n} ★',
      active: 'Hệ số đang active',
      uses: 'Lượt mua còn lại',
      none: 'Chưa có hệ số — giá bình thường.',
      stackNow: 'Đang chạy: {a} · còn {n} lượt mua. Quay tiếp sẽ nhân chồng vào và KHÔNG nạp lại số lượt.',
      stackIdle: 'Mỗi lần kích hoạt mới tặng {n} lượt mua được áp dụng. Mỗi lần mua tiêu một lượt; hết lượt thì giá trở về ×1.',
      resultGood: '{m} — giá giảm còn {p}% giá thường trong {n} lượt mua.',
      resultFlat: '×1 — không đổi. Không có hệ số nào được kích hoạt.',
      resultBad: '{m} — giá tăng lên {p}% giá thường trong {n} lượt mua.',
      resultStack: '{before} × {spun} = {m} · còn {n} lượt mua (không nạp lại).',
      jackpot: 'JACKPOT — ×0.1! Mọi thứ rẻ bằng một phần mười trong {n} lượt mua.',
      worst: '×10 — ô tệ nhất. Mọi thứ đắt gấp mười trong {n} lượt mua.',
      poor: 'Không đủ sao — một lượt quay giá {n} ★.',
      restored: 'Lượt quay bị gián đoạn đã được trao: {m}.',
      prices: 'Giá thực tế',
      pricesHint: 'Mọi sản phẩm trong cửa hàng, báo giá bằng đúng bộ tính toán mà bước thanh toán dùng.',
      atom: 'nguyên tử',
      ammo: 'Đạn (mỗi viên)',
      odds: 'Tỉ lệ thật',
      oddsGood: 'giá −{p}%',
      oddsFlat: 'giữ nguyên',
      oddsBad: 'giá +{p}%',
      ev: 'Hệ số trung bình {m} · {good}% rẻ hơn · {flat}% giữ nguyên · {bad}% đắt hơn',
      history: 'Lượt quay gần đây',
      histEmpty: 'Chưa quay lần nào.',
      owned: 'Đã sở hữu',
      pending: 'đã trao',
      reset: 'Bỏ hệ số',
      resetArm: 'Xác nhận — về ×1?',
      resetDone: 'Đã bỏ hệ số. Giá trở lại bình thường.',
      sound: 'Âm thanh',
      soundOn: 'Âm thanh bật',
      soundOff: 'Âm thanh tắt',
      localNote: 'Lưu cục bộ · chống sửa đổi, không xác thực máy chủ',
      close: 'Đóng',
      wait: 'Hãy đợi vòng quay dừng.'
    }
  };

  function econ() { return window.__mol3dEcon || null; }
  function shop() { return window.__mol3dShop || null; }
  function lang() {
    var e = econ();
    if (e) return e.lang();
    var l = null;
    try { l = localStorage.getItem('mol3d.lang'); } catch (err) {}
    return l === 'en' ? 'en' : 'vi';
  }
  function S(k) { var t = STR[lang()] || STR.vi; return t[k] || STR.en[k] || k; }
  function sf(k, p) {
    var s = S(k);
    for (var key in (p || {})) s = s.split('{' + key + '}').join(String(p[key]));
    return s;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(n) { var e = econ(); return e ? e.fmt(n) : String(n); }
  function fmtMult(m) { var e = econ(); return e ? e.fmtMult(m) : '\u00d7' + m; }
  function stat2(n) { return String(Math.round(Number(n) * 100) / 100); }

  /* ── sound ── */
  var ac = null;
  var muted = false;
  try { muted = localStorage.getItem(SOUND_KEY) === '0'; } catch (err) {}

  function volume() {
    if (muted) return 0;
    var v = 50;
    try {
      var s = localStorage.getItem('mol3d.volume');
      if (s !== null && isFinite(Number(s))) v = Number(s);
    } catch (err) {}
    return Math.max(0, Math.min(100, v)) / 100;
  }
  function ctx() {
    if (ac) return ac;
    try {
      var C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      ac = new C();
    } catch (err) { ac = null; }
    return ac;
  }
  function tone(freq, dur, type, gain, delay, slideTo) {
    var v = volume();
    if (!(v > 0)) return;
    var a = ctx();
    if (!a) return;
    try {
      if (a.state === 'suspended' && a.resume) a.resume();
      var t0 = a.currentTime + (delay || 0);
      var o = a.createOscillator(), g = a.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t0);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain * v), t0 + Math.min(0.02, dur * 0.3));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(a.destination);
      o.start(t0); o.stop(t0 + dur + 0.02);
    } catch (err) { /* audio is a garnish; never let it break a spin */ }
  }
  var SND = {
    tick: function (k) { tone(880 + 760 * k, 0.028, 'square', 0.018 + 0.05 * k); },
    start: function () { tone(200, 0.4, 'sine', 0.09, 0, 620); },
    land: function () { tone(520, 0.16, 'triangle', 0.1); tone(780, 0.22, 'triangle', 0.07, 0.06); },
    jackpot: function () {
      tone(70, 0.7, 'sine', 0.16);
      [523, 659, 784, 1047, 1319, 1568].forEach(function (f, i) {
        tone(f, 0.34, 'triangle', 0.11, 0.07 * i);
      });
      tone(2093, 0.6, 'sine', 0.06, 0.44);
    },
    worst: function () {
      tone(190, 0.85, 'sawtooth', 0.13, 0, 48);
      tone(196, 0.85, 'square', 0.07, 0.02, 44);
      tone(58, 0.9, 'sine', 0.15, 0.05);
    },
    bad: function () { tone(300, 0.3, 'sawtooth', 0.08, 0, 150); },
    poor: function () { tone(180, 0.09, 'square', 0.07); tone(140, 0.12, 'square', 0.07, 0.11); }
  };

  /* ── disc geometry ── */
  function polar(r, deg) {
    var a = (deg - 90) * Math.PI / 180;
    return [(100 + r * Math.cos(a)).toFixed(3), (100 + r * Math.sin(a)).toFixed(3)];
  }
  function wedge(i) {
    var a0 = i * STEP, a1 = a0 + STEP;
    var p0 = polar(96, a0), p1 = polar(96, a1);
    return 'M100 100 L' + p0[0] + ' ' + p0[1] + ' A96 96 0 0 1 ' + p1[0] + ' ' + p1[1] + ' Z';
  }
  function discSvg() {
    var s = '<svg class="whl-disc" viewBox="0 0 200 200" aria-hidden="true">';
    s += '<defs><radialGradient id="whl-sheen" cx="50%" cy="34%" r="72%">' +
      '<stop offset="0%" stop-color="#ffffff" stop-opacity=".22"/>' +
      '<stop offset="58%" stop-color="#ffffff" stop-opacity="0"/>' +
      '<stop offset="100%" stop-color="#000000" stop-opacity=".34"/></radialGradient></defs>';
    s += '<circle cx="100" cy="100" r="99" class="whl-rim"/>';
    SLOTS.forEach(function (seg, i) {
      s += '<path class="whl-seg" data-slot="' + i + '" d="' + wedge(i) + '" fill="' + seg.fill + '"/>';
    });
    SLOTS.forEach(function (seg, i) {
      var mid = i * STEP + STEP / 2;
      s += '<g transform="rotate(' + mid.toFixed(3) + ' 100 100)">' +
        '<text class="whl-lab" x="100" y="35" fill="' + seg.ink + '">' + esc(fmtMult(seg.m)) + '</text>' +
        '<text class="whl-odd" x="100" y="47" fill="' + seg.ink + '">' + seg.w + '%</text>' +
        '</g>';
    });
    s += '<circle cx="100" cy="100" r="96" fill="url(#whl-sheen)" pointer-events="none"/>';
    SLOTS.forEach(function (seg, i) {
      var p = polar(96, i * STEP);
      s += '<line class="whl-div" x1="100" y1="100" x2="' + p[0] + '" y2="' + p[1] + '"/>';
    });
    s += '<circle cx="100" cy="100" r="96" class="whl-edge"/>';
    s += '</svg>';
    return s;
  }
  function lightsSvg() {
    var s = '<svg class="whl-lights" viewBox="0 0 200 200" aria-hidden="true">';
    for (var i = 0; i < 24; i++) {
      var p = polar(99, i * 15);
      s += '<circle class="whl-bulb" cx="' + p[0] + '" cy="' + p[1] + '" r="2.1" ' +
        'style="animation-delay:' + (i * 0.055).toFixed(3) + 's"/>';
    }
    s += '</svg>';
    return s;
  }

  /* ── module state ── */
  var root = null, disc = null, hub = null, hubTop = null, hubSub = null;
  var spinBtn = null, resetBtn = null, soundBtn = null, msgEl = null;
  var statMult = null, statUses = null, stackEl = null, pricesEl = null, histEl = null;
  var fxEl = null, wrapEl = null;
  var spinning = false;
  var rotation = 0;
  var lastResult = null;
  var lastMsg = null;
  var lastMsgTone = 'flat';
  var resetArmed = 0;
  var langPending = false;
  var animatedThisSession = false;
  var rafId = 0, watchdog = 0;

  function tierOf(m) {
    for (var i = 0; i < SEGMENTS.length; i++) if (SEGMENTS[i].m === m) return SEGMENTS[i].tier;
    return m < 1 ? 'good' : (m > 1 ? 'bad' : 'flat');
  }
  function toneOf(m) { return m < 1 ? 'good' : (m > 1 ? 'bad' : 'flat'); }

  /* ── build ── */
  function build() {
    var el = document.createElement('div');
    el.className = 'whl';
    el.innerHTML =
      '<div class="whl-head">' +
        '<span class="whl-title">' + esc(S('title')) + '</span>' +
        '<button type="button" class="whl-sound" data-whl="sound"></button>' +
      '</div>' +
      '<p class="whl-lead">' + esc(S('leadShort')) + '</p>' +
      '<div class="whl-stage">' +
        '<div class="whl-wheelwrap">' +
          lightsSvg() + discSvg() +
          '<div class="whl-pointer"></div>' +
          '<button type="button" class="whl-hub">' +
            '<span class="whl-hub-top"></span><span class="whl-hub-sub"></span>' +
          '</button>' +
          '<div class="whl-fx"></div>' +
        '</div>' +
        '<div class="whl-side">' +
          '<div class="whl-stats">' +
            '<div class="whl-stat"><span class="whl-k">' + esc(S('active')) + '</span>' +
              '<span class="whl-v" data-whl="mult">\u00d71</span></div>' +
            '<div class="whl-stat"><span class="whl-k">' + esc(S('uses')) + '</span>' +
              '<span class="whl-v" data-whl="uses">0</span></div>' +
          '</div>' +
          '<p class="whl-msg" role="status" aria-live="polite"></p>' +
          '<button type="button" class="whl-spin"></button>' +
          '<button type="button" class="whl-reset" hidden></button>' +
        '</div>' +
      '</div>' +
      '<div class="whl-sect">' +
        '<h4 class="whl-h">' + esc(S('odds')) + '</h4>' +
        '<p class="whl-sub">' + esc(S('lead')) + '</p>' +
        '<p class="whl-sub whl-stack"></p>' +
        '<div class="whl-odds">' + oddsHtml() + '</div>' +
        '<p class="whl-ev">' + esc(evLine()) + '</p>' +
      '</div>' +
      '<div class="whl-sect">' +
        '<h4 class="whl-h">' + esc(S('prices')) + '</h4>' +
        '<p class="whl-sub">' + esc(S('pricesHint')) + '</p>' +
        '<div class="whl-prices"></div>' +
      '</div>' +
      '<div class="whl-sect">' +
        '<h4 class="whl-h">' + esc(S('history')) + '</h4>' +
        '<div class="whl-hist"></div>' +
      '</div>' +
      '<p class="whl-note">' + esc(S('localNote')) + '</p>';

    root = el;
    disc = el.querySelector('.whl-disc');
    wrapEl = el.querySelector('.whl-wheelwrap');
    hub = el.querySelector('.whl-hub');
    hubTop = el.querySelector('.whl-hub-top');
    hubSub = el.querySelector('.whl-hub-sub');
    fxEl = el.querySelector('.whl-fx');
    spinBtn = el.querySelector('.whl-spin');
    resetBtn = el.querySelector('.whl-reset');
    soundBtn = el.querySelector('.whl-sound');
    msgEl = el.querySelector('.whl-msg');
    statMult = el.querySelector('[data-whl="mult"]');
    statUses = el.querySelector('[data-whl="uses"]');
    stackEl = el.querySelector('.whl-stack');
    pricesEl = el.querySelector('.whl-prices');
    histEl = el.querySelector('.whl-hist');

    hub.addEventListener('click', doSpin);
    spinBtn.addEventListener('click', doSpin);
    resetBtn.addEventListener('click', doReset);
    soundBtn.addEventListener('click', toggleSound);
    disc.style.transform = 'rotate(' + rotation + 'deg)';
    return el;
  }

  function oddsHtml() {
    var total = 0;
    SEGMENTS.forEach(function (s) { total += s.w; });
    return SEGMENTS.map(function (s) {
      var eff = s.m < 1 ? sf('oddsGood', { p: fmt((1 - s.m) * 100) })
        : s.m > 1 ? sf('oddsBad', { p: fmt((s.m - 1) * 100) })
        : S('oddsFlat');
      return '<div class="whl-odd-row" data-tone="' + toneOf(s.m) + '">' +
        '<span class="whl-sw" style="background:' + s.fill + '"></span>' +
        '<span class="whl-odd-m">' + esc(fmtMult(s.m)) + '</span>' +
        '<span class="whl-odd-w">' + stat2(s.w * 100 / total) + '%</span>' +
        '<span class="whl-odd-e">' + esc(eff) + '</span>' +
        '</div>';
    }).join('');
  }
  function evLine() {
    var total = 0, ev = 0, good = 0, flat = 0, bad = 0;
    SEGMENTS.forEach(function (s) {
      total += s.w; ev += s.m * s.w;
      if (s.m < 1) good += s.w; else if (s.m > 1) bad += s.w; else flat += s.w;
    });
    return sf('ev', {
      m: '\u00d7' + stat2(ev / total),
      good: stat2(good * 100 / total),
      flat: stat2(flat * 100 / total),
      bad: stat2(bad * 100 / total)
    });
  }

  /* ── live paint ── */
  function previewItems() {
    var sh = shop(), out = [];
    if (!sh || !sh.catalogue) return out;
    var c = sh.catalogue;
    [1, 6, 8, 26, 79].forEach(function (z) {
      var el = null;
      var a = window.__mol3d;
      if (a && a.ELEMENTS) for (var i = 0; i < a.ELEMENTS.length; i++) if (a.ELEMENTS[i].z === z) { el = a.ELEMENTS[i]; break; }
      out.push({ label: el ? el.sym : 'Z' + z, sub: S('atom'), base: c.unitPrice(z) });
    });
    out.push({ label: S('ammo'), sub: '', base: c.ammoPrice });
    (c.features || []).forEach(function (f) {
      out.push({
        label: sh.featureName ? sh.featureName(f.id) : f.id,
        sub: '', base: sh.priceOf(f.price, f.min), owned: sh.ownsFeature(f.id)
      });
    });
    return out;
  }

  function paintPrices() {
    var e = econ();
    if (!pricesEl || !e) return;
    pricesEl.innerHTML = previewItems().map(function (it) {
      return '<div class="whl-price' + (it.owned ? ' is-owned' : '') + '">' +
        '<span class="whl-price-k">' + esc(it.label) +
          (it.sub ? '<i>' + esc(it.sub) + '</i>' : '') + '</span>' +
        '<span class="whl-price-v">' +
          (it.owned ? '<em class="whl-owned">' + esc(S('owned')) + '</em>' : e.priceHtml(it.base, { detail: true })) +
        '</span>' +
        '</div>';
    }).join('');
  }

  function paintHistory() {
    var e = econ();
    if (!histEl || !e) return;
    var tx = e.transactions().filter(function (t) { return t.kind === 'spin'; }).slice(-8).reverse();
    if (!tx.length) {
      histEl.innerHTML = '<span class="whl-empty">' + esc(S('histEmpty')) + '</span>';
      return;
    }
    histEl.innerHTML = tx.map(function (t) {
      var m = Number(t.meta && t.meta.m) || 1;
      var d = new Date(t.at);
      var hh = ('0' + d.getHours()).slice(-2), mm = ('0' + d.getMinutes()).slice(-2);
      return '<span class="whl-hist-i" data-tone="' + toneOf(m) + '" title="' +
        esc(hh + ':' + mm + ' \u00b7 ' + S('pending')) + '">' + esc(fmtMult(m)) + '</span>';
    }).join('');
  }

  function paint() {
    var e = econ();
    if (!root || !e) return;
    var m = e.mult(), uses = e.uses(), bal = e.balance();
    var tone = toneOf(m);

    statMult.textContent = fmtMult(m);
    statMult.dataset.tone = uses > 0 ? tone : 'flat';
    statUses.textContent = String(uses);
    statUses.dataset.tone = uses > 0 ? tone : 'flat';

    stackEl.textContent = uses > 0
      ? sf('stackNow', { a: fmtMult(m), n: uses })
      : sf('stackIdle', { n: e.usesPerActivation });

    var afford = bal + 1e-9 >= COST;
    hub.disabled = spinning || !afford;
    spinBtn.disabled = spinning || !afford;
    hub.classList.toggle('is-poor', !afford && !spinning);
    spinBtn.classList.toggle('is-poor', !afford && !spinning);
    hub.classList.toggle('is-spinning', spinning);
    wrapEl.classList.toggle('is-spinning', spinning);
    spinBtn.classList.toggle('is-spinning', spinning);

    if (spinning) {
      hubTop.textContent = S('spinning');
      hubSub.textContent = '\u2026';
      spinBtn.textContent = S('spinning') + '\u2026';
    } else if (lastResult !== null) {
      hubTop.textContent = fmtMult(lastResult);
      hubTop.dataset.tone = toneOf(lastResult);
      hubSub.textContent = sf('cost', { n: fmt(COST) });
      spinBtn.textContent = S('spin') + ' \u00b7 ' + sf('cost', { n: fmt(COST) });
    } else {
      hubTop.textContent = S('spin');
      delete hubTop.dataset.tone;
      hubSub.textContent = sf('cost', { n: fmt(COST) });
      spinBtn.textContent = S('spin') + ' \u00b7 ' + sf('cost', { n: fmt(COST) });
    }
    // A stacked rate can run to six decimals; the hub is a fixed circle, so the
    // label steps down rather than overflowing it.
    hubTop.style.fontSize = hubTop.textContent.length > 7 ? '9px'
      : hubTop.textContent.length > 5 ? '11px' : '';
    hub.title = afford ? sf('hubHint', { n: fmt(COST) }) : sf('poor', { n: fmt(COST) });
    hub.setAttribute('aria-label', hub.title);
    spinBtn.title = hub.title;

    resetBtn.hidden = !(m !== 1 && uses > 0) || spinning;
    resetBtn.textContent = resetArmed ? S('resetArm') : S('reset');
    resetBtn.classList.toggle('armed', !!resetArmed);

    soundBtn.textContent = muted ? '\uD83D\uDD07' : '\uD83D\uDD0A';
    soundBtn.title = muted ? S('soundOff') : S('soundOn');
    soundBtn.setAttribute('aria-label', S('sound') + ': ' + soundBtn.title);
    soundBtn.classList.toggle('off', muted);

    msgEl.textContent = lastMsg || '';
    msgEl.dataset.tone = lastMsg ? lastMsgTone : 'flat';
    msgEl.hidden = !lastMsg;

    paintPrices();
    paintHistory();
  }

  /* ── effects ── */
  function burst(count, colors) {
    if (!fxEl) return;
    for (var i = 0; i < count; i++) {
      var p = document.createElement('i');
      p.className = 'whl-part';
      var a = Math.random() * Math.PI * 2;
      var d = 60 + Math.random() * 110;
      p.style.setProperty('--dx', (Math.cos(a) * d).toFixed(1) + 'px');
      p.style.setProperty('--dy', (Math.sin(a) * d).toFixed(1) + 'px');
      p.style.setProperty('--sc', (0.5 + Math.random() * 1.1).toFixed(2));
      p.style.background = colors[i % colors.length];
      p.style.animationDelay = (Math.random() * 0.18).toFixed(3) + 's';
      fxEl.appendChild(p);
      (function (node) { setTimeout(function () { if (node.parentNode) node.remove(); }, 1500); })(p);
    }
  }
  function flash(kind) {
    var f = document.createElement('div');
    f.className = 'whl-flash whl-flash-' + kind;
    document.body.appendChild(f);
    setTimeout(function () { if (f.parentNode) f.remove(); }, kind === 'jackpot' ? 1500 : 1100);
  }
  function shake() {
    if (!wrapEl) return;
    wrapEl.classList.remove('is-quake');
    void wrapEl.offsetWidth;
    wrapEl.classList.add('is-quake');
    setTimeout(function () { if (wrapEl) wrapEl.classList.remove('is-quake'); }, 620);
  }
  function say(msg, tone) {
    lastMsg = msg;
    lastMsgTone = tone || (lastResult !== null ? toneOf(lastResult) : 'flat');
    paint();
    var a = window.__mol3d;
    if (a && typeof a.status === 'function') {
      try { a.status(msg, lastMsgTone === 'good' ? 'ok' : 'warn', 7000); } catch (err) {}
    }
  }

  /* ── the spin ── */
  function rollSlot() {
    var e = econ();
    var entries = SLOTS.map(function (s, i) { return { w: s.w, i: i, m: s.m }; });
    var hit = e.weighted(entries);
    return hit ? hit.i : 0;
  }

  function doSpin() {
    var e = econ();
    if (!e) return;
    if (spinning) { say(S('wait')); return; }
    if (e.balance() + 1e-9 < COST) {
      SND.poor();
      say(sf('poor', { n: fmt(COST) }), 'bad');
      if (wrapEl) { wrapEl.classList.remove('is-nope'); void wrapEl.offsetWidth; wrapEl.classList.add('is-nope'); }
      return;
    }
    // Synchronous guard before anything asynchronous: a second click in the same
    // tick cannot start a second disc or a second debit.
    spinning = true;
    resetArmed = 0;
    lastResult = null;
    lastMsg = null;
    paint();

    var slot = rollSlot();
    var seg = SLOTS[slot];
    var before = { mult: e.mult(), uses: e.uses() };
    var id = e.uid('spin');
    var res = e.purchase({
      id: id, kind: 'spin', cost: COST,
      rewards: [{
        id: 'wheel_x' + String(seg.m).replace('.', '_'),
        kind: 'mult', mult: seg.m, rarity: seg.tier,
        name: { en: 'Price multiplier ' + fmtMult(seg.m), vi: 'H\u1ec7 s\u1ed1 gi\u00e1 ' + fmtMult(seg.m) },
        value: 0
      }],
      meta: { m: seg.m, slot: slot }
    });
    if (!res.ok) {
      spinning = false;
      SND.poor();
      say(sf('poor', { n: fmt(COST) }), 'bad');
      return;
    }

    SND.start();
    animate(slot, function () {
      e.claim(id);
      spinning = false;
      animatedThisSession = true;
      lastResult = seg.m;
      finishMessage(seg, before, e);
      celebrate(seg);
      paint();
      var sh = shop();
      if (sh && sh.isOpen()) sh.rerender();
      if (langPending) { langPending = false; relang(); }
    });
  }

  function finishMessage(seg, before, e) {
    var m = e.mult(), uses = e.uses();
    var pct = fmt(seg.m * 100);
    if (before.uses > 0) {
      say(sf('resultStack', { before: fmtMult(before.mult), spun: fmtMult(seg.m), m: fmtMult(m), n: uses }));
      return;
    }
    if (seg.m === 1) { say(S('resultFlat')); return; }
    if (seg.m <= 0.1) { say(sf('jackpot', { n: uses })); return; }
    if (seg.m >= 10) { say(sf('worst', { n: uses })); return; }
    say(seg.m < 1
      ? sf('resultGood', { m: fmtMult(seg.m), p: pct, n: uses })
      : sf('resultBad', { m: fmtMult(seg.m), p: pct, n: uses }));
  }

  function celebrate(seg) {
    var slot = SLOTS.indexOf(seg);
    if (disc) {
      disc.querySelectorAll('.whl-seg').forEach(function (p) {
        p.classList.toggle('is-win', Number(p.dataset.slot) === slot);
      });
    }
    if (seg.tier === 'jackpot' || seg.tier === 'great') {
      SND.jackpot();
      flash('jackpot');
      burst(46, ['#00ffc8', '#7ef9ff', '#ffe08a', '#ffffff', '#00e6a2']);
      shake();
    } else if (seg.tier === 'worst' || seg.tier === 'worse') {
      SND.worst();
      flash('bad');
      burst(26, ['#ff1744', '#d62f63', '#7a0f22']);
      shake();
    } else if (seg.m < 1) {
      SND.land();
      burst(20, [seg.fill, '#7ef9ff', '#ffffff']);
    } else if (seg.m > 1) {
      SND.bad();
      burst(14, [seg.fill, '#ffaa00']);
    } else {
      SND.land();
    }
    setTimeout(function () {
      if (disc) disc.querySelectorAll('.whl-seg.is-win').forEach(function (p) { p.classList.remove('is-win'); });
    }, 4200);
  }

  /* Elapsed-time driven, with an interval watchdog beside rAF: a backgrounded
     tab fires no animation frames at all, and the spin must still land and
     claim rather than stall with the player's 50 stars already spent. */
  function animate(slot, done) {
    var target = -(slot * STEP + STEP / 2);
    var start = rotation;
    var startNorm = ((start % 360) + 360) % 360;
    var wantNorm = ((target % 360) + 360) % 360;
    var delta = ((wantNorm - startNorm) + 360) % 360;
    var e = econ();
    var turns = TURNS_MIN + (e ? e.randInt(TURNS_VAR) : Math.floor(Math.random() * TURNS_VAR));
    var total = turns * 360 + delta;
    var dur = DUR_MIN + (e ? e.rand() : Math.random()) * DUR_VAR;
    var t0 = Date.now();
    var finished = false;
    var lastSector = Math.floor(startNorm / STEP);
    var lastTick = 0;

    function frame() {
      if (finished) return;
      var now = Date.now();
      var t = Math.min(1, (now - t0) / dur);
      var eased = 1 - Math.pow(1 - t, 4);
      rotation = start + total * eased;
      if (disc) disc.style.transform = 'rotate(' + rotation.toFixed(3) + 'deg)';

      var norm = ((rotation % 360) + 360) % 360;
      var sector = Math.floor(norm / STEP);
      if (sector !== lastSector) {
        lastSector = sector;
        if (now - lastTick > 42) {
          lastTick = now;
          SND.tick(Math.pow(t, 2.2));
        }
      }
      if (t >= 1) {
        finished = true;
        rotation = start + total;
        if (disc) disc.style.transform = 'rotate(' + rotation.toFixed(3) + 'deg)';
        stop();
        done();
      }
    }
    function stop() {
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      if (watchdog) { clearInterval(watchdog); watchdog = 0; }
    }
    function loop() {
      frame();
      if (!finished) rafId = requestAnimationFrame(loop);
    }
    watchdog = setInterval(frame, 32);
    if (typeof requestAnimationFrame === 'function') rafId = requestAnimationFrame(loop);
    else frame();
  }

  /* ── secondary controls ── */
  function doReset() {
    var e = econ();
    if (!e || spinning) return;
    if (!resetArmed) {
      resetArmed = 1;
      paint();
      setTimeout(function () { if (resetArmed) { resetArmed = 0; paint(); } }, 3200);
      return;
    }
    resetArmed = 0;
    e.clearMultiplier();
    lastResult = null;
    say(S('resetDone'));
    SND.land();
    paint();
    var sh = shop();
    if (sh && sh.isOpen()) sh.rerender();
  }
  function toggleSound() {
    muted = !muted;
    try { localStorage.setItem(SOUND_KEY, muted ? '0' : '1'); } catch (err) {}
    if (!muted) SND.land();
    paint();
  }

  /* ── language ── */
  function relang() {
    if (spinning) { langPending = true; return; }
    var old = root;
    root = null;
    build();
    if (old && old.parentNode) old.parentNode.replaceChild(root, old);
    paint();
    var sh = shop();
    if (sh && sh.registerTab) sh.rerender();
  }

  /* ── styles ── */
  function css() {
    return [
      '.whl{display:flex;flex-direction:column;gap:10px;font-size:var(--fs-sm,12px);color:var(--text);}',
      '.whl-head{display:flex;align-items:center;gap:8px;}',
      '.whl-title{font-weight:800;font-size:13px;letter-spacing:.3px;',
      '  background:linear-gradient(96deg,var(--rz-mint,#00ffc8),var(--accent,#00d4ff) 52%,var(--rz-magenta,#ff4fd8));',
      '  -webkit-background-clip:text;background-clip:text;color:transparent;}',
      '.whl-sound{margin-left:auto;width:26px;height:26px;flex:none;border-radius:8px;cursor:pointer;',
      '  border:1px solid var(--border);background:var(--panel-2);color:var(--text);font-size:12px;line-height:1;}',
      '.whl-sound:hover{border-color:var(--accent);}',
      '.whl-sound.off{opacity:.5;}',
      '.whl-lead{margin:0;font-size:10.5px;line-height:1.5;color:var(--muted);}',

      '.whl-stage{display:grid;grid-template-columns:minmax(0,46%) minmax(0,1fr);gap:10px;align-items:start;}',
      // The disc shares the panel's width with its controls rather than stacking
      // above them: on a short screen the whole spin has to fit without scrolling.
      '.whl-wheelwrap{position:relative;width:100%;max-width:220px;aspect-ratio:1/1;',
      '  margin:0 auto;flex:none;filter:drop-shadow(0 8px 22px rgba(0,0,0,.5));}',
      '.whl-disc,.whl-lights{position:absolute;inset:0;width:100%;height:100%;display:block;}',
      '.whl-disc{will-change:transform;}',
      '.whl-lights{pointer-events:none;}',
      '.whl-rim{fill:none;stroke:var(--border);stroke-width:2;}',
      '.whl-edge{fill:none;stroke:rgba(0,0,0,.45);stroke-width:1.5;}',
      '.whl-div{stroke:rgba(4,10,20,.42);stroke-width:.9;}',
      '.whl-seg{transition:filter .25s,opacity .25s;}',
      '.whl-seg.is-win{filter:brightness(1.45) saturate(1.2) drop-shadow(0 0 6px currentColor);}',
      '.whl-lab{font:800 11px/1 system-ui,sans-serif;text-anchor:middle;letter-spacing:-.2px;}',
      '.whl-odd{font:700 6.5px/1 system-ui,sans-serif;text-anchor:middle;opacity:.72;}',
      '.whl-bulb{fill:var(--rz-mint,#00ffc8);opacity:.22;}',
      '.whl-wheelwrap.is-spinning .whl-bulb{animation:whlChase 1.32s linear infinite;}',
      '@keyframes whlChase{0%,100%{opacity:.18;}12%{opacity:1;r:2.9;}}',

      '.whl-pointer{position:absolute;left:50%;top:-3px;width:0;height:0;transform:translateX(-50%);',
      '  border-left:9px solid transparent;border-right:9px solid transparent;',
      '  border-top:17px solid var(--rz-magenta,#ff4fd8);z-index:3;',
      '  filter:drop-shadow(0 0 7px var(--rz-magenta,#ff4fd8));}',
      '.whl-hub{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:4;',
      '  width:37%;aspect-ratio:1/1;border-radius:50%;cursor:pointer;font:inherit;',
      '  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;',
      '  border:2px solid var(--rz-mint,#00ffc8);color:var(--text);',
      '  background:radial-gradient(circle at 50% 34%,var(--panel-2,#101a30),var(--panel,#0a0e1a) 72%);',
      '  box-shadow:0 0 0 3px rgba(4,10,20,.6),0 0 18px var(--accent-glow,rgba(0,212,255,.4)),',
      '    inset 0 0 14px rgba(0,255,200,.14);',
      '  transition:box-shadow .22s,border-color .22s,transform .18s;}',
      '.whl-hub:hover:not(:disabled){transform:translate(-50%,-50%) scale(1.05);',
      '  box-shadow:0 0 0 3px rgba(4,10,20,.6),0 0 28px var(--rz-mint,#00ffc8);}',
      '.whl-hub:disabled{cursor:default;}',
      '.whl-hub.is-poor{border-color:var(--err);opacity:.6;}',
      '.whl-hub.is-spinning{border-color:var(--rz-magenta,#ff4fd8);animation:whlHub 1.1s ease-in-out infinite;}',
      '@keyframes whlHub{0%,100%{box-shadow:0 0 0 3px rgba(4,10,20,.6),0 0 14px var(--accent-glow);}',
      '50%{box-shadow:0 0 0 3px rgba(4,10,20,.6),0 0 30px var(--rz-magenta,#ff4fd8);}}',
      '.whl-hub-top{font-weight:900;font-size:clamp(9px,2.2vw,15px);letter-spacing:.3px;line-height:1.05;',
      '  font-variant-numeric:tabular-nums;}',
      '.whl-hub-top[data-tone="good"]{color:var(--ok-text,#7ee2a8);}',
      '.whl-hub-top[data-tone="bad"]{color:var(--err-text,#ff6688);}',
      '.whl-hub-sub{font-size:9px;font-weight:700;color:var(--warn,#ffaa00);}',

      '.whl-fx{position:absolute;inset:0;pointer-events:none;z-index:5;overflow:visible;}',
      '.whl-part{position:absolute;left:50%;top:50%;width:6px;height:6px;border-radius:2px;',
      '  animation:whlPart 1.25s cubic-bezier(.15,.7,.3,1) forwards;}',
      '@keyframes whlPart{0%{transform:translate(-50%,-50%) scale(.3);opacity:1;}',
      '100%{transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(var(--sc));opacity:0;}}',
      '.whl-wheelwrap.is-quake{animation:whlQuake .6s ease-out;}',
      '@keyframes whlQuake{0%,100%{translate:0 0;}15%{translate:-5px 2px;}30%{translate:5px -3px;}',
      '45%{translate:-4px -2px;}60%{translate:3px 3px;}80%{translate:-2px 1px;}}',
      '.whl-wheelwrap.is-nope{animation:whlNope .4s ease;}',
      '@keyframes whlNope{0%,100%{translate:0 0;}25%{translate:-7px 0;}60%{translate:6px 0;}}',

      '.whl-side{display:flex;flex-direction:column;gap:6px;min-width:0;}',
      '.whl-stats{display:flex;flex-direction:column;gap:4px;}',
      '.whl-stat{display:flex;align-items:baseline;justify-content:space-between;gap:6px;',
      '  padding:5px 8px;border-radius:10px;background:var(--panel-2);border:1px solid var(--border);}',
      '.whl-k{font-size:9px;font-weight:700;color:var(--muted);letter-spacing:.2px;',
      '  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.whl-v{font-size:14px;font-weight:900;font-variant-numeric:tabular-nums;line-height:1;flex:none;}',
      '.whl-v[data-tone="good"]{color:var(--ok-text,#7ee2a8);}',
      '.whl-v[data-tone="bad"]{color:var(--err-text,#ff6688);}',
      '.whl-stack{margin:0;font-size:10px;line-height:1.45;color:var(--muted);}',
      '.whl-msg{margin:0;font-size:10.5px;line-height:1.45;font-weight:700;padding:6px 8px;border-radius:9px;',
      '  background:var(--accent-soft);border:1px solid var(--border);}',
      '.whl-msg[hidden]{display:none;}',
      '.whl-msg[data-tone="good"]{color:var(--ok-text,#7ee2a8);border-color:rgba(0,255,136,.34);background:var(--ok-soft);}',
      '.whl-msg[data-tone="bad"]{color:var(--err-text,#ff6688);border-color:rgba(255,51,102,.34);background:var(--err-soft);}',
      '.whl-spin{padding:9px 12px;border-radius:11px;cursor:pointer;font:inherit;font-weight:900;',
      '  font-size:12px;letter-spacing:.5px;color:var(--on-accent,#04121c);border:none;',
      '  background:linear-gradient(96deg,var(--rz-mint,#00ffc8),var(--accent,#00d4ff));',
      '  box-shadow:0 4px 16px var(--accent-glow,rgba(0,212,255,.4));transition:filter .18s,transform .18s;}',
      '.whl-spin:hover:not(:disabled){filter:brightness(1.12);transform:translateY(-1px);}',
      '.whl-spin:disabled{cursor:default;filter:grayscale(.55);opacity:.6;box-shadow:none;}',
      '.whl-spin.is-spinning{background:linear-gradient(96deg,var(--rz-magenta,#ff4fd8),var(--accent,#00d4ff));}',
      '.whl-reset{padding:5px 10px;border-radius:9px;cursor:pointer;font:inherit;font-size:10px;font-weight:700;',
      '  background:transparent;border:1px solid var(--border);color:var(--muted);}',
      '.whl-reset:hover{border-color:var(--err);color:var(--err-text);}',
      '.whl-reset.armed{border-color:var(--err);color:var(--err-text);background:var(--err-soft);}',
      '.whl-reset[hidden]{display:none;}',

      '.whl-sect{display:flex;flex-direction:column;gap:5px;padding-top:8px;border-top:1px solid var(--border);}',
      '.whl-h{margin:0;font-size:10px;font-weight:800;letter-spacing:.7px;text-transform:uppercase;color:var(--accent);}',
      '.whl-sub{margin:0;font-size:9.5px;line-height:1.4;color:var(--muted);}',
      '.whl-prices{display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:5px;}',
      '.whl-price{display:flex;align-items:center;justify-content:space-between;gap:7px;',
      '  padding:5px 8px;border-radius:9px;background:var(--panel-2);border:1px solid var(--border);}',
      '.whl-price.is-owned{opacity:.55;}',
      '.whl-price-k{display:flex;flex-direction:column;font-size:11px;font-weight:800;min-width:0;',
      '  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.whl-price-k i{font-style:normal;font-size:8.5px;font-weight:600;color:var(--muted);}',
      '.whl-price-v{flex:none;font-size:10.5px;}',
      '.whl-odds{display:grid;grid-template-columns:repeat(auto-fill,minmax(152px,1fr));gap:4px;}',
      '.whl-odd-row{display:flex;align-items:center;gap:6px;padding:4px 7px;border-radius:8px;',
      '  background:var(--row-alt,rgba(0,212,255,.03));border:1px solid var(--border);}',
      '.whl-sw{width:9px;height:9px;border-radius:3px;flex:none;box-shadow:0 0 6px currentColor;}',
      '.whl-odd-m{font-size:11px;font-weight:900;font-variant-numeric:tabular-nums;min-width:38px;}',
      '.whl-odd-row[data-tone="good"] .whl-odd-m{color:var(--ok-text,#7ee2a8);}',
      '.whl-odd-row[data-tone="bad"] .whl-odd-m{color:var(--err-text,#ff6688);}',
      '.whl-odd-w{font-size:9.5px;font-weight:800;color:var(--warn,#ffaa00);min-width:26px;text-align:right;',
      '  font-variant-numeric:tabular-nums;}',
      '.whl-odd-e{font-size:9px;color:var(--muted);margin-left:auto;white-space:nowrap;}',
      '.whl-ev{margin:0;font-size:9.5px;line-height:1.45;color:var(--muted);}',
      '.whl-hist{display:flex;flex-wrap:wrap;gap:4px;}',
      '.whl-empty{font-size:10px;color:var(--muted);}',
      '.whl-hist-i{padding:3px 7px;border-radius:8px;font-size:10.5px;font-weight:800;',
      '  font-variant-numeric:tabular-nums;border:1px solid var(--border);background:var(--panel-2);}',
      '.whl-hist-i[data-tone="good"]{color:var(--ok-text,#7ee2a8);border-color:rgba(0,255,136,.3);}',
      '.whl-hist-i[data-tone="bad"]{color:var(--err-text,#ff6688);border-color:rgba(255,51,102,.3);}',
      '.whl-note{margin:0;font-size:9px;color:var(--accent);opacity:.8;line-height:1.4;}',

      /* Light shell: the neon headings and the spin button are the wheel's accent
         hues, and at 9-13px on a light panel they land between 3.3:1 and 4:1. The
         hues are kept, their lightness dropped — the same move --rz-* makes — and
         the spin button keeps the shell's --on-accent ink (white on light) over a
         deepened ramp so its label clears 5:1.
         The title is background-clip:text, so only background-image may be overridden
         here: the `background` shorthand would reset the clip and paint a bar. */
      'html[data-theme=light] .whl-title{background-image:linear-gradient(96deg,var(--rz-mint,#0b6f66),var(--rz-ink,#0369a1) 52%,var(--rz-magenta,#a21caf))}',
      'html[data-theme=light] .whl-h{color:var(--rz-ink,#0369a1)}',
      'html[data-theme=light] .whl-note{color:var(--rz-ink,#0369a1);opacity:1}',
      'html[data-theme=light] .whl-spin{background:linear-gradient(96deg,var(--rz-mint,#0b6f66),var(--rz-ink,#0369a1))}',
      'html[data-theme=light] .whl-spin.is-spinning{background:linear-gradient(96deg,var(--rz-magenta,#a21caf),var(--rz-ink,#0369a1))}',

      '.whl-flash{position:fixed;inset:0;z-index:10020;pointer-events:none;}',
      '.whl-flash-jackpot{background:radial-gradient(circle at 50% 45%,rgba(0,255,200,.5),rgba(0,212,255,.2) 45%,transparent 72%);',
      '  animation:whlFlashGood 1.4s ease-out forwards;}',
      '.whl-flash-bad{background:radial-gradient(circle at 50% 45%,rgba(255,23,68,.55),rgba(120,0,20,.3) 50%,transparent 76%);',
      '  animation:whlFlashBad 1s ease-out forwards;}',
      '@keyframes whlFlashGood{0%{opacity:0;}12%{opacity:1;}100%{opacity:0;}}',
      '@keyframes whlFlashBad{0%{opacity:0;}8%{opacity:1;}22%{opacity:.35;}34%{opacity:.9;}100%{opacity:0;}}',

      '@media (min-width:700px){',
      '  .whl-stage{grid-template-columns:minmax(0,220px) minmax(0,1fr);gap:12px;}',
      '  .whl-stats{display:grid;grid-template-columns:1fr 1fr;gap:6px;}',
      '  .whl-stat{flex-direction:column;align-items:flex-start;gap:2px;padding:6px 8px;}',
      '  .whl-v{font-size:16px;}',
      '}',
      // A tall phone has height to spare, so the disc goes back on top and grows.
      '@media (max-width:699px) and (min-height:700px){',
      '  .whl-stage{grid-template-columns:minmax(0,1fr);}',
      '  .whl-wheelwrap{width:min(240px,62vw);}',
      '  .whl-stats{display:grid;grid-template-columns:1fr 1fr;gap:6px;}',
      '  .whl-stat{flex-direction:column;align-items:flex-start;gap:2px;}',
      '}',
      '@media (max-width:379px){',
      '  .whl-stage{grid-template-columns:minmax(0,1fr);}',
      '  .whl-wheelwrap{width:min(200px,58vw);}',
      '}',
      // The wheel is the one category whose primary control is a large object, so
      // it claims more of the panel's height than a list of cards needs.
      '#shop-panel:has(.whl) .shop-body{max-height:min(64vh,520px);}',
      '@media (prefers-reduced-motion:reduce){',
      '  .whl-bulb,.whl-hub.is-spinning,.whl-part,.whl-flash{animation:none !important;}',
      '  .whl-wheelwrap.is-quake,.whl-wheelwrap.is-nope{animation:none !important;}',
      '}'
    ].join('\n');
  }
  function injectStyles() {
    if (document.getElementById('mol-wheel-styles')) return;
    var el = document.createElement('style');
    el.id = 'mol-wheel-styles';
    el.textContent = css();
    document.head.appendChild(el);
  }

  /* ── mount ── */
  function sig() {
    return [spinning ? 1 : 0, lastResult, lastMsg || '', muted ? 1 : 0, resetArmed].join('|');
  }
  function renderTab() {
    if (!root) build();
    paint();
    return root;
  }
  function restoreNote() {
    var e = econ();
    if (!e || animatedThisSession) return;
    var tx = e.transactions().filter(function (t) { return t.kind === 'spin'; });
    var last = tx[tx.length - 1];
    if (!last || last.state !== 'claimed' || !last.claimedAt) return;
    // A normal spin claims about six seconds after it was paid; one claimed
    // within moments of this page loading was resumed, not watched.
    if (Date.now() - last.claimedAt > 12000) return;
    var m = Number(last.meta && last.meta.m) || 1;
    lastResult = m;
    lastMsg = sf('restored', { m: fmtMult(m) });
    lastMsgTone = toneOf(m);
  }

  function attach(tries) {
    var e = econ(), sh = shop();
    if (!e || !sh || typeof sh.registerTab !== 'function') {
      if (tries < 80) setTimeout(function () { attach(tries + 1); }, 300);
      return;
    }
    injectStyles();
    restoreNote();
    sh.registerTab({
      id: 'wheel', order: 20,
      label: function () { return S('tab'); },
      render: renderTab,
      sig: sig
    });

    e.on('mult', paint);
    e.on('balance', paint);
    e.on('event', paint);
    e.on('override', paint);
    window.addEventListener('mol3d:lang', relang);
    window.addEventListener('pagehide', function () {
      if (watchdog) clearInterval(watchdog);
      if (rafId) cancelAnimationFrame(rafId);
    });

    window.__mol3dWheel = {
      version: 1,
      cost: COST,
      segments: SEGMENTS.map(function (s) { return { mult: s.m, weight: s.w, tier: s.tier }; }),
      slots: SLOTS.map(function (s, i) { return { slot: i, mult: s.m, weight: s.w }; }),
      isSpinning: function () { return spinning; },
      lastResult: function () { return lastResult; },
      open: function () { sh.showTab('wheel'); },
      spin: doSpin,
      refresh: paint,
      sound: function (on) {
        if (typeof on === 'boolean' && on === muted) toggleSound();
        return !muted;
      }
    };
    e.emit('wheelReady', { cost: COST });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { attach(0); });
  else attach(0);
})();