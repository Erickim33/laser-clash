/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { settingsStore } from '../utils/settingsStore';

export type TutorialStep = 
  | 'step1_core'      // 0-15s: highlight health & energy bars
  | 'step2_upgrade'   // highlight Damage upgrade, wait for purchase
  | 'step3_overdrive' // highlight Overdrive Beam button, wait for fire
  | 'step4_complete'  // Tutorial complete toast
  | 'inactive';

type TutorialListener = (step: TutorialStep, caption: string) => void;

export class TutorialController {
  private active: boolean = false;
  private currentStep: TutorialStep = 'inactive';
  private listeners: Set<TutorialListener> = new Set();
  private elapsedSeconds: number = 0;
  private hasPurchasedFirstUpgrade: boolean = false;
  private hasFiredOverdrive: boolean = false;

  constructor() {
    this.active = false;
  }

  public isActive(): boolean {
    return this.active;
  }

  public getStep(): TutorialStep {
    return this.currentStep;
  }

  public start() {
    if (!this.active) return;
    this.setStep('step1_core', 'This is your core. Keep it above zero.');
  }

  public update(deltaSeconds: number, playerEnergy: number) {
    if (!this.active) return;
    this.elapsedSeconds += deltaSeconds;

    // Transition from Step 1 to Step 2
    if (this.currentStep === 'step1_core') {
      if (this.elapsedSeconds >= 12 || playerEnergy >= 50) {
        this.setStep('step2_upgrade', 'Tap Laser Damage [1] to boost your automatic firepower.');
      }
    } else if (this.currentStep === 'step2_upgrade') {
      if (this.hasPurchasedFirstUpgrade) {
        this.setStep('step3_overdrive', 'Activate Overdrive Beam to fire a concentrated laser burst.');
      }
    } else if (this.currentStep === 'step3_overdrive') {
      if (this.hasFiredOverdrive) {
        this.completeTutorial();
      }
    }
  }

  public onUpgradePurchased() {
    if (!this.active) return;
    if (this.currentStep === 'step2_upgrade') {
      this.hasPurchasedFirstUpgrade = true;
      this.setStep('step3_overdrive', 'Activate Overdrive Beam to fire a concentrated laser burst.');
    }
  }

  public onAbilityActivated(abilityId: string) {
    if (!this.active) return;
    if (abilityId === 'overdrive_beam' && (this.currentStep === 'step3_overdrive' || this.currentStep === 'step2_upgrade')) {
      this.hasFiredOverdrive = true;
      this.completeTutorial();
    }
  }

  public skipTutorial() {
    this.active = false;
    this.currentStep = 'inactive';
    settingsStore.updateSettings({ hasCompletedTutorial: true });
    this.notify();
  }

  private completeTutorial() {
    this.setStep('step4_complete', 'Tutorial complete! Destroy the opposing core.');
    settingsStore.updateSettings({ hasCompletedTutorial: true });
    setTimeout(() => {
      this.active = false;
      this.currentStep = 'inactive';
      this.notify();
    }, 3500);
  }

  private setStep(step: TutorialStep, caption: string) {
    this.currentStep = step;
    this.notify(caption);
  }

  private notify(caption: string = '') {
    this.listeners.forEach((l) => l(this.currentStep, caption));
  }

  public subscribe(listener: TutorialListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
