export const HABIT_TEMPLATES = [
  // Health
  { name: 'Drink Water', type: 'count', unit: 'glasses', target: 8, icon: '\u{1F4A7}', color: '#10B981', category: 'health', description: 'Stay hydrated throughout the day', difficulty: 'Easy' },
  { name: 'Take Vitamins', type: 'boolean', icon: '\u{1F48A}', color: '#10B981', category: 'health', description: 'Daily supplement routine', difficulty: 'Easy' },
  { name: 'Sleep 8 Hours', type: 'boolean', icon: '\u{1F634}', color: '#6366F1', category: 'health', description: 'Consistent sleep schedule', difficulty: 'Medium' },

  // Fitness
  { name: 'Morning Run', type: 'count', unit: 'km', target: 5, icon: '\u{1F3C3}', color: '#F59E0B', category: 'fitness', description: '5 km daily run', difficulty: 'Hard' },
  { name: 'Workout', type: 'count', unit: 'minutes', target: 45, icon: '\u{1F4AA}', color: '#EF4444', category: 'fitness', description: '45 min exercise session', difficulty: 'Medium' },
  { name: 'Push-ups', type: 'count', unit: 'reps', target: 50, icon: '\u{1F9B5}', color: '#F59E0B', category: 'fitness', description: '50 reps daily', difficulty: 'Medium' },
  { name: 'Stretching', type: 'boolean', icon: '\u{1F9D8}', color: '#8B5CF6', category: 'fitness', description: '10 min flexibility routine', difficulty: 'Easy' },

  // Learning
  { name: 'Read', type: 'count', unit: 'pages', target: 30, icon: '\u{1F4D6}', color: '#6366F1', category: 'learning', description: '30 pages per day', difficulty: 'Medium' },
  { name: 'Practice Language', type: 'count', unit: 'minutes', target: 15, icon: '\u{1F30D}', color: '#14B8A6', category: 'learning', description: '15 min daily practice', difficulty: 'Easy' },
  { name: 'Online Course', type: 'count', unit: 'minutes', target: 30, icon: '\u{1F393}', color: '#6366F1', category: 'learning', description: '30 min of coursework', difficulty: 'Medium' },

  // Work
  { name: 'Deep Work', type: 'count', unit: 'hours', target: 4, icon: '\u{1F4BB}', color: '#3B82F6', category: 'work', description: '4 hours focused work', difficulty: 'Hard' },
  { name: 'No Social Media at Work', type: 'boolean', icon: '\u{1F6AB}', color: '#EF4444', category: 'work', description: 'Stay focused during work hours', difficulty: 'Medium' },
  { name: 'Plan Tomorrow', type: 'boolean', icon: '\u{1F4CB}', color: '#3B82F6', category: 'work', description: '5 min evening planning', difficulty: 'Easy' },

  // Mindfulness
  { name: 'Meditate', type: 'count', unit: 'minutes', target: 10, icon: '\u{1F9D8}', color: '#8B5CF6', category: 'mindfulness', description: '10 min daily meditation', difficulty: 'Easy' },
  { name: 'Journal', type: 'boolean', icon: '\u{1F4DD}', color: '#EC4899', category: 'mindfulness', description: 'Write your thoughts daily', difficulty: 'Easy' },
  { name: 'Gratitude Log', type: 'boolean', icon: '\u{1F64F}', color: '#8B5CF6', category: 'mindfulness', description: 'List 3 things you\'re grateful for', difficulty: 'Easy' },

  // Social
  { name: 'Call a Friend', type: 'boolean', icon: '\u{1F4DE}', color: '#EC4899', category: 'social', description: 'Stay connected with loved ones', difficulty: 'Easy' },
  { name: 'Family Time', type: 'count', unit: 'minutes', target: 30, icon: '\u{1F46A}', color: '#EC4899', category: 'social', description: '30 min quality time', difficulty: 'Easy' },

  // Finance
  { name: 'No Unnecessary Spending', type: 'boolean', icon: '\u{1F4B0}', color: '#14B8A6', category: 'finance', description: 'Mindful spending habits', difficulty: 'Medium' },
  { name: 'Track Expenses', type: 'boolean', icon: '\u{1F4CA}', color: '#14B8A6', category: 'finance', description: '5 min daily expense logging', difficulty: 'Easy' },
];
