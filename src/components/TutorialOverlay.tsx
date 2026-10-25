/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Sparkles, X, ChevronRight, CheckCircle2 } from 'lucide-react';
import { TutorialController, TutorialStep } from '../tutorial/TutorialController';

interface TutorialOverlayProps {
  controller: TutorialController;
}

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({ controller }) => {
  const [step, setStep] = useState<TutorialStep>(controller.getStep());
  const [caption, setCaption] = useState<string>('This is your core. Keep it above zero.');

  useEffect(() => {
    const unsub = controller.subscribe((newStep, newCaption) => {
      setStep(newStep);
      if (newCaption) setCaption(newCaption);
    });
    return unsub;
  }, [controller]);

  if (!controller.isActive() || step === 'inactive') return null;

  const isComplete = step === 'step4_complete';

  return (
    <div className="absolute inset-0 z-20 pointer-events-none flex flex-col justify-between p-4">
      {/* Top Banner with Step tracker & Skip button */}
      <div className="flex items-center justify-between pointer-events-auto bg-black/90 border border-white/20 p-2.5 shadow-xl font-mono-numbers text-xs">
        <div className="flex items-center gap-2">
          {isComplete ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <Sparkles className="w-4 h-4 text-[#38bdf8] animate-spin" />
          )}
          <span className="font-bold text-white uppercase tracking-wider">
            {isComplete ? 'Mission Ready' : 'Combat Primer'}
          </span>
          <span className="text-white/40">·</span>
          <span className="text-white/70">
            {step === 'step1_core' && 'Step 1/3: Core Vitality'}
            {step === 'step2_upgrade' && 'Step 2/3: Upgrade System'}
            {step === 'step3_overdrive' && 'Step 3/3: Special Ability'}
            {isComplete && 'Complete'}
          </span>
        </div>

        {!isComplete && (
          <button
            onClick={() => controller.skipTutorial()}
            className="flex items-center gap-1 text-[11px] text-white/50 hover:text-white px-2 py-1 border border-white/10 hover:border-white/30 transition-colors"
          >
            <span>Skip Primer</span>
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Contextual Spotlight Callout Box */}
      <div className="pointer-events-auto mx-auto max-w-md w-full mb-28">
        <div className={`p-4 border backdrop-blur-md transition-all shadow-2xl font-mono-numbers text-xs ${
          isComplete
            ? 'bg-emerald-950/80 border-emerald-500/50 text-white'
            : 'bg-black/95 border-white/40 text-white'
        }`}>
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 bg-white mt-1 shrink-0 animate-ping" />
            <div className="flex-1">
              <p className="text-xs md:text-sm font-medium leading-relaxed">
                {caption}
              </p>
              {!isComplete && (
                <div className="mt-2 text-[10px] text-white/50 flex items-center gap-1">
                  <span>AI opponent set to Easy training parameters</span>
                  <ChevronRight className="w-3 h-3" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
