// Multiplayer networking using PeerJS (WebRTC)
// PeerJS loaded via CDN in index.html

// Message types for network protocol
export const MSG = {
  MOVE: 0,
  CHAT: 1,
  JOIN: 2,
  LEAVE: 3,
  VOICE: 4,
  SYNC: 5,
  ROOM_INFO: 6,
  TIME_FREEZE: 7,
  TIME_RESUME: 8,
  TIME_SPEED: 9,
  PLAYER_DEAD: 10,
  PLAYER_REVIVE: 11,
  ATOM_MOVE: 12,
  BOND_ADD: 13,
  BOND_REMOVE: 14,
  CHARGE_SET: 15,
  ATOM_ADD: 16,
  ATOM_REMOVE: 17,
  REACTION: 18,
  WORLD_SYNC: 19,
};

const SEND_INTERVAL = 50; // ms (20 updates/sec)
const HEARTBEAT_INTERVAL = 2000; // ms
const MOVE_THRESHOLD = 0.05; // units
const ROTATION_THRESHOLD = 0.1; // radians

class NetworkManager {
  constructor() {
    this.peer = null;
    this.connections = new Map(); // peerId -> DataConnection
    this.mediaConnections = new Map(); // peerId -> MediaConnection
    this.localStreams = new Map(); // peerId -> MediaStream (remote audio)
    this.localStream = null; // local microphone stream
    this.playerId = null;
    this.roomId = null;
    this.isHost = false;
    this.players = new Map(); // peerId -> player data
    this.lastSendTime = 0;
    this.lastHeartbeat = 0;
    this.lastPos = { x: 0, y: 0, z: 0 };
    this.lastRot = 0;
    this.voiceEnabled = false;
    this.muted = true;
    this.onMessage = null;
    this.onPlayerJoin = null;
    this.onPlayerLeave = null;
    this.onVoiceStream = null;
  }

  // Generate a unique player ID
  generatePlayerId() {
    return 'player_' + Math.random().toString(36).substr(2, 9);
  }

  // Generate a room code
  generateRoomCode() {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
  }

  // Initialize PeerJS
  async init(customId = null) {
    if (!window.Peer) {
      console.error('[Network] PeerJS not loaded');
      throw new Error('PeerJS library not available. Please refresh the page.');
    }
    
    return new Promise((resolve, reject) => {
      const peerId = customId || this.generatePlayerId();
      
      console.log('[Network] Initializing PeerJS with ID:', peerId);
      
      try {
        // Use default PeerJS cloud server configuration
        this.peer = new window.Peer(peerId);
      } catch (e) {
        console.error('[Network] Failed to create Peer:', e);
        reject(e);
        return;
      }

      const timeout = setTimeout(() => {
        if (this.peer) { try { this.peer.destroy(); } catch(e) {} }
        this.peer = null;
        reject(new Error('Connection timeout - PeerJS server not responding.'));
      }, 15000);

      this.peer.on('open', (id) => {
        clearTimeout(timeout);
        console.log('[Network] Peer opened with ID:', id);
        this.playerId = id;
        
        this.peer.on('connection', (conn) => this.handleConnection(conn));
        this.peer.on('call', (call) => this.handleCall(call));
        
        this.peer.on('error', (err) => {
          console.error('[Network] Peer error:', err.type, err.message);
          if (err.type === 'unavailable-id') {
            const newId = this.generatePlayerId();
            if (this.peer) { try { this.peer.destroy(); } catch(e) {} }
            this.peer = null;
            this.init(newId).then(resolve).catch(reject);
          }
        });
        
        this.peer.on('disconnected', () => {
          console.warn('[Network] Disconnected, reconnecting...');
          try { this.peer.reconnect(); } catch(e) {}
        });

        resolve(id);
      });

      this.peer.on('error', (err) => {
        clearTimeout(timeout);
        console.error('[Network] Init error:', err.type, err.message);
        if (this.peer) { try { this.peer.destroy(); } catch(e) {} }
        this.peer = null;
        
        if (err.type === 'unavailable-id') {
          this.init(this.generatePlayerId()).then(resolve).catch(reject);
        } else {
          reject(err);
        }
      });
    });
  }

