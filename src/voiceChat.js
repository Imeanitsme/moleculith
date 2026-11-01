// Voice chat manager with audio playback and speaking indicators
import { network } from './networking.js';

class VoiceChatManager {
  constructor() {
    this.audioElements = new Map(); // peerId -> HTMLAudioElement
    this.audioContext = null;
    this.analyzers = new Map(); // peerId -> AnalyserNode
    this.speakingThreshold = 0.01;
    this.speakingTimers = new Map(); // peerId -> timeout
    this.enabled = false;
    this.muted = true;
  }
  
  init() {
    // Setup voice stream handler
    network.onVoiceStream = (peerId, stream) => {
      this.handleRemoteStream(peerId, stream);
    };
    
    // Setup voice toggle button
    const voiceBtn = document.getElementById('btn-voice-toggle');
    if (voiceBtn) {
      voiceBtn.addEventListener('click', async () => {
        await this.toggleVoice();
      });
    }
  }
  
  async toggleVoice() {
    const voiceBtn = document.getElementById('btn-voice-toggle');
    if (!voiceBtn) return;
    
    const icon = voiceBtn.querySelector('i');
    const indicator = document.getElementById('voice-indicator');
    
    if (this.enabled) {
      // Disable voice
      this.disable();
      icon.setAttribute('data-lucide', 'mic-off');
      voiceBtn.classList.remove('active');
      if (indicator) indicator.classList.remove('speaking');
      if (window.lucide) lucide.createIcons();
    } else {
      // Enable voice
      try {
        await this.enable();
        icon.setAttribute('data-lucide', 'mic');
        voiceBtn.classList.add('active');
        if (window.lucide) lucide.createIcons();
      } catch (err) {
        console.error('[VoiceChat] Failed to enable voice:', err);
        alert('Failed to access microphone. Please check permissions.');
      }
    }
  }
  
  async enable() {
    if (this.enabled) return;
    
    await network.setVoiceEnabled(true);
    this.enabled = true;
    this.muted = false;
    network.setMuted(false);
    
    console.log('[VoiceChat] Voice chat enabled');
  }
  
  disable() {
    if (!this.enabled) return;
    
    network.setMuted(true);
    this.muted = true;
    this.enabled = false;
    
    // Stop all remote audio
    for (const audio of this.audioElements.values()) {
      audio.pause();
      audio.srcObject = null;
    }
    this.audioElements.clear();
    
    // Stop local stream
    if (network.localStream) {
      for (const track of network.localStream.getTracks()) {
        track.stop();
      }
      network.localStream = null;
    }
    
    console.log('[VoiceChat] Voice chat disabled');
  }
  
  handleRemoteStream(peerId, stream) {
    console.log('[VoiceChat] Received remote stream from:', peerId);
    
    // Create audio element for playback
    const audio = new Audio();
    audio.srcObject = stream;
    audio.autoplay = true;
    audio.volume = 1.0;
    
    // Handle autoplay restrictions
    audio.play().catch(err => {
      console.warn('[VoiceChat] Autoplay blocked for:', peerId, err);
      // User will need to interact with the page first
    });
    
    this.audioElements.set(peerId, audio);
    
    // Setup audio analyzer for speaking detection
    this.setupAnalyzer(peerId, stream);
    
    // Clean up when stream ends
    stream.getTracks().forEach(track => {
      track.onended = () => {
        console.log('[VoiceChat] Remote stream ended:', peerId);
        this.removeRemoteStream(peerId);
      };
    });
  }
  
  setupAnalyzer(peerId, stream) {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    const source = this.audioContext.createMediaStreamSource(stream);
    const analyzer = this.audioContext.createAnalyser();
    analyzer.fftSize = 256;
    analyzer.smoothingTimeConstant = 0.8;
    
    source.connect(analyzer);
    
    this.analyzers.set(peerId, analyzer);
    
    // Start monitoring for speaking
    this.monitorSpeaking(peerId, analyzer);
  }
  
  monitorSpeaking(peerId, analyzer) {
    const dataArray = new Uint8Array(analyzer.frequencyBinCount);
    
    const check = () => {
      if (!this.analyzers.has(peerId)) return;
      
      analyzer.getByteFrequencyData(dataArray);
      
      // Calculate average volume
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length / 255;
      
      // Check if speaking
      if (average > this.speakingThreshold) {
        this.setSpeaking(peerId, true);
      } else {
        // Delay before marking as "not speaking"
        if (!this.speakingTimers.has(peerId)) {
          const timer = setTimeout(() => {
            this.setSpeaking(peerId, false);
            this.speakingTimers.delete(peerId);
          }, 500);
          this.speakingTimers.set(peerId, timer);
        }
      }
      
      requestAnimationFrame(check);
    };
    
    check();
  }
  
  setSpeaking(peerId, isSpeaking) {
    // Update local indicator if this is the local player
    if (peerId === network.playerId) {
      const indicator = document.getElementById('voice-indicator');
      if (indicator) {
        if (isSpeaking) {
          indicator.classList.add('speaking');
        } else {
          indicator.classList.remove('speaking');
        }
      }
    }
    
    // TODO: Update remote player UI indicators
    // This would require integration with the player sync system
  }
  
  removeRemoteStream(peerId) {
    const audio = this.audioElements.get(peerId);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      this.audioElements.delete(peerId);
    }
    
    const analyzer = this.analyzers.get(peerId);
    if (analyzer) {
      analyzer.disconnect();
      this.analyzers.delete(peerId);
    }
    
    const timer = this.speakingTimers.get(peerId);
    if (timer) {
      clearTimeout(timer);
      this.speakingTimers.delete(peerId);
    }
  }
  
  setMuted(muted) {
    this.muted = muted;
    network.setMuted(muted);
    
    // Mute/unmute all remote audio
    for (const audio of this.audioElements.values()) {
      audio.muted = muted;
    }
  }
  
  setVolume(volume) {
    for (const audio of this.audioElements.values()) {
      audio.volume = Math.max(0, Math.min(1, volume));
    }
  }
  
  destroy() {
    // Clean up all streams
    for (const peerId of this.audioElements.keys()) {
      this.removeRemoteStream(peerId);
    }
    
    // Close audio context
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.enabled = false;
  }
}

export const voiceChat = new VoiceChatManager();
