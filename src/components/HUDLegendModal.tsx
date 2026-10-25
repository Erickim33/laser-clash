/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, Shield, Zap, Crosshair, Compass, RotateCw, AlertTriangle, Eye } from 'lucide-react';
import { settingsStore } from '../utils/settingsStore';

interface HUDLegendModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HUDLegendModal: React.FC<HUDLegendModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const handleDismiss = () => {
    settingsStore.updateSettings({ hasSeenHUDPrimer: true });
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm cursor-pointer scanlines font-mono-numbers"
      onClick={handleDismiss}
    >
      <div 
        className="relative w-full max-w-2xl bg-[#0c0d14] border border-white/20 p-6 rounded-none text-white shadow-2xl overflow-y-auto max-h-[90vh] cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
          <div>
            <h2 className="text-xl font-bold tracking-wider uppercase">
              HUD Primer · Battle Royale & Overload Protocol
            </h2>
            <p className="text-xs text-white/50 mt-0.5">
              Multiplayer survival rules, environmental laser puzzles, and tactical combat
            </p>
          </div>
          <button 
            onClick={handleDismiss}
            className="p-1.5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Legend Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* 1. Free Movement & Aiming */}
          <div className="border border-white/10 p-3.5 bg-white/[0.02]">
            <div className="flex items-center gap-2 mb-2">
              <Compass className="w-5 h-5 text-cyan-400" />
              <span className="font-bold text-white text-sm">Movement & Shooting</span>
            </div>
            <p className="text-white/60 leading-relaxed mb-3">
              Pilot your combat cube across the 2,400 × 2,400 arena. Aim with your mouse and fire continuous or charged laser bolts.
            </p>
            <div className="space-y-1 bg-black/40 p-2 border border-white/5 text-[11px]">
              <div className="flex justify-between text-white/80">
                <span>MOVE / AIM</span>
                <span className="text-white font-bold">W, A, S, D / Mouse</span>
              </div>
              <div className="flex justify-between text-white/80">
                <span>FIRE LASER</span>
                <span className="text-white font-bold">Left Click / Touch Button</span>
              </div>
              <div className="flex justify-between text-white/80">
                <span>DASH / SHIELD</span>
                <span className="text-white font-bold">Space / Right-Click (Shift)</span>
              </div>
            </div>
          </div>

          {/* 2. The Overload Protocol Puzzle */}
          <div className="border border-white/10 p-3.5 bg-white/[0.02]">
            <div className="flex items-center gap-2 mb-2 text-cyan-400">
              <Zap className="w-5 h-5 fill-current" />
              <span className="font-bold text-white text-sm">The Overload Protocol</span>
            </div>
            <p className="text-white/60 leading-relaxed mb-2">
              The reactor displays a shared three-node sequence using the Alpha, Beta, Gamma, and Delta terminals. Activate the highlighted next node in the correct order.
            </p>
            <div className="bg-black/40 p-2 border border-white/5 space-y-1 text-[11px]">
              <div className="text-white/80">
                • Move within range of a terminal and press <strong className="text-cyan-400">[E]</strong> to activate it.
              </div>
              <div className="text-white/80">
                • A wrong terminal resets the sequence. Each completed sequence adds 25% core charge.
              </div>
              <div className="text-emerald-400">
                • 100% Core Charge releases an arena-wide EMP that disables all enemy shields!
              </div>
            </div>
          </div>

          {/* 3. Rotating Laser Mirrors */}
          <div className="border border-white/10 p-3.5 bg-white/[0.02]">
            <div className="flex items-center gap-2 mb-2">
              <RotateCw className="w-5 h-5 text-amber-400" />
              <span className="font-bold text-white text-sm">Rotating Mirrors</span>
            </div>
            <p className="text-white/60 leading-relaxed mb-2">
              Metallic chrome mirrors reflect laser attacks using physics-accurate reflection angles.
            </p>
            <div className="bg-black/40 p-2 border border-white/5 text-[11px] text-white/70">
              Mirrors reflect laser attacks. The E key is reserved for the reactor terminals in this build; mirror rotation is not currently wired to an interaction.
            </div>
          </div>

          {/* 4. Shrinking Safe Zone */}
          <div className="border border-white/10 p-3.5 bg-white/[0.02]">
            <div className="flex items-center gap-2 mb-2 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-bold text-white text-sm">Shrinking Safe Zone</span>
            </div>
            <p className="text-white/60 leading-relaxed mb-2">
              To prevent stalemates, the electric perimeter collapses inward in 4 distinct phases.
            </p>
            <div className="bg-black/40 p-2 border border-white/5 text-[11px] text-white/70">
              Remaining outside the safe zone causes ticking storm damage that penetrates shields. Always keep an eye on the top timer!
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
          <span className="text-xs text-white/40">Be the last player standing to achieve Victory Royale.</span>
          <button
            onClick={handleDismiss}
            className="px-5 py-2 bg-white text-black font-extrabold uppercase tracking-wider text-xs hover:bg-white/90"
          >
            Acknowledge & Close
          </button>
        </div>
      </div>
    </div>
  );
};
