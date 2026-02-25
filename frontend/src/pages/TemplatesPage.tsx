import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { generationApi } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorState from '../components/common/ErrorState';
import {
  useAspectRatios,
  useCoverTemplates,
  useDeleteCoverTemplate,
  useTemplateFonts,
  queryKeys,
} from '../hooks/useApiQueries';
import type { CoverTemplate, CoverTemplateInput, CoverTemplateTextBox } from '../types';

type ApiErrorShape = {
  response?: {
    data?: {
      error?: string;
    };
  };
};

type EditableBoxKey = 'title_box' | 'author_box';

const DEFAULT_TITLE_BOX: CoverTemplateTextBox = {
  x: 8,
  y: 9,
  width: 84,
  height: 24,
  font_family: 'Space Grotesk',
  font_size: 128,
  font_weight: 700,
  font_color: '#FFFFFF',
  text_align: 'center',
  line_height: 1.05,
  letter_spacing: 0,
  uppercase: false,
  italic: false,
  shadow_color: '#00000099',
  shadow_blur: 8,
  shadow_x: 0,
  shadow_y: 2,
  opacity: 1,
};

const DEFAULT_AUTHOR_BOX: CoverTemplateTextBox = {
  x: 8,
  y: 80,
  width: 84,
  height: 12,
  font_family: 'Space Grotesk',
  font_size: 62,
  font_weight: 600,
  font_color: '#FFFFFF',
  text_align: 'center',
  line_height: 1.05,
  letter_spacing: 1.4,
  uppercase: true,
  italic: false,
  shadow_color: '#00000099',
  shadow_blur: 6,
  shadow_x: 0,
  shadow_y: 2,
  opacity: 1,
};

const FALLBACK_FONTS = [
  'Space Grotesk',
  'DM Sans',
  'Playfair Display',
  'Merriweather',
  'Bebas Neue',
  'Oswald',
  'Inter',
  'Manrope',
  'Montserrat',
  'Lora',
  'Cormorant Garamond',
  'Libre Baskerville',
  'Cinzel',
  'Abril Fatface',
];

const FONT_WEIGHT_OPTIONS = [300, 400, 500, 600, 700, 800, 900];
const MAX_TEMPLATE_TEST_IMAGE_SIZE = 7 * 1024 * 1024;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

function createDraftTemplate(aspectRatio = '2:3', name = 'Untitled Template'): CoverTemplateInput {
  return {
    name,
    aspect_ratio: aspectRatio,
    title_box: { ...DEFAULT_TITLE_BOX },
    author_box: { ...DEFAULT_AUTHOR_BOX },
  };
}

function toDraftTemplate(template: CoverTemplate): CoverTemplateInput {
  return {
    name: template.name,
    aspect_ratio: template.aspect_ratio,
    title_box: { ...template.title_box },
    author_box: { ...template.author_box },
  };
}

function alignToJustify(textAlign: string) {
  if (textAlign === 'left') return 'flex-start';
  if (textAlign === 'right') return 'flex-end';
  return 'center';
}

function getErrorMessage(error: unknown, fallback: string) {
  const typedError = error as ApiErrorShape;
  return typedError.response?.data?.error || fallback;
}

