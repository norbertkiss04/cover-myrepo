import { useState, useEffect } from 'react';
import type { StyleReference, DetectedText } from '../../types';
import {
  useUpdateTextSelection,
  useRedetectText,
  useRemoveBorder,
  useRegenerateCleanBackground,
  useRegenerateTextLayer,
} from '../../hooks/useApiQueries';

interface StyleReferenceModalProps {
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

interface ImagePreviewProps {
  label: string;
  imageUrl: string | null;
  isLoading: boolean;
  onGenerate: () => void;
  onRegenerate?: () => void;
  canGenerate: boolean;
  badge?: string;
  onImageClick?: (url: string) => void;
}

function ImagePreview({
  label,
  imageUrl,
  isLoading,
  onGenerate,
  onRegenerate,
  canGenerate,
  badge,
  onImageClick,
}: ImagePreviewProps) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-text-secondary">{label}</span>
        {badge && (
          <span className="text-[10px] px-1.5 py-0.5 bg-accent/10 text-accent rounded">
            {badge}
          </span>
        )}
      </div>
      <div
        className={`relative aspect-[2/3] bg-surface-alt border border-border rounded-lg overflow-hidden ${
          imageUrl && onImageClick ? 'cursor-pointer' : ''
        }`}
        onClick={() => imageUrl && onImageClick?.(imageUrl)}
      >
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : imageUrl ? (
          <img
            src={imageUrl}
            alt={label}
            className="w-full h-full object-cover"
            crossOrigin="anonymous"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-text-muted">
            <svg className="w-8 h-8 opacity-30" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
          </div>
        )}
      </div>
      <div className="mt-2">
        {imageUrl ? (
          onRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              disabled={isLoading}
              className="w-full px-2 py-1.5 text-xs font-medium text-text-secondary border border-border rounded-lg hover:bg-surface-alt hover:text-text disabled:opacity-40 transition-colors"
            >
              {isLoading ? 'Generating...' : 'Regenerate'}
            </button>
          )
        ) : (
          canGenerate && (
            <button
              type="button"
              onClick={onGenerate}
              disabled={isLoading}
              className="w-full px-2 py-1.5 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent-hover disabled:opacity-40 transition-colors"
            >
              {isLoading ? 'Generating...' : 'Generate'}
            </button>
          )
        )}
      </div>
    </div>
  );
}

interface LightboxProps {
  imageUrl: string | null;
  onClose: () => void;
}

