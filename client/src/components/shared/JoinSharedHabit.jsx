import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { joinByInviteCode, getInvitePreview } from '../../api/sharedHabitApi';
import Card from '../ui/Card';
import toast from 'react-hot-toast';

export default function JoinSharedHabit() {
  const { inviteCode } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPreview();
  }, [inviteCode]);

  const fetchPreview = async () => {
    setPreviewLoading(true);
    setError(null);
    try {
      const { data: res } = await getInvitePreview(inviteCode);
      setPreview(res.data.preview);
    } catch (err) {
      const message = err.response?.data?.message || 'Invalid or expired invite link';
      setError(message);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleJoin = async () => {
    setLoading(true);
    setError(null);
    try {
      await joinByInviteCode(inviteCode);
      toast.success('Joined shared habit!');
      // Force full reload so TodayView fetches fresh data with the new shared habit
      window.location.href = '/today';
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
        {previewLoading ? (
          <div className="py-8">
            <div className="w-12 h-12 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Loading invite details...</p>
          </div>
        ) : error && !preview ? (
          /* Invalid/expired link — show error state */
          <div>
            <div className="text-4xl mb-4">😕</div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Invalid Invite
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mb-6">{error}</p>
            <button
              onClick={() => navigate('/today')}
              className="w-full py-3 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition"
            >
              Go to Today
            </button>
          </div>
        ) : preview ? (
          /* Valid link — show habit preview */
          <div>
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl mx-auto mb-4"
              style={{ backgroundColor: `${preview.habitColor || '#6366f1'}20` }}
            >
              {preview.habitIcon || '🎯'}
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {preview.habitName}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mb-1">
              Shared by <span className="font-medium text-gray-700 dark:text-gray-300">{preview.ownerName}</span>
            </p>
            <div className="flex items-center justify-center gap-3 text-sm text-gray-400 dark:text-gray-500 mb-6">
              <span className="flex items-center gap-1">
                👥 {preview.memberCount} member{preview.memberCount !== 1 ? 's' : ''}
              </span>
              <span>&middot;</span>
              <span className="capitalize">{preview.habitType}</span>
            </div>

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
          </div>
        ) : null}
      </Card>
    </div>
  );
}
