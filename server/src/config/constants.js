export const ROLES = {
  USER: 'user',
  PREMIUM: 'premium',
  ADMIN: 'admin',
};

export const HABIT_TYPES = {
  BOOLEAN: 'boolean',
  COUNT: 'count',
};

export const HABIT_CATEGORIES = {
  HEALTH: 'health',
  FITNESS: 'fitness',
  LEARNING: 'learning',
  WORK: 'work',
  MINDFULNESS: 'mindfulness',
  SOCIAL: 'social',
  FINANCE: 'finance',
  OTHER: 'other',
};

export const CATEGORY_DEFAULTS = {
  health: { icon: '\u{1F48A}', color: '#10B981', label: 'Health' },
  fitness: { icon: '\u{1F4AA}', color: '#F59E0B', label: 'Fitness' },
  learning: { icon: '\u{1F4DA}', color: '#6366F1', label: 'Learning' },
  work: { icon: '\u{1F4BC}', color: '#3B82F6', label: 'Work' },
  mindfulness: { icon: '\u{1F9D8}', color: '#8B5CF6', label: 'Mindfulness' },
  social: { icon: '\u{1F91D}', color: '#EC4899', label: 'Social' },
  finance: { icon: '\u{1F4B0}', color: '#14B8A6', label: 'Finance' },
  other: { icon: '\u{1F3AF}', color: '#6B7280', label: 'Other' },
};

export const MAX_BACKDATE_DAYS = 7;

export const DEFAULT_HABIT_COLOR = '#6366f1';
export const DEFAULT_HABIT_ICON = '\u{1F3AF}';
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
