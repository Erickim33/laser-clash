/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ArenaObstacle,
  ClientMessage,
  GameStateSnapshot,
  KillEvent,
  LaserBeamEvent,
  MatchPhase,
  PlayerInput,
  PlayerState,
  PowerUp,
  ReactorState,
  ProjectileState,
  SafeZone,
  ServerMessage,
  WeaponType
} from '../types/multiplayer';
import { WebSocket } from 'ws';

export const ARENA_SIZE = 2000;

export const PLAYER_COLORS = [
  '#00f0ff', // Cyber Cyan
  '#ff0055', // Neon Crimson
  '#39ff14', // Acid Lime
  '#ffe600', // Electric Gold
  '#b026ff', // Plasma Purple
  '#ff6600', // Solar Orange
  '#ff00b7', // Neon Fuchsia
  '#00e5ff', // Cobalt Glow
  '#ff3366', // Hot Coral
  '#00ff99', // Mint Laser
  '#9d4edd', // Deep Violet
  '#ffffff', // Pure White
];

interface ConnectedClient {
  id: string;
  ws?: WebSocket;
  name: string;
  color: string;
  isBot: boolean;
  input: PlayerInput;
  lastPingTime: number;
  pendingInteract: boolean;
}

export class MultiplayerEngine {
  public roomId: string;
  public roomName: string;
  public phase: MatchPhase = 'waiting';
  public countdown: number = 5;
  public matchTime: number = 0;
  public isHardcore: boolean = true;

  private clients: Map<string, ConnectedClient> = new Map();
  private players: Map<string, PlayerState> = new Map();
  private projectiles: ProjectileState[] = [];
  private laserBeams: LaserBeamEvent[] = [];
  private powerUps: PowerUp[] = [];
  private obstacles: ArenaObstacle[] = [];
  private recentKills: KillEvent[] = [];
  private safeZone: SafeZone;
  private reactor: ReactorState;

  private tickInterval: NodeJS.Timeout | null = null;
  private projectileIdCounter = 1;
  private laserIdCounter = 1;

  constructor(roomId: string, roomName = 'Hardcore Arena') {
    this.roomId = roomId;
    this.roomName = roomName;

    // Hardcore shrinking safe zone
    this.safeZone = {
      currentX: ARENA_SIZE / 2,
      currentY: ARENA_SIZE / 2,
      currentRadius: ARENA_SIZE * 0.65,
      targetX: ARENA_SIZE / 2,
      targetY: ARENA_SIZE / 2,
      targetRadius: ARENA_SIZE * 0.45,
      phase: 1,
      shrinkTimer: 20, // 20s before first shrink
      shrinkDuration: 25,
      isShrinking: false,
      damagePerSecond: 10, // Punishing hard damage outside safe zone
    };

    this.initArenaObstacles();
    this.initPowerUps();
    this.reactor = this.createReactorState();
    this.startLoop();
  }

  private initArenaObstacles() {
    this.obstacles = [
      // Central Reflective Monoliths (Mirror bounces)
      { id: 'obs-c1', x: 880, y: 880, width: 240, height: 40, isMirror: true },
      { id: 'obs-c2', x: 880, y: 1080, width: 240, height: 40, isMirror: true },
      { id: 'obs-c3', x: 880, y: 920, width: 40, height: 160, isMirror: true },
      { id: 'obs-c4', x: 1080, y: 920, width: 40, height: 160, isMirror: true },

      // Perimeter Hard Cover & Mirrors
      { id: 'obs-nw-1', x: 350, y: 350, width: 200, height: 35, isMirror: true },
      { id: 'obs-nw-2', x: 350, y: 385, width: 35, height: 180, isMirror: false },

      { id: 'obs-ne-1', x: 1450, y: 350, width: 200, height: 35, isMirror: true },
      { id: 'obs-ne-2', x: 1615, y: 385, width: 35, height: 180, isMirror: false },

      { id: 'obs-sw-1', x: 350, y: 1615, width: 200, height: 35, isMirror: true },
      { id: 'obs-sw-2', x: 350, y: 1435, width: 35, height: 180, isMirror: false },

      { id: 'obs-se-1', x: 1450, y: 1615, width: 200, height: 35, isMirror: true },
      { id: 'obs-se-2', x: 1615, y: 1435, width: 35, height: 180, isMirror: false },

      // Mid-Field Cross Pillars
      { id: 'obs-mid-w', x: 550, y: 950, width: 50, height: 100, isMirror: true },
      { id: 'obs-mid-e', x: 1400, y: 950, width: 50, height: 100, isMirror: true },
      { id: 'obs-mid-n', x: 975, y: 550, width: 100, height: 50, isMirror: true },
      { id: 'obs-mid-s', x: 975, y: 1400, width: 100, height: 50, isMirror: true },
    ];
  }

