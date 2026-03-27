export const CATEGORIES = [
  { value: 'health', label: 'Health', icon: '\u{1F48A}', color: '#10B981' },
  { value: 'fitness', label: 'Fitness', icon: '\u{1F4AA}', color: '#F59E0B' },
  { value: 'learning', label: 'Learning', icon: '\u{1F4DA}', color: '#6366F1' },
  { value: 'work', label: 'Work', icon: '\u{1F4BC}', color: '#3B82F6' },
  { value: 'mindfulness', label: 'Mindfulness', icon: '\u{1F9D8}', color: '#8B5CF6' },
  { value: 'social', label: 'Social', icon: '\u{1F91D}', color: '#EC4899' },
  { value: 'finance', label: 'Finance', icon: '\u{1F4B0}', color: '#14B8A6' },
  { value: 'other', label: 'Other', icon: '\u{1F3AF}', color: '#6B7280' },
];

export function getCategoryConfig(value) {
  return CATEGORIES.find((c) => c.value === value) || CATEGORIES[CATEGORIES.length - 1];
}
