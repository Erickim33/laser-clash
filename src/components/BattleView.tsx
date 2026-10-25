/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Pause,
  Shield,
  Zap,
  Crosshair,
  Sparkles,
  AlertTriangle,
  Compass,
  Star,
  Target
} from 'lucide-react';
import { CombatSimulation, InputState } from '../combat/CombatSimulation';
import { CanvasRenderer } from '../combat/CanvasRenderer';
import { TutorialController } from '../tutorial/TutorialController';
import { KillCamOverlay } from './KillCamOverlay';
import { PauseMenu } from './PauseMenu';
import {
  Difficulty,
  GameSettings,
  MatchResult,
  ReplayFrame,
  UpgradeType
} from '../types/game';
import { settingsStore } from '../utils/settingsStore';
import { UPGRADE_DEFINITIONS, getUpgradeCost, GAME_CONSTANTS } from '../data/balanceConfig';
import { audioManager } from '../audio/AudioManager';

interface BattleViewProps {
  difficulty: Difficulty;
  sector?: number;
  isUnlimited?: boolean;
  onMatchComplete: (result: MatchResult, upgrades: Record<UpgradeType, number>) => void;
  onQuitToMenu: () => void;
  onOpenSettings: () => void;
}

export const BattleView: React.FC<BattleViewProps> = ({
  difficulty,
  sector = 1,
  isUnlimited = false,
  onMatchComplete,
  onQuitToMenu,
  onOpenSettings,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [sim, setSim] = useState<CombatSimulation | null>(null);
  const [renderer, setRenderer] = useState<CanvasRenderer | null>(null);
  const [settings, setSettings] = useState<GameSettings>(settingsStore.getSettings());
  const [isPaused, setIsPaused] = useState(false);

  // Input state
  const inputRef = useRef<InputState>({
    up: false,
    down: false,
    left: false,
    right: false,
    joyX: 0,
    joyY: 0,
  });

  // Virtual Joystick state for mobile
  const [joystickPos, setJoystickPos] = useState<{ x: number; y: number } | null>(null);
  const joystickCenterRef = useRef<{ x: number; y: number } | null>(null);

  // Kill-Cam state (Section 22)
  const [isPlayingKillCam, setIsPlayingKillCam] = useState(false);
  const [killCamFrames, setKillCamFrames] = useState<ReplayFrame[]>([]);
  const [pendingMatchResult, setPendingMatchResult] = useState<MatchResult | null>(null);

  // Aiming state for Overdrive Beam
  const [isAiming, setIsAiming] = useState(false);
  const [aimPoint, setAimPoint] = useState<{ x: number; y: number } | null>(null);

  // Tick for UI state synchronization
  const [, setTick] = useState(0);

  // Initialize Combat Simulation
  const initSimulation = useCallback(() => {
    const tutController = new TutorialController();
    const newSim = new CombatSimulation(
      difficulty,
      tutController,
      (result: MatchResult) => {
        if (isUnlimited) {
          // In unlimited mode, player revives and continues indefinitely!
          return;
        }

        // Check for clean kill replay (Section 22)
        if (result.hadCleanKill) {
          const frames = newSim.replayBuffer.getFinalKillSequence(2.5);
          if (frames.length > 5) {
            setKillCamFrames(frames);
            setPendingMatchResult(result);
            setIsPlayingKillCam(true);
            return;
          }
        }
        onMatchComplete(result, {
          damage: newSim.player.baseDamage > 16 ? 1 : 0,
          fire_rate: newSim.player.fireInterval < 0.38 ? 1 : 0,
          armor: newSim.player.armorLevel,
          generator: newSim.player.generatorLevel,
          piercing: newSim.player.piercingLevel,
          overdrive: newSim.player.overdriveUnlocked ? 1 : 0,
        });
      },
      sector
    );

    newSim.isUnlimited = isUnlimited;
    setSim(newSim);
    setIsPaused(false);
    setIsPlayingKillCam(false);
    audioManager.startCombatDrone();
  }, [difficulty, isUnlimited, onMatchComplete, sector]);

  useEffect(() => {
    initSimulation();
    const unsub = settingsStore.subscribe((s) => setSettings(s));
    return () => {
      unsub();
      audioManager.stopCombatMusic();
    };
  }, [initSimulation]);

  // Keyboard controls for WASD and Arrow Keys (Section 1)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isPaused || isPlayingKillCam || !sim) {
        if (e.key === 'Escape') {
          setIsPaused(!isPaused);
          if (sim) sim.isPaused = !isPaused;
        }
        return;
      }

      if (isUnlimited && sim.player.isDead && (e.code === 'Space' || e.code === 'Enter')) {
        sim.revivePlayer();
        return;
      }

      if (e.key === 'Escape') {
        setIsPaused(true);
        sim.isPaused = true;
        return;
      }

      // Movement keys
      const key = e.key.toLowerCase();
      if (key === 'w' || e.key === 'ArrowUp') inputRef.current.up = true;
      if (key === 's' || e.key === 'ArrowDown') inputRef.current.down = true;
      if (key === 'a' || e.key === 'ArrowLeft') inputRef.current.left = true;
      if (key === 'd' || e.key === 'ArrowRight') inputRef.current.right = true;

      // Quick upgrade shortcuts 1-6
      const keyMap: Record<string, UpgradeType> = {
        '1': 'damage',
        '2': 'fire_rate',
        '3': 'armor',
        '4': 'generator',
        '5': 'piercing',
        '6': 'overdrive',
      };
      if (keyMap[e.key]) {
        sim.purchaseUpgrade(keyMap[e.key]);
      }

      // Space activates Overdrive Beam or Shield
      if (e.code === 'Space') {
        e.preventDefault();
        if (sim.player.overdriveUnlocked && sim.player.overdriveCooldownRemaining <= 0) {
          sim.activateAbility('overdrive_beam');
        } else if (sim.player.shieldCooldownRemaining <= 0) {
          sim.activateAbility('pulse_shield');
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'w' || e.key === 'ArrowUp') inputRef.current.up = false;
      if (key === 's' || e.key === 'ArrowDown') inputRef.current.down = false;
      if (key === 'a' || e.key === 'ArrowLeft') inputRef.current.left = false;
      if (key === 'd' || e.key === 'ArrowRight') inputRef.current.right = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [sim, isPaused, isPlayingKillCam]);

  // Canvas Resize and 60fps Render Loop
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current || !sim) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rend = new CanvasRenderer(ctx);
    setRenderer(rend);

    const handleResize = () => {
      if (!containerRef.current || !canvas) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);

      rend.resize(rect.width, rect.height);
      sim.setViewport(rect.width, rect.height);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    let lastTime = performance.now();
    let animId: number;

    const loop = (currentTime: number) => {
      const delta = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      if (!isPlayingKillCam) {
        sim.update(delta, inputRef.current);
        rend.render(sim, settings, isAiming ? aimPoint : null);
        setTick((t) => (t + 1) % 60);
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [sim, settings, isAiming, aimPoint, isPlayingKillCam]);

  // Pointer aiming in world space
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isPaused || isPlayingKillCam || !sim) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Convert screen coordinates to world coordinates via camera offset
    const worldX = screenX + sim.camera.x;
    const worldY = screenY + sim.camera.y;

    if (sim.player.overdriveUnlocked && sim.player.overdriveCooldownRemaining <= 0) {
      setIsAiming(true);
      setAimPoint({ x: worldX, y: worldY });
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isAiming || !sim) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setAimPoint({
      x: e.clientX - rect.left + sim.camera.x,
      y: e.clientY - rect.top + sim.camera.y,
    });
  };

  const handlePointerUp = () => {
    if (isAiming && sim && aimPoint) {
      sim.activateAbility('overdrive_beam', aimPoint);
    }
    setIsAiming(false);
    setAimPoint(null);
  };

  // Mobile Virtual Joystick Touch Handlers (Section 1)
  const handleTouchStartJoystick = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    joystickCenterRef.current = { x: centerX, y: centerY };
    updateJoystickOffset(touch.clientX, touch.clientY);
  };

  const handleTouchMoveJoystick = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    updateJoystickOffset(touch.clientX, touch.clientY);
  };

  const handleTouchEndJoystick = () => {
    joystickCenterRef.current = null;
    setJoystickPos(null);
    inputRef.current.joyX = 0;
    inputRef.current.joyY = 0;
  };

  const updateJoystickOffset = (clientX: number, clientY: number) => {
    if (!joystickCenterRef.current) return;
    const maxRadius = 45;
    const dx = clientX - joystickCenterRef.current.x;
    const dy = clientY - joystickCenterRef.current.y;
    const dist = Math.hypot(dx, dy);

    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);

    const clampedX = Math.cos(angle) * clampedDist;
    const clampedY = Math.sin(angle) * clampedDist;

    setJoystickPos({ x: clampedX, y: clampedY });

    // Normalized input
    inputRef.current.joyX = clampedX / maxRadius;
    inputRef.current.joyY = clampedY / maxRadius;
  };

  const handleKillCamComplete = () => {
    setIsPlayingKillCam(false);
    if (pendingMatchResult && sim) {
      onMatchComplete(pendingMatchResult, {
        damage: sim.player.baseDamage > 16 ? 1 : 0,
        fire_rate: sim.player.fireInterval < 0.38 ? 1 : 0,
        armor: sim.player.armorLevel,
        generator: sim.player.generatorLevel,
        piercing: sim.player.piercingLevel,
        overdrive: sim.player.overdriveUnlocked ? 1 : 0,
      });
    }
  };

  if (!sim) return null;

  const player = sim.player;
  const hpRatio = Math.max(0, player.health / player.maxHealth);
  const xpRatio = Math.min(1, player.xp / player.xpToNextLevel);
  const isCrit = hpRatio <= 0.25;

  const timeFormatted = `${Math.floor(sim.matchTime / 60)}:${Math.floor(sim.matchTime % 60).toString().padStart(2, '0')}`;

  return (
    <div className="relative w-full h-full flex flex-col bg-[#07070a] text-white select-none overflow-hidden font-mono-numbers">
      {/* Top Fixed Screen HUD: Score by Kills & Overcore Status */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 px-4 py-2 bg-[#0a0a0e]/95 border-b border-white/10 backdrop-blur-md">
        {/* Left: Player Level, Score by Kills, and Kill Count */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2.5 py-1 bg-white/5 border border-white/20">
            <div className="w-5 h-5 border border-white flex items-center justify-center font-bold text-xs text-white">
              {player.playerLevel}
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-white/50 leading-none">LV.{player.playerLevel}</span>
              <div className="w-16 h-1 bg-white/10 border border-white/20 mt-0.5 overflow-hidden">
                <div 
                  className="h-full bg-amber-400 transition-all duration-100" 
                  style={{ width: `${xpRatio * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Prominent Score Counter */}
          <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/20 shadow-[0_0_8px_rgba(255,255,255,0.05)]">
            <Target className="w-3.5 h-3.5 text-[#38bdf8]" />
            <span className="text-[10px] text-white/50 uppercase tracking-wider hidden sm:inline">Score</span>
            <span className="text-sm font-black text-white font-mono-numbers">
              {player.score.toLocaleString()}
            </span>
          </div>

          {/* Prominent Kills Counter */}
          <div className="flex items-center gap-1.5 px-3 py-1 bg-red-950/40 border border-red-500/40">
            <Crosshair className="w-3.5 h-3.5 text-red-400" />
            <span className="text-[10px] text-red-300 uppercase tracking-wider hidden sm:inline">Kills</span>
            <span className="text-sm font-black text-red-400 font-mono-numbers">
              {player.enemiesKilled}
            </span>
          </div>

          {/* Active 10s Triple Blaster Star Boost Countdown in Top Bar */}
          {player.starBoostTimer > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-cyan-950/70 border border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(56,189,248,0.3)]">
              <div className="relative w-4 h-4 flex items-center justify-center">
                <svg className="w-4 h-4 -rotate-90">
                  <circle cx="8" cy="8" r="6" stroke="rgba(255,255,255,0.2)" strokeWidth="2" fill="none" />
                  <circle
                    cx="8" cy="8" r="6"
                    stroke="#38bdf8"
                    strokeWidth="2"
                    fill="none"
                    strokeDasharray="38"
                    strokeDashoffset={38 * (1 - player.starBoostTimer / player.starBoostMaxDuration)}
                  />
                </svg>
              </div>
              <span className="text-[10px] uppercase font-bold text-white hidden sm:inline">3x Shot</span>
              <span className="text-xs font-mono-numbers text-amber-300 font-bold">{player.starBoostTimer.toFixed(1)}s</span>
            </div>
          )}
        </div>

        {/* Center: Enemy Overcore Boss Bar or Wave Warning */}
        {sim.waveWarning ? (
          <div className="flex-1 max-w-xs sm:max-w-md mx-2 flex items-center justify-center px-3 py-1 bg-red-950/80 border border-red-500/60 animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400 mr-1.5 shrink-0" />
            <span className="text-[11px] font-bold text-red-200 tracking-wider uppercase truncate">
              {sim.waveWarning}
            </span>
          </div>
        ) : !sim.enemyCore.isDead ? (
          <div className="flex-1 max-w-xs sm:max-w-md mx-2 flex flex-col justify-center">
            <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-wider mb-0.5">
              <span className="text-red-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-red-400" />
                <span>PRIMARY GOAL: DESTROY OVERCORE</span>
              </span>
              <span className="text-white/80 font-mono-numbers">
                {Math.max(0, Math.round(sim.enemyCore.health))} / {sim.enemyCore.maxHealth}
              </span>
            </div>
            <div className="w-full h-2.5 bg-black/60 border border-red-500/50 overflow-hidden shadow-[0_0_10px_rgba(239,68,68,0.3)]">
              <div 
                className="h-full bg-red-500 transition-all duration-75"
                style={{ width: `${Math.max(0, (sim.enemyCore.health / sim.enemyCore.maxHealth) * 100)}%` }}
              />
            </div>
          </div>
        ) : null}

        {/* Right Info: Sector, Wave, & Pause */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col text-right text-[11px]">
            <span className="text-[#38bdf8] font-bold">SECTOR {sim.sector}</span>
            <span className="text-white/60">WAVE {sim.currentWave} · {timeFormatted}</span>
          </div>

          <button
            onClick={() => {
              setIsPaused(true);
              sim.isPaused = true;
            }}
            className="p-1.5 bg-white/5 hover:bg-white/15 border border-white/20 text-white transition-colors flex items-center gap-1 text-xs"
            aria-label="Pause Combat"
          >
            <Pause className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Pause</span>
          </button>
        </div>
      </div>

      {/* Main Interactive Arena Canvas Viewport (100% clean and unobstructed in center) */}
      <div 
        ref={containerRef} 
        className="relative flex-1 w-full h-full touch-none overflow-hidden"
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="w-full h-full block cursor-crosshair"
        />

        {/* Kill-Cam Replay Overlay (Section 22) */}
        {isPlayingKillCam && (
          <KillCamOverlay
            frames={killCamFrames}
            settings={settings}
            renderer={renderer}
            onComplete={handleKillCamComplete}
          />
        )}

        {/* Mobile Virtual Joystick Area (Section 1) */}
        <div 
          onTouchStart={handleTouchStartJoystick}
          onTouchMove={handleTouchMoveJoystick}
          onTouchEnd={handleTouchEndJoystick}
          className="absolute bottom-6 left-6 z-20 w-32 h-32 rounded-full border border-white/20 bg-white/[0.04] backdrop-blur-xs flex items-center justify-center md:hidden touch-none"
        >
          <div className="w-8 h-8 rounded-full border border-white/40 flex items-center justify-center text-[10px] text-white/40 pointer-events-none">
            <Compass className="w-4 h-4" />
          </div>
          {joystickPos && (
            <div
              className="absolute w-12 h-12 rounded-full bg-white/80 border-2 border-white shadow-[0_0_15px_#ffffff] pointer-events-none"
              style={{
                transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)`,
              }}
            />
          )}
        </div>
      </div>

      {/* Bottom HUD: Player Health, Energy, 6 Upgrades, 3 Abilities */}
      <div className="relative z-10 bg-[#09090d]/95 border-t border-white/10 p-3 backdrop-blur-md">
        {/* Vitality & Energy Row */}
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-4 mb-3">
          {/* Player Shields & Health */}
          <div className="flex items-center gap-2.5 flex-1 min-w-[220px] max-w-sm">
            <div className={`w-6 h-6 border-2 flex items-center justify-center shrink-0 ${
              isCrit 
                ? (settings.colorblindMode ? 'border-amber-400 bg-amber-500/20' : 'border-red-500 bg-red-500/20 animate-pulse') 
                : player.shield > 0 ? 'border-[#38bdf8] bg-[#38bdf8]/10' : 'border-white'
            }`}>
              <Shield className={`w-3.5 h-3.5 ${player.shield > 0 ? 'text-[#38bdf8]' : 'text-white'}`} />
            </div>

            <div className="flex-1">
              {/* Shield Bar */}
              <div className="flex justify-between text-[11px] mb-0.5">
                <span className="text-[#38bdf8] uppercase tracking-wider font-bold flex items-center gap-1">
                  <span>Shield</span>
                  {player.shieldRegenDelay <= 0 && player.shield < player.maxShield && (
                    <span className="text-[9px] text-[#38bdf8]/80 animate-pulse">[RECHARGING]</span>
                  )}
                </span>
                <span className="font-bold text-[#38bdf8]">
                  {Math.round(player.shield)} / {player.maxShield}
                </span>
              </div>
              <div className="w-full h-1.5 bg-white/10 border border-[#38bdf8]/40 overflow-hidden mb-1.5">
                <div
                  className="h-full bg-[#38bdf8] transition-all duration-75"
                  style={{ width: `${Math.max(0, (player.shield / player.maxShield) * 100)}%` }}
                />
              </div>

              {/* Hull Health Bar */}
              <div className="flex justify-between text-[11px] mb-0.5">
                <span className="text-white/70 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                  <span>Hull</span>
                  {isCrit && <span className="text-[10px] font-bold text-amber-400">[CRITICAL]</span>}
                  {player.isInCover && (
                    <span className="text-[9px] font-bold text-[#38bdf8] bg-[#38bdf8]/10 px-1 border border-[#38bdf8]/40">
                      [COVER -20%]
                    </span>
                  )}
                  {player.isTrapped && (
                    <span className="text-[9px] font-bold text-orange-400 bg-orange-950/60 px-1 border border-orange-500 animate-pulse">
                      [STASIS: {player.trappedTimeRemaining.toFixed(1)}s]
                    </span>
                  )}
                </span>
                <span className="font-bold text-white">
                  {Math.round(player.health)} / {player.maxHealth}
                </span>
              </div>
              <div className="w-full h-1.5 bg-white/10 border border-white/30 overflow-hidden">
                <div
                  className={`h-full transition-all duration-100 ${
                    isCrit
                      ? (settings.colorblindMode ? 'bg-amber-400' : 'bg-red-500')
                      : 'bg-white'
                  }`}
                  style={{ width: `${hpRatio * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Allied Base Core Status */}
          {!sim.alliedCore.isDead && (
            <div className="hidden md:flex flex-col flex-1 max-w-[180px] p-2 bg-white/[0.03] border border-white/15">
              <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-wider mb-1">
                <span className="text-white/60">Allied Base Core</span>
                <span className="text-[#38bdf8] font-mono-numbers">
                  {Math.round(sim.alliedCore.health)} HP
                </span>
              </div>
              <div className="w-full h-1.5 bg-white/10 border border-[#38bdf8]/30 overflow-hidden">
                <div 
                  className="h-full bg-[#38bdf8] transition-all duration-100"
                  style={{ width: `${Math.max(0, (sim.alliedCore.health / sim.alliedCore.maxHealth) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Energy Pool Gauge */}
          <div className="flex items-center gap-2 flex-1 min-w-[160px] max-w-xs">
            <Zap className="w-4 h-4 text-[#38bdf8] shrink-0" />
            <div className="flex-1">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-white/60 uppercase tracking-wider text-[11px]">
                  Energy Pool
                </span>
                <span className="font-bold text-[#38bdf8] text-xs">
                  {Math.floor(player.energy)} EN
                </span>
              </div>
              <div className="w-full h-2 bg-white/10 border border-[#38bdf8]/40 overflow-hidden">
                <div
                  className="h-full bg-[#38bdf8] transition-all duration-75"
                  style={{ width: `${Math.min(100, (player.energy / 180) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Unlimited AI Mode Respawn Button */}
        {isUnlimited && player.isDead && (
          <div className="max-w-md mx-auto mb-3 flex items-center justify-center pointer-events-auto">
            <button
              onClick={() => sim.revivePlayer()}
              className="w-full py-2.5 px-4 bg-[#00f0ff] hover:bg-[#38bdf8] text-black font-extrabold uppercase text-xs tracking-widest shadow-[0_0_20px_rgba(0,240,255,0.7)] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4 fill-current" />
              ⚡ RESPAWN &amp; CONTINUE UNLIMITED AI SURVIVAL [SPACE]
            </button>
          </div>
        )}

        {/* Upgrades Strip (GDD 4: 6 Escalating Upgrades) */}
        <div className="max-w-4xl mx-auto grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
          {(['damage', 'fire_rate', 'armor', 'generator', 'piercing', 'overdrive'] as UpgradeType[]).map((type) => {
            const config = UPGRADE_DEFINITIONS[type];
            const currentLevel = (player as unknown as Record<string, number>)[`${type}Level`] || 0;
            const isMax = currentLevel >= config.maxLevel;
            const cost = getUpgradeCost(type, currentLevel);
            const canAfford = player.energy >= cost && !isMax;

            return (
              <button
                key={type}
                onClick={() => sim.purchaseUpgrade(type)}
                disabled={!canAfford || isMax}
                className={`relative p-2 text-left border transition-all text-xs flex flex-col justify-between h-[62px] ${
                  isMax
                    ? 'border-white/10 bg-white/[0.01] opacity-40 cursor-not-allowed'
                    : canAfford
                    ? 'border-white/60 bg-white/10 text-white hover:bg-white/20 hover:border-white shadow-[0_0_8px_rgba(255,255,255,0.15)] active:scale-[0.98]'
                    : 'border-white/10 bg-white/[0.02] text-white/40 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center justify-between w-full text-[10px]">
                  <span className="px-1 py-0.2 bg-white/10 text-white/80 font-bold">
                    [{config.shortcutKey}]
                  </span>
                  <span className="text-white/60 font-semibold">
                    {isMax ? 'MAX' : `Lv.${currentLevel}`}
                  </span>
                </div>
                <div className="font-bold text-[11px] truncate text-white leading-tight">
                  {config.name}
                </div>
                <div className="text-[10px] text-right font-medium">
                  {isMax ? (
                    <span className="text-white/40">COMPLETED</span>
                  ) : (
                    <span className={canAfford ? 'text-[#38bdf8] font-bold' : 'text-white/30'}>
                      {cost} EN
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Tactical Special Abilities */}
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3 pt-2 border-t border-white/5">
          {/* Overdrive Beam */}
          <button
            onClick={() => sim.activateAbility('overdrive_beam')}
            disabled={
              !player.overdriveUnlocked ||
              player.overdriveCooldownRemaining > 0 ||
              player.energy < GAME_CONSTANTS.ABILITIES.OVERDRIVE_BEAM.cost
            }
            className={`flex-1 py-2 px-3 border text-xs flex items-center justify-center gap-2 transition-all ${
              player.overdriveUnlocked &&
              player.overdriveCooldownRemaining <= 0 &&
              player.energy >= GAME_CONSTANTS.ABILITIES.OVERDRIVE_BEAM.cost
                ? 'border-white bg-white text-black font-extrabold shadow-[0_0_15px_rgba(255,255,255,0.4)] hover:bg-white/90 active:scale-[0.98]'
                : 'border-white/10 bg-white/[0.02] text-white/30 cursor-not-allowed'
            }`}
          >
            <Crosshair className="w-4 h-4" />
            <div className="text-left leading-tight">
              <span className="block font-bold text-[11px]">Overdrive Beam</span>
              <span className="text-[9px] opacity-75">
                {!player.overdriveUnlocked
                  ? 'Locked [Buy #6]'
                  : player.overdriveCooldownRemaining > 0
                  ? `Recharge ${Math.ceil(player.overdriveCooldownRemaining)}s`
                  : '50 EN · Burst Laser'}
              </span>
            </div>
          </button>

          {/* Pulse Shield */}
          <button
            onClick={() => sim.activateAbility('pulse_shield')}
            disabled={
              player.shieldCooldownRemaining > 0 ||
              player.energy < GAME_CONSTANTS.ABILITIES.PULSE_SHIELD.cost
            }
            className={`flex-1 py-2 px-3 border text-xs flex items-center justify-center gap-2 transition-all ${
              player.shieldActive
                ? 'border-[#38bdf8] bg-[#38bdf8]/30 text-white font-bold animate-pulse'
                : player.shieldCooldownRemaining <= 0 &&
                  player.energy >= GAME_CONSTANTS.ABILITIES.PULSE_SHIELD.cost
                ? 'border-[#38bdf8] bg-[#38bdf8]/10 text-[#38bdf8] hover:bg-[#38bdf8]/20 font-bold active:scale-[0.98]'
                : 'border-white/10 bg-white/[0.02] text-white/30 cursor-not-allowed'
            }`}
          >
            <Shield className="w-4 h-4" />
            <div className="text-left leading-tight">
              <span className="block font-bold text-[11px]">Pulse Shield</span>
              <span className="text-[9px] opacity-75">
                {player.shieldActive
                  ? `Active (${Math.ceil(player.shieldDurationRemaining)}s)`
                  : player.shieldCooldownRemaining > 0
                  ? `Recharge ${Math.ceil(player.shieldCooldownRemaining)}s`
                  : '40 EN · 75% Absorb'}
              </span>
            </div>
          </button>

          {/* Energy Pulse */}
          <button
            onClick={() => sim.activateAbility('energy_pulse')}
            disabled={
              player.pulseCooldownRemaining > 0 ||
              player.energy < GAME_CONSTANTS.ABILITIES.ENERGY_PULSE.cost
            }
            className={`flex-1 py-2 px-3 border text-xs flex items-center justify-center gap-2 transition-all ${
              player.pulseCooldownRemaining <= 0 &&
              player.energy >= GAME_CONSTANTS.ABILITIES.ENERGY_PULSE.cost
                ? 'border-amber-400 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20 font-bold active:scale-[0.98]'
                : 'border-white/10 bg-white/[0.02] text-white/30 cursor-not-allowed'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <div className="text-left leading-tight">
              <span className="block font-bold text-[11px]">Energy Pulse</span>
              <span className="text-[9px] opacity-75">
                {player.pulseCooldownRemaining > 0
                  ? `Recharge ${Math.ceil(player.pulseCooldownRemaining)}s`
                  : '45 EN · Shockwave'}
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Pause Menu Overlay */}
      {isPaused && (
        <PauseMenu
          onResume={() => {
            setIsPaused(false);
            sim.isPaused = false;
          }}
          onRestart={initSimulation}
          onOpenSettings={onOpenSettings}
          onQuitToMenu={() => {
            audioManager.stopCombatMusic();
            onQuitToMenu();
          }}
        />
      )}
    </div>
  );
};
