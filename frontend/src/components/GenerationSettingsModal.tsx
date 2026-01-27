import { useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { Generation } from '../types';

interface Props {
  generation: Generation;
  onClose: () => void;
  onUseSettings: (generation: Generation) => void;
}

export default function GenerationSettingsModal({ generation, onClose, onUseSettings }: Props) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const hasStyleAnalysis = generation.style_analysis &&
    (generation.style_analysis.feeling || generation.style_analysis.layout ||
     generation.style_analysis.illustration_rules || generation.style_analysis.typography);

  const aspectLabel = generation.aspect_ratio_info
    ? `${generation.aspect_ratio} (${generation.aspect_ratio_info.name})`
    : generation.aspect_ratio;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto bg-surface border border-border rounded-2xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-surface border-b border-border rounded-t-2xl">
          <h2 className="text-lg font-heading font-semibold text-text">Generation Settings</h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-surface-alt rounded-lg transition-colors cursor-pointer"
          >
            <XMarkIcon className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <SettingRow label="Book Title" value={generation.book_title} />
          <SettingRow label="Author Name" value={generation.author_name} />
          <SettingRow label="Cover Ideas" value={generation.cover_ideas} />
          <SettingRow label="Book Description" value={generation.description} />
          {generation.genres && generation.genres.length > 0 && (
            <SettingRow label="Genres" value={generation.genres.join(', ')} />
          )}
          <SettingRow label="Character Description" value={generation.character_description} />
          <SettingRow label="Aspect Ratio" value={aspectLabel} />

          {hasStyleAnalysis && (
            <div>
              <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">Style Reference</p>
              <div className="bg-surface-alt rounded-lg p-3 space-y-2 text-sm">
                {generation.style_analysis!.feeling && (
                  <StyleRow label="Feeling" value={generation.style_analysis!.feeling} />
                )}
                {generation.style_analysis!.layout && (
                  <StyleRow label="Layout" value={generation.style_analysis!.layout} />
                )}
                {generation.style_analysis!.illustration_rules && (
                  <StyleRow label="Illustration" value={generation.style_analysis!.illustration_rules} />
                )}
                {generation.style_analysis!.typography && (
                  <StyleRow label="Typography" value={generation.style_analysis!.typography} />
                )}
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 px-6 py-4 bg-surface border-t border-border rounded-b-2xl">
          <button
            onClick={() => onUseSettings(generation)}
            className="w-full bg-accent text-white py-2.5 rounded-lg font-medium hover:bg-accent-hover transition-colors cursor-pointer"
          >
            Use These Settings
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-medium text-text-muted uppercase tracking-wide">{label}</p>
      <p className="mt-0.5 text-sm text-text">{value}</p>
    </div>
  );
}

function StyleRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-text-secondary font-medium">{label}:</span>{' '}
      <span className="text-text">{value}</span>
    </div>
  );
}
