import { useState, useEffect } from 'react';
import { getYearlyLogs } from '../../api/logApi';
import CompletionChart from './CompletionChart';
import YearlyHeatmap from './YearlyHeatmap';
import HabitSelector from './HabitSelector';
import Card from '../ui/Card';
import EmptyState from '../ui/EmptyState';
import LoadingSpinner from '../ui/LoadingSpinner';
import Button from '../ui/Button';

export default function YearlyAnalytics() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedHabit, setSelectedHabit] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: res } = await getYearlyLogs(year);
        setData(res.data);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [year]);

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

  // Compute stats
  const habitStats = data.habits.map((habit) => {
    const habitLogs = data.logs.filter((l) => l.habitId === habit._id);
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

  const topHabits = [...habitStats].sort((a, b) => b.rate - a.rate).slice(0, 5);

  const totalLogs = data.logs.length;
  const completedLogs = data.logs.filter((l) => {
    const habit = data.habits.find((h) => h._id === l.habitId);
    if (!habit) return false;
    return typeof l.value === 'boolean' ? l.value : l.value >= habit.target;
  }).length;
  const overallRate = totalLogs > 0 ? Math.round((completedLogs / totalLogs) * 100) : 0;

  // Best streak across all habits
  const bestStreak = data.habits.reduce((max, h) => Math.max(max, h.longestStreak || 0), 0);
  const bestStreakHabit = data.habits.find((h) => (h.longestStreak || 0) === bestStreak);

  return (
    <div className="space-y-5">
      {/* Year navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setYear(year - 1)}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Button>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{year}</h3>
        <Button variant="ghost" size="sm" onClick={() => setYear(year + 1)}>
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
