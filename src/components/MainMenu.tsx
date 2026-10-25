/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Play,
  Settings as SettingsIcon,
  HelpCircle,
  Maximize2,
  Minimize2,
  Trophy,
  Star,
  Target,
  Compass,
  Cpu,
  Shield,
  Layers,
  ChevronRight
} from 'lucide-react';
import { Difficulty, PersistentStats } from '../types/game';
import { statsStore } from '../utils/statsStore';
import { fullscreenManager } from '../utils/fullscreen';
import { SECTOR_NAMES } from '../data/balanceConfig';

interface MainMenuProps {
  onStartMatch: (difficulty: Difficulty, sector: number) => void;
  onOpenSettings: () => void;
  onOpenHUDLegend: () => void;
  onOpenTechLab: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  onStartMatch,
  onOpenSettings,
  onOpenHUDLegend,
  onOpenTechLab,
}) => {
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('normal');
  const [selectedSector, setSelectedSector] = useState<number>(1);
  const [stats, setStats] = useState<PersistentStats>(statsStore.getStats());
  const [isFullscreen, setIsFullscreen] = useState(fullscreenManager.isFullscreen());

  useEffect(() => {
    const unsubStats = statsStore.subscribe((s) => {
      setStats(s);
      if (selectedSector > s.highestSector) {
        setSelectedSector(s.highestSector);
      }
    });
    const unsubFs = fullscreenManager.subscribe((fs) => setIsFullscreen(fs));
    return () => {
      unsubStats();
      unsubFs();
    };
  }, [selectedSector]);

  const handleFullscreen = async () => {
    await fullscreenManager.toggle();
    setIsFullscreen(fullscreenManager.isFullscreen());
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const currentSectorData = SECTOR_NAMES[selectedSector] || SECTOR_NAMES[1];

  return (
    <div className="relative w-full h-full flex flex-col justify-between bg-[#07070a] text-white overflow-hidden scanlines">
      {/* Top Bar Contract: Brand Wordmark, Nav Links, Primary CTA */}
      <header className="flex items-center justify-between gap-4 px-6 py-3.5 border-b border-white/10 z-10 bg-[#07070a]/90 backdrop-blur-md">
        {/* Zone 1: Brand wordmark */}
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-white flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-cyan-400" />
          </div>
          <span className="text-base font-extrabold tracking-widest text-white uppercase whitespace-nowrap shrink-0 font-mono-numbers">
            LASER CLASH
          </span>
        </div>

        {/* Zone 2: Navigation links */}
        <nav className="flex items-center gap-4 text-xs font-mono-numbers text-white/70">
          <button
            onClick={onOpenTechLab}
            className="flex items-center gap-1.5 px-3 py-1 bg-cyan-950/40 border border-cyan-400/50 text-cyan-300 hover:bg-cyan-900/40 transition-all font-bold whitespace-nowrap shrink-0 shadow-[0_0_10px_rgba(56,189,248,0.2)]"
          >
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span>Tech Lab</span>
            <span className="text-amber-400 ml-1">({stats.techCredits} TC)</span>
          </button>

          <button
            onClick={onOpenHUDLegend}
            className="hidden sm:flex hover:text-white transition-colors items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>HUD Primer</span>
          </button>
          <button
            onClick={onOpenSettings}
            className="hidden sm:flex hover:text-white transition-colors items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <SettingsIcon className="w-3.5 h-3.5" />
            <span>Settings</span>
          </button>
          {fullscreenManager.getSupported() && (
            <button
              onClick={handleFullscreen}
              className="hidden md:flex hover:text-white transition-colors items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
            </button>
          )}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onStartMatch(selectedDifficulty, selectedSector)}
            className="px-4 py-2 text-xs font-bold font-mono-numbers uppercase tracking-wider text-black bg-white hover:bg-white/90 transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-[0_0_15px_rgba(255,255,255,0.3)]"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Launch Sector {selectedSector}</span>
          </button>
        </div>
      </header>

      {/* Main Hero & Launch Deck */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-6 z-10 max-w-2xl mx-auto w-full text-center overflow-y-auto">
        {/* Kinetic Geometric Core Emblem with Star Motif */}
        <div className="relative mb-4 shrink-0">
          <div className="w-20 h-20 border border-white/20 flex items-center justify-center animate-[spin_14s_linear_infinite]">
            <div className="w-14 h-14 border-2 border-cyan-400/60 flex items-center justify-center animate-[spin_7s_linear_infinite_reverse]">
              <div className="w-7 h-7 bg-white shadow-[0_0_20px_#38bdf8] flex items-center justify-center">
                <Star className="w-3.5 h-3.5 text-black fill-black" />
              </div>
            </div>
          </div>
          <div className="absolute top-1/2 left-[-20px] right-[-20px] h-px bg-white/20 -translate-y-1/2 pointer-events-none" />
          <div className="absolute left-1/2 top-[-20px] bottom-[-20px] w-px bg-white/20 -translate-x-1/2 pointer-events-none" />
        </div>

        <h1 className="text-2xl md:text-3xl font-extrabold uppercase tracking-tight text-white font-mono-numbers mb-1">
          Sector Assault & Overcore Siege
        </h1>
        <p className="text-xs text-white/60 max-w-lg mx-auto mb-4 font-mono-numbers leading-relaxed">
          Defend your allied base energy core, dodge stasis traps, hunt down the enemy Overcore, and shatter its rotating energy shields before your core falls!
        </p>

        {/* Feature Highlights Pills / Tags */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-4 text-[11px] font-mono-numbers text-white/70">
          <span className="flex items-center gap-1 px-2.5 py-1 bg-white/[0.04] border border-white/10">
            <Shield className="w-3 h-3 text-[#38bdf8]" /> Shields & Cover Bunkers
          </span>
          <span className="flex items-center gap-1 px-2.5 py-1 bg-white/[0.04] border border-white/10">
            <Star className="w-3 h-3 text-amber-400 fill-amber-400" /> 10s Star 3-Blaster Boost
          </span>
          <span className="flex items-center gap-1 px-2.5 py-1 bg-white/[0.04] border border-white/10">
            <Target className="w-3 h-3 text-red-400" /> Enemy Overcore Boss
          </span>
        </div>

        {/* Sector Campaign Selection */}
        <div className="w-full mb-4 bg-white/[0.02] border border-white/10 p-3 text-left">
          <div className="flex items-center justify-between text-[11px] font-mono-numbers text-white/50 uppercase tracking-widest mb-2">
            <span className="flex items-center gap-1.5 text-cyan-300 font-bold">
              <Layers className="w-3.5 h-3.5" /> Sector Selection
            </span>
            <span>Unlocked: {stats.highestSector} / 4</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
            {[1, 2, 3, 4].map((sec) => {
              const isUnlocked = sec <= stats.highestSector;
              const isSelected = selectedSector === sec;
              return (
                <button
                  key={sec}
                  disabled={!isUnlocked}
                  onClick={() => setSelectedSector(sec)}
                  className={`py-2 px-2.5 border text-xs font-mono-numbers uppercase tracking-wider transition-all flex flex-col items-center justify-center ${
                    isSelected
                      ? 'border-cyan-400 bg-cyan-950/40 text-cyan-300 font-bold shadow-[0_0_12px_rgba(56,189,248,0.3)]'
                      : isUnlocked
                      ? 'border-white/20 bg-white/[0.02] text-white/80 hover:border-white/40 hover:text-white'
                      : 'border-white/5 bg-transparent text-white/20 cursor-not-allowed'
                  }`}
                >
                  <span className="text-[10px] text-white/40">SEC 0{sec}</span>
                  <span className="font-extrabold">{isUnlocked ? `Sector ${sec}` : 'Locked'}</span>
                </button>
              );
            })}
          </div>

          <div className="text-[11px] font-mono-numbers text-white/70 flex items-center justify-between pt-2 border-t border-white/10">
            <span className="font-bold text-white">{currentSectorData.name}</span>
            <span className="text-red-400">Boss: {currentSectorData.bossName}</span>
          </div>
          <div className="text-[10px] text-white/50 mt-0.5">
            {currentSectorData.subtitle}
          </div>
        </div>

        {/* Difficulty Selection */}
        <div className="w-full mb-4">
          <div className="grid grid-cols-3 gap-2">
            {(['easy', 'normal', 'hard'] as Difficulty[]).map((diff) => {
              const isSelected = selectedDifficulty === diff;
              return (
                <button
                  key={diff}
                  onClick={() => setSelectedDifficulty(diff)}
                  className={`py-2 px-3 border text-xs font-mono-numbers uppercase tracking-wider transition-all ${
                    isSelected
                      ? 'border-white bg-white text-black font-bold shadow-[0_0_10px_rgba(255,255,255,0.25)]'
                      : 'border-white/20 bg-white/[0.02] text-white/70 hover:border-white/50 hover:text-white'
                  }`}
                >
                  {diff}
                </button>
              );
            })}
          </div>
        </div>

        {/* Primary Action Launch Button */}
        <button
          onClick={() => onStartMatch(selectedDifficulty, selectedSector)}
          className="w-full py-3.5 bg-white text-black font-extrabold text-sm uppercase tracking-widest hover:bg-white/90 active:scale-[0.99] transition-all flex items-center justify-center gap-2 font-mono-numbers shadow-[0_0_25px_rgba(255,255,255,0.35)] shrink-0"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>Launch Sector {selectedSector} ({selectedDifficulty.toUpperCase()})</span>
        </button>

        {/* Mobile Quick Action Buttons */}
        <div className="flex md:hidden items-center justify-center gap-3 mt-4 text-xs font-mono-numbers text-white/60 shrink-0">
          <button onClick={onOpenTechLab} className="flex items-center gap-1 text-cyan-400 font-bold">
            <Cpu className="w-3.5 h-3.5" /> Tech Lab
          </button>
          <span>·</span>
          <button onClick={onOpenHUDLegend} className="flex items-center gap-1 hover:text-white">
            <HelpCircle className="w-3.5 h-3.5" /> HUD Primer
          </button>
          <span>·</span>
          <button onClick={onOpenSettings} className="flex items-center gap-1 hover:text-white">
            <SettingsIcon className="w-3.5 h-3.5" /> Settings
          </button>
        </div>
      </main>

      {/* Persistent Session Stats Compact Strip */}
      <footer className="border-t border-white/10 bg-[#09090d]/90 py-2.5 px-6 z-10 font-mono-numbers text-xs shrink-0">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-white/60">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span className="uppercase tracking-wider text-[11px] text-white/40">Record:</span>
            <span className="text-white font-bold">{stats.bestScore.toLocaleString()} PTS</span>
            <span className="text-white/40">·</span>
            <span className="text-white/80">Best Time: {formatTime(stats.bestSurvivalTime)}</span>
          </div>

          <div className="flex items-center gap-4 text-white/60">
            <div className="flex items-center gap-1.5">
              <span className="text-white/40 text-[11px] uppercase">Tech Credits:</span>
              <span className="text-amber-400 font-bold">{stats.techCredits} TC</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5">
              <span className="text-white/40 text-[11px] uppercase">Total Kills:</span>
              <span className="text-white font-medium">{stats.totalEnemiesKilled}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
