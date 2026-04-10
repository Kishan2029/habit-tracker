import { useState } from 'react';
import { getLocalDateString } from '../../utils/dateUtils';
import { wasHabitCreatedOnOrBefore } from '../../utils/habitDateUtils';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getColorClass(percentage) {
  if (percentage === 0) return 'bg-gray-100 dark:bg-gray-800';
  if (percentage < 0.25) return 'bg-green-200 dark:bg-green-900';
  if (percentage < 0.5) return 'bg-green-300 dark:bg-green-700';
  if (percentage < 0.75) return 'bg-green-400 dark:bg-green-600';
  return 'bg-green-500 dark:bg-green-500';
}

export default function CalendarHeatmap({ year, month, logs, habits, selectedHabitId, frozenDates = new Set() }) {
  const [tooltip, setTooltip] = useState(null);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay();
  const todayStr = getLocalDateString();

  // Build a log lookup map: "habitId-YYYY-MM-DD" -> log
  const logMap = new Map();
  for (const l of logs) {
    const logDate = typeof l.date === 'string' ? l.date.slice(0, 10) : l.date.toISOString().slice(0, 10);
    logMap.set(`${l.habitId}-${logDate}`, l);
  }

  const cells = [];
  const dayData = {};

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayOfWeek = new Date(year, month - 1, d).getDay();

    const relevantHabits = selectedHabitId
      ? habits.filter(
          (h) =>
            h._id === selectedHabitId &&
            wasHabitCreatedOnOrBefore(h.createdAt, dateStr, h.createdDate) &&
            h.frequency.includes(dayOfWeek)
        )
      : habits.filter(
          (h) => wasHabitCreatedOnOrBefore(h.createdAt, dateStr, h.createdDate) && h.frequency.includes(dayOfWeek)
        );

    // Proportional completion: count habits give partial credit (e.g. 8/10 = 0.8)
    let completionSum = 0;
    for (const habit of relevantHabits) {
      const log = logMap.get(`${habit._id}-${dateStr}`);
      if (!log) continue;
      if (typeof log.value === 'boolean') {
        completionSum += log.value ? 1 : 0;
      } else {
        completionSum += Math.min(1, log.value / (habit.target || 1));
      }
    }

    dayData[d] = {
      dateStr,
      total: relevantHabits.length,
      completed: completionSum,
      percentage: relevantHabits.length > 0 ? completionSum / relevantHabits.length : 0,
      habits: relevantHabits,
    };
  }

  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    cells.push(<div key={`empty-${i}`} className="w-9 h-9" />);
  }

  // Day cells
  for (let d = 1; d <= daysInMonth; d++) {
    const { percentage, completed, total, dateStr } = dayData[d];
    const isToday = dateStr === todayStr;

    cells.push(
      <div
        key={d}
        className={`w-9 h-9 rounded-lg ${getColorClass(percentage)} flex items-center justify-center text-xs cursor-default transition-all relative ${
          isToday ? 'ring-2 ring-indigo-500 ring-offset-1 dark:ring-offset-gray-800' : ''
        }`}
        onMouseEnter={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setTooltip({ d, x: rect.left + rect.width / 2, y: rect.top });
        }}
        onMouseLeave={() => setTooltip(null)}
      >
        <span className={`text-[11px] font-medium ${
          percentage >= 0.5 ? 'text-white' : 'text-gray-700 dark:text-gray-300'
        }`}>
          {d}
        </span>
        {frozenDates.has(dateStr) && (
          <span className="absolute -top-0.5 -right-0.5 text-[9px]" title="Frozen day">&#10052;</span>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Day labels */}
      <div className="grid grid-cols-7 gap-1.5 mb-1.5">
        {DAY_LABELS.map((label) => (
          <div key={label} className="w-9 h-5 flex items-center justify-center text-[10px] font-medium text-gray-400 dark:text-gray-500">
            {label}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1.5">{cells}</div>

      {/* Tooltip */}
      {tooltip && dayData[tooltip.d] && (
        <div
          className="fixed z-50 px-3 py-2 rounded-lg shadow-lg bg-gray-900 dark:bg-gray-700 text-white text-xs transform -translate-x-1/2 -translate-y-full pointer-events-none"
          style={{ left: tooltip.x, top: tooltip.y - 8 }}
        >
          <div className="font-medium mb-0.5">{dayData[tooltip.d].dateStr}</div>
          <div className={dayData[tooltip.d].percentage > 0 ? 'text-green-400' : 'text-gray-400'}>
            {Math.round(dayData[tooltip.d].percentage * 100)}% completed
            {dayData[tooltip.d].total > 0 && ` (${dayData[tooltip.d].total} habit${dayData[tooltip.d].total > 1 ? 's' : ''})`}
          </div>
          {frozenDates.has(dayData[tooltip.d].dateStr) && (
            <div className="text-blue-300">&#10052; Streak frozen</div>
          )}
        </div>
      )}
    </div>
  );
}
