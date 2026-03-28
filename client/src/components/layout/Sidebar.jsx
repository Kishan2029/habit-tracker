import { NavLink } from 'react-router-dom';

const navItems = [
  { path: '/today', label: 'Today', icon: '\u{1F4C5}' },
  { path: '/weekly', label: 'Weekly', icon: '\u{1F4C6}' },
  { path: '/habits', label: 'Habits', icon: '\u{1F4CB}' },
  { path: '/shared', label: 'Shared', icon: '\u{1F91D}' },
  { path: '/analytics', label: 'Analytics', icon: '\u{1F4CA}' },
  { path: '/settings', label: 'Settings', icon: '\u2699\uFE0F' },
];

export default function Sidebar({ isMobileOpen, onClose }) {
  return (
    <>
      {isMobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={onClose} />
      )}
      <aside
        className={`fixed top-0 left-0 h-full w-60 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 z-50 transform transition-transform duration-200 md:translate-x-0 md:static md:z-auto ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span>Habit Tracker</span>
          </h1>
        </div>
        <nav className="p-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`
              }
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
