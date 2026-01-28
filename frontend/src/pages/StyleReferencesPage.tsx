import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Masonry from 'react-masonry-css';
import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { generationApi } from '../services/api';
import { useStyleReferences, useDeleteStyleReference, useUpdateStyleReference, queryKeys } from '../hooks/useApiQueries';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorState from '../components/common/ErrorState';
import StyleReferenceModal from '../components/common/StyleReferenceModal';
import type { StyleReference } from '../types';
import { MASONRY_BREAKPOINTS } from '../constants';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

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

function InlineTitle({
  refId,
  title,
  isEditing,
  onStopEdit,
}: {
  refId: number;
  title: string;
  isEditing: boolean;
  onStopEdit: () => void;
}) {
  const [value, setValue] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);
  const updateMutation = useUpdateStyleReference();

  useEffect(() => {
    setValue(title);
  }, [title]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const save = () => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === title) {
      setValue(title);
      onStopEdit();
      return;
    }
    updateMutation.mutate({ id: refId, data: { title: trimmed } });
    onStopEdit();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      save();
    }
    if (e.key === 'Escape') {
      setValue(title);
      onStopEdit();
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        className="w-full font-medium text-white bg-white/20 border border-white/40 rounded px-1.5 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-white/50 placeholder-white/50 backdrop-blur-sm"
        placeholder="Give this style a name..."
      />
    );
  }

  return (
    <h3 className="flex-1 min-w-0 font-medium text-white truncate">
      {title || 'Untitled Reference'}
    </h3>
  );
}

export default function StyleReferencesPage() {
  const queryClient = useQueryClient();
  const { data: refs = [], isLoading, error, refetch } = useStyleReferences();
  const deleteMutation = useDeleteStyleReference();

  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedRef, setSelectedRef] = useState<StyleReference | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleImageFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select an image file.');
      return;
    }
    setUploadError(null);
    setIsUploading(true);

    try {
      const dataUrl = await resizeImage(file);
      const ref = await generationApi.uploadStyleReference(dataUrl);

      queryClient.setQueryData<StyleReference[]>(queryKeys.styleReferences, (old) =>
        old ? [ref, ...old] : [ref]
      );
    } catch (err: any) {
      setUploadError(err.response?.data?.error || 'Failed to upload image.');
    } finally {
      setIsUploading(false);
    }
  }, [queryClient]);

  const handleImageFileRef = useRef(handleImageFile);
  handleImageFileRef.current = handleImageFile;

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

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate(id);
  };

  const handleCardClick = (ref: StyleReference) => {
    setSelectedRef(ref);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
  };

  const handleModalUpdate = (id: number, data: Partial<Pick<StyleReference, 'title'>>) => {
    if (selectedRef && selectedRef.id === id) {
      setSelectedRef({ ...selectedRef, ...data });
    }
  };

  const handleModalDelete = (id: number) => {
    deleteMutation.mutate(id);
  };

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error.message || 'Failed to load style references'} onRetry={refetch} />;

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className="min-h-full relative"
    >
      {isDragOver && (
        <div className="fixed top-14 left-0 right-0 bottom-0 z-50 bg-accent/10 border-4 border-dashed border-accent flex items-center justify-center pointer-events-none">
          <div className="bg-surface rounded-2xl px-8 py-6 shadow-lg text-center">
            <svg className="w-12 h-12 text-accent mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
            </svg>
            <p className="text-lg font-medium text-text">Drop image to upload</p>
          </div>
        </div>
      )}

      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-text tracking-tight">Style References</h1>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="flex-shrink-0 flex items-center gap-2 bg-accent text-white px-3.5 py-1.5 rounded-lg font-medium text-sm hover:bg-accent-hover disabled:opacity-40 transition-colors"
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

      {isUploading && (
        <div className="mb-6 bg-info-bg border border-info-border text-info px-4 py-3 rounded-xl">
          <div className="flex items-center text-sm">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent mr-3"></div>
            Uploading image...
          </div>
        </div>
      )}

      {uploadError && (
        <div className="mb-6 bg-error-bg border border-error-border text-error px-4 py-3 rounded-xl text-sm">
          {uploadError}
          <button
            onClick={() => setUploadError(null)}
            className="ml-2 underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {refs.length === 0 && !isUploading && (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="cursor-pointer border-2 border-dashed border-border rounded-2xl p-16 text-center hover:border-accent/40 hover:bg-surface-alt/50 transition-colors"
        >
          <svg className="w-16 h-16 text-text-muted mx-auto mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
          </svg>
          <h2 className="text-xl font-heading font-semibold text-text tracking-tight">No style references yet</h2>
          <p className="mt-2 text-text-secondary">
            Drop an image here, click to upload, or paste from clipboard.
          </p>
          <p className="mt-1 text-xs text-text-muted">Max 5MB. JPG, PNG, WebP. Ctrl+V to paste.</p>
        </div>
      )}

      {refs.length > 0 && (
        <Masonry
          breakpointCols={MASONRY_BREAKPOINTS}
          className="masonry-grid"
          columnClassName="masonry-grid-column"
        >
          {refs.map((ref) => (
            <div
              key={ref.id}
              onClick={() => handleCardClick(ref)}
              className="relative group rounded-2xl overflow-hidden cursor-pointer"
            >
              <img
                src={ref.image_url}
                alt={ref.title || 'Style reference'}
                crossOrigin="anonymous"
                className="w-full h-auto block opacity-0 transition-opacity duration-300"
                onLoad={(e) => { (e.target as HTMLImageElement).style.opacity = '1'; }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <div className="flex items-center gap-2">
                    <InlineTitle
                      refId={ref.id}
                      title={ref.title || 'Untitled Reference'}
                      isEditing={renamingId === ref.id}
                      onStopEdit={() => setRenamingId(null)}
                    />
                    {renamingId !== ref.id && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setRenamingId(ref.id); }}
                        className="flex-shrink-0 p-2 bg-white/20 hover:bg-white/30 rounded-lg backdrop-blur-sm transition-colors cursor-pointer"
                        title="Rename"
                      >
                        <PencilIcon className="w-5 h-5 text-white" />
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); if (confirm('Delete this style reference? This cannot be undone.')) handleDelete(ref.id); }}
                      className="flex-shrink-0 p-2 bg-white/20 hover:bg-red-500/60 rounded-lg backdrop-blur-sm transition-colors cursor-pointer"
                      title="Delete"
                    >
                      <TrashIcon className="w-5 h-5 text-white" />
                    </button>
                  </div>

                </div>
              </div>
            </div>
          ))}
        </Masonry>
      )}

      <StyleReferenceModal
        styleRef={selectedRef}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onUpdate={handleModalUpdate}
        onDelete={handleModalDelete}
      />
    </div>
  );
}
