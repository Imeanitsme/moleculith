// Main menu and multiplayer lobby system
import { network } from './networking.js';
import { t } from './i18n.js';
import { chatManager } from './chat.js';

let currentMenu = 'main'; // 'main', 'lobby', 'game'
let username = '';

export function initMenu() {
  // Check for mode parameter
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get('mode');
  const roomCode = urlParams.get('room');
  
  // Show/hide return to lobby button based on mode
  const btnReturnLobby = document.getElementById('btn-return-lobby');
  if (btnReturnLobby) {
    btnReturnLobby.hidden = mode !== 'multiplayer';
  }
  
  // Initialize top bar
  initTopBar(mode);
  
  if (mode === 'singleplayer') {
    // Auto-start singleplayer mode
    hideAllMenus();
    startSingleplayer();
  } else if (mode === 'multiplayer') {
    // Show multiplayer lobby
    if (roomCode) {
      showDirectJoinModal(roomCode);
    } else {
      showLobby();
    }
  } else {
    // Show main menu
    showMainMenu();
  }
  
  setupMenuEventListeners();
}

function initTopBar(mode) {
  const topModeBadge = document.getElementById('top-mode-badge');
  const topBarMP = document.getElementById('top-bar-mp');
  const topRoomName = document.getElementById('top-room-name');
  const topBtnExit = document.getElementById('top-btn-exit');
  const topBtnShare = document.getElementById('top-btn-share');
  const topBtnRoster = document.getElementById('top-btn-roster');
  
  if (!topModeBadge) return;
  
  // Set mode badge
  if (mode === 'multiplayer') {
    topModeBadge.textContent = 'Multiplayer';
    topModeBadge.style.color = '#4ade80';
    topModeBadge.style.borderColor = '#4ade80';
    topModeBadge.style.background = 'rgba(74, 222, 128, 0.15)';
    if (topBarMP) topBarMP.hidden = false;
  } else {
    topModeBadge.textContent = 'Singleplayer';
    if (topBarMP) topBarMP.hidden = true;
  }
  
  // Exit room button
  if (topBtnExit) {
    topBtnExit.addEventListener('click', () => {
      if (confirm('Leave the room?')) {
        window.location.href = 'index.html';
      }
    });
  }
  
  // Share room button
  if (topBtnShare) {
    topBtnShare.addEventListener('click', () => {
      const url = window.location.href;
      navigator.clipboard.writeText(url).then(() => {
        alert('Room link copied to clipboard!');
      }).catch(() => {
        prompt('Copy this link:', url);
      });
    });
  }
  
  // Roster button (placeholder - would show player list)
  if (topBtnRoster) {
    topBtnRoster.addEventListener('click', () => {
      alert('Channel roster feature coming soon!');
    });
  }
}

export function updateTopBarRoomInfo(roomName, playerCount) {
  const topRoomName = document.getElementById('top-room-name');
  const topRosterCount = document.getElementById('top-roster-count');
  
  if (topRoomName && roomName) {
    topRoomName.textContent = `Room: ${roomName}`;
  }
  if (topRosterCount && playerCount !== undefined) {
    topRosterCount.textContent = playerCount;
  }
}

function showMainMenu() {
  const mainMenu = document.getElementById('main-menu');
  const lobby = document.getElementById('multiplayer-lobby');
  mainMenu.hidden = false;
  mainMenu.style.display = '';
  lobby.hidden = true;
  lobby.style.display = 'none';
  currentMenu = 'main';
}

function showLobby() {
  const mainMenu = document.getElementById('main-menu');
  const lobby = document.getElementById('multiplayer-lobby');
  mainMenu.hidden = true;
  mainMenu.style.display = 'none';
  lobby.hidden = false;
  lobby.style.display = '';
  currentMenu = 'lobby';
}

function hideAllMenus() {
  const ids = ['main-menu', 'multiplayer-lobby', 'host-room-modal', 'join-room-modal', 'direct-join-modal', 'settings-modal'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    el.hidden = true;
    el.style.display = 'none';
  });
  currentMenu = 'game';
}

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

function showDirectJoinModal(roomCode) {
  document.getElementById('direct-join-room').textContent = `Room: ${roomCode}`;
  document.getElementById('direct-join-modal').dataset.roomCode = roomCode;
  showModal('direct-join-modal');
  
  // Focus username input
  setTimeout(() => {
    document.getElementById('direct-join-username').focus();
  }, 100);
}

