import mongoose from 'mongoose';

const habitLogSchema = new mongoose.Schema(
  {
    habitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Habit',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    notes: {
      type: String,
      maxlength: 500,
      default: '',
    },
  },
  { timestamps: true }
);

habitLogSchema.index({ habitId: 1, userId: 1, date: 1 }, { unique: true });
habitLogSchema.index({ userId: 1, date: 1 });
habitLogSchema.index({ habitId: 1, date: 1, value: 1 });

export default mongoose.model('HabitLog', habitLogSchema);
