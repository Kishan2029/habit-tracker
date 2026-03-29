import { useState, useEffect } from 'react';
import { getSharedWithMe, getSharedByMe, getPendingInvites, leaveHabit, respondToInvite } from '../../api/sharedHabitApi';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Card from '../ui/Card';
import EmptyState from '../ui/EmptyState';
import LoadingSpinner from '../ui/LoadingSpinner';
import ShareHabitModal from '../habits/ShareHabitModal';
import toast from 'react-hot-toast';

export default function SharedHabitsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sharedWithMe, setSharedWithMe] = useState([]);
  const [sharedByMe, setSharedByMe] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalHabit, setModalHabit] = useState(null); // { habit, isOwner }

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [withMeRes, byMeRes, pendingRes] = await Promise.all([
        getSharedWithMe(),
        getSharedByMe(),
        getPendingInvites(),
      ]);
      setSharedWithMe(withMeRes.data.data.sharedHabits || []);
      setSharedByMe(byMeRes.data.data.sharedHabits || []);
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

  const openModal = (habit, isOwner) => {
    setModalHabit({ habit, isOwner });
  };

  if (loading) return <LoadingSpinner />;

  const isEmpty = sharedWithMe.length === 0 && sharedByMe.length === 0 && pendingInvites.length === 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Shared Habits</h1>

      {isEmpty && (
        <EmptyState
          icon="👥"
          title="No shared habits yet"
          description="Share your habits with friends to stay accountable, or join shared habits via invite links."
          actionLabel="Go to Habits"
          onAction={() => navigate('/habits')}
        />
      )}

      {/* ─── Pending Invites ─────────────────────────────────────────── */}
      {pendingInvites.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Pending Invites ({pendingInvites.length})
          </h2>
          <div className="space-y-3">
            {pendingInvites.filter((invite) => invite.habitId).map((invite) => (
              <Card key={invite.habitId._id} className="p-4">
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
        </section>
      )}

      {/* ─── Habits I Share (Owner View) ─────────────────────────────── */}
      {sharedByMe.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Habits I Share ({sharedByMe.length})
          </h2>
          <div className="space-y-3">
            {sharedByMe.map((sh) => {
              const habit = sh.habitId;
              const accepted = sh.sharedWith?.filter((m) => m.status === 'accepted') || [];
              const pending = sh.sharedWith?.filter((m) => m.status === 'pending') || [];
              return (
                <Card key={sh._id} className="p-4 border-l-4 border-l-indigo-400 dark:border-l-indigo-500">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0"
                        style={{ backgroundColor: `${habit?.color || '#6366f1'}20` }}
                      >
                        {habit?.icon || '🎯'}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-medium text-gray-900 dark:text-white truncate">
                          {habit?.name || 'Unknown Habit'}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                          <span className="flex items-center gap-1">
                            <span className="text-indigo-500">👥</span>
                            {accepted.length} member{accepted.length !== 1 ? 's' : ''}
                          </span>
                          {pending.length > 0 && (
                            <>
                              <span>&middot;</span>
                              <span className="text-amber-500">{pending.length} pending</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => openModal(habit, true)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-sm font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition shrink-0"
                    >
                      Manage
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* ─── Shared With Me ──────────────────────────────────────────── */}
      {sharedWithMe.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Shared With Me ({sharedWithMe.length})
          </h2>
          <div className="space-y-3">
            {sharedWithMe.map((sh) => {
              const habit = sh.habitId;
              const owner = sh.ownerId;
              const myMembership = sh.sharedWith?.find(
                (m) => String(m.userId?._id || m.userId) === String(user?._id) && m.status === 'accepted'
              );
              const acceptedCount = (sh.sharedWith?.filter((m) => m.status === 'accepted').length || 0) + 1;
              return (
                <Card key={sh._id} className="p-4 border-l-4 border-l-purple-400 dark:border-l-purple-500">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0"
                        style={{ backgroundColor: `${habit?.color || '#6366f1'}20` }}
                      >
                        {habit?.icon || '🎯'}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-medium text-gray-900 dark:text-white truncate">
                          {habit?.name || 'Unknown Habit'}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                          <span>by {owner?.name || 'Unknown'}</span>
                          <span>&middot;</span>
                          <span className="capitalize">{myMembership?.role || 'member'}</span>
                          <span>&middot;</span>
                          <span>{acceptedCount} members</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => openModal(habit, false)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                        title="View members & progress"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleLeave(habit?._id, habit?.name)}
                        className="px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                      >
                        Leave
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* Empty states for individual sections when the other has data */}
      {!isEmpty && sharedByMe.length === 0 && (
        <section className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            You haven't shared any habits yet.{' '}
            <button
              onClick={() => navigate('/habits')}
              className="text-indigo-500 hover:text-indigo-600 font-medium"
            >
              Share one from Habits page
            </button>
          </p>
        </section>
      )}

      {!isEmpty && sharedWithMe.length === 0 && pendingInvites.length === 0 && (
        <section className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No one has shared habits with you yet. Join via an invite link to get started.
          </p>
        </section>
      )}

      {/* ShareHabitModal */}
      {modalHabit && (
        <ShareHabitModal
          habit={modalHabit.habit}
          isOwner={modalHabit.isOwner}
          onClose={() => {
            setModalHabit(null);
            fetchData(); // Refresh data in case anything changed
          }}
        />
      )}
    </div>
  );
}
