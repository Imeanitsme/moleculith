// Proton Gun & Nuclear Fission System - Standalone module
(function() {
  'use strict';
  let active = false;
  let timerInterval = null;
  let timerAtomId = null;
  let criticalOverlay = null;
  let redFlash = null;

  const NOBLE_GASES = new Set([2, 10, 18, 36, 54, 86, 118]);

  function showStatus(msg, kind) {
    const el = document.getElementById('status-text');
    if (el) { el.textContent = msg; el.className = kind || 'info'; }
  }

  function esc(v) { return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function tt(key, params) {
    const i18n = window.__mol3d && window.__mol3d.i18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, params) : key;
  }

  // The proton gun may only push an atom into an element the player actually owns.
  function ownsElement(z) {
    const shop = window.__mol3dShop;
    if (!shop || typeof shop.ownsElement !== 'function') return true;
    return !!shop.ownsElement(z);
  }
  function tierPriceFor(z) {
    const shop = window.__mol3dShop;
    const tiers = shop && shop.catalogue && shop.catalogue.tiers;
    if (!Array.isArray(tiers)) return null;
    let base = null;
    for (let i = 0; i < tiers.length; i++) if (z <= tiers[i].maxZ) { base = tiers[i].price; break; }
    if (base === null) return null;
    if (typeof shop.priceOf === 'function') return shop.priceOf(base);
    return base;
  }
  function elNameOf(el) {
    const i18n = window.__mol3d && window.__mol3d.i18n;
    try {
      if (el && i18n && typeof i18n.elName === 'function') return i18n.elName(el);
    } catch (e) {}
    return el ? (el.name || el.sym) : '';
  }
  function refuseUpgrade(newEl) {
    const price = tierPriceFor(newEl.z);
    const params = { sym: newEl.sym, name: elNameOf(newEl), price: price };
    const msg = price === null || price === undefined
      ? tt('pg.needOwn', params)
      : tt('pg.needOwnPrice', params);
    showStatus('🔒 ' + msg, 'err');
    const shop = window.__mol3dShop;
    if (shop && typeof shop.open === 'function') shop.open();
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
        massTitle: 'Phân bố khối lượng mảnh vỡ — U-235, neutron nhiệt',
        massNote: 'Hiệu suất độc lập Y(A), % trên mỗi số khối. Vạch đỏ: phép chia đôi mà bạn vừa buộc hạt nhân thực hiện.',
        mark: 'chia đôi · xác suất < 1%',
        energyTitle: 'Phân bố năng lượng — 202,5 MeV cho mỗi phân hạch',
        eLab: ['động năng mảnh', 'neutron', 'gamma tức thời', 'beta', 'gamma sản phẩm', 'neutrino'],
        total: 'Tổng phát ra tức thời',
        perKg: '1 phân hạch = 3,24 × 10⁻¹¹ J · 1 mol U-235 = 1,95 × 10¹⁰ kJ',
        axisA: 'số khối A',
        lose: 'thoát ra ngoài, không thu hồi được'
      },
      facts: [
        'Hai mảnh vỡ mang đi ≈ 168 MeV động năng; tổng một phân hạch U-235 ≈ 202,5 MeV ≈ 3,24 × 10⁻¹¹ J.',
        '1 kg U-235 phân hạch hoàn toàn: ≈ 8,3 × 10¹³ J ≈ 20 tấn TNT — đương lượng của một quả bom trút xuống một thành phố.',
        'Hiroshima, 6-8-1945: quả Little Boy chở 64 kg uranium, chưa tới 1 kg kịp phân hạch; 90.000 – 146.000 người đã chết trước cuối năm đó.',
        'Một liên kết hóa học bạn vừa xây ở đây: ≈ 4 eV. Phân hạch mạnh gấp ≈ 5 × 10⁷ lần.',
        'Chu kỳ bán rã của Pu-239 là 24.100 năm: sau 240 thế kỷ, một nửa chất độc vẫn còn đó — lâu hơn mọi nền văn minh trên mặt đất.'
      ],
      dialogue: [
        { who: 'aria', text: 'Bạn còn ở đó không? Ánh sáng vừa tan, và tôi không còn thấy phân tử nào nữa.' },
        { who: 'you', text: 'Tôi vẫn ở đây. Thế giới thì không.' },
        { who: 'aria', text: 'Chỉ một hạt nhân vừa tách đôi. Hai mảnh, ba neutron, 200 MeV — gấp năm mươi triệu lần năng lượng của một liên kết hóa học.' },
        { who: 'you', text: 'Tất cả những gì tôi xây bao lâu nay… giờ chỉ còn tro.' },
        { who: 'aria', text: 'Tro là cách nói đẹp. Đó là bụi của những nguyên tử từng là mái nhà, là cửa kính, là cơ thể con người.' },
        { who: 'you', text: 'Sao tôi không thấy giận? Tôi chỉ thấy trống.' },
        { who: 'aria', text: 'Vì giận là cảm giác của người còn sống. Bạn còn sống — đó không phải tai nạn, đó là trách nhiệm.' },
        { who: 'aria', text: 'Nguyên tử không biết gì về chiến tranh. Proton, neutron, lực hạt nhân mạnh, định luật bảo toàn — chúng chỉ làm đúng điều đó. Khác biệt giữa một lò phản ứng và một thành phố bị xóa sổ không phải vật lý. Là lựa chọn.' },
        { who: 'you', text: 'Vậy tôi phải làm gì với đống đổ nát này?' },
        { who: 'aria', text: 'Điều duy nhất một nhà hóa học làm được: xây lại. Từng liên kết một.' },
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
        massTitle: 'Fragment mass yield — U-235, thermal neutrons',
        massNote: 'Independent cumulative yield Y(A), % per mass unit. Red line: the even split you just forced on the nucleus.',
        mark: 'symmetric · probability < 1%',
        energyTitle: 'Energy release — 202.5 MeV per fission',
        eLab: ['fragment kinetic', 'neutrons', 'prompt gamma', 'beta', 'product gamma', 'neutrinos'],
        total: 'Prompt energy released',
        perKg: 'one fission = 3.24 × 10⁻¹¹ J · 1 mol of U-235 = 1.95 × 10¹⁰ kJ',
        axisA: 'mass number A',
        lose: 'escapes, cannot be recovered'
      },
      facts: [
        'The two fragments carry away ≈ 168 MeV of kinetic energy; one U-235 fission totals ≈ 202.5 MeV ≈ 3.24 × 10⁻¹¹ J.',
        '1 kg of U-235 fully fissioned: ≈ 8.3 × 10¹³ J ≈ 20 tonnes of TNT — the yield of a bomb dropped on a city.',
        'Hiroshima, 6 August 1945: Little Boy carried 64 kg of uranium and less than 1 kg actually fissioned; 90,000 – 146,000 people were dead by the end of that year.',
        'A chemical bond you just built in here: ≈ 4 eV. Fission is ≈ 5 × 10⁷ times stronger per event.',
        'Pu-239 has a half-life of 24,100 years: after 240 centuries half the poison is still there — longer than every civilisation on this ground.'
      ],
      dialogue: [
        { who: 'aria', text: 'Are you still there? The light just cleared, and I cannot find a single molecule left.' },
        { who: 'you', text: 'I am still here. The world is not.' },
        { who: 'aria', text: 'One nucleus split. Two fragments, three neutrons, 200 MeV — fifty million times the energy of one chemical bond.' },
        { who: 'you', text: 'Everything I built… is ash now.' },
        { who: 'aria', text: 'Ash is the polite word. It is dust from atoms that were roofs, and windows, and people.' },
        { who: 'you', text: 'Why am I not angry? I only feel empty.' },
        { who: 'aria', text: 'Because anger belongs to the living. You are alive — that is not an accident, it is a responsibility.' },
        { who: 'aria', text: 'Atoms know nothing about war. Protons, neutrons, the strong force, conservation — that is all they do. The difference between a reactor and a city wiped off the map is not physics. It is a choice.' },
        { who: 'you', text: 'So what do I do with this ruin?' },
        { who: 'aria', text: 'The only thing a chemist can do: build it back. One bond at a time.' },
        { who: 'aria', text: 'And remember that every bond you make has two futures: warming a city, or burning one down.' },
        { who: 'aria', text: 'Peace is not the default state of matter. It is a reaction we have to balance again every single day.' }
      ]
    }
  };

  let cine = null;

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

  // Independent fission-fragment mass yield of U-235 with thermal neutrons, from the
  // evaluated yield libraries: light peak A=95 (6.6 %), valley A=115 (0.8 %), heavy
  // peak A=135 (6.8 %). The energy column is the standard partition of the 202.5 MeV
  // per fission; neutrinos carry 8.8 MeV straight out of the reactor.
  const YIELD_PTS = [
    [70, .45], [75, .8], [79, 2.0], [82, 3.3], [85, 4.6], [88, 5.6], [90, 6.0],
    [92, 6.4], [94, 6.6], [96, 6.1], [98, 5.2], [101, 4.0], [104, 2.9], [107, 1.9],
    [110, 1.3], [113, .95], [116, .8], [119, .78], [122, .85], [125, 1.2], [128, 1.9],
    [131, 4.2], [133, 5.8], [135, 6.8], [137, 6.6], [139, 5.9], [141, 4.8], [143, 3.6],
    [146, 2.2], [149, 1.2], [152, .7], [155, .35], [158, .2], [162, .08], [165, .02]
  ];
  const ENERGY_MEV = [168.3, 4.8, 7.0, 7.0, 6.6, 8.8];
  const YIELD_MAX = 7.2;

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

  // Drawn on the whiteout while the screen is still blank, so the instrument reads
  // before the world does.
  function cineGraphs(sheet, data) {
    const S = CINE_STR[cineLang()].g;
    const aMin = 70, aMax = 165, nBars = 48;
    const aTot = Math.max(4, Math.round((data.z || 92) * 2.55));
    const a1 = Math.round(aTot / 2), a2 = aTot - a1;
    let ybars = '', ebars = '', elabs = '';
    for (let i = 0; i < nBars; i++) ybars += '<div class="pg-bar"><i></i></div>';
    for (let e = 0; e < ENERGY_MEV.length; e++) {
      ebars += '<div class="pg-bar pg-en' + (e === ENERGY_MEV.length - 1 ? ' pg-lose' : '') + '"><i></i></div>';
      elabs += '<div class="pg-cap-lab">' + esc(S.eLab[e]) + '<br>' + ENERGY_MEV[e].toFixed(1) + '</div>';
    }
    const box = cineNode('div', 'pg-graphs');
    box.innerHTML =
      '<div class="pg-gpanel">' +
        '<div class="pg-gtitle">' + esc(S.massTitle) + '</div>' +
        '<div class="pg-gnote">' + esc(S.massNote) + '</div>' +
        '<div class="pg-gplot">' + ybars + '<div class="pg-marks"></div></div>' +
        '<div class="pg-axis"><span>A ' + aMin + '</span><span>' + esc(S.axisA) +
          '</span><span>A ' + aMax + ' · Y(A) %</span></div>' +
      '</div>' +
      '<div class="pg-gpanel">' +
        '<div class="pg-gtitle">' + esc(S.energyTitle) + '</div>' +
        '<div class="pg-gplot">' + ebars + '</div>' +
        '<div class="pg-lrow">' + elabs + '</div>' +
        '<div class="pg-readout">' + esc(S.total) + ': <b>0.0</b> MeV &middot; ' + esc(S.perKg) + '</div>' +
      '</div>';
    sheet.appendChild(box);
    void box.offsetHeight;

    const plots = box.querySelectorAll('.pg-gplot');
    const ys = plots[0].querySelectorAll('.pg-bar i');
    for (let i = 0; i < nBars; i++) {
      const a = aMin + ((aMax - aMin) * i) / (nBars - 1);
      ys[i].style.transitionDelay = (Math.random() * 1100).toFixed(0) + 'ms';
      ys[i].style.height = Math.max(0.6, (yieldAt(a) / YIELD_MAX) * 100).toFixed(1) + '%';
    }
    const es = plots[1].querySelectorAll('.pg-bar i');
    const eMax = Math.max.apply(null, ENERGY_MEV);
    for (let e = 0; e < es.length; e++) {
      es[e].style.transitionDelay = (600 + Math.random() * 1400).toFixed(0) + 'ms';
      es[e].style.height = (ENERGY_MEV[e] / eMax) * 100 + '%';
    }

    const marks = box.querySelector('.pg-marks');
    [a1, a2].forEach(function (a, i) {
      const mk = document.createElement('div');
      mk.className = 'pg-mark';
      mk.style.left = (((a - aMin) / (aMax - aMin)) * 100).toFixed(2) + '%';
      mk.innerHTML = i === 0
        ? '<span>A ' + a + ' / ' + a2 + ' — ' + esc(S.mark) + '</span>'
        : '<span></span>';
      mk.style.transitionDelay = '1500ms';
      mk.style.opacity = '1';
      marks.appendChild(mk);
    });

    const readout = box.querySelector('.pg-readout b');
    const totalMev = ENERGY_MEV.reduce(function (a, b) { return a + b; }, 0);
    let shown = 0;
    const ticker = cineEvery(function () {
      shown = Math.min(totalMev, shown + totalMev / 45);
      readout.textContent = shown.toFixed(1);
      if (shown >= totalMev) clearInterval(ticker);
    }, 28);
  }

  function cineWasteland() {
    const S = CINE_STR[cineLang()];
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
        '<ul class="pg-cap-facts">' + S.facts.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>' +
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

  function cineDialogue(done) {
    const S = CINE_STR[cineLang()];
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
    let idx = 0, tick = null, wait = null;

    function showNext() {
      if (idx >= S.dialogue.length) { finish(); return; }
      const entry = S.dialogue[idx++];
      const isYou = entry.who === 'you';
      line.classList.toggle('pg-you', isYou);
      face.innerHTML = isYou ? '<div class="pg-you-mark">☹</div>' : AVATAR;
      nameEl.textContent = isYou ? S.you : S.aria;
      textEl.textContent = '';
      hint.textContent = '';
      const chars = Array.from(entry.text);
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
        textEl.textContent = S.dialogue[idx - 1].text;
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
  function playFissionCinematic(opts) {
    if (cine) return false;
    ensureCineStyles();
    cine = { nodes: [], timers: [], millis: [], raf: null };
    const origin = opts.origin && isFinite(opts.origin.x) && isFinite(opts.origin.y)
      ? opts.origin : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const sheet = cineGrow(origin, function () {
      // Arm the reveal before drawing anything, so a bad frame cannot leave the
      // player staring at a white screen with no scheduled way out.
      cineAfter(function () {
        cineWasteland();
        if (opts.onReveal) opts.onReveal();
        if (sheet) {
          sheet.style.transition = 'opacity ' + (CINE.fadeMs / 1000) + 's ease-out';
          sheet.style.opacity = '0';
        }
        cineAfter(function () { if (sheet && sheet.parentNode) sheet.parentNode.removeChild(sheet); }, CINE.fadeMs + 140);
        cineAfter(function () {
          cineDialogue(function () { cineRestore(opts.elementName, opts.onDone); });
        }, CINE.fadeMs + 320);
      }, CINE.holdMs);
      cineGraphs(sheet, opts);
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

    if (atom.el.z > 82) {
      // If already counting down on this atom, don't reset
      if (timerAtomId === atomId && timerInterval) {
        showStatus(tt('pg.alreadyCritical'));
        return;
      }
      startCriticalTimer(atom, atomId);
    } else {
      addProton(atom, atomId);
    }
  }

  function addProton(atom, atomId) {
    var newZ = atom.el.z + 1;
    var newEl = findElement(newZ);
    if (!newEl) { showStatus(tt('pg.noAbove', { z: atom.el.z })); return; }
    if (!ownsElement(newZ)) { refuseUpgrade(newEl); return; }

    var oldSym = atom.el.sym;
    var isNoble = NOBLE_GASES.has(newZ);
    atom.el = newEl;

    if (isNoble) {
      var bondsBroken = 0;
      for (var entry of window.__mol3d.bonds) {
        var b = entry[1];
        if (b.a === atomId || b.b === atomId) {
          window.__mol3d.bonds.delete(entry[0]);
          bondsBroken++;
        }
      }
      showStatus(tt('pg.addedProtonNoble', { from: oldSym, to: newEl.name, z: newZ, n: bondsBroken }));
    } else {
      showStatus(tt('pg.addedProton', { from: oldSym, to: newEl.name, z: newZ }));
    }

    if (window.__mol3d.updateAtomLabel) {
      window.__mol3d.updateAtomLabel(atomId, newEl);
    }

    if (window.__xray && window.__xray.isActive && window.__xray.isActive()) {
      window.__xray.updateAtom(atomId, atom);
    }

    if (window.__mol3d.refreshInspector) {
      window.__mol3d.refreshInspector();
    }

    if (window.__mol3d.reanalyze) window.__mol3d.reanalyze();
    if (window.__mol3d.invalidate) window.__mol3d.invalidate();
  }

  function startCriticalTimer(atom, atomId) {
    clearCriticalTimer();
    timerAtomId = atomId;
    var countdown = 60;

    showStatus(tt('pg.critical', { name: atom.el.name, z: atom.el.z, n: countdown }));
    createCriticalOverlay();
    updateCriticalOverlay(atom.el.name, atom.el.z, countdown);
    showRedFlash();
    startAlarmSound();

    timerInterval = setInterval(function() {
      if (!window.__mol3d || !window.__mol3d.atoms.has(atomId)) {
        clearCriticalTimer();
        return;
      }

      countdown--;
      updateCriticalOverlay(atom.el.name, atom.el.z, countdown);

      if (countdown > 0) {
        showStatus(tt('pg.criticalLeft', { n: countdown }));
      }

      if (countdown <= 0) {
        clearCriticalTimer();
        triggerFission(atomId);
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

  function triggerFission(atomId) {
    if (!window.__mol3d || !window.__mol3d.atoms) return;
    var atom = window.__mol3d.atoms.get(atomId);
    if (!atom) return;
    var oldZ = atom.el.z;
    var oldName = atom.el.name;
    var pos = { x: atom.pos.x, y: atom.pos.y, z: atom.pos.z };
    // The bubble has to grow from where the atom actually is on screen, so read it
    // while the atom still exists; clearAll() later would make it unresolvable.
    var screen = window.__mol3d.screenPosOf ? window.__mol3d.screenPosOf(atomId) : null;

    if (window.__xray && window.__xray.removeAtom) {
      window.__xray.removeAtom(atomId);
    }

    var split1 = Math.floor(oldZ / 2);
    var split2 = oldZ - split1;
    var el1 = findElement(split1);
    var el2 = findElement(split2);
    if (!el1 || !el2) return;

    window.__mol3d.atoms.delete(atomId);
    for (var entry of window.__mol3d.bonds) {
      var b = entry[1];
      if (b.a === atomId || b.b === atomId) window.__mol3d.bonds.delete(entry[0]);
    }

    if (window.__mol3d.vfx && window.__mol3d.vfx.reactionVFX && window.__mol3d.THREE) {
      window.__mol3d.vfx.reactionVFX.fission(
        new window.__mol3d.THREE.Vector3(pos.x, pos.y, pos.z), 5.0
      );
    }
    if (window.__mol3d.triggerNuclearVFX) {
      window.__mol3d.triggerNuclearVFX();
    }

    showStatus(tt('pg.fission', { name: oldName, a: el1.name, b: el2.name }));
    if (window.__mol3d.reanalyze) window.__mol3d.reanalyze();
    if (window.__mol3d.refreshInspector) window.__mol3d.refreshInspector();
    if (window.__mol3d.invalidate) window.__mol3d.invalidate();

    // White bubble from the fission point -> 10 s whiteout -> irradiated wasteland,
    // then ARIA walks the player through what just happened.
    playFissionCinematic({
      origin: screen,
      elementName: oldName,
      z: oldZ,
      onReveal: function() {
        if (window.__mol3d.clearAll) window.__mol3d.clearAll();
        resetCameraToGround();
      }
    });
  }

  function init() {
    var btn = document.getElementById('btn-proton');
    if (btn) {
      btn.addEventListener('click', function() {
        if (window.__mol3dShop && window.__mol3dShop.blocksFeature('proton')) {
          showStatus(window.__mol3dShop.lockedMessage('proton'));
          window.__mol3dShop.open();
          return;
        }
        active = !active;
        btn.classList.toggle('on', active);
        showStatus(active ? tt('pg.on') : tt('pg.off'));
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

    window.__protonGun = {
      toggle: function() { if (btn) btn.click(); },
      isActive: function() { return active; },
      shoot: shootProton,
      fission: triggerFission,
      playCinematic: playFissionCinematic,
      stopCinematic: cineStop
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
