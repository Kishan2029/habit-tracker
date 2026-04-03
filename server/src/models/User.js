import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { ROLES } from '../config/constants.js';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: [true, 'Password is required'],
      select: false,
    },
    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.USER,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationCode: {
      type: String,
      select: false,
    },
    emailVerificationExpires: {
      type: Date,
      select: false,
    },
    emailVerificationAttempts: {
      type: Number,
      default: 0,
      select: false,
    },
    settings: {
      theme: {
        type: String,
        enum: ['light', 'dark', 'system'],
        default: 'system',
      },
      timezone: {
        type: String,
        default: 'UTC',
      },
      notifications: {
        dailyReminders: {
          push: { type: Boolean, default: true },
          email: { type: Boolean, default: false },
        },
        streakMilestones: {
          push: { type: Boolean, default: true },
          email: { type: Boolean, default: true },
        },
        missedAlerts: {
          push: { type: Boolean, default: true },
          email: { type: Boolean, default: false },
        },
        sharedActivity: {
          push: { type: Boolean, default: true },
          email: { type: Boolean, default: false },
        },
        goalCompletion: {
          push: { type: Boolean, default: true },
          email: { type: Boolean, default: true },
        },
        weeklySummary: {
          push: { type: Boolean, default: true },
          email: { type: Boolean, default: false },
        },
      },
      reminderTime: {
        type: String,
        default: '08:00',
      },
    },
    avatar: {
      url: { type: String, default: '' },
      publicId: { type: String, default: '' },
    },
    passwordChangedAt: Date,
    resetPasswordToken: String,
    resetPasswordExpires: Date,
  },
  { timestamps: true }
);

userSchema.pre('save', async function () {
  if (!this.isModified('passwordHash')) return;
  this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  this.resetPasswordExpires = Date.now() + 30 * 60 * 1000; // 30 minutes
  return resetToken;
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpires;
  delete obj.emailVerificationCode;
  delete obj.emailVerificationExpires;
  delete obj.emailVerificationAttempts;
  return obj;
};

export default mongoose.model('User', userSchema);
