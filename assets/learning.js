(function () {
  'use strict';
  if (window.__mol3dLearning) return;
  const KEY = 'mol3d.learning.v1';
  const content = window.MolLearningContent;
  const lessons = content.lessons;
  const api = () => window.__mol3d;
  const vi = () => (api()?.i18n.getLang() || 'vi') !== 'en';
  const text = pair => pair[vi() ? 'vi' : 'en'];
  const L = (en, vn) => vi() ? vn : en;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const fresh = () => ({ v: 1, mode: 'guided', welcomed: false, active: null, done: {}, seen: {}, runs: {} });
  function sanitize(raw) {
    const out = fresh();
    if (!raw || typeof raw !== 'object') return out;
    if (['guided', 'standard', 'expert'].includes(raw.mode)) out.mode = raw.mode;
    out.welcomed = raw.welcomed === true;
    if (lessons.some(l => l.id === raw.active)) out.active = raw.active;
    for (const l of lessons) {
      if (Number.isFinite(raw.done?.[l.id]) && raw.done[l.id] > 0) out.done[l.id] = raw.done[l.id];
      const r = raw.runs?.[l.id];
      if (!r || typeof r !== 'object') continue;
      out.runs[l.id] = {
        checks: l.checks.map((_, i) => r.checks?.[i] === true), quiz: r.quiz === true,
        inspected: Array.isArray(r.inspected) ? r.inspected.filter(n => Number.isInteger(n) && n > 0).slice(0, 500) : [],
        baseline: Array.isArray(r.baseline) ? r.baseline.filter(s => typeof s === 'string').slice(0, 500) : [],
        prediction: typeof r.prediction === 'string' ? r.prediction.slice(0, 1000) : '',
        observation: typeof r.observation === 'string' ? r.observation.slice(0, 1000) : '',
        predicted: r.predicted === true,
        camera: Array.isArray(r.camera) && r.camera.length === 4 && r.camera.every(Number.isFinite) ? r.camera : null
      };
    }
    for (const g of content.glossary) if (raw.seen?.[g[0]] === true) out.seen[g[0]] = true;
    return out;
  }
  let state;
  try { state = sanitize(JSON.parse(localStorage.getItem(KEY))); } catch (_) { state = fresh(); }
  let panel, body, entry, mini, activeView = 'overview', inspectedId = null, storageFailed = false, returnFocus = null;
  let notice = '', noticeTone = 'info', hintVisible = false, lastOffer = 0, miniTarget = null;
  const current = () => lessons.find(l => l.id === state.active);
  const run = () => state.runs[state.active];
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); storageFailed = false; } catch (_) { storageFailed = true; }
    if (entry) entry.title = storageFailed ? L('Progress is only in memory: browser storage is unavailable.', 'Tiến độ chỉ ở bộ nhớ: không thể lưu trong trình duyệt.') : L('Learning modes, experiments and glossary', 'Chế độ học, thí nghiệm và từ điển');
  }
  function graphs() {
    const a = api();
    if (!a) return [];
    return a.comps().map((c, i) => {
      const ats = c.atoms.map(id => a.atoms.get(id)).filter(Boolean);
      const bs = c.bonds;
      const counts = {}, sums = new Map(ats.map(at => [at.id, 0]));
      ats.forEach(at => { counts[at.el.sym] = (counts[at.el.sym] || 0) + 1; });
      bs.forEach(b => { sums.set(b.a, sums.get(b.a) + b.order); sums.set(b.b, sums.get(b.b) + b.order); });
      const signature = ats.map(at => at.id + ':' + at.el.sym).sort().join(',') + '|' + bs.map(b => [Math.min(b.a, b.b), Math.max(b.a, b.b), b.order].join(':')).sort().join(',');
      const analysis = a.analyses()[i];
      const valences = { H: 1, C: 4, N: 3, O: 2 };
      const valid = ats.length > 1 && !bs.some(b => b.ionic || !Number.isInteger(b.order) || b.order < 1 || b.order > 3) &&
        ats.every(at => valences[at.el.sym] === sums.get(at.id)) && (analysis?.charge ?? 0) === 0;
      return { ats, bs, counts, sums, signature, valid, analysis };
    });
  }
  function formula(g, counts) {
    return Object.keys(g.counts).length === Object.keys(counts).length && Object.keys(counts).every(k => g.counts[k] === counts[k]);
  }
  function tetrahedral(g) {
    if (!g.valid || !formula(g, { C: 1, H: 4 })) return false;
    const c = g.ats.find(a => a.el.sym === 'C');
    const v = g.ats.filter(a => a !== c).map(a => [a.pos.x-c.pos.x, a.pos.y-c.pos.y, a.pos.z-c.pos.z]);
    for (let i=0; i<4; i++) for (let j=i+1; j<4; j++) {
      const den = Math.hypot(...v[i]) * Math.hypot(...v[j]);
      if (!den) return false;
      const angle = Math.acos(Math.max(-1, Math.min(1, v[i].reduce((s,x,k)=>s+x*v[j][k],0)/den))) * 180/Math.PI;
      if (!Number.isFinite(angle) || angle < 94 || angle > 124) return false;
    }
    return true;
  }
  function inspect(id) {
    const at = api()?.atoms.get(id);
    if (!at) return tell(L('That atom is no longer in the scene. Refresh the live list.', 'Nguyên tử không còn trong cảnh. Làm mới danh sách thật.'), 'warn');
    inspectedId = id;
    api().selectAtom(id);
    recordInspection(id);
    render();
  }
  function recordInspection(id) {
    if (!current() || !run() || (state.mode === 'expert' && panel.hidden)) return;
    const at = api().atoms.get(id);
    if (!at) return;
    inspectedId = id;
    const r = run();
    if (!r.inspected.includes(id)) r.inspected.push(id);
    if (state.active === 'atom' && at.el.sym === 'H') r.checks[0] = true;
    if (state.active === 'elements') {
      if (at.el.sym === 'H') r.checks[0] = true;
      if (at.el.sym === 'O') r.checks[1] = true;
    }
    if (state.active === 'electrons' && at.el.sym === 'O') r.checks[0] = true;
    save();
  }
  function evaluate() {
    const l = current(), r = run();
    if (!l || !r) return [];
    const gs = graphs();
    if (l.id === 'bond') r.checks[0] = gs.some(g => g.valid && formula(g, { H:2 }) && g.bs.length === 1 && g.bs[0].order === 1);
    if (l.id === 'water') r.checks[0] = gs.some(g => g.valid && formula(g, { H:2, O:1 }) && g.bs.length === 2);
    if (l.id === 'formula') r.checks[0] = gs.some(g => g.valid && formula(g, { C:1, O:2 }) && g.bs.length === 2 && g.bs.every(b=>b.order===2));
    if (l.id === 'geometry') {
      r.checks[0] = gs.some(tetrahedral);
      const q = api().camera.quaternion.toArray();
      if (r.camera && 1-Math.abs(q.reduce((s,x,i)=>s+x*r.camera[i],0)) > 0.002) r.checks[1] = true;
    }
    if (l.id === 'isomers') for (const g of gs) {
      if (!g.valid || !formula(g, { C:2, H:6, O:1 }) || !g.bs.every(b=>b.order===1)) continue;
      const o = g.ats.find(at=>at.el.sym==='O');
      const neigh = g.bs.filter(b=>b.a===o.id || b.b===o.id).map(b=>api().atoms.get(b.a===o.id?b.b:b.a).el.sym).sort().join('');
      if (neigh === 'CH') r.checks[0] = true;
      if (neigh === 'CC') r.checks[1] = true;
    }
    if (l.id === 'independent') {
      r.checks[0] = r.predicted && r.prediction.trim().length >= 8;
      r.checks[1] = r.checks[0] && gs.some(g=>g.valid && g.ats.length>=3 && !r.baseline.includes(g.signature) && g.ats.some(at=>r.inspected.includes(at.id)));
      r.checks[2] = r.observation.trim().length >= 8;
    }
    save();
    return r.checks.slice();
  }
  function start(id) {
    if (!lessons.some(l=>l.id===id)) return;
    window.__tutorial?.pause?.();
    state.active = id;
    const l = current();
    if (!state.runs[id] || state.done[id]) state.runs[id] = {
      checks: l.checks.map(()=>false), quiz:false, inspected:[], baseline:graphs().map(g=>g.signature),
      camera:api().camera.quaternion.toArray(), prediction:'', observation:'', predicted:false
    };
    hintVisible = false; notice = ''; activeView = 'lesson'; state.welcomed = true;
    save(); open('lesson');
  }
  function mode(value) {
    if (!['guided','standard','expert'].includes(value)) return;
    state.mode = value; state.welcomed = true; save();
    if (value === 'expert') { window.__tutorial?.pause?.(); close(); }
    else render();
    updateMini();
  }
  function tell(message, tone = 'info') {
    notice = message; noticeTone = tone;
    const n = panel?.querySelector('#learn-notice');
    if (n) { n.textContent = notice; n.dataset.tone = tone; n.hidden = false; }
  }
  function complete() {
    evaluate();
    const r = run();
    if (!r || !r.quiz || !r.checks.every(Boolean)) return tell(L('Not complete yet. Finish each scene task and answer the question; use Hint for a correction.', 'Chưa hoàn tất. Hãy làm đủ thao tác trong cảnh và trả lời câu hỏi; dùng Gợi ý để sửa.'), 'warn');
    state.done[state.active] = Date.now(); save(); render();
    tell(L('Lesson completed. Your real scene remains untouched. Choose the next experiment or keep exploring.', 'Đã hoàn thành bài. Cảnh thật được giữ nguyên. Chọn bài tiếp theo hoặc tiếp tục khám phá.'), 'ok');
    updateMini();
  }
  function button(id, label, extra = '') { return '<button type="button" data-learn="'+id+'" '+extra+'>'+esc(label)+'</button>'; }
  function shellDiagram(at) {
    const shells = api().electronShells(at.el.z);
    const rings = shells.map((n,i)=>{
      const r=15+(i+1)*12;
      let s='<circle cx="110" cy="110" r="'+r+'" fill="none" stroke="currentColor" opacity=".35"/>';
      for(let j=0;j<n;j++){const a=2*Math.PI*j/n;s+='<circle cx="'+(110+r*Math.cos(a))+'" cy="'+(110+r*Math.sin(a))+'" r="2.5" fill="currentColor"/>';}
      return s;
    }).join('');
    return '<figure class="learn-diagram"><svg viewBox="0 0 220 220" role="img" aria-label="'+esc(at.el.sym+': '+shells.join(', '))+'">'+rings+'<text x="110" y="114" text-anchor="middle" fill="currentColor">'+esc(at.el.sym)+'</text></svg><figcaption>'+esc(L('Neutral-atom shell reference (not to scale): ', 'Sơ đồ lớp nguyên tử trung hòa (không theo tỷ lệ): ')+shells.join(', '))+'</figcaption></figure>';
  }
  function atomTools() {
    const a = api();
    const options = [...a.atoms.values()].map(at=>'<option value="'+at.id+'">'+esc(at.el.sym+' #'+at.id)+'</option>').join('');
    const bonds = [...a.bonds.values()].map(b=>'<option value="'+b.id+'">'+esc(a.atoms.get(b.a)?.el.sym+' #'+b.a+' — '+a.atoms.get(b.b)?.el.sym+' #'+b.b+' ('+b.order+')')+'</option>').join('');
    return '<details class="learn-tools" open><summary>'+L('Real scene tools','Công cụ cảnh thật')+'</summary><p>'+L('These controls act on your actual atoms; normal costs and chemistry rules still apply.','Các nút tác động lên nguyên tử thật của bạn; chi phí và quy tắc hóa học vẫn áp dụng.')+'</p>'+button('refresh',L('Refresh atom list','Làm mới danh sách'))+
      '<div class="learn-row"><label>'+L('Atom','Nguyên tử')+'<select id="learn-atom">'+options+'</select></label>'+button('inspect',L('Inspect','Xem'), options?'':'disabled')+'</div>'+
      (['atom','elements','electrons'].includes(state.active)?'':'<details><summary>'+L('Accessible bond controls','Điều khiển liên kết dễ thao tác')+'</summary><div class="learn-row"><label>A<select id="learn-a">'+options+'</select></label><label>B<select id="learn-b">'+options+'</select></label>'+button('bond',L('Bond','Liên kết'),options?'':'disabled')+'</div><label>'+L('Existing bond','Liên kết có sẵn')+'<select id="learn-bond">'+bonds+'</select></label><div class="learn-row"><label>'+L('Order','Bậc')+'<select id="learn-order"><option>1</option><option>2</option><option>3</option></select></label>'+button('order',L('Set order','Đặt bậc'),bonds?'':'disabled')+'</div></details>')+'</details>';
  }
  function renderLesson() {
    const l = current(), r = run();
    if (!l || !r) return renderOverview();
    body.innerHTML = '<h3>'+esc((lessons.indexOf(l)+1)+'. '+text(l.title))+'</h3><p class="learn-objective">'+esc(text(l.objective))+'</p><p>'+esc(text(l.steps))+'</p>'+button('check',L('Check scene','Kiểm tra cảnh'))+' '+button('hint',L('Hint','Gợi ý'))+' '+button('minimize',L('Make room to build','Thu gọn để xây dựng'))+
      '<p id="learn-hint" '+(hintVisible?'':'hidden')+'>'+esc(text(l.hint))+'</p><ul id="learn-checks">'+l.checks.map((c,i)=>'<li data-done="'+!!r.checks[i]+'">'+(r.checks[i]?'✓ ':'○ ')+esc(text(c))+'</li>').join('')+'</ul>'+
      '<details '+(state.mode==='guided'?'open':'')+'><summary>'+L('Why this works','Vì sao như vậy')+'</summary><p>'+esc(text(l.explanation))+'</p></details>'+atomTools()+
      (inspectedId && api().atoms.has(inspectedId) ? '<section><h4>'+esc(api().atoms.get(inspectedId).el.sym+' #'+inspectedId+' · Z = '+api().atoms.get(inspectedId).el.z)+'</h4>'+shellDiagram(api().atoms.get(inspectedId))+'</section>' : '')+
      (l.id==='reaction'?'<div class="learn-row">'+button('select-water',L('Select water','Chọn nước'))+button('electrolysis',L('Run electrolysis','Chạy điện phân'))+'</div>':'')+
      (l.id==='independent'?'<label>'+L('Prediction (before building)','Dự đoán (trước khi tạo)')+'<textarea id="learn-prediction" maxlength="1000">'+esc(r.prediction)+'</textarea></label>'+button('prediction',L('Record prediction','Ghi dự đoán'))+'<label>'+L('Observation (what actually happened)','Quan sát (điều đã xảy ra)')+'<textarea id="learn-observation" maxlength="1000">'+esc(r.observation)+'</textarea></label>':'')+
      '<fieldset><legend>'+esc(text(l.question))+'</legend>'+l.answers.map((v,i)=>button('answer',text(v),'data-answer="'+i+'"')).join('')+'<p id="learn-quiz">'+(r.quiz?L('Correct — recorded.','Đúng — đã ghi nhận.'):'')+'</p></fieldset>'+button('complete',L('Complete experiment','Hoàn tất bài'))+' '+button('next',L('Recommended next','Bài tiếp theo'));
  }
  function renderOverview() {
    const count = Object.keys(state.done).length;
    body.innerHTML = '<h3>'+L('From your first atom to independent discovery','Từ nguyên tử đầu tiên đến tự khám phá')+'</h3><p>'+L('No chemistry knowledge needed. Start with one task at a time. Nothing here disables advanced tools or changes the simulation.','Không cần biết hóa học trước. Mỗi lần làm một việc. Không công cụ nâng cao nào bị khóa và mô phỏng không bị thay đổi.')+'</p><progress max="10" value="'+count+'"></progress><p>'+count+'/10 '+L('experiments completed','bài đã hoàn thành')+'</p>'+button('next',L('Start / continue learning','Bắt đầu / tiếp tục học'))+'<ol class="learn-lessons">'+lessons.map(l=>'<li>'+button('start',text(l.title),'data-id="'+l.id+'"')+'<span>'+esc(state.done[l.id]?L('Completed · revisit','Đã xong · học lại'):L('Available','Có thể học'))+'</span></li>').join('')+'</ol><details><summary>'+L('Interface tour and advanced resources','Tham quan giao diện và tài liệu nâng cao')+'</summary><p>'+L('The original comprehensive tour and science guide remain available. Progress is saved separately from your molecules.','Hướng dẫn đầy đủ và cẩm nang khoa học gốc vẫn có sẵn. Tiến độ học được lưu riêng với phân tử.')+'</p>'+button('tour',L('Resume interface tour','Tiếp tục hướng dẫn giao diện'))+' '+button('replay-tour',L('Replay interface tour','Xem lại hướng dẫn giao diện'))+' '+button('science',L('Science guide','Cẩm nang khoa học'))+'</details>';
  }
  function normalize(s) { return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d'); }
  function glossaryResults(query = '') {
    const q=normalize(query);
    const matches=content.glossary.filter(g=>normalize(text(g[1])+' '+text(g[2])+' '+g[3]).includes(q));
    const host=body.querySelector('#learn-results');
    if (!host) return;
    host.innerHTML=matches.map(g=>'<details data-concept="'+g[0]+'"><summary>'+esc(text(g[1]))+'</summary><p>'+esc(text(g[2]))+'</p><pre>'+esc(g[3])+'</pre>'+button('guide-topic',L('Explore in science guide','Đọc sâu trong cẩm nang'),'data-topic="'+g[4]+'"')+'</details>').join('') || '<p>'+L('No matching concept. Try an element, bond, energy, or reaction.','Không thấy khái niệm phù hợp. Thử nguyên tố, liên kết, năng lượng hoặc phản ứng.')+'</p>';
  }
  function render() {
    if (!panel || panel.hidden) return;
    panel.querySelector('#learn-title').textContent=L('Learning lab','Góc học tập');
    panel.querySelector('#learn-mode-label').textContent=L('Guidance mode','Chế độ hướng dẫn');
    panel.querySelector('#learn-mode').value=state.mode;
    const labels = [L('Guided','Có hướng dẫn'), L('Standard','Tiêu chuẩn'), L('Expert','Chuyên gia')];
    [...panel.querySelector('#learn-mode').options].forEach((o,i)=>{o.textContent=labels[i];});
    panel.querySelector('[data-learn="overview"]').textContent=L('Progress','Tiến độ');
    panel.querySelector('[data-learn="glossary"]').textContent=L('Glossary','Từ điển');
    panel.querySelector('[data-learn="minimize"]').textContent=L('Minimize','Thu gọn');
    panel.querySelector('[data-learn="pool"]').textContent=L('Element pool','Kho nguyên tố');
    panel.querySelector('[data-learn="supplies"]').textContent=L('Supplies','Vật tư');
    if(activeView==='glossary') {
      body.innerHTML='<label>'+L('Search chemistry concepts','Tìm khái niệm hóa học')+'<input type="search" id="learn-search" autocomplete="off"></label><div id="learn-results"></div>';
      glossaryResults();
    } else if(activeView==='lesson') renderLesson(); else renderOverview();
    const n=document.createElement('p');n.id='learn-notice';n.setAttribute('role','status');n.hidden=!notice;n.textContent=notice;n.dataset.tone=noticeTone;body.appendChild(n);
    if(storageFailed){const p=document.createElement('p');p.textContent=L('Browser storage unavailable: progress will not survive closing this page.','Không thể lưu trong trình duyệt: tiến độ sẽ mất khi đóng trang.');body.prepend(p);}
    updateMini();
  }
  function open(view='overview') {
    returnFocus=document.activeElement;
    window.__tutorial?.pause?.();
    state.welcomed=true;save();activeView=view;miniTarget=null;panel.hidden=false;mini.hidden=true;render();panel.querySelector('#learn-title').focus();
  }
  function close() { panel.hidden=true; if(returnFocus?.isConnected) returnFocus.focus(); updateMini(); }
  function updateMini() {
    if (!mini) return;
    mini.textContent=miniTarget ? (miniTarget.error ? L('Why did that fail?','Vì sao thao tác thất bại?') : L('Concept help available','Có giải thích khái niệm')) : state.active?L('Resume lesson','Tiếp tục bài')+' '+(lessons.findIndex(l=>l.id===state.active)+1):L('Learn','Học');
    mini.hidden=!panel.hidden || state.mode==='expert' || (!state.active && !miniTarget);
    entry.textContent=L('Learning lab','Góc học tập');
  }
  function locatePool() {
    close();
    const search=document.getElementById('pool-search');
    const collapse=document.getElementById('ub-pool-toggle');
    if (collapse?.getAttribute('aria-expanded') === 'false') collapse.click();
    if(search?.getClientRects().length){search.focus();search.classList.add('learn-highlight');setTimeout(()=>search.classList.remove('learn-highlight'),2500);}
    api().status(L('Element pool: drag an element chip into empty 3D space. Use the pool arrow if it is collapsed.','Kho nguyên tố: kéo thẻ nguyên tố vào chỗ trống 3D. Dùng mũi tên kho nếu đang thu gọn.'),'info');
  }
  function explain(reason, original, operation) {
    if (original && /^(Operation failed:|Thao tác thất bại:)/.test(original)) return original;
    const key=typeof reason==='object'?reason?.key:reason;
    const prefix=L('Operation failed: ','Thao tác thất bại: ')+(operation||L('requested change','thay đổi yêu cầu'))+'. ';
    const corrections={
      'chem.selfBond':L('Connectivity restriction: a bond needs two different atoms. Choose another atom.','Giới hạn kết nối: liên kết cần hai nguyên tử khác nhau. Chọn nguyên tử khác.'),
      'chem.alreadyBonded':L('These atoms are already connected. Select the existing bond to change its order instead of adding a duplicate.','Hai nguyên tử đã nối nhau. Chọn liên kết có sẵn để đổi bậc thay vì thêm liên kết trùng.'),
      'chem.nobleNoCompound':L('Model limitation: this simulator does not support that noble-gas compound. Some noble gases do form compounds in real chemistry. Try a supported structure or consult the science guide.','Giới hạn mô hình: mô phỏng không hỗ trợ hợp chất khí hiếm này. Một số khí hiếm có tạo hợp chất thật. Thử cấu trúc được hỗ trợ hoặc đọc cẩm nang.'),
      'chem.nobleOnlyFO':L('Model limitation: the current noble-gas rules support only certain F/O bonds, not every real noble-gas compound. Use a supported partner.','Giới hạn mô hình: quy tắc khí hiếm hiện chỉ hỗ trợ một số liên kết F/O, không phải mọi hợp chất thật. Dùng đối tác được hỗ trợ.'),
      'chem.ionicNeedMetal':L('Model limitation: this ionic-bond representation expects a metal partner. Real ions also include nonmetal molecular ions. Use a supported metal/nonmetal pair here.','Giới hạn mô hình: kiểu liên kết ion này yêu cầu đối tác kim loại. Ion thật còn gồm ion phân tử phi kim. Hãy dùng cặp kim loại/phi kim được hỗ trợ.'),
      'chem.octet':L('Lewis-model restriction: the proposed order exceeds the allowed electron count at this atom. Lower the bond order or remove a competing bond. The octet rule is not universal.','Giới hạn mô hình Lewis: bậc đề nghị vượt số electron cho phép ở nguyên tử. Giảm bậc hoặc bỏ liên kết cạnh tranh. Quy tắc bát tử không phổ quát.')
    };
    let why=corrections[key];
    if(!why && typeof key==='string' && key.startsWith('chem.')) why=L('The current bonding/Lewis model rejected this change. Inspect existing bond orders and formal charge; try a lower order or a different partner. This is not proof that every related real compound is impossible.','Mô hình liên kết/Lewis hiện tại từ chối thay đổi. Xem bậc liên kết và điện tích hình thức; thử bậc thấp hơn hoặc đối tác khác. Điều này không chứng minh mọi hợp chất thật liên quan đều bất khả thi.');
    if(!why) why=L('The cause is not established from this message. Check the selection, available stock and active conditions. If it persists, preserve your progress and report the original message; do not infer a chemistry law from an unknown error.','Chưa xác định nguyên nhân từ thông báo này. Kiểm tra lựa chọn, vật tư và điều kiện. Nếu vẫn lỗi, giữ tiến độ và báo thông báo gốc; không suy ra quy luật hóa học từ lỗi chưa rõ.');
    return prefix+(original?original+' ':'')+why;
  }
  function handle(e) {
    const b=e.target.closest('[data-learn]');if(!b)return;
    const act=b.dataset.learn;
    if(act==='start')return start(b.dataset.id);
    if(act==='overview'||act==='glossary'){activeView=act;notice='';return render();}
    if(act==='minimize')return close();
    if(act==='pool')return locatePool();
    if(act==='supplies'){close();return window.__mol3dShop?.showTab('elements');}
    if(act==='blueprint'){close();return window.__blueprint?.open();}
    if(act==='science'){close();return window.ScienceGuide?.open();}
    if(act==='guide-topic'){close();window.ScienceGuide?.open();return window.ScienceGuide?.show(b.dataset.topic);}
    if(act==='tour'||act==='replay-tour'){close();return act==='tour'?window.__tutorial?.start():window.__tutorial?.replay();}
    if(act==='next'){const next=lessons.find(l=>!state.done[l.id]);return next?start(next.id):tell(L('All ten complete. Revisit any experiment or explore freely.','Đã xong cả mười bài. Học lại bài bất kỳ hoặc tự khám phá.'),'ok');}
    if(act==='hint'){hintVisible=true;return render();}
    if(act==='refresh')return render();
    if(act==='check'){evaluate();render();return tell(L('Updated from the actual scene. Hollow circles show tasks still needed.','Đã cập nhật từ cảnh thật. Vòng tròn rỗng chỉ việc còn cần làm.'));}
    if(act==='inspect')return inspect(Number(body.querySelector('#learn-atom').value));
    if(act==='complete')return complete();
    if(act==='prediction'){
      const r=run();if(r.prediction.trim().length<8)return tell(L('Write a short prediction first (at least 8 characters).','Hãy viết dự đoán ngắn trước (ít nhất 8 ký tự).'),'warn');
      r.predicted=true;r.baseline=graphs().map(g=>g.signature);r.inspected=[];save();return tell(L('Prediction recorded. Now build something new, inspect it and record your observation.','Đã ghi dự đoán. Giờ hãy tạo phân tử mới, xem và ghi quan sát.'));
    }
    if(act==='answer'){
      const l=current();const correct=Number(b.dataset.answer)===l.correct;run().quiz=correct;save();
      body.querySelector('#learn-quiz').textContent=correct?L('Correct — recorded.','Đúng — đã ghi nhận.'):L('Not quite. ','Chưa đúng. ')+text(l.explanation);return;
    }
    if(act==='bond'){
      const a=api(),x=Number(body.querySelector('#learn-a').value),y=Number(body.querySelector('#learn-b').value);
      if(!a.atoms.has(x)||!a.atoms.has(y))return tell(L('Selection changed. Refresh the atom list.','Lựa chọn đã đổi. Làm mới danh sách.'),'warn');
      const check=a.chem.bondCheck(a.atoms,a.bonds,x,y);
      if(!check.ok)return tell(explain(check.reason,a.i18n.t(check.reason.key,check.reason.p),L('bond atoms','nối nguyên tử')),'warn');
      a.devBond(x,y);evaluate();return render();
    }
    if(act==='order'){
      const a=api(),id=Number(body.querySelector('#learn-bond').value),n=Number(body.querySelector('#learn-order').value);
      if(!a.bonds.has(id))return tell(L('Bond no longer exists; refresh the list.','Liên kết không còn; làm mới danh sách.'),'warn');
      a.devOrder(id,n);evaluate();return render();
    }
    if(act==='select-water'){
      api().reaction.clear();const found=api().reaction.selectByFormula('H2O');const second=api().reaction.selectByFormula('H2O');
      return tell(found&&second?L('Two water molecules selected. Electrolysis will consume them.','Đã chọn hai phân tử nước. Điện phân sẽ tiêu thụ chúng.'):L('Build two separate H₂O molecules first; existing water is not copied.','Hãy tạo hai H₂O riêng trước; nước có sẵn không được sao chép.'),found&&second?'info':'warn');
    }
    if(act==='electrolysis'){
      const result=api().reaction.pick('electricity');
      if(result==='none'||result.startsWith('wrong-condition'))tell(L('No supported electrolysis matched this selection. Select two separate water molecules, then retry. This is a reaction-library limit, not proof of chemical impossibility.','Không tìm thấy điện phân được hỗ trợ cho lựa chọn này. Chọn hai phân tử nước riêng rồi thử lại. Đây là giới hạn thư viện, không chứng minh phản ứng bất khả thi.'),'warn');
      else{evaluate();render();}
    }
  }
  function mount() {
    if(!api()||!document.querySelector('.top-bar-left'))return setTimeout(mount,250);
    const style=document.createElement('style');style.textContent=`
      #learning-panel{position:fixed;z-index:180;left:max(8px,env(safe-area-inset-left));top:calc(var(--top-h,44px) + 8px);width:min(380px,calc(100vw - 24px));max-height:calc(var(--free-h,80dvh) - 20px);display:flex;flex-direction:column;background:var(--panel,#0b1526);color:var(--text,#def);border:1px solid var(--border,#345);border-radius:14px;box-shadow:0 12px 45px #0007;font-size:13px;overflow:hidden}
      #learning-panel[hidden],#learn-mini[hidden]{display:none!important}#learning-panel header{padding:10px;flex:none;border-bottom:1px solid var(--border)}#learn-title{font-size:15px;margin:0 0 8px;color:var(--accent)}#learning-panel nav,.learn-row{display:flex;flex-wrap:wrap;gap:5px;align-items:end}#learning-panel button,#learning-panel input,#learning-panel select,#learning-panel textarea,#learn-mini{font:inherit;border:1px solid var(--border);border-radius:7px;color:var(--text);background:var(--panel-2,#15263a);padding:7px;max-width:100%;box-sizing:border-box}#learning-panel button{cursor:pointer;min-height:32px}#learning-panel button:hover{border-color:var(--accent)}#learning-panel button:disabled{opacity:.5;cursor:default}#learning-panel :focus-visible,#learn-mini:focus-visible{outline:2px solid var(--accent);outline-offset:2px}#learn-body{overflow:auto;min-height:0;padding:12px;line-height:1.55;overscroll-behavior:contain}#learn-body h3{margin-top:0}#learn-body details{padding:8px 0;border-bottom:1px solid var(--border)}#learn-body summary{cursor:pointer;font-weight:700}#learn-body label{display:block;min-width:0;flex:1}#learn-body select,#learn-body textarea,#learn-search{display:block;width:100%}#learn-body textarea{min-height:70px}#learn-body fieldset{margin:12px 0;padding:8px;border:1px solid var(--border);border-radius:8px}#learn-body fieldset button{display:block;margin:4px 0;width:100%;text-align:left}.learn-lessons{padding-left:25px}.learn-lessons li{margin:8px 0}.learn-lessons span{display:block;font-size:11px;color:var(--muted)}#learn-body progress{width:100%;accent-color:var(--accent)}#learn-checks{padding-left:0;list-style:none}#learn-checks [data-done=true]{color:var(--ok-text,#7ee2a8)}#learn-notice{padding:8px;border-left:3px solid var(--accent);white-space:pre-wrap}#learn-notice[data-tone=warn]{border-color:var(--warn);color:var(--warn)}#learn-notice[data-tone=ok]{color:var(--ok-text)}.learn-diagram{margin:8px 0}.learn-diagram svg{height:150px;width:100%;color:var(--accent)}.learn-diagram figcaption{font-size:11px;color:var(--muted)}#learn-body pre{white-space:pre-wrap;font-size:12px}#learn-mini{position:fixed;z-index:179;top:calc(var(--top-h,44px) + 6px);left:8px;background:var(--panel);cursor:pointer}.learn-highlight{outline:3px solid var(--accent)!important}#btn-learning{font-size:11px} @media(max-width:820px){#learning-panel{max-height:min(54dvh,calc(var(--free-h,70dvh) - 12px));font-size:12px}#learning-panel header{padding:7px}#learn-body{padding:9px}#learn-title{font-size:13px}}`;
    document.head.appendChild(style);
    panel=document.createElement('section');panel.id='learning-panel';panel.hidden=true;panel.setAttribute('aria-labelledby','learn-title');
    panel.innerHTML='<header><h2 id="learn-title" tabindex="-1"></h2><label for="learn-mode" id="learn-mode-label"></label> <select id="learn-mode"><option value="guided">Guided</option><option value="standard">Standard</option><option value="expert">Expert</option></select><nav>'+button('overview','Progress')+button('glossary','Glossary')+button('minimize','Minimize')+'</nav></header><div id="learn-body"></div><nav style="padding:7px">'+button('pool',L('Element pool','Kho nguyên tố'))+button('supplies',L('Supplies','Vật tư'))+button('blueprint','BluePrint')+'</nav>';
    body=panel.querySelector('#learn-body');document.body.appendChild(panel);
    entry=document.createElement('button');entry.type='button';entry.id='btn-learning';entry.className='btn';entry.addEventListener('click',()=>open());document.querySelector('.top-bar-left').appendChild(entry);
    mini=document.createElement('button');mini.type='button';mini.id='learn-mini';mini.hidden=true;mini.addEventListener('click',()=>{const target=miniTarget;open(target?'glossary':'lesson');if(target?.concept){const d=body.querySelector('[data-concept="'+target.concept+'"]');if(d){d.open=true;d.scrollIntoView({block:'nearest'});}}if(target?.error)body.querySelector('#learn-notice')?.scrollIntoView({block:'nearest'});});document.body.appendChild(mini);
    panel.addEventListener('click',handle);
    panel.querySelector('#learn-mode').addEventListener('change',e=>mode(e.target.value));
    panel.addEventListener('input',e=>{
      if(e.target.id==='learn-search')glossaryResults(e.target.value);
      if(e.target.id==='learn-prediction'&&run()){run().prediction=e.target.value;run().predicted=false;save();}
      if(e.target.id==='learn-observation'&&run()){run().observation=e.target.value;save();}
    });
    panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();close();}});
    window.addEventListener('mol3d:atom-selected',e=>{recordInspection(e.detail.id);});
    window.addEventListener('mol3d:reaction-completed',e=>{
      if(state.active!=='reaction'||!run()||(state.mode==='expert'&&panel.hidden))return;
      const gs=graphs();const products=gs.filter(g=>g.ats.some(at=>e.detail.productIds.includes(at.id)));
      if(e.detail.condition==='electricity' && e.detail.reactants.every(f=>f==='H2O') && products.filter(g=>g.valid&&formula(g,{H:2})).length>=2 && products.some(g=>g.valid&&formula(g,{O:2}))) {
        run().checks[0]=true;save();if(!panel.hidden)render();
      }
    });
    const statusNode=document.getElementById('status-text');
    if(statusNode)new MutationObserver(()=>{
      if(state.mode==='expert'||!statusNode.textContent||!statusNode.classList.contains('err'))return;
      tell(explain(null,statusNode.textContent), 'warn');
      if(panel.hidden){miniTarget={error:true};updateMini();}
    }).observe(statusNode,{childList:true,characterData:true,subtree:true});
    function labelTips() {
    const tips={ 'btn-undo':L('Undo the last editable scene action','Hoàn tác thao tác cảnh vừa chỉnh'), 'btn-blueprint':L('Draw atoms and bonds in 2D, then send to the real 3D scene','Vẽ nguyên tử và liên kết 2D rồi đưa vào cảnh 3D thật'), 'btn-atmosphere':L('Choose surroundings; gases can participate in reactions','Chọn môi trường; khí có thể tham gia phản ứng'), 'btn-fc':L('Formal charge: electron bookkeeping, not a measured partial charge','Điện tích hình thức: cách phân chia electron, không phải điện tích riêng phần đo được') };
    Object.entries(tips).forEach(([id,t])=>{const el=document.getElementById(id);if(el){el.title=t;el.setAttribute('aria-label',t);}});
    }
    labelTips();
    document.addEventListener('click',e=>{
      if(state.mode==='expert'||!panel.hidden||Date.now()-lastOffer<90000||window.__tutorial?.isActive())return;
      const el=e.target.closest('button');const map={'btn-fc':'charge','btn-atmosphere':'reaction','btn-blueprint':'bond','btn-isomer':'isomer'};const key=map[el?.id];
      if(!key||state.seen[key])return;state.seen[key]=true;lastOffer=Date.now();save();
      const term=content.glossary.find(g=>g[0]===key);notice=text(term[2]);
      if(state.mode==='guided'){open('glossary');const d=body.querySelector('[data-concept="'+key+'"]');if(d){d.open=true;d.scrollIntoView({block:'nearest'});}}
      else{miniTarget={concept:key};updateMini();}
    });
    window.addEventListener('mol3d:lang',()=>{render();updateMini();labelTips();});
    updateMini();
    let legacy=false;try{legacy=!!localStorage.getItem('mol3d.tutorial.completed.v6');}catch(_){}
    if(!state.welcomed&&!legacy)setTimeout(()=>{if(!state.welcomed&&state.mode!=='expert')open();},1800);
  }
  window.__mol3dLearning={
    open,close,start,mode: value=>value===undefined?state.mode:mode(value),check:evaluate,explain,
    exportState:()=>JSON.parse(JSON.stringify({...state,tutorial:window.__tutorial?.progress()})),
    importState:raw=>{if(!raw||raw.v!==1)return false;state=sanitize(raw);if(raw.tutorial)window.__tutorial?.importProgress(raw.tutorial);save();render();updateMini();return true;},
    lessons:lessons.map(l=>({id:l.id,title:l.title})),graphs
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
