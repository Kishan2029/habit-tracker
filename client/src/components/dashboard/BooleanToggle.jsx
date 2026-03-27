export default function BooleanToggle({ isCompleted, onChange, color }) {
  return (
    <button
      onClick={onChange}
      aria-pressed={isCompleted}
      aria-label={isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
      className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 ${
        isCompleted
          ? 'scale-105'
          : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
      }`}
      style={isCompleted ? { backgroundColor: color } : {}}
    >
      {isCompleted ? (
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <div className="w-5 h-5 rounded border-2 border-gray-300 dark:border-gray-500" />
      )}
    </button>
  );
}
