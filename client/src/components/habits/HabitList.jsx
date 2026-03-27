import { useState, useEffect, useCallback } from 'react';
import { getHabits, createHabit, updateHabit, archiveHabit, unarchiveHabit, deleteHabit, reorderHabits } from '../../api/habitApi';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import SortableHabitCard from './SortableHabitCard';
import HabitForm from './HabitForm';
import ShareHabitModal from './ShareHabitModal';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import EmptyState from '../ui/EmptyState';
import LoadingSpinner from '../ui/LoadingSpinner';
import { CATEGORIES } from '../../config/categories';
import toast from 'react-hot-toast';

export default function HabitList() {
  const [habits, setHabits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingHabit, setEditingHabit] = useState(null);
  const [saving, setSaving] = useState(false);
  const [sharingHabit, setSharingHabit] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const fetchHabits = useCallback(async () => {
    try {
      const { data } = await getHabits(showArchived, categoryFilter || undefined);
      setHabits(data.data.habits);
    } catch (err) {
      toast.error('Failed to load habits');
    } finally {
      setLoading(false);
    }
  }, [showArchived, categoryFilter]);

  useEffect(() => {
    fetchHabits();
  }, [fetchHabits]);

  const handleCreate = async (formData) => {
    setSaving(true);
    try {
      await createHabit(formData);
      toast.success('Habit created!');
      setShowForm(false);
      fetchHabits();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create habit');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (formData) => {
    setSaving(true);
    try {
      await updateHabit(editingHabit._id, formData);
      toast.success('Habit updated!');
      setEditingHabit(null);
      fetchHabits();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update habit');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (habit) => {
    try {
      if (habit.isArchived) {
        await unarchiveHabit(habit._id);
        toast.success('Habit unarchived!');
      } else {
        await archiveHabit(habit._id);
        toast.success('Habit archived!');
      }
      fetchHabits();
    } catch (err) {
      toast.error('Failed to update habit');
    }
  };

  const handleDelete = async (habit) => {
    if (!window.confirm(`Delete "${habit.name}"? This will remove all associated logs.`)) {
      return;
    }
    try {
      await deleteHabit(habit._id);
      toast.success('Habit deleted!');
      fetchHabits();
    } catch (err) {
      toast.error('Failed to delete habit');
    }
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = habits.findIndex((h) => h._id === active.id);
    const newIndex = habits.findIndex((h) => h._id === over.id);
    const reordered = arrayMove(habits, oldIndex, newIndex);
    setHabits(reordered);

    const items = reordered.map((h, i) => ({ id: h._id, sortOrder: i }));
    try {
      await reorderHabits(items);
    } catch {
      toast.error('Failed to reorder');
      fetchHabits();
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Habits</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
            />
            Show archived
          </label>
          <Button onClick={() => setShowForm(true)}>
            + New Habit
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setCategoryFilter('')}
          className={`px-3 py-1 rounded-full text-xs font-medium transition ${
            !categoryFilter
              ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          All
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setCategoryFilter(cat.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition ${
              categoryFilter === cat.value
                ? 'text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
            style={categoryFilter === cat.value ? { backgroundColor: cat.color } : {}}
          >
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      {habits.length === 0 ? (
        <EmptyState
          icon={'\u{1F331}'}
          title="No habits yet"
          description="Create your first habit to start tracking your daily progress!"
          actionLabel="Create Habit"
          onAction={() => setShowForm(true)}
        />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={habits.map((h) => h._id)} strategy={verticalListSortingStrategy}>
            <div className="grid gap-3 sm:grid-cols-2">
              {habits.map((habit) => (
                <SortableHabitCard
                  key={habit._id}
                  habit={habit}
                  onEdit={(h) => setEditingHabit(h)}
                  onArchive={handleArchive}
                  onDelete={handleDelete}
                  onShare={(h) => setSharingHabit(h)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title="Create New Habit"
      >
        <HabitForm
          onSubmit={handleCreate}
          onCancel={() => setShowForm(false)}
          isLoading={saving}
        />
      </Modal>

      <Modal
        isOpen={!!editingHabit}
        onClose={() => setEditingHabit(null)}
        title="Edit Habit"
      >
        {editingHabit && (
          <HabitForm
            habit={editingHabit}
            onSubmit={handleUpdate}
            onCancel={() => setEditingHabit(null)}
            isLoading={saving}
          />
        )}
      </Modal>

      {sharingHabit && (
        <ShareHabitModal
          habit={sharingHabit}
          onClose={() => setSharingHabit(null)}
        />
      )}
    </div>
  );
}