  private createReactorState(): ReactorState {
    return {
      x: 1000,
      y: 1000,
      nodes: [
        { id: 'alpha', name: 'ALPHA', x: 1000, y: 820, color: '#00f0ff' },
        { id: 'beta', name: 'BETA', x: 1180, y: 1000, color: '#ffe600' },
        { id: 'gamma', name: 'GAMMA', x: 1000, y: 1180, color: '#b026ff' },
        { id: 'delta', name: 'DELTA', x: 820, y: 1000, color: '#39ff14' },
      ],
      // The three-node code repeats until the core reaches 100%.
      sequence: ['alpha', 'gamma', 'beta'],
      sequenceProgress: 0,
      charge: 0,
      empTimeRemaining: 0,
      eventText: 'OVERLOAD PROTOCOL ONLINE',
      eventTimeRemaining: 4,
    };
  }

  private initPowerUps() {
    this.powerUps = [
      { id: 'pw-1', x: 650, y: 650, type: 'rapid', color: '#ffe600', respawnTime: 0 },
      { id: 'pw-2', x: 1350, y: 650, type: 'triple', color: '#ff0055', respawnTime: 0 },
      { id: 'pw-3', x: 650, y: 1350, type: 'shield_recharge', color: '#00f0ff', respawnTime: 0 },
      { id: 'pw-4', x: 1350, y: 1350, type: 'damage_boost', color: '#b026ff', respawnTime: 0 },
      { id: 'pw-c', x: 1000, y: 1000, type: 'dash_boost', color: '#39ff14', respawnTime: 0 },
    ];
  }

  public addClient(
    id: string,
    name: string,
    color: string,
    ws?: WebSocket,
    isBot = false
  ): PlayerState {
    const defaultInput: PlayerInput = {
      up: false,
      down: false,
      left: false,
      right: false,
      aimAngle: 0,
      shooting: false,
      dash: false,
      shield: false,
      interact: false,
    };

    this.clients.set(id, {
      id,
      name,
      color,
      isBot,
      input: defaultInput,
      lastPingTime: Date.now(),
      pendingInteract: false,
      ws,
    });

    // Spawn player around perimeter facing center
    const spawnIndex = this.players.size;
    const angle = (spawnIndex / 12) * Math.PI * 2;
    const spawnDist = 720;
    const spawnX = Math.max(100, Math.min(ARENA_SIZE - 100, ARENA_SIZE / 2 + Math.cos(angle) * spawnDist));
    const spawnY = Math.max(100, Math.min(ARENA_SIZE - 100, ARENA_SIZE / 2 + Math.sin(angle) * spawnDist));

    const player: PlayerState = {
      id,
      name,
      color,
      x: spawnX,
      y: spawnY,
      vx: 0,
      vy: 0,
      angle: Math.atan2(ARENA_SIZE / 2 - spawnY, ARENA_SIZE / 2 - spawnX),
      health: 100,
      maxHealth: 100,
      shield: 40,
      maxShield: 40,
      shieldActive: false,
      shieldDisabledTimer: 0,
      dashCooldown: 0,
      isDashing: false,
      weaponType: 'standard',
      heat: 0,
      isOverheated: false,
      kills: 0,
      damageDealt: 0,
      isAlive: true,
      isBot,
      ping: 20,
      survivalTime: 0,
    };

    this.players.set(id, player);
    return player;
  }

  public fillBotsUpTo(targetCount = 8) {
    const botNames = [
      'NEXUS_VIPER', 'CYBER_TITAN', 'LASER_GHOST', 'PULSE_FANG',
      'APEX_SHADOW', 'VECTOR_ZERO', 'NEON_STALKER', 'VOID_REAPER',
      'OVERCORE_SENTINEL', 'CHRONO_RAZOR', 'HYPERION_9'
    ];

    let count = this.players.size;
    let botIndex = 0;
    while (count < targetCount && count < 12) {
      const id = `bot_${Date.now()}_${botIndex}`;
      const name = botNames[botIndex % botNames.length];
      const color = PLAYER_COLORS[(count + 3) % PLAYER_COLORS.length];
      this.addClient(id, name, color, undefined, true);
      count++;
      botIndex++;
    }
  }

