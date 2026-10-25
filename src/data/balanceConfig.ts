/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { EnemyType, UpgradeConfig, UpgradeType } from '../types/game';

export const GAME_CONSTANTS = {
  // Expanded Arena (Section 2)
  WORLD_WIDTH: 2500,
  WORLD_HEIGHT: 2500,
  
  // Player Movement & Physics (Section 1)
  PLAYER_MAX_SPEED: 280,
  PLAYER_ACCEL: 2000,
  PLAYER_FRICTION: 0.88,
  PLAYER_SIZE: 24,
  STARTING_HEALTH: 60,
  STARTING_SHIELD: 50,
  SHIELD_REGEN_DELAY: 3.5,
  SHIELD_REGEN_RATE: 12,
  STARTING_ENERGY: 60,
  PASSIVE_ENERGY_PER_SECOND: 1.5,
  
  // Star 3-bullet temporary boost (10-second duration with loader)
  STAR_BOOST_DURATION: 10.0,
  
  // Allied & Enemy Cores
  ALLIED_CORE_MAX_HEALTH: 1500,
  ALLIED_CORE_MAX_SHIELD: 400,
  ENEMY_CORE_MAX_HEALTH: 2500,
  
  // Stasis Traps (Orange glowing objects that trap player)
  STASIS_TRAP_COUNT: 14,
  STASIS_TRAP_DURATION: 3.5,
  STASIS_TRAP_HEALTH: 55,
  
  // Weapons & Bullets per shot (Section 4 & 5)
  BASIC_LASER_DAMAGE: 16,
  BASIC_FIRE_INTERVAL_SECONDS: 0.38,
  MIN_FIRE_INTERVAL_SECONDS: 0.12,
  PROJECTILE_SPEED: 650,
  PROJECTILE_RADIUS: 4.5,
  PROJECTILE_MAX_RANGE: 750,
  TARGETING_RANGE: 620,
  
  // Multi-shot spread angles (Section 4)
  SPREAD_ANGLES: {
    1: [0],
    2: [-0.09, 0.09],
    3: [-0.17, 0, 0.17], // 3 bullets milestone!
    4: [-0.24, -0.08, 0.08, 0.24],
    5: [-0.32, -0.16, 0, 0.16, 0.32],
  } as Record<number, number[]>,

  // Level-Up Stars (Section 4)
  STAR_SPAWN_INTERVAL_SECONDS: 10,
  STAR_MAX_ACTIVE: 6,
  STAR_LIFETIME_SECONDS: 35,
  STAR_RADIUS: 14,

  // Enemy Configuration (Section 3)
  MAX_ENEMIES_BASE: 25,
  MAX_ENEMIES_SCALED_PER_LEVEL: 3,
  SPAWN_INTERVAL_BASE_SECONDS: 1.8,
  MIN_SPAWN_DISTANCE_FROM_PLAYER: 380,
  MAX_SPAWN_DISTANCE_FROM_PLAYER: 850,
  WAVE_INTERVAL_SECONDS: 28,

  ENEMY_PROFILES: {
    chaser: {
      type: 'chaser' as EnemyType,
      size: 22,
      health: 26,
      speed: 155,
      damage: 18,
      xpReward: 16,
      energyReward: 6,
      scoreReward: 100,
      shootCooldown: 0,
      color: '#ffffff',
    },
    ranged: {
      type: 'ranged' as EnemyType,
      size: 24,
      health: 44,
      speed: 95,
      damage: 16,
      shootCooldown: 2.0,
      projectileSpeed: 340,
      idealDistance: 260,
      xpReward: 28,
      energyReward: 10,
      scoreReward: 200,
      color: '#38bdf8',
    },
    heavy: {
      type: 'heavy' as EnemyType,
      size: 34,
      health: 125,
      speed: 70,
      damage: 34,
      shootCooldown: 0,
      xpReward: 65,
      energyReward: 22,
      scoreReward: 350,
      color: '#f59e0b',
    },
    boss: {
      type: 'boss' as EnemyType,
      size: 54,
      health: 900,
      speed: 60,
      damage: 40,
      shootCooldown: 1.3,
      projectileSpeed: 380,
      idealDistance: 320,
      xpReward: 350,
      energyReward: 70,
      scoreReward: 1500,
      color: '#ec4899',
    },
  },

  // Special Abilities (GDD 5)
  ABILITIES: {
    OVERDRIVE_BEAM: {
      id: 'overdrive_beam' as const,
      name: 'Overdrive Beam',
      cost: 50,
      damage: 75,
      durationSeconds: 0.6,
      cooldownSeconds: 7.0,
      range: 800,
    },
    PULSE_SHIELD: {
      id: 'pulse_shield' as const,
      name: 'Pulse Shield',
      cost: 40,
      durationSeconds: 4.0,
      cooldownSeconds: 9.0,
      damageReduction: 0.75,
    },
    ENERGY_PULSE: {
      id: 'energy_pulse' as const,
      name: 'Energy Pulse',
      cost: 45,
      damage: 40,
      cooldownSeconds: 9.0,
      radius: 480,
      speed: 550,
    },
  },
};

