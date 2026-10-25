/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Play,
  RotateCcw,
  Settings as SettingsIcon,
  Home,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { fullscreenManager } from '../utils/fullscreen';

interface PauseMenuProps {
  onResume: () => void;
  onRestart: () => void;
  onOpenSettings: () => void;
  onQuitToMenu: () => void;
}

export const PauseMenu: React.FC<PauseMenuProps> = ({
  onResume,
  onRestart,
  onOpenSettings,
  onQuitToMenu,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(fullscreenManager.isFullscreen());

  const handleFullscreen = async () => {
    await fullscreenManager.toggle();
    setIsFullscreen(fullscreenManager.isFullscreen());
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="w-full max-w-sm bg-[#0c0c10] border border-white/20 p-6 text-white text-center font-mono-numbers">
        {/* Emblem */}
        <div className="w-10 h-10 border border-white/40 flex items-center justify-center mx-auto mb-3">
          <div className="w-4 h-4 bg-white" />
        </div>

        <h2 className="text-xl font-extrabold uppercase tracking-widest text-white mb-1">
          Tactical Pause
        </h2>
        <p className="text-xs text-white/50 mb-6">
          Simulation frozen. All firing and recharge timers suspended.
        </p>

        <div className="space-y-2 text-xs">
          <button
            onClick={onResume}
            className="w-full py-3 bg-white text-black font-extrabold uppercase tracking-wider hover:bg-white/90 transition-all flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Resume Combat</span>
          </button>

          <button
            onClick={onRestart}
            className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/20 transition-all flex items-center justify-center gap-2 uppercase tracking-wider"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restart Match</span>
          </button>

          <button
            onClick={onOpenSettings}
            className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/20 transition-all flex items-center justify-center gap-2 uppercase tracking-wider"
          >
            <SettingsIcon className="w-3.5 h-3.5" />
            <span>Settings</span>
          </button>

          {fullscreenManager.getSupported() && (
            <button
              onClick={handleFullscreen}
              className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/20 transition-all flex items-center justify-center gap-2 uppercase tracking-wider text-white/80"
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
            </button>
          )}

          <button
            onClick={onQuitToMenu}
            className="w-full py-2.5 bg-red-950/30 hover:bg-red-950/60 text-red-300 border border-red-500/30 transition-all flex items-center justify-center gap-2 uppercase tracking-wider mt-4"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Surrender / Main Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
};
