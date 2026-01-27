import { useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { Generation } from '../types';

interface Props {
  generation: Generation;
  styleReferenceName?: string | null;
  onClose: () => void;
  onUseSettings: (generation: Generation) => void;
}

export default function GenerationSettingsModal({ generation, styleReferenceName, onClose, onUseSettings }: Props) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

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
          <h2 className="text-lg font-heading font-semibold text-text tracking-tight">Generation Settings</h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-surface-alt rounded-lg transition-colors cursor-pointer"
          >
            <XMarkIcon className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {generation.base_image_only && (
            <SettingRow label="Mode" value="Image only (no title or author text)" />
          )}
          {!generation.base_image_only && (
            <>
              <SettingRow label="Book Title" value={generation.book_title} />
              <SettingRow label="Author Name" value={generation.author_name} />
            </>
          )}
          <SettingRow label="Cover Ideas" value={generation.cover_ideas} />
          <SettingRow label="Book Description" value={generation.description} />
          {generation.genres && generation.genres.length > 0 && (
            <SettingRow label="Genres" value={generation.genres.join(', ')} />
          )}
          <SettingRow label="Character Description" value={generation.character_description} />
          <SettingRow label="Aspect Ratio" value={aspectLabel} />
          <SettingRow label="Style Reference" value={styleReferenceName} />
        </div>

        <div className="sticky bottom-0 px-6 py-3 bg-surface border-t border-border rounded-b-2xl">
          <button
            onClick={() => onUseSettings(generation)}
            className="w-full bg-accent text-white py-1.5 rounded-lg font-medium text-sm hover:bg-accent-hover transition-colors cursor-pointer"
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


