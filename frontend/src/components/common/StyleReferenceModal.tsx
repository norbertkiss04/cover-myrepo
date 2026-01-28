import { useState, useEffect, useRef, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, PencilIcon, TrashIcon, CheckIcon } from '@heroicons/react/24/outline';
import type { StyleReference } from '../../types';
import { generationApi } from '../../services/api';

type ImageVariant = 'original' | 'clean' | 'text_layer';

interface StyleReferenceModalProps {
  styleRef: StyleReference | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updated: StyleReference) => void;
  onDelete: (id: number) => void;
}

export default function StyleReferenceModal({
  styleRef,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
}: StyleReferenceModalProps) {
  const [selectedVariant, setSelectedVariant] = useState<ImageVariant>('original');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (styleRef) {
      setTitleValue(styleRef.title || 'Untitled Reference');
      setSelectedVariant('original');
      setIsEditingTitle(false);
    }
  }, [styleRef]);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  if (!styleRef) return null;

  const getImageUrl = () => {
    switch (selectedVariant) {
      case 'clean':
        return styleRef.clean_image_url || styleRef.image_url;
      case 'text_layer':
        return styleRef.text_layer_url || styleRef.image_url;
      default:
        return styleRef.image_url;
    }
  };

  const getVariantLabel = (variant: ImageVariant) => {
    switch (variant) {
      case 'original':
        return 'Original';
      case 'clean':
        return 'Clean';
      case 'text_layer':
        return 'Typography';
    }
  };

  const availableVariants: ImageVariant[] = ['original'];
  if (styleRef.clean_image_url) availableVariants.push('clean');
  if (styleRef.text_layer_url) availableVariants.push('text_layer');

  const handleSaveTitle = async () => {
    const trimmed = titleValue.trim();
    if (!trimmed || trimmed === styleRef.title) {
      setTitleValue(styleRef.title || 'Untitled Reference');
      setIsEditingTitle(false);
      return;
    }
    setIsSaving(true);
    try {
      const updated = await generationApi.updateStyleReference(styleRef.id, { title: trimmed });
      onUpdate(updated);
      setIsEditingTitle(false);
    } catch {
      setTitleValue(styleRef.title || 'Untitled Reference');
      setIsEditingTitle(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveTitle();
    }
    if (e.key === 'Escape') {
      setTitleValue(styleRef.title || 'Untitled Reference');
      setIsEditingTitle(false);
    }
  };

  const handleDeleteClick = () => {
    if (confirm('Delete this style reference? This cannot be undone.')) {
      onDelete(styleRef.id);
      onClose();
    }
  };

  const analysisFields = [
    { label: 'Feeling', value: styleRef.feeling },
    { label: 'Layout', value: styleRef.layout },
    { label: 'Typography', value: styleRef.typography },
    { label: 'Illustration Rules', value: styleRef.illustration_rules },
  ].filter((f) => f.value);

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-surface shadow-xl transition-all">
                <div className="flex flex-col lg:flex-row">
                  <div className="relative flex-shrink-0 lg:w-1/2 bg-black/20">
                    <button
                      onClick={onClose}
                      className="absolute top-3 right-3 z-10 p-2 bg-black/40 hover:bg-black/60 rounded-full backdrop-blur-sm transition-colors"
                    >
                      <XMarkIcon className="w-5 h-5 text-white" />
                    </button>

                    <div className="aspect-[2/3] w-full flex items-center justify-center p-4">
                      <img
                        src={getImageUrl()}
                        alt={styleRef.title || 'Style reference'}
                        crossOrigin="anonymous"
                        className="max-w-full max-h-full object-contain rounded-lg"
                      />
                    </div>

                    {availableVariants.length > 1 && (
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black/50 backdrop-blur-sm rounded-full p-1.5">
                        {availableVariants.map((variant) => (
                          <button
                            key={variant}
                            onClick={() => setSelectedVariant(variant)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                              selectedVariant === variant
                                ? 'bg-white text-black'
                                : 'text-white/80 hover:text-white hover:bg-white/10'
                            }`}
                          >
                            {getVariantLabel(variant)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 p-6 lg:max-h-[80vh] lg:overflow-y-auto">
                    <div className="flex items-center gap-3 mb-6">
                      {isEditingTitle ? (
                        <input
                          ref={titleInputRef}
                          type="text"
                          value={titleValue}
                          onChange={(e) => setTitleValue(e.target.value)}
                          onBlur={handleSaveTitle}
                          onKeyDown={handleTitleKeyDown}
                          disabled={isSaving}
                          className="flex-1 text-xl font-heading font-bold text-text bg-surface-alt border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                      ) : (
                        <h2 className="flex-1 text-xl font-heading font-bold text-text truncate">
                          {styleRef.title || 'Untitled Reference'}
                        </h2>
                      )}

                      {isEditingTitle ? (
                        <button
                          onClick={handleSaveTitle}
                          disabled={isSaving}
                          className="p-2 bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors"
                        >
                          <CheckIcon className="w-5 h-5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => setIsEditingTitle(true)}
                          className="p-2 bg-surface-alt hover:bg-border text-text-secondary rounded-lg transition-colors"
                          title="Rename"
                        >
                          <PencilIcon className="w-5 h-5" />
                        </button>
                      )}

                      <button
                        onClick={handleDeleteClick}
                        className="p-2 bg-surface-alt hover:bg-error/20 hover:text-error text-text-secondary rounded-lg transition-colors"
                        title="Delete"
                      >
                        <TrashIcon className="w-5 h-5" />
                      </button>
                    </div>

                    {analysisFields.length > 0 && (
                      <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
                          Style Analysis
                        </h3>
                        {analysisFields.map((field) => (
                          <div key={field.label}>
                            <h4 className="text-sm font-medium text-text mb-1">{field.label}</h4>
                            <p className="text-sm text-text-secondary leading-relaxed">{field.value}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {analysisFields.length === 0 && (
                      <p className="text-text-secondary text-sm">
                        No style analysis available for this reference.
                      </p>
                    )}
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
