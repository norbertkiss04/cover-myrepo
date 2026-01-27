import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function HeroBlobs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute -top-20 -right-20 w-72 h-72 bg-accent/10 rounded-full blur-3xl animate-gradient-blob" />
      <div className="absolute top-1/2 -right-10 w-56 h-56 bg-rose-300/10 dark:bg-rose-500/5 rounded-full blur-3xl animate-gradient-blob-delay" />
      <div className="absolute -bottom-10 right-1/4 w-48 h-48 bg-pink-200/15 dark:bg-pink-500/5 rounded-full blur-3xl animate-gradient-blob-delay-2" />
    </div>
  );
}

export default function HomePage() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <div className="py-8 sm:py-16 space-y-20">
      <section className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-accent-soft border border-accent/20 rounded-full mb-6">
            <div className="w-1.5 h-1.5 bg-accent rounded-full" />
            <span className="text-xs font-medium text-accent-text tracking-wide uppercase">
              AI-Powered Design
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-heading font-bold text-text leading-[1.1] tracking-tight mb-6">
            Book covers
            <br />
            made in
            <br />
            <span className="text-accent">minutes</span>, not months
          </h1>

          <p className="text-lg text-text-secondary leading-relaxed mb-8 max-w-md">
            Describe your story and get a professional, print-ready cover.
            Built for indie authors who move fast.
          </p>

          <div className="flex items-center gap-4">
            {isLoading ? (
              <div className="h-12" />
            ) : isAuthenticated ? (
              <Link
                to="/generate"
                className="bg-accent text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors"
              >
                Generate a Cover
              </Link>
            ) : (
              <Link
                to="/login"
                className="bg-accent text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors"
              >
                Start Creating
              </Link>
            )}
            <span className="text-sm text-text-muted">3 credits per cover</span>
          </div>
        </div>

        <div className="relative hidden lg:block">
          <HeroBlobs />
          <div className="relative grid grid-cols-2 gap-4">
            <div className="space-y-4">
              <div className="bg-surface border border-border rounded-2xl p-6 h-44 flex items-end">
                <div>
                  <div className="w-10 h-1 bg-accent rounded-full mb-3" />
                  <div className="w-24 h-2 bg-border rounded-full mb-2" />
                  <div className="w-16 h-2 bg-border rounded-full" />
                </div>
              </div>
              <div className="bg-accent/10 border border-accent/20 rounded-2xl p-6 h-32 flex items-center justify-center">
                <svg className="w-12 h-12 text-accent/60" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                </svg>
              </div>
            </div>
            <div className="space-y-4 pt-8">
              <div className="bg-surface border border-border rounded-2xl p-6 h-32 flex items-center justify-center">
                <svg className="w-10 h-10 text-text-muted/40" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
                </svg>
              </div>
              <div className="bg-surface border border-border rounded-2xl p-6 h-44 flex items-end">
                <div className="w-full">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 bg-accent/20 rounded-full" />
                    <div className="w-16 h-2 bg-border rounded-full" />
                  </div>
                  <div className="w-full h-2 bg-surface-alt rounded-full overflow-hidden">
                    <div className="w-3/4 h-full bg-accent/40 rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 auto-rows-[minmax(160px,auto)]">
          <div className="md:col-span-2 lg:col-span-2 md:row-span-2 bg-surface border border-border rounded-2xl p-8 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-40 h-40 bg-accent/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform duration-500" />
            <div>
              <div className="w-10 h-10 bg-accent-soft rounded-xl flex items-center justify-center mb-5">
                <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              </div>
              <h3 className="font-heading text-xl font-semibold text-text mb-3">Minutes, Not Weeks</h3>
              <p className="text-text-secondary leading-relaxed max-w-sm">
                Your cover is generated in under a minute. No back-and-forth with designers, no endless revision cycles. Describe it, generate it, ship it.
              </p>
            </div>
            <div className="flex items-center gap-2 mt-6 text-sm text-text-muted">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              Average generation: 45 seconds
            </div>
          </div>

          <div className="bg-surface border border-border rounded-2xl p-6 flex flex-col justify-between group hover:border-accent/30 transition-colors">
            <div className="w-9 h-9 bg-accent-soft rounded-lg flex items-center justify-center mb-4">
              <svg className="w-4.5 h-4.5 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42" />
              </svg>
            </div>
            <div>
              <h3 className="font-heading text-base font-semibold text-text mb-1.5">Genre-Aware</h3>
              <p className="text-text-secondary text-sm leading-relaxed">
                Romance, thriller, sci-fi -- each gets the visual language readers expect.
              </p>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-2xl p-6 flex flex-col justify-between group hover:border-accent/30 transition-colors">
            <div className="w-9 h-9 bg-accent-soft rounded-lg flex items-center justify-center mb-4">
              <svg className="w-4.5 h-4.5 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-heading text-base font-semibold text-text mb-1.5">90% Cheaper</h3>
              <p className="text-text-secondary text-sm leading-relaxed">
                Professional covers without the professional price tag.
              </p>
            </div>
          </div>

          <div className="md:col-span-3 lg:col-span-2 bg-surface-alt border border-border rounded-2xl p-6 sm:p-8">
            <h3 className="font-heading text-base font-semibold text-text mb-6">How it works</h3>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 sm:gap-0">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center flex-shrink-0 text-sm font-semibold">
                  1
                </div>
                <div>
                  <p className="text-sm font-medium text-text">Describe</p>
                  <p className="text-xs text-text-muted">Title, genre, mood</p>
                </div>
              </div>
              <div className="hidden sm:block w-12 h-px bg-border flex-shrink-0" />
              <div className="flex items-center gap-3 flex-1">
                <div className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center flex-shrink-0 text-sm font-semibold">
                  2
                </div>
                <div>
                  <p className="text-sm font-medium text-text">Generate</p>
                  <p className="text-xs text-text-muted">AI crafts your cover</p>
                </div>
              </div>
              <div className="hidden sm:block w-12 h-px bg-border flex-shrink-0" />
              <div className="flex items-center gap-3 flex-1">
                <div className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center flex-shrink-0 text-sm font-semibold">
                  3
                </div>
                <div>
                  <p className="text-sm font-medium text-text">Publish</p>
                  <p className="text-xs text-text-muted">Download & ship</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
