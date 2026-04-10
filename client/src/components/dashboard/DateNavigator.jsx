import Button from '../ui/Button';
import { getLocalDateString, shiftDate } from '../../utils/dateUtils';

export default function DateNavigator({ date, onChange, minDate }) {
  const today = getLocalDateString();
  const defaultMin = shiftDate(today, -7);
  const minDateStr = minDate || defaultMin;

  const canGoForward = date < today;
  const canGoBack = date > minDateStr;

  const shift = (days) => {
    onChange(shiftDate(date, days));
  };

  const isToday = date === today;

  const formatDate = (dateStr) => {
    // Parse as local date (YYYY-MM-DD → local midnight)
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="flex items-center justify-between">
      <Button
        variant="ghost"
        size="sm"
        disabled={!canGoBack}
        onClick={() => shift(-1)}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </Button>

      <div className="text-center">
        <p className="text-lg font-semibold text-gray-900 dark:text-white">
          {isToday ? 'Today' : formatDate(date)}
        </p>
        {isToday ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{formatDate(date)}</p>
        ) : (
          <button
            onClick={() => onChange(today)}
            className="text-xs text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium transition"
          >
            Jump to Today
          </button>
        )}
      </div>

      <Button
        variant="ghost"
        size="sm"
        disabled={!canGoForward}
        onClick={() => shift(1)}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Button>
    </div>
  );
}
