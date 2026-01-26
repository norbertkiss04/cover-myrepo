import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { generationApi } from '../services/api';
import type { StyleReference } from '../types';

export default function StyleReferencesPage() {
  const navigate = useNavigate();
  const [refs, setRefs] = useState<StyleReference[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    loadRefs();
  }, []);

  const loadRefs = async () => {
    setIsLoading(true);
    try {
      const data = await generationApi.getStyleReferences();
      setRefs(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load style references');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this style reference? This cannot be undone.')) return;

    try {
      await generationApi.deleteStyleReference(id);
      setRefs((prev) => prev.filter((r) => r.id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete');
    }
  };

  const handleUse = (ref: StyleReference) => {
    navigate('/generate', {
      state: {
        styleRef: {
          feeling: ref.feeling || '',
          layout: ref.layout || '',
          illustration_rules: ref.illustration_rules || '',
          typography: ref.typography || '',
          image_url: ref.image_url,
        },
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-accent border-t-transparent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-error">{error}</p>
        <button
          onClick={loadRefs}
          className="mt-4 text-accent hover:text-accent-hover font-medium transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  if (refs.length === 0) {
    return (
      <div className="text-center py-16">
        <svg className="w-16 h-16 text-text-muted mx-auto mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
        </svg>
        <h2 className="text-xl font-heading font-semibold text-text">No style references yet</h2>
        <p className="mt-2 text-text-secondary">
          Upload a reference image when generating a cover to save it here.
        </p>
        <Link
          to="/generate"
          className="mt-6 inline-block bg-accent text-white px-6 py-2.5 rounded-lg font-medium hover:bg-accent-hover transition-colors"
        >
          Generate a Cover
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-text">Style References</h1>
        <p className="text-text-secondary mt-1">
          Your uploaded reference images and their AI-analyzed design briefs.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {refs.map((ref) => {
          const isExpanded = expandedId === ref.id;

          return (
            <div
              key={ref.id}
              className="bg-surface border border-border rounded-xl overflow-hidden hover:border-accent/30 transition-colors"
            >
              {/* Image */}
              <div className="aspect-square bg-surface-alt">
                <img
                  src={ref.image_url}
                  alt="Style reference"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Info */}
              <div className="p-4">
                {/* Truncated feeling preview */}
                {ref.feeling && (
                  <p className="text-sm text-text line-clamp-2 mb-1">{ref.feeling}</p>
                )}
                <p className="text-xs text-text-muted">
                  {new Date(ref.created_at).toLocaleDateString()}
                </p>

                {/* Actions */}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => handleUse(ref)}
                    className="flex-1 text-center text-sm bg-accent text-white py-1.5 px-3 rounded-lg hover:bg-accent-hover transition-colors font-medium"
                  >
                    Use
                  </button>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : ref.id)}
                    className="text-sm text-text-secondary border border-border py-1.5 px-3 rounded-lg hover:bg-surface-alt transition-colors"
                  >
                    {isExpanded ? 'Hide' : 'View'}
                  </button>
                  <button
                    onClick={() => handleDelete(ref.id)}
                    className="text-sm text-text-muted hover:text-error py-1.5 px-3 transition-colors"
                  >
                    Delete
                  </button>
                </div>

                {/* Expanded analysis view */}
                {isExpanded && (
                  <div className="mt-4 space-y-3 border-t border-border pt-3">
                    {ref.feeling && (
                      <div>
                        <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                          Feeling
                        </h4>
                        <p className="text-sm text-text whitespace-pre-wrap">{ref.feeling}</p>
                      </div>
                    )}
                    {ref.layout && (
                      <div>
                        <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                          Layout
                        </h4>
                        <p className="text-sm text-text whitespace-pre-wrap">{ref.layout}</p>
                      </div>
                    )}
                    {ref.illustration_rules && (
                      <div>
                        <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                          Illustration Rules
                        </h4>
                        <p className="text-sm text-text whitespace-pre-wrap">
                          {ref.illustration_rules}
                        </p>
                      </div>
                    )}
                    {ref.typography && (
                      <div>
                        <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                          Typography
                        </h4>
                        <p className="text-sm text-text whitespace-pre-wrap">{ref.typography}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
