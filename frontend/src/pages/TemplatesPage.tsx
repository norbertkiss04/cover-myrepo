import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
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
  const [isSaving, setIsSaving] = useState(false);
  const [testImageData, setTestImageData] = useState<string | null>(null);
  const [renderedTestImage, setRenderedTestImage] = useState<string | null>(null);
  const [testBookTitle, setTestBookTitle] = useState('Sample Book Title');
  const [testAuthorName, setTestAuthorName] = useState('AUTHOR NAME');
  const [isRenderingTestImage, setIsRenderingTestImage] = useState(false);
  const [testRenderError, setTestRenderError] = useState<string | null>(null);
  const [canvasPreviewScale, setCanvasPreviewScale] = useState(0.5);

  const canvasRef = useRef<HTMLDivElement>(null);
  const testImageInputRef = useRef<HTMLInputElement>(null);
  const interactionRef = useRef<{
    mode: 'move' | 'resize';
    boxKey: EditableBoxKey;
    startX: number;
    startY: number;
    startBox: CoverTemplateTextBox;
    rect: DOMRect;
  } | null>(null);

  const availableFonts = templateFonts.length > 0 ? templateFonts : FALLBACK_FONTS;

  const activeTemplate = useMemo(
    () => coverTemplates.find((template) => template.id === selectedTemplateId) || null,
    [coverTemplates, selectedTemplateId]
  );

  const ratioInfo = aspectRatios[draftTemplate.aspect_ratio] || aspectRatios['2:3'] || { width: 1600, height: 2400, name: 'Kindle Standard' };

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
      setSelectedTemplateId(null);
      setDraftTemplate(createDraftTemplate());
      return;
    }

    if (selectedTemplateId === null) {
      const firstTemplate = coverTemplates[0];
      setSelectedTemplateId(firstTemplate.id);
      setDraftTemplate(toDraftTemplate(firstTemplate));
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
  }, [ratioInfo.width]);

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
  };

  const selectTemplate = (templateId: number | null) => {
    if (templateId === null) {
      setSelectedTemplateId(null);
      setDraftTemplate(createDraftTemplate(draftTemplate.aspect_ratio));
      return;
    }

    const found = coverTemplates.find((template) => template.id === templateId);
    if (!found) {
      return;
    }

    setSelectedTemplateId(templateId);
    setDraftTemplate(toDraftTemplate(found));
  };

  const createNewTemplate = () => {
    setSelectedTemplateId(null);
    setDraftTemplate(createDraftTemplate(draftTemplate.aspect_ratio, `Template ${coverTemplates.length + 1}`));
    setActiveBoxKey('title_box');
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
        toast.success('Template updated');
      }
    } catch (saveError: unknown) {
      toast.error(getErrorMessage(saveError, 'Failed to save template'));
    } finally {
      setIsSaving(false);
    }
  };

  const deleteTemplate = () => {
    if (selectedTemplateId === null) {
      return;
    }

    if (!confirm('Delete this template? This cannot be undone.')) {
      return;
    }

    const deletingTemplateId = selectedTemplateId;
    deleteTemplateMutation.mutate(deletingTemplateId, {
      onSuccess: () => {
        toast.success('Template deleted');
        const remaining = coverTemplates.filter((template) => template.id !== deletingTemplateId);
        if (remaining.length === 0) {
          setSelectedTemplateId(null);
          setDraftTemplate(createDraftTemplate());
          return;
        }
        const nextTemplate = remaining[0];
        setSelectedTemplateId(nextTemplate.id);
        setDraftTemplate(toDraftTemplate(nextTemplate));
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

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-text tracking-tight">Cover Templates</h1>
        <p className="text-sm text-text-secondary mt-1">
          Build reusable title and author layouts. Rendering matches this browser canvas.
        </p>
      </div>

      <div className="grid xl:grid-cols-[340px_1fr] gap-6">
        <div className="space-y-4">
          <div className="bg-surface border border-border rounded-2xl p-4 space-y-3">
            <label className="block text-sm font-medium text-text-secondary">Template</label>
            <select
              value={selectedTemplateId ?? ''}
              onChange={(event) => {
                const value = event.target.value;
                selectTemplate(value ? Number(value) : null);
              }}
              className="w-full px-3 py-2 bg-surface-alt border border-border rounded-lg text-text text-sm"
            >
              <option value="">New template</option>
              {coverTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={createNewTemplate}
                className="px-3 py-2 text-sm font-medium border border-border rounded-lg text-text-secondary hover:text-text hover:bg-surface-alt transition-colors"
              >
                New
              </button>
              <button
                type="button"
                onClick={deleteTemplate}
                disabled={selectedTemplateId === null || deleteTemplateMutation.isPending}
                className="px-3 py-2 text-sm font-medium border border-error-border rounded-lg text-error hover:bg-error-bg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Delete
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Name</label>
              <input
                value={draftTemplate.name}
                onChange={(event) => setDraftTemplate((prev) => ({ ...prev, name: event.target.value }))}
                className="w-full px-3 py-2 bg-surface-alt border border-border rounded-lg text-text text-sm"
                placeholder="Template name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Cover Format</label>
              <select
                value={draftTemplate.aspect_ratio}
                onChange={(event) => setDraftTemplate((prev) => ({ ...prev, aspect_ratio: event.target.value }))}
                className="w-full px-3 py-2 bg-surface-alt border border-border rounded-lg text-text text-sm"
              >
                {Object.entries(aspectRatios).map(([ratio, info]) => (
                  <option key={ratio} value={ratio}>{info.name} ({ratio})</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={saveTemplate}
              disabled={isSaving}
              className="w-full bg-accent text-white py-2 rounded-lg text-sm font-medium hover:bg-accent-hover disabled:opacity-40 transition-colors"
            >
              {isSaving ? 'Saving...' : selectedTemplateId === null ? 'Create Template' : 'Save Changes'}
            </button>
          </div>

          <div className="bg-surface border border-border rounded-2xl p-4 space-y-2">
            <label className="block text-sm font-medium text-text-secondary">Edit Box</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setActiveBoxKey('title_box')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeBoxKey === 'title_box'
                    ? 'bg-accent text-white'
                    : 'bg-surface-alt text-text-secondary hover:text-text'
                }`}
              >
                Title
              </button>
              <button
                type="button"
                onClick={() => setActiveBoxKey('author_box')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeBoxKey === 'author_box'
                    ? 'bg-accent text-white'
                    : 'bg-surface-alt text-text-secondary hover:text-text'
                }`}
              >
                Author
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-surface border border-border rounded-2xl p-4">
            <div className="mb-3 flex items-center justify-between text-xs text-text-muted">
              <span>Drag boxes to move. Drag corner handle to resize.</span>
              <span>{ratioInfo.name}</span>
            </div>
            <div
              ref={canvasRef}
              className="relative w-full max-w-3xl mx-auto overflow-hidden rounded-xl border border-border shadow-inner select-none"
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
                const text = boxKey === 'title_box'
                  ? (testBookTitle || 'Sample Book Title')
                  : (testAuthorName || 'AUTHOR NAME');
                return (
                  <div
                    key={boxKey}
                    role="button"
                    tabIndex={0}
                    onPointerDown={(event) => beginInteraction(event, boxKey, 'move')}
                    onClick={() => setActiveBoxKey(boxKey)}
                    className={`absolute border-2 rounded-sm ${isActive ? 'border-accent' : 'border-white/50'} cursor-move`}
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
                    {text}
                    <button
                      type="button"
                      onPointerDown={(event) => beginInteraction(event, boxKey, 'resize')}
                      className={`absolute -bottom-2 -right-2 w-4 h-4 rounded-sm border ${
                        isActive ? 'bg-accent border-accent' : 'bg-white border-white/80'
                      }`}
                      aria-label={`Resize ${boxKey}`}
                    />
                  </div>
                );
              })}
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

          <div className="bg-surface border border-border rounded-2xl p-4 space-y-3">
            <h2 className="text-sm font-medium text-text">
              {activeBoxKey === 'title_box' ? 'Title box styles' : 'Author box styles'}
            </h2>

            <div className="grid sm:grid-cols-4 gap-2">
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

            <div className="grid sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2">
                <label className="block text-xs text-text-muted mb-1">Font family</label>
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
                <label className="block text-xs text-text-muted mb-1">Font size</label>
                <input
                  type="number"
                  value={activeBox.font_size}
                  onChange={(event) => updateNumericField(activeBoxKey, 'font_size', event.target.value)}
                  className="w-full px-2 py-1.5 bg-surface-alt border border-border rounded text-sm"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-4 gap-2">
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
                <label className="block text-xs text-text-muted mb-1">Align</label>
                <select
                  value={activeBox.text_align}
                  onChange={(event) => updateBox(activeBoxKey, { text_align: event.target.value as CoverTemplateTextBox['text_align'] })}
                  className="w-full px-2 py-1.5 bg-surface-alt border border-border rounded text-sm"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
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
            </div>

            <div className="grid sm:grid-cols-4 gap-2">
              <div>
                <label className="block text-xs text-text-muted mb-1">Text color</label>
                <input
                  type="color"
                  value={activeBox.font_color}
                  onChange={(event) => updateBox(activeBoxKey, { font_color: event.target.value.toUpperCase() })}
                  className="w-full h-9 bg-surface-alt border border-border rounded"
                />
              </div>
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
              <div className="flex items-end gap-2">
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

            <div className="grid sm:grid-cols-3 gap-2">
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
          </div>
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