  public removeClient(id: string) {
    this.clients.delete(id);
    this.players.delete(id);
    if (this.players.size === 0) {
      this.resetMatch();
    }
  }

  public handleInput(id: string, input: PlayerInput) {
    const client = this.clients.get(id);
    if (client) {
      // Queue a single interaction on the rising edge, not 30 interactions/sec
      // while the client keeps E held down.
      if (input.interact && !client.input.interact) client.pendingInteract = true;
      client.input = input;
    }
  }

  public startMatch() {
    if (this.phase === 'waiting' || this.phase === 'game_over') {
      if (this.phase === 'game_over') this.resetMatch();
      this.phase = 'countdown';
      this.countdown = 3;
    }
  }

  private resetMatch() {
    this.phase = 'waiting';
    this.countdown = 5;
    this.matchTime = 0;
    this.projectiles = [];
    this.laserBeams = [];
    this.recentKills = [];
    this.reactor = this.createReactorState();

    // Reset safe zone
    this.safeZone = {
      currentX: ARENA_SIZE / 2,
      currentY: ARENA_SIZE / 2,
      currentRadius: ARENA_SIZE * 0.65,
      targetX: ARENA_SIZE / 2,
      targetY: ARENA_SIZE / 2,
      targetRadius: ARENA_SIZE * 0.42,
      phase: 1,
      shrinkTimer: 20,
      shrinkDuration: 25,
      isShrinking: false,
      damagePerSecond: 10,
    };

    // Reset player states
    let i = 0;
    for (const [id, player] of this.players.entries()) {
      const client = this.clients.get(id);
      if (client) {
        client.pendingInteract = false;
        client.input.interact = false;
      }
      const angle = (i / Math.max(1, this.players.size)) * Math.PI * 2;
      const spawnDist = 720;
      player.x = Math.max(100, Math.min(ARENA_SIZE - 100, ARENA_SIZE / 2 + Math.cos(angle) * spawnDist));
      player.y = Math.max(100, Math.min(ARENA_SIZE - 100, ARENA_SIZE / 2 + Math.sin(angle) * spawnDist));
      player.vx = 0;
      player.vy = 0;
      player.angle = Math.atan2(ARENA_SIZE / 2 - player.y, ARENA_SIZE / 2 - player.x);
      player.health = 100;
      player.shield = 40;
      player.shieldActive = false;
      player.shieldDisabledTimer = 0;
      player.dashCooldown = 0;
      player.isDashing = false;
      player.weaponType = 'standard';
      player.heat = 0;
      player.isOverheated = false;
      player.kills = 0;
      player.damageDealt = 0;
      player.isAlive = true;
      player.survivalTime = 0;
      delete player.rank;
      delete player.eliminatedBy;
      i++;
    }
  }

  private startLoop() {
    const TICK_RATE = 30; // 30 updates/sec authoritative
    const dt = 1 / TICK_RATE;

    this.tickInterval = setInterval(() => {
      this.update(dt);
      this.broadcastState();
    }, 1000 / TICK_RATE);
  }

  public destroy() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  private update(dt: number) {
    if (this.phase === 'countdown') {
      this.countdown -= dt;
      if (this.countdown <= 0) {
        this.phase = 'active';
        this.matchTime = 0;
      }
      return;
    }

    if (this.phase !== 'active') return;

    this.matchTime += dt;

    // 1. Update Safe Zone (Shrinking Battle Royale Circle)
    this.updateSafeZone(dt);

    // 2. Update Reactor / EMP timers
    this.updateReactor(dt);

    // 3. Update Bot Inputs (High-Difficulty Tactical AI)
    this.updateBotAI(dt);

    // 4. Update Players
    this.updatePlayers(dt);

    // 5. Update Projectiles & Hits
    this.updateProjectiles(dt);

    // 6. Update PowerUps
    this.updatePowerUps(dt);

    // 7. Clean Laser Beam Visual Events
    for (let i = this.laserBeams.length - 1; i >= 0; i--) {
      this.laserBeams[i].duration -= dt;
      if (this.laserBeams[i].duration <= 0) {
        this.laserBeams.splice(i, 1);
      }
    }

    // 8. Check Win Condition (Last Player Standing)
    this.checkMatchEnd();
  }

