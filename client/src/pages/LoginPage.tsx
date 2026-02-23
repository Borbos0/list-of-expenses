import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.js';
import { useToast } from '../contexts/ToastContext.js';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const { addToast } = useToast();

  if (user) {
    navigate('/dashboard', { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(username, password);
      navigate('/dashboard', { replace: true });
    } catch {
      addToast('Неверные учётные данные', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-bg">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-surface rounded-xl shadow-lg shadow-black/30 p-8"
      >
        <h1 className="text-2xl font-bold text-center mb-6">Учёт расходов</h1>
        <div className="mb-4">
          <label className="block text-sm font-medium text-text mb-1">
            Логин
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg bg-input-bg text-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            required
            autoFocus
          />
        </div>
        <div className="mb-6">
          <label className="block text-sm font-medium text-text mb-1">
            Пароль
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg bg-input-bg text-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
        >
          {loading ? 'Вход...' : 'Войти'}
        </button>
      </form>
    </div>
  );
}
