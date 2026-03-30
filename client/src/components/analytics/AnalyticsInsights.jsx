import Card from '../ui/Card';
import { parseLocalDate } from '../../utils/dateUtils';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function AnalyticsInsights({ habits, logs }) {
  if (!habits || habits.length === 0 || !logs || logs.length === 0) return null;

  // Build completion lookup
  const completedLogs = logs.filter((l) => {
    const habit = habits.find((h) => h._id === l.habitId);
    if (!habit) return false;
    return typeof l.value === 'boolean' ? l.value : l.value >= habit.target;
  });

  // Best day of week
  const dayStats = Array(7).fill(null).map(() => ({ completed: 0, scheduled: 0 }));
  const uniqueDates = [...new Set(logs.map((l) => {
    return typeof l.date === 'string' ? l.date.slice(0, 10) : l.date.toISOString().slice(0, 10);
  }))];

  for (const dateStr of uniqueDates) {
    const d = parseLocalDate(dateStr);
    const dow = d.getDay();
    for (const habit of habits) {
      if (!habit.frequency.includes(dow)) continue;
      dayStats[dow].scheduled++;
      const log = logs.find((l) => {
        const logDate = typeof l.date === 'string' ? l.date.slice(0, 10) : l.date.toISOString().slice(0, 10);
        return logDate === dateStr && l.habitId === habit._id;
      });
      if (log) {
        const done = typeof log.value === 'boolean' ? log.value : log.value >= habit.target;
        if (done) dayStats[dow].completed++;
      }
    }
  }

  let bestDay = { name: '-', rate: 0 };
  for (let i = 0; i < 7; i++) {
    const rate = dayStats[i].scheduled > 0 ? Math.round((dayStats[i].completed / dayStats[i].scheduled) * 100) : 0;
    if (rate > bestDay.rate) bestDay = { name: DAY_NAMES[i], rate };
  }

  // Best streak habit
  const bestStreakHabit = habits.reduce((best, h) =>
    (h.longestStreak || 0) > (best?.longestStreak || 0) ? h : best
  , habits[0]);

  // Current active streaks
  const activeStreaks = habits
    .filter((h) => (h.currentStreak || 0) > 0)
    .sort((a, b) => b.currentStreak - a.currentStreak);

  const insights = [
    {
      icon: '📅',
      label: 'Most consistent day',
      value: `${bestDay.name} (${bestDay.rate}%)`,
      color: 'text-indigo-600 dark:text-indigo-400',
    },
    {
      icon: '🔥',
      label: 'Longest streak ever',
      value: bestStreakHabit ? `${bestStreakHabit.icon} ${bestStreakHabit.name} — ${bestStreakHabit.longestStreak || 0} days` : '-',
      color: 'text-amber-600 dark:text-amber-400',
    },
    {
      icon: '✅',
      label: 'Total completions',
      value: `${completedLogs.length} out of ${logs.length} logs`,
      color: 'text-green-600 dark:text-green-400',
    },
  ];

  return (
    <Card className="p-4">
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Insights</h4>
      <div className="space-y-3">
        {insights.map((insight) => (
          <div key={insight.label} className="flex items-start gap-3">
            <span className="text-lg shrink-0">{insight.icon}</span>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{insight.label}</p>
              <p className={`text-sm font-semibold ${insight.color}`}>{insight.value}</p>
            </div>
          </div>
        ))}

        {activeStreaks.length > 0 && (
          <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Active streaks</p>
            <div className="flex flex-wrap gap-2">
              {activeStreaks.slice(0, 5).map((h) => (
                <span
                  key={h._id}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
                >
                  {h.icon} {h.currentStreak}d
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
