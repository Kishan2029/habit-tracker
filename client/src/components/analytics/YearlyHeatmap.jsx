import { useState, useMemo } from 'react';

const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getColor(percentage, isDark) {
  if (percentage === 0) return isDark ? '#1f2937' : '#f3f4f6';
  if (percentage < 0.25) return isDark ? '#064e3b' : '#bbf7d0';
  if (percentage < 0.5) return isDark ? '#065f46' : '#86efac';
  if (percentage < 0.75) return isDark ? '#047857' : '#4ade80';
  return isDark ? '#059669' : '#22c55e';
}

export default function YearlyHeatmap({ year, logs, habits, selectedHabitId }) {
  const [tooltip, setTooltip] = useState(null);
  const isDark = document.documentElement.classList.contains('dark');

  const { weeks, monthPositions, totalCompleted } = useMemo(() => {
    // Build log lookup
    const logMap = new Map();
    for (const log of logs) {
      const dateKey = typeof log.date === 'string' ? log.date.slice(0, 10) : new Date(log.date).toISOString().split('T')[0];
      const key = `${log.habitId}-${dateKey}`;
      logMap.set(key, log);
    }

    const filteredHabits = selectedHabitId
      ? habits.filter((h) => h._id === selectedHabitId)
      : habits;

    // Generate all days of the year
    const jan1 = new Date(year, 0, 1);
    const dec31 = new Date(year, 11, 31);
    const totalDays = Math.ceil((dec31 - jan1) / 86400000) + 1;

    const weeks = [];
    let currentWeek = [];
    const monthPos = {};
    let totalComp = 0;

    // Pad first week with empty cells
    const startDay = jan1.getDay(); // 0=Sun
    for (let i = 0; i < startDay; i++) {
      currentWeek.push(null);
    }

    for (let i = 0; i < totalDays; i++) {
      const d = new Date(year, 0, 1 + i);
      const dow = d.getDay();
      const m = d.getMonth();
      const dateStr = `${year}-${String(m + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      // Track month positions for labels
      if (d.getDate() === 1) {
        monthPos[m] = weeks.length;
      }

      // Calculate proportional completion for this day
      let scheduled = 0;
      let completionSum = 0;
      for (const habit of filteredHabits) {
        if (!habit.frequency.includes(dow)) continue;
        scheduled++;
        const log = logMap.get(`${habit._id}-${dateStr}`);
        if (log) {
          if (typeof log.value === 'boolean') {
            if (log.value) { completionSum += 1; totalComp++; }
          } else {
            const fraction = Math.min(1, log.value / (habit.target || 1));
            completionSum += fraction;
            if (fraction >= 1) totalComp++;
          }
        }
      }

      const percentage = scheduled > 0 ? completionSum / scheduled : 0;
      currentWeek.push({ dateStr, completed: completionSum, scheduled, percentage, day: d.getDate(), month: m });

      if (dow === 6 || i === totalDays - 1) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    return { weeks, monthPositions: monthPos, totalCompleted: totalComp };
  }, [year, logs, habits, selectedHabitId]);

  return (
    <div className="relative">
      {/* Month labels */}
      <div className="flex ml-8 mb-1">
        {MONTH_LABELS.map((label, i) => {
          const weekIdx = monthPositions[i] ?? 0;
          const left = weekIdx * 15; // 13px cell + 2px gap
          return (
            <span
              key={label}
              className="text-[10px] text-gray-400 dark:text-gray-500 absolute"
              style={{ left: 32 + left }}
            >
              {label}
            </span>
          );
        })}
      </div>

      <div className="flex mt-4">
        {/* Day labels */}
        <div className="flex flex-col gap-[2px] mr-1 shrink-0">
          {DAY_LABELS.map((label, i) => (
            <div key={i} className="w-6 h-[13px] flex items-center justify-end pr-1">
              <span className="text-[9px] text-gray-400 dark:text-gray-500">{label}</span>
            </div>
          ))}
        </div>

        {/* Heatmap grid */}
        <div className="flex gap-[2px] overflow-x-auto">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[2px]">
              {week.map((day, di) => {
                if (!day) {
                  return <div key={di} className="w-[13px] h-[13px]" />;
                }
                return (
                  <div
                    key={di}
                    className="w-[13px] h-[13px] rounded-sm cursor-default transition-colors"
                    style={{ backgroundColor: getColor(day.percentage, isDark) }}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setTooltip({
                        ...day,
                        x: rect.left + rect.width / 2,
                        y: rect.top,
                      });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {totalCompleted} completions in {year}
        </span>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-gray-400 dark:text-gray-500">Less</span>
          {[0, 0.1, 0.35, 0.6, 0.85].map((p, i) => (
            <div
              key={i}
              className="w-[11px] h-[11px] rounded-sm"
              style={{ backgroundColor: getColor(p, isDark) }}
            />
          ))}
          <span className="text-[10px] text-gray-400 dark:text-gray-500">More</span>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 px-3 py-2 rounded-lg shadow-lg bg-gray-900 dark:bg-gray-700 text-white text-xs transform -translate-x-1/2 -translate-y-full pointer-events-none"
          style={{ left: tooltip.x, top: tooltip.y - 8 }}
        >
          <div className="font-medium">{tooltip.dateStr}</div>
          <div className={tooltip.percentage > 0 ? 'text-green-400' : 'text-gray-400'}>
            {Math.round(tooltip.percentage * 100)}% completed ({tooltip.scheduled} habit{tooltip.scheduled !== 1 ? 's' : ''})
          </div>
        </div>
      )}
    </div>
  );
}
