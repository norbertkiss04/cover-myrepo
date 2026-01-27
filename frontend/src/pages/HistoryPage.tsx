import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Masonry from 'react-masonry-css';
import { ArrowDownTrayIcon, TrashIcon } from '@heroicons/react/24/outline';
import { generationApi } from '../services/api';
import type { Generation } from '../types';

const MASONRY_BREAKPOINTS = { default: 3, 1024: 2, 640: 1 };

export default function HistoryPage() {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadGenerations();
  }, [page]);

  const loadGenerations = async () => {
    setIsLoading(true);
    try {
      const data = await generationApi.getAll(page);
      setGenerations(data.generations);
      setTotalPages(data.pages);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load history');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this generation?')) return;

    try {
      await generationApi.delete(id);
      setGenerations((prev) => prev.filter((g) => g.id !== id));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete');
    }
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
          onClick={loadGenerations}
          className="mt-4 text-accent hover:text-accent-hover font-medium transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  if (generations.length === 0) {
    return (
      <div className="text-center py-16">
        <svg className="w-16 h-16 text-text-muted mx-auto mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
        </svg>
        <h2 className="text-xl font-heading font-semibold text-text">No covers yet</h2>
        <p className="mt-2 text-text-secondary">Your generated book covers will appear here.</p>
        <Link
          to="/generate"
          className="mt-6 inline-block bg-accent text-white px-6 py-2.5 rounded-lg font-medium hover:bg-accent-hover transition-colors"
        >
          Generate Your First Cover
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-text">Your Covers</h1>
      </div>

      <Masonry
        breakpointCols={MASONRY_BREAKPOINTS}
        className="masonry-grid"
        columnClassName="masonry-grid-column"
      >
        {generations.filter((gen) => gen.final_image_url).map((gen) => (
          <div key={gen.id} className="relative group rounded-xl overflow-hidden cursor-pointer">
            <img
              src={gen.final_image_url!}
              alt={gen.book_title}
              className="w-full h-auto block"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <h3 className="font-heading font-semibold text-white truncate">{gen.book_title}</h3>
                <p className="text-sm text-white/70 truncate">by {gen.author_name}</p>
                <p className="text-xs text-white/50 mt-1">
                  {new Date(gen.created_at).toLocaleDateString()}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <a
                    href={gen.final_image_url!}
                    download
                    onClick={(e) => e.stopPropagation()}
                    className="p-2 bg-white/20 hover:bg-white/30 rounded-lg backdrop-blur-sm transition-colors"
                    title="Download"
                  >
                    <ArrowDownTrayIcon className="w-5 h-5 text-white" />
                  </a>
                  <button
                    onClick={() => handleDelete(gen.id)}
                    className="p-2 bg-white/20 hover:bg-red-500/60 rounded-lg backdrop-blur-sm transition-colors"
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
            className="px-4 py-2 border border-border rounded-lg text-text-secondary hover:bg-surface-alt disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-sm text-text-secondary">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 border border-border rounded-lg text-text-secondary hover:bg-surface-alt disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
