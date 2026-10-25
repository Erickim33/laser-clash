/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type GameScreen = 'menu' | 'battle' | 'results';

export type Difficulty = 'easy' | 'normal' | 'hard';

export type EnemyType = 'chaser' | 'ranged' | 'heavy' | 'boss';

export type UpgradeType = 
  | 'damage' 
  | 'fire_rate' 
  | 'armor' 
  | 'generator' 
  | 'piercing' 
  | 'overdrive';

export type SpecialAbilityType = 
  | 'overdrive_beam' 
  | 'pulse_shield' 
  | 'energy_pulse';

export interface CoreState {
  id: string;
  health: number;
  maxHealth: number;
  energy: number;
  baseDamage: number;
  fireInterval: number;
  lastShotTime: number;
  armorLevel: number;
  generatorLevel: number;
  piercingLevel: number;
  overdriveUnlocked: boolean;
  shieldActive: boolean;
  shieldDurationRemaining: number;
  shieldCooldownRemaining: number;
  overdriveCooldownRemaining: number;
  pulseCooldownRemaining: number;
  disruptedDurationRemaining?: number;
  totalDamageDealt?: number;
  totalDamageReceived?: number;
  upgradesPurchased: Record<UpgradeType, number>;
  isDead: boolean;
}

export interface UpgradeConfig {
  id: UpgradeType;
  name: string;
  description: string;
  baseCost: number;
  growthRate: number;
  maxLevel: number;
  shortcutKey: string;
}

export interface Obstacle {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'pillar' | 'barrier' | 'monolith' | 'bunker' | 'corner';
  hitFlash?: number;
}

// Stasis Trap: Orange glowing objects that don't shoot, but trap player on contact
export interface StasisTrap {
  id: string;
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  health: number;
  maxHealth: number;
  pulsePhase: number;
  isTrappingPlayer: boolean;
}

// Player's Base Core (defend this!)
export interface AlliedCore {
  x: number;
  y: number;
  size: number;
  health: number;
  maxHealth: number;
  shield: number;
  maxShield: number;
  turrets: Array<{
    x: number;
    y: number;
    angle: number;
    lastShot: number;
  }>;
  isDead: boolean;
}

// Enemy Sector Overcore (Main Goal: Destroy this!)
export interface EnemyCore {
  x: number;
  y: number;
  size: number;
  health: number;
  maxHealth: number;
  shieldAngle: number;
  turrets: Array<{
    x: number;
    y: number;
    angle: number;
    lastShot: number;
  }>;
  defensiveShields: Array<{
    angle: number;
    arcLength: number;
    health: number;
    maxHealth: number;
  }>;
  lastCounterAttack: number;
  isDead: boolean;
}

export interface PlayerCube {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  speed: number;
  health: number;
  maxHealth: number;
  shield: number;
  maxShield: number;
  shieldRegenDelay: number;
  energy: number;
  score: number;
  isInCover: boolean;
  
  // Star 3-bullet temporary boost (10-second duration with loader)
  starBoostTimer: number;
  starBoostMaxDuration: number;
  
  // Trapped inside orange glowing stasis object
  isTrapped: boolean;
  trappedTimeRemaining: number;
  trappedInsideId?: string;
  
  // Two separate progressions (GDD Expansion 6)
  weaponLevel: number; // 1 to 5+
  bulletsPerShot: number;
  
  playerLevel: number; // level 1, 2, 3... from enemy XP
  xp: number;
  xpToNextLevel: number;
  
  baseDamage: number;
  fireInterval: number;
  lastShotTime: number;
  armorLevel: number;
  generatorLevel: number;
  piercingLevel: number;
  overdriveUnlocked: boolean;
  
  // Tactical Buffs & Cooldowns
  shieldActive: boolean;
  shieldDurationRemaining: number;
  shieldCooldownRemaining: number;
  overdriveCooldownRemaining: number;
  pulseCooldownRemaining: number;
  
  starsCollected: number;
  enemiesKilled: number;
  isDead: boolean;
}

