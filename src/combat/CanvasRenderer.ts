/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CombatSimulation } from './CombatSimulation';
import { GameSettings, ReplayFrame } from '../types/game';
import { GAME_CONSTANTS } from '../data/balanceConfig';

export class CanvasRenderer {
  private ctx: CanvasRenderingContext2D;
  private width: number = 0;
  private height: number = 0;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  public resize(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  public render(
    sim: CombatSimulation,
    settings: GameSettings,
    aimWorldPoint?: { x: number; y: number } | null
  ) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const cam = sim.camera;

    // Clear Screen
    ctx.fillStyle = '#070709';
    ctx.fillRect(0, 0, w, h);

    ctx.save();

    // Screen Shake
    if (settings.screenShake && sim.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * sim.screenShake;
      const shakeY = (Math.random() - 0.5) * sim.screenShake;
      ctx.translate(shakeX, shakeY);
    }

    // Apply Camera translation to world coordinates
    ctx.translate(-cam.x, -cam.y);

    // 1. World Grid & Boundaries (2500x2500)
    this.drawWorldGrid(cam.x, cam.y, w, h);

    // 2. Obstacles (Geometric pillars & monoliths)
    this.drawObstacles(sim);

    // 3. Stasis Traps (Orange glowing objects that trap player)
    this.drawStasisTraps(sim);

    // 4. Allied Base Core & Enemy Sector Overcore
    this.drawCores(sim);

    // 5. Level-Up Stars (Section 4)
    this.drawLevelUpStars(sim);

    // 6. Tactical Aim Guide
    if (aimWorldPoint && sim.player.overdriveUnlocked && sim.player.overdriveCooldownRemaining <= 0) {
      this.drawAimGuide(sim.player.x, sim.player.y, aimWorldPoint.x, aimWorldPoint.y);
    }

    // 7. Shockwaves
    this.drawShockwaves(sim);

    // 8. Laser Beams
    this.drawLaserBeams(sim);

    // 9. Projectiles with Trails
    this.drawProjectiles(sim);

    // 10. Enemies (Chaser, Ranged, Heavy, Boss)
    this.drawEnemies(sim, settings);

    // 11. Moving Player Cube
    this.drawPlayer(sim, settings);

    // 12. Particles & Sparks
    this.drawParticles(sim);

    // 13. Floating Texts
    this.drawFloatingTexts(sim);

    ctx.restore();

    // 12. Screen-Space Minimap Radar (Section 8)
    this.drawMinimap(sim);
  }

  private drawWorldGrid(camX: number, camY: number, viewW: number, viewH: number) {
    const ctx = this.ctx;
    const worldW = GAME_CONSTANTS.WORLD_WIDTH;
    const worldH = GAME_CONSTANTS.WORLD_HEIGHT;

    // Arena perimeter glow
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 10;
    ctx.strokeRect(0, 0, worldW, worldH);
    ctx.shadowBlur = 0;

    // Subtle grid lines visible within viewport
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    const step = 60;

    const startX = Math.max(0, Math.floor(camX / step) * step);
    const endX = Math.min(worldW, Math.ceil((camX + viewW) / step) * step);
    const startY = Math.max(0, Math.floor(camY / step) * step);
    const endY = Math.min(worldH, Math.ceil((camY + viewH) / step) * step);

    for (let x = startX; x <= endX; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
      ctx.stroke();
    }
    for (let y = startY; y <= endY; y += step) {
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
      ctx.stroke();
    }
  }

