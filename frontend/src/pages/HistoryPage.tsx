import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Masonry from 'react-masonry-css';
import { ArrowDownTrayIcon, TrashIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import { useGenerations, useStyleReferences, useDeleteGeneration } from '../hooks/useApiQueries';
import GenerationSettingsModal from '../components/GenerationSettingsModal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorState from '../components/common/ErrorState';
import type { Generation } from '../types';
import { MASONRY_BREAKPOINTS } from '../constants';

export default function HistoryPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [settingsGen, setSettingsGen] = useState<Generation | null>(null);

  const { data: generationsData, isLoading, error, refetch } = useGenerations(page);
  const { data: styleReferences = [] } = useStyleReferences();
  const deleteGeneration = useDeleteGeneration();

  const generations = generationsData?.generations ?? [];
  const totalPages = generationsData?.pages ?? 1;

  const handleDelete = (id: number) => {
    if (!confirm('Are you sure you want to delete this generation?')) return;
    deleteGeneration.mutate(id);
  };

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error.message || 'Failed to load history'} onRetry={refetch} />;

  if (generations.length === 0) {
    return (
      <div className="text-center py-16">
        <svg className="w-16 h-16 text-text-muted mx-auto mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
        </svg>
        <h2 className="text-xl font-heading font-semibold text-text tracking-tight">No covers yet</h2>
        <p className="mt-2 text-text-secondary">Your generated book covers will appear here.</p>
        <Link
          to="/generate"
          className="mt-6 inline-block bg-accent text-white px-5 py-2 rounded-lg font-medium hover:bg-accent-hover transition-colors text-sm"
        >
          Generate Your First Cover
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-text tracking-tight">Your Covers</h1>
      </div>

      <Masonry
        breakpointCols={MASONRY_BREAKPOINTS}
        className="masonry-grid"
        columnClassName="masonry-grid-column"
      >
        {generations.filter((gen) => gen.final_image_url).map((gen) => (
          <div key={gen.id} className="relative group rounded-2xl overflow-hidden cursor-pointer">
            <img
              src={gen.final_image_url!}
              alt={gen.book_title}
              crossOrigin="anonymous"
              className="w-full h-auto block opacity-0 transition-opacity duration-300"
              onLoad={(e) => { (e.target as HTMLImageElement).style.opacity = '1'; }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-heading font-semibold text-white truncate">
                      {gen.book_title && gen.book_title !== 'Untitled'
                        ? gen.book_title
                        : gen.cover_ideas
                          ? gen.cover_ideas.slice(0, 40) + (gen.cover_ideas.length > 40 ? '...' : '')
                          : 'Untitled'}
                    </h3>
                    {gen.book_title && gen.book_title !== 'Untitled' && (
                      <p className="text-sm text-white/70 truncate">by {gen.author_name}</p>
                    )}
                    {gen.base_image_only && (
                      <p className="text-xs text-white/50 mt-0.5">Image only</p>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setSettingsGen(gen); }}
                    className="flex-shrink-0 p-2 bg-white/20 hover:bg-white/30 rounded-lg backdrop-blur-sm transition-colors cursor-pointer"
                    title="View Settings"
                  >
                    <Cog6ToothIcon className="w-5 h-5 text-white" />
                  </button>
                  <a
                    href={gen.final_image_url!}
                    download
                    onClick={(e) => e.stopPropagation()}
                    className="flex-shrink-0 p-2 bg-white/20 hover:bg-white/30 rounded-lg backdrop-blur-sm transition-colors cursor-pointer"
                    title="Download"
                  >
                    <ArrowDownTrayIcon className="w-5 h-5 text-white" />
                  </a>
                  <button
                    onClick={() => handleDelete(gen.id)}
                    className="flex-shrink-0 p-2 bg-white/20 hover:bg-red-500/60 rounded-lg backdrop-blur-sm transition-colors cursor-pointer"
                    title="Delete"
                  >
                    <TrashIcon className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </Masonry>

      {totalPages > 1 && (
        <div className="mt-8 flex justify-center items-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 border border-border rounded-xl text-sm text-text-secondary hover:bg-surface-alt disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-sm text-text-muted">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 border border-border rounded-xl text-sm text-text-secondary hover:bg-surface-alt disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}
      {settingsGen && (
        <GenerationSettingsModal
          generation={settingsGen}
          styleReferenceName={
            settingsGen.style_reference_id
              ? styleReferences.find((r) => r.id === settingsGen.style_reference_id)?.title || 'Deleted Reference'
              : null
          }
          onClose={() => setSettingsGen(null)}
          onUseSettings={(gen) => {
            setSettingsGen(null);
            navigate('/generate', { state: { fromGeneration: gen } });
          }}
        />
      )}
    </div>
  );
}
