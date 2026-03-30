import mongoose from 'mongoose';

const MOODS = ['loved', 'happy', 'neutral', 'confused', 'sad'];
const STATUSES = ['open', 'reviewed', 'resolved'];

const feedbackSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    mood: {
      type: String,
      enum: MOODS,
      required: [true, 'Mood is required'],
    },
    message: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },
    page: {
      type: String,
      trim: true,
      maxlength: 200,
      default: '',
    },
    status: {
      type: String,
      enum: STATUSES,
      default: 'open',
    },
  },
  { timestamps: true }
);

feedbackSchema.index({ status: 1, createdAt: -1 });

export { MOODS, STATUSES };
export default mongoose.model('Feedback', feedbackSchema);