  private updateSafeZone(dt: number) {
    const sz = this.safeZone;
    if (!sz.isShrinking) {
      sz.shrinkTimer -= dt;
      if (sz.shrinkTimer <= 0) {
        sz.isShrinking = true;
        sz.shrinkTimer = sz.shrinkDuration;
      }
    } else {
      // Interpolate radius and center towards target
      const shrinkRate = (sz.currentRadius - sz.targetRadius) / sz.shrinkTimer;
      sz.currentRadius = Math.max(sz.targetRadius, sz.currentRadius - shrinkRate * dt);
      sz.shrinkTimer -= dt;

      if (sz.shrinkTimer <= 0 || sz.currentRadius <= sz.targetRadius + 5) {
        // Prepare next phase (even tighter)
        sz.phase++;
        sz.isShrinking = false;
        sz.shrinkTimer = 18;
        sz.currentRadius = sz.targetRadius;
        sz.targetRadius = Math.max(120, sz.targetRadius * 0.65);
        sz.damagePerSecond = 10 + sz.phase * 3; // Escalates up to 25 DPS
      }
    }

    // Apply zone damage to players outside safe circle
    for (const player of this.players.values()) {
      if (!player.isAlive) continue;
      const dx = player.x - sz.currentX;
      const dy = player.y - sz.currentY;
      const dist = Math.hypot(dx, dy);

      if (dist > sz.currentRadius) {
        // Outside safe zone!
        const dmg = sz.damagePerSecond * dt;
        this.applyDamage(player, dmg, undefined, 'safe_zone');
      }
    }
  }

  private updateReactor(dt: number) {
    if (this.reactor.empTimeRemaining > 0) {
      this.reactor.empTimeRemaining = Math.max(0, this.reactor.empTimeRemaining - dt);
      if (this.reactor.empTimeRemaining === 0) {
        this.reactor.eventText = 'EMP FIELD CLEARED';
        this.reactor.eventTimeRemaining = 3;
      }
    }
    if (this.reactor.eventTimeRemaining > 0) {
      this.reactor.eventTimeRemaining = Math.max(0, this.reactor.eventTimeRemaining - dt);
    }
  }

  private tryReactorInteraction(player: PlayerState) {
    if (!player.isAlive || this.phase !== 'active' || this.reactor.empTimeRemaining > 0) return;

    const node = this.reactor.nodes
      .map((candidate) => ({ candidate, distance: Math.hypot(player.x - candidate.x, player.y - candidate.y) }))
      .sort((a, b) => a.distance - b.distance)[0];

    if (!node || node.distance > 62) {
      this.reactor.eventText = 'MOVE CLOSER TO A TERMINAL';
      this.reactor.eventTimeRemaining = 1.5;
      return;
    }

    const expectedId = this.reactor.sequence[this.reactor.sequenceProgress];
    if (node.candidate.id !== expectedId) {
      this.reactor.sequenceProgress = 0;
      this.reactor.eventText = `WRONG NODE · SEQUENCE RESET`;
      this.reactor.eventTimeRemaining = 2;
      return;
    }

    this.reactor.sequenceProgress++;
    if (this.reactor.sequenceProgress < this.reactor.sequence.length) {
      const nextName = this.reactor.nodes.find((n) => n.id === this.reactor.sequence[this.reactor.sequenceProgress])?.name;
      this.reactor.eventText = `${node.candidate.name} ACCEPTED · NEXT: ${nextName}`;
      this.reactor.eventTimeRemaining = 2;
      return;
    }

    this.reactor.sequenceProgress = 0;
    this.reactor.charge = Math.min(100, this.reactor.charge + 25);
    if (this.reactor.charge >= 100) {
      this.reactor.charge = 0;
      this.reactor.empTimeRemaining = 5;
      for (const opponent of this.players.values()) {
        if (opponent.id !== player.id && opponent.isAlive) {
          opponent.shieldDisabledTimer = Math.max(opponent.shieldDisabledTimer, 5);
          opponent.shieldActive = false;
        }
      }
      this.reactor.eventText = `${player.name} TRIGGERED EMP · SHIELDS OFFLINE`;
      this.reactor.eventTimeRemaining = 5;
    } else {
      this.reactor.eventText = `SEQUENCE COMPLETE · CORE ${this.reactor.charge}%`;
      this.reactor.eventTimeRemaining = 2.5;
    }
  }

