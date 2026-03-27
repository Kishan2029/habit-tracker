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
import { useNavigate } from 'react-router-dom';
import { getLocalDateString } from '../../utils/dateUtils';
import toast from 'react-hot-toast';

export default function TodayView() {
  const today = getLocalDateString();
  const [date, setDate] = useState(today);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
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
      toast.error('Failed to save log');
    }
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
        {data.habits.map(({ habit, log, isCompleted }) => (
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
                  <h3 className={`font-medium truncate ${
                    isCompleted
                      ? 'text-green-600 dark:text-green-400 line-through'
                      : 'text-gray-900 dark:text-white'
                  }`}>
                    {habit.name}
                  </h3>
                  <StreakBadge current={habit.currentStreak} longest={habit.longestStreak} />
                </div>
              </div>

              <div className="shrink-0 ml-3">
                {habit.type === 'boolean' ? (
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
          </Card>
        ))}
      </div>
    </div>
  );
}
