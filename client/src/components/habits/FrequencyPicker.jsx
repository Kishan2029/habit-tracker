import toast from 'react-hot-toast';

const DAYS = [
  { value: 0, label: 'S' },
  { value: 1, label: 'M' },
  { value: 2, label: 'T' },
  { value: 3, label: 'W' },
  { value: 4, label: 'T' },
  { value: 5, label: 'F' },
  { value: 6, label: 'S' },
];

export default function FrequencyPicker({ value = [], onChange }) {
  const toggleDay = (day) => {
    if (value.includes(day)) {
      if (value.length > 1) {
        onChange(value.filter((d) => d !== day));
      } else {
        toast.error('At least one day must be selected');
      }
    } else {
      onChange([...value, day].sort((a, b) => a - b));
    }
  };

  const selectAll = () => {
    onChange([0, 1, 2, 3, 4, 5, 6]);
  };

  const selectWeekdays = () => {
    onChange([1, 2, 3, 4, 5]);
  };

  const isAllSelected = value.length === 7;

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        {DAYS.map((day) => (
          <button
            key={day.value}
            type="button"
            onClick={() => toggleDay(day.value)}
            className={`w-9 h-9 rounded-full text-sm font-medium transition ${
              value.includes(day.value)
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {day.label}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={selectAll}
          className={`text-xs px-2 py-1 rounded transition ${
            isAllSelected
              ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Every day
        </button>
        <button
          type="button"
          onClick={selectWeekdays}
          className="text-xs px-2 py-1 rounded text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition"
        >
          Weekdays
        </button>
      </div>
    </div>
  );
}
