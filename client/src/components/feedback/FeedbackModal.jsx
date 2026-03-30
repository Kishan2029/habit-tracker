import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import { submitFeedback } from '../../api/feedbackApi';

const moods = [
  { key: 'loved', emoji: '\u{1F60D}', label: 'Love it' },
  { key: 'happy', emoji: '\u{1F60A}', label: 'Good' },
  { key: 'neutral', emoji: '\u{1F610}', label: 'Okay' },
  { key: 'confused', emoji: '\u{1F615}', label: 'Confused' },
  { key: 'sad', emoji: '\u{1F622}', label: 'Not great' },
];

export default function FeedbackModal({ isOpen, onClose }) {
  const location = useLocation();
  const [selectedMood, setSelectedMood] = useState(null);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const reset = () => {
    setSelectedMood(null);
    setMessage('');
    setSubmitted(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!selectedMood) return;
    setSubmitting(true);
    try {
      await submitFeedback({
        mood: selectedMood,
        message: message.trim(),
        page: location.pathname,
      });
      setSubmitted(true);
    } catch {
      toast.error('Failed to send feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={submitted ? '' : 'How are we doing?'}>
      {submitted ? (
        <div className="text-center py-6">
          <div className="text-5xl mb-4">{'\u{1F389}'}</div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Thanks for your feedback!
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            You're helping us make Habit Tracker better.
          </p>
          <button
            onClick={handleClose}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition"
          >
            Close
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Mood selector */}
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Pick a mood — that's all we need!
            </p>
            <div className="flex justify-center gap-3">
              {moods.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setSelectedMood(m.key)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all duration-150 ${
                    selectedMood === m.key
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 ring-2 ring-indigo-500 scale-110'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  title={m.label}
                >
                  <span className="text-3xl">{m.emoji}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Optional message */}
          <div>
            <label
              htmlFor="feedback-message"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Anything else? <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              id="feedback-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us what's on your mind..."
              rows={3}
              maxLength={2000}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none transition"
            />
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!selectedMood || submitting}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition"
          >
            {submitting ? 'Sending...' : 'Send Feedback'}
          </button>
        </div>
      )}
    </Modal>
  );
}