  private updateBotAI(dt: number) {
    const aliveTargets = Array.from(this.players.values()).filter((p) => p.isAlive);

    for (const [id, client] of this.clients.entries()) {
      if (!client.isBot) continue;
      const bot = this.players.get(id);
      if (!bot || !bot.isAlive) continue;

      // Find closest enemy player
      let closestEnemy: PlayerState | null = null;
      let closestDist = Infinity;
      for (const target of aliveTargets) {
        if (target.id === bot.id) continue;
        const dist = Math.hypot(target.x - bot.x, target.y - bot.y);
        if (dist < closestDist) {
          closestDist = dist;
          closestEnemy = target;
        }
      }

      // Hard AI logic: Lead targets, use dash to evade, maintain distance
      if (closestEnemy) {
        // Predictive aim (leading laser shots based on target velocity)
        const laserSpeed = 1050;
        const timeToHit = closestDist / laserSpeed;
        const predX = closestEnemy.x + closestEnemy.vx * timeToHit * 0.8;
        const predY = closestEnemy.y + closestEnemy.vy * timeToHit * 0.8;
        client.input.aimAngle = Math.atan2(predY - bot.y, predX - bot.x);

        // Movement strategy: Stay inside safe zone, strafe around target
        const centerDx = this.safeZone.currentX - bot.x;
        const centerDy = this.safeZone.currentY - bot.y;
        const distToCenter = Math.hypot(centerDx, centerDy);

        if (distToCenter > this.safeZone.currentRadius * 0.75) {
          // Move towards center to avoid storm
          client.input.up = centerDy < -20;
          client.input.down = centerDy > 20;
          client.input.left = centerDx < -20;
          client.input.right = centerDx > 20;
        } else {
          // Tactical strafe around enemy
          const enemyDx = closestEnemy.x - bot.x;
          const enemyDy = closestEnemy.y - bot.y;
          const angle = Math.atan2(enemyDy, enemyDx);
          const strafeAngle = angle + (Math.sin(this.matchTime * 2 + bot.x) > 0 ? Math.PI / 2 : -Math.PI / 2);

          client.input.up = Math.sin(strafeAngle) < -0.3;
          client.input.down = Math.sin(strafeAngle) > 0.3;
          client.input.left = Math.cos(strafeAngle) < -0.3;
          client.input.right = Math.cos(strafeAngle) > 0.3;
        }

        // Hard shooting: Shoot when aimed near target and not overheated
        client.input.shooting = closestDist < 800 && bot.heat < 75;

        // Defensive dash if low health or incoming laser
        if (bot.health < 45 && bot.dashCooldown <= 0 && Math.random() < 0.08) {
          client.input.dash = true;
        } else {
          client.input.dash = false;
        }

        // Shield usage if under fire
        client.input.shield = bot.shield > 10 && closestDist < 300 && Math.random() < 0.05;
      } else {
        client.input.shooting = false;
      }
    }
  }

