import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GenerationProvider } from './context/GenerationContext';
import { GenerationFormProvider } from './context/GenerationFormContext';
import Layout from './components/Layout/Layout';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import GeneratePage from './pages/GeneratePage';
import StyleReferencesPage from './pages/StyleReferencesPage';
import HistoryPage from './pages/HistoryPage';

function RecoveryGuard({ children }: { children: React.ReactNode }) {
  const { isRecoveryMode } = useAuth();
  const location = useLocation();

  if (isRecoveryMode && location.pathname !== '/reset-password') {
    return <Navigate to="/reset-password" replace />;
  }

  return <>{children}</>;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <GenerationProvider>
        <GenerationFormProvider>
        <BrowserRouter>
          <RecoveryGuard>
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<HomePage />} />
                <Route path="login" element={<LoginPage />} />
                <Route path="forgot-password" element={<ForgotPasswordPage />} />
                <Route path="reset-password" element={<ResetPasswordPage />} />
                <Route path="auth/callback" element={<AuthCallbackPage />} />
                <Route
                  path="generate"
                  element={
                    <ProtectedRoute>
                      <GeneratePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="references"
                  element={
                    <ProtectedRoute>
                      <StyleReferencesPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="history"
                  element={
                    <ProtectedRoute>
                      <HistoryPage />
                    </ProtectedRoute>
                  }
                />
              </Route>
            </Routes>
          </RecoveryGuard>
        </BrowserRouter>
        </GenerationFormProvider>
        </GenerationProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
