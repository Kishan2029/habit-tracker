import { useState, useEffect, useRef, useMemo } from 'react';
import { getYearlyLogs } from '../../api/logApi';
import { useAuth } from '../../context/AuthContext';
import CompletionChart from './CompletionChart';
import YearlyHeatmap from './YearlyHeatmap';
import HabitSelector from './HabitSelector';
import Card from '../ui/Card';
import EmptyState from '../ui/EmptyState';
import LoadingSpinner from '../ui/LoadingSpinner';
import Button from '../ui/Button';

const EMPTY_STATS = { habitStats: [], topHabits: [], totalLogs: 0, completedLogs: 0, overallRate: 0, bestStreak: 0, bestStreakHabit: null };

export default function YearlyAnalytics() {
  const { user } = useAuth();
  const currentYear = new Date().getFullYear();
  const minYear = user?.createdAt ? new Date(user.createdAt).getFullYear() : null;
  const [year, setYear] = useState(currentYear);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedHabit, setSelectedHabit] = useState('');
  const fetchIdRef = useRef(0);

  useEffect(() => {
    const fetchId = ++fetchIdRef.current;
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: res } = await getYearlyLogs(year);
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
  }, [year]);

  // Compute stats (memoized to avoid recalculating on every render)
  // Must be called before early returns to maintain consistent hook ordering
  const { habitStats, topHabits, totalLogs, completedLogs, overallRate, bestStreak, bestStreakHabit } = useMemo(() => {
    if (!data || data.habits.length === 0) {
      return EMPTY_STATS;
    }

    // Build a Map for O(1) habit lookups
    const habitMap = new Map(data.habits.map((h) => [h._id, h]));

    // Group logs by habitId
    const logsByHabit = new Map();
    for (const l of data.logs) {
      if (!logsByHabit.has(l.habitId)) logsByHabit.set(l.habitId, []);
      logsByHabit.get(l.habitId).push(l);
    }

    const stats = data.habits.map((habit) => {
      const habitLogs = logsByHabit.get(habit._id) || [];
      const completed = habitLogs.filter((l) =>
        typeof l.value === 'boolean' ? l.value : l.value >= habit.target
      ).length;
      return {
        ...habit,
        completed,
        total: habitLogs.length,
        rate: habitLogs.length > 0 ? Math.round((completed / habitLogs.length) * 100) : 0,
      };
    });

    const top = [...stats].sort((a, b) => b.rate - a.rate).slice(0, 5);

    const total = data.logs.length;
    const done = data.logs.filter((l) => {
      const habit = habitMap.get(l.habitId);
      if (!habit) return false;
      return typeof l.value === 'boolean' ? l.value : l.value >= habit.target;
    }).length;
    const rate = total > 0 ? Math.round((done / total) * 100) : 0;

    const best = data.habits.reduce((max, h) => Math.max(max, h.longestStreak || 0), 0);
    const bestHabit = data.habits.find((h) => (h.longestStreak || 0) === best);

    return { habitStats: stats, topHabits: top, totalLogs: total, completedLogs: done, overallRate: rate, bestStreak: best, bestStreakHabit: bestHabit };
  }, [data]);

  if (loading) return <LoadingSpinner />;

  if (!data || data.habits.length === 0) {
    return (
      <EmptyState
        icon="📊"
        title="No yearly data"
        description="Create some habits and start tracking to see yearly analytics."
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Year navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setYear(year - 1)} disabled={minYear != null && year <= minYear}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Button>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{year}</h3>
        <Button variant="ghost" size="sm" onClick={() => setYear(year + 1)} disabled={year >= currentYear}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Button>
      </div>

      {/* LeetCode-style yearly heatmap */}
      <Card className="p-4 overflow-x-auto">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Activity Heatmap</h4>
        <HabitSelector habits={data.habits} value={selectedHabit} onChange={setSelectedHabit} />
        <div className="mt-3">
          <YearlyHeatmap
            year={year}
            logs={data.logs}
            habits={data.habits}
            selectedHabitId={selectedHabit}
          />
        </div>
      </Card>

      {/* Stat cards — responsive */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4 text-center">
          <p className={`text-2xl font-bold ${overallRate >= 75 ? 'text-green-600 dark:text-green-400' : overallRate >= 25 ? 'text-amber-600 dark:text-amber-400' : 'text-red-500 dark:text-red-400'}`}>{overallRate}%</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Overall Rate</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{completedLogs}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Completed</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.habits.length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Habits</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{bestStreak}d</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Best Streak</p>
        </Card>
      </div>

      {/* Monthly bar chart */}
      <Card className="p-4">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Monthly Completion Rate</h4>
        <CompletionChart monthlyStats={data.monthlyStats} />
      </Card>

      {/* Top habits with bars */}
      {topHabits.length > 0 && (
        <Card className="p-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Top Performing Habits</h4>
          <div className="space-y-3">
            {topHabits.map((habit, i) => (
              <div key={habit._id}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-bold text-gray-400 dark:text-gray-500 w-5">{i + 1}.</span>
                    <span className="text-sm">{habit.icon}</span>
                    <span className="text-xs font-medium text-gray-900 dark:text-white truncate">{habit.name}</span>
                  </div>
                  <span className="text-xs font-bold shrink-0" style={{ color: habit.color }}>
                    {habit.rate}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden ml-7">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${habit.rate}%`, backgroundColor: habit.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
