import { useState, useEffect, useCallback } from 'react';
import { isPushSupported, subscribeToPush, unsubscribeFromPush, isSubscribed } from '../../services/pushNotification';
import { updateProfile } from '../../api/userApi';
import { useAuth } from '../../context/AuthContext';
import EmailVerificationModal from './EmailVerificationModal';
import toast from 'react-hot-toast';

const NOTIFICATION_TYPES = [
  {
    key: 'dailyReminders',
    label: 'Daily Reminders',
    description: 'Remind you of today\'s habits',
    hasEmail: true,
    hasTimePicker: true,
  },
  {
    key: 'streakMilestones',
    label: 'Streak Milestones',
    description: 'Celebrate when you hit streak milestones (7, 14, 30 days...)',
    hasEmail: true,
  },
  {
    key: 'missedAlerts',
    label: 'Missed Habit Alerts',
    description: 'Alert when you missed habits yesterday',
    hasEmail: true,
  },
  {
    key: 'sharedActivity',
    label: 'Shared Habit Activity',
    description: 'Partner joins or completes shared habits',
    hasEmail: false,
  },
  {
    key: 'goalCompletion',
    label: 'Goal Completion',
    description: 'When you complete a habit\'s daily target',
    hasEmail: true,
  },
  {
    key: 'weeklySummary',
    label: 'Weekly Summary',
    description: 'Sunday summary of your weekly progress',
    hasEmail: true,
  },
];

function Toggle({ enabled, onChange, disabled, small }) {
  const size = small ? 'w-9 h-5' : 'w-11 h-6';
  const dot = small ? 'w-4 h-4' : 'w-5 h-5';
  const translate = small ? 'translate-x-4' : 'translate-x-5';

  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      disabled={disabled}
      className={`relative ${size} rounded-full transition-colors ${
        enabled ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 ${dot} rounded-full bg-white transition-transform ${
          enabled ? translate : 'translate-x-0'
        }`}
      />
    </button>
  );
}

export default function NotificationToggle() {
  const { user, updateUser } = useAuth();
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const supported = isPushSupported();

  const notifications = user?.settings?.notifications || {};
  const reminderTime = user?.settings?.reminderTime || '08:00';
  const emailVerified = user?.emailVerified || false;

  useEffect(() => {
    isSubscribed().then((val) => {
      setPushEnabled(val);
      setPushLoading(false);
    });
  }, []);

  const handlePushToggle = async () => {
    setPushLoading(true);
    try {
      if (pushEnabled) {
        await unsubscribeFromPush();
        setPushEnabled(false);
        toast.success('Push notifications disabled');
      } else {
        await subscribeToPush();
        setPushEnabled(true);
        toast.success('Push notifications enabled!');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to update push settings');
    } finally {
      setPushLoading(false);
    }
  };

  const savePreference = useCallback(async (path, value) => {
    setSaving(true);
    try {
      const keys = path.split('.');
      const update = { settings: {} };
      let current = update.settings;
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = {};
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;

      const res = await updateProfile(update);
      updateUser(res.data.data.user);
    } catch {
      toast.error('Failed to save preference');
    } finally {
      setSaving(false);
    }
  }, [updateUser]);

  const handleNotificationToggle = (typeKey, channel, newValue) => {
    if (channel === 'email' && !emailVerified && newValue) {
      setShowVerifyModal(true);
      return;
    }
    savePreference(`notifications.${typeKey}.${channel}`, newValue);
  };

  const handleReminderTimeChange = (e) => {
    savePreference('reminderTime', e.target.value);
  };

  const handleEmailVerified = (updatedUser) => {
    updateUser(updatedUser);
    setShowVerifyModal(false);
    toast.success('Email verified! You can now enable email notifications.');
  };

  return (
    <div className="space-y-6">
      {/* Master Push Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable Push Notifications</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {supported
              ? 'Required for all push notification types below'
              : 'Push notifications are not supported in this browser'}
          </p>
        </div>
        <Toggle
          enabled={pushEnabled}
          onChange={handlePushToggle}
          disabled={!supported || pushLoading}
        />
      </div>

      {/* Email Verification Status */}
      <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Email Notifications</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {emailVerified
              ? `Verified: ${user?.email}`
              : 'Verify your email to receive email notifications'
            }
          </p>
        </div>
        {emailVerified ? (
          <span className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded-full">
            Verified
          </span>
        ) : (
          <button
            onClick={() => setShowVerifyModal(true)}
            className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700"
          >
            Verify Email
          </button>
        )}
      </div>

      <hr className="border-gray-200 dark:border-gray-700" />

      {/* Per-type Notification Preferences */}
      <div className="space-y-4">
        {NOTIFICATION_TYPES.map((type) => {
          const prefs = notifications[type.key] || {};
          const pushOn = prefs.push ?? true;
          const emailOn = prefs.email ?? false;

          return (
            <div key={type.key} className="space-y-2">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{type.label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{type.description}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] uppercase text-gray-400 dark:text-gray-500">Push</span>
                    <Toggle
                      small
                      enabled={pushOn}
                      onChange={(val) => handleNotificationToggle(type.key, 'push', val)}
                      disabled={!pushEnabled || saving}
                    />
                  </div>
                  {type.hasEmail && (
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[10px] uppercase text-gray-400 dark:text-gray-500">Email</span>
                      <Toggle
                        small
                        enabled={emailOn}
                        onChange={(val) => handleNotificationToggle(type.key, 'email', val)}
                        disabled={saving}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Reminder time picker for daily reminders */}
              {type.hasTimePicker && (
                <div className="flex items-center gap-2 ml-0">
                  <label className="text-xs text-gray-500 dark:text-gray-400">Remind at:</label>
                  <input
                    type="time"
                    value={reminderTime}
                    onChange={handleReminderTimeChange}
                    className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Email Verification Modal */}
      {showVerifyModal && (
        <EmailVerificationModal
          onClose={() => setShowVerifyModal(false)}
          onVerified={handleEmailVerified}
        />
      )}
    </div>
  );
}
