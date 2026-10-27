// Tutorial / onboarding with language selection.
// Shows language picker first, then tutorial in selected language.
// Tutorial style: video editor software (Premiere Pro / DaVinci Resolve style).

import { t, setLang, getLang, LANGS } from './i18n.js';

const SEEN_KEY = 'mol3d.tutorial-seen';
const LANG_KEY = 'mol3d.lang-selected';

let overlay = null;
let currentStep = 0;
let selectedLang = null;
let calloutSvg = null;

const STEPS = [
  {
    titleKey: 'tut.welcome.title',
    bodyKey: 'tut.welcome.body',
    icon: '🧪',
  },
  {
    titleKey: 'tut.pool.title',
    bodyKey: 'tut.pool.body',
    icon: '⚛️',
    highlight: '[data-tab="left"]',
    cardPos: 'above',
  },
  {
    titleKey: 'tut.bond.title',
    bodyKey: 'tut.bond.body',
    icon: '🔗',
  },
  {
    titleKey: 'tut.bondOrder.title',
    bodyKey: 'tut.bondOrder.body',
    icon: '🔄',
  },
  {
    titleKey: 'tut.info.title',
    bodyKey: 'tut.info.body',
    icon: '📋',
    highlight: '[data-tab="side-info"]',
    cardPos: 'above',
  },
  {
    titleKey: 'tut.reaction.title',
    bodyKey: 'tut.reaction.body',
    icon: '⚗️',
  },
  {
    titleKey: 'tut.dex.title',
    bodyKey: 'tut.dex.body',
    icon: '📖',
    highlight: '[data-tab="side-dex"]',
    cardPos: 'above',
  },
  {
    titleKey: 'tut.camera.title',
    bodyKey: 'tut.camera.body',
    icon: '🎥',
  },
  {
    titleKey: 'tut.ready.title',
    bodyKey: 'tut.ready.body',
    icon: '🚀',
  },
];

function hasSeenTutorial() {
  try { return localStorage.getItem(SEEN_KEY) === '1'; } catch { return false; }
}

function hasSelectedLang() {
  try { return localStorage.getItem(LANG_KEY) !== null; } catch { return false; }
}

function markSeen() {
  try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* session-only */ }
}

function markLangSelected() {
  try { localStorage.setItem(LANG_KEY, '1'); } catch { /* session-only */ }
}

