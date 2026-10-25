/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { MultiplayerLobby } from './components/MultiplayerLobby';
import { MultiplayerGameView } from './components/MultiplayerGameView';
import { BattleView } from './components/BattleView';
import { SettingsModal } from './components/SettingsModal';
import { HUDLegendModal } from './components/HUDLegendModal';

export type AppScreen = 'lobby' | 'multiplayer' | 'singleplayer';

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('lobby');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHUDLegendOpen, setIsHUDLegendOpen] = useState(false);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#060709] text-white select-none">
      {screen === 'lobby' && (
        <MultiplayerLobby
          onMatchStarted={() => setScreen('multiplayer')}
          onStartSinglePlayer={() => setScreen('singleplayer')}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenHUDLegend={() => setIsHUDLegendOpen(true)}
        />
      )}

      {screen === 'singleplayer' && (
        <BattleView
          difficulty="normal"
          sector={1}
          isUnlimited={true}
          onMatchComplete={() => {}}
          onQuitToMenu={() => setScreen('lobby')}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      )}

      {screen === 'multiplayer' && (
        <MultiplayerGameView
          onReturnToLobby={() => setScreen('lobby')}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      )}

      {/* Global Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      <HUDLegendModal
        isOpen={isHUDLegendOpen}
        onClose={() => setIsHUDLegendOpen(false)}
      />
    </div>
  );
}
