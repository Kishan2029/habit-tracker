import { useState, useEffect, useCallback, useRef } from 'react';
import { getDailyLogs, createLog } from '../../api/logApi';
import DateNavigator from './DateNavigator';
import DailyProgressBar from './DailyProgressBar';
import BooleanToggle from './BooleanToggle';
import CountStepper from './CountStepper';
import StreakBadge from './StreakBadge';
import Card from '../ui/Card';
import EmptyState from '../ui/EmptyState';
import LoadingSpinner from '../ui/LoadingSpinner';
import { triggerConfetti, triggerMiniConfetti } from '../ui/ConfettiEffect';
import SharedBadge from '../ui/SharedBadge';
import MemberProgressList from '../shared/MemberProgressList';
import ShareHabitModal from '../habits/ShareHabitModal';
import { useNavigate } from 'react-router-dom';
import { getLocalDateString } from '../../utils/dateUtils';
import toast from 'react-hot-toast';

export default function TodayView() {
  const today = getLocalDateString();
  const [date, setDate] = useState(today);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedHabit, setExpandedHabit] = useState(null);
  const [sharedInfoHabit, setSharedInfoHabit] = useState(null); // { habit, myRole }
  const prevCompleted = useRef(0);
  const fetchIdRef = useRef(0); // tracks latest fetch to prevent race conditions
  const userLoggedRef = useRef(false); // true only after user actively logs a habit
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const fetchId = ++fetchIdRef.current;
    try {
      const { data: res } = await getDailyLogs(date);
      // Only update state if this is still the latest request (prevents race condition)
      if (fetchId !== fetchIdRef.current) return;
      setData(res.data);
    } catch (err) {
      if (fetchId !== fetchIdRef.current) return;
      toast.error('Failed to load today\'s habits');
    } finally {
      if (fetchId === fetchIdRef.current) {
        setLoading(false);
      }
    }
  }, [date]);

  // Reset confetti tracking when date changes (navigation)
  useEffect(() => {
    userLoggedRef.current = false;
    setExpandedHabit(null);
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!data) return;
    const prev = prevCompleted.current;
    const { completed, total } = data;
    // Only trigger confetti if user actively logged a habit (not on date navigation)
    if (userLoggedRef.current && prev < total && completed === total && total > 0) {
      triggerConfetti();
    }
    prevCompleted.current = completed;
  }, [data]);

  const handleLog = async (habitId, value, event) => {
    try {
      await createLog({ habitId, date, value });
      userLoggedRef.current = true; // mark that this data refresh is from a user action
      if (event && value === true) {
        triggerMiniConfetti(event.clientX, event.clientY);
      }
      fetchData();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to save log';
      console.error('Log error:', err.response?.data || err.message);
      toast.error(msg);
    }
  };

  const toggleExpand = (habitId) => {
    setExpandedHabit(expandedHabit === habitId ? null : habitId);
  };

  if (loading) return <LoadingSpinner />;

  if (!data || data.habits.length === 0) {
    return (
      <div className="max-w-2xl mx-auto">
        <DateNavigator date={date} onChange={setDate} />
        <EmptyState
          icon="📅"
          title="No habits scheduled"
          description="You don't have any habits scheduled for this day. Create some habits to get started!"
          actionLabel="Create Habit"
          onAction={() => navigate('/habits')}
        />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <DateNavigator date={date} onChange={setDate} />
      <DailyProgressBar completed={data.completed} total={data.total} />

      <div className="space-y-3">
        {data.habits.map(({ habit, log, isCompleted, isShared, sharedBy, myRole }) => (
          <Card key={habit._id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0"
                  style={{ backgroundColor: `${habit.color}20` }}
                >
                  {habit.icon}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className={`font-medium truncate ${
                      isCompleted
                        ? 'text-green-600 dark:text-green-400 line-through'
                        : 'text-gray-900 dark:text-white'
                    }`}>
                      {habit.name}
                    </h3>
                    {isShared && <SharedBadge sharedBy={sharedBy} />}
                  </div>
                  <div className="flex items-center gap-2">
                    <StreakBadge current={habit.currentStreak} longest={habit.longestStreak} />
                    {isShared && (
                      <>
                        <button
                          onClick={() => toggleExpand(habit._id)}
                          className="text-xs text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center gap-0.5"
                        >
                          <span>👥</span>
                          {expandedHabit !== habit._id && (
                            <MemberProgressList habitId={habit._id} date={date} compact />
                          )}
                          <svg
                            className={`w-3 h-3 transition-transform ${expandedHabit === habit._id ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setSharedInfoHabit({ habit, myRole })}
                          className="text-xs text-gray-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition"
                          title="View members & progress"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="shrink-0 ml-3">
                {isShared && myRole === 'viewer' ? (
                  <span className="text-xs text-gray-400 dark:text-gray-500 italic">View only</span>
                ) : habit.type === 'boolean' ? (
                  <BooleanToggle
                    isCompleted={isCompleted}
                    color={habit.color}
                    onChange={(e) => handleLog(habit._id, !isCompleted, e.nativeEvent)}
                  />
                ) : (
                  <CountStepper
                    value={log?.value ?? 0}
                    target={habit.target}
                    unit={habit.unit}
                    color={habit.color}
                    onChange={(val) => handleLog(habit._id, val)}
                  />
                )}
              </div>
            </div>

            {/* Expandable member progress */}
            {isShared && expandedHabit === habit._id && (
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                <MemberProgressList habitId={habit._id} date={date} />
              </div>
            )}
          </Card>
        ))}
      </div>

      {sharedInfoHabit && (
        <ShareHabitModal
          habit={sharedInfoHabit.habit}
          isOwner={sharedInfoHabit.myRole === 'owner'}
          onClose={() => setSharedInfoHabit(null)}
        />
      )}
    </div>
  );
}
