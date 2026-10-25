/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  RotateCcw,
  Home,
  Trophy,
  Star,
  Zap,
  Clock,
  Sparkles,
  ChevronRight,
  ShieldAlert,
  Award,
  Cpu,
  ArrowRight
} from 'lucide-react';
import { MatchResult, UpgradeType } from '../types/game';
import { statsStore } from '../utils/statsStore';
import { SECTOR_NAMES } from '../data/balanceConfig';

interface ResultsViewProps {
  result: MatchResult;
  onRematch: () => void;
  onReturnToMenu: () => void;
  onNextSector?: () => void;
  onOpenTechLab?: () => void;
  playerUpgrades: Record<UpgradeType, number>;
}

export const ResultsView: React.FC<ResultsViewProps> = ({
  result,
  onRematch,
  onReturnToMenu,
  onNextSector,
  onOpenTechLab,
  playerUpgrades,
}) => {
  const [isNewBest, setIsNewBest] = useState(false);

  useEffect(() => {
    const recorded = statsStore.recordMatch(result, playerUpgrades);
    setIsNewBest(recorded.isNewBestScore);
  }, [result, playerUpgrades]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const isVictory = result.winner === 'player' && result.enemyCoreDestroyed;
  const sectorInfo = SECTOR_NAMES[result.sector || 1] || SECTOR_NAMES[1];
  const nextSectorNumber = Math.min(4, (result.sector || 1) + 1);
  const nextSectorInfo = SECTOR_NAMES[nextSectorNumber];
  const canAdvance = isVictory && (result.sector || 1) < 4;

  return (
    <div className="relative w-full h-full flex flex-col justify-center items-center p-4 bg-[#07070a] text-white scanlines overflow-y-auto">
      <div className="w-full max-w-lg bg-[#0c0c10] border border-white/20 p-6 shadow-2xl font-mono-numbers my-auto">
        {/* Outcome Header Banner */}
        <div className="text-center pb-5 border-b border-white/10">
          <div
            className={`inline-flex items-center justify-center p-3 border-2 mb-3 ${
              isVictory
                ? 'border-emerald-400 bg-emerald-950/40 text-emerald-300 shadow-[0_0_20px_rgba(52,211,153,0.3)]'
                : 'border-red-500 bg-red-950/40 text-red-400'
            }`}
          >
            {isVictory ? (
              <Award className="w-6 h-6 fill-emerald-400/20" />
            ) : (
              <ShieldAlert className="w-6 h-6" />
            )}
          </div>

          <h1
            className={`text-2xl sm:text-3xl font-extrabold uppercase tracking-widest mb-1 ${
              isVictory ? 'text-emerald-300' : 'text-white'
            }`}
          >
            {isVictory
              ? 'SECTOR LIBERATED!'
              : result.alliedCoreDestroyed
              ? 'ALLIED CORE OBLITERATED'
              : 'MISSION TERMINATED'}
          </h1>

          <p className="text-xs text-white/50 uppercase tracking-wider">
            {isVictory
              ? `Enemy Overcore Destroyed · ${sectorInfo.name}`
              : result.alliedCoreDestroyed
              ? 'Your Energy Base Was Breached & Destroyed'
              : `Combat Unit Eliminated · Survived ${formatTime(result.survivalTimeSeconds)}`}
          </p>

          {/* Tech Credits Reward Callout */}
          <div className="mt-3 inline-flex items-center gap-2 px-3.5 py-1.5 bg-amber-500/10 border border-amber-400/50 text-amber-300 text-xs font-bold uppercase tracking-widest">
            <Sparkles className="w-3.5 h-3.5" />
            <span>+{result.techCreditsEarned || 0} Tech Credits Awarded</span>
          </div>

          {/* New Best Score Callout */}
          {isNewBest && (
            <div className="mt-2 block">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-cyan-500/20 border border-cyan-400 text-cyan-300 text-xs font-bold uppercase tracking-widest animate-bounce">
                <Trophy className="w-3.5 h-3.5" />
                <span>New Personal High Score!</span>
              </span>
            </div>
          )}
        </div>

        {/* Combat Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 my-5 text-xs">
          {/* Final Score */}
          <div className="p-3 bg-white/[0.02] border border-white/10">
            <div className="flex items-center gap-1.5 text-white/50 text-[10px] uppercase mb-1">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>Final Score</span>
            </div>
            <div className="text-xl font-bold text-white">
              {result.score.toLocaleString()} PTS
            </div>
            <div className="text-[10px] text-white/40 mt-0.5">
              Threat: {result.difficulty.toUpperCase()}
            </div>
          </div>

          {/* Weapon Evolution */}
          <div className="p-3 bg-white/[0.02] border border-white/10">
            <div className="flex items-center gap-1.5 text-white/50 text-[10px] uppercase mb-1">
              <Star className="w-3.5 h-3.5 text-[#38bdf8]" />
              <span>Evolution</span>
            </div>
            <div className="text-xl font-bold text-[#38bdf8]">
              Lv.{result.weaponLevelReached}
            </div>
            <div className="text-[10px] text-white/50 mt-0.5">
              {result.bulletsPerShot}x Bullet Spread
            </div>
          </div>

          {/* Enemies Eliminated */}
          <div className="p-3 bg-white/[0.02] border border-white/10">
            <div className="flex items-center gap-1.5 text-white/50 text-[10px] uppercase mb-1">
              <Zap className="w-3.5 h-3.5 text-white" />
              <span>Enemies Destroyed</span>
            </div>
            <div className="text-xl font-bold text-white">
              {result.enemiesKilled}
            </div>
            <div className="text-[10px] text-white/40 mt-0.5">
              Player Level: {result.playerLevelReached}
            </div>
          </div>

          {/* Stars & Survival */}
          <div className="p-3 bg-white/[0.02] border border-white/10">
            <div className="flex items-center gap-1.5 text-white/50 text-[10px] uppercase mb-1">
              <Clock className="w-3.5 h-3.5 text-white" />
              <span>Time & Stars</span>
            </div>
            <div className="text-xl font-bold text-white">
              {result.starsCollected} ★
            </div>
            <div className="text-[10px] text-white/40 mt-0.5">
              Time: {formatTime(result.survivalTimeSeconds)}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2 text-xs">
          {/* If victory & next sector available, show Primary Advance button */}
          {canAdvance && onNextSector ? (
            <button
              onClick={onNextSector}
              className="w-full py-3.5 bg-emerald-400 text-black font-extrabold uppercase tracking-widest hover:bg-emerald-300 active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(52,211,153,0.35)]"
            >
              <span>Deploy to {nextSectorInfo.name}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={onRematch}
              className="w-full py-3.5 bg-white text-black font-extrabold uppercase tracking-widest hover:bg-white/90 active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.3)]"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{isVictory ? 'Re-Play Sector Run' : 'Engage New Run'}</span>
            </button>
          )}

          {/* Tech Lab button */}
          {onOpenTechLab && (
            <button
              onClick={onOpenTechLab}
              className="w-full py-3 bg-cyan-950/40 hover:bg-cyan-900/40 border border-cyan-400/50 text-cyan-300 transition-all flex items-center justify-center gap-2 uppercase tracking-wider font-bold"
            >
              <Cpu className="w-4 h-4" />
              <span>Open Tech Lab (Spend Credits)</span>
            </button>
          )}

          <button
            onClick={onReturnToMenu}
            className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/20 transition-all flex items-center justify-center gap-2 uppercase tracking-wider text-white/80"
          >
            <Home className="w-4 h-4" />
            <span>Return to Main Menu</span>
            <ChevronRight className="w-3.5 h-3.5 text-white/40" />
          </button>
        </div>
      </div>
    </div>
  );
};
