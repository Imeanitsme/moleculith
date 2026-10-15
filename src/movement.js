import * as THREE from 'three';

// Camera movement: WASD/arrow keys and the touch joystick feed one shared
// motion state; update(dt) flies the camera together with its orbit target
// so OrbitControls rotation keeps working around the new viewpoint.
export function createMovement({ camera, controls }) {
  const SPEED = 6;      // world units per second
  const FAST = 2.25;    // Shift multiplier
  const Y_MIN = -1.4;
  const Y_MAX = 9;
  const R_MAX = 45;     // horizontal clamp for the orbit target

  const keys = new Set();
  const stick = { x: 0, y: 0 };
  let vertical = 0;

  const isTyping = () => {
    const a = document.activeElement;
    return a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement;
  };
  const HANDLED = new Set(['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']);

  window.addEventListener('keydown', e => {
    if (e.key === 'Shift') { keys.add('shift'); return; }
    if (isTyping()) return;
    const k = e.key.toLowerCase();
    if (!HANDLED.has(k)) return;
    e.preventDefault();
    keys.add(k);
  });
  window.addEventListener('keyup', e => {
    keys.delete(e.key.toLowerCase());
    if (e.key === 'Shift') keys.delete('shift');
  });
  window.addEventListener('blur', () => keys.clear());

  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();
  const move = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);

  function update(dt) {
    let x = stick.x, y = stick.y;
    let v = vertical;
    if (keys.has('w') || keys.has('arrowup')) y += 1;
    if (keys.has('s') || keys.has('arrowdown')) y -= 1;
    if (keys.has('a') || keys.has('arrowleft')) x -= 1;
    if (keys.has('d') || keys.has('arrowright')) x += 1;
    if (keys.has('e')) v += 1;
    if (keys.has('q')) v -= 1;
    if (!x && !y && !v) return false;

    camera.getWorldDirection(fwd);
    fwd.y = 0;
    if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1);
    fwd.normalize();
    right.crossVectors(fwd, UP); // fwd x up = screen right

    const speed = SPEED * (keys.has('shift') ? FAST : 1) * dt;
    move.set(0, 0, 0).addScaledVector(fwd, y).addScaledVector(right, x);
    move.y += v;
    if (move.lengthSq() === 0) return false;
    move.normalize().multiplyScalar(speed);

    controls.target.add(move);
    camera.position.add(move);
    controls.target.y = Math.max(Y_MIN, Math.min(Y_MAX, controls.target.y));
    const horiz = Math.hypot(controls.target.x, controls.target.z);
    if (horiz > R_MAX) {
      const s = R_MAX / horiz;
      controls.target.x *= s;
      controls.target.z *= s;
    }
    return true;
  }

  return {
    update,
    setStick: (x, y) => { stick.x = x; stick.y = y; },
    setVertical: v => { vertical = v; },
  };
}
