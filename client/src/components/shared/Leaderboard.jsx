import { useState, useEffect } from 'react';
import { getLeaderboard } from '../../api/logApi';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function Leaderboard({ habitId }) {
  const [range, setRange] = useState('week');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getLeaderboard(habitId, range)
      .then(({ data: res }) => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [habitId, range]);

  return (
    <div className="space-y-3">
      {/* Range Toggle */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
        {['week', 'month'].map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`flex-1 py-1 text-xs font-medium rounded-md transition ${
              range === r
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {r === 'week' ? 'This Week' : 'This Month'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-6 text-center text-sm text-gray-400">Loading...</div>
      ) : !data?.entries?.length ? (
        <div className="py-6 text-center text-sm text-gray-400">No data yet</div>
      ) : (
        <div className="space-y-2">
          {data.entries.map((entry) => (
            <div
              key={entry.userId}
              className={`flex items-center gap-3 p-2.5 rounded-lg ${
                entry.rank <= 3
                  ? 'bg-indigo-50 dark:bg-indigo-900/10'
                  : 'bg-gray-50 dark:bg-gray-700/50'
              }`}
            >
              {/* Rank */}
              <span className="text-lg w-7 text-center shrink-0">
                {entry.rank <= 3 ? MEDALS[entry.rank - 1] : (
                  <span className="text-sm text-gray-400">#{entry.rank}</span>
                )}
              </span>

              {/* Avatar */}
              <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-sm font-medium text-indigo-600 dark:text-indigo-400 shrink-0">
                {(entry.name || '?')[0].toUpperCase()}
              </div>

              {/* Name & Role */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {entry.name}
                  </p>
                  {entry.role === 'owner' && (
                    <span className="text-xs px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                      Owner
                    </span>
                  )}
                </div>
                {/* Progress bar */}
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                      style={{ width: `${entry.completionRate}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0 w-8 text-right">
                    {entry.completionRate}%
                  </span>
                </div>
              </div>

              {/* Streak */}
              {entry.currentStreak > 0 && (
                <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0 flex items-center gap-0.5">
                  🔥 {entry.currentStreak}
                </span>
              )}
            </div>
          ))}

          <p className="text-xs text-gray-400 dark:text-gray-500 text-center pt-1">
            {data.entries[0]?.scheduledDays || 0} scheduled days in this {range}
          </p>
        </div>
      )}
    </div>
  );
}