  private updatePlayers(dt: number) {
    const SPEED = 280; // High speed responsive movement
    const DASH_SPEED = 720;

    for (const [id, player] of this.players.entries()) {
      if (!player.isAlive) continue;

      player.survivalTime += dt;
      const client = this.clients.get(id);
      const input = client?.input || {
        up: false, down: false, left: false, right: false,
        aimAngle: player.angle, shooting: false, dash: false, shield: false, interact: false
      };

      player.angle = input.aimAngle;

      // EMP disables shields temporarily. The timer is authoritative on the server.
      if (player.shieldDisabledTimer > 0) {
        player.shieldDisabledTimer = Math.max(0, player.shieldDisabledTimer - dt);
        player.shieldActive = false;
      }

      // Handle Dash Cooldown
      if (player.dashCooldown > 0) {
        player.dashCooldown -= dt;
      }

      // Trigger Dash (Hardcore: 0.18s burst, 3.5s cooldown)
      if (input.dash && player.dashCooldown <= 0) {
        player.isDashing = true;
        player.dashCooldown = 3.5;
        // Direction vector
        const dashAngle = (input.up || input.down || input.left || input.right)
          ? Math.atan2(
              (input.down ? 1 : 0) - (input.up ? 1 : 0),
              (input.right ? 1 : 0) - (input.left ? 1 : 0)
            )
          : player.angle;
        player.vx = Math.cos(dashAngle) * DASH_SPEED;
        player.vy = Math.sin(dashAngle) * DASH_SPEED;
      }

      // Handle Movement Velocity
      if (!player.isDashing) {
        let moveX = 0;
        let moveY = 0;
        if (input.up) moveY -= 1;
        if (input.down) moveY += 1;
        if (input.left) moveX -= 1;
        if (input.right) moveX += 1;

        if (moveX !== 0 && moveY !== 0) {
          moveX *= 0.7071;
          moveY *= 0.7071;
        }

        // Shield slows movement by 40%
        const speedMultiplier = input.shield && player.shield > 0 ? 0.6 : 1.0;
        player.vx = moveX * SPEED * speedMultiplier;
        player.vy = moveY * SPEED * speedMultiplier;
      } else {
        // Damping dash
        player.vx *= 0.88;
        player.vy *= 0.88;
        if (Math.hypot(player.vx, player.vy) < SPEED) {
          player.isDashing = false;
        }
      }

      // Check Shield
      player.shieldActive = player.shieldDisabledTimer <= 0 && input.shield && player.shield > 0;
      if (player.shieldActive) {
        player.shield = Math.max(0, player.shield - 12 * dt);
      } else if (player.shield < player.maxShield) {
        player.shield = Math.min(player.maxShield, player.shield + 8 * dt);
      }

      // Update Position with Obstacle Collisions
      const nextX = player.x + player.vx * dt;
      const nextY = player.y + player.vy * dt;
      const playerRadius = 16;

      // Arena boundary collision
      const clampedX = Math.max(playerRadius, Math.min(ARENA_SIZE - playerRadius, nextX));
      const clampedY = Math.max(playerRadius, Math.min(ARENA_SIZE - playerRadius, nextY));

      // Check obstacle collisions
      if (!this.checkObstacleCollision(clampedX, player.y, playerRadius)) {
        player.x = clampedX;
      } else {
        player.vx = 0;
      }

      if (!this.checkObstacleCollision(player.x, clampedY, playerRadius)) {
        player.y = clampedY;
      } else {
        player.vy = 0;
      }

      // Interact with the closest reactor terminal after movement resolves.
      if (client?.pendingInteract) {
        client.pendingInteract = false;
        this.tryReactorInteraction(player);
      }

      // Weapon Heat & Cooldown
      if (player.isOverheated) {
        player.heat -= 40 * dt;
        if (player.heat <= 0) {
          player.heat = 0;
          player.isOverheated = false;
        }
      } else {
        player.heat = Math.max(0, player.heat - 25 * dt);
      }

      // Weapon Firing
      if (input.shooting && !player.isOverheated) {
        this.fireWeapon(player);
      }
    }
  }

  private fireWeapon(player: PlayerState) {
    const now = Date.now();
    // Fire rate check: 0.16s for standard, 0.09s for rapid
    const cooldownMs = player.weaponType === 'rapid' ? 90 : 160;
    const lastFired = (player as unknown as { lastFireTime?: number }).lastFireTime || 0;

    if (now - lastFired < cooldownMs) return;
    (player as unknown as { lastFireTime?: number }).lastFireTime = now;

    // Heat generation: Harder management
    const heatCost = player.weaponType === 'rapid' ? 6 : 9;
    player.heat += heatCost;
    if (player.heat >= 100) {
      player.heat = 100;
      player.isOverheated = true; // Overheated penalty lock
    }

    // High projectile velocity: 1050 px/s (very hard/fast!)
    const SPEED = 1050;
    const DAMAGE = player.weaponType === 'triple' ? 22 : 32;

    if (player.weaponType === 'triple') {
      const spread = [-0.14, 0, 0.14];
      for (const angleOffset of spread) {
        const finalAngle = player.angle + angleOffset;
        this.projectiles.push({
          id: `proj_${this.projectileIdCounter++}`,
          shooterId: player.id,
          shooterColor: player.color,
          x: player.x + Math.cos(player.angle) * 22,
          y: player.y + Math.sin(player.angle) * 22,
          vx: Math.cos(finalAngle) * SPEED,
          vy: Math.sin(finalAngle) * SPEED,
          damage: DAMAGE,
          color: player.color,
          radius: 4,
          bouncesLeft: 1, // Can bounce off mirrors!
          type: 'triple',
          life: 1.8,
        });
      }
    } else {
      this.projectiles.push({
        id: `proj_${this.projectileIdCounter++}`,
        shooterId: player.id,
        shooterColor: player.color,
        x: player.x + Math.cos(player.angle) * 22,
        y: player.y + Math.sin(player.angle) * 22,
        vx: Math.cos(player.angle) * SPEED,
        vy: Math.sin(player.angle) * SPEED,
        damage: DAMAGE,
        color: player.color,
        radius: 5,
        bouncesLeft: 2, // Reflective laser bounce
        type: player.weaponType,
        life: 1.8,
      });
    }

    // Register laser beam trace
    this.laserBeams.push({
      id: `laser_${this.laserIdCounter++}`,
      shooterId: player.id,
      color: player.color,
      startX: player.x,
      startY: player.y,
      endX: player.x + Math.cos(player.angle) * 45,
      endY: player.y + Math.sin(player.angle) * 45,
      duration: 0.08,
      thickness: 3,
    });
  }

