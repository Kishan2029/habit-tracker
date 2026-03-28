import { useState, useEffect, useCallback, useRef } from 'react';
import { getRangeLogs, createLog } from '../../api/logApi';
import { getLocalDateString, parseLocalDate } from '../../utils/dateUtils';
import { getCategoryConfig } from '../../config/categories';
import Card from '../ui/Card';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

function getMonthBounds(year, month) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end, lastDay };
}

const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function MonthlyGridView() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedHabit, setSelectedHabit] = useState('');
  const navigate = useNavigate();
  const today = getLocalDateString();

  const { start, end, lastDay } = getMonthBounds(year, month);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await getRangeLogs(start, end);
      setData(res.data);
      if (!selectedHabit && res.data.habits.length > 0) {
        setSelectedHabit(res.data.habits[0]._id);
      }
    } catch {
      toast.error('Failed to load monthly data');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggle = async (habitId, dateStr, currentValue, habit) => {
    const newValue = habit.type === 'boolean' ? !currentValue : Math.max(0, (currentValue || 0) + 1);
    try {
      await createLog({ habitId, date: dateStr, value: newValue });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    }
  };

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(year - 1); }
    else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(year + 1); }
    else setMonth(month + 1);
  };

  if (loading) return <LoadingSpinner />;

  if (!data || data.habits.length === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <EmptyState
          icon={'\u{1F5D3}'}
          title="No habits to show"
          description="Create some habits first to see the monthly grid."
          actionLabel="Create Habit"
          onAction={() => navigate('/habits')}
        />
      </div>
    );
  }

  const logMap = new Map();
  for (const log of data.logs) {
    const dateKey = log.date.split('T')[0];
    logMap.set(`${log.habitId}-${dateKey}`, log);
  }

  const habit = data.habits.find((h) => h._id === selectedHabit) || data.habits[0];
  const cat = getCategoryConfig(habit.category);

  // Build calendar grid
  const firstDayOfMonth = parseLocalDate(start).getDay(); // 0=Sun
  const offset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; // Monday-based

  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null); // padding
  for (let d = 1; d <= lastDay; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const log = logMap.get(`${habit._id}-${dateStr}`);
    const dayOfWeek = parseLocalDate(dateStr).getDay();
    const isScheduled = habit.frequency.includes(dayOfWeek);
    const value = log?.value;
    const isCompleted = value
      ? typeof value === 'boolean' ? value : value >= habit.target
      : false;
    cells.push({ day: d, dateStr, log, isScheduled, value, isCompleted });
  }

  const completedDays = cells.filter((c) => c?.isCompleted).length;
  const scheduledDays = cells.filter((c) => c?.isScheduled).length;
  const completionRate = scheduledDays > 0 ? Math.round((completedDays / scheduledDays) * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Monthly View</h1>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <span className="text-lg font-semibold text-gray-900 dark:text-white min-w-[160px] text-center">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {data.habits.map((h) => {
          const c = getCategoryConfig(h.category);
          return (
            <button
              key={h._id}
              onClick={() => setSelectedHabit(h._id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
                selectedHabit === h._id
                  ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <span>{h.icon}</span> {h.name}
            </button>
          );
        })}
      </div>

      <div className="flex gap-4">
        <Card className="flex-1 p-4 text-center">
          <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{completionRate}%</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Completion Rate</div>
        </Card>
        <Card className="flex-1 p-4 text-center">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{completedDays}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Days Completed</div>
        </Card>
        <Card className="flex-1 p-4 text-center">
          <div className="text-2xl font-bold" style={{ color: cat.color }}>{cat.icon}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">{cat.label}</div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-7 gap-1">
          {DAY_HEADERS.map((d) => (
            <div key={d} className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 py-1">{d}</div>
          ))}
          {cells.map((cell, i) => {
            if (!cell) return <div key={`empty-${i}`} />;
            const { day, dateStr, isScheduled, value, isCompleted } = cell;
            const isToday = dateStr === today;

            return (
              <button
                key={dateStr}
                onClick={() => isScheduled && handleToggle(habit._id, dateStr, value, habit)}
                disabled={!isScheduled}
                className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs transition relative ${
                  isToday ? 'ring-2 ring-indigo-500' : ''
                } ${
                  !isScheduled
                    ? 'text-gray-300 dark:text-gray-600 cursor-default'
                    : isCompleted
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                      : value
                        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200'
                        : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <span className="font-medium">{day}</span>
                {isScheduled && isCompleted && (
                  <svg className="w-3 h-3 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
