import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import LoginPage from './components/auth/LoginPage';
import RegisterPage from './components/auth/RegisterPage';
import ForgotPasswordPage from './components/auth/ForgotPasswordPage';
import ResetPasswordPage from './components/auth/ResetPasswordPage';
import TodayView from './components/dashboard/TodayView';
import HabitList from './components/habits/HabitList';
import AnalyticsPage from './components/analytics/AnalyticsPage';
import SettingsPage from './components/settings/SettingsPage';
import WeeklyView from './components/views/WeeklyView';
import SharedHabitsPage from './components/shared/SharedHabitsPage';
import JoinSharedHabit from './components/shared/JoinSharedHabit';
import NotFoundPage from './components/ui/NotFoundPage';
import ErrorBoundary from './components/ui/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/join/:inviteCode" element={<JoinSharedHabit />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  <Route path="/" element={<Navigate to="/today" replace />} />
                  <Route path="/today" element={<TodayView />} />
                  <Route path="/weekly" element={<WeeklyView />} />
                  <Route path="/habits" element={<HabitList />} />
                  <Route path="/shared" element={<SharedHabitsPage />} />
                  <Route path="/analytics" element={<AnalyticsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Route>
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            className: 'text-sm',
            duration: 3000,
          }}
        />
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
