import { useState, useRef, useEffect } from 'react';
import ReactCrop, { type Crop, type PercentCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

interface ImageCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  onCropComplete: (crop: { x: number; y: number; width: number; height: number }) => void;
  isLoading?: boolean;
}

export default function ImageCropModal({
  isOpen,
  onClose,
  imageUrl,
  onCropComplete,
  isLoading = false,
}: ImageCropModalProps) {
  const [crop, setCrop] = useState<Crop>();
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (isOpen) {
      setCrop({
        unit: '%',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose, isLoading]);

  const handleApply = () => {
    if (!crop) return;

    const percentCrop = crop as PercentCrop;
    onCropComplete({
      x: percentCrop.x,
      y: percentCrop.y,
      width: percentCrop.width,
      height: percentCrop.height,
    });
  };

  const hasValidCrop = crop && crop.width > 0 && crop.height > 0;
  const isFullImage = crop && crop.x === 0 && crop.y === 0 && crop.width === 100 && crop.height === 100;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={() => !isLoading && onClose()}
      />

      <div className="relative bg-surface border border-border rounded-2xl shadow-lg w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-lg font-heading font-semibold text-text tracking-tight">
              Crop Image
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              Drag the corners or edges to adjust the crop area
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1 rounded-md text-text-muted hover:text-text hover:bg-surface-alt transition-colors disabled:opacity-40"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/20">
          <ReactCrop
            crop={crop}
            onChange={(_, percentCrop) => setCrop(percentCrop)}
            className="max-h-[60vh]"
          >
            <img
              ref={imgRef}
              src={imageUrl}
              alt="Crop preview"
              crossOrigin="anonymous"
              className="max-h-[60vh] max-w-full object-contain"
            />
          </ReactCrop>
        </div>

        <div className="flex items-center justify-between p-4 border-t border-border">
          <div className="text-xs text-text-muted">
            {hasValidCrop && !isFullImage ? (
              <span>
                Crop: {Math.round(crop.width)}% x {Math.round(crop.height)}%
              </span>
            ) : (
              <span>Select an area to crop</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={isLoading || !hasValidCrop || isFullImage}
              className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isLoading && (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              {isLoading ? 'Applying...' : 'Apply Crop'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
