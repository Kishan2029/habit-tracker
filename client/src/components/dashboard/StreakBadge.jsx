export default function StreakBadge({ current, longest }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {current > 0 && (
        <span className="flex items-center gap-1 text-amber-500 font-medium">
          &#x1F525; {current}
        </span>
      )}
      {longest > 0 && (
        <span className="text-gray-400 dark:text-gray-500 text-xs">
          Best: {longest}
        </span>
      )}
    </div>
  );
}
