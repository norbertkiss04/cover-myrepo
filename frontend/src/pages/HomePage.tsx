import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function HomePage() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <div className="py-12 sm:py-20">
      {}
      <div className="text-center max-w-3xl mx-auto">
        <p className="text-accent font-medium tracking-wide uppercase text-sm mb-4">
          For Authors & Publishers
        </p>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-heading font-bold text-text leading-tight mb-6">
          Book covers crafted by{' '}
          <span className="text-accent italic">imagination</span>,
          <br className="hidden sm:block" />
          powered by AI
        </h1>
        <p className="text-lg text-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed">
          Describe your story and watch it come to life as a stunning cover.
          Professional results in minutes, not weeks. Made for independent authors
          who refuse to judge a book by its budget.
        </p>

        <div className="flex justify-center gap-4">
          {isLoading ? (
            <div className="h-[52px]" />
          ) : isAuthenticated ? (
            <Link
              to="/generate"
              className="bg-accent text-white px-8 py-3.5 rounded-lg text-lg font-medium hover:bg-accent-hover transition-colors shadow-sm"
            >
              Generate a Cover
            </Link>
          ) : (
            <Link
              to="/login"
              className="bg-accent text-white px-8 py-3.5 rounded-lg text-lg font-medium hover:bg-accent-hover transition-colors shadow-sm"
            >
              Start Creating
            </Link>
          )}
        </div>
      </div>

      {}
      <div className="max-w-xs mx-auto my-16 flex items-center gap-4">
        <div className="flex-1 h-px bg-border"></div>
        <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
        </svg>
        <div className="flex-1 h-px bg-border"></div>
      </div>

      {}
      <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
        <div className="bg-surface border border-border rounded-xl p-6 hover:border-accent/30 transition-colors">
          <div className="w-10 h-10 bg-accent-soft rounded-lg flex items-center justify-center mb-4">
            <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          </div>
          <h3 className="font-heading text-lg font-semibold text-text mb-2">Minutes, Not Weeks</h3>
          <p className="text-text-secondary text-sm leading-relaxed">
            Your cover is generated in under a minute. No back-and-forth, no revisions limbo.
          </p>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6 hover:border-accent/30 transition-colors">
          <div className="w-10 h-10 bg-accent-soft rounded-lg flex items-center justify-center mb-4">
            <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42" />
            </svg>
          </div>
          <h3 className="font-heading text-lg font-semibold text-text mb-2">Genre-Aware Design</h3>
          <p className="text-text-secondary text-sm leading-relaxed">
            The AI understands genre conventions. Romance, thriller, sci-fi -- each gets the visual language readers expect.
          </p>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6 hover:border-accent/30 transition-colors">
          <div className="w-10 h-10 bg-accent-soft rounded-lg flex items-center justify-center mb-4">
            <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
            </svg>
          </div>
          <h3 className="font-heading text-lg font-semibold text-text mb-2">Fraction of the Cost</h3>
          <p className="text-text-secondary text-sm leading-relaxed">
            Professional covers without the professional price tag. 90% less than a traditional designer.
          </p>
        </div>
      </div>

      {}
      <div className="mt-20 max-w-2xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-heading font-bold text-text text-center mb-12">
          Three steps to your cover
        </h2>
        <div className="space-y-8">
          <div className="flex items-start gap-5">
            <div className="w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center flex-shrink-0 font-heading font-bold text-lg">
              1
            </div>
            <div className="pt-1">
              <h3 className="font-heading font-semibold text-text text-lg">Describe your book</h3>
              <p className="text-text-secondary mt-1 leading-relaxed">
                Title, genre, mood, a brief description. The more you share, the better the result.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-5">
            <div className="w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center flex-shrink-0 font-heading font-bold text-lg">
              2
            </div>
            <div className="pt-1">
              <h3 className="font-heading font-semibold text-text text-lg">AI creates your cover</h3>
              <p className="text-text-secondary mt-1 leading-relaxed">
                Our AI interprets your vision and generates a unique, print-ready cover design.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-5">
            <div className="w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center flex-shrink-0 font-heading font-bold text-lg">
              3
            </div>
            <div className="pt-1">
              <h3 className="font-heading font-semibold text-text text-lg">Download & publish</h3>
              <p className="text-text-secondary mt-1 leading-relaxed">
                Download your high-resolution cover, ready for KDP, IngramSpark, or any platform.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
