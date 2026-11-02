// Tutorial System - Professional Typewriter Style
(function() {
  'use strict';

  var TUTORIAL_KEY = 'mol3d.tutorial.completed.v3';
  var USER_NAME_KEY = 'mol3d.user.name';

  var tutorialActive = false;
  var phase = 0;
  var step = 0;
  var userName = localStorage.getItem(USER_NAME_KEY) || 'Scientist';
  var assistantName = 'ARIA';

  var backdrop, dialog, spotlightRing, clickIndicator;
  var typeInterval = null;
  var waitInterval = null;
  var currentFullText = '';
  var currentCharIndex = 0;
  var resizeHandler = null;

  var PHASES = [
    {
      id: 'setup', name: 'Introduction',
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
        { text: 'Two H atoms will automatically form H\u2082 \u2014 molecular hydrogen!', action: 'next' },
        { text: 'Double-click molecules to see reactions. Try combining different elements!', action: 'next' },
        { target: '#btn-fc', text: 'This shows formal charges on atoms. Useful for understanding reactivity.', action: 'highlight' },
      ]
    },
    {
      id: 'advanced', name: 'Advanced Features',
      steps: [
        { target: '#btn-xray', text: 'X-Ray mode lets you see electron clouds. Press X or click here.', action: 'highlight' },
        { target: '#btn-proton', text: 'The Proton Gun adds protons to atoms, transmuting elements!', action: 'highlight' },
        { target: '#btn-quest', text: 'Quest mode gives you challenges to complete for rewards.', action: 'highlight' },
        { text: "You're all set, {user}! Explore and experiment. The lab is yours.", action: 'complete' },
      ]
    }
  ];

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

  function clearType() {
    if (typeInterval) { clearInterval(typeInterval); typeInterval = null; }
  }

  function shouldShow() { return !localStorage.getItem(TUTORIAL_KEY); }

  function createUI() {
    backdrop = document.createElement('div');
    backdrop.id = 'tut-backdrop';
    document.body.appendChild(backdrop);

    dialog = document.createElement('div');
    dialog.id = 'tut-dialog';
    document.body.appendChild(dialog);

    requestAnimationFrame(function() { backdrop.classList.add('visible'); });
  }

  function destroyUI() {
    clearType();
    clearWait();
    hideHighlight();
    if (backdrop) { backdrop.classList.remove('visible'); setTimeout(function() { if (backdrop && backdrop.parentNode) backdrop.remove(); }, 500); }
    if (dialog && dialog.parentNode) dialog.remove();
    if (spotlightRing && spotlightRing.parentNode) spotlightRing.remove();
    if (clickIndicator && clickIndicator.parentNode) clickIndicator.remove();
    backdrop = dialog = spotlightRing = clickIndicator = null;
  }

  function typewriterWrite(element, text, speed, callback) {
    clearType();
    currentFullText = text;
    currentCharIndex = 0;
    element.textContent = '';
    typeInterval = setInterval(function() {
      if (currentCharIndex < currentFullText.length) {
        element.textContent += currentFullText.charAt(currentCharIndex);
        currentCharIndex++;
      } else {
        clearType();
        if (callback) callback();
      }
    }, speed || 30);
  }

  function skipTypewriter(element) {
    clearType();
    element.textContent = currentFullText;
    currentCharIndex = currentFullText.length;
  }

  function highlightTarget(selector) {
    var target = document.querySelector(selector);
    if (!target) { hideHighlight(); return; }

    var rect = target.getBoundingClientRect();
    var pad = 8;

    // Cut a hole in the backdrop around the target
    if (backdrop) {
      backdrop.style.clipPath = 'polygon('
        + '0% 0%, 0% 100%, '
        + (rect.left - pad) + 'px 100%, '
        + (rect.left - pad) + 'px ' + (rect.bottom + pad) + 'px, '
        + (rect.right + pad) + 'px ' + (rect.bottom + pad) + 'px, '
        + (rect.right + pad) + 'px ' + (rect.top - pad) + 'px, '
        + (rect.left - pad) + 'px ' + (rect.top - pad) + 'px, '
        + (rect.left - pad) + 'px 0%, 100% 0%, 100% 100%, 0% 100%'
        + ')';
    }

    // Glowing ring around target
    if (!spotlightRing) {
      spotlightRing = document.createElement('div');
      spotlightRing.id = 'tut-spotlight-ring';
      document.body.appendChild(spotlightRing);
    }
    spotlightRing.style.left = (rect.left - pad) + 'px';
    spotlightRing.style.top = (rect.top - pad) + 'px';
    spotlightRing.style.width = (rect.width + pad * 2) + 'px';
    spotlightRing.style.height = (rect.height + pad * 2) + 'px';
    spotlightRing.style.display = 'block';

    // Pulsing click indicator
    if (!clickIndicator) {
      clickIndicator = document.createElement('div');
      clickIndicator.id = 'tut-click-indicator';
      clickIndicator.innerHTML = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/></svg>';
      document.body.appendChild(clickIndicator);
    }
    clickIndicator.style.left = (rect.left + rect.width / 2 - 16) + 'px';
    clickIndicator.style.top = (rect.top - pad - 40) + 'px';
    clickIndicator.style.display = 'block';

    target.classList.add('tut-pulse-target');

    if (!resizeHandler) {
      resizeHandler = function() {
        if (!tutorialActive) return;
        var cur = PHASES[phase] && PHASES[phase].steps[step];
        if (cur && cur.target) highlightTarget(cur.target);
      };
      window.addEventListener('resize', resizeHandler);
    }
  }

  function hideHighlight() {
    if (backdrop) backdrop.style.clipPath = '';
    if (spotlightRing) spotlightRing.style.display = 'none';
    if (clickIndicator) clickIndicator.style.display = 'none';
    document.querySelectorAll('.tut-pulse-target').forEach(function(el) { el.classList.remove('tut-pulse-target'); });
    if (resizeHandler) { window.removeEventListener('resize', resizeHandler); resizeHandler = null; }
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

    dialog.innerHTML = ''
      + '<div class="tut-line">'
      + '  <img class="tut-assistant-gif" src="./assets/TutorialAssets/Assistant.gif" alt="ARIA" />'
      + '  <div class="tut-text-area">'
      + '    <div class="tut-assistant-name">' + assistantName + '</div>'
      + '    <div class="tut-phase-label">Phase ' + (phase + 1) + ': ' + p.name + '</div>'
      + '    <div class="tut-body" id="tut-body-text"></div>'
      + '  </div>'
      + '</div>'
      + '<div class="tut-actions" id="tut-actions"></div>';

    dialog.style.display = 'flex';

    if (s.target) {
      setTimeout(function() { highlightTarget(s.target); }, 100);
    } else {
      hideHighlight();
    }

    var bodyEl = document.getElementById('tut-body-text');
    var actionsEl = document.getElementById('tut-actions');

    if (isNameInput) {
      typewriterWrite(bodyEl, text, 25, function() {
        actionsEl.innerHTML = '<input type="text" class="tut-name-input" id="tut-name-input" placeholder="Enter your name" value="' + userName + '" />'
          + '<button class="tut-btn" id="tut-continue-btn">Continue</button>';
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
      });
    } else if (isWaiting) {
      typewriterWrite(bodyEl, text, 25, function() {
        actionsEl.innerHTML = '<button class="tut-btn tut-btn-wait" id="tut-next-btn" disabled>Waiting...</button>';
        waitForAction(s.threshold);
      });
    } else if (isComplete) {
      typewriterWrite(bodyEl, text, 25, function() {
        actionsEl.innerHTML = '<button class="tut-btn tut-btn-finish" id="tut-next-btn">Finish</button>';
        document.getElementById('tut-next-btn').addEventListener('click', complete);
      });
    } else {
      typewriterWrite(bodyEl, text, 25, function() {
        var btnLabel = 'Next';
        actionsEl.innerHTML = '<button class="tut-btn" id="tut-next-btn">' + btnLabel + '</button>';
        document.getElementById('tut-next-btn').addEventListener('click', function() {
          if (s.action === 'highlight' && s.target) {
            var target = document.querySelector(s.target);
            if (target) target.click();
          }
          advance();
        });
      });
    }

    // Click on dialog to skip typewriter
    if (dialog) {
      dialog.onclick = function(e) {
        if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
        if (typeInterval) {
          skipTypewriter(bodyEl);
          // Re-render actions after skip
          if (!isNameInput && !isWaiting && !isComplete) {
            if (!actionsEl.querySelector('#tut-next-btn')) {
              actionsEl.innerHTML = '<button class="tut-btn" id="tut-next-btn">Next</button>';
              document.getElementById('tut-next-btn').addEventListener('click', function() {
                if (s.action === 'highlight' && s.target) {
                  var target = document.querySelector(s.target);
                  if (target) target.click();
                }
                advance();
              });
            }
          } else if (isWaiting && !actionsEl.querySelector('#tut-next-btn:not([disabled])')) {
            // Already waiting, do nothing
          } else if (isComplete && !actionsEl.querySelector('#tut-next-btn')) {
            actionsEl.innerHTML = '<button class="tut-btn tut-btn-finish" id="tut-next-btn">Finish</button>';
            document.getElementById('tut-next-btn').addEventListener('click', complete);
          }
        }
      };
    }
  }

  function waitForAction(threshold) {
    clearWait();
    var needed = threshold || 1;
    waitInterval = setInterval(function() {
      if (window.__mol3d && window.__mol3d.atoms && window.__mol3d.atoms.size >= needed) {
        clearWait();
        var btn = document.getElementById('tut-next-btn');
        if (btn) {
          btn.disabled = false;
          btn.classList.remove('tut-btn-wait');
          btn.textContent = 'Next';
          btn.addEventListener('click', advance);
        }
      }
    }, 300);
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
    if (document.getElementById('tut-styles-v3')) return;
    var s = document.createElement('style');
    s.id = 'tut-styles-v3';
    s.textContent = [
      '#tut-backdrop { position:fixed;inset:0;background:#000000;z-index:9998;opacity:0;transition:opacity 0.5s;pointer-events:none; }',
      '#tut-backdrop.visible { opacity:1; }',
      '#tut-dialog { position:fixed;bottom:clamp(40px,8vh,80px);left:50%;transform:translateX(-50%);',
      '  background:rgba(10,10,15,0.95);border:1px solid rgba(255,255,255,0.1);',
      '  border-radius:12px;padding:clamp(16px,3vw,24px);',
      '  width:clamp(320px,80vw,560px);z-index:9999;',
      '  box-shadow:0 16px 48px rgba(0,0,0,0.8);',
      '  display:none;flex-direction:column;gap:16px;',
      '  font-family:"Segoe UI",system-ui,-apple-system,sans-serif; }',
      '.tut-line { display:flex;align-items:flex-start;gap:clamp(10px,2vw,16px); }',
      '.tut-assistant-gif { width:clamp(40px,8vw,56px);height:clamp(40px,8vw,56px);',
      '  border-radius:50%;object-fit:cover;flex-shrink:0;',
      '  border:2px solid rgba(0,200,255,0.4);box-shadow:0 0 12px rgba(0,200,255,0.2); }',
      '.tut-text-area { flex:1;min-width:0; }',
      '.tut-assistant-name { color:#00d4ff;font-weight:600;font-size:clamp(11px,2.2vw,13px);letter-spacing:1px; }',
      '.tut-phase-label { color:rgba(255,255,255,0.35);font-size:clamp(9px,1.8vw,11px);margin-top:2px; }',
      '.tut-body { color:rgba(255,255,255,0.9);font-size:clamp(13px,2.6vw,15px);line-height:1.6;',
      '  margin-top:clamp(8px,1.5vw,12px);min-height:2.4em;word-wrap:break-word; }',
      '.tut-actions { display:flex;gap:8px;justify-content:flex-end;align-items:center; }',
      '.tut-btn { padding:clamp(6px,1.2vw,8px) clamp(14px,3vw,20px);',
      '  background:rgba(0,200,255,0.15);border:1px solid rgba(0,200,255,0.3);',
      '  border-radius:6px;color:#00d4ff;font-weight:500;cursor:pointer;',
      '  font-size:clamp(12px,2.2vw,13px);transition:all 0.2s; }',
      '.tut-btn:hover { background:rgba(0,200,255,0.25);border-color:rgba(0,200,255,0.5); }',
      '.tut-btn-wait { opacity:0.4;cursor:not-allowed; }',
      '.tut-btn-finish { background:rgba(0,255,136,0.15);border-color:rgba(0,255,136,0.3);color:#00ff88; }',
      '.tut-btn-finish:hover { background:rgba(0,255,136,0.25);border-color:rgba(0,255,136,0.5); }',
      '.tut-name-input { flex:1;padding:clamp(6px,1.2vw,8px) clamp(10px,2vw,14px);',
      '  background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.15);',
      '  border-radius:6px;color:#fff;font-size:clamp(12px,2.2vw,13px);outline:none; }',
      '.tut-name-input:focus { border-color:rgba(0,200,255,0.5); }',
      '#tut-spotlight-ring { position:fixed;border:2px solid #00d4ff;border-radius:10px;',
      '  box-shadow:0 0 20px #00d4ff, 0 0 40px rgba(0,212,255,0.4), inset 0 0 15px rgba(0,212,255,0.15);',
      '  z-index:9997;pointer-events:none;display:none;transition:all 0.3s ease;',
      '  animation:tutRingPulse 1.8s ease-in-out infinite; }',
      '#tut-click-indicator { position:fixed;z-index:9997;pointer-events:none;display:none;',
      '  color:#00d4ff;animation:tutBounce 1s ease-in-out infinite;',
      '  filter:drop-shadow(0 0 8px rgba(0,212,255,0.8)); }',
      '@keyframes tutRingPulse {',
      '  0%,100% { box-shadow:0 0 20px #00d4ff, 0 0 40px rgba(0,212,255,0.4), inset 0 0 15px rgba(0,212,255,0.15); }',
      '  50% { box-shadow:0 0 30px #00d4ff, 0 0 60px rgba(0,212,255,0.6), inset 0 0 25px rgba(0,212,255,0.25); }',
      '}',
      '@keyframes tutBounce {',
      '  0%,100% { transform:translateY(0); }',
      '  50% { transform:translateY(8px); }',
      '}',
      '@keyframes tutPulseTarget {',
      '  0%,100% { box-shadow:0 0 0 0 rgba(0,212,255,0.7); }',
      '  50% { box-shadow:0 0 0 12px rgba(0,212,255,0); }',
      '}',
      '.tut-pulse-target { animation:tutPulseTarget 1.5s ease-in-out infinite !important; }'
    ].join('\n');
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
