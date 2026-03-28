import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { joinByInviteCode } from '../../api/sharedHabitApi';
import Card from '../ui/Card';
import toast from 'react-hot-toast';

export default function JoinSharedHabit() {
  const { inviteCode } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleJoin = async () => {
    setLoading(true);
    setError(null);
    try {
      await joinByInviteCode(inviteCode);
      toast.success('Joined shared habit!');
      navigate('/today');
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to join';
      if (message.includes('already joined')) {
        toast.success('You have already joined this habit');
        navigate('/today');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 text-center">
        <div className="text-4xl mb-4">👥</div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Join Shared Habit
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          You've been invited to join a shared habit. Click below to join as a member.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <button
          onClick={handleJoin}
          disabled={loading}
          className="w-full py-3 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
        >
          {loading ? 'Joining...' : 'Join Habit'}
        </button>

        <button
          onClick={() => navigate('/today')}
          className="mt-3 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          Go back to Today
        </button>
      </Card>
    </div>
  );
}
