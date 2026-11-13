/* MOLECULITH economy core.
   One place owns money: the balance, the price every surface quotes, the active
   multiplier, and the transaction log that makes a reward land exactly once.

   Money is stored in two pieces. The whole stars stay in the bundle's sealed
   ledger (mol3d.starLedger.v1) untouched, so every existing earner and spender
   keeps working. The sub-star remainder lives here in [0,1) under its own seal,
   which is what lets a 0.1x price of 0.3★ be charged exactly instead of being
   floored to zero or rounded up to one.

   SECURITY, STATED PLAINLY: this build is entirely client-side. The salt, the
   seal algorithm and the reward tables all ship in the page, so a player with
   devtools can forge a save. What the seals buy is tamper *evidence* and
   resistance to a copied save file — not authority. Drop rates are rolled with
   crypto.getRandomValues before any animation runs and written to disk before
   the first frame, so an interrupted opening still delivers and a replayed one
   cannot pay twice. None of that is server-validated anti-cheat, and nothing
   here claims to be. */
(function () {
  'use strict';
  if (window.__mol3dEcon) return;

  var SAVE_KEY = 'mol3d.econ.v1';
  var SALT_KEY = 'mol3d.starLedger.salt';
  var SCHEMA = 1;
  var EPS = 1e-9;
  var TX_KEEP = 120;
  var PEAK_RATE = 0.1;
  var MULT_MIN = 0.01;
  var MULT_MAX = 1000;
  var USES_PER_ACTIVATION = 10;

  var STR = {
    en: {
      stars: 'Stars',
      balanceTitle: 'Star balance — open the shop',
      multTitle: 'Active price multiplier — open the wheel',
      multUses: '{n} purchases left',
      eventTitle: 'Live event — open event status',
      nextCheck: 'Next event check',
      idle: 'No event',
      save: 'save {p}%',
      extra: '+{p}% cost',
      original: 'Original price',
      adjusted: 'You pay',
      multiplier: 'Multiplier',
      peak: 'PEAK DISCOUNT',
      market: 'BLACK MARKET',
      boost: 'Discount boost',
      localNote: 'Local save · tamper-evident, not server-verified',
      dupComp: 'Duplicate — converted to {n} ★',
      claimed: 'Rewards claimed',
      nothing: 'Nothing to claim',
      poor: 'Not enough stars',
      redeem: 'Summon',
      redeemOk: '{f} summoned',
      redeemPoor: 'Not enough atoms in the crate for {f}',
      invEmpty: 'No collectibles yet',
      expires: 'expires in {t}'
    },
    vi: {
      stars: 'Sao',
      balanceTitle: 'Số dư sao — mở cửa hàng',
      multTitle: 'Hệ số giá đang active — mở vòng quay',
      multUses: 'còn {n} lượt mua',
      eventTitle: 'Sự kiện đang diễn ra — mở bảng sự kiện',
      nextCheck: 'Lần kiểm tra sự kiện tới',
      idle: 'Không có sự kiện',
      save: 'giảm {p}%',
      extra: 'đắt hơn {p}%',
      original: 'Giá gốc',
      adjusted: 'Bạn trả',
      multiplier: 'Hệ số',
      peak: 'SIÊU GIẢM GIÁ',
      market: 'CHỢ ĐEN',
      boost: 'Ưu đãi giảm giá',
      localNote: 'Lưu cục bộ · chống sửa đổi, không xác thực máy chủ',
      dupComp: 'Trùng lặp — quy đổi thành {n} ★',
      claimed: 'Đã nhận thưởng',
      nothing: 'Không có gì để nhận',
      poor: 'Không đủ sao',
      redeem: 'Triệu hồi',
      redeemOk: 'Đã triệu hồi {f}',
      redeemPoor: 'Không đủ nguyên tử trong kho để tạo {f}',
      invEmpty: 'Chưa có vật phẩm sưu tầm',
      expires: 'hết hạn sau {t}'
    }
  };

  function api() { return window.__mol3d || null; }
  function shop() { return window.__mol3dShop || null; }
  function rm() {
    var a = api();
    return (a && a.progression && a.progression.rankManager) || null;
  }
  function lang() {
    var a = api();
    var l = a && a.i18n ? a.i18n.getLang() : null;
    if (!l) { try { l = localStorage.getItem('mol3d.lang'); } catch (e) {} }
    return l === 'en' ? 'en' : 'vi';
  }
  function S(k) { return STR[lang()][k] || STR.en[k] || k; }
  function sf(k, p) {
    var s = S(k);
    for (var key in (p || {})) s = s.split('{' + key + '}').join(String(p[key]));
    return s;
  }
  function L(v) {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    return v[lang()] || v.en || '';
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ── randomness ── */
  var cryptoObj = (typeof crypto !== 'undefined' && crypto.getRandomValues) ? crypto : null;
  function rand() {
    if (cryptoObj) {
      var b = new Uint32Array(1);
      cryptoObj.getRandomValues(b);
      return b[0] / 4294967296;
    }
    return Math.random();
  }
  function randInt(n) { return Math.floor(rand() * Math.max(1, n)); }
  function pick(arr) { return (arr && arr.length) ? arr[randInt(arr.length)] : null; }
  function shuffle(arr) {
    var a = (arr || []).slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = randInt(i + 1), t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  // entries: [{w: number, ...}] — one weighted draw, weights need not sum to 1.
  function weighted(entries) {
    var list = (entries || []).filter(function (e) { return e && Number(e.w) > 0; });
    if (!list.length) return null;
    var total = 0, i;
    for (i = 0; i < list.length; i++) total += Number(list[i].w);
    var r = rand() * total;
    for (i = 0; i < list.length; i++) {
      r -= Number(list[i].w);
      if (r < 0) return list[i];
    }
    return list[list.length - 1];
  }
  function uid(prefix) {
    var s = '';
    if (cryptoObj) {
      var b = new Uint8Array(8);
      cryptoObj.getRandomValues(b);
      for (var i = 0; i < 8; i++) s += b[i].toString(16).padStart(2, '0');
    } else {
      s = Math.random().toString(16).slice(2, 10) + Math.random().toString(16).slice(2, 10);
    }
    return (prefix || 'tx') + '_' + Date.now().toString(36) + '_' + s;
  }

  /* ── seal ── */
  function salt() {
    var s = null;
    try { s = localStorage.getItem(SALT_KEY); } catch (e) {}
    if (typeof s === 'string' && s.length >= 32) return s;
    var b = new Uint8Array(16), hex = '';
    if (cryptoObj) cryptoObj.getRandomValues(b);
    else for (var i = 0; i < 16; i++) b[i] = randInt(256);
    for (var j = 0; j < 16; j++) hex += b[j].toString(16).padStart(2, '0');
    try { localStorage.setItem(SALT_KEY, hex); } catch (e) {}
    return hex;
  }
  function sealStr(s) {
    var h1 = 2166136261 >>> 0, h2 = 3432345061 >>> 0;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
      h2 = Math.imul(h2 + c, 2246822519) >>> 0;
    }
    return (h1 >>> 0).toString(36) + '.' + (h2 >>> 0).toString(36);
  }

  /* ── state ── */
  var state = {
    frac: 0,
    mult: 1,
    uses: 0,
    spins: 0,
    boosts: [],
    inv: {},
    tx: [],
    event: null,
    market: null,
    nextCheck: 0
  };
  var seq = 0;

  function payload() {
    return {
      v: SCHEMA, frac: state.frac, mult: state.mult, uses: state.uses, spins: state.spins,
      boosts: state.boosts, inv: state.inv, tx: state.tx,
      event: state.event, market: state.market, nextCheck: state.nextCheck
    };
  }
  function save() {
    seq = (seq + 1) % 1e9;
    var body = JSON.stringify(payload());
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        seq: seq, seal: sealStr(salt() + '|' + seq + '|' + body), data: payload()
      }));
    } catch (e) { /* private mode: the session still works, it just will not persist */ }
  }
  function num(v, lo, hi, dflt) {
    var n = Number(v);
    if (!Number.isFinite(n)) return dflt;
    return Math.min(hi, Math.max(lo, n));
  }
  function applyPayload(p, s) {
    if (!p || p.v !== SCHEMA) return false;
    seq = Math.floor(Number(s)) || 0;
    state.frac = num(p.frac, 0, 0.999999, 0);
    state.mult = num(p.mult, MULT_MIN, MULT_MAX, 1);
    state.uses = Math.floor(num(p.uses, 0, USES_PER_ACTIVATION, 0));
    state.spins = Math.floor(num(p.spins, 0, 1e9, 0));
    state.boosts = Array.isArray(p.boosts) ? p.boosts.filter(validBoost) : [];
    state.inv = (p.inv && typeof p.inv === 'object') ? p.inv : {};
    state.tx = Array.isArray(p.tx) ? p.tx.filter(validTx) : [];
    state.event = validEvent(p.event) ? p.event : null;
    state.market = (p.market && Array.isArray(p.market.items)) ? p.market : null;
    state.nextCheck = num(p.nextCheck, 0, 8.64e15, 0);
    if (!state.uses) state.mult = 1;
    return true;
  }
  function sealedBody() {
    var body = payload();
    return { v: SCHEMA, seq: seq, seal: sealStr(salt() + '|' + seq + '|' + JSON.stringify(body)), data: body };
  }
  function readSealed(d) {
    if (!d || typeof d !== 'object' || !d.data) return null;
    if (typeof d.seal !== 'string') return null;
    if (d.seal !== sealStr(salt() + '|' + d.seq + '|' + JSON.stringify(d.data))) return null;
    return d;
  }
  function load() {
    var d = null;
    try { d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { return; }
    if (!d || typeof d !== 'object' || !d.data) return;
    // A pre-seal blob is honoured once and sealed on the next write, matching how
    // the star ledger treats its own unsigned history.
    if (typeof d.seal === 'string' && d.seal !== sealStr(salt() + '|' + d.seq + '|' + JSON.stringify(d.data))) {
      console.warn('[econ] seal mismatch — edited or copied save; multiplier, inventory and pending rewards dropped');
      return;
    }
    applyPayload(d.data, d.seq);
  }
  function validBoost(b) {
    return b && typeof b.id === 'string' && Number(b.rate) > 0 && Number(b.rate) <= 1 &&
      Number(b.uses) > 0 && Number(b.expires) > 0;
  }
  function validTx(t) {
    return t && typeof t.id === 'string' && typeof t.kind === 'string' &&
      typeof t.state === 'string' && Number.isFinite(Number(t.at));
  }
  function validEvent(e) {
    return e && typeof e.id === 'string' && Number(e.ends) > 0;
  }

  /* ── listeners ── */
  var listeners = {};
  function on(evt, fn) {
    if (typeof fn !== 'function') return function () {};
    (listeners[evt] || (listeners[evt] = [])).push(fn);
    return function () { off(evt, fn); };
  }
  function off(evt, fn) {
    var a = listeners[evt];
    if (!a) return;
    var i = a.indexOf(fn);
    if (i >= 0) a.splice(i, 1);
  }
  function emit(evt, data) {
    (listeners[evt] || []).slice().forEach(function (fn) {
      try { fn(data); } catch (e) { console.error('[econ] ' + evt + ' handler', e); }
    });
  }

  /* ── money ── */
  function wholeStars() {
    var r = rm();
    return r ? Math.max(0, Math.floor(r.totalStars) || 0) : 0;
  }
  function balance() { return wholeStars() + state.frac; }

  function announceBalance(delta, reason, ledgerMoved) {
    // A sub-star move does not touch the rank ledger, so its starsChanged event
    // never fires. Re-emit it only in that case, so the shop, the rank chip and
    // the HUD all see the same balance without each of them polling.
    var r = rm();
    if (!ledgerMoved && r && typeof r.emit === 'function') {
      try { r.emit('starsChanged', { totalStars: r.totalStars, rank: r.getCurrentRank() }); } catch (e) {}
    }
    save();
    hudSig = '';
    renderHud();
    emit('balance', { balance: balance(), delta: delta, reason: reason || '' });
  }
  function credit(amount, reason) {
    var n = Number(amount);
    if (!(n > 0)) return 0;
    var r = rm();
    var before = balance();
    state.frac += n;
    var lift = Math.floor(state.frac + EPS);
    state.frac = Math.min(0.999999, Math.max(0, state.frac - lift));
    if (r && lift > 0) r.addStars(lift);
    var got = balance() - before;
    announceBalance(got, reason || 'credit', lift > 0);
    return got;
  }
  function debit(amount, reason) {
    var n = Number(amount);
    if (!(n > 0)) return false;
    if (balance() + EPS < n) return false;
    var r = rm();
    var whole = Math.floor(n + EPS);
    var rest = n - whole;
    if (state.frac + EPS < rest) {
      // Borrow one whole star and hand the change back as remainder, so the
      // integer ledger only ever moves by integers.
      whole += 1;
      state.frac = Math.min(0.999999, state.frac + 1 - rest);
    } else {
      state.frac = Math.max(0, state.frac - rest);
    }
    if (r && whole > 0) r.removeStars(whole);
    announceBalance(-n, reason || 'debit', whole > 0);
    return true;
  }

  /* ── formatting ── */
  // Truncate, never round up: a price shown as 0.33 is never charged as 0.34.
  function trunc2(n) { return Math.floor(Math.abs(Number(n) || 0) * 100 + EPS) / 100; }
  function fmt(n) {
    var v = Number(n) || 0;
    var t = trunc2(v);
    if (t === 0) return '0';
    var s = t.toFixed(2);
    if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return (v < 0 ? '-' : '') + s;
  }
  function fmtGroup(n) {
    var s = fmt(n), parts = s.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '\u2009');
    return parts.join('.');
  }
  // A multiplier is not a price: truncating 0.1875 to 0.18 would quote a rate the
  // checkout does not use. The state rounds to six decimals, so six is exact.
  function fmtRate(n) {
    var v = Number(n) || 0, a = Math.abs(v);
    var s = a.toFixed(6);
    if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    if (Number(s) === 0 && a > 0) s = String(a);
    return (v < 0 ? '-' : '') + s;
  }
  function fmtMult(m) { return '\u00d7' + fmtRate(m); }
  function clock(ms) {
    var t = Math.max(0, Math.ceil(ms / 1000));
    var h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    var pad = function (x) { return x < 10 ? '0' + x : String(x); };
    return h > 0 ? h + ':' + pad(m) + ':' + pad(s) : m + ':' + pad(s);
  }

  /* ── multiplier ── */
  function activeBoost() {
    var now = Date.now(), best = null;
    state.boosts = state.boosts.filter(function (b) { return validBoost(b) && b.expires > now; });
    for (var i = 0; i < state.boosts.length; i++) {
      if (!best || state.boosts[i].rate < best.rate) best = state.boosts[i];
    }
    return best;
  }
  function eventRate() {
    var e = state.event;
    if (!e || e.ends <= Date.now()) return 0;
    var r = Number(e.rate);
    return (r > 0 && r < 1) ? r : 0;
  }
  function marketRate(id) {
    var m = state.market;
    if (!m || !id || m.ends <= Date.now()) return 0;
    for (var i = 0; i < m.items.length; i++) {
      if (m.items[i].id === id) {
        var r = Number(m.items[i].rate);
        return (r > 0 && r < 1) ? r : 0;
      }
    }
    return 0;
  }

  /* One price for every surface. `base` is the ordinary listed price the caller
     already computed (features run it through the shop's percent rule first);
     this never re-applies that rule, so 1x is exactly the old pricing. */
  function quote(base, opts) {
    var o = opts || {};
    var b = Math.max(0, Number(base) || 0);
    var floor = Math.max(0, Number(o.floor) || 0);
    var now = Date.now();
    var ev = state.event && state.event.ends > now ? state.event : null;
    var boost = activeBoost();
    var factor = 1, source = 'base', uses = state.uses;

    var mk = marketRate(o.marketId);
    var pk = eventRate();
    if (mk > 0) { factor = mk; source = 'market'; }
    else if (pk > 0) { factor = pk; source = 'peak'; }
    else {
      factor = state.mult * (boost ? boost.rate : 1);
      source = state.mult !== 1 ? 'multiplier' : (boost ? 'boost' : 'base');
    }
    factor = Math.min(MULT_MAX, Math.max(MULT_MIN, factor));

    var exact = b * factor;
    var final;
    if (Math.abs(factor - 1) < EPS) final = Math.max(b, floor);
    else final = Math.max(0.01, trunc2(exact));

    var delta = final - b;
    var pct = b > 0 ? Math.round((delta / b) * 1000) / 10 : 0;
    return {
      base: b, final: final, exact: exact, factor: factor, source: source,
      mult: state.mult, uses: uses, boost: boost, event: ev,
      delta: delta, pct: pct,
      tone: final < b - EPS ? 'good' : (final > b + EPS ? 'bad' : 'flat')
    };
  }

  function priceText(base, opts) { return fmt(quote(base, opts).final) + ' \u2605'; }

  function priceHtml(base, opts) {
    var q = quote(base, opts);
    var detail = !!(opts && opts.detail);
    if (q.tone === 'flat') {
      return '<span class="ec-p" data-tone="flat"><b class="ec-now">' + esc(fmt(q.final)) + '\u2605</b></span>';
    }
    var badge = q.tone === 'good' ? sf('save', { p: fmt(Math.abs(q.pct)) }) : sf('extra', { p: fmt(Math.abs(q.pct)) });
    var src = q.source === 'peak' ? S('peak') : q.source === 'market' ? S('market')
      : q.source === 'boost' ? S('boost') : S('multiplier');
    var tip = S('original') + ': ' + fmt(q.base) + '\u2605 \u00b7 ' + src + ' ' + fmtMult(q.factor) +
      ' \u00b7 ' + S('adjusted') + ': ' + fmt(q.final) + '\u2605';
    var html = '<span class="ec-p" data-tone="' + q.tone + '" data-src="' + q.source + '" title="' + esc(tip) + '">' +
      '<s class="ec-was">' + esc(fmt(q.base)) + '\u2605</s>' +
      '<b class="ec-now">' + esc(fmt(q.final)) + '\u2605</b>';
    if (detail) html += '<i class="ec-badge">' + esc(badge) + '</i>';
    html += '</span>';
    return html;
  }

  /* A fresh activation grants ten eligible purchases. Re-spinning while one is
     still running multiplies into it and deliberately does not refill the count. */
  function spin(m) {
    var v = Number(m);
    if (!(v > 0)) return null;
    v = Math.min(MULT_MAX, Math.max(MULT_MIN, v));
    state.spins += 1;
    if (state.uses > 0) {
      state.mult = Math.min(MULT_MAX, Math.max(MULT_MIN, state.mult * v));
    } else if (Math.abs(v - 1) < EPS) {
      state.mult = 1;
      state.uses = 0;
    } else {
      state.mult = v;
      state.uses = USES_PER_ACTIVATION;
    }
    state.mult = Math.round(state.mult * 1e6) / 1e6;
    save();
    renderHud();
    emit('mult', { mult: state.mult, uses: state.uses, spun: v });
    return { mult: state.mult, uses: state.uses };
  }
  function consumeUse() {
    var changed = false;
    var boost = activeBoost();
    if (boost) {
      boost.uses -= 1;
      if (boost.uses <= 0) state.boosts = state.boosts.filter(function (b) { return b !== boost; });
      changed = true;
    }
    // Peak Discount replaces the multiplier rather than spending it, so the
    // player keeps every remaining use for after the event ends. Black Market
    // only prices its own rotating list, so ordinary buys still spend a use.
    if (eventRate() > 0) {
      if (changed) { save(); renderHud(); emit('mult', { mult: state.mult, uses: state.uses }); }
      return false;
    }
    if (state.mult !== 1 && state.uses > 0) {
      state.uses -= 1;
      changed = true;
      if (state.uses <= 0) {
        state.mult = 1;
        state.uses = 0;
        save();
        renderHud();
        emit('multExpired', {});
        emit('mult', { mult: 1, uses: 0 });
        return true;
      }
    }
    if (changed) {
      save();
      renderHud();
      emit('mult', { mult: state.mult, uses: state.uses });
    }
    return changed;
  }
  function clearMultiplier() {
    state.mult = 1;
    state.uses = 0;
    save();
    renderHud();
    emit('mult', { mult: 1, uses: 0 });
  }
  function addBoost(b) {
    if (!b || !(Number(b.rate) > 0) || !(Number(b.rate) < 1)) return null;
    var item = {
      id: b.id || uid('boost'),
      rate: Number(b.rate),
      uses: Math.max(1, Math.floor(Number(b.uses) || 1)),
      expires: Date.now() + Math.max(1, Number(b.hours) || 1) * 3600000,
      name: b.name || null
    };
    state.boosts.push(item);
    save();
    renderHud();
    emit('mult', { mult: state.mult, uses: state.uses });
    return item;
  }

  /* ── events + market: state only, the event scheduler drives them ── */
  function setEvent(e) {
    if (!e || !e.id) return null;
    state.event = {
      id: String(e.id),
      kind: String(e.kind || e.id),
      name: e.name || null,
      desc: e.desc || null,
      ends: Math.max(0, Number(e.ends) || 0),
      rate: Number(e.rate) > 0 ? Number(e.rate) : 0,
      data: e.data || null
    };
    if (state.event.kind === 'peak' && !state.event.rate) state.event.rate = PEAK_RATE;
    save();
    renderHud();
    emit('event', { event: state.event });
    return state.event;
  }
  function clearEvent() {
    var was = state.event;
    state.event = null;
    state.market = null;
    save();
    renderHud();
    emit('event', { event: null, previous: was });
    return was;
  }
  function currentEvent() {
    var e = state.event;
    if (e && e.ends <= Date.now()) { clearEvent(); return null; }
    return e;
  }
  function setMarket(m) {
    if (!m || !Array.isArray(m.items)) { state.market = null; }
    else {
      state.market = {
        ends: Math.max(0, Number(m.ends) || 0),
        items: m.items.filter(function (it) {
          return it && typeof it.id === 'string' && Number(it.rate) > 0 && Number(it.rate) < 1;
        }).map(function (it) {
          return { id: it.id, rate: Number(it.rate), label: it.label || null, base: Number(it.base) || 0 };
        })
      };
    }
    save();
    emit('override', {});
    return state.market;
  }
  function setNextCheck(ts) {
    state.nextCheck = Math.max(0, Number(ts) || 0);
    save();
    renderHud();
  }

  /* ── transactions ── */
  function txById(id) {
    for (var i = 0; i < state.tx.length; i++) if (state.tx[i].id === id) return state.tx[i];
    return null;
  }
  function pruneTx() {
    if (state.tx.length <= TX_KEEP) return;
    var open = state.tx.filter(function (t) { return t.state !== 'claimed' && t.state !== 'aborted'; });
    var done = state.tx.filter(function (t) { return t.state === 'claimed' || t.state === 'aborted'; });
    state.tx = open.concat(done.slice(-(TX_KEEP - open.length)));
  }

  /* Rewards are rolled by the caller and written here BEFORE any animation, so
     the outcome never depends on the cinematic finishing. The charge is
     committed ahead of the debit and flagged the instant it lands: a crash in
     between replays the debit at most once and still delivers the goods. */
  function purchase(spec) {
    var s = spec || {};
    var id = s.id || uid(s.kind || 'buy');
    var existing = txById(id);
    if (existing) {
      if (existing.state === 'paid' || existing.state === 'claimed') {
        return { ok: true, tx: existing, replay: true };
      }
      if (existing.state === 'aborted') return { ok: false, reason: 'aborted', tx: existing };
    }
    var cost = Math.max(0, Number(s.cost) || 0);
    if (cost > 0 && balance() + EPS < cost) return { ok: false, reason: 'poor', need: cost, have: balance() };
    var tx = {
      id: id, kind: String(s.kind || 'buy'), at: Date.now(),
      cost: cost, charged: false, state: 'paid',
      rewards: Array.isArray(s.rewards) ? s.rewards : [],
      meta: s.meta || null
    };
    state.tx.push(tx);
    pruneTx();
    save();
    if (cost > 0) {
      tx.charged = debit(cost, tx.kind) ? true : false;
      if (!tx.charged) {
        tx.state = 'aborted';
        save();
        emit('tx', { tx: tx });
        return { ok: false, reason: 'poor', tx: tx };
      }
      save();
    } else {
      tx.charged = true;
      save();
    }
    emit('tx', { tx: tx });
    return { ok: true, tx: tx };
  }

  function claim(id) {
    var tx = txById(id);
    if (!tx) return { ok: false, reason: 'unknown' };
    if (tx.state === 'claimed') return { ok: false, reason: 'already', tx: tx, granted: tx.granted || [] };
    if (tx.state === 'aborted') return { ok: false, reason: 'aborted', tx: tx };
    if (!tx.charged && tx.cost > 0) {
      tx.charged = debit(tx.cost, tx.kind);
      if (!tx.charged) { tx.charged = true; tx.waived = true; }
    }
    var granted = [];
    for (var i = 0; i < tx.rewards.length; i++) {
      granted.push(grantReward(tx.rewards[i]));
    }
    tx.granted = granted;
    tx.state = 'claimed';
    tx.claimedAt = Date.now();
    save();
    emit('tx', { tx: tx });
    emit('claimed', { tx: tx, granted: granted });
    return { ok: true, tx: tx, granted: granted };
  }

  function pending() {
    return state.tx.filter(function (t) { return t.state === 'paid'; });
  }
  function resumePending() {
    var open = pending();
    for (var i = 0; i < open.length; i++) {
      var t = open[i];
      if (!t.charged && t.cost > 0) {
        t.charged = debit(t.cost, t.kind);
        if (!t.charged) { t.charged = true; t.waived = true; }
        save();
      }
      // A pack keeps its own cinematic and claims when the player returns to it.
      // Everything else has no presentation to resume, so it lands now.
      if (t.kind !== 'pack') claim(t.id);
    }
    return pending();
  }

  /* ── inventory + rewards ── */
  function invCount(id) {
    var e = state.inv[id];
    return e ? Math.max(0, Math.floor(e.n) || 0) : 0;
  }
  function invAdd(id, n) {
    var q = Math.max(1, Math.floor(Number(n) || 1));
    var e = state.inv[id] || (state.inv[id] = { n: 0, first: Date.now(), last: 0, kind: '', name: null, rarity: '', icon: '', desc: null, value: 0, data: null });
    e.n += q;
    e.last = Date.now();
    return e;
  }
  function inventory() {
    var out = [];
    for (var id in state.inv) {
      if (!state.inv.hasOwnProperty(id)) continue;
      var e = state.inv[id];
      if (!(e.n > 0)) continue;
      out.push({
        id: id, n: e.n, kind: e.kind, name: e.name, rarity: e.rarity,
        icon: e.icon, desc: e.desc, value: e.value, data: e.data, first: e.first, last: e.last
      });
    }
    out.sort(function (a, b) { return (b.last || 0) - (a.last || 0); });
    return out;
  }

  var DUP_RATE = 0.35;

  /* Every reward kind lands in a real system: stars in the ledger, atoms and ammo
     in the crate, features in the ownership set, molecules as crate stock plus a
     summonable card. Collectibles stack and pay compensation when repeated. */
  function grantReward(item) {
    if (!item || !item.id) return null;
    var out = {
      id: item.id, kind: item.kind || 'card', name: item.name || null,
      rarity: item.rarity || 'common', icon: item.icon || '', desc: item.desc || null,
      value: Number(item.value) || 0, count: Math.max(1, Math.floor(Number(item.count) || 1)),
      dup: false, compensation: 0, delivered: 0, data: item.data || null
    };
    var sh = shop();
    var k = out.kind;

    if (k === 'stars') {
      out.delivered = credit(out.value * out.count, 'reward:' + out.id);
      return out;
    }
    if (k === 'atom') {
      var z = Math.floor(Number(item.z) || 0);
      out.delivered = sh ? sh.grantStock(z, out.count) : 0;
      out.data = { z: z };
      return out;
    }
    if (k === 'ammo') {
      out.delivered = sh ? sh.grantAmmo(String(item.ammo || 'proton'), out.count) : 0;
      out.data = { ammo: String(item.ammo || 'proton') };
      return out;
    }
    if (k === 'feature') {
      var fid = String(item.feature || item.id);
      if (sh && sh.ownsFeature(fid)) {
        out.dup = true;
        out.compensation = Math.max(1, Math.round(out.value * DUP_RATE));
        credit(out.compensation, 'dup:' + fid);
      } else if (sh) {
        out.delivered = sh.grantFeature(fid) ? 1 : 0;
        if (!out.delivered) {
          out.compensation = Math.max(1, Math.round(out.value * DUP_RATE));
          credit(out.compensation, 'dup:' + fid);
          out.dup = true;
        }
      }
      return out;
    }
    if (k === 'boost') {
      addBoost({
        id: uid('boost'), rate: Number(item.rate) || 0.5,
        uses: Math.max(1, Math.floor(Number(item.uses) || 3)),
        hours: Number(item.hours) || 2, name: out.name
      });
      out.delivered = 1;
      return out;
    }
    if (k === 'mult') {
      var r = spin(Number(item.mult) || 1);
      out.delivered = r ? 1 : 0;
      out.data = r;
      return out;
    }
    if (k === 'molecule') {
      var formula = String(item.formula || '');
      var atoms = parseFormula(formula);
      var got = 0;
      if (sh) {
        for (var i = 0; i < atoms.length; i++) got += sh.grantStock(atoms[i].z, atoms[i].n);
      }
      out.delivered = got;
      out.data = { formula: formula, atoms: atoms };
      var entry = invAdd(out.id, 1);
      entry.kind = k; entry.name = out.name; entry.rarity = out.rarity;
      entry.icon = out.icon; entry.desc = out.desc; entry.value = out.value; entry.data = out.data;
      save();
      emit('inventory', { id: out.id, count: entry.n });
      return out;
    }

    // skins, decorations, VFX, cards, titles: a stacked collectible.
    var had = invCount(out.id);
    var e2 = invAdd(out.id, out.count);
    e2.kind = k; e2.name = out.name; e2.rarity = out.rarity;
    e2.icon = out.icon; e2.desc = out.desc; e2.value = out.value; e2.data = out.data;
    out.delivered = out.count;
    if (had > 0) {
      out.dup = true;
      out.compensation = Math.max(1, Math.round(out.value * DUP_RATE)) * out.count;
      credit(out.compensation, 'dup:' + out.id);
    }
    save();
    emit('inventory', { id: out.id, count: e2.n });
    return out;
  }

  function parseFormula(formula) {
    var a = api();
    var els = (a && a.ELEMENTS) || [];
    var map = {}, order = [];
    var re = /([A-Z][a-z]?)(\d*)/g, m;
    while ((m = re.exec(String(formula || ''))) !== null) {
      if (!m[1]) continue;
      var n = m[2] ? parseInt(m[2], 10) : 1;
      var el = null;
      for (var i = 0; i < els.length; i++) if (els[i].sym === m[1]) { el = els[i]; break; }
      if (!el) continue;
      if (!map[el.z]) { map[el.z] = 0; order.push(el.z); }
      map[el.z] += n;
    }
    return order.map(function (z) { return { z: z, n: map[z] }; });
  }

  // A molecule card owns the atoms it granted; summoning spends them through the
  // crate like any other placement, so it can never mint matter for free.
  function redeem(id) {
    var e = state.inv[id];
    var a = api();
    if (!e || !(e.n > 0) || e.kind !== 'molecule' || !a || typeof a.spawnMolecule !== 'function') {
      return { ok: false, reason: 'unknown' };
    }
    var formula = e.data && e.data.formula;
    var ids = a.spawnMolecule(formula);
    if (!ids || !ids.length) return { ok: false, reason: 'poor', formula: formula };
    e.n -= 1;
    if (e.n <= 0) delete state.inv[id];
    save();
    emit('inventory', { id: id, count: invCount(id) });
    return { ok: true, formula: formula, ids: ids };
  }

  // A collectible that is gifted moves between two players' stacks instead of
  // being rolled out of a pack. Taking it out hands back the full record so the
  // gift code can carry it, and the sender's own copy is what disappears — a
  // title that could be given away without end would not be worth receiving.
  // Nothing pays duplicate compensation here: two copies of the same title in
  // one collection is a gift that arrived twice, not a wasted roll.
  function takeCollectible(id, n) {
    var e = state.inv[id];
    if (!e || !(e.n > 0)) return { ok: false, removed: 0, entry: null };
    var q = Math.max(1, Math.floor(Number(n) || 1));
    var removed = Math.min(e.n, q);
    var record = {
      id: id, kind: e.kind, rarity: e.rarity, icon: e.icon, value: e.value,
      name: e.name, desc: e.desc, data: e.data
    };
    e.n -= removed;
    if (e.n <= 0) delete state.inv[id];
    save();
    emit('inventory', { id: id, count: invCount(id) });
    return { ok: true, removed: removed, entry: record };
  }

  function giveCollectible(record, n) {
    if (!record || !record.id) return 0;
    var q = Math.max(1, Math.floor(Number(n) || 1));
    var e = invAdd(String(record.id), q);
    if (!e.kind) e.kind = record.kind || 'card';
    if (!e.name) e.name = record.name || null;
    if (!e.rarity) e.rarity = record.rarity || 'common';
    if (!e.icon) e.icon = record.icon || '';
    if (!e.desc) e.desc = record.desc || null;
    if (!e.value) e.value = Number(record.value) || 0;
    if (!e.data) e.data = record.data || null;
    save();
    emit('inventory', { id: String(record.id), count: e.n });
    return q;
  }

  /* ── signature: the shop rebuilds its chips whenever this changes ── */
  function sig() {
    var b = activeBoost();
    var e = currentEvent();
    return [
      state.mult, state.uses, state.frac.toFixed(6),
      b ? b.id + ':' + b.uses : '-',
      e ? e.id + ':' + e.kind : '-',
      state.market ? state.market.items.length + ':' + state.market.ends : '-'
    ].join('|');
  }

  /* ── styles ── */
  function css() {
    return [
      '.ec-p{display:inline-flex;flex-direction:column;align-items:center;line-height:1.12;gap:1px;}',
      '.ec-p .ec-was{font-size:.82em;font-weight:600;opacity:.62;text-decoration:line-through;}',
      '.ec-p .ec-now{font-weight:800;font-variant-numeric:tabular-nums;}',
      '.ec-p[data-tone="good"] .ec-now{color:var(--ok-text,#7ee2a8);}',
      '.ec-p[data-tone="bad"] .ec-now{color:var(--err-text,#ff6688);}',
      '.ec-p[data-tone="flat"] .ec-now{color:inherit;}',
      '.ec-p .ec-badge{font-style:normal;font-size:.78em;font-weight:800;letter-spacing:.3px;',
      '  padding:1px 5px;border-radius:99px;}',
      '.ec-p[data-tone="good"] .ec-badge{background:rgba(0,255,136,.16);color:var(--ok-text,#7ee2a8);}',
      '.ec-p[data-tone="bad"] .ec-badge{background:rgba(255,51,102,.16);color:var(--err-text,#ff6688);}',
      '.ec-row{display:flex;align-items:baseline;justify-content:space-between;gap:10px;',
      '  font-size:var(--fs-sm,12px);}',
      '.ec-row .ec-k{color:var(--muted,#5a7a9a);font-weight:600;}',
      '.ec-row .ec-v{font-weight:800;font-variant-numeric:tabular-nums;}',
      'button.hud-chip{font-family:inherit;-webkit-appearance:none;appearance:none;}',
      'button.hud-chip:focus-visible{outline:2px solid var(--accent,#00d4ff);outline-offset:2px;}',
      '.hud-chip .hud-ico{width:calc(12px * var(--ui-scale,1));height:calc(12px * var(--ui-scale,1));flex:none;}',
      '.hud-chip .hud-v{font-variant-numeric:tabular-nums;}',
      '#mol-hud .hud-sep{width:1px;height:calc(15px * var(--ui-scale,1));flex:none;',
      '  background:var(--border,rgba(0,200,255,.15));}',
      '.hud-chip.hud-boost{color:var(--rz-mint,#00ffc8);border-color:rgba(0,255,200,.36);',
      '  background:linear-gradient(135deg,rgba(0,255,200,.14),rgba(0,212,255,.06));}',
      // The boost chip's ink comes from --rz-mint, which the light shell retunes;
      // its literal rim and wash are the neon ones, so they need the same pass.
      'html[data-theme="light"] .hud-chip.hud-boost{border-color:rgba(11,111,102,.42);',
      '  background:linear-gradient(135deg,rgba(11,111,102,.12),rgba(3,105,161,.06));}'
    ].join('\n');
  }
  function injectStyles() {
    if (document.getElementById('mol-econ-styles')) return;
    var el = document.createElement('style');
    el.id = 'mol-econ-styles';
    el.textContent = css();
    document.head.appendChild(el);
  }

  /* ── HUD ── */
  var hud = null;
  var STAR_SVG = '<svg class="hud-ico" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<path d="M12 2.6l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.45 6.19 20.5 7.3 14.03 2.6 9.45l6.5-.95z"/></svg>';

  function ensureHud() {
    if (hud && hud.isConnected) return hud;
    hud = document.getElementById('mol-hud');
    if (hud) return hud;
    var top = document.querySelector('.top-bar');
    if (!top) return null;
    hud = document.createElement('div');
    hud.id = 'mol-hud';
    (top.querySelector('.top-bar-left') || top).appendChild(hud);
    return hud;
  }

  function chip(cls, act, title, inner, attrs) {
    var b = document.createElement(act ? 'button' : 'span');
    if (act) b.type = 'button';
    b.className = 'hud-chip ' + cls;
    if (act) b.dataset.act = act;
    b.title = title;
    if (act) b.setAttribute('aria-label', title);
    for (var k in (attrs || {})) b.setAttribute(k, attrs[k]);
    b.innerHTML = inner;
    return b;
  }

  var hudSig = '';
  function renderHud() {
    var h = ensureHud();
    if (!h) return;
    var ev = currentEvent();
    var boost = activeBoost();
    var s = [
      fmtGroup(balance()), state.mult, state.uses, lang(),
      ev ? ev.id : '-', boost ? boost.id + ':' + boost.uses : '-',
      ev ? '' : state.nextCheck
    ].join('|');
    if (s === hudSig) { tickHud(); return; }
    hudSig = s;
    h.innerHTML = '';

    h.appendChild(chip('hud-stars', 'shop', S('balanceTitle') + ' \u00b7 ' + S('localNote'),
      STAR_SVG + '<span class="hud-v" data-hud="stars">' + esc(fmtGroup(balance())) + '</span>'));

    if (state.mult !== 1 && state.uses > 0) {
      var tone = state.mult < 1 ? 'good' : 'bad';
      h.appendChild(chip('hud-mult', 'wheel',
        S('multTitle') + ' \u00b7 ' + sf('multUses', { n: state.uses }),
        '<span class="hud-v">' + esc(fmtMult(state.mult)) + '</span>' +
        '<span class="hud-k">\u00b7</span><span class="hud-t" data-hud="uses">' + state.uses + '</span>',
        { 'data-tone': tone }));
    }
    if (boost) {
      h.appendChild(chip('hud-boost', 'wheel',
        L(boost.name) || S('boost'),
        '<span class="hud-v">' + esc(fmtMult(boost.rate)) + '</span>' +
        '<span class="hud-k">\u00b7</span><span class="hud-t">' + boost.uses + '</span>'));
    }
    if (ev) {
      h.appendChild(chip('hud-event', 'event',
        S('eventTitle') + ' \u00b7 ' + (L(ev.desc) || L(ev.name)),
        '<span class="hud-v">' + esc(L(ev.name) || ev.id) + '</span>' +
        '<span class="hud-t" data-hud="evclock">' + esc(clock(ev.ends - Date.now())) + '</span>',
        { 'data-ev': ev.kind }));
    } else if (state.nextCheck > Date.now()) {
      h.appendChild(chip('hud-idle', 'event', S('nextCheck'),
        '<span class="hud-k">' + esc(S('nextCheck')) + '</span>' +
        '<span class="hud-t" data-hud="nextclock">' + esc(clock(state.nextCheck - Date.now())) + '</span>'));
    }
    if (window.__mol3dShell) window.__mol3dShell.measure();
  }

  function tickHud() {
    if (!hud) return;
    var ev = state.event;
    var n1 = hud.querySelector('[data-hud="evclock"]');
    if (n1 && ev) n1.textContent = clock(ev.ends - Date.now());
    var n2 = hud.querySelector('[data-hud="nextclock"]');
    if (n2) n2.textContent = clock(state.nextCheck - Date.now());
  }

  function hudAction(act) {
    var sh = shop();
    if (act === 'shop') { if (sh) sh.open(); return; }
    if (act === 'wheel') {
      if (sh && sh.showTab && window.__mol3dWheel) sh.showTab('wheel');
      else if (sh) sh.open();
      return;
    }
    if (act === 'event') {
      if (window.__mol3dEvents && typeof window.__mol3dEvents.openStatus === 'function') {
        window.__mol3dEvents.openStatus();
      } else if (sh) sh.open();
    }
  }

  /* ── lifecycle ── */
  var timer = 0;
  // Atom and feature rewards land in the crate, so a resumed transaction has to
  // wait for the shop to mount or it would deliver nothing.
  function resumeWhenReady(tries) {
    if (shop() || tries > 25) { resumePending(); return; }
    setTimeout(function () { resumeWhenReady(tries + 1); }, 400);
  }
  function tick() {
    var now = Date.now();
    if (state.event && state.event.ends <= now) {
      var was = state.event;
      clearEvent();
      emit('eventEnded', { event: was });
    }
    if (state.market && state.market.ends <= now) {
      state.market = null;
      save();
      emit('override', {});
    }
    var before = state.boosts.length;
    activeBoost();
    if (state.boosts.length !== before) {
      save();
      hudSig = '';
      renderHud();
      emit('mult', { mult: state.mult, uses: state.uses });
    }
    if (state.nextCheck && state.nextCheck <= now && !state.event) {
      state.nextCheck = 0;
      hudSig = '';
      renderHud();
    }
    tickHud();
  }

  function attach() {
    var a = api();
    if (!a || !a.progression || !a.progression.rankManager) { setTimeout(attach, 300); return; }
    load();
    injectStyles();
    resumeWhenReady(0);
    renderHud();

    document.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('#mol-hud .hud-chip[data-act]') : null;
      if (!b) return;
      e.preventDefault();
      hudAction(b.dataset.act);
    });

    var r = rm();
    if (r && typeof r.on === 'function') {
      r.on('starsChanged', function () { hudSig = ''; renderHud(); });
    }
    window.addEventListener('mol3d:lang', function () { hudSig = ''; renderHud(); });
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) { tick(); hudSig = ''; renderHud(); }
    });
    window.addEventListener('storage', function (e) {
      if (e.key !== SAVE_KEY && e.key !== 'mol3d.rank.v2' && e.key !== 'mol3d.starLedger.v1') return;
      load();
      hudSig = '';
      renderHud();
      emit('balance', { balance: balance(), delta: 0, reason: 'sync' });
    });

    timer = setInterval(tick, 1000);
    window.addEventListener('pagehide', function () { save(); });

    window.__mol3dEcon = {
      version: SCHEMA,
      // money
      balance: balance, credit: credit, debit: debit,
      fmt: fmt, fmtGroup: fmtGroup, fmtMult: fmtMult, fmtRate: fmtRate, clock: clock,
      // pricing
      quote: quote, priceHtml: priceHtml, priceText: priceText,
      // multiplier
      mult: function () { return state.mult; },
      uses: function () { return state.uses; },
      spins: function () { return state.spins; },
      spin: spin, consumeUse: consumeUse, clearMultiplier: clearMultiplier,
      usesPerActivation: USES_PER_ACTIVATION,
      boosts: function () { return state.boosts.slice(); },
      addBoost: addBoost,
      peakRate: PEAK_RATE,
      // events + market
      setEvent: setEvent, clearEvent: clearEvent, event: currentEvent,
      setMarket: setMarket, market: function () { return state.market; },
      setNextCheck: setNextCheck, nextCheck: function () { return state.nextCheck; },
      // transactions
      purchase: purchase, claim: claim, pending: pending,
      tx: txById, transactions: function () { return state.tx.slice(); },
      // rewards
      grantReward: grantReward, inventory: inventory, invCount: invCount,
      takeCollectible: takeCollectible, giveCollectible: giveCollectible,
      redeem: redeem, parseFormula: parseFormula, dupRate: DUP_RATE,
      // randomness
      rand: rand, randInt: randInt, pick: pick, shuffle: shuffle, weighted: weighted, uid: uid,
      // plumbing
      on: on, off: off, emit: emit, sig: sig,
      text: S, textf: sf, localized: L, esc: esc, lang: lang,
      refresh: function () { hudSig = ''; renderHud(); },
      security: function () { return S('localNote'); },
      // A backup carries the multiplier, the collectibles and any half-finished
      // purchase. The seal only reproduces under this browser's salt, so the same
      // block is ignored on another machine rather than trusted there.
      exportState: function () { return sealedBody(); },
      importState: function (d) {
        var ok = readSealed(d);
        if (!ok || !applyPayload(ok.data, ok.seq)) return false;
        save();
        hudSig = '';
        renderHud();
        resumeWhenReady(0);
        emit('balance', { balance: balance(), delta: 0, reason: 'import' });
        emit('mult', { mult: state.mult, uses: state.uses });
        emit('inventory', { id: null, count: inventory().length });
        return true;
      },
      destroy: function () {
        if (timer) clearInterval(timer);
        timer = 0;
        save();
      }
    };
    emit('ready', { balance: balance() });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach);
  else attach();
})();