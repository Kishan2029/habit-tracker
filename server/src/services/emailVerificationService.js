import crypto from 'crypto';
import User from '../models/User.js';
import emailService from './emailService.js';
import AppError from '../utils/AppError.js';

class EmailVerificationService {
  generateCode() {
    return crypto.randomInt(100000, 999999).toString();
  }

  hashCode(code) {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  async sendVerification(userId) {
    const user = await User.findById(userId).select('+emailVerificationExpires');
    if (!user) throw new AppError('User not found', 404);

    if (user.emailVerified) {
      throw new AppError('Email is already verified', 400);
    }

    // Rate limit: don't allow resend within 60 seconds
    if (user.emailVerificationExpires) {
      const expiresAt = new Date(user.emailVerificationExpires).getTime();
      const cooldownEnd = expiresAt - 9 * 60 * 1000; // 10min expiry minus 9min = 1min after send
      if (Date.now() < cooldownEnd) {
        throw new AppError('Please wait before requesting another code', 429);
      }
    }

    const code = this.generateCode();
    user.emailVerificationCode = this.hashCode(code);
    user.emailVerificationExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    user.emailVerificationAttempts = 0;
    await user.save({ validateBeforeSave: false });

    await emailService.sendEmailVerificationEmail(user.email, user.name, code);

    return { message: 'Verification code sent' };
  }

  async verifyEmail(userId, code) {
    const user = await User.findById(userId).select('+emailVerificationCode +emailVerificationExpires +emailVerificationAttempts');
    if (!user) throw new AppError('User not found', 404);

    if (user.emailVerified) {
      throw new AppError('Email is already verified', 400);
    }

    if (!user.emailVerificationCode || !user.emailVerificationExpires) {
      throw new AppError('No verification code found. Please request a new one.', 400);
    }

    // Brute-force protection: lock after 5 failed attempts
    if (user.emailVerificationAttempts >= 5) {
      user.emailVerificationCode = undefined;
      user.emailVerificationExpires = undefined;
      user.emailVerificationAttempts = 0;
      await user.save({ validateBeforeSave: false });
      throw new AppError('Too many failed attempts. Please request a new code.', 429);
    }

    if (Date.now() > user.emailVerificationExpires) {
      user.emailVerificationCode = undefined;
      user.emailVerificationExpires = undefined;
      user.emailVerificationAttempts = 0;
      await user.save({ validateBeforeSave: false });
      throw new AppError('Verification code has expired. Please request a new one.', 400);
    }

    const hashedCode = this.hashCode(code);
    if (hashedCode !== user.emailVerificationCode) {
      user.emailVerificationAttempts = (user.emailVerificationAttempts || 0) + 1;
      await user.save({ validateBeforeSave: false });
      throw new AppError('Invalid verification code', 400);
    }

    user.emailVerified = true;
    user.emailVerificationCode = undefined;
    user.emailVerificationExpires = undefined;
    user.emailVerificationAttempts = 0;
    await user.save({ validateBeforeSave: false });

    return { message: 'Email verified successfully' };
  }
}

export default new EmailVerificationService();