  // Host a new room
  async hostRoom(roomCode, password = null) {
    this.roomId = roomCode || this.generateRoomCode();
    this.isHost = true;
    
    // Use room code as peer ID prefix for easy discovery
    const hostId = `room_${this.roomId}_host`;
    
    // Destroy existing peer if any
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    
    console.log('[Network] Creating host peer with ID:', hostId);
    
    try {
      await this.init(hostId);
      console.log('[Network] Hosting room:', this.roomId, 'with host ID:', hostId);
      
      return {
        roomId: this.roomId,
        hostId: hostId,
        password: password,
      };
    } catch (err) {
      throw new Error('Failed to create room: ' + err.message);
    }
  }

  // Join an existing room
  async joinRoom(roomCode, password = null) {
    // Always ensure peer is initialized
    if (!this.peer || this.peer.destroyed) {
      try {
        await this.init();
      } catch (err) {
        throw new Error('Failed to initialize network: ' + err.message);
      }
    }
    
    this.roomId = roomCode;
    this.isHost = false;
    
    const hostId = `room_${roomCode}_host`;
    
    // Retry logic for connection
    const maxRetries = 3;
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Check peer is still valid before each attempt
        if (!this.peer || this.peer.destroyed) {
          console.warn('[Network] Peer is null or destroyed, reinitializing...');
          await this.init();
        }
        
        console.log(`[Network] Attempt ${attempt}/${maxRetries} to connect to host:`, hostId);
        
        const conn = await this.connectToHost(hostId, roomCode, password);
        return conn;
      } catch (err) {
        lastError = err;
        console.warn(`[Network] Attempt ${attempt} failed:`, err.message);
        
        if (attempt < maxRetries) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    throw lastError || new Error('Failed to connect after multiple attempts');
  }
  
  // Helper method to connect to host
  connectToHost(hostId, roomCode, password) {
    return new Promise((resolve, reject) => {
      // Safety check
      if (!this.peer || this.peer.destroyed) {
        reject(new Error('Peer is not initialized'));
        return;
      }
      
      const conn = this.peer.connect(hostId, { 
        reliable: true,
        serialization: 'json'
      });
      
      const timeout = setTimeout(() => {
        if (!conn.open) {
          conn.close();
          reject(new Error(`Connection timeout - Room "${roomCode}" not found or host is offline. Please verify the room code and try again.`));
        }
      }, 15000);
      
      conn.on('open', () => {
        clearTimeout(timeout);
        console.log('[Network] Connected to room:', roomCode);
        this.connections.set(hostId, conn);
        
        // Send join message with player info
        this.sendMessage(hostId, MSG.JOIN, {
          playerId: this.playerId,
          username: 'Player',
          password: password,
        });
        
        this.setupConnectionHandlers(conn, hostId);
        resolve(conn);
      });
      
      conn.on('error', (err) => {
        clearTimeout(timeout);
        console.error('[Network] Join error:', err);
        reject(new Error('Connection failed: ' + err.message));
      });
      
      conn.on('close', () => {
        clearTimeout(timeout);
        if (!conn.open) {
          reject(new Error('Connection closed by host'));
        }
      });
    });
  }

  // Handle incoming connection
  handleConnection(conn) {
    const peerId = conn.peer;
    console.log('[Network] Incoming connection from:', peerId);
    
    this.connections.set(peerId, conn);
    this.setupConnectionHandlers(conn, peerId);
  }

  // Setup connection event handlers
  setupConnectionHandlers(conn, peerId) {
    conn.on('data', (data) => {
      this.handleData(peerId, data);
    });
    
    conn.on('close', () => {
      console.log('[Network] Connection closed:', peerId);
      this.connections.delete(peerId);
      this.players.delete(peerId);
      
      if (this.onPlayerLeave) {
        this.onPlayerLeave(peerId);
      }
    });
    
    conn.on('error', (err) => {
      console.error('[Network] Connection error:', peerId, err);
    });
  }

