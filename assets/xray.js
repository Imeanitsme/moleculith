// X-Ray Mode - makes all atoms transparent/wireframe
(function() {
  'use strict';
  var active = false;
  function showStatus(msg) {
    var el = document.getElementById('status-text');
    if (el) { el.textContent = msg; el.className = 'info'; }
  }
  function apply() {
    if (!window.__mol3d || !window.__mol3d.scene) return;
    window.__mol3d.scene.traverse(function(obj) {
      if (obj.isMesh && obj.material) {
        var mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach(function(m) {
          m.transparent = active;
          m.opacity = active ? 0.3 : 1.0;
          m.wireframe = active;
          m.needsUpdate = true;
        });
      }
    });
    if (window.__mol3d.renderer && window.__mol3d.camera) {
      window.__mol3d.renderer.render(window.__mol3d.scene, window.__mol3d.camera);
    }
  }
  function toggle() {
    active = !active;
    apply();
    showStatus(active ? 'X-Ray mode ON' : 'X-Ray mode OFF');
    return active;
  }
  function init() {
    var btn = document.getElementById('btn-xray');
    if (btn) btn.addEventListener('click', function() { btn.classList.toggle('on', toggle()); });
    window.addEventListener('keydown', function(e) {
      if ((e.key === 'x' || e.key === 'X') && !e.ctrlKey && !e.altKey && !e.metaKey) {
        var tag = document.activeElement && document.activeElement.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && btn) { e.preventDefault(); btn.click(); }
      }
    });
    window.__xray = { toggle: toggle, isActive: function() { return active; } };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
