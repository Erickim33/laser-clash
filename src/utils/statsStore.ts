/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MatchResult, PersistentStats, UpgradeType } from '../types/game';
import { logger } from './logger';

const STATS_KEY = 'laser_clash_session_stats_v2';

const INITIAL_STATS: PersistentStats = {
  matchesPlayed: 0,
  bestScore: 0,
  bestSurvivalTime: 0,
  highestPlayerLevel: 1,
  highestWeaponLevel: 1,
  totalEnemiesKilled: 0,
  totalStarsCollected: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  bestDamageDealt: 0,
  favoriteUpgrade: 'none',
  upgradeCounts: {
    damage: 0,
    fire_rate: 0,
    armor: 0,
    generator: 0,
    piercing: 0,
    overdrive: 0,
  },
  techCredits: 100, // starter credits
  highestSector: 1,
  metaUpgrades: {
    hull_plating: 0,
    shield_capacitor: 0,
    blaster_overclock: 0,
    core_bastion: 0,
    stasis_phase_shift: 0,
  },
};

type StatsListener = (stats: PersistentStats) => void;

class StatsStore {
  private stats: PersistentStats;
  private listeners: Set<StatsListener> = new Set();

  constructor() {
    this.stats = this.load();
  }

  private load(): PersistentStats {
    try {
      const raw = localStorage.getItem(STATS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          ...INITIAL_STATS,
          ...parsed,
          upgradeCounts: { ...INITIAL_STATS.upgradeCounts, ...(parsed.upgradeCounts || {}) },
          metaUpgrades: { ...INITIAL_STATS.metaUpgrades, ...(parsed.metaUpgrades || {}) },
        };
      }
    } catch (e) {
      logger.warn('Failed to parse stats from localStorage', { error: String(e) });
    }
    return { ...INITIAL_STATS };
  }

  public getStats(): PersistentStats {
    return { ...this.stats };
  }

  public purchaseMetaUpgrade(upgradeId: string, cost: number, maxLevel: number): boolean {
    const current = this.stats.metaUpgrades[upgradeId] || 0;
    if (current >= maxLevel) return false;
    if (this.stats.techCredits < cost) return false;

    this.stats.techCredits -= cost;
    this.stats.metaUpgrades[upgradeId] = current + 1;
    this.save();
    this.listeners.forEach((l) => l(this.stats));
    return true;
  }

  public recordMatch(
    result: MatchResult,
    playerUpgradesPurchased: Record<UpgradeType, number>
  ): { isNewBestScore: boolean; favoriteUpgrade: UpgradeType | 'none' } {
    const isNewBest = result.score > this.stats.bestScore && result.score > 0;
    
    this.stats.matchesPlayed += 1;
    if (result.winner === 'player') {
      this.stats.wins += 1;
    } else {
      this.stats.losses += 1;
    }

    if (result.score > this.stats.bestScore) {
      this.stats.bestScore = result.score;
    }
    if (result.survivalTimeSeconds > this.stats.bestSurvivalTime) {
      this.stats.bestSurvivalTime = result.survivalTimeSeconds;
    }
    if (result.playerLevelReached > this.stats.highestPlayerLevel) {
      this.stats.highestPlayerLevel = result.playerLevelReached;
    }
    if (result.weaponLevelReached > this.stats.highestWeaponLevel) {
      this.stats.highestWeaponLevel = result.weaponLevelReached;
    }

    this.stats.totalEnemiesKilled += result.enemiesKilled;
    this.stats.totalStarsCollected += result.starsCollected;

    // Credits & Sector unlocks
    this.stats.techCredits += result.techCreditsEarned || 0;
    if (result.sectorCompleted && result.sector >= this.stats.highestSector) {
      this.stats.highestSector = Math.min(4, result.sector + 1);
    }

    // Accumulate upgrade counts
    for (const [key, count] of Object.entries(playerUpgradesPurchased)) {
      const uKey = key as UpgradeType;
      this.stats.upgradeCounts[uKey] = (this.stats.upgradeCounts[uKey] || 0) + (count || 0);
    }

    let maxPurchased = 0;
    let fav: UpgradeType | 'none' = 'none';
    for (const [key, count] of Object.entries(this.stats.upgradeCounts)) {
      if (count > maxPurchased) {
        maxPurchased = count;
        fav = key as UpgradeType;
      }
    }
    this.stats.favoriteUpgrade = fav;

    this.save();
    this.listeners.forEach((l) => l(this.stats));

    return {
      isNewBestScore: isNewBest,
      favoriteUpgrade: fav,
    };
  }

  public resetStats() {
    this.stats = {
      ...INITIAL_STATS,
      upgradeCounts: { ...INITIAL_STATS.upgradeCounts },
      metaUpgrades: { ...INITIAL_STATS.metaUpgrades },
    };
    this.save();
    this.listeners.forEach((l) => l(this.stats));
    logger.info('User reset game stats');
  }

  private save() {
    try {
      localStorage.setItem(STATS_KEY, JSON.stringify(this.stats));
    } catch (e) {
      logger.error('Failed to save stats to localStorage', { error: String(e) });
    }
  }

  public subscribe(listener: StatsListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const statsStore = new StatsStore();
