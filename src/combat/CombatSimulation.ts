/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GAME_CONSTANTS,
  UPGRADE_DEFINITIONS,
  getUpgradeCost,
  getRequiredXPForLevel,
  SECTOR_NAMES,
} from '../data/balanceConfig';
import {
  AlliedCore,
  CameraState,
  Difficulty,
  Enemy,
  EnemyCore,
  EnemyType,
  FloatingText,
  LaserBeam,
  LevelUpStar,
  MatchResult,
  Obstacle,
  Particle,
  PlayerCube,
  Projectile,
  ReplayFrame,
  Shockwave,
  StasisTrap,
  UpgradeType,
} from '../types/game';
import { audioManager } from '../audio/AudioManager';
import { HapticsManager } from '../utils/haptics';
import { statsStore } from '../utils/statsStore';
import { ReplayBuffer } from './ReplayBuffer';
import { TutorialController } from '../tutorial/TutorialController';

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  joyX: number;
  joyY: number;
}

/**
 * Fast 2D line segment vs AABB intersection test for Line-of-Sight and Cover
 */
export function isLineBlockedByObstacles(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  obstacles: Obstacle[]
): boolean {
  for (const obs of obstacles) {
    if (lineSegmentIntersectsAABB(x1, y1, x2, y2, obs.x, obs.y, obs.width, obs.height)) {
      return true;
    }
  }
  return false;
}

function lineSegmentIntersectsAABB(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number
): boolean {
  let tmin = 0;
  let tmax = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;

  const p = [-dx, dx, -dy, dy];
  const q = [x1 - boxX, boxX + boxW - x1, y1 - boxY, boxY + boxH - y1];

  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > tmax) return false;
        if (t > tmin) tmin = t;
      } else {
        if (t < tmin) return false;
        if (t < tmax) tmax = t;
      }
    }
  }
  return tmin <= tmax;
}

export class CombatSimulation {
  public player: PlayerCube;
  public difficulty: Difficulty;
  public sector: number;
  public matchTime: number = 0;
  public isPaused: boolean = false;
  public isGameOver: boolean = false;
  
  public camera: CameraState;
  public obstacles: Obstacle[] = [];
  public enemies: Enemy[] = [];
  public stars: LevelUpStar[] = [];
  public projectiles: Projectile[] = [];
  public laserBeams: LaserBeam[] = [];
  public shockwaves: Shockwave[] = [];
  public particles: Particle[] = [];
  public floatingTexts: FloatingText[] = [];

  // Allied & Enemy Cores (Main Objective)
  public alliedCore: AlliedCore;
  public enemyCore: EnemyCore;

  // Stasis Traps (Orange glowing objects that trap player)
  public stasisTraps: StasisTrap[] = [];

  public replayBuffer: ReplayBuffer;
  public tutorialController: TutorialController;
  public screenShake: number = 0;

  // Wave & Spawning
  public currentWave: number = 1;
  public waveTimer: number = 0;
  public waveWarning: string | null = null;
  public waveWarningTimer: number = 0;
  public isUnlimited: boolean = false;
  public overcoreTier: number = 1;

  private nextSpawnTime: number = 1.0;
  private nextStarSpawnTime: number = 3.0;
  private projectileIdCounter: number = 0;
  private enemyIdCounter: number = 0;
  private onGameOverCallback?: (result: MatchResult) => void;

  constructor(
    difficulty: Difficulty,
    tutorialController: TutorialController,
    onGameOver?: (result: MatchResult) => void,
    sector: number = 1
  ) {
    this.difficulty = difficulty;
    this.tutorialController = tutorialController;
    this.onGameOverCallback = onGameOver;
    this.sector = sector;
    this.replayBuffer = new ReplayBuffer(3.0);

    // Initial camera centered on player/allied base area
    this.camera = {
      x: 300,
      y: 300,
      viewportWidth: 480,
      viewportHeight: 720,
    };

    // Initialize Allied Base Core (Defense Objective)
    const metaBastion = statsStore.getStats().metaUpgrades?.core_bastion || 0;
    this.alliedCore = {
      x: 360,
      y: 360,
      size: 74,
      health: GAME_CONSTANTS.ALLIED_CORE_MAX_HEALTH + metaBastion * 300,
      maxHealth: GAME_CONSTANTS.ALLIED_CORE_MAX_HEALTH + metaBastion * 300,
      shield: GAME_CONSTANTS.ALLIED_CORE_MAX_SHIELD,
      maxShield: GAME_CONSTANTS.ALLIED_CORE_MAX_SHIELD,
      turrets: [
        { x: 360 - 45, y: 360, angle: 0, lastShot: 0 },
        { x: 360 + 45, y: 360, angle: 0, lastShot: 0 },
        ...(metaBastion > 0 ? [{ x: 360, y: 360 - 45, angle: 0, lastShot: 0 }] : []),
      ],
      isDead: false,
    };

    // Initialize Enemy Sector Overcore (Main Offensive Goal)
    const sectorHpScale = 1 + (this.sector - 1) * 0.4;
    this.enemyCore = {
      x: 2150,
      y: 2150,
      size: 96,
      health: Math.round(GAME_CONSTANTS.ENEMY_CORE_MAX_HEALTH * sectorHpScale),
      maxHealth: Math.round(GAME_CONSTANTS.ENEMY_CORE_MAX_HEALTH * sectorHpScale),
      shieldAngle: 0,
      turrets: [
        { x: 2150 - 65, y: 2150 - 65, angle: 0, lastShot: 0 },
        { x: 2150 + 65, y: 2150 - 65, angle: 0, lastShot: 0 },
        { x: 2150 - 65, y: 2150 + 65, angle: 0, lastShot: 0 },
        { x: 2150 + 65, y: 2150 + 65, angle: 0, lastShot: 0 },
      ],
      defensiveShields: [
        { angle: 0, arcLength: Math.PI * 0.45, health: 320, maxHealth: 320 },
        { angle: Math.PI, arcLength: Math.PI * 0.45, health: 320, maxHealth: 320 },
      ],
      lastCounterAttack: 0,
      isDead: false,
    };

    // Initialize player near Allied Core
    this.player = this.createInitialPlayer();

    // Generate tactical geometric obstacles across arena
    this.generateObstacles();

    // Generate Stasis Traps (Orange glowing objects)
    this.generateStasisTraps();

    if (this.tutorialController.isActive()) {
      this.tutorialController.start();
    }
  }

  private createInitialPlayer(): PlayerCube {
    const meta = statsStore.getStats().metaUpgrades || {};
    const bonusHp = (meta.hull_plating || 0) * 15;
    const bonusShield = (meta.shield_capacitor || 0) * 15;
    const bonusDmg = (meta.blaster_overclock || 0) * 4;

    return {
      x: 480,
      y: 480,
      vx: 0,
      vy: 0,
      size: GAME_CONSTANTS.PLAYER_SIZE,
      speed: GAME_CONSTANTS.PLAYER_MAX_SPEED,
      health: GAME_CONSTANTS.STARTING_HEALTH + bonusHp,
      maxHealth: GAME_CONSTANTS.STARTING_HEALTH + bonusHp,
      shield: GAME_CONSTANTS.STARTING_SHIELD + bonusShield,
      maxShield: GAME_CONSTANTS.STARTING_SHIELD + bonusShield,
      shieldRegenDelay: 0,
      energy: GAME_CONSTANTS.STARTING_ENERGY,
      score: 0,
      isInCover: false,
      
      // Star 3-bullet temporary boost (10-second duration with loader)
      starBoostTimer: 0,
      starBoostMaxDuration: GAME_CONSTANTS.STAR_BOOST_DURATION,
      
      // Trapped inside orange glowing stasis object
      isTrapped: false,
      trappedTimeRemaining: 0,
      
      // Weapon progression (Stars collected)
      weaponLevel: 1,
      bulletsPerShot: 1,
      
      // Player progression (XP from enemies)
      playerLevel: 1,
      xp: 0,
      xpToNextLevel: getRequiredXPForLevel(1),
      
      baseDamage: GAME_CONSTANTS.BASIC_LASER_DAMAGE + bonusDmg,
      fireInterval: GAME_CONSTANTS.BASIC_FIRE_INTERVAL_SECONDS,
      lastShotTime: 0,
      armorLevel: 0,
      generatorLevel: 0,
      piercingLevel: 0,
      overdriveUnlocked: false,

      shieldActive: false,
      shieldDurationRemaining: 0,
      shieldCooldownRemaining: 0,
      overdriveCooldownRemaining: 0,
      pulseCooldownRemaining: 0,

      starsCollected: 0,
      enemiesKilled: 0,
      isDead: false,
    };
  }

  private generateStasisTraps() {
    this.stasisTraps = [];
    const count = GAME_CONSTANTS.STASIS_TRAP_COUNT;
    for (let i = 0; i < count; i++) {
      // Position traps along mid-field and outer choke points
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const dist = 500 + Math.random() * 1200;
      const x = Math.max(150, Math.min(GAME_CONSTANTS.WORLD_WIDTH - 150, 1250 + Math.cos(angle) * dist));
      const y = Math.max(150, Math.min(GAME_CONSTANTS.WORLD_HEIGHT - 150, 1250 + Math.sin(angle) * dist));

      this.stasisTraps.push({
        id: `stasis_${i}`,
        x,
        y,
        radius: 20,
        vx: (Math.random() - 0.5) * 20,
        vy: (Math.random() - 0.5) * 20,
        health: GAME_CONSTANTS.STASIS_TRAP_HEALTH,
        maxHealth: GAME_CONSTANTS.STASIS_TRAP_HEALTH,
        pulsePhase: Math.random() * Math.PI * 2,
        isTrappingPlayer: false,
      });
    }
  }