export interface Enemy {
  id: string;
  type: EnemyType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  health: number;
  maxHealth: number;
  speed: number;
  damage: number;
  xpReward: number;
  energyReward: number;
  scoreReward: number;
  shootCooldown: number;
  lastShotTime: number;
  color: string;
  
  // If an enemy steals a star
  isEmpowered?: boolean;
  
  // Boss features
  isBoss?: boolean;
  bossName?: string;
  attackPhase?: number;
}

export interface LevelUpStar {
  id: string;
  x: number;
  y: number;
  size: number;
  life: number;
  maxLife: number;
  rotation: number;
}

export interface Projectile {
  id: string;
  source: 'player' | 'enemy';
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  radius: number;
  isPiercing: boolean;
  penetratedTargets: Set<string>;
  trail: Array<{ x: number; y: number; alpha: number }>;
}

export interface LaserBeam {
  id: string;
  source: 'player' | 'enemy';
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  width: number;
  durationRemaining: number;
  maxDuration: number;
  damage: number;
  isOverdrive: boolean;
}

export interface Shockwave {
  id: string;
  source: 'player' | 'enemy';
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  damage: number;
  hitEnemies: Set<string>;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
  shape: 'square' | 'line' | 'spark';
}

export interface FloatingText {
  id: string;
  text: string;
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  isCrit?: boolean;
}

export interface EnergyPickup {
  id: string;
  x: number;
  y: number;
  amount: number;
  size: number;
  angle: number;
}

export interface CameraState {
  x: number;
  y: number;
  viewportWidth: number;
  viewportHeight: number;
}

// Kill-Cam Replay Buffer Frame
export interface ReplayFrame {
  timestamp: number;
  playerPos: { x: number; y: number };
  playerHp: number;
  playerShield: boolean;
  enemies: Array<{
    x: number;
    y: number;
    type: EnemyType;
    hp: number;
  }>;
  projectiles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    source: 'player' | 'enemy';
    isPiercing: boolean;
  }>;
  beams: Array<{
    source: 'player' | 'enemy';
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    width: number;
    isOverdrive: boolean;
  }>;
  shockwaves: Array<{
    x: number;
    y: number;
    radius: number;
    maxRadius: number;
  }>;
}

// Match Results
export interface MatchResult {
  winner: 'player' | 'enemy';
  reason: 'kill' | 'surrender' | 'core_destroyed';
  score: number;
  survivalTimeSeconds: number;
  playerLevelReached: number;
  weaponLevelReached: number;
  bulletsPerShot: number;
  enemiesKilled: number;
  starsCollected: number;
  damageDealt: number;
  damageReceived: number;
  difficulty: Difficulty;
  isNewBestScore: boolean;
  hadCleanKill: boolean;
  sector: number;
  sectorCompleted: boolean;
  techCreditsEarned: number;
  enemyCoreDestroyed: boolean;
  alliedCoreDestroyed: boolean;
}

// Persistent Session Stats
export interface PersistentStats {
  matchesPlayed: number;
  bestScore: number;
  bestSurvivalTime: number;
  highestPlayerLevel: number;
  highestWeaponLevel: number;
  totalEnemiesKilled: number;
  totalStarsCollected: number;
  wins: number;
  losses: number;
  draws: number;
  bestDamageDealt: number;
  favoriteUpgrade: UpgradeType | 'none';
  upgradeCounts: Record<UpgradeType, number>;
  
  // Permanent Progression
  techCredits: number;
  highestSector: number;
  metaUpgrades: Record<string, number>;
}

// Game Settings
export interface GameSettings {
  masterVolume: number;
  sfxVolume: number;
  sfxEnabled: boolean;
  musicVolume: number;
  musicEnabled: boolean;
  screenShake: boolean;
  reducedEffects: boolean;
  colorblindMode: boolean;
  hapticsEnabled: boolean;
  hasCompletedTutorial: boolean;
  hasSeenHUDPrimer: boolean;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  stack?: string;
  data?: Record<string, unknown>;
}
