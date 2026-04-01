export function getHabitCreatedDateString(createdAt) {
  if (!createdAt) return null;

  if (typeof createdAt === 'string') {
    return createdAt.slice(0, 10);
  }

  return new Date(createdAt).toISOString().slice(0, 10);
}

export function wasHabitCreatedOnOrBefore(createdAt, dateStr) {
  const createdDate = getHabitCreatedDateString(createdAt);
  return !createdDate || dateStr >= createdDate;
}
