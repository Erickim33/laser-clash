/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GameSettings } from '../types/game';
import { logger } from './logger';

const SETTINGS_KEY = 'laser_clash_settings_v1';

const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 0.8,
  sfxVolume: 0.85,
  sfxEnabled: true,
  musicVolume: 0.5,
  musicEnabled: true,
  screenShake: true,
  reducedEffects: false,
  colorblindMode: false,
  hapticsEnabled: true,
  hasCompletedTutorial: true,
  hasSeenHUDPrimer: true,
};

type SettingsListener = (settings: GameSettings) => void;

class SettingsStore {
  private settings: GameSettings;
  private listeners: Set<SettingsListener> = new Set();
  private saveNotificationTimeout: ReturnType<typeof setTimeout> | null = null;
  private saveCallback: ((saved: boolean) => void) | null = null;

  constructor() {
    this.settings = this.load();
  }

  private load(): GameSettings {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch (e) {
      logger.warn('Failed to load settings from localStorage, falling back to defaults', { error: String(e) });
    }
    return { ...DEFAULT_SETTINGS };
  }

  public getSettings(): GameSettings {
    return { ...this.settings };
  }

  public updateSettings(partial: Partial<GameSettings>) {
    this.settings = { ...this.settings, ...partial };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
      this.notifySave();
    } catch (e) {
      logger.error('Failed to save settings to localStorage', { error: String(e) });
    }
    this.listeners.forEach((listener) => listener(this.settings));
  }

  public subscribe(listener: SettingsListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public onSaveFeedback(cb: (saved: boolean) => void) {
    this.saveCallback = cb;
  }

  private notifySave() {
    if (this.saveCallback) {
      this.saveCallback(true);
      if (this.saveNotificationTimeout) clearTimeout(this.saveNotificationTimeout);
      this.saveNotificationTimeout = setTimeout(() => {
        if (this.saveCallback) this.saveCallback(false);
      }, 1400);
    }
  }

  public resetToDefaults() {
    this.settings = { ...DEFAULT_SETTINGS };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
      this.notifySave();
    } catch {
      // ignore
    }
    this.listeners.forEach((listener) => listener(this.settings));
  }
}

export const settingsStore = new SettingsStore();
