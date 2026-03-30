export default function CountStepper({ value, target, unit, color, onChange }) {
  const isCompleted = value >= target;
  const isPartial = value > 0 && !isCompleted;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(Math.max(0, value - 1))}
        className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400 transition"
      >
        -
      </button>
      <div className="text-center min-w-[60px]">
        <span
          className={`text-lg font-bold ${
            isCompleted
              ? 'text-green-600 dark:text-green-400'
              : isPartial
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-gray-900 dark:text-white'
          }`}
        >
          {value}
        </span>
        <span className="text-sm text-gray-400 dark:text-gray-500">
          /{target} {unit}
        </span>
      </div>
      <button
        onClick={() => onChange(Math.min(9999, value + 1))}
        className="w-8 h-8 rounded-lg flex items-center justify-center transition hover:opacity-80"
        style={{ backgroundColor: color, color: 'white' }}
      >
        +
      </button>
    </div>
  );
}
