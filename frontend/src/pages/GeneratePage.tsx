import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { generationApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useGeneration } from '../context/GenerationContext';
import { useGenerationForm } from '../context/GenerationFormContext';
import type { Generation, GenerationInput, AspectRatioInfo, StyleReference } from '../types';

const OPTIONAL_FIELD_DEFS = [
  { key: 'description', label: 'Book Description' },
  { key: 'genres', label: 'Genres' },
  { key: 'character_description', label: 'Character Description' },
] as const;

type OptionalFieldKey = typeof OPTIONAL_FIELD_DEFS[number]['key'];

function Toggle({ checked, onChange, disabled }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed ${
        checked ? 'bg-accent' : 'bg-border-strong'
      }`}
    >
      <span
        className={`pointer-events-none absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

function PlaceholderPanel() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface-alt/50 flex flex-col items-center justify-center p-8 min-h-[320px] text-center">
      <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
        <svg className="w-7 h-7 text-accent/50" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
        </svg>
      </div>
      <p className="text-sm text-text-muted mb-0.5">Your cover will appear here</p>
      <p className="text-xs text-text-muted/70">Fill in the form and hit generate</p>
    </div>
  );
}

const FAKE_STEPS = [
  { at: 0, message: 'Analyzing your description...' },
  { at: 5, message: 'Crafting the visual concept...' },
  { at: 12, message: 'Composing the layout...' },
  { at: 22, message: 'Rendering the artwork...' },
  { at: 38, message: 'Refining details...' },
  { at: 50, message: 'Finalizing your cover...' },
];

const TOTAL_FAKE_DURATION = 60;
const MAX_FAKE_PERCENT = 95;

function useFakeProgress(isGenerating: boolean, isCompleted: boolean) {
  const [percent, setPercent] = useState(0);
  const [message, setMessage] = useState(FAKE_STEPS[0].message);
  const [finishing, setFinishing] = useState(false);
  const startTimeRef = useRef<number>(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!isGenerating && !isCompleted) {
      setPercent(0);
      setMessage(FAKE_STEPS[0].message);
      setFinishing(false);
      return;
    }

    if (isGenerating && !finishing) {
      startTimeRef.current = Date.now();

      const tick = () => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        const t = Math.min(elapsed / TOTAL_FAKE_DURATION, 1);
        const eased = 1 - Math.pow(1 - t, 4);
        setPercent(Math.round(eased * MAX_FAKE_PERCENT));

        for (let i = FAKE_STEPS.length - 1; i >= 0; i--) {
          if (elapsed >= FAKE_STEPS[i].at) {
            setMessage(FAKE_STEPS[i].message);
            break;
          }
        }

        if (t < 1) {
          rafRef.current = requestAnimationFrame(tick);
        }
      };

      rafRef.current = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(rafRef.current);
    }
  }, [isGenerating, finishing]);

  useEffect(() => {
    if (isCompleted && !finishing) {
      setFinishing(true);
      cancelAnimationFrame(rafRef.current);
      setMessage('Complete!');

      const start = percent;
      const startTime = Date.now();
      const duration = 500;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const t = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        setPercent(Math.round(start + (100 - start) * eased));
        if (t < 1) {
          rafRef.current = requestAnimationFrame(animate);
        }
      };

      rafRef.current = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(rafRef.current);
    }
  }, [isCompleted]);

  return { percent, message, finishing };
}

function ProgressPanel({ generation }: { generation: ReturnType<typeof useGeneration> }) {
  const isGenerating = generation.status === 'generating';
  const isCompleted = generation.status === 'completed';
  const { percent, message } = useFakeProgress(isGenerating, isCompleted);

  const circumference = 2 * Math.PI * 52;
  const strokeOffset = circumference - (percent / 100) * circumference;

  return (
    <div className="rounded-2xl border border-border bg-surface flex flex-col items-center justify-center p-6 min-h-[320px]">
      <div className="relative w-28 h-28 mb-5">
        <svg className="w-28 h-28 -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="52" fill="none" stroke="var(--color-border)" strokeWidth="8" />
          <circle
            cx="60" cy="60" r="52" fill="none"
            stroke="var(--color-accent)" strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeOffset}
            className="transition-all duration-300 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-heading font-bold text-text">{percent}%</span>
        </div>
      </div>

      <p className="text-sm font-medium text-text mb-1">
        {message}
      </p>

      <p className="text-xs text-text-muted mt-4">
        You can navigate away while generating.
      </p>
    </div>
  );
}

