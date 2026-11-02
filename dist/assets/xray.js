// X-Ray Mode System - Standalone module
(function() {
  'use strict';

  let isXRayActive = false;

  function showStatus(msg) {
    const el = document.getElementById('status-text');
    if (el) { el.textContent = msg; el.className = 'info'; }
  }

  function applyXRayVisuals() {
    if (!window.__mol3d) return;
    const matM = window.__mol3d.atomMatM;
    const matN = window.__mol3d.atomMatN;
    if (!matM || !matN) return;

    matM.transparent = isXRayActive;
    matM.opacity = isXRayActive ? 0.4 : 1.0;
    matM.wireframe = isXRayActive;
    matN.transparent = isXRayActive;
    matN.opacity = isXRayActive ? 0.4 : 1.0;
    matN.wireframe = isXRayActive;
    matM.needsUpdate = true;
    matN.needsUpdate = true;

    if (window.__mol3d.invalidate) window.__mol3d.invalidate();
  }

  function toggleXRay() {
    isXRayActive = !isXRayActive;
    applyXRayVisuals();
    showStatus(isXRayActive ? 'X-Ray mode enabled' : 'X-Ray mode disabled');
    return isXRayActive;
  }

  function init() {
    const btn = document.getElementById('btn-xray');
    if (btn) {
      btn.addEventListener('click', function() {
        btn.classList.toggle('on', toggleXRay());
      });
    }

    window.addEventListener('keydown', function(e) {
      if ((e.key === 'x' || e.key === 'X') && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const tag = document.activeElement && document.activeElement.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && btn) {
          e.preventDefault();
          btn.click();
        }
      }
    });

    window.__xray = { toggle: toggleXRay, isActive: () => isXRayActive };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
