import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useGeneration } from '../context/GenerationContext';
import { useGenerationForm } from '../context/GenerationFormContext';
import { useGenres, useAspectRatios, useStyleReferences, useCoverTemplates } from '../hooks/useApiQueries';
import { generationApi } from '../services/api';
import { Toggle, ReferenceModeToggle, PlaceholderPanel, ProgressPanel, ResultPanel, BlendingModeToggle } from '../components/Generate';
import type { Generation, GenerationInput } from '../types';

const OPTIONAL_FIELD_DEFS = [
  { key: 'description', label: 'Book Description' },
  { key: 'genres', label: 'Genres' },
  { key: 'character_description', label: 'Character Description' },
] as const;

type OptionalFieldKey = typeof OPTIONAL_FIELD_DEFS[number]['key'];

export default function GeneratePage() {
  const { user } = useAuth();
  const generation = useGeneration();
  const form = useGenerationForm();
  const location = useLocation();
  const navigate = useNavigate();

  const { data: genres = [] } = useGenres();
  const { data: aspectRatios = {} } = useAspectRatios();
  const { data: styleReferences = [] } = useStyleReferences();
  const { data: coverTemplates = [] } = useCoverTemplates();

  const [addFieldOpen, setAddFieldOpen] = useState(false);
  const addFieldRef = useRef<HTMLDivElement>(null);
  const pendingGenRef = useRef<Generation | null>(null);

  const [estimatedCost, setEstimatedCost] = useState<number | null>(null);
  const [canAfford, setCanAfford] = useState(true);
  const [isFetchingCost, setIsFetchingCost] = useState(false);
  const [costError, setCostError] = useState(false);

  const prefsFields = user?.preferences?.visible_fields || [];
  const visibleOptionalKeys = new Set<string>([...prefsFields, ...form.tempFields]);

  const visibleOptionalFields = OPTIONAL_FIELD_DEFS.filter((f) =>
    visibleOptionalKeys.has(f.key)
  );
  const hiddenOptionalFields = OPTIONAL_FIELD_DEFS.filter(
    (f) => !visibleOptionalKeys.has(f.key)
  );

  const selectedTemplate = form.selectedTemplateId !== null
    ? coverTemplates.find((template) => template.id === form.selectedTemplateId) || null
    : null;
  const isTemplateMode = form.selectedTemplateId !== null;

  useEffect(() => {
    const state = location.state as { fromGeneration?: Generation } | null;
    if (!state?.fromGeneration) return;

    const gen = state.fromGeneration;
    pendingGenRef.current = gen;

    form.setFormData({
      book_title: gen.book_title || '',
      author_name: gen.author_name || '',
      cover_ideas: gen.cover_ideas || '',
      description: gen.description || '',
      genres: gen.genres || [],
      aspect_ratio: gen.aspect_ratio || '2:3',
      character_description: gen.character_description || '',
    });

    const fieldsToShow = new Set<string>();
    if (gen.description) fieldsToShow.add('description');
    if (gen.genres && gen.genres.length > 0) fieldsToShow.add('genres');
    if (gen.character_description) fieldsToShow.add('character_description');
    if (fieldsToShow.size > 0) form.setTempFields(fieldsToShow);

    form.setBaseImageOnly(Boolean(gen.base_image_only));
    form.setSelectedTemplateId(gen.cover_template_id ?? null);
    form.setTwoStepGeneration(gen.two_step_generation !== false);
    if (gen.reference_mode) {
      form.setReferenceMode(gen.reference_mode);
    }

    navigate(location.pathname, { replace: true, state: {} });
  }, []);

  useEffect(() => {
    const gen = pendingGenRef.current;
    if (!gen || styleReferences.length === 0) return;

    if (gen.style_reference_id) {
      const matchingRef = styleReferences.find((r) => r.id === gen.style_reference_id);
      if (matchingRef) {
        form.setSelectedRefId(matchingRef.id);
        if (gen.reference_mode) {
          form.setReferenceMode(gen.reference_mode);
        }
      }
    }

    pendingGenRef.current = null;
  }, [styleReferences]);

  useEffect(() => {
    if (!addFieldOpen) return;
    const handler = (e: MouseEvent) => {
      if (addFieldRef.current && !addFieldRef.current.contains(e.target as Node)) {
        setAddFieldOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [addFieldOpen]);

  useEffect(() => {
    if (!user) return;

    const controller = new AbortController();
    
    const fetchEstimate = async () => {
      setIsFetchingCost(true);
      setCostError(false);
      try {
        const estimate = await generationApi.estimateCost({
          use_style_image: form.selectedRefId !== null,
          style_reference_id: form.selectedRefId,
          cover_template_id: form.selectedTemplateId,
          base_image_only: isTemplateMode ? false : form.baseImageOnly,
          reference_mode: form.referenceMode,
          text_blending_mode: form.textBlendingMode,
          two_step_generation: form.twoStepGeneration,
        });
        
        if (!controller.signal.aborted) {
          setEstimatedCost(estimate.total);
          setCanAfford(estimate.can_afford);
        }
      } catch {
        if (!controller.signal.aborted) {
          setCostError(true);
          setCanAfford(false);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsFetchingCost(false);
        }
      }
    };

    const debounceTimer = setTimeout(fetchEstimate, 300);

    return () => {
      controller.abort();
      clearTimeout(debounceTimer);
    };
  }, [
    user,
    form.selectedRefId,
    form.selectedTemplateId,
    form.baseImageOnly,
    form.referenceMode,
    form.textBlendingMode,
    form.twoStepGeneration,
    isTemplateMode,
  ]);

  const handleTemplateSelect = (id: number | null) => {
    form.setSelectedTemplateId(id);

    if (id === null) {
      return;
    }

    const template = coverTemplates.find((item) => item.id === id);
    if (template) {
      form.setFormData((prev) => ({
        ...prev,
        aspect_ratio: template.aspect_ratio,
      }));
      form.setBaseImageOnly(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const shouldIncludeText = isTemplateMode || !form.baseImageOnly;

    const payload: GenerationInput = {
      book_title: shouldIncludeText ? form.formData.book_title : '',
      author_name: shouldIncludeText ? form.formData.author_name : '',
      aspect_ratio: form.formData.aspect_ratio,
    };

    if (isTemplateMode) {
      payload.cover_template_id = form.selectedTemplateId ?? undefined;
    } else if (form.baseImageOnly) {
      payload.base_image_only = true;
    } else {
      payload.two_step_generation = form.twoStepGeneration;
    }

    if (form.formData.cover_ideas) {
      payload.cover_ideas = form.formData.cover_ideas;
    }
    if (visibleOptionalKeys.has('description') && form.formData.description) {
      payload.description = form.formData.description;
    }
    if (visibleOptionalKeys.has('genres') && form.formData.genres && form.formData.genres.length > 0) {
      payload.genres = form.formData.genres;
    }
    if (visibleOptionalKeys.has('character_description') && form.formData.character_description) {
      payload.character_description = form.formData.character_description;
    }

    if (form.selectedRefId !== null) {
      const ref = styleReferences.find((r) => r.id === form.selectedRefId);
      if (ref) {
        payload.style_reference_id = ref.id;
        payload.use_style_image = true;
        payload.reference_mode = isTemplateMode ? 'background' : form.referenceMode;
        if (!isTemplateMode && form.twoStepGeneration && (form.referenceMode === 'both' || form.referenceMode === 'text')) {
          payload.text_blending_mode = form.textBlendingMode;
        }
      }
    }

    generation.startGeneration(payload);
  };

  const handleGenreToggle = (genre: string) => {
    form.setFormData((prev) => ({
      ...prev,
      genres: (prev.genres || []).includes(genre)
        ? (prev.genres || []).filter((g) => g !== genre)
        : [...(prev.genres || []), genre],
    }));
  };

  const handleAddTempField = (key: string) => {
    form.setTempFields((prev) => new Set([...prev, key]));
    setAddFieldOpen(false);
  };

  const handleRemoveTempField = (key: string) => {
    form.setTempFields((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    clearFieldData(key as OptionalFieldKey);
  };

  const clearFieldData = (key: OptionalFieldKey) => {
    form.setFormData((prev) => {
      const updated = { ...prev };
      if (key === 'genres') updated.genres = [];
      else if (key === 'description') updated.description = '';
      else if (key === 'character_description') updated.character_description = '';
      return updated;
    });
  };

  const handleClear = () => {
    generation.reset();
    form.clearForm();
  };

  const isTempField = (key: string) => form.tempFields.has(key) && !prefsFields.includes(key);

  const inputClass =
    'w-full px-3 py-2 bg-surface-alt border border-border rounded-lg text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 text-sm';

  const renderOptionalField = (key: OptionalFieldKey) => {
    const showRemove = isTempField(key);
    const removeBtn = showRemove ? (
      <button
        type="button"
        onClick={() => handleRemoveTempField(key)}
        className="ml-2 p-0.5 text-text-muted hover:text-error transition-colors"
        aria-label={`Remove ${key} field`}
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    ) : null;

    switch (key) {
      case 'description':
        return (
          <div key={key}>
            <div className="flex items-center mb-1.5">
              <label className="block text-sm font-medium text-text-secondary">Book Description</label>
              {removeBtn}
            </div>
            <textarea
              rows={3}
              disabled={isGenerating}
              value={form.formData.description || ''}
              onChange={(e) => form.setFormData({ ...form.formData, description: e.target.value })}
              className={inputClass}
              placeholder="Plot, themes, key elements..."
            />
          </div>
        );

      case 'genres':
        return (
          <div key={key}>
            <div className="flex items-center mb-2">
              <label className="block text-sm font-medium text-text-secondary">Genre(s)</label>
              {removeBtn}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {genres.map((genre) => (
                <button
                  key={genre}
                  type="button"
                  disabled={isGenerating}
                  onClick={() => handleGenreToggle(genre)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
                    (form.formData.genres || []).includes(genre)
                      ? 'bg-accent text-white border-accent'
                      : 'bg-surface-alt text-text-secondary border-border hover:border-accent/40 hover:text-text'
                  }`}
                >
                  {genre}
                </button>
              ))}
            </div>
          </div>
        );

      case 'character_description':
        return (
          <div key={key}>
            <div className="flex items-center mb-1.5">
              <label className="block text-sm font-medium text-text-secondary">Character Description</label>
              {removeBtn}
            </div>
            <textarea
              rows={2}
              disabled={isGenerating}
              value={form.formData.character_description || ''}
              onChange={(e) => form.setFormData({ ...form.formData, character_description: e.target.value })}
              className={inputClass}
              placeholder="Main character appearance for the cover..."
            />
          </div>
        );

      default:
        return null;
    }
  };

  const isGenerating = generation.status === 'generating';
  const isCompleted = generation.status === 'completed' && generation.result;
  const isFailed = generation.status === 'failed';
  const isIdle = !isGenerating && !isCompleted && !isFailed;

  return (
    <div className="max-w-6xl mx-auto">
      {isFailed && (
        <div className="mb-4 flex items-center gap-3 bg-error-bg border border-error-border text-error px-3 py-2.5 rounded-lg text-sm">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          <div className="flex-1">
            <p className="font-medium text-xs">Generation failed</p>
            <p className="text-xs mt-0.5 opacity-80">{generation.error || 'An unexpected error occurred.'}</p>
          </div>
          <button
            onClick={generation.reset}
            className="text-xs font-medium hover:underline flex-shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {generation.error && isIdle && !isFailed && (
        <div className="mb-4 bg-error-bg border border-error-border text-error px-3 py-2.5 rounded-lg text-sm">
          {generation.error}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-5 lg:gap-6">
        <div>
          <div className="mb-4">
            <h1 className="text-2xl font-heading font-bold text-text tracking-tight">
              Generate Book Cover
            </h1>
            <p className="text-text-secondary mt-0.5 text-sm">Describe your book and let AI craft the cover.</p>
          </div>
          <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5">
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {!isTemplateMode && (
              <div className="flex items-center justify-between">
                <span
                  className="text-sm text-text-secondary cursor-help"
                  title="Generate only the background artwork without any text. Uses the clean background from your style reference."
                >
                  Image only (no title or author text)
                </span>
                <Toggle
                  checked={form.baseImageOnly}
                  onChange={form.setBaseImageOnly}
                  disabled={isGenerating}
                />
              </div>
            )}

            {!form.baseImageOnly && !isTemplateMode && (
              <div className="flex items-center justify-between">
                <span
                  className="text-sm text-text-secondary cursor-help"
                  title="First generates base artwork, then adds text separately. Generally produces better results than single-step generation."
                >
                  Two-step generation
                </span>
                <Toggle
                  checked={form.twoStepGeneration}
                  onChange={form.setTwoStepGeneration}
                  disabled={isGenerating}
                />
              </div>
            )}

            {!form.baseImageOnly && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Book Title
                  </label>
                  <input
                    type="text"
                    required
                    disabled={isGenerating}
                    value={form.formData.book_title}
                    onChange={(e) => form.setFormData({ ...form.formData, book_title: e.target.value })}
                    className={inputClass}
                    placeholder="Your book title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Author Name
                  </label>
                  <input
                    type="text"
                    required
                    disabled={isGenerating}
                    value={form.formData.author_name}
                    onChange={(e) => form.setFormData({ ...form.formData, author_name: e.target.value })}
                    className={inputClass}
                    placeholder="Author name"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Cover Ideas
              </label>
              <textarea
                rows={3}
                disabled={isGenerating}
                value={form.formData.cover_ideas || ''}
                onChange={(e) => form.setFormData({ ...form.formData, cover_ideas: e.target.value })}
                className={inputClass}
                placeholder="Colors, imagery, mood, composition, style..."
              />
              <p className="mt-0.5 text-xs text-text-muted">
                Leave blank to let AI decide.
              </p>
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Aspect Ratio
                </label>
                <select
                  value={form.formData.aspect_ratio}
                  onChange={(e) => form.setFormData({ ...form.formData, aspect_ratio: e.target.value })}
                  disabled={isGenerating || isTemplateMode}
                  className={inputClass}
                >
                  {Object.entries(aspectRatios).map(([ratio, info]) => (
                    <option key={ratio} value={ratio}>
                      {info.name} ({ratio})
                    </option>
                  ))}
                </select>
                {isTemplateMode && selectedTemplate && (
                  <p className="mt-0.5 text-xs text-text-muted">
                    Locked to template format ({selectedTemplate.aspect_ratio}).
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Style Reference
                </label>
                <select
                  value={form.selectedRefId ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    const newId = val === '' ? null : Number(val);
                    form.setSelectedRefId(newId);
                  }}
                  disabled={isGenerating}
                  className={inputClass}
                >
                  <option value="">None</option>
                  {styleReferences.map((ref) => (
                    <option key={ref.id} value={ref.id}>
                      {ref.title || 'Untitled Reference'}
                    </option>
                  ))}
                </select>
                {styleReferences.length === 0 && (
                  <p className="mt-0.5 text-xs text-text-muted">
                    No references yet.{' '}
                    <a href="/references" className="text-accent hover:text-accent-hover transition-colors">
                      Create one
                    </a>
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Cover Template
                </label>
                <select
                  value={form.selectedTemplateId ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    const newId = val === '' ? null : Number(val);
                    handleTemplateSelect(newId);
                  }}
                  disabled={isGenerating}
                  className={inputClass}
                >
                  <option value="">None</option>
                  {coverTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
                {coverTemplates.length === 0 && (
                  <p className="mt-0.5 text-xs text-text-muted">
                    No templates yet.{' '}
                    <a href="/templates" className="text-accent hover:text-accent-hover transition-colors">
                      Create one
                    </a>
                  </p>
                )}
              </div>
            </div>

            {form.selectedRefId !== null && !form.baseImageOnly && !isTemplateMode && (
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Reference Mode
                </label>
                <ReferenceModeToggle
                  value={form.referenceMode}
                  onChange={form.setReferenceMode}
                  disabled={isGenerating}
                />
                <p className="mt-1 text-xs text-text-muted">
                  {form.referenceMode === 'both' && 'Use the full reference image as style guide.'}
                  {form.referenceMode === 'background' && 'Use only the background/artwork style (text removed).'}
                  {form.referenceMode === 'text' && 'Use only the typography/text style.'}
                </p>
              </div>
            )}

            {form.selectedRefId !== null && form.twoStepGeneration && !form.baseImageOnly && !isTemplateMode && (form.referenceMode === 'both' || form.referenceMode === 'text') && (
              <BlendingModeToggle
                value={form.textBlendingMode}
                onChange={form.setTextBlendingMode}
                disabled={isGenerating}
              />
            )}

            {isTemplateMode && selectedTemplate && (
              <div className="text-xs text-text-muted bg-surface-alt border border-border rounded-lg px-3 py-2">
                Template mode is active. Text is rendered from template "{selectedTemplate.name}" after the base image is generated.
              </div>
            )}

            {visibleOptionalFields.length > 0 && (
              <div className="border-t border-border pt-3.5 space-y-3.5">
                {visibleOptionalFields.map((f) => renderOptionalField(f.key))}
              </div>
            )}

            {hiddenOptionalFields.length > 0 && (
              <div className="relative" ref={addFieldRef}>
                <button
                  type="button"
                  onClick={() => setAddFieldOpen(!addFieldOpen)}
                  disabled={isGenerating}
                  className="flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover transition-colors font-medium"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Add field
                </button>

                {addFieldOpen && (
                  <div className="absolute left-0 mt-1 w-48 bg-surface border border-border rounded-lg shadow-lg z-10 py-1">
                    {hiddenOptionalFields.map((f) => (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => handleAddTempField(f.key)}
                        className="w-full text-left px-3 py-1.5 text-sm text-text hover:bg-surface-alt transition-colors"
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-3">
              <button
                type="submit"
                disabled={isGenerating || !generation.socketConnected || isFetchingCost || costError || (!user?.unlimited_credits && !canAfford)}
                className="flex-1 bg-accent text-white py-1.5 px-3 rounded-lg font-medium hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm"
              >
                {isGenerating ? 'Generating...' : (
                  isFetchingCost ? 'Calculating...' : (
                    costError ? 'Error' : `Generate (${estimatedCost ?? '...'} credits)`
                  )
                )}
              </button>
              <button
                type="button"
                onClick={handleClear}
                disabled={isGenerating}
                className="p-1.5 border border-border text-text-muted rounded-lg hover:bg-surface-alt hover:text-text-secondary disabled:opacity-40 transition-colors"
                aria-label="Reset form"
                title="Reset form"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.992 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
                </svg>
              </button>
            </div>
            {costError && (
              <p className="text-center text-xs text-error">Failed to calculate cost. Please try again.</p>
            )}
            {!costError && !user?.unlimited_credits && !canAfford && estimatedCost !== null && (
              <p className="text-center text-xs text-error">
                Not enough credits. You need {estimatedCost}, but have {user?.credits ?? 0}.
              </p>
            )}
          </form>
          </div>
        </div>

        <div className="flex items-center justify-center">
          {(isIdle || isFailed) && <PlaceholderPanel />}
          {isGenerating && <ProgressPanel generation={generation} />}
          {isCompleted && generation.result && (
            <ResultPanel result={generation.result} />
          )}
        </div>
      </div>
    </div>
  );
}
