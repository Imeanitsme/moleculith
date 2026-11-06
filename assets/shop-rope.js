// Rope Shop - pull the cord to drop the supply shop
(function() {
  'use strict';

  // Above PCT_THRESHOLD stars, shop items stop costing a fixed price and instead
  // cost PCT_RATE of the player's current star balance. Rate is deliberately
  // headroom-heavy so late-game stars keep a use without becoming infinite money.
  var PCT_THRESHOLD = 2000;
  var PCT_RATE = 0.1;

  // v2 belongs to the reset ledger; v1 predates it and is dropped on load so no
  // ghost of the old purchases can survive next to a brand new save.
  var SAVE_KEY = 'mol3d.shop.v2';
  var LEGACY_SAVE_KEY = 'mol3d.shop.v1';
  var FREE_MAX_Z = 20;

  // One ledger: the rank star total (mol3d.rank.v2) IS the shop balance.
  // Prices are denominated in rank stars, so spending downranks the player.
  var TIERS = [
    { maxZ: 20, stars: 0, price: 0 },
    { maxZ: 36, stars: 1, price: 25 },
    { maxZ: 54, stars: 2, price: 55 },
    { maxZ: 86, stars: 3, price: 110 },
    { maxZ: 110, stars: 4, price: 180 },
    { maxZ: 118, stars: 5, price: 280 }
  ];

  // The console has a rank gate of its own and no rank path any more: 2000 stars
  // is the only way in, and `min` stops dynamic pricing from discounting it.
  var FEATURES = [
    { id: 'xray', icon: 'scan-eye', stars: 2, price: 40 },
    { id: 'proton', icon: 'crosshair', stars: 2, price: 65 },
    { id: 'timeSpeed', icon: 'fast-forward', stars: 3, price: 70 },
    { id: 'timeStop', icon: 'clock', stars: 4, price: 120 },
    { id: 'mayhem', icon: 'flame', stars: 4, price: 150 },
    { id: 'console', icon: 'terminal', stars: 5, price: 2000, min: 2000 }
  ];

  var INCOME = { discovery: 1, daily: 5 };

  var STR = {
    en: {
      title: 'Supply Shop',
      tabElements: 'Elements',
      tabFeatures: 'Features',
      balance: 'Balance',
      owned: 'OWNED',
      buy: 'BUY',
      free: 'FREE',
      locked: 'Locked - pull the rope to shop',
      needStars: 'Need {n} more stars',
      bought: 'Purchased {name} for {price} stars',
      notEnough: 'Not enough stars for {name} ({price} needed)',
      earnDiscovery: '+{n} stars · new discovery',
      earnDaily: '+{n} stars · daily reward',
      hint: 'Drag the rope down to open the shop',
      close: 'Close',
      spendHint: 'Your stars are your rank progress — buying spends them and can downrank you',
      dynMode: 'Dynamic pricing: each item costs {pct}% of your {stars} ★ balance',
      rankNow: '{rank} · {stars} ★ left',
      f: {
        xray: 'X-Ray Vision',
        xray_d: 'See electron clouds around every atom',
        proton: 'Proton Gun',
        proton_d: 'Transmute atoms by firing protons',
        timeSpeed: 'Time Acceleration',
        timeSpeed_d: 'Unlocks fast-forward beyond 1x',
        timeStop: 'Time Stop',
        timeStop_d: 'Freeze the world mid-reaction',
        mayhem: 'Mayhem Reactions',
        mayhem_d: 'Explosive, cinematic reaction set',
        console: 'Developer Console',
        console_d: 'Script the scene from the console'
      }
    },
    vi: {
      title: 'Cửa hàng tiếp tế',
      tabElements: 'Nguyên tố',
      tabFeatures: 'Tính năng',
      balance: 'Số dư',
      owned: 'ĐÃ SỞ HỮU',
      buy: 'MUA',
      free: 'MIỄN PHÍ',
      locked: 'Đang khoá - kéo dây thừng để mở cửa hàng',
      needStars: 'Cần thêm {n} sao nữa',
      bought: 'Đã mua {name} với {price} sao',
      notEnough: 'Không đủ sao cho {name} (cần {price})',
      earnDiscovery: '+{n} sao · phát hiện mới',
      earnDaily: '+{n} sao · thưởng hằng ngày',
      hint: 'Kéo dây thừng xuống để mở cửa hàng',
      close: 'Đóng',
      spendHint: 'Sao cũng chính là tiến độ cấp bậc — mua sắm sẽ tiêu sao và có thể hạ cấp bạn',
      dynMode: 'Giá động: mỗi món tốn {pct}% số dư {stars} ★ của bạn',
      rankNow: '{rank} · còn {stars} ★',
      f: {
        xray: 'Tia X',
        xray_d: 'Nhìn thấy đám mây electron quanh mỗi nguyên tử',
        proton: 'Súng proton',
        proton_d: 'Biến đổi nguyên tố bằng cách bắn proton',
        timeSpeed: 'Tăng tốc thời gian',
        timeSpeed_d: 'Mở khoá tua nhanh trên 1x',
        timeStop: 'Đóng băng thời gian',
        timeStop_d: 'Dừng thế giới giữa phản ứng',
        mayhem: 'Phản ứng hỗn loạn',
        mayhem_d: 'Bộ phản ứng bùng nổ, đậm chất điện ảnh',
        console: 'Console lập trình viên',
        console_d: 'Điều khiển cảnh bằng lệnh console'
      }
    }
  };

  var state = { elements: [], features: [], seenHint: false };
  var ownedElements = new Set();
  var ownedFeatures = new Set();
  var listeners = [];
  var rig = null, rope = null, panel = null, balanceEl = null;
  var tab = 'elements';
  var api = null;

  function lang() {
    try {
      if (api && api.i18n && typeof api.i18n.getLang === 'function') return api.i18n.getLang();
    } catch (e) {}
    var s = 'en';
    try { s = localStorage.getItem('mol3d.lang'); } catch (e2) {}
    return s === 'vi' ? 'vi' : 'en';
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

  function tierOf(z) {
    for (var i = 0; i < TIERS.length; i++) if (z <= TIERS[i].maxZ) return TIERS[i];
    return TIERS[TIERS.length - 1];
  }
  function featureById(id) {
    for (var i = 0; i < FEATURES.length; i++) if (FEATURES[i].id === id) return FEATURES[i];
    return null;
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
    try {
      localStorage.removeItem(LEGACY_SAVE_KEY);
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) { save(); return; }
      var d = JSON.parse(raw);
      if (d && typeof d === 'object') {
        state.elements = Array.isArray(d.elements) ? d.elements : [];
        state.features = Array.isArray(d.features) ? d.features : [];
        state.seenHint = !!d.seenHint;
      }
    } catch (e) {}
    ownedElements = new Set(state.elements);
    ownedFeatures = new Set(state.features);
  }
  function save() {
    state.elements = Array.from(ownedElements);
    state.features = Array.from(ownedFeatures);
    delete state.stars;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  function ownsElement(z) {
    if (!z || z <= FREE_MAX_Z) return true;
    if (z > 118) return true;
    return ownedElements.has(z);
  }
  function ownsFeature(id) {
    if (!featureById(id)) return true;
    return ownedFeatures.has(id) || rankQualifies(id);
  }
  function rankQualifies(id) {
    try {
      var map = api.progression.featureRanks();
      var reqId = map && map[id];
      if (!reqId) return false;
      var order = api.progression.ranks();
      var reqIdx = -1;
      for (var i = 0; i < order.length; i++) if (order[i].id === reqId) reqIdx = i;
      if (reqIdx < 0) return false;
      return api.progression.rankManager.getCurrentRank().rankIndex >= reqIdx;
    } catch (e) {
      return false;
    }
  }
  function blocksFeature(id) {
    var f = featureById(id);
    if (!f || ownedFeatures.has(id)) return false;
    return !rankQualifies(id);
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

  function buyElement(z) {
    var el = elementByZ(z);
    if (!el) return;
    if (ownsElement(z)) return;
    var price = priceOf(tierOf(z).price);
    if (balance() < price || !spend(price)) {
      status('⚠ ' + fmt(S('notEnough'), { name: nameOf(el), price: price }), 'err');
      shake();
      return;
    }
    ownedElements.add(z);
    save();
    render();
    rebuildPool();
    announce(price, nameOf(el));
    pop(el);
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
  function elementByZ(z) {
    var list = (api && api.ELEMENTS) || [];
    for (var i = 0; i < list.length; i++) if (list[i].z === z) return list[i];
    return null;
  }
  function buyableElements() {
    var list = (api && api.ELEMENTS) || [];
    return list.filter(function(el) { return el.z > FREE_MAX_Z; });
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
    var consoleBtn = document.getElementById('btn-console');
    if (consoleBtn) consoleBtn.classList.toggle('feature-locked', blocksFeature('console'));
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

  function ownershipSig() {
    return tab + '|' + lang() + '|' + ownedElements.size + '|' + Array.from(ownedFeatures).sort().join(',');
  }

  // Star changes fire on every discovery; rebuilding 90+ cards for that is wasteful,
  // so the cheap path only refreshes the chips and the affordability styling.
  // The chips must be rewritten too: with dynamic pricing the number depends on balance.
  function refreshAffordability() {
    if (!panel) return;
    var b = balance();
    panel.querySelectorAll('.shop-card[data-base], .shop-row[data-base]').forEach(function(node) {
      var owned = node.classList.contains('is-owned');
      var p = priceOf(Number(node.dataset.base), Number(node.dataset.min));
      node.classList.toggle('is-poor', !owned && b < p);
      if (owned) return;
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
    var sig = ownershipSig();
    if (renderedTab === tab && renderedSig === sig) {
      refreshAffordability();
      return;
    }
    body.innerHTML = '';
    if (tab === 'elements') body.appendChild(elementGrid());
    else body.appendChild(featureList());
    panel.querySelectorAll('.shop-tab').forEach(function(b) {
      b.classList.toggle('on', b.dataset.tab === tab);
    });
    renderedTab = tab;
    renderedSig = sig;
  }

  function elementGrid() {
    var wrap = document.createElement('div');
    wrap.className = 'shop-grid';
    buyableElements().forEach(function(el) {
      var tier = tierOf(el.z);
      var owned = ownsElement(el.z);
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'shop-card' + (owned ? ' is-owned' : '') + (balance() >= priceOf(tier.price) ? '' : ' is-poor');
      card.dataset.z = String(el.z);
      card.dataset.base = String(tier.price);
      card.innerHTML =
        '<span class="shop-card-sym">' + esc(el.sym) + '</span>' +
        '<span class="shop-card-name">' + esc(nameOf(el)) + '</span>' +
        '<span class="shop-card-stars">' + starRow(tier.stars, 5) + '</span>' +
        '<span class="shop-card-price">' + priceChip(owned, priceOf(tier.price)) + '</span>';
      card.addEventListener('click', function() { buyElement(el.z); });
      wrap.appendChild(card);
    });
    var note = document.createElement('div');
    note.className = 'shop-note';
    note.textContent = 'Z ≤ ' + FREE_MAX_Z + ' · ' + S('free');
    wrap.appendChild(note);
    wrap.appendChild(ledgerNote());
    return wrap;
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
      '  transition:opacity .35s;background:rgba(8,14,30,.72);padding:2px 8px;border-radius:8px;}',
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
      '.shop-dyn{display:block;padding:6px 12px;font-size:10px;font-weight:600;color:#ffcf5c;',
      '  background:rgba(255,207,92,.10);border-bottom:1px solid var(--border);}',
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
      '.shop-card-stars{font-size:9px;color:#ffcf5c;letter-spacing:1px;line-height:1;}',
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
      '.shop-note{grid-column:1/-1;font-size:10px;color:var(--muted);padding-top:4px;}',
      '.shop-ledger-note{color:var(--accent);opacity:.85;line-height:1.4;}',
      '.shop-pop{position:fixed;z-index:10005;pointer-events:none;transform:translate(-50%,-50%);',
      '  font-weight:800;font-size:20px;color:#ffcf5c;text-shadow:0 0 14px rgba(255,207,92,.75);',
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
      version: 1,
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
      dynamicPricing: { threshold: PCT_THRESHOLD, rate: PCT_RATE },
      catalogue: { features: FEATURES, tiers: TIERS, freeMaxZ: FREE_MAX_Z },
      exportState: function() {
        return { version: 2, elements: Array.from(ownedElements), features: Array.from(ownedFeatures) };
      },
      importState: function(d) {
        if (!d || typeof d !== 'object') return false;
        ownedElements = new Set(Array.isArray(d.elements) ? d.elements.map(Number).filter(Number.isFinite) : []);
        ownedFeatures = new Set(Array.isArray(d.features) ? d.features : []);
        state.elements = Array.from(ownedElements);
        state.features = Array.from(ownedFeatures);
        save();
        render();
        refreshFeatureLocks();
        return true;
      },
      reset: function() {
        ownedElements.clear();
        ownedFeatures.clear();
        save();
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
        b.textContent = b.dataset.tab === 'elements' ? S('tabElements') : S('tabFeatures');
      });
      render();
      icons();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach);
  else attach();
})();