  private generateObstacles() {
    this.obstacles = [];
    const cx = GAME_CONSTANTS.WORLD_WIDTH / 2;
    const cy = GAME_CONSTANTS.WORLD_HEIGHT / 2;

    // 1. IMMEDIATE SPAWN AREA BUNKERS (Distance ~160-260 from player start)
    // 4 L-shaped tactical cover compounds with inner alcoves you can tuck behind immediately!
    const spawnOff = 220;
    // North bunker: horizontal blast wall + right downward wing
    this.obstacles.push(
      { id: 'bunker_n_h', x: cx - 110, y: cy - spawnOff, width: 220, height: 42, type: 'bunker', hitFlash: 0 },
      { id: 'bunker_n_v1', x: cx - 110, y: cy - spawnOff + 42, width: 42, height: 75, type: 'bunker', hitFlash: 0 },
      { id: 'bunker_n_v2', x: cx + 68, y: cy - spawnOff + 42, width: 42, height: 75, type: 'bunker', hitFlash: 0 }
    );

    // South bunker: horizontal blast wall + wings
    this.obstacles.push(
      { id: 'bunker_s_h', x: cx - 110, y: cy + spawnOff - 42, width: 220, height: 42, type: 'bunker', hitFlash: 0 },
      { id: 'bunker_s_v1', x: cx - 110, y: cy + spawnOff - 117, width: 42, height: 75, type: 'bunker', hitFlash: 0 },
      { id: 'bunker_s_v2', x: cx + 68, y: cy + spawnOff - 117, width: 42, height: 75, type: 'bunker', hitFlash: 0 }
    );

    // West & East defensive walls with shooting slots
    this.obstacles.push(
      { id: 'bunker_w_v', x: cx - spawnOff - 10, y: cy - 90, width: 42, height: 180, type: 'barrier', hitFlash: 0 },
      { id: 'bunker_e_v', x: cx + spawnOff - 32, y: cy - 90, width: 42, height: 180, type: 'barrier', hitFlash: 0 }
    );

    // 4 Center Heavy Pillars
    const pDist = 130;
    this.obstacles.push(
      { id: 'pillar_c1', x: cx - pDist - 25, y: cy - pDist - 25, width: 50, height: 50, type: 'pillar', hitFlash: 0 },
      { id: 'pillar_c2', x: cx + pDist - 25, y: cy - pDist - 25, width: 50, height: 50, type: 'pillar', hitFlash: 0 },
      { id: 'pillar_c3', x: cx - pDist - 25, y: cy + pDist - 25, width: 50, height: 50, type: 'pillar', hitFlash: 0 },
      { id: 'pillar_c4', x: cx + pDist - 25, y: cy + pDist - 25, width: 50, height: 50, type: 'pillar', hitFlash: 0 }
    );

    // 2. MID-RANGE TACTICAL REDOUBTS (Distance 420 - 650)
    // 8 stations in cardinal & diagonal directions
    const midDistances = [460, 580];
    const midAngles = [0, Math.PI / 4, Math.PI / 2, 3 * Math.PI / 4, Math.PI, 5 * Math.PI / 4, 3 * Math.PI / 2, 7 * Math.PI / 4];
    midAngles.forEach((ang, i) => {
      const d = midDistances[i % 2];
      const ox = cx + Math.cos(ang) * d;
      const oy = cy + Math.sin(ang) * d;

      if (i % 2 === 0) {
        // T-Shaped barricade
        const isHoriz = Math.abs(Math.cos(ang)) < 0.5;
        if (isHoriz) {
          this.obstacles.push(
            { id: `mid_b_${i}_1`, x: ox - 90, y: oy - 20, width: 180, height: 40, type: 'barrier', hitFlash: 0 },
            { id: `mid_b_${i}_2`, x: ox - 20, y: oy + 20, width: 40, height: 60, type: 'corner', hitFlash: 0 }
          );
        } else {
          this.obstacles.push(
            { id: `mid_b_${i}_1`, x: ox - 20, y: oy - 90, width: 40, height: 180, type: 'barrier', hitFlash: 0 },
            { id: `mid_b_${i}_2`, x: ox + 20, y: oy - 20, width: 60, height: 40, type: 'corner', hitFlash: 0 }
          );
        }
      } else {
        // Heavy Column + L-Shield
        this.obstacles.push(
          { id: `mid_p_${i}`, x: ox - 40, y: oy - 40, width: 80, height: 80, type: 'pillar', hitFlash: 0 },
          { id: `mid_s_${i}`, x: ox + 50, y: oy - 60, width: 36, height: 120, type: 'barrier', hitFlash: 0 }
        );
      }
    });

    // 3. OUTER BASTIONS & DEFENSIVE MONOLITHS (Distance 850 - 1120)
    const outerAngles = [0.25, 0.78, 1.35, 1.9, 2.45, 3.0, 3.6, 4.15, 4.7, 5.25, 5.75, 6.2];
    outerAngles.forEach((ang, i) => {
      const dist = 880 + (i % 3) * 90;
      const ox = cx + Math.cos(ang) * dist;
      const oy = cy + Math.sin(ang) * dist;

      if (i % 3 === 0) {
        // Dual trench walls
        this.obstacles.push(
          { id: `out_tr_${i}_1`, x: ox - 80, y: oy - 50, width: 160, height: 38, type: 'barrier', hitFlash: 0 },
          { id: `out_tr_${i}_2`, x: ox - 80, y: oy + 25, width: 160, height: 38, type: 'barrier', hitFlash: 0 }
        );
      } else if (i % 3 === 1) {
        // Heavy Monolith
        this.obstacles.push({
          id: `out_mono_${i}`,
          x: ox - 55,
          y: oy - 55,
          width: 110,
          height: 110,
          type: 'monolith',
          hitFlash: 0,
        });
      } else {
        // Corner Bunker
        this.obstacles.push(
          { id: `out_c_${i}_1`, x: ox - 60, y: oy - 60, width: 120, height: 40, type: 'bunker', hitFlash: 0 },
          { id: `out_c_${i}_2`, x: ox - 60, y: oy - 20, width: 40, height: 80, type: 'bunker', hitFlash: 0 }
        );
      }
    });
  }

  public setViewport(w: number, h: number) {
    this.camera.viewportWidth = w;
    this.camera.viewportHeight = h;
  }

