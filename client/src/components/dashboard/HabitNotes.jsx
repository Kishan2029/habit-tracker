import { useState, useEffect } from 'react';

const MAX_LENGTH = 500;

export default function HabitNotes({ notes, onSave }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(notes || '');

  // Sync text with parent when not editing (e.g. after silentRefresh)
  useEffect(() => {
    if (!editing) setText(notes || '');
  }, [notes, editing]);

  const handleSave = () => {
    onSave(text.trim());
    setEditing(false);
  };

  const handleCancel = () => {
    setText(notes || '');
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition mt-1"
        title={notes ? 'Edit note' : 'Add a note'}
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
        {notes ? (
          <span className="truncate max-w-[200px]">{notes}</span>
        ) : (
          <span>Add note</span>
        )}
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-1.5">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, MAX_LENGTH))}
        placeholder="Add a note about today's progress..."
        rows={2}
        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
        autoFocus
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">{text.length}/{MAX_LENGTH}</span>
        <div className="flex gap-1.5">
          <button
            onClick={handleCancel}
            className="px-2 py-0.5 text-xs rounded text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-2 py-0.5 text-xs rounded bg-indigo-600 text-white hover:bg-indigo-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
