import { useState, useRef, useEffect } from 'react';
import { sendEmailVerification, verifyEmail, getProfile } from '../../api/userApi';
import toast from 'react-hot-toast';

export default function EmailVerificationModal({ onClose, onVerified }) {
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    if (codeSent && inputRef.current) {
      inputRef.current.focus();
    }
  }, [codeSent]);

  const handleSendCode = async () => {
    setSending(true);
    try {
      await sendEmailVerification();
      setCodeSent(true);
      setCooldown(60);
      toast.success('Verification code sent to your email');
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to send verification code';
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (code.length !== 6) return;

    setVerifying(true);
    try {
      await verifyEmail(code);
      const res = await getProfile();
      onVerified(res.data.data.user);
    } catch (err) {
      const msg = err.response?.data?.message || 'Verification failed';
      toast.error(msg);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-sm mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Verify Your Email</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {codeSent
            ? 'Enter the 6-digit code we sent to your email.'
            : 'We\'ll send a verification code to your email address.'
          }
        </p>

        {!codeSent ? (
          <div className="space-y-3">
            <button
              onClick={handleSendCode}
              disabled={sending}
              className="w-full py-2.5 px-4 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {sending ? 'Sending...' : 'Send Verification Code'}
            </button>
            <button
              onClick={onClose}
              className="w-full py-2.5 px-4 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <form onSubmit={handleVerify} className="space-y-3">
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="w-full text-center text-2xl tracking-[0.5em] font-mono py-3 px-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <button
              type="submit"
              disabled={code.length !== 6 || verifying}
              className="w-full py-2.5 px-4 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {verifying ? 'Verifying...' : 'Verify'}
            </button>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handleSendCode}
                disabled={cooldown > 0 || sending}
                className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
