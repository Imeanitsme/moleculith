// Star gifting — turn stars into a Pastefy code, and a code back into stars.
//
// Why Pastefy: the game is a static bundle with no server of its own, so a gift
// has to be held somewhere both players can reach. Pastefy answers CORS with `*`
// and enforces a real expiry timestamp server-side, which is the only protection
// a server-less transfer can have: after `expireAt` the raw URL 404s for everyone.
//
// What it cannot do: Pastefy's API has no burn-after-read switch. That was checked
// against their published schema and their own frontend bundle, and verified
// empirically — payloads carrying burn fields are accepted, ignored, and the paste
// stays readable on the second and third fetch. So single use is enforced here
// instead: this browser records the code as spent the moment it pays, and the
// expiry bounds how long the code lives anywhere else. The dialogs say so plainly
// instead of pretending the paste itself is one-time.
(function () {
  'use strict';

  if (window.__mol3dStarGiftMounted) return;
  window.__mol3dStarGiftMounted = true;

  var CREATE_URL = 'https://pastefy.app/api/v2/paste';
  var RAW_BASE = 'https://pastefy.app/';
  var CODE_RE = /^[A-Za-z0-9]{4,16}$/;
  var CODE_URL_RE = /pastefy\.app\/([A-Za-z0-9]{4,16})(?:\/raw)?\/?$/;

  var APP_ID = 'moleculith';
  var KIND = 'star-gift';
  var VERSION = 1;
  var SEAL_KEY = 'moleculith.star-gift.v1';

  var MIN_GIFT = 200;
  var MAX_GIFT = 100000;
  // A code born already dead is a lost gift, and a code that lives a year is one
  // someone can sit on. Both ends are clamped.
  var MIN_LIFE_MS = 60 * 1000;
  var MAX_LIFE_MS = 90 * 24 * 60 * 60 * 1000;
  var BALANCE_CAP = 1000000;

  var STATE_KEY = 'mol3d.gift.v1';
  var KEEP = 300;

  var PRESETS = [
    { ms: 30 * 60 * 1000, key: 'p30m' },
    { ms: 60 * 60 * 1000, key: 'p1h' },
    { ms: 6 * 60 * 60 * 1000, key: 'p6h' },
    { ms: 24 * 60 * 60 * 1000, key: 'p1d' },
    { ms: 3 * 24 * 60 * 60 * 1000, key: 'p3d' },
    { ms: 7 * 24 * 60 * 60 * 1000, key: 'p7d' },
    { ms: 30 * 24 * 60 * 60 * 1000, key: 'p30d' },
    { ms: 0, key: 'pCustom' }
  ];

  var busy = false;
  var refs = null;
  var toastTimer = null;
  var copyTimer = null;

  // ---------------------------------------------------------------- plumbing

  function game() { return window.__mol3d || null; }

  function rankMgr() {
    try {
      var g = game();
      return (g && g.progression && g.progression.rankManager) || null;
    } catch (e) { return null; }
  }

  function balance() {
    var rm = rankMgr();
    return rm ? Math.max(0, Math.round(rm.totalStars) || 0) : 0;
  }

  // The tamper-evident ledger behind the balance only pays out what it can prove
  // it was given, so stars move through addStars/removeStars and nowhere else.
  function spendStars(n) {
    var rm = rankMgr();
    if (!rm || !(n > 0) || balance() < n) return false;
    rm.removeStars(n);
    paintBalance();
    return true;
  }

  // Returns the stars actually applied: a wallet already at the cap cannot take
  // the whole gift, and the player is told so instead of being shown a number
  // that never landed.
  function giveStars(n) {
    var rm = rankMgr();
    if (!rm || !(n > 0)) return 0;
    var before = balance();
    rm.addStars(n);
    applyState();
    return balance() - before;
  }

  // `starsChanged` has no listener inside the bundle, so a gift that does not
  // cross a grade boundary would leave the widget showing the old number. The
  // rank-up/down events repaint everything themselves; this is the same line the
  // bundle writes, so the two paths cannot disagree.
  function paintBalance() {
    var el = document.getElementById('rank-stars');
    if (el) el.textContent = balance() + ' ★';
  }

  function applyState() {
    paintBalance();
    try {
      var g = game();
      if (g && g.progression && typeof g.progression.rebuildPool === 'function') {
        g.progression.rebuildPool();
      }
    } catch (e) { /* addStars has already saved the balance itself */ }
  }

  // ------------------------------------------------------------------ i18n

  function lang() {
    var g = game();
    try {
      if (g && g.i18n && typeof g.i18n.getLang === 'function' && g.i18n.getLang() === 'en') return 'en';
    } catch (e) { }
    return 'vi';
  }

  var STR = {
    en: {
      secGift: 'Star gifting',
      secCodes: 'Gift codes',
      btnGift: 'Gifting',
      btnCodes: 'Codes',
      btnGiftTitle: 'Turn stars into a gift code',
      btnCodesTitle: 'Add the stars behind a gift code to your balance',
      giftTitle: 'Send a star gift',
      giftIntro: 'Stars leave your balance the moment the code is made. Anyone holding the code can claim them before it dies.',
      amount: 'Star amount',
      amountHint: 'Minimum {min} ★ · maximum {max} ★',
      balanceRow: 'Your balance',
      afterRow: 'After this gift',
      expiry: 'Expiry date',
      expWhen: 'Code stops working',
      create: 'Gift',
      cancel: 'Cancel',
      done: 'Done',
      creating: 'Creating code…',
      codeTitle: 'Your gift code',
      codeIntro: 'Send this code to the other player. They enter it under Menu → Progress → Codes.',
      codeLabel: 'Shareable code',
      copy: 'Copy',
      copied: 'Copied',
      copyKeys: 'Press Ctrl+C',
      expiresAt: 'Expires',
      burnNote: 'Pastefy has no burn-after-read option in its API, so single use is the game’s own rule: this browser marks the code spent the moment it pays out, and Pastefy deletes it at the expiry above. Until then anyone holding the code can read it — pick a short expiry.',
      redeemTitle: 'Redeem a gift code',
      redeemIntro: 'Paste the gift code, or the whole pastefy.app link.',
      redeemLabel: 'Pastefy code',
      redeemPh: 'e.g. AbC12dEf or https://pastefy.app/AbC12dEf/raw',
      redeem: 'Redeem',
      checking: 'Checking code…',
      credited: '+{n} ★ added to your balance',
      creditedNote: 'Code {code} · {stars} ★ · expires {when}',
      capWarn: 'Only {n} of {stars} ★ fitted under the {cap} ★ balance cap.',
      p30m: '30 minutes', p1h: '1 hour', p6h: '6 hours', p1d: '1 day',
      p3d: '3 days', p7d: '7 days', p30d: '30 days', pCustom: 'Pick a date…',
      eAmount: 'Enter a whole number of stars between {min} and {max}.',
      eBalance: 'Not enough stars — your balance is {n} ★.',
      eExpiryPast: 'The expiry has to be in the future.',
      eExpiryFar: 'A code can live for at most {days} days.',
      eCodeFormat: 'That is not a Pastefy code.',
      eExpired: 'This code has expired or never existed.',
      eUsed: 'This code was already redeemed on this device.',
      eSelf: 'This is a code you sent from this device — the gift is for another player.',
      ePayload: 'The code does not hold a valid star gift.',
      eBusy: 'Wait for the current request to finish.',
      eNetwork: 'Pastefy could not be reached. Check your connection.',
      eRate: 'Pastefy is rate-limiting this device. Try again in a minute.',
      eServer: 'Pastefy refused the request ({status}).',
      eBadReply: 'Pastefy returned an unreadable answer.',
      refunded: 'Your stars were put back.'
    },
    vi: {
      secGift: 'Tặng sao',
      secCodes: 'Mã quà tặng',
      btnGift: 'Tặng sao',
      btnCodes: 'Nhập mã',
      btnGiftTitle: 'Biến sao thành mã quà tặng',
      btnCodesTitle: 'Cộng sao của mã quà tặng vào số dư của bạn',
      giftTitle: 'Gửi quà bằng sao',
      giftIntro: 'Sao bị trừ ngay khi tạo mã. Ai cầm mã đều có thể nhận số sao đó trước khi mã hết hạn.',
      amount: 'Số sao',
      amountHint: 'Tối thiểu {min} ★ · tối đa {max} ★',
      balanceRow: 'Số dư của bạn',
      afterRow: 'Sau khi tặng',
      expiry: 'Ngày hết hạn',
      expWhen: 'Mã ngừng hoạt động',
      create: 'Tặng',
      cancel: 'Hủy',
      done: 'Xong',
      creating: 'Đang tạo mã…',
      codeTitle: 'Mã quà của bạn',
      codeIntro: 'Gửi mã này cho người nhận. Họ nhập tại Trình đơn → Tiến độ → Mã.',
      codeLabel: 'Mã để chia sẻ',
      copy: 'Sao chép',
      copied: 'Đã sao chép',
      copyKeys: 'Nhấn Ctrl+C',
      expiresAt: 'Hết hạn',
      burnNote: 'Pastefy không có tùy chọn “chỉ đọc một lần” trong API, nên việc dùng một lần là luật của trò chơi: máy này đánh dấu mã đã dùng ngay khi trả sao, và Pastefy xóa mã đúng lúc hết hạn ở trên. Cho tới lúc đó, ai có mã cũng đọc được — hãy chọn thời hạn ngắn.',
      redeemTitle: 'Nhập mã quà tặng',
      redeemIntro: 'Dán mã quà, hoặc toàn bộ liên kết pastefy.app.',
      redeemLabel: 'Mã Pastefy',
      redeemPh: 'VD: AbC12dEf hoặc https://pastefy.app/AbC12dEf/raw',
      redeem: 'Nhận quà',
      checking: 'Đang kiểm tra mã…',
      credited: '+{n} ★ đã được cộng vào số dư của bạn',
      creditedNote: 'Mã {code} · {stars} ★ · hết hạn {when}',
      capWarn: 'Chỉ {n} trong {stars} ★ vừa với trần số dư {cap} ★.',
      p30m: '30 phút', p1h: '1 giờ', p6h: '6 giờ', p1d: '1 ngày',
      p3d: '3 ngày', p7d: '7 ngày', p30d: '30 ngày', pCustom: 'Chọn ngày…',
      eAmount: 'Hãy nhập số sao nguyên từ {min} đến {max}.',
      eBalance: 'Không đủ sao — số dư của bạn là {n} ★.',
      eExpiryPast: 'Ngày hết hạn phải ở tương lai.',
      eExpiryFar: 'Mã chỉ sống tối đa {days} ngày.',
      eCodeFormat: 'Đó không phải mã Pastefy.',
      eExpired: 'Mã đã hết hạn hoặc chưa từng tồn tại.',
      eUsed: 'Mã này đã được nạp trên máy này.',
      eSelf: 'Đây là mã bạn đã gửi từ máy này — phần quà dành cho người chơi khác.',
      ePayload: 'Mã không chứa quà sao hợp lệ.',
      eBusy: 'Vui lòng đợi yêu cầu hiện tại hoàn tất.',
      eNetwork: 'Không kết nối được Pastefy. Hãy kiểm tra mạng.',
      eRate: 'Pastefy đang giới hạn tốc độ với máy này. Thử lại sau một phút.',
      eServer: 'Pastefy từ chối yêu cầu ({status}).',
      eBadReply: 'Pastefy trả về dữ liệu không đọc được.',
      refunded: 'Sao của bạn đã được hoàn lại.'
    }
  };

  function fill(s, params) {
    if (!params) return s;
    return s.replace(/\{(\w+)\}/g, function (_, k) {
      return params[k] === undefined ? '' : String(params[k]);
    });
  }

  function L(key, params) {
    var g = game();
    try {
      if (g && g.i18n && typeof g.i18n.t === 'function') {
        var via = g.i18n.t(key, params);
        if (typeof via === 'string' && via !== key) return via;
      }
    } catch (e) { }
    var t = STR[lang()] || STR.en;
    return fill(typeof t[key] === 'string' ? t[key] : STR.en[key], params);
  }

  // ------------------------------------------------------------- time helpers

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  // Pastefy is a Go service whose clock is UTC and whose timestamp is
  // "YYYY-MM-DD HH:MM:SS" with no zone suffix. Anything else is stored but never
  // matched, so the paste would outlive its expiry.
  function toUtcStamp(d) {
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()) +
      ' ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds());
  }

  function fromUtcStamp(s) {
    if (typeof s !== 'string') return NaN;
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/);
    if (!m) return NaN;
    return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  }

  function localInputValue(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function humanDate(ms) {
    try { return new Date(ms).toLocaleString(); } catch (e) { return String(ms); }
  }

  // ------------------------------------------------------------ the seal
  // The same double-hash the star ledger uses. It is not a secret — anything the
  // client holds ships in the client — it only stops a hand-typed or edited code
  // from paying, so casual forgeries fail loudly instead of quietly succeeding.
  function seal(stars, exp, giftId) {
    var s = SEAL_KEY + '|' + stars + '|' + exp + '|' + giftId;
    var h1 = 2166136261 >>> 0, h2 = 3432345061 >>> 0;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
      h2 = Math.imul(h2 + c, 2246822519) >>> 0;
    }
    return (h1 >>> 0).toString(36) + '.' + (h2 >>> 0).toString(36);
  }

  function randomId() {
    var bytes = new Uint8Array(8);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes);
    else for (var i = 0; i < 8; i++) bytes[i] = Math.floor(Math.random() * 256);
    var hex = '';
    for (var j = 0; j < bytes.length; j++) hex += bytes[j].toString(16).padStart(2, '0');
    return hex;
  }

  function buildPayload(stars, expMs) {
    var exp = toUtcStamp(new Date(expMs));
    var giftId = randomId();
    return {
      app: APP_ID, kind: KIND, v: VERSION,
      stars: stars, exp: exp, giftId: giftId, sig: seal(stars, exp, giftId)
    };
  }

  function verifyPayload(text) {
    var p;
    try { p = JSON.parse(text); } catch (e) { return { ok: false, error: 'ePayload' }; }
    if (!p || typeof p !== 'object') return { ok: false, error: 'ePayload' };
    if (p.app !== APP_ID || p.kind !== KIND || p.v !== VERSION) return { ok: false, error: 'ePayload' };
    var stars = Math.floor(Number(p.stars));
    if (!Number.isFinite(stars) || stars < MIN_GIFT || stars > MAX_GIFT) return { ok: false, error: 'ePayload' };
    var expMs = fromUtcStamp(p.exp);
    if (!Number.isFinite(expMs)) return { ok: false, error: 'ePayload' };
    if (expMs <= Date.now()) return { ok: false, error: 'eExpired' };
    if (typeof p.giftId !== 'string' || !p.giftId || typeof p.sig !== 'string') {
      return { ok: false, error: 'ePayload' };
    }
    if (p.sig !== seal(stars, p.exp, p.giftId)) return { ok: false, error: 'ePayload' };
    return { ok: true, stars: stars, expMs: expMs, giftId: p.giftId };
  }

  // --------------------------------------------------------- local registry

  function readState() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(STATE_KEY)); } catch (e) { s = null; }
    if (!s || typeof s !== 'object') s = {};
    if (!s.sent || typeof s.sent !== 'object') s.sent = {};
    if (!s.redeemed || typeof s.redeemed !== 'object') s.redeemed = {};
    return s;
  }

  function trimMap(map) {
    var keys = Object.keys(map);
    if (keys.length <= KEEP) return;
    keys.sort(function (a, b) { return (map[a].at || 0) - (map[b].at || 0); });
    for (var i = 0; i < keys.length - KEEP; i++) delete map[keys[i]];
  }

  function writeState(s) {
    trimMap(s.sent); trimMap(s.redeemed);
    try { localStorage.setItem(STATE_KEY, JSON.stringify(s)); } catch (e) { }
  }

  // -------------------------------------------------------------- validation

  function parseCode(input) {
    var s = String(input == null ? '' : input).trim();
    if (!s) return null;
    var m = s.match(CODE_URL_RE);
    if (m) return m[1];
    return CODE_RE.test(s) ? s : null;
  }

  function wholeStars(raw) {
    var n = Math.floor(Number(raw));
    return Number.isFinite(n) ? n : null;
  }

  function validateGift(n, expMs, bal) {
    if (n === null || n < MIN_GIFT || n > MAX_GIFT) {
      return { error: 'eAmount', params: { min: MIN_GIFT, max: MAX_GIFT } };
    }
    if (!Number.isFinite(expMs)) return { error: 'eExpiryPast' };
    var life = expMs - Date.now();
    if (!(life > 0)) return { error: 'eExpiryPast' };
    if (life > MAX_LIFE_MS) return { error: 'eExpiryFar', params: { days: 90 } };
    if (n > bal) return { error: 'eBalance', params: { n: bal } };
    return null;
  }

  // ------------------------------------------------------------------ flows
  // The gift is charged before the request goes out, so every failure path that
  // follows has to hand the stars back.

  async function createGift(stars, expMs) {
    if (busy) return { ok: false, error: 'eBusy' };
    var n = wholeStars(stars);
    var bal = balance();
    var bad = validateGift(n, expMs, bal);
    if (bad) return { ok: false, error: bad.error, params: bad.params };
    if (expMs - Date.now() < MIN_LIFE_MS) expMs = Date.now() + MIN_LIFE_MS;

    var payload = buildPayload(n, expMs);
    if (!spendStars(n)) return { ok: false, error: 'eBalance', params: { n: balance() } };

    busy = true;
    try {
      var body = {
        title: 'MOLECULITH star gift — ' + n + ' ★',
        content: JSON.stringify(payload),
        visibility: 'UNLISTED',
        encrypted: false,
        expireAt: payload.exp,
        // Accepted and ignored by Pastefy: they state the intent of the gift even
        // though nothing on their side acts on it. See the note at the top.
        burnAfterRead: true,
        burn_after_read: true
      };
      var res = await fetch(CREATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (res.status === 429) return fail(n, 'eRate');
      if (!res.ok) return fail(n, 'eServer', { status: res.status });
      var data = null;
      try { data = await res.json(); } catch (e) { return fail(n, 'eBadReply'); }
      var paste = data && data.success && data.paste;
      if (!paste || !paste.id) return fail(n, 'eBadReply');
      var m = typeof paste.raw_url === 'string' ? paste.raw_url.match(CODE_URL_RE) : null;
      var code = m ? m[1] : String(paste.id);
      if (!CODE_RE.test(code)) return fail(n, 'eBadReply');
      var st = readState();
      st.sent[code] = { stars: n, at: Date.now(), exp: expMs };
      writeState(st);
      return { ok: true, code: code, url: RAW_BASE + code + '/raw', stars: n, expMs: expMs };
    } catch (e) {
      return fail(n, 'eNetwork');
    } finally {
      busy = false;
    }
  }

  function fail(n, error, params) {
    giveStars(n);
    return { ok: false, error: error, params: params, refunded: true };
  }

  async function redeemCode(input) {
    if (busy) return { ok: false, error: 'eBusy' };
    var code = parseCode(input);
    if (!code) return { ok: false, error: 'eCodeFormat' };
    var st = readState();
    if (st.redeemed[code]) return { ok: false, error: 'eUsed', code: code };
    if (st.sent[code]) return { ok: false, error: 'eSelf', code: code };

    busy = true;
    try {
      var res = await fetch(RAW_BASE + code + '/raw', { cache: 'no-store' });
      if (res.status === 404) return { ok: false, error: 'eExpired', code: code };
      if (!res.ok) return { ok: false, error: 'eNetwork', code: code };
      var v = verifyPayload(await res.text());
      if (!v.ok) return { ok: false, error: v.error, code: code };
      // Spend the code before paying: two clicks on one code must not buy two
      // gifts, and a half-finished payout is worse than a refused one.
      st = readState();
      if (st.redeemed[code]) return { ok: false, error: 'eUsed', code: code };
      st.redeemed[code] = { stars: v.stars, at: Date.now(), exp: v.expMs };
      writeState(st);
      var got = giveStars(v.stars);
      return {
        ok: true, code: code, stars: v.stars, credited: got, expMs: v.expMs,
        balance: balance(), truncated: got < v.stars
      };
    } catch (e) {
      return { ok: false, error: 'eNetwork', code: code };
    } finally {
      busy = false;
    }
  }

  // ------------------------------------------------------------------ styles

  var CSS = [
    '.sg-overlay{position:fixed;inset:0;z-index:10050;display:none;align-items:center;',
    '  justify-content:center;padding:16px;background:var(--overlay-faint,rgba(4,8,18,.62));',
    '  backdrop-filter:blur(4px);}',
    '.sg-overlay.show{display:flex;}',
    '.sg-card{width:min(430px,94vw);max-height:min(84vh,720px);overflow-y:auto;',
    '  overscroll-behavior:contain;touch-action:pan-y;background:var(--panel);',
    '  border:1px solid var(--border);border-radius:16px;padding:16px 16px 14px;',
    '  box-shadow:0 22px 60px rgba(0,0,0,.55);position:relative;color:var(--text);',
    '  color-scheme:dark;}',
    // --accent and --muted are tuned for the dark shell; at 9.5-11px on the light
    // panel they fall under 4.5:1, so the two text roles this feature uses for
    // real information get their own accessible pair of inks.
    '.sg-card,.sg-sec{--sg-sub:#8ea6bd;--sg-ink:var(--accent);}',
    'html[data-theme=light] .sg-card{color-scheme:light;}',
    'html[data-theme=light] .sg-card,html[data-theme=light] .sg-sec{--sg-sub:#4a5a72;--sg-ink:#0b6a9e;}',
    '.sg-x{position:absolute;top:10px;right:10px;width:26px;height:26px;border-radius:50%;',
    '  border:1px solid var(--border);background:var(--panel-2);color:var(--muted);cursor:pointer;',
    '  font-size:15px;line-height:1;display:flex;align-items:center;justify-content:center;}',
    '.sg-x:hover{color:var(--text);border-color:var(--accent);}',
    '.sg-h{font-size:14.5px;font-weight:800;letter-spacing:.2px;margin:0 26px 6px 0;}',
    '.sg-intro{font-size:11px;line-height:1.5;color:var(--sg-sub);margin:0 0 12px;}',
    '.sg-label{display:block;font-size:10px;font-weight:700;text-transform:uppercase;',
    '  letter-spacing:.6px;color:var(--sg-ink);margin:10px 0 5px;}',
    '.sg-field{display:flex;align-items:center;gap:8px;}',
    '.sg-input{display:block;width:100%;background:var(--panel-2);border:1px solid var(--border);',
    '  border-radius:9px;color:var(--text);font:inherit;font-size:13px;font-weight:700;',
    '  padding:8px 10px;}',
    '.sg-field .sg-input{flex:1;min-width:0;width:auto;}',
    '.sg-input:focus{outline:none;border-color:var(--accent);}',
    'input.sg-input[type=number]{font-variant-numeric:tabular-nums;}',
    '.sg-unit{font-size:12px;font-weight:700;color:var(--sg-sub);flex:none;}',
    '.sg-quick{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px;}',
    '.sg-quick button{flex:1 1 auto;min-width:52px;padding:4px 7px;border-radius:7px;cursor:pointer;',
    '  border:1px solid var(--border);background:var(--panel-2);color:var(--sg-sub);',
    '  font:inherit;font-size:10.5px;font-weight:700;transition:border-color .16s,color .16s;}',
    '.sg-quick button:hover{border-color:var(--accent);color:var(--text);}',
    '.sg-quick button.sel{border-color:var(--accent);color:var(--sg-ink);background:var(--accent-soft);}',
    '.sg-row{display:flex;align-items:baseline;justify-content:space-between;gap:10px;',
    '  font-size:11px;color:var(--sg-sub);margin-top:7px;}',
    '.sg-row b{font-size:12px;font-weight:800;color:var(--text);font-variant-numeric:tabular-nums;',
    '  text-align:right;}',
    '.sg-row b.neg{color:var(--err);}',
    '.sg-hint{font-size:10px;color:var(--sg-sub);line-height:1.45;margin:5px 0 0;}',
    '.sg-note{font-size:10px;line-height:1.5;color:var(--sg-sub);border-left:2px solid var(--border);',
    '  padding-left:9px;margin:12px 0 0;}',
    '.sg-msg{font-size:11px;line-height:1.45;border-radius:9px;padding:8px 10px;margin-top:11px;',
    '  display:none;white-space:pre-line;}',
    '.sg-msg.show{display:block;}',
    '.sg-msg.err{background:var(--err-soft,rgba(255,51,102,.1));border:1px solid var(--err);',
    '  color:var(--text);}',
    '.sg-msg.ok{background:var(--ok-soft,rgba(0,255,136,.09));border:1px solid var(--ok);',
    '  color:var(--text);}',
    '.sg-msg .sub{display:block;font-size:10px;color:var(--muted);margin-top:3px;font-weight:400;}',
    '.sg-actions{display:flex;gap:8px;margin-top:14px;}',
    '.sg-btn{flex:1;min-height:34px;padding:8px 12px;border-radius:9px;cursor:pointer;font:inherit;',
    '  font-size:12.5px;font-weight:700;border:1px solid var(--border);background:var(--panel-2);',
    '  color:var(--text);transition:border-color .16s,transform .16s;}',
    '.sg-btn:hover{border-color:var(--accent);}',
    '.sg-btn:disabled{opacity:.45;cursor:not-allowed;}',
    '.sg-btn.primary{background:var(--accent);border-color:var(--accent);color:var(--on-accent,#04121c);}',
    '.sg-btn.primary:hover{transform:translateY(-1px);}',
    '.sg-code{display:flex;align-items:stretch;gap:7px;}',
    '.sg-code input{flex:1;min-width:0;width:auto;background:var(--board,#050912);',
    '  border:1px solid var(--accent);border-radius:9px;color:var(--text);',
    '  font-family:ui-monospace,Consolas,monospace;font-size:16px;font-weight:700;',
    '  letter-spacing:1.5px;padding:10px;text-align:center;}',
    '.sg-code .sg-btn{flex:none;padding:0 12px;}',
    '.sg-url{font-size:10.5px;color:var(--sg-sub);font-family:ui-monospace,Consolas,monospace;',
    '  margin-top:7px;word-break:break-all;line-height:1.4;}',
    '.sg-sec{border-top:1px solid var(--border);padding-top:6px;margin-top:3px;}',
    '.sg-sec-title{font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.7px;',
    '  color:var(--sg-ink);margin:1px 0 4px;opacity:.9;}',
    '@media (max-width:640px){.sg-card{width:min(430px,96vw);padding:13px 12px 11px;border-radius:14px;}',
    '  .sg-h{font-size:13px;}.sg-intro{font-size:10px;}.sg-label{font-size:9.5px;margin:8px 0 4px;}',
    '  .sg-input{font-size:12px;padding:7px 9px;}.sg-code input{font-size:14px;padding:8px;}',
    '  .sg-btn{font-size:11.5px;min-height:31px;padding:7px 9px;}.sg-row{font-size:10px;}',
    '  .sg-row b{font-size:11px;}.sg-note,.sg-hint{font-size:9.5px;}',
    // iOS zooms the page when a focused field is under 16px; these are the typed ones.
    '  #sg-amount,#sg-code-in,#sg-expiry-custom{font-size:16px;padding:9px 10px;}}'
  ].join('\n');

  function ensureStyles() {
    if (document.getElementById('sg-styles')) return;
    var style = document.createElement('style');
    style.id = 'sg-styles';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  // --------------------------------------------------------------------- DOM

  function make(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function dialog(id) {
    var root = make('div', 'sg-overlay');
    root.id = id;
    root.setAttribute('aria-hidden', 'true');
    var card = make('div', 'sg-card');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    root.appendChild(card);
    document.body.appendChild(root);
    root.addEventListener('mousedown', function (e) { if (e.target === root) hide(root); });
    return { root: root, card: card };
  }

  function show(node) {
    node.classList.add('show');
    node.setAttribute('aria-hidden', 'false');
  }

  function hide(node) {
    node.classList.remove('show');
    node.setAttribute('aria-hidden', 'true');
  }

  function closeAll() {
    if (!refs) return;
    hide(refs.gift.root); hide(refs.code.root); hide(refs.redeem.root);
  }

  function wireClose(m) {
    m.card.querySelectorAll('[data-sg-close]').forEach(function (b) {
      b.addEventListener('click', function () { hide(m.root); });
    });
  }

  function say(box, kind, text, sub) {
    box.className = 'sg-msg show ' + kind;
    box.textContent = sub ? text + '\n' + sub : text;
  }

  function quiet(box) {
    box.className = 'sg-msg';
    box.textContent = '';
  }

  function q(card, sel) { return card.querySelector(sel); }

  // --------------------------------------------------------------- gift dialog

  function buildGift() {
    var m = dialog('sg-gift-modal');
    m.card.innerHTML =
      '<button class="sg-x" type="button" data-sg-close aria-label="close">&times;</button>' +
      '<h3 class="sg-h" data-t="giftTitle"></h3>' +
      '<p class="sg-intro" data-t="giftIntro"></p>' +
      '<label class="sg-label" for="sg-amount" data-t="amount"></label>' +
      '<div class="sg-field">' +
      '  <input class="sg-input" id="sg-amount" type="number" min="' + MIN_GIFT + '" max="' + MAX_GIFT + '" step="50" inputmode="numeric" value="' + MIN_GIFT + '" />' +
      '  <span class="sg-unit">★</span>' +
      '</div>' +
      '<div class="sg-quick" id="sg-quick"></div>' +
      '<p class="sg-hint" data-t="amountHint"></p>' +
      '<label class="sg-label" for="sg-expiry" data-t="expiry"></label>' +
      '<select class="sg-input" id="sg-expiry"></select>' +
      '<input class="sg-input" id="sg-expiry-custom" type="datetime-local" step="60" style="margin-top:7px" hidden />' +
      '<div class="sg-row"><span data-t="balanceRow"></span><b id="sg-balance-row">0 ★</b></div>' +
      '<div class="sg-row"><span data-t="afterRow"></span><b id="sg-after-row">0 ★</b></div>' +
      '<div class="sg-row"><span data-t="expWhen"></span><b id="sg-exp-row">—</b></div>' +
      '<div class="sg-msg" id="sg-gift-msg"></div>' +
      '<p class="sg-note" data-t="burnNote"></p>' +
      '<div class="sg-actions">' +
      '  <button class="sg-btn" type="button" data-sg-close data-t="cancel"></button>' +
      '  <button class="sg-btn primary" type="button" id="sg-create" data-t="create"></button>' +
      '</div>';

    [MIN_GIFT, 500, 1000, 5000, 10000].forEach(function (v) {
      var b = make('button', null, esc(v));
      b.type = 'button';
      b.dataset.amount = String(v);
      b.addEventListener('click', function () {
        q(m.card, '#sg-amount').value = String(v);
        syncGift();
      });
      q(m.card, '#sg-quick').appendChild(b);
    });

    var sel = q(m.card, '#sg-expiry');
    PRESETS.forEach(function (p, i) {
      var o = make('option');
      o.value = String(i);
      sel.appendChild(o);
    });
    sel.value = '3';

    q(m.card, '#sg-create').addEventListener('click', submitGift);
    q(m.card, '#sg-amount').addEventListener('input', syncGift);
    sel.addEventListener('change', function () {
      var custom = q(m.card, '#sg-expiry-custom');
      if (currentPreset().ms === 0) {
        custom.hidden = false;
        if (!custom.value) custom.value = localInputValue(new Date(Date.now() + 24 * 3600 * 1000));
      } else custom.hidden = true;
      syncGift();
    });
    q(m.card, '#sg-expiry-custom').addEventListener('input', syncGift);
    wireClose(m);
    return m;
  }

  function currentPreset() {
    var i = parseInt(q(refs.gift.card, '#sg-expiry').value, 10);
    if (!(i >= 0 && i < PRESETS.length)) i = 3;
    return PRESETS[i];
  }

  function chosenExpiry() {
    var p = currentPreset();
    if (p.ms > 0) return Date.now() + p.ms;
    var v = q(refs.gift.card, '#sg-expiry-custom').value;
    if (!v) return NaN;
    var t = new Date(v).getTime();
    return Number.isFinite(t) ? t : NaN;
  }

  function syncGift() {
    if (!refs) return;
    var card = refs.gift.card;
    var n = wholeStars(q(card, '#sg-amount').value) || 0;
    var bal = balance();
    q(card, '#sg-balance-row').textContent = bal + ' ★';
    var after = q(card, '#sg-after-row');
    after.textContent = (bal - n) + ' ★';
    after.className = n > bal ? 'neg' : '';
    var exp = chosenExpiry();
    var expEl = q(card, '#sg-exp-row');
    expEl.textContent = Number.isFinite(exp) ? humanDate(exp) : '—';
    expEl.className = Number.isFinite(exp) && exp <= Date.now() ? 'neg' : '';
    card.querySelectorAll('#sg-quick button').forEach(function (b) {
      b.classList.toggle('sel', Number(b.dataset.amount) === n);
    });
    quiet(q(card, '#sg-gift-msg'));
  }

  async function submitGift() {
    var card = refs.gift.card;
    var box = q(card, '#sg-gift-msg');
    var btn = q(card, '#sg-create');
    quiet(box);
    var amount = wholeStars(q(card, '#sg-amount').value);
    var exp = chosenExpiry();
    var bad = validateGift(amount, exp, balance());
    if (bad) { say(box, 'err', L(bad.error, bad.params)); return; }

    btn.disabled = true;
    btn.textContent = L('creating');
    var r = await createGift(amount, exp);
    btn.disabled = false;
    btn.textContent = L('create');
    if (!r.ok) {
      say(box, 'err', L(r.error, r.params), r.refunded ? L('refunded') : '');
      syncGift();
      return;
    }
    hide(refs.gift.root);
    showCode(r);
    syncGift();
  }

  // --------------------------------------------------------------- code dialog

  function buildCode() {
    var m = dialog('sg-code-modal');
    m.card.innerHTML =
      '<button class="sg-x" type="button" data-sg-close aria-label="close">&times;</button>' +
      '<h3 class="sg-h" data-t="codeTitle"></h3>' +
      '<p class="sg-intro" data-t="codeIntro"></p>' +
      '<label class="sg-label" for="sg-code-out" data-t="codeLabel"></label>' +
      '<div class="sg-code">' +
      '  <input class="sg-input" id="sg-code-out" type="text" readonly aria-readonly="true" />' +
      '  <button class="sg-btn" type="button" id="sg-copy" data-t="copy"></button>' +
      '</div>' +
      '<div class="sg-url" id="sg-code-url"></div>' +
      '<div class="sg-row"><span data-t="amount"></span><b id="sg-code-stars">0 ★</b></div>' +
      '<div class="sg-row"><span data-t="expiresAt"></span><b id="sg-code-exp">—</b></div>' +
      '<p class="sg-note" data-t="burnNote"></p>' +
      '<div class="sg-actions">' +
      '  <button class="sg-btn primary" type="button" data-sg-close data-t="done"></button>' +
      '</div>';
    q(m.card, '#sg-copy').addEventListener('click', function () {
      copyText(q(m.card, '#sg-code-out').value, q(m.card, '#sg-copy'));
    });
    wireClose(m);
    return m;
  }

  function showCode(r) {
    var card = refs.code.card;
    q(card, '#sg-code-out').value = r.code;
    q(card, '#sg-code-url').textContent = r.url;
    q(card, '#sg-code-stars').textContent = r.stars + ' ★';
    q(card, '#sg-code-exp').textContent = humanDate(r.expMs);
    show(refs.code.root);
  }

  function copyText(text, btn) {
    function flash(label) {
      if (!btn) return;
      btn.textContent = label;
      clearTimeout(copyTimer);
      copyTimer = setTimeout(function () { btn.textContent = L('copy'); }, 1600);
    }
    // Nothing was really copied: hand the player a selected field instead of
    // claiming a success the browser refused to give us.
    function selectCode() {
      var field = refs.code ? q(refs.code.card, '#sg-code-out') : null;
      if (!field) return;
      field.focus();
      field.select();
    }
    function legacy() {
      var ta = make('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      if (ok) flash(L('copied'));
      else { selectCode(); flash(L('copyKeys')); }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { flash(L('copied')); }, legacy);
    } else legacy();
  }

  // ------------------------------------------------------------- redeem dialog

  function buildRedeem() {
    var m = dialog('sg-redeem-modal');
    m.card.innerHTML =
      '<button class="sg-x" type="button" data-sg-close aria-label="close">&times;</button>' +
      '<h3 class="sg-h" data-t="redeemTitle"></h3>' +
      '<p class="sg-intro" data-t="redeemIntro"></p>' +
      '<label class="sg-label" for="sg-code-in" data-t="redeemLabel"></label>' +
      '<input class="sg-input" id="sg-code-in" type="text" autocomplete="off" spellcheck="false" />' +
      '<p class="sg-hint" data-t="redeemPh"></p>' +
      '<div class="sg-msg" id="sg-redeem-msg"></div>' +
      '<div class="sg-actions">' +
      '  <button class="sg-btn" type="button" data-sg-close data-t="cancel"></button>' +
      '  <button class="sg-btn primary" type="button" id="sg-redeem" data-t="redeem"></button>' +
      '</div>';
    var input = q(m.card, '#sg-code-in');
    input.addEventListener('input', function () { quiet(q(m.card, '#sg-redeem-msg')); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); submitRedeem(); }
    });
    q(m.card, '#sg-redeem').addEventListener('click', submitRedeem);
    wireClose(m);
    return m;
  }

  async function submitRedeem() {
    var card = refs.redeem.card;
    var box = q(card, '#sg-redeem-msg');
    var btn = q(card, '#sg-redeem');
    var input = q(card, '#sg-code-in');
    quiet(box);
    var raw = input.value.trim();
    if (!parseCode(raw)) { say(box, 'err', L('eCodeFormat')); return; }
    btn.disabled = true;
    input.disabled = true;
    btn.textContent = L('checking');
    var r = await redeemCode(raw);
    btn.disabled = false;
    input.disabled = false;
    btn.textContent = L('redeem');
    if (!r.ok) { say(box, 'err', L(r.error, r.params)); input.focus(); return; }
    input.value = '';
    var note = L('creditedNote', { code: r.code, stars: r.stars, when: humanDate(r.expMs) });
    if (r.truncated) note += '\n' + L('capWarn', { n: r.credited, stars: r.stars, cap: BALANCE_CAP });
    say(box, 'ok', L('credited', { n: r.credited }), note);
    toast(L('credited', { n: r.credited }));
  }

  function toast(text) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 4200);
  }

  // -------------------------------------------------------------- menu wiring

  function closeMenuDropdown() {
    var btn = document.getElementById('btn-menu');
    var dd = document.getElementById('menu-dropdown');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    if (dd) dd.hidden = true;
  }

  function translate() {
    [['sg-sec-gift-title', 'secGift'], ['sg-sec-codes-title', 'secCodes'],
      ['btn-star-gift', 'btnGift', 'btnGiftTitle'], ['btn-star-codes', 'btnCodes', 'btnCodesTitle']]
      .forEach(function (p) {
        var n = document.getElementById(p[0]);
        if (!n) return;
        n.textContent = L(p[1]);
        if (p[2]) n.title = L(p[2]);
      });
    if (!refs) return;
    var TIPS = { amountHint: { min: MIN_GIFT, max: MAX_GIFT } };
    [refs.gift, refs.code, refs.redeem].forEach(function (m) {
      m.card.querySelectorAll('[data-t]').forEach(function (n) {
        var key = n.getAttribute('data-t');
        n.textContent = L(key, TIPS[key]);
      });
      var codeIn = q(m.card, '#sg-code-in');
      if (codeIn) codeIn.placeholder = L('redeemPh');
      var sel = q(m.card, '#sg-expiry');
      if (sel) {
        Array.prototype.forEach.call(sel.options, function (o, i) { o.textContent = L(PRESETS[i].key); });
      }
    });
    syncGift();
  }

  // One dialog at a time: an open backdrop would swallow the menu anyway, and
  // two .show overlays would stack both cards in the same pixel centre.
  function openGift() {
    if (!tryMount()) return false;
    closeAll();
    syncGift();
    show(refs.gift.root);
    q(refs.gift.card, '#sg-amount').focus();
    return true;
  }

  function openRedeem() {
    if (!tryMount()) return false;
    closeAll();
    quiet(q(refs.redeem.card, '#sg-redeem-msg'));
    show(refs.redeem.root);
    q(refs.redeem.card, '#sg-code-in').focus();
    return true;
  }

  function openCode() {
    if (!tryMount()) return false;
    closeAll();
    show(refs.code.root);
    return true;
  }

  function mount() {
    if (!document.getElementById('btn-star-gift') || !document.getElementById('btn-star-codes')) return false;
    ensureStyles();
    refs = { gift: buildGift(), code: buildCode(), redeem: buildRedeem() };
    document.getElementById('btn-star-gift').addEventListener('click', function () {
      closeMenuDropdown();
      openGift();
    });
    document.getElementById('btn-star-codes').addEventListener('click', function () {
      closeMenuDropdown();
      openRedeem();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeAll();
    });
    window.addEventListener('mol3d:lang', translate);
    window.addEventListener('mol3d:theme', syncGift);
    translate();
    return true;
  }

  var mounted = false;
  var tries = 0;
  var poll = window.setInterval(function () {
    tries++;
    if (tryMount() || tries > 150) clearInterval(poll);
  }, 400);

  function tryMount() {
    if (mounted) return true;
    try { mounted = mount(); } catch (e) { mounted = false; console.warn('Star gift:', e); }
    if (mounted) clearInterval(poll);
    return mounted;
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', tryMount);
  } else {
    tryMount();
  }

  window.__mol3dStarGift = {
    version: VERSION,
    limits: { min: MIN_GIFT, max: MAX_GIFT, maxLifeDays: 90, balanceCap: BALANCE_CAP },
    balance: balance,
    createGift: createGift,
    redeemCode: redeemCode,
    parseCode: parseCode,
    validateGift: validateGift,
    buildPayload: buildPayload,
    verifyPayload: verifyPayload,
    toUtcStamp: toUtcStamp,
    fromUtcStamp: fromUtcStamp,
    seal: seal,
    state: readState,
    isBusy: function () { return busy; },
    isReady: function () { return mounted; },
    open: function (which) {
      if (which === 'code') return openCode();
      if (which === 'redeem') return openRedeem();
      return openGift();
    },
    close: closeAll,
    strings: function () { return STR; }
  };
})();
