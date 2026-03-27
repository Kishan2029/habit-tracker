import { useAuth } from '../../context/AuthContext';
import ThemeToggle from '../settings/ThemeToggle';

export default function Header({ onMenuToggle }) {
  const { user, logout } = useAuth();

  return (
    <header className="h-14 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 sticky top-0 z-30">
      <button
        onClick={onMenuToggle}
        className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <div className="flex-1" />
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400 hidden sm:block">
            {user?.name}
          </span>
          <button
            onClick={logout}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