function resizeTemplateTestImage(file: File, maxDim = 2400): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;

        if (width <= maxDim && height <= maxDim && file.size <= MAX_TEMPLATE_TEST_IMAGE_SIZE) {
          resolve(reader.result as string);
          return;
        }

        const scale = Math.min(maxDim / width, maxDim / height, 1);
        width = Math.round(width * scale);
        height = Math.round(height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Unable to process image'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function TemplatesPage() {
  const queryClient = useQueryClient();
  const { data: coverTemplates = [], isLoading, error, refetch } = useCoverTemplates();
  const { data: templateFonts = [] } = useTemplateFonts();
  const { data: aspectRatios = {} } = useAspectRatios();
  const deleteTemplateMutation = useDeleteCoverTemplate();

  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [draftTemplate, setDraftTemplate] = useState<CoverTemplateInput>(() => createDraftTemplate());
  const [activeBoxKey, setActiveBoxKey] = useState<EditableBoxKey>('title_box');
  const [editingTextBoxKey, setEditingTextBoxKey] = useState<EditableBoxKey | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [testImageData, setTestImageData] = useState<string | null>(null);
  const [renderedTestImage, setRenderedTestImage] = useState<string | null>(null);
  const [testBookTitle, setTestBookTitle] = useState('Sample Book Title');
  const [testAuthorName, setTestAuthorName] = useState('AUTHOR NAME');
  const [isRenderingTestImage, setIsRenderingTestImage] = useState(false);
  const [testRenderError, setTestRenderError] = useState<string | null>(null);
  const [canvasPreviewScale, setCanvasPreviewScale] = useState(0.28);

  const canvasRef = useRef<HTMLDivElement>(null);
  const testImageInputRef = useRef<HTMLInputElement>(null);
  const didInitializeSelectionRef = useRef(false);
  const interactionRef = useRef<{
    mode: 'move' | 'resize';
    boxKey: EditableBoxKey;
    startX: number;
    startY: number;
    startBox: CoverTemplateTextBox;
    rect: DOMRect;
  } | null>(null);

  const availableFonts = useMemo(
    () => Array.from(new Set([...FALLBACK_FONTS, ...templateFonts])),
    [templateFonts]
  );

  const activeTemplate = useMemo(
    () => coverTemplates.find((template) => template.id === selectedTemplateId) || null,
    [coverTemplates, selectedTemplateId]
  );

  const hasUnsavedChanges = useMemo(() => {
    if (!activeTemplate) {
      return false;
    }
    return JSON.stringify(toDraftTemplate(activeTemplate)) !== JSON.stringify(draftTemplate);
  }, [activeTemplate, draftTemplate]);

  const ratioInfo = aspectRatios[draftTemplate.aspect_ratio] || aspectRatios['2:3'] || { width: 1600, height: 2400, name: 'Kindle Standard' };

  const activeBoxText = activeBoxKey === 'title_box' ? testBookTitle : testAuthorName;

  const setActiveBoxText = (value: string) => {
    if (activeBoxKey === 'title_box') {
      setTestBookTitle(value);
      return;
    }
    setTestAuthorName(value);
  };

  const setBoxText = (boxKey: EditableBoxKey, value: string) => {
    if (boxKey === 'title_box') {
      setTestBookTitle(value);
      return;
    }
    setTestAuthorName(value);
  };

  const updateBox = useCallback((boxKey: EditableBoxKey, updates: Partial<CoverTemplateTextBox>) => {
    setDraftTemplate((prev) => ({
      ...prev,
      [boxKey]: {
        ...prev[boxKey],
        ...updates,
      },
    }));
  }, []);

  useEffect(() => {
    if (coverTemplates.length === 0) {
      didInitializeSelectionRef.current = true;
      setSelectedTemplateId(null);
      setDraftTemplate(createDraftTemplate());
      return;
    }

    if (!didInitializeSelectionRef.current) {
      const firstTemplate = coverTemplates[0];
      setSelectedTemplateId(firstTemplate.id);
      setDraftTemplate(toDraftTemplate(firstTemplate));
      didInitializeSelectionRef.current = true;
      return;
    }

    if (selectedTemplateId === null) {
      return;
    }

    const currentTemplate = coverTemplates.find((template) => template.id === selectedTemplateId);
    if (!currentTemplate) {
      const fallbackTemplate = coverTemplates[0];
      setSelectedTemplateId(fallbackTemplate.id);
      setDraftTemplate(toDraftTemplate(fallbackTemplate));
    }
  }, [coverTemplates, selectedTemplateId]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!canvasRef.current) {
      return;
    }

    const element = canvasRef.current;

    const updateScale = () => {
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || ratioInfo.width <= 0) {
        return;
      }
      setCanvasPreviewScale(rect.width / ratioInfo.width);
    };

    updateScale();

    const observer = new ResizeObserver(updateScale);
    observer.observe(element);
    window.addEventListener('resize', updateScale);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, [ratioInfo.width, isLoading, selectedTemplateId]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const interaction = interactionRef.current;
      if (!interaction) {
        return;
      }

      const dxPercent = ((event.clientX - interaction.startX) / interaction.rect.width) * 100;
      const dyPercent = ((event.clientY - interaction.startY) / interaction.rect.height) * 100;

      if (interaction.mode === 'move') {
        const nextX = clamp(interaction.startBox.x + dxPercent, 0, 100 - interaction.startBox.width);
        const nextY = clamp(interaction.startBox.y + dyPercent, 0, 100 - interaction.startBox.height);
        updateBox(interaction.boxKey, { x: round(nextX), y: round(nextY) });
        return;
      }

      const nextWidth = clamp(interaction.startBox.width + dxPercent, 5, 100 - interaction.startBox.x);
      const nextHeight = clamp(interaction.startBox.height + dyPercent, 5, 100 - interaction.startBox.y);
      updateBox(interaction.boxKey, { width: round(nextWidth), height: round(nextHeight) });
    };

    const handlePointerUp = () => {
      interactionRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [updateBox]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (editingTextBoxKey) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      if (tagName === 'input' || tagName === 'textarea' || target?.isContentEditable) {
        return;
      }

      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        return;
      }

      event.preventDefault();

      const step = event.shiftKey ? 1 : 0.25;
      const box = draftTemplate[activeBoxKey];

      if (event.key === 'ArrowUp') {
        updateBox(activeBoxKey, { y: round(clamp(box.y - step, 0, 100 - box.height)) });
        return;
      }
      if (event.key === 'ArrowDown') {
        updateBox(activeBoxKey, { y: round(clamp(box.y + step, 0, 100 - box.height)) });
        return;
      }
      if (event.key === 'ArrowLeft') {
        updateBox(activeBoxKey, { x: round(clamp(box.x - step, 0, 100 - box.width)) });
        return;
      }

      updateBox(activeBoxKey, { x: round(clamp(box.x + step, 0, 100 - box.width)) });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeBoxKey, draftTemplate, editingTextBoxKey, updateBox]);

  const beginInteraction = (event: React.PointerEvent, boxKey: EditableBoxKey, mode: 'move' | 'resize') => {
    if (!canvasRef.current) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const box = draftTemplate[boxKey];
    interactionRef.current = {
      mode,
      boxKey,
      startX: event.clientX,
      startY: event.clientY,
      startBox: { ...box },
      rect: canvasRef.current.getBoundingClientRect(),
    };
    setActiveBoxKey(boxKey);
    setEditingTextBoxKey(null);
  };

  const confirmDiscardChanges = () => {
    if (!hasUnsavedChanges) {
      return true;
    }
    return confirm('Discard unsaved changes to this template?');
  };

  const selectTemplate = (templateId: number) => {
    if (selectedTemplateId === templateId) {
      return;
    }

    if (!confirmDiscardChanges()) {
      return;
    }

    const found = coverTemplates.find((template) => template.id === templateId);
    if (!found) {
      return;
    }

    setSelectedTemplateId(templateId);
    setDraftTemplate(toDraftTemplate(found));
    setActiveBoxKey('title_box');
    setEditingTextBoxKey(null);
  };

  const createNewTemplate = () => {
    if (!confirmDiscardChanges()) {
      return;
    }

    const nextAspectRatio = activeTemplate?.aspect_ratio || draftTemplate.aspect_ratio;
    setSelectedTemplateId(null);
    setDraftTemplate(createDraftTemplate(nextAspectRatio, `Template ${coverTemplates.length + 1}`));
    setActiveBoxKey('title_box');
    setEditingTextBoxKey(null);
  };

  const handleTestImageFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    try {
      const dataUrl = await resizeTemplateTestImage(file);
      setTestImageData(dataUrl);
      setRenderedTestImage(null);
      setTestRenderError(null);
    } catch {
      toast.error('Failed to process image');
    }
  }, []);

  const handleTestImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      void handleTestImageFile(file);
    }
    event.target.value = '';
  };

  const clearTestImages = () => {
    setTestImageData(null);
    setRenderedTestImage(null);
    setTestRenderError(null);
  };

  const renderTemplateTestImage = async () => {
    if (!testImageData) {
      toast.error('Upload a test image first');
      return;
    }

    setIsRenderingTestImage(true);
    setTestRenderError(null);

    try {
      const result = await generationApi.renderTemplatePreview({
        image: testImageData,
        template: draftTemplate,
        book_title: testBookTitle,
        author_name: testAuthorName,
      });

      setRenderedTestImage(result.image);
    } catch (renderError: unknown) {
      const message = getErrorMessage(renderError, 'Failed to render preview');
      setTestRenderError(message);
      toast.error(message);
    } finally {
      setIsRenderingTestImage(false);
    }
  };

  const saveTemplate = async () => {
    const name = draftTemplate.name.trim();
    if (!name) {
      toast.error('Template name is required');
      return;
    }

    setIsSaving(true);
    try {
      if (selectedTemplateId === null) {
        const created = await generationApi.createCoverTemplate({
          ...draftTemplate,
          name,
        });
        queryClient.setQueryData<CoverTemplate[]>(queryKeys.coverTemplates, (old) =>
          old ? [created, ...old] : [created]
        );
        setSelectedTemplateId(created.id);
        setDraftTemplate(toDraftTemplate(created));
        setEditingTextBoxKey(null);
        toast.success('Template created');
      } else {
        const updated = await generationApi.updateCoverTemplate(selectedTemplateId, {
          ...draftTemplate,
          name,
        });
        queryClient.setQueryData<CoverTemplate[]>(
          queryKeys.coverTemplates,
          (old) => old?.map((template) => (template.id === updated.id ? updated : template)) ?? [updated]
        );
        setDraftTemplate(toDraftTemplate(updated));
        setEditingTextBoxKey(null);
        toast.success('Template updated');
      }
    } catch (saveError: unknown) {
      toast.error(getErrorMessage(saveError, 'Failed to save template'));
    } finally {
      setIsSaving(false);
    }
  };

  const deleteTemplate = (templateId?: number) => {
    const deletingTemplateId = templateId ?? selectedTemplateId;
    if (deletingTemplateId === null || deletingTemplateId === undefined) {
      return;
    }

    const deletingTemplate = coverTemplates.find((template) => template.id === deletingTemplateId);
    const deleteLabel = deletingTemplate?.name || 'this template';

    if (!confirm(`Delete ${deleteLabel}? This cannot be undone.`)) {
      return;
    }

    deleteTemplateMutation.mutate(deletingTemplateId, {
      onSuccess: () => {
        toast.success('Template deleted');
        const remaining = coverTemplates.filter((template) => template.id !== deletingTemplateId);
        if (remaining.length === 0) {
          setSelectedTemplateId(null);
          setDraftTemplate(createDraftTemplate());
          setEditingTextBoxKey(null);
          return;
        }

        if (selectedTemplateId === deletingTemplateId) {
          const nextTemplate = remaining[0];
          setSelectedTemplateId(nextTemplate.id);
          setDraftTemplate(toDraftTemplate(nextTemplate));
          setActiveBoxKey('title_box');
          setEditingTextBoxKey(null);
        }
      },
    });
  };

  const updateNumericField = (boxKey: EditableBoxKey, field: keyof CoverTemplateTextBox, rawValue: string) => {
    const value = Number(rawValue);
    if (Number.isNaN(value)) {
      return;
    }

    const box = draftTemplate[boxKey];
    if (field === 'x') {
      updateBox(boxKey, { x: round(clamp(value, 0, 100 - box.width)) });
      return;
    }
    if (field === 'y') {
      updateBox(boxKey, { y: round(clamp(value, 0, 100 - box.height)) });
      return;
    }
    if (field === 'width') {
      updateBox(boxKey, { width: round(clamp(value, 5, 100 - box.x)) });
      return;
    }
    if (field === 'height') {
      updateBox(boxKey, { height: round(clamp(value, 5, 100 - box.y)) });
      return;
    }
    if (field === 'font_size') {
      updateBox(boxKey, { font_size: Math.round(clamp(value, 8, 400)) });
      return;
    }
    if (field === 'line_height') {
      updateBox(boxKey, { line_height: round(clamp(value, 0.8, 3)) });
      return;
    }
    if (field === 'letter_spacing') {
      updateBox(boxKey, { letter_spacing: round(clamp(value, -10, 20)) });
      return;
    }
    if (field === 'shadow_blur') {
      updateBox(boxKey, { shadow_blur: Math.round(clamp(value, 0, 60)) });
      return;
    }
    if (field === 'shadow_x') {
      updateBox(boxKey, { shadow_x: Math.round(clamp(value, -40, 40)) });
      return;
    }
    if (field === 'shadow_y') {
      updateBox(boxKey, { shadow_y: Math.round(clamp(value, -40, 40)) });
      return;
    }
    if (field === 'opacity') {
      updateBox(boxKey, { opacity: round(clamp(value, 0, 1)) });
    }
  };

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error.message || 'Failed to load templates'} onRetry={refetch} />;

  const activeBox = draftTemplate[activeBoxKey];
  const previewTitle = testBookTitle || 'Sample Book Title';
  const previewAuthor = testAuthorName || 'AUTHOR NAME';

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-text tracking-tight">Cover Templates</h1>
        <p className="text-sm text-text-secondary mt-1">
          Build reusable title and author layouts with a card gallery and compact editor.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-text-muted">Select a template card to edit, or create a new one.</p>
          <div className="flex items-center gap-2">
            {hasUnsavedChanges && (
              <span className="text-xs text-accent px-2 py-1 rounded-full bg-accent/10 border border-accent/20">
                Unsaved
              </span>
            )}
            <button
              type="button"
              onClick={createNewTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-border rounded-lg text-text-secondary hover:text-text hover:bg-surface-alt transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              New Template
            </button>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={createNewTemplate}
            className={`rounded-2xl border-2 border-dashed p-3 text-left transition-colors ${
              selectedTemplateId === null
                ? 'border-accent bg-accent/5'
                : 'border-border hover:border-accent/40 hover:bg-surface-alt/50'
            }`}
          >
            <div className="flex items-center justify-center rounded-xl border border-border bg-surface-alt/70" style={{ aspectRatio: '2 / 3' }}>
              <div className="text-center text-text-muted">
                <PlusIcon className="w-6 h-6 mx-auto" />
                <p className="text-xs mt-1">Start new layout</p>
              </div>
            </div>
            <p className="mt-2 text-sm font-medium text-text truncate">{selectedTemplateId === null ? draftTemplate.name : 'Untitled Template'}</p>
            <p className="text-xs text-text-muted">Draft</p>
          </button>

          {coverTemplates.map((template) => {
            const templateRatio = aspectRatios[template.aspect_ratio] || aspectRatios['2:3'] || { width: 1600, height: 2400, name: 'Kindle Standard' };
            const isSelected = selectedTemplateId === template.id;
            const cardScale = 0.12;

            return (
              <div
                key={template.id}
                className={`group relative rounded-2xl border transition-colors ${
                  isSelected ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/40'
                }`}
              >
                <button
                  type="button"
                  onClick={() => selectTemplate(template.id)}
                  className="w-full text-left p-3"
                >
                  <div
                    className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900"
                    style={{ aspectRatio: `${templateRatio.width} / ${templateRatio.height}` }}
                  >
                    {(['title_box', 'author_box'] as EditableBoxKey[]).map((boxKey) => {
                      const box = template[boxKey];
                      const text = boxKey === 'title_box' ? previewTitle : previewAuthor;
                      return (
                        <div
                          key={boxKey}
                          className="absolute"
                          style={{
                            left: `${box.x}%`,
                            top: `${box.y}%`,
                            width: `${box.width}%`,
                            height: `${box.height}%`,
                            color: box.font_color,
                            fontFamily: box.font_family,
                            fontSize: `${Math.max(6, box.font_size * cardScale)}px`,
                            fontWeight: box.font_weight,
                            textAlign: box.text_align,
                            lineHeight: box.line_height,
                            letterSpacing: `${box.letter_spacing * cardScale}px`,
                            textTransform: box.uppercase ? 'uppercase' : 'none',
                            fontStyle: box.italic ? 'italic' : 'normal',
                            textShadow: `${box.shadow_x * cardScale}px ${box.shadow_y * cardScale}px ${box.shadow_blur * cardScale}px ${box.shadow_color}`,
                            opacity: box.opacity,
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: alignToJustify(box.text_align),
                            overflow: 'hidden',
                            whiteSpace: 'pre-wrap',
                            overflowWrap: 'break-word',
                            wordBreak: 'break-word',
                            padding: '0.18em',
                          }}
                        >
                          {text}
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-2">
                    <p className="text-sm font-medium text-text truncate">{template.name}</p>
                    <p className="text-xs text-text-muted">{templateRatio.name} ({template.aspect_ratio})</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    deleteTemplate(template.id);
                  }}
                  disabled={deleteTemplateMutation.isPending}
                  className="absolute top-2 right-2 p-1.5 rounded-lg border border-transparent text-text-muted bg-surface/70 hover:text-error hover:border-error-border hover:bg-error-bg transition-colors disabled:opacity-40"
                  aria-label="Delete template"
                  title="Delete template"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid xl:grid-cols-[minmax(0,520px)_minmax(0,1fr)] gap-6 items-start">
        <div className="space-y-4">
          <div className="bg-surface border border-border rounded-2xl p-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-medium text-text">Canvas Editor</h2>
                <p className="text-xs text-text-muted mt-1">
                  Click to select. Double-click text to edit. Drag to move and resize.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {selectedTemplateId !== null && (
                  <button
                    type="button"
                    onClick={() => deleteTemplate()}
                    disabled={deleteTemplateMutation.isPending}
                    className="px-2.5 py-1.5 text-xs font-medium border border-error-border rounded-lg text-error hover:bg-error-bg disabled:opacity-40"
                  >
                    Delete
                  </button>
                )}
                <button
                  type="button"
                  onClick={saveTemplate}
                  disabled={isSaving}
                  className="px-3 py-1.5 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent-hover disabled:opacity-40"
                >
                  {isSaving ? 'Saving...' : selectedTemplateId === null ? 'Create Template' : 'Save Changes'}
                </button>
              </div>
            </div>

            <div className="grid sm:grid-cols-[auto_1fr] gap-2 items-end">
              <div className="inline-flex border border-border rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setActiveBoxKey('title_box')}
                  className={`px-3 py-1.5 text-xs font-medium ${activeBoxKey === 'title_box' ? 'bg-accent text-white' : 'bg-surface-alt text-text-secondary hover:text-text'}`}
                >
                  Title
                </button>
                <button
                  type="button"
                  onClick={() => setActiveBoxKey('author_box')}
                  className={`px-3 py-1.5 text-xs font-medium ${activeBoxKey === 'author_box' ? 'bg-accent text-white' : 'bg-surface-alt text-text-secondary hover:text-text'}`}
                >
                  Author
                </button>
              </div>

              <div>
                <label className="block text-xs text-text-muted mb-1">Active text</label>
                <input
                  value={activeBoxText}
                  onChange={(event) => setActiveBoxText(event.target.value)}
                  className="w-full px-2 py-1.5 bg-surface-alt border border-border rounded text-sm"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-[minmax(0,1fr)_92px_84px_auto] gap-2 items-end">
              <div>
                <label className="block text-xs text-text-muted mb-1">Font</label>
                <select
                  value={activeBox.font_family}
                  onChange={(event) => updateBox(activeBoxKey, { font_family: event.target.value })}
                  className="w-full px-2 py-1.5 bg-surface-alt border border-border rounded text-sm"
                >
                  {availableFonts.map((font) => (
                    <option key={font} value={font}>{font}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-text-muted mb-1">Size</label>
                <input
                  type="number"
                  value={activeBox.font_size}
                  onChange={(event) => updateNumericField(activeBoxKey, 'font_size', event.target.value)}
                  className="w-full px-2 py-1.5 bg-surface-alt border border-border rounded text-sm"
                />
              </div>

              <div>
                <label className="block text-xs text-text-muted mb-1">Color</label>
                <input
                  type="color"
                  value={activeBox.font_color}
                  onChange={(event) => updateBox(activeBoxKey, { font_color: event.target.value.toUpperCase() })}
                  className="w-full h-8 bg-surface-alt border border-border rounded"
                />
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => updateBox(activeBoxKey, { text_align: 'left' })}
                  className={`px-2 py-1.5 text-xs border rounded ${activeBox.text_align === 'left' ? 'bg-accent text-white border-accent' : 'border-border text-text-secondary hover:text-text'}`}
                >
                  L
                </button>
                <button
                  type="button"
                  onClick={() => updateBox(activeBoxKey, { text_align: 'center' })}
                  className={`px-2 py-1.5 text-xs border rounded ${activeBox.text_align === 'center' ? 'bg-accent text-white border-accent' : 'border-border text-text-secondary hover:text-text'}`}
                >
                  C
                </button>
                <button
                  type="button"
                  onClick={() => updateBox(activeBoxKey, { text_align: 'right' })}
                  className={`px-2 py-1.5 text-xs border rounded ${activeBox.text_align === 'right' ? 'bg-accent text-white border-accent' : 'border-border text-text-secondary hover:text-text'}`}
                >
                  R
                </button>
              </div>
            </div>

            <div className="mx-auto w-full max-w-[430px]">
              <div className="mb-2 flex items-center justify-between text-xs text-text-muted">
                <span>{ratioInfo.name}</span>
                <span>Arrow keys move text (Shift = faster)</span>
              </div>
              <div
                ref={canvasRef}
                className="relative w-full overflow-hidden rounded-xl border border-border shadow-inner select-none"
                style={{
                  aspectRatio: `${ratioInfo.width} / ${ratioInfo.height}`,
                  backgroundImage: testImageData
                    ? `url(${testImageData})`
                    : 'linear-gradient(135deg, #1f2937 0%, #374151 38%, #111827 100%)',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                }}
              >
                {(['title_box', 'author_box'] as EditableBoxKey[]).map((boxKey) => {
                  const box = draftTemplate[boxKey];
                  const isActive = boxKey === activeBoxKey;
                  const isEditingText = boxKey === editingTextBoxKey;
                  const text = boxKey === 'title_box' ? previewTitle : previewAuthor;

                  return (
                    <div
                      key={boxKey}
                      role="button"
                      tabIndex={0}
                      onPointerDown={(event) => beginInteraction(event, boxKey, 'move')}
                      onClick={() => setActiveBoxKey(boxKey)}
                      onDoubleClick={(event) => {
                        event.preventDefault();
                        setActiveBoxKey(boxKey);
                        setEditingTextBoxKey(boxKey);
                      }}
                      className={`absolute rounded-sm cursor-move ${isActive ? 'border-2 border-accent' : 'border border-white/60'}`}
                      style={{
                        left: `${box.x}%`,
                        top: `${box.y}%`,
                        width: `${box.width}%`,
                        height: `${box.height}%`,
                        color: box.font_color,
                        fontFamily: box.font_family,
                        fontSize: `${Math.max(8, box.font_size * canvasPreviewScale)}px`,
                        fontWeight: box.font_weight,
                        textAlign: box.text_align,
                        lineHeight: box.line_height,
                        letterSpacing: `${box.letter_spacing * canvasPreviewScale}px`,
                        textTransform: box.uppercase ? 'uppercase' : 'none',
                        fontStyle: box.italic ? 'italic' : 'normal',
                        textShadow: `${box.shadow_x * canvasPreviewScale}px ${box.shadow_y * canvasPreviewScale}px ${box.shadow_blur * canvasPreviewScale}px ${box.shadow_color}`,
                        opacity: box.opacity,
                        boxSizing: 'border-box',
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: alignToJustify(box.text_align),
                        overflow: 'hidden',
                        whiteSpace: 'pre-wrap',
                        overflowWrap: 'break-word',
                        wordBreak: 'break-word',
                        padding: '0.2em',
                      }}
                    >
                      {isEditingText ? (
                        <textarea
                          autoFocus
                          value={text}
                          onPointerDown={(event) => event.stopPropagation()}
                          onChange={(event) => setBoxText(boxKey, event.target.value)}
                          onBlur={() => setEditingTextBoxKey(null)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.shiftKey) {
                              event.preventDefault();
                              setEditingTextBoxKey(null);
                            }
                          }}
                          className="w-full h-full bg-transparent resize-none outline-none"
                          style={{
                            color: 'inherit',
                            font: 'inherit',
                            letterSpacing: 'inherit',
                            textTransform: 'none',
                          }}
                        />
                      ) : (
                        text
                      )}

                      <button
                        type="button"
                        onPointerDown={(event) => beginInteraction(event, boxKey, 'resize')}
                        className={`absolute -bottom-1.5 -right-1.5 w-4 h-4 rounded-sm border ${
                          isActive ? 'bg-accent border-accent' : 'bg-white border-white/90'
                        }`}
                        aria-label={`Resize ${boxKey}`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-medium text-text">Template render test</h2>
                <p className="text-xs text-text-muted mt-1">
                  Upload any image and render with backend template engine. No credits. Nothing is saved.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => testImageInputRef.current?.click()}
                  className="px-3 py-2 text-sm font-medium border border-border rounded-lg text-text-secondary hover:text-text hover:bg-surface-alt transition-colors"
                >
                  Upload Image
                </button>
                <button
                  type="button"
                  onClick={clearTestImages}
                  disabled={!testImageData && !renderedTestImage}
                  className="px-3 py-2 text-sm font-medium border border-border rounded-lg text-text-secondary hover:text-text hover:bg-surface-alt disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Clear
                </button>
              </div>
              <input
                ref={testImageInputRef}
                type="file"
                accept="image/*"
                onChange={handleTestImageChange}
                className="hidden"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-text-muted mb-1">Test title</label>
                <input
                  value={testBookTitle}
                  onChange={(event) => setTestBookTitle(event.target.value)}
                  className="w-full px-2 py-1.5 bg-surface-alt border border-border rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Test author</label>
                <input
                  value={testAuthorName}
                  onChange={(event) => setTestAuthorName(event.target.value)}
                  className="w-full px-2 py-1.5 bg-surface-alt border border-border rounded text-sm"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={renderTemplateTestImage}
              disabled={!testImageData || isRenderingTestImage}
              className="w-full bg-accent text-white py-2 rounded-lg text-sm font-medium hover:bg-accent-hover disabled:opacity-40 transition-colors"
            >
              {isRenderingTestImage ? 'Rendering...' : 'Render Test Preview'}
            </button>

            {testRenderError && (
              <p className="text-xs text-error">{testRenderError}</p>
            )}

            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-text-muted mb-2">Source image (cover crop)</p>
                <div
                  className="overflow-hidden rounded-lg border border-border bg-surface-alt"
                  style={{ aspectRatio: `${ratioInfo.width} / ${ratioInfo.height}` }}
                >
                  {testImageData ? (
                    <img src={testImageData} alt="Template test source" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-text-muted px-4 text-center">
                      Upload an image to test cropping and render output.
                    </div>
                  )}
                </div>
              </div>

              <div>
                <p className="text-xs text-text-muted mb-2">Rendered output</p>
                <div
                  className="overflow-hidden rounded-lg border border-border bg-surface-alt"
                  style={{ aspectRatio: `${ratioInfo.width} / ${ratioInfo.height}` }}
                >
                  {renderedTestImage ? (
                    <img src={renderedTestImage} alt="Template render output" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-text-muted px-4 text-center">
                      Render preview to verify exact backend placement.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-surface border border-border rounded-2xl p-4 space-y-3">
            <h2 className="text-sm font-medium text-text">Template Settings</h2>

            <div>
              <label className="block text-xs text-text-muted mb-1">Template name</label>
              <input
                value={draftTemplate.name}
                onChange={(event) => setDraftTemplate((prev) => ({ ...prev, name: event.target.value }))}
                className="w-full px-3 py-2 bg-surface-alt border border-border rounded-lg text-sm"
                placeholder="Template name"
              />
            </div>

            <div>
              <label className="block text-xs text-text-muted mb-1">Cover format</label>
              <select
                value={draftTemplate.aspect_ratio}
                onChange={(event) => setDraftTemplate((prev) => ({ ...prev, aspect_ratio: event.target.value }))}
                className="w-full px-3 py-2 bg-surface-alt border border-border rounded-lg text-sm"
              >
                {Object.entries(aspectRatios).map(([ratio, info]) => (
                  <option key={ratio} value={ratio}>{info.name} ({ratio})</option>
                ))}
              </select>
            </div>
          </div>

          <details open className="bg-surface border border-border rounded-2xl p-4">
            <summary className="cursor-pointer text-sm font-medium text-text">Layout</summary>
            <div className="grid sm:grid-cols-2 gap-2 mt-3">
              <div>
                <label className="block text-xs text-text-muted mb-1">X %</label>
                <input
                  type="number"
                  value={activeBox.x}
                  onChange={(event) => updateNumericField(activeBoxKey, 'x', event.target.value)}
                  className="w-full px-2 py-1.5 bg-surface-alt border border-border rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Y %</label>
                <input
                  type="number"
                  value={activeBox.y}
                  onChange={(event) => updateNumericField(activeBoxKey, 'y', event.target.value)}
                  className="w-full px-2 py-1.5 bg-surface-alt border border-border rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Width %</label>
                <input
                  type="number"
                  value={activeBox.width}
                  onChange={(event) => updateNumericField(activeBoxKey, 'width', event.target.value)}
                  className="w-full px-2 py-1.5 bg-surface-alt border border-border rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Height %</label>
                <input
                  type="number"
                  value={activeBox.height}
                  onChange={(event) => updateNumericField(activeBoxKey, 'height', event.target.value)}
                  className="w-full px-2 py-1.5 bg-surface-alt border border-border rounded text-sm"
                />
              </div>
            </div>
          </details>

          <details open className="bg-surface border border-border rounded-2xl p-4">
            <summary className="cursor-pointer text-sm font-medium text-text">Typography</summary>
            <div className="grid sm:grid-cols-2 gap-2 mt-3">
              <div>
                <label className="block text-xs text-text-muted mb-1">Weight</label>
                <select
                  value={activeBox.font_weight}
                  onChange={(event) => updateBox(activeBoxKey, { font_weight: Number(event.target.value) })}
                  className="w-full px-2 py-1.5 bg-surface-alt border border-border rounded text-sm"
                >
                  {FONT_WEIGHT_OPTIONS.map((weight) => (
                    <option key={weight} value={weight}>{weight}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Line height</label>
                <input
                  type="number"
                  step="0.05"
                  value={activeBox.line_height}
                  onChange={(event) => updateNumericField(activeBoxKey, 'line_height', event.target.value)}
                  className="w-full px-2 py-1.5 bg-surface-alt border border-border rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Letter spacing</label>
                <input
                  type="number"
                  step="0.1"
                  value={activeBox.letter_spacing}
                  onChange={(event) => updateNumericField(activeBoxKey, 'letter_spacing', event.target.value)}
                  className="w-full px-2 py-1.5 bg-surface-alt border border-border rounded text-sm"
                />
              </div>
              <div className="flex items-center gap-3 pt-5">
                <label className="flex items-center gap-1 text-xs text-text-secondary">
                  <input
                    type="checkbox"
                    checked={activeBox.uppercase}
                    onChange={(event) => updateBox(activeBoxKey, { uppercase: event.target.checked })}
                  />
                  Uppercase
                </label>
                <label className="flex items-center gap-1 text-xs text-text-secondary">
                  <input
                    type="checkbox"
                    checked={activeBox.italic}
                    onChange={(event) => updateBox(activeBoxKey, { italic: event.target.checked })}
                  />
                  Italic
                </label>
              </div>
            </div>
          </details>

          <details className="bg-surface border border-border rounded-2xl p-4">
            <summary className="cursor-pointer text-sm font-medium text-text">Effects</summary>
            <div className="grid sm:grid-cols-2 gap-2 mt-3">
              <div>
                <label className="block text-xs text-text-muted mb-1">Shadow color</label>
                <input
                  type="color"
                  value={activeBox.shadow_color.slice(0, 7)}
                  onChange={(event) => {
                    const alpha = activeBox.shadow_color.length === 9 ? activeBox.shadow_color.slice(7) : '99';
                    updateBox(activeBoxKey, { shadow_color: `${event.target.value.toUpperCase()}${alpha}` });
                  }}
                  className="w-full h-9 bg-surface-alt border border-border rounded"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Opacity</label>
                <input
                  type="number"
                  step="0.05"
                  value={activeBox.opacity}
                  onChange={(event) => updateNumericField(activeBoxKey, 'opacity', event.target.value)}
                  className="w-full px-2 py-1.5 bg-surface-alt border border-border rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Shadow blur</label>
                <input
                  type="number"
                  value={activeBox.shadow_blur}
                  onChange={(event) => updateNumericField(activeBoxKey, 'shadow_blur', event.target.value)}
                  className="w-full px-2 py-1.5 bg-surface-alt border border-border rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Shadow X</label>
                <input
                  type="number"
                  value={activeBox.shadow_x}
                  onChange={(event) => updateNumericField(activeBoxKey, 'shadow_x', event.target.value)}
                  className="w-full px-2 py-1.5 bg-surface-alt border border-border rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Shadow Y</label>
                <input
                  type="number"
                  value={activeBox.shadow_y}
                  onChange={(event) => updateNumericField(activeBoxKey, 'shadow_y', event.target.value)}
                  className="w-full px-2 py-1.5 bg-surface-alt border border-border rounded text-sm"
                />
              </div>
            </div>
          </details>
        </div>
      </div>

      {activeTemplate && (
        <p className="mt-4 text-xs text-text-muted">
          Editing template "{activeTemplate.name}".
        </p>
      )}
    </div>
  );
}
