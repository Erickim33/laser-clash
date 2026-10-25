/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Users,
  Shield,
  Zap,
  Flame,
  Radio,
  Play,
  Settings as SettingsIcon,
  HelpCircle,
  Cpu,
  Target,
  Skull,
  Download,
  Loader2
} from 'lucide-react';
import { multiplayerClient } from '../utils/multiplayerClient';
import { PLAYER_COLORS } from '../server/MultiplayerEngine';
import { GameStateSnapshot } from '../types/multiplayer';

interface MultiplayerLobbyProps {
  onMatchStarted: () => void;
  onStartSinglePlayer: () => void;
  onOpenSettings: () => void;
  onOpenHUDLegend: () => void;
}

export const MultiplayerLobby: React.FC<MultiplayerLobbyProps> = ({
  onMatchStarted,
  onStartSinglePlayer,
  onOpenSettings,
  onOpenHUDLegend,
}) => {
  const [username, setUsername] = useState<string>(() => {
    return localStorage.getItem('laser_clash_username') || `OPERATIVE_${Math.floor(100 + Math.random() * 900)}`;
  });
  const [selectedColor, setSelectedColor] = useState<string>(PLAYER_COLORS[0]);
  const [roomId, setRoomId] = useState<string>('nexus-arena');
  const [targetPlayers, setTargetPlayers] = useState<number>(8); // Target 8-12 players
  const [fillBots, setFillBots] = useState<boolean>(true); // Fills remaining slots up to target

  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [lobbySnapshot, setLobbySnapshot] = useState<GameStateSnapshot | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadZip = async () => {
    try {
      setIsDownloading(true);
      const res = await fetch('/api/download-zip');
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      // Ensure explicit application/zip MIME type so browser saves as .zip archive (never .htm/.html)
      const zipBlob = new Blob([blob], { type: 'application/zip' });
      const url = window.URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'laser-clash-game.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => window.URL.revokeObjectURL(url), 1500);
    } catch {
      window.location.href = '/api/download-zip';
    } finally {
      setIsDownloading(false);
    }
  };

  // Save username
  const handleNameChange = (name: string) => {
    setUsername(name);
    localStorage.setItem('laser_clash_username', name);
  };

  const handleJoinLobby = async () => {
    if (!username.trim()) return;
    setIsConnecting(true);
    setErrorMessage(null);

    try {
      await multiplayerClient.connect(
        username.trim(),
        selectedColor,
        roomId.trim().toLowerCase(),
        fillBots,
        targetPlayers
      );
      setIsConnected(true);
    } catch {
      setErrorMessage('Failed to connect to multiplayer server. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  useEffect(() => {
    const unsubState = multiplayerClient.onState((snap) => {
      setLobbySnapshot(snap);
      if (snap.phase === 'countdown' || snap.phase === 'active') {
        onMatchStarted();
      }
    });

    const unsubError = multiplayerClient.onError((msg) => {
      setErrorMessage(msg);
      setIsConnecting(false);
    });

    return () => {
      unsubState();
      unsubError();
    };
  }, [onMatchStarted]);

  const handleStartMatch = () => {
    multiplayerClient.startMatch();
  };

  return (
    <div className="relative w-full h-full flex flex-col justify-between p-4 md:p-6 bg-[#060709] overflow-y-auto">
      {/* Top Header */}
      <header className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 border border-white/30 bg-white/5 flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.1)]">
            <Zap className="w-5 h-5 text-[#00f0ff]" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-wider uppercase flex items-center gap-2">
              LASER CLASH
              <span className="text-[10px] px-2 py-0.5 border border-red-500/60 bg-red-500/10 text-red-400 font-mono tracking-normal">
                HARDCORE BATTLE ROYALE
              </span>
            </h1>
            <p className="text-xs text-white/50 font-mono">
              2–12 Players · Server-Authoritative · Lethal Lasers &amp; Shrinking Storm
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadZip}
            disabled={isDownloading}
            className="px-3 py-1.5 border border-[#00f0ff] bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20 text-[#00f0ff] text-xs font-mono font-bold flex items-center gap-1.5 transition-colors shadow-[0_0_10px_rgba(0,240,255,0.2)] disabled:opacity-50"
            title="Download Complete Game ZIP Archive (Binary .zip file)"
          >
            {isDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isDownloading ? 'Downloading...' : 'Download .ZIP'}</span>
          </button>
          <button
            onClick={onOpenHUDLegend}
            className="p-2 border border-white/20 hover:border-white text-white/70 hover:text-white transition-colors"
            title="Tactical Guide"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
          <button
            onClick={onOpenSettings}
            className="p-2 border border-white/20 hover:border-white text-white/70 hover:text-white transition-colors"
            title="Audio & Settings"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Prominent Download Banner (Impossible to Miss) */}
      <div className="w-full max-w-5xl mx-auto mt-4 p-3.5 bg-gradient-to-r from-[#00f0ff]/15 via-black/90 to-[#00f0ff]/15 border-2 border-[#00f0ff] shadow-[0_0_25px_rgba(0,240,255,0.3)] flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#00f0ff]/20 border border-[#00f0ff] text-[#00f0ff]">
            {isDownloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5 animate-pulse" />}
          </div>
          <div>
            <div className="font-extrabold text-sm text-white tracking-wide flex items-center gap-2">
              DOWNLOAD COMPLETE GAME PACKAGE (.ZIP)
              <span className="text-[10px] bg-[#00f0ff] text-black px-1.5 py-0.5 font-mono font-bold">REAL ZIP ARCHIVE</span>
            </div>
            <div className="text-xs text-white/70 font-mono">
              Includes standalone offline web game (double-click <code className="text-[#00f0ff]">web-game/index.html</code> to play anywhere) + complete multiplayer source code!
            </div>
          </div>
        </div>
        <button
          onClick={handleDownloadZip}
          disabled={isDownloading}
          className="shrink-0 px-6 py-2.5 bg-[#00f0ff] hover:bg-[#33f3ff] text-black font-extrabold uppercase text-xs tracking-wider font-mono flex items-center gap-2 shadow-[0_0_15px_rgba(0,240,255,0.5)] active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 fill-current" />}
          <span>{isDownloading ? 'Generating ZIP...' : 'Download .ZIP'}</span>
        </button>
      </div>

      {/* Game Mode Selection Grid */}
      <div className="max-w-5xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {/* Card 1: Unlimited Single Player (AI Arena) */}
        <div className="border-2 border-emerald-500/80 bg-emerald-950/20 p-4 flex flex-col justify-between shadow-[0_0_20px_rgba(16,185,129,0.2)]">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold font-mono">
                SINGLE PLAYER MODE
              </span>
              <span className="text-[10px] text-emerald-400 font-mono font-bold">UNLIMITED WAVES</span>
            </div>
            <h3 className="text-lg font-black text-white uppercase tracking-wider mb-1 flex items-center gap-2">
              <Zap className="w-5 h-5 text-emerald-400" /> UNLIMITED AI SURVIVAL
            </h3>
            <p className="text-xs text-white/80 font-mono leading-relaxed mb-4">
              Play solo against endless waves of adaptive tactical AI bots! Continuous combat with boss encounters every 5 waves, 6 escalating weapon upgrades, stasis traps, Level-Up Stars, and instant respawns.
            </p>
          </div>
          <button
            onClick={onStartSinglePlayer}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase text-xs tracking-widest font-mono shadow-[0_0_20px_rgba(16,185,129,0.5)] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4 fill-current" />
            Launch Unlimited AI Arena
          </button>
        </div>

        {/* Card 2: Multiplayer Battle Royale */}
        <div className="border border-white/20 bg-white/[0.02] p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] px-2 py-0.5 bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/40 font-bold font-mono">
                ONLINE MULTIPLAYER
              </span>
              <span className="text-[10px] text-white/50 font-mono">2–12 REAL PLAYERS</span>
            </div>
            <h3 className="text-lg font-black text-white uppercase tracking-wider mb-1 flex items-center gap-2">
              <Users className="w-5 h-5 text-[#00f0ff]" /> SECTOR BATTLE ROYALE
            </h3>
            <p className="text-xs text-white/70 font-mono leading-relaxed mb-4">
              Join online matches with 2–12 players over real-time WebSockets. Lethal high-speed lasers (32 DMG/hit), reflector mirror walls, and a deadly shrinking storm safe zone.
            </p>
          </div>
          <div className="text-xs text-[#00f0ff] font-mono text-center py-1">
            Configure Operative Below &amp; Deploy ⬇️
          </div>
        </div>
      </div>

      {/* Main Content Grid (Multiplayer Setup) */}
      <main className="max-w-5xl mx-auto w-full grid grid-cols-1 md:grid-cols-12 gap-6 my-auto py-6">
        {/* Left Column: Player Identity & Match Setup */}
        <div className="md:col-span-6 flex flex-col gap-4">
          <div className="border border-white/10 bg-white/[0.02] p-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-white/60 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-[#00f0ff]" /> Operative Identity
            </h2>

            {/* Username Input */}
            <div className="mb-4">
              <label className="block text-[11px] font-mono text-white/50 mb-1">CALLSIGN / USERNAME</label>
              <input
                type="text"
                value={username}
                onChange={(e) => handleNameChange(e.target.value)}
                disabled={isConnected}
                maxLength={18}
                className="w-full bg-black/60 border border-white/20 focus:border-[#00f0ff] px-3 py-2 text-sm font-mono text-white outline-none transition-colors disabled:opacity-50"
                placeholder="Enter Operative Name"
              />
            </div>

            {/* Color Palette Picker (12 vibrant cyber colors) */}
            <div>
              <label className="block text-[11px] font-mono text-white/50 mb-1.5">CHASSIS LASER COLOR</label>
              <div className="grid grid-cols-6 gap-2">
                {PLAYER_COLORS.map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setSelectedColor(col)}
                    disabled={isConnected}
                    style={{ backgroundColor: col }}
                    className={`h-8 border-2 transition-transform ${
                      selectedColor === col
                        ? 'border-white scale-110 shadow-[0_0_12px_rgba(255,255,255,0.6)]'
                        : 'border-transparent opacity-70 hover:opacity-100 hover:scale-105'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Room & Hardcore Settings */}
          <div className="border border-white/10 bg-white/[0.02] p-4 flex flex-col gap-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-white/60 flex items-center gap-2">
              <Target className="w-4 h-4 text-amber-400" /> Matchmaking Parameters
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-mono text-white/50 mb-1">SECTOR ARENA CODE</label>
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  disabled={isConnected}
                  className="w-full bg-black/60 border border-white/20 focus:border-[#00f0ff] px-2.5 py-1.5 text-xs font-mono text-white outline-none disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-white/50 mb-1">TARGET PLAYERS (2-12)</label>
                <select
                  value={targetPlayers}
                  onChange={(e) => setTargetPlayers(Number(e.target.value))}
                  disabled={isConnected}
                  className="w-full bg-black/60 border border-white/20 focus:border-[#00f0ff] px-2 py-1.5 text-xs font-mono text-white outline-none disabled:opacity-50"
                >
                  <option value={2}>2 Players (Duel)</option>
                  <option value={4}>4 Players (Squad)</option>
                  <option value={8}>8 Players (Apex BR - Recommended)</option>
                  <option value={12}>12 Players (Full Arena Chaos)</option>
                </select>
              </div>
            </div>

            {/* Fill Bots Option */}
            <label className="flex items-center gap-2 text-xs font-mono text-white/80 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={fillBots}
                onChange={(e) => setFillBots(e.target.checked)}
                disabled={isConnected}
                className="accent-[#00f0ff] w-4 h-4"
              />
              Fill empty slots with high-difficulty combat bots
            </label>

            {/* Connect / Join Button */}
            {!isConnected ? (
              <button
                onClick={handleJoinLobby}
                disabled={isConnecting || !username.trim()}
                className="mt-2 w-full py-2.5 bg-[#00f0ff] text-black font-extrabold uppercase tracking-wider text-sm hover:bg-[#00f0ff]/90 active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Radio className="w-4 h-4" />
                {isConnecting ? 'Linking Neural Net...' : 'Connect to Arena Lobby'}
              </button>
            ) : (
              <div className="mt-2 p-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono flex items-center justify-between">
                <span>ONLINE · ROOM: {roomId.toUpperCase()}</span>
                <span>PING: {multiplayerClient.ping || 18}ms</span>
              </div>
            )}

            {errorMessage && (
              <p className="text-xs text-red-400 font-mono mt-1">{errorMessage}</p>
            )}
          </div>
        </div>

        {/* Right Column: Active Arena Manifest & Launch */}
        <div className="md:col-span-6 flex flex-col justify-between border border-white/10 bg-white/[0.02] p-4">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-white/60 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                Connected Combatants ({lobbySnapshot ? lobbySnapshot.totalPlayers : (isConnected ? 1 : 0)} / {targetPlayers})
              </h2>
              <span className="text-[10px] font-mono text-white/40">
                LOBBY PHASE: {lobbySnapshot?.phase.toUpperCase() || 'STANDBY'}
              </span>
            </div>

            {/* Combatants List */}
            <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
              {lobbySnapshot && Object.values(lobbySnapshot.players).length > 0 ? (
                Object.values(lobbySnapshot.players).map((p) => {
                  const isSelf = p.id === multiplayerClient.playerId;
                  return (
                    <div
                      key={p.id}
                      className={`p-2 border flex items-center justify-between font-mono text-xs ${
                        isSelf ? 'border-white bg-white/10' : 'border-white/10 bg-black/40'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-3.5 h-3.5 border border-white/40"
                          style={{ backgroundColor: p.color }}
                        />
                        <span className="font-bold text-white">
                          {p.name} {isSelf && '(YOU)'}
                        </span>
                        {p.isBot && (
                          <span className="text-[9px] px-1 bg-red-500/20 text-red-400 border border-red-500/30">
                            HARD BOT
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-white/50 flex items-center gap-2">
                        <span>100 HP</span>
                        <span className="text-emerald-400">READY</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-xs text-white/40 font-mono">
                  {isConnected
                    ? 'Synchronizing operative roster...'
                    : 'Configure your operative parameters and connect to join the match.'}
                </div>
              )}
            </div>
          </div>

          {/* Hardcore Rules Notice */}
          <div className="mt-4 pt-3 border-t border-white/10 space-y-2">
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div className="p-2 border border-red-500/30 bg-red-500/5 text-red-300 flex items-center gap-1.5">
                <Skull className="w-3.5 h-3.5 text-red-400" />
                <span>32 DMG Per Shot (Lethal)</span>
              </div>
              <div className="p-2 border border-amber-500/30 bg-amber-500/5 text-amber-300 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>Laser Heat &amp; Overheat</span>
              </div>
            </div>

            {/* Launch Match Button */}
            {isConnected && (
              <button
                onClick={handleStartMatch}
                className="w-full py-3 bg-red-600 text-white font-extrabold uppercase tracking-widest text-sm hover:bg-red-500 active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(239,68,68,0.4)]"
              >
                <Play className="w-4 h-4 fill-current" />
                Initiate Battle Royale Protocol
              </button>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-[10px] font-mono text-white/30 border-t border-white/5 pt-3">
        CONTROLS: [W,A,S,D] Move · [Mouse] Aim · [Left Click] Shoot · [Space / Shift] Quick Dash · [Right Click] Reflector Shield
      </footer>
    </div>
  );
};
