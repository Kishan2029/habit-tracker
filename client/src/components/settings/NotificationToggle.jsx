import { useState, useEffect } from 'react';
import { isPushSupported, subscribeToPush, unsubscribeFromPush, isSubscribed } from '../../services/pushNotification';
import toast from 'react-hot-toast';

export default function NotificationToggle() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const supported = isPushSupported();

  useEffect(() => {
    isSubscribed().then((val) => {
      setEnabled(val);
      setLoading(false);
    });
  }, []);

  const handleToggle = async () => {
    setLoading(true);
    try {
      if (enabled) {
        await unsubscribeFromPush();
        setEnabled(false);
        toast.success('Notifications disabled');
      } else {
        await subscribeToPush();
        setEnabled(true);
        toast.success('Notifications enabled! You\'ll get weekly summaries.');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to update notification settings');
    } finally {
      setLoading(false);
    }
  };

  if (!supported) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Push notifications are not supported in this browser.
      </p>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Weekly Summary</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">Get a push notification every Sunday with your weekly stats</p>
      </div>
      <button
        onClick={handleToggle}
        disabled={loading}
        className={`relative w-11 h-6 rounded-full transition-colors ${
          enabled ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'
        } ${loading ? 'opacity-50' : ''}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
            enabled ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
