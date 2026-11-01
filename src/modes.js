// Mode chooser - handles main menu and settings
import '../style.css';
import { t, setLang } from './i18n.js';

function showModal(modalId) {
  const el = document.getElementById(modalId);
  el.hidden = false;
  el.style.display = '';
}

function hideModal(modalId) {
  const el = document.getElementById(modalId);
  el.hidden = true;
  el.style.display = 'none';
}

function updateSettingsDisplay() {
  const themeBtn = document.getElementById('settings-theme');
  const langBtn = document.getElementById('settings-lang');
  const qualityBtn = document.getElementById('settings-quality');
  const volumeSlider = document.getElementById('settings-volume-slider');
  
  if (themeBtn) {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    themeBtn.querySelector('span').textContent = `Theme: ${currentTheme === 'dark' ? 'Dark' : 'Light'}`;
  }
  
  if (langBtn) {
    const currentLang = localStorage.getItem('lang') || 'en';
    langBtn.querySelector('span').textContent = `Language: ${currentLang.toUpperCase()}`;
  }
  
  if (qualityBtn) {
    const currentQuality = localStorage.getItem('quality') || 'auto';
    qualityBtn.querySelector('span').textContent = `Quality: ${currentQuality.charAt(0).toUpperCase() + currentQuality.slice(1)}`;
  }
  
  if (volumeSlider) {
    const volume = localStorage.getItem('volume') || '50';
    volumeSlider.value = volume;
  }
}

function init() {
  // Singleplayer button
  document.getElementById('btn-singleplayer').addEventListener('click', () => {
    window.location.href = 'game.html?mode=singleplayer';
  });
  
  // Multiplayer button
  document.getElementById('btn-multiplayer').addEventListener('click', () => {
    window.location.href = 'game.html?mode=multiplayer';
  });
  
  // Settings button
  document.getElementById('btn-settings').addEventListener('click', () => {
    showModal('settings-modal');
    updateSettingsDisplay();
  });
  
  // Settings modal buttons
  document.getElementById('settings-back').addEventListener('click', () => {
    hideModal('settings-modal');
  });
  
  document.getElementById('settings-theme').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    updateSettingsDisplay();
  });
  
  document.getElementById('settings-lang').addEventListener('click', () => {
    const current = localStorage.getItem('lang') || 'en';
    const next = current === 'en' ? 'vi' : 'en';
    localStorage.setItem('lang', next);
    setLang(next);
    updateSettingsDisplay();
  });
  
  document.getElementById('settings-quality').addEventListener('click', () => {
    const qualities = ['auto', 'low', 'medium', 'high'];
    const current = localStorage.getItem('quality') || 'auto';
    const idx = qualities.indexOf(current);
    const next = qualities[(idx + 1) % qualities.length];
    localStorage.setItem('quality', next);
    updateSettingsDisplay();
  });
  
  document.getElementById('settings-volume-slider').addEventListener('input', (e) => {
    localStorage.setItem('volume', e.target.value);
  });
  
  // Modal close buttons
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      hideModal(btn.dataset.close);
    });
  });
  
  // Apply saved theme
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
  }
  
  // Apply saved language
  const savedLang = localStorage.getItem('lang');
  if (savedLang) {
    setLang(savedLang);
  }
}

init();
