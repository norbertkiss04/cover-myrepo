import type { Generation } from '../../types';

export default function ResultPanel({ result }: { result: Generation }) {
  return (
    <div className="w-full flex justify-center">
      <div className="w-[85%] relative group rounded-2xl overflow-hidden border border-border bg-surface cursor-pointer">
        <img
          src={result.final_image_url || result.base_image_url || ''}
          alt={result.book_title}
          className="w-full h-auto block"
        />
        <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-all duration-200 flex items-end justify-end p-3 opacity-0 group-hover:opacity-100">
          <a
            href={result.final_image_url || result.base_image_url || ''}
            download={`${result.book_title.replace(/\s+/g, '_')}_cover.png`}
            onClick={(e) => e.stopPropagation()}
            className="p-2 bg-white/20 hover:bg-white/30 rounded-lg backdrop-blur-sm transition-colors"
            title="Download"
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}
