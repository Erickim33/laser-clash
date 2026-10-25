/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PlayerInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  aimAngle: number;
  shooting: boolean;
  dash: boolean;
  shield: boolean;
  interact: boolean;
}

export type WeaponType = 'standard' | 'rapid' | 'triple' | 'charged' | 'railgun';

export interface PlayerState {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  health: number;
  maxHealth: number;
  shield: number;
  maxShield: number;
  shieldActive: boolean;
  shieldDisabledTimer: number;
  dashCooldown: number;
  isDashing: boolean;
  weaponType: WeaponType;
  heat: number; // 0 to 100
  isOverheated: boolean;
  kills: number;
  damageDealt: number;
  isAlive: boolean;
  isBot: boolean;
  ping: number;
  eliminatedBy?: string;
  survivalTime: number;
  rank?: number;
}

export interface ProjectileState {
  id: string;
  shooterId: string;
  shooterColor: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  color: string;
  radius: number;
  bouncesLeft: number;
  type: WeaponType;
  life: number;
}

export interface LaserBeamEvent {
  id: string;
  shooterId: string;
  color: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  duration: number;
  thickness: number;
}

export interface ArenaObstacle {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isMirror?: boolean; // Reflects lasers
}

export interface SafeZone {
  currentX: number;
  currentY: number;
  currentRadius: number;
  targetX: number;
  targetY: number;
  targetRadius: number;
  phase: number;
  shrinkTimer: number;
  shrinkDuration: number;
  isShrinking: boolean;
  damagePerSecond: number;
}

export interface PowerUp {
  id: string;
  x: number;
  y: number;
  type: 'rapid' | 'triple' | 'shield_recharge' | 'damage_boost' | 'dash_boost';
  color: string;
  respawnTime: number;
}

export interface KillEvent {
  killerId: string;
  killerName: string;
  killerColor: string;
  victimId: string;
  victimName: string;
  victimColor: string;
  weapon: WeaponType;
  timestamp: number;
}

export type MatchPhase = 'waiting' | 'countdown' | 'active' | 'game_over';

export interface ReactorNode {
  id: string;
  name: string;
  x: number;
  y: number;
  color: string;
}

export interface ReactorState {
  x: number;
  y: number;
  nodes: ReactorNode[];
  sequence: string[];
  sequenceProgress: number;
  charge: number;
  empTimeRemaining: number;
  eventText: string;
  eventTimeRemaining: number;
}

export interface GameStateSnapshot {
  phase: MatchPhase;
  countdown: number;
  matchTime: number;
  aliveCount: number;
  totalPlayers: number;
  players: Record<string, PlayerState>;
  projectiles: ProjectileState[];
  laserBeams: LaserBeamEvent[];
  powerUps: PowerUp[];
  safeZone: SafeZone;
  reactor: ReactorState;
  obstacles: ArenaObstacle[];
  recentKills: KillEvent[];
  winner?: {
    id: string;
    name: string;
    color: string;
    kills: number;
    damageDealt: number;
    survivalTime: number;
  };
}

// Network Packets
export type ClientMessage =
  | { type: 'join'; name: string; color: string; roomId?: string; fillBots?: boolean; targetCount?: number }
  | { type: 'input'; input: PlayerInput }
  | { type: 'start_match' }
  | { type: 'ping'; clientTime: number };

export type ServerMessage =
  | { type: 'init'; playerId: string; roomId: string; isHost: boolean; obstacles: ArenaObstacle[] }
  | { type: 'state'; snapshot: GameStateSnapshot }
  | { type: 'eliminated'; killerName?: string; rank: number; stats: { kills: number; damage: number; time: number } }
  | { type: 'pong'; clientTime: number; serverTime: number }
  | { type: 'error'; message: string };