function setupMenuEventListeners() {
  // Main menu buttons
  document.getElementById('btn-singleplayer').addEventListener('click', () => {
    window.location.href = 'game.html?mode=singleplayer';
  });
  
  document.getElementById('btn-multiplayer').addEventListener('click', () => {
    window.location.href = 'game.html?mode=multiplayer';
  });
  
  document.getElementById('btn-settings').addEventListener('click', () => {
    showModal('settings-modal');
    updateSettingsDisplay();
  });
  
  // Lobby buttons
  document.getElementById('lobby-back').addEventListener('click', () => {
    showMainMenu();
  });
  
  document.getElementById('btn-host-room').addEventListener('click', () => {
    showModal('host-room-modal');
    setTimeout(() => {
      document.getElementById('host-username').focus();
    }, 100);
  });
  
  document.getElementById('btn-join-room').addEventListener('click', () => {
    showModal('join-room-modal');
    setTimeout(() => {
      document.getElementById('join-username').focus();
    }, 100);
  });
  
  // Host room modal
  document.getElementById('host-password-enabled').addEventListener('change', (e) => {
    document.getElementById('host-password-group').hidden = !e.target.checked;
  });
  
  document.getElementById('btn-start-hosting').addEventListener('click', async () => {
    const username = document.getElementById('host-username').value.trim();
    const roomCode = document.getElementById('host-room-code').value.trim().toUpperCase();
    const passwordEnabled = document.getElementById('host-password-enabled').checked;
    const password = passwordEnabled ? document.getElementById('host-password').value : null;
    
    if (!username) {
      alert('Please enter a username');
      return;
    }
    
    try {
      await hostRoom(username, roomCode, password);
      hideModal('host-room-modal');
    } catch (err) {
      console.error('Failed to host room:', err);
      alert('Failed to create room: ' + err.message);
    }
  });
  
  // Join room modal
  document.getElementById('btn-start-join').addEventListener('click', async () => {
    const username = document.getElementById('join-username').value.trim();
    const roomCode = document.getElementById('join-room-code').value.trim().toUpperCase();
    const password = document.getElementById('join-password').value;
    
    if (!username) {
      alert('Please enter a username');
      return;
    }
    
    if (!roomCode) {
      alert('Please enter a room code');
      return;
    }
    
    try {
      await joinRoom(username, roomCode, password);
      hideModal('join-room-modal');
    } catch (err) {
      console.error('Failed to join room:', err);
      alert('Failed to join room: ' + err.message);
    }
  });
  
  // Direct join modal
  document.getElementById('btn-direct-join').addEventListener('click', async () => {
    const username = document.getElementById('direct-join-username').value.trim();
    const roomCode = document.getElementById('direct-join-modal').dataset.roomCode;
    const password = document.getElementById('direct-join-password').value;
    
    if (!username) {
      alert('Please enter a username');
      return;
    }
    
    try {
      await joinRoom(username, roomCode, password);
      hideModal('direct-join-modal');
    } catch (err) {
      console.error('Failed to join room:', err);
      alert('Failed to join room: ' + err.message);
    }
  });
  
  // Modal close buttons
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      hideModal(btn.dataset.close);
    });
  });
  
  // Settings modal
  document.getElementById('settings-back').addEventListener('click', () => {
    hideModal('settings-modal');
  });
  
  document.getElementById('settings-theme').addEventListener('click', () => {
    const btn = document.getElementById('btn-theme');
    if (btn) btn.click();
    updateSettingsDisplay();
  });
  
  document.getElementById('settings-lang').addEventListener('click', () => {
    const btn = document.getElementById('btn-lang');
    if (btn) btn.click();
    updateSettingsDisplay();
  });
  
  document.getElementById('settings-quality').addEventListener('click', () => {
    const btn = document.getElementById('btn-quality');
    if (btn) btn.click();
    updateSettingsDisplay();
  });
  
  document.getElementById('settings-volume-slider').addEventListener('input', (e) => {
    const slider = document.getElementById('volume-slider');
    if (slider) slider.value = e.target.value;
    if (window.__mol3d && window.__mol3d.setVolume) {
      window.__mol3d.setVolume(e.target.value / 100);
    }
  });
  
  // In-game HUD - top bar buttons
  const topBtnShare = document.getElementById('top-btn-share');
  if (topBtnShare) {
    topBtnShare.addEventListener('click', () => {
      const link = network.getInviteLink();
      navigator.clipboard.writeText(link).then(() => {
        alert('Invite link copied to clipboard!');
      }).catch(err => {
        console.error('Failed to copy link:', err);
      });
    });
  }
  
  const topBtnExit = document.getElementById('top-btn-exit');
  if (topBtnExit) {
    topBtnExit.addEventListener('click', () => {
      if (confirm('Are you sure you want to leave the room?')) {
        leaveRoom();
      }
    });
  }
  
  const btnVoiceToggle = document.getElementById('btn-voice-toggle');
  if (btnVoiceToggle) {
    btnVoiceToggle.addEventListener('click', async () => {
      const btn = document.getElementById('btn-voice-toggle');
      const icon = btn.querySelector('i');
      
      if (network.voiceEnabled) {
        // Disable voice
        network.setMuted(true);
        icon.setAttribute('data-lucide', 'mic-off');
        btn.classList.remove('active');
        const indicator = document.getElementById('voice-indicator');
        if (indicator) indicator.classList.remove('speaking');
        lucide.createIcons();
      } else {
        // Enable voice
        try {
          await network.setVoiceEnabled(true);
          network.setMuted(false);
          icon.setAttribute('data-lucide', 'mic');
          btn.classList.add('active');
          lucide.createIcons();
        } catch (err) {
          console.error('Failed to enable voice:', err);
          alert('Failed to access microphone. Please check permissions.');
        }
      }
    });
  }
}

