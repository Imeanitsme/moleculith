// Proton Gun & Nuclear Fission System - Standalone module
(function() {
  'use strict';
  let active = false;
  let timerInterval = null;
  let timerAtomId = null;
  let criticalOverlay = null;
  let redFlash = null;

  const NOBLE_GASES = new Set([2, 10, 18, 36, 54, 86, 118]);

  // The nuclides that actually fission on capturing a slow neutron - the fissile
  // set, keyed Z-A. Everything else heavier than bismuth just grows heavier:
  // U-238 is fertile, not fissile, and a neutron it catches turns it into U-239
  // rather than into two fragments. Breeding Pu-239 out of U-238 is the real
  // reactor route, and the decay engine walks it.
  const FISSILE = new Set(['92-233', '92-235', '94-239', '94-241', '95-242', '96-249', '96-251', '96-252']);
  function isFissile(z, a) { return FISSILE.has(Math.round(z) + '-' + Math.round(a)); }

  // Decay-mode glyphs, language-independent on purpose; the sentences around
  // them are translated, the physics symbols are not.
  const MODE_GLYPH = { alpha: 'α', betaMinus: 'β⁻', betaPlus: 'β⁺', electronCapture: 'electron capture', fission: 'spontaneous-fission' };

  // Whether a shot neutron splits the nucleus it hits is an energy question, not
  // only a species question. The gun's neutrons come out at fission speed, about
  // 2 MeV, because that is what a neutron emitted by a fission is. At that energy
  // the evaluated cross sections of U-238 read about 0.1 barn for fission against
  // roughly 0.3 barn for radiative capture - the 1/v capture has fallen a long way
  // from its 2.7 barn thermal value - so about one interaction in four splits it
  // and three in four just add a mass unit. A fissile nucleus has no such lottery:
  // thermal neutrons split it, and a fast one only makes sure of it.
  const FAST_FISSION_CHANCE = 0.25;
  // The split itself is prompt (about 1e-14 s after capture). The countdown is not
  // a physical delay pretending to be one; it is the warning the player gets for a
  // nucleus they just turned into U-236*.
  const CRITICAL_SECONDS = 3;
  // Fast neutrons cross the assembly quickly, and every generation leaves the
  // pile more dispersed than the last. Real bare masses multiply for a handful of
  // generations and stop; a scene full of uranium must stop too, or one shot keeps
  // firing long after the player has let go of the trigger.
  const CHAIN_RADIUS = 7, MAX_CHAIN_GEN = 4;
  // Fragment speeds are exact in ratio (momentum is equal and opposite) and scaled
  // here so the flight reads on screen: the real 5 % of light speed is a number no
  // camera in this build could follow.
  const FRAG_SPEED = 150, NEUTRON_MASS_MEV = 931.494;

  function showStatus(msg, kind) {
    const el = document.getElementById('status-text');
    if (el) { el.textContent = msg; el.className = kind || 'info'; }
  }

  function esc(v) { return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function tt(key, params) {
    const i18n = window.__mol3d && window.__mol3d.i18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, params) : key;
  }

  // --- Strings the gun owns ---
  // The panel text cannot live in the app's i18n bundle (that file is not this
  // module's to edit), so both languages ship here, exactly like the fission
  // cinematic's CINE_STR below. L() still prefers the game's t() whenever that
  // table answers the key, so the strings can be moved over later untouched.
  const STR = {
    en: {
      panelTitle: 'Neutron + Proton gun',
      mProton: 'Proton',
      mNeutron: 'Neutron',
      kProton: 'proton',
      kNeutron: 'neutron',
      modeHint: 'Click an atom to fire the selected particle.',
      ammoProton: 'Proton ammo',
      ammoNeutron: 'Neutron ammo',
      ammoUnknown: 'not readable',
      buyButton: 'buy {n}',
      buyNote: '{price}★ each, in the Rope Shop',
      buyNoteNoPrice: 'priced in the Rope Shop',
      lastShot: 'Last shot',
      none: 'nothing fired yet',
      isotopeLine: 'A={a} = Z{z} + N{n}',
      modeSet: 'Firing {kind}s — every shot spends 1 {kind} ({price}★ in the Rope Shop).',
      modeSetNoPrice: 'Firing {kind}s — every shot spends 1 {kind} from the Rope Shop.',
      armedNote: 'Mode: {kind} · {left} left',
      noAmmo: 'No {kind}s left — each one costs {price}★ in the Rope Shop. Drag the rope to open it; nothing was fired and nothing was spent.',
      noAmmoNoPrice: 'No {kind}s left — buy them in the Rope Shop. Drag the rope to open it; nothing was fired.',
      spent: '· 1 {kind} spent, {left} left',
      spentUnknown: '· 1 {kind} spent',
      refunded: 'The {kind} is back in the magazine — that shot was not possible, so nothing was spent.',
      ammoApiMissing: 'The shop exposes no ammo stock, so shots stay free.',
      neutronAdded: 'Neutron captured: {sym}-{a} (Z={z}, N={n}) — the element and its chemistry are unchanged.',
      inBand: 'Inside the band of stability: the heaviest stable isotope of {sym} is {sym}-{max}.',
      neutronRich: '⚠ {sym}-{a} is neutron-rich: the heaviest stable isotope of {sym} is {sym}-{max}. The measured charts list no beta half-life for {sym}-{a}, electron or positron, so this build lets it sit.',
      noStable: '⚠ {sym} has no stable isotope at all, so every nucleus of it carries a decay time. The measured charts list none for {sym}-{a}, so this build lets it sit.',
      betaMeasured: '☢ {sym}-{a} is a measured beta-minus emitter: it gives up an electron and becomes {daughter}-{da}, with a half-life of {life}. This build counts that clock down.',
      betaChain: 'Its path to stability: {chain}.',
      betaPlusMeasured: '☢ {sym}-{a} is a measured positron emitter: a proton inside it turns into a neutron, throws out a positron, and the nucleus becomes {daughter}-{da}, with a half-life of {life}. This build counts that clock down.',
      betaChainStop: 'The chain reads: {chain}. It comes to rest on {end}, which the charts list as {why}, so the run stops short of a stable nucleus and this build does not pretend otherwise.',
      chainWhyEc: 'a pure electron-capture nuclide - an orbital electron falling in is not a positron flying out, and this build runs neither',
      chainWhyOther: 'a decay mode other than the beta one counted here',
      chainWhyNone: 'nothing the charts measure for it at all',
      chainWhyHeavy: 'bismuth or heavier, where the measured decay chain of the proton number owns the nucleus',
      chainWhyLong: 'still decaying, further than this panel prints a chain',
      heavy: '☢ {sym}-{a} caught the neutron and grew heavier. It is not fissile, so a neutron at fission speed only had about one chance in {p} of splitting it, and this time it lost. The charts measure {sym}-{a} as a {mode} emitter with a half-life of {life}, and the decay engine runs that clock.',
      heavyModel: '☢ {sym}-{a} caught the neutron and grew heavier. It is not fissile, so a neutron at fission speed only had about one chance in {p} of splitting it, and this time it lost. No chart measures this isotope, so the liquid-drop model in this build estimates it as a {mode} emitter with a half-life of {life}, and the decay engine runs that estimate.',
      heavyNoClock: '☢ {sym}-{a} caught the neutron and grew heavier. It is not fissile, so a neutron at fission speed only had about one chance in {p} of splitting it, and this time it lost. No chart measures a half-life for it, so this build lets it sit.',
      fissionShot: '☢ {parent} fissioned: {f1} + {f2} and {nu} prompt neutron(s), ≈ {energy} released ({src}). Both fragments are new nuclei — neutron-rich, beta-radioactive, and flying apart.',
      chainNote: ' · {n} of its neutrons struck another fissile nucleus; the chain runs on.',
      fragMissing: ' · {f} found no room in the scene, so only one half of the split is in front of you.',
      fissionDeclined: '☢ {parent} finds no pair of fragments that releases energy, so this build leaves it one nucleus instead of inventing two.',
      srcMeasured: 'measured',
      srcModel: 'model estimate',
      pastAll: '⚠ {sym}-{a} is a long way past the band of stability ({sym}-{max} is the heaviest stable one). The charts do measure isotopes of {sym} this heavy, so the nucleus holds together — anything past the drip line is thrown straight back out instead of kept.',
      // Prompt nucleon emission: past the drip line the last nucleon is not bound,
      // so the shot lands and leaves again in the same breath. Both facts belong in
      // one sentence, or the player reads a captured particle in a nucleus that
      // gave it back.
      edgeHeaviest: 'heaviest',
      edgeLightest: 'lightest',
      boundMeasured: '{limit} is the {edge} isotope of {sym} ever measured',
      boundModel: 'no nucleus the liquid-drop model in this build can bind reaches that mass',
      ejectN: '{n} {kind}(s)',
      promptEject: '⚠ The {kind} was captured and made {comp}, but {comp} sits past the {line} drip line ({bound}). It cannot hold that: {shot} flew straight back out, and {final} is the nucleus standing in the scene now.',
      // The energy the same ejection carries away. Every number here is computed
      // from the semi-empirical mass formula, so the sentence is only printed when
      // the model can actually price the nucleus - and it says so when it cannot.
      ejectEnergy: '{q} of binding energy was released over {n} ejected nucleon(s); the fastest of them left at about {v} — one crossing of the nucleus in {t}, which is the "prompt" in prompt emission.',
      ejectBoundAnyway: 'The charts refuse this nucleus by weight, but the liquid-drop model in this build still binds that nucleon (S = {s} MeV), so no ejection energy can be quoted — the refusal is measured, the binding is modelled.',
      ejectNoModel: 'No mass model in this build can price that nucleus, so the ejection is reported without an energy.',
      ejectLight: 'That nucleus is too light for the liquid-drop model to price (it needs A ≥ {min}, this one has A = {a}), so the ejection is reported without an energy.',
      ejectImplausible: 'The liquid-drop model returns Q = {q} MeV for that ejection, above the {max} MeV where a one-nucleon separation energy stops being believable, so the number is dropped rather than shown.',
      ejectPartial: ' {n} of the ejected nucleon(s) fell outside the range the model can price, so that energy covers only the steps it can stand behind.',
      ejectSevered: ' The nucleus left behind is a noble gas, so {n} bond(s) were severed.',
      shotLost: 'The {kind} flew all the way to a nucleus that has since left the scene, so nothing was captured.',
      vInBand: 'in the band',
      vRich: 'neutron-rich',
      vPast: 'past every measured isotope',
      vNoStable: 'no stable isotope',
      vHeavy: 'radioactive by proton number',
      vBeta: 'measured β⁻ emitter',
      vBetaP: 'measured β⁺ emitter',
      close: 'Close'
    },
    vi: {
      panelTitle: 'Súng neutron + proton',
      mProton: 'Proton',
      mNeutron: 'Neutron',
      kProton: 'proton',
      kNeutron: 'neutron',
      modeHint: 'Bấm vào một nguyên tử để bắn hạt đang chọn.',
      ammoProton: 'Đạn proton',
      ammoNeutron: 'Đạn neutron',
      ammoUnknown: 'không đọc được',
      buyButton: 'mua {n}',
      buyNote: 'mỗi hạt {price}★, mua ở Cửa hàng Dây thừng',
      buyNoteNoPrice: 'có bán trong Cửa hàng Dây thừng',
      lastShot: 'Lần bắn cuối',
      none: 'chưa bắn phát nào',
      isotopeLine: 'A={a} = Z{z} + N{n}',
      modeSet: 'Đang bắn {kind} — mỗi phát tốn 1 {kind} ({price}★ ở Cửa hàng Dây thừng).',
      modeSetNoPrice: 'Đang bắn {kind} — mỗi phát tốn 1 {kind} từ Cửa hàng Dây thừng.',
      armedNote: 'Chế độ: {kind} · còn {left} viên',
      noAmmo: 'Hết {kind} — mỗi hạt giá {price}★ trong Cửa hàng Dây thừng. Kéo sợi dây để mở cửa hàng; không phát nào được bắn và không tốn gì.',
      noAmmoNoPrice: 'Hết {kind} — hãy mua trong Cửa hàng Dây thừng. Kéo sợi dây để mở cửa hàng; không phát nào được bắn.',
      spent: '· đã dùng 1 {kind}, còn {left}',
      spentUnknown: '· đã dùng 1 {kind}',
      refunded: 'Hạt {kind} đã được trả lại băng đạn — phát đó không thể thực hiện nên bạn không tốn gì.',
      ammoApiMissing: 'Cửa hàng không cung cấp kho đạn, nên mỗi phát vẫn miễn phí.',
      neutronAdded: 'Đã bắt một neutron: {sym}-{a} (Z={z}, N={n}) — vẫn là nguyên tố cũ, hóa học không đổi.',
      inBand: 'Nằm trong dải bền: đồng vị bền nặng nhất của {sym} là {sym}-{max}.',
      neutronRich: '⚠ {sym}-{a} giàu neutron: đồng vị bền nặng nhất của {sym} là {sym}-{max}. Các bảng đo lường không ghi thời gian bán rã beta nào cho {sym}-{a}, dù là electron hay positron, nên bản này để nó nằm yên.',
      noStable: '⚠ {sym} hoàn toàn không có đồng vị bền, nên mọi hạt nhân của nó đều mang một thời gian phân hủy. Các bảng đo lường không ghi thời gian bán rã cho {sym}-{a}, nên bản này để nó nằm yên.',
      betaMeasured: '☢ {sym}-{a} là chất phát beta-minus đã đo: nó nhả một electron và hóa thành {daughter}-{da}, với thời gian bán rã {life}. Bản này sẽ đếm thời gian bán rã đó.',
      betaChain: 'Đường đi tới bền của nó: {chain}.',
      betaPlusMeasured: '☢ {sym}-{a} là chất phát positron đã đo: một proton trong nó hóa thành neutron, nhả một positron, và hạt nhân trở thành {daughter}-{da}, với thời gian bán rã {life}. Bản này sẽ đếm thời gian bán rã đó.',
      betaChainStop: 'Chuỗi phân rã: {chain}. Nó dừng ở {end}, là hạt nhân mà các bảng đo xếp vào {why}, nên hành trình dừng trước khi tới một hạt nhân bền và bản này không nói khác đi.',
      chainWhyEc: 'chỉ bắt electron - electron quỹ đạo rơi vào hạt nhân chứ không phải positron bay ra, và bản này không chạy cả hai',
      chainWhyOther: 'một kiểu phân rã khác với kiểu beta được đếm ở đây',
      chainWhyNone: 'không được các bảng đo ghi nhận điều gì',
      chainWhyHeavy: 'từ bismuth trở lên, nơi chuỗi phân rã đo được theo số proton nắm hạt nhân',
      chainWhyLong: 'vẫn đang phân rã, xa hơn mức bảng này in ra một chuỗi',
      heavy: '☢ {sym}-{a} đã bắt neutron và nặng thêm. Nó không phải hạt nhân fissile, nên một neutron bay với tốc độ phân hạch chỉ có khoảng một phần {p} cơ hội tách đôi nó, và lần này nó thua. Các bảng đo ghi {sym}-{a} là chất phát {mode} với thời gian bán rã {life}, và công cụ phân rã chạy đúng chiếc đồng hồ đó.',
      heavyModel: '☢ {sym}-{a} đã bắt neutron và nặng thêm. Nó không phải hạt nhân fissile, nên một neutron bay với tốc độ phân hạch chỉ có khoảng một phần {p} cơ hội tách đôi nó, và lần này nó thua. Chưa bảng đo nào ghi đúng đồng vị này, nên mô hình giọt chất lỏng trong bản này ước lượng nó là chất phát {mode} với thời gian bán rã {life}, và công cụ phân rã chạy theo đúng ước lượng đó.',
      heavyNoClock: '☢ {sym}-{a} đã bắt neutron và nặng thêm. Nó không phải hạt nhân fissile, nên một neutron bay với tốc độ phân hạch chỉ có khoảng một phần {p} cơ hội tách đôi nó, và lần này nó thua. Chưa bảng đo nào ghi thời gian bán rã cho nó, nên bản này để nó nằm yên.',
      fissionShot: '☢ {parent} vừa phân hạch: {f1} + {f2} và {nu} neutron tức thời, năng lượng ≈ {energy} ({src}). Hai mảnh là những hạt nhân mới — giàu neutron, phát beta, và đang bay ra xa nhau.',
      chainNote: ' · {n} neutron của nó đã vớ một hạt nhân fissile khác; chuỗi dây chuyền tiếp tục.',
      fragMissing: ' · {f} không còn chỗ trong cảnh, nên chỉ một nửa của vụ tách đôi hiện ra trước mắt bạn.',
      fissionDeclined: '☢ {parent} không có cặp mảnh nào mà phép tách đôi tỏa năng lượng, nên bản này để nó là một hạt nhân thay vì bịa ra hai.',
      srcMeasured: 'số đo thật',
      srcModel: 'ước lượng mô hình',
      pastAll: '⚠ {sym}-{a} nằm rất xa ngoài dải bền ({sym}-{max} là đồng vị bền nặng nhất của {sym}). Các bảng đo vẫn ghi nhận những đồng vị của {sym} nặng đến thế, nên hạt nhân này còn giữ được — thứ gì vượt quá đường nhỏ giọt sẽ bị bắn ngược ra ngay thay vì bị giữ lại.',
      edgeHeaviest: 'nặng nhất',
      edgeLightest: 'nhẹ nhất',
      boundMeasured: '{limit} là đồng vị {edge} của {sym} từng được đo',
      boundModel: 'không hạt nhân nào mà mô hình giọt chất lỏng trong bản này liên kết được chạm tới khối lượng đó',
      ejectN: '{n} hạt {kind}',
      promptEject: '⚠ Bắt được một {kind} và tạo thành {comp}, nhưng {comp} đã vượt đường nhỏ giọt {line} ({bound}). Hạt nhân không giữ nổi: {shot} bay ngược ra ngay tức khắc, và {final} mới là hạt nhân còn lại trong cảnh.',
      ejectEnergy: '{q} năng lượng liên kết được giải phóng qua {n} hạt nucleon bị đẩy ra; hạt nhanh nhất rời đi với tốc độ khoảng {v} — bằng một lần băng qua hạt nhân trong {t}, đó chính là nghĩa của "tức thời".',
      ejectBoundAnyway: 'Các bảng đo từ chối hạt nhân này theo khối lượng, nhưng mô hình giọt chất lỏng trong bản này vẫn liên kết hạt nucleon đó (S = {s} MeV), nên không thể trích ra năng lượng đẩy ra nào — sự từ chối là số đo, còn độ liên kết là mô hình.',
      ejectNoModel: 'Không có mô hình khối lượng nào trong bản này định giá được hạt nhân đó, nên vụ đẩy nucleon được báo cáo mà không kèm năng lượng.',
      ejectLight: 'Hạt nhân đó quá nhẹ để mô hình giọt chất lỏng định giá (cần A ≥ {min}, hạt nhân này chỉ có A = {a}), nên vụ đẩy nucleon được báo cáo mà không kèm năng lượng.',
      ejectImplausible: 'Mô hình giọt chất lỏng trả về Q = {q} MeV cho vụ đẩy đó, vượt quá {max} MeV là ngưỡng mà năng lượng tách một nucleon không còn đáng tin, nên con số bị bỏ đi thay vì hiển thị.',
      ejectPartial: ' {n} nucleon bị đẩy ra nằm ngoài phạm vi mô hình có thể định giá, nên năng lượng trên chỉ bao gồm các bước mà mô hình chắc chắn.',
      ejectSevered: ' Hạt nhân còn lại là khí hiếm, nên {n} liên kết đã bị cắt.',
      shotLost: 'Hạt {kind} đã bay tới một hạt nhân vừa rời khỏi cảnh, nên không có gì được bắt vào.',
      vInBand: 'trong dải bền',
      vRich: 'giàu neutron',
      vPast: 'vượt mọi đồng vị từng đo',
      vNoStable: 'không có đồng vị bền',
      vHeavy: 'phóng xạ theo số proton',
      vBeta: 'chất phát β⁻ đã đo',
      vBetaP: 'chất phát β⁺ đã đo',
      close: 'Đóng'
    }
  };

  // Neither language may be left half-done, and a missing key would otherwise show
  // up as a raw key on screen. Silent while both tables hold the same keys.
  (function checkStrings() {
    var missing = [];
    Object.keys(STR.en).forEach(function (k) { if (typeof STR.vi[k] !== 'string') missing.push('vi.' + k); });
    Object.keys(STR.vi).forEach(function (k) { if (typeof STR.en[k] !== 'string') missing.push('en.' + k); });
    if (missing.length && window.console && console.warn) {
      console.warn('[proton-gun] untranslated strings:', missing.join(', '));
    }
  })();

  function fill(s, params) {
    if (!params) return s;
    Object.keys(params).forEach(function (p) {
      const v = params[p] === undefined || params[p] === null ? '' : String(params[p]);
      s = s.split('{' + p + '}').join(v);
    });
    return s;
  }

  function L(key, params) {
    const viaGame = tt(key, params);
    if (typeof viaGame === 'string' && viaGame !== key) return viaGame;
    const table = STR[cineLang()] || STR.en;
    let s = typeof table[key] === 'string' ? table[key] : STR.en[key];
    if (typeof s !== 'string') return key;
    return fill(s, params);
  }

  // A transmutation moves the crate's books, not its gate: the loan the atom was
  // bought under is re-pointed at the element it has become, so the shot neither
  // restocks the old element nor charges a second unit for the new one. Where a
  // paid-for particle lands is decided by the nucleus, so an element the player has
  // never bought is still a legal destination.
  function crateTransmute(atomId, newZ) {
    const c = window.__mol3d && window.__mol3d.crate;
    if (!c || typeof c.transmute !== 'function') return true;
    return c.transmute(atomId, newZ) === true;
  }

  // ============================ NEUTRON + PROTON GUN ============================
  // The gun used to fire one kind of particle for free. It now fires two, and the
  // magazine lives in the Rope Shop (window.__mol3dShop v3): one particle per shot,
  // and a shot only happens after the shop has handed the particle over.
  const KINDS = ['proton', 'neutron'];
  const BUY_PACK = 10;      // the panel's shortcut buys a pack, never a single shot
  let mode = 'proton';      // proton mode is the original behaviour, unchanged

  function shopApi() { return window.__mol3dShop || null; }
  function shopHasAmmoApi() {
    const s = shopApi();
    return !!(s && typeof s.takeAmmo === 'function');
  }
  function ammoCount(kind) {
    const s = shopApi();
    if (!s || typeof s.ammoOf !== 'function') return null;
    const n = s.ammoOf(kind);
    return (typeof n === 'number' && isFinite(n)) ? Math.max(0, Math.floor(n)) : null;
  }
  // Never a literal price: the catalogue owns both the per-particle cost and the
  // ammo rows that carry it, so a shop-side rebalance reaches these strings as-is.
  function ammoPrice(kind) {
    const s = shopApi();
    const cat = s && s.catalogue;
    if (!cat) return null;
    if (typeof cat.ammoPrice === 'number' && isFinite(cat.ammoPrice) && cat.ammoPrice > 0) {
      return cat.ammoPrice;
    }
    const list = Array.isArray(cat.ammo) ? cat.ammo : [];
    for (let i = 0; i < list.length; i++) {
      const row = list[i];
      if (row && row.id === kind && typeof row.stars === 'number' && row.stars > 0) return row.stars;
    }
    return null;
  }
  function kindKey(kind) { return kind === 'proton' ? 'kProton' : 'kNeutron'; }
  // A shot that never happened hands the particle straight back: paying for
  // nothing is not a fair reading of "you must buy protons and neutrons to shoot".
  // The only transmutation left that can decline is the one past the last element.
  function refundAmmo(kind) {
    const s = shopApi();
    if (s && typeof s.refundAmmo === 'function') s.refundAmmo(kind);
  }
  // Returning the particle is invisible money work, so the status line says so —
  // otherwise the player reasonably believes they paid for a shot that never happened.
  function refundNote(kind) {
    if (!shopHasAmmoApi()) return '';
    return ' ' + L('refunded', { kind: L(kindKey(kind)) });
  }

  // The one call site that decides whether a shot exists at all. A shop that
  // exposes no ammo API is the pre-v3 build, where shots were free; the gun keeps
  // working there instead of silently bricking itself.
  function spendAmmo(kind) {
    const s = shopApi();
    if (!s || typeof s.takeAmmo !== 'function') return { ok: true, legacy: true, left: null };
    if (s.takeAmmo(kind) === true) return { ok: true, legacy: false, left: ammoCount(kind) };
    return { ok: false, legacy: false, left: ammoCount(kind) };
  }

  function refuseForAmmo(kind) {
    const price = ammoPrice(kind);
    const params = { kind: L(kindKey(kind)), price: price };
    showStatus('⚠ ' + (price === null ? L('noAmmoNoPrice', params) : L('noAmmo', params)), 'err');
    const s = shopApi();
    // Point at the rope instead of opening a panel over the scene: the player was
    // aiming at an atom, and the shop is one drag away.
    if (s && typeof s.flash === 'function') s.flash();
    setLastShot(null, null);
    paintGun();
  }

  function spendTail(paid, kind) {
    if (!paid || paid.legacy) return '';
    const params = { kind: L(kindKey(kind)), left: paid.left };
    return ' ' + (paid.left === null ? L('spentUnknown', params) : L('spent', params));
  }

  // --- The neutron ledger ---
  // An atom in this build carries nothing but its element, so isotope mass cannot
  // live on the atom (and must not live on ELEMENTS, which is shared by every atom
  // of that element). This Map of atomId -> the nucleus itself is the record: it
  // survives repeated shots at the same atom, travels with the nucleus when a
  // proton shot moves it up a row or a decay turns it into another element, and is
  // pruned so a deleted atom cannot leak.
  const neutronLedger = new Map();
  const LEDGER_PRUNE_MS = 2000;
  const LEDGER_KEY = 'mol3d.isotopes.v1';

  // The ledger is written to storage because a shot is bought with a star: a
  // reload that forgot the isotope would take the nucleus back and leave the
  // player holding nothing they paid for. Every record carries the Z it was shot
  // into, because ids are reused after a clear - an id alone would let the spare
  // neutron of a 14C land on the next carbon to inherit that number. A record
  // that no longer matches its atom reads as nothing and is swept away, so an
  // edited file can fail to show an isotope but cannot invent one.
  function liveAtom(atomId) {
    const atoms = window.__mol3d && window.__mol3d.atoms;
    return atoms && typeof atoms.get === 'function' ? atoms.get(atomId) : null;
  }
  // A record is the gun's word that this exact nucleus is not the one the element
  // ships with, and it keeps the mass number itself. "Extra neutrons over the
  // natural average" cannot say a nucleus is lighter than that average: helium-3 is
  // one neutron short of the 4 the periodic table prints, and a beta decay leaves
  // daughters like that behind. The surplus is still available for the places that
  // show it, derived from the record instead of kept beside it.
  function aOf(rec) {
    if (typeof rec.a === 'number') return rec.a;
    return baseA(findElement(rec.z) || { z: rec.z, mass: null }) + rec.n;
  }
  function recordOf(atomId) {
    const rec = neutronLedger.get(atomId);
    if (!rec) return null;
    const atom = liveAtom(atomId);
    if (atom && atom.el && atom.el.z !== rec.z) return null;
    return rec;
  }
  function hasIsotopeRecord(atomId) { return recordOf(atomId) !== null; }
  function excessOf(atomId) {
    const rec = recordOf(atomId);
    if (!rec) return 0;
    const atom = liveAtom(atomId);
    const el = (atom && atom.el) || findElement(rec.z) || { z: rec.z, mass: null };
    return aOf(rec) - baseA(el);
  }
  function saveLedger() {
    const rows = [];
    neutronLedger.forEach(function (rec, id) {
      rows.push(typeof rec.a === 'number' ? [id, rec.z, rec.n, rec.a] : [id, rec.z, rec.n]);
    });
    try { localStorage.setItem(LEDGER_KEY, JSON.stringify(rows)); } catch (e) {}
  }
  function loadLedger() {
    let rows;
    try { rows = JSON.parse(localStorage.getItem(LEDGER_KEY) || '[]'); } catch (e) { return; }
    if (!Array.isArray(rows)) return;
    for (const row of rows) {
      if (!Array.isArray(row) || row.length < 3) continue;
      const z = Number(row[1]);
      if (!(z > 0)) continue;
      // A four-column row is a nucleus. A three-column row is the older record of
      // a surplus, which still reads the same way it did before it was stored as a
      // mass number - so a reload keeps every isotope a player paid for.
      const a = Math.floor(Number(row[3]));
      if (a > 0) { neutronLedger.set(row[0], { z: z, n: Math.floor(Number(row[2])) || 0, a: a }); continue; }
      const n = Math.floor(Number(row[2]));
      if (!(n > 0)) continue;
      neutronLedger.set(row[0], { z: z, n: n });
    }
  }
  function pruneLedger() {
    const atoms = window.__mol3d && window.__mol3d.atoms;
    if (!atoms || typeof atoms.has !== 'function') return;
    let swept = false;
    neutronLedger.forEach(function (rec, id) {
      const atom = atoms.has(id) ? atoms.get(id) : null;
      if (!atom || !atom.el || atom.el.z !== rec.z) { neutronLedger.delete(id); swept = true; }
    });
    if (swept) saveLedger();
  }
  // The record a decay leaves behind. The daughter is a real nucleus with a real
  // mass number, so it is written as that and the surplus over the natural average
  // is whatever falls out, rather than the other way round. The surplus is stored
  // beside it because a build older than this one reads that column as the whole
  // record, and a-baseline is exactly what it would have needed.
  function setNuclide(atomId, z, a) {
    const Z = Math.floor(Number(z)), mass = Math.floor(Number(a));
    if (!(Z > 0) || !(mass > 0)) { neutronLedger.delete(atomId); saveLedger(); return false; }
    neutronLedger.set(atomId, { z: Z, n: mass - baseA(findElement(Z) || { z: Z, mass: null }), a: mass });
    saveLedger();
    return true;
  }

  // The app's own masses are standard atomic weights, so the nucleus a player
  // placed is, to within a hair, the element's dominant natural isotope. That is
  // the baseline the ledger adds to; a broken row falls back to a symmetric one.
  function baseA(el) {
    const z = (el && typeof el.z === 'number') ? el.z : 1;
    const m = (el && typeof el.mass === 'number' && isFinite(el.mass)) ? Math.round(el.mass) : null;
    return (m !== null && m >= z) ? m : Math.max(1, z * 2 - 1);
  }
  function massNumberOf(atomId, atom) {
    const rec = recordOf(atomId);
    return rec ? aOf(rec) : baseA(atom.el);
  }
  function isotopeOf(el, a) { return { sym: el.sym, a: a, z: el.z, n: a - el.z, label: el.sym + '-' + a }; }
  function isotopeOfAtom(atomId, atom) { return isotopeOf(atom.el, massNumberOf(atomId, atom)); }

  // The engine paints atom labels while it boots, which lands between this file
  // running and init(), so the record and the reader that exposes it both have to
  // exist now - otherwise every restored nucleus comes back wearing its plain
  // element symbol and the mass a player paid a star for is invisible.
  loadLedger();
  if (!window.__protonGun) {
    window.__protonGun = {
      neutronExcessOf: excessOf,
      hasIsotopeRecord: hasIsotopeRecord,
      setNuclide: setNuclide,
      isotopeOf: function (atomId) {
        const atom = liveAtom(atomId);
        return atom ? isotopeOfAtom(atomId, atom) : null;
      },
      // The cinematic is twelve seconds of white screen before any of its text is
      // readable, so the panels stay reachable from here for testing and for the
      // console alike.
      fissionEvent: cineEvent,
      fissionPreview: cinePreview
    };
  }

  // Heaviest isotope that is stable, or so long-lived it still occurs in nature,
  // per atomic number: the standard table of primordial nuclides, indexed by Z and
  // ending at bismuth-209. 43 and 61 are 0 because no isotope of technetium or
  // promethium is stable, and nothing above 83 is tabulated: this build already
  // treats every Z > 82 as radioactive, which is a louder statement than the band.
  const STABLE_MAX_A = [
    0,
    2, 4, 7, 9, 11, 13, 15, 18, 19, 22,
    23, 26, 27, 30, 31, 36, 37, 40, 41, 48,
    45, 50, 51, 54, 55, 58, 59, 64, 65, 70,
    71, 76, 75, 82, 81, 86, 85, 88, 89, 96,
    93, 100, 0, 104, 103, 110, 109, 116, 115, 124,
    123, 130, 127, 136, 133, 138, 139, 142, 141, 150,
    0, 154, 153, 160, 159, 164, 165, 170, 169, 176,
    176, 180, 181, 186, 187, 192, 193, 198, 197, 204,
    205, 208, 209
  ];
  const MAX_STABLE_Z = STABLE_MAX_A.length - 1;
  // How far past the band a nucleus has to sit before the status line stops calling
  // it merely neutron-rich and calls it absurd. This is a wording threshold and not
  // a physical limit - the physical one is `dripLine` below, which is drawn from
  // what the charts actually measure. Nothing here refuses a shot.
  const DRIP_GUARD = 14;

  function stabilityVerdict(z, a) {
    if (z > MAX_STABLE_Z) return { key: 'heavy', verdictKey: 'vHeavy', bandMax: null };
    const lim = STABLE_MAX_A[z] || 0;
    if (lim === 0) return { key: 'noStable', verdictKey: 'vNoStable', bandMax: 0 };
    if (a <= lim) return { key: 'inBand', verdictKey: 'vInBand', bandMax: lim };
    if (a <= lim + DRIP_GUARD) return { key: 'neutronRich', verdictKey: 'vRich', bandMax: lim };
    return { key: 'pastAll', verdictKey: 'vPast', bandMax: lim };
  }

  // --- The drip lines --------------------------------------------------------
  // `stabilityVerdict` answers "will this nucleus decay". This answers the louder
  // question "can this nucleus be built at all": past the drip line the newest
  // nucleon is not bound, and the compound nucleus throws it back out in about
  // 10^-22 s - prompt emission, faster than any clock this build runs. A shot that
  // lands there has to be answered by a particle flying out again, not by a
  // quieter status line.
  //
  // The line is drawn from data rather than from a formula, because the formula is
  // not good enough for the job. For a proton number the charts give a span: every
  // nuclide either measured chart names for it, plus the heaviest primordial
  // isotope, plus the isotope the element table itself ships - and an isotope no
  // chart has ever seen at all is treated as unbound. The measured minimum is a
  // floor rather than the true proton drip line (the dumps are cut off at
  // beta-stable-ish territory on that side), which is why the light edge only ever
  // costs a nucleus a proton when it is genuinely far below the band.
  //
  // Above Z 82 both charts keep silent on purpose, so the semi-empirical mass
  // formula takes over and asks the question it is actually good at: is the
  // separation energy positive? S_n = B(Z,A) - B(Z,A-1) and
  // S_p = B(Z,A) - B(Z-1,A-1) of zero or less is the model saying the same thing
  // the charts say by absence.
  const MAX_MEASURED_Z = 82;
  // The charts are cut off on the proton-rich side for reasons of detection, not
  // of existence, so their light edge sits inside the real drip line. A nucleus has
  // to clear that edge by this much before the build calls it unbound - the mirror
  // of the neutron side, where the measured maximum really is the line, because a
  // nuclide that exists for 10^-21 s is still in the dump.
  const PROTON_GUARD = 3;
  const dripSpans = new Map();

  function chartKnown(z, a) {
    const B = window.__mol3dBeta, BP = window.__mol3dBetaPlus;
    if (B && z <= B.MAX_Z && (B.isBetaRadioactive(z, a) || B.isTabulatedStable(z, a))) return true;
    if (BP && z <= BP.MAX_Z && (BP.isPositronRadioactive(z, a) || BP.isElectronCaptureOnly(z, a) ||
      BP.isTabulatedStable(z, a))) return true;
    return false;
  }

  // Widest span of mass numbers a nucleus of this proton number is known to occupy.
  // Null means the charts say nothing about the element at all, which is not a
  // licence to strip a nucleus down to nothing - it means the model is asked.
  function measuredSpan(z) {
    if (dripSpans.has(z)) return dripSpans.get(z);
    if (!window.__mol3dBeta && !window.__mol3dBetaPlus) return null;
    let lo = 0, hi = 0;
    for (let a = z; a <= z + 250; a++) {
      if (!chartKnown(z, a)) continue;
      if (!lo) lo = a;
      hi = a;
    }
    const el = findElement(z);
    if (el) {
      const base = baseA(el);
      lo = lo ? Math.min(lo, base) : base;
      hi = Math.max(hi, base);
    }
    const primordial = STABLE_MAX_A[z] || 0;
    if (primordial > hi) hi = primordial;
    const span = lo ? { min: lo, max: hi } : null;
    dripSpans.set(z, span);
    return span;
  }

  // Which line this exact nucleus is past, and where that line runs. Null is the
  // answer for every nucleus that has a chance of existing.
  function dripLine(z, a) {
    if (!(z > 0) || !(a >= z)) return null;
    if (z <= MAX_MEASURED_Z) {
      const span = measuredSpan(z);
      if (span) {
        if (a > span.max) return { kind: 'neutron', limit: span.max, measured: true };
        if (z > 1 && a < span.min - PROTON_GUARD) return { kind: 'proton', limit: span.min, measured: true };
        return null;
      }
    }
    const N = window.__nuclear;
    if (!N || typeof N.binding !== 'function') return null;
    const b = N.binding(z, a);
    if (a > z && b - N.binding(z, a - 1) <= 0) return { kind: 'neutron', limit: null, measured: false };
    if (z > 1 && a - 1 >= z - 1 && b - N.binding(z - 1, a - 1) <= 0) {
      return { kind: 'proton', limit: null, measured: false };
    }
    return null;
  }

  // --- What the ejection actually carries ------------------------------------
  // The line above answers "can this nucleon stay". The semi-empirical mass
  // formula answers the next question, which is a number rather than a yes/no:
  // by how much is it unbound? S_n = B(Z,A) - B(Z,A-1) and
  // S_p = B(Z,A) - B(Z-1,A-1); a negative separation energy is an unbound
  // nucleon, and the exit is exothermic by Q = -S. That Q is not a footnote - it
  // is the kinetic energy the particle leaves with, so the same model that
  // throws the nucleon back out also says how fast it goes.
  //
  // Everything here is computed from the model, never tabulated per case. The
  // masses of the fragments come from the binding energies themselves, so the
  // two-body sharing of Q is momentum conservation rather than a guess.
  const M_N_C2 = 939.565;   // neutron rest energy, MeV
  const M_P_C2 = 938.272;   // proton rest energy, MeV
  const AMU_C2 = 931.494;   // 1 u in MeV, for the residue
  const C_LIGHT = 299792458; // m/s
  const R_NUCLEAR_FM = 1.2; // radius constant of R = r0 A^(1/3), femtometres

  function separationEnergy(z, a, kind) {
    const N = window.__nuclear;
    if (!N || typeof N.binding !== 'function' || !(z > 0) || !(a >= z)) return null;
    if (kind === 'neutron') {
      if (!(a - 1 >= z)) return null;
      return N.binding(z, a) - N.binding(z, a - 1);
    }
    if (!(z > 1 && a - 1 >= z - 1)) return null;
    return N.binding(z, a) - N.binding(z - 1, a - 1);
  }

  // Relativistic speed from a kinetic energy: v = c sqrt(1 - 1/(1 + K/mc^2)^2).
  // A drip-line nucleon leaves with a few MeV, which is ~2% of c, so the
  // non-relativistic sqrt(2K/m) would be within a percent - but this is exact
  // and costs nothing, so nothing has to be excused later.
  function speedFromKinetic(keMeV, restMeV) {
    if (!(keMeV > 0) || !(restMeV > 0)) return 0;
    const g = 1 + keMeV / restMeV;
    return C_LIGHT * Math.sqrt(Math.max(0, 1 - 1 / (g * g)));
  }

  // One nucleon leaving one nucleus. Q is shared by momentum conservation:
  // the particle takes the residue's share of the mass ratio, because the two
  // fly apart with equal and opposite momentum.
  //
  // The liquid drop is fitted to medium and heavy nuclei, and below about
  // A = 20 it is not a description of anything: it prices 4H as if it were a
  // droplet and returns a 20 MeV separation energy for a nucleus that real
  // charts put within a couple of MeV of falling apart. So a step is only
  // quotable inside the model's own domain, and outside it the ejection is
  // still reported - just without an energy the model never earned.
  const SEMF_MIN_A = 20;
  // No measured one-nucleon separation energy reaches 20 MeV, and a nucleus
  // past the drip line gives its nucleon back over a few. Past this ceiling the
  // number is the model failing, not the nucleus talking.
  const Q_PLAUSIBLE_MAX = 12;

  function ejectaStep(z, a, kind) {
    const s = separationEnergy(z, a, kind);
    if (s === null) return null;
    const q = -s;                      // MeV released; <= 0 means the model binds it
    let usable = q > 0, why = usable ? 'ok' : 'bound';
    if (usable && a < SEMF_MIN_A) { usable = false; why = 'light'; }
    if (usable && q > Q_PLAUSIBLE_MAX) { usable = false; why = 'large'; }
    const residueA = a - 1;
    const restParticle = kind === 'neutron' ? M_N_C2 : M_P_C2;
    const restResidue = Math.max(1, residueA) * AMU_C2;
    const keParticle = usable ? q * restResidue / (restResidue + restParticle) : 0;
    const keResidue = usable ? q - keParticle : 0;
    const v = usable ? speedFromKinetic(keParticle, restParticle) : 0;
    // The clock prompt emission runs on: one crossing of the nucleus at that
    // speed, R = r0 A^(1/3). This is where the "about 10^-22 s" in the comment
    // above comes from - it is measured off the geometry, not asserted.
    const radiusM = R_NUCLEAR_FM * Math.pow(Math.max(1, a), 1 / 3) * 1e-15;
    return {
      kind: kind, z: z, a: a, s: s, q: q, usable: usable, why: why,
      keParticle: keParticle, keResidue: keResidue, speed: v,
      transitS: v > 0 ? radiusM / v : null
    };
  }

  // Walk the nucleus back inside the line one nucleon at a time and report what has
  // to leave, step by step with the energy of each step. Null means the nucleus is
  // already somewhere a nucleus can be, which is the case for every ordinary shot.
  function settleNucleus(z, a) {
    const first = dripLine(z, a);
    if (!first) return null;
    let neutrons = 0, protons = 0, cz = z, ca = a, qTotal = 0, steps = [], priced = false;
    for (let guard = 0; guard < 40; guard++) {
      const past = dripLine(cz, ca);
      if (!past) break;
      const step = ejectaStep(cz, ca, past.kind);
      if (step) {
        steps.push(step);
        if (step.usable) { qTotal += step.q; priced = true; }
      }
      if (past.kind === 'neutron') {
        if (!(ca - 1 >= cz)) break;
        ca -= 1; neutrons++;
      } else {
        if (!(cz > 1 && ca - 1 >= cz - 1)) break;
        cz -= 1; ca -= 1; protons++;
      }
    }
    if (!neutrons && !protons) return null;
    const quotable = steps.filter(x => x.usable);
    const fast = quotable.length ? quotable.reduce((m, x) => (x.speed > m.speed ? x : m), quotable[0]) : null;
    return {
      z: z, a: a, finalZ: cz, finalA: ca,
      neutrons: neutrons, protons: protons,
      kind: first.kind, limit: first.limit, measured: first.measured,
      steps: steps, qTotal: priced ? qTotal : null,
      // How many of those steps the model would actually price a particle for:
      // a cascade can mix priceable steps with ones the guards reject, and the
      // energy sentence must count only the nucleons it is really talking about.
      pricedSteps: quotable.length,
      speed: fast ? fast.speed : null,
      transitS: fast ? fast.transitS : null,
      // Which excuse the first unquotable step gives, so the note can name the
      // reason the model cannot price this ejection instead of printing a zero.
      why: steps.length ? (priced ? 'ok' : steps[0].why) : 'none',
      // True when a step was computed but the model binds that nucleon: the
      // refusal came from the measured charts, so the energy line must say so.
      boundDespiteEjection: steps.some(x => x.why === 'bound')
    };
  }

  function nuclideName(z, a) {
    const el = findElement(z);
    return (el ? el.sym : 'Z' + z) + '-' + a;
  }

  // What left the nucleus, in the words of whichever language is showing.
  function ejectedPhrase(s) {
    const parts = [];
    if (s.neutrons) parts.push(L('ejectN', { n: s.neutrons, kind: L('kNeutron') }));
    if (s.protons) parts.push(L('ejectN', { n: s.protons, kind: L('kProton') }));
    return parts.join(' + ');
  }

  // MeV to the units the rest of this build quotes energy in, so an ejection and
  // a fission can be compared by eye rather than by arithmetic.
  function ejectaEnergyPhrase(q) {
    const N = window.__nuclear;
    if (N && typeof N.formatEnergy === 'function') {
      // fissionEnergy reports MeV per fission the same way; keep the same shape.
      const mev = N.formatEnergy(q);
      if (mev && mev !== '—') return mev;
    }
    return q.toFixed(2) + ' MeV';
  }

  function speedPhrase(v) {
    if (!(v > 0)) return '';
    const frac = v / C_LIGHT;
    return (frac * 100).toFixed(1) + '% c (' + Math.round(v / 1000).toLocaleString('en-US') + ' km/s)';
  }

  // The energy sentence that follows the ejection. Every number in it comes from
  // the mass formula; when the mass formula has nothing to say - no model at all,
  // a nucleus too light for the liquid drop, or a model that disagrees with the
  // charts - the line names that reason instead of printing a made-up zero.
  function ejectaEnergyNote(s) {
    if (!s.steps || !s.steps.length) return L('ejectNoModel');
    if (s.qTotal === null) {
      if (s.why === 'bound') return L('ejectBoundAnyway', { s: s.steps[0].s.toFixed(2) });
      if (s.why === 'light') return L('ejectLight', { min: SEMF_MIN_A, a: s.steps[0].a });
      if (s.why === 'large') return L('ejectImplausible', { q: s.steps[0].q.toFixed(1), max: Q_PLAUSIBLE_MAX });
      return L('ejectNoModel');
    }
    return L('ejectEnergy', {
      q: ejectaEnergyPhrase(s.qTotal),
      n: s.pricedSteps,
      v: s.speed ? speedPhrase(s.speed) : '?',
      t: s.transitS ? s.transitS.toExponential(1) + ' s' : '?'
    }) + (s.pricedSteps < s.steps.length
      ? L('ejectPartial', { n: s.steps.length - s.pricedSteps }) : '');
  }

  function ejectionNote(s, finalZ, finalA) {
    const bound = s.measured
      ? L('boundMeasured', {
        limit: nuclideName(s.z, s.limit),
        edge: L(s.kind === 'neutron' ? 'edgeHeaviest' : 'edgeLightest'),
        sym: (findElement(s.z) || { sym: 'Z' + s.z }).sym
      })
      : L('boundModel');
    return L('promptEject', {
      kind: L(s.kind === 'neutron' ? 'kNeutron' : 'kProton'),
      line: L(s.kind === 'neutron' ? 'kNeutron' : 'kProton'),
      comp: nuclideName(s.z, s.a),
      bound: bound,
      shot: ejectedPhrase(s),
      final: nuclideName(finalZ, finalA)
    }) + ' ' + ejectaEnergyNote(s);
  }

  // Put the settled nucleus into the atom: the crate's books first (the element the
  // player owns follows the nucleus, exactly as it does for a capture), then the
  // element the engine draws and reacts with, then the mass number the ledger keeps.
  // That order matters - a record whose Z disagrees with the atom reads as nothing.
  function applyNucleus(atom, atomId, z, a) {
    const el = findElement(z);
    if (!el) return false;
    crateTransmute(atomId, z);
    atom.el = el;
    setNuclide(atomId, z, a);
    return true;
  }

  // Every bond the atom carries. The proton shot has always done this when it
  // landed on a noble gas; now the ejection can land there too, by dropping a
  // proton out of element 19 rather than adding one to element 17.
  function severBonds(atomId) {
    const bonds = window.__mol3d && window.__mol3d.bonds;
    if (!bonds || typeof bonds.delete !== 'function') return 0;
    let broken = 0;
    for (const entry of bonds) {
      const b = entry[1];
      if (b.a === atomId || b.b === atomId) { bonds.delete(entry[0]); broken++; }
    }
    return broken;
  }

  // What the measured charts say about this exact nucleus, worked out once so the
  // status line and the panel cannot drift apart. Null means neither chart has a
  // beta row for it - which is not the same sentence as stable, and is why the band
  // wording below still has a job. Two charts now, because beta decay has two
  // directions: neutron-rich nuclei throw an electron and gain a proton, proton-
  // rich ones throw a positron and lose one. Asking beta-decay.js first is not a
  // preference; the two tables are cut from the same dump and between them name no
  // nucleus twice, so at most one of them has anything to say. Both stop at lead on
  // purpose: bismuth and up belong to the build's proton-number chain, so the panel
  // never promises a clock the engine would not run.
  function betaNote(z, a) {
    const symOf = function (zz) { const e = findElement(zz); return e ? e.sym : 'Z' + zz; };
    const read = function (T, kind) {
      if (!T || z > T.MAX_Z) return null;
      const d = T.daughterOf(z, a);
      if (!d) return null;
      const path = T.pathTo(z, a);
      let chain = symOf(z) + '-' + a;
      for (const s of path.steps) chain += ' →(' + T.formatLife(s.halfLife) + ') ' + symOf(s.to.z) + '-' + s.to.a;
      return {
        kind: kind,
        life: T.formatLife(d.halfLife),
        daughter: symOf(d.z),
        da: d.a,
        shed: kind === 'minus' ? d.neutronsShed : d.protonsShed,
        chain: chain,
        steps: path.steps.length,
        rest: symOf(path.endZ) + '-' + path.endA,
        reason: path.reason
      };
    };
    return read(window.__mol3dBeta, 'minus') || read(window.__mol3dBetaPlus, 'plus');
  }

  // 'path to stability' is a claim about where a chain ends, and the beta tables
  // know four other endings: a nucleus the dump measures as pure electron capture,
  // one it measures as some other mode, one it has never measured, and the top of
  // the table where the proton-number chain takes over. Naming the reason is the
  // difference between a chain and a promise.
  const CHAIN_WHY = {
    electronCapture: 'chainWhyEc',
    otherMode: 'chainWhyOther',
    unlisted: 'chainWhyNone',
    protonChain: 'chainWhyHeavy',
    handedOver: 'chainWhyOther',
    capped: 'chainWhyLong'
  };

  function chainTail(b) {
    if (b.reason !== 'stable') {
      return L('betaChainStop', { chain: b.chain, end: b.rest, why: L(CHAIN_WHY[b.reason] || 'chainWhyNone') });
    }
    return b.steps < 2 ? '' : L('betaChain', { chain: b.chain });
  }

  // The reason goes in the status line in full: an isotope the player just built
  // is a teaching moment, and hiding the caveat would be the fake part.
  function verdictText(el, iso, v) {
    const params = {
      sym: el.sym, a: iso.a, z: iso.z, n: iso.n, max: v.bandMax,
      p: Math.round(1 / FAST_FISSION_CHANCE)
    };
    if (v.key !== 'heavy') {
      const b = betaNote(iso.z, iso.a);
      if (b) {
        const head = L(b.kind === 'plus' ? 'betaPlusMeasured' : 'betaMeasured',
          { sym: el.sym, a: iso.a, life: b.life, daughter: b.daughter, da: b.da });
        const tail = chainTail(b);
        return tail ? head + ' ' + tail : head;
      }
    }
    if (v.key === 'inBand') return L('inBand', params);
    if (v.key === 'noStable') return L('noStable', params);
    if (v.key === 'heavy') {
      // Name the clock this exact nucleus lives by. The decay engine runs the
      // measured half-life of the isotope the shot just made, so the status can
      // promise it - and say plainly when no chart measures anything.
      const N = window.__nuclear;
      const c = N && typeof N.clock === 'function' ? N.clock(iso.z, iso.a) : null;
      if (c && c.halfLife > 0) {
        // The clock the engine runs is measured for some nuclei and modelled for
        // the rest, and the two deserve different sentences: promising "the charts
        // measure this" about a nucleus no chart has is the fake part.
        return L(c.source === 'measured' ? 'heavy' : 'heavyModel', {
          sym: el.sym, a: iso.a, z: iso.z, n: iso.n, max: v.bandMax, p: params.p,
          mode: MODE_GLYPH[c.mode] || c.mode, life: N.formatLife(c.halfLife)
        });
      }
      return L('heavyNoClock', params);
    }
    if (v.key === 'pastAll') return L('pastAll', params);
    return L('neutronRich', params);
  }

  let lastShot = null;
  function setLastShot(iso, v) {
    if (!iso || !v) { lastShot = null; return; }
    const measured = v.key === 'heavy' ? null : betaNote(iso.z, iso.a);
    lastShot = {
      iso: iso,
      verdictKey: measured ? (measured.kind === 'plus' ? 'vBetaP' : 'vBeta') : v.verdictKey,
      warn: measured ? true : v.key !== 'inBand'
    };
  }

  function addNeutron(atom, atomId, paid) {
    pruneLedger();
    const el = atom.el;
    const a = massNumberOf(atomId, atom) + 1;
    const compound = isotopeOf(el, a);
    // Nothing about the atom is touched: same Z, same electrons, same chemistry -
    // which is exactly why the engine needs no reanalyze for this shot either.
    // Unless the nucleus is past a drip line and gives a nucleon straight back,
    // which is the one case where the element does move.
    setNuclide(atomId, el.z, a);
    const shed = settleNucleus(el.z, a);
    if (shed) {
      if (shed.finalZ !== el.z) applyNucleus(atom, atomId, shed.finalZ, shed.finalA);
      else setNuclide(atomId, shed.finalZ, shed.finalA);
      drawEjection(atom, shed);
    }
    const iso = isotopeOfAtom(atomId, atom);
    const v = stabilityVerdict(iso.z, iso.a);
    // The nucleus changed, so the atom's own label has to say so: the ledger is the
    // only record of A, and a paid-for neutron that only shows while the gun panel
    // happens to be open is not the same nucleus the player is looking at.
    if (window.__mol3d && window.__mol3d.updateAtomLabel) {
      window.__mol3d.updateAtomLabel(atomId, atom.el);
    }
    showStatus('⚛ ' + (shed
      ? ejectionNote(shed, iso.z, iso.a)
      : L('neutronAdded', { sym: el.sym, a: iso.a, z: iso.z, n: iso.n })) + ' ' +
      verdictText(atom.el, iso, v) + spendTail(paid, 'neutron'), v.key === 'inBand' ? 'ok' : 'err');
    setLastShot(iso, v);
    // The x-ray, unlike the engine, draws the nucleus itself - and that nucleus is
    // another isotope now. One atom is repainted here, exactly the way a proton shot
    // repaints one atom, so a shot-heavy nucleus reads its real mass number the
    // moment the shot lands instead of at the next rebuild.
    if (window.__xray && window.__xray.isActive && window.__xray.isActive()) {
      window.__xray.updateAtom(atomId, atom);
    }
    if (shed) {
      // A nucleus that left its element behind has to tell the rest of the app.
      if (window.__mol3d.refreshInspector) window.__mol3d.refreshInspector();
      if (window.__mol3d.reanalyze) window.__mol3d.reanalyze();
    }
    paintGun();
  }

  // --- The gun panel: mode selector, live ammo, isotope record ---
  // It opens with the gun and closes with it, so there is exactly one source of
  // truth for "armed": no hidden mode the player can still shoot with, and no
  // panel left floating over the scene once the gun is off.
  const NG_CSS = [
    '#neutron-gun-panel{position:fixed;z-index:1201;width:min(258px,70vw);background:var(--panel);',
    '  border:1px solid var(--border);border-radius:12px;box-shadow:0 14px 34px rgba(0,0,0,.5);',
    '  backdrop-filter:blur(12px);padding:9px 10px 10px;display:none;}',
    '#neutron-gun-panel.open{display:block;}',
    '.ng-head{display:flex;align-items:center;gap:6px;margin-bottom:6px;}',
    '.ng-title{font-size:11.5px;font-weight:700;letter-spacing:.3px;}',
    '.ng-close{margin-left:auto;width:20px;height:20px;border-radius:6px;border:1px solid var(--border);',
    '  background:transparent;color:var(--muted);cursor:pointer;font-size:12px;line-height:1;}',
    '.ng-close:hover{color:var(--text);border-color:var(--accent);}',
    '.ng-modes{display:flex;gap:5px;}',
    '.ng-mode{flex:1;display:flex;align-items:center;justify-content:center;gap:5px;padding:5px 4px;',
    '  border-radius:9px;border:1px solid var(--border);background:var(--panel-2);color:var(--muted);',
    '  font:inherit;font-size:11px;font-weight:700;cursor:pointer;transition:border-color .16s,color .16s;}',
    '.ng-mode b{font-size:10px;font-weight:700;font-variant-numeric:tabular-nums;}',
    '.ng-mode.on{color:var(--text);border-color:var(--accent);background:var(--accent-soft);}',
    '.ng-mode:hover{border-color:var(--accent);}',
    '.ng-ammo{display:flex;align-items:center;gap:6px;margin-top:7px;font-size:10.5px;color:var(--muted);}',
    '.ng-ammo-main{flex:1;min-width:0;}',
    '.ng-count{color:var(--text);font-weight:700;font-variant-numeric:tabular-nums;}',
    '.ng-buy{flex:none;border:1px solid var(--border);border-radius:8px;background:var(--panel-2);',
    '  color:var(--text);font:inherit;font-size:10px;font-weight:700;cursor:pointer;padding:4px 7px;}',
    '.ng-buy:hover{border-color:var(--accent);}',
    '.ng-note{margin-top:4px;font-size:9.5px;line-height:1.4;color:var(--muted);}',
    '.ng-iso{margin-top:6px;padding-top:6px;border-top:1px solid var(--border);font-size:10px;',
    '  line-height:1.45;color:var(--muted);}',
    '.ng-iso b{color:var(--text);font-variant-numeric:tabular-nums;}',
    '.ng-iso .ng-flag{color:var(--warn,#ffb347);}',
    '@media (max-width:640px){#neutron-gun-panel{width:min(232px,66vw);padding:8px}.ng-mode{font-size:10px}}'
  ].join('\n');

  let panel = null;
  let gunBtn = null;

  function buildGun() {
    if (panel) return panel;
    if (!document.getElementById('ng-gun-styles')) {
      const style = document.createElement('style');
      style.id = 'ng-gun-styles';
      style.textContent = NG_CSS;
      document.head.appendChild(style);
    }
    panel = document.createElement('div');
    panel.id = 'neutron-gun-panel';
    panel.setAttribute('role', 'group');
    panel.innerHTML =
      '<div class="ng-head"><span class="ng-title"></span>' +
        '<button type="button" class="ng-close" aria-label="' + esc(L('close')) + '">×</button></div>' +
      '<div class="ng-modes"></div>' +
      '<div class="ng-ammo"><span class="ng-ammo-main"></span>' +
        '<button type="button" class="ng-buy"></button></div>' +
      '<div class="ng-note"></div>' +
      '<div class="ng-iso"></div>';

    const modes = panel.querySelector('.ng-modes');
    KINDS.forEach(function (kind) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'ng-mode';
      chip.dataset.kind = kind;
      chip.addEventListener('click', function () { setMode(kind); });
      modes.appendChild(chip);
    });

    // The close button routes through the toolbar button rather than mutating the
    // armed flag, so the toggle keeps owning the one piece of state it always did.
    panel.querySelector('.ng-close').addEventListener('click', function () {
      if (gunBtn) gunBtn.click(); else setArmed(false);
    });
    panel.querySelector('.ng-buy').addEventListener('click', function () {
      const s = shopApi();
      if (s && typeof s.buyAmmo === 'function') {
        s.buyAmmo(mode, BUY_PACK);   // the shop charges, announces and repaints itself
      } else if (s && typeof s.open === 'function') {
        s.open();
      }
      paintGun();
    });

    document.body.appendChild(panel);
    return panel;
  }

  function setMode(kind, quiet) {
    if (KINDS.indexOf(kind) < 0) return;
    mode = kind;
    paintGun();
    if (quiet) return;
    const price = ammoPrice(kind);
    const params = { kind: L(kindKey(kind)), price: price };
    showStatus('🎯 ' + (price === null ? L('modeSetNoPrice', params) : L('modeSet', params)));
  }

  function paintGun() {
    if (!panel) return;
    panel.querySelector('.ng-title').textContent = L('panelTitle');
    panel.setAttribute('aria-label', L('panelTitle'));
    panel.querySelector('.ng-close').setAttribute('aria-label', L('close'));

    const chips = panel.querySelectorAll('.ng-mode');
    for (let i = 0; i < chips.length; i++) {
      const chip = chips[i];
      const kind = chip.dataset.kind;
      const held = ammoCount(kind);
      chip.classList.toggle('on', kind === mode);
      chip.setAttribute('aria-pressed', kind === mode ? 'true' : 'false');
      chip.innerHTML = '<span>' + esc(L(kind === 'proton' ? 'mProton' : 'mNeutron')) + '</span>' +
        '<b>×' + esc(held === null ? '—' : held) + '</b>';
      chip.title = L(kind === 'proton' ? 'ammoProton' : 'ammoNeutron') + ': ' +
        (held === null ? L('ammoUnknown') : held);
    }

    const held = ammoCount(mode);
    const main = panel.querySelector('.ng-ammo-main');
    main.innerHTML = esc(L(mode === 'proton' ? 'ammoProton' : 'ammoNeutron')) + ': ' +
      '<span class="ng-count">' +
      esc(held === null ? L('ammoUnknown') : held) + '</span>';
    const buy = panel.querySelector('.ng-buy');
    buy.textContent = L('buyButton', { n: BUY_PACK });
    buy.title = L('buyButton', { n: BUY_PACK }) + ' · ' + ammoPriceNote();

    const note = panel.querySelector('.ng-note');
    note.textContent = L('modeHint') + ' ' + ammoPriceNote();

    const isoLine = panel.querySelector('.ng-iso');
    if (!lastShot) {
      isoLine.textContent = L('lastShot') + ': ' + L('none');
    } else {
      const s = lastShot.iso;
      isoLine.innerHTML = esc(L('lastShot')) + ': <b>' + esc(s.label) + '</b> · ' +
        esc(L('isotopeLine', { a: s.a, z: s.z, n: s.n })) +
        (lastShot.warn ? '<div class="ng-flag"><i data-lucide="triangle-alert" class="st-lc"></i>' + esc(L(lastShot.verdictKey)) + '</div>'
                       : '<div>' + esc(L(lastShot.verdictKey)) + '</div>');
      try {
        window.lucide && window.lucide.createIcons({ nameAttr: 'data-lucide', root: isoLine });
      } catch (e) {}
    }
  }

  function ammoPriceNote() {
    const price = ammoPrice(mode);
    return price === null ? L('buyNoteNoPrice') : L('buyNote', { price: price });
  }

  // The sidebar can sit on either edge and the format panel shares this side of it,
  // so the gun stacks under whatever is already open instead of covering it.
  function placeGun() {
    if (!panel || !gunBtn) return;
    const r = gunBtn.getBoundingClientRect();
    const towardLeft = r.right > window.innerWidth / 2;
    panel.style.right = '';
    panel.style.left = '';
    if (towardLeft) panel.style.right = Math.round(window.innerWidth - r.left + 8) + 'px';
    else panel.style.left = Math.round(r.right + 8) + 'px';
    const format = document.getElementById('format-panel');
    let top = r.top - 8;
    if (format && format.classList.contains('open')) {
      const fr = format.getBoundingClientRect();
      if (fr.left < r.left && fr.right > panel.getBoundingClientRect().left - 40) top = fr.bottom + 8;
    }
    const h = panel.offsetHeight || 190;
    top = Math.max(8, Math.min(top, window.innerHeight - h - 8));
    panel.style.top = Math.round(top) + 'px';
    panel.style.bottom = 'auto';
  }

  function showGun() {
    buildGun();
    paintGun();
    panel.classList.add('open');
    placeGun();
  }
  function hideGun() {
    if (panel) panel.classList.remove('open');
  }

  function setArmed(on) {
    active = !!on;
    if (gunBtn) gunBtn.classList.toggle('on', active);
    if (active) showGun(); else hideGun();
    // Toggling off never clears the critical timer: fission runs on its own.
  }

  let shopWatched = false;
  function attachShopWatch() {
    const s = shopApi();
    if (!s || typeof s.onStockChange !== 'function') return false;
    if (!shopWatched) {
      shopWatched = true;
      // fn takes no args by contract; the readout re-reads what it needs.
      s.onStockChange(function () { paintGun(); });
    }
    paintGun();
    return true;
  }

  function armedNote() {
    if (!shopHasAmmoApi()) return L('ammoApiMissing');
    const params = { kind: L(kindKey(mode)) };
    const held = ammoCount(mode);
    params.left = held === null ? L('ammoUnknown') : held;
    return L('armedNote', params);
  }

  // The toolbar tooltip is still owned by the app's own i18n key, so data-i18n-title
  // stays exactly where it is; this only overlays the new name and re-applies it
  // after the app's translator has had its turn.
  function relabelButton() {
    if (!gunBtn) return;
    const label = L('panelTitle');
    gunBtn.title = label;
    gunBtn.setAttribute('aria-label', label);
  }

  // --- Cinematic screen effects ---
  function createRedFlash() {
    if (redFlash) return;
    redFlash = document.createElement('div');
    redFlash.id = 'nuclear-red-flash';
    redFlash.style.cssText = [
      'position:fixed', 'top:0', 'left:0', 'width:100vw', 'height:100vh',
      'z-index:9990', 'pointer-events:none', 'display:none',
      'background:radial-gradient(ellipse at center, rgba(255,0,0,0.15) 0%, rgba(180,0,0,0.25) 100%)',
      'animation:nuclearRedPulse 1s ease-in-out infinite'
    ].join(';');
    if (!document.getElementById('nuclear-fx-styles')) {
      var style = document.createElement('style');
      style.id = 'nuclear-fx-styles';
      style.textContent = [
        '@keyframes nuclearRedPulse {',
        '  0% { opacity:0.3; } 50% { opacity:0.8; } 100% { opacity:0.3; }',
        '}',
        '@keyframes nuclearCountdownPulse {',
        '  0% { transform:scale(1); text-shadow:0 0 30px #ff0000, 0 0 60px #ff3300, 0 0 90px #ff0000; }',
        '  100% { transform:scale(1.08); text-shadow:0 0 50px #ff0000, 0 0 100px #ff3300, 0 0 150px #ff0000; }',
        '}',
        '@keyframes nuclearUrgentPulse {',
        '  0% { transform:scale(1); text-shadow:0 0 40px #ff0000, 0 0 80px #ff0000, 0 0 120px #ff3300; }',
        '  100% { transform:scale(1.15); text-shadow:0 0 60px #ff0000, 0 0 120px #ff0000, 0 0 180px #ff3300; }',
        '}',
        '.nuclear-countdown-num { font-variant-numeric:tabular-nums; }'
      ].join('\n');
      document.head.appendChild(style);
    }
    document.body.appendChild(redFlash);
  }

  function showRedFlash() {
    createRedFlash();
    redFlash.style.display = 'block';
  }

  function hideRedFlash() {
    if (!redFlash) return;
    redFlash.remove();
    redFlash = null;
  }

  // --- Fission cinematic ---
  // The breach panel (title, subtitle, a number ticking down from ten) read like a
  // loading screen, and a countdown is the one thing an annihilation should never
  // be. What the player gets instead: a bubble of light that grows out of the atom
  // that split until the whole viewport is white, ten seconds of nothing, then a
  // fade onto the wasteland - and only then a voice.
  const CINE = { bubbleMs: 1100, holdMs: 10000, fadeMs: 2000, typeMs: 18, linePause: 900 };

  const CINE_STR = {
    vi: {
      aria: 'ARIA', you: 'Bạn',
      skip: 'Bỏ qua đoạn kết ▸',
      hint: 'nhấn để tiếp tục ▸',
      title: 'HÒA BÌNH THẾ GIỚI — XÓA SỔ HẠT NHÂN, MỘT LẦN VÀ MÃI MÃI',
      sub: 'Bạn vừa xem một hạt nhân tự chia đôi. Không một quốc gia nào cần thêm lý do để làm điều đó có chủ đích.',
      g: {
        massTitle: 'Phân bố khối lượng mảnh vỡ — {nu}',
        massNote: 'Hiệu suất độc lập Y(A), % trên mỗi số khối; tổng bằng 200 % vì mỗi phân hạch sinh ra hai mảnh. {src} Vạch đỏ: phép chia đôi mà bạn vừa buộc {nu} thực hiện.',
        massNoteReal: 'Hiệu suất độc lập Y(A), % trên mỗi số khối; tổng bằng 200 % vì mỗi phân hạch sinh ra hai mảnh. {src} Vạch đỏ: hai hạt nhân mà {nu} thực sự vỡ thành, {f1} và {f2}.',
        srcEval: 'Đường cong là mô hình bản này khớp với số liệu đo của U-236*, hai đỉnh ở A = 95 và A = 140.',
        srcModel: 'Đường cong là mô hình bản này tính cho {nu} theo đúng độ dễ phân hạch của nó (Z²/A = {x}); chưa có số liệu đo cho hạt nhân này.',
        mark: 'chia đôi · khoảng {p} % số vụ phân hạch rơi vào đây',
        markReal: '{f1} + {f2}: khoảng {p} % số vụ phân hạch gửi một mảnh nhẹ qua vạch thứ nhất, {ph} % gửi một mảnh nặng qua vạch thứ hai',
        energyTitle: 'Phân bố năng lượng — {q} MeV cho một phép chia đôi {nu}',
        energyTitleReal: 'Phân bố năng lượng — {q} MeV cho một vụ phân hạch của {nu}',
        energyNote: 'Tính bằng công thức khối lượng bán thực nghiệm Bethe–Weizsäcker cho đúng cặp mảnh này. Phân hạch thật của {nu} thích hai mảnh không đều: ≈ {qAsym} MeV, còn U-235 với neutron nhiệt đo được {qMeasured} MeV.',
        energyNoteReal: 'Công thức khối lượng trả lời {qp} MeV cho đúng cặp này, {f1} + {f2}. {srcT} {ke} MeV trong số đó rời đi dưới dạng động năng của hai mảnh, và đó chính là phần làm nóng mọi thứ chúng chạm vào.',
        srcTotalMeasured: 'Tổng năng lượng in ở đây là số đo nhiệt lượng của {nu}.',
        srcTotalModel: 'Chưa ai đo tổng năng lượng của {nu}, nên con số in ở đây chính là Q của công thức khối lượng kia.',
        eLab: ['động năng mảnh', 'neutron', 'gamma tức thời', 'beta', 'gamma sản phẩm', 'neutrino'],
        total: 'Tổng năng lượng cho một vụ phân hạch',
        perKg: '1 phân hạch = {j} J · 1 mol {nu} = {kJ} kJ',
        axisA: 'số khối A',
        axisY: 'Y(A) %, đỉnh {peak}',
        lose: 'thoát ra ngoài, không thu hồi được'
      },
      facts: [
        'Hai mảnh vỡ mang đi ≈ {ke} MeV động năng; một vụ phân hạch {nu} tổng cộng ≈ {q} MeV ≈ {j} J.',
        '1 kg {nu} phân hạch hoàn toàn: ≈ {ekg} J ≈ {kt} kiloton TNT — đương lượng của một quả bom trút xuống một thành phố.',
        'Hiroshima, 6-8-1945: quả Little Boy chở 64 kg uranium, chưa tới 1 kg kịp phân hạch; 90.000 – 146.000 người đã chết trước cuối năm đó.',
        'Một liên kết hóa học bạn vừa xây ở đây: ≈ 4 eV. Phân hạch mạnh gấp ≈ {ratio} lần.',
        'Thời gian phân hủy của Pu-239 là 24.100 năm: sau đúng một thời gian phân hủy — 240 thế kỷ — một nửa chất độc vẫn còn đó, lâu hơn mọi nền văn minh trên mặt đất.'
      ],
      dialogue: [
        { who: 'aria', text: 'Bạn còn ở đó không? Ánh sáng vừa tan. {nu} không còn nữa, và {f1} với {f2} đang đứng ngay chỗ nó.' },
        { who: 'you', text: 'Tôi vẫn ở đây. Căn phòng cũng vậy — và tôi không chắc ai trong hai chúng tôi tệ hơn.' },
        { who: 'aria', text: 'Chỉ một hạt nhân vừa tách đôi: {nu} hóa thành {f1} và {f2}. Hai mảnh, ≈ {nubar} neutron, {q} MeV — gấp ≈ {ratioM} triệu lần năng lượng của một liên kết hóa học.' },
        { who: 'you', text: 'Một neutron, một hạt nhân, và không khí ở đây giờ là không khí nhiễm xạ.' },
        { who: 'aria', text: 'Hai mảnh vỡ mới là phần nhiễm xạ: cả hai đều giàu neutron, cả hai đều phát beta, và công cụ phân rã đang chạy đồng hồ của chúng. Đó là thứ một lò phản ứng phải che chắn, và là thứ một quả bom để lại trên thành phố.' },
        { who: 'you', text: 'Sao tôi không thấy giận? Tôi chỉ thấy trống.' },
        { who: 'aria', text: 'Vì giận là cảm giác của người còn sống. Bạn còn sống — đó không phải tai nạn, đó là trách nhiệm.' },
        { who: 'aria', text: 'Nguyên tử không biết gì về chiến tranh. Proton, neutron, lực hạt nhân mạnh, định luật bảo toàn — chúng chỉ làm đúng điều đó. Khác biệt giữa một lò phản ứng và một thành phố bị xóa sổ không phải vật lý. Là lựa chọn.' },
        { who: 'you', text: 'Vậy tôi phải làm gì với hai hạt nhân kia?' },
        { who: 'aria', text: 'Điều duy nhất một nhà hóa học làm được: xây tiếp thứ khác quanh chúng. Từng liên kết một.' },
        { who: 'aria', text: 'Và nhớ rằng mỗi liên kết bạn tạo ra đều có hai tương lai: giữ ấm một thành phố, hoặc đốt cháy nó.' },
        { who: 'aria', text: 'Hòa bình không phải trạng thái mặc định của vật chất. Nó là một phản ứng mà con người phải cân bằng lại mỗi ngày.' }
      ]
    },
    en: {
      aria: 'ARIA', you: 'You',
      skip: 'Skip the ending ▸',
      hint: 'press to continue ▸',
      title: 'WORLD PEACE — ABOLISH NUCLEAR WEAPONS, ONCE AND FOR ALL',
      sub: 'You just watched a single nucleus split itself. No nation needs a better reason than that to do it on purpose.',
      g: {
        massTitle: 'Fragment mass yield — {nu}',
        massNote: 'Independent cumulative yield Y(A), % per mass unit; it sums to 200 % because every fission gives two fragments. {src} Red line: the even split you just forced on {nu}.',
        massNoteReal: 'Independent cumulative yield Y(A), % per mass unit; it sums to 200 % because every fission gives two fragments. {src} Red lines: the two nuclei {nu} actually broke into, {f1} and {f2}.',
        srcEval: 'The curve is this build fit to the yields measured for U-236*, peaked at A = 95 and A = 140.',
        srcModel: 'The curve is a model built for {nu} from its own fissility (Z²/A = {x}); no evaluated yield data exists for this nucleus.',
        mark: 'even split · about {p} % of fissions land here',
        markReal: '{f1} + {f2}: about {p} % of fissions send a light fragment through the first line, {ph} % a heavy one through the second',
        energyTitle: 'Energy release — {q} MeV per even split of {nu}',
        energyTitleReal: 'Energy release — {q} MeV for one fission of {nu}',
        energyNote: 'Computed with the semi-empirical Bethe–Weizsäcker mass formula for exactly this pair. A real {nu} prefers unequal fragments: ≈ {qAsym} MeV, against the {qMeasured} MeV measured for thermal-neutron U-235.',
        energyNoteReal: 'The mass formula answers {qp} MeV for exactly this pair, {f1} + {f2}. {srcT} {ke} MeV of it leaves as the kinetic energy of the two fragments, which is the part that heats anything they touch.',
        srcTotalMeasured: 'The total quoted here is the calorimetric value measured for {nu}.',
        srcTotalModel: 'No total energy has been measured for {nu}, so the total quoted here is that same mass-formula Q.',
        eLab: ['fragment kinetic', 'neutrons', 'prompt gamma', 'beta', 'product gamma', 'neutrinos'],
        total: 'Total energy released per fission',
        perKg: 'one fission = {j} J · 1 mol of {nu} = {kJ} kJ',
        axisA: 'mass number A',
        axisY: 'Y(A) %, peak {peak}',
        lose: 'escapes, cannot be recovered'
      },
      facts: [
        'The two fragments carry away ≈ {ke} MeV of kinetic energy; one fission of {nu} totals ≈ {q} MeV ≈ {j} J.',
        '1 kg of {nu} fully fissioned: ≈ {ekg} J ≈ {kt} kilotonnes of TNT — the yield of a bomb dropped on a city.',
        'Hiroshima, 6 August 1945: Little Boy carried 64 kg of uranium and less than 1 kg actually fissioned; 90,000 – 146,000 people were dead by the end of that year.',
        'A chemical bond you just built in here: ≈ 4 eV. Fission is ≈ {ratio} times stronger per event.',
        'Pu-239 has a decay time of 24,100 years: after exactly one decay time — 240 centuries — half the poison is still there, longer than every civilisation on this ground.'
      ],
      dialogue: [
        { who: 'aria', text: 'Are you still there? The light just cleared. {nu} is gone, and {f1} and {f2} are standing where it was.' },
        { who: 'you', text: 'I am still here. So is the room — and I am not sure which of us is worse off.' },
        { who: 'aria', text: 'One nucleus split: {nu} into {f1} and {f2}. Two fragments, ≈ {nubar} neutrons, {q} MeV — about {ratioM} million times the energy of one chemical bond.' },
        { who: 'you', text: 'One neutron, one nucleus, and the air in here is radioactive now.' },
        { who: 'aria', text: 'The fragments are the radioactive part: both of them neutron-rich, both of them beta emitters, and the engine is already running their clocks. That is what a reactor has to shield, and what a bomb leaves on a city.' },
        { who: 'you', text: 'Why am I not angry? I only feel empty.' },
        { who: 'aria', text: 'Because anger belongs to the living. You are alive — that is not an accident, it is a responsibility.' },
        { who: 'aria', text: 'Atoms know nothing about war. Protons, neutrons, the strong force, conservation — that is all they do. The difference between a reactor and a city wiped off the map is not physics. It is a choice.' },
        { who: 'you', text: 'So what do I do with the two of them?' },
        { who: 'aria', text: 'The only thing a chemist can do: build something else around them. One bond at a time.' },
        { who: 'aria', text: 'And remember that every bond you make has two futures: warming a city, or burning one down.' },
        { who: 'aria', text: 'Peace is not the default state of matter. It is a reaction we have to balance again every single day.' }
      ]
    }
  };

  let cine = null;

  // Both languages are printed from one event object, so a placeholder that exists
  // in only one of the two tables would either leak a raw {token} onto the screen
  // or quietly drop a number from the other language. Same rule as STR above.
  (function checkCineStrings() {
    var problems = [];
    var tokens = function (s) {
      var out = [];
      String(s).replace(/\{([a-zA-Z0-9_]+)\}/g, function (whole, key) { out.push(key); return whole; });
      return out.sort().join(',');
    };
    var walk = function (path, a, b) {
      if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) problems.push(path + ': length');
        a.forEach(function (v, i) { walk(path + '[' + i + ']', v, b[i]); });
      } else if (a && typeof a === 'object' && b && typeof b === 'object') {
        Object.keys(a).forEach(function (k) {
          if (!Object.prototype.hasOwnProperty.call(b, k)) problems.push(path + '.' + k + ': missing in en');
          else walk(path + '.' + k, a[k], b[k]);
        });
        Object.keys(b).forEach(function (k) {
          if (!Object.prototype.hasOwnProperty.call(a, k)) problems.push(path + '.' + k + ': missing in vi');
        });
      } else if (tokens(a) !== tokens(b)) {
        problems.push(path + ': placeholders');
      }
    };
    walk('', CINE_STR.vi, CINE_STR.en);
    if (problems.length && window.console && console.warn) {
      console.warn('[proton-gun] fission cinematic strings:', problems.join(', '));
    }
  })();

  function cineLang() {
    const i18n = window.__mol3d && window.__mol3d.i18n;
    try {
      if (i18n && typeof i18n.getLang === 'function' && i18n.getLang() === 'en') return 'en';
    } catch (e) {}
    return 'vi';
  }

  function ensureCineStyles() {
    if (document.getElementById('pg-cine-styles')) return;
    const style = document.createElement('style');
    style.id = 'pg-cine-styles';
    style.textContent = `
.pg-bubble{position:fixed;z-index:100004;width:10px;height:10px;border-radius:50%;pointer-events:none;will-change:transform;
  background:radial-gradient(circle,#ffffff 0%,#ffffff 52%,rgba(255,248,232,.97) 70%,rgba(255,214,140,.6) 88%,rgba(255,180,90,0) 100%)}
.pg-whiteout{position:fixed;top:0;left:0;right:0;bottom:0;z-index:100003;background:#fff;pointer-events:all}
.pg-waste{position:fixed;top:0;left:0;right:0;bottom:0;z-index:100000;overflow:hidden;pointer-events:all;background:#181412;
  font-family:"Segoe UI",system-ui,-apple-system,sans-serif}
.pg-sky{position:absolute;top:0;left:0;right:0;bottom:0;
  background:linear-gradient(180deg,#251f1c 0%,#4b382c 24%,#7a4e30 42%,#3d312a 64%,#1d1715 100%)}
.pg-fire{position:absolute;left:0;right:0;bottom:0;height:48%;
  background:radial-gradient(ellipse 62% 58% at 50% 100%,rgba(255,126,44,.5) 0%,rgba(190,70,25,.22) 46%,rgba(0,0,0,0) 74%);
  animation:pgEmber 5.5s ease-in-out infinite alternate}
.pg-cloud{position:absolute;left:50%;bottom:24%;width:52vmax;height:52vmax;opacity:0;pointer-events:none;
  animation:pgRise 9s cubic-bezier(.16,.84,.3,1) forwards}
.pg-cap{position:absolute;top:0;left:50%;width:46vmax;height:21vmax;transform:translateX(-50%);border-radius:50%;
  background:radial-gradient(ellipse at 50% 62%,rgba(255,238,218,.96) 0%,rgba(226,196,168,.86) 26%,rgba(150,124,106,.7) 54%,rgba(84,70,62,.46) 76%,rgba(60,50,45,0) 100%);
  filter:blur(1.2px)}
.pg-ring{position:absolute;top:15vmax;left:50%;width:34vmax;height:9vmax;transform:translateX(-50%);border-radius:50%;
  background:radial-gradient(ellipse,rgba(206,178,150,.55),rgba(90,74,64,0) 70%);filter:blur(3px)}
.pg-stem{position:absolute;top:12vmax;left:50%;width:12vmax;height:36vmax;transform:translateX(-50%);
  background:linear-gradient(180deg,rgba(224,200,176,.82) 0%,rgba(160,132,110,.62) 34%,rgba(96,76,64,.48) 68%,rgba(60,48,42,.24) 100%);
  border-radius:44% 44% 24% 24%/16% 16% 8% 8%;filter:blur(1.6px)}
.pg-skyline{position:absolute;left:0;bottom:0;width:100%;pointer-events:none}
.pg-skyline-far{height:30vh;fill:#413833;opacity:.5}
.pg-skyline-near{height:40vh;fill:#15110f}
.pg-ash{position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none}
.pg-flake{position:absolute;top:-8vh;background:#dbd2c7;border-radius:40%;will-change:transform;animation:pgFall linear infinite}
.pg-grain{position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;
  background:radial-gradient(ellipse at center,rgba(0,0,0,0) 44%,rgba(0,0,0,.6) 100%)}
.pg-caption{position:absolute;left:50%;top:6%;transform:translateX(-50%);width:min(94vw,900px);text-align:center;
  color:#f5ede2;text-shadow:0 2px 20px rgba(0,0,0,.85);animation:pgSoftIn 2.6s ease-out .7s both}
.pg-peace{font-size:clamp(42px,7vw,86px);line-height:1;color:#fff;filter:drop-shadow(0 0 20px rgba(255,255,255,.35))}
.pg-cap-title{font-size:clamp(15px,2.4vw,26px);font-weight:700;letter-spacing:.05em;margin-top:6px}
.pg-cap-facts{list-style:none;margin:16px auto 0;padding:0;max-width:830px;
  font-size:clamp(11px,1.35vw,14.5px);line-height:1.6;color:#ded2c5}
.pg-cap-facts li{margin:5px 0}
.pg-cap-sub{margin-top:14px;font-size:clamp(12px,1.6vw,16px);font-style:italic;color:#fff;opacity:.94}
.pg-dialogue{position:fixed;left:50%;bottom:5vh;transform:translateX(-50%);width:min(94vw,780px);z-index:100005;
  display:flex;flex-direction:column;gap:8px;pointer-events:all;animation:pgSoftIn .9s ease-out both;
  font-family:"Segoe UI",system-ui,-apple-system,sans-serif}
.pg-line{display:flex;gap:14px;align-items:flex-start;cursor:pointer;
  background:rgba(14,11,10,.78);border:1px solid rgba(255,255,255,.16);border-radius:14px;padding:14px 16px;
  backdrop-filter:blur(6px);box-shadow:0 10px 40px rgba(0,0,0,.5)}
.pg-you{flex-direction:row-reverse}
.pg-face img{width:62px;height:62px;border-radius:50%;object-fit:cover;display:block;background:#000}
.pg-you-mark{width:62px;height:62px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  font-size:26px;background:rgba(255,255,255,.12);color:#f2e8dc}
.pg-body{flex:1;min-width:0}
.pg-name{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#ffc978;margin-bottom:6px}
.pg-you .pg-name{color:#9fd8ff}
.pg-text{font-size:clamp(14px,1.7vw,17px);line-height:1.6;color:#f7f0e7;min-height:3.4em}
.pg-hint{align-self:center;color:#e9dfd3;font-size:12px;opacity:.75;min-height:14px}
.pg-skip{align-self:flex-end;background:rgba(0,0,0,.55);color:#e8dccf;border:1px solid rgba(255,255,255,.22);
  border-radius:8px;padding:6px 12px;font-size:12px;cursor:pointer}
.pg-skip:hover{background:rgba(255,255,255,.18);color:#fff}
.pg-graphs{position:absolute;inset:0;padding:3.5vh 4vw 5vh;display:flex;flex-direction:column;gap:2vh;pointer-events:none;color:#1b1a19;font-family:"Segoe UI",system-ui,-apple-system,sans-serif}
.pg-gpanel{flex:1;min-height:0;display:flex;flex-direction:column}
.pg-gtitle{font-size:clamp(11px,1.3vw,15px);font-weight:700;letter-spacing:.13em;text-transform:uppercase}
.pg-gnote{font-size:clamp(10px,1.1vw,13px);color:#544e48;margin-top:3px;line-height:1.5}
.pg-gplot{position:relative;flex:1;min-height:0;display:flex;align-items:flex-end;border-bottom:2px solid #1b1a19;border-left:2px solid #1b1a19;margin-top:1vh}
.pg-bar{flex:1;display:flex;flex-direction:column;justify-content:flex-end;height:100%;min-width:0}
.pg-bar i{display:block;height:0;background:linear-gradient(180deg,#ff9540,#8a2f12);transition:height .95s cubic-bezier(.18,.9,.22,1)}
.pg-en i{background:linear-gradient(180deg,#3fa0dc,#123f61)}
.pg-en.pg-lose i{background:linear-gradient(180deg,#b8b2aa,#6b6560)}
.pg-cap-lab{font-size:clamp(8px,.95vw,11px);text-align:center;color:#544e48;padding-top:4px;white-space:nowrap;overflow:hidden}
.pg-lrow{display:flex;padding-top:4px}
.pg-lrow .pg-cap-lab{flex:1;min-width:0;padding-top:0;white-space:normal;line-height:1.35}
.pg-marks{position:absolute;inset:0;pointer-events:none}
.pg-mark{position:absolute;top:0;bottom:0;width:0;border-left:2px dashed #c01c1c;opacity:0;transition:opacity .7s ease-out}
.pg-mark span{position:absolute;top:2px;left:4px;font-size:clamp(9px,1vw,12px);font-weight:700;color:#c01c1c;white-space:nowrap}
.pg-axis{display:flex;justify-content:space-between;font-size:clamp(9px,1vw,12px);color:#544e48;padding-top:3px}
.pg-readout{margin-top:1vh;font-size:clamp(12px,1.5vw,17px);font-weight:700;letter-spacing:.02em;font-variant-numeric:tabular-nums}
@keyframes pgFall{to{transform:translate3d(var(--drift,4vw),114vh,0) rotate(240deg)}}
@keyframes pgRise{0%{opacity:0;transform:translate(-50%,44%) scale(.4)}24%{opacity:.92}100%{opacity:.94;transform:translate(-50%,4%) scale(1)}}
@keyframes pgEmber{0%{opacity:.5}100%{opacity:.95}}
@keyframes pgSoftIn{from{opacity:0}to{opacity:1}}
@media (max-width:720px){.pg-face img,.pg-you-mark{width:46px;height:46px}.pg-text{min-height:4.6em}.pg-cap-facts li{margin:7px 0}}
`;
    document.head.appendChild(style);
  }

  function cineNode(tag, cls, html) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (html !== undefined) el.innerHTML = html;
    cine.nodes.push(el);
    document.body.appendChild(el);
    return el;
  }

  function cineAfter(fn, ms) { cine.timers.push(setTimeout(fn, ms)); }
  function cineEvery(fn, ms) { const id = setInterval(fn, ms); cine.millis.push(id); return id; }

  function cineStop() {
    if (!cine) return;
    cine.timers.forEach(clearTimeout);
    cine.millis.forEach(clearInterval);
    if (cine.raf) cancelAnimationFrame(cine.raf);
    cine.nodes.forEach(function (n) { if (n && n.parentNode) n.parentNode.removeChild(n); });
    cine = null;
  }

  // A circle of light centred on the atom that split, scaled about its own middle
  // until it has swallowed the viewport including the four corners. Timers, not
  // requestAnimationFrame: a hidden tab pauses rAF entirely and would strand the
  // player on a half-grown bubble with no way out.
  function cineGrow(origin, done) {
    const base = 10;
    const diag = Math.sqrt(window.innerWidth * window.innerWidth + window.innerHeight * window.innerHeight);
    const target = Math.max(30, (diag * 2.3) / base);
    const sheet = cineNode('div', 'pg-whiteout');
    sheet.style.opacity = '0';
    const bubble = cineNode('div', 'pg-bubble');
    bubble.style.left = (origin.x - base / 2) + 'px';
    bubble.style.top = (origin.y - base / 2) + 'px';
    const t0 = performance.now();
    let finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      clearInterval(tick);
      // The bubble has covered every corner by now, so swapping it for the flat
      // sheet is invisible; before this point the screen must stay the scene.
      sheet.style.opacity = '1';
      if (bubble.parentNode) bubble.parentNode.removeChild(bubble);
      done();
    }
    const tick = cineEvery(function () {
      const k = Math.min(1, (performance.now() - t0) / CINE.bubbleMs);
      bubble.style.transform = 'scale(' + (1 + (target - 1) * (1 - Math.pow(1 - k, 3))).toFixed(2) + ')';
      if (k >= 1) finish();
    }, 16);
    cineAfter(finish, CINE.bubbleMs + 700);
    return sheet;
  }

  function skylineSvg(layer) {
    const w = 1200, h = 320, far = layer === 'far';
    let x = -30, polys = '';
    while (x < w) {
      const bw = (far ? 54 : 40) + Math.random() * (far ? 58 : 78);
      const bh = (far ? 74 : 108) + Math.random() * (far ? 128 : 172);
      const teeth = 3 + Math.floor(Math.random() * 3);
      const pts = [x.toFixed(1) + ',' + h, x.toFixed(1) + ',' + (h - bh).toFixed(1)];
      for (let i = 1; i <= teeth; i++) {
        const px = x + (bw * i) / teeth;
        const py = h - bh + (Math.random() - 0.3) * bh * 0.6;
        pts.push(px.toFixed(1) + ',' + Math.max(8, py).toFixed(1));
      }
      pts.push((x + bw).toFixed(1) + ',' + h);
      polys += '<polygon points="' + pts.join(' ') + '"/>';
      x += bw + Math.random() * 22;
    }
    return '<svg class="pg-skyline pg-skyline-' + layer + '" viewBox="0 0 ' + w + ' ' + h +
      '" preserveAspectRatio="none" aria-hidden="true">' + polys + '</svg>';
  }

  // Evaluated fission-fragment mass yield of U-236*, the compound nucleus a thermal
  // neutron turns U-235 into: light peak A=95 (6.6 %), valley A=115 (0.8 %), heavy
  // peak A=135 (6.8 %), summing to 200 % because every fission gives two fragments.
  // ENERGY_MEV is the measured partition of the 202.5 MeV of that same reaction;
  // neutrinos carry 8.8 MeV straight out of the reactor. These two tables are the
  // only numbers in the cinematic that belong to one named nuclide, so the panels
  // now say which nucleus they were measured for and which they only borrow - see
  // cineEvent.
  const YIELD_PTS = [
    [70, .45], [75, .8], [79, 2.0], [82, 3.3], [85, 4.6], [88, 5.6], [90, 6.0],
    [92, 6.4], [94, 6.6], [96, 6.1], [98, 5.2], [101, 4.0], [104, 2.9], [107, 1.9],
    [110, 1.3], [113, .95], [116, .8], [119, .78], [122, .85], [125, 1.2], [128, 1.9],
    [131, 4.2], [133, 5.8], [135, 6.8], [137, 6.6], [139, 5.9], [141, 4.8], [143, 3.6],
    [146, 2.2], [149, 1.2], [152, .7], [155, .35], [158, .2], [162, .08], [165, .02]
  ];
  const ENERGY_MEV = [168.3, 4.8, 7.0, 7.0, 6.6, 8.8];

  function yieldAt(a) {
    if (a <= YIELD_PTS[0][0]) return YIELD_PTS[0][1];
    for (let i = 1; i < YIELD_PTS.length; i++) {
      if (a <= YIELD_PTS[i][0]) {
        const p = YIELD_PTS[i - 1], q = YIELD_PTS[i];
        const k = (a - p[0]) / (q[0] - p[0]);
        return p[1] + (q[1] - p[1]) * k;
      }
    }
    return 0;
  }

  // --- What happens to the nucleus the player actually split ---
  // Nothing here is uranium-235 unless uranium-235 is what split. The energy comes
  // from the standard Bethe-Weizsäcker semi-empirical mass formula applied to the
  // exact pair of fragments triggerFission creates, and the yield curve is either
  // the evaluated table above or a two-peak model whose asymmetry is read off this
  // nucleus' own fissility, Z²/A.
  const SEMF = { av: 15.75, as: 17.8, ac: 0.711, aa: 23.7, ap: 11.18 };
  const MEV_IN_J = 1.602176634e-13;
  const AVOGADRO = 6.02214076e23;
  const KTONNE_TNT_J = 4.184e12;
  const BOND_EV = 4;
  const Q_U236_MEASURED = ENERGY_MEV.reduce(function (s, v) { return s + v; }, 0);
  // Below Z²/A = 33 a heavy nucleus gains almost nothing by splitting unevenly and
  // the curve stays single-humped; by 36 - uranium - the double peak is fully
  // developed and its peaks sit about 40 mass units apart, as the measured
  // actinide curves (U-235 95/135, Cf-252 106/146) show.
  const FISSILITY_SYMMETRIC = 33, FISSILITY_ASYMMETRIC = 36, PEAK_SEPARATION = 40;
  const PEAK_SIGMA = { light: 6.0, heavy: 7.0, symmetric: 9.0 };
  const SYMMETRIC_WING = 0.12;

  function semfBinding(z, a) {
    if (!(z > 0) || !(a >= z)) return 0;
    const n = a - z;
    const pair = (z % 2 === 0 && n % 2 === 0) ? SEMF.ap / Math.sqrt(a)
      : (z % 2 === n % 2) ? -SEMF.ap / Math.sqrt(a)
        : 0;
    return SEMF.av * a - SEMF.as * Math.pow(a, 2 / 3) -
      SEMF.ac * z * (z - 1) / Math.pow(a, 1 / 3) -
      SEMF.aa * (n - z) * (n - z) / a + pair;
  }

  // Prompt neutrons per fission. 0.024 per mass unit above A = 133 reproduces the
  // measured averages closely enough to quote: U-235 gives 2.44 against 2.43 and
  // Cf-252 gives 3.86 against 3.76.
  function neutronsPerFission(a) { return Math.max(0, 0.024 * a - 3.2); }

  // The split as this build performs it: half the protons in triggerFission's
  // floor(Z/2), and half of the mass that is left once the prompt neutrons are gone.
  function evenSplit(z, a) {
    const nu = neutronsPerFission(a);
    const massLeft = Math.max(2, Math.round(a - nu));
    const light = Math.round(massLeft / 2);
    return { nu: nu, massLeft: massLeft, a1: light, a2: massLeft - light };
  }

  function gaussianYield(a, mu, sigma) {
    return Math.exp(-((a - mu) * (a - mu)) / (2 * sigma * sigma));
  }

  function modelledYield(al, ah, mid) {
    const even = Math.abs(ah - al) < 1;
    const wing = even ? 1 : SYMMETRIC_WING;
    const area = Math.sqrt(2 * Math.PI) *
      (PEAK_SIGMA.light + PEAK_SIGMA.heavy + wing * PEAK_SIGMA.symmetric);
    // Yield is normalised per fragment, so a complete distribution sums to two
    // fragments per fission, i.e. 200 % over the mass axis.
    const scale = 200 / area;
    return function (a) {
      return scale * (gaussianYield(a, al, PEAK_SIGMA.light) +
        gaussianYield(a, ah, PEAK_SIGMA.heavy) +
        wing * gaussianYield(a, mid, PEAK_SIGMA.symmetric));
    };
  }

  // The panels describing a fission that really happened. triggerFission hands the
  // event over, so the masses under the red lines, the neutron count and the energy
  // are the ones the scene was paid - not a re-imagination of them. Only the yield
  // curve is still a distribution: it exists to say how likely the draw was.
  function cineRealEvent(real, z, a, sym, nameOf, NU) {
    const model = real.model || NU.yieldModel(z, a);
    const peaks = model.peaks;
    let lo = Infinity, hi = -Infinity, muLight = 0, muHeavy = 0;
    for (let i = 0; i < peaks.length; i++) {
      lo = Math.min(lo, peaks[i].mu - 4 * peaks[i].sigma);
      hi = Math.max(hi, peaks[i].mu + 4 * peaks[i].sigma);
      if (!muLight || peaks[i].mu < muLight) muLight = peaks[i].mu;
      if (peaks[i].mu > muHeavy) muHeavy = peaks[i].mu;
    }
    // The fragments have to be inside the window the marks are drawn on, or the
    // plot would show a curve the event is not on.
    lo = Math.max(10, Math.min(lo, real.light.a - 3));
    hi = Math.max(hi, real.heavy.a + 3);
    const curve = {
      at: function (mass) { return NU.yieldAt(z, a, mass); },
      lo: Math.round(lo), hi: Math.round(hi)
    };
    let peak = 0;
    for (let i = 0; i <= 400; i++) {
      const y = curve.at(curve.lo + ((curve.hi - curve.lo) * i) / 400);
      if (y > peak) peak = y;
    }
    // The six-part partition below is measured for U-236*; for another nucleus it
    // is that same shape applied to the nucleus' own total, which the panel says.
    const parts = ENERGY_MEV.map(function (m) { return (m * real.energy) / Q_U236_MEASURED; });
    return {
      real: true,
      z: z, a: a, label: sym + '-' + a, nuName: nameOf(z),
      nubar: real.nu, a1: real.light.a, a2: real.heavy.a,
      frag1: nameOf(real.light.z) + '-' + real.light.a,
      frag2: nameOf(real.heavy.z) + '-' + real.heavy.a,
      // A +/-3 mass unit band around each fragment, as a share of the 200 % total.
      evenShare: Math.min(100, (curve.at(real.light.a) * 6 / 200) * 100),
      heavyShare: Math.min(100, (curve.at(real.heavy.a) * 6 / 200) * 100),
      al: muLight, ah: muHeavy, mid: model.mid,
      fissility: model.fissility, measured: !!model.measured,
      curve: curve, peak: peak, axisMax: peak * 1.08,
      // The headline number of the panels is the energy the world was paid; the
      // mass formula's own answer for the exact pair is quoted beside it, labelled.
      q: real.energy, qPair: real.q, energySource: real.energySource,
      parts: parts, kinetic: parts[0], qPreferred: real.q,
      lightEnergy: real.lightEnergy, heavyEnergy: real.heavyEnergy,
      jPerFission: real.qJ,
      kjPerMol: real.kjPerMol,
      jPerKg: real.jPerKg,
      kilotonnes: real.kilotonnes,
      bondRatio: (real.energy * 1e6) / BOND_EV
    };
  }

  function cineEvent(opts) {
    const z = Math.max(2, Math.round(Number(opts.z) || 92));
    const a = Math.max(4, Math.round(Number(opts.a) || z * 2.55));
    const sym = opts.sym || (findElement(z) || { sym: 'Z' + z }).sym;
    const nameOf = function (zz) { const e = findElement(zz); return e ? (e.name || e.sym) : 'Z' + zz; };
    const NU = window.__nuclear;
    if (opts.event && opts.event.light && NU && typeof NU.yieldAt === 'function') {
      return cineRealEvent(opts.event, z, a, sym, nameOf, NU);
    }
    const zLight = Math.floor(z / 2), zHeavy = z - zLight;
    const split = evenSplit(z, a);
    const mid = split.massLeft / 2;
    const fissility = z * z / a;
    const ramp = Math.min(1, Math.max(0, (fissility - FISSILITY_SYMMETRIC) /
      (FISSILITY_ASYMMETRIC - FISSILITY_SYMMETRIC)));
    const separation = Math.min(PEAK_SEPARATION * ramp, Math.max(0, split.massLeft - 124));
    const al = mid - separation / 2, ah = mid + separation / 2;
    const measured = z === 92 && (a === 235 || a === 236);
    const curveWindow = measured ? { at: yieldAt, lo: 70, hi: 165 } : (function () {
      const fn = modelledYield(al, ah, mid);
      return {
        at: fn,
        lo: Math.max(10, Math.round(Math.min(al, mid) - 4 * PEAK_SIGMA.light)),
        hi: Math.round(Math.max(ah, mid) + 4 * PEAK_SIGMA.heavy)
      };
    })();
    let peak = 0;
    for (let i = 0; i <= 400; i++) {
      const y = curveWindow.at(curveWindow.lo + ((curveWindow.hi - curveWindow.lo) * i) / 400);
      if (y > peak) peak = y;
    }
    // Energy of the event the player watched, and of the split the curve says is
    // most likely, from the same formula: the second number is what makes the first
    // one honest about being an even split.
    const q = semfBinding(zLight, split.a1) + semfBinding(zHeavy, split.a2) - semfBinding(z, a);
    const zAsymHeavy = Math.round((z * ah) / split.massLeft);
    const qPreferred = semfBinding(z - zAsymHeavy, Math.round(al)) +
      semfBinding(zAsymHeavy, Math.round(ah)) - semfBinding(z, a);
    const parts = ENERGY_MEV.map(function (m) { return (m * q) / Q_U236_MEASURED; });
    const jPerFission = q * MEV_IN_J;
    const jPerKg = (1000 / a) * AVOGADRO * jPerFission;
    const fragNames = opts.fragNames || [nameOf(zLight), nameOf(zHeavy)];
    return {
      z: z, a: a, label: sym + '-' + a, nuName: nameOf(z),
      nubar: split.nu, a1: split.a1, a2: split.a2,
      frag1: fragNames[0] + '-' + split.a1, frag2: fragNames[1] + '-' + split.a2,
      al: al, ah: ah, mid: mid, fissility: fissility, measured: measured,
      curve: curveWindow, peak: peak, axisMax: peak * 1.08,
      // A +/-3 mass unit window around the even split, as a share of the 200 % total.
      evenShare: Math.min(100, (curveWindow.at(mid) * 6 / 200) * 100),
      heavyShare: Math.min(100, (curveWindow.at(mid) * 6 / 200) * 100),
      qPair: q, energySource: 'SEMF',
      q: q, parts: parts, kinetic: parts[0], qPreferred: qPreferred,
      jPerFission: jPerFission,
      kjPerMol: (jPerFission * AVOGADRO) / 1000,
      jPerKg: jPerKg,
      kilotonnes: jPerKg / KTONNE_TNT_J,
      bondRatio: (q * 1e6) / BOND_EV
    };
  }

  const SUPERSCRIPT = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };

  // The Vietnamese panel writes 3,24 where the English one writes 3.24, exactly as
  // the two halves of CINE_STR always have.
  function cineNum(value, dp) {
    const s = Number(value).toFixed(dp);
    return cineLang() === 'vi' ? s.replace('.', ',') : s;
  }

  // Very large and very small quantities keep the scientific form the panel was
  // built with; anything a reader can hold in their head stays a plain number.
  function cineSci(value, dp) {
    const v = Number(value);
    if (!(v > 0)) return cineNum(v, dp);
    const e = Math.floor(Math.log10(v));
    if (e >= -2 && e <= 4) return cineNum(v, dp);
    const mantissa = v / Math.pow(10, e);
    return cineNum(mantissa, dp) + ' × 10' +
      String(e).replace(/[0-9-]/g, function (d) { return SUPERSCRIPT[d]; });
  }

  // One interpolation pass over every string the cinematic prints. A key that was
  // given a placeholder no event provides keeps showing the raw token, which is a
  // visible bug, unlike a wrong number that looks entirely plausible.
  function cineT(template, params) {
    return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, function (whole, key) {
      return Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : whole;
    });
  }

  function cineParams(ev) {
    return {
      nu: ev.label,
      name: ev.nuName,
      x: cineNum(ev.fissility, 1),
      p: cineNum(ev.evenShare, ev.evenShare < 10 ? 1 : 0),
      ph: cineNum(ev.heavyShare, ev.heavyShare < 10 ? 1 : 0),
      q: cineNum(ev.q, 1),
      qp: cineNum(ev.qPair, 1),
      ke: cineNum(ev.kinetic, 1),
      qAsym: cineNum(ev.qPreferred, 1),
      qMeasured: cineSci(Q_U236_MEASURED, 1),
      j: cineSci(ev.jPerFission, 2),
      kJ: cineSci(ev.kjPerMol, 2),
      kgJ: cineSci(ev.jPerKg, 1),
      // The caption prints this one as {ekg}; without it the raw token was reaching
      // the screen, which is the one failure cineT promises out loud.
      ekg: cineSci(ev.jPerKg, 1),
      kt: cineNum(ev.kilotonnes, ev.kilotonnes < 100 ? 1 : 0),
      ratio: cineSci(ev.bondRatio, 1),
      ratioM: cineNum(ev.bondRatio / 1e6, 0),
      nubar: cineNum(ev.nubar, 1),
      peak: cineNum(ev.peak, 1),
      al: cineNum(Math.round(ev.al), 0),
      ah: cineNum(Math.round(ev.ah), 0),
      f1: ev.frag1,
      f2: ev.frag2
    };
  }

  // One place turns the language table plus the event into the sentences that get
  // printed, so the two panels, the caption and the dialogue cannot disagree about
  // which nucleus split.
  function cineWords(S, ev) {
    const P = cineParams(ev);
    const g = S.g;
    P.src = cineT(ev.measured ? g.srcEval : g.srcModel, P);
    P.srcT = cineT(ev.energySource === 'measured' ? g.srcTotalMeasured : g.srcTotalModel, P);
    // A fission the engine actually performed gets the panels that describe it;
    // the even-split wording is only for a nucleus nobody split.
    const real = !!ev.real;
    return {
      params: P,
      massTitle: cineT(g.massTitle, P),
      massNote: cineT(real ? g.massNoteReal : g.massNote, P),
      mark: cineT(real ? g.markReal : g.mark, P),
      axisY: cineT(g.axisY, P),
      energyTitle: cineT(real ? g.energyTitleReal : g.energyTitle, P),
      energyNote: cineT(real ? g.energyNoteReal : g.energyNote, P),
      perKg: cineT(g.perKg, P),
      facts: S.facts.map(function (f) { return cineT(f, P); }),
      dialogue: S.dialogue.map(function (d) { return { who: d.who, text: cineT(d.text, P) }; })
    };
  }

  // The whole cinematic for one nucleus, in one language, as the panels print it.
  // Watching a real fission costs twelve seconds of white screen, so this is how the
  // copy gets read and checked: same tables, same event, same interpolation.
  function cinePreview(z, a, sym, lang) {
    const ev = cineEvent({ z: z, a: a, sym: sym });
    return { event: ev, words: cineWords(CINE_STR[lang === 'en' ? 'en' : 'vi'], ev) };
  }

  // Drawn on the whiteout while the screen is still blank, so the instrument reads
  // before the world does.
  function cineGraphs(sheet, ev) {
    const S = CINE_STR[cineLang()];
    const W = cineWords(S, ev);
    const nBars = 48;
    const aMin = ev.curve.lo, aMax = ev.curve.hi;
    let ybars = '', ebars = '', elabs = '';
    for (let i = 0; i < nBars; i++) ybars += '<div class="pg-bar"><i></i></div>';
    for (let e = 0; e < ev.parts.length; e++) {
      ebars += '<div class="pg-bar pg-en' + (e === ev.parts.length - 1 ? ' pg-lose' : '') + '"><i></i></div>';
      elabs += '<div class="pg-cap-lab">' + esc(S.g.eLab[e]) + '<br>' + esc(cineNum(ev.parts[e], 1)) + '</div>';
    }
    const box = cineNode('div', 'pg-graphs');
    box.innerHTML =
      '<div class="pg-gpanel">' +
        '<div class="pg-gtitle">' + esc(W.massTitle) + '</div>' +
        '<div class="pg-gnote">' + esc(W.massNote) + '</div>' +
        '<div class="pg-gplot">' + ybars + '<div class="pg-marks"></div></div>' +
        '<div class="pg-axis"><span>A ' + aMin + '</span><span>' + esc(S.g.axisA) +
          '</span><span>A ' + aMax + ' · ' + esc(W.axisY) + '</span></div>' +
      '</div>' +
      '<div class="pg-gpanel">' +
        '<div class="pg-gtitle">' + esc(W.energyTitle) + '</div>' +
        '<div class="pg-gnote">' + esc(W.energyNote) + '</div>' +
        '<div class="pg-gplot">' + ebars + '</div>' +
        '<div class="pg-lrow">' + elabs + '</div>' +
        '<div class="pg-readout">' + esc(S.g.total) + ': <b>0.0</b> MeV &middot; ' + esc(W.perKg) + '</div>' +
      '</div>';
    sheet.appendChild(box);
    void box.offsetHeight;

    const plots = box.querySelectorAll('.pg-gplot');
    const ys = plots[0].querySelectorAll('.pg-bar i');
    for (let i = 0; i < nBars; i++) {
      const a = aMin + ((aMax - aMin) * i) / (nBars - 1);
      ys[i].style.transitionDelay = (Math.random() * 1100).toFixed(0) + 'ms';
      ys[i].style.height = Math.max(0.6, (ev.curve.at(a) / ev.axisMax) * 100).toFixed(1) + '%';
    }
    const es = plots[1].querySelectorAll('.pg-bar i');
    const eMax = Math.max.apply(null, ev.parts);
    for (let e = 0; e < es.length; e++) {
      es[e].style.transitionDelay = (600 + Math.random() * 1400).toFixed(0) + 'ms';
      es[e].style.height = (ev.parts[e] / eMax) * 100 + '%';
    }

    const marks = box.querySelector('.pg-marks');
    [ev.a1, ev.a2].forEach(function (a, i) {
      const mk = document.createElement('div');
      mk.className = 'pg-mark';
      mk.style.left = (((a - aMin) / (aMax - aMin)) * 100).toFixed(2) + '%';
      mk.innerHTML = i === 0
        ? '<span>A ' + a + ' / ' + ev.a2 + ' — ' + esc(W.mark) + '</span>'
        : '<span></span>';
      mk.style.transitionDelay = '1500ms';
      mk.style.opacity = '1';
      marks.appendChild(mk);
    });

    const readout = box.querySelector('.pg-readout b');
    const totalMev = ev.q;
    let shown = 0;
    const ticker = cineEvery(function () {
      shown = Math.min(totalMev, shown + totalMev / 45);
      readout.textContent = cineNum(shown, 1);
      if (shown >= totalMev) clearInterval(ticker);
    }, 28);
  }

  function cineWasteland(ev) {
    const S = CINE_STR[cineLang()];
    const W = cineWords(S, ev);
    const wrap = cineNode('div', 'pg-waste');
    wrap.innerHTML =
      '<div class="pg-sky"></div>' +
      '<div class="pg-fire"></div>' +
      '<div class="pg-cloud"><div class="pg-cap"></div><div class="pg-ring"></div><div class="pg-stem"></div></div>' +
      skylineSvg('far') + skylineSvg('near') +
      '<div class="pg-ash"></div>' +
      '<div class="pg-grain"></div>' +
      '<div class="pg-caption"><div class="pg-peace">☮</div>' +
        '<div class="pg-cap-title">' + esc(S.title) + '</div>' +
        '<ul class="pg-cap-facts">' + W.facts.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>' +
        '<div class="pg-cap-sub">' + esc(S.sub) + '</div>' +
      '</div>';
    const ash = wrap.querySelector('.pg-ash');
    const n = window.innerWidth < 720 ? 34 : 64;
    for (let i = 0; i < n; i++) {
      const flake = document.createElement('span');
      const s = 2 + Math.random() * 3.5;
      flake.className = 'pg-flake';
      flake.style.cssText = 'left:' + (Math.random() * 100).toFixed(2) + 'vw;' +
        'width:' + s.toFixed(1) + 'px;height:' + (s * 1.5).toFixed(1) + 'px;' +
        'animation-duration:' + (6 + Math.random() * 10).toFixed(2) + 's;' +
        'animation-delay:-' + (Math.random() * 14).toFixed(2) + 's;' +
        'opacity:' + (0.2 + Math.random() * 0.5).toFixed(2) + ';' +
        '--drift:' + ((Math.random() - 0.5) * 18).toFixed(1) + 'vw';
      ash.appendChild(flake);
    }
    return wrap;
  }

  function cineDialogue(ev, done) {
    const S = CINE_STR[cineLang()];
    const LINES = cineWords(S, ev).dialogue;
    const box = cineNode('div', 'pg-dialogue');
    box.innerHTML =
      '<button class="pg-skip" type="button">' + esc(S.skip) + '</button>' +
      '<div class="pg-line"><div class="pg-face"></div>' +
        '<div class="pg-body"><div class="pg-name"></div><div class="pg-text"></div></div></div>' +
      '<div class="pg-hint"></div>';
    const line = box.querySelector('.pg-line');
    const face = box.querySelector('.pg-face');
    const nameEl = box.querySelector('.pg-name');
    const textEl = box.querySelector('.pg-text');
    const hint = box.querySelector('.pg-hint');
    const AVATAR = '<img src="./assets/TutorialAssets/Assistant.gif" alt="ARIA" />';
    let idx = 0, tick = null, wait = null, lastText = '';

    function showNext() {
      if (idx >= LINES.length) { finish(); return; }
      const entry = LINES[idx++];
      const isYou = entry.who === 'you';
      line.classList.toggle('pg-you', isYou);
      face.innerHTML = isYou ? '<div class="pg-you-mark">☹</div>' : AVATAR;
      nameEl.textContent = isYou ? S.you : S.aria;
      textEl.textContent = '';
      hint.textContent = '';
      lastText = entry.text;
      const chars = Array.from(lastText);
      let i = 0;
      tick = cineEvery(function () {
        textEl.textContent = chars.slice(0, ++i).join('');
        if (i >= chars.length) {
          clearInterval(tick); tick = null;
          hint.textContent = S.hint;
          wait = cineAfter(showNext, CINE.linePause);
        }
      }, CINE.typeMs);
    }

    // A click finishes the line that is still typing, and moves on from one that
    // has already landed, so nobody has to watch a typewriter against their will.
    function advance() {
      if (wait) { clearTimeout(wait); wait = null; }
      if (tick) {
        clearInterval(tick); tick = null;
        textEl.textContent = lastText;
        hint.textContent = S.hint;
        wait = cineAfter(showNext, 380);
        return;
      }
      showNext();
    }

    function finish() {
      if (tick) clearInterval(tick);
      if (wait) clearTimeout(wait);
      if (box.parentNode) box.parentNode.removeChild(box);
      done();
    }

    box.querySelector('.pg-skip').addEventListener('click', finish);
    line.addEventListener('click', advance);
    showNext();
  }

  function cineRestore(elementName, onDone) {
    cineStop();
    // The wasteland sits over the scene for the whole dialogue, and anything that
    // touches the camera while it is up (respawn, focus, idle drift) can leave the
    // view inside the ground. Re-park it once the overlay is gone.
    resetCameraToGround();
    if (window.__mol3d) {
      if (window.__mol3d.reanalyze) window.__mol3d.reanalyze();
      if (window.__mol3d.refreshInspector) window.__mol3d.refreshInspector();
      if (window.__mol3d.invalidate) window.__mol3d.invalidate();
    }
    showStatus(tt('pg.restored', { name: elementName }));
    if (onDone) onDone();
  }

  // origin: client-space point of the atom that split (captured before it is gone)
  // z and a: the nucleus as it was, so every panel and every line describes it.
  function playFissionCinematic(opts) {
    if (cine) return false;
    ensureCineStyles();
    cine = { nodes: [], timers: [], millis: [], raf: null };
    const ev = cineEvent(opts);
    const origin = opts.origin && isFinite(opts.origin.x) && isFinite(opts.origin.y)
      ? opts.origin : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const sheet = cineGrow(origin, function () {
      // Arm the reveal before drawing anything, so a bad frame cannot leave the
      // player staring at a white screen with no scheduled way out.
      cineAfter(function () {
        cineWasteland(ev);
        if (opts.onReveal) opts.onReveal();
        if (sheet) {
          sheet.style.transition = 'opacity ' + (CINE.fadeMs / 1000) + 's ease-out';
          sheet.style.opacity = '0';
        }
        cineAfter(function () { if (sheet && sheet.parentNode) sheet.parentNode.removeChild(sheet); }, CINE.fadeMs + 140);
        cineAfter(function () {
          cineDialogue(ev, function () { cineRestore(opts.elementName, opts.onDone); });
        }, CINE.fadeMs + 320);
      }, CINE.holdMs);
      cineGraphs(sheet, ev);
    });
    return true;
  }

  // --- Critical timer overlay (big cinematic counter) ---
  function createCriticalOverlay() {
    if (criticalOverlay) return;
    criticalOverlay = document.createElement('div');
    criticalOverlay.id = 'critical-timer-overlay';
    criticalOverlay.style.cssText = [
      'position:fixed', 'top:50%', 'left:50%',
      'transform:translate(-50%,-50%)',
      'z-index:9995', 'pointer-events:none', 'text-align:center',
      'font-family:"Courier New",monospace', 'font-weight:bold',
      'display:none', 'flex-direction:column', 'align-items:center',
      'background:rgba(0,0,0,0.75)', 'border:2px solid rgba(255,0,0,0.5)',
      'border-radius:16px', 'padding:24px 48px',
      'backdrop-filter:blur(6px)', 'box-shadow:0 0 60px rgba(255,0,0,0.3), inset 0 0 30px rgba(255,0,0,0.1)'
    ].join(';');

    criticalOverlay.innerHTML = ''
      + '<div id="critical-element" style="font-size:18px;color:#ff6644;letter-spacing:3px;margin-bottom:16px;text-shadow:0 0 10px #ff4400;white-space:nowrap"></div>'
      + '<div id="critical-countdown" class="nuclear-countdown-num" style="font-size:120px;line-height:1;color:#ff0000;text-shadow:0 0 30px #ff0000, 0 0 60px #ff3300, 0 0 90px #ff0000;animation:nuclearCountdownPulse 1s ease-in-out infinite alternate"></div>'
      + '<div style="font-size:14px;color:#ff4444;margin-top:16px;letter-spacing:8px;text-shadow:0 0 10px #ff0000">' + esc(tt('pg.toFission')) + '</div>';
    document.body.appendChild(criticalOverlay);
  }

  function updateCriticalOverlay(atomName, atomZ, countdown) {
    if (!criticalOverlay) createCriticalOverlay();
    var nameEl = document.getElementById('critical-element');
    var countEl = document.getElementById('critical-countdown');
    if (nameEl) nameEl.textContent = '\u2622 ' + atomName + ' (Z=' + atomZ + ')';
    if (countEl) {
      countEl.textContent = countdown;
      if (countdown <= 10) {
        countEl.style.animation = 'nuclearUrgentPulse 0.25s ease-in-out infinite alternate';
        countEl.style.color = '#ff0000';
      }
    }
    criticalOverlay.style.display = 'flex';
  }

  function hideCriticalOverlay() {
    if (!criticalOverlay) return;
    criticalOverlay.remove();
    criticalOverlay = null;
  }

  // --- Nuclear alarm sound ---
  function startAlarmSound() {
    try {
      var audio = document.getElementById('sfx-nuclear');
      if (audio) {
        audio.currentTime = 0;
        audio.volume = 0.6;
        audio.play().catch(function() {});
      }
    } catch (e) {}
  }

  function stopAlarmSound() {
    try {
      var audio = document.getElementById('sfx-nuclear');
      if (audio) { audio.pause(); audio.currentTime = 0; }
    } catch (e) {}
  }

  function clearCriticalTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    timerAtomId = null;
    stopAlarmSound();
    hideCriticalOverlay();
    hideRedFlash();
  }

  function getElements() {
    return (window.__mol3d && window.__mol3d.ELEMENTS) || null;
  }

  function findElement(z) {
    var els = getElements();
    return els ? els.find(function(e) { return e.z === z; }) : null;
  }

  function findAtomMeshes() {
    if (!window.__mol3d || !window.__mol3d.scene) return [];
    var meshes = [];
    window.__mol3d.scene.traverse(function(obj) {
      if (obj.isInstancedMesh && obj.userData.ids) meshes.push(obj);
    });
    return meshes;
  }

  // --- Nucleons you can see --------------------------------------------------
  // A shot used to be an invisible contract: click, and a nucleus was different.
  // Both particles now cross the scene as the things they are - a red ball for a
  // proton, a gray one for a neutron, the same two colors the x-ray view paints the
  // nucleus with - and the nucleus only answers when the particle lands. What the
  // drip line refuses is drawn the same way, flying back out.
  //
  // The arrival runs on a timer and the flight runs on frames. That is deliberate:
  // requestAnimationFrame stops dead in a hidden tab, and a transmutation the player
  // paid a star for must not wait for the tab to come back. The timer applies the
  // physics even when the frames never came; the frame loop only decides where the
  // ball is drawn, so a skipped frame costs a stutter and nothing else.
  const NUC = {
    proton: { color: 0xff0000, r: 0.09 },
    neutron: { color: 0x888888, r: 0.09 }
  };
  const SHOT_SPEED = 26;         // scene units per second, so a far atom takes longer
  const EJECT_RANGE = 2.1, EJECT_SPEED = 5.2;
  const MUZZLE_GAP = 1.4;        // where the ball appears in front of the camera
  const nucAssets = {};
  const flying = [];
  let flyingFrame = 0;

  function nucMesh(kind) {
    const API = window.__mol3d;
    if (!API || !API.THREE || !API.scene || !NUC[kind]) return null;
    const THREE = API.THREE;
    if (!nucAssets[kind]) {
      nucAssets[kind] = {
        geo: new THREE.SphereGeometry(NUC[kind].r, 12, 12),
        mat: new THREE.MeshBasicMaterial({ color: NUC[kind].color })
      };
    }
    const m = new THREE.Mesh(nucAssets[kind].geo, nucAssets[kind].mat);
    // Not a target for the gun's own raycast, and not something the label culler
    // should ever mistake for an atom.
    m.raycast = function () {};
    return m;
  }

  function dropNucleon(i) {
    const p = flying.splice(i, 1)[0];
    if (p.timer) clearTimeout(p.timer);
    if (p.mesh && p.mesh.parent) p.mesh.parent.remove(p.mesh);
    if (p.onArrive && !p.arrived) { p.arrived = true; p.onArrive(); }
  }

  function finishNucleon(p) {
    const i = flying.indexOf(p);
    if (i >= 0) dropNucleon(i);
  }

  function driveFlying() {
    flyingFrame = 0;
    const now = performance.now();
    for (let i = flying.length - 1; i >= 0; i--) {
      const p = flying[i];
      const t = Math.min(1, (now - p.t0) / p.dur);
      p.mesh.position.set(
        p.from.x + (p.to.x - p.from.x) * t,
        p.from.y + (p.to.y - p.from.y) * t,
        p.from.z + (p.to.z - p.from.z) * t
      );
      // Ejecta shrinks away rather than popping out of existence; a shot keeps its
      // size to the last frame, because the next thing you see is the nucleus change.
      if (p.fade) p.mesh.scale.setScalar(Math.max(0.02, 1 - t));
      if (t >= 1 && !p.onArrive) dropNucleon(i);
    }
    const API = window.__mol3d;
    if (API && API.invalidate) API.invalidate();
    if (flying.length) flyingFrame = requestAnimationFrame(driveFlying);
  }

  // The one way a nucleon enters or leaves the scene. False means there is no
  // renderer to draw on, and the caller applies its physics immediately instead of
  // scheduling them - a headless console test still shoots.
  function flyNucleon(kind, from, to, ms, opts) {
    const API = window.__mol3d;
    const mesh = nucMesh(kind);
    if (!mesh || !API) return false;
    const p = {
      kind: kind, mesh: mesh, t0: performance.now(), dur: Math.max(60, ms),
      from: { x: from.x, y: from.y, z: from.z }, to: { x: to.x, y: to.y, z: to.z },
      fade: !!(opts && opts.fade), onArrive: opts && opts.onArrive ? opts.onArrive : null,
      arrived: false, timer: null
    };
    mesh.position.set(p.from.x, p.from.y, p.from.z);
    API.scene.add(mesh);
    flying.push(p);
    // The end of a nucleon's life is told by the clock, not by the frame loop: a
    // page that stops painting (a backgrounded tab) still gets the shot applied and
    // still gets the ball taken back out of the scene.
    p.timer = setTimeout(function () { p.timer = null; finishNucleon(p); }, p.dur + 20);
    if (!flyingFrame) flyingFrame = requestAnimationFrame(driveFlying);
    return true;
  }

  // Fire the particle the magazine just gave up. It leaves from in front of the
  // camera along the aiming ray and lands on the nucleus, where the shot is applied.
  function fireNucleon(kind, ray, target, onArrive) {
    const d = Math.hypot(target.x - ray.origin.x, target.y - ray.origin.y, target.z - ray.origin.z);
    const from = {
      x: ray.origin.x + ray.direction.x * MUZZLE_GAP,
      y: ray.origin.y + ray.direction.y * MUZZLE_GAP,
      z: ray.origin.z + ray.direction.z * MUZZLE_GAP
    };
    const travel = Math.max(0, d - MUZZLE_GAP);
    return flyNucleon(kind, from, target, travel / SHOT_SPEED * 1000, { onArrive: onArrive });
  }

  // The nucleus throwing its surplus back. One ball per nucleon, in directions drawn
  // afresh each time, because prompt emission has no preferred way out — and each
  // ball travels at the speed its own step computed, so a nucleon that leaves with
  // 5 MeV visibly outruns one that leaves with 0.2 MeV. The scene cannot run at
  // 0.03 c, so the real speeds are mapped onto EJECT_SPEED through one reference
  // particle; the ordering and the ratios are the physics, the scale is the scene.
  const EJECT_REF_SPEED = speedFromKinetic(2, M_N_C2);
  function ejectaMs(speed) {
    const ratio = speed > 0 ? speed / EJECT_REF_SPEED : 1;
    const clamped = Math.max(0.35, Math.min(3, ratio));
    return EJECT_RANGE / (EJECT_SPEED * clamped) * 1000;
  }

  function drawEjection(atom, shed) {
    if (!atom || !atom.pos) return;
    const at = { x: atom.pos.x, y: atom.pos.y, z: atom.pos.z };
    const ms = ejectaMs(shed && shed.speed);
    const fly = function (kind) {
      const dir = randomDirection();
      return flyNucleon(kind, at, {
        x: at.x + dir.x * EJECT_RANGE, y: at.y + dir.y * EJECT_RANGE, z: at.z + dir.z * EJECT_RANGE
      }, ms, { fade: true });
    };
    if (shed && shed.steps && shed.steps.length) {
      // One ball per emitted nucleon, each with its own step energy. The walk
      // inside settleNucleus is sequential, and the balls are drawn together,
      // because the whole cascade finishes long before a frame does.
      for (const st of shed.steps) fly(st.kind);
      return;
    }
    for (let i = 0; i < (shed ? shed.neutrons : 0); i++) fly('neutron');
    for (let i = 0; i < (shed ? shed.protons : 0); i++) fly('proton');
  }

  // What one landed shot actually does to the nucleus it found. Split out of the
  // click handler because it now runs a few frames after the trigger, and the atom
  // it was aimed at may have spent that time leaving the scene.
  function applyShot(kind, atomId, paid) {
    const atom = window.__mol3d && window.__mol3d.atoms ? window.__mol3d.atoms.get(atomId) : null;
    if (!atom) {
      // The particle was fired, so the magazine already gave it up; a nucleus that
      // is not there to take it gets the particle back.
      refundAmmo(kind);
      showStatus(L('shotLost', { kind: L(kindKey(kind)) }) + refundNote(kind), 'err');
      paintGun();
      return;
    }
    if (atom.el.z > 82) {
      if (timerAtomId === atomId && timerInterval) {
        refundAmmo(kind);
        showStatus(tt('pg.alreadyCritical') + refundNote(kind));
        paintGun();
        return;
      }
      // Whether this shot splits the nucleus is a question about the nuclide and
      // about the neutron, not about the element. A fissile nucleus splits on
      // capture; a fertile heavy one takes the gamble described above; a proton
      // shot never splits anything - it moves one place up the table. Fertile
      // U-238 + n that loses is U-239, and the decay engine carries it the rest of
      // the way to plutonium-239, which is fissile and splits on the next shot.
      const N = window.__nuclear;
      const aNow = massNumberOf(atomId, atom);
      const compound = aNow + 1;
      const canSplit = kind === 'neutron' && N &&
        typeof N.sampleFission === 'function' && N.fissionable(atom.el.z, compound);
      const splits = !!canSplit &&
        (isFissile(atom.el.z, aNow) || Math.random() < FAST_FISSION_CHANCE);
      if (splits) {
        // The countdown names the compound nucleus that is about to split:
        // U-235 + n is U-236*, and it is the U-236* that breaks.
        startCriticalTimer(atom, atomId, compound);
      } else if (kind === 'neutron') {
        addNeutron(atom, atomId, paid);
      } else {
        addProton(atom, atomId, paid);
      }
      paintGun();
      return;
    }
    if (kind === 'neutron') addNeutron(atom, atomId, paid);
    else addProton(atom, atomId, paid);
  }

  function shootProton(event) {
    if (!active || !window.__mol3d || !window.__mol3d.THREE) return;
    var THREE = window.__mol3d.THREE;
    var camera = window.__mol3d.camera;
    var renderer = window.__mol3d.renderer;
    if (!camera || !renderer) return;

    var rect = renderer.domElement.getBoundingClientRect();
    var mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    var raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    var meshes = findAtomMeshes();
    var hits = raycaster.intersectObjects(meshes);
    if (!hits.length) return;

    var hit = hits[0];
    var ids = hit.object.userData.ids;
    if (!ids || hit.instanceId === undefined) return;

    var atomId = ids[hit.instanceId];
    var atom = window.__mol3d.atoms.get(atomId);
    if (!atom) return;

    // Asked before the trigger is pulled, and asked again when the particle lands:
    // a nucleus that is already splitting cannot take another particle, and the
    // player must not pay for a shot this build refuses to fire.
    if (atom.el.z > 82 && timerAtomId === atomId && timerInterval) {
      showStatus(tt('pg.alreadyCritical'));
      return;
    }

    // The shop hands over the particle first: a shot that was not paid for does
    // not exist, and an empty magazine must leave the atom exactly as it was.
    var paid = spendAmmo(mode);
    if (!paid.ok) { refuseForAmmo(mode); return; }

    var kind = mode;
    var target = { x: atom.pos.x, y: atom.pos.y, z: atom.pos.z };
    var deliver = function () { applyShot(kind, atomId, paid); };
    if (!fireNucleon(kind, raycaster.ray, target, deliver)) deliver();
    paintGun();
  }

  function addProton(atom, atomId, paid) {
    var oldEl = atom.el;
    var newZ = oldEl.z + 1;
    var newEl = findElement(newZ);
    if (!newEl) {
      // The particle was paid for, then the transmutation declined: give it back.
      refundAmmo('proton');
      showStatus(tt('pg.noAbove', { z: oldEl.z }) + refundNote('proton'));
      paintGun();
      return;
    }
    crateTransmute(atomId, newZ);

    var oldSym = oldEl.sym;
    // Proton capture lifts Z by one and A by one while N stands still, so the
    // record travels with the nucleus instead of being re-anchored: 13C + p is 14N
    // and 3H + p is 3He, one of them heavier than the new element's natural average
    // and the other lighter than it. A mass number carries both.
    var aBefore = massNumberOf(atomId, atom);
    atom.el = newEl;
    setNuclide(atomId, newZ, aBefore + 1);

    var compound = isotopeOfAtom(atomId, atom);
    var shed = settleNucleus(compound.z, compound.a);
    if (shed && shed.finalZ !== compound.z) applyNucleus(atom, atomId, shed.finalZ, shed.finalA);
    else if (shed) setNuclide(atomId, shed.finalZ, shed.finalA);

    var after = isotopeOfAtom(atomId, atom);
    var verdict = stabilityVerdict(after.z, after.a);

    var tail = spendTail(paid, 'proton');
    var head;
    if (shed) {
      // The compound nucleus existed for about 10^-22 s and gave a nucleon back.
      // Saying what is left is the honest part; the capture itself is still true.
      head = ejectionNote(shed, after.z, after.a);
      drawEjection(atom, shed);
      if (NOBLE_GASES.has(after.z)) head += L('ejectSevered', { n: severBonds(atomId) });
    } else if (NOBLE_GASES.has(newZ)) {
      head = tt('pg.addedProtonNoble', { from: oldSym, to: newEl.name, z: newZ, n: severBonds(atomId) });
    } else {
      head = tt('pg.addedProton', { from: oldSym, to: newEl.name, z: newZ });
    }
    showStatus(head + ' ' + verdictText(atom.el, after, verdict) + tail,
      verdict.key === 'inBand' ? 'ok' : 'err');

    setLastShot(after, verdict);

    if (window.__mol3d.updateAtomLabel) {
      // atom.el, not newEl: when the nucleus threw a proton back out the element the
      // shot aimed at is not the element standing there.
      window.__mol3d.updateAtomLabel(atomId, atom.el);
    }

    if (window.__xray && window.__xray.isActive && window.__xray.isActive()) {
      window.__xray.updateAtom(atomId, atom);
    }

    if (window.__mol3d.refreshInspector) {
      window.__mol3d.refreshInspector();
    }

    if (window.__mol3d.reanalyze) window.__mol3d.reanalyze();
    if (window.__mol3d.invalidate) window.__mol3d.invalidate();
    paintGun();
  }

  function startCriticalTimer(atom, atomId, compoundA, gen) {
    clearCriticalTimer();
    timerAtomId = atomId;
    var countdown = CRITICAL_SECONDS;
    // A shot at a nucleus already counting down is refused, so the isotope armed
    // here is the isotope that splits - and it is the one the countdown names.
    var a = compoundA || massNumberOf(atomId, atom);
    var isotopeName = atom.el.name + '-' + a;

    showStatus(tt('pg.critical', { name: isotopeName, z: atom.el.z, n: countdown }));
    createCriticalOverlay();
    updateCriticalOverlay(isotopeName, atom.el.z, countdown);
    showRedFlash();
    startAlarmSound();

    timerInterval = setInterval(function() {
      if (!window.__mol3d || !window.__mol3d.atoms.has(atomId)) {
        clearCriticalTimer();
        return;
      }

      countdown--;
      updateCriticalOverlay(isotopeName, atom.el.z, countdown);

      if (countdown > 0) {
        showStatus(tt('pg.criticalLeft', { n: countdown }));
      }

      if (countdown <= 0) {
        clearCriticalTimer();
        triggerFission(atomId, { compoundA: a, gen: gen });
      }
    }, 1000);
  }

  function resetCameraToGround() {
    if (!window.__mol3d || !window.__mol3d.camera) return;
    var cam = window.__mol3d.camera;
    cam.position.set(0, 4.2, 10.5);
    if (window.__mol3d.controls && window.__mol3d.controls.target) {
      window.__mol3d.controls.target.set(0, 1.6, 0);
      window.__mol3d.controls.update();
    }
    cam.lookAt(0, 0, 0);
  }

  // A unit vector, uniformly over the sphere. The split has no preferred
  // direction in the lab, so the axis the two fragments fly apart along is drawn
  // and both of them use the same one.
  function randomDirection() {
    const u = Math.random() * 2 - 1;
    const t = Math.random() * Math.PI * 2;
    const s = Math.sqrt(Math.max(0, 1 - u * u));
    return { x: s * Math.cos(t), y: s * Math.sin(t), z: u };
  }

  function radiusOf(el) {
    return 0.28 + ((el && el.radius) || 150) / 110;
  }

  // The two halves of the event, placed and moving. `charge: false` keeps them out
  // of the crate - the player never bought a caesium nucleus, the universe handed it
  // to them - and `silent` keeps the engine from selecting one and rewriting the
  // status line the fission is about to print.
  function spawnFragment(z, a, at, vel) {
    const el = findElement(z);
    const API = window.__mol3d;
    if (!el || !API || typeof API.spawnAtom !== 'function') return null;
    const id = API.spawnAtom(el, { x: at.x, y: at.y, z: at.z }, { charge: false, silent: true });
    if (id === null || id === undefined) return null;
    // The isotope record has to exist before anything reads the atom: the label is
    // drawn from it, and so is the decay clock the sweep runs a second later. A
    // fission product is born neutron-rich, which is exactly why it decays.
    setNuclide(id, z, a);
    const atom = API.atoms.get(id);
    if (atom) atom.vel = { x: vel.x, y: vel.y, z: vel.z };
    if (API.updateAtomLabel) API.updateAtomLabel(id, el);
    if (window.__xray && window.__xray.isActive && window.__xray.isActive()) {
      // updateAtom builds the structure when there is none, which is the case for
      // both fragments: they were not in the scene a moment ago.
      window.__xray.updateAtom(id, atom);
    }
    return id;
  }

  // Prompt neutrons are what makes a fission more than the death of one nucleus:
  // each one leaves the split at about 2 MeV, and a 2 MeV neutron has roughly the
  // one-in-four chance described above of splitting a heavy nucleus it meets. Only
  // a fissile nucleus is taken as a certain catch here, because that chance is what
  // the shot itself already rolled.
  function releasePromptNeutrons(ev, from, gen, sourceId) {
    const out = { caught: 0, escaped: ev.nu };
    const API = window.__mol3d;
    if (!API || !API.atoms || gen >= MAX_CHAIN_GEN) return out;
    const targets = [];
    for (const pair of API.atoms) {
      const id = pair[0], atom = pair[1];
      if (!atom || !atom.el) continue;
      // The nucleus that is splitting cannot catch one of its own neutrons: it is
      // the source, and counting it would both claim a chain that is not there and
      // schedule a second detonation of an atom that is about to be deleted.
      if (id === sourceId) continue;
      const a = massNumberOf(id, atom);
      if (!isFissile(atom.el.z, a)) continue;
      const d = Math.hypot(atom.pos.x - from.x, atom.pos.y - from.y, atom.pos.z - from.z);
      if (d > CHAIN_RADIUS) continue;
      targets.push({ id: id, atom: atom, compoundA: a + 1, d: d });
    }
    targets.sort(function (p, q) { return p.d - q.d; });
    const take = Math.min(targets.length, ev.nu);
    for (let i = 0; i < take; i++) {
      const t = targets[i];
      // A generation is not instantaneous: the neutron has to cross the gap, and
      // staggering them also keeps one frame from detonating a whole uranium bag.
      // The second generation gets no countdown - the player warned themselves
      // about the first one, and a prompt chain does not wait for anyone.
      //
      // The crossing is the flight of the particle, drawn rather than waited for:
      // one gray ball per neutron, and the nucleus it lands on answers when it lands.
      const ms = 300 + i * 400;
      const onto = { x: t.atom.pos.x, y: t.atom.pos.y, z: t.atom.pos.z };
      const detonate = function () {
        if (!window.__mol3d || !window.__mol3d.atoms.has(t.id)) return;
        triggerFission(t.id, { compoundA: t.compoundA, gen: gen + 1 });
      };
      if (!flyNucleon('neutron', from, onto, ms, { onArrive: detonate })) {
        setTimeout(detonate, ms);
      }
      out.caught++;
    }
    out.escaped = ev.nu - out.caught;
    // The neutrons that found no nucleus in time still left the split, and a
    // 2 MeV neutron does not simply stop existing off the edge of the screen.
    for (let i = 0; i < out.escaped; i++) {
      const dir = randomDirection();
      flyNucleon('neutron', from, {
        x: from.x + dir.x * 6, y: from.y + dir.y * 6, z: from.z + dir.z * 6
      }, 900, { fade: true });
    }
    return out;
  }

  // opts.compoundA: the nucleus that actually splits. A captured neutron is part of
  // it by then, so a shot at U-235 splits U-236; a spontaneous fission has no
  // capture and splits the nucleus as it stands.
  function triggerFission(atomId, opts) {
    if (!window.__mol3d || !window.__mol3d.atoms) return;
    var atom = window.__mol3d.atoms.get(atomId);
    if (!atom) return;
    var N = window.__nuclear;
    var oldZ = atom.el.z;
    var oldName = atom.el.name;
    var oldSym = atom.el.sym;
    // Read before the ledger record dies with the atom: the cinematic has to quote
    // the isotope the player actually built, not the element it is made of.
    var oldA = (opts && opts.compoundA) || massNumberOf(atomId, atom);
    var gen = (opts && opts.gen) || 0;
    var pos = { x: atom.pos.x, y: atom.pos.y, z: atom.pos.z };
    // The bubble has to grow from where the atom actually is on screen, so read it
    // while the atom still exists; the fragments take its place a moment later.
    var screen = window.__mol3d.screenPosOf ? window.__mol3d.screenPosOf(atomId) : null;

    // The split itself is not invented here. nuclear.js draws the fragment masses
    // from this nucleus' own yield curve, fixes the complement by conservation,
    // assigns their charges by unchanged-charge distribution, and only accepts a
    // pair the mass formula says releases energy.
    var ev = N && typeof N.sampleFission === 'function' ? N.sampleFission(oldZ, oldA) : null;
    if (!ev) {
      // No pair the formula will pay for: the nucleus stays one nucleus, and the
      // shot that aimed at it has to be told so rather than answered with a show.
      showStatus(L('fissionDeclined', {
        parent: oldName + '-' + oldA, sym: oldSym, a: oldA, z: oldZ
      }));
      return;
    }
    var caught = releasePromptNeutrons(ev, pos, gen, atomId);

    if (window.__xray && window.__xray.removeAtom) {
      window.__xray.removeAtom(atomId);
    }

    var lightEl = findElement(ev.light.z);
    var heavyEl = findElement(ev.heavy.z);
    if (!lightEl || !heavyEl) return;

    window.__mol3d.atoms.delete(atomId);
    // The atom is gone, so its isotope record goes with it; the sweep below would
    // catch it a second later, but fission is exactly when the ledger should be
    // clean because the fragments take over the space it left.
    neutronLedger.delete(atomId);
    saveLedger();
    setLastShot(null, null);
    for (var entry of window.__mol3d.bonds) {
      var b = entry[1];
      if (b.a === atomId || b.b === atomId) window.__mol3d.bonds.delete(entry[0]);
    }

    // Back to back along one axis, touching at the moment of the split, then
    // apart. Momentum is equal and opposite, so the lighter fragment is the faster
    // one by exactly the ratio of the masses, and the speeds below carry the
    // energies the event reports rather than a number picked for the animation.
    var dir = randomDirection();
    var gapLight = radiusOf(lightEl) + 0.25;
    var gapHeavy = radiusOf(heavyEl) + 0.25;
    var betaLight = Math.sqrt(2 * ev.lightEnergy / (ev.light.a * NEUTRON_MASS_MEV));
    var betaHeavy = Math.sqrt(2 * ev.heavyEnergy / (ev.heavy.a * NEUTRON_MASS_MEV));
    var vL = FRAG_SPEED * betaLight, vH = FRAG_SPEED * betaHeavy;
    var f1 = spawnFragment(ev.light.z, ev.light.a, {
      x: pos.x + dir.x * gapLight, y: pos.y + dir.y * gapLight, z: pos.z + dir.z * gapLight
    }, { x: dir.x * vL, y: dir.y * vL, z: dir.z * vL });
    var f2 = spawnFragment(ev.heavy.z, ev.heavy.a, {
      x: pos.x - dir.x * gapHeavy, y: pos.y - dir.y * gapHeavy, z: pos.z - dir.z * gapHeavy
    }, { x: -dir.x * vH, y: -dir.y * vH, z: -dir.z * vH });

    if (window.__mol3d.vfx && window.__mol3d.vfx.reactionVFX && window.__mol3d.THREE) {
      window.__mol3d.vfx.reactionVFX.fission(
        new window.__mol3d.THREE.Vector3(pos.x, pos.y, pos.z), 5.0
      );
    }
    if (window.__mol3d.triggerNuclearVFX) {
      window.__mol3d.triggerNuclearVFX();
    }

    var labelLight = N.nuclideLabel(ev.light.z, ev.light.a);
    var labelHeavy = N.nuclideLabel(ev.heavy.z, ev.heavy.a);
    var note = L('fissionShot', {
      parent: oldSym + '-' + oldA,
      f1: labelLight, f2: labelHeavy,
      nu: ev.nu, energy: N.formatEnergy(ev.energy),
      src: L(ev.energySource === 'measured' ? 'srcMeasured' : 'srcModel')
    });
    // A fragment that could not be placed is a fact about the scene, not a detail
    // to smooth over: the split happened, one of its halves is not in front of you.
    if (f1 === null) note += L('fragMissing', { f: labelLight });
    if (f2 === null) note += L('fragMissing', { f: labelHeavy });
    if (caught.caught > 0) note += L('chainNote', { n: caught.caught });
    showStatus(note);
    if (window.__mol3d.reanalyze) window.__mol3d.reanalyze();
    if (window.__mol3d.refreshInspector) window.__mol3d.refreshInspector();
    if (window.__mol3d.invalidate) window.__mol3d.invalidate();

    // White bubble from the fission point -> 10 s whiteout -> irradiated wasteland,
    // then ARIA walks the player through the nucleus that actually split.
    playFissionCinematic({
      origin: screen,
      elementName: oldName,
      z: oldZ,
      a: oldA,
      sym: oldSym,
      event: ev,
      fragNames: [lightEl.name, heavyEl.name],
      // The world is not erased. Two new nuclei are standing where one was, and
      // they are radioactive: the aftermath is the point.
      onReveal: function () {
        if (window.__mol3d.refreshInspector) window.__mol3d.refreshInspector();
        if (window.__mol3d.invalidate) window.__mol3d.invalidate();
      }
    });
  }

  function init() {
    var btn = document.getElementById('btn-proton');
    gunBtn = btn;
    if (btn) {
      relabelButton();
      btn.addEventListener('click', function() {
        if (window.__mol3dShop && window.__mol3dShop.blocksFeature('proton')) {
          showStatus(window.__mol3dShop.lockedMessage('proton'));
          window.__mol3dShop.open();
          return;
        }
        active = !active;
        btn.classList.toggle('on', active);
        var msg = active ? tt('pg.on') : tt('pg.off');
        if (active) { showGun(); msg += ' · ' + armedNote(); }
        else hideGun();
        showStatus(msg);
        // Don't clear critical timer when toggling off - fission continues independently
      });
    }

    function attachClick() {
      if (window.__mol3d && window.__mol3d.renderer) {
        window.__mol3d.renderer.domElement.addEventListener('click', shootProton);
        return true;
      }
      return false;
    }

    if (!attachClick()) {
      var poll = setInterval(function() { if (attachClick()) clearInterval(poll); }, 200);
    }

    // The shop builds itself only once the engine has handed over its element
    // table, so the ammo subscription is armed the same patient way.
    if (!attachShopWatch()) {
      var pollShop = setInterval(function () { if (attachShopWatch()) clearInterval(pollShop); }, 400);
    }

    // Atoms leave the scene through the engine's own delete paths, which this
    // module may not hook; a slow sweep keeps the neutron ledger from keeping
    // records of atoms that no longer exist. The records themselves were read
    // before the engine booted, because its labels ask for them.
    setInterval(pruneLedger, LEDGER_PRUNE_MS);

    window.addEventListener('mol3d:lang', function () {
      relabelButton();
      paintGun();
      if (panel && panel.classList.contains('open')) placeGun();
    });
    window.addEventListener('resize', function () { if (panel && panel.classList.contains('open')) placeGun(); });

    // Merged, not replaced: the early block above already handed over the isotope
    // record readers the engine needs before a single atom exists, and assigning
    // fresh here would take them away again as soon as the button wiring finished.
    window.__protonGun = Object.assign(window.__protonGun || {}, {
      toggle: function() { if (btn) btn.click(); },
      isActive: function() { return active; },
      shoot: shootProton,
      fission: triggerFission,
      playCinematic: playFissionCinematic,
      stopCinematic: cineStop,
      // Two barrels now, and an isotope record: anything outside this file asks
      // these instead of guessing at what the last shot put into an atom.
      mode: function() { return mode; },
      setMode: function(kind) { setMode(kind); },
      kinds: function() { return KINDS.slice(); },
      ammoOf: ammoCount,
      ammoPriceOf: ammoPrice,
      neutronExcessOf: excessOf,
      hasIsotopeRecord: hasIsotopeRecord,
      setNuclide: setNuclide,
      isotopeOf: function(atomId) {
        var atoms = window.__mol3d && window.__mol3d.atoms;
        var atom = atoms && typeof atoms.get === 'function' ? atoms.get(atomId) : null;
        return atom ? isotopeOfAtom(atomId, atom) : null;
      },
      stabilityOf: function(atomId) {
        var iso = this.isotopeOf(atomId);
        return iso ? stabilityVerdict(iso.z, iso.a) : null;
      },
      // The drip line is a claim about the charts, not about this file's opinion, so
      // both the span it reads and what a nucleus would settle to are readable here.
      dripSpanOf: function(z) { return measuredSpan(z); },
      settleTo: function(z, a) { return settleNucleus(z, a); },
      // The full priced ejection: which line, how many nucleons, the separation
      // energy of each step, the Q it releases and the speed the particle leaves
      // with. Nothing here is tabulated per nuclide — it all comes from the mass
      // formula, so any nucleus in the scene can be asked.
      ejectionOf: function(z, a) { return settleNucleus(z, a); },
      separationOf: function(z, a, kind) { return separationEnergy(z, a, kind); },
      nucleonsInFlight: function() { return flying.length; },
      panelOpen: function() { return !!(panel && panel.classList.contains('open')); }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
