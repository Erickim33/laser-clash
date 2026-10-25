/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { FastForward, Video } from 'lucide-react';
import { ReplayFrame, GameSettings } from '../types/game';
import { CanvasRenderer } from '../combat/CanvasRenderer';

interface KillCamOverlayProps {
  frames: ReplayFrame[];
  settings: GameSettings;
  renderer: CanvasRenderer | null;
  onComplete: () => void;
}

export const KillCamOverlay: React.FC<KillCamOverlayProps> = ({
  frames,
  settings,
  renderer,
  onComplete,
}) => {
  const [canSkip, setCanSkip] = useState(false);
  const [currentFrameIdx, setCurrentFrameIdx] = useState(0);

  useEffect(() => {
    // Skippable with tap/click after 1.0 second (Section 22)
    const skipTimer = setTimeout(() => {
      setCanSkip(true);
    }, 1000);

    if (frames.length === 0) {
      onComplete();
      return () => clearTimeout(skipTimer);
    }

    // Playback at 60% speed (~100fps per tick normalized to slow-mo)
    // 2.5s real time at 60% speed = ~4.16 seconds of slow motion playback
    const frameIntervalMs = (1000 / 60) / 0.6; // ~27.7ms per frame
    let frame = 0;

    const interval = setInterval(() => {
      frame++;
      if (frame >= frames.length) {
        clearInterval(interval);
        setTimeout(onComplete, 400);
      } else {
        setCurrentFrameIdx(frame);
      }
    }, frameIntervalMs);

    return () => {
      clearTimeout(skipTimer);
      clearInterval(interval);
    };
  }, [frames, onComplete]);

  // Render the current replay frame to canvas
  useEffect(() => {
    if (renderer && frames[currentFrameIdx]) {
      const progress = frames.length > 0 ? currentFrameIdx / frames.length : 0;
      renderer.renderReplayFrame(frames[currentFrameIdx], settings, progress);
    }
  }, [renderer, frames, currentFrameIdx, settings]);

  const handleSkip = () => {
    if (canSkip) {
      onComplete();
    }
  };

  const progressPercent = frames.length > 0 
    ? Math.round((currentFrameIdx / frames.length) * 100) 
    : 0;

  return (
    <div 
      className="absolute inset-0 z-30 flex flex-col justify-between p-4 cursor-pointer select-none"
      onClick={handleSkip}
    >
      {/* Top Replay Badge */}
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-2 bg-red-600/90 text-white px-3 py-1 font-mono-numbers text-xs uppercase tracking-widest font-bold border border-red-400/50 shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-pulse">
          <Video className="w-3.5 h-3.5" />
          <span>Final Hit Kill-Cam · 0.6x Slow-Mo</span>
        </div>

        {canSkip && (
          <div className="flex items-center gap-1.5 bg-black/70 border border-white/20 text-white/90 px-3 py-1 text-xs font-mono-numbers tracking-wider hover:bg-white/20 transition-all">
            <FastForward className="w-3.5 h-3.5" />
            <span>Tap to Skip</span>
          </div>
        )}
      </div>

      {/* Cinematic Center Letterbox Lines */}
      <div className="pointer-events-none flex-1 flex flex-col justify-center items-center">
        <div className="w-full flex items-center justify-between px-8 text-white/20 font-mono text-[10px]">
          <span>RECORDING_BUF_SNAPSHOT</span>
          <span>CHAMBER_SPECTATE</span>
        </div>
      </div>

      {/* Bottom Timeline Bar */}
      <div className="z-10 bg-black/80 p-2.5 border border-white/10 font-mono-numbers text-xs">
        <div className="flex items-center justify-between text-[11px] text-white/60 mb-1.5">
          <span>REPLAY PLAYBACK</span>
          <span className="text-white font-bold">{progressPercent}%</span>
        </div>
        <div className="w-full h-1.5 bg-white/10 overflow-hidden">
          <div 
            className="h-full bg-red-500 transition-all duration-75"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
};
