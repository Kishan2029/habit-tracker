import { useState, useEffect } from 'react';
import { getSharedWithMe, getPendingInvites, leaveHabit, respondToInvite } from '../../api/sharedHabitApi';
import Card from '../ui/Card';
import EmptyState from '../ui/EmptyState';
import LoadingSpinner from '../ui/LoadingSpinner';
import toast from 'react-hot-toast';

export default function SharedHabitsPage() {
  const [sharedHabits, setSharedHabits] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sharedRes, pendingRes] = await Promise.all([
        getSharedWithMe(),
        getPendingInvites(),
      ]);
      setSharedHabits(sharedRes.data.data.sharedHabits || []);
      setPendingInvites(pendingRes.data.data.invites || []);
    } catch {
      toast.error('Failed to load shared habits');
    } finally {
      setLoading(false);
    }
  };

  const handleLeave = async (habitId, habitName) => {
    if (!confirm(`Leave "${habitName}"? You'll lose access to this habit.`)) return;
    try {
      await leaveHabit(habitId);
      toast.success('Left shared habit');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to leave');
    }
  };

  const handleRespond = async (habitId, accept) => {
    try {
      await respondToInvite(habitId, accept);
      toast.success(accept ? 'Invite accepted!' : 'Invite declined');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to respond');
    }
  };

  if (loading) return <LoadingSpinner />;

  const isEmpty = sharedHabits.length === 0 && pendingInvites.length === 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Shared Habits</h1>

      {/* Pending Invites */}
      {pendingInvites.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Pending Invites ({pendingInvites.length})
          </h2>
          <div className="space-y-3">
            {pendingInvites.map((invite) => (
              <Card key={invite.habitId?._id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                      style={{ backgroundColor: `${invite.habitId?.color || '#6366f1'}20` }}
                    >
                      {invite.habitId?.icon || '🎯'}
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {invite.habitId?.name || 'Unknown Habit'}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        From {invite.ownerId?.name || 'Unknown'} &middot; as {invite.role}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRespond(invite.habitId?._id, true)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleRespond(invite.habitId?._id, false)}
                      className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Shared With Me */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          Shared With Me ({sharedHabits.length})
        </h2>
        {sharedHabits.length === 0 && pendingInvites.length === 0 ? (
          <EmptyState
            icon="👥"
            title="No shared habits yet"
            description="When someone shares a habit with you, it will appear here. You can also join via an invite link."
          />
        ) : sharedHabits.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No active shared habits.</p>
        ) : (
          <div className="space-y-3">
            {sharedHabits.map((sh) => {
              const habit = sh.habitId;
              const owner = sh.ownerId;
              const myMembership = sh.sharedWith?.find(
                (m) => m.status === 'accepted'
              );
              return (
                <Card key={sh._id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                        style={{ backgroundColor: `${habit?.color || '#6366f1'}20` }}
                      >
                        {habit?.icon || '🎯'}
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">
                          {habit?.name || 'Unknown Habit'}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                          <span>by {owner?.name || 'Unknown'}</span>
                          <span>&middot;</span>
                          <span className="capitalize">{myMembership?.role || 'member'}</span>
                          <span>&middot;</span>
                          <span>{sh.sharedWith?.filter((m) => m.status === 'accepted').length} members</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleLeave(habit?._id, habit?.name)}
                      className="px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                    >
                      Leave
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
