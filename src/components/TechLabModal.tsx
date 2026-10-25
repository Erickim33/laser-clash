/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Cpu,
  Shield,
  Zap,
  Crosshair,
  ShieldAlert,
  Sparkles,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { META_UPGRADES, getMetaUpgradeCost, MetaUpgradeConfig } from '../data/balanceConfig';
import { statsStore } from '../utils/statsStore';
import { audioManager } from '../audio/AudioManager';
import { HapticsManager } from '../utils/haptics';

interface TechLabModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const UPGRADE_ICONS: Record<string, React.ReactNode> = {
  hull_plating: <Shield className="w-5 h-5 text-emerald-400" />,
  shield_capacitor: <ShieldAlert className="w-5 h-5 text-[#38bdf8]" />,
  blaster_overclock: <Zap className="w-5 h-5 text-amber-400" />,
  core_bastion: <Crosshair className="w-5 h-5 text-indigo-400" />,
  stasis_phase_shift: <Sparkles className="w-5 h-5 text-orange-400" />,
};

export const TechLabModal: React.FC<TechLabModalProps> = ({ isOpen, onClose }) => {
  const [stats, setStats] = useState(statsStore.getStats());

  useEffect(() => {
    const unsub = statsStore.subscribe((s) => setStats(s));
    return () => unsub();
  }, []);

  if (!isOpen) return null;

  const handlePurchase = (upgrade: MetaUpgradeConfig) => {
    const currentLevel = stats.metaUpgrades[upgrade.id] || 0;
    if (currentLevel >= upgrade.maxLevel) return;

    const cost = getMetaUpgradeCost(upgrade.id, currentLevel);
    if (stats.techCredits < cost) return;

    const success = statsStore.purchaseMetaUpgrade(upgrade.id, cost, upgrade.maxLevel);
    if (success) {
      audioManager.playUpgrade();
      HapticsManager.trigger('purchase');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm scanlines">
      <div className="relative w-full max-w-2xl bg-[#0a0a0f] border border-white/20 p-6 shadow-[0_0_50px_rgba(0,0,0,0.8)] font-mono-numbers text-white flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 border border-cyan-400/50 bg-cyan-950/30 flex items-center justify-center text-cyan-400">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold uppercase tracking-widest text-white flex items-center gap-2">
                Cybernetics Tech Lab
                <span className="text-[10px] px-2 py-0.5 border border-cyan-400/40 text-cyan-400 bg-cyan-950/40">
                  Permanent Meta-Progression
                </span>
              </h2>
              <p className="text-xs text-white/50">
                Enhance your combat cube and core matrices between sector runs.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/20 transition-all"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Balance Status Banner */}
        <div className="my-4 p-3 bg-white/[0.03] border border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-xs uppercase text-white/60">Available Tech Credits:</span>
          </div>
          <div className="text-lg font-bold text-amber-400 tracking-wider">
            {stats.techCredits.toLocaleString()} <span className="text-xs text-white/40">TC</span>
          </div>
        </div>

        {/* Upgrade Cards List */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-3">
          {Object.values(META_UPGRADES).map((upgrade) => {
            const currentLevel = stats.metaUpgrades[upgrade.id] || 0;
            const isMaxed = currentLevel >= upgrade.maxLevel;
            const nextCost = isMaxed ? 0 : getMetaUpgradeCost(upgrade.id, currentLevel);
            const canAfford = stats.techCredits >= nextCost && !isMaxed;

            return (
              <div
                key={upgrade.id}
                className={`p-4 border transition-all ${
                  isMaxed
                    ? 'border-emerald-500/30 bg-emerald-950/10'
                    : canAfford
                    ? 'border-white/20 bg-white/[0.02] hover:border-white/40'
                    : 'border-white/10 bg-white/[0.01] opacity-75'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 border border-white/10 bg-black/40 shrink-0 mt-0.5">
                      {UPGRADE_ICONS[upgrade.id] || <Cpu className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white uppercase tracking-wide">
                          {upgrade.name}
                        </span>
                        <span className="text-[10px] text-white/50 px-1.5 py-0.5 border border-white/10">
                          {upgrade.bonusText}
                        </span>
                      </div>
                      <p className="text-xs text-white/60 mt-1 max-w-md leading-relaxed">
                        {upgrade.description}
                      </p>

                      {/* Level Pips */}
                      <div className="flex items-center gap-1.5 mt-2.5">
                        <span className="text-[10px] uppercase text-white/40 mr-1">Rank:</span>
                        {Array.from({ length: upgrade.maxLevel }).map((_, idx) => (
                          <div
                            key={idx}
                            className={`w-3.5 h-2 border ${
                              idx < currentLevel
                                ? 'bg-cyan-400 border-cyan-300 shadow-[0_0_6px_rgba(56,189,248,0.5)]'
                                : 'bg-transparent border-white/20'
                            }`}
                          />
                        ))}
                        <span className="text-[11px] text-white/60 font-bold ml-1">
                          {currentLevel} / {upgrade.maxLevel}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Purchase CTA */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 border-t sm:border-t-0 border-white/10 pt-2 sm:pt-0">
                    {!isMaxed && (
                      <div className="text-xs text-white/60">
                        Cost:{' '}
                        <span className={canAfford ? 'text-amber-400 font-bold' : 'text-red-400 font-bold'}>
                          {nextCost} TC
                        </span>
                      </div>
                    )}

                    <button
                      disabled={!canAfford || isMaxed}
                      onClick={() => handlePurchase(upgrade)}
                      className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 whitespace-nowrap ${
                        isMaxed
                          ? 'border border-emerald-500/40 text-emerald-400 bg-emerald-950/20 cursor-default'
                          : canAfford
                          ? 'bg-cyan-400 text-black hover:bg-cyan-300 active:scale-95 shadow-[0_0_15px_rgba(56,189,248,0.3)]'
                          : 'border border-white/10 text-white/30 bg-white/[0.02] cursor-not-allowed'
                      }`}
                    >
                      {isMaxed ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>MAX RANK</span>
                        </>
                      ) : canAfford ? (
                        <>
                          <Zap className="w-3.5 h-3.5 fill-current" />
                          <span>RESEARCH</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5" />
                          <span>NEED TC</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="pt-4 mt-4 border-t border-white/10 flex items-center justify-between text-xs text-white/40 shrink-0">
          <span>Earn Tech Credits by destroying enemies and conquering sector Overcores.</span>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-white/20 hover:border-white/50 text-white transition-all uppercase"
          >
            Close Lab
          </button>
        </div>
      </div>
    </div>
  );
};
