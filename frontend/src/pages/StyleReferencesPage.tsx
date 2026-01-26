import { useState, useEffect, useCallback, useRef } from 'react';
import { generationApi } from '../services/api';
import type { StyleReference } from '../types';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

// Resize image on a canvas if it exceeds max dimensions
function resizeImage(file: File, maxDim = 2048): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width <= maxDim && height <= maxDim && file.size <= MAX_IMAGE_SIZE) {
          resolve(reader.result as string);
          return;
        }
        const scale = Math.min(maxDim / width, maxDim / height, 1);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Accordion Section Component ──
function AccordionSection({
  title,
  value,
  onChange,
  defaultOpen = false,
  readOnly = false,
}: {
  title: string;
  value: string;
  onChange?: (v: string) => void;
  defaultOpen?: boolean;
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-surface-alt hover:bg-surface-hover transition-colors text-left"
      >
        <span className="text-sm font-medium text-text">{title}</span>
        <svg
          className={`w-4 h-4 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && (
        <div className="p-3">
          {readOnly ? (
            <p className="text-sm text-text whitespace-pre-wrap">{value || '(empty)'}</p>
          ) : (
            <textarea
              rows={3}
              value={value}
              onChange={(e) => onChange?.(e.target.value)}
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent resize-y"
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Edit form state for a single reference ──
interface EditState {
  title: string;
  feeling: string;
  layout: string;
  illustration_rules: string;
  typography: string;
}

export default function StyleReferencesPage() {
  const [refs, setRefs] = useState<StyleReference[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editing
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Upload / analyze
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [newRefId, setNewRefId] = useState<number | null>(null); // auto-open edit for newly created ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadRefs();
  }, []);

  // When a new ref is created, auto-open its edit mode
  useEffect(() => {
    if (newRefId !== null) {
      const ref = refs.find((r) => r.id === newRefId);
      if (ref) {
        startEdit(ref);
        setNewRefId(null);
      }
    }
  }, [newRefId, refs]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadRefs = async () => {
    setIsLoading(true);
    try {
      const data = await generationApi.getStyleReferences();
      setRefs(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load style references');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Upload + Analyze ──

  const handleImageFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setAnalyzeError('Please select an image file.');
      return;
    }
    setAnalyzeError(null);
    setIsAnalyzing(true);

    try {
      const dataUrl = await resizeImage(file);
      const ref = await generationApi.analyzeStyle(dataUrl);
      // Prepend to list and auto-open edit for title
      setRefs((prev) => [ref, ...prev]);
      setNewRefId(ref.id);
    } catch (err: any) {
      setAnalyzeError(err.response?.data?.error || 'Failed to analyze image.');
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  // Stable ref so the paste listener always calls the latest handleImageFile
  const handleImageFileRef = useRef(handleImageFile);
  handleImageFileRef.current = handleImageFile;

  // ── Paste support (Ctrl+V / Cmd+V) ──
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) handleImageFileRef.current(file);
          return;
        }
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleImageFile(file);
    },
    [handleImageFile],
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageFile(file);
    // Reset input so the same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Edit ──

  const startEdit = (ref: StyleReference) => {
    setEditingId(ref.id);
    setEditState({
      title: ref.title || '',
      feeling: ref.feeling || '',
      layout: ref.layout || '',
      illustration_rules: ref.illustration_rules || '',
      typography: ref.typography || '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditState(null);
  };

  const saveEdit = async () => {
    if (!editingId || !editState) return;
    setIsSaving(true);
    try {
      const updated = await generationApi.updateStyleReference(editingId, editState);
      setRefs((prev) => prev.map((r) => (r.id === editingId ? updated : r)));
      setEditingId(null);
      setEditState(null);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Delete ──

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this style reference? This cannot be undone.')) return;
    try {
      await generationApi.deleteStyleReference(id);
      setRefs((prev) => prev.filter((r) => r.id !== id));
      if (editingId === id) cancelEdit();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete');
    }
  };

  // ── Render ──

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-accent border-t-transparent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-error">{error}</p>
        <button
          onClick={loadRefs}
          className="mt-4 text-accent hover:text-accent-hover font-medium transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className="min-h-[60vh] relative"
    >
      {/* Drag overlay */}
      {isDragOver && (
        <div className="fixed inset-0 z-50 bg-accent/10 border-4 border-dashed border-accent rounded-xl flex items-center justify-center pointer-events-none">
          <div className="bg-surface rounded-xl px-8 py-6 shadow-lg text-center">
            <svg className="w-12 h-12 text-accent mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
            </svg>
            <p className="text-lg font-medium text-text">Drop image to analyze</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-text">Style References</h1>
          <p className="text-text-secondary mt-1">
            Upload, drag-and-drop, or paste images to extract reusable design styles for your covers.
          </p>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isAnalyzing}
          className="flex-shrink-0 flex items-center gap-2 bg-accent text-white px-4 py-2.5 rounded-lg font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Upload Image
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Analyzing banner */}
      {isAnalyzing && (
        <div className="mb-6 bg-info-bg border border-info-border text-info px-4 py-3 rounded-lg">
          <div className="flex items-center text-sm">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent mr-3"></div>
            Analyzing image with Gemini... This may take a few seconds.
          </div>
        </div>
      )}

      {/* Analyze error */}
      {analyzeError && (
        <div className="mb-6 bg-error-bg border border-error-border text-error px-4 py-3 rounded-lg text-sm">
          {analyzeError}
          <button
            onClick={() => setAnalyzeError(null)}
            className="ml-2 underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Empty state */}
      {refs.length === 0 && !isAnalyzing && (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="cursor-pointer border-2 border-dashed border-border rounded-xl p-16 text-center hover:border-accent/40 hover:bg-surface-alt/50 transition-colors"
        >
          <svg className="w-16 h-16 text-text-muted mx-auto mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
          </svg>
          <h2 className="text-xl font-heading font-semibold text-text">No style references yet</h2>
          <p className="mt-2 text-text-secondary">
            Drop an image here, click to upload, or paste from clipboard. The AI will analyze its visual style.
          </p>
          <p className="mt-1 text-xs text-text-muted">Max 5MB. JPG, PNG, WebP. Ctrl+V to paste.</p>
        </div>
      )}

      {/* Reference grid */}
      {refs.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {refs.map((ref) => {
            const isEditing = editingId === ref.id;

            return (
              <div
                key={ref.id}
                className={`bg-surface border rounded-xl overflow-hidden transition-colors ${
                  isEditing ? 'border-accent ring-1 ring-accent/20' : 'border-border hover:border-accent/30'
                }`}
              >
                {/* Image */}
                <div className="aspect-[4/3] bg-surface-alt">
                  <img
                    src={ref.image_url}
                    alt={ref.title || 'Style reference'}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Content */}
                <div className="p-4">
                  {isEditing && editState ? (
                    // ── Edit mode ──
                    <div className="space-y-3">
                      {/* Title input */}
                      <div>
                        <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                          Title
                        </label>
                        <input
                          type="text"
                          value={editState.title}
                          onChange={(e) => setEditState({ ...editState, title: e.target.value })}
                          className="w-full px-3 py-2 bg-surface-alt border border-border rounded-lg text-sm text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
                          placeholder="Give this style a name..."
                          autoFocus
                        />
                      </div>

                      {/* Analysis fields */}
                      <AccordionSection
                        title="Feeling & Atmosphere"
                        value={editState.feeling}
                        onChange={(v) => setEditState({ ...editState, feeling: v })}
                        defaultOpen
                      />
                      <AccordionSection
                        title="Layout & Composition"
                        value={editState.layout}
                        onChange={(v) => setEditState({ ...editState, layout: v })}
                      />
                      <AccordionSection
                        title="Illustration Rules"
                        value={editState.illustration_rules}
                        onChange={(v) => setEditState({ ...editState, illustration_rules: v })}
                      />
                      <AccordionSection
                        title="Typography"
                        value={editState.typography}
                        onChange={(v) => setEditState({ ...editState, typography: v })}
                      />

                      {/* Save / Cancel */}
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={saveEdit}
                          disabled={isSaving}
                          className="flex-1 bg-accent text-white py-2 px-3 rounded-lg text-sm font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors"
                        >
                          {isSaving ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={cancelEdit}
                          disabled={isSaving}
                          className="flex-1 bg-surface-alt text-text-secondary border border-border py-2 px-3 rounded-lg text-sm font-medium hover:bg-surface-hover transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    // ── View mode ──
                    <>
                      <h3 className="font-medium text-text truncate">{ref.title || 'Untitled Reference'}</h3>
                      {ref.feeling && (
                        <p className="text-sm text-text-secondary line-clamp-2 mt-1">{ref.feeling}</p>
                      )}
                      <p className="text-xs text-text-muted mt-2">
                        {new Date(ref.created_at).toLocaleDateString()}
                      </p>

                      {/* Actions */}
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => startEdit(ref)}
                          className="flex-1 text-center text-sm bg-surface-alt text-text border border-border py-1.5 px-3 rounded-lg hover:bg-surface-hover transition-colors font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(ref.id)}
                          className="text-sm text-text-muted hover:text-error py-1.5 px-3 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
