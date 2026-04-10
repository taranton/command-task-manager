import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { AppShell } from './components/layout/AppShell';
import LoginPage from './app/login/page';
import BoardPage from './app/board/page';
import AdminPage from './app/admin/page';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;

  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppShell>
              <Routes>
                <Route path="/" element={<Navigate to="/board" replace />} />
                <Route path="/board" element={<BoardPage />} />
                <Route path="/my-tasks" element={<BoardPage />} />
                <Route path="/stories" element={<div>Stories (coming soon)</div>} />
                <Route path="/admin" element={<AdminPage />} />
              </Routes>
            </AppShell>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
