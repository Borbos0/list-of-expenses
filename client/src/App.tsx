import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext.js';
import { Layout } from './components/Layout.js';
import { LoginPage } from './pages/LoginPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { TransactionsPage } from './pages/TransactionsPage.js';
import { ImportPage } from './pages/ImportPage.js';
import { RulesPage } from './pages/RulesPage.js';
import { CategoriesPage } from './pages/CategoriesPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { CategoryDetailPage } from './pages/CategoryDetailPage.js';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg text-gray-500">Загрузка...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="import" element={<ImportPage />} />
        <Route path="rules" element={<RulesPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="category/:categoryId" element={<CategoryDetailPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
