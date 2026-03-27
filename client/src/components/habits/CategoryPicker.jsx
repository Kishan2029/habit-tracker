import { CATEGORIES } from '../../config/categories';

export default function CategoryPicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {CATEGORIES.map((cat) => (
        <button
          key={cat.value}
          type="button"
          onClick={() => onChange(cat.value)}
          className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg text-xs font-medium transition border ${
            value === cat.value
              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
              : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          <span className="text-lg">{cat.icon}</span>
          <span className="truncate w-full text-center">{cat.label}</span>
        </button>
      ))}
    </div>
  );
}