  // Handle incoming data
  handleData(peerId, data) {
    if (!Array.isArray(data) || data.length < 2) return;
    
    const [msgType, ...payload] = data;
    
    switch (msgType) {
      case MSG.JOIN:
        this.handleJoin(peerId, payload[0]);
        break;
      case MSG.LEAVE:
        this.handleLeave(peerId);
        break;
      case MSG.MOVE:
        this.handleMove(peerId, payload);
        break;
      case MSG.CHAT:
        this.handleChat(peerId, payload[0]);
        break;
      case MSG.ROOM_INFO:
        this.handleRoomInfo(peerId, payload[0]);
        break;
      case MSG.SYNC:
        this.handleSync(peerId, payload[0]);
        break;
      case MSG.TIME_FREEZE:
      case MSG.TIME_RESUME:
      case MSG.TIME_SPEED:
        // Pass through to onMessage callback for game-specific handling
        break;
    }
    
    if (this.onMessage) {
      this.onMessage(peerId, msgType, payload);
    }
  }

  // Handle player join
  handleJoin(peerId, data) {
    console.log('[Network] Player joined:', peerId, data);
    
    this.players.set(peerId, {
      id: peerId,
      playerId: data.playerId,
      position: { x: 0, y: 0, z: 0 },
      rotation: 0,
      velocity: { x: 0, y: 0, z: 0 },
      username: data.username || 'Player',
    });
    
    // If host, send room info and broadcast to other players
    if (this.isHost) {
      this.sendMessage(peerId, MSG.ROOM_INFO, {
        roomId: this.roomId,
        players: Array.from(this.players.values()),
      });
      
      // Broadcast new player to others
      this.broadcast(peerId, MSG.JOIN, {
        playerId: peerId,
        player: this.players.get(peerId),
      });
    }
    
    if (this.onPlayerJoin) {
      this.onPlayerJoin(peerId, this.players.get(peerId));
    }
  }

  // Handle player leave
  handleLeave(peerId) {
    console.log('[Network] Player left:', peerId);
    this.players.delete(peerId);
    
    if (this.isHost) {
      this.broadcast(peerId, MSG.LEAVE, { playerId: peerId });
    }
    
    if (this.onPlayerLeave) {
      this.onPlayerLeave(peerId);
    }
  }

  // Handle position update
  handleMove(peerId, data) {
    const [x, y, z, vx, vy, vz, rot] = data;
    const player = this.players.get(peerId);
    
    if (player) {
      player.position = { x, y, z };
      player.velocity = { x: vx, y: vy, z: vz };
      player.rotation = rot;
      
      // If host, broadcast to other players
      if (this.isHost) {
        this.broadcast(peerId, MSG.MOVE, data);
      }
    }
  }

  // Handle chat message
  handleChat(peerId, message) {
    const player = this.players.get(peerId);
    
    if (this.isHost) {
      this.broadcast(peerId, MSG.CHAT, {
        playerId: peerId,
        username: player?.username || 'Player',
        message: message,
        timestamp: Date.now(),
      });
    }
    
    if (this.onMessage) {
      this.onMessage(peerId, MSG.CHAT, {
        playerId: peerId,
        username: player?.username || 'Player',
        message: message,
        timestamp: Date.now(),
      });
    }
  }

  // Handle room info (client receives this)
  handleRoomInfo(peerId, data) {
    console.log('[Network] Room info received:', data);
    
    // Update players list
    for (const player of data.players) {
      if (player.id !== this.playerId) {
        this.players.set(player.id, player);
        
        if (this.onPlayerJoin) {
          this.onPlayerJoin(player.id, player);
        }
      }
    }
  }

  // Handle sync message
  handleSync(peerId, data) {
    // Sync full game state (atoms, bonds, etc.)
    if (this.onMessage) {
      this.onMessage(peerId, MSG.SYNC, data);
    }
  }

  // Handle incoming voice call
  handleCall(call) {
    console.log('[Network] Incoming call from:', call.peer);
    
    call.answer(this.localStream);
    
    call.on('stream', (remoteStream) => {
      console.log('[Network] Received voice stream from:', call.peer);
      this.localStreams.set(call.peer, remoteStream);
      
      if (this.onVoiceStream) {
        this.onVoiceStream(call.peer, remoteStream);
      }
    });
    
    call.on('close', () => {
      this.localStreams.delete(call.peer);
    });
    
    this.mediaConnections.set(call.peer, call);
  }

