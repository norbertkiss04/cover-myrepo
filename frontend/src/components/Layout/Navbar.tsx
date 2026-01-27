import { useState, useEffect, useRef } from 'react';
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
  const { user, supabaseUser, isAuthenticated, isLoading, logout } = useAuth();
  const { effective, toggle } = useTheme();
  const location = useLocation();

  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isActive = (path: string) => location.pathname === path;

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const creditDisplay = user?.unlimited_credits
    ? 'Unlimited'
    : String(user?.credits ?? 0);

  return (
    <>
      <nav className="bg-surface border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 relative">
            {}
            <div className="flex items-center">
              <Link to="/" className="flex items-center gap-2">
                <BookIcon className="w-6 h-6 text-accent" />
                <span className="text-xl font-heading font-bold text-text">
                  Insta<span className="text-accent">Cover</span>
                </span>
              </Link>
            </div>

            {!isLoading && isAuthenticated && (
              <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1">
                <Link
                  to="/generate"
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/generate')
                      ? 'text-accent bg-accent-soft'
                      : 'text-text-secondary hover:text-text hover:bg-surface-alt'
                  }`}
                >
                  Generate
                </Link>
                <Link
                  to="/history"
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/history')
                      ? 'text-accent bg-accent-soft'
                      : 'text-text-secondary hover:text-text hover:bg-surface-alt'
                  }`}
                >
                  History
                </Link>
                <Link
                  to="/references"
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/references')
                      ? 'text-accent bg-accent-soft'
                      : 'text-text-secondary hover:text-text hover:bg-surface-alt'
                  }`}
                >
                  References
                </Link>
              </div>
            )}

            {}
            <div className="flex items-center gap-3">
              {isLoading ? (
                <div className="w-8 h-8 rounded-full bg-surface-alt animate-pulse" />
              ) : isAuthenticated ? (

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-sm text-text-secondary">
                    <CreditIcon className="w-4 h-4" />
                    <span className="font-medium">{creditDisplay}</span>
                  </div>

                  <div className="relative" ref={menuRef}>
                    <button
                      onClick={() => setMenuOpen(!menuOpen)}
                      className="flex items-center rounded-full focus:outline-none focus:ring-2 focus:ring-accent/40 focus:ring-offset-2 focus:ring-offset-surface"
                    >
                      {user?.picture ? (
                        <img
                          src={user.picture}
                          alt={user?.name || 'User'}
                          className="w-8 h-8 rounded-full ring-2 ring-border"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-accent-soft flex items-center justify-center ring-2 ring-border">
                          <span className="text-sm font-medium text-accent">
                            {user?.name?.charAt(0)?.toUpperCase() || supabaseUser?.email?.charAt(0)?.toUpperCase() || '?'}
                          </span>
                        </div>
                      )}
                    </button>

                    {}
                    {menuOpen && (
                      <div className="absolute right-0 mt-2 w-56 bg-surface border border-border rounded-xl shadow-lg py-1 z-40">
                        {}
                        <div className="px-4 py-3 border-b border-border">
                          <p className="text-sm font-medium text-text truncate">
                            {user?.name || supabaseUser?.email?.split('@')[0]}
                          </p>
                          <p className="text-xs text-text-muted truncate">
                            {supabaseUser?.email || user?.email}
                          </p>
                        </div>

                        {}
                        <div className="py-1">
                          <button
                            onClick={() => {
                              setMenuOpen(false);
                              setSettingsOpen(true);
                            }}
                            className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-text-secondary hover:text-text hover:bg-surface-alt transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                            </svg>
                            Settings
                          </button>
                          <button
                            onClick={() => {
                              setMenuOpen(false);
                              logout();
                            }}
                            className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-text-secondary hover:text-text hover:bg-surface-alt transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                            </svg>
                            Logout
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (

                <>
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
                  <Link
                    to="/login"
                    className="bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors"
                  >
                    Login
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {}
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
