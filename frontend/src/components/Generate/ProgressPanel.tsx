import type { useGeneration } from '../../context/GenerationContext';
import StepIcon from './StepIcon';

export default function ProgressPanel({ generation }: { generation: ReturnType<typeof useGeneration> }) {
  const { step, totalSteps, stepMessage, cancelGeneration } = generation;

  const stepLabels: Record<number, string[]> = {
    2: ['Generate image prompt', 'Create base image'],
    3: ['Generate image prompt', 'Prepare style reference', 'Generate final cover'],
    4: ['Generate image prompt', 'Create base image', 'Design typography', 'Add text to cover'],
  };

  const labels = stepLabels[totalSteps] || stepLabels[4];
  const displayTotal = totalSteps || 4;

  return (
    <div className="w-full rounded-2xl border border-border bg-surface flex flex-col p-6 min-h-[320px]">
      <div className="flex-1 flex flex-col justify-center">
        <div className="space-y-3">
          {Array.from({ length: displayTotal }, (_, i) => {
            const stepNum = i + 1;
            const state: 'done' | 'active' | 'pending' =
              stepNum < step ? 'done' : stepNum === step ? 'active' : 'pending';

            return (
              <div key={stepNum} className="flex items-center gap-3">
                <StepIcon state={state} />
                <span className={`text-sm ${
                  state === 'done' ? 'text-text-secondary line-through' :
                  state === 'active' ? 'text-text font-medium' :
                  'text-text-muted'
                }`}>
                  {labels[i] || `Step ${stepNum}`}
                </span>
              </div>
            );
          })}
        </div>

        {stepMessage && (
          <p className="text-xs text-text-muted mt-4">{stepMessage}</p>
        )}
      </div>

      <div className="pt-4 flex flex-col items-center gap-2">
        <p className="text-xs text-text-muted">You can navigate away while generating.</p>
        <button
          type="button"
          onClick={cancelGeneration}
          className="text-xs text-error hover:text-error/80 font-medium transition-colors"
        >
          Cancel generation
        </button>
      </div>
    </div>
  );
}
