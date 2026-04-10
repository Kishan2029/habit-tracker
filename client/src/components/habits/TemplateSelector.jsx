import { HABIT_TEMPLATES } from '../../config/habitTemplates';
import { CATEGORIES, getCategoryConfig } from '../../config/categories';

export default function TemplateSelector({ onSelect, onScratch }) {
  // Group templates by category
  const grouped = CATEGORIES.reduce((acc, cat) => {
    const templates = HABIT_TEMPLATES.filter((t) => t.category === cat.value);
    if (templates.length > 0) {
      acc.push({ ...cat, templates });
    }
    return acc;
  }, []);

  return (
    <div className="space-y-5">
      <button
        onClick={onScratch}
        className="w-full py-3 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 text-sm font-medium hover:border-indigo-400 hover:text-indigo-600 dark:hover:border-indigo-500 dark:hover:text-indigo-400 transition"
      >
        + Start from Scratch
      </button>

      {grouped.map((category) => (
        <div key={category.value}>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
            <span>{category.icon}</span>
            <span>{category.label}</span>
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {category.templates.map((template) => (
              <button
                key={template.name}
                onClick={() => onSelect(template)}
                className="flex items-start gap-2 p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition text-left"
              >
                <span className="text-lg shrink-0 mt-0.5">{template.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {template.name}
                    </p>
                    {template.difficulty && (
                      <span className={`text-[10px] px-1 py-0.5 rounded font-medium shrink-0 ${
                        template.difficulty === 'Easy' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                        template.difficulty === 'Medium' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                        'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                      }`}>
                        {template.difficulty}
                      </span>
                    )}
                  </div>
                  {template.description && (
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{template.description}</p>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {template.type === 'boolean'
                      ? 'Yes / No'
                      : `${template.target} ${template.unit}`}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
