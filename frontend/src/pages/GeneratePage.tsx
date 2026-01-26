import { useState, useEffect, useRef } from 'react';
import { generationApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { GenerationInput, Generation, AspectRatioInfo } from '../types';

// All optional field definitions
const OPTIONAL_FIELD_DEFS = [
  { key: 'summary', label: 'Book Summary' },
  { key: 'genres', label: 'Genres' },
  { key: 'mood', label: 'Mood / Atmosphere' },
  { key: 'color_preference', label: 'Color Preference' },
  { key: 'character_description', label: 'Character Description' },
  { key: 'keywords', label: 'Keywords' },
  { key: 'reference_image_description', label: 'Style Reference' },
] as const;

type OptionalFieldKey = typeof OPTIONAL_FIELD_DEFS[number]['key'];

export default function GeneratePage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Generation | null>(null);

  // Form options
  const [genres, setGenres] = useState<string[]>([]);
  const [moods, setMoods] = useState<string[]>([]);
  const [aspectRatios, setAspectRatios] = useState<Record<string, AspectRatioInfo>>({});

  // Temp fields added for this session only (not saved to preferences)
  const [tempFields, setTempFields] = useState<Set<string>>(new Set());
  const [addFieldOpen, setAddFieldOpen] = useState(false);
  const addFieldRef = useRef<HTMLDivElement>(null);

  // Form state — starts empty
  const [formData, setFormData] = useState<GenerationInput>({
    book_title: '',
    author_name: '',
    summary: '',
    genres: [],
    mood: '',
    aspect_ratio: '2:3',
    color_preference: '',
    character_description: '',
    keywords: [],
    reference_image_description: '',
  });

  const [keywordInput, setKeywordInput] = useState('');

  // Compute which optional fields are visible
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
        const [genresData, moodsData, ratiosData] = await Promise.all([
          generationApi.getGenres(),
          generationApi.getMoods(),
          generationApi.getAspectRatios(),
        ]);
        setGenres(genresData);
        setMoods(moodsData);
        setAspectRatios(ratiosData);
      } catch (err) {
        console.error('Failed to load options:', err);
      }
    };
    loadOptions();
  }, []);

  // Close add-field dropdown on outside click
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      // Only send fields that are visible and have values
      const payload: GenerationInput = {
        book_title: formData.book_title,
        author_name: formData.author_name,
        aspect_ratio: formData.aspect_ratio,
      };

      if (visibleOptionalKeys.has('summary') && formData.summary) {
        payload.summary = formData.summary;
      }
      if (visibleOptionalKeys.has('genres') && formData.genres && formData.genres.length > 0) {
        payload.genres = formData.genres;
      }
      if (visibleOptionalKeys.has('mood') && formData.mood) {
        payload.mood = formData.mood;
      }
      if (visibleOptionalKeys.has('color_preference') && formData.color_preference) {
        payload.color_preference = formData.color_preference;
      }
      if (visibleOptionalKeys.has('character_description') && formData.character_description) {
        payload.character_description = formData.character_description;
      }
      if (visibleOptionalKeys.has('keywords') && formData.keywords && formData.keywords.length > 0) {
        payload.keywords = formData.keywords;
      }
      if (visibleOptionalKeys.has('reference_image_description') && formData.reference_image_description) {
        payload.reference_image_description = formData.reference_image_description;
      }

      const result = await generationApi.create(payload);
      setResult(result);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to generate cover');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenreToggle = (genre: string) => {
    setFormData((prev) => ({
      ...prev,
      genres: (prev.genres || []).includes(genre)
        ? (prev.genres || []).filter((g) => g !== genre)
        : [...(prev.genres || []), genre],
    }));
  };

  const handleAddKeyword = () => {
    if (keywordInput.trim() && !formData.keywords?.includes(keywordInput.trim())) {
      setFormData((prev) => ({
        ...prev,
        keywords: [...(prev.keywords || []), keywordInput.trim()],
      }));
      setKeywordInput('');
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    setFormData((prev) => ({
      ...prev,
      keywords: prev.keywords?.filter((k) => k !== keyword) || [],
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
    // Clear the field data when removing
    clearFieldData(key as OptionalFieldKey);
  };

  const clearFieldData = (key: OptionalFieldKey) => {
    setFormData((prev) => {
      const updated = { ...prev };
      if (key === 'genres') updated.genres = [];
      else if (key === 'keywords') updated.keywords = [];
      else if (key === 'summary') updated.summary = '';
      else if (key === 'mood') updated.mood = '';
      else if (key === 'color_preference') updated.color_preference = '';
      else if (key === 'character_description') updated.character_description = '';
      else if (key === 'reference_image_description') updated.reference_image_description = '';
      return updated;
    });
  };

  const handleRegenerate = async () => {
    if (!result) return;
    setIsLoading(true);
    setError(null);

    try {
      const newResult = await generationApi.regenerate(result.id);
      setResult(newResult);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to regenerate cover');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper: is this field a temp-added field (not in preferences)?
  const isTempField = (key: string) => tempFields.has(key) && !prefsFields.includes(key);

  // ── Render a single optional field ──
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
      case 'summary':
        return (
          <div key={key}>
            <div className="flex items-center mb-1.5">
              <label className="block text-sm font-medium text-text-secondary">Book Summary</label>
              {removeBtn}
            </div>
            <textarea
              rows={4}
              value={formData.summary || ''}
              onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
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

      case 'mood':
        return (
          <div key={key}>
            <div className="flex items-center mb-1.5">
              <label className="block text-sm font-medium text-text-secondary">Mood / Atmosphere</label>
              {removeBtn}
            </div>
            <select
              value={formData.mood || ''}
              onChange={(e) => setFormData({ ...formData, mood: e.target.value })}
              className={inputClass}
            >
              <option value="">Select a mood...</option>
              {moods.map((mood) => (
                <option key={mood} value={mood}>{mood}</option>
              ))}
            </select>
          </div>
        );

      case 'color_preference':
        return (
          <div key={key}>
            <div className="flex items-center mb-1.5">
              <label className="block text-sm font-medium text-text-secondary">Color Preference</label>
              {removeBtn}
            </div>
            <input
              type="text"
              value={formData.color_preference || ''}
              onChange={(e) => setFormData({ ...formData, color_preference: e.target.value })}
              className={inputClass}
              placeholder="e.g., Dark blues and golds, Warm autumn colors"
            />
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

      case 'keywords':
        return (
          <div key={key}>
            <div className="flex items-center mb-1.5">
              <label className="block text-sm font-medium text-text-secondary">Key Elements / Keywords</label>
              {removeBtn}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddKeyword())}
                className={`flex-1 ${inputClass}`}
                placeholder="e.g., sword, castle, dragon"
              />
              <button
                type="button"
                onClick={handleAddKeyword}
                className="px-4 py-2.5 bg-surface-alt text-text-secondary border border-border rounded-lg hover:bg-surface-hover hover:text-text transition-colors"
              >
                Add
              </button>
            </div>
            {formData.keywords && formData.keywords.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.keywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-accent-soft text-accent-text border border-accent/20"
                  >
                    {keyword}
                    <button
                      type="button"
                      onClick={() => handleRemoveKeyword(keyword)}
                      className="ml-2 hover:text-error transition-colors"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        );

      case 'reference_image_description':
        return (
          <div key={key}>
            <div className="flex items-center mb-1.5">
              <label className="block text-sm font-medium text-text-secondary">Style Reference Description</label>
              {removeBtn}
            </div>
            <textarea
              rows={2}
              value={formData.reference_image_description || ''}
              onChange={(e) => setFormData({ ...formData, reference_image_description: e.target.value })}
              className={inputClass}
              placeholder="Describe a visual style you'd like to emulate..."
            />
          </div>
        );

      default:
        return null;
    }
  };

  // ── Result View ──
  if (result && result.status === 'completed') {
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
                {result.genres && result.genres.length > 0 && (
                  <div className="flex gap-2">
                    <span className="font-medium text-text-secondary w-24 flex-shrink-0">Genres</span>
                    <span className="text-text">{result.genres.join(', ')}</span>
                  </div>
                )}
                {result.mood && (
                  <div className="flex gap-2">
                    <span className="font-medium text-text-secondary w-24 flex-shrink-0">Mood</span>
                    <span className="text-text">{result.mood}</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <span className="font-medium text-text-secondary w-24 flex-shrink-0">Ratio</span>
                  <span className="text-text">{result.aspect_ratio_info?.name}</span>
                </div>
              </div>

              <div className="mt-8 space-y-3">
                <button
                  onClick={handleRegenerate}
                  disabled={isLoading}
                  className="w-full bg-accent text-white py-2.5 px-4 rounded-lg font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors"
                >
                  {isLoading ? 'Regenerating...' : 'Regenerate Cover'}
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
                    setResult(null);
                    setFormData({
                      book_title: '',
                      author_name: '',
                      summary: '',
                      genres: [],
                      mood: '',
                      aspect_ratio: '2:3',
                      color_preference: '',
                      character_description: '',
                      keywords: [],
                      reference_image_description: '',
                    });
                    setTempFields(new Set());
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

  // ── Form View ──
  const inputClass =
    'w-full px-3.5 py-2.5 bg-surface-alt border border-border rounded-lg text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent';

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl sm:text-3xl font-heading font-bold text-text mb-2">Generate Book Cover</h1>
      <p className="text-text-secondary mb-8">Describe your book and let the AI craft a cover for it.</p>

      {error && (
        <div className="mb-6 bg-error-bg border border-error-border text-error px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {isLoading && (
        <div className="mb-6 bg-info-bg border border-info-border text-info px-4 py-3 rounded-lg">
          <div className="flex items-center text-sm">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent mr-3"></div>
            Generating your cover... This may take a minute.
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-xl p-6 sm:p-8 space-y-5">
        {/* Required: Book Title */}
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

        {/* Required: Author Name */}
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

        {/* Required: Aspect Ratio */}
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

        {/* Visible optional fields */}
        {visibleOptionalFields.length > 0 && (
          <div className="border-t border-border pt-5 space-y-5">
            {visibleOptionalFields.map((f) => renderOptionalField(f.key))}
          </div>
        )}

        {/* Add field button */}
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
          disabled={isLoading}
          className="w-full bg-accent text-white py-3 px-4 rounded-lg font-medium hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Generating...' : 'Generate Cover'}
        </button>
      </form>
    </div>
  );
}
