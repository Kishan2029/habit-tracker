import mongoose from 'mongoose';
import { HABIT_TYPES, HABIT_CATEGORIES, DEFAULT_HABIT_COLOR, DEFAULT_HABIT_ICON, ALL_DAYS } from '../config/constants.js';

const habitSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Habit name is required'],
      trim: true,
      maxlength: 100,
    },
    type: {
      type: String,
      enum: Object.values(HABIT_TYPES),
      default: HABIT_TYPES.BOOLEAN,
    },
    unit: {
      type: String,
      default: '',
      trim: true,
    },
    target: {
      type: Number,
      default: 1,
      min: 1,
    },
    color: {
      type: String,
      default: DEFAULT_HABIT_COLOR,
    },
    icon: {
      type: String,
      default: DEFAULT_HABIT_ICON,
    },
    frequency: {
      type: [Number],
      default: ALL_DAYS,
      validate: {
        validator: (arr) => arr.every((d) => d >= 0 && d <= 6),
        message: 'Frequency days must be between 0 (Sunday) and 6 (Saturday)',
      },
    },
    category: {
      type: String,
      enum: Object.values(HABIT_CATEGORIES),
      default: HABIT_CATEGORIES.OTHER,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
    currentStreak: {
      type: Number,
      default: 0,
    },
    longestStreak: {
      type: Number,
      default: 0,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

habitSchema.index({ userId: 1, isArchived: 1 });
habitSchema.index({ userId: 1, sortOrder: 1 });
habitSchema.index({ userId: 1, category: 1 });

export default mongoose.model('Habit', habitSchema);
