// Tutorial System - Cell to Singularity Style - Standalone module
(function() {
  'use strict';

  var TUTORIAL_KEY = 'mol3d.tutorial.completed.v2';
  var USER_NAME_KEY = 'mol3d.user.name';

  var tutorialActive = false;
  var phase = 0;
  var step = 0;
  var userName = localStorage.getItem(USER_NAME_KEY) || 'Scientist';
  var assistantName = 'ARIA';

  var waitInterval = null;
  var resizeHandler = null;

  var PHASES = [
    {
      id: 'setup', name: 'Assistant Setup',
      steps: [
        { text: "Hello! I'm {assistant}, your chemistry AI assistant.", action: 'show' },
        { text: 'What should I call you?', action: 'nameInput' },
        { text: 'Nice to meet you, {user}! Let me show you around the lab.', action: 'next' },
      ]
    },
    {
      id: 'basics', name: 'Foundations',
      steps: [
        { target: '#left-sidebar', text: 'This is your element pool, {user}. All 118 elements are here.', action: 'highlight' },
        { target: '#pool-list', text: 'Click any element to place it in the scene. Try Hydrogen (H)!', action: 'waitForSpawn', threshold: 1 },
        { text: 'Great! Atoms are the building blocks of all matter.', action: 'next' },
        { text: "Drag atoms to move them. They'll bond when close enough.", action: 'next' },
      ]
    },
    {
      id: 'bonding', name: 'Bonding & Reactions',
      steps: [
        { text: "Now let's learn about bonds! Spawn another H atom.", action: 'waitForSpawn', threshold: 2 },
        { text: 'Two H atoms will automatically form H2 - molecular hydrogen!', action: 'next' },
        { text: 'Double-click molecules to see reactions. Try combining different elements!', action: 'next' },
        { target: '#btn-fc', text: 'This shows formal charges on atoms. Useful for understanding reactivity.', action: 'highlight' },
      ]
    },
    {
      id: 'advanced', name: 'Advanced Features',
      steps: [
        { target: '#btn-xray', text: 'X-Ray mode lets you see through atoms. Press X or click here.', action: 'highlight' },
        { target: '#btn-proton', text: 'The Proton Gun adds protons to atoms, transmuting elements!', action: 'highlight' },
        { target: '#btn-quest', text: 'Quest mode gives you challenges to complete for rewards.', action: 'highlight' },
        { text: "You're all set, {user}! Explore and experiment. The lab is yours.", action: 'complete' },
      ]
    }
  ];

  var backdrop, dialog, highlight;

  function showStatus(msg) {
    var el = document.getElementById('status-text');
    if (el) { el.textContent = msg; el.className = 'info'; }
  }

  function fmt(text) {
    return text.replace(/\{assistant\}/g, assistantName).replace(/\{user\}/g, userName);
  }

  function clearWait() {
    if (waitInterval) { clearInterval(waitInterval); waitInterval = null; }
  }

  function removeResize() {
    if (resizeHandler) { window.removeEventListener('resize', resizeHandler); resizeHandler = null; }
  }

  function shouldShow() { return !localStorage.getItem(TUTORIAL_KEY); }

  function createUI() {
    backdrop = document.createElement('div');
    backdrop.className = 'tut-backdrop';
    document.body.appendChild(backdrop);

    dialog = document.createElement('div');
    dialog.className = 'tut-dialog';
    document.body.appendChild(dialog);

    highlight = document.createElement('div');
    highlight.className = 'tut-highlight';
    document.body.appendChild(highlight);

    requestAnimationFrame(function() { backdrop.classList.add('visible'); });
  }

  function destroyUI() {
    removeResize();
    clearWait();
    if (backdrop) { backdrop.classList.remove('visible'); setTimeout(function() { if (backdrop.parentNode) backdrop.remove(); }, 300); }
    if (dialog && dialog.parentNode) dialog.remove();
    if (highlight && highlight.parentNode) highlight.remove();
    backdrop = dialog = highlight = null;
  }

  function highlightEl(selector) {
    var el = document.querySelector(selector);
    if (!el) { hideHighlight(); return; }

    var rect = el.getBoundingClientRect();
    var pad = 6;
    highlight.style.left = (rect.left - pad) + 'px';
    highlight.style.top = (rect.top - pad) + 'px';
    highlight.style.width = (rect.width + pad * 2) + 'px';
    highlight.style.height = (rect.height + pad * 2) + 'px';
    highlight.style.display = 'block';

    el.classList.add('tut-pulse-target');

    if (!resizeHandler) {
      resizeHandler = function() {
        if (!tutorialActive) return;
        var cur = PHASES[phase] && PHASES[phase].steps[step];
        if (cur && cur.action === 'highlight' && cur.target) highlightEl(cur.target);
      };
      window.addEventListener('resize', resizeHandler);
    }
  }

  function hideHighlight() {
    if (highlight) highlight.style.display = 'none';
    document.querySelectorAll('.tut-pulse-target').forEach(function(el) { el.classList.remove('tut-pulse-target'); });
  }

  function renderStep() {
    if (phase >= PHASES.length) { complete(); return; }
    var p = PHASES[phase];
    var s = p.steps[step];
    if (!s) { nextPhase(); return; }

    var text = fmt(s.text);
    var isWaiting = s.action === 'waitForSpawn';
    var isComplete = s.action === 'complete';
    var isNameInput = s.action === 'nameInput';

    var btnLabel = isComplete ? 'Finish' : isWaiting ? 'Waiting...' : 'Next';
    var btnDisabled = isWaiting ? 'disabled' : '';
    var btnClass = isWaiting ? 'tut-btn tut-btn-wait' : 'tut-btn';

    var actionsHTML = '';
    if (isNameInput) {
      actionsHTML = '<input type="text" class="tut-name-input" id="tut-name-input" placeholder="Enter your name" value="' + userName + '" />' +
        '<button class="tut-btn" id="tut-continue-btn">Continue</button>';
    } else {
      actionsHTML = '<button class="' + btnClass + '" id="tut-next-btn" ' + btnDisabled + '>' + btnLabel + '</button>';
    }

    dialog.innerHTML =
      '<div class="tut-header">' +
        '<div class="tut-avatar">🤖</div>' +
        '<div class="tut-header-text">' +
          '<div class="tut-assistant-name">' + assistantName + '</div>' +
          '<div class="tut-phase-label">Phase ' + (phase + 1) + ': ' + p.name + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="tut-body">' + text + '</div>' +
      '<div class="tut-actions">' + actionsHTML + '</div>';

    dialog.style.display = 'block';

    if (isNameInput) {
      var input = document.getElementById('tut-name-input');
      var contBtn = document.getElementById('tut-continue-btn');
      if (input) input.focus();
      if (contBtn) {
        contBtn.addEventListener('click', function() {
          if (input && input.value.trim()) {
            userName = input.value.trim();
            localStorage.setItem(USER_NAME_KEY, userName);
          }
          advance();
        });
      }
      if (input) {
        input.addEventListener('keydown', function(e) {
          if (e.key === 'Enter') contBtn.click();
        });
      }
    } else if (isWaiting) {
      waitForAction(s.action, s.threshold);
    } else {
      var nextBtn = document.getElementById('tut-next-btn');
      if (nextBtn) {
        nextBtn.addEventListener('click', function() {
          if (s.action === 'highlight' && s.target) {
            var target = document.querySelector(s.target);
            if (target) target.click();
          }
          advance();
        });
      }
    }

    if (s.action === 'highlight' && s.target) highlightEl(s.target);
    else hideHighlight();
  }

  function waitForAction(action, threshold) {
    clearWait();
    var needed = threshold || 1;
    waitInterval = setInterval(function() {
      if (window.__mol3d && window.__mol3d.atoms && window.__mol3d.atoms.size >= needed) {
        clearWait();
        enableNextBtn();
      }
    }, 300);
  }

  function enableNextBtn() {
    if (!dialog) return;
    var btn = dialog.querySelector('.tut-btn');
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('tut-btn-wait');
      btn.textContent = 'Next';
      btn.addEventListener('click', function() { advance(); });
    }
  }

  function advance() {
    step++;
    if (step >= PHASES[phase].steps.length) nextPhase();
    else renderStep();
  }

  function nextPhase() {
    phase++;
    step = 0;
    if (phase >= PHASES.length) complete();
    else renderStep();
  }

  function complete() {
    localStorage.setItem(TUTORIAL_KEY, 'true');
    tutorialActive = false;
    hideHighlight();
    destroyUI();
    showStatus('Tutorial complete! Welcome to the lab, ' + userName + '!');
  }

  function start() {
    if (tutorialActive) return;
    tutorialActive = true;
    phase = 0;
    step = 0;
    createUI();
    renderStep();
  }

  function replay() {
    localStorage.removeItem(TUTORIAL_KEY);
    destroyUI();
    start();
  }

  function injectStyles() {
    if (document.getElementById('tut-styles')) return;
    var s = document.createElement('style');
    s.id = 'tut-styles';
    s.textContent =
      '@keyframes tut-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(0,255,136,0.7); } 50% { box-shadow: 0 0 0 clamp(10px, 2vw, 14px) rgba(0,255,136,0); } }' +
      '.tut-pulse-target { animation: tut-pulse 1.5s infinite !important; }' +
      '.tut-backdrop { position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9998;pointer-events:none;opacity:0;transition:opacity 0.3s; }' +
      '.tut-backdrop.visible { opacity:1; }' +
      '.tut-dialog { position:fixed;bottom:clamp(60px,12vh,120px);left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);border:2px solid #0f3460;border-radius:clamp(10px,2vw,16px);padding:clamp(12px,3vw,20px);width:clamp(280px,85vw,500px);z-index:9999;box-shadow:0 8px 32px rgba(0,0,0,0.5);display:none;font-family:inherit; }' +
      '.tut-header { display:flex;align-items:center;gap:clamp(8px,2vw,12px);margin-bottom:clamp(8px,2vw,12px); }' +
      '.tut-avatar { width:clamp(36px,8vw,48px);height:clamp(36px,8vw,48px);background:linear-gradient(135deg,#00ff88,#00d4ff);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:clamp(18px,4vw,24px);flex-shrink:0; }' +
      '.tut-header-text { min-width:0; }' +
      '.tut-assistant-name { color:#00ff88;font-weight:bold;font-size:clamp(12px,2.5vw,14px); }' +
      '.tut-phase-label { color:#888;font-size:clamp(10px,2vw,11px); }' +
      '.tut-body { color:#fff;font-size:clamp(13px,2.8vw,15px);line-height:1.5;margin-bottom:clamp(10px,2vw,16px);word-wrap:break-word;overflow-wrap:break-word; }' +
      '.tut-actions { display:flex;gap:clamp(6px,1.5vw,8px);justify-content:flex-end;flex-wrap:wrap;align-items:center; }' +
      '.tut-btn { padding:clamp(6px,1.5vw,8px) clamp(12px,3vw,16px);background:#00ff88;border:none;border-radius:clamp(6px,1.5vw,8px);color:#000;font-weight:bold;cursor:pointer;font-size:clamp(12px,2.5vw,14px);white-space:nowrap;transition:opacity 0.2s; }' +
      '.tut-btn:hover { opacity:0.85; }' +
      '.tut-btn-wait { opacity:0.5;cursor:not-allowed; }' +
      '.tut-name-input { flex:1;min-width:0;padding:clamp(6px,1.5vw,8px) clamp(8px,2vw,12px);background:#0a0a1a;border:1px solid #0f3460;border-radius:clamp(6px,1.5vw,8px);color:#fff;font-size:clamp(12px,2.5vw,14px); }' +
      '.tut-highlight { position:fixed;border:3px solid #00ff88;border-radius:8px;box-shadow:0 0 20px #00ff88,inset 0 0 20px rgba(0,255,136,0.1);z-index:9997;pointer-events:none;display:none;transition:all 0.3s; }';
    document.head.appendChild(s);
  }

  function init() {
    injectStyles();

    var settingsBtn = document.getElementById('settings-tutorial');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', function() {
        replay();
        var modal = document.getElementById('settings-modal');
        if (modal) modal.hidden = true;
      });
    }

    window.__tutorial = {
      start: start,
      replay: replay,
      isActive: function() { return tutorialActive; },
      shouldShow: shouldShow
    };

    setTimeout(function() { if (shouldShow()) start(); }, 2000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
