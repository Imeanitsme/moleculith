// X-Ray Mode System - Standalone module
(function() {
  'use strict';

  let isXRayActive = false;

  function toggleXRay() {
    isXRayActive = !isXRayActive;
    applyXRayVisuals();
    showStatus(isXRayActive ? 'X-Ray mode enabled' : 'X-Ray mode disabled');
    return isXRayActive;
  }

  function applyXRayVisuals() {
    if (!window.__mol3d) return;

    const atomMatM = window.__mol3d.atomMatM;
    const atomMatN = window.__mol3d.atomMatN;

    if (!atomMatM || !atomMatN) {
      console.warn('[X-Ray] Materials not found on __mol3d');
      return;
    }

    if (isXRayActive) {
      atomMatM.transparent = true;
      atomMatM.opacity = 0.4;
      atomMatM.wireframe = true;
      atomMatN.transparent = true;
      atomMatN.opacity = 0.4;
      atomMatN.wireframe = true;
    } else {
      atomMatM.transparent = false;
      atomMatM.opacity = 1.0;
      atomMatM.wireframe = false;
      atomMatN.transparent = false;
      atomMatN.opacity = 1.0;
      atomMatN.wireframe = false;
    }

    atomMatM.needsUpdate = true;
    atomMatN.needsUpdate = true;

    if (window.__mol3d.invalidate) {
      window.__mol3d.invalidate();
    }
  }

  function showStatus(msg) {
    const statusEl = document.getElementById('status-text');
    if (statusEl) {
      statusEl.textContent = msg;
      statusEl.className = 'info';
    }
  }

  function init() {
    const btn = document.getElementById('btn-xray');
    if (btn) {
      btn.addEventListener('click', function() {
        const active = toggleXRay();
        btn.classList.toggle('on', active);
      });
    }

    window.addEventListener('keydown', function(e) {
      if (e.key === 'x' || e.key === 'X') {
        if (!e.ctrlKey && !e.altKey && !e.metaKey) {
          const activeEl = document.activeElement;
          const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
          if (!isInput && btn) {
            e.preventDefault();
            btn.click();
          }
        }
      }
    });

    window.__xray = {
      toggle: toggleXRay,
      isActive: () => isXRayActive
    };

    console.log('[X-Ray] Module initialized');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
