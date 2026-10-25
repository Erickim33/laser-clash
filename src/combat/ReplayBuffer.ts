/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ReplayFrame } from '../types/game';

const BUFFER_DURATION_SECONDS = 3.0;

export class ReplayBuffer {
  private frames: ReplayFrame[] = [];
  private maxDuration: number;

  constructor(maxDurationSeconds: number = BUFFER_DURATION_SECONDS) {
    this.maxDuration = maxDurationSeconds;
  }

  public recordTick(frame: ReplayFrame) {
    this.frames.push(frame);

    // Prune frames older than maxDuration relative to latest frame
    const latestTimestamp = frame.timestamp;
    const cutoff = latestTimestamp - this.maxDuration;

    while (this.frames.length > 0 && this.frames[0].timestamp < cutoff) {
      this.frames.shift();
    }
  }

  /**
   * Retrieves the recorded sequence for final-hit playback (e.g. last 2.5 seconds).
   */
  public getFinalKillSequence(durationSeconds: number = 2.5): ReplayFrame[] {
    if (this.frames.length === 0) return [];
    const latestTimestamp = this.frames[this.frames.length - 1].timestamp;
    const cutoff = latestTimestamp - durationSeconds;
    return this.frames.filter((f) => f.timestamp >= cutoff);
  }

  public clear() {
    this.frames = [];
  }

  public getFrameCount(): number {
    return this.frames.length;
  }
}
