/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { settingsStore } from '../utils/settingsStore';

class AudioManagerService {
  private ctx: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private isMuted: boolean = false;
  private musicOscillators: OscillatorNode[] = [];
  private isMusicRunning: boolean = false;

  constructor() {
    // AudioContext will be initialized on first user interaction to comply with browser autoplay policies
    settingsStore.subscribe((s) => {
      this.updateVolumes(s.masterVolume, s.sfxVolume, s.musicVolume, s.sfxEnabled, s.musicEnabled);
    });
  }

  private initContext() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.connect(this.masterGain);

      this.musicGain = this.ctx.createGain();
      this.musicGain.connect(this.masterGain);

      const s = settingsStore.getSettings();
      this.updateVolumes(s.masterVolume, s.sfxVolume, s.musicVolume, s.sfxEnabled, s.musicEnabled);
    } catch {
      // AudioContext unavailable
    }
  }

  private ensureUnlocked() {
    this.initContext();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private updateVolumes(master: number, sfx: number, music: number, sfxOn: boolean, musicOn: boolean) {
    if (!this.masterGain || !this.sfxGain || !this.musicGain) return;
    const now = this.ctx ? this.ctx.currentTime : 0;
    
    this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : master, now);
    this.sfxGain.gain.setValueAtTime(sfxOn ? sfx : 0, now);
    this.musicGain.gain.setValueAtTime(musicOn ? music * 0.15 : 0, now);

    if (!musicOn && this.isMusicRunning) {
      this.stopCombatMusic();
    }
  }

  public playLaserShot(isEnemy: boolean = false) {
    this.ensureUnlocked();
    if (!this.ctx || !this.sfxGain || !settingsStore.getSettings().sfxEnabled) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = isEnemy ? 'sawtooth' : 'sine';
      // Pitch drop for snappy laser
      const startFreq = isEnemy ? 620 : 880;
      const endFreq = isEnemy ? 180 : 260;

      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.08);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now);
      osc.stop(now + 0.08);
    } catch {
      // safe fallback
    }
  }

  public playHit(isCritical: boolean = false) {
    this.ensureUnlocked();
    if (!this.ctx || !this.sfxGain || !settingsStore.getSettings().sfxEnabled) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(isCritical ? 190 : 130, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.12);

      gain.gain.setValueAtTime(isCritical ? 0.35 : 0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now);
      osc.stop(now + 0.12);
    } catch {
      // safe fallback
    }
  }

  public playShield() {
    this.ensureUnlocked();
    if (!this.ctx || !this.sfxGain || !settingsStore.getSettings().sfxEnabled) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(350, now);
      osc.frequency.linearRampToValueAtTime(520, now + 0.18);
      osc.frequency.linearRampToValueAtTime(440, now + 0.35);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch {
      // safe fallback
    }
  }

  public playOverdriveBeam() {
    this.ensureUnlocked();
    if (!this.ctx || !this.sfxGain || !settingsStore.getSettings().sfxEnabled) return;

    try {
      const now = this.ctx.currentTime;
      
      // Dual oscillator for heavy industrial laser roar
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'square';

      osc1.frequency.setValueAtTime(440, now);
      osc1.frequency.exponentialRampToValueAtTime(80, now + 0.7);

      osc2.frequency.setValueAtTime(220, now);
      osc2.frequency.exponentialRampToValueAtTime(55, now + 0.7);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.sfxGain);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.7);
      osc2.stop(now + 0.7);
    } catch {
      // safe fallback
    }
  }

  public playEnergyPulse() {
    this.ensureUnlocked();
    if (!this.ctx || !this.sfxGain || !settingsStore.getSettings().sfxEnabled) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.45);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now);
      osc.stop(now + 0.45);
    } catch {
      // safe fallback
    }
  }

  public playUpgrade() {
    this.ensureUnlocked();
    if (!this.ctx || !this.sfxGain || !settingsStore.getSettings().sfxEnabled) return;

    try {
      const now = this.ctx.currentTime;
      [440, 554, 659].forEach((freq, index) => {
        if (!this.ctx || !this.sfxGain) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + index * 0.05);

        gain.gain.setValueAtTime(0.12, now + index * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.05 + 0.12);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(now + index * 0.05);
        osc.stop(now + index * 0.05 + 0.12);
      });
    } catch {
      // safe fallback
    }
  }

  public playEnergyPickup() {
    this.ensureUnlocked();
    if (!this.ctx || !this.sfxGain || !settingsStore.getSettings().sfxEnabled) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.14);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now);
      osc.stop(now + 0.14);
    } catch {
      // safe fallback
    }
  }

  public playExplosion() {
    this.ensureUnlocked();
    if (!this.ctx || !this.sfxGain || !settingsStore.getSettings().sfxEnabled) return;

    try {
      const now = this.ctx.currentTime;
      
      // Noise buffer for blast
      const bufferSize = this.ctx.sampleRate * 0.8;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, now);
      filter.frequency.exponentialRampToValueAtTime(40, now + 0.8);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);

      noise.start(now);
      noise.stop(now + 0.8);
    } catch {
      // safe fallback
    }
  }

  public playVictory() {
    this.ensureUnlocked();
    if (!this.ctx || !this.sfxGain || !settingsStore.getSettings().sfxEnabled) return;

    try {
      const now = this.ctx.currentTime;
      [330, 440, 554, 659].forEach((f, i) => {
        if (!this.ctx || !this.sfxGain) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, now + i * 0.1);
        gain.gain.setValueAtTime(0.2, now + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.4);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now + i * 0.1);
        osc.stop(now + i * 0.1 + 0.4);
      });
    } catch {
      // safe fallback
    }
  }

  public playDefeat() {
    this.ensureUnlocked();
    if (!this.ctx || !this.sfxGain || !settingsStore.getSettings().sfxEnabled) return;

    try {
      const now = this.ctx.currentTime;
      [440, 392, 330, 220].forEach((f, i) => {
        if (!this.ctx || !this.sfxGain) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(f, now + i * 0.12);
        gain.gain.setValueAtTime(0.2, now + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.35);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now + i * 0.12);
        osc.stop(now + i * 0.12 + 0.35);
      });
    } catch {
      // safe fallback
    }
  }

  public startCombatDrone() {
    this.ensureUnlocked();
    if (!this.ctx || !this.musicGain || this.isMusicRunning || !settingsStore.getSettings().musicEnabled) return;

    try {
      const now = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();

      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(55, now); // A1 note
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(110, now); // A2 note

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(220, now);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(this.musicGain);

      osc1.start(now);
      osc2.start(now);

      this.musicOscillators = [osc1, osc2];
      this.isMusicRunning = true;
    } catch {
      // safe fallback
    }
  }

  public playStarCollect() {
    this.ensureUnlocked();
    if (!this.ctx || !this.sfxGain || !settingsStore.getSettings().sfxEnabled) return;

    try {
      const now = this.ctx.currentTime;
      [880, 1174, 1567, 2093].forEach((f, i) => {
        if (!this.ctx || !this.sfxGain) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, now + i * 0.05);

        gain.gain.setValueAtTime(0.18, now + i * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.25);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(now + i * 0.05);
        osc.stop(now + i * 0.05 + 0.25);
      });
    } catch {
      // safe fallback
    }
  }

  public playPlayerLevelUp() {
    this.ensureUnlocked();
    if (!this.ctx || !this.sfxGain || !settingsStore.getSettings().sfxEnabled) return;

    try {
      const now = this.ctx.currentTime;
      [523, 659, 783, 1046].forEach((f, i) => {
        if (!this.ctx || !this.sfxGain) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + i * 0.07);

        gain.gain.setValueAtTime(0.2, now + i * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.35);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(now + i * 0.07);
        osc.stop(now + i * 0.07 + 0.35);
      });
    } catch {
      // safe fallback
    }
  }

  public playWaveAlert() {
    this.ensureUnlocked();
    if (!this.ctx || !this.sfxGain || !settingsStore.getSettings().sfxEnabled) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.linearRampToValueAtTime(180, now + 0.15);
      osc.frequency.linearRampToValueAtTime(120, now + 0.35);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now);
      osc.stop(now + 0.4);
    } catch {
      // safe fallback
    }
  }

  public playMirrorClink() {
    this.ensureUnlocked();
    if (!this.ctx || !this.sfxGain || !settingsStore.getSettings().sfxEnabled) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, now);
      osc.frequency.exponentialRampToValueAtTime(2640, now + 0.08);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.08);
    } catch {
      // safe fallback
    }
  }

  public playPuzzleNodeChime(step = 1) {
    this.ensureUnlocked();
    if (!this.ctx || !this.sfxGain || !settingsStore.getSettings().sfxEnabled) return;
    try {
      const now = this.ctx.currentTime;
      const baseFreq = step === 1 ? 523.25 : step === 2 ? 659.25 : 783.99; // C5, E5, G5
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.linearRampToValueAtTime(baseFreq * 1.5, now + 0.18);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.25);
    } catch {
      // safe fallback
    }
  }

  public playPuzzleFail() {
    this.ensureUnlocked();
    if (!this.ctx || !this.sfxGain || !settingsStore.getSettings().sfxEnabled) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.linearRampToValueAtTime(80, now + 0.25);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.25);
    } catch {
      // safe fallback
    }
  }

  public playOverloadEMP() {
    this.ensureUnlocked();
    if (!this.ctx || !this.sfxGain || !settingsStore.getSettings().sfxEnabled) return;
    try {
      const now = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'square';
      osc1.frequency.setValueAtTime(880, now);
      osc1.frequency.exponentialRampToValueAtTime(55, now + 1.2);
      osc2.frequency.setValueAtTime(440, now);
      osc2.frequency.exponentialRampToValueAtTime(30, now + 1.2);

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.sfxGain);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 1.2);
      osc2.stop(now + 1.2);
    } catch {
      // safe fallback
    }
  }

  public playDash() {
    this.ensureUnlocked();
    if (!this.ctx || !this.sfxGain || !settingsStore.getSettings().sfxEnabled) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.15);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.15);
    } catch {
      // safe fallback
    }
  }

  public stopCombatMusic() {
    this.musicOscillators.forEach((osc) => {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        // ignore
      }
    });
    this.musicOscillators = [];
    this.isMusicRunning = false;
  }
}

export const audioManager = new AudioManagerService();
