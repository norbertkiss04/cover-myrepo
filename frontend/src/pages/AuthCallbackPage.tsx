import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {

    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const errorDescription = hashParams.get('error_description');
    if (errorDescription) {
      setError('Sign-in failed. Please try again.');
      return;
    }

    if (!isLoading) {
      if (isAuthenticated) {
        navigate('/generate');
      } else {

        const timeout = setTimeout(() => {
          if (!isAuthenticated) {
            navigate('/login');
          }
        }, 3000);
        return () => clearTimeout(timeout);
      }
    }
  }, [isAuthenticated, isLoading, navigate]);

  if (error) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center max-w-md">
          <p className="text-error mb-4">{error}</p>
          <button
            onClick={() => navigate('/login')}
            className="text-accent hover:text-accent-hover font-medium transition-colors"
          >
            Back to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto"></div>
        <p className="mt-4 text-text-secondary">Signing you in...</p>
      </div>
    </div>
  );
}
