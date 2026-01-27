import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { generationApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useGeneration } from '../context/GenerationContext';
import type { Generation, GenerationInput, AspectRatioInfo, StyleReference } from '../types';

const OPTIONAL_FIELD_DEFS = [
  { key: 'description', label: 'Book Description' },
  { key: 'genres', label: 'Genres' },
  { key: 'character_description', label: 'Character Description' },
] as const;

type OptionalFieldKey = typeof OPTIONAL_FIELD_DEFS[number]['key'];

function PlaceholderPanel() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface-alt/50 flex flex-col items-center justify-center p-8 min-h-[400px] text-center">
      <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-5">
        <svg className="w-8 h-8 text-accent/50" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
        </svg>
      </div>
      <p className="text-sm font-medium text-text-muted mb-1">Your cover will appear here</p>
      <p className="text-xs text-text-muted/70">Fill in the form and hit generate</p>
    </div>
  );
}

function ProgressPanel({ generation }: { generation: ReturnType<typeof useGeneration> }) {
  const progressPercent = generation.totalSteps > 0
    ? Math.round((generation.step / generation.totalSteps) * 100)
    : 0;

  const circumference = 2 * Math.PI * 52;
  const strokeOffset = circumference - (progressPercent / 100) * circumference;

  return (
    <div className="rounded-2xl border border-border bg-surface flex flex-col items-center justify-center p-8 min-h-[400px]">
      <div className="relative w-32 h-32 mb-6">
        <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="52" fill="none" stroke="var(--color-border)" strokeWidth="8" />
          <circle
            cx="60" cy="60" r="52" fill="none"
            stroke="var(--color-accent)" strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeOffset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-heading font-bold text-text">{progressPercent}%</span>
        </div>
      </div>

      <p className="text-sm font-medium text-text mb-1">
        {generation.stepMessage || 'Preparing...'}
      </p>
      {generation.totalSteps > 0 && (
        <p className="text-xs text-text-muted">
          Step {generation.step} of {generation.totalSteps}
        </p>
      )}

      <div className="w-full max-w-xs mt-8 space-y-2">
        {Array.from({ length: generation.totalSteps || 4 }, (_, i) => {
          const stepNum = i + 1;
          const isActive = stepNum === generation.step;
          const isDone = stepNum < generation.step;

          return (
            <div key={stepNum} className="flex items-center gap-3">
              <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                isDone
                  ? 'bg-accent text-white'
                  : isActive
                    ? 'bg-accent/15 text-accent ring-2 ring-accent/30'
                    : 'bg-surface-alt text-text-muted'
              }`}>
                {isDone ? (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : (
                  stepNum
                )}
              </div>
              <span className={`text-xs ${
                isActive ? 'text-text font-medium' : isDone ? 'text-text-secondary' : 'text-text-muted'
              }`}>
                {isActive ? generation.stepMessage : isDone ? 'Done' : 'Waiting...'}
              </span>
              {isActive && (
                <div className="animate-spin rounded-full h-3 w-3 border-[1.5px] border-accent border-t-transparent ml-auto" />
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-text-muted mt-6">
        You can navigate away while generating.
      </p>
    </div>
  );
}

function ResultPanel({ result, generation, user, onRegenerate, onReset }: {
  result: Generation;
  generation: ReturnType<typeof useGeneration>;
  user: any;
  onRegenerate: () => void;
  onReset: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl overflow-hidden border border-border bg-surface">
        <img
          src={result.final_image_url || result.base_image_url || ''}
          alt={result.book_title}
          className="w-full h-auto block"
        />
      </div>

      <div className="space-y-3">
        <a
          href={result.final_image_url || result.base_image_url || ''}
          download={`${result.book_title.replace(/\s+/g, '_')}_cover.png`}
          className="flex items-center justify-center gap-2 w-full bg-accent text-white py-3 px-4 rounded-xl font-semibold hover:bg-accent-hover transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Download Cover
        </a>

        <button
          onClick={onRegenerate}
          disabled={generation.status !== 'completed' || (!user?.unlimited_credits && (user?.credits ?? 0) < 3)}
          className="w-full border border-border text-text py-2.5 px-4 rounded-xl font-medium hover:bg-surface-alt disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Regenerate (3 credits)
        </button>

        <button
          onClick={onReset}
          className="w-full text-sm text-text-muted hover:text-text py-2 transition-colors"
        >
          Start a new cover
        </button>
      </div>
    </div>
  );
}

export default function GeneratePage() {
  const { user } = useAuth();
  const generation = useGeneration();
  const location = useLocation();
  const navigate = useNavigate();

  const [genres, setGenres] = useState<string[]>([]);
  const [aspectRatios, setAspectRatios] = useState<Record<string, AspectRatioInfo>>({});

  const [styleReferences, setStyleReferences] = useState<StyleReference[]>([]);
  const [selectedRefId, setSelectedRefId] = useState<number | null>(null);
  const [useStyleImage, setUseStyleImage] = useState(false);
  const [coverStyleImage, setCoverStyleImage] = useState(false);
  const [baseImageOnly, setBaseImageOnly] = useState(false);

  const [tempFields, setTempFields] = useState<Set<string>>(new Set());
  const [addFieldOpen, setAddFieldOpen] = useState(false);
  const addFieldRef = useRef<HTMLDivElement>(null);
  const pendingGenRef = useRef<Generation | null>(null);

  const [formData, setFormData] = useState<GenerationInput>({
    book_title: '',
    author_name: '',
    cover_ideas: '',
    description: '',
    genres: [],
    aspect_ratio: '2:3',
    character_description: '',
  });

  const prefsFields = user?.preferences?.visible_fields || [];
  const visibleOptionalKeys = new Set<string>([...prefsFields, ...tempFields]);

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

    setFormData({
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
    if (fieldsToShow.size > 0) setTempFields(fieldsToShow);

    setBaseImageOnly(Boolean(gen.base_image_only));

    navigate(location.pathname, { replace: true, state: {} });
  }, []);

  useEffect(() => {
    const gen = pendingGenRef.current;
    if (!gen || styleReferences.length === 0) return;

    if (gen.style_reference_id) {
      const matchingRef = styleReferences.find((r) => r.id === gen.style_reference_id);
      if (matchingRef) {
        setSelectedRefId(matchingRef.id);
        setUseStyleImage(Boolean(gen.use_style_image));
        setCoverStyleImage(Boolean(gen.cover_style_image));
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
      book_title: baseImageOnly ? '' : formData.book_title,
      author_name: baseImageOnly ? '' : formData.author_name,
      aspect_ratio: formData.aspect_ratio,
    };

    if (baseImageOnly) {
      payload.base_image_only = true;
    }

    if (formData.cover_ideas) {
      payload.cover_ideas = formData.cover_ideas;
    }
    if (visibleOptionalKeys.has('description') && formData.description) {
      payload.description = formData.description;
    }
    if (visibleOptionalKeys.has('genres') && formData.genres && formData.genres.length > 0) {
      payload.genres = formData.genres;
    }
    if (visibleOptionalKeys.has('character_description') && formData.character_description) {
      payload.character_description = formData.character_description;
    }

    if (selectedRefId !== null) {
      const ref = styleReferences.find((r) => r.id === selectedRefId);
      if (ref) {
        payload.style_analysis = {
          feeling: ref.feeling || '',
          layout: ref.layout || '',
          illustration_rules: ref.illustration_rules || '',
          typography: ref.typography || '',
        };
        payload.style_reference_id = ref.id;
        payload.use_style_image = useStyleImage;
        if (useStyleImage) {
          payload.cover_style_image = coverStyleImage;
        }
      }
    }

    generation.startGeneration(payload);
  };

  const handleGenreToggle = (genre: string) => {
    setFormData((prev) => ({
      ...prev,
      genres: (prev.genres || []).includes(genre)
        ? (prev.genres || []).filter((g) => g !== genre)
        : [...(prev.genres || []), genre],
    }));
  };

  const handleAddTempField = (key: string) => {
    setTempFields((prev) => new Set([...prev, key]));
    setAddFieldOpen(false);
  };

  const handleRemoveTempField = (key: string) => {
    setTempFields((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    clearFieldData(key as OptionalFieldKey);
  };

  const clearFieldData = (key: OptionalFieldKey) => {
    setFormData((prev) => {
      const updated = { ...prev };
      if (key === 'genres') updated.genres = [];
      else if (key === 'description') updated.description = '';
      else if (key === 'character_description') updated.character_description = '';
      return updated;
    });
  };

  const handleRegenerate = () => {
    if (!generation.result) return;
    generation.startRegeneration(generation.result.id);
  };

  const handleReset = () => {
    generation.reset();
    setFormData({
      book_title: '',
      author_name: '',
      cover_ideas: '',
      description: '',
      genres: [],
      aspect_ratio: '2:3',
      character_description: '',
    });
    setTempFields(new Set());
    setSelectedRefId(null);
    setBaseImageOnly(false);
  };

  const isTempField = (key: string) => tempFields.has(key) && !prefsFields.includes(key);

  const inputClass =
    'w-full px-3.5 py-2.5 bg-surface-alt border border-border rounded-xl text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 text-sm';

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
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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
                  onClick={() => handleGenreToggle(genre)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
                    (formData.genres || []).includes(genre)
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
              value={formData.character_description || ''}
              onChange={(e) => setFormData({ ...formData, character_description: e.target.value })}
              className={inputClass}
              placeholder="Main character appearance for the cover..."
            />
          </div>
        );

      default:
        return null;
    }
  };

  const renderForm = () => (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={baseImageOnly}
          onChange={(e) => setBaseImageOnly(e.target.checked)}
          className="w-4 h-4 rounded border-border text-accent focus:ring-accent/40 cursor-pointer"
        />
        <span className="text-sm text-text-secondary">
          Image only (no title or author text)
        </span>
      </label>

      {!baseImageOnly && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Book Title
            </label>
            <input
              type="text"
              required
              value={formData.book_title}
              onChange={(e) => setFormData({ ...formData, book_title: e.target.value })}
              className={inputClass}
              placeholder="Your book title"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Author Name
            </label>
            <input
              type="text"
              required
              value={formData.author_name}
              onChange={(e) => setFormData({ ...formData, author_name: e.target.value })}
              className={inputClass}
              placeholder="Author name"
            />
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">
          Cover Ideas
        </label>
        <textarea
          rows={3}
          value={formData.cover_ideas || ''}
          onChange={(e) => setFormData({ ...formData, cover_ideas: e.target.value })}
          className={inputClass}
          placeholder="Colors, imagery, mood, composition, style..."
        />
        <p className="mt-1 text-xs text-text-muted">
          Leave blank to let AI decide based on book details.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">
            Aspect Ratio
          </label>
          <select
            value={formData.aspect_ratio}
            onChange={(e) => setFormData({ ...formData, aspect_ratio: e.target.value })}
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
          <label className="block text-sm font-medium text-text-secondary mb-1.5">
            Style Reference
          </label>
          <select
            value={selectedRefId ?? ''}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedRefId(val === '' ? null : Number(val));
            }}
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
            <p className="mt-1 text-xs text-text-muted">
              No references yet.{' '}
              <a href="/references" className="text-accent hover:text-accent-hover transition-colors">
                Create one
              </a>
            </p>
          )}
        </div>
      </div>

      {selectedRefId !== null && (
        <div className="space-y-2 pl-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useStyleImage}
              onChange={(e) => {
                setUseStyleImage(e.target.checked);
                if (!e.target.checked) setCoverStyleImage(false);
              }}
              className="w-4 h-4 rounded border-border text-accent focus:ring-accent/40 cursor-pointer"
            />
            <span className="text-sm text-text-secondary">
              Use reference image directly
            </span>
          </label>
          {useStyleImage && (
            <label className="flex items-center gap-2 cursor-pointer pl-6">
              <input
                type="checkbox"
                checked={coverStyleImage}
                onChange={(e) => setCoverStyleImage(e.target.checked)}
                className="w-4 h-4 rounded border-border text-accent focus:ring-accent/40 cursor-pointer"
              />
              <span className="text-sm text-text-secondary">
                Fill canvas with reference
              </span>
            </label>
          )}
        </div>
      )}

      {visibleOptionalFields.length > 0 && (
        <div className="border-t border-border pt-4 space-y-4">
          {visibleOptionalFields.map((f) => renderOptionalField(f.key))}
        </div>
      )}

      {hiddenOptionalFields.length > 0 && (
        <div className="relative" ref={addFieldRef}>
          <button
            type="button"
            onClick={() => setAddFieldOpen(!addFieldOpen)}
            className="flex items-center gap-1.5 text-sm text-accent hover:text-accent-hover transition-colors font-medium"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add field
          </button>

          {addFieldOpen && (
            <div className="absolute left-0 mt-1 w-52 bg-surface border border-border rounded-xl shadow-lg z-10 py-1">
              {hiddenOptionalFields.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => handleAddTempField(f.key)}
                  className="w-full text-left px-4 py-2 text-sm text-text hover:bg-surface-alt transition-colors"
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={generation.status !== 'idle' || !generation.socketConnected || (!user?.unlimited_credits && (user?.credits ?? 0) < 3)}
        className="w-full bg-accent text-white py-3 px-4 rounded-xl font-semibold hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm"
      >
        Generate Cover (3 credits)
      </button>
      {!user?.unlimited_credits && (user?.credits ?? 0) < 3 && (
        <p className="text-center text-xs text-error">Not enough credits.</p>
      )}
    </form>
  );

  const renderFormSummary = () => (
    <div className="space-y-3 text-sm">
      {formData.book_title && (
        <div>
          <p className="text-xs text-text-muted uppercase tracking-wide mb-0.5">Title</p>
          <p className="text-text font-medium">{formData.book_title}</p>
        </div>
      )}
      {formData.author_name && (
        <div>
          <p className="text-xs text-text-muted uppercase tracking-wide mb-0.5">Author</p>
          <p className="text-text">{formData.author_name}</p>
        </div>
      )}
      {formData.cover_ideas && (
        <div>
          <p className="text-xs text-text-muted uppercase tracking-wide mb-0.5">Ideas</p>
          <p className="text-text-secondary">{formData.cover_ideas}</p>
        </div>
      )}
    </div>
  );

  const renderResultInfo = () => {
    if (!generation.result) return null;
    const result = generation.result;

    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-heading font-bold text-text">{result.book_title}</h2>
          {result.author_name && (
            <p className="text-text-secondary mt-0.5">by {result.author_name}</p>
          )}
        </div>

        <div className="space-y-2 text-sm">
          {result.cover_ideas && (
            <div className="flex gap-2">
              <span className="text-text-muted w-20 flex-shrink-0">Ideas</span>
              <span className="text-text-secondary">{result.cover_ideas}</span>
            </div>
          )}
          {result.genres && result.genres.length > 0 && (
            <div className="flex gap-2">
              <span className="text-text-muted w-20 flex-shrink-0">Genres</span>
              <span className="text-text-secondary">{result.genres.join(', ')}</span>
            </div>
          )}
          <div className="flex gap-2">
            <span className="text-text-muted w-20 flex-shrink-0">Ratio</span>
            <span className="text-text-secondary">{result.aspect_ratio_info?.name}</span>
          </div>
          {result.style_analysis && (
            <div className="flex gap-2">
              <span className="text-text-muted w-20 flex-shrink-0">Style</span>
              <span className="text-text-secondary">Applied</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const isGenerating = generation.status === 'generating';
  const isCompleted = generation.status === 'completed' && generation.result;
  const isFailed = generation.status === 'failed';
  const isIdle = !isGenerating && !isCompleted && !isFailed;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-text tracking-tight">
          {isCompleted ? 'Your Book Cover' : isGenerating ? 'Generating...' : 'Generate Book Cover'}
        </h1>
        {isIdle && (
          <p className="text-text-secondary mt-1 text-sm">Describe your book and let AI craft the cover.</p>
        )}
      </div>

      {isFailed && (
        <div className="mb-6 flex items-center gap-3 bg-error-bg border border-error-border text-error px-4 py-3 rounded-xl text-sm">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          <div className="flex-1">
            <p className="font-medium">Generation failed</p>
            <p className="text-xs mt-0.5 opacity-80">{generation.error || 'An unexpected error occurred.'}</p>
          </div>
          <button
            onClick={generation.reset}
            className="text-sm font-medium hover:underline flex-shrink-0"
          >
            Try again
          </button>
        </div>
      )}

      {generation.error && isIdle && !isFailed && (
        <div className="mb-6 bg-error-bg border border-error-border text-error px-4 py-3 rounded-xl text-sm">
          {generation.error}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6 lg:gap-8 items-start">
        <div className="bg-surface border border-border rounded-2xl p-5 sm:p-6">
          {isIdle || isFailed ? renderForm() : null}
          {isGenerating && renderFormSummary()}
          {isCompleted && renderResultInfo()}
        </div>

        <div className="lg:sticky lg:top-8">
          {isIdle || isFailed ? <PlaceholderPanel /> : null}
          {isGenerating && <ProgressPanel generation={generation} />}
          {isCompleted && generation.result && (
            <ResultPanel
              result={generation.result}
              generation={generation}
              user={user}
              onRegenerate={handleRegenerate}
              onReset={handleReset}
            />
          )}
        </div>
      </div>
    </div>
  );
}
