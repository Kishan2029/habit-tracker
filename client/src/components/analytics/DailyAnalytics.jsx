import { useState, useEffect, useRef } from 'react';
import { getDailyLogs } from '../../api/logApi';
import { getLocalDateString } from '../../utils/dateUtils';
import DateNavigator from '../dashboard/DateNavigator';
import Card from '../ui/Card';
import EmptyState from '../ui/EmptyState';
import LoadingSpinner from '../ui/LoadingSpinner';

function CompletionRing({ percentage }) {
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const color = percentage >= 75 ? '#22c55e' : percentage >= 25 ? '#f59e0b' : percentage > 0 ? '#ef4444' : '#e5e7eb';

  return (
    <div className="relative w-40 h-40 flex items-center justify-center">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="10" className="dark:stroke-gray-700" />
        <circle
          cx="70" cy="70" r={radius} fill="none"
          stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-gray-900 dark:text-white">{percentage}%</span>
      </div>
    </div>
  );
}

export default function DailyAnalytics() {
  const today = getLocalDateString();
  const [date, setDate] = useState(today);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const fetchIdRef = useRef(0);

  useEffect(() => {
    const fetchId = ++fetchIdRef.current;
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: res } = await getDailyLogs(date);
        if (fetchId !== fetchIdRef.current) return;
        setData(res.data);
      } catch {
        if (fetchId !== fetchIdRef.current) return;
        setData(null);
      } finally {
        if (fetchId === fetchIdRef.current) setLoading(false);
      }
    };
    fetchData();
  }, [date]);

  if (loading) return <LoadingSpinner />;

  if (!data || !data.habits || data.habits.length === 0) {
    return (
      <div className="space-y-4">
        <DateNavigator date={date} onChange={setDate} />
        <EmptyState
          icon="📊"
          title="No data for this day"
          description="No habits were scheduled for this day."
        />
      </div>
    );
  }

  const { total } = data;
  // Proportional completion: count habits give partial credit (e.g. 8/10 = 0.8)
  let proportionalCompleted = 0;
  for (const entry of data.habits) {
    const log = entry.log;
    if (!log) continue;
    if (typeof log.value === 'boolean') {
      proportionalCompleted += log.value ? 1 : 0;
    } else {
      const target = entry.habit?.target || 1;
      proportionalCompleted += Math.min(1, (log.value || 0) / target);
    }
  }
  const percentage = total > 0 ? Math.round((proportionalCompleted / total) * 100) : 0;

  return (
    <div className="space-y-5">
      <DateNavigator date={date} onChange={setDate} />

      {/* Completion Ring */}
      <Card className="p-6">
        <div className="flex flex-col items-center">
          <CompletionRing percentage={percentage} />
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {total} habit{total !== 1 ? 's' : ''} scheduled
          </p>
        </div>
      </Card>

      {/* Per-habit progress */}
      <div className="space-y-2">
        {data.habits.map((entry) => {
          const { habit, log, isCompleted } = entry;
          if (!habit) return null;
          const value = log?.value ?? 0;
          const target = habit.target || 1;
          const progress = habit.type === 'boolean'
            ? (isCompleted ? 100 : 0)
            : Math.min(100, Math.round(((typeof value === 'number' ? value : 0) / target) * 100));

          return (
            <Card key={habit._id} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-lg shrink-0">{habit.icon}</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{habit.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {habit.type === 'count' && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {typeof value === 'number' ? value : 0}/{target} {habit.unit || ''}
                    </span>
                  )}
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    isCompleted
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : progress > 0
                        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                  }`}>
                    {isCompleted ? '\u2713 Done' : progress > 0 ? `${progress}%` : '\u2717 Missed'}
                  </span>
                </div>
              </div>
              <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${progress}%`,
                    backgroundColor: isCompleted ? '#22c55e' : progress > 0 ? '#f59e0b' : 'transparent',
                  }}
                />
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
