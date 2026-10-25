/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GameStateSnapshot, PlayerState } from '../types/multiplayer';
import { ARENA_SIZE } from '../server/MultiplayerEngine';

export class MultiplayerCanvasRenderer {
  private ctx: CanvasRenderingContext2D;
  private width: number = 0;
  private height: number = 0;

  // Camera interpolation
  public camX: number = ARENA_SIZE / 2;
  public camY: number = ARENA_SIZE / 2;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  public resize(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  public render(
    snapshot: GameStateSnapshot,
    localPlayerId: string | null,
    spectateId: string | null = null,
    crosshairPoint?: { x: number; y: number } | null
  ) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // Determine focus player (local player if alive, else spectated player)
    const targetId = localPlayerId && snapshot.players[localPlayerId]?.isAlive
      ? localPlayerId
      : spectateId || localPlayerId;
    const focusPlayer: PlayerState | undefined = targetId ? snapshot.players[targetId] : undefined;

    // Smooth camera follow
    if (focusPlayer) {
      this.camX += (focusPlayer.x - this.camX) * 0.15;
      this.camY += (focusPlayer.y - this.camY) * 0.15;
    }

    // Clear background
    ctx.fillStyle = '#060709';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    // Center camera on screen
    ctx.translate(w / 2 - this.camX, h / 2 - this.camY);

    // 1. Draw World Grid & Bounds
    this.drawWorldGrid();

    // 2. Draw Safe Zone & Storm Field
    this.drawSafeZone(snapshot.safeZone);

    // 3. Draw Obstacles & Reflective Mirrors
    this.drawObstacles(snapshot);

    // 4. Draw the interactive Overload Protocol reactor and terminals
    this.drawReactor(snapshot);

    // 5. Draw Power-Ups
    this.drawPowerUps(snapshot);

    // 6. Draw Laser Beams
    this.drawLaserBeams(snapshot);

    // 7. Draw Projectiles
    this.drawProjectiles(snapshot);

    // 8. Draw All Players (2-12 players)
    this.drawPlayers(snapshot, localPlayerId);

    // 9. Draw Aim Crosshair (World Space)
    if (crosshairPoint && focusPlayer && focusPlayer.isAlive && focusPlayer.id === localPlayerId) {
      this.drawCrosshair(crosshairPoint.x, crosshairPoint.y, focusPlayer.color);
    }

    ctx.restore();

    // 10. Screen-Space Minimap (Top-Left Corner - NEVER IN THE MIDDLE)
    this.drawMinimap(snapshot, localPlayerId);
  }

  private drawWorldGrid() {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
    ctx.lineWidth = 1;

    const gridSize = 80;
    for (let x = 0; x <= ARENA_SIZE; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, ARENA_SIZE);
      ctx.stroke();
    }
    for (let y = 0; y <= ARENA_SIZE; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(ARENA_SIZE, y);
      ctx.stroke();
    }

