/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GAME_CONSTANTS, getUpgradeCost } from '../data/balanceConfig';
import { CoreState, Difficulty, UpgradeType } from '../types/game';

export class OpponentAI {
  private difficulty: Difficulty;
  private lastEvaluationTime: number = 0;
  private evaluationInterval: number;

  constructor(difficulty: Difficulty) {
    this.difficulty = difficulty;
    switch (difficulty) {
      case 'easy':
        this.evaluationInterval = 1.4;
        break;
      case 'normal':
        this.evaluationInterval = 0.8;
        break;
      case 'hard':
        this.evaluationInterval = 0.45;
        break;
    }
  }

  public setDifficulty(diff: Difficulty) {
    this.difficulty = diff;
    if (diff === 'easy') this.evaluationInterval = 1.4;
    else if (diff === 'normal') this.evaluationInterval = 0.8;
    else this.evaluationInterval = 0.45;
  }

  /**
   * Evaluates AI choices and returns decisions for upgrades or special abilities.
   */
  public update(
    matchTime: number,
    aiCore: CoreState,
    playerCore: CoreState
  ): {
    buyUpgrade?: UpgradeType;
    triggerAbility?: 'overdrive_beam' | 'pulse_shield' | 'energy_pulse';
  } {
    if (aiCore.isDead || playerCore.isDead) return {};

    // Don't act too frequently
    if (matchTime - this.lastEvaluationTime < this.evaluationInterval) {
      return {};
    }
    this.lastEvaluationTime = matchTime;

    // 1. Evaluate Defensive Reflexes (Pulse Shield)
    if (
      aiCore.shieldCooldownRemaining <= 0 &&
      aiCore.energy >= GAME_CONSTANTS.ABILITIES.PULSE_SHIELD.cost
    ) {
      // Hard AI shields when receiving heavy damage or player has high damage
      if (this.difficulty === 'hard') {
        if (aiCore.health < 65 || playerCore.upgradesPurchased.damage >= 3) {
          return { triggerAbility: 'pulse_shield' };
        }
      } else if (this.difficulty === 'normal') {
        if (aiCore.health < 45) {
          return { triggerAbility: 'pulse_shield' };
        }
      } else {
        // Easy AI rarely shields
        if (aiCore.health < 25 && Math.random() < 0.35) {
          return { triggerAbility: 'pulse_shield' };
        }
      }
    }

    // 2. Evaluate Offensive Tactical Abilities
    // Energy Pulse (disrupts player)
    if (
      aiCore.pulseCooldownRemaining <= 0 &&
      aiCore.energy >= GAME_CONSTANTS.ABILITIES.ENERGY_PULSE.cost
    ) {
      if (this.difficulty === 'hard') {
        // Use energy pulse if player has high fire rate or no shield active
        if (playerCore.upgradesPurchased.fire_rate >= 2 || Math.random() < 0.6) {
          return { triggerAbility: 'energy_pulse' };
        }
      } else if (this.difficulty === 'normal') {
        if (Math.random() < 0.5) {
          return { triggerAbility: 'energy_pulse' };
        }
      } else {
        if (Math.random() < 0.25) {
          return { triggerAbility: 'energy_pulse' };
        }
      }
    }

    // Overdrive Beam (Heavy manual laser)
    if (
      aiCore.overdriveUnlocked &&
      aiCore.overdriveCooldownRemaining <= 0 &&
      aiCore.energy >= GAME_CONSTANTS.ABILITIES.OVERDRIVE_BEAM.cost
    ) {
      // Don't waste beam if player has an active shield
      if (!playerCore.shieldActive || this.difficulty === 'easy') {
        return { triggerAbility: 'overdrive_beam' };
      }
    }

    // 3. Evaluate Upgrade Purchases
    const currentEnergy = aiCore.energy;

    // Hard AI strategic purchase priorities
    if (this.difficulty === 'hard') {
      // Counter player's damage stacking with armor
      const armorCost = getUpgradeCost('armor', aiCore.armorLevel);
      if (playerCore.upgradesPurchased.damage >= 2 && aiCore.armorLevel < 4 && currentEnergy >= armorCost) {
        return { buyUpgrade: 'armor' };
      }

      // Unlock overdrive if affordable
      if (!aiCore.overdriveUnlocked) {
        const odCost = getUpgradeCost('overdrive', 0);
        if (currentEnergy >= odCost) {
          return { buyUpgrade: 'overdrive' };
        }
      }

      // Early generator investment for economy
      if (aiCore.generatorLevel < 3) {
        const genCost = getUpgradeCost('generator', aiCore.generatorLevel);
        if (currentEnergy >= genCost) {
          return { buyUpgrade: 'generator' };
        }
      }

      // Pierce if player has armor or shield
      if (playerCore.armorLevel >= 2 && aiCore.piercingLevel < 2) {
        const pierceCost = getUpgradeCost('piercing', aiCore.piercingLevel);
        if (currentEnergy >= pierceCost) {
          return { buyUpgrade: 'piercing' };
        }
      }

      // Alternate damage and fire rate
      const dmgCost = getUpgradeCost('damage', aiCore.upgradesPurchased.damage);
      const frCost = getUpgradeCost('fire_rate', aiCore.upgradesPurchased.fire_rate);

      if (aiCore.upgradesPurchased.damage <= aiCore.upgradesPurchased.fire_rate && currentEnergy >= dmgCost) {
        return { buyUpgrade: 'damage' };
      } else if (currentEnergy >= frCost) {
        return { buyUpgrade: 'fire_rate' };
      }
    } else if (this.difficulty === 'normal') {
      // Normal AI balances damage, fire rate, and unlocks
      if (!aiCore.overdriveUnlocked && currentEnergy >= 120 && Math.random() < 0.6) {
        return { buyUpgrade: 'overdrive' };
      }

      const choices: UpgradeType[] = ['damage', 'fire_rate', 'armor', 'generator'];
      const pick = choices[Math.floor(Math.random() * choices.length)];
      const cost = getUpgradeCost(pick, aiCore.upgradesPurchased[pick]);

      if (currentEnergy >= cost) {
        return { buyUpgrade: pick };
      }
    } else {
      // Easy AI focuses mostly on basic damage or fire rate and rarely upgrades armor
      const choices: UpgradeType[] = ['damage', 'fire_rate'];
      const pick = choices[Math.floor(Math.random() * choices.length)];
      const cost = getUpgradeCost(pick, aiCore.upgradesPurchased[pick]);

      if (currentEnergy >= cost && Math.random() < 0.65) {
        return { buyUpgrade: pick };
      }
    }

    return {};
  }
}