  private updateProjectiles(dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.projectiles.splice(i, 1);
        continue;
      }

      const nextX = p.x + p.vx * dt;
      const nextY = p.y + p.vy * dt;

      // 1. Check Mirror & Obstacle Collisions
      let hitObstacle = false;
      for (const obs of this.obstacles) {
        if (
          nextX >= obs.x &&
          nextX <= obs.x + obs.width &&
          nextY >= obs.y &&
          nextY <= obs.y + obs.height
        ) {
          hitObstacle = true;
          if (obs.isMirror && p.bouncesLeft > 0) {
            // Reflect laser angle!
            p.bouncesLeft--;
            const prevDistLeft = Math.abs(p.x - obs.x);
            const prevDistRight = Math.abs(p.x - (obs.x + obs.width));
            const prevDistTop = Math.abs(p.y - obs.y);
            const prevDistBottom = Math.abs(p.y - (obs.y + obs.height));
            const minHorizontal = Math.min(prevDistLeft, prevDistRight);
            const minVertical = Math.min(prevDistTop, prevDistBottom);

            if (minHorizontal < minVertical) {
              p.vx = -p.vx; // Flip X
            } else {
              p.vy = -p.vy; // Flip Y
            }
            p.life = Math.min(p.life, 1.2);
            hitObstacle = false; // Continue flying reflected
          }
          break;
        }
      }

      if (hitObstacle) {
        this.projectiles.splice(i, 1);
        continue;
      }

      // Check Arena Bounds
      if (nextX < 0 || nextX > ARENA_SIZE || nextY < 0 || nextY > ARENA_SIZE) {
        this.projectiles.splice(i, 1);
        continue;
      }

      p.x = nextX;
      p.y = nextY;

      // 2. Check Hit on Players
      let projectileConsumed = false;
      for (const target of this.players.values()) {
        if (!target.isAlive) continue;
        if (target.id === p.shooterId) continue; // Don't hit self

        const dist = Math.hypot(target.x - p.x, target.y - p.y);
        if (dist <= 18 + p.radius) {
          // Check if target is dashing (dash gives brief invulnerability)
          if (target.isDashing) {
            continue; // Dodged laser!
          }

          // Check if target has active reflector shield
          if (target.shieldDisabledTimer <= 0 && target.shieldActive && target.shield > 0) {
            const angleToBullet = Math.atan2(p.y - target.y, p.x - target.x);
            const angleDiff = Math.abs(Math.atan2(Math.sin(angleToBullet - target.angle), Math.cos(angleToBullet - target.angle)));
            if (angleDiff < Math.PI / 2.5) {
              // Shield absorbed or deflected laser!
              target.shield = Math.max(0, target.shield - p.damage);
              projectileConsumed = true;
              break;
            }
          }

          // Direct hit! Apply damage
          const shooter = this.players.get(p.shooterId);
          if (shooter) {
            shooter.damageDealt += p.damage;
          }

          this.applyDamage(target, p.damage, shooter, p.type);
          projectileConsumed = true;
          break;
        }
      }

