import type { TextBlendingMode } from '../../types';

const OPTIONS: { value: TextBlendingMode; label: string; tooltip: string }[] = [
  {
    value: 'ai_blend',
    label: 'AI Blend',
    tooltip: 'AI combines the generated base image with the extracted text layer. Most creative results.',
  },
  {
    value: 'direct_overlay',
    label: 'Direct Overlay',
    tooltip: 'Text layer is programmatically overlaid onto the base image, then cleaned up by AI. More precise text placement.',
  },
  {
    value: 'separate_reference',
    label: 'No Blend',
    tooltip: 'Sends the generated base image and text layer separately to AI. Typography is matched without blending.',
  },
];

interface BlendingModeToggleProps {
  value: TextBlendingMode;
  onChange: (mode: TextBlendingMode) => void;
  disabled?: boolean;
}

export default function BlendingModeToggle({ value, onChange, disabled }: BlendingModeToggleProps) {
  return (
    <div className={`space-y-1.5 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <span className="text-xs font-medium text-text-secondary">Text Blending</span>
      <div className="flex rounded-lg bg-surface-alt p-0.5 border border-border">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.value)}
            title={option.tooltip}
            className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors duration-150 disabled:cursor-not-allowed ${
              value === option.value
                ? 'bg-accent text-white shadow-sm'
                : 'text-text-secondary hover:text-text disabled:opacity-40'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
