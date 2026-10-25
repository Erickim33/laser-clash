/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class FullscreenManager {
  private isSupported: boolean = false;
  private listeners: Set<(isFullscreen: boolean) => void> = new Set();
  private sessionPrefersFullscreen: boolean = false;

  constructor() {
    if (typeof document !== 'undefined') {
      this.isSupported = Boolean(
        document.fullscreenEnabled ||
        (document as unknown as { webkitFullscreenEnabled?: boolean }).webkitFullscreenEnabled ||
        (document as unknown as { mozFullScreenEnabled?: boolean }).mozFullScreenEnabled ||
        (document as unknown as { msFullscreenEnabled?: boolean }).msFullscreenEnabled
      );

      document.addEventListener('fullscreenchange', () => this.handleFullscreenChange());
      document.addEventListener('webkitfullscreenchange', () => this.handleFullscreenChange());
    }
  }

  public getSupported(): boolean {
    return this.isSupported;
  }

  public isFullscreen(): boolean {
    if (typeof document === 'undefined') return false;
    return Boolean(
      document.fullscreenElement ||
      (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement ||
      (document as unknown as { mozFullScreenElement?: Element }).mozFullScreenElement
    );
  }

  public async toggle(): Promise<boolean> {
    if (!this.isSupported) return false;

    try {
      if (this.isFullscreen()) {
        if (document.exitFullscreen) {
          await document.exitFullscreen().catch(() => {});
        } else if ((document as unknown as { webkitExitFullscreen?: () => Promise<void> }).webkitExitFullscreen) {
          await (document as unknown as { webkitExitFullscreen: () => Promise<void> }).webkitExitFullscreen().catch(() => {});
        }
        this.sessionPrefersFullscreen = false;
      } else {
        const root = document.documentElement;
        if (root.requestFullscreen) {
          await root.requestFullscreen().catch(() => {});
        } else if ((root as unknown as { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen) {
          await (root as unknown as { webkitRequestFullscreen: () => Promise<void> }).webkitRequestFullscreen().catch(() => {});
        }
        this.sessionPrefersFullscreen = true;
      }
    } catch {
      // Permission rejected by user or browser policy safe
    }

    return this.isFullscreen();
  }

  private handleFullscreenChange() {
    const state = this.isFullscreen();
    this.listeners.forEach((listener) => listener(state));
  }

  public subscribe(cb: (isFullscreen: boolean) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  public getSessionPreference(): boolean {
    return this.sessionPrefersFullscreen;
  }
}

export const fullscreenManager = new FullscreenManager();
