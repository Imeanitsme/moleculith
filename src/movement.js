import * as THREE from 'three';

// Survival: first-person camera with direct pitch/yaw control, ground-walk + jump.
// Creative: free-fly with OrbitControls.
export function createMovement({ camera, controls, getGameMode, isPlayerDead }) {
  const SPEED = 6;
  const FAST = 2.25;
  const R_MAX = 45;
  const GROUND_Y = 0;
  const EYE_HEIGHT = 1.8;
  const JUMP_VELOCITY = 6;
  const GRAVITY = 15;
  const MOUSE_SENSITIVITY = 0.003;
  const PITCH_LIMIT = Math.PI * 0.45; // ~81 degrees up/down

  const keys = new Set();
  const stick = { x: 0, y: 0 };
  let vertical = 0;
  
  // Player position (independent of OrbitControls)
  const playerPos = new THREE.Vector3(0, GROUND_Y, 0);
  let velocityY = 0;
  let isGrounded = true;
  
  // Camera orientation for survival mode
  let yaw = 0;
  let pitch = 0;
  let pointerLocked = false;

  const isTyping = () => {
    const a = document.activeElement;
    return a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement;
  };
  const HANDLED = new Set(['w', 'a', 's', 'd', 'q', 'e', ' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']);

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

  // Mouse drag look for survival mode (no pointer lock)
  let isCameraDragging = false;
  let lastMouseX = 0;
  let lastMouseY = 0;
  const CAMERA_DRAG_SENSITIVITY = 0.005;

  function initMouseLook(element, shouldStartDrag = () => true) {
    element.addEventListener('mousedown', e => {
      if (!isSurvival() || e.button !== 0) return;
      // Only start camera drag if callback allows it (e.g., no atom being dragged)
      if (!shouldStartDrag()) return;
      const rect = element.getBoundingClientRect();
      const x = e.clientX - rect.left;
      // Use right side of screen for camera drag
      if (x > rect.width * 0.3) {
        isCameraDragging = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
      }
    });

    document.addEventListener('mousemove', e => {
      if (!isCameraDragging || !isSurvival()) return;
      const dx = e.clientX - lastMouseX;
      const dy = e.clientY - lastMouseY;
      yaw -= dx * CAMERA_DRAG_SENSITIVITY;
      pitch -= dy * CAMERA_DRAG_SENSITIVITY;
      pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    });

    const endDrag = () => { isCameraDragging = false; };
    document.addEventListener('mouseup', endDrag);
    document.addEventListener('mouseleave', endDrag);
  }

  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();
  const move = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);

  function isSurvival() {
    return (typeof getGameMode === 'function' ? getGameMode() : 'creative') === 'survival';
  }

  function update(dt) {
    // Block all movement when player is dead
    if (isPlayerDead && isPlayerDead()) return false;
    
    const survival = isSurvival();
    let x = stick.x, y = stick.y;
    let v = vertical;
    if (keys.has('w') || keys.has('arrowup')) y += 1;
    if (keys.has('s') || keys.has('arrowdown')) y -= 1;
    if (keys.has('a') || keys.has('arrowleft')) x -= 1;
    if (keys.has('d') || keys.has('arrowright')) x += 1;
    if (!survival) {
      if (keys.has('e')) v += 1;
      if (keys.has('q')) v -= 1;
    }

    // Jump (space) — survival only
    if (survival && keys.has(' ') && isGrounded) {
      velocityY = JUMP_VELOCITY;
      isGrounded = false;
      keys.delete(' ');
    }

    if (!x && !y && !v && !(survival && !isGrounded)) {
      if (survival) {
        updateSurvivalCamera();
        // Always render in survival mode (camera might have changed from mouse/touch look)
        return isCameraDragging || lookTouchId !== null;
      }
      return false;
    }

    const speed = SPEED * (keys.has('shift') ? FAST : 1) * dt;

    if (survival) {
      // Gravity
      velocityY -= GRAVITY * dt;
      playerPos.y += velocityY * dt;
      if (playerPos.y <= GROUND_Y) {
        playerPos.y = GROUND_Y;
        velocityY = 0;
        isGrounded = true;
      }

      // Movement direction based on yaw
      fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw));
      right.set(Math.cos(yaw), 0, -Math.sin(yaw));
      
      move.set(0, 0, 0).addScaledVector(fwd, y).addScaledVector(right, x);
      if (move.lengthSq() > 0) {
        move.normalize().multiplyScalar(speed);
        playerPos.x += move.x;
        playerPos.z += move.z;
      }
      
      // Clamp to world bounds
      const horiz = Math.hypot(playerPos.x, playerPos.z);
      if (horiz > R_MAX) {
        const s = R_MAX / horiz;
        playerPos.x *= s;
        playerPos.z *= s;
      }
      
      updateSurvivalCamera();
    } else {
      camera.getWorldDirection(fwd);
      fwd.y = 0;
      if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1);
      fwd.normalize();
      right.crossVectors(fwd, UP);

      move.set(0, 0, 0).addScaledVector(fwd, y).addScaledVector(right, x);
      move.y += v;
      if (move.lengthSq() === 0) return false;
      move.normalize().multiplyScalar(speed);
      controls.target.add(move);
      camera.position.add(move);
      controls.target.y = Math.max(-1.4, Math.min(9, controls.target.y));
    }
    return true;
  }

  function updateSurvivalCamera() {
    // Position camera at player's eye location
    camera.position.set(playerPos.x, playerPos.y + EYE_HEIGHT, playerPos.z);
    
    // Apply yaw and pitch rotation using quaternion
    const quaternion = new THREE.Quaternion();
    const euler = new THREE.Euler(pitch, yaw, 0, 'YXZ');
    quaternion.setFromEuler(euler);
    camera.quaternion.copy(quaternion);
  }

  // Touch-based look for mobile (survival mode)
  let lookTouchId = null;
  let lastTouchX = 0;
  let lastTouchY = 0;
  const TOUCH_LOOK_SENSITIVITY = 0.005;

  function initTouchLook(element) {
    element.addEventListener('touchstart', e => {
      if (!isSurvival()) return;
      for (const touch of e.changedTouches) {
        const rect = element.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        if (x > rect.width * 0.4 && lookTouchId === null) {
          lookTouchId = touch.identifier;
          lastTouchX = touch.clientX;
          lastTouchY = touch.clientY;
          break;
        }
      }
    }, { passive: true });

    element.addEventListener('touchmove', e => {
      if (!isSurvival() || lookTouchId === null) return;
      for (const touch of e.changedTouches) {
        if (touch.identifier === lookTouchId) {
          const dx = touch.clientX - lastTouchX;
          const dy = touch.clientY - lastTouchY;
          yaw -= dx * TOUCH_LOOK_SENSITIVITY;
          pitch -= dy * TOUCH_LOOK_SENSITIVITY;
          pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));
          lastTouchX = touch.clientX;
          lastTouchY = touch.clientY;
          break;
        }
      }
    }, { passive: true });

    const touchEnd = e => {
      for (const touch of e.changedTouches) {
        if (touch.identifier === lookTouchId) {
          lookTouchId = null;
          break;
        }
      }
    };
    element.addEventListener('touchend', touchEnd, { passive: true });
    element.addEventListener('touchcancel', touchEnd, { passive: true });
  }

  return {
    update,
    setStick: (x, y) => { stick.x = x; stick.y = y; },
    setVertical: v => { vertical = v; },
    jump: () => { if (isGrounded && isSurvival()) { velocityY = JUMP_VELOCITY; isGrounded = false; } },
    getPlayerY: () => playerPos.y,
    getPlayerPos: () => playerPos.clone(),
    isGrounded: () => isGrounded,
    initMouseLook,
    initTouchLook,
    getYaw: () => yaw,
    setYaw: (y) => { yaw = y; },
    addYaw: (dy) => { yaw += dy; },
    addPitch: (dp) => { 
      pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch + dp)); 
    },
  };
}
