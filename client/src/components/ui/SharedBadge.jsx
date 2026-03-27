export default function SharedBadge({ sharedBy, isOwner }) {
  if (isOwner) {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
        <span>👥</span>
        <span>Shared</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
      <span>👥</span>
      <span>{sharedBy ? `by ${sharedBy}` : 'Shared'}</span>
    </span>
  );
}
