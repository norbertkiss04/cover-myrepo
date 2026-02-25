import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../hooks/useTheme';
import SettingsModal from './SettingsModal';

function SunIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
    </svg>
  );
}

function BookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
    </svg>
  );
}

function CreditIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
    </svg>
  );
}

export default function Navbar() {
  const { user, supabaseUser, isAuthenticated, isLoading, isRecoveryMode } = useAuth();
  const { effective, toggle } = useTheme();
  const location = useLocation();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const showNavLinks = !isLoading && isAuthenticated && !isRecoveryMode;

  const isActive = (path: string) => location.pathname === path;

  useEffect(() => {
    if (!mobileNavOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileNavOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [mobileNavOpen]);

  const creditDisplay = user?.unlimited_credits
    ? 'Unlimited'
    : String(user?.credits ?? 0);

  return (
    <>
      <nav className="bg-surface/80 backdrop-blur-md border-b border-border sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 relative">
            {}
            <div className="flex items-center">
              <Link to="/" className="flex items-center gap-2">
                <BookIcon className="w-6 h-6 text-accent" />
                <span className="text-lg font-heading font-bold text-text tracking-tight">
                  Insta<span className="text-accent">Cover</span>
                </span>
              </Link>
            </div>

            {showNavLinks && (
              <div className="hidden lg:flex lg:absolute lg:left-1/2 lg:-translate-x-1/2 items-center gap-0.5 bg-surface-alt/60 rounded-lg p-0.5">
                <Link
                  to="/generate"
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    isActive('/generate')
                      ? 'text-text bg-surface shadow-sm'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  Generate
                </Link>
                <Link
                  to="/history"
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    isActive('/history')
                      ? 'text-text bg-surface shadow-sm'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  History
                </Link>
                <Link
                  to="/references"
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    isActive('/references')
                      ? 'text-text bg-surface shadow-sm'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  References
                </Link>
                <Link
                  to="/templates"
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    isActive('/templates')
                      ? 'text-text bg-surface shadow-sm'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  Templates
                </Link>
              </div>
            )}

            {}
            <div className="flex items-center gap-3">
              {isLoading ? (
                <div className="w-8 h-8 rounded-full bg-surface-alt animate-pulse" />
              ) : isRecoveryMode ? (
                <button
                  onClick={toggle}
                  className="p-2 rounded-lg text-text-secondary hover:text-text hover:bg-surface-alt transition-colors"
                  aria-label={`Switch to ${effective === 'dark' ? 'light' : 'dark'} mode`}
                >
                  {effective === 'dark' ? (
                    <SunIcon className="w-5 h-5" />
                  ) : (
                    <MoonIcon className="w-5 h-5" />
                  )}
                </button>
              ) : isAuthenticated ? (
                <div className="flex items-center gap-3">
                  {showNavLinks && (
                    <button
                      onClick={() => setMobileNavOpen((open) => !open)}
                      className="lg:hidden p-2 rounded-lg text-text-secondary hover:text-text hover:bg-surface-alt transition-colors"
                      aria-label={mobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
                      aria-expanded={mobileNavOpen}
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        {mobileNavOpen ? (
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
                        )}
                      </svg>
                    </button>
                  )}
                  <div className="hidden sm:flex items-center gap-1.5 text-sm text-text-secondary">
                    <CreditIcon className="w-4 h-4" />
                    <span className="font-medium">{creditDisplay}</span>
                  </div>
                  <button
                    onClick={() => setSettingsOpen(true)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center justify-center ${
                      settingsOpen
                        ? 'text-text bg-surface shadow-sm'
                        : 'text-text-muted hover:text-text'
                    }`}
                    aria-label="Open settings"
                  >
                    {user?.picture ? (
                      <img
                        src={user.picture}
                        alt={user?.name || 'User'}
                        className="w-6 h-6 rounded-full ring-2 ring-border"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-accent-soft flex items-center justify-center ring-2 ring-border">
                        <span className="text-[11px] font-semibold text-accent">
                          {user?.name?.charAt(0)?.toUpperCase() || supabaseUser?.email?.charAt(0)?.toUpperCase() || '?'}
                        </span>
                      </div>
                    )}
                  </button>
                </div>
              ) : (
                <Link
                  to="/login"
                  className="px-3 py-1.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors"
                >
                  Login
                </Link>
              )}
            </div>
          </div>
          {showNavLinks && (
            <div className={`lg:hidden ${mobileNavOpen ? 'block' : 'hidden'} pb-3`}>
              <div className="flex flex-col gap-1 bg-surface-alt/60 rounded-lg p-1">
                <Link
                  to="/generate"
                  onClick={() => setMobileNavOpen(false)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/generate')
                      ? 'text-text bg-surface shadow-sm'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  Generate
                </Link>
                <Link
                  to="/history"
                  onClick={() => setMobileNavOpen(false)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/history')
                      ? 'text-text bg-surface shadow-sm'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  History
                </Link>
                <Link
                  to="/references"
                  onClick={() => setMobileNavOpen(false)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/references')
                      ? 'text-text bg-surface shadow-sm'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  References
                </Link>
                <Link
                  to="/templates"
                  onClick={() => setMobileNavOpen(false)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/templates')
                      ? 'text-text bg-surface shadow-sm'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  Templates
                </Link>
              </div>
            </div>
          )}
        </div>
      </nav>

      {}
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
