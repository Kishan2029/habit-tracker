import { useState, useEffect } from 'react';
import Button from '../ui/Button';
import ColorPicker from './ColorPicker';
import EmojiPicker from './EmojiPicker';
import FrequencyPicker from './FrequencyPicker';
import CategoryPicker from './CategoryPicker';

const defaultForm = {
  name: '',
  type: 'boolean',
  unit: '',
  target: 1,
  color: '#6366f1',
  icon: '\u{1F3AF}',
  frequency: [0, 1, 2, 3, 4, 5, 6],
  category: 'other',
};

export default function HabitForm({ habit, initialValues, onSubmit, onCancel, isLoading }) {
  const [form, setForm] = useState(defaultForm);

  useEffect(() => {
    if (habit) {
      setForm({
        name: habit.name || '',
        type: habit.type || 'boolean',
        unit: habit.unit || '',
        target: habit.target || 1,
        color: habit.color || '#6366f1',
        icon: habit.icon || '\u{1F3AF}',
        frequency: habit.frequency || [0, 1, 2, 3, 4, 5, 6],
        category: habit.category || 'other',
      });
    } else if (initialValues) {
      setForm({ ...defaultForm, ...initialValues });
    } else {
      // Reset to defaults when opening for create (no habit passed)
      setForm({ ...defaultForm });
    }
  }, [habit, initialValues]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSubmit({ ...form, name: form.name.trim() });
  };

  const updateField = (field, value) => {
    setForm((prev) => {
      const updated = { ...prev, [field]: value };
      // Clear unit/target when switching from count to boolean
      if (field === 'type' && value === 'boolean') {
        updated.unit = '';
        updated.target = 1;
      }
      return updated;
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Habit Name
        </label>
        <input
          type="text"
          required
          maxLength={100}
          value={form.name}
          onChange={(e) => updateField('name', e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
          placeholder="e.g., Morning Gym, Read 30 pages"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Type
        </label>
        <div className="flex gap-2">
          {['boolean', 'count'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => updateField('type', t)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition border ${
                form.type === t
                  ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {t === 'boolean' ? 'Yes / No' : 'Count'}
            </button>
          ))}
        </div>
      </div>

      {form.type === 'count' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Target
            </label>
            <input
              type="number"
              min={1}
              required
              value={form.target}
              onChange={(e) => updateField('target', parseInt(e.target.value, 10) || 1)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Unit
            </label>
            <input
              type="text"
              value={form.unit}
              onChange={(e) => updateField('unit', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
              placeholder="e.g., pages, glasses"
            />
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Category
        </label>
        <CategoryPicker value={form.category} onChange={(v) => updateField('category', v)} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Icon
        </label>
        <EmojiPicker value={form.icon} onChange={(v) => updateField('icon', v)} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Color
        </label>
        <ColorPicker value={form.color} onChange={(v) => updateField('color', v)} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Frequency
        </label>
        <FrequencyPicker value={form.frequency} onChange={(v) => updateField('frequency', v)} />
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isLoading} className="flex-1">
          {isLoading ? 'Saving...' : habit ? 'Update Habit' : 'Create Habit'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
