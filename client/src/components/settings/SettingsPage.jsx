import { useAuth } from '../../context/AuthContext';
import ThemeToggle from './ThemeToggle';
import AvatarUpload from './AvatarUpload';
import ChangePasswordForm from './ChangePasswordForm';
import NotificationToggle from './NotificationToggle';
import Card from '../ui/Card';

export default function SettingsPage() {
  const { user } = useAuth();

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
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Notifications</h2>
        <NotificationToggle />
      </Card>
    </div>
  );
}