  private drawObstacles(sim: CombatSimulation) {
    const ctx = this.ctx;
    const player = sim.player;

    for (const obs of sim.obstacles) {
      ctx.save();

      // 1. Drop shadow for physical depth & bunker elevation
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(obs.x + 4, obs.y + 6, obs.width, obs.height);

      // 2. Base bunker armor fill
      ctx.fillStyle = '#0f1118';
      ctx.fillRect(obs.x, obs.y, obs.width, obs.height);

      // 3. Hit deflection flash ripple if struck
      const flash = obs.hitFlash || 0;
      if (flash > 0) {
        const flashAlpha = Math.min(1, flash * 2.5);
        ctx.fillStyle = `rgba(56, 189, 248, ${flashAlpha * 0.35})`;
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);

        // Glowing outer deflection shock
        ctx.strokeStyle = `rgba(255, 255, 255, ${flashAlpha})`;
        ctx.lineWidth = 3;
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 16 * flashAlpha;
        ctx.strokeRect(obs.x - 2, obs.y - 2, obs.width + 4, obs.height + 4);
      }

      // Check proximity to player for cover status visual feedback
      const nearX = Math.max(obs.x, Math.min(player.x, obs.x + obs.width));
      const nearY = Math.max(obs.y, Math.min(player.y, obs.y + obs.height));
      const distToPlayer = Math.hypot(player.x - nearX, player.y - nearY);
      const isPlayerCoverObstacle = distToPlayer < 70 && player.isInCover;

      // 4. Perimeter border
      ctx.lineWidth = 2;
      if (isPlayerCoverObstacle) {
        ctx.strokeStyle = '#38bdf8';
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 8;
      } else {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.shadowBlur = 0;
      }
      ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);

