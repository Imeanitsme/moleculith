// Tutorial System - Cell to Singularity Style - Standalone module
(function() {
  'use strict';

  const TUTORIAL_KEY = 'mol3d.tutorial.completed.v2';
  const ASSISTANT_NAME_KEY = 'mol3d.assistant.name';
  const USER_NAME_KEY = 'mol3d.user.name';

  let tutorialActive = false;
  let tutorialPhase = 0;
  let tutorialStep = 0;
  let assistantName = localStorage.getItem(ASSISTANT_NAME_KEY) || 'ARIA';
  let userName = localStorage.getItem(USER_NAME_KEY) || 'Scientist';

  const TUTORIAL_PHASES = [
    {
      id: 'setup',
      name: 'Assistant Setup',
      steps: [
        { target: null, text: `Hello! I'm {assistant}, your chemistry AI assistant.`, action: 'show' },
        { target: null, text: `What should I call you?`, action: 'showNameInput' },
        { target: null, text: `Nice to meet you, {user}! Let me show you around the lab.`, action: 'next' },
      ]
    },
    {
      id: 'basics',
      name: 'Foundations',
      steps: [
        { target: '#left-sidebar', text: `This is your element pool, {user}. All 118 elements are here.`, action: 'highlight' },
        { target: '#btn-spawn-h', text: `Try spawning a Hydrogen atom by clicking here.`, action: 'waitForClick' },
        { target: null, text: `Great! Atoms are the building blocks of all matter.`, action: 'next' },
        { target: null, text: `Drag atoms to move them. They'll bond when close enough.`, action: 'next' },
      ]
    },
    {
      id: 'bonding',
      name: 'Bonding & Reactions',
      steps: [
        { target: null, text: `Now let's learn about bonds! Spawn another H atom.`, action: 'waitForSpawn' },
        { target: null, text: `Two H atoms will automatically form H₂ - molecular hydrogen!`, action: 'next' },
        { target: null, text: `Double-click molecules to see reactions. Try combining different elements!`, action: 'next' },
        { target: '#btn-fc', text: `This shows formal charges on atoms. Useful for understanding reactivity.`, action: 'highlight' },
      ]
    },
    {
      id: 'advanced',
      name: 'Advanced Features',
      steps: [
        { target: '#btn-xray', text: `X-Ray mode lets you see through atoms. Press X or click here.`, action: 'highlight' },
        { target: '#btn-proton', text: `The Proton Gun adds protons to atoms, transmuting elements!`, action: 'highlight' },
        { target: '#btn-quest', text: `Quest mode gives you challenges to complete for rewards.`, action: 'highlight' },
        { target: null, text: `You're all set, {user}! Explore and experiment. The lab is yours.`, action: 'complete' },
      ]
    }
  ];

  let backdrop = null;
  let dialogBox = null;
  let highlightOverlay = null;

  function shouldShowTutorial() {
    return !localStorage.getItem(TUTORIAL_KEY);
  }

  function startTutorial() {
    if (tutorialActive) return;
    tutorialActive = true;
    tutorialPhase = 0;
    tutorialStep = 0;
    createTutorialUI();
    showCurrentStep();
  }

  function createTutorialUI() {
    backdrop = document.createElement('div');
    backdrop.className = 'tutorial-backdrop';
    backdrop.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      z-index: 9998;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.3s;
    `;
    document.body.appendChild(backdrop);

    dialogBox = document.createElement('div');
    dialogBox.className = 'tutorial-dialog-box';
    dialogBox.style.cssText = `
      position: fixed;
      bottom: 100px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      border: 2px solid #0f3460;
      border-radius: 16px;
      padding: 20px;
      max-width: 500px;
      z-index: 9999;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      display: none;
    `;
    document.body.appendChild(dialogBox);

    highlightOverlay = document.createElement('div');
    highlightOverlay.className = 'tutorial-highlight';
    highlightOverlay.style.cssText = `
      position: fixed;
      border: 3px solid #00ff88;
      border-radius: 8px;
      box-shadow: 0 0 20px #00ff88, inset 0 0 20px rgba(0, 255, 136, 0.1);
      z-index: 9997;
      pointer-events: none;
      display: none;
      transition: all 0.3s;
    `;
    document.body.appendChild(highlightOverlay);

    setTimeout(() => {
      backdrop.style.opacity = '1';
    }, 100);
  }

  function showCurrentStep() {
    if (tutorialPhase >= TUTORIAL_PHASES.length) {
      completeTutorial();
      return;
    }

    const phase = TUTORIAL_PHASES[tutorialPhase];
    const step = phase.steps[tutorialStep];

    if (!step) {
      nextPhase();
      return;
    }

    const text = step.text.replace('{assistant}', assistantName).replace('{user}', userName);

    dialogBox.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
        <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #00ff88, #00d4ff); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px;">
          🤖
        </div>
        <div>
          <div style="color: #00ff88; font-weight: bold; font-size: 14px;">${assistantName}</div>
          <div style="color: #888; font-size: 11px;">Phase ${tutorialPhase + 1}: ${phase.name}</div>
        </div>
      </div>
      <div style="color: #fff; font-size: 15px; line-height: 1.5; margin-bottom: 16px;">
        ${text}
      </div>
      <div id="tutorial-actions" style="display: flex; gap: 8px; justify-content: flex-end;">
        ${step.action === 'showNameInput' ? `
          <input type="text" id="tutorial-name-input" placeholder="Enter your name" value="${userName}" style="flex: 1; padding: 8px 12px; background: #0a0a1a; border: 1px solid #0f3460; border-radius: 8px; color: #fff; font-size: 14px;" />
          <button class="tutorial-btn" style="padding: 8px 16px; background: #00ff88; border: none; border-radius: 8px; color: #000; font-weight: bold; cursor: pointer;">Continue</button>
        ` : `
          <button class="tutorial-btn" style="padding: 8px 16px; background: #00ff88; border: none; border-radius: 8px; color: #000; font-weight: bold; cursor: pointer;">
            ${step.action === 'complete' ? 'Finish' : step.action === 'waitForClick' || step.action === 'waitForSpawn' ? 'Waiting...' : 'Next'}
          </button>
        `}
      </div>
    `;

    dialogBox.style.display = 'block';

    const btn = dialogBox.querySelector('.tutorial-btn');
    if (btn) {
      if (step.action === 'waitForClick' || step.action === 'waitForSpawn') {
        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
        waitForAction(step.action);
      } else {
        btn.addEventListener('click', function() {
          if (step.action === 'showNameInput') {
            const input = document.getElementById('tutorial-name-input');
            if (input && input.value.trim()) {
              userName = input.value.trim();
              localStorage.setItem(USER_NAME_KEY, userName);
            }
          }
          handleStepAction(step.action, step.target);
        });
      }
    }

    if (step.target && step.action === 'highlight') {
      highlightElement(step.target);
    } else {
      hideHighlight();
    }
  }

  function handleStepAction(action, target) {
    if (action === 'highlight' && target) {
      const el = document.querySelector(target);
      if (el) {
        el.click();
      }
    }

    nextStep();
  }

  function waitForAction(action) {
    if (action === 'waitForClick') {
      const spawnBtn = document.getElementById('btn-spawn-h');
      if (spawnBtn) {
        const handler = function() {
          spawnBtn.removeEventListener('click', handler);
          const btn = dialogBox.querySelector('.tutorial-btn');
          if (btn) {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
            btn.textContent = 'Next';
          }
        };
        spawnBtn.addEventListener('click', handler);
      }
    } else if (action === 'waitForSpawn') {
      const checkSpawn = setInterval(function() {
        if (window.__mol3d && window.__mol3d.atoms && window.__mol3d.atoms.size >= 2) {
          clearInterval(checkSpawn);
          const btn = dialogBox.querySelector('.tutorial-btn');
          if (btn) {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
            btn.textContent = 'Next';
          }
        }
      }, 500);
    }
  }

  function highlightElement(selector) {
    const el = document.querySelector(selector);
    if (!el) return;

    const rect = el.getBoundingClientRect();
    highlightOverlay.style.left = (rect.left - 5) + 'px';
    highlightOverlay.style.top = (rect.top - 5) + 'px';
    highlightOverlay.style.width = (rect.width + 10) + 'px';
    highlightOverlay.style.height = (rect.height + 10) + 'px';
    highlightOverlay.style.display = 'block';

    el.style.animation = 'tutorial-pulse 1.5s infinite';
  }

  function hideHighlight() {
    highlightOverlay.style.display = 'none';
    document.querySelectorAll('[style*="tutorial-pulse"]').forEach(function(el) {
      el.style.animation = '';
    });
  }

  function nextStep() {
    tutorialStep++;
    const phase = TUTORIAL_PHASES[tutorialPhase];
    if (tutorialStep >= phase.steps.length) {
      nextPhase();
    } else {
      showCurrentStep();
    }
  }

  function nextPhase() {
    tutorialPhase++;
    tutorialStep = 0;
    if (tutorialPhase >= TUTORIAL_PHASES.length) {
      completeTutorial();
    } else {
      showCurrentStep();
    }
  }

  function completeTutorial() {
    localStorage.setItem(TUTORIAL_KEY, 'true');
    tutorialActive = false;

    hideHighlight();

    if (backdrop) {
      backdrop.style.opacity = '0';
      setTimeout(() => backdrop.remove(), 300);
    }
    if (dialogBox) {
      dialogBox.style.display = 'none';
      dialogBox.remove();
    }
    if (highlightOverlay) {
      highlightOverlay.remove();
    }

    showStatus(`Tutorial complete! Welcome to the lab, ${userName}!`);
  }

  function replayTutorial() {
    localStorage.removeItem(TUTORIAL_KEY);
    startTutorial();
  }

  function showStatus(msg) {
    const statusEl = document.getElementById('status-text');
    if (statusEl) {
      statusEl.textContent = msg;
      statusEl.className = 'info';
    }
  }

  function init() {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes tutorial-pulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(0, 255, 136, 0.7); }
        50% { box-shadow: 0 0 0 10px rgba(0, 255, 136, 0); }
      }
    `;
    document.head.appendChild(style);

    const settingsBtn = document.querySelector('[data-action="settings"]');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', function() {
        setTimeout(function() {
          const modal = document.getElementById('settings-modal');
          if (modal && !document.getElementById('settings-tutorial')) {
            const tutorialBtn = document.createElement('button');
            tutorialBtn.id = 'settings-tutorial';
            tutorialBtn.textContent = 'Replay Tutorial';
            tutorialBtn.style.cssText = 'padding: 8px 16px; background: #0f3460; border: 1px solid #00ff88; border-radius: 8px; color: #fff; cursor: pointer; margin-top: 8px;';
            tutorialBtn.addEventListener('click', function() {
              replayTutorial();
              modal.hidden = true;
            });
            modal.appendChild(tutorialBtn);
          }
        }, 100);
      });
    }

    window.__tutorial = {
      start: startTutorial,
      replay: replayTutorial,
      isActive: () => tutorialActive,
      shouldShow: shouldShowTutorial
    };

    setTimeout(function() {
      if (shouldShowTutorial()) {
        startTutorial();
      }
    }, 2000);

    console.log('[Tutorial] Module initialized');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
