import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useWebSocket } from './hooks/useWebSocket';
import { AppShell } from './components/layout/AppShell';
import LoginPage from './app/login/page';
import BoardPage from './app/board/page';
import YourBoardsPage from './app/boards/page';
import AdminPage from './app/admin/page';
import CLevelBoardPage from './app/clevel/page';
import ExecutivePage from './app/executive/page';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  useWebSocket(); // Connect to WebSocket for real-time updates

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
                <Route path="/board" element={<YourBoardsPage />} />
                <Route path="/board/region/:regionId" element={<BoardPage />} />
                <Route path="/board/:teamId" element={<BoardPage />} />
                <Route path="/my-tasks" element={<BoardPage />} />
                <Route path="/c-level" element={<CLevelBoardPage />} />
                <Route path="/executive" element={<ExecutivePage />} />
                <Route path="/admin" element={<AdminPage />} />
              </Routes>
            </AppShell>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