export const UPGRADE_DEFINITIONS: Record<UpgradeType, UpgradeConfig> = {
  damage: {
    id: 'damage',
    name: 'Laser Damage',
    description: '+25% damage per projectile',
    baseCost: 40,
    growthRate: 1.35,
    maxLevel: 8,
    shortcutKey: '1',
  },
  fire_rate: {
    id: 'fire_rate',
    name: 'Fire Rate',
    description: '15% faster automatic firing',
    baseCost: 45,
    growthRate: 1.35,
    maxLevel: 8,
    shortcutKey: '2',
  },
  armor: {
    id: 'armor',
    name: 'Core Armor',
    description: '+10% incoming damage absorption',
    baseCost: 55,
    growthRate: 1.4,
    maxLevel: 5,
    shortcutKey: '3',
  },
  generator: {
    id: 'generator',
    name: 'Energy Gen',
    description: '+0.8 energy/sec passive income',
    baseCost: 50,
    growthRate: 1.35,
    maxLevel: 6,
    shortcutKey: '4',
  },
  piercing: {
    id: 'piercing',
    name: 'Piercing Core',
    description: 'Lasers penetrate through multiple enemies',
    baseCost: 80,
    growthRate: 1.5,
    maxLevel: 3,
    shortcutKey: '5',
  },
  overdrive: {
    id: 'overdrive',
    name: 'Unlock Overdrive',
    description: 'Tactical manual directional beam blast',
    baseCost: 90,
    growthRate: 1.0,
    maxLevel: 1,
    shortcutKey: '6',
  },
};

export function getUpgradeCost(upgradeType: UpgradeType, currentLevel: number): number {
  const config = UPGRADE_DEFINITIONS[upgradeType];
  if (!config) return 999;
  return Math.round(config.baseCost * Math.pow(config.growthRate, currentLevel));
}

// XP curve for player levels (GDD Expansion 6 & 7)
export function getRequiredXPForLevel(level: number): number {
  return Math.round(40 * Math.pow(1.32, level - 1));
}

export interface MetaUpgradeConfig {
  id: string;
  name: string;
  description: string;
  baseCost: number;
  costMultiplier: number;
  maxLevel: number;
  bonusText: string;
}

export const META_UPGRADES: Record<string, MetaUpgradeConfig> = {
  hull_plating: {
    id: 'hull_plating',
    name: 'Reinforced Hull Plating',
    description: 'Permanently increases maximum player health by +15 HP.',
    baseCost: 200,
    costMultiplier: 1.5,
    maxLevel: 5,
    bonusText: '+15 Max Health / lvl',
  },
  shield_capacitor: {
    id: 'shield_capacitor',
    name: 'Shield Flux Capacitor',
    description: 'Permanently increases shield capacity (+15) and shield recharge rate (+2/s).',
    baseCost: 250,
    costMultiplier: 1.6,
    maxLevel: 5,
    bonusText: '+15 Shield & Faster Regen',
  },
  blaster_overclock: {
    id: 'blaster_overclock',
    name: 'Overclocked Blaster Coils',
    description: 'Permanently increases starting laser base damage by +4.',
    baseCost: 300,
    costMultiplier: 1.7,
    maxLevel: 5,
    bonusText: '+4 Base Damage / lvl',
  },
  core_bastion: {
    id: 'core_bastion',
    name: 'Allied Core Bastion Matrix',
    description: 'Increases Allied Base Core health by +300 and unlocks an extra defensive turret.',
    baseCost: 350,
    costMultiplier: 1.6,
    maxLevel: 4,
    bonusText: '+300 Base Core HP & Auto-Turret',
  },
  stasis_phase_shift: {
    id: 'stasis_phase_shift',
    name: 'Stasis Phase Dampeners',
    description: 'Reduces the duration trapped inside orange anomaly objects by 30%.',
    baseCost: 220,
    costMultiplier: 1.5,
    maxLevel: 3,
    bonusText: '-30% Stasis Trap Duration',
  },
};

export const SECTOR_NAMES: Record<number, { name: string; subtitle: string; bossName: string }> = {
  1: {
    name: 'Sector 1: Neon Outpost',
    subtitle: 'Outer perimeter defended by Chaser packs and Ranged squads.',
    bossName: 'VOID DREADNOUGHT',
  },
  2: {
    name: 'Sector 2: Obsidian Expanse',
    subtitle: 'Fortified redoubts with relentless Heavy siege units.',
    bossName: 'OBSIDIAN COLOSSUS',
  },
  3: {
    name: 'Sector 3: Hyperion Void',
    subtitle: 'High-density star cluster surrounded by aggressive elite defenders.',
    bossName: 'HYPERION TITAN',
  },
  4: {
    name: 'Sector 4: The Overcore Citadel',
    subtitle: 'The epicenter of enemy command. Destroy the ultimate Overcore!',
    bossName: 'THE OVERCORE EMPEROR',
  },
};

export function getMetaUpgradeCost(upgradeId: string, currentLevel: number): number {
  const config = META_UPGRADES[upgradeId];
  if (!config) return 9999;
  return Math.round(config.baseCost * Math.pow(config.costMultiplier, currentLevel));
}
