import type { ReferenceMode } from '../../types';

const OPTIONS: { value: ReferenceMode; label: string }[] = [
  { value: 'both', label: 'Both' },
  { value: 'background', label: 'Background' },
  { value: 'text', label: 'Text' },
];

export default function ReferenceModeToggle({
  value,
  onChange,
  disabled,
}: {
  value: ReferenceMode;
  onChange: (mode: ReferenceMode) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex rounded-lg bg-surface-alt p-0.5 border border-border">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(option.value)}
          className={`flex-1 px-3 py-1 text-xs font-medium rounded-md transition-colors duration-150 disabled:cursor-not-allowed ${
            value === option.value
              ? 'bg-accent text-white shadow-sm'
              : 'text-text-secondary hover:text-text disabled:opacity-40'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