async function startSingleplayer() {
  console.log('[Menu] Starting singleplayer mode');
  // Game is already loaded, just hide menus
}

async function hostRoom(username, roomCode, password) {
  console.log('[Menu] Hosting room:', roomCode || 'auto');
  
  try {
    const result = await network.hostRoom(roomCode, password);
    
    // Update top bar with room info
    updateTopBarRoomInfo(result.roomId, 1);
    
    hideAllMenus();
    
    console.log('[Menu] Room hosted successfully:', result.roomId);
    console.log('[Menu] Invite link:', network.getInviteLink());
    
    // Show invite link in console for now
    alert(`Room created!\nRoom Code: ${result.roomId}\n\nShare this link with friends:\n${network.getInviteLink()}`);
    
  } catch (err) {
    console.error('[Menu] Failed to host room:', err);
    throw err;
  }
}

async function joinRoom(username, roomCode, password) {
  console.log('[Menu] Joining room:', roomCode);
  
  try {
    await network.joinRoom(roomCode, password);
    
    // Update top bar with room info
    updateTopBarRoomInfo(roomCode, 1);
    
    hideAllMenus();
    
    console.log('[Menu] Joined room successfully:', roomCode);
    
  } catch (err) {
    console.error('[Menu] Failed to join room:', err);
    throw err;
  }
}

function leaveRoom() {
  console.log('[Menu] Leaving room');
  
  network.disconnect();
  
  // Hide multiplayer top bar section
  const topBarMP = document.getElementById('top-bar-mp');
  if (topBarMP) topBarMP.hidden = true;
  
  // Reset room info
  const topRoomName = document.getElementById('top-room-name');
  if (topRoomName) topRoomName.textContent = 'Room: —';
  
  const topRosterCount = document.getElementById('top-roster-count');
  if (topRosterCount) topRosterCount.textContent = '0';
  
  showMainMenu();
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

// Network event handlers
network.onPlayerJoin = (peerId, player) => {
  console.log('[Menu] Player joined:', player.username);
  updatePlayerCount();
  
  // Show notification
  const notification = document.createElement('div');
  notification.className = 'network-notification';
  notification.textContent = t('network.playerJoined', { username: player.username });
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 3000);
};

network.onPlayerLeave = (peerId) => {
  console.log('[Menu] Player left:', peerId);
  updatePlayerCount();
  
  const player = network.players.get(peerId);
  if (player) {
    // Show notification
    const notification = document.createElement('div');
    notification.className = 'network-notification';
    notification.textContent = t('network.playerLeft', { username: player.username });
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
};

function updatePlayerCount() {
  const count = network.players.size + 1; // +1 for local player
  const topRosterCount = document.getElementById('top-roster-count');
  if (topRosterCount) {
    topRosterCount.textContent = count;
  }
}

// Add CSS for network notifications
const style = document.createElement('style');
style.textContent = `
  .network-notification {
    position: fixed;
    top: 100px;
    left: 50%;
    transform: translateX(-50%);
    padding: 16px 24px;
    background: rgba(102, 126, 234, 0.9);
    color: #fff;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    z-index: 10002;
    animation: slideDown 0.3s ease, fadeOut 0.3s ease 2.7s;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }
  
  @keyframes slideDown {
    from {
      transform: translateX(-50%) translateY(-20px);
      opacity: 0;
    }
    to {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
    }
  }
  
  @keyframes fadeOut {
    from { opacity: 1; }
    to { opacity: 0; }
  }
`;
document.head.appendChild(style);
