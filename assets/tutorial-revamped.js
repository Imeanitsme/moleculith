// Tutorial System - Flying Assistant (No Backdrop)
(function() {
  'use strict';

  var TUTORIAL_KEY = 'mol3d.tutorial.completed.v4';
  var USER_NAME_KEY = 'mol3d.user.name';

  var tutorialActive = false;
  var phase = 0;
  var step = 0;
  var userName = localStorage.getItem(USER_NAME_KEY) || 'Scientist';
  var assistantName = 'ARIA';

  var container, assistantEl, dialogEl;
  var spotlightRing, clickIndicator;
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
        { text: "Nice to meet you, {user}! Let me show you around the lab.", action: 'next' },
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
        { target: '#pool-list', text: "Now let's learn about bonds! Spawn another H atom.", action: 'waitForSpawn', threshold: 2 },
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
    container = document.createElement('div');
    container.id = 'tut-container';
    container.className = 'tut-no-transition';

    dialogEl = document.createElement('div');
    dialogEl.id = 'tut-dialog';
    dialogEl.innerHTML = '<div class="tut-dialog-tail"></div><div class="tut-dialog-body" id="tut-body-text"></div><div class="tut-dialog-actions" id="tut-actions"></div>';

    assistantEl = document.createElement('div');
    assistantEl.id = 'tut-assistant';
    assistantEl.innerHTML = '<img class="tut-assistant-img" src="./assets/TutorialAssets/Assistant.gif" alt="ARIA" /><div class="tut-assistant-name">' + assistantName + '</div>';

    container.appendChild(dialogEl);
    container.appendChild(assistantEl);
    document.body.appendChild(container);

    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        container.classList.remove('tut-no-transition');
      });
    });
  }

  function destroyUI() {
    clearType();
    clearWait();
    hideHighlight();
    if (container && container.parentNode) {
      container.classList.add('tut-fade-out');
      setTimeout(function() { if (container && container.parentNode) container.remove(); }, 500);
    }
    if (spotlightRing && spotlightRing.parentNode) spotlightRing.remove();
    if (clickIndicator && clickIndicator.parentNode) clickIndicator.remove();
    container = assistantEl = dialogEl = spotlightRing = clickIndicator = null;
  }

  function positionContainer(targetSelector) {
    if (!container) return;

    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var cw = container.offsetWidth || 320;
    var ch = container.offsetHeight || 300;

    if (targetSelector) {
      var target = document.querySelector(targetSelector);
      if (target) {
        var rect = target.getBoundingClientRect();
        var spaceAbove = rect.top;
        var spaceBelow = vh - rect.bottom;
        var assistantH = 70;
        var gap = 10;

        if (spaceAbove > ch + assistantH + gap + 20 || spaceAbove >= spaceBelow) {
          var bottomPos = vh - rect.top + gap;
          bottomPos = Math.max(10, bottomPos);
          container.style.bottom = bottomPos + 'px';
        } else {
          var topPos = rect.bottom + gap;
          topPos = Math.max(10, topPos);
          container.style.bottom = '';
          container.style.top = topPos + 'px';
        }

        var centerX = rect.left + rect.width / 2;
        var leftPos = centerX - cw / 2;
        leftPos = Math.max(10, Math.min(leftPos, vw - cw - 10));
        container.style.left = leftPos + 'px';
        container.style.right = '';
        return;
      }
    }

    container.style.top = '';
    var bottomCenter = Math.max(20, vh * 0.18);
    container.style.bottom = bottomCenter + 'px';
    var leftCenter = (vw - cw) / 2;
    leftCenter = Math.max(10, Math.min(leftCenter, vw - cw - 10));
    container.style.left = leftCenter + 'px';
    container.style.right = '';
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
    }, speed || 25);
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

    if (!clickIndicator) {
      clickIndicator = document.createElement('div');
      clickIndicator.id = 'tut-click-indicator';
      clickIndicator.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/></svg>';
      document.body.appendChild(clickIndicator);
    }
    clickIndicator.style.left = (rect.left + rect.width / 2 - 14) + 'px';
    clickIndicator.style.top = (rect.top - pad - 36) + 'px';
    clickIndicator.style.display = 'block';

    target.classList.add('tut-pulse-target');

    if (!resizeHandler) {
      resizeHandler = function() {
        if (!tutorialActive) return;
        var cur = PHASES[phase] && PHASES[phase].steps[step];
        if (cur) {
          if (cur.target) highlightTarget(cur.target);
          positionContainer(cur.target || null);
        }
      };
      window.addEventListener('resize', resizeHandler);
    }
  }

  function hideHighlight() {
    if (spotlightRing) spotlightRing.style.display = 'none';
    if (clickIndicator) clickIndicator.style.display = 'none';
    document.querySelectorAll('.tut-pulse-target').forEach(function(el) { el.classList.remove('tut-pulse-target'); });
    if (resizeHandler) { window.removeEventListener('resize', resizeHandler); resizeHandler = null; }
  }

  function setDialogContent(phaseInfo, text) {
    var body = dialogEl.querySelector('#tut-body-text');
    if (body) body.textContent = text;
    var tail = dialogEl.querySelector('.tut-dialog-tail');
    if (!tail) {
      tail = document.createElement('div');
      tail.className = 'tut-dialog-tail';
      dialogEl.insertBefore(tail, dialogEl.firstChild);
    }
    var header = dialogEl.querySelector('.tut-dialog-header');
    if (!header) {
      header = document.createElement('div');
      header.className = 'tut-dialog-header';
      header.innerHTML = '<div class="tut-dialog-meta"><span class="tut-assistant-label">' + assistantName + '</span><span class="tut-phase-label">Phase ' + (phase + 1) + ': ' + phaseInfo.name + '</span></div><button class="tut-skip-btn" title="Skip Tutorial">&times;</button>';
      dialogEl.insertBefore(header, tail);
    } else {
      var meta = header.querySelector('.tut-dialog-meta');
      if (meta) meta.innerHTML = '<span class="tut-assistant-label">' + assistantName + '</span><span class="tut-phase-label">Phase ' + (phase + 1) + ': ' + phaseInfo.name + '</span>';
    }
    var skipBtn = header.querySelector('.tut-skip-btn');
    if (skipBtn) {
      skipBtn.onclick = function(e) {
        e.stopPropagation();
        complete();
      };
    }
  }

  function setActions(html) {
    var actions = dialogEl.querySelector('#tut-actions');
    if (actions) actions.innerHTML = html;
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

    setDialogContent(p, text);

    if (s.target) {
      setTimeout(function() { highlightTarget(s.target); }, 50);
    } else {
      hideHighlight();
    }

    positionContainer(s.target || null);
    container.classList.add('tut-visible');

    var bodyEl = dialogEl.querySelector('#tut-body-text');
    var actionsEl = dialogEl.querySelector('#tut-actions');

    if (isNameInput) {
      typewriterWrite(bodyEl, text, 22, function() {
        setActions('<input type="text" class="tut-name-input" id="tut-name-input" placeholder="Enter your name" value="' + userName + '" /><button class="tut-btn" id="tut-continue-btn">Continue</button>');
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
      typewriterWrite(bodyEl, text, 22, function() {
        setActions('<button class="tut-btn tut-btn-wait" id="tut-next-btn" disabled>Waiting...</button>');
        waitForAction(s.threshold);
      });
    } else if (isComplete) {
      typewriterWrite(bodyEl, text, 22, function() {
        setActions('<button class="tut-btn tut-btn-finish" id="tut-next-btn">Finish</button>');
        document.getElementById('tut-next-btn').addEventListener('click', complete);
      });
    } else {
      typewriterWrite(bodyEl, text, 22, function() {
        setActions('<button class="tut-btn" id="tut-next-btn">Next</button>');
        document.getElementById('tut-next-btn').addEventListener('click', function() {
          if (s.action === 'highlight' && s.target) {
            var target = document.querySelector(s.target);
            if (target) target.click();
          }
          advance();
        });
      });
    }

    dialogEl.onclick = function(e) {
      if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
      if (typeInterval) {
        skipTypewriter(bodyEl);
        if (!isNameInput && !isWaiting && !isComplete) {
          if (!actionsEl.querySelector('#tut-next-btn')) {
            setActions('<button class="tut-btn" id="tut-next-btn">Next</button>');
            document.getElementById('tut-next-btn').addEventListener('click', function() {
              if (s.action === 'highlight' && s.target) {
                var target = document.querySelector(s.target);
                if (target) target.click();
              }
              advance();
            });
          }
        } else if (isComplete && !actionsEl.querySelector('#tut-next-btn')) {
          setActions('<button class="tut-btn tut-btn-finish" id="tut-next-btn">Finish</button>');
          document.getElementById('tut-next-btn').addEventListener('click', complete);
        }
      }
    };
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
    if (container && container.parentNode) container.remove();
    container = assistantEl = dialogEl = null;
    start();
  }

  function injectStyles() {
    if (document.getElementById('tut-styles-v4')) return;
    var s = document.createElement('style');
    s.id = 'tut-styles-v4';
    s.textContent = [
      '#tut-container {',
      '  position:fixed; z-index:9999;',
      '  display:flex; flex-direction:column; align-items:center;',
      '  gap:0; pointer-events:none;',
      '  transition: left 0.7s cubic-bezier(0.34,1.56,0.64,1),',
      '              bottom 0.7s cubic-bezier(0.34,1.56,0.64,1),',
      '              top 0.7s cubic-bezier(0.34,1.56,0.64,1),',
      '              opacity 0.5s ease;',
      '  opacity:0;',
      '}',
      '#tut-container.tut-no-transition { transition:none !important; }',
      '#tut-container.tut-visible { opacity:1; }',
      '#tut-container.tut-fade-out { opacity:0; }',

      '#tut-dialog {',
      '  position:relative; pointer-events:auto;',
      '  background:linear-gradient(145deg, rgba(8,14,30,0.95), rgba(12,20,40,0.93));',
      '  border:1px solid rgba(0,212,255,0.25);',
      '  border-radius:16px;',
      '  padding:clamp(12px,2.5vw,18px) clamp(14px,3vw,20px);',
      '  width:clamp(260px,75vw,440px); max-width:calc(100vw - 24px);',
      '  box-shadow:0 12px 40px rgba(0,0,0,0.7), 0 0 1px rgba(0,212,255,0.4), 0 0 30px rgba(0,212,255,0.06);',
      '  display:flex; flex-direction:column; gap:10px;',
      '  font-family:"Segoe UI",system-ui,-apple-system,sans-serif;',
      '  backdrop-filter:blur(16px);',
      '  animation:tutDialogIn 0.35s cubic-bezier(0.16,1,0.3,1);',
      '}',
      '@keyframes tutDialogIn { from { opacity:0; transform:translateY(8px) scale(0.97); } to { opacity:1; transform:translateY(0) scale(1); } }',

      '.tut-dialog-tail {',
      '  position:absolute; bottom:-10px; left:50%; transform:translateX(-50%);',
      '  width:0; height:0;',
      '  border-left:10px solid transparent; border-right:10px solid transparent;',
      '  border-top:10px solid rgba(10,17,35,0.95);',
      '  filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));',
      '  z-index:1;',
      '}',

      '.tut-dialog-header {',
      '  display:flex; align-items:center; justify-content:space-between; gap:8px;',
      '}',
      '.tut-dialog-meta { display:flex; flex-direction:column; gap:1px; }',
      '.tut-assistant-label {',
      '  color:#00d4ff; font-weight:700; font-size:clamp(10px,2vw,12px);',
      '  letter-spacing:1.5px; text-transform:uppercase;',
      '  text-shadow:0 0 8px rgba(0,212,255,0.4);',
      '}',
      '.tut-phase-label {',
      '  color:rgba(0,212,255,0.35); font-size:clamp(8px,1.6vw,10px);',
      '  letter-spacing:0.5px;',
      '}',
      '.tut-skip-btn {',
      '  background:none; border:none; color:rgba(0,212,255,0.3);',
      '  font-size:18px; cursor:pointer; padding:0 2px; line-height:1;',
      '  transition:color 0.2s; pointer-events:auto;',
      '}',
      '.tut-skip-btn:hover { color:rgba(0,212,255,0.8); }',

      '.tut-dialog-body {',
      '  color:rgba(224,240,255,0.95); font-size:clamp(12px,2.5vw,14px);',
      '  line-height:1.55; min-height:1.8em; word-wrap:break-word;',
      '}',

      '.tut-dialog-actions {',
      '  display:flex; gap:8px; justify-content:flex-end; align-items:center;',
      '  padding-top:2px; flex-wrap:wrap;',
      '}',

      '.tut-btn {',
      '  padding:clamp(6px,1.2vw,8px) clamp(14px,2.5vw,20px);',
      '  background:linear-gradient(135deg, rgba(0,212,255,0.15), rgba(0,255,136,0.08));',
      '  border:1px solid rgba(0,212,255,0.35);',
      '  border-radius:8px; color:#00d4ff; font-weight:600; cursor:pointer;',
      '  font-size:clamp(11px,2vw,12px); transition:all 0.25s cubic-bezier(0.4,0,0.2,1);',
      '  letter-spacing:0.5px; text-transform:uppercase; pointer-events:auto;',
      '}',
      '.tut-btn:hover {',
      '  background:linear-gradient(135deg, rgba(0,212,255,0.25), rgba(0,255,136,0.15));',
      '  border-color:rgba(0,212,255,0.6); box-shadow:0 0 14px rgba(0,212,255,0.2);',
      '  transform:translateY(-1px);',
      '}',
      '.tut-btn:active { transform:translateY(0); }',
      '.tut-btn-wait { opacity:0.35; cursor:not-allowed; transform:none !important; box-shadow:none !important; }',
      '.tut-btn-finish {',
      '  background:linear-gradient(135deg, rgba(0,255,136,0.15), rgba(0,212,255,0.08));',
      '  border-color:rgba(0,255,136,0.4); color:#00ff88;',
      '}',
      '.tut-btn-finish:hover {',
      '  background:linear-gradient(135deg, rgba(0,255,136,0.25), rgba(0,212,255,0.15));',
      '  border-color:rgba(0,255,136,0.6); box-shadow:0 0 14px rgba(0,255,136,0.2);',
      '}',

      '.tut-name-input {',
      '  flex:1; min-width:120px;',
      '  padding:clamp(6px,1.2vw,8px) clamp(10px,2vw,12px);',
      '  background:rgba(0,20,40,0.6); border:1px solid rgba(0,212,255,0.2);',
      '  border-radius:8px; color:#e0f0ff; font-size:clamp(11px,2vw,13px);',
      '  outline:none; transition:border-color 0.2s, box-shadow 0.2s;',
      '  pointer-events:auto;',
      '}',
      '.tut-name-input:focus { border-color:rgba(0,212,255,0.5); box-shadow:0 0 10px rgba(0,212,255,0.12); }',

      '#tut-assistant {',
      '  display:flex; flex-direction:column; align-items:center; gap:3px;',
      '  pointer-events:none; margin-top:6px;',
      '  animation:tutAssistantBob 3s ease-in-out infinite;',
      '}',
      '@keyframes tutAssistantBob {',
      '  0%,100% { transform:translateY(0); }',
      '  50% { transform:translateY(-5px); }',
      '}',
      '.tut-assistant-img {',
      '  width:clamp(42px,8vw,54px); height:clamp(42px,8vw,54px);',
      '  border-radius:50%; object-fit:cover;',
      '  border:2px solid rgba(0,212,255,0.5);',
      '  box-shadow:0 0 16px rgba(0,212,255,0.35), 0 0 4px rgba(0,255,136,0.2);',
      '}',
      '.tut-assistant-name {',
      '  color:#00d4ff; font-size:9px; font-weight:700;',
      '  letter-spacing:1.5px; text-transform:uppercase;',
      '  text-shadow:0 0 6px rgba(0,212,255,0.5); opacity:0.7;',
      '}',

      '#tut-spotlight-ring {',
      '  position:fixed; border:2px solid #00d4ff; border-radius:12px;',
      '  box-shadow:0 0 20px #00d4ff, 0 0 40px rgba(0,212,255,0.3), inset 0 0 16px rgba(0,212,255,0.1);',
      '  z-index:9997; pointer-events:none; display:none;',
      '  transition:all 0.35s cubic-bezier(0.4,0,0.2,1);',
      '  animation:tutRingPulse 2s ease-in-out infinite;',
      '}',
      '#tut-click-indicator {',
      '  position:fixed; z-index:9997; pointer-events:none; display:none;',
      '  color:#00d4ff; animation:tutBounce 1.2s ease-in-out infinite;',
      '  filter:drop-shadow(0 0 8px rgba(0,212,255,0.8));',
      '}',
      '@keyframes tutRingPulse {',
      '  0%,100% { box-shadow:0 0 20px #00d4ff, 0 0 40px rgba(0,212,255,0.3), inset 0 0 16px rgba(0,212,255,0.1); }',
      '  50% { box-shadow:0 0 30px #00d4ff, 0 0 60px rgba(0,212,255,0.45), inset 0 0 24px rgba(0,212,255,0.18); }',
      '}',
      '@keyframes tutBounce {',
      '  0%,100% { transform:translateY(0); opacity:1; }',
      '  50% { transform:translateY(8px); opacity:0.6; }',
      '}',
      '@keyframes tutPulseTarget {',
      '  0%,100% { box-shadow:0 0 0 0 rgba(0,212,255,0.5); }',
      '  50% { box-shadow:0 0 0 12px rgba(0,212,255,0); }',
      '}',
      '.tut-pulse-target { animation:tutPulseTarget 1.8s ease-in-out infinite !important; }'
    ].join('\n');
    document.head.appendChild(s);
  }

  function init() {
    injectStyles();

    var tutorialBtn = document.getElementById('btn-tutorial');
    if (tutorialBtn) {
      tutorialBtn.addEventListener('click', function() {
        replay();
        var menu = document.getElementById('menu-dropdown');
        if (menu) menu.hidden = true;
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
