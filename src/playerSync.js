// Player synchronization with dead reckoning and interpolation
import * as THREE from 'three';
import { network, MSG } from './networking.js';

const INTERPOLATION_DELAY = 100; // ms - buffer for smooth interpolation
const INTERPOLATION_DURATION = 100; // ms - time to interpolate between positions

class RemotePlayer {
  constructor(peerId, playerData) {
    this.peerId = peerId;
    this.username = playerData.username || 'Player';
    this.isDead = false;
    
    // Current interpolated position/rotation
    this.position = new THREE.Vector3(0, 2, 0);
    this.rotation = 0;
    this.velocity = new THREE.Vector3(0, 0, 0);
    
    // Target position/rotation for interpolation
    this.targetPosition = new THREE.Vector3(0, 2, 0);
    this.targetRotation = 0;
    this.targetVelocity = new THREE.Vector3(0, 0, 0);
    
    // Interpolation timing
    this.lastUpdateTime = Date.now();
    this.interpolationStartTime = Date.now();
    
    // Position history for interpolation buffer
    this.positionBuffer = [];
    this.maxBufferSize = 20;
    
    // 3D mesh
    this.mesh = this.createMesh();
  }
  
  createMesh() {
    const group = new THREE.Group();
    
    // Body (capsule)
    const bodyGeometry = new THREE.CapsuleGeometry(0.3, 0.8, 4, 8);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x667eea,
      metalness: 0.3,
      roughness: 0.7,
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.7;
    group.add(body);
    
    // Head (sphere)
    const headGeometry = new THREE.SphereGeometry(0.25, 16, 16);
    const headMaterial = new THREE.MeshStandardMaterial({
      color: 0xffdbac,
      metalness: 0.1,
      roughness: 0.8,
    });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 1.5;
    group.add(head);
    
    // Username label (sprite)
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.font = 'bold 32px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.username, canvas.width / 2, canvas.height / 2);
    
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.y = 2.2;
    sprite.scale.set(1.5, 0.4, 1);
    group.add(sprite);
    
    group.position.copy(this.position);
    
    return group;
  }
  
  // Add position to buffer for interpolation
  addPosition(x, y, z, vx, vy, vz, rot, timestamp) {
    this.positionBuffer.push({
      position: new THREE.Vector3(x, y, z),
      velocity: new THREE.Vector3(vx, vy, vz),
      rotation: rot,
      timestamp: timestamp,
    });
    
    // Keep buffer size limited
    if (this.positionBuffer.length > this.maxBufferSize) {
      this.positionBuffer.shift();
    }
  }
  
  // Update interpolation target based on buffer
  update(now) {
    // Find the position we should be rendering at (with delay for smooth interpolation)
    const renderTime = now - INTERPOLATION_DELAY;
    
    // Find two positions to interpolate between
    let from = null;
    let to = null;
    
    for (let i = 0; i < this.positionBuffer.length - 1; i++) {
      const curr = this.positionBuffer[i];
      const next = this.positionBuffer[i + 1];
      
      if (curr.timestamp <= renderTime && next.timestamp >= renderTime) {
        from = curr;
        to = next;
        break;
      }
    }
    
    // If we don't have enough data, use the latest position
    if (!from || !to) {
      if (this.positionBuffer.length > 0) {
        const latest = this.positionBuffer[this.positionBuffer.length - 1];
        this.targetPosition.copy(latest.position);
        this.targetRotation = latest.rotation;
        this.targetVelocity.copy(latest.velocity);
      }
    } else {
      // Interpolate between from and to
      const t = (renderTime - from.timestamp) / (to.timestamp - from.timestamp);
      
      this.targetPosition.lerpVectors(from.position, to.position, t);
      this.targetVelocity.lerpVectors(from.velocity, to.velocity, t);
      
      // Handle rotation interpolation (shortest path)
      let rotDiff = to.rotation - from.rotation;
      while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
      while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
      this.targetRotation = from.rotation + rotDiff * t;
    }
    
    // Smoothly interpolate current position toward target
    const lerpFactor = 0.2; // Smoothing factor
    this.position.lerp(this.targetPosition, lerpFactor);
    
    // Smooth rotation interpolation
    let rotDiff = this.targetRotation - this.rotation;
    while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
    while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
    this.rotation += rotDiff * lerpFactor;
    
    // Apply dead reckoning (predict position based on velocity)
    const dt = (now - this.lastUpdateTime) / 1000;
    this.position.x += this.targetVelocity.x * dt * 0.5; // 50% prediction to avoid overshooting
    this.position.y += this.targetVelocity.y * dt * 0.5;
    this.position.z += this.targetVelocity.z * dt * 0.5;
    
    this.lastUpdateTime = now;
    
    // Update mesh
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.rotation;
  }
  
