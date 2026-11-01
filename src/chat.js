// Chat system with draggable, resizable, and fade effects
import { network, MSG } from './networking.js';
import { t } from './i18n.js';

const FADE_DELAY = 5000; // ms before chat fades
const MAX_MESSAGES = 100;

class ChatManager {
  constructor() {
    this.chatBox = null;
    this.chatHeader = null;
    this.chatMessages = null;
    this.chatInput = null;
    this.chatToggle = null;
    this.isOpen = false;
    this.isMinimized = false;
    this.isFaded = false;
    this.fadeTimer = null;
    this.isDragging = false;
    this.isResizing = false;
    this.dragOffset = { x: 0, y: 0 };
    this.messages = [];
    this.unreadCount = 0;
  }
  
  init() {
    this.chatBox = document.getElementById('chat-box');
    this.chatHeader = document.getElementById('chat-header');
    this.chatMessages = document.getElementById('chat-messages');
    this.chatInput = document.getElementById('chat-input');
    this.chatToggle = document.getElementById('btn-chat-toggle');
    
    this.setupEventListeners();
    this.startFadeTimer();
    
    // Show chat toggle when in multiplayer
    if (network.roomId) {
      this.show();
    }
  }
  
  setupEventListeners() {
    // Toggle chat
    this.chatToggle.addEventListener('click', () => {
      this.toggle();
    });
    
    // Close button
    document.getElementById('chat-close').addEventListener('click', () => {
      this.hide();
    });
    
    // Minimize button
    document.getElementById('chat-minimize').addEventListener('click', () => {
      this.toggleMinimize();
    });
    
    // Send message
    document.getElementById('chat-send').addEventListener('click', () => {
      this.sendMessage();
    });
    
    // Enter key to send
    this.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
      if (e.key === 'Escape') {
        this.chatInput.blur();
      }
    });
    
    // Focus input on T or Enter
    document.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;
      
      // Don't trigger if typing in another input
      if (e.target.tagName === 'INPUT' && e.target !== this.chatInput) return;
      
      if (e.key === 't' || e.key === 'T') {
        if (document.activeElement !== this.chatInput) {
          e.preventDefault();
          this.wake();
          this.chatInput.focus();
        }
      }
      
      if (e.key === 'Enter' && document.activeElement !== this.chatInput) {
        e.preventDefault();
        this.wake();
        this.chatInput.focus();
      }
    });
    
    // Drag functionality
    this.chatHeader.addEventListener('mousedown', (e) => {
      if (e.target.closest('.chat-btn')) return;
      this.startDrag(e);
    });
    
    document.addEventListener('mousemove', (e) => {
      this.onDrag(e);
    });
    
    document.addEventListener('mouseup', () => {
      this.stopDrag();
    });
    
    // Touch drag support
    this.chatHeader.addEventListener('touchstart', (e) => {
      if (e.target.closest('.chat-btn')) return;
      this.startDrag(e.touches[0]);
    });
    
    document.addEventListener('touchmove', (e) => {
      if (this.isDragging) {
        this.onDrag(e.touches[0]);
      }
    });
    
    document.addEventListener('touchend', () => {
      this.stopDrag();
    });
    
    // Resize functionality
    const resizeHandle = document.getElementById('chat-resize');
    resizeHandle.addEventListener('mousedown', (e) => {
      this.startResize(e);
    });
    
    // Wake on interaction
    this.chatBox.addEventListener('mousedown', () => {
      this.wake();
    });
    
    this.chatBox.addEventListener('mouseenter', () => {
      this.wake();
    });
    
    // Network message handler
    network.onMessage = (peerId, msgType, data) => {
      if (msgType === MSG.CHAT) {
        this.receiveMessage(data);
      }
    };
  }
  
  startDrag(e) {
    this.isDragging = true;
    const rect = this.chatBox.getBoundingClientRect();
    this.dragOffset.x = e.clientX - rect.left;
    this.dragOffset.y = e.clientY - rect.top;
    this.chatBox.style.transition = 'none';
  }
  
  onDrag(e) {
    if (!this.isDragging) return;
    
    const x = e.clientX - this.dragOffset.x;
    const y = e.clientY - this.dragOffset.y;
    
    // Keep within viewport
    const maxX = window.innerWidth - this.chatBox.offsetWidth;
    const maxY = window.innerHeight - this.chatBox.offsetHeight;
    
    this.chatBox.style.left = Math.max(0, Math.min(x, maxX)) + 'px';
    this.chatBox.style.top = Math.max(0, Math.min(y, maxY)) + 'px';
    this.chatBox.style.bottom = 'auto';
  }
  
  stopDrag() {
    this.isDragging = false;
    this.chatBox.style.transition = '';
  }
  
  startResize(e) {
    this.isResizing = true;
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = this.chatBox.offsetWidth;
    const startHeight = this.chatBox.offsetHeight;
    
    const onResize = (e) => {
      if (!this.isResizing) return;
      
      const width = startWidth + (e.clientX - startX);
      const height = startHeight + (e.clientY - startY);
      
      this.chatBox.style.width = Math.max(250, Math.min(width, 600)) + 'px';
      this.chatBox.style.height = Math.max(200, Math.min(height, 600)) + 'px';
    };
    
    const onStop = () => {
      this.isResizing = false;
      document.removeEventListener('mousemove', onResize);
      document.removeEventListener('mouseup', onStop);
    };
    
    document.addEventListener('mousemove', onResize);
    document.addEventListener('mouseup', onStop);
  }
  
  toggle() {
    if (this.isOpen) {
      this.hide();
    } else {
      this.show();
    }
  }
  
  show() {
    this.chatBox.hidden = false;
    this.chatToggle.hidden = true;
    this.isOpen = true;
    this.unreadCount = 0;
    this.wake();
    this.chatInput.focus();
  }
  
  hide() {
    this.chatBox.hidden = true;
    this.chatToggle.hidden = false;
    this.isOpen = false;
  }
  
  toggleMinimize() {
    this.isMinimized = !this.isMinimized;
    this.chatBox.classList.toggle('minimized', this.isMinimized);
  }
  
  wake() {
    this.isFaded = false;
    this.chatBox.classList.remove('faded');
    this.startFadeTimer();
  }
  
  startFadeTimer() {
    if (this.fadeTimer) {
      clearTimeout(this.fadeTimer);
    }
    
    this.fadeTimer = setTimeout(() => {
      if (this.isOpen && !this.isMinimized) {
        this.isFaded = true;
        this.chatBox.classList.add('faded');
      }
    }, FADE_DELAY);
  }
  
  sendMessage() {
    const text = this.chatInput.value.trim();
    if (!text) return;
    
    // Send to network
    network.sendChat(text);
    
    // Add to local messages
    this.addMessage({
      username: 'You',
      message: text,
      timestamp: Date.now(),
      isLocal: true,
    });
    
    this.chatInput.value = '';
    this.wake();
  }
  
  receiveMessage(data) {
    this.addMessage({
      username: data.username || 'Player',
      message: data.message,
      timestamp: data.timestamp || Date.now(),
      isLocal: false,
    });
    
    // Show notification if chat is hidden
    if (!this.isOpen) {
      this.unreadCount++;
      this.chatToggle.classList.add('has-unread');
      
      // Play sound notification
      this.playNotificationSound();
    }
    
    this.wake();
  }
  
  addMessage(data) {
    this.messages.push(data);
    
    // Limit message count
    if (this.messages.length > MAX_MESSAGES) {
      this.messages.shift();
      if (this.chatMessages.firstChild) {
        this.chatMessages.removeChild(this.chatMessages.firstChild);
      }
    }
    
    // Create message element
    const msgEl = document.createElement('div');
    msgEl.className = 'chat-message';
    
    const time = new Date(data.timestamp);
    const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    msgEl.innerHTML = `
      <div class="chat-message-header">
        <span class="chat-username">${this.escapeHtml(data.username)}</span>
        <span class="chat-timestamp">${timeStr}</span>
      </div>
      <div class="chat-text">${this.escapeHtml(data.message)}</div>
    `;
    
    this.chatMessages.appendChild(msgEl);
    
    // Auto-scroll to bottom
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }
  
  addSystemMessage(text) {
    const msgEl = document.createElement('div');
    msgEl.className = 'chat-message system';
    
    const time = new Date();
    const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    msgEl.innerHTML = `
      <div class="chat-text">${this.escapeHtml(text)}</div>
    `;
    
    this.chatMessages.appendChild(msgEl);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  playNotificationSound() {
    // Create a simple beep sound using Web Audio API
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (err) {
      console.warn('Failed to play notification sound:', err);
    }
  }
  
  clear() {
    this.messages = [];
    this.chatMessages.innerHTML = '';
  }
  
  destroy() {
    if (this.fadeTimer) {
      clearTimeout(this.fadeTimer);
    }
  }
}

export const chatManager = new ChatManager();
