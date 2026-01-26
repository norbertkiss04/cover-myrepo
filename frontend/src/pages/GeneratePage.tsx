import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { generationApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { GenerationInput, Generation, AspectRatioInfo, StyleAnalysis } from '../types';

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

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

// Resize image on a canvas if it exceeds max dimensions
function resizeImage(file: File, maxDim = 2048): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width <= maxDim && height <= maxDim && file.size <= MAX_IMAGE_SIZE) {
          resolve(reader.result as string);
          return;
        }
        // Scale down
        const scale = Math.min(maxDim / width, maxDim / height, 1);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Accordion Section Component ──
function AccordionSection({
  title,
  value,
  onChange,
  defaultOpen = false,
}: {
  title: string;
  value: string;
  onChange: (v: string) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-surface-alt hover:bg-surface-hover transition-colors text-left"
      >
        <span className="text-sm font-medium text-text">{title}</span>
        <svg
          className={`w-4 h-4 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && (
        <div className="p-3">
          <textarea
            rows={3}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent resize-y"
          />
        </div>
      )}
    </div>
  );
}

export default function GeneratePage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
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

  // Style reference state
  const [styleTab, setStyleTab] = useState<'describe' | 'upload'>('describe');
  const [referenceImage, setReferenceImage] = useState<string | null>(null); // base64 data URL
  const [styleAnalysis, setStyleAnalysis] = useState<StyleAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compute which optional fields are visible
  const prefsFields = user?.preferences?.visible_fields || [];
  const visibleOptionalKeys = new Set<string>([...prefsFields, ...tempFields]);

  const visibleOptionalFields = OPTIONAL_FIELD_DEFS.filter((f) =>
    visibleOptionalKeys.has(f.key)
  );
  const hiddenOptionalFields = OPTIONAL_FIELD_DEFS.filter(
    (f) => !visibleOptionalKeys.has(f.key)
  );

  // Load form options
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

  // Handle incoming style reference from /references page
  useEffect(() => {
    const state = location.state as { styleRef?: { feeling: string; layout: string; illustration_rules: string; typography: string; image_url: string } } | null;
    if (state?.styleRef) {
      // Make sure the style reference field is visible
      setTempFields((prev) => new Set([...prev, 'reference_image_description']));
      setStyleTab('upload');
      setStyleAnalysis({
        feeling: state.styleRef.feeling || '',
        layout: state.styleRef.layout || '',
        illustration_rules: state.styleRef.illustration_rules || '',
        typography: state.styleRef.typography || '',
      });
      setReferenceImage(state.styleRef.image_url);
      // Clear the state so it doesn't re-apply on re-render
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate, location.pathname]);

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

      // Style reference: either text description or analyzed image (mutually exclusive based on active tab)
      if (visibleOptionalKeys.has('reference_image_description')) {
        if (styleTab === 'describe' && formData.reference_image_description) {
          payload.reference_image_description = formData.reference_image_description;
        } else if (styleTab === 'upload' && styleAnalysis) {
          payload.style_analysis = styleAnalysis;
        }
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
    // Also clear style analysis state if removing style reference field
    if (key === 'reference_image_description') {
      setStyleAnalysis(null);
      setReferenceImage(null);
      setAnalyzeError(null);
    }
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

  // ── Image upload handlers ──

  const handleImageSelect = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setAnalyzeError('Please select an image file.');
      return;
    }
    setAnalyzeError(null);
    setStyleAnalysis(null);

    try {
      const dataUrl = await resizeImage(file);
      setReferenceImage(dataUrl);
    } catch {
      setAnalyzeError('Failed to process image.');
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageSelect(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleImageSelect(file);
  }, [handleImageSelect]);

  const handleAnalyze = async () => {
    if (!referenceImage) return;
    setIsAnalyzing(true);
    setAnalyzeError(null);

    try {
      const ref = await generationApi.analyzeStyle(referenceImage);
      setStyleAnalysis({
        feeling: ref.feeling || '',
        layout: ref.layout || '',
        illustration_rules: ref.illustration_rules || '',
        typography: ref.typography || '',
      });
      // Update the referenceImage to the stored URL (from Supabase) so it persists
      if (ref.image_url) {
        setReferenceImage(ref.image_url);
      }
    } catch (err: any) {
      setAnalyzeError(err.response?.data?.error || 'Failed to analyze image.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleClearStyleRef = () => {
    setReferenceImage(null);
    setStyleAnalysis(null);
    setAnalyzeError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Helper: is this field a temp-added field (not in preferences)?
  const isTempField = (key: string) => tempFields.has(key) && !prefsFields.includes(key);

  // ── Render Style Reference field (tabbed) ──
  const renderStyleReferenceField = () => {
    const showRemove = isTempField('reference_image_description');
    const removeBtn = showRemove ? (
      <button
        type="button"
        onClick={() => handleRemoveTempField('reference_image_description')}
        className="ml-2 p-0.5 text-text-muted hover:text-error transition-colors"
        aria-label="Remove style reference field"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    ) : null;

    return (
      <div key="reference_image_description">
        <div className="flex items-center mb-3">
          <label className="block text-sm font-medium text-text-secondary">Style Reference</label>
          {removeBtn}
        </div>

        {/* Tabs */}
        <div className="flex mb-3 bg-surface-alt border border-border rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => setStyleTab('describe')}
            className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              styleTab === 'describe'
                ? 'bg-surface text-text shadow-sm border border-border'
                : 'text-text-muted hover:text-text'
            }`}
          >
            Describe
          </button>
          <button
            type="button"
            onClick={() => setStyleTab('upload')}
            className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              styleTab === 'upload'
                ? 'bg-surface text-text shadow-sm border border-border'
                : 'text-text-muted hover:text-text'
            }`}
          >
            Upload Image
          </button>
        </div>

        {/* Tab content */}
        {styleTab === 'describe' ? (
          <textarea
            rows={2}
            value={formData.reference_image_description || ''}
            onChange={(e) => setFormData({ ...formData, reference_image_description: e.target.value })}
            className={inputClass}
            placeholder="Describe a visual style you'd like to emulate..."
          />
        ) : (
          <div className="space-y-3">
            {/* Image upload area */}
            {!referenceImage ? (
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-accent/40 hover:bg-surface-alt/50 transition-colors"
              >
                <svg className="w-10 h-10 text-text-muted mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                </svg>
                <p className="text-sm text-text-secondary">
                  Drop an image here or <span className="text-accent font-medium">browse</span>
                </p>
                <p className="text-xs text-text-muted mt-1">Max 5MB. JPG, PNG, WebP</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            ) : (
              <>
                {/* Image preview + actions */}
                <div className="flex gap-3 items-start">
                  <img
                    src={referenceImage}
                    alt="Style reference"
                    className="w-24 h-24 object-cover rounded-lg border border-border flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    {!styleAnalysis && !isAnalyzing && (
                      <button
                        type="button"
                        onClick={handleAnalyze}
                        className="w-full bg-accent text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors"
                      >
                        Analyze Style
                      </button>
                    )}
                    {isAnalyzing && (
                      <div className="flex items-center gap-2 text-sm text-text-secondary py-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-accent border-t-transparent"></div>
                        Analyzing with Gemini...
                      </div>
                    )}
                    {styleAnalysis && (
                      <p className="text-xs text-accent font-medium py-1">Analysis complete</p>
                    )}
                    <div className="flex gap-2 mt-2">
                      <button
                        type="button"
                        onClick={handleClearStyleRef}
                        className="text-xs text-text-muted hover:text-error transition-colors"
                      >
                        Remove image
                      </button>
                      <span className="text-xs text-text-muted">|</span>
                      <button
                        type="button"
                        onClick={() => navigate('/references')}
                        className="text-xs text-accent hover:text-accent-hover transition-colors"
                      >
                        Use from library
                      </button>
                    </div>
                  </div>
                </div>

                {/* Analysis error */}
                {analyzeError && (
                  <p className="text-sm text-error">{analyzeError}</p>
                )}

                {/* Editable analysis accordion */}
                {styleAnalysis && (
                  <div className="space-y-2">
                    <AccordionSection
                      title="Feeling & Atmosphere"
                      value={styleAnalysis.feeling}
                      onChange={(v) => setStyleAnalysis({ ...styleAnalysis, feeling: v })}
                    />
                    <AccordionSection
                      title="Layout & Composition"
                      value={styleAnalysis.layout}
                      onChange={(v) => setStyleAnalysis({ ...styleAnalysis, layout: v })}
                    />
                    <AccordionSection
                      title="Illustration Rules"
                      value={styleAnalysis.illustration_rules}
                      onChange={(v) => setStyleAnalysis({ ...styleAnalysis, illustration_rules: v })}
                    />
                    <AccordionSection
                      title="Typography"
                      value={styleAnalysis.typography}
                      onChange={(v) => setStyleAnalysis({ ...styleAnalysis, typography: v })}
                    />
                  </div>
                )}
              </>
            )}

            {/* Link to library when no image is uploaded */}
            {!referenceImage && (
              <button
                type="button"
                onClick={() => navigate('/references')}
                className="flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover transition-colors font-medium"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
                Use from library
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  // ── Render a single optional field ──
  const renderOptionalField = (key: OptionalFieldKey) => {
    // Style reference gets special treatment
    if (key === 'reference_image_description') {
      return renderStyleReferenceField();
    }

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
                    setStyleAnalysis(null);
                    setReferenceImage(null);
                    setStyleTab('describe');
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
