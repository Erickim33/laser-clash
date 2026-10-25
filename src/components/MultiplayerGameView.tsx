/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Shield,
  Zap,
  Flame,
  Clock,
  Users,
  Compass,
  Trophy,
  ArrowRight,
  RotateCcw,
  Skull,
  Radio
} from 'lucide-react';
import { multiplayerClient } from '../utils/multiplayerClient';
import { MultiplayerCanvasRenderer } from '../combat/MultiplayerCanvasRenderer';
import { GameStateSnapshot, PlayerInput, PlayerState } from '../types/multiplayer';
import { audioManager } from '../audio/AudioManager';

interface MultiplayerGameViewProps {
  onReturnToLobby: () => void;
  onOpenSettings: () => void;
}

export const MultiplayerGameView: React.FC<MultiplayerGameViewProps> = ({
  onReturnToLobby,
  onOpenSettings,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<MultiplayerCanvasRenderer | null>(null);

  const [snapshot, setSnapshot] = useState<GameStateSnapshot | null>(null);
  const [localPlayerId, setLocalPlayerId] = useState<string | null>(multiplayerClient.playerId);
  const [spectateTargetId, setSpectateTargetId] = useState<string | null>(null);
  const [isEliminated, setIsEliminated] = useState(false);
  const [eliminationInfo, setEliminationInfo] = useState<{
    killerName?: string;
    rank: number;
    stats: { kills: number; damage: number; time: number };
  } | null>(null);

  // Input tracking
  const inputRef = useRef<PlayerInput>({
    up: false,
    down: false,
    left: false,
    right: false,
    aimAngle: 0,
    shooting: false,
    dash: false,
    shield: false,
    interact: false,
  });

  const mousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Handle Resize
  const handleResize = useCallback(() => {
    if (!canvasRef.current || !containerRef.current) return;
    const w = containerRef.current.clientWidth;
    const h = containerRef.current.clientHeight;
    const dpr = window.devicePixelRatio || 1;

    canvasRef.current.width = w * dpr;
    canvasRef.current.height = h * dpr;
    canvasRef.current.style.width = `${w}px`;
    canvasRef.current.style.height = `${h}px`;

    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }

    if (rendererRef.current) {
      rendererRef.current.resize(w, h);
    }
  }, []);

  // Initialize Canvas Renderer & Subscriptions
  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    rendererRef.current = new MultiplayerCanvasRenderer(ctx);
    handleResize();
    window.addEventListener('resize', handleResize);

    // Audio cue
    audioManager.playWaveAlert();

    // Subscribe to multiplayer state
    const unsubState = multiplayerClient.onState((snap) => {
      setSnapshot(snap);

      // Check if local player was eliminated
      const myId = multiplayerClient.playerId;
      if (myId && snap.players[myId]) {
        const me = snap.players[myId];
        if (!me.isAlive && !isEliminated) {
          setIsEliminated(true);
          audioManager.playExplosion();
        }
      }
    });

    const unsubElim = multiplayerClient.onEliminated((info) => {
      setIsEliminated(true);
      setEliminationInfo(info);
      audioManager.playExplosion();
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      audioManager.stopCombatMusic();
      unsubState();
      unsubElim();
    };
  }, [handleResize, isEliminated]);

  // Input Event Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      if (code === 'KeyW' || code === 'ArrowUp') inputRef.current.up = true;
      if (code === 'KeyS' || code === 'ArrowDown') inputRef.current.down = true;
      if (code === 'KeyA' || code === 'ArrowLeft') inputRef.current.left = true;
      if (code === 'KeyD' || code === 'ArrowRight') inputRef.current.right = true;
      if (code === 'Space' || code === 'ShiftLeft' || code === 'ShiftRight') {
        inputRef.current.dash = true;
      }
      if (code === 'KeyE' && !e.repeat) inputRef.current.interact = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const code = e.code;
      if (code === 'KeyW' || code === 'ArrowUp') inputRef.current.up = false;
      if (code === 'KeyS' || code === 'ArrowDown') inputRef.current.down = false;
      if (code === 'KeyA' || code === 'ArrowLeft') inputRef.current.left = false;
      if (code === 'KeyD' || code === 'ArrowRight') inputRef.current.right = false;
      if (code === 'Space' || code === 'ShiftLeft' || code === 'ShiftRight') {
        inputRef.current.dash = false;
      }
      if (code === 'KeyE') inputRef.current.interact = false;
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        inputRef.current.shooting = true;
      } else if (e.button === 2) {
        inputRef.current.shield = true;
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        inputRef.current.shooting = false;
      } else if (e.button === 2) {
        inputRef.current.shield = false;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;
      mousePosRef.current = { x: clientX, y: clientY };

      // Calculate angle from center of screen (where camera focuses player)
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      inputRef.current.aimAngle = Math.atan2(clientY - centerY, clientX - centerX);
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault(); // Prevent default browser context menu on right-click shield
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('contextmenu', handleContextMenu);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  // Send input tick to server at 30Hz
  useEffect(() => {
    const interval = setInterval(() => {
      multiplayerClient.sendInput(inputRef.current);
    }, 1000 / 30);
    return () => clearInterval(interval);
  }, []);

  // Render Loop
  useEffect(() => {
    let animId: number;

    const loop = () => {
      if (rendererRef.current && snapshot && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const worldAimX = rendererRef.current.camX + (mousePosRef.current.x - rect.width / 2);
        const worldAimY = rendererRef.current.camY + (mousePosRef.current.y - rect.height / 2);

        rendererRef.current.render(
          snapshot,
          localPlayerId,
          spectateTargetId,
          { x: worldAimX, y: worldAimY }
        );
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [snapshot, localPlayerId, spectateTargetId]);

  // Cycle spectators when eliminated
  const cycleSpectator = (direction: 'next' | 'prev') => {
    if (!snapshot) return;
    const alivePlayers = Object.values(snapshot.players).filter((p) => p.isAlive);
    if (alivePlayers.length === 0) return;

    const currentIndex = alivePlayers.findIndex((p) => p.id === (spectateTargetId || localPlayerId));
    let nextIndex = 0;
    if (direction === 'next') {
      nextIndex = (currentIndex + 1) % alivePlayers.length;
    } else {
      nextIndex = (currentIndex - 1 + alivePlayers.length) % alivePlayers.length;
    }
    setSpectateTargetId(alivePlayers[nextIndex].id);
  };

  const myPlayer: PlayerState | undefined = localPlayerId && snapshot
    ? snapshot.players[localPlayerId]
    : undefined;

  const spectatedPlayer: PlayerState | undefined = spectateTargetId && snapshot
    ? snapshot.players[spectateTargetId]
    : undefined;

  const activeFocusPlayer = myPlayer?.isAlive ? myPlayer : spectatedPlayer;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-[#060709] overflow-hidden select-none cursor-crosshair font-mono"
    >
      {/* 2D Canvas Arena (Screen center is 100% clean and unobstructed) */}
      <canvas ref={canvasRef} className="absolute inset-0 block w-full h-full" />

      {/* Top HUD Bar (Docked to top edge, never in the middle) */}
      <div className="absolute top-0 inset-x-0 h-14 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between px-4 z-20 pointer-events-none">
        {/* Top-Left: Ping & Hardcore indicator */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-black/60 border border-white/10 px-2 py-1">
            <Radio className="w-3.5 h-3.5" />
            <span>{multiplayerClient.ping || 18}ms</span>
          </div>
          <span className="text-[11px] px-2 py-1 border border-red-500/40 bg-red-500/10 text-red-400 font-bold tracking-wider">
            HARDCORE BR
          </span>
        </div>

        {/* Top-Center: Alive Combatants & Safe Zone Status */}
        <div className="flex items-center gap-4 bg-black/70 border border-white/15 px-4 py-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Users className="w-4 h-4 text-[#00f0ff]" />
            <span>ALIVE: {snapshot?.aliveCount || 0} / {snapshot?.totalPlayers || 0}</span>
          </div>
          <div className="w-[1px] h-4 bg-white/20" />
          <div className="flex items-center gap-2 text-xs">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span className={snapshot?.safeZone.isShrinking ? 'text-red-400 font-bold animate-pulse' : 'text-amber-300'}>
              {snapshot?.safeZone.isShrinking
                ? 'STORM ADVANCING'
                : `SAFE ZONE: ${Math.max(0, Math.ceil(snapshot?.safeZone.shrinkTimer || 0))}s`}
            </span>
          </div>
        </div>

        {/* Top-Right: Quick Actions */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={onReturnToLobby}
            className="px-2.5 py-1 text-xs border border-white/20 bg-black/60 text-white/70 hover:text-white hover:border-white transition-colors"
          >
            Leave
          </button>
        </div>
      </div>

      {/* Top-Right Kill Feed (Unobtrusive edge corner) */}
      {snapshot && snapshot.recentKills.length > 0 && (
        <div className="absolute top-16 right-4 z-20 space-y-1.5 pointer-events-none max-w-xs text-right">
          {snapshot.recentKills.slice(0, 3).map((kill, idx) => (
            <div
              key={`${kill.timestamp}_${idx}`}
              className="text-[11px] bg-black/75 border border-white/10 px-2.5 py-1 text-white/80 inline-flex items-center gap-1.5 ml-auto"
            >
              <span style={{ color: kill.killerColor }} className="font-bold">
                {kill.killerName}
              </span>
              <Skull className="w-3 h-3 text-red-400" />
              <span style={{ color: kill.victimColor }} className="font-bold">
                {kill.victimName}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Live Overload Protocol status, shared by every player in the room */}
      {snapshot?.reactor && (
        <div className="absolute left-4 top-20 z-20 w-64 border border-cyan-400/30 bg-black/85 p-3 text-[11px] text-white shadow-[0_0_18px_rgba(0,240,255,0.08)] pointer-events-none">
          <div className="mb-2 flex items-center justify-between font-bold tracking-widest text-cyan-300">
            <span>OVERLOAD PROTOCOL</span>
            <span>{snapshot.reactor.charge}%</span>
          </div>
          <div className="mb-2 h-1.5 overflow-hidden bg-white/10">
            <div className="h-full bg-cyan-300 transition-all" style={{ width: `${snapshot.reactor.charge}%` }} />
          </div>
          <div className="mb-1 text-white/50">NODE SEQUENCE</div>
          <div className="mb-2 flex gap-1">
            {snapshot.reactor.sequence.map((nodeId, index) => {
              const node = snapshot.reactor.nodes.find((candidate) => candidate.id === nodeId);
              const complete = index < snapshot.reactor.sequenceProgress;
              return <span key={`${nodeId}-${index}`} className={`flex-1 border px-1 py-1 text-center ${complete ? 'border-emerald-400 bg-emerald-400/15 text-emerald-300' : 'border-white/15 text-white/70'}`}>{node?.name || nodeId}</span>;
            })}
          </div>
          <div className="text-white/70">Move near a glowing node and press <strong className="text-cyan-300">E</strong>.</div>
          {snapshot.reactor.eventTimeRemaining > 0 && <div className={`mt-2 font-bold ${snapshot.reactor.empTimeRemaining > 0 ? 'text-amber-300 animate-pulse' : 'text-cyan-200'}`}>{snapshot.reactor.eventText}</div>}
          {snapshot.reactor.empTimeRemaining > 0 && <div className="mt-1 font-bold text-red-300">EMP ACTIVE · {snapshot.reactor.empTimeRemaining.toFixed(1)}s</div>}
        </div>
      )}

      {/* Bottom Action HUD Bar (Docked to bottom edge) */}
      <div className="absolute bottom-3 inset-x-0 z-20 pointer-events-none flex flex-col items-center">
        {/* Elimination Spectator Banner if dead */}
        {isEliminated && snapshot?.phase === 'active' && (
          <div className="mb-2 bg-black/90 border border-red-500/60 px-4 py-2 flex items-center gap-4 text-xs pointer-events-auto shadow-[0_0_15px_rgba(239,68,68,0.3)]">
            <span className="text-red-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Skull className="w-4 h-4" /> ELIMINATED · SPECTATING: {spectatedPlayer?.name || 'SURVIVOR'}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => cycleSpectator('prev')}
                className="px-2 py-0.5 border border-white/30 hover:border-white text-white/80 hover:text-white text-[10px]"
              >
                ◀ PREV
              </button>
              <button
                onClick={() => cycleSpectator('next')}
                className="px-2 py-0.5 border border-white/30 hover:border-white text-white/80 hover:text-white text-[10px]"
              >
                NEXT ▶
              </button>
            </div>
          </div>
        )}

        {/* Combat Vitals Bar */}
        <div className="max-w-xl w-full bg-black/85 border border-white/20 p-2.5 flex items-center justify-between gap-4 pointer-events-auto backdrop-blur-sm">
          {/* Health Gauge */}
          <div className="flex-1">
            <div className="flex items-center justify-between text-[11px] text-white/80 mb-1">
              <span className="font-bold">INTEGRITY (HP)</span>
              <span className="font-bold text-[#00f0ff]">{Math.ceil(activeFocusPlayer?.health || 0)} / 100</span>
            </div>
            <div className="w-full h-3 bg-white/10 overflow-hidden border border-white/20">
              <div
                className="h-full bg-gradient-to-r from-red-500 to-[#00f0ff] transition-all duration-100"
                style={{ width: `${Math.max(0, (activeFocusPlayer?.health || 0))}%` }}
              />
            </div>
          </div>

          {/* Reflector Shield Gauge */}
          <div className="w-28">
            <div className="flex items-center justify-between text-[10px] text-white/70 mb-1">
              <span className="flex items-center gap-1">
                <Shield className="w-3 h-3 text-[#00f0ff]" /> SHIELD
              </span>
              <span>{Math.ceil(activeFocusPlayer?.shield || 0)}/40</span>
            </div>
            <div className="w-full h-2 bg-white/10 overflow-hidden border border-white/20">
              <div
                className="h-full bg-[#00f0ff] transition-all duration-100"
                style={{ width: `${Math.max(0, ((activeFocusPlayer?.shield || 0) / 40) * 100)}%` }}
              />
            </div>
          </div>

          {/* Blaster Heat Gauge */}
          <div className="w-28">
            <div className="flex items-center justify-between text-[10px] text-white/70 mb-1">
              <span className="flex items-center gap-1">
                <Flame className={`w-3 h-3 ${activeFocusPlayer?.isOverheated ? 'text-red-500 animate-pulse' : 'text-amber-400'}`} />
                {activeFocusPlayer?.isOverheated ? 'OVERHEAT' : 'HEAT'}
              </span>
              <span className={activeFocusPlayer?.isOverheated ? 'text-red-400 font-bold' : ''}>
                {Math.ceil(activeFocusPlayer?.heat || 0)}%
              </span>
            </div>
            <div className="w-full h-2 bg-white/10 overflow-hidden border border-white/20">
              <div
                className={`h-full transition-all duration-100 ${
                  activeFocusPlayer?.isOverheated ? 'bg-red-500' : 'bg-amber-400'
                }`}
                style={{ width: `${Math.max(0, (activeFocusPlayer?.heat || 0))}%` }}
              />
            </div>
          </div>

          {/* Dash Status Indicator */}
          <div className="text-center px-2 border-l border-white/20 text-[10px]">
            <span className="block text-white/40">DASH [SPACE]</span>
            <span className={`font-bold ${
              (activeFocusPlayer?.dashCooldown || 0) <= 0 ? 'text-emerald-400' : 'text-white/40'
            }`}>
              {(activeFocusPlayer?.dashCooldown || 0) <= 0
                ? 'READY'
                : `${Math.ceil(activeFocusPlayer?.dashCooldown || 0)}s`}
            </span>
          </div>

          {/* Kills Count */}
          <div className="text-center px-2 border-l border-white/20 text-[10px]">
            <span className="block text-white/40">KILLS</span>
            <span className="font-bold text-[#00f0ff] text-xs">
              {activeFocusPlayer?.kills || 0}
            </span>
          </div>
        </div>
      </div>

      {/* Match Conclusion Modal (Only displayed when match concludes) */}
      {snapshot?.phase === 'game_over' && (
        <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-md w-full border-2 border-[#00f0ff] bg-[#0a0c10] p-6 shadow-[0_0_40px_rgba(0,240,255,0.3)] text-center">
            <Trophy className="w-12 h-12 text-[#ffe600] mx-auto mb-3" />
            <h2 className="text-2xl font-black uppercase tracking-wider text-white mb-1">
              MATCH COMPLETE
            </h2>
            <p className="text-xs text-white/50 mb-4">
              Apex Hardcore Battle Royale Protocol Finished
            </p>

            {snapshot.winner && (
              <div className="p-3 border border-white/20 bg-white/5 mb-4">
                <span className="text-[10px] text-white/40 uppercase block mb-1">VICTOR (CHAMPION)</span>
                <span
                  className="text-lg font-black tracking-wide"
                  style={{ color: snapshot.winner.color }}
                >
                  {snapshot.winner.name}
                </span>
                <div className="flex items-center justify-center gap-4 text-xs text-white/60 mt-2 font-mono">
                  <span>{snapshot.winner.kills} KILLS</span>
                  <span>{snapshot.winner.damageDealt} DMG</span>
                  <span>{snapshot.winner.survivalTime}s SURVIVED</span>
                </div>
              </div>
            )}

            {/* Local Stats */}
            {myPlayer && (
              <div className="text-xs font-mono text-white/70 mb-6 space-y-1">
                <div>YOUR PLACEMENT: #{myPlayer.rank || (myPlayer.isAlive ? 1 : 2)}</div>
                <div>YOUR ELIMINATIONS: {myPlayer.kills}</div>
                <div>YOUR TOTAL DAMAGE: {Math.round(myPlayer.damageDealt)}</div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={() => multiplayerClient.startMatch()}
                className="flex-1 py-2.5 bg-[#00f0ff] text-black font-extrabold uppercase text-xs hover:bg-[#00f0ff]/90 transition-all flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" /> Rematch
              </button>
              <button
                onClick={onReturnToLobby}
                className="flex-1 py-2.5 border border-white/30 text-white font-extrabold uppercase text-xs hover:bg-white/10 transition-all"
              >
                Return to Lobby
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