  public update(delta: number, input: InputState) {
    if (this.isPaused || this.isGameOver) return;

    const dt = Math.min(delta, 0.1);
    this.matchTime += dt;

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 20);
    }

    // 1. Update Player Movement (Section 1)
    this.updatePlayerMovement(dt, input);

    // 2. Update Camera Tracking (Section 2)
    this.updateCamera(dt);

    // 3. Update Economy & Cooldowns
    this.updatePlayerEconomyAndCooldowns(dt);

    // 4. Update Stasis Traps (Orange glowing objects)
    this.updateStasisTraps(dt);

    // 5. Update Allied & Enemy Cores (Objectives & Core Defenses)
    this.updateCores(dt);

    // 6. Wave Management & Spawning (Section 3)
    this.updateWaves(dt);

    // 7. Level-Up Stars Spawning & Expiration (Section 4)
    this.updateStars(dt);

    // 8. Automatic Nearest-Enemy Shooting (Section 5)
    this.checkAutomaticFiring();

    // 9. Update Projectiles & Collisions
    this.updateProjectiles(dt);

    // 10. Update Laser Beams & Shockwaves
    this.updateLaserBeams(dt);
    this.updateShockwaves(dt);

    // 11. Update Enemies (Chaser, Ranged, Heavy, Boss)
    this.updateEnemies(dt);

    // 12. Update Particles & Floating Text
    this.updateParticles(dt);

    // 13. Tutorial update
    this.tutorialController.update(dt, this.player.energy);

    // 14. Snapshot in ReplayBuffer
    this.recordReplaySnapshot();

    // 15. Check Death Condition (Section 9)
    if (this.player.health <= 0 && !this.player.isDead) {
      this.handlePlayerDeath();
    }
  }

  private updatePlayerMovement(dt: number, input: InputState) {
    if (this.player.isDead) return;

    // Trapped inside an orange glowing stasis object
    if (this.player.isTrapped) {
      this.player.trappedTimeRemaining -= dt;
      this.player.vx = 0;
      this.player.vy = 0;
      const trap = this.stasisTraps.find((t) => t.id === this.player.trappedInsideId);
      if (trap && trap.health > 0) {
        this.player.x = trap.x;
        this.player.y = trap.y;
      }
      if (this.player.trappedTimeRemaining <= 0 || !trap || trap.health <= 0) {
        this.player.isTrapped = false;
        this.player.trappedInsideId = undefined;
        this.floatingTexts.push({
          id: Math.random().toString(),
          text: 'STASIS BROKEN! FREED!',
          x: this.player.x,
          y: this.player.y - 30,
          vy: -35,
          life: 0.9,
          maxLife: 0.9,
          color: '#f97316',
          isCrit: true,
        });
        audioManager.playExplosion();
        this.spawnSparks(this.player.x, this.player.y, '#f97316', 16);
      }
      return;
    }

    let moveX = 0;
    let moveY = 0;

    // Keyboard WASD / Arrows
    if (input.left) moveX -= 1;
    if (input.right) moveX += 1;
    if (input.up) moveY -= 1;
    if (input.down) moveY += 1;

    // Mobile Virtual Joystick override / addition
    if (Math.abs(input.joyX) > 0.05 || Math.abs(input.joyY) > 0.05) {
      moveX = input.joyX;
      moveY = input.joyY;
    }

    // Normalize if diagonal
    const len = Math.hypot(moveX, moveY);
    if (len > 1) {
      moveX /= len;
      moveY /= len;
    }

    if (len > 0.05) {
      this.player.vx += moveX * GAME_CONSTANTS.PLAYER_ACCEL * dt;
      this.player.vy += moveY * GAME_CONSTANTS.PLAYER_ACCEL * dt;
    }

    // Apply friction
    this.player.vx *= Math.pow(GAME_CONSTANTS.PLAYER_FRICTION, dt * 60);
    this.player.vy *= Math.pow(GAME_CONSTANTS.PLAYER_FRICTION, dt * 60);

    // Speed clamp
    const currentSpeed = Math.hypot(this.player.vx, this.player.vy);
    if (currentSpeed > this.player.speed) {
      this.player.vx = (this.player.vx / currentSpeed) * this.player.speed;
      this.player.vy = (this.player.vy / currentSpeed) * this.player.speed;
    }

    let nextX = this.player.x + this.player.vx * dt;
    let nextY = this.player.y + this.player.vy * dt;

    // World bounds collision
    const half = this.player.size / 2;
    nextX = Math.max(half + 10, Math.min(GAME_CONSTANTS.WORLD_WIDTH - half - 10, nextX));
    nextY = Math.max(half + 10, Math.min(GAME_CONSTANTS.WORLD_HEIGHT - half - 10, nextY));

    // Obstacle collision detection
    for (const obs of this.obstacles) {
      if (
        nextX + half > obs.x &&
        nextX - half < obs.x + obs.width &&
        this.player.y + half > obs.y &&
        this.player.y - half < obs.y + obs.height
      ) {
        // Block X
        this.player.vx = 0;
        nextX = this.player.x;
      }
      if (
        this.player.x + half > obs.x &&
        this.player.x - half < obs.x + obs.width &&
        nextY + half > obs.y &&
        nextY - half < obs.y + obs.height
      ) {
        // Block Y
        this.player.vy = 0;
        nextY = this.player.y;
      }
    }

    this.player.x = nextX;
    this.player.y = nextY;

    // Check Star collection
    for (let i = this.stars.length - 1; i >= 0; i--) {
      const star = this.stars[i];
      if (Math.hypot(star.x - this.player.x, star.y - this.player.y) < star.size + half + 6) {
        this.collectStar(star.id);
      }
    }
  }

  private updateCamera(dt: number) {
    const targetX = this.player.x - this.camera.viewportWidth / 2;
    const targetY = this.player.y - this.camera.viewportHeight / 2;

    const smooth = Math.min(1, dt * 9);
    this.camera.x += (targetX - this.camera.x) * smooth;
    this.camera.y += (targetY - this.camera.y) * smooth;

    // Clamp camera within world bounds
    const maxCamX = Math.max(0, GAME_CONSTANTS.WORLD_WIDTH - this.camera.viewportWidth);
    const maxCamY = Math.max(0, GAME_CONSTANTS.WORLD_HEIGHT - this.camera.viewportHeight);

    this.camera.x = Math.max(0, Math.min(maxCamX, this.camera.x));
    this.camera.y = Math.max(0, Math.min(maxCamY, this.camera.y));
  }

  private updatePlayerEconomyAndCooldowns(dt: number) {
    const incomeRate = GAME_CONSTANTS.PASSIVE_ENERGY_PER_SECOND + this.player.generatorLevel * 0.8;
    this.player.energy += incomeRate * dt;

    // Dedicated Shield Regeneration
    if (this.player.shieldRegenDelay > 0) {
      this.player.shieldRegenDelay -= dt;
    } else if (this.player.shield < this.player.maxShield) {
      const metaShield = statsStore.getStats().metaUpgrades?.shield_capacitor || 0;
      const regenRate = GAME_CONSTANTS.SHIELD_REGEN_RATE + metaShield * 2;
      this.player.shield = Math.min(this.player.maxShield, this.player.shield + regenRate * dt);
    }

    // Level-up Star 3-bullet temporary boost (10-second duration with loader)
    if (this.player.starBoostTimer > 0) {
      this.player.starBoostTimer -= dt;
      if (this.player.starBoostTimer <= 0) {
        this.player.starBoostTimer = 0;
        this.player.bulletsPerShot = 1; // 10s effect ends!
        this.floatingTexts.push({
          id: Math.random().toString(),
          text: '3x BLASTER BOOST EXPIRED',
          x: this.player.x,
          y: this.player.y - 30,
          vy: -35,
          life: 0.8,
          maxLife: 0.8,
          color: '#38bdf8',
        });
      }
    }

    if (this.player.shieldActive) {
      this.player.shieldDurationRemaining -= dt;
      if (this.player.shieldDurationRemaining <= 0) {
        this.player.shieldActive = false;
        this.player.shieldDurationRemaining = 0;
      }
    }

    if (this.player.shieldCooldownRemaining > 0) {
      this.player.shieldCooldownRemaining = Math.max(0, this.player.shieldCooldownRemaining - dt);
    }
    if (this.player.overdriveCooldownRemaining > 0) {
      this.player.overdriveCooldownRemaining = Math.max(0, this.player.overdriveCooldownRemaining - dt);
    }
    if (this.player.pulseCooldownRemaining > 0) {
      this.player.pulseCooldownRemaining = Math.max(0, this.player.pulseCooldownRemaining - dt);
    }

    if (this.waveWarningTimer > 0) {
      this.waveWarningTimer -= dt;
      if (this.waveWarningTimer <= 0) {
        this.waveWarning = null;
      }
    }

    // Fade obstacle hit flash effects
    for (const obs of this.obstacles) {
      if (obs.hitFlash && obs.hitFlash > 0) {
        obs.hitFlash = Math.max(0, obs.hitFlash - dt * 3.5);
      }
    }

    // Dynamic Tactical Cover Check
    let inCover = false;
    for (const obs of this.obstacles) {
      const nearX = Math.max(obs.x, Math.min(this.player.x, obs.x + obs.width));
      const nearY = Math.max(obs.y, Math.min(this.player.y, obs.y + obs.height));
      const distToObs = Math.hypot(this.player.x - nearX, this.player.y - nearY);

      if (distToObs < 65) {
        for (const enemy of this.enemies) {
          if (Math.hypot(enemy.x - this.player.x, enemy.y - this.player.y) < 650) {
            if (isLineBlockedByObstacles(enemy.x, enemy.y, this.player.x, this.player.y, this.obstacles)) {
              inCover = true;
              break;
            }
          }
        }
        if (inCover) break;
      }
    }
    this.player.isInCover = inCover;
  }

  // Update Orange Glowing Objects (Stasis Traps)
  private updateStasisTraps(dt: number) {
    for (let i = this.stasisTraps.length - 1; i >= 0; i--) {
      const trap = this.stasisTraps[i];
      trap.pulsePhase += dt * 3.5;
      trap.x += trap.vx * dt;
      trap.y += trap.vy * dt;

      // Bounce softly inside world boundaries
      if (trap.x < 120 || trap.x > GAME_CONSTANTS.WORLD_WIDTH - 120) trap.vx *= -1;
      if (trap.y < 120 || trap.y > GAME_CONSTANTS.WORLD_HEIGHT - 120) trap.vy *= -1;

      // Check collision with player: Traps player inside!
      if (!this.player.isDead && !this.player.isTrapped) {
        const dist = Math.hypot(trap.x - this.player.x, trap.y - this.player.y);
        if (dist < trap.radius + this.player.size / 2) {
          const metaDampener = (statsStore.getStats().metaUpgrades?.stasis_phase_shift || 0) * 0.3;
          this.player.isTrapped = true;
          this.player.trappedInsideId = trap.id;
          this.player.trappedTimeRemaining = Math.max(1.2, GAME_CONSTANTS.STASIS_TRAP_DURATION * (1 - metaDampener));
          this.player.vx = 0;
          this.player.vy = 0;
          this.player.x = trap.x;
          this.player.y = trap.y;

          audioManager.playHit(true);
          HapticsManager.trigger('damage');
          this.screenShake = 12;
          this.spawnSparks(trap.x, trap.y, '#f97316', 22);

          this.floatingTexts.push({
            id: Math.random().toString(),
            text: '⚠️ TRAPPED IN STASIS FIELD! (SHOOT TRAP TO BREAK FREE)',
            x: this.player.x,
            y: this.player.y - 35,
            vy: -35,
            life: 1.5,
            maxLife: 1.5,
            color: '#f97316',
            isCrit: true,
          });
        }
      }
    }
  }

  // Update Allied Base Core and Enemy Sector Overcore
  private updateCores(dt: number) {
    // 1. Allied Core Shield Regeneration
    if (!this.alliedCore.isDead && this.alliedCore.shield < this.alliedCore.maxShield) {
      this.alliedCore.shield = Math.min(this.alliedCore.maxShield, this.alliedCore.shield + 10 * dt);
    }

    // 2. Allied Core Defense Turrets auto-fire at nearest enemies
    if (!this.alliedCore.isDead) {
      for (const turret of this.alliedCore.turrets) {
        if (this.matchTime - turret.lastShot > 1.3) {
          let nearestEnemy: Enemy | null = null;
          let minD = 440;
          for (const e of this.enemies) {
            const d = Math.hypot(e.x - turret.x, e.y - turret.y);
            if (d < minD) {
              minD = d;
              nearestEnemy = e;
            }
          }
          if (nearestEnemy) {
            turret.lastShot = this.matchTime;
            turret.angle = Math.atan2(nearestEnemy.y - turret.y, nearestEnemy.x - turret.x);
            this.projectiles.push({
              id: `allied_t_${++this.projectileIdCounter}`,
              source: 'player',
              x: turret.x + Math.cos(turret.angle) * 16,
              y: turret.y + Math.sin(turret.angle) * 16,
              vx: Math.cos(turret.angle) * 600,
              vy: Math.sin(turret.angle) * 600,
              damage: 20,
              radius: 4.5,
              isPiercing: false,
              penetratedTargets: new Set(),
              trail: [],
            });
            audioManager.playLaserShot(false);
          }
        }
      }
    }

    // 3. Enemy Core Shield Rotation & Automated Defense Turrets
    if (!this.enemyCore.isDead) {
      this.enemyCore.shieldAngle += dt * 0.75;

      // Enemy Core Turrets target player if in range (700 units)
      const distToPlayer = Math.hypot(this.player.x - this.enemyCore.x, this.player.y - this.enemyCore.y);
      if (distToPlayer < 750 && !this.player.isDead) {
        for (const turret of this.enemyCore.turrets) {
          if (this.matchTime - turret.lastShot > 2.0 + Math.random() * 0.4) {
            turret.lastShot = this.matchTime;
            turret.angle = Math.atan2(this.player.y - turret.y, this.player.x - turret.x);
            this.projectiles.push({
              id: `ec_t_${++this.projectileIdCounter}`,
              source: 'enemy',
              x: turret.x + Math.cos(turret.angle) * 18,
              y: turret.y + Math.sin(turret.angle) * 18,
              vx: Math.cos(turret.angle) * 360,
              vy: Math.sin(turret.angle) * 360,
              damage: 20,
              radius: 5,
              isPiercing: false,
              penetratedTargets: new Set(),
              trail: [],
            });
            audioManager.playLaserShot(true);
          }
        }
      }
    }
  }

  private updateWaves(dt: number) {
    this.waveTimer += dt;
    if (this.waveTimer >= GAME_CONSTANTS.WAVE_INTERVAL_SECONDS) {
      this.waveTimer = 0;
      this.currentWave += 1;

      // Boss Wave every 5th wave!
      if (this.currentWave % 5 === 0) {
        const sectorInfo = SECTOR_NAMES[this.sector] || SECTOR_NAMES[1];
        this.waveWarning = `⚠️ BOSS WAVE ${this.currentWave}: ${sectorInfo.bossName} SPAWNING! ⚠️`;
        this.waveWarningTimer = 4.5;
        audioManager.playWaveAlert();
        HapticsManager.trigger('damage');
        this.spawnBoss(sectorInfo.bossName);
      } else {
        this.waveWarning = `WAVE ${this.currentWave}: INCOMING ASSAULT SQUAD!`;
        this.waveWarningTimer = 3.5;
        audioManager.playWaveAlert();
        HapticsManager.trigger('damage');
      }

      // Spawn a wave cluster with a heavy cube
      for (let i = 0; i < 4 + this.currentWave; i++) {
        const type: EnemyType = i === 0 ? 'heavy' : (i % 2 === 0 ? 'ranged' : 'chaser');
        this.spawnEnemy(type);
      }
    }

    // Regular interval spawning
    if (this.matchTime >= this.nextSpawnTime) {
      const maxEnemies = GAME_CONSTANTS.MAX_ENEMIES_BASE + this.player.playerLevel * GAME_CONSTANTS.MAX_ENEMIES_SCALED_PER_LEVEL;
      if (this.enemies.length < maxEnemies) {
        const roll = Math.random();
        let type: EnemyType = 'chaser';
        if (roll < 0.25 + this.currentWave * 0.05) {
          type = 'ranged';
        } else if (roll > 0.85 - this.currentWave * 0.04) {
          type = 'heavy';
        }
        this.spawnEnemy(type);
      }
      const interval = Math.max(0.6, GAME_CONSTANTS.SPAWN_INTERVAL_BASE_SECONDS - this.currentWave * 0.1);
      this.nextSpawnTime = this.matchTime + interval;
    }
  }

  private spawnBoss(name: string) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 550;
    const spawnX = Math.max(120, Math.min(GAME_CONSTANTS.WORLD_WIDTH - 120, this.player.x + Math.cos(angle) * dist));
    const spawnY = Math.max(120, Math.min(GAME_CONSTANTS.WORLD_HEIGHT - 120, this.player.y + Math.sin(angle) * dist));

    const hp = 800 + this.currentWave * 150 + (this.sector - 1) * 350;
    const boss: Enemy = {
      id: `boss_${++this.enemyIdCounter}`,
      type: 'boss',
      isBoss: true,
      bossName: name,
      x: spawnX,
      y: spawnY,
      vx: 0,
      vy: 0,
      size: 58,
      health: hp,
      maxHealth: hp,
      speed: 65,
      damage: 38,
      xpReward: 350,
      energyReward: 60,
      scoreReward: 2000,
      shootCooldown: 1.2,
      lastShotTime: this.matchTime + 1.0,
      color: '#ec4899',
    };
    this.enemies.push(boss);
  }

  private spawnEnemy(type: EnemyType) {
    const profile = GAME_CONSTANTS.ENEMY_PROFILES[type];
    
    // Spawn at radius around player outside immediate view
    const angle = Math.random() * Math.PI * 2;
    const dist = GAME_CONSTANTS.MIN_SPAWN_DISTANCE_FROM_PLAYER + Math.random() * 300;
    let spawnX = this.player.x + Math.cos(angle) * dist;
    let spawnY = this.player.y + Math.sin(angle) * dist;

    // Clamp inside world
    spawnX = Math.max(profile.size + 20, Math.min(GAME_CONSTANTS.WORLD_WIDTH - profile.size - 20, spawnX));
    spawnY = Math.max(profile.size + 20, Math.min(GAME_CONSTANTS.WORLD_HEIGHT - profile.size - 20, spawnY));

    // Scaling with difficulty, wave, and sector
    const hpMult = this.difficulty === 'hard' ? 1.3 : this.difficulty === 'normal' ? 1.0 : 0.85;
    const waveHpMult = 1 + (this.currentWave - 1) * 0.12 + (this.sector - 1) * 0.25;

    const enemy: Enemy = {
      id: `enemy_${++this.enemyIdCounter}`,
      type,
      x: spawnX,
      y: spawnY,
      vx: 0,
      vy: 0,
      size: profile.size,
      health: Math.round(profile.health * hpMult * waveHpMult),
      maxHealth: Math.round(profile.health * hpMult * waveHpMult),
      speed: profile.speed,
      damage: profile.damage,
      xpReward: profile.xpReward,
      energyReward: profile.energyReward,
      scoreReward: profile.scoreReward,
      shootCooldown: profile.shootCooldown,
      lastShotTime: this.matchTime + Math.random() * 1.5,
      color: profile.color,
    };

    this.enemies.push(enemy);
  }

  private updateStars(dt: number) {
    // Spawning Level-Up Stars (Section 4)
    if (this.matchTime >= this.nextStarSpawnTime && this.stars.length < GAME_CONSTANTS.STAR_MAX_ACTIVE) {
      this.nextStarSpawnTime = this.matchTime + GAME_CONSTANTS.STAR_SPAWN_INTERVAL_SECONDS;
      
      const spawnX = 200 + Math.random() * (GAME_CONSTANTS.WORLD_WIDTH - 400);
      const spawnY = 200 + Math.random() * (GAME_CONSTANTS.WORLD_HEIGHT - 400);

      this.stars.push({
        id: `star_${Math.random().toString(36).substring(2, 8)}`,
        x: spawnX,
        y: spawnY,
        size: GAME_CONSTANTS.STAR_RADIUS,
        life: GAME_CONSTANTS.STAR_LIFETIME_SECONDS,
        maxLife: GAME_CONSTANTS.STAR_LIFETIME_SECONDS,
        rotation: 0,
      });
    }

    // Update stars and check if enemies or player collect them
    for (let i = this.stars.length - 1; i >= 0; i--) {
      const s = this.stars[i];
      s.life -= dt;
      s.rotation += dt * 2.5;

      // Check if ANY enemy touches the star (Enemies can take stars!)
      let enemyTookStar = false;
      for (const enemy of this.enemies) {
        const dist = Math.hypot(enemy.x - s.x, enemy.y - s.y);
        if (dist < s.size + enemy.size / 2) {
          this.stars.splice(i, 1);
          enemyTookStar = true;
          this.enemyEmpower(enemy, s.x, s.y);
          break;
        }
      }

      if (enemyTookStar) continue;

      if (s.life <= 0) {
        this.stars.splice(i, 1);
      }
    }
  }

  private enemyEmpower(enemy: Enemy, x: number, y: number) {
    enemy.isEmpowered = true;
    enemy.maxHealth = Math.round(enemy.maxHealth * 2.0);
    enemy.health = enemy.maxHealth;
    enemy.speed = Math.round(enemy.speed * 1.35);
    enemy.size = Math.round(enemy.size * 1.3);
    enemy.damage = Math.round(enemy.damage * 1.5);

    audioManager.playExplosion();
    this.spawnSparks(x, y, '#38bdf8', 25);
    this.floatingTexts.push({
      id: Math.random().toString(),
      text: '⚠️ ENEMY STOLE STAR! EMPOWERED! ⚠️',
      x: enemy.x,
      y: enemy.y - 35,
      vy: -40,
      life: 1.4,
      maxLife: 1.4,
      color: '#38bdf8',
      isCrit: true,
    });
  }

  public collectStar(starId: string) {
    const idx = this.stars.findIndex((s) => s.id === starId);
    if (idx === -1) return;
    const star = this.stars[idx];
    this.stars.splice(idx, 1);

    // Star grants 3 bullets per shot with a 10-second timer!
    this.player.starBoostTimer = GAME_CONSTANTS.STAR_BOOST_DURATION; // 10.0s
    this.player.bulletsPerShot = 3;
    this.player.weaponLevel = Math.max(this.player.weaponLevel, 3);
    this.player.starsCollected += 1;
    this.player.score += 250;

    audioManager.playStarCollect();
    HapticsManager.trigger('purchase');

    // Particle flash
    this.spawnSparks(star.x, star.y, '#ffffff', 20);
    this.spawnSparks(star.x, star.y, '#38bdf8', 15);

    // On-screen notification
    this.floatingTexts.push({
      id: Math.random().toString(),
      text: '★ TRIPLE BLASTER ACTIVE (10s)!',
      x: this.player.x,
      y: this.player.y - 30,
      vy: -45,
      life: 1.2,
      maxLife: 1.2,
      color: '#38bdf8',
      isCrit: true,
    });
  }

  private checkAutomaticFiring() {
    if (this.player.isDead) return;

    if (this.matchTime - this.player.lastShotTime < this.player.fireInterval) {
      return;
    }

    // Find nearest valid enemy within range with clear line-of-sight (Section 5)
    let targetEnemy: Enemy | null = null;
    let nearestDistSq = GAME_CONSTANTS.TARGETING_RANGE * GAME_CONSTANTS.TARGETING_RANGE;

    for (const enemy of this.enemies) {
      const distSq = (enemy.x - this.player.x) ** 2 + (enemy.y - this.player.y) ** 2;
      if (distSq < nearestDistSq) {
        // Line-of-sight check: don't shoot straight into walls
        if (!isLineBlockedByObstacles(this.player.x, this.player.y, enemy.x, enemy.y, this.obstacles)) {
          nearestDistSq = distSq;
          targetEnemy = enemy;
        }
      }
    }

    // If no enemy has clear line-of-sight (e.g. player hiding safely behind bunker), hold fire!
    if (!targetEnemy) {
      return;
    }

    this.player.lastShotTime = this.matchTime;

    // Base angle toward target
    const baseAngle = Math.atan2(targetEnemy.y - this.player.y, targetEnemy.x - this.player.x);
    const bulletsCount = this.player.bulletsPerShot;
    const spreadAngles = GAME_CONSTANTS.SPREAD_ANGLES[bulletsCount] || [0];

    const isPiercing = this.player.piercingLevel > 0;

    // Fire all spread bullets (Section 4 milestone: 3 bullets per shot after collecting 2 stars!)
    for (const angleOffset of spreadAngles) {
      const angle = baseAngle + angleOffset;
      const proj: Projectile = {
        id: `p_${++this.projectileIdCounter}`,
        source: 'player',
        x: this.player.x + Math.cos(angle) * (this.player.size / 2 + 6),
        y: this.player.y + Math.sin(angle) * (this.player.size / 2 + 6),
        vx: Math.cos(angle) * GAME_CONSTANTS.PROJECTILE_SPEED,
        vy: Math.sin(angle) * GAME_CONSTANTS.PROJECTILE_SPEED,
        damage: this.player.baseDamage,
        radius: GAME_CONSTANTS.PROJECTILE_RADIUS + (isPiercing ? 1.5 : 0),
        isPiercing,
        penetratedTargets: new Set(),
        trail: [],
      };
      this.projectiles.push(proj);
    }

    audioManager.playLaserShot(false);
  }

  private updateProjectiles(dt: number) {
    const remaining: Projectile[] = [];

    for (const p of this.projectiles) {
      p.trail.push({ x: p.x, y: p.y, alpha: 0.7 });
      if (p.trail.length > 5) p.trail.shift();

      for (const t of p.trail) {
        t.alpha -= dt * 3;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // World bounds
      if (
        p.x < 10 ||
        p.x > GAME_CONSTANTS.WORLD_WIDTH - 10 ||
        p.y < 10 ||
        p.y > GAME_CONSTANTS.WORLD_HEIGHT - 10
      ) {
        continue;
      }

      // Check obstacle collisions
      let hitObstacle = false;
      for (const obs of this.obstacles) {
        if (
          p.x > obs.x &&
          p.x < obs.x + obs.width &&
          p.y > obs.y &&
          p.y < obs.y + obs.height
        ) {
          hitObstacle = true;
          obs.hitFlash = 0.35; // Trigger deflection ripple flash
          this.spawnSparks(p.x, p.y, p.source === 'player' ? '#ffffff' : '#38bdf8', 6);
          if (p.source === 'enemy') {
            audioManager.playHit(false); // Bullet hit against cover!
          }
          break;
        }
      }
      if (hitObstacle) continue;

      // Check Stasis Trap collisions (player can shoot the orange trap to destroy it!)
      if (p.source === 'player') {
        let hitTrap = false;
        for (const trap of this.stasisTraps) {
          const dist = Math.hypot(p.x - trap.x, p.y - trap.y);
          if (dist < trap.radius + p.radius) {
            trap.health -= p.damage;
            hitTrap = true;
            this.spawnSparks(p.x, p.y, '#f97316', 7);
            audioManager.playHit(false);
            if (trap.health <= 0) {
              this.destroyStasisTrap(trap);
            }
            break;
          }
        }
        if (hitTrap) continue;
      }

      if (p.source === 'player') {
        // Collide with Enemy Core (Main Objective)
        if (!this.enemyCore.isDead) {
          const dist = Math.hypot(p.x - this.enemyCore.x, p.y - this.enemyCore.y);
          if (dist <= this.enemyCore.size / 2 + p.radius) {
            const hitAngle = (Math.atan2(p.y - this.enemyCore.y, p.x - this.enemyCore.x) + Math.PI * 2) % (Math.PI * 2);
            let blockedByShield = false;

            // Check rotating orbital shields
            for (const s of this.enemyCore.defensiveShields) {
              const normShieldAngle = (s.angle + this.enemyCore.shieldAngle) % (Math.PI * 2);
              const diff = Math.abs(((hitAngle - normShieldAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
              if (diff < s.arcLength / 2 && s.health > 0) {
                s.health -= p.damage;
                blockedByShield = true;
                this.spawnSparks(p.x, p.y, '#38bdf8', 8);
                audioManager.playHit(false);
                break;
              }
            }

            if (!blockedByShield) {
              this.enemyCore.health -= p.damage;
              this.player.score += Math.round(p.damage * 3);
              this.spawnSparks(p.x, p.y, '#ef4444', 9);
              audioManager.playHit(true);

              this.floatingTexts.push({
                id: Math.random().toString(),
                text: `-${Math.round(p.damage)} [OVERCORE]`,
                x: p.x,
                y: p.y - 15,
                vy: -30,
                life: 0.6,
                maxLife: 0.6,
                color: '#ef4444',
                isCrit: true,
              });

              if (this.enemyCore.health <= 0) {
                this.handleEnemyCoreDestroyed();
              }
            }
            continue;
          }
        }

        // Collide with enemies
        let hitSomething = false;
        for (const enemy of this.enemies) {
          if (!p.penetratedTargets.has(enemy.id)) {
            const dist = Math.hypot(p.x - enemy.x, p.y - enemy.y);
            if (dist <= enemy.size / 2 + p.radius) {
              p.penetratedTargets.add(enemy.id);
              this.damageEnemy(enemy, p.damage, p.x, p.y);
              hitSomething = true;
              if (!p.isPiercing) break;
            }
          }
        }
        if (hitSomething && !p.isPiercing) {
          continue;
        }
      } else {
        // Enemy projectile hits Allied Core
        if (!this.alliedCore.isDead) {
          const distToAlliedCore = Math.hypot(p.x - this.alliedCore.x, p.y - this.alliedCore.y);
          if (distToAlliedCore <= this.alliedCore.size / 2 + p.radius) {
            let dmg = p.damage;
            if (this.alliedCore.shield > 0) {
              const absorbed = Math.min(this.alliedCore.shield, dmg);
              this.alliedCore.shield -= absorbed;
              dmg -= absorbed;
              this.spawnSparks(p.x, p.y, '#38bdf8', 6);
            }
            if (dmg > 0) {
              this.alliedCore.health -= dmg;
              this.spawnSparks(p.x, p.y, '#ef4444', 8);
            }
            audioManager.playHit(true);
            if (this.alliedCore.health <= 0) {
              this.handleAlliedCoreDestroyed();
            }
            continue;
          }
        }

        // Enemy projectile hits player
        const dist = Math.hypot(p.x - this.player.x, p.y - this.player.y);
        if (dist <= this.player.size / 2 + p.radius) {
          this.damagePlayer(p.damage, p.x, p.y);
          continue;
        }
      }

      remaining.push(p);
    }

    this.projectiles = remaining;
  }

  private destroyStasisTrap(trap: StasisTrap) {
    const idx = this.stasisTraps.indexOf(trap);
    if (idx !== -1) {
      this.stasisTraps.splice(idx, 1);
    }
    this.spawnSparks(trap.x, trap.y, '#f97316', 25);
    audioManager.playExplosion();

    // If player was trapped in this specific trap, free them!
    if (this.player.isTrapped && this.player.trappedInsideId === trap.id) {
      this.player.isTrapped = false;
      this.player.trappedInsideId = undefined;
      this.floatingTexts.push({
        id: Math.random().toString(),
        text: 'STASIS SHATTERED! FREED!',
        x: this.player.x,
        y: this.player.y - 30,
        vy: -35,
        life: 1.0,
        maxLife: 1.0,
        color: '#f97316',
        isCrit: true,
      });
    }
  }

  private damageEnemy(enemy: Enemy, rawDamage: number, hitX: number, hitY: number) {
    enemy.health -= rawDamage;
    audioManager.playHit(rawDamage > 25);
    this.spawnSparks(hitX, hitY, enemy.color, 6);

    this.floatingTexts.push({
      id: Math.random().toString(),
      text: `-${Math.round(rawDamage)}`,
      x: hitX + (Math.random() - 0.5) * 15,
      y: hitY,
      vy: -30,
      life: 0.55,
      maxLife: 0.55,
      color: '#ffffff',
      isCrit: rawDamage > 25,
    });

    if (enemy.health <= 0) {
      this.destroyEnemy(enemy);
    }
  }

  private destroyEnemy(enemy: Enemy) {
    const idx = this.enemies.indexOf(enemy);
    if (idx !== -1) {
      this.enemies.splice(idx, 1);
    }

    this.player.enemiesKilled += 1;
    this.player.score += enemy.scoreReward;
    this.player.energy += enemy.energyReward;

    // Floating kill text
    this.floatingTexts.push({
      id: Math.random().toString(),
      text: `+${enemy.scoreReward} PTS`,
      x: enemy.x,
      y: enemy.y - 20,
      vy: -25,
      life: 0.7,
      maxLife: 0.7,
      color: '#38bdf8',
    });

    // Gain XP
    this.gainXP(enemy.xpReward);

    audioManager.playExplosion();
    this.spawnSparks(enemy.x, enemy.y, enemy.color, 14);
  }

  private gainXP(amount: number) {
    this.player.xp += amount;
    if (this.player.xp >= this.player.xpToNextLevel) {
      this.player.playerLevel += 1;
      this.player.xp -= this.player.xpToNextLevel;
      this.player.xpToNextLevel = getRequiredXPForLevel(this.player.playerLevel);

      // Level-up rewards
      this.player.maxHealth += 10;
      this.player.health = Math.min(this.player.maxHealth, this.player.health + 25);
      this.player.speed = Math.min(350, this.player.speed + 6);
      this.player.baseDamage += 2;

      audioManager.playPlayerLevelUp();
      HapticsManager.trigger('purchase');

      this.floatingTexts.push({
        id: Math.random().toString(),
        text: `★ PLAYER LEVEL ${this.player.playerLevel}! (+MAX HP, SPEED, DMG)`,
        x: this.player.x,
        y: this.player.y - 45,
        vy: -40,
        life: 1.5,
        maxLife: 1.5,
        color: '#f59e0b',
        isCrit: true,
      });
    }
  }

  private damagePlayer(rawDamage: number, hitX: number, hitY: number) {
    if (this.player.isDead) return;

    let finalDamage = rawDamage;

    // Tactical Cover absorption
    if (this.player.isInCover) {
      finalDamage *= 0.8; // 20% tactical damage absorption behind cover!
    }

    // Pulse Shield ability absorption
    if (this.player.shieldActive) {
      finalDamage *= (1 - GAME_CONSTANTS.ABILITIES.PULSE_SHIELD.damageReduction);
    }

    // Armor upgrade reduction
    const armorReduction = Math.min(0.5, this.player.armorLevel * 0.1);
    finalDamage *= (1 - armorReduction);

    finalDamage = Math.max(1, Math.round(finalDamage));

    // Reset shield regen delay (must avoid damage for 3.5s to recharge shield)
    this.player.shieldRegenDelay = GAME_CONSTANTS.SHIELD_REGEN_DELAY;

    // Shields absorb incoming damage first!
    if (this.player.shield > 0) {
      const absorbed = Math.min(this.player.shield, finalDamage);
      this.player.shield -= absorbed;
      finalDamage -= absorbed;
      this.spawnSparks(hitX, hitY, '#38bdf8', 8);
    }

    // Leftover damage directly damages player Core health
    if (finalDamage > 0) {
      this.player.health = Math.max(0, this.player.health - finalDamage);
      this.spawnSparks(hitX, hitY, '#ef4444', 9);
    }

    audioManager.playHit(true);
    HapticsManager.trigger('damage');
    this.screenShake = Math.min(16, this.screenShake + 6);

    this.floatingTexts.push({
      id: Math.random().toString(),
      text: this.player.isInCover ? `-${Math.round(rawDamage)} [COVER]` : `-${Math.round(rawDamage)}`,
      x: hitX,
      y: hitY,
      vy: 25,
      life: 0.6,
      maxLife: 0.6,
      color: this.player.isInCover ? '#38bdf8' : '#ef4444',
      isCrit: true,
    });
  }

  private updateEnemies(dt: number) {
    const remaining: Enemy[] = [];

    for (const enemy of this.enemies) {
      const dx = this.player.x - enemy.x;
      const dy = this.player.y - enemy.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 0.01) {
        const nx = dx / dist;
        const ny = dy / dist;

        if (enemy.type === 'chaser' || enemy.type === 'heavy') {
          // Check if path to player is occluded by an obstacle
          const pathBlocked = isLineBlockedByObstacles(enemy.x, enemy.y, this.player.x, this.player.y, this.obstacles);
          if (pathBlocked) {
            // Slide around the obstacle to navigate cover
            const slideDir = ((Math.floor(enemy.x / 60) + Math.floor(enemy.y / 60)) % 2 === 0) ? 1 : -1;
            enemy.vx = (nx * 0.35 - ny * 0.75 * slideDir) * enemy.speed;
            enemy.vy = (ny * 0.35 + nx * 0.75 * slideDir) * enemy.speed;
          } else {
            enemy.vx = nx * enemy.speed;
            enemy.vy = ny * enemy.speed;
          }

          // Contact damage check
          if (dist <= (enemy.size + this.player.size) / 2) {
            this.damagePlayer(enemy.damage * dt * 3.5, this.player.x, this.player.y);
          }
        } else if (enemy.type === 'ranged' || enemy.type === 'boss' || enemy.isEmpowered) {
          // Line of sight check for ranged, empowered, and boss enemies
          const hasLOS = !isLineBlockedByObstacles(enemy.x, enemy.y, this.player.x, this.player.y, this.obstacles);

          if (hasLOS) {
            // Clear line of sight: maintain ideal distance and shoot
            const ideal = enemy.isBoss ? 320 : 260;
            if (dist < ideal - 40) {
              enemy.vx = -nx * enemy.speed;
              enemy.vy = -ny * enemy.speed;
            } else if (dist > ideal + 40) {
              enemy.vx = nx * enemy.speed;
              enemy.vy = ny * enemy.speed;
            } else {
              // Strafe
              enemy.vx = -ny * (enemy.speed * 0.7);
              enemy.vy = nx * (enemy.speed * 0.7);
            }

            // Shoot when off cooldown
            if (this.matchTime - enemy.lastShotTime >= enemy.shootCooldown) {
              enemy.lastShotTime = this.matchTime;
              const angle = Math.atan2(dy, dx);

              if (enemy.isBoss) {
                // Boss fires 4-way rotating spread
                for (const offset of [-0.3, -0.1, 0.1, 0.3]) {
                  const ang = angle + offset;
                  this.projectiles.push({
                    id: `boss_p_${++this.projectileIdCounter}`,
                    source: 'enemy',
                    x: enemy.x + Math.cos(ang) * (enemy.size / 2 + 6),
                    y: enemy.y + Math.sin(ang) * (enemy.size / 2 + 6),
                    vx: Math.cos(ang) * 360,
                    vy: Math.sin(ang) * 360,
                    damage: 24,
                    radius: 5.5,
                    isPiercing: false,
                    penetratedTargets: new Set(),
                    trail: [],
                  });
                }
              } else if (enemy.isEmpowered) {
                // Enemy that stole a star fires 3-bullet spread!
                for (const offset of [-0.2, 0, 0.2]) {
                  const ang = angle + offset;
                  this.projectiles.push({
                    id: `emp_p_${++this.projectileIdCounter}`,
                    source: 'enemy',
                    x: enemy.x + Math.cos(ang) * (enemy.size / 2 + 4),
                    y: enemy.y + Math.sin(ang) * (enemy.size / 2 + 4),
                    vx: Math.cos(ang) * 360,
                    vy: Math.sin(ang) * 360,
                    damage: 20,
                    radius: 4.5,
                    isPiercing: false,
                    penetratedTargets: new Set(),
                    trail: [],
                  });
                }
              } else {
                this.projectiles.push({
                  id: `ep_${++this.projectileIdCounter}`,
                  source: 'enemy',
                  x: enemy.x + Math.cos(angle) * (enemy.size / 2 + 4),
                  y: enemy.y + Math.sin(angle) * (enemy.size / 2 + 4),
                  vx: Math.cos(angle) * 340,
                  vy: Math.sin(angle) * 340,
                  damage: enemy.damage,
                  radius: 4,
                  isPiercing: false,
                  penetratedTargets: new Set(),
                  trail: [],
                });
              }
              audioManager.playLaserShot(true);
            }
          } else {
            // Player is HIDING behind cover! Enemy flanks around cover
            const flankDir = (Math.floor(enemy.x / 80) % 2 === 0) ? 1 : -1;
            enemy.vx = (nx * 0.4 - ny * 0.85 * flankDir) * enemy.speed;
            enemy.vy = (ny * 0.4 + nx * 0.85 * flankDir) * enemy.speed;
          }
        }
      }

      // Check if enemy attacks Allied Core when nearby
      if (!this.alliedCore.isDead) {
        const dToAlliedCore = Math.hypot(this.alliedCore.x - enemy.x, this.alliedCore.y - enemy.y);
        if (dToAlliedCore < (enemy.size + this.alliedCore.size) / 2) {
          const dmg = enemy.damage * dt * 2;
          if (this.alliedCore.shield > 0) {
            this.alliedCore.shield -= dmg;
          } else {
            this.alliedCore.health -= dmg;
          }
          if (this.alliedCore.health <= 0) {
            this.handleAlliedCoreDestroyed();
          }
        }
      }

      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;

      // Obstacle collision for enemies
      for (const obs of this.obstacles) {
        const half = enemy.size / 2;
        if (
          enemy.x + half > obs.x &&
          enemy.x - half < obs.x + obs.width &&
          enemy.y + half > obs.y &&
          enemy.y - half < obs.y + obs.height
        ) {
          // Push away from obstacle
          if (enemy.x < obs.x) enemy.x = obs.x - half;
          else if (enemy.x > obs.x + obs.width) enemy.x = obs.x + obs.width + half;
          if (enemy.y < obs.y) enemy.y = obs.y - half;
          else if (enemy.y > obs.y + obs.height) enemy.y = obs.y + obs.height + half;
        }
      }

      remaining.push(enemy);
    }

    this.enemies = remaining;
  }

  private updateLaserBeams(dt: number) {
    const remaining: LaserBeam[] = [];
    for (const b of this.laserBeams) {
      b.durationRemaining -= dt;

      // Damage enemies along beam path
      const angle = Math.atan2(b.endY - b.startY, b.endX - b.startX);
      const beamLen = Math.hypot(b.endX - b.startX, b.endY - b.startY);

      for (const enemy of this.enemies) {
        // Point to line segment distance
        const ex = enemy.x - b.startX;
        const ey = enemy.y - b.startY;
        const proj = ex * Math.cos(angle) + ey * Math.sin(angle);
        if (proj >= 0 && proj <= beamLen) {
          const perpDist = Math.abs(-ex * Math.sin(angle) + ey * Math.cos(angle));
          if (perpDist <= b.width + enemy.size / 2) {
            this.damageEnemy(enemy, b.damage * (dt / b.maxDuration), enemy.x, enemy.y);
          }
        }
      }

      if (b.durationRemaining > 0) {
        remaining.push(b);
      }
    }
    this.laserBeams = remaining;
  }

  private updateShockwaves(dt: number) {
    const remaining: Shockwave[] = [];
    for (const sw of this.shockwaves) {
      sw.radius += GAME_CONSTANTS.ABILITIES.ENERGY_PULSE.speed * dt;
      sw.alpha = Math.max(0, 1 - sw.radius / sw.maxRadius);

      for (const enemy of this.enemies) {
        if (!sw.hitEnemies.has(enemy.id)) {
          const dist = Math.hypot(enemy.x - sw.x, enemy.y - sw.y);
          if (Math.abs(dist - sw.radius) < 30) {
            sw.hitEnemies.add(enemy.id);
            this.damageEnemy(enemy, sw.damage, enemy.x, enemy.y);
          }
        }
      }

      if (sw.radius < sw.maxRadius && sw.alpha > 0.02) {
        remaining.push(sw);
      }
    }
    this.shockwaves = remaining;
  }

  private updateParticles(dt: number) {
    const remP: Particle[] = [];
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life > 0) remP.push(p);
    }
    this.particles = remP;

    const remT: FloatingText[] = [];
    for (const t of this.floatingTexts) {
      t.y += t.vy * dt;
      t.life -= dt;
      if (t.life > 0) remT.push(t);
    }
    this.floatingTexts = remT;
  }

  public purchaseUpgrade(upgradeType: UpgradeType): boolean {
    if (this.player.isDead) return false;

    const config = UPGRADE_DEFINITIONS[upgradeType];
    if (!config) return false;

    const currentLvl = (this.player as unknown as Record<string, number>)[`${upgradeType}Level`] || 0;
    if (currentLvl >= config.maxLevel) return false;

    const cost = getUpgradeCost(upgradeType, currentLvl);
    if (this.player.energy < cost) return false;

    this.player.energy -= cost;

    switch (upgradeType) {
      case 'damage':
        this.player.baseDamage = Math.round((GAME_CONSTANTS.BASIC_LASER_DAMAGE * (1 + 0.25 * (currentLvl + 1))) * 10) / 10;
        break;
      case 'fire_rate':
        this.player.fireInterval = Math.max(
          GAME_CONSTANTS.MIN_FIRE_INTERVAL_SECONDS,
          GAME_CONSTANTS.BASIC_FIRE_INTERVAL_SECONDS * Math.pow(0.85, currentLvl + 1)
        );
        break;
      case 'armor':
        this.player.armorLevel = currentLvl + 1;
        break;
      case 'generator':
        this.player.generatorLevel = currentLvl + 1;
        break;
      case 'piercing':
        this.player.piercingLevel = currentLvl + 1;
        break;
      case 'overdrive':
        this.player.overdriveUnlocked = true;
        break;
    }

    audioManager.playUpgrade();
    HapticsManager.trigger('purchase');
    this.tutorialController.onUpgradePurchased();

    return true;
  }

  public activateAbility(
    abilityType: 'overdrive_beam' | 'pulse_shield' | 'energy_pulse',
    targetPoint?: { x: number; y: number }
  ): boolean {
    if (this.player.isDead) return false;

    switch (abilityType) {
      case 'overdrive_beam': {
        if (!this.player.overdriveUnlocked || this.player.overdriveCooldownRemaining > 0) return false;
        const cost = GAME_CONSTANTS.ABILITIES.OVERDRIVE_BEAM.cost;
        if (this.player.energy < cost) return false;

        this.player.energy -= cost;
        this.player.overdriveCooldownRemaining = GAME_CONSTANTS.ABILITIES.OVERDRIVE_BEAM.cooldownSeconds;

        let endX = targetPoint?.x;
        let endY = targetPoint?.y;

        if (!endX || !endY) {
          // If no target point provided, fire forward
          endX = this.player.x + 600;
          endY = this.player.y;
        }

        const angle = Math.atan2(endY - this.player.y, endX - this.player.x);
        const range = GAME_CONSTANTS.ABILITIES.OVERDRIVE_BEAM.range;

        this.laserBeams.push({
          id: `beam_${Math.random().toString()}`,
          source: 'player',
          startX: this.player.x,
          startY: this.player.y,
          endX: this.player.x + Math.cos(angle) * range,
          endY: this.player.y + Math.sin(angle) * range,
          width: 18,
          damage: GAME_CONSTANTS.ABILITIES.OVERDRIVE_BEAM.damage,
          durationRemaining: GAME_CONSTANTS.ABILITIES.OVERDRIVE_BEAM.durationSeconds,
          maxDuration: GAME_CONSTANTS.ABILITIES.OVERDRIVE_BEAM.durationSeconds,
          isOverdrive: true,
        });

        audioManager.playOverdriveBeam();
        this.screenShake = 18;
        HapticsManager.trigger('ability');
        this.tutorialController.onAbilityActivated('overdrive_beam');
        return true;
      }

      case 'pulse_shield': {
        if (this.player.shieldCooldownRemaining > 0) return false;
        const cost = GAME_CONSTANTS.ABILITIES.PULSE_SHIELD.cost;
        if (this.player.energy < cost) return false;

        this.player.energy -= cost;
        this.player.shieldActive = true;
        this.player.shieldDurationRemaining = GAME_CONSTANTS.ABILITIES.PULSE_SHIELD.durationSeconds;
        this.player.shieldCooldownRemaining = GAME_CONSTANTS.ABILITIES.PULSE_SHIELD.cooldownSeconds;

        audioManager.playShield();
        HapticsManager.trigger('ability');
        return true;
      }

      case 'energy_pulse': {
        if (this.player.pulseCooldownRemaining > 0) return false;
        const cost = GAME_CONSTANTS.ABILITIES.ENERGY_PULSE.cost;
        if (this.player.energy < cost) return false;

        this.player.energy -= cost;
        this.player.pulseCooldownRemaining = GAME_CONSTANTS.ABILITIES.ENERGY_PULSE.cooldownSeconds;

        this.shockwaves.push({
          id: `pulse_${Math.random().toString()}`,
          source: 'player',
          x: this.player.x,
          y: this.player.y,
          radius: 10,
          maxRadius: GAME_CONSTANTS.ABILITIES.ENERGY_PULSE.radius,
          alpha: 1.0,
          damage: GAME_CONSTANTS.ABILITIES.ENERGY_PULSE.damage,
          hitEnemies: new Set(),
        });

        audioManager.playEnergyPulse();
        this.screenShake = 12;
        HapticsManager.trigger('ability');
        return true;
      }
    }
  }

  private spawnSparks(x: number, y: number, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 140;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 3,
        life: 0.3 + Math.random() * 0.3,
        maxLife: 0.6,
        color,
        shape: Math.random() > 0.5 ? 'square' : 'spark',
      });
    }
  }

  private recordReplaySnapshot() {
    const frame: ReplayFrame = {
      timestamp: this.matchTime,
      playerPos: { x: this.player.x, y: this.player.y },
      playerHp: this.player.health,
      playerShield: this.player.shieldActive,
      enemies: this.enemies.slice(0, 10).map((e) => ({
        x: e.x,
        y: e.y,
        type: e.type,
        hp: e.health,
      })),
      projectiles: this.projectiles.slice(0, 20).map((p) => ({
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
        source: p.source,
        isPiercing: p.isPiercing,
      })),
      beams: this.laserBeams.map((b) => ({
        source: b.source,
        startX: b.startX,
        startY: b.startY,
        endX: b.endX,
        endY: b.endY,
        width: b.width,
        isOverdrive: b.isOverdrive,
      })),
      shockwaves: this.shockwaves.map((s) => ({
        x: s.x,
        y: s.y,
        radius: s.radius,
        maxRadius: s.maxRadius,
      })),
    };

    this.replayBuffer.recordTick(frame);
  }

  public handleEnemyCoreDestroyed() {
    if (this.isGameOver) return;

    if (this.isUnlimited) {
      this.overcoreTier += 1;
      this.enemyCore.isDead = false;
      this.enemyCore.maxHealth = Math.round(this.enemyCore.maxHealth * 1.4);
      this.enemyCore.health = this.enemyCore.maxHealth;
      this.player.score += 5000;
      this.player.energy += 150;
      this.player.starsCollected += 2;
      this.stars.push({
        id: `star_${Math.random().toString(36).substring(2, 8)}`,
        x: this.enemyCore.x + 20,
        y: this.enemyCore.y + 20,
        size: GAME_CONSTANTS.STAR_RADIUS,
        life: GAME_CONSTANTS.STAR_LIFETIME_SECONDS,
        maxLife: GAME_CONSTANTS.STAR_LIFETIME_SECONDS,
        rotation: 0,
      });
      audioManager.playExplosion();
      this.spawnSparks(this.enemyCore.x, this.enemyCore.y, '#ffffff', 50);
      this.spawnSparks(this.enemyCore.x, this.enemyCore.y, '#38bdf8', 40);
      this.floatingTexts.push({
        id: Math.random().toString(),
        text: `⚡ OVERCORE DESTROYED! ADVANCING TO TIER ${this.overcoreTier}! ⚡`,
        x: this.enemyCore.x,
        y: this.enemyCore.y - 45,
        vy: -40,
        life: 2.5,
        maxLife: 2.5,
        color: '#f59e0b',
        isCrit: true,
      });
      return;
    }

    this.enemyCore.isDead = true;
    this.isGameOver = true;

    audioManager.stopCombatMusic();
    audioManager.playVictory();
    audioManager.playExplosion();
    this.screenShake = 24;
    this.spawnSparks(this.enemyCore.x, this.enemyCore.y, '#ffffff', 50);
    this.spawnSparks(this.enemyCore.x, this.enemyCore.y, '#38bdf8', 40);
    this.spawnSparks(this.enemyCore.x, this.enemyCore.y, '#f59e0b', 30);
    HapticsManager.trigger('matchEnd');

    const credits = 350 + this.sector * 180 + this.player.enemiesKilled * 6;
    const result: MatchResult = {
      winner: 'player',
      reason: 'core_destroyed',
      score: this.player.score + 5000 * this.sector,
      survivalTimeSeconds: Math.round(this.matchTime),
      playerLevelReached: this.player.playerLevel,
      weaponLevelReached: this.player.weaponLevel,
      bulletsPerShot: this.player.bulletsPerShot,
      enemiesKilled: this.player.enemiesKilled,
      starsCollected: this.player.starsCollected,
      damageDealt: Math.round(this.player.score * 1.5 + 2500),
      damageReceived: Math.round(this.player.maxHealth - this.player.health),
      difficulty: this.difficulty,
      isNewBestScore: false,
      hadCleanKill: true,
      sector: this.sector,
      sectorCompleted: true,
      techCreditsEarned: credits,
      enemyCoreDestroyed: true,
      alliedCoreDestroyed: false,
    };

    if (this.onGameOverCallback) {
      this.onGameOverCallback(result);
    }
  }

  public handleAlliedCoreDestroyed() {
    if (this.isGameOver) return;
    this.alliedCore.isDead = true;
    this.isGameOver = true;

    audioManager.stopCombatMusic();
    audioManager.playDefeat();
    audioManager.playExplosion();
    this.screenShake = 22;
    this.spawnSparks(this.alliedCore.x, this.alliedCore.y, '#ef4444', 40);
    HapticsManager.trigger('matchEnd');

    const result: MatchResult = {
      winner: 'enemy',
      reason: 'core_destroyed',
      score: this.player.score,
      survivalTimeSeconds: Math.round(this.matchTime),
      playerLevelReached: this.player.playerLevel,
      weaponLevelReached: this.player.weaponLevel,
      bulletsPerShot: this.player.bulletsPerShot,
      enemiesKilled: this.player.enemiesKilled,
      starsCollected: this.player.starsCollected,
      damageDealt: Math.round(this.player.score * 1.2),
      damageReceived: Math.round(this.alliedCore.maxHealth),
      difficulty: this.difficulty,
      isNewBestScore: false,
      hadCleanKill: true,
      sector: this.sector,
      sectorCompleted: false,
      techCreditsEarned: Math.round(this.player.enemiesKilled * 3),
      enemyCoreDestroyed: false,
      alliedCoreDestroyed: true,
    };

    if (this.onGameOverCallback) {
      this.onGameOverCallback(result);
    }
  }

  private handlePlayerDeath() {
    if (this.isGameOver) return;
    this.player.isDead = true;
    this.isGameOver = true;

    audioManager.stopCombatMusic();
    audioManager.playExplosion();
    audioManager.playDefeat();
    HapticsManager.trigger('matchEnd');

    const result: MatchResult = {
      winner: 'enemy',
      reason: 'kill',
      score: this.player.score,
      survivalTimeSeconds: Math.round(this.matchTime),
      playerLevelReached: this.player.playerLevel,
      weaponLevelReached: this.player.weaponLevel,
      bulletsPerShot: this.player.bulletsPerShot,
      enemiesKilled: this.player.enemiesKilled,
      starsCollected: this.player.starsCollected,
      damageDealt: Math.round(this.player.score * 1.5),
      damageReceived: Math.round(this.player.maxHealth),
      difficulty: this.difficulty,
      isNewBestScore: false,
      hadCleanKill: true,
      sector: this.sector,
      sectorCompleted: false,
      techCreditsEarned: Math.round(this.player.enemiesKilled * 3),
      enemyCoreDestroyed: false,
      alliedCoreDestroyed: false,
    };

    if (this.onGameOverCallback) {
      this.onGameOverCallback(result);
    }
  }

  public revivePlayer() {
    this.player.isDead = false;
    this.isGameOver = false;
    this.player.health = this.player.maxHealth;
    this.player.shieldActive = true;
    this.player.shieldDurationRemaining = 4.0;
    this.player.energy = Math.max(this.player.energy, 60);

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
      if (d < 350) {
        e.health -= 200;
        if (e.health <= 0) {
          this.destroyEnemy(e);
        }
      }
    }
    audioManager.playUpgrade();
  }
}
