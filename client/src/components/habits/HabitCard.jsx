import Card from '../ui/Card';
import SharedBadge from '../ui/SharedBadge';
import { getCategoryConfig } from '../../config/categories';

export default function HabitCard({ habit, onEdit, onArchive, onDelete, onShare }) {
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const category = getCategoryConfig(habit.category);

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
            style={{ backgroundColor: `${habit.color}20` }}
          >
            {habit.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 dark:text-white">{habit.name}</h3>
              {habit.isShared && (
                <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium">
                  👥 {habit.memberCount > 0 ? `${habit.memberCount} member${habit.memberCount !== 1 ? 's' : ''}` : 'Shared'}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {habit.type === 'count'
                ? `${habit.target} ${habit.unit || 'units'} / day`
                : 'Yes / No'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            disabled={habit.isArchived}
            onClick={() => onShare(habit)}
            className={`p-1.5 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-400 ${
              habit.isShared
                ? 'text-indigo-500 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
                : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-indigo-600 dark:hover:text-indigo-400'
            }`}
            title={habit.isArchived ? 'Unarchive before sharing' : habit.isShared ? 'Manage sharing' : 'Share'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          </button>
          <button
            onClick={() => onEdit(habit)}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
            title="Edit"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => onArchive(habit)}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-yellow-600 dark:hover:text-yellow-400 transition"
            title={habit.isArchived ? 'Unarchive' : 'Archive'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(habit)}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition"
            title="Delete"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-4">
        <div className="flex items-center gap-1 text-sm">
          <span className="text-orange-500">&#x1F525;</span>
          <span className="text-gray-600 dark:text-gray-400">{habit.currentStreak} day streak</span>
        </div>
        <div className="text-xs text-gray-400 dark:text-gray-500">
          Best: {habit.longestStreak} days
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1">
        <span
          className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{ backgroundColor: `${category.color}20`, color: category.color }}
        >
          {category.icon} {category.label}
        </span>
        {habit.frequency.map((day) => (
          <span
            key={day}
            className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
          >
            {dayLabels[day]}
          </span>
        ))}
      </div>

      {habit.isArchived && (
        <span className="mt-2 inline-block text-xs px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
          Archived
        </span>
      )}
    </Card>
  );
}
