import { useState, useEffect } from 'react';
import { getMembersProgress } from '../../api/logApi';

export default function MemberProgressList({ habitId, date, compact = false }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!habitId || !date) return;
    setLoading(true);
    getMembersProgress(habitId, date)
      .then(({ data: res }) => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [habitId, date]);

  if (loading) {
    return <div className="text-xs text-gray-400 py-1">Loading...</div>;
  }

  if (!data || data.members.length === 0) {
    return <div className="text-xs text-gray-400 py-1">No members</div>;
  }

  // Compact mode: just show "2/4 members" summary
  if (compact) {
    return (
      <span className="text-xs text-gray-500 dark:text-gray-400">
        {data.completedCount}/{data.totalMembers} members
      </span>
    );
  }

  return (
    <div className="space-y-1.5">
      {data.members.map((member) => (
        <div
          key={member.userId}
          className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-gray-50 dark:bg-gray-700/50"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-xs font-medium text-indigo-600 dark:text-indigo-400 shrink-0">
              {(member.name || '?')[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {member.name}
                </span>
                {member.isOwner && (
                  <span className="text-[10px] px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                    Owner
                  </span>
                )}
                {!member.isOwner && (
                  <span className="text-[10px] px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400 capitalize">
                    {member.role}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="shrink-0 ml-2">
            {member.isCompleted ? (
              <div className="flex items-center gap-1">
                {data.habitType === 'count' && (
                  <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                    {member.value}/{data.target}
                  </span>
                )}
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            ) : member.value !== null && data.habitType === 'count' ? (
              <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                {member.value}/{data.target}
              </span>
            ) : (
              <svg className="w-5 h-5 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" strokeWidth={2} />
              </svg>
            )}
          </div>
        </div>
      ))}

      <div className="text-xs text-center text-gray-400 dark:text-gray-500 pt-1">
        {data.completedCount}/{data.totalMembers} completed
      </div>
    </div>
  );
}
