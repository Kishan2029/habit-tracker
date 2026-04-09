export function getHabitCreatedDateString(createdAt, createdDate) {
  // Prefer createdDate (local YYYY-MM-DD) over createdAt (UTC timestamp)
  if (createdDate) return createdDate;
  if (!createdAt) return null;

  if (typeof createdAt === 'string') {
    return createdAt.slice(0, 10);
  }

  return new Date(createdAt).toISOString().slice(0, 10);
}

export function wasHabitCreatedOnOrBefore(createdAt, dateStr, createdDate) {
  const created = getHabitCreatedDateString(createdAt, createdDate);
  return !created || dateStr >= created;
}
