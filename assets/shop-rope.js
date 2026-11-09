// Rope Shop - pull the cord to drop the supply shop
(function() {
  'use strict';

  // Above PCT_THRESHOLD stars, one-off features stop costing a fixed price and
  // instead cost PCT_RATE of the player's current star balance. Rate is
  // deliberately headroom-heavy so late-game stars keep a use without becoming
  // infinite money.
  //
  // Atoms and gun ammo are NOT percentage-priced, on purpose: they are
  // denominations, not goods. A molecule's summon price is the sum of its atom
  // prices, so once the unit price depends on the balance the same molecule costs
  // a different amount at every click and nothing adds up any more. The dynamic
  // banner says so instead of pretending it applies everywhere.
  var PCT_THRESHOLD = 2000;
  var PCT_RATE = 0.1;

  // v3 is the stock ledger: elements are no longer unlocked once for all, they are
  // bought as atoms and spent as atoms. v2 (permanent unlocks) and v1 are folded in
  // on load - the features carry over untouched and the atoms that unlock used to
  // grant come back as the starter crate, so nobody loses what they paid for.
  var SAVE_KEY = 'mol3d.shop.v3';
  var LEGACY_SAVE_KEYS = ['mol3d.shop.v2', 'mol3d.shop.v1'];

  // One atom costs its period base times a rarity factor for its chemical
  // family. The period boundaries are the shells themselves (2, 8, 8, 18, 18, 32,
  // 32 elements), so nothing is priced by hand; the family factor is what the old
  // flat-per-period ladder had wrong - it charged sodium and gold the same, and
  // made the CHNOPS elements that every real molecule is built from pay the same
  // as a lump of iron. Reading the registry's own `cat` field keeps the table
  // short and covers all 118 elements plus anything the gun creates.
  var PERIOD_MAX_Z = [2, 10, 18, 36, 54, 86, 118];
  var PERIOD_BASE = [2, 3, 4, 6, 9, 13, 20];
  var CAT_FACTOR = {
    nonmetal: 1, metalloid: 1, halogen: 1,
    alkali: 2, alkaline: 2, post: 2,
    transition: 3, noble: 3,
    lanthanide: 4, actinide: 4
  };
  var DEFAULT_CAT_FACTOR = 2;
  // A new species pays under half of what its atoms cost on the shelf, for every
  // element individually: discovering is income, buying is a cost, and the two
  // must never cancel out into a farm. starsOf() clamps to that ceiling itself,
  // so this ladder can be retuned without re-checking 118 pairs by hand.
  var PERIOD_STARS = [1, 2, 3, 5, 8, 11, 16];

  var AMMO_PRICE = 1;
  var AMMO = [
    { id: 'proton', icon: 'plus', stars: 1 },
    { id: 'neutron', icon: 'minus', stars: 1 }
  ];

  // A brand new player has nothing to place and nothing to discover with, so the
  // first run opens a crate: the four elements the whole early game is built from.
  var STARTER_KIT = [
    { z: 1, n: 16 },
    { z: 6, n: 10 },
    { z: 7, n: 8 },
    { z: 8, n: 10 }
  ];
  var STARTER_STARS = 40;
  // A sane ceiling on one stored number: the save is player-editable JSON, and an
  // atom count of 1e9 would render as a price the shop could never charge.
  var MAX_STOCK_PER_ELEMENT = 9999;

  var FEATURES = [
    { id: 'xray', icon: 'scan-eye', stars: 2, price: 40 },
    { id: 'proton', icon: 'crosshair', stars: 3, price: 500 },
    { id: 'timeSpeed', icon: 'fast-forward', stars: 3, price: 70 },
    { id: 'timeStop', icon: 'clock', stars: 4, price: 120 },
    { id: 'mayhem', icon: 'flame', stars: 4, price: 150 }
  ];

  var INCOME = { daily: 20 };

  var STR = {
    en: {
      title: 'Supply Shop',
      tabElements: 'Elements',
      tabFeatures: 'Features',
      tabAmmo: 'Ammo',
      balance: 'Balance',
      owned: 'OWNED',
      buy: 'BUY',
      free: 'FREE',
      locked: 'Locked - pull the rope to shop',
      needStars: 'Need {n} more stars',
      bought: 'Purchased {name} for {price} stars',
      boughtAtoms: 'Bought {n} × {name} for {price} stars',
      notEnough: 'Not enough stars for {name} ({price} needed)',
      earnDiscovery: '+{n} stars · new discovery',
      earnDaily: '+{n} stars · daily reward',
      hint: 'Drag the rope down to open the shop',
      close: 'Close',
      spendHint: 'Your stars are your rank progress — buying spends them and can downrank you',
      dynMode: 'Dynamic pricing: each feature costs {pct}% of your {stars} ★ balance. Atoms and ammo keep fixed prices — a molecule is the sum of its atoms.',
      rankNow: '{rank} · {stars} ★ left',
      qty: 'Buy amount',
      unitPrice: '{n} ★ / atom',
      stockOf: 'in crate',
      crateTotal: '{n} atoms in the crate · worth {stars} ★',
      allUnlocked: 'Every element is open for trade — you buy the atoms, not the unlock.',
      priceRule: 'One atom = period base × family: nonmetal, metalloid, halogen ×1 · alkali, alkaline earth, post-transition ×2 · transition metal, noble gas ×3 · lanthanide, actinide ×4.',
      ammoHint: 'Each shot of the neutron & proton gun spends one particle from here.',
      ammoName: { proton: 'Proton', neutron: 'Neutron' },
      f: {
        xray: 'X-Ray Vision',
        xray_d: 'See electron clouds around every atom',
        proton: 'Neutron & Proton Gun',
        proton_d: 'Transmute atoms by firing protons or adding neutrons. Every shot costs 1 star of ammo.',
        timeSpeed: 'Time Acceleration',
        timeSpeed_d: 'Unlocks fast-forward beyond 1x',
        timeStop: 'Time Stop',
        timeStop_d: 'Freeze the world mid-reaction',
        mayhem: 'Mayhem Reactions',
        mayhem_d: 'Explosive, cinematic reaction set'
      }
    },
    vi: {
      title: 'Cửa hàng tiếp tế',
      tabElements: 'Nguyên tố',
      tabFeatures: 'Tính năng',
      tabAmmo: 'Đạn',
      balance: 'Số dư',
      owned: 'ĐÃ SỞ HỮU',
      buy: 'MUA',
      free: 'MIỄN PHÍ',
      locked: 'Đang khoá - kéo dây thừng để mở cửa hàng',
      needStars: 'Cần thêm {n} sao nữa',
      bought: 'Đã mua {name} với {price} sao',
      boughtAtoms: 'Đã mua {n} × {name} với {price} sao',
      notEnough: 'Không đủ sao cho {name} (cần {price})',
      earnDiscovery: '+{n} sao · phát hiện mới',
      earnDaily: '+{n} sao · thưởng hằng ngày',
      hint: 'Kéo dây thừng xuống để mở cửa hàng',
      close: 'Đóng',
      spendHint: 'Sao cũng chính là tiến độ cấp bậc — mua sắm sẽ tiêu sao và có thể hạ cấp bạn',
      dynMode: 'Giá động: mỗi tính năng tốn {pct}% số dư {stars} ★ của bạn. Nguyên tử và đạn giữ giá cố định — một phân tử có giá bằng tổng các nguyên tử của nó.',
      rankNow: '{rank} · còn {stars} ★',
      qty: 'Số lượng mua',
      unitPrice: '{n} ★ / nguyên tử',
      stockOf: 'trong kho',
      crateTotal: '{n} nguyên tử trong kho · giá trị {stars} ★',
      allUnlocked: 'Mọi nguyên tố đều được mở bán — bạn mua nguyên tử, không mua quyền mở khoá.',
      priceRule: 'Một nguyên tử = nền chu kỳ × họ: phi kim, á kim, halogen ×1 · kim loại kiềm, kiềm thổ, sau chuyển tiếp ×2 · kim loại chuyển tiếp, khí hiếm ×3 · lantanoid, actinoid ×4.',
      ammoHint: 'Mỗi phát của súng neutron & proton tiêu một hạt trong kho này.',
      ammoName: { proton: 'Proton', neutron: 'Neutron' },
      f: {
        xray: 'Tia X',
        xray_d: 'Nhìn thấy đám mây electron quanh mỗi nguyên tử',
        proton: 'Súng neutron & proton',
        proton_d: 'Biến đổi nguyên tố bằng cách bắn proton hoặc thêm neutron. Mỗi phát tốn 1 sao đạn.',
        timeSpeed: 'Tăng tốc thời gian',
        timeSpeed_d: 'Mở khoá tua nhanh trên 1x',
        timeStop: 'Đóng băng thời gian',
        timeStop_d: 'Dừng thế giới giữa phản ứng',
        mayhem: 'Phản ứng hỗn loạn',
        mayhem_d: 'Bộ phản ứng bùng nổ, đậm chất điện ảnh'
      }
    }
  };

  var state = { features: [], seenHint: false };
  var ownedFeatures = new Set();
  // stock[z] = atoms bought and lying in the crate. inScene[z] = atoms bought this
  // session and currently standing in the world. A delete may only put an atom
  // back while it is owed, which is what stops a cheap atom from being transmuted
  // into an expensive one and refunded as the expensive one.
  var stock = {};
  var inScene = {};
  // Atoms already out of the crate when this page loaded cannot be re-registered by
  // id, because the game process starts empty. claimOwed hands out one slot per
  // owed atom so a reload can adopt the scene, and never more than the crate loaned.
  var claimed = {};
  var ammo = { proton: 0, neutron: 0 };
  var buyQty = 1;
  var listeners = [];
  var rig = null, rope = null, panel = null, balanceEl = null;
  var tab = 'elements';
  var api = null;

  function lang() {
    try {
      if (api && api.i18n && typeof api.i18n.getLang === 'function') return api.i18n.getLang();
    } catch (e) {}
    var s = 'vi';
    try { s = localStorage.getItem('mol3d.lang'); } catch (e2) {}
    return s === 'en' ? 'en' : 'vi';
  }
  function S(key) {
    var d = STR[lang()] || STR.en;
    return d[key] != null ? d[key] : STR.en[key];
  }
  function sf(key) {
    var d = STR[lang()] || STR.en;
    return (d.f && d.f[key]) || (STR.en.f && STR.en.f[key]) || key;
  }
  function fmt(s, params) {
    var out = String(s);
    if (params) {
      for (var k in params) out = out.split('{' + k + '}').join(String(params[k]));
    }
    return out;
  }
  function status(msg, kind) {
    try {
      if (api && typeof api.status === 'function') api.status(msg, kind || 'info');
      return;
    } catch (e) {}
    var el = document.getElementById('status-text');
    if (el) { el.textContent = msg; el.className = kind || 'info'; }
  }

  // Period 1-7 straight off the shell boundaries; the base is the price of the
  // cheapest family in that period.
  function periodOf(z) {
    for (var i = 0; i < PERIOD_MAX_Z.length; i++) if (z <= PERIOD_MAX_Z[i]) return i + 1;
    return PERIOD_MAX_Z.length;
  }
  function catFactor(z) {
    var el = elementByZ(z);
    if (!el || !el.cat) return DEFAULT_CAT_FACTOR;
    var f = CAT_FACTOR[el.cat];
    return typeof f === 'number' && isFinite(f) ? f : DEFAULT_CAT_FACTOR;
  }
  function unitPrice(z) {
    if (!(z > 0)) return 0;
    var base = PERIOD_BASE[periodOf(z) - 1];
    return Math.max(1, Math.round(base * catFactor(z)));
  }
  function starsOf(z) {
    if (!(z > 0)) return 0;
    // Clamped against the atom's own shelf price, not just the period's cheapest
    // element: an actinide pays its own rung, and no discovery ever refunds what
    // buying the same atom costs.
    var cap = Math.max(1, Math.floor(unitPrice(z) / 2));
    return Math.min(PERIOD_STARS[periodOf(z) - 1], cap);
  }
  // Accepts a z, a symbol, an element record or an atom from the scene.
  function zOf(atom) {
    if (typeof atom === 'number') return atom;
    if (typeof atom === 'string') {
      var bySym = elementBySym(atom);
      return bySym ? bySym.z : 0;
    }
    if (atom && typeof atom === 'object') {
      if (atom.el && typeof atom.el.z === 'number') return atom.el.z;
      if (typeof atom.z === 'number') return atom.z;
      if (atom.sym) {
        var e = elementBySym(atom.sym);
        return e ? e.z : 0;
      }
    }
    return 0;
  }
  function elementBySym(sym) {
    var list = registry();
    for (var i = 0; i < list.length; i++) if (list[i].sym === sym) return list[i];
    return null;
  }
  // The price of anything made of atoms: the sum of its parts, always the same
  // number for the same molecule, in the shop, in the dex and on the tooltip.
  function priceOfAtoms(list) {
    var total = 0;
    for (var i = 0; i < (list || []).length; i++) total += unitPrice(zOf(list[i]));
    return total;
  }
  function crateTotal() {
    var n = 0, stars = 0;
    for (var k in stock) {
      var z = Number(k);
      if (!(stock[k] > 0)) continue;
      n += stock[k];
      stars += stock[k] * unitPrice(z);
    }
    return { atoms: n, stars: stars };
  }
  function featureById(id) {
    for (var i = 0; i < FEATURES.length; i++) if (FEATURES[i].id === id) return FEATURES[i];
    return null;
  }
  // One row per period: the Z range it covers and the cheapest and dearest atom
  // inside it. The guide and the gun render the rule from here instead of
  // copying numbers, so a rebalance cannot leave a stale price in the help text.
  function priceLadder() {
    var rows = [];
    for (var p = 0; p < PERIOD_MAX_Z.length; p++) {
      var lo = p === 0 ? 1 : PERIOD_MAX_Z[p - 1] + 1;
      var hi = PERIOD_MAX_Z[p];
      var min = Infinity, max = 0;
      for (var z = lo; z <= hi; z++) {
        var v = unitPrice(z);
        if (v < min) min = v;
        if (v > max) max = v;
      }
      rows.push({ period: p + 1, minZ: lo, maxZ: hi, min: min, max: max });
    }
    return rows;
  }

  function rankMgr() {
    try {
      return (api && api.progression && api.progression.rankManager) || null;
    } catch (e) {
      return null;
    }
  }
  function balance() {
    var rm = rankMgr();
    return rm ? Math.max(0, Math.round(rm.totalStars) || 0) : 0;
  }
  function rankLabel() {
    var rm = rankMgr();
    if (!rm || typeof rm.getCurrentRank !== 'function') return '';
    try {
      var r = rm.getCurrentRank();
      if (!r || !r.rank) return '';
      var name = lang() === 'vi' && r.rank.vi ? r.rank.vi : r.rank.name;
      return name + ' ' + (r.gradeRoman || '');
    } catch (e) {
      return '';
    }
  }
  // Deduct from the rank ledger; refuses when the balance cannot cover the price,
  // because removeStars clamps at zero and would otherwise grant the item for less.
  function spend(n) {
    var rm = rankMgr();
    if (!(n > 0) || !rm) return false;
    if (balance() < n) return false;
    rm.removeStars(n);
    return true;
  }

  function load() {
    var legacy = null;
    try {
      LEGACY_SAVE_KEYS.forEach(function(k) {
        var raw = localStorage.getItem(k);
        if (!raw || legacy) return;
        try {
          var d = JSON.parse(raw);
          if (d && typeof d === 'object') legacy = d;
        } catch (e0) {}
      });
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) {
        // First run on the stock ledger: keep the feature purchases, open a crate,
        // and top the balance up once so there is something to spend.
        state.features = legacy && Array.isArray(legacy.features) ? legacy.features : [];
        ownedFeatures = new Set(state.features);
        stock = normalizeCountMap(legacy && legacy.stock);
        ammo = normalizeAmmo(legacy && legacy.ammo);
        foldLegacyElements(legacy);
        save();
        grantStarter();
        return;
      }
      var d = JSON.parse(raw);
      if (d && typeof d === 'object') {
        state.features = Array.isArray(d.features) ? d.features : [];
        state.seenHint = !!d.seenHint;
        state.starter = !!d.starter;
        stock = normalizeCountMap(d.stock);
        ammo = normalizeAmmo(d.ammo);
        inScene = normalizeCountMap(d.out);
        // v2 stored permanent unlocks; those atoms were paid for once and are
        // handed back as crate stock rather than thrown away.
        foldLegacyElements(legacy);
      }
    } catch (e) {}
    ownedFeatures = new Set(state.features);
    save();
    if (!state.starter) grantStarter();
  }
  function normalizeCountMap(d) {
    var out = {};
    if (d && typeof d === 'object') {
      Object.keys(d).forEach(function(k) {
        var z = Number(k), n = Math.floor(Number(d[k]));
        if (z > 0 && z <= 118 && n > 0) out[z] = Math.min(n, MAX_STOCK_PER_ELEMENT);
      });
    }
    return out;
  }
  // v2 sold an element once and let the player place it forever. That purchase is
  // honoured as one crate unit per element rather than discarded, because taking
  // away what a player already paid for is not a migration.
  function foldLegacyElements(legacy) {
    if (!legacy || !Array.isArray(legacy.elements)) return;
    legacy.elements.forEach(function(z) {
      var n = Number(z);
      if (n > 0) addStock(n, 1);
    });
  }
  function bumpStock(map, z, n) {
    if (!(z > 0) || !(n > 0)) return;
    map[z] = Math.min((map[z] || 0) + n, MAX_STOCK_PER_ELEMENT);
  }
  // Everything the crate holds is worth stars: atoms at their shelf price, gun
  // particles at the price of a particle.
  function inventoryValue(stockMap, ammoMap) {
    var v = 0, k;
    for (k in stockMap) v += (stockMap[k] || 0) * unitPrice(Number(k));
    for (k in ammoMap) v += (ammoMap[k] || 0) * AMMO_PRICE;
    return v;
  }
  // A feature is worth the price the shop would have charged for it at the
  // cheapest rung, so an imported list of owned features has to be paid for just
  // like the atoms beside it.
  function featureValue(list) {
    var v = 0;
    for (var i = 0; i < list.length; i++) {
      var f = featureById(list[i]);
      if (f && f.price > 0) v += f.price;
    }
    return v;
  }
  function payableStarCap() {
    var rm = rankMgr();
    if (rm && typeof rm.payableStars === 'function') return rm.payableStars();
    return Infinity;
  }
  function normalizeAmmo(d) {
    var out = { proton: 0, neutron: 0 };
    if (d && typeof d === 'object') {
      Object.keys(out).forEach(function(k) {
        var n = Math.floor(Number(d[k]));
        if (n > 0) out[k] = Math.min(n, MAX_STOCK_PER_ELEMENT);
      });
    }
    return out;
  }
  function save() {
    state.features = Array.from(ownedFeatures);
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        stock: stock, ammo: ammo, features: state.features,
        out: inScene,
        seenHint: state.seenHint, starter: !!state.starter
      }));
      LEGACY_SAVE_KEYS.forEach(function(k) {
        try { localStorage.removeItem(k); } catch (e) {}
      });
    } catch (e) {}
  }
  function grantStarter() {
    if (state.starter) return;
    state.starter = true;
    STARTER_KIT.forEach(function(k) { addStock(k.z, k.n); });
    var rm = rankMgr();
    if (rm && typeof rm.addStars === 'function') rm.addStars(STARTER_STARS);
    save();
    notify();
  }

  function stockOf(z) {
    return stock[z] || 0;
  }
  function owedOf(z) {
    return inScene[z] || 0;
  }
  function addStock(z, n) {
    if (!(z > 0) || !(n > 0)) return 0;
    var cur = stock[z] || 0;
    var granted = Math.min(n, MAX_STOCK_PER_ELEMENT - cur);
    if (granted <= 0) return 0;
    stock[z] = cur + granted;
    return granted;
  }
  // Every atom that leaves the scene comes back through here, and only while the
  // crate says the world still owes it. Reactions, the atmosphere, decay fragments
  // and other players' atoms were never bought, so deleting them returns nothing.
  // What comes back is the crate unit that went out, never stars: paid in stars, a
  // cheap atom could be transmuted and cashed in as an expensive one.
  function refundAtom(z) {
    if (!(z > 0)) return false;
    var owed = inScene[z] || 0;
    if (owed <= 0) return false;
    inScene[z] = owed - 1;
    if ((claimed[z] || 0) > inScene[z]) claimed[z] = inScene[z];
    addStock(z, 1);
    save();
    notify();
    return true;
  }
  function refundAtoms(zs) {
    var n = 0;
    for (var i = 0; i < (zs || []).length; i++) if (refundAtom(zOf(zs[i]))) n++;
    return n;
  }
  // A reload empties the game side's id ledger while the crate still remembers how
  // many atoms of each element it loaned out. Adopting hands out at most that many
  // slots, so a saved scene reclaims what it was given and nothing more.
  function claimOwed(z) {
    if (!(z > 0)) return false;
    var unadopted = (inScene[z] || 0) - (claimed[z] || 0);
    if (unadopted <= 0) return false;
    claimed[z] = (claimed[z] || 0) + 1;
    return true;
  }
  function takeAtom(z) {
    if (!(z > 0)) return true;
    var have = stock[z] || 0;
    if (have <= 0) return false;
    stock[z] = have - 1;
    inScene[z] = (inScene[z] || 0) + 1;
    save();
    notify();
    return true;
  }
  // Buys a mixed bag in one charge: the dex summon and the assistant both price a
  // molecule as the sum of its atoms and take the whole amount off in one go.
  function buyAtoms(list) {
    var cost = priceOfAtoms(list);
    if (cost <= 0) return { ok: true, cost: 0 };
    if (!spend(cost)) return { ok: false, cost: cost };
    for (var i = 0; i < list.length; i++) addStock(zOf(list[i]), 1);
    save();
    notify();
    return { ok: true, cost: cost };
  }
  function buyElement(z, n) {
    var qty = Math.max(1, Math.floor(n || buyQty));
    var price = unitPrice(z) * qty;
    var el = elementByZ(z);
    if (!el) return false;
    if (!spend(price)) {
      status('⚠ ' + fmt(S('notEnough'), { name: nameOf(el), price: price }), 'err');
      shake();
      return false;
    }
    var got = addStock(z, qty);
    save();
    render();
    notify();
    announce(price, got + ' × ' + nameOf(el));
    pop(el);
    return true;
  }
  function ammoOf(kind) {
    return ammo[kind] || 0;
  }
  function buyAmmo(kind, n) {
    if (!ammo.hasOwnProperty(kind)) return false;
    var qty = Math.max(1, Math.floor(n || buyQty));
    var price = AMMO_PRICE * qty;
    var label = (S('ammoName') || {})[kind] || kind;
    if (!spend(price)) {
      status('⚠ ' + fmt(S('notEnough'), { name: label, price: price }), 'err');
      shake();
      return false;
    }
    ammo[kind] = Math.min(MAX_STOCK_PER_ELEMENT, (ammo[kind] || 0) + qty);
    save();
    render();
    notify();
    announce(price, qty + ' × ' + label);
    return true;
  }
  // One particle out of the magazine per shot. The gun asks before it fires, so a
  // shot is never both free and un-counted.
  function takeAmmo(kind) {
    if (!ammo.hasOwnProperty(kind)) return false;
    if ((ammo[kind] || 0) <= 0) return false;
    ammo[kind] -= 1;
    save();
    notify();
    return true;
  }
  function refundAmmo(kind) {
    if (!ammo.hasOwnProperty(kind)) return false;
    ammo[kind] = Math.min(MAX_STOCK_PER_ELEMENT, (ammo[kind] || 0) + 1);
    save();
    notify();
    return true;
  }
  function onStockChange(fn) {
    if (typeof fn === 'function') listeners.push(fn);
  }
  function notify() {
    var total = crateTotal();
    for (var i = 0; i < listeners.length; i++) {
      try {
        listeners[i]({ stock: stock, ammo: ammo, atoms: total.atoms, value: total.stars });
      } catch (e) {}
    }
  }

  function ownsElement(z) {
    // Trading is open for every element now; what gates a placement is the crate.
    if (!z) return true;
    return true;
  }
  function ownsFeature(id) {
    if (!featureById(id)) return true;
    return ownedFeatures.has(id);
  }
  function blocksFeature(id) {
    var f = featureById(id);
    if (!f || ownedFeatures.has(id)) return false;
    return true;
  }
  function lockedMessage(id) {
    var f = featureById(id);
    return '🔒 ' + S('locked') + (f ? ' · ' + sf(id) : '');
  }
  function earn(kind, amount) {
    var n = amount != null ? amount : (INCOME[kind] || 0);
    if (!(n > 0)) return;
    var rm = rankMgr();
    if (!rm || typeof rm.addStars !== 'function') return;
    rm.addStars(n);
    var label = kind === 'daily' ? S('earnDaily') : S('earnDiscovery');
    status(fmt(label, { n: n }), 'info');
  }

  function priceOf(base, floor) {
    if (!(base > 0)) return 0;
    var b = balance();
    var p = base;
    if (b > PCT_THRESHOLD) p = Math.max(1, Math.round(b * PCT_RATE));
    var min = floor || 0;
    return p > min ? p : min;
  }
  function isDynamic() {
    return balance() > PCT_THRESHOLD;
  }

  function buyFeature(id) {
    var f = featureById(id);
    if (!f || ownsFeature(id)) return;
    var price = priceOf(f.price, f.min);
    if (balance() < price || !spend(price)) {
      status('⚠ ' + fmt(S('notEnough'), { name: sf(id), price: price }), 'err');
      shake();
      return;
    }
    ownedFeatures.add(id);
    save();
    render();
    refreshFeatureLocks();
    announce(price, sf(id));
    pop(null, id);
  }
  // The rank ledger may have moved down as a side effect of the purchase.
  function announce(price, name) {
    var label = rankLabel();
    status('⭐ ' + fmt(S('bought'), { name: name, price: price }) +
      (label ? ' · ' + fmt(S('rankNow'), { rank: label, stars: balance() }) : ''), 'ok');
  }

  function nameOf(el) {
    try {
      if (api && api.i18n && typeof api.i18n.elName === 'function') return api.i18n.elName(el);
    } catch (e) {}
    return el.name || el.sym;
  }
  function registry() {
    var list = ((api && api.ELEMENTS) || []).slice();
    try {
      var more = (window.__mol3d && window.__mol3d.customElements) || [];
      for (var i = 0; i < more.length; i++) list.push(more[i]);
    } catch (e) {}
    return list;
  }
  function elementByZ(z) {
    var list = registry();
    for (var i = 0; i < list.length; i++) if (list[i].z === z) return list[i];
    return null;
  }
  function buyableElements() {
    var list = (api && api.ELEMENTS) || [];
    return list.filter(function(el) { return el.z > 0 && el.z <= 118; });
  }
  function rebuildPool() {
    try {
      if (api && api.progression && typeof api.progression.rebuildPool === 'function') api.progression.rebuildPool();
    } catch (e) {}
  }
  function refreshFeatureLocks() {
    try {
      var rm = api && api.progression && api.progression.rankManager;
      if (rm && typeof rm.emit === 'function') {
        rm.emit('starsChanged', { totalStars: rm.totalStars, rank: rm.getCurrentRank() });
      }
    } catch (e) {}
    var mayhem = document.getElementById('btn-mayhem');
    if (mayhem) mayhem.classList.toggle('feature-locked', blocksFeature('mayhem'));
    var xray = document.getElementById('btn-xray');
    if (xray) xray.classList.toggle('feature-locked', blocksFeature('xray'));
    var proton = document.getElementById('btn-proton');
    if (proton) proton.classList.toggle('feature-locked', blocksFeature('proton'));
  }

  function starRow(n, total) {
    var out = '';
    for (var i = 0; i < total; i++) out += i < n ? '★' : '☆';
    return out;
  }

  function updateBalance() {
    if (balanceEl) balanceEl.textContent = balance() + ' ★';
    var rankEl = document.getElementById('shop-rank');
    if (rankEl) rankEl.textContent = rankLabel();
    updateDynMode();
  }

  var renderedTab = null;
  var renderedSig = '';
  var filterText = '';

  function stockSig() {
    var n = 0;
    for (var k in stock) n += stock[k];
    return tab + '|' + lang() + '|' + buyQty + '|' + filterText + '|' + n + '|' +
      (ammo.proton + ammo.neutron) + '|' + Array.from(ownedFeatures).sort().join(',');
  }

  // Star changes fire on every discovery; rebuilding 118 cards for that is wasteful,
  // so the cheap path only refreshes the chips and the affordability styling.
  // The chips must be rewritten too: with dynamic pricing the number depends on balance.
  function refreshAffordability() {
    if (!panel) return;
    var b = balance();
    panel.querySelectorAll('.shop-card[data-unit], .shop-row[data-base]').forEach(function(node) {
      var unit = Number(node.dataset.unit);
      var p = node.dataset.base
        ? priceOf(Number(node.dataset.base), Number(node.dataset.min))
        : unit * buyQty;
      node.classList.toggle('is-poor', b < p);
      var chip = node.querySelector('.shop-card-price');
      if (chip) chip.textContent = p + ' ★';
    });
  }

  function priceChip(owned, price) {
    return owned ? esc(S('owned')) : esc(String(price)) + ' ★';
  }

  function updateDynMode() {
    var el = document.getElementById('shop-dyn');
    if (!el) return;
    if (!isDynamic()) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    el.textContent = '⚡ ' + fmt(S('dynMode'), {
      pct: Math.round(PCT_RATE * 100),
      stars: balance()
    });
  }

  function render() {
    if (!panel) return;
    updateBalance();
    if (!isOpen) {
      renderedTab = null;
      return;
    }
    var body = panel.querySelector('.shop-body');
    if (!body) return;
    var sig = stockSig();
    if (renderedTab === tab && renderedSig === sig) {
      refreshAffordability();
      return;
    }
    body.innerHTML = '';
    if (tab === 'elements') body.appendChild(elementGrid());
    else if (tab === 'ammo') body.appendChild(ammoList());
    else body.appendChild(featureList());
    panel.querySelectorAll('.shop-tab').forEach(function(b) {
      b.classList.toggle('on', b.dataset.tab === tab);
    });
    renderedTab = tab;
    renderedSig = sig;
  }

  // One number drives every buy in the panel, so the price shown on a card is the
  // price that click pays.
  function qtyBar() {
    var bar = document.createElement('div');
    bar.className = 'shop-qty';
    var label = document.createElement('span');
    label.className = 'shop-qty-label';
    label.textContent = S('qty');
    bar.appendChild(label);
    [1, 5, 10, 25].forEach(function(n) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'shop-qty-btn' + (buyQty === n ? ' on' : '');
      b.textContent = '×' + n;
      b.addEventListener('click', function() {
        buyQty = n;
        render();
      });
      bar.appendChild(b);
    });
    var total = crateTotal();
    var crate = document.createElement('span');
    crate.className = 'shop-qty-crate';
    crate.textContent = '🧰 ' + fmt(S('crateTotal'), { n: total.atoms, stars: total.stars });
    bar.appendChild(crate);
    return bar;
  }

  function matchText(el) {
    return (el.sym + ' ' + el.name + ' ' + nameOf(el) + ' ' + el.z).toLowerCase();
  }

  function elementGrid() {
    var out = document.createElement('div');
    out.appendChild(qtyBar());
    var search = document.createElement('input');
    search.type = 'search';
    search.className = 'shop-search';
    search.placeholder = S('tabElements') + '…';
    search.value = filterText;
    search.addEventListener('input', function() {
      filterText = search.value.trim().toLowerCase();
      render();
      var again = panel.querySelector('.shop-search');
      if (again) again.focus();
    });
    out.appendChild(search);
    var note = document.createElement('div');
    note.className = 'shop-note';
    note.textContent = S('allUnlocked');
    out.appendChild(note);
    var rule = document.createElement('div');
    rule.className = 'shop-note shop-note-rule';
    rule.textContent = S('priceRule');
    out.appendChild(rule);
    var wrap = document.createElement('div');
    wrap.className = 'shop-grid';
    var q = filterText;
    buyableElements().forEach(function(el) {
      if (q && matchText(el).indexOf(q) < 0) return;
      var have = stockOf(el.z);
      var price = unitPrice(el.z) * buyQty;
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'shop-card' + (have > 0 ? ' is-stocked' : '') + (balance() >= price ? '' : ' is-poor');
      card.dataset.z = String(el.z);
      card.dataset.unit = String(unitPrice(el.z));
      card.innerHTML =
        '<span class="shop-card-sym">' + esc(el.sym) + '</span>' +
        '<span class="shop-card-name">' + esc(nameOf(el)) + '</span>' +
        '<span class="shop-card-stars">' + starRow(starsOf(el.z), 5) + '</span>' +
        '<span class="shop-card-price">' + esc(String(price)) + ' ★</span>' +
        '<span class="shop-card-stock">' + esc(String(have)) + ' ' + esc(S('stockOf')) + '</span>';
      card.title = fmt(S('unitPrice'), { n: unitPrice(el.z) });
      card.addEventListener('click', function() { buyElement(el.z, buyQty); });
      wrap.appendChild(card);
    });
    out.appendChild(wrap);
    out.appendChild(ledgerNote());
    return out;
  }

  function ammoList() {
    var out = document.createElement('div');
    out.appendChild(qtyBar());
    var note = document.createElement('div');
    note.className = 'shop-note';
    note.textContent = S('ammoHint');
    out.appendChild(note);
    var wrap = document.createElement('div');
    wrap.className = 'shop-list';
    AMMO.forEach(function(a) {
      var have = ammoOf(a.id);
      var price = AMMO_PRICE * buyQty;
      var row = document.createElement('button');
      row.type = 'button';
      row.className = 'shop-row' + (have > 0 ? ' is-stocked' : '') + (balance() >= price ? '' : ' is-poor');
      row.dataset.ammo = a.id;
      row.dataset.unit = String(AMMO_PRICE);
      row.innerHTML =
        '<span class="shop-row-icon"><i data-lucide="' + a.icon + '"></i></span>' +
        '<span class="shop-row-main">' +
          '<span class="shop-row-title">' + esc((S('ammoName') || {})[a.id] || a.id) + '</span>' +
          '<span class="shop-row-desc">' + esc(String(have)) + ' ' + esc(S('stockOf')) + '</span>' +
        '</span>' +
        '<span class="shop-row-right">' +
          '<span class="shop-card-stars">' + starRow(a.stars, 5) + '</span>' +
          '<span class="shop-card-price">' + esc(String(price)) + ' ★</span>' +
        '</span>';
      row.addEventListener('click', function() { buyAmmo(a.id, buyQty); });
      wrap.appendChild(row);
    });
    out.appendChild(wrap);
    out.appendChild(ledgerNote());
    return out;
  }

  function ledgerNote() {
    var note = document.createElement('div');
    note.className = 'shop-note shop-ledger-note';
    note.textContent = S('spendHint');
    return note;
  }

  function featureList() {
    var wrap = document.createElement('div');
    wrap.className = 'shop-list';
    FEATURES.forEach(function(f) {
      var owned = ownsFeature(f.id);
      var row = document.createElement('button');
      row.type = 'button';
      var price = priceOf(f.price, f.min);
      row.className = 'shop-row' + (owned ? ' is-owned' : '') + (balance() >= price ? '' : ' is-poor');
      row.dataset.feature = f.id;
      row.dataset.base = String(f.price);
      if (f.min) row.dataset.min = String(f.min);
      row.innerHTML =
        '<span class="shop-row-icon"><i data-lucide="' + f.icon + '"></i></span>' +
        '<span class="shop-row-main">' +
          '<span class="shop-row-title">' + esc(sf(f.id)) + '</span>' +
          '<span class="shop-row-desc">' + esc(sf(f.id + '_d')) + '</span>' +
        '</span>' +
        '<span class="shop-row-right">' +
          '<span class="shop-card-stars">' + starRow(f.stars, 5) + '</span>' +
          '<span class="shop-card-price">' + priceChip(owned, price) + '</span>' +
        '</span>';
      row.addEventListener('click', function() { buyFeature(f.id); });
      wrap.appendChild(row);
    });
    wrap.appendChild(ledgerNote());
    return wrap;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function(c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function icons() {
    try {
      if (typeof window.lucide !== 'undefined' && window.lucide.createIcons) window.lucide.createIcons();
    } catch (e) {}
  }

  function shake() {
    if (!panel) return;
    panel.classList.remove('nope');
    void panel.offsetWidth;
    panel.classList.add('nope');
    setTimeout(function() { panel.classList.remove('nope'); }, 420);
  }

  // A refused placement has exactly one fix, and it hangs from the ceiling: pull
  // the rope so it is visibly the thing to click instead of describing it.
  function flashRope() {
    if (!rig) return;
    rig.classList.remove('flash');
    void rig.offsetWidth;
    rig.classList.add('flash');
    setTimeout(function() { rig.classList.remove('flash'); }, 1600);
  }

  function pop(el, featureId) {
    var burst = document.createElement('div');
    burst.className = 'shop-pop';
    burst.textContent = el ? el.sym : '✓';
    var anchor = el ? panel.querySelector('.shop-card[data-z="' + el.z + '"]')
      : panel.querySelector('.shop-row[data-feature="' + featureId + '"]');
    if (!anchor) return;
    var r = anchor.getBoundingClientRect();
    burst.style.left = (r.left + r.width / 2) + 'px';
    burst.style.top = (r.top + r.height / 2) + 'px';
    document.body.appendChild(burst);
    setTimeout(function() { if (burst.parentNode) burst.remove(); }, 700);
  }

  // ROPE.png is 258x253: strand on top, flask knot on the bottom. The element is
  // never scaled — the background keeps the image's own aspect and the element
  // height only reveals more of it from the ceiling down.
  var ROPE_ASPECT = 253 / 258;
  var ROPE_REST = 0.62;
  var PULL_RANGE = 150;
  var OPEN_AT = 0.42;

  var dragging = false;
  var startY = 0;
  var progress = 0;
  var isOpen = false;
  var ropeFullPx = 0;

  function setRopeMetrics() {
    var narrow = window.innerWidth <= 640 || (document.body && document.body.classList.contains('mobile'));
    var w = narrow ? 104 : 132;
    ropeFullPx = w * ROPE_ASPECT;
    rig.style.setProperty('--rope-w', w + 'px');
    rig.style.setProperty('--rope-img-h', ropeFullPx.toFixed(1) + 'px');
  }
  function applyProgress(p) {
    progress = Math.max(0, Math.min(1, p));
    var pay = Math.min(1, progress / 0.55);
    var len = ropeFullPx * (ROPE_REST + (1 - ROPE_REST) * pay);
    rig.style.setProperty('--rope-h', len.toFixed(1) + 'px');
    panel.style.transform = 'translateY(' + (-112 * (1 - progress)) + '%)';
    panel.style.opacity = String(0.15 + 0.85 * progress);
  }
  function clearInline() {
    panel.style.transform = '';
    panel.style.opacity = '';
    rig.style.removeProperty('--rope-h');
  }
  function open() {
    isOpen = true;
    rig.classList.remove('dragging');
    clearInline();
    rig.classList.add('open');
    render();
    icons();
  }
  function close() {
    isOpen = false;
    progress = 0;
    rig.classList.remove('dragging');
    clearInline();
    rig.classList.remove('open');
  }
  function toggle() {
    if (isOpen) close(); else open();
  }

  function onDown(e) {
    if (e.button != null && e.button !== 0) return;
    dragging = true;
    startY = e.clientY;
    rig.classList.add('dragging');
    try { rope.setPointerCapture(e.pointerId); } catch (err) {}
    if (e.pointerType === 'touch' || e.pointerType === 'pen') e.preventDefault();
  }
  function onMove(e) {
    if (!dragging) return;
    e.preventDefault();
    var base = isOpen ? PULL_RANGE : 0;
    applyProgress((e.clientY - startY + base) / PULL_RANGE);
  }
  function onUp() {
    if (!dragging) return;
    dragging = false;
    rig.classList.remove('dragging');
    if (progress > OPEN_AT) open(); else close();
  }

  function build() {
    if (rig) return;
    var css = [
      '#shop-rig{position:fixed;top:0;right:68px;width:min(460px,88vw);display:flex;flex-direction:column;',
      '  align-items:center;pointer-events:none;z-index:62;--rope-w:132px;--rope-img-h:129.4px;',
      '  --rope-h:calc(var(--rope-img-h) * ' + ROPE_REST + ');}',
      '#shop-rig.open{--rope-h:var(--rope-img-h);}',
      '#shop-rope{width:var(--rope-w);height:var(--rope-h);flex:none;cursor:grab;pointer-events:auto;',
      '  background:url("./assets/ROPE.png") center bottom/var(--rope-w) var(--rope-img-h) no-repeat;',
      '  clip-path:inset(0 20% 0 20%);',
      '  filter:drop-shadow(0 6px 14px rgba(0,0,0,.45));touch-action:none;',
      '  transition:height .52s cubic-bezier(.2,.9,.28,1.06);}',
      '#shop-rope:active{cursor:grabbing;}',
      '#shop-rig.dragging #shop-rope{transition:none;}',
      '#shop-rig.open #shop-rope{animation:ropeSwing 2.6s ease-in-out infinite;transform-origin:top center;}',
      '@keyframes ropeSwing{0%,100%{transform:rotate(-1.1deg);}50%{transform:rotate(1.1deg);}}',
      '#shop-hint{position:absolute;top:calc(var(--rope-h) - 6px);left:50%;transform:translateX(-50%);',
      '  white-space:nowrap;font-size:10px;color:var(--muted);pointer-events:none;opacity:0;',
      '  transition:opacity .35s;background:var(--overlay-soft,rgba(8,14,30,.72));padding:2px 8px;border-radius:8px;}',
      '#shop-rig.hint #shop-hint{opacity:1;}',
      '#shop-panel{width:100%;pointer-events:none;visibility:hidden;background:var(--panel);border:1px solid var(--border);',
      '  border-radius:16px;box-shadow:0 18px 48px rgba(0,0,0,.5);backdrop-filter:blur(14px);',
      '  overflow:hidden;transform:translateY(-112%);opacity:0;',
      '  transition:transform .52s cubic-bezier(.2,.9,.28,1.06),opacity .3s,visibility 0s linear .52s;}',
      '#shop-rig.open #shop-panel,#shop-rig.dragging #shop-panel{transform:none;opacity:1;pointer-events:auto;visibility:visible;',
      '  transition:transform .52s cubic-bezier(.2,.9,.28,1.06),opacity .3s,visibility 0s;}',
      '#shop-rig.dragging #shop-panel{transition:none;}',
      '#shop-panel.nope{animation:shopNope .4s ease;}',
      '@keyframes shopNope{0%,100%{margin-left:0;}20%{margin-left:-9px;}45%{margin-left:8px;}70%{margin-left:-4px;}}',
      '.shop-head{display:flex;align-items:center;gap:8px;padding:9px 12px;border-bottom:1px solid var(--border);}',
      '.shop-title{font-weight:700;font-size:13px;letter-spacing:.3px;}',
      '.shop-rank{margin-left:auto;font-size:10px;font-weight:700;color:var(--muted);white-space:nowrap;}',
      '.shop-balance{margin-left:8px;font-family:Consolas,Monaco,monospace;font-weight:700;font-size:12px;',
      '  color:var(--accent);padding:3px 9px;border-radius:9px;background:var(--accent-soft);}',
      '.shop-close{width:24px;height:24px;border-radius:8px;border:1px solid var(--border);background:transparent;',
      '  color:var(--muted);cursor:pointer;font-size:13px;line-height:1;}',
      '.shop-close:hover{color:var(--text);border-color:var(--accent);}',
      '.shop-tabs{display:flex;gap:6px;padding:8px 12px 0;}',
      '.shop-tab{flex:1;padding:6px 8px;border-radius:10px 10px 0 0;border:1px solid var(--border);',
      '  border-bottom:none;background:transparent;color:var(--muted);cursor:pointer;font-size:11px;font-weight:600;}',
      '.shop-tab.on{color:var(--text);background:var(--panel-2);}',
      '.shop-dyn{display:block;padding:6px 12px;font-size:10px;font-weight:600;color:var(--warn,#ffcf5c);',
      '  background:var(--warn-soft,rgba(255,207,92,.10));border-bottom:1px solid var(--border);}',
      '.shop-dyn[hidden]{display:none;}',
      '.shop-body{max-height:min(46vh,380px);overflow-y:auto;padding:10px 12px 12px;',
      '  touch-action:pan-y;-webkit-overflow-scrolling:touch;}',
      '.shop-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:6px;}',
      '.shop-list{display:flex;flex-direction:column;gap:6px;}',
      '.shop-card,.shop-row{position:relative;display:flex;background:var(--panel-2);border:1px solid var(--border);',
      '  border-radius:12px;color:var(--text);cursor:pointer;font:inherit;text-align:left;overflow:hidden;',
      '  transition:border-color .18s,transform .18s,box-shadow .18s;}',
      '.shop-card{flex-direction:column;align-items:flex-start;gap:2px;padding:7px 8px;}',
      '.shop-row{align-items:center;gap:9px;padding:8px 10px;}',
      '.shop-card:hover,.shop-row:hover{border-color:var(--accent);transform:translateY(-1px);}',
      '.shop-card-sym{font-weight:800;font-size:15px;color:var(--accent);}',
      '.shop-card-name{font-size:10px;color:var(--muted);max-width:100%;overflow:hidden;',
      '  text-overflow:ellipsis;white-space:nowrap;}',
      '.shop-card-stars{font-size:9px;color:var(--warn,#ffcf5c);letter-spacing:1px;line-height:1;}',
      '.shop-card-price{font-size:10px;font-weight:700;margin-top:auto;}',
      '.shop-row-main{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1;}',
      '.shop-row-title{font-size:12px;font-weight:700;}',
      '.shop-row-desc{font-size:10px;color:var(--muted);}',
      '.shop-row-right{display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex:none;}',
      '.shop-row-icon{width:26px;height:26px;flex:none;display:flex;align-items:center;justify-content:center;',
      '  border-radius:9px;background:var(--accent-soft);color:var(--accent);}',
      '.shop-row-icon svg{width:15px;height:15px;}',
      '.shop-card.is-owned,.shop-row.is-owned{border-color:var(--ok);cursor:default;opacity:.72;}',
      '.shop-card.is-owned .shop-card-price,.shop-row.is-owned .shop-card-price{color:var(--ok);}',
      '.shop-card.is-poor,.shop-row.is-poor{opacity:.55;}',
      '.shop-card-stock{position:absolute;top:6px;right:6px;font-size:9px;font-weight:800;line-height:1;',
      '  padding:2px 5px;border-radius:7px;background:var(--border,rgba(255,255,255,.09));color:var(--muted);}',
      '.shop-card.is-stocked .shop-card-stock{background:var(--accent-soft);color:var(--accent);}',
      '.shop-card.is-stocked{border-color:var(--warn,rgba(255,207,92,.45));}',
      '.shop-qty{display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-bottom:8px;}',
      '.shop-qty-label{font-size:10px;font-weight:700;color:var(--muted);}',
      '.shop-qty-btn{padding:3px 9px;border-radius:9px;border:1px solid var(--border);background:transparent;',
      '  color:var(--muted);font:inherit;font-size:11px;font-weight:700;cursor:pointer;}',
      '.shop-qty-btn.on{border-color:var(--accent);color:var(--accent);background:var(--accent-soft);}',
      '.shop-qty-crate{margin-left:auto;font-size:10px;font-weight:700;color:var(--muted);white-space:nowrap;}',
      '.shop-search{width:100%;box-sizing:border-box;margin-bottom:8px;padding:6px 10px;font:inherit;font-size:11px;',
      '  color:var(--text);background:var(--panel-2);border:1px solid var(--border);border-radius:10px;outline:none;}',
      '.shop-search:focus{border-color:var(--accent);}',
      '#shop-rig.flash #shop-rope{animation:ropeFlash 1.5s ease-out;}',
      '@keyframes ropeFlash{0%,100%{filter:drop-shadow(0 6px 14px rgba(0,0,0,.45));}',
      '25%,75%{filter:drop-shadow(0 0 18px var(--warn,rgba(255,207,92,.95)));}}',
      '.shop-note{grid-column:1/-1;font-size:10px;color:var(--muted);padding-top:4px;}',
      '.shop-ledger-note{color:var(--accent);opacity:.85;line-height:1.4;}',
      '.shop-pop{position:fixed;z-index:10005;pointer-events:none;transform:translate(-50%,-50%);',
      '  font-weight:800;font-size:20px;color:var(--warn,#ffcf5c);text-shadow:0 0 14px var(--warn,rgba(255,207,92,.75));',
      '  animation:shopPop .7s ease-out forwards;}',
      '@keyframes shopPop{0%{transform:translate(-50%,-50%) scale(.4);opacity:0;}',
      '30%{transform:translate(-50%,-60%) scale(1.25);opacity:1;}',
      '100%{transform:translate(-50%,-150%) scale(1);opacity:0;}}',
      'body.mobile #shop-rig{right:10px;width:min(360px,94vw);--rope-w:104px;--rope-img-h:102px;}',
      '@media (max-width:640px){',
      '  #shop-rig{right:10px;width:min(360px,94vw);--rope-w:104px;--rope-img-h:102px;}',
      '  .shop-body{max-height:38vh;}',
      '  .shop-grid{grid-template-columns:repeat(auto-fill,minmax(78px,1fr));}',
      '}'
    ].join('\n');

    var style = document.createElement('style');
    style.id = 'shop-rope-styles';
    style.textContent = css;
    document.head.appendChild(style);

    rig = document.createElement('div');
    rig.id = 'shop-rig';
    rope = document.createElement('div');
    rope.id = 'shop-rope';
    rope.title = S('hint');
    rope.setAttribute('role', 'button');
    rope.setAttribute('aria-label', S('hint'));
    var hint = document.createElement('div');
    hint.id = 'shop-hint';
    hint.textContent = S('hint');
    panel = document.createElement('div');
    panel.id = 'shop-panel';

    var head = document.createElement('div');
    head.className = 'shop-head';
    head.innerHTML = '<span class="shop-title">' + esc(S('title')) + '</span>' +
      '<span class="shop-rank" id="shop-rank"></span>' +
      '<span class="shop-balance" id="shop-balance">0 ★</span>' +
      '<button type="button" class="shop-close" id="shop-close" aria-label="' + esc(S('close')) + '">×</button>';
    var tabs = document.createElement('div');
    tabs.className = 'shop-tabs';
    tabs.innerHTML = '<button type="button" class="shop-tab" data-tab="elements">' + esc(S('tabElements')) + '</button>' +
      '<button type="button" class="shop-tab" data-tab="ammo">' + esc(S('tabAmmo')) + '</button>' +
      '<button type="button" class="shop-tab" data-tab="features">' + esc(S('tabFeatures')) + '</button>';
    var dyn = document.createElement('div');
    dyn.className = 'shop-dyn';
    dyn.id = 'shop-dyn';
    dyn.hidden = true;
    var body = document.createElement('div');
    body.className = 'shop-body';

    panel.appendChild(head);
    panel.appendChild(tabs);
    panel.appendChild(dyn);
    panel.appendChild(body);
    rig.appendChild(rope);
    rig.appendChild(hint);
    rig.appendChild(panel);
    document.body.appendChild(rig);
    setRopeMetrics();
    window.addEventListener('resize', setRopeMetrics);

    balanceEl = document.getElementById('shop-balance');

    rope.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    rope.addEventListener('click', function() {
      if (Math.abs(progress) < 0.02) toggle();
    });

    tabs.addEventListener('click', function(e) {
      var b = e.target.closest('.shop-tab');
      if (!b) return;
      tab = b.dataset.tab;
      render();
      icons();
    });
    document.getElementById('shop-close').addEventListener('click', close);

    render();
    icons();

    var stored = false;
    try { stored = !!state.seenHint; } catch (e2) {}
    if (!stored) {
      rig.classList.add('hint');
      setTimeout(function() {
        rig.classList.remove('hint');
        state.seenHint = true;
        save();
      }, 6500);
    }
  }

  function attach() {
    api = window.__mol3d || null;
    if (!api || !api.ELEMENTS) { setTimeout(attach, 400); return; }
    load();
    build();
    refreshFeatureLocks();
    window.__mol3dShop = {
      version: 3,
      ownsElement: ownsElement,
      ownsFeature: ownsFeature,
      blocksFeature: blocksFeature,
      lockedMessage: lockedMessage,
      earn: earn,
      open: open,
      close: close,
      toggle: toggle,
      isOpen: function() { return isOpen; },
      balance: balance,
      rankLabel: rankLabel,
      buyElement: buyElement,
      buyFeature: buyFeature,
      priceOf: priceOf,
      isDynamic: isDynamic,
      // The shop owns the only copy of the feature labels; the How-to-Play guide
      // reads them from here so the two can never drift apart.
      featureName: function (id) { return sf(id); },
      featureDesc: function (id) { return sf(id + '_d'); },
      dynamicPricing: { threshold: PCT_THRESHOLD, rate: PCT_RATE },
      catalogue: {
        features: FEATURES, ammo: AMMO, ammoPrice: AMMO_PRICE,
        periods: PERIOD_MAX_Z, periodBase: PERIOD_BASE, catFactor: CAT_FACTOR,
        ladder: priceLadder(), unitPrice: unitPrice, starsOf: starsOf
      },
      // The crate: what the player owns, what the world currently owes them, and
      // the two ways an atom moves between the crate and the table.
      stockOf: stockOf,
      owedOf: owedOf,
      crateTotal: crateTotal,
      takeAtom: takeAtom,
      refundAtom: refundAtom,
      refundAtoms: refundAtoms,
      claimOwed: claimOwed,
      starsOf: starsOf,
      valueOfAtoms: priceOfAtoms,
      buyAtoms: buyAtoms,
      unitPrice: unitPrice,
      periodOf: periodOf,
      priceOfAtoms: priceOfAtoms,
      zOf: zOf,
      ammoOf: ammoOf,
      buyAmmo: buyAmmo,
      takeAmmo: takeAmmo,
      refundAmmo: refundAmmo,
      onStockChange: onStockChange,
      // The rope is the only way into the shop and it hangs off-screen on a phone
      // the moment a placement is refused; this gives the game a way to point at it.
      flash: flashRope,
      exportState: function() {
        return {
          version: 3,
          stock: JSON.parse(JSON.stringify(stock)),
          ammo: JSON.parse(JSON.stringify(ammo)),
          out: JSON.parse(JSON.stringify(inScene)),
          features: Array.from(ownedFeatures)
        };
      },
      importState: function(d) {
        if (!d || typeof d !== 'object') return false;
        var nextStock = normalizeCountMap(d.stock);
        if (Array.isArray(d.elements)) {
          // A pre-stock save: every unlock it recorded comes back as one atom.
          d.elements.forEach(function(z) {
            var n = Number(z);
            if (n > 0) bumpStock(nextStock, n, 1);
          });
        }
        var nextAmmo = normalizeAmmo(d.ammo);
        var nextFeatures = Array.isArray(d.features) ? d.features.filter(function(x) { return typeof x === 'string'; }) : [];
        // Crate units, gun particles and features are all bought with stars, so a
        // file can only bring in what this browser's ledger says it paid for.
        // Anything the ledger cannot cover comes back empty rather than free.
        var want = inventoryValue(nextStock, nextAmmo) + featureValue(nextFeatures);
        var cap = payableStarCap();
        if (want > cap) {
          console.warn('[shop] import: stock, ammo and features worth ' + want + ' star exceed the ' + cap + ' star ledger; all three dropped');
          nextStock = {};
          nextAmmo = { proton: 0, neutron: 0 };
          nextFeatures = [];
        }
        stock = nextStock;
        ammo = nextAmmo;
        ownedFeatures = new Set(nextFeatures);
        state.features = Array.from(ownedFeatures);
        inScene = normalizeCountMap(d.out);
        claimed = {};
        save();
        render();
        refreshFeatureLocks();
        notify();
        return true;
      },
      reset: function() {
        stock = {};
        inScene = {};
        claimed = {};
        ammo = { proton: 0, neutron: 0 };
        state.starter = false;
        ownedFeatures.clear();
        save();
        grantStarter();
        rebuildPool();
        render();
        refreshFeatureLocks();
      }
    };
    try {
      var rm = api.progression && api.progression.rankManager;
      if (rm && typeof rm.on === 'function') {
        rm.on('starsChanged', function() { render(); });
      }
    } catch (e) {}
    window.addEventListener('mol3d:lang', function() {
      if (!rig) return;
      rope.title = S('hint');
      rope.setAttribute('aria-label', S('hint'));
      var hint = document.getElementById('shop-hint');
      if (hint) hint.textContent = S('hint');
      var title = panel.querySelector('.shop-title');
      if (title) title.textContent = S('title');
      var close = panel.querySelector('.shop-close');
      if (close) close.setAttribute('aria-label', S('close'));
      panel.querySelectorAll('.shop-tab').forEach(function(b) {
        b.textContent = b.dataset.tab === 'elements' ? S('tabElements')
          : b.dataset.tab === 'ammo' ? S('tabAmmo') : S('tabFeatures');
      });
      render();
      icons();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach);
  else attach();
})();
