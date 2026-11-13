// Star gifting — turn stars, elements and titles into a gift code, and a code
// back into the same three things.
//
// What a code holds: a star amount and a list of contents. Elements are units of
// the sender's own crate stock and titles are copies taken out of the sender's
// collection, so a gift can only ever give away what somebody already paid for.
// The units leave the sending side the moment the code is made — not to the
// table, never to the table, straight to the other player — and come back if the
// upload fails, exactly as the stars do.
//
// Why the game needs a host at all: it is a static bundle with no server of its
// own, so a gift has to be held somewhere a second player can reach, and a fetch
// started by this page must be able to READ the answer — that is the only thing
// that matters for a bundle served straight off GitHub Pages. A host that
// answers but sends no Access-Control-Allow-Origin is, from here, the same as a
// host that is down.
//
// PrivateBin is that host. The gift is encrypted in the browser with WebCrypto
// (PBKDF2 -> AES-256-GCM) before it is sent, and the key travels only inside the
// shareable code, so the service stores unreadable bytes and never sees the
// stars. The instance is also configured for burn-after-read, which makes the
// code pay exactly once on any device in the world: measured against the live
// service, the first read returns the paste and the second returns
// `{"status":1,"message":"Document does not exist…"}`.
//
// Hosts measured and rejected, all from this page, so the choice is not a guess:
// nullpaste.org answers a write with 403 `cross_origin_write_forbidden`;
// pastebin.ai completes a write but the response carries no
// Access-Control-Allow-Origin and sets `Cross-Origin-Resource-Policy:
// same-origin`, so the browser refuses to hand back the paste id; litterbox is
// reachable but stores the gift in plain text with only four lifetimes and no
// delete call at all; and of the public PrivateBin instances checked, only this
// one answers the preflight a JSON POST needs (165 of the 172 listed instances
// send no CORS headers whatsoever). paaster.org as recommended did not resolve.
//
// Three costs of this route, all reported rather than worked around: the
// per-connection traffic limiter refuses a second post for 10 seconds; one
// volunteer-run instance holds every gift, so when it is unreachable no code can
// be made or opened; and because the only way to look at a PrivateBin code is to
// spend it, the game never checks the live status of a code for you.
(function () {
  'use strict';

  if (window.__mol3dStarGiftMounted) return;
  window.__mol3dStarGiftMounted = true;

  // A PrivateBin instance is a JSON API at its own root: POST <base> creates,
  // GET <base>?<id> reads, and the reply is JSON as soon as the request asks for
  // it. This one is reachable from a browser, which the great majority are not.
  var PB_BASE = 'https://securebin.fastm.de/';
  var PB_JSON = { Accept: 'application/json' };
  // The instance's own expiry list, read from its page: an unrecognised value is
  // not an error, it silently becomes the instance default, so the game can only
  // ever offer tokens measured here.
  var PB_TIERS = {
    300000: '5min',
    600000: '10min',
    3600000: '1hour',
    86400000: '1day',
    604800000: '1week',
    2592000000: '1month'
  };
  var PB_KDF = { iterations: 100000, keyLength: 256, tagLength: 128, hash: 'SHA-256' };
  var PB_KEY_BYTES = 16;
  var PB_ID_RE = /^[0-9a-f]{16}$/;
  var PB_CODE_RE = /^PB-([0-9a-f]{16})-([A-Za-z0-9_-]{22})$/i;
  var PB_URL_RE = /securebin\.fastm\.de\/\?([0-9a-f]{16})#([A-Za-z0-9_-]{22})/i;

  var APP_ID = 'moleculith';
  var KIND = 'star-gift';
  // Version 4 adds contents to what had always been a star-only payload. A v3
  // code is still honoured, because one that is sitting in a chat window right
  // now is a real gift somebody paid for; anything older is refused as unreadable.
  var VERSION = 4;
  var OLDEST_READABLE = 3;
  var SEAL_KEY = 'moleculith.star-gift.v1';

  var MIN_GIFT = 200;
  var MAX_GIFT = 100000;
  // Contents are bounded the same way the star amount is: a code is a gift, not a
  // way to move a warehouse, and every extra row is bytes a stranger's browser has
  // to decrypt before it can say no.
  var MAX_ROWS = 12;
  var MAX_ATOMS = 999;
  var MAX_TITLES = 5;
  var MAX_EL_Z = 118;
  // A code born already dead is a lost gift, and a code that lives a year is one
  // someone can sit on. Both ends are clamped.
  var MIN_LIFE_MS = 60 * 1000;
  var MAX_LIFE_MS = 30 * 24 * 60 * 60 * 1000;
  var BALANCE_CAP = 1000000;

  // The PrivateBin presets are the instance's six expiry tokens and nothing
  // else, so picking one cannot produce a value the host would quietly swap out.
  var PB_PRESETS = [
    { ms: 5 * 60 * 1000, key: 'p5m' },
    { ms: 10 * 60 * 1000, key: 'p10m' },
    { ms: 60 * 60 * 1000, key: 'p1h' },
    { ms: 24 * 60 * 60 * 1000, key: 'p1d' },
    { ms: 7 * 24 * 60 * 60 * 1000, key: 'p7d' },
    { ms: 30 * 24 * 60 * 60 * 1000, key: 'p30d' }
  ];

  var STATE_KEY = 'mol3d.gift.v1';
  var PROBE_MS = 45 * 1000;
  var KEEP = 300;

  var busy = false;
  var refs = null;
  var toastTimer = null;
  var copyTimer = null;
  var lastProbe = null;
  var probeInFlight = null;
  // Set when a gift was refused because the service looks down; the second click
  // in a row is the player overriding that warning.
  var armed = false;
  // The gift whose code dialog is open, so the live-status row can be re-checked.
  var codeAt = null;

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

  // The crate and the collection are where a gift's contents come from. Either
  // can be missing on a page that has not mounted it yet, and then the only
  // thing this dialog can offer is stars — which is what it offered before.
  function shop() { try { return window.__mol3dShop || null; } catch (e) { return null; } }
  function econ() { try { return window.__mol3dEcon || null; } catch (e) { return null; } }

  // Repaint whatever the contents moved through: the crate chips and the
  // economy HUD read these numbers live, so a gift that is not announced leaves
  // the shop showing a stock count that is no longer true.
  function repaintEconomy() {
    var sh = shop();
    try { if (sh && typeof sh.rerender === 'function') sh.rerender(); } catch (e) { }
    var ec = econ();
    try { if (ec && typeof ec.refresh === 'function') ec.refresh(); } catch (e) { }
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
      secGift: 'Gifting',
      secCodes: 'Gift codes',
      btnGift: 'Gift',
      btnCodes: 'Codes',
      btnGiftTitle: 'Turn stars, elements and titles into a gift code',
      btnCodesTitle: 'Open a gift code and take what it holds',
      giftTitle: 'Send a gift',
      giftIntro: 'Stars, elements and titles leave your side the moment the code is made — the crate ships the atoms and the collection gives up the title, and neither is put back if you change your mind later. The gift is encrypted in this browser and held by PrivateBin, and the code dies the first time anyone opens it — or at the expiry you pick, whichever comes first.',
      amount: 'Star amount',
      amountHint: 'Minimum {min} ★ · maximum {max} ★ · or 0 with something below in the gift',
      contents: 'What is inside',
      elements: 'Elements from your crate',
      elPh: 'Symbol or name — H, O, Au…',
      elQty: 'How many',
      elAdd: 'Add',
      elNone: 'Your crate holds no elements yet, so there is nothing to put in a gift.',
      elHave: 'crate holds {n}',
      eElement: 'That is not an element your crate can give.',
      titles: 'Titles from your collection',
      titlesNone: 'No titles collected yet — Lab Crates are where they come from.',
      contentsValue: 'Worth about {n} ★ to whoever opens it',
      contentsEmpty: 'Nothing added yet.',
      balanceRow: 'Your balance',
      afterRow: 'After this gift',
      expiry: 'Expiry date',
      expWhen: 'Code stops working',
      statusRow: 'Service status',
      check: 'Check',
      recheck: 'Re-check',
      stProbing: 'Checking…',
      stOnline: 'Online · {ms} ms',
      stOnlineNow: 'Online · just uploaded',
      stBusy: 'Busy · rate limited',
      stOffline: 'Not reachable from this browser',
      stUnknown: 'Not checked yet',
      stAt: 'at {when}',
      downWarn: 'PrivateBin looks unreachable right now.',
      giftAnyway: 'Gift anyway',
      stepDebit: 'Taking the gift out of your crate…',
      stepUpload: 'Uploading to PrivateBin…',
      stepVerify: 'Confirming the code…',
      stepLive: 'Code is live',
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
      liveRow: 'Live status',
      liveSelf: 'A gift you sent from this device',
      liveRead: 'Already redeemed on this device',
      liveBad: 'Nothing to report — that is not a code this game made',
      liveSpend: 'PrivateBin holds it — checking it here would spend the gift',
      burnByRead: 'PrivateBin destroyed the code the moment this device opened it — it cannot pay again anywhere',
      burnReadFailed: 'The code was already spent at PrivateBin before it could pay: a single-use gift destroyed by one read pays nobody',
      burnNote: 'A gift code is encrypted in this browser (PBKDF2 + AES-256-GCM) before it is uploaded, and the key only ever travels inside the shareable code, so PrivateBin stores bytes it cannot read. The service also holds the single-use flag: the first read returns the gift and every later read is refused — measured against the live service. That is what makes a gift pay once in the world rather than once per device, and its cost is that opening the code somewhere else destroys it instead of paying. Looking at the live status of a code would be exactly such a read, so the game never does it.',
      redeemTitle: 'Redeem a gift code',
      redeemIntro: 'Paste the gift code, or the whole PrivateBin link you were sent.',
      redeemLabel: 'Gift code',
      redeemPh: 'e.g. PB-71d9800173e373cc-4kQ0pXhZ8sY2mN7bQ1rTfA or the full PrivateBin link',
      redeem: 'Redeem',
      checking: 'Checking code…',
      credited: '+{n} ★ added to your balance',
      creditedNote: 'Code {code} · {stars} ★ · expires {when}',
      capWarn: 'Only {n} of {stars} ★ fitted under the {cap} ★ balance cap.',
      codeContents: 'The code holds',
      gotAtom: '{n} × {sym}',
      gotTitle: '{name}',
      partialWarn: 'Only {got} of {want} could be delivered — a full shelf takes no more.',
      nothingWarn: 'Nothing could be delivered, so this code paid nothing.',
      p5m: '5 minutes', p10m: '10 minutes',
      p1h: '1 hour', p1d: '1 day', p7d: '7 days', p30d: '30 days',
      eAmount: 'Stars must be 0, or a whole number between {min} and {max}.',
      eTooMany: 'A gift can hold at most {max} lines.',
      eNoCrate: 'The crate is not on this page, so elements cannot go in a gift.',
      eNoCollection: 'The collection is not on this page, so titles cannot go in a gift.',
      eStockShort: 'Your crate only holds {have} × {sym}.',
      eTitleShort: 'Only {n} of that title are left in your collection.',
      eBalance: 'Not enough stars — your balance is {n} ★.',
      eExpiryPast: 'The expiry has to be in the future.',
      eExpiryFar: 'A code can live for at most {days} days.',
      eCodeFormat: 'That is not a gift code this game understands.',
      eExpired: 'This code has expired, been opened once already, or never existed.',
      eUsed: 'This code was already redeemed on this device.',
      eSelf: 'This is a code you sent from this device — the gift is for another player.',
      ePayload: 'The code does not hold a valid star gift.',
      eKey: 'The code reached PrivateBin, but the gift inside it would not decrypt — the key half of the code is mistyped.',
      eBusy: 'Wait for the current request to finish.',
      eNetwork: 'Could not reach PrivateBin. Check your connection.',
      eNoCrypto: 'This page was not opened over https, so the browser refuses to encrypt — a PrivateBin gift cannot be made or opened from here.',
      eRate: 'PrivateBin is rate-limiting this device. Try again in a minute.',
      eHostWait: 'PrivateBin allows one gift per connection every {seconds} seconds. Try again in a moment.',
      eHostMsg: 'PrivateBin refused the gift: {message}',
      eServer: 'PrivateBin refused the request ({status}).',
      eBadReply: 'PrivateBin returned an unreadable answer.',
      refunded: 'Your stars were put back.',
      refundedContents: 'Your elements and titles went back into your crate and collection.'
    },
    vi: {
      secGift: 'Tặng quà',
      secCodes: 'Mã quà tặng',
      btnGift: 'Tặng quà',
      btnCodes: 'Nhập mã',
      btnGiftTitle: 'Biến sao, nguyên tố và danh hiệu thành mã quà tặng',
      btnCodesTitle: 'Mở mã quà tặng và nhận những gì bên trong',
      giftTitle: 'Gửi quà tặng',
      giftIntro: 'Sao, nguyên tố và danh hiệu rời khỏi bạn ngay khi tạo mã — kho gửi nguyên tố đi còn bộ sưu tập nhường lại danh hiệu, và không thứ nào tự quay về nếu bạn đổi ý sau đó. Quà được mã hóa ngay trên máy này rồi PrivateBin giữ hộ; mã mất ngay khi có người mở lần đầu — hoặc khi hết hạn theo lúc bạn chọn, tùy điều nào đến trước.',
      amount: 'Số sao',
      amountHint: 'Tối thiểu {min} ★ · tối đa {max} ★ · hoặc 0 kèm quà bên dưới',
      contents: 'Bên trong có gì',
      elements: 'Nguyên tố trong kho của bạn',
      elPh: 'Kí hiệu hoặc tên — H, O, Au…',
      elQty: 'Số lượng',
      elAdd: 'Thêm',
      elNone: 'Kho của bạn chưa có nguyên tố nào nên chưa có gì để tặng.',
      elHave: 'kho có {n}',
      eElement: 'Đó không phải nguyên tố kho của bạn tặng được.',
      titles: 'Danh hiệu trong bộ sưu tập',
      titlesNone: 'Chưa sưu tầm danh hiệu nào — mở Thùng thí nghiệm để có.',
      contentsValue: 'Người mở quà nhận giá trị khoảng {n} ★',
      contentsEmpty: 'Chưa thêm gì.',
      balanceRow: 'Số dư của bạn',
      afterRow: 'Sau khi tặng',
      expiry: 'Ngày hết hạn',
      expWhen: 'Mã ngừng hoạt động',
      statusRow: 'Trạng thái dịch vụ',
      check: 'Kiểm tra',
      recheck: 'Kiểm tra lại',
      stProbing: 'Đang kiểm tra…',
      stOnline: 'Online · {ms} ms',
      stOnlineNow: 'Online · vừa tải lên',
      stBusy: 'Bận · bị giới hạn tốc độ',
      stOffline: 'Không tiếp cận được từ trình duyệt này',
      stUnknown: 'Chưa kiểm tra',
      stAt: 'lúc {when}',
      downWarn: 'PrivateBin có vẻ không tiếp cận được ngay lúc này.',
      giftAnyway: 'Cứ tặng',
      stepDebit: 'Đang lấy quà ra khỏi kho và bộ sưu tập…',
      stepUpload: 'Đang tải lên PrivateBin…',
      stepVerify: 'Đang xác nhận mã…',
      stepLive: 'Mã đã có hiệu lực',
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
      liveRow: 'Trạng thái trực tiếp',
      liveSelf: 'Là quà bạn gửi từ máy này',
      liveRead: 'Đã được nạp trên máy này',
      liveBad: 'Không có gì để báo — đó không phải mã do trò chơi này tạo ra',
      liveSpend: 'PrivateBin đang giữ quà — kiểm tra ở đây sẽ làm mất quà',
      burnByRead: 'PrivateBin đã hủy mã ngay khi máy này mở nó — không thể nạp lần hai ở bất kỳ đâu khác',
      burnReadFailed: 'Mã đã bị hủy tại PrivateBin trước khi trả sao: quà một lần đã mở thì không ai nhận được nữa',
      burnNote: 'Mã quà được mã hóa ngay trên máy này (PBKDF2 + AES-256-GCM) trước khi tải lên; khóa chỉ đi kèm trong mã chia sẻ, nên PrivateBin lưu những đoạn byte nó không đọc được. Dịch vụ cũng giữ cơ chế một lần mở: lần đọc đầu trả lại quà, mọi lần sau đều bị từ chối — đã đo trên dịch vụ thật. Điều đó khiến quà chỉ trả một lần trên toàn thế giới, chứ không phải một lần mỗi thiết bị; đổi lại, nếu người khác mở mã trước thì mã bị hủy mà không ai nhận. Vì xem trạng thái trực tiếp của mã cũng chính là mở nó, nên trò chơi không làm việc đó.',
      redeemTitle: 'Nhập mã quà tặng',
      redeemIntro: 'Dán mã quà, hoặc toàn bộ liên kết PrivateBin mà bạn được gửi.',
      redeemLabel: 'Mã quà tặng',
      redeemPh: 'VD: PB-71d9800173e373cc-4kQ0pXhZ8sY2mN7bQ1rTfA hoặc liên kết PrivateBin đầy đủ',
      redeem: 'Nhận quà',
      checking: 'Đang kiểm tra mã…',
      credited: '+{n} ★ đã được cộng vào số dư của bạn',
      creditedNote: 'Mã {code} · {stars} ★ · hết hạn {when}',
      capWarn: 'Chỉ {n} trong {stars} ★ vừa với trần số dư {cap} ★.',
      codeContents: 'Mã chứa',
      gotAtom: '{n} × {sym}',
      gotTitle: '{name}',
      partialWarn: 'Chỉ giao được {got} trên {want} — kệ đã đầy nên nhận thêm không được nữa.',
      nothingWarn: 'Không giao được gì, nên mã này không trả phần quà nào.',
      p5m: '5 phút', p10m: '10 phút',
      p1h: '1 giờ', p1d: '1 ngày', p7d: '7 ngày', p30d: '30 ngày',
      eAmount: 'Số sao phải là 0, hoặc số nguyên từ {min} đến {max}.',
      eTooMany: 'Một món quà chứa tối đa {max} dòng.',
      eNoCrate: 'Trang này không có kho nên không cho nguyên tố vào quà được.',
      eNoCollection: 'Trang này không có bộ sưu tập nên không cho danh hiệu vào quà được.',
      eStockShort: 'Kho của bạn chỉ còn {have} × {sym}.',
      eTitleShort: 'Bộ sưu tập của bạn chỉ còn {n} danh hiệu đó.',
      eBalance: 'Không đủ sao — số dư của bạn là {n} ★.',
      eExpiryPast: 'Ngày hết hạn phải ở tương lai.',
      eExpiryFar: 'Mã chỉ sống tối đa {days} ngày.',
      eCodeFormat: 'Đó không phải mã quà mà trò chơi này hiểu.',
      eExpired: 'Mã đã hết hạn, đã bị mở một lần, hoặc chưa từng tồn tại.',
      eUsed: 'Mã này đã được nạp trên máy này.',
      eSelf: 'Đây là mã bạn đã gửi từ máy này — phần quà dành cho người chơi khác.',
      ePayload: 'Mã không chứa quà sao hợp lệ.',
      eKey: 'Mã đã tới PrivateBin, nhưng quà bên trong không giải mã được — nửa khóa của mã bị nhập sai.',
      eBusy: 'Vui lòng đợi yêu cầu hiện tại hoàn tất.',
      eNetwork: 'Không tiếp cận được PrivateBin. Hãy kiểm tra mạng.',
      eNoCrypto: 'Trang này không mở qua https nên trình duyệt từ chối mã hóa — không tạo hay nạp được quà PrivateBin ở đây.',
      eRate: 'PrivateBin đang giới hạn tốc độ với máy này. Thử lại sau một phút.',
      eHostWait: 'PrivateBin chỉ cho gửi một món quà mỗi {seconds} giây trên mỗi kết nối. Hãy thử lại sau lát nữa.',
      eHostMsg: 'PrivateBin từ chối món quà: {message}',
      eServer: 'PrivateBin từ chối yêu cầu ({status}).',
      eBadReply: 'PrivateBin trả về dữ liệu không đọc được.',
      refunded: 'Sao của bạn đã được hoàn lại.',
      refundedContents: 'Nguyên tố và danh hiệu đã trở về kho và bộ sưu tập của bạn.'
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

  // The expiry travels as a UTC stamp with no zone suffix, because the seal is
  // taken over that exact text: a local-time string would make the same gift
  // verify differently on the machine that made it and the one that redeems it.
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

  function humanDate(ms) {
    try { return new Date(ms).toLocaleString(); } catch (e) { return String(ms); }
  }

  // Status rows say when they were measured; only the clock time matters there,
  // a full timestamp would push the card over on a phone.
  function timeOfDay(ms) {
    try {
      var d = new Date(ms);
      return pad(d.getHours()) + ':' + pad(d.getMinutes());
    } catch (e) { return ''; }
  }

  // ------------------------------------------------------------- the seal
  // The same double-hash the star ledger uses. It is not a secret — anything the
  // client holds ships in the client — it only stops a hand-typed or edited code
  // from paying, so casual forgeries fail loudly instead of quietly succeeding.
  // The contents digest joins the hash from version 4 on: an edited element count
  // in a code is exactly the forgery worth stopping, and a v3 code — which has no
  // contents — keeps hashing the string it was sealed with, so codes that are
  // already sitting in somebody's chat window still pay.
  function seal(stars, exp, giftId, digest) {
    var s = SEAL_KEY + '|' + stars + '|' + exp + '|' + giftId + (digest ? '|' + digest : '');
    var h1 = 2166136261 >>> 0, h2 = 3432345061 >>> 0;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
      h2 = Math.imul(h2 + c, 2246822519) >>> 0;
    }
    return (h1 >>> 0).toString(36) + '.' + (h2 >>> 0).toString(36);
  }

  function randomHex(bytes) {
    var out = new Uint8Array(bytes);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(out);
    else for (var i = 0; i < bytes; i++) out[i] = Math.floor(Math.random() * 256);
    var hex = '';
    for (var j = 0; j < out.length; j++) hex += out[j].toString(16).padStart(2, '0');
    return hex;
  }

  function randomId() { return randomHex(8); }

  // ------------------------------------------------------------- gift contents
  // A content row is one of two things: units of an element out of the crate, or
  // a title out of the collection. The rows are what the code carries, what the
  // sender is charged for and what the receiver is handed, so they are built
  // once, checked once, and then read by every surface that shows the gift.
  // Names travel in both languages because the code is opened by a stranger, in
  // their language, on a machine the sender will never see again.

  function elements() {
    var g = game();
    return (g && g.ELEMENTS) || [];
  }

  function elementByZ(z) {
    var list = elements();
    for (var i = 0; i < list.length; i++) if (list[i].z === z) return list[i];
    return null;
  }

  function elLabel(el) {
    if (!el) return '?';
    var g = game();
    try {
      if (g && g.i18n && typeof g.i18n.elName === 'function') return g.i18n.elName(el);
    } catch (e) { }
    return el.sym || String(el.z);
  }

  // The pack pool is the title catalogue: it is where a title's bilingual name,
  // rarity and icon are defined, and a gifted title must render exactly like the
  // one the receiver would have rolled. Falling back to the sender's own stored
  // string keeps titles minted by any other surface giftable too; the pair then
  // carries that one text in both slots, which is all anybody can honestly say.
  function titleCatalog() {
    var out = {};
    var p = null;
    try { p = window.__mol3dPacks || null; } catch (e) { return out; }
    var pool = p && p.pool;
    if (!pool) return out;
    Object.keys(pool).forEach(function (rar) {
      (pool[rar] || []).forEach(function (it) {
        if (it && it.kind === 'title') out[it.id] = it;
      });
    });
    return out;
  }

  function namePair(rec, cat) {
    var src = cat || rec || {};
    var n = src.name, d = src.desc;
    if (n && typeof n === 'object') {
      return { name: { en: String(n.en || n.vi || ''), vi: String(n.vi || n.en || '') },
        desc: d && typeof d === 'object'
          ? { en: String(d.en || d.vi || ''), vi: String(d.vi || d.en || '') }
          : { en: String(d || ''), vi: String(d || '') } };
    }
    var s = String(n || rec.id || '');
    var sd = String((d && d[lang()] || d) || '');
    return { name: { en: s, vi: s }, desc: { en: sd, vi: sd } };
  }

  // What the sender may put in a gift, read from the two systems that hold it.
  function ownedAtoms() {
    var sh = shop();
    if (!sh || typeof sh.stockOf !== 'function') return [];
    return elements().filter(function (el) {
      try { return sh.stockOf(el.z) > 0; } catch (e) { return false; }
    }).map(function (el) {
      return { z: el.z, sym: el.sym, name: el.name, label: elLabel(el), have: sh.stockOf(el.z), unit: sh.unitPrice ? sh.unitPrice(el.z) : 0 };
    });
  }

  function ownedTitles() {
    var ec = econ();
    if (!ec || typeof ec.inventory !== 'function') return [];
    var cat = titleCatalog();
    return ec.inventory().filter(function (x) {
      return x.kind === 'title' && x.id;
    }).map(function (x) {
      var c = cat[x.id];
      var pair = namePair(x, c);
      return {
        id: x.id, have: Math.max(1, Math.floor(x.n || 1)),
        name: pair.name, desc: pair.desc,
        rarity: (c && c.rarity) || x.rarity || 'common',
        icon: (c && c.icon) || x.icon || 'award',
        value: (c && c.value) || x.value || 0
      };
    });
  }

  // Anything arriving from a code is untrusted text, including a code this game
  // made that somebody edited on the way. Every row is rebuilt from scratch here,
  // so a payload cannot smuggle a negative count or a field a later screen
  // would paste into the page.
  function sanitizeItems(raw) {
    if (raw === undefined || raw === null || raw === '') return { ok: true, items: [] };
    if (!Array.isArray(raw)) return { ok: false, error: 'ePayload' };
    if (raw.length > MAX_ROWS) return { ok: false, error: 'eTooMany' };
    var cat = titleCatalog();
    var items = [];
    for (var i = 0; i < raw.length; i++) {
      var r = raw[i];
      if (!r || typeof r !== 'object') return { ok: false, error: 'ePayload' };
      var n = Math.floor(Number(r.n));
      if (!Number.isFinite(n) || n < 1) return { ok: false, error: 'ePayload' };
      if (r.k === 'atom') {
        var z = Math.floor(Number(r.z));
        if (!(z >= 1 && z <= MAX_EL_Z)) return { ok: false, error: 'ePayload' };
        if (n > MAX_ATOMS) return { ok: false, error: 'ePayload' };
        if (!elementByZ(z)) return { ok: false, error: 'ePayload' };
        items.push({ k: 'atom', z: z, n: n });
      } else if (r.k === 'title') {
        var id = String(r.id || '');
        if (!/^[A-Za-z0-9_-]{1,48}$/.test(id)) return { ok: false, error: 'ePayload' };
        if (n > MAX_TITLES) return { ok: false, error: 'ePayload' };
        var c = cat[id];
        var pair = namePair(c || { id: id, name: r.name, desc: r.desc }, c);
        items.push({
          k: 'title', id: id, n: n, name: pair.name, desc: pair.desc,
          rarity: String(r.rarity || (c && c.rarity) || 'common').slice(0, 16),
          icon: String(r.icon || (c && c.icon) || 'award').slice(0, 24),
          value: Math.max(0, Math.floor(Number(r.value || (c && c.value) || 0)) || 0)
        });
      } else {
        return { ok: false, error: 'ePayload' };
      }
    }
    return { ok: true, items: items };
  }

  // The row text the digest is taken over, and the same text a list of contents
  // shows: counts first, then what they are made of.
  function digestOf(items) {
    return (items || []).map(function (it) {
      return it.k === 'atom' ? 'a' + it.z + 'x' + it.n
        : 't' + it.id + 'x' + it.n + '#' + it.rarity + '#' + it.value;
    }).join(';');
  }

  function contentsValue(items) {
    var sh = shop();
    var v = 0;
    (items || []).forEach(function (it) {
      if (it.k === 'atom') v += (sh && sh.unitPrice ? sh.unitPrice(it.z) : 0) * it.n;
      else v += (it.value || 0) * it.n;
    });
    return v;
  }

  // Charging the sender is the same three-step dance as the stars: move only
  // what is really there, remember exactly what moved, and hand every bit of it
  // back if the upload fails. `sent` is what left, so a refund can never give
  // back a unit that was never taken.
  function chargeContents(items) {
    var sent = [];
    var sh = shop(), ec = econ();
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.k === 'atom') {
        if (!sh || typeof sh.shipStock !== 'function') {
          return { ok: false, error: 'eNoCrate', sent: sent };
        }
        var got = sh.shipStock(it.z, it.n);
        if (got !== it.n) {
          return {
            ok: false, error: 'eStockShort', sent: sent,
            params: { sym: (elementByZ(it.z) || { sym: it.z }).sym, have: got, want: it.n }
          };
        }
        sent.push(it);
      } else {
        if (!ec || typeof ec.takeCollectible !== 'function') {
          return { ok: false, error: 'eNoCollection', sent: sent };
        }
        var r = ec.takeCollectible(it.id, it.n);
        if (!r.ok || r.removed !== it.n) {
          return { ok: false, error: 'eTitleShort', sent: sent, params: { n: r.removed || 0 } };
        }
        sent.push(it);
      }
    }
    repaintEconomy();
    return { ok: true, sent: sent };
  }

  function refundContents(sent) {
    var sh = shop(), ec = econ();
    (sent || []).forEach(function (it) {
      if (it.k === 'atom') { if (sh && sh.grantStock) sh.grantStock(it.z, it.n); }
      else if (ec && ec.giveCollectible) ec.giveCollectible(it, it.n);
    });
    repaintEconomy();
  }

  // Paying the receiver: the same rows, delivered by the systems that own them.
  // Each row reports what actually landed, because a crate shelf that is already
  // full and a stranger who has changed their mind are different outcomes, and
  // the player is told which one they got.
  function deliverContents(items) {
    var sh = shop(), ec = econ();
    var out = [];
    (items || []).forEach(function (it) {
      var row = { k: it.k, n: it.n, want: it.n, got: 0 };
      if (it.k === 'atom') {
        row.z = it.z;
        row.sym = (elementByZ(it.z) || { sym: '?' + it.z }).sym;
        row.got = sh && sh.grantStock ? sh.grantStock(it.z, it.n) : 0;
      } else {
        row.id = it.id;
        row.name = it.name; row.desc = it.desc;
        row.rarity = it.rarity; row.icon = it.icon; row.value = it.value;
        row.got = ec && ec.giveCollectible ? ec.giveCollectible(it, it.n) : 0;
      }
      out.push(row);
    });
    repaintEconomy();
    return out;
  }

  // ------------------------------------------------------------ PrivateBin wire
  // PrivateBin's FormatV2, measured against the live instance: the ciphertext is
  // one base64 blob of `0x02 | 12-byte IV | message+tag`, and adata describes how
  // it was made. The server stores both without reading either, so the gift is
  // secret from the host — the key material never appears in the request at all.
  // It is the second half of the shareable code instead, and a `#` fragment is
  // something browsers never transmit, so the same secret survives being pasted
  // into a link.
  var PB_BLOB_VERSION = 2;

  function b64(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }

  function unb64(text) {
    var bin = atob(String(text));
    var out = new Uint8Array(bin.length);
    for (var j = 0; j < bin.length; j++) out[j] = bin.charCodeAt(j);
    return out;
  }

  // The shareable half is base64url with the padding dropped, so a code stays
  // typable and survives being pasted into a chat that autolinks it.
  function b64url(bytes) {
    return b64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function unb64url(text) {
    return unb64(String(text).replace(/-/g, '+').replace(/_/g, '/'));
  }

  function hasCrypto() {
    return !!(window.crypto && window.crypto.subtle && window.TextEncoder && window.TextDecoder);
  }

  async function pbKey(keyMaterial, salt, iterations, length) {
    var material = await window.crypto.subtle.importKey('raw', keyMaterial, 'PBKDF2', false, ['deriveKey']);
    return window.crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: salt, iterations: iterations || PB_KDF.iterations, hash: PB_KDF.hash },
      material,
      { name: 'AES-GCM', length: length || PB_KDF.keyLength },
      false, ['encrypt', 'decrypt']
    );
  }

  async function pbSeal(text) {
    var keyMaterial = window.crypto.getRandomValues(new Uint8Array(PB_KEY_BYTES));
    var salt = window.crypto.getRandomValues(new Uint8Array(8));
    var iv = window.crypto.getRandomValues(new Uint8Array(12));
    var secret = await pbKey(keyMaterial, salt);
    var sealed = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv }, secret, new TextEncoder().encode(text));
    var blob = new Uint8Array(13 + sealed.byteLength);
    blob[0] = PB_BLOB_VERSION;
    blob.set(iv, 1);
    blob.set(new Uint8Array(sealed), 13);
    return {
      key: b64url(keyMaterial),
      // Slot 0 is where PrivateBin keeps its attachment key; this game has no
      // attachment, so it carries the IV and the shape the service answers to.
      // Slot 1 is the salt the receiving side needs to rebuild the same key.
      body: {
        v: 2,
        adata: [[b64(iv), b64(salt), PB_KDF.iterations, PB_KDF.keyLength, PB_KDF.tagLength,
          'aes', 'gcm', 'none'], 'plaintext', 0, 1],
        ct: b64(blob)
      }
    };
  }

  // Returns the plaintext, or { error: <string key> } when the reply is not a
  // paste this game could have made. A decryption failure is reported as a
  // mistyped key rather than a dead code: those are different problems and the
  // player can only fix one of them.
  async function pbOpen(reply, key) {
    var a = reply && reply.adata && reply.adata[0];
    if (!a || typeof a[1] !== 'string' || typeof reply.ct !== 'string') {
      return { error: 'ePayload' };
    }
    try {
      var secret = await pbKey(unb64url(key), unb64(a[1]), Number(a[2]), Number(a[3]));
      var blob = unb64(reply.ct);
      var plain = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: blob.subarray(1, 13) }, secret, blob.subarray(13));
      return { text: new TextDecoder().decode(plain) };
    } catch (e) {
      return { error: 'eKey' };
    }
  }

  function buildPayload(stars, expMs, items) {
    var exp = toUtcStamp(new Date(expMs));
    var giftId = randomId();
    var list = items || [];
    return {
      app: APP_ID, kind: KIND, v: VERSION,
      stars: stars, exp: exp, giftId: giftId,
      items: list, sig: seal(stars, exp, giftId, digestOf(list))
    };
  }

  function verifyPayload(text) {
    var p;
    try { p = JSON.parse(text); } catch (e) { return { ok: false, error: 'ePayload' }; }
    if (!p || typeof p !== 'object') return { ok: false, error: 'ePayload' };
    if (p.app !== APP_ID || p.kind !== KIND) return { ok: false, error: 'ePayload' };
    var modern = p.v === VERSION;
    if (!modern && p.v !== OLDEST_READABLE) return { ok: false, error: 'ePayload' };
    var stars = Math.floor(Number(p.stars));
    if (!Number.isFinite(stars) || stars < 0 || stars > MAX_GIFT) return { ok: false, error: 'ePayload' };
    var expMs = fromUtcStamp(p.exp);
    if (!Number.isFinite(expMs)) return { ok: false, error: 'ePayload' };
    if (expMs <= Date.now()) return { ok: false, error: 'eExpired' };
    if (typeof p.giftId !== 'string' || !p.giftId || typeof p.sig !== 'string') {
      return { ok: false, error: 'ePayload' };
    }
    var clean = modern ? sanitizeItems(p.items) : { ok: true, items: [] };
    if (!clean.ok) return { ok: false, error: clean.error };
    // Stars alone used to have to clear MIN_GIFT; a code that carries a present
    // is allowed to carry no stars at all, and one that carries neither is not a
    // gift, so it is refused rather than opened for nothing.
    if (!clean.items.length && stars < MIN_GIFT) return { ok: false, error: 'ePayload' };
    if (p.sig !== seal(stars, p.exp, p.giftId, digestOf(clean.items))) {
      return { ok: false, error: 'ePayload' };
    }
    return { ok: true, stars: stars, expMs: expMs, giftId: p.giftId, items: clean.items };
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

  // The shareable string, `PB-<paste id>-<key>`, so one pasted line tells the
  // game both where to look for the gift and how to open it.
  function shareCode(id, key) { return 'PB-' + id + '-' + key; }

  // The paste id is hex and case does not matter to the service; the key is
  // base64url and changing one letter breaks the decryption, so only the id is
  // normalised here and the registry key is built from the same two halves.
  function pbEntry(id, key) {
    var lower = String(id).toLowerCase();
    return { id: lower, key: key, code: shareCode(lower, key) };
  }

  function parseCode(input) {
    var s = String(input == null ? '' : input).trim();
    if (!s) return null;
    var m = s.match(PB_CODE_RE);
    if (m) return pbEntry(m[1], m[2]);
    m = s.match(PB_URL_RE);
    if (m) return pbEntry(m[1], m[2]);
    return null;
  }

  function wholeStars(raw) {
    var n = Math.floor(Number(raw));
    return Number.isFinite(n) ? n : null;
  }

  function validateGift(n, expMs, bal, items) {
    var has = items && items.length;
    // 0 stars is only a valid amount when the gift carries something else;
    // below the minimum but not zero is a typo, and it is reported as one.
    if (n === null || n < 0 || (n > 0 && (n < MIN_GIFT || n > MAX_GIFT)) || (!has && n < MIN_GIFT)) {
      return { error: 'eAmount', params: { min: MIN_GIFT, max: MAX_GIFT } };
    }
    if (!Number.isFinite(expMs)) return { error: 'eExpiryPast' };
    var life = expMs - Date.now();
    if (!(life > 0)) return { error: 'eExpiryPast' };
    if (life > MAX_LIFE_MS) {
      return { error: 'eExpiryFar', params: { days: Math.round(MAX_LIFE_MS / 86400000) } };
    }
    if (n > bal) return { error: 'eBalance', params: { n: bal } };
    if (items && items.length > MAX_ROWS) return { error: 'eTooMany', params: { max: MAX_ROWS } };
    return null;
  }

  // ------------------------------------------------------------------ flows
  // The gift is charged before the request goes out, so every failure path that
  // follows has to hand the stars back.

  // PrivateBin cannot be bought an arbitrary instant: it takes one of its own
  // expiry tokens, and answers an unknown one by quietly using its default
  // instead of refusing. So the requested moment is snapped to the nearest tier
  // the instance offers, and the gift is stamped with the lifetime that was
  // actually bought rather than the one that was asked for.
  function tierFor(expMs) {
    var life = expMs - Date.now();
    var best = null, bestErr = Infinity;
    Object.keys(PB_TIERS).forEach(function (k) {
      var err = Math.abs(Number(k) - life);
      if (err < bestErr) { bestErr = err; best = Number(k); }
    });
    return best === null ? null : { ms: best, token: PB_TIERS[best] };
  }

  // PrivateBin reports API errors as HTTP 200 with `{"status":1,…}`, so the
  // status code tells nothing and the message has to be read and repeated. The
  // per-connection post limit is the one a player hits by gifting twice in a row.
  function privatebinError(reply) {
    var msg = typeof reply.message === 'string' ? reply.message : '';
    var m = msg.match(/wait (\d+) seconds?/i);
    if (m) return { error: 'eHostWait', params: { seconds: m[1] } };
    if (/does not exist|expired|deleted/i.test(msg)) return { error: 'eExpired' };
    return { error: 'eHostMsg', params: { message: msg || ('status ' + reply.status) } };
  }

  async function uploadPrivatebin(payload, tier) {
    if (!hasCrypto()) return { ok: false, error: 'eNoCrypto' };
    var sealed = await pbSeal(JSON.stringify(payload));
    var res = await fetch(PB_BASE, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'JSONHttpRequest',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        v: sealed.body.v,
        adata: sealed.body.adata,
        ct: sealed.body.ct,
        meta: { expire: tier }
      })
    });
    if (res.status === 429) return { ok: false, error: 'eRate' };
    var reply = null;
    try { reply = await res.json(); } catch (e) { return { ok: false, error: 'eBadReply' }; }
    if (!res.ok || !reply || typeof reply.status !== 'number') {
      return { ok: false, error: 'eServer', params: { status: res.status } };
    }
    if (reply.status !== 0) {
      var bad = privatebinError(reply);
      return { ok: false, error: bad.error, params: bad.params };
    }
    // Trust the id the service chose over any guess of ours: the code the player
    // gets must be the one that resolves.
    var id = String(reply.id || '');
    if (!PB_ID_RE.test(id)) return { ok: false, error: 'eBadReply' };
    return {
      ok: true,
      id: id,
      key: sealed.key,
      code: shareCode(id, sealed.key),
      url: PB_BASE + '?' + id + '#' + sealed.key
    };
  }

  async function createGift(stars, expMs, items, onStep) {
    if (busy) return { ok: false, error: 'eBusy' };
    var n = wholeStars(stars);
    // The rows the dialog assembled are rebuilt through the same sanitizer the
    // receiving side uses, so what gets sealed, what gets charged and what gets
    // paid out are provably the same list.
    var clean = sanitizeItems(items || []);
    if (!clean.ok) return { ok: false, error: clean.error, params: { max: MAX_ROWS } };
    var bad = validateGift(n, expMs, balance(), clean.items);
    if (bad) return { ok: false, error: bad.error, params: bad.params };
    if (expMs - Date.now() < MIN_LIFE_MS) expMs = Date.now() + MIN_LIFE_MS;
    var tier = tierFor(expMs);
    expMs = Date.now() + tier.ms;

    var payload = buildPayload(n, expMs, clean.items);
    if (n > 0 && !spendStars(n)) {
      if (n > 0) giveStars(n);
      return { ok: false, error: 'eBalance', params: { n: balance() } };
    }
    var charged = chargeContents(clean.items);
    if (!charged.ok) {
      if (n > 0) giveStars(n);
      refundContents(charged.sent);
      return {
        ok: false, error: charged.error, params: charged.params,
        refunded: true, refundedStars: n > 0, refundedContents: charged.sent.length > 0
      };
    }
    if (onStep) onStep('debit');

    busy = true;
    try {
      if (onStep) onStep('upload');
      var made = await uploadPrivatebin(payload, tier.token);
      if (!made.ok) return fail(n, charged.sent, made.error, made.params);
      if (onStep) onStep('verify');
      var st = readState();
      st.sent[made.code] = { stars: n, at: Date.now(), exp: expMs, items: clean.items };
      writeState(st);
      // The upload is itself the proof the service is reachable, so the status
      // row says that and no round-trip time it did not measure. The next real
      // probe — dialog reopen, or the player pressing Check — replaces it.
      lastProbe = { state: 'online', status: 200, ms: null, at: Date.now() };
      if (onStep) onStep('live');
      return { ok: true, code: made.code, url: made.url, stars: n, expMs: expMs, items: clean.items };
    } catch (e) {
      return fail(n, charged.sent, 'eNetwork');
    } finally {
      busy = false;
    }
  }

  // Nothing was delivered, so nothing may stay charged: the stars go back the way
  // they left and every shipped unit of stock and taken title comes back too.
  function fail(n, sent, error, params) {
    giveStars(n);
    refundContents(sent);
    return {
      ok: false, error: error, params: params, refunded: true,
      refundedStars: n > 0, refundedContents: (sent || []).length > 0
    };
  }

  // The read URL is also the only way to ask the service what it holds — and for
  // a burn-after-read paste, asking is spending.
  function giftUrl(c) { return PB_BASE + '?' + c.id; }

  async function readGift(c) {
    if (!hasCrypto()) return { ok: false, error: 'eNoCrypto' };
    var res = await fetch(giftUrl(c), { headers: PB_JSON, cache: 'no-store' });
    if (res.status === 429) return { ok: false, error: 'eRate' };
    var reply = null;
    try { reply = await res.json(); } catch (e) { return { ok: false, error: 'eBadReply' }; }
    if (!reply || typeof reply.status !== 'number') {
      return { ok: false, error: 'eBadReply' };
    }
    if (reply.status !== 0) {
      var bad = privatebinError(reply);
      return { ok: false, error: bad.error, params: bad.params };
    }
    var opened = await pbOpen(reply, c.key);
    if (opened.error) return { ok: false, error: opened.error };
    return { ok: true, text: opened.text };
  }

  async function redeemCode(input) {
    if (busy) return { ok: false, error: 'eBusy' };
    var c = parseCode(input);
    if (!c) return { ok: false, error: 'eCodeFormat' };
    var st = readState();
    if (st.redeemed[c.code]) return { ok: false, error: 'eUsed', code: c.code };
    if (st.sent[c.code]) return { ok: false, error: 'eSelf', code: c.code };

    busy = true;
    try {
      var read = await readGift(c);
      if (!read.ok) return { ok: false, error: read.error, params: read.params, code: c.code };
      var v = verifyPayload(read.text);
      if (!v.ok) {
        // The paste was opened whether or not it turned out to be a gift, so the
        // code is gone either way. Saying so is the only honest thing left to do.
        return { ok: false, error: v.error, code: c.code, burned: true };
      }
      // Spend the code before paying: two clicks on one code must not buy two
      // gifts, and a half-finished payout is worse than a refused one.
      st = readState();
      if (st.redeemed[c.code]) return { ok: false, error: 'eUsed', code: c.code };
      st.redeemed[c.code] = { stars: v.stars, at: Date.now(), exp: v.expMs, items: v.items };
      writeState(st);
      var got = giveStars(v.stars);
      var delivered = deliverContents(v.items);
      repaintEconomy();
      return {
        ok: true, code: c.code, stars: v.stars, credited: got,
        expMs: v.expMs, balance: balance(), truncated: got < v.stars,
        items: v.items, delivered: delivered
      };
    } catch (e) {
      return { ok: false, error: 'eNetwork', code: c.code };
    } finally {
      busy = false;
    }
  }

  // What the status rows are built from, and deliberately not a request: the one
  // way to ask the service about a code spends it, so a code this device has
  // never opened is only ever reported as held, and nothing else is claimed.
  async function statusOf(input) {
    var c = parseCode(input);
    if (!c) return { state: 'bad', error: 'eCodeFormat' };
    var st = readState();
    if (st.redeemed[c.code]) return { state: 'read', code: c.code, entry: st.redeemed[c.code] };
    if (st.sent[c.code]) return { state: 'self', code: c.code, entry: st.sent[c.code] };
    return { state: 'held', code: c.code };
  }

  // ------------------------------------------------------------------- status
  // A probe never uploads anything and never spends a gift: it asks the service
  // for a record that cannot exist, an id of all zeroes. A readable answer,
  // whatever status it carries, is the exact thing the game needs to know,
  // because a 403 or a 503 the page cannot read is just as useless as a network
  // failure.
  async function probeStatus(force) {
    if (!force && lastProbe && Date.now() - lastProbe.at < PROBE_MS) return lastProbe;
    if (probeInFlight) return probeInFlight;
    probeInFlight = (async function () {
      var t0 = Date.now();
      try {
        var res = await fetch(PB_BASE + '?0000000000000000', { headers: PB_JSON, cache: 'no-store' });
        lastProbe = {
          state: res.status === 429 ? 'busy' : 'online',
          status: res.status, ms: Date.now() - t0, at: Date.now()
        };
      } catch (e) {
        lastProbe = {
          state: 'offline', status: 0,
          ms: Date.now() - t0, at: Date.now(), detail: (e && e.message) || 'blocked'
        };
      }
      probeInFlight = null;
      return lastProbe;
    })();
    return probeInFlight;
  }

  function stateText(p) {
    if (!p) return L('stUnknown');
    if (p.state === 'online') return p.ms == null ? L('stOnlineNow') : L('stOnline', { ms: p.ms });
    if (p.state === 'busy') return L('stBusy');
    return L('stOffline');
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
    // Status rows carry three parts — label, reading, action — so the value takes
    // the slack and hugs the button instead of floating in the middle of the row.
    '.sg-live{display:flex;align-items:center;justify-content:flex-end;gap:6px;flex:1;min-width:0;}',
    '.sg-live span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.sg-dot{width:8px;height:8px;border-radius:50%;background:var(--muted);flex:none;}',
    '.sg-dot.up{background:#25d07a;box-shadow:0 0 7px rgba(37,208,122,.6);}',
    '.sg-dot.warn{background:#ffb02e;box-shadow:0 0 7px rgba(255,176,46,.5);}',
    '.sg-dot.down{background:var(--err);box-shadow:0 0 7px rgba(255,51,102,.5);}',
    '.sg-dot.wait{background:var(--muted);animation:sg-pulse 1.1s ease-in-out infinite;}',
    '@keyframes sg-pulse{0%,100%{opacity:.2}50%{opacity:1}}',
    '.sg-mini{flex:none;font:inherit;font-size:9.5px;font-weight:700;letter-spacing:.4px;',
    '  text-transform:uppercase;color:var(--sg-ink);background:transparent;',
    '  border:1px solid var(--border);border-radius:6px;padding:3px 7px;cursor:pointer;}',
    '.sg-mini:hover{border-color:var(--accent);color:var(--text);}',
    '.sg-mini:disabled{opacity:.45;cursor:not-allowed;}',
    // The contents picker: a typed element, a count, and the staged rows shown as
    // removable chips. It is deliberately the same visual family as the quick
    // star buttons so the dialog reads as one feature rather than two.
    '.sg-pick{display:flex;gap:6px;align-items:stretch;}',
    '.sg-pick .sg-input{flex:1;min-width:0;}',
    '.sg-pick .sg-input.num{flex:0 0 72px;}',
    '.sg-pick .sg-mini{align-self:center;}',
    '.sg-chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px;}',
    '.sg-chip{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;',
    '  border:1px solid var(--accent);border-radius:8px;padding:4px 6px;',
    '  background:var(--accent-soft);color:var(--text);}',
    '.sg-chip button{border:0;background:transparent;color:var(--sg-sub);cursor:pointer;',
    '  font:inherit;font-size:14px;line-height:1;padding:0 1px;}',
    '.sg-chip button:hover{color:var(--err);}',
    '.sg-empty{font-size:10px;line-height:1.45;color:var(--sg-sub);margin:6px 0 0;}',
    '.sg-empty[hidden]{display:none;}',
    '.sg-sum{display:flex;align-items:baseline;justify-content:space-between;gap:10px;',
    '  font-size:10px;color:var(--sg-sub);margin-top:8px;}',
    '.sg-sum b{font-size:11px;font-weight:800;color:var(--text);font-variant-numeric:tabular-nums;',
    '  text-align:right;}',
    '.sg-list{display:flex;flex-direction:column;gap:4px;margin-top:2px;}',
    '.sg-list div{display:flex;align-items:baseline;justify-content:space-between;gap:10px;',
    '  font-size:11px;color:var(--sg-sub);}',
    '.sg-list b{font-size:11.5px;font-weight:800;color:var(--text);text-align:right;',
    '  font-variant-numeric:tabular-nums;}',
    '.sg-sec[hidden]{display:none;}',
    // An explicit display beats the UA [hidden] rule, so the step line needs its
    // own off state or it stays visible with no text.
    '.sg-step{display:flex;align-items:center;gap:7px;font-size:10.5px;color:var(--sg-sub);',
    '  margin:11px 0 0;}',
    '.sg-step[hidden]{display:none;}',
    '@media (max-width:640px){.sg-card{width:min(430px,96vw);padding:13px 12px 11px;border-radius:14px;}',
    '  .sg-h{font-size:13px;}.sg-intro{font-size:10px;}.sg-label{font-size:9.5px;margin:8px 0 4px;}',
    '  .sg-input{font-size:12px;padding:7px 9px;}.sg-code input{font-size:14px;padding:8px;}',
    '  .sg-btn{font-size:11.5px;min-height:31px;padding:7px 9px;}.sg-row{font-size:10px;}',
    '  .sg-row b{font-size:11px;}.sg-note,.sg-hint{font-size:9.5px;}',
    '  .sg-mini{font-size:9px;padding:3px 6px;}.sg-step{font-size:10px;}',
    '  .sg-pick .sg-input.num{flex:0 0 58px;}.sg-chip{font-size:10px;}.sg-list div{font-size:10px;}',
    // iOS zooms the page when a focused field is under 16px; these are the typed ones.
    '  #sg-amount,#sg-el-in,#sg-el-n,#sg-code-in{font-size:16px;padding:9px 10px;}}'
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

  // ---------------------------------------------------------- contents picker
  // The staged rows live in here rather than in the DOM, because the dialog is
  // rebuilt whenever the language or the theme changes while the gift the player
  // is assembling has to survive that. Nothing is taken from the crate or the
  // collection at this point — staging is only a list of intentions, and the
  // charge happens once, inside createGift, immediately before the upload.
  var staged = [];

  function stagedIndex(kind, key) {
    for (var i = 0; i < staged.length; i++) {
      if (staged[i].k !== kind) continue;
      if (kind === 'atom' ? staged[i].z === key : staged[i].id === key) return i;
    }
    return -1;
  }

  function titleText(row) {
    var pair = row && row.name;
    if (!pair) return row ? String(row.id || '') : '';
    return String(pair[lang()] || pair.en || pair.vi || '');
  }

  // A typed element is matched by symbol first, because that is what the field
  // asks for, then by the exact name in either language, then by a name prefix so
  // the datalist and typing "oxi" both land on Oxygen. Only what the crate
  // actually holds can be found: an element the player has none of is not a gift.
  function findOwned(text) {
    var s = String(text || '').trim().toLowerCase();
    if (!s) return null;
    var owned = ownedAtoms(), i;
    for (i = 0; i < owned.length; i++) if (String(owned[i].sym).toLowerCase() === s) return owned[i];
    for (i = 0; i < owned.length; i++) {
      if (String(owned[i].label || '').toLowerCase() === s) return owned[i];
      if (String(owned[i].name || '').toLowerCase() === s) return owned[i];
    }
    for (i = 0; i < owned.length; i++) {
      var nm = String(owned[i].name || '').toLowerCase();
      if (nm.length > s.length && nm.indexOf(s) === 0) return owned[i];
    }
    return null;
  }

  function addAtomRow(text, want) {
    var own = findOwned(text);
    if (!own) return { error: 'eElement' };
    var n = Math.floor(Number(want));
    if (!Number.isFinite(n) || n < 1) n = 1;
    var at = stagedIndex('atom', own.z);
    var total = (at < 0 ? 0 : staged[at].n) + n;
    // The same element asked for twice is one bigger row, not two rows: MAX_ROWS
    // is there to keep a code small, and repeating a line would waste it.
    var cap = Math.min(own.have, MAX_ATOMS);
    if (total > cap) {
      return { error: 'eStockShort', params: { have: cap, sym: own.sym } };
    }
    if (at < 0) {
      if (staged.length >= MAX_ROWS) return { error: 'eTooMany', params: { max: MAX_ROWS } };
      staged.push({ k: 'atom', z: own.z, n: total });
    } else {
      staged[at].n = total;
    }
    return { ok: true };
  }

  function dropRow(index) {
    if (!(index >= 0 && index < staged.length)) return;
    staged.splice(index, 1);
  }

  // A title is a one-of-a-kind thing in a collection, so clicking it stages it and
  // clicking it again takes it back. The count a row can carry is checked here
  // even though the picker only ever asks for one, because the same rule has to
  // hold for a code somebody builds by hand.
  function addTitleRow(id) {
    var at = stagedIndex('title', id);
    if (at >= 0) { staged.splice(at, 1); return { ok: true }; }
    var rec = null;
    ownedTitles().forEach(function (t) { if (t.id === id) rec = t; });
    if (!rec) return { error: 'eTitleShort', params: { n: 0 } };
    if (staged.length >= MAX_ROWS) return { error: 'eTooMany', params: { max: MAX_ROWS } };
    staged.push({
      k: 'title', id: rec.id, n: 1, name: rec.name, desc: rec.desc,
      rarity: rec.rarity, icon: rec.icon, value: rec.value
    });
    return { ok: true };
  }

  function renderContents() {
    if (!refs || !refs.gift) return;
    var card = refs.gift.card;
    var owned = ownedAtoms();
    var dl = q(card, '#sg-el-dl');
    dl.innerHTML = '';
    owned.forEach(function (o) {
      var opt = make('option');
      opt.value = o.sym;
      opt.label = o.label + ' · ' + L('elHave', { n: o.have });
      dl.appendChild(opt);
    });
    q(card, '#sg-el-none').hidden = owned.length > 0;

    var titles = ownedTitles();
    var tbox = q(card, '#sg-title-list');
    tbox.innerHTML = '';
    titles.forEach(function (t) {
      var b = make('button', null, esc(titleText(t)));
      b.type = 'button';
      b.dataset.title = t.id;
      if (stagedIndex('title', t.id) >= 0) b.classList.add('sel');
      tbox.appendChild(b);
    });
    q(card, '#sg-title-none').hidden = titles.length > 0;

    var chips = q(card, '#sg-chips');
    chips.innerHTML = '';
    staged.forEach(function (row, i) {
      var chip = make('span', 'sg-chip');
      chip.appendChild(make('span', null, esc(rowLabel(row))));
      var x = make('button', null, '&times;');
      x.type = 'button';
      x.dataset.drop = String(i);
      chip.appendChild(x);
      chips.appendChild(chip);
    });
    q(card, '#sg-contents-empty').hidden = staged.length > 0;
    var v = contentsValue(staged);
    q(card, '#sg-contents-val').textContent = staged.length && v > 0 ? L('contentsValue', { n: v }) : '';
  }

  // One line per staged/gifted row, in the language of the screen showing it.
  // Both the sender's code dialog and the receiver's result use this, so the two
  // sides of one gift cannot drift into describing it differently.
  function rowLabel(row) {
    if (row.k === 'atom') {
      var el = elementByZ(row.z) || {};
      return L('gotAtom', { n: row.n, sym: row.sym || el.sym || row.z });
    }
    var name = titleText(row);
    return L('gotTitle', { name: name }) + (row.n > 1 ? ' ×' + row.n : '');
  }

  function fillList(box, rows) {
    box.innerHTML = '';
    (rows || []).forEach(function (text) {
      var div = make('div');
      div.appendChild(make('span', null, esc(text)));
      box.appendChild(div);
    });
  }

  // One place decides what happens after a row is staged or dropped: a rejection
  // is said out loud, a success clears the message and repaints everything that
  // reads the staged list.
  function stageResult(res) {
    var card = refs.gift.card;
    if (res && res.error) {
      say(q(card, '#sg-gift-msg'), 'err', L(res.error, res.params));
      return false;
    }
    quiet(q(card, '#sg-gift-msg'));
    syncGift();
    return true;
  }

  function addFromForm() {
    var card = refs.gift.card;
    var field = q(card, '#sg-el-in');
    var qty = q(card, '#sg-el-n');
    if (!stageResult(addAtomRow(field.value, qty.value))) return;
    field.value = '';
    qty.value = '1';
    field.focus();
  }

  function buildGift() {
    var m = dialog('sg-gift-modal');
    m.card.innerHTML =
      '<button class="sg-x" type="button" data-sg-close aria-label="close">&times;</button>' +
      '<h3 class="sg-h" data-t="giftTitle"></h3>' +
      '<p class="sg-intro" data-t="giftIntro"></p>' +
      '<label class="sg-label" for="sg-amount" data-t="amount"></label>' +
      '<div class="sg-field">' +
      '  <input class="sg-input" id="sg-amount" type="number" min="0" max="' + MAX_GIFT + '" step="50" inputmode="numeric" value="' + MIN_GIFT + '" />' +
      '  <span class="sg-unit">★</span>' +
      '</div>' +
      '<div class="sg-quick" id="sg-quick"></div>' +
      '<p class="sg-hint" data-t="amountHint"></p>' +
      '<div class="sg-sec">' +
      '  <div class="sg-sec-title" data-t="contents"></div>' +
      '  <label class="sg-label" for="sg-el-in" data-t="elements"></label>' +
      '  <div class="sg-pick">' +
      '    <input class="sg-input" id="sg-el-in" type="text" autocomplete="off" spellcheck="false" list="sg-el-dl" />' +
      '    <input class="sg-input num" id="sg-el-n" type="number" min="1" step="1" inputmode="numeric" value="1" />' +
      '    <button class="sg-mini" type="button" id="sg-el-add" data-t="elAdd"></button>' +
      '    <datalist id="sg-el-dl"></datalist>' +
      '  </div>' +
      '  <p class="sg-empty" id="sg-el-none" data-t="elNone" hidden></p>' +
      '  <label class="sg-label" data-t="titles"></label>' +
      '  <div class="sg-quick" id="sg-title-list"></div>' +
      '  <p class="sg-empty" id="sg-title-none" data-t="titlesNone" hidden></p>' +
      '  <div class="sg-chips" id="sg-chips"></div>' +
      '  <div class="sg-sum"><span id="sg-contents-empty" data-t="contentsEmpty"></span>' +
      '  <b id="sg-contents-val"></b></div>' +
      '</div>' +
      '<div class="sg-row"><span data-t="statusRow"></span><b class="sg-live">' +
      '  <i class="sg-dot" id="sg-dot"></i><span id="sg-status-txt"></span></b>' +
      '  <button class="sg-mini" type="button" id="sg-probe" data-t="check"></button>' +
      '</div>' +
      '<label class="sg-label" for="sg-expiry" data-t="expiry"></label>' +
      '<select class="sg-input" id="sg-expiry"></select>' +
      '<div class="sg-row"><span data-t="balanceRow"></span><b id="sg-balance-row">0 ★</b></div>' +
      '<div class="sg-row"><span data-t="afterRow"></span><b id="sg-after-row">0 ★</b></div>' +
      '<div class="sg-row"><span data-t="expWhen"></span><b id="sg-exp-row">—</b></div>' +
      '<p class="sg-step" id="sg-step" hidden></p>' +
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

    q(m.card, '#sg-create').addEventListener('click', submitGift);
    q(m.card, '#sg-amount').addEventListener('input', function () { armed = false; syncGift(); });
    q(m.card, '#sg-probe').addEventListener('click', function () { refreshProbe(true); });
    sel.addEventListener('change', syncGift);
    q(m.card, '#sg-el-add').addEventListener('click', addFromForm);
    ['#sg-el-in', '#sg-el-n'].forEach(function (id) {
      q(m.card, id).addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        e.stopPropagation();
        addFromForm();
      });
    });
    q(m.card, '#sg-title-list').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-title]') : null;
      if (!b) return;
      stageResult(addTitleRow(b.dataset.title));
    });
    q(m.card, '#sg-chips').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-drop]') : null;
      if (!b) return;
      dropRow(Number(b.dataset.drop));
      stageResult({ ok: true });
    });
    wireClose(m);
    return m;
  }

  function setExpiryOptions() {
    var sel = q(refs.gift.card, '#sg-expiry');
    sel.innerHTML = '';
    PB_PRESETS.forEach(function (p) {
      var o = make('option');
      o.value = String(sel.options.length);
      o.textContent = L(p.key);
      sel.appendChild(o);
    });
    sel.value = String(giftDefaultIndex());
  }

  function giftDefaultIndex() {
    for (var i = 0; i < PB_PRESETS.length; i++) {
      if (PB_PRESETS[i].ms === 24 * 60 * 60 * 1000) return i;
    }
    return 0;
  }

  function currentPreset() {
    var i = parseInt(q(refs.gift.card, '#sg-expiry').value, 10);
    if (!(i >= 0 && i < PB_PRESETS.length)) i = giftDefaultIndex();
    return PB_PRESETS[i];
  }

  function chosenExpiry() { return Date.now() + currentPreset().ms; }

  function paintProbe(p) {
    if (!refs) return;
    var card = refs.gift.card;
    var dot = q(card, '#sg-dot');
    var txt = q(card, '#sg-status-txt');
    if (!p) {
      dot.className = 'sg-dot';
      txt.textContent = L('stUnknown');
      return;
    }
    dot.className = 'sg-dot ' + (p.state === 'online' ? 'up' : p.state === 'busy' ? 'warn' : 'down');
    txt.textContent = stateText(p) + ' ' + L('stAt', { when: timeOfDay(p.at) });
  }

  function refreshProbe(force) {
    if (!refs) return;
    paintProbe(lastProbe);
    var btn = q(refs.gift.card, '#sg-probe');
    btn.disabled = true;
    probeStatus(force).then(function (p) {
      btn.disabled = false;
      paintProbe(p);
    }, function () { btn.disabled = false; });
  }

  function stepLine(which) {
    var node = refs ? q(refs.gift.card, '#sg-step') : null;
    if (!node) return;
    if (!which) { node.hidden = true; node.textContent = ''; return; }
    var map = { debit: 'stepDebit', upload: 'stepUpload', verify: 'stepVerify', live: 'stepLive' };
    node.hidden = false;
    node.textContent = L(map[which]);
  }

  function syncGift() {
    if (!refs) return;
    var card = refs.gift.card;
    renderContents();
    var n = wholeStars(q(card, '#sg-amount').value) || 0;
    var bal = balance();
    q(card, '#sg-balance-row').textContent = bal + ' ★';
    var after = q(card, '#sg-after-row');
    after.textContent = (bal - n) + ' ★';
    after.className = n > bal ? 'neg' : '';
    var exp = chosenExpiry();
    var expEl = q(card, '#sg-exp-row');
    expEl.textContent = humanDate(exp);
    expEl.className = exp <= Date.now() ? 'neg' : '';
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
    var bad = validateGift(amount, exp, balance(), staged);
    if (bad) { say(box, 'err', L(bad.error, bad.params)); return; }

    // A probe that could not reach the service is worth saying out loud before
    // the stars move, but the probe can be wrong (a browser extension, a stale
    // cache), so the player who trusts it gets one more click instead of a dead
    // end.
    if (lastProbe && lastProbe.state === 'offline' && !armed) {
      armed = true;
      say(box, 'err', L('downWarn'));
      btn.textContent = L('giftAnyway');
      return;
    }
    armed = false;

    btn.disabled = true;
    btn.textContent = L('creating');
    var r = await createGift(amount, exp, staged, stepLine);
    btn.disabled = false;
    btn.textContent = L('create');
    stepLine(null);
    if (!r.ok) {
      // syncGift repaints the refunded balance and clears the message box, so it
      // has to run first or the reason for the failure is erased as it appears.
      syncGift();
      var back = [];
      if (r.refundedStars) back.push(L('refunded'));
      if (r.refundedContents) back.push(L('refundedContents'));
      say(box, 'err', L(r.error, r.params), back.join('\n'));
      refreshProbe(false);
      return;
    }
    hide(refs.gift.root);
    // The rows the code actually carries are the sanitized ones createGift
    // returns, not the ones the picker staged: after this point the two must not
    // be able to differ.
    staged = [];
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
      '<div class="sg-sec" id="sg-code-contents" hidden>' +
      '  <div class="sg-sec-title" data-t="codeContents"></div>' +
      '  <div class="sg-list" id="sg-code-list"></div>' +
      '</div>' +
      '<div class="sg-row"><span data-t="expiresAt"></span><b id="sg-code-exp">—</b></div>' +
      '<div class="sg-row"><span data-t="liveRow"></span><b class="sg-live">' +
      '  <i class="sg-dot" id="sg-live-dot"></i><span id="sg-live-txt">…</span></b>' +
      '  <button class="sg-mini" type="button" id="sg-live-re" data-t="recheck"></button>' +
      '</div>' +
      '<p class="sg-note" data-t="burnNote"></p>' +
      '<div class="sg-actions">' +
      '  <button class="sg-btn primary" type="button" data-sg-close data-t="done"></button>' +
      '</div>';
    q(m.card, '#sg-copy').addEventListener('click', function () {
      copyText(q(m.card, '#sg-code-out').value, q(m.card, '#sg-copy'));
    });
    q(m.card, '#sg-live-re').addEventListener('click', function () { checkLive(true); });
    wireClose(m);
    return m;
  }

  function showCode(r) {
    var card = refs.code.card;
    codeAt = r;
    q(card, '#sg-code-out').value = r.code;
    q(card, '#sg-code-url').textContent = r.url;
    q(card, '#sg-code-stars').textContent = r.stars + ' ★';
    q(card, '#sg-code-exp').textContent = humanDate(r.expMs);
    var items = r.items || [];
    var v = contentsValue(items);
    fillList(q(card, '#sg-code-list'), items.map(rowLabel).concat(
      v > 0 ? [L('contentsValue', { n: v })] : []));
    q(card, '#sg-code-contents').hidden = items.length === 0;
    show(refs.code.root);
    checkLive(false);
  }

  // What the code is, as far as this device can know without spending it: the
  // answer the ledger has, or the honest admission that a look would be a read.
  function checkLive(force) {
    var card = refs.code.card;
    var dot = q(card, '#sg-live-dot');
    var txt = q(card, '#sg-live-txt');
    var btn = q(card, '#sg-live-re');
    if (!codeAt) return;
    if (!force) {
      dot.className = 'sg-dot wait';
      txt.textContent = L('stProbing');
    }
    btn.disabled = true;
    statusOf(codeAt.code).then(function (s) {
      btn.disabled = false;
      var cls = 'sg-dot', text;
      if (s.state === 'self') { cls += ' up'; text = L('liveSelf'); }
      else if (s.state === 'read') { cls += ' warn'; text = L('liveRead'); }
      else if (s.state === 'held') { cls += ' up'; text = L('liveSpend'); }
      else { cls += ' warn'; text = L('liveBad'); }
      dot.className = cls;
      txt.textContent = text;
    }, function () {
      btn.disabled = false;
      dot.className = 'sg-dot warn';
      txt.textContent = L('liveBad');
    });
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

  // The receipt is written from what landed, not from what the code promised: a
  // shelf that was already full gives back fewer atoms than were sent, and the
  // player is told that number rather than the sender's.
  function deliveredLines(rows) {
    var out = [];
    (rows || []).forEach(function (d) {
      var label = d.k === 'atom'
        ? L('gotAtom', { n: d.got, sym: d.sym })
        : L('gotTitle', { name: titleText(d) }) + (d.got > 1 ? ' ×' + d.got : '');
      if (d.got < d.want) label += '\n  ' + L('partialWarn', { got: d.got, want: d.want });
      out.push(label);
    });
    return out;
  }

  async function submitRedeem() {
    var card = refs.redeem.card;
    var box = q(card, '#sg-redeem-msg');
    var btn = q(card, '#sg-redeem');
    var input = q(card, '#sg-code-in');
    quiet(box);
    var raw = input.value.trim();
    var parsed = parseCode(raw);
    if (!parsed) { say(box, 'err', L('eCodeFormat')); return; }
    btn.disabled = true;
    input.disabled = true;
    btn.textContent = L('checking');
    var r = await redeemCode(raw);
    btn.disabled = false;
    input.disabled = false;
    btn.textContent = L('redeem');
    if (!r.ok) {
      // A code that reached the service and was refused there is already
      // destroyed, so the player is told the gift is gone rather than left with
      // a retry that can only ever answer "does not exist".
      var spent = r.burned ? L('burnReadFailed') : '';
      say(box, 'err', L(r.error, r.params), spent);
      input.focus();
      return;
    }
    input.value = '';
    var items = r.items || [];
    var lines = deliveredLines(r.delivered);
    var empty = items.length > 0 && (r.delivered || []).every(function (d) {
      return !(d.got > 0);
    });
    var headline = r.credited > 0 ? L('credited', { n: r.credited }) : L('codeContents');
    var note = L('creditedNote', { code: r.code, stars: r.stars, when: humanDate(r.expMs) });
    if (r.truncated) note += '\n' + L('capWarn', { n: r.credited, stars: r.stars, cap: BALANCE_CAP });
    if (lines.length) note += '\n' + lines.join('\n');
    if (empty) note += '\n' + L('nothingWarn');
    note += '\n' + L('burnByRead');
    say(box, 'ok', headline, note);
    toast(headline);
    // The opening animation is decoration on top of a payout that has already
    // happened, so it is called through a hook that may be absent and must never
    // be able to fail the redeem.
    var cine = window.__mol3dGiftPack;
    if (typeof cine === 'function') {
      try { cine({ stars: r.credited, items: items, delivered: r.delivered }); } catch (e) { }
    }
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
      // The two fields of the element picker have no room for captions next to
      // them, so the text they need lives in the field itself and in its name.
      var elIn = q(m.card, '#sg-el-in');
      if (elIn) elIn.placeholder = L('elPh');
      var elN = q(m.card, '#sg-el-n');
      if (elN) { elN.setAttribute('aria-label', L('elQty')); elN.title = L('elQty'); }
      var sel = q(m.card, '#sg-expiry');
      if (sel) {
        Array.prototype.forEach.call(sel.options, function (o, i) {
          if (PB_PRESETS[i]) o.textContent = L(PB_PRESETS[i].key);
        });
      }
    });
    paintProbe(lastProbe);
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
    // The status row is the one part of the dialog that cannot be filled in
    // offline, so opening the dialog is what asks for it.
    refreshProbe(false);
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
    if (!codeAt) return false;
    closeAll();
    show(refs.code.root);
    checkLive(false);
    return true;
  }

  function mount() {
    if (!document.getElementById('btn-star-gift') || !document.getElementById('btn-star-codes')) return false;
    ensureStyles();
    refs = { gift: buildGift(), code: buildCode(), redeem: buildRedeem() };
    // Built after refs exist: setExpiryOptions reads the assembled dialogs.
    setExpiryOptions();
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
    try {
      mounted = mount();
    } catch (e) {
      mounted = false;
      // The retry would otherwise stack a second set of dialogs on the half
      // built first set, and every later lookup would hit the stale one.
      refs = null;
      ['sg-gift-modal', 'sg-code-modal', 'sg-redeem-modal'].forEach(function (id) {
        var n = document.getElementById(id);
        if (n) n.remove();
      });
      console.warn('Star gift:', e);
    }
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
    limits: { min: MIN_GIFT, max: MAX_GIFT, maxLifeDays: Math.round(MAX_LIFE_MS / 86400000), balanceCap: BALANCE_CAP },
    relay: {
      name: 'PrivateBin',
      base: PB_BASE,
      singleUse: true,
      maxLifeDays: Math.round(MAX_LIFE_MS / 86400000),
      hours: PB_PRESETS.map(function (x) { return x.ms / 3600000; }),
      tiers: Object.keys(PB_TIERS).map(Number),
      codeShape: 'PB-<16 hex id>-<22 char key>'
    },
    balance: balance,
    createGift: createGift,
    redeemCode: redeemCode,
    contents: {
      ownedAtoms: ownedAtoms,
      ownedTitles: ownedTitles,
      sanitize: sanitizeItems,
      value: contentsValue,
      label: rowLabel,
      staged: function () { return staged.slice(); },
      clear: function () { staged = []; },
      addAtom: addAtomRow,
      addTitle: addTitleRow
    },
    parseCode: parseCode,
    statusOf: statusOf,
    probe: probeStatus,
    validateGift: validateGift,
    buildPayload: buildPayload,
    verifyPayload: verifyPayload,
    toUtcStamp: toUtcStamp,
    fromUtcStamp: fromUtcStamp,
    seal: seal,
    canEncrypt: hasCrypto,
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
