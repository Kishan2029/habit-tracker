export const HABIT_TEMPLATES = [
  // Health
  { name: 'Drink Water', type: 'count', unit: 'glasses', target: 8, icon: '\u{1F4A7}', color: '#10B981', category: 'health' },
  { name: 'Take Vitamins', type: 'boolean', icon: '\u{1F48A}', color: '#10B981', category: 'health' },
  { name: 'Sleep 8 Hours', type: 'boolean', icon: '\u{1F634}', color: '#6366F1', category: 'health' },

  // Fitness
  { name: 'Morning Run', type: 'count', unit: 'km', target: 5, icon: '\u{1F3C3}', color: '#F59E0B', category: 'fitness' },
  { name: 'Workout', type: 'count', unit: 'minutes', target: 45, icon: '\u{1F4AA}', color: '#EF4444', category: 'fitness' },
  { name: 'Push-ups', type: 'count', unit: 'reps', target: 50, icon: '\u{1F9B5}', color: '#F59E0B', category: 'fitness' },
  { name: 'Stretching', type: 'boolean', icon: '\u{1F9D8}', color: '#8B5CF6', category: 'fitness' },

  // Learning
  { name: 'Read', type: 'count', unit: 'pages', target: 30, icon: '\u{1F4D6}', color: '#6366F1', category: 'learning' },
  { name: 'Practice Language', type: 'count', unit: 'minutes', target: 15, icon: '\u{1F30D}', color: '#14B8A6', category: 'learning' },
  { name: 'Online Course', type: 'count', unit: 'minutes', target: 30, icon: '\u{1F393}', color: '#6366F1', category: 'learning' },

  // Work
  { name: 'Deep Work', type: 'count', unit: 'hours', target: 4, icon: '\u{1F4BB}', color: '#3B82F6', category: 'work' },
  { name: 'No Social Media at Work', type: 'boolean', icon: '\u{1F6AB}', color: '#EF4444', category: 'work' },
  { name: 'Plan Tomorrow', type: 'boolean', icon: '\u{1F4CB}', color: '#3B82F6', category: 'work' },

  // Mindfulness
  { name: 'Meditate', type: 'count', unit: 'minutes', target: 10, icon: '\u{1F9D8}', color: '#8B5CF6', category: 'mindfulness' },
  { name: 'Journal', type: 'boolean', icon: '\u{1F4DD}', color: '#EC4899', category: 'mindfulness' },
  { name: 'Gratitude Log', type: 'boolean', icon: '\u{1F64F}', color: '#8B5CF6', category: 'mindfulness' },

  // Social
  { name: 'Call a Friend', type: 'boolean', icon: '\u{1F4DE}', color: '#EC4899', category: 'social' },
  { name: 'Family Time', type: 'count', unit: 'minutes', target: 30, icon: '\u{1F46A}', color: '#EC4899', category: 'social' },

  // Finance
  { name: 'No Unnecessary Spending', type: 'boolean', icon: '\u{1F4B0}', color: '#14B8A6', category: 'finance' },
  { name: 'Track Expenses', type: 'boolean', icon: '\u{1F4CA}', color: '#14B8A6', category: 'finance' },
];
