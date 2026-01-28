import type { useGeneration } from '../../context/GenerationContext';
import GeneratingAnimation from './GeneratingAnimation';

export default function ProgressPanel({ generation }: { generation: ReturnType<typeof useGeneration> }) {
  const { cancelGeneration } = generation;

  return (
    <div className="w-full rounded-2xl border border-border bg-surface flex flex-col items-center justify-center p-6 min-h-[320px]">
      <GeneratingAnimation />
      
      <p className="mt-6 text-sm font-medium text-text">Generating...</p>
      <p className="mt-1 text-xs text-text-muted">This usually takes 30-60 seconds</p>
      
      <div className="mt-6 flex flex-col items-center gap-2">
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
