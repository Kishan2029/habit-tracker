import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import ThemeToggle from './ThemeToggle';
import AvatarUpload from './AvatarUpload';
import ChangePasswordForm from './ChangePasswordForm';
import NotificationToggle from './NotificationToggle';
import Card from '../ui/Card';
import { updateProfile } from '../../api/userApi';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { user, updateUser } = useAuth();
  const [freezeEnabled, setFreezeEnabled] = useState(user?.settings?.streakFreeze?.enabled || false);
  const [freezePerMonth, setFreezePerMonth] = useState(user?.settings?.streakFreeze?.allowedPerMonth || 2);

  const handleFreezeToggle = async (enabled) => {
    setFreezeEnabled(enabled);
    try {
      await updateProfile({ settings: { ...user.settings, streakFreeze: { enabled, allowedPerMonth: freezePerMonth } } });
      updateUser({ ...user, settings: { ...user.settings, streakFreeze: { enabled, allowedPerMonth: freezePerMonth } } });
    } catch {
      setFreezeEnabled(!enabled);
      toast.error('Failed to update setting');
    }
  };

  const handleFreezeCountChange = async (count) => {
    setFreezePerMonth(count);
    try {
      await updateProfile({ settings: { ...user.settings, streakFreeze: { enabled: freezeEnabled, allowedPerMonth: count } } });
      updateUser({ ...user, settings: { ...user.settings, streakFreeze: { enabled: freezeEnabled, allowedPerMonth: count } } });
    } catch {
      toast.error('Failed to update setting');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Profile Photo</h2>
        <AvatarUpload />
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Appearance</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Theme</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Choose your preferred theme</p>
          </div>
          <ThemeToggle />
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Account</h2>
        <div className="space-y-3">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Name</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white">{user?.name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white">{user?.email}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Role</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">{user?.role}</p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Security</h2>
        <ChangePasswordForm />
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Streak Freeze</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable Streak Freeze</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Protect streaks on sick or vacation days</p>
            </div>
            <button
              onClick={() => handleFreezeToggle(!freezeEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                freezeEnabled ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  freezeEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          {freezeEnabled && (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Freezes per month</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Maximum freeze days allowed each month</p>
              </div>
              <select
                value={freezePerMonth}
                onChange={(e) => handleFreezeCountChange(parseInt(e.target.value, 10))}
                className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Notifications</h2>
        <NotificationToggle />
      </Card>
    </div>
  );
}
