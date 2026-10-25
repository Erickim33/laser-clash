/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Volume2,
  VolumeX,
  Smartphone,
  Eye,
  Activity,
  Maximize2,
  Minimize2,
  RotateCcw,
  AlertCircle,
  Copy,
  Check,
  FileText
} from 'lucide-react';
import { GameSettings } from '../types/game';
import { settingsStore } from '../utils/settingsStore';
import { statsStore } from '../utils/statsStore';
import { fullscreenManager } from '../utils/fullscreen';
import { logger } from '../utils/logger';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState<GameSettings>(settingsStore.getSettings());
  const [showSaveFeedback, setShowSaveFeedback] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(fullscreenManager.isFullscreen());
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagnosticReport, setDiagnosticReport] = useState('');
  const [copiedReport, setCopiedReport] = useState(false);

  useEffect(() => {
    const unsubSettings = settingsStore.subscribe((newSettings) => {
      setSettings(newSettings);
    });
    settingsStore.onSaveFeedback((saved) => {
      setShowSaveFeedback(saved);
    });
    const unsubFullscreen = fullscreenManager.subscribe((fs) => {
      setIsFullscreen(fs);
    });

    return () => {
      unsubSettings();
      unsubFullscreen();
    };
  }, []);

  if (!isOpen) return null;

  const handleFullscreenToggle = async () => {
    await fullscreenManager.toggle();
    setIsFullscreen(fullscreenManager.isFullscreen());
  };

  const handleResetStats = () => {
    statsStore.resetStats();
    setShowResetConfirm(false);
  };

  const handleOpenDiagnostics = () => {
    setDiagnosticReport(logger.generateDiagnosticReport());
    setShowDiagnostics(true);
  };

  const handleCopyReport = () => {
    navigator.clipboard.writeText(diagnosticReport);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-xl bg-[#0c0c10] border border-white/20 p-6 rounded-none text-white shadow-2xl overflow-y-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-5">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold tracking-wider uppercase font-mono-numbers">
              Settings & Configuration
            </h2>
            {/* Visual Save Confirmation (Section 25) */}
            {showSaveFeedback && (
              <span className="flex items-center gap-1 text-[11px] font-mono-numbers bg-emerald-500/20 text-emerald-400 px-2 py-0.5 border border-emerald-500/40">
                <Check className="w-3 h-3" /> Saved
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Settings Body */}
        <div className="space-y-6 font-mono-numbers text-xs">
          {/* Audio Controls */}
          <div>
            <h3 className="text-white/40 uppercase tracking-widest text-[10px] mb-3">Audio Systems</h3>
            <div className="space-y-3 bg-white/[0.02] border border-white/5 p-3">
              {/* SFX */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => settingsStore.updateSettings({ sfxEnabled: !settings.sfxEnabled })}
                    className="text-white/80 hover:text-white"
                  >
                    {settings.sfxEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-white/40" />}
                  </button>
                  <span>Sound Effects</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.sfxVolume}
                  onChange={(e) => settingsStore.updateSettings({ sfxVolume: parseFloat(e.target.value) })}
                  className="w-32 accent-white cursor-pointer"
                />
              </div>

              {/* Music Drone */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => settingsStore.updateSettings({ musicEnabled: !settings.musicEnabled })}
                    className="text-white/80 hover:text-white"
                  >
                    {settings.musicEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-white/40" />}
                  </button>
                  <span>Combat Synth Ambient</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.musicVolume}
                  onChange={(e) => settingsStore.updateSettings({ musicVolume: parseFloat(e.target.value) })}
                  className="w-32 accent-white cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Accessibility & Visual FX (Section 25 & 26) */}
          <div>
            <h3 className="text-white/40 uppercase tracking-widest text-[10px] mb-3">Accessibility & Visuals</h3>
            <div className="space-y-2 bg-white/[0.02] border border-white/5 p-3">
              {/* Colorblind-Safe Palette (Section 26) */}
              <div className="flex items-center justify-between py-1">
                <div className="flex flex-col">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-white/70" /> Colorblind-Safe Palette
                  </span>
                  <span className="text-[10px] text-white/40">
                    High-contrast cyan & amber accents with hazard pattern cues
                  </span>
                </div>
                <button
                  onClick={() => settingsStore.updateSettings({ colorblindMode: !settings.colorblindMode })}
                  className={`px-3 py-1 text-xs border ${
                    settings.colorblindMode
                      ? 'bg-white text-black border-white font-bold'
                      : 'bg-transparent text-white/60 border-white/20 hover:border-white/50'
                  }`}
                >
                  {settings.colorblindMode ? 'ENABLED' : 'OFF'}
                </button>
              </div>

              {/* Screen Shake */}
              <div className="flex items-center justify-between py-1 border-t border-white/5">
                <div className="flex flex-col">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-white/70" /> Screen Shake Effects
                  </span>
                  <span className="text-[10px] text-white/40">Tactile impact and overdrive vibration</span>
                </div>
                <button
                  onClick={() => settingsStore.updateSettings({ screenShake: !settings.screenShake })}
                  className={`px-3 py-1 text-xs border ${
                    settings.screenShake
                      ? 'bg-white text-black border-white font-bold'
                      : 'bg-transparent text-white/60 border-white/20 hover:border-white/50'
                  }`}
                >
                  {settings.screenShake ? 'ENABLED' : 'OFF'}
                </button>
              </div>

              {/* Mobile Haptic Feedback (Section 26) */}
              <div className="flex items-center justify-between py-1 border-t border-white/5">
                <div className="flex flex-col">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-white/70" /> Haptic Pulses (Mobile)
                  </span>
                  <span className="text-[10px] text-white/40">Vibrations on damage, purchase, and abilities</span>
                </div>
                <button
                  onClick={() => settingsStore.updateSettings({ hapticsEnabled: !settings.hapticsEnabled })}
                  className={`px-3 py-1 text-xs border ${
                    settings.hapticsEnabled
                      ? 'bg-white text-black border-white font-bold'
                      : 'bg-transparent text-white/60 border-white/20 hover:border-white/50'
                  }`}
                >
                  {settings.hapticsEnabled ? 'ENABLED' : 'OFF'}
                </button>
              </div>
            </div>
          </div>

          {/* Fullscreen & Display (Section 24) */}
          {fullscreenManager.getSupported() && (
            <div>
              <h3 className="text-white/40 uppercase tracking-widest text-[10px] mb-3">Display</h3>
              <div className="bg-white/[0.02] border border-white/5 p-3 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-white block">Fullscreen Arena Mode</span>
                  <span className="text-[10px] text-white/40">Toggle full browser viewport presentation</span>
                </div>
                <button
                  onClick={handleFullscreenToggle}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-white/30 hover:border-white text-xs transition-colors"
                >
                  {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  <span>{isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Diagnostics & Stats (Sections 23 & 27) */}
          <div>
            <h3 className="text-white/40 uppercase tracking-widest text-[10px] mb-3">Data & Diagnostics</h3>
            <div className="bg-white/[0.02] border border-white/5 p-3 flex flex-wrap gap-2">
              <button
                onClick={handleOpenDiagnostics}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/20 text-xs transition-colors"
              >
                <FileText className="w-3.5 h-3.5 text-white/70" />
                <span>Report a Problem (Logs)</span>
              </button>

              <button
                onClick={() => setShowResetConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Stats</span>
              </button>
            </div>
          </div>
        </div>

        {/* Confirmation Modal for Reset Stats */}
        {showResetConfirm && (
          <div className="absolute inset-0 z-10 flex items-center justify-center p-4 bg-black/95">
            <div className="border border-red-500/40 p-4 bg-[#110e10] max-w-sm text-center">
              <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
              <h4 className="font-bold text-sm text-white mb-1">Confirm Reset Session Stats?</h4>
              <p className="text-xs text-white/60 mb-4">
                This will reset your total matches played, win/loss history, and personal best damage record.
              </p>
              <div className="flex justify-center gap-2">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="px-3 py-1.5 border border-white/20 hover:border-white text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResetStats}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs"
                >
                  Yes, Reset Stats
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Diagnostics & Crash Report Modal (Section 27) */}
        {showDiagnostics && (
          <div className="absolute inset-0 z-20 flex flex-col p-4 bg-[#0a0a0e] text-white">
            <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
              <span className="font-bold text-xs uppercase tracking-wider font-mono-numbers">
                Diagnostics & Device Report
              </span>
              <button
                onClick={() => setShowDiagnostics(false)}
                className="p-1 hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10px] text-white/50 mb-2 font-mono-numbers">
              Lightweight client-side diagnostic report containing session metrics, screen specs, and recent system event logs.
            </p>
            <div className="flex-1 bg-black p-3 border border-white/10 font-mono text-[10px] text-white/70 overflow-auto whitespace-pre">
              {diagnosticReport}
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={handleCopyReport}
                className="flex items-center gap-1 px-3 py-1.5 bg-white text-black font-bold text-xs hover:bg-white/90"
              >
                {copiedReport ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedReport ? 'Copied to Clipboard' : 'Copy Diagnostic Report'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
