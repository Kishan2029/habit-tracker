import mongoose from 'mongoose';

const streakFreezeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    habitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Habit',
      required: true,
    },
    date: {
      type: String, // YYYY-MM-DD
      required: true,
    },
    month: {
      type: String, // YYYY-MM (for counting monthly usage)
      required: true,
    },
  },
  { timestamps: true }
);

streakFreezeSchema.index({ userId: 1, habitId: 1, date: 1 }, { unique: true });
streakFreezeSchema.index({ userId: 1, month: 1 });

export default mongoose.model('StreakFreeze', streakFreezeSchema);
