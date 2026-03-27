import { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../../api/authApi';
import toast from 'react-hot-toast';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { data } = await forgotPassword(email);
      // In dev mode, the server returns the token directly
      if (data.data?.resetToken) {
        setResetToken(data.data.resetToken);
      } else {
        setEmailSent(true);
      }
      toast.success(data.message || 'Check your email for reset instructions');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate reset token');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Forgot Password</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Enter your email to get a password reset token
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          {emailSent ? (
            <div className="space-y-4">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 text-center">
                <p className="text-sm font-medium text-green-800 dark:text-green-300">
                  Check your email for a password reset link. It expires in 30 minutes.
                </p>
              </div>
              <Link
                to="/reset-password"
                className="block w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition text-center"
              >
                Enter Reset Token
              </Link>
            </div>
          ) : !resetToken ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                  placeholder="you@example.com"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Generating...' : 'Get Reset Token'}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <p className="text-sm font-medium text-green-800 dark:text-green-300 mb-2">
                  Your reset token:
                </p>
                <code className="block bg-white dark:bg-gray-900 border border-green-300 dark:border-green-700 rounded p-3 text-xs text-gray-900 dark:text-gray-100 break-all select-all">
                  {resetToken}
                </code>
                <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                  This token expires in 30 minutes. Copy it and use it on the reset page.
                </p>
              </div>
              <Link
                to="/reset-password"
                className="block w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition text-center"
              >
                Reset Password
              </Link>
            </div>
          )}

          <div className="flex justify-between text-sm pt-2">
            <Link to="/login" className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
              Back to Login
            </Link>
            {!resetToken && (
              <Link to="/reset-password" className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
                Already have a token?
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
