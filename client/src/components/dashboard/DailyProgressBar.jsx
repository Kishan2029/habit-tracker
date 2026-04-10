function getMotivationalMessage(percentage, completed, total) {
  if (total === 0) return '';
  if (percentage === 0) return "Let's get started! You've got this.";
  if (percentage < 25) return 'Good start! Keep the momentum going.';
  if (percentage < 50) return 'Making progress! Stay focused.';
  if (percentage < 75) return 'Halfway there! You\'re doing great.';
  if (percentage < 100) return `Almost there! Just ${total - completed} left.`;
  return 'Perfect day! You crushed it.';
}

export default function DailyProgressBar({ completed, total }) {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  const message = getMotivationalMessage(percentage, completed, total);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700 dark:text-gray-300">
          {completed}/{total} habits done
        </span>
        <span className="text-gray-500 dark:text-gray-400">{percentage}%</span>
      </div>
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-600 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
      {message && (
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          {message}
        </p>
      )}
    </div>
  );
}