      // 5. Architectural detailing based on obstacle type
      ctx.lineWidth = 1;
      if (obs.type === 'bunker' || obs.type === 'monolith') {
        // Reinforced armor plates and corner brackets
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.strokeRect(obs.x + 6, obs.y + 6, obs.width - 12, obs.height - 12);

        // Tech vent slots in center
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        const ventW = Math.min(obs.width - 24, 40);
        const ventH = Math.min(obs.height - 24, 20);
        if (ventW > 10 && ventH > 6) {
          ctx.fillRect(obs.x + (obs.width - ventW) / 2, obs.y + (obs.height - ventH) / 2, ventW, ventH);
        }
      } else if (obs.type === 'pillar') {
        // Octagonal / corner bolt rivets
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        const rSize = 3;
        ctx.fillRect(obs.x + 3, obs.y + 3, rSize, rSize);
        ctx.fillRect(obs.x + obs.width - 3 - rSize, obs.y + 3, rSize, rSize);
        ctx.fillRect(obs.x + 3, obs.y + obs.height - 3 - rSize, rSize, rSize);
        ctx.fillRect(obs.x + obs.width - 3 - rSize, obs.y + obs.height - 3 - rSize, rSize, rSize);

        // Diamond center emblem
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.beginPath();
        const midX = obs.x + obs.width / 2;
        const midY = obs.y + obs.height / 2;
        const dSize = Math.min(obs.width, obs.height) * 0.3;
        ctx.moveTo(midX, midY - dSize);
        ctx.lineTo(midX + dSize, midY);
        ctx.lineTo(midX, midY + dSize);
        ctx.lineTo(midX - dSize, midY);
        ctx.closePath();
        ctx.stroke();
      } else {
        // Barrier / Trench: Segmented blast seams & hazard crosshatch
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.beginPath();
        ctx.moveTo(obs.x, obs.y);
        ctx.lineTo(obs.x + obs.width, obs.y + obs.height);
        ctx.moveTo(obs.x + obs.width, obs.y);
        ctx.lineTo(obs.x, obs.y + obs.height);
        ctx.stroke();

        // Hazard stripes on longer axis
        if (obs.width > obs.height * 1.5) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
          const segCount = Math.floor(obs.width / 24);
          for (let s = 1; s < segCount; s++) {
            const sx = obs.x + s * 24;
            ctx.beginPath();
            ctx.moveTo(sx, obs.y);
            ctx.lineTo(sx, obs.y + obs.height);
            ctx.stroke();
          }
        }
      }

      ctx.restore();
    }
  }

  // Draw Orange Glowing Objects that trap the player on contact
  private drawStasisTraps(sim: CombatSimulation) {
    const ctx = this.ctx;
    for (const trap of sim.stasisTraps) {
      ctx.save();
      ctx.translate(trap.x, trap.y);

      const pulse = (Math.sin(trap.pulsePhase) + 1) / 2;
      const isTrapping = sim.player.isTrapped && sim.player.trappedInsideId === trap.id;

      // Outer glowing field
      ctx.strokeStyle = '#f97316';
      ctx.shadowColor = '#f97316';
      ctx.shadowBlur = isTrapping ? 25 : 12 + pulse * 6;
      ctx.lineWidth = isTrapping ? 3.5 : 2;

      // Outer hazard ring
      ctx.beginPath();
      ctx.arc(0, 0, trap.radius + pulse * 3, 0, Math.PI * 2);
      ctx.stroke();

      // Rotating inner stasis ring
      ctx.rotate(trap.pulsePhase * 0.7);
      ctx.strokeStyle = 'rgba(251, 146, 60, 0.7)';
      ctx.setLineDash([6, 5]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, trap.radius * 0.65, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Center glowing orange core
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.arc(0, 0, 5 + pulse * 2, 0, Math.PI * 2);
      ctx.fill();

      // Overhead tag if trapping player
      if (isTrapping) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('STASIS ACTIVE', 0, -trap.radius - 8);
      }

      ctx.restore();
    }
  }

  // Draw Allied Base Core and Enemy Sector Overcore
  private drawCores(sim: CombatSimulation) {
    const ctx = this.ctx;

    // 1. Allied Base Core
    if (!sim.alliedCore.isDead) {
      const ac = sim.alliedCore;
      ctx.save();
      ctx.translate(ac.x, ac.y);

      // Base footprint shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.beginPath();
      ctx.arc(4, 6, ac.size / 2, 0, Math.PI * 2);
      ctx.fill();

      // Fortified Hex base fill
      ctx.fillStyle = '#0a101d';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        const rad = ac.size / 2;
        const hx = Math.cos(ang) * rad;
        const hy = Math.sin(ang) * rad;
        if (i === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Inner reactor core
      const pulse = (Math.sin(Date.now() / 180) + 1) / 2;
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 15 + pulse * 8;
      ctx.beginPath();
      ctx.arc(0, 0, 10 + pulse * 3, 0, Math.PI * 2);
      ctx.fill();

      // Defensive Turrets
      ctx.shadowBlur = 0;
      for (const t of ac.turrets) {
        ctx.save();
        ctx.translate(t.x - ac.x, t.y - ac.y);
        ctx.rotate(t.angle);
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-8, -8, 16, 16);
        ctx.fillRect(-8, -8, 16, 16);
        // Barrel
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(8, -2.5, 9, 5);
        ctx.restore();
      }

      // Overhead Health & Shield Bar
      const barW = ac.size + 20;
      const barH = 5;
      const barY = -ac.size / 2 - 14;

      // Background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(-barW / 2, barY, barW, barH);

      // Health
      const hpPct = Math.max(0, ac.health / ac.maxHealth);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-barW / 2, barY, barW * hpPct, barH);

      // Shield bar above health
      if (ac.shield > 0) {
        const shPct = Math.max(0, ac.shield / ac.maxShield);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(-barW / 2, barY - 4, barW * shPct, 3);
      }

      // Name Label
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('ALLIED BASE CORE', 0, barY - 8);

      ctx.restore();
    }

    // 2. Enemy Sector Overcore (Main Objective)
    if (!sim.enemyCore.isDead) {
      const ec = sim.enemyCore;
      ctx.save();
      ctx.translate(ec.x, ec.y);

      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.beginPath();
      ctx.arc(6, 8, ec.size / 2, 0, Math.PI * 2);
      ctx.fill();

      // Fortified Octagon Citadel fill
      ctx.fillStyle = '#1a080c';
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        const rad = ec.size / 2;
        const ox = Math.cos(ang) * rad;
        const oy = Math.sin(ang) * rad;
        if (i === 0) ctx.moveTo(ox, oy);
        else ctx.lineTo(ox, oy);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Pulsing Ruby Overcore Reactor
      const ecPulse = (Math.sin(Date.now() / 150) + 1) / 2;
      ctx.fillStyle = '#ef4444';
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 20 + ecPulse * 10;
      ctx.beginPath();
      ctx.arc(0, 0, 16 + ecPulse * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();

      // Rotating Orbital Energy Shields (Deflects lasers!)
      ctx.shadowBlur = 0;
      for (const s of ec.defensiveShields) {
        if (s.health > 0) {
          ctx.save();
          const startAng = s.angle + ec.shieldAngle - s.arcLength / 2;
          const endAng = s.angle + ec.shieldAngle + s.arcLength / 2;
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 5;
          ctx.shadowColor = '#38bdf8';
          ctx.shadowBlur = 14;
          ctx.beginPath();
          ctx.arc(0, 0, ec.size * 0.72, startAng, endAng);
          ctx.stroke();
          ctx.restore();
        }
      }

      // Automated Perimeter Defense Turrets
      for (const turret of ec.turrets) {
        ctx.save();
        ctx.translate(turret.x - ec.x, turret.y - ec.y);
        ctx.rotate(turret.angle);
        ctx.fillStyle = '#1f1315';
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-9, -9, 18, 18);
        ctx.fillRect(-9, -9, 18, 18);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(9, -3, 10, 6);
        ctx.restore();
      }

      // Boss Health Bar above Overcore
      const barW = ec.size + 40;
      const barH = 7;
      const barY = -ec.size / 2 - 20;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillRect(-barW / 2, barY, barW, barH);
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(-barW / 2, barY, barW, barH);

      const hpPct = Math.max(0, ec.health / ec.maxHealth);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-barW / 2, barY, barW * hpPct, barH);

      // Overcore Label
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`ENEMY OVERCORE [HP: ${Math.round(ec.health)}]`, 0, barY - 6);

      ctx.restore();
    }
  }

  private drawLevelUpStars(sim: CombatSimulation) {
    const ctx = this.ctx;
    for (const star of sim.stars) {
      ctx.save();
      ctx.translate(star.x, star.y);
      ctx.rotate(star.rotation);

      // Pulsing outer aura
      const pulse = (Math.sin(Date.now() / 200) + 1) / 2;
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 14 + pulse * 8;

      // 4-point star shape
      const s = star.size + pulse * 3;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.3, -s * 0.3);
      ctx.lineTo(s, 0);
      ctx.lineTo(s * 0.3, s * 0.3);
      ctx.lineTo(0, s);
      ctx.lineTo(-s * 0.3, s * 0.3);
      ctx.lineTo(-s, 0);
      ctx.lineTo(-s * 0.3, -s * 0.3);
      ctx.closePath();
      ctx.stroke();

      // Glowing white center
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-s * 0.25, -s * 0.25, s * 0.5, s * 0.5);

      ctx.restore();
    }
  }

  private drawAimGuide(fromX: number, fromY: number, toX: number, toY: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.setLineDash([5, 6]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(toX, toY, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(toX, toY, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();
  }

  private drawShockwaves(sim: CombatSimulation) {
    const ctx = this.ctx;
    for (const sw of sim.shockwaves) {
      ctx.save();
      ctx.strokeStyle = `rgba(255, 255, 255, ${sw.alpha * 0.9})`;
      ctx.lineWidth = 3;
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawLaserBeams(sim: CombatSimulation) {
    const ctx = this.ctx;
    for (const b of sim.laserBeams) {
      ctx.save();
      // Outer glow
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
      ctx.lineWidth = b.width * 2.2;
      ctx.beginPath();
      ctx.moveTo(b.startX, b.startY);
      ctx.lineTo(b.endX, b.endY);
      ctx.stroke();

      // Inner intense core
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = b.width;
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 24;
      ctx.beginPath();
      ctx.moveTo(b.startX, b.startY);
      ctx.lineTo(b.endX, b.endY);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(b.endX, b.endY, b.width * 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawProjectiles(sim: CombatSimulation) {
    const ctx = this.ctx;
    for (const p of sim.projectiles) {
      ctx.save();

      // Trails
      for (const t of p.trail) {
        if (t.alpha <= 0) continue;
        ctx.fillStyle = p.source === 'player'
          ? `rgba(255, 255, 255, ${t.alpha * 0.35})`
          : `rgba(239, 68, 68, ${t.alpha * 0.35})`;
        ctx.beginPath();
        ctx.arc(t.x, t.y, p.radius * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = p.source === 'player' ? '#ffffff' : '#ef4444';
      ctx.shadowColor = p.source === 'player' ? '#ffffff' : '#ef4444';
      ctx.shadowBlur = p.isPiercing ? 14 : 8;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawEnemies(sim: CombatSimulation, settings: GameSettings) {
    const ctx = this.ctx;
    for (const e of sim.enemies) {
      ctx.save();
      ctx.translate(e.x, e.y);

      const half = e.size / 2;

      // Color override if colorblind mode
      let enemyColor = e.color;
      if (settings.colorblindMode && e.type === 'ranged') {
        enemyColor = '#38bdf8';
      }

      ctx.strokeStyle = enemyColor;
      ctx.lineWidth = e.isBoss ? 3.5 : 2;
      ctx.shadowColor = enemyColor;
      ctx.shadowBlur = e.isBoss ? 16 : 8;

      if (e.isBoss) {
        // Sector Boss: Heavy Dreadnought Warship
        ctx.fillStyle = '#1c0715';
        ctx.fillRect(-half, -half, e.size, e.size);
        ctx.strokeRect(-half, -half, e.size, e.size);
        ctx.strokeRect(-half + 5, -half + 5, e.size - 10, e.size - 10);

        // Quad corner gun turrets
        ctx.fillStyle = '#ec4899';
        ctx.fillRect(-half - 3, -half - 3, 7, 7);
        ctx.fillRect(half - 4, -half - 3, 7, 7);
        ctx.fillRect(-half - 3, half - 4, 7, 7);
        ctx.fillRect(half - 4, half - 4, 7, 7);

        // Glowing core
        const bPulse = (Math.sin(Date.now() / 120) + 1) / 2;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-6, -6, 12, 12);
        ctx.strokeStyle = '#ec4899';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-10 - bPulse * 3, -10 - bPulse * 3, 20 + bPulse * 6, 20 + bPulse * 6);
      } else if (e.type === 'heavy') {
        // Heavy cube has double outer border
        ctx.strokeRect(-half, -half, e.size, e.size);
        ctx.strokeRect(-half + 4, -half + 4, e.size - 8, e.size - 8);
        ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';
        ctx.fillRect(-half, -half, e.size, e.size);
      } else if (e.type === 'ranged') {
        // Ranged cube has diamond orientation
        ctx.rotate(Math.PI / 4);
        ctx.strokeRect(-half * 0.7, -half * 0.7, e.size * 0.7, e.size * 0.7);
        ctx.fillStyle = enemyColor;
        ctx.fillRect(-3, -3, 6, 6);
      } else {
        // Chaser cube
        ctx.strokeRect(-half, -half, e.size, e.size);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-half / 3, -half / 3, e.size / 3, e.size / 3);
      }

      // If Enemy Stole a Star: Empowered Visuals!
      if (e.isEmpowered) {
        ctx.save();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(0, 0, e.size * 0.75, 0, Math.PI * 2);
        ctx.stroke();

        // Star indicator above
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('★ EMPOWERED', 0, -half - 14);
        ctx.restore();
      }

      // Overhead Health Bar
      const hpRatio = Math.max(0, e.health / e.maxHealth);
      const barW = e.isBoss ? e.size + 20 : e.size;
      const barH = e.isBoss ? 5 : 3;
      const barY = -half - (e.isBoss ? 16 : 8);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.fillRect(-barW / 2, barY, barW, barH);
      ctx.fillStyle = enemyColor;
      ctx.fillRect(-barW / 2, barY, barW * hpRatio, barH);

      // Boss Name label
      if (e.isBoss && e.bossName) {
        ctx.fillStyle = '#ec4899';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(e.bossName, 0, barY - 4);
      }

      ctx.restore();
    }
  }

  private drawPlayer(sim: CombatSimulation, settings: GameSettings) {
    const ctx = this.ctx;
    const p = sim.player;
    ctx.save();
    ctx.translate(p.x, p.y);

    const half = p.size / 2;
    const isCritical = p.health / p.maxHealth <= 0.25;

    // Pulse Shield Ability Aura
    if (p.shieldActive) {
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(0, 0, p.size * 0.95, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Dedicated Shield Layer (Absorbs damage first!)
    if (p.shield > 0) {
      ctx.save();
      const shieldRatio = p.shield / p.maxShield;
      ctx.strokeStyle = `rgba(56, 189, 248, ${0.4 + shieldRatio * 0.6})`;
      ctx.lineWidth = 2;
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 8 + shieldRatio * 6;
      ctx.strokeRect(-half - 3, -half - 3, p.size + 6, p.size + 6);
      ctx.restore();
    }

    // Critical Hazard Cue (Section 26)
    if (isCritical && !p.isDead) {
      ctx.save();
      const pulse = (Math.sin(Date.now() / 140) + 1) / 2;
      ctx.strokeStyle = settings.colorblindMode ? '#f59e0b' : '#ef4444';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        -half - 6 - pulse * 4,
        -half - 6 - pulse * 4,
        p.size + 12 + pulse * 8,
        p.size + 12 + pulse * 8
      );
      ctx.restore();
    }

    // Trapped in Orange Stasis Field
    if (p.isTrapped) {
      ctx.save();
      const tPulse = (Math.sin(Date.now() / 90) + 1) / 2;
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#f97316';
      ctx.shadowBlur = 18 + tPulse * 8;
      ctx.beginPath();
      ctx.arc(0, 0, p.size * 1.3, 0, Math.PI * 2);
      ctx.stroke();

      ctx.setLineDash([7, 5]);
      ctx.beginPath();
      ctx.arc(0, 0, p.size * 1.55, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Player Cube Body
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 10;
    ctx.strokeRect(-half, -half, p.size, p.size);

    // Inner glowing core
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-half / 2, -half / 2, half, half);

    // Weapon Level Ring Indicator (Section 4)
    if (p.bulletsPerShot > 1) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, p.size * 0.75, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Tactical In-Cover Indicator (Cover Defense Buff)
    if (p.isInCover && !p.isDead) {
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 10;
      const bSize = 6;
      const offset = half + 6;

      // Top-Left bracket
      ctx.beginPath();
      ctx.moveTo(-offset, -offset + bSize);
      ctx.lineTo(-offset, -offset);
      ctx.lineTo(-offset + bSize, -offset);

      // Top-Right bracket
      ctx.moveTo(offset - bSize, -offset);
      ctx.lineTo(offset, -offset);
      ctx.lineTo(offset, -offset + bSize);

      // Bottom-Left bracket
      ctx.moveTo(-offset, offset - bSize);
      ctx.lineTo(-offset, offset);
      ctx.lineTo(-offset + bSize, offset);

      // Bottom-Right bracket
      ctx.moveTo(offset - bSize, offset);
      ctx.lineTo(offset, offset);
      ctx.lineTo(offset, offset - bSize);
      ctx.stroke();

      // "IN COVER" callout text
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('IN COVER', 0, -offset - 4);
      ctx.restore();
    }

    ctx.restore();
  }

  private drawParticles(sim: CombatSimulation) {
    const ctx = this.ctx;
    for (const p of sim.particles) {
      ctx.save();
      const alpha = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, alpha);

      if (p.shape === 'square') {
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private drawFloatingTexts(sim: CombatSimulation) {
    const ctx = this.ctx;
    for (const t of sim.floatingTexts) {
      ctx.save();
      const alpha = Math.max(0, t.life / t.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = t.color;
      ctx.font = t.isCrit ? 'bold 15px "Space Mono", monospace' : '13px "Space Mono", monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 4;
      ctx.fillText(t.text, t.x, t.y);
      ctx.restore();
    }
  }

  /**
   * Screen-Space Minimap Radar (Section 8)
   */
  private drawMinimap(sim: CombatSimulation) {
    const ctx = this.ctx;
    const mapSize = 100;
    const margin = 12;
    const x = this.width - mapSize - margin;
    const y = 56; // Below top bar

    ctx.save();
    // Background
    ctx.fillStyle = 'rgba(7, 7, 10, 0.9)';
    ctx.fillRect(x, y, mapSize, mapSize);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, mapSize, mapSize);

    const scale = mapSize / GAME_CONSTANTS.WORLD_WIDTH;

    // Draw Obstacles on radar
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    for (const obs of sim.obstacles) {
      ctx.fillRect(x + obs.x * scale, y + obs.y * scale, obs.width * scale, obs.height * scale);
    }

    // Draw Stasis Traps on radar (Orange)
    ctx.fillStyle = '#f97316';
    for (const st of sim.stasisTraps) {
      ctx.fillRect(x + st.x * scale - 1, y + st.y * scale - 1, 2.5, 2.5);
    }

    // Draw Stars on radar
    ctx.fillStyle = '#38bdf8';
    for (const s of sim.stars) {
      ctx.fillRect(x + s.x * scale - 1.5, y + s.y * scale - 1.5, 3, 3);
    }

    // Draw Allied Base Core (Cyan)
    if (!sim.alliedCore.isDead) {
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(x + sim.alliedCore.x * scale - 3, y + sim.alliedCore.y * scale - 3, 6, 6);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + sim.alliedCore.x * scale - 3, y + sim.alliedCore.y * scale - 3, 6, 6);
    }

    // Draw Enemy Overcore (Red)
    if (!sim.enemyCore.isDead) {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(x + sim.enemyCore.x * scale - 4, y + sim.enemyCore.y * scale - 4, 8, 8);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + sim.enemyCore.x * scale - 4, y + sim.enemyCore.y * scale - 4, 8, 8);
    }

    // Draw Enemies on radar
    for (const e of sim.enemies) {
      ctx.fillStyle = e.isBoss ? '#ec4899' : (e.isEmpowered ? '#38bdf8' : '#ef4444');
      const size = e.isBoss ? 4 : 2;
      ctx.fillRect(x + e.x * scale - size / 2, y + e.y * scale - size / 2, size, size);
    }

    // Draw Player on radar
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + sim.player.x * scale - 2, y + sim.player.y * scale - 2, 4, 4);

    // Directional Compass Arrow to Enemy Overcore
    if (!sim.enemyCore.isDead && !sim.player.isDead) {
      const dx = sim.enemyCore.x - sim.player.x;
      const dy = sim.enemyCore.y - sim.player.y;
      const dist = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);

      ctx.save();
      ctx.translate(x + mapSize / 2, y + mapSize + 14);
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(dist)}m TO OVERCORE`, 0, 0);

      // Mini arrow
      ctx.rotate(angle);
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(-4, -4);
      ctx.lineTo(-2, 0);
      ctx.lineTo(-4, 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * Section 22: Kill-Cam replay playback
   */
  public renderReplayFrame(frame: ReplayFrame, settings: GameSettings, playbackProgress: number) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.save();
    ctx.fillStyle = '#050507';
    ctx.fillRect(0, 0, w, h);

    // Vignette
    const grad = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.7);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.85)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Slow-mo tracking bar
    const barY = (playbackProgress * h * 2) % h;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(0, barY - 15, w, 30);

    ctx.restore();
  }
}
