import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await resetPassword(email);
      setSent(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-heading font-bold text-text tracking-tight">
            Reset your password
          </h1>
          <p className="mt-2 text-text-secondary text-sm">
            Enter your email and we'll send you a link to reset your password.
          </p>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-8">
          {error && (
            <div className="mb-4 p-3 bg-error-bg border border-error-border text-error rounded-xl text-sm">
              {error}
            </div>
          )}

          {sent ? (
            <div className="text-center">
              <div className="mb-4 p-3 bg-success-bg border border-success-border text-success rounded-xl text-sm">
                Check your email for a password reset link!
              </div>
              <p className="text-sm text-text-secondary mt-4">
                Didn't receive it? Check your spam folder or{' '}
                <button
                  type="button"
                  onClick={() => setSent(false)}
                  className="text-accent hover:text-accent-hover font-medium transition-colors"
                >
                  try again
                </button>
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-surface-alt border border-border rounded-xl text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 text-sm"
                  placeholder="you@example.com"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-accent text-white py-2 px-4 rounded-lg font-medium hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors mt-2 text-sm"
              >
                {isLoading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-text-secondary">
            Remember your password?{' '}
            <Link
              to="/login"
              className="text-accent hover:text-accent-hover font-medium transition-colors"
            >
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