function ResultPanel({ result }: { result: Generation }) {
  return (
    <div className="flex justify-center">
      <div className="w-[85%] relative group rounded-2xl overflow-hidden border border-border bg-surface cursor-pointer">
        <img
          src={result.final_image_url || result.base_image_url || ''}
          alt={result.book_title}
          className="w-full h-auto block"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="absolute bottom-0 left-0 right-0 p-4 flex items-end justify-between">
            <div className="min-w-0">
              <h3 className="font-heading font-semibold text-white truncate">
                {result.book_title || 'Untitled'}
              </h3>
              {result.author_name && (
                <p className="text-sm text-white/70 truncate">by {result.author_name}</p>
              )}
            </div>
            <a
              href={result.final_image_url || result.base_image_url || ''}
              download={`${result.book_title.replace(/\s+/g, '_')}_cover.png`}
              onClick={(e) => e.stopPropagation()}
              className="flex-shrink-0 p-2 bg-white/20 hover:bg-white/30 rounded-lg backdrop-blur-sm transition-colors"
              title="Download"
            >
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GeneratePage() {
  const { user } = useAuth();
  const generation = useGeneration();
  const form = useGenerationForm();
  const location = useLocation();
  const navigate = useNavigate();

  const [genres, setGenres] = useState<string[]>([]);
  const [aspectRatios, setAspectRatios] = useState<Record<string, AspectRatioInfo>>({});
  const [styleReferences, setStyleReferences] = useState<StyleReference[]>([]);

  const [addFieldOpen, setAddFieldOpen] = useState(false);
  const addFieldRef = useRef<HTMLDivElement>(null);
  const pendingGenRef = useRef<Generation | null>(null);

  const prefsFields = user?.preferences?.visible_fields || [];
  const visibleOptionalKeys = new Set<string>([...prefsFields, ...form.tempFields]);

  const visibleOptionalFields = OPTIONAL_FIELD_DEFS.filter((f) =>
    visibleOptionalKeys.has(f.key)
  );
  const hiddenOptionalFields = OPTIONAL_FIELD_DEFS.filter(
    (f) => !visibleOptionalKeys.has(f.key)
  );

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [genresData, ratiosData, refsData] = await Promise.all([
          generationApi.getGenres(),
          generationApi.getAspectRatios(),
          generationApi.getStyleReferences(),
        ]);
        setGenres(genresData);
        setAspectRatios(ratiosData);
        setStyleReferences(refsData);
      } catch (err) {
        console.error('Failed to load options:', err);
      }
    };
    loadOptions();
  }, []);

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

    navigate(location.pathname, { replace: true, state: {} });
  }, []);

  useEffect(() => {
    const gen = pendingGenRef.current;
    if (!gen || styleReferences.length === 0) return;

    if (gen.style_reference_id) {
      const matchingRef = styleReferences.find((r) => r.id === gen.style_reference_id);
      if (matchingRef) {
        form.setSelectedRefId(matchingRef.id);
        form.setUseStyleImage(Boolean(gen.use_style_image));
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const payload: GenerationInput = {
      book_title: form.baseImageOnly ? '' : form.formData.book_title,
      author_name: form.baseImageOnly ? '' : form.formData.author_name,
      aspect_ratio: form.formData.aspect_ratio,
    };

    if (form.baseImageOnly) {
      payload.base_image_only = true;
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
        payload.style_analysis = {
          feeling: ref.feeling || '',
          layout: ref.layout || '',
          illustration_rules: ref.illustration_rules || '',
          typography: ref.typography || '',
        };
        payload.style_reference_id = ref.id;
        payload.use_style_image = form.useStyleImage;
        if (form.useStyleImage) {
          payload.cover_style_image = true;
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
      <div className="mb-5">
        <h1 className="text-2xl font-heading font-bold text-text tracking-tight">
          Generate Book Cover
        </h1>
        <p className="text-text-secondary mt-0.5 text-sm">Describe your book and let AI craft the cover.</p>
      </div>

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

      <div className="grid lg:grid-cols-2 gap-5 lg:gap-6 items-start">
        <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5">
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">
                Image only (no title or author text)
              </span>
              <Toggle
                checked={form.baseImageOnly}
                onChange={form.setBaseImageOnly}
                disabled={isGenerating}
              />
            </div>

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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Aspect Ratio
                </label>
                <select
                  value={form.formData.aspect_ratio}
                  onChange={(e) => form.setFormData({ ...form.formData, aspect_ratio: e.target.value })}
                  disabled={isGenerating}
                  className={inputClass}
                >
                  {Object.entries(aspectRatios).map(([ratio, info]) => (
                    <option key={ratio} value={ratio}>
                      {info.name} ({ratio})
                    </option>
                  ))}
                </select>
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
                    if (newId === null) form.setUseStyleImage(false);
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
            </div>

            {form.selectedRefId !== null && (
              <div className="flex items-center justify-between bg-surface-alt/50 border border-border rounded-lg px-3 py-2">
                <span className="text-sm text-text-secondary">
                  Use reference image in generation
                </span>
                <Toggle
                  checked={form.useStyleImage}
                  onChange={form.setUseStyleImage}
                  disabled={isGenerating}
                />
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

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={isGenerating || !generation.socketConnected || (!user?.unlimited_credits && (user?.credits ?? 0) < 3)}
                className="flex-1 bg-accent text-white py-1.5 px-3 rounded-lg font-medium hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm"
              >
                {isGenerating ? 'Generating...' : 'Generate (3 credits)'}
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
            {!user?.unlimited_credits && (user?.credits ?? 0) < 3 && (
              <p className="text-center text-xs text-error">Not enough credits.</p>
            )}
          </form>
        </div>

        <div className="lg:sticky lg:top-20">
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