  // Send message to specific peer
  sendMessage(peerId, msgType, data) {
    const conn = this.connections.get(peerId);
    if (conn && conn.open) {
      conn.send([msgType, data]);
    }
  }

  // Broadcast message to all peers except sender
  broadcast(exceptPeerId, msgType, data) {
    for (const [peerId, conn] of this.connections) {
      if (peerId !== exceptPeerId && conn.open) {
        conn.send([msgType, data]);
      }
    }
  }

  // Send position update (with rate limiting and threshold)
  sendPositionUpdate(position, rotation, velocity) {
    const now = Date.now();
    
    // Check time interval
    if (now - this.lastSendTime < SEND_INTERVAL) return;
    
    // Check movement threshold
    const dx = position.x - this.lastPos.x;
    const dy = position.y - this.lastPos.y;
    const dz = position.z - this.lastPos.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    const rotDiff = Math.abs(rotation - this.lastRot);
    
    // Check heartbeat
    const isHeartbeat = now - this.lastHeartbeat >= HEARTBEAT_INTERVAL;
    
    if (dist < MOVE_THRESHOLD && rotDiff < ROTATION_THRESHOLD && !isHeartbeat) {
      return;
    }
    
    // Send compact position packet
    const packet = [
      MSG.MOVE,
      position.x,
      position.y,
      position.z,
      velocity.x,
      velocity.y,
      velocity.z,
      rotation,
    ];
    
    if (this.isHost) {
      this.broadcast(null, MSG.MOVE, packet);
    } else {
      for (const [peerId, conn] of this.connections) {
        if (conn.open) {
          conn.send(packet);
        }
      }
    }
    
    this.lastSendTime = now;
    this.lastPos = { ...position };
    this.lastRot = rotation;
    
    if (isHeartbeat) {
      this.lastHeartbeat = now;
    }
  }

  // Send chat message
  sendChat(message) {
    if (this.isHost) {
      this.broadcast(null, MSG.CHAT, {
        playerId: this.playerId,
        username: 'You',
        message: message,
        timestamp: Date.now(),
      });
    } else {
      for (const [peerId, conn] of this.connections) {
        if (conn.open) {
          conn.send([MSG.CHAT, message]);
        }
      }
    }
  }

  // Enable/disable voice chat
  async setVoiceEnabled(enabled) {
    this.voiceEnabled = enabled;
    
    if (enabled && !this.localStream) {
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('[Network] Microphone access granted');
        
        // Call all connected peers
        for (const [peerId, conn] of this.connections) {
          if (conn.open) {
            const call = this.peer.call(peerId, this.localStream);
            this.mediaConnections.set(peerId, call);
            
            call.on('stream', (remoteStream) => {
              this.localStreams.set(peerId, remoteStream);
              if (this.onVoiceStream) {
                this.onVoiceStream(peerId, remoteStream);
              }
            });
          }
        }
      } catch (err) {
        console.error('[Network] Microphone access denied:', err);
        this.voiceEnabled = false;
      }
    }
  }

  // Toggle mute
  setMuted(muted) {
    this.muted = muted;
    
    if (this.localStream) {
      for (const track of this.localStream.getAudioTracks()) {
        track.enabled = !muted;
      }
    }
  }

  // Get invite link
  getInviteLink() {
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?room=${this.roomId}`;
  }

  // Disconnect from room
  disconnect() {
    // Send leave message
    this.broadcast(null, MSG.LEAVE, { playerId: this.playerId });
    
    // Close all connections
    for (const conn of this.connections.values()) {
      conn.close();
    }
    
    for (const call of this.mediaConnections.values()) {
      call.close();
    }
    
    // Stop local stream
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        track.stop();
      }
    }
    
    // Destroy peer
    if (this.peer) {
      this.peer.destroy();
    }
    
    this.connections.clear();
    this.mediaConnections.clear();
    this.localStreams.clear();
    this.players.clear();
    this.localStream = null;
    this.roomId = null;
    this.isHost = false;
  }

  // Cleanup
  destroy() {
    this.disconnect();
  }
}

export const network = new NetworkManager();
