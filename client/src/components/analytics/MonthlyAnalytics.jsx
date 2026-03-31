import { useState, useEffect, useRef } from 'react';
import { getMonthlyLogs } from '../../api/logApi';
import CalendarHeatmap from './CalendarHeatmap';
import HabitSelector from './HabitSelector';
import Card from '../ui/Card';
import EmptyState from '../ui/EmptyState';
import LoadingSpinner from '../ui/LoadingSpinner';
import Button from '../ui/Button';
import { wasHabitCreatedOnOrBefore } from '../../utils/habitDateUtils';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function MonthlyAnalytics() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedHabit, setSelectedHabit] = useState('');
  const fetchIdRef = useRef(0);

  useEffect(() => {
    const fetchId = ++fetchIdRef.current;
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: res } = await getMonthlyLogs(month, year);
        if (fetchId !== fetchIdRef.current) return;
        setData(res.data);
        setSelectedHabit('');
      } catch {
        if (fetchId !== fetchIdRef.current) return;
        setData(null);
      } finally {
        if (fetchId === fetchIdRef.current) setLoading(false);
      }
    };
    fetchData();
  }, [month, year]);

  const shiftMonth = (delta) => {
    let newMonth = month + delta;
    let newYear = year;
    if (newMonth > 12) { newMonth = 1; newYear++; }
    else if (newMonth < 1) { newMonth = 12; newYear--; }
    setMonth(newMonth);
    setYear(newYear);
  };

  if (loading) return <LoadingSpinner />;

  if (!data || data.habits.length === 0) {
    return (
      <EmptyState
        icon="📊"
        title="No habits tracked"
        description="Create some habits to see monthly analytics."
      />
    );
  }

  // Build a log lookup map: "habitId-YYYY-MM-DD" -> log (O(n) instead of O(n²))
  const logLookup = new Map();
  for (const l of data.logs) {
    const logDate = typeof l.date === 'string' ? l.date.slice(0, 10) : l.date.toISOString().slice(0, 10);
    logLookup.set(`${l.habitId}-${logDate}`, l);
  }

  // Compute per-habit stats with proportional completion for count habits
  const daysInMonth = new Date(year, month, 0).getDate();
  const habitStats = data.habits.map((habit) => {
    let scheduled = 0;
    let completionSum = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (!wasHabitCreatedOnOrBefore(habit.createdAt, dateStr)) continue;
      const dow = new Date(year, month - 1, d).getDay();
      if (!habit.frequency.includes(dow)) continue;
      scheduled++;
      const log = logLookup.get(`${habit._id}-${dateStr}`);
      if (log) {
        if (typeof log.value === 'boolean') {
          completionSum += log.value ? 1 : 0;
        } else {
          completionSum += Math.min(1, log.value / (habit.target || 1));
        }
      }
    }
    const rate = scheduled > 0 ? Math.round((completionSum / scheduled) * 100) : 0;
    return { habit, scheduled, completed: Math.round(completionSum * 10) / 10, rate };
  });

  const totalScheduled = habitStats.reduce((s, h) => s + h.scheduled, 0);
  const totalCompleted = Math.round(habitStats.reduce((s, h) => s + h.completed, 0) * 10) / 10;
  const completionRate = totalScheduled > 0 ? Math.round((totalCompleted / totalScheduled) * 100) : 0;
  const bestHabit = habitStats.length > 0 ? habitStats.reduce((a, b) => a.rate > b.rate ? a : b) : null;

  return (
    <div className="space-y-5">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => shiftMonth(-1)}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Button>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {MONTH_NAMES[month - 1]} {year}
        </h3>
        <Button variant="ghost" size="sm" onClick={() => shiftMonth(1)}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Button>
      </div>

      <HabitSelector habits={data.habits} value={selectedHabit} onChange={setSelectedHabit} />

      {/* Heatmap */}
      <Card className="p-4">
        <CalendarHeatmap
          year={year}
          month={month}
          logs={data.logs}
          habits={data.habits}
          selectedHabitId={selectedHabit}
        />
      </Card>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4 text-center">
          <p className={`text-2xl font-bold ${completionRate >= 75 ? 'text-green-600 dark:text-green-400' : completionRate >= 25 ? 'text-amber-600 dark:text-amber-400' : 'text-red-500 dark:text-red-400'}`}>{completionRate}%</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Completion Rate</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{totalCompleted}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Days Completed</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {bestHabit ? `${bestHabit.rate}%` : '-'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Best Habit Rate</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.habits.length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Active Habits</p>
        </Card>
      </div>

      {/* Per-habit completion bars */}
      <Card className="p-4">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Habit Breakdown</h4>
        <div className="space-y-3">
          {[...habitStats].sort((a, b) => b.rate - a.rate).map(({ habit, completed, scheduled, rate }) => (
            <div key={habit._id}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm">{habit.icon}</span>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{habit.name}</span>
                </div>
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 shrink-0">
                  {completed}/{scheduled} ({rate}%)
                </span>
              </div>
              <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${rate}%`, backgroundColor: habit.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