    // Outer Arena Boundary Border
    ctx.strokeStyle = 'rgba(255, 0, 85, 0.4)';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, ARENA_SIZE, ARENA_SIZE);
  }

  private drawSafeZone(sz: GameStateSnapshot['safeZone']) {
    const ctx = this.ctx;

    // Draw Storm Zone outside safe radius
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, ARENA_SIZE, ARENA_SIZE);
    ctx.arc(sz.currentX, sz.currentY, Math.max(0, sz.currentRadius), 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
    ctx.fill();

    // Pulsing Safe Zone Perimeter Ring
    ctx.beginPath();
    ctx.arc(sz.currentX, sz.currentY, Math.max(0, sz.currentRadius), 0, Math.PI * 2);
    ctx.strokeStyle = sz.isShrinking ? '#ef4444' : '#00f0ff';
    ctx.lineWidth = 3;
    ctx.shadowColor = sz.isShrinking ? '#ef4444' : '#00f0ff';
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  private drawObstacles(snapshot: GameStateSnapshot) {
    const ctx = this.ctx;
    for (const obs of snapshot.obstacles) {
      ctx.save();
      if (obs.isMirror) {
        // Reflective Mirror Barrier
        ctx.fillStyle = 'rgba(16, 32, 48, 0.95)';
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);

        // Reflective edge glow
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 2;
        ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);

        // Diagonal mirror hazard stripes
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.2)';
        ctx.lineWidth = 1.5;
        const stripeStep = 18;
        for (let sx = obs.x; sx < obs.x + obs.width + obs.height; sx += stripeStep) {
          ctx.beginPath();
          ctx.moveTo(sx, obs.y);
          ctx.lineTo(sx - obs.height, obs.y + obs.height);
          ctx.stroke();
        }
      } else {
        // Solid High-Density Cover
        ctx.fillStyle = 'rgba(28, 28, 35, 0.98)';
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
      }
      ctx.restore();
    }
  }

  private drawReactor(snapshot: GameStateSnapshot) {
    const ctx = this.ctx;
    const reactor = snapshot.reactor;
    if (!reactor) return;

    const pulse = 1 + Math.sin(Date.now() / 220) * 0.08;
    ctx.save();
    ctx.translate(reactor.x, reactor.y);
    const reactorColor = reactor.empTimeRemaining > 0 ? '#ff3366' : '#00f0ff';
    ctx.strokeStyle = reactorColor;
    ctx.lineWidth = 3;
    ctx.shadowColor = reactorColor;
    ctx.shadowBlur = reactor.empTimeRemaining > 0 ? 24 : 12;
    ctx.beginPath();
    ctx.arc(0, 0, 48 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,240,255,0.12)';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#e8fdff';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CORE', 0, 4);
    ctx.restore();

    for (const node of reactor.nodes) {
      const sequenceIndex = reactor.sequence[reactor.sequenceProgress] === node.id;
      ctx.save();
      ctx.translate(node.x, node.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = `${node.color}22`;
      ctx.strokeStyle = node.color;
      ctx.lineWidth = sequenceIndex ? 3 : 2;
      ctx.shadowColor = node.color;
      ctx.shadowBlur = sequenceIndex ? 18 : 8;
      ctx.fillRect(-14, -14, 28, 28);
      ctx.strokeRect(-14, -14, 28, 28);
      ctx.restore();
      ctx.save();
      ctx.fillStyle = node.color;
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = node.color;
      ctx.shadowBlur = 8;
      ctx.fillText(node.name, node.x, node.y + 31);
      ctx.restore();
    }
  }

  private drawPowerUps(snapshot: GameStateSnapshot) {
    const ctx = this.ctx;
    const time = Date.now() / 350;

    for (const pw of snapshot.powerUps) {
      ctx.save();
      ctx.translate(pw.x, pw.y);

      // Rotating cyber diamond
      ctx.rotate(time);
      ctx.fillStyle = `${pw.color}22`;
      ctx.strokeStyle = pw.color;
      ctx.lineWidth = 2;
      ctx.shadowColor = pw.color;
      ctx.shadowBlur = 10;

      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(14, 0);
      ctx.lineTo(0, 14);
      ctx.lineTo(-14, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Inner pulse
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      ctx.restore();
    }
  }

  private drawLaserBeams(snapshot: GameStateSnapshot) {
    const ctx = this.ctx;
    for (const beam of snapshot.laserBeams) {
      ctx.save();
      ctx.strokeStyle = beam.color;
      ctx.lineWidth = beam.thickness;
      ctx.shadowColor = beam.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(beam.startX, beam.startY);
      ctx.lineTo(beam.endX, beam.endY);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawProjectiles(snapshot: GameStateSnapshot) {
    const ctx = this.ctx;
    for (const p of snapshot.projectiles) {
      ctx.save();
      ctx.translate(p.x, p.y);

      // Laser projectile trail
      const speed = Math.hypot(p.vx, p.vy);
      const angle = Math.atan2(p.vy, p.vx);
      ctx.rotate(angle);

      // Glowing projectile body
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 12;

      ctx.beginPath();
      ctx.ellipse(0, 0, p.radius * 2.5, p.radius * 0.9, 0, 0, Math.PI * 2);
      ctx.fill();

      // Tail
      const grad = ctx.createLinearGradient(-p.radius * 3.5, 0, 0, 0);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, p.color);
      ctx.fillStyle = grad;
      ctx.fillRect(-p.radius * 4, -p.radius * 0.6, p.radius * 4, p.radius * 1.2);

      ctx.restore();
    }
  }

  private drawPlayers(snapshot: GameStateSnapshot, localPlayerId: string | null) {
    const ctx = this.ctx;

    for (const player of Object.values(snapshot.players)) {
      if (!player.isAlive) continue;

      const isLocal = player.id === localPlayerId;

      ctx.save();
      ctx.translate(player.x, player.y);

      // 1. Dash Motion Blur
      if (player.isDashing) {
        ctx.save();
        ctx.fillStyle = `${player.color}44`;
        ctx.beginPath();
        ctx.arc(-player.vx * 0.04, -player.vy * 0.04, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 2. Reflector Shield Dome
      if (player.shieldActive && player.shield > 0) {
        ctx.save();
        ctx.beginPath();
        // Shield hemisphere in facing direction
        ctx.arc(0, 0, 24, player.angle - Math.PI / 2.3, player.angle + Math.PI / 2.3);
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.restore();
      }

      // 3. Player Chassis Body
      ctx.save();
      ctx.rotate(player.angle);

      // Shadow glow
      ctx.shadowColor = player.color;
      ctx.shadowBlur = isLocal ? 16 : 8;

      // Futuristic Combat Drone Shape
      ctx.fillStyle = '#121318';
      ctx.strokeStyle = player.color;
      ctx.lineWidth = isLocal ? 2.5 : 1.8;

      ctx.beginPath();
      ctx.moveTo(18, 0); // Front nose
      ctx.lineTo(-12, 13); // Right wing
      ctx.lineTo(-7, 0); // Rear notch
      ctx.lineTo(-12, -13); // Left wing
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Front Cannon Barrel
      ctx.fillStyle = player.color;
      ctx.fillRect(8, -2, 12, 4);

      // Core Power Cell (changes to red when overheated)
      ctx.fillStyle = player.isOverheated ? '#ef4444' : '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // 4. Compact Overhead Indicator (24px above, clean & unobtrusive)
      const barW = 34;
      const barH = 4;
      const barY = -26;

      // Background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(-barW / 2, barY, barW, barH);

      // Health bar fill
      const hpPct = Math.max(0, player.health / player.maxHealth);
      ctx.fillStyle = hpPct > 0.4 ? player.color : '#ef4444';
      ctx.fillRect(-barW / 2, barY, barW * hpPct, barH);

      // Shield overlay line
      if (player.shield > 0) {
        const shieldPct = Math.max(0, player.shield / player.maxShield);
        ctx.fillStyle = '#00f0ff';
        ctx.fillRect(-barW / 2, barY - 2.5, barW * shieldPct, 2);
      }

      // Compact Username
      ctx.fillStyle = isLocal ? '#ffffff' : 'rgba(255, 255, 255, 0.85)';
      ctx.font = isLocal ? 'bold 10px monospace' : '9px monospace';
      ctx.textAlign = 'center';
      const label = player.isBot ? `[BOT] ${player.name}` : player.name;
      ctx.fillText(label, 0, barY - 5);

      ctx.restore();
    }
  }

  private drawCrosshair(x: number, y: number, color: string) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.moveTo(x - 12, y);
    ctx.lineTo(x - 3, y);
    ctx.moveTo(x + 3, y);
    ctx.lineTo(x + 12, y);
    ctx.moveTo(x, y - 12);
    ctx.lineTo(x, y - 3);
    ctx.moveTo(x, y + 3);
    ctx.lineTo(x, y + 12);
    ctx.stroke();
    ctx.restore();
  }

  private drawMinimap(snapshot: GameStateSnapshot, localPlayerId: string | null) {
    const ctx = this.ctx;
    const mapSize = 135;
    const x = 16;
    const y = 60; // Just below top status bar

    ctx.save();

    // Map background
    ctx.fillStyle = 'rgba(8, 10, 14, 0.88)';
    ctx.fillRect(x, y, mapSize, mapSize);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, mapSize, mapSize);

    const scale = mapSize / ARENA_SIZE;

    // Obstacles on radar
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    for (const obs of snapshot.obstacles) {
      ctx.fillRect(x + obs.x * scale, y + obs.y * scale, obs.width * scale, obs.height * scale);
    }

    // Safe zone on radar
    const sz = snapshot.safeZone;
    ctx.beginPath();
    ctx.arc(x + sz.currentX * scale, y + sz.currentY * scale, sz.currentRadius * scale, 0, Math.PI * 2);
    ctx.strokeStyle = sz.isShrinking ? '#ef4444' : '#00f0ff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Players on radar
    for (const p of Object.values(snapshot.players)) {
      if (!p.isAlive) continue;
      const isLocal = p.id === localPlayerId;
      ctx.fillStyle = isLocal ? '#ffffff' : p.color;
      const dotSize = isLocal ? 4.5 : 3;
      ctx.beginPath();
      ctx.arc(x + p.x * scale, y + p.y * scale, dotSize, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
