import { useState, useEffect, useRef, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, PencilIcon, TrashIcon, CheckIcon } from '@heroicons/react/24/outline';
import type { StyleReference } from '../../types';
import { useUpdateStyleReference } from '../../hooks/useApiQueries';

interface StyleReferenceModalProps {
  styleRef: StyleReference | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (id: number, data: Partial<Pick<StyleReference, 'title'>>) => void;
  onDelete: (id: number) => void;
}

export default function StyleReferenceModal({
  styleRef,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
}: StyleReferenceModalProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);
  const updateMutation = useUpdateStyleReference();

  useEffect(() => {
    if (styleRef) {
      setTitleValue(styleRef.title || 'Untitled Reference');
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

  const handleSaveTitle = () => {
    const trimmed = titleValue.trim();
    if (!trimmed || trimmed === styleRef.title) {
      setTitleValue(styleRef.title || 'Untitled Reference');
      setIsEditingTitle(false);
      return;
    }
    updateMutation.mutate({ id: styleRef.id, data: { title: trimmed } });
    onUpdate(styleRef.id, { title: trimmed });
    setIsEditingTitle(false);
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
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-surface shadow-xl transition-all">
                <div className="relative">
                  <button
                    onClick={onClose}
                    className="absolute top-3 right-3 z-10 p-2 bg-black/40 hover:bg-black/60 rounded-full backdrop-blur-sm transition-colors"
                  >
                    <XMarkIcon className="w-5 h-5 text-white" />
                  </button>

                  <div className="aspect-[2/3] w-full flex items-center justify-center p-4 bg-black/20">
                    <img
                      src={styleRef.image_url}
                      alt={styleRef.title || 'Style reference'}
                      crossOrigin="anonymous"
                      className="max-w-full max-h-full object-contain rounded-lg"
                    />
                  </div>

                  <div className="p-6">
                    <div className="flex items-center gap-3">
                      {isEditingTitle ? (
                        <input
                          ref={titleInputRef}
                          type="text"
                          value={titleValue}
                          onChange={(e) => setTitleValue(e.target.value)}
                          onBlur={handleSaveTitle}
                          onKeyDown={handleTitleKeyDown}
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