function getHighlightRect(selector) {
  const el = document.querySelector(selector);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

function positionCard(card, rect, pos) {
  const cardRect = card.getBoundingClientRect();
  const gap = 24;

  let top, left;

  if (pos === 'right') {
    top = rect.top + (rect.height - cardRect.height) / 2;
    left = rect.left + rect.width + gap;
  } else if (pos === 'left') {
    top = rect.top + (rect.height - cardRect.height) / 2;
    left = rect.left - cardRect.width - gap;
  } else if (pos === 'above') {
    top = rect.top - cardRect.height - gap;
    left = rect.left + (rect.width - cardRect.width) / 2;
  } else {
    top = (window.innerHeight - cardRect.height) / 2;
    left = (window.innerWidth - cardRect.width) / 2;
  }

  top = Math.max(16, Math.min(top, window.innerHeight - cardRect.height - 16));
  left = Math.max(16, Math.min(left, window.innerWidth - cardRect.width - 16));

  card.style.top = `${top}px`;
  card.style.left = `${left}px`;
}

function getCardAnchor(card, rect, pos) {
  const cardRect = card.getBoundingClientRect();
  let cx, cy, sx, sy;

  if (!rect) return null;

  sx = rect.left + rect.width / 2;
  sy = rect.top + rect.height / 2;

  if (pos === 'above') {
    cx = cardRect.left + cardRect.width / 2;
    cy = cardRect.top + cardRect.height;
  } else if (pos === 'right') {
    cx = cardRect.left;
    cy = cardRect.top + cardRect.height / 2;
  } else if (pos === 'left') {
    cx = cardRect.left + cardRect.width;
    cy = cardRect.top + cardRect.height / 2;
  } else {
    cx = cardRect.left + cardRect.width / 2;
    cy = cardRect.top + cardRect.height;
  }

  return { cx, cy, sx, sy };
}

function drawCallout(card, rect, pos) {
  if (!calloutSvg) return;
  const anchor = getCardAnchor(card, rect, pos);
  if (!anchor) {
    calloutSvg.style.display = 'none';
    return;
  }

  const { cx, cy, sx, sy } = anchor;
  const pad = 40;
  const minX = Math.min(cx, sx) - pad;
  const minY = Math.min(cy, sy) - pad;
  const maxX = Math.max(cx, sx) + pad;
  const maxY = Math.max(cy, sy) + pad;

  calloutSvg.style.display = 'block';
  calloutSvg.style.left = `${minX}px`;
  calloutSvg.style.top = `${minY}px`;
  calloutSvg.style.width = `${maxX - minX}px`;
  calloutSvg.style.height = `${maxY - minY}px`;
  calloutSvg.setAttribute('viewBox', `0 0 ${maxX - minX} ${maxY - minY}`);

  const lx1 = cx - minX, ly1 = cy - minY;
  const lx2 = sx - minX, ly2 = sy - minY;

  calloutSvg.innerHTML = `
    <line x1="${lx1}" y1="${ly1}" x2="${lx2}" y2="${ly2}"
      stroke="var(--accent)" stroke-width="2" stroke-dasharray="6 4" opacity="0.6" />
    <circle cx="${lx2}" cy="${ly2}" r="4" fill="var(--accent)" opacity="0.8" />
  `;
}

function updateHighlight(rect) {
  const highlight = overlay.querySelector('.tut-spotlight');
  if (!rect) {
    highlight.style.display = 'none';
    return;
  }

  highlight.style.display = 'block';
  highlight.style.top = `${rect.top}px`;
  highlight.style.left = `${rect.left}px`;
  highlight.style.width = `${rect.width}px`;
  highlight.style.height = `${rect.height}px`;

  overlay.style.setProperty('--spotlight-top', `${rect.top}px`);
  overlay.style.setProperty('--spotlight-left', `${rect.left}px`);
  overlay.style.setProperty('--spotlight-width', `${rect.width}px`);
  overlay.style.setProperty('--spotlight-height', `${rect.height}px`);
}

function buildTimeline() {
  let html = '<div class="tut-timeline">';
  for (let i = 0; i < STEPS.length; i++) {
    const cls = i < currentStep ? 'done' : i === currentStep ? 'active' : '';
    html += `<div class="tut-tl-seg ${cls}"><div class="tut-tl-fill"></div></div>`;
  }
  html += '</div>';
  return html;
}

function renderStep() {
  if (!overlay) return;
  const step = STEPS[currentStep];
  const content = overlay.querySelector('.tut-content');
  const card = overlay.querySelector('.tut-card');

  content.innerHTML = `
    <div class="tut-step-header">
      <div class="tut-icon-badge">${step.icon}</div>
      <div class="tut-step-text">
        <div class="tut-step-label">Step ${currentStep + 1} of ${STEPS.length}</div>
        <h2 class="tut-title">${t(step.titleKey)}</h2>
      </div>
    </div>
    <p class="tut-body">${t(step.bodyKey)}</p>
    ${buildTimeline()}
    <div class="tut-kbd-hint">
      <span>← →</span> navigate &nbsp;·&nbsp; <span>Esc</span> skip
    </div>
  `;

  const rect = step.highlight ? getHighlightRect(step.highlight) : null;
  updateHighlight(rect);

  requestAnimationFrame(() => {
    positionCard(card, rect, step.cardPos);
    requestAnimationFrame(() => {
      drawCallout(card, rect, step.cardPos);
    });
  });

  const prevBtn = overlay.querySelector('.tut-prev');
  const nextBtn = overlay.querySelector('.tut-next');
  prevBtn.disabled = currentStep === 0;
  nextBtn.textContent = currentStep === STEPS.length - 1 ? t('tut.finish') : t('tut.next');

  card.classList.remove('tut-card-enter');
  void card.offsetWidth;
  card.classList.add('tut-card-enter');
}

function closeTutorial() {
  if (!overlay) return;
  overlay.remove();
  overlay = null;
  calloutSvg = null;
  document.removeEventListener('keydown', onKey);
  window.removeEventListener('resize', onResize);
  markSeen();
}

function onKey(e) {
  if (!overlay) return;
  if (e.key === 'Escape') closeTutorial();
  if (e.key === 'ArrowRight' || e.key === 'Enter') goNext();
  if (e.key === 'ArrowLeft') goPrev();
}

function onResize() {
  if (overlay) renderStep();
}

function goNext() {
  if (currentStep < STEPS.length - 1) {
    currentStep++;
    renderStep();
  } else {
    closeTutorial();
  }
}

function goPrev() {
  if (currentStep > 0) {
    currentStep--;
    renderStep();
  }
}

function showLanguageSelection() {
  if (overlay) return;

  overlay = document.createElement('div');
  overlay.className = 'lang-overlay';
  overlay.innerHTML = `
    <div class="lang-card">
      <h1 class="lang-title">${t('lang.select.title')}</h1>
      <p class="lang-subtitle">${t('lang.select.subtitle')}</p>
      <div class="lang-options">
        <button class="lang-btn" data-lang="en">
          <span class="lang-flag">🇺🇸</span>
          <span class="lang-name">${t('lang.en')}</span>
        </button>
        <button class="lang-btn" data-lang="vi">
          <span class="lang-flag">🇻🇳</span>
          <span class="lang-name">${t('lang.vi')}</span>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const lang = btn.dataset.lang;
      setLang(lang);
      markLangSelected();
      overlay.remove();
      overlay = null;
      setTimeout(showTutorial, 300);
    });
  });
}

export function showTutorial() {
  if (overlay) return;

  overlay = document.createElement('div');
  overlay.className = 'tut-overlay';
  overlay.innerHTML = `
    <div class="tut-spotlight"></div>
    <svg class="tut-callout" style="display:none;"></svg>
    <div class="tut-card">
      <button class="tut-skip" aria-label="Skip tutorial">${t('tut.skip')}</button>
      <div class="tut-content"></div>
      <div class="tut-nav">
        <button class="tut-prev">${t('tut.prev')}</button>
        <button class="tut-next">${t('tut.next')}</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  calloutSvg = overlay.querySelector('.tut-callout');

  overlay.querySelector('.tut-skip').addEventListener('click', closeTutorial);
  overlay.querySelector('.tut-prev').addEventListener('click', goPrev);
  overlay.querySelector('.tut-next').addEventListener('click', goNext);

  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', onResize);
  currentStep = 0;
  renderStep();
}

export function initTutorial() {
  if (!hasSelectedLang()) {
    setTimeout(showLanguageSelection, 500);
  } else if (!hasSeenTutorial()) {
    setTimeout(showTutorial, 800);
  }
}