  updateVisuals() {
    // Update appearance based on death state
    this.mesh.traverse((child) => {
      if (child.isMesh && child.geometry.type === 'CapsuleGeometry') {
        // Body - turn gray when dead
        child.material.color.setHex(this.isDead ? 0x555555 : 0x667eea);
        child.material.opacity = this.isDead ? 0.5 : 1.0;
        child.material.transparent = this.isDead;
      }
    });
    
    // Rotate mesh to lie flat when dead
    if (this.isDead) {
      this.mesh.rotation.x = Math.PI / 2;
      this.mesh.position.y = 0.3;
    } else {
      this.mesh.rotation.x = 0;
      this.mesh.position.y = this.position.y;
    }
  }
  
  dispose() {
    // Clean up Three.js objects
    this.mesh.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (child.material.map) child.material.map.dispose();
        child.material.dispose();
      }
    });
  }
}

class PlayerSync {
  constructor() {
    this.remotePlayers = new Map(); // peerId -> RemotePlayer
    this.localPlayer = null;
    this.scene = null;
    this.enabled = false;
  }
  
  init(scene) {
    this.scene = scene;
    this.enabled = true;
    
    // Setup network event handlers
    network.onMessage = (peerId, msgType, data) => {
      if (msgType === MSG.MOVE) {
        this.handlePositionUpdate(peerId, data);
      }
    };
    
    network.onPlayerJoin = (peerId, playerData) => {
      this.addRemotePlayer(peerId, playerData);
    };
    
    network.onPlayerLeave = (peerId) => {
      this.removeRemotePlayer(peerId);
    };
  }
  
  // Add a remote player
  addRemotePlayer(peerId, playerData) {
    if (this.remotePlayers.has(peerId)) return;
    
    const player = new RemotePlayer(peerId, playerData);
    this.remotePlayers.set(peerId, player);
    
    if (this.scene) {
      this.scene.add(player.mesh);
    }
    
    console.log('[PlayerSync] Added remote player:', peerId);
  }
  
  // Remove a remote player
  removeRemotePlayer(peerId) {
    const player = this.remotePlayers.get(peerId);
    if (!player) return;
    
    if (this.scene) {
      this.scene.remove(player.mesh);
    }
    
    player.dispose();
    this.remotePlayers.delete(peerId);
    
    console.log('[PlayerSync] Removed remote player:', peerId);
  }
  
  // Handle incoming position update
  handlePositionUpdate(peerId, data) {
    const player = this.remotePlayers.get(peerId);
    if (!player) return;
    
    // data format: [x, y, z, vx, vy, vz, rot] or {playerId, username, message, timestamp}
    if (Array.isArray(data)) {
      const [x, y, z, vx, vy, vz, rot] = data;
      player.addPosition(x, y, z, vx, vy, vz, rot, Date.now());
    }
  }
  
  // Update local player position (called from game loop)
  updateLocalPlayer(position, rotation, velocity) {
    if (!this.enabled) return;
    
    // Send position update to network
    network.sendPositionUpdate(position, rotation, velocity);
  }
  
  // Update all remote players (called from render loop)
  update(now) {
    if (!this.enabled) return;
    
    for (const player of this.remotePlayers.values()) {
      player.update(now);
    }
  }
  
  // Get remote player count
  getPlayerCount() {
    return this.remotePlayers.size;
  }
  
  // Cleanup
  dispose() {
    for (const player of this.remotePlayers.values()) {
      if (this.scene) {
        this.scene.remove(player.mesh);
      }
      player.dispose();
    }
    this.remotePlayers.clear();
    this.enabled = false;
  }
}

export const playerSync = new PlayerSync();
