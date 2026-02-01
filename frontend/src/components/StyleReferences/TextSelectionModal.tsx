import { useState, useEffect } from 'react';
import type { StyleReference, DetectedText } from '../../types';
import { useUpdateTextSelection } from '../../hooks/useApiQueries';

interface TextSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  styleReference: StyleReference;
}

const TEXT_TYPE_LABELS: Record<DetectedText['text_type'], string> = {
  title: 'Title',
  subtitle: 'Subtitle',
  author_name: 'Author',
  tagline: 'Tagline',
  series_name: 'Series',
  publisher: 'Publisher',
  other: 'Other',
};

export default function TextSelectionModal({ isOpen, onClose, styleReference }: TextSelectionModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const updateMutation = useUpdateTextSelection();

  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set(styleReference.selected_text_ids || []));
    }
  }, [isOpen, styleReference.selected_text_ids]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handleToggle = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedIds(new Set(styleReference.detected_text.map((t) => t.id)));
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleSave = () => {
    updateMutation.mutate(
      { id: styleReference.id, selectedTextIds: Array.from(selectedIds) },
      { onSuccess: () => onClose() }
    );
  };

  if (!isOpen) return null;

  const detectedTexts = styleReference.detected_text || [];
  const hasChanges = (() => {
    const current = new Set(styleReference.selected_text_ids || []);
    if (selectedIds.size !== current.size) return true;
    for (const id of selectedIds) {
      if (!current.has(id)) return true;
    }
    return false;
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      <div className="relative bg-surface border border-border rounded-2xl shadow-lg w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-lg font-heading font-semibold text-text tracking-tight">Configure Text Selection</h2>
            <p className="text-xs text-text-muted mt-0.5">
              Select which text to use for typography reference
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-text-muted hover:text-text hover:bg-surface-alt transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex gap-4">
            <div className="w-48 flex-shrink-0">
              <img
                src={styleReference.image_url}
                alt={styleReference.title}
                className="w-full h-auto rounded-lg border border-border"
                crossOrigin="anonymous"
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-3">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-xs text-accent hover:text-accent-hover transition-colors"
                >
                  Select All
                </button>
                <span className="text-text-muted">|</span>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="text-xs text-accent hover:text-accent-hover transition-colors"
                >
                  Deselect All
                </button>
                <span className="ml-auto text-xs text-text-muted">
                  {selectedIds.size} of {detectedTexts.length} selected
                </span>
              </div>

              {detectedTexts.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-text-muted text-sm">No text detected in this image.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {detectedTexts.map((text) => (
                    <label
                      key={text.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedIds.has(text.id)
                          ? 'bg-accent/10 border-accent/40'
                          : 'bg-surface-alt/50 border-border hover:border-accent/30'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(text.id)}
                        onChange={() => handleToggle(text.id)}
                        className="mt-0.5 w-4 h-4 rounded border-border text-accent focus:ring-accent/30"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-text text-sm truncate">
                            "{text.text}"
                          </span>
                          <span className="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-surface-alt text-text-muted border border-border">
                            {TEXT_TYPE_LABELS[text.text_type] || text.text_type}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-text-muted">
                          <span className="capitalize">{text.position}</span>
                          <span className="truncate">{text.style_description}</span>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 border-t border-border">
          <p className="text-xs text-text-muted">
            Only selected text will be extracted for typography reference.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={updateMutation.isPending || !hasChanges}
              className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Selection'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
