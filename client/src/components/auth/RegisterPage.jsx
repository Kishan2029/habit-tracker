import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

function getPasswordStrength(password) {
  if (!password) return { level: 0, label: '', color: '' };
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { level: 1, label: 'Weak', color: 'bg-red-500' };
  if (score <= 2) return { level: 2, label: 'Fair', color: 'bg-amber-500' };
  if (score <= 3) return { level: 3, label: 'Good', color: 'bg-yellow-500' };
  if (score <= 4) return { level: 4, label: 'Strong', color: 'bg-green-500' };
  return { level: 5, label: 'Very Strong', color: 'bg-green-600' };
}

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from || '/today';

  const strength = getPasswordStrength(password);

  const validate = () => {
    const newErrors = {};
    if (!name.trim()) {
      newErrors.name = 'Name is required';
    } else if (name.trim().length > 100) {
      newErrors.name = 'Name must be at most 100 characters';
    }
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      await register(name, email, password);
      toast.success('Account created! Check your email for a welcome message.');
      navigate(redirectTo);
    } catch (err) {
      const message = err.response?.data?.message || 'Registration failed';
      toast.error(message);
      if (err.response?.status === 400 && message.toLowerCase().includes('email')) {
        setErrors((p) => ({ ...p, email: message }));
      }
      if (err.response?.status === 429) {
        setErrors({ form: 'Too many attempts. Please try again later.' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = (field) =>
    `w-full px-3 py-2 rounded-lg border ${errors[field] ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition`;

  const clearError = (field) => setErrors((p) => ({ ...p, [field]: undefined }));

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Habit Tracker</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Create your account</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          {errors.form && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{errors.form}</p>
            </div>
          )}

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => { setName(e.target.value); clearError('name'); }}
              className={inputClass('name')}
              placeholder="Your name"
            />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => { setEmail(e.target.value); clearError('email'); }}
              className={inputClass('email')}
              placeholder="you@example.com"
            />
            {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => { setPassword(e.target.value); clearError('password'); }}
              className={inputClass('password')}
              placeholder="At least 6 characters"
            />
            {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}
            {password && !errors.password && (
              <div className="mt-2">
                <div className="flex gap-1 mb-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        i <= strength.level ? strength.color : 'bg-gray-200 dark:bg-gray-600'
                      }`}
                    />
                  ))}
                </div>
                <p className={`text-xs ${
                  strength.level <= 1 ? 'text-red-500' :
                  strength.level <= 2 ? 'text-amber-500' :
                  'text-green-600 dark:text-green-400'
                }`}>
                  {strength.label}
                </p>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); clearError('confirmPassword'); }}
              className={inputClass('confirmPassword')}
              placeholder="Confirm your password"
            />
            {errors.confirmPassword && <p className="mt-1 text-xs text-red-500">{errors.confirmPassword}</p>}
            {confirmPassword && !errors.confirmPassword && password === confirmPassword && (
              <p className="mt-1 text-xs text-green-600 dark:text-green-400">Passwords match</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Creating account...' : 'Create Account'}
          </button>
          <p className="text-center text-sm text-gray-600 dark:text-gray-400">
            Already have an account?{' '}
            <Link to="/login" className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