function Lightbox({ imageUrl, onClose }: LightboxProps) {
  useEffect(() => {
    if (!imageUrl) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [imageUrl, onClose]);

  if (!imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 text-white/70 hover:text-white transition-colors"
      >
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
      <img
        src={imageUrl}
        alt="Preview"
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
        crossOrigin="anonymous"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

export default function StyleReferenceModal({ isOpen, onClose, styleReference }: StyleReferenceModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [localRef, setLocalRef] = useState<StyleReference>(styleReference);

  const updateTextMutation = useUpdateTextSelection();
  const redetectTextMutation = useRedetectText();
  const removeBorderMutation = useRemoveBorder();
  const regenerateCleanMutation = useRegenerateCleanBackground();
  const regenerateTextLayerMutation = useRegenerateTextLayer();

  useEffect(() => {
    if (isOpen) {
      setLocalRef(styleReference);
      setSelectedIds(new Set(styleReference.selected_text_ids || []));
    }
  }, [isOpen, styleReference]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !lightboxUrl) onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose, lightboxUrl]);

  const handleMutationSuccess = (updated: StyleReference) => {
    setLocalRef(updated);
    if (updated.detected_text) {
      setSelectedIds(new Set(updated.selected_text_ids || []));
    }
  };

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
    setSelectedIds(new Set(localRef.detected_text.map((t) => t.id)));
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleSaveSelection = () => {
    updateTextMutation.mutate(
      { id: localRef.id, selectedTextIds: Array.from(selectedIds) },
      {
        onSuccess: (updated) => {
          handleMutationSuccess(updated);
          onClose();
        },
      }
    );
  };

  const handleRedetectText = () => {
    redetectTextMutation.mutate(localRef.id, { onSuccess: handleMutationSuccess });
  };

  const handleRemoveBorder = () => {
    removeBorderMutation.mutate(localRef.id, { onSuccess: handleMutationSuccess });
  };

  const handleGenerateClean = () => {
    regenerateCleanMutation.mutate(localRef.id, { onSuccess: handleMutationSuccess });
  };

  const handleGenerateTextLayer = () => {
    regenerateTextLayerMutation.mutate(localRef.id, { onSuccess: handleMutationSuccess });
  };

  if (!isOpen) return null;

  const detectedTexts = localRef.detected_text || [];
  const hasChanges = (() => {
    const current = new Set(localRef.selected_text_ids || []);
    if (selectedIds.size !== current.size) return true;
    for (const id of selectedIds) {
      if (!current.has(id)) return true;
    }
    return false;
  })();

  const hasOriginalImage = !!localRef.original_image_url;
  const hasDifferentCurrentImage = hasOriginalImage && localRef.original_image_url !== localRef.image_url;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div
          className="absolute inset-0 bg-black/40"
          onClick={onClose}
        />

        <div className="relative bg-surface border border-border rounded-2xl shadow-lg w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div>
              <h2 className="text-lg font-heading font-semibold text-text tracking-tight">
                Style Reference Manager
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                {localRef.title || 'Untitled Reference'}
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

          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            <div>
              <h3 className="text-sm font-medium text-text mb-3">Images</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-text-secondary">Current Image</span>
                    {hasDifferentCurrentImage && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-green-500/10 text-green-600 rounded">
                        Border Removed
                      </span>
                    )}
                  </div>
                  <div
                    className="relative aspect-[2/3] bg-surface-alt border border-border rounded-lg overflow-hidden cursor-pointer"
                    onClick={() => setLightboxUrl(localRef.image_url)}
                  >
                    <img
                      src={localRef.image_url}
                      alt="Current"
                      className="w-full h-full object-cover"
                      crossOrigin="anonymous"
                    />
                  </div>
                  <div className="mt-2">
                    {hasOriginalImage && (
                      <button
                        type="button"
                        onClick={handleRemoveBorder}
                        disabled={removeBorderMutation.isPending}
                        className="w-full px-2 py-1.5 text-xs font-medium text-text-secondary border border-border rounded-lg hover:bg-surface-alt hover:text-text disabled:opacity-40 transition-colors"
                      >
                        {removeBorderMutation.isPending ? 'Removing...' : 'Remove Border'}
                      </button>
                    )}
                  </div>
                </div>

                <ImagePreview
                  label="Clean Background"
                  imageUrl={localRef.clean_image_url}
                  isLoading={regenerateCleanMutation.isPending}
                  onGenerate={handleGenerateClean}
                  onRegenerate={handleGenerateClean}
                  canGenerate={true}
                  onImageClick={setLightboxUrl}
                />

                <ImagePreview
                  label="Text Layer"
                  imageUrl={localRef.text_layer_url}
                  isLoading={regenerateTextLayerMutation.isPending}
                  onGenerate={handleGenerateTextLayer}
                  onRegenerate={handleGenerateTextLayer}
                  canGenerate={detectedTexts.length > 0 && selectedIds.size > 0}
                  badge={localRef.text_layer_cleaned ? 'Cleaned' : undefined}
                  onImageClick={setLightboxUrl}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-text">Text Detection</h3>
                <button
                  type="button"
                  onClick={handleRedetectText}
                  disabled={redetectTextMutation.isPending}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-accent hover:text-accent-hover disabled:opacity-40 transition-colors"
                >
                  <svg className={`w-3.5 h-3.5 ${redetectTextMutation.isPending ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.992 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
                  </svg>
                  {redetectTextMutation.isPending ? 'Detecting...' : 'Re-detect Text'}
                </button>
              </div>

              <div className="bg-surface-alt/50 border border-border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-3">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    disabled={detectedTexts.length === 0}
                    className="text-xs text-accent hover:text-accent-hover disabled:opacity-40 transition-colors"
                  >
                    Select All
                  </button>
                  <span className="text-text-muted">|</span>
                  <button
                    type="button"
                    onClick={handleDeselectAll}
                    disabled={detectedTexts.length === 0}
                    className="text-xs text-accent hover:text-accent-hover disabled:opacity-40 transition-colors"
                  >
                    Deselect All
                  </button>
                  <span className="ml-auto text-xs text-text-muted">
                    {selectedIds.size} of {detectedTexts.length} selected
                  </span>
                </div>

                {detectedTexts.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-text-muted text-sm">No text detected in this image.</p>
                    <p className="text-text-muted text-xs mt-1">Click "Re-detect Text" to try again.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {detectedTexts.map((text) => (
                      <label
                        key={text.id}
                        className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                          selectedIds.has(text.id)
                            ? 'bg-accent/10 border-accent/40'
                            : 'bg-surface border-border hover:border-accent/30'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(text.id)}
                          onChange={() => handleToggle(text.id)}
                          className="mt-0.5 w-4 h-4 rounded border-border text-accent focus:ring-accent/30"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-medium text-text text-sm truncate">
                              "{text.text}"
                            </span>
                            <span className="flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-surface-alt text-text-muted border border-border">
                              {TEXT_TYPE_LABELS[text.text_type] || text.text_type}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-text-muted">
                            <span className="capitalize">{text.position}</span>
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
              Selected text will be used for typography reference.
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
                onClick={handleSaveSelection}
                disabled={updateTextMutation.isPending || !hasChanges}
                className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {updateTextMutation.isPending ? 'Saving...' : 'Save Selection'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <Lightbox imageUrl={lightboxUrl} onClose={() => setLightboxUrl(null)} />
    </>
  );
}
