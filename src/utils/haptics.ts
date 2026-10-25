/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { settingsStore } from './settingsStore';

export class HapticsManager {
  private static canVibrate(): boolean {
    return typeof navigator !== 'undefined' && 'vibrate' in navigator;
  }

  public static trigger(type: 'damage' | 'purchase' | 'ability' | 'matchEnd') {
    if (!settingsStore.getSettings().hapticsEnabled) return;
    if (!this.canVibrate()) return;

    try {
      switch (type) {
        case 'damage':
          navigator.vibrate(30);
          break;
        case 'purchase':
          navigator.vibrate([20, 30, 30]);
          break;
        case 'ability':
          navigator.vibrate([40, 40, 60]);
          break;
        case 'matchEnd':
          navigator.vibrate([80, 50, 100, 50, 160]);
          break;
      }
    } catch {
      // Ignore vibration errors if blocked by browser policy
    }
  }
}
