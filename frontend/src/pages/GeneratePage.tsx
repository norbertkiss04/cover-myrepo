import { useState, useEffect, useRef } from 'react';
import { generationApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useGeneration } from '../context/GenerationContext';
import type { GenerationInput, AspectRatioInfo, StyleReference } from '../types';

const OPTIONAL_FIELD_DEFS = [
  { key: 'description', label: 'Book Description' },
  { key: 'genres', label: 'Genres' },
  { key: 'character_description', label: 'Character Description' },
] as const;

type OptionalFieldKey = typeof OPTIONAL_FIELD_DEFS[number]['key'];

export default function GeneratePage() {
  const { user } = useAuth();
  const generation = useGeneration();

  const [genres, setGenres] = useState<string[]>([]);
  const [aspectRatios, setAspectRatios] = useState<Record<string, AspectRatioInfo>>({});

  const [styleReferences, setStyleReferences] = useState<StyleReference[]>([]);
  const [selectedRefId, setSelectedRefId] = useState<number | null>(null);
  const [useStyleImage, setUseStyleImage] = useState(false);
  const [coverStyleImage, setCoverStyleImage] = useState(false);

  const [tempFields, setTempFields] = useState<Set<string>>(new Set());
  const [addFieldOpen, setAddFieldOpen] = useState(false);
  const addFieldRef = useRef<HTMLDivElement>(null);

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
      book_title: formData.book_title,
      author_name: formData.author_name,
      aspect_ratio: formData.aspect_ratio,
    };

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

  const isTempField = (key: string) => tempFields.has(key) && !prefsFields.includes(key);

  const renderOptionalField = (key: OptionalFieldKey) => {
    const showRemove = isTempField(key);
    const removeBtn = showRemove ? (
      <button
        type="button"
        onClick={() => handleRemoveTempField(key)}
        className="ml-2 p-0.5 text-text-muted hover:text-error transition-colors"
        aria-label={`Remove ${key} field`}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
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
              rows={4}
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className={inputClass}
              placeholder="Describe your book's plot, themes, and key elements..."
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
            <div className="flex flex-wrap gap-2">
              {genres.map((genre) => (
                <button
                  key={genre}
                  type="button"
                  onClick={() => handleGenreToggle(genre)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
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
              placeholder="Describe main character appearance if they should be on the cover..."
            />
          </div>
        );

      default:
        return null;
    }
  };

  if (generation.status === 'generating') {
    const progressPercent = generation.totalSteps > 0
      ? Math.round((generation.step / generation.totalSteps) * 100)
      : 0;

    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-text mb-6">Generating Your Cover</h1>

        <div className="bg-surface border border-border rounded-xl p-6 sm:p-8">
          <div className="text-center mb-8">
            <h2 className="text-xl font-heading font-semibold text-text">{generation.bookTitle}</h2>
            <p className="text-text-secondary mt-1">by {generation.authorName}</p>
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between text-sm text-text-secondary mb-2">
              <span>{generation.stepMessage || 'Preparing...'}</span>
              {generation.totalSteps > 0 && (
                <span>Step {generation.step} of {generation.totalSteps}</span>
              )}
            </div>
            <div className="w-full bg-surface-alt rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-500 ease-out"
                style={{ width: `${Math.max(progressPercent, 5)}%` }}
              />
            </div>
          </div>

          <div className="space-y-3">
            {Array.from({ length: generation.totalSteps || 4 }, (_, i) => {
              const stepNum = i + 1;
              const isActive = stepNum === generation.step;
              const isDone = stepNum < generation.step;

              return (
                <div key={stepNum} className="flex items-center gap-3">
                  <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium border-2 transition-colors ${
                    isDone
                      ? 'bg-accent border-accent text-white'
                      : isActive
                        ? 'border-accent text-accent bg-accent-soft'
                        : 'border-border text-text-muted'
                  }`}>
                    {isDone ? (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    ) : (
                      stepNum
                    )}
                  </div>
                  <span className={`text-sm ${
                    isActive ? 'text-text font-medium' : isDone ? 'text-text-secondary' : 'text-text-muted'
                  }`}>
                    {isActive ? generation.stepMessage : isDone ? 'Done' : 'Waiting...'}
                  </span>
                  {isActive && (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-accent border-t-transparent ml-auto" />
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-center text-xs text-text-muted mt-8">
            You can navigate to other pages while your cover is being generated.
          </p>
        </div>
      </div>
    );
  }

  if (generation.status === 'completed' && generation.result) {
    const result = generation.result;
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-text mb-6">Your Book Cover</h1>

        <div className="bg-surface border border-border rounded-xl p-6 sm:p-8">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="flex justify-center">
              <img
                src={result.final_image_url || result.base_image_url || ''}
                alt={result.book_title}
                className="max-w-full rounded-lg shadow-lg ring-1 ring-border"
              />
            </div>
            <div>
              <h2 className="text-xl font-heading font-semibold text-text">{result.book_title}</h2>
              <p className="text-text-secondary mt-1">by {result.author_name}</p>

              <div className="mt-6 space-y-3 text-sm">
                {result.cover_ideas && (
                  <div className="flex gap-2">
                    <span className="font-medium text-text-secondary w-24 flex-shrink-0">Ideas</span>
                    <span className="text-text">{result.cover_ideas}</span>
                  </div>
                )}
                {result.genres && result.genres.length > 0 && (
                  <div className="flex gap-2">
                    <span className="font-medium text-text-secondary w-24 flex-shrink-0">Genres</span>
                    <span className="text-text">{result.genres.join(', ')}</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <span className="font-medium text-text-secondary w-24 flex-shrink-0">Ratio</span>
                  <span className="text-text">{result.aspect_ratio_info?.name}</span>
                </div>
                {result.style_analysis && (
                  <div className="flex gap-2">
                    <span className="font-medium text-text-secondary w-24 flex-shrink-0">Style Ref</span>
                    <span className="text-text">Applied</span>
                  </div>
                )}
              </div>

              <div className="mt-8 space-y-3">
                <button
                  onClick={handleRegenerate}
                  disabled={generation.status !== 'completed'}
                  className="w-full bg-accent text-white py-2.5 px-4 rounded-lg font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors"
                >
                  Regenerate Cover
                </button>

                <a
                  href={result.final_image_url || result.base_image_url || ''}
                  download={`${result.book_title.replace(/\s+/g, '_')}_cover.png`}
                  className="block w-full text-center bg-surface-alt text-text border border-border py-2.5 px-4 rounded-lg hover:bg-surface-hover transition-colors"
                >
                  Download Cover
                </a>

                <button
                  onClick={() => {
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
                  }}
                  className="w-full text-text-muted py-2.5 px-4 rounded-lg hover:text-text transition-colors"
                >
                  Create New Cover
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (generation.status === 'failed') {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-text mb-6">Generation Failed</h1>

        <div className="bg-surface border border-border rounded-xl p-6 sm:p-8 text-center">
          <svg className="w-16 h-16 text-error mx-auto mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          <p className="text-error text-lg font-medium mb-2">Something went wrong</p>
          <p className="text-text-secondary text-sm mb-6">{generation.error || 'An unexpected error occurred during generation.'}</p>
          <button
            onClick={generation.reset}
            className="bg-accent text-white py-2.5 px-6 rounded-lg font-medium hover:bg-accent-hover transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const inputClass =
    'w-full px-3.5 py-2.5 bg-surface-alt border border-border rounded-lg text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent';

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl sm:text-3xl font-heading font-bold text-text mb-2">Generate Book Cover</h1>
      <p className="text-text-secondary mb-8">Describe your book and let the AI craft a cover for it.</p>

      {generation.error && generation.status === 'idle' && (
        <div className="mb-6 bg-error-bg border border-error-border text-error px-4 py-3 rounded-lg text-sm">
          {generation.error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-xl p-6 sm:p-8 space-y-5">
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
            placeholder="Enter your book title"
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
            placeholder="Author name as it should appear on cover"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">
            Cover Ideas
          </label>
          <textarea
            rows={3}
            value={formData.cover_ideas || ''}
            onChange={(e) => setFormData({ ...formData, cover_ideas: e.target.value })}
            className={inputClass}
            placeholder="Describe how you want the cover to look — colors, imagery, mood, composition, style... anything goes."
          />
          <p className="mt-1.5 text-xs text-text-muted">
            Leave blank to let the AI decide based on your book details.
          </p>
        </div>

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
                {info.name} ({ratio}) - {info.width}x{info.height}px
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
            <p className="mt-1.5 text-xs text-text-muted">
              No references yet.{' '}
              <a href="/references" className="text-accent hover:text-accent-hover transition-colors">
                Create one
              </a>
            </p>
          )}
          {selectedRefId !== null && (
            <div className="mt-2 space-y-2">
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
                    Fill canvas with reference (crop to fit, no white bars)
                  </span>
                </label>
              )}
            </div>
          )}
        </div>

        {visibleOptionalFields.length > 0 && (
          <div className="border-t border-border pt-5 space-y-5">
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
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add field
            </button>

            {addFieldOpen && (
              <div className="absolute left-0 mt-1 w-56 bg-surface border border-border rounded-lg shadow-lg z-10 py-1">
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
          disabled={generation.status !== 'idle' || !generation.socketConnected}
          className="w-full bg-accent text-white py-3 px-4 rounded-lg font-medium hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Generate Cover
        </button>
      </form>
    </div>
  );
}