      if (projectileConsumed) {
        this.projectiles.splice(i, 1);
      }
    }
  }

  private applyDamage(
    victim: PlayerState,
    amount: number,
    killer?: PlayerState,
    weaponType: WeaponType | 'safe_zone' = 'standard'
  ) {
    if (!victim.isAlive) return;

    victim.health -= amount;
    if (victim.health <= 0) {
      victim.health = 0;
      victim.isAlive = false;
      victim.eliminatedBy = killer ? killer.name : 'Storm Safe Zone';

      // Count alive players to assign rank
      const aliveCount = Array.from(this.players.values()).filter((p) => p.isAlive).length;
      victim.rank = aliveCount + 1;

      if (killer && killer.id !== victim.id) {
        killer.kills += 1;
        killer.health = Math.min(killer.maxHealth, killer.health + 20); // Hard reward: +20 HP on kill
      }

      // Register kill feed event
      this.recentKills.unshift({
        killerId: killer?.id || 'storm',
        killerName: killer?.name || 'STORM',
        killerColor: killer?.color || '#ff0055',
        victimId: victim.id,
        victimName: victim.name,
        victimColor: victim.color,
        weapon: weaponType as WeaponType,
        timestamp: Date.now(),
      });

      if (this.recentKills.length > 5) {
        this.recentKills.pop();
      }

      // Notify eliminated client
      const victimClient = this.clients.get(victim.id);
      if (victimClient?.ws && victimClient.ws.readyState === WebSocket.OPEN) {
        const msg: ServerMessage = {
          type: 'eliminated',
          killerName: killer?.name,
          rank: victim.rank,
          stats: {
            kills: victim.kills,
            damage: Math.round(victim.damageDealt),
            time: Math.round(victim.survivalTime),
          },
        };
        victimClient.ws.send(JSON.stringify(msg));
      }
    }
  }

  private updatePowerUps(dt: number) {
    for (const pw of this.powerUps) {
      if (pw.respawnTime > 0) {
        pw.respawnTime -= dt;
        continue;
      }

      // Check collision with alive players
      for (const p of this.players.values()) {
        if (!p.isAlive) continue;
        const dist = Math.hypot(p.x - pw.x, p.y - pw.y);
        if (dist < 26) {
          // Pickup powerup!
          if (pw.type === 'rapid') p.weaponType = 'rapid';
          else if (pw.type === 'triple') p.weaponType = 'triple';
          else if (pw.type === 'shield_recharge') p.shield = p.maxShield;
          else if (pw.type === 'damage_boost') p.health = Math.min(100, p.health + 35);
          else if (pw.type === 'dash_boost') p.dashCooldown = 0;

          pw.respawnTime = 16; // 16s respawn
          break;
        }
      }
    }
  }

  private checkObstacleCollision(x: number, y: number, radius: number): boolean {
    for (const obs of this.obstacles) {
      const closestX = Math.max(obs.x, Math.min(x, obs.x + obs.width));
      const closestY = Math.max(obs.y, Math.min(y, obs.y + obs.height));
      const distance = Math.hypot(x - closestX, y - closestY);
      if (distance < radius) {
        return true;
      }
    }
    return false;
  }

  private checkMatchEnd() {
    if (this.players.size < 2) return;

    const alivePlayers = Array.from(this.players.values()).filter((p) => p.isAlive);
    if (alivePlayers.length <= 1) {
      this.phase = 'game_over';
      const winner = alivePlayers[0];
      if (winner) {
        winner.rank = 1;
      }
    }
  }

  public getSnapshot(): GameStateSnapshot {
    const playersObj: Record<string, PlayerState> = {};
    let aliveCount = 0;

    for (const [id, p] of this.players.entries()) {
      playersObj[id] = { ...p };
      if (p.isAlive) aliveCount++;
    }

    const alivePlayers = Array.from(this.players.values()).filter((p) => p.isAlive);
    const winner = this.phase === 'game_over' && alivePlayers.length === 1 ? {
      id: alivePlayers[0].id,
      name: alivePlayers[0].name,
      color: alivePlayers[0].color,
      kills: alivePlayers[0].kills,
      damageDealt: Math.round(alivePlayers[0].damageDealt),
      survivalTime: Math.round(alivePlayers[0].survivalTime),
    } : undefined;

    return {
      phase: this.phase,
      countdown: Math.ceil(this.countdown),
      matchTime: Math.round(this.matchTime),
      aliveCount,
      totalPlayers: this.players.size,
      players: playersObj,
      projectiles: this.projectiles.map((p) => ({ ...p })),
      laserBeams: [...this.laserBeams],
      powerUps: this.powerUps.filter((pw) => pw.respawnTime <= 0),
      safeZone: { ...this.safeZone },
      reactor: { ...this.reactor, nodes: this.reactor.nodes.map((node) => ({ ...node })), sequence: [...this.reactor.sequence] },
      obstacles: this.obstacles,
      recentKills: this.recentKills,
      winner,
    };
  }

  private broadcastState() {
    const snapshot = this.getSnapshot();
    const payload = JSON.stringify({ type: 'state', snapshot });

    for (const client of this.clients.values()) {
      if (client.ws && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
      }
    }
  }
}
