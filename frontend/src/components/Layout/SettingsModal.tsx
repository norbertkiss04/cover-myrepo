import { useEffect, useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../context/AuthContext';

const OPTIONAL_FIELDS = [
  { key: 'description', label: 'Book Description' },
  { key: 'genres', label: 'Genres' },
  { key: 'mood', label: 'Mood / Atmosphere' },
  { key: 'color_preference', label: 'Color Preference' },
  { key: 'character_description', label: 'Character Description' },
  { key: 'keywords', label: 'Keywords' },
  { key: 'reference_image_description', label: 'Style Reference' },
];

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { effective, setTheme } = useTheme();
  const { user, updatePreferences } = useAuth();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {}
      <div className="relative bg-surface border border-border rounded-2xl shadow-lg w-full max-w-sm mx-4 p-6">
        {}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-heading font-semibold text-text tracking-tight">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-text-muted hover:text-text hover:bg-surface-alt transition-colors"
            aria-label="Close settings"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-text">Theme</span>
          <div className="flex bg-surface-alt border border-border rounded-lg p-0.5">
            <button
              onClick={() => setTheme('light')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                effective === 'light'
                  ? 'bg-surface text-text shadow-sm border border-border'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
              </svg>
              Light
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                effective === 'dark'
                  ? 'bg-surface text-text shadow-sm border border-border'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
              </svg>
              Dark
            </button>
          </div>
        </div>

        {}
        <div className="mt-6 pt-6 border-t border-border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-text">Default Form Fields</span>
            {saving && (
              <span className="text-xs text-text-muted">Saving...</span>
            )}
          </div>
          <p className="text-xs text-text-muted mb-3">
            Choose which optional fields appear by default on the generation form.
          </p>
          <div className="space-y-2">
            {OPTIONAL_FIELDS.map(({ key, label }) => {
              const visibleFields = user?.preferences?.visible_fields || [];
              const isChecked = visibleFields.includes(key);

              return (
                <label
                  key={key}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-alt transition-colors cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={async () => {
                      const newFields = isChecked
                        ? visibleFields.filter((f) => f !== key)
                        : [...visibleFields, key];
                      setSaving(true);
                      try {
                        await updatePreferences({ visible_fields: newFields });
                      } catch {

                      } finally {
                        setSaving(false);
                      }
                    }}
                    className="w-4 h-4 rounded border-border text-accent focus:ring-accent/40"
                  />
                  <span className="text-sm text-text">{label}</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
