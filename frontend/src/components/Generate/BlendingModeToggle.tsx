import type { TextBlendingMode } from '../../types';

interface BlendingModeToggleProps {
  value: TextBlendingMode;
  onChange: (mode: TextBlendingMode) => void;
  disabled?: boolean;
}

export default function BlendingModeToggle({ value, onChange, disabled }: BlendingModeToggleProps) {
  return (
    <div className={`space-y-2 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-text-secondary">Text Blending</span>
      </div>
      <div className="flex bg-surface-alt border border-border rounded-lg p-0.5">
        <button
          type="button"
          onClick={() => onChange('ai')}
          className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            value === 'ai'
              ? 'bg-surface text-text shadow-sm'
              : 'text-text-muted hover:text-text'
          }`}
        >
          AI Blending
        </button>
        <button
          type="button"
          onClick={() => onChange('programmatic')}
          className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            value === 'programmatic'
              ? 'bg-surface text-text shadow-sm'
              : 'text-text-muted hover:text-text'
          }`}
        >
          Direct Overlay
        </button>
      </div>
      <p className="text-[10px] text-text-muted">
        {value === 'ai' 
          ? 'AI generates text matching the reference style (more creative, less precise)'
          : 'Text layer is overlaid directly onto base image, then cleaned up by AI (more precise)'
        }
      </p>
    </div>
  );
}
