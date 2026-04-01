import { useState, useEffect, useCallback, useRef } from 'react';
import { getRangeLogs, createLog } from '../../api/logApi';
import { getLocalDateString, shiftDate, parseLocalDate } from '../../utils/dateUtils';
import { useAuth } from '../../context/AuthContext';
import { getCategoryConfig } from '../../config/categories';
import SharedBadge from '../ui/SharedBadge';
import Card from '../ui/Card';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

function getWeekStart(dateStr) {
  const d = parseLocalDate(dateStr);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? 6 : day - 1; // shift to Monday
  return shiftDate(dateStr, -diff);
}

function getWeekDays(startStr) {
  return Array.from({ length: 7 }, (_, i) => shiftDate(startStr, i));
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function WeeklyView() {
  const { user } = useAuth();
  const today = getLocalDateString();
  const accountCreated = user?.createdAt ? getLocalDateString(new Date(user.createdAt)) : null;
  const currentWeekStart = getWeekStart(today);
  const minWeekStart = accountCreated ? getWeekStart(accountCreated) : null;
  const [weekStart, setWeekStart] = useState(currentWeekStart);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const fetchIdRef = useRef(0);
  const navigate = useNavigate();

  const weekDays = getWeekDays(weekStart);
  const weekEnd = weekDays[6];

  const fetchData = useCallback(async () => {
    const fetchId = ++fetchIdRef.current;
    setLoading(true);
    try {
      const { data: res } = await getRangeLogs(weekStart, weekEnd);
      if (fetchId !== fetchIdRef.current) return;
      setData(res.data);
    } catch {
      if (fetchId !== fetchIdRef.current) return;
      toast.error('Failed to load weekly data');
    } finally {
      if (fetchId === fetchIdRef.current) setLoading(false);
    }
  }, [weekStart, weekEnd]);

  // Silent refresh — syncs server data without showing loading spinner
  const silentRefresh = useCallback(async () => {
    const fetchId = ++fetchIdRef.current;
    try {
      const { data: res } = await getRangeLogs(weekStart, weekEnd);
      if (fetchId !== fetchIdRef.current) return;
      setData(res.data);
    } catch {
      // Silent — don't show error for background sync
    }
  }, [weekStart, weekEnd]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggle = useCallback(async (habitId, dateStr, currentValue, habit, delta = 1) => {
    // Block viewers from logging shared habits
    if (habit.isShared && habit.myRole === 'viewer') {
      toast.error('Viewers cannot log shared habits');
      return;
    }
    let newValue;
    if (habit.type === 'boolean') {
      newValue = !currentValue;
    } else {
      newValue = Math.max(0, (currentValue || 0) + delta);
      if (newValue === currentValue) return; // no change
    }

    const prevData = data;

    // Optimistic update — reflect change instantly in the logs array
    const existingIndex = data.logs.findIndex(
      (log) => log.habitId === habitId && log.date.split('T')[0] === dateStr
    );
    let newLogs;
    if (existingIndex >= 0) {
      newLogs = data.logs.map((log, i) =>
        i === existingIndex ? { ...log, value: newValue } : log
      );
    } else {
      newLogs = [...data.logs, { habitId, date: dateStr, value: newValue }];
    }
    setData({ ...data, logs: newLogs });

    try {
      await createLog({ habitId, date: dateStr, value: newValue });
      silentRefresh(); // sync from server
    } catch (err) {
      setData(prevData); // rollback on failure
      toast.error(err.response?.data?.message || 'Failed to save');
    }
  }, [data, silentRefresh]);

  const canGoPrev = !minWeekStart || shiftDate(weekStart, -7) >= minWeekStart;
  const canGoNext = weekStart < currentWeekStart;
  const goToPrevWeek = () => canGoPrev && setWeekStart(shiftDate(weekStart, -7));
  const goToNextWeek = () => canGoNext && setWeekStart(shiftDate(weekStart, 7));
  const goToThisWeek = () => setWeekStart(currentWeekStart);

  if (loading) return <LoadingSpinner />;

  if (!data || data.habits.length === 0) {
    return (
      <div className="max-w-5xl mx-auto">
        <EmptyState
          icon={'\u{1F4C5}'}
          title="No habits to show"
          description="Create some habits first to see the weekly view."
          actionLabel="Create Habit"
          onAction={() => navigate('/habits')}
        />
      </div>
    );
  }

  const logMap = new Map();
  for (const log of data.logs) {
    const dateKey = log.date.split('T')[0];
    const key = `${log.habitId}-${dateKey}`;
    logMap.set(key, log);
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Weekly View</h1>
        <div className="flex items-center gap-2">
          {(() => {
            const enabledNav = 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300';
            const disabledNav = 'text-gray-300 dark:text-gray-600 cursor-not-allowed';
            return (
              <>
                <button onClick={goToPrevWeek} disabled={!canGoPrev} className={`p-2 rounded-lg transition ${canGoPrev ? enabledNav : disabledNav}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <button onClick={goToThisWeek} className="px-3 py-1 rounded-lg text-sm font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition">
                  This Week
                </button>
                <button onClick={goToNextWeek} disabled={!canGoNext} className={`p-2 rounded-lg transition ${canGoNext ? enabledNav : disabledNav}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              </>
            );
          })()}
        </div>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400 min-w-[160px]">Habit</th>
              {weekDays.map((d, i) => (
                <th key={d} className={`py-3 px-2 text-center font-medium min-w-[60px] ${d === today ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  <div>{DAY_LABELS[i]}</div>
                  <div className="text-xs">{d.split('-')[2]}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.habits.map((habit) => {
              const cat = getCategoryConfig(habit.category);
              return (
                <tr key={habit._id} className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 ${habit.isShared ? (habit.myRole === 'owner' ? 'bg-indigo-50/30 dark:bg-indigo-900/5' : 'bg-purple-50/30 dark:bg-purple-900/5') : ''}`}>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{habit.icon}</span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-gray-900 dark:text-white text-sm">{habit.name}</span>
                          {habit.isShared && <SharedBadge sharedBy={habit.sharedBy} />}
                        </div>
                        <span className="text-xs" style={{ color: cat.color }}>{cat.icon} {cat.label}</span>
                      </div>
                    </div>
                  </td>
                  {weekDays.map((d) => {
                    const dayOfWeek = parseLocalDate(d).getDay();
                    const isScheduled = habit.frequency.includes(dayOfWeek);
                    const isFuture = d > today;
                    const log = logMap.get(`${habit._id}-${d}`);
                    const value = log?.value;
                    const isCompleted = value
                      ? typeof value === 'boolean' ? value : value >= habit.target
                      : false;

                    if (!isScheduled) {
                      return (
                        <td key={d} className="py-3 px-2 text-center">
                          <span className="text-gray-300 dark:text-gray-600">-</span>
                        </td>
                      );
                    }

                    if (isFuture) {
                      return (
                        <td key={d} className="py-3 px-2 text-center">
                          <div className="w-8 h-8 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center mx-auto opacity-40" title="Future date">
                            {habit.type === 'boolean' ? (
                              <div className="w-3 h-3 rounded border border-gray-300 dark:border-gray-600" />
                            ) : (
                              <span className="text-xs text-gray-400 dark:text-gray-600">-</span>
                            )}
                          </div>
                        </td>
                      );
                    }

                    return (
                      <td key={d} className="py-3 px-2 text-center">
                        {habit.type === 'boolean' ? (
                          <button
                            onClick={() => handleToggle(habit._id, d, value, habit)}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition mx-auto ${
                              isCompleted
                                ? 'scale-105'
                                : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                            style={isCompleted ? { backgroundColor: habit.color } : {}}
                          >
                            {isCompleted ? (
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <div className="w-4 h-4 rounded border-2 border-gray-300 dark:border-gray-500" />
                            )}
                          </button>
                        ) : (
                          <div className="flex items-center justify-center gap-0.5">
                            <button
                              onClick={() => handleToggle(habit._id, d, value, habit, -1)}
                              disabled={!value}
                              className="w-6 h-6 rounded-lg flex items-center justify-center bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400 text-xs disabled:opacity-30 disabled:cursor-not-allowed transition"
                              title="Decrease"
                            >
                              -
                            </button>
                            <span
                              className={`min-w-[24px] text-xs font-bold text-center ${
                                isCompleted
                                  ? 'text-green-600 dark:text-green-400'
                                  : value
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-gray-500 dark:text-gray-400'
                              }`}
                              title={`${value || 0}/${habit.target} ${habit.unit || ''}`}
                            >
                              {value || 0}
                            </span>
                            <button
                              onClick={() => handleToggle(habit._id, d, value, habit, 1)}
                              className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs transition hover:opacity-80"
                              style={{ backgroundColor: habit.color }}
                              title="Increase"
                            >
                              +
                            </button>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
