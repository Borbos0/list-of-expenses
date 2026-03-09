import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.js';

const navItems = [
  { to: '/dashboard', label: 'Дашборд' },
  { to: '/transactions', label: 'Операции' },
  { to: '/import', label: 'Импорт' },
  { to: '/import-history', label: 'История импортов' },
  { to: '/rules', label: 'Правила' },
  { to: '/categories', label: 'Категории' },
  { to: '/settings', label: 'Настройки' },
];

export function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen bg-bg">
      {/* Боковая панель */}
      <aside className="w-60 bg-sidebar text-sidebar-text flex flex-col shrink-0 border-r border-border">
        <div className="p-4 text-lg font-bold border-b border-border text-text">
          Учёт расходов
        </div>
        <nav className="flex-1 py-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center px-4 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-sidebar-active text-white'
                    : 'text-sidebar-text hover:bg-surface-hover'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-border">
          <div className="text-sm text-text-secondary mb-2">{user?.username}</div>
          <button
            onClick={logout}
            className="text-sm text-text-secondary hover:text-white transition-colors"
          >
            Выйти
          </button>
        </div>
      </aside>

      {/* Основное содержимое */}
      <main className="flex-1 overflow-auto p-6 bg-bg">
        <Outlet />
      </main>
    </div>
  );
}
