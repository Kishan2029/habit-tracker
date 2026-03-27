const EMOJIS = [
  '🎯', '💪', '📚', '🏃',
  '🧘', '💧', '🍎', '😴',
  '✍️', '🎵', '💻', '🎨',
  '🌟', '❤️', '🧠', '🏋️',
  '🚴', '🍳', '💰', '🌱',
  '☕', '📱', '🎮', '🚶',
];

export default function EmojiPicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-8 gap-1">
      {EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onChange(emoji)}
          className={`w-9 h-9 flex items-center justify-center rounded-lg text-lg transition ${
            value === emoji
              ? 'bg-indigo-100 dark:bg-indigo-900/30 ring-2 ring-indigo-500'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
