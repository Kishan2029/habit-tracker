import crypto from 'crypto';
import User from '../models/User.js';
import emailService from './emailService.js';
import AppError from '../utils/AppError.js';

class EmailVerificationService {
  generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  hashCode(code) {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  async sendVerification(userId) {
    const user = await User.findById(userId);
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
    await user.save({ validateBeforeSave: false });

    await emailService.sendEmailVerificationEmail(user.email, user.name, code);

    return { message: 'Verification code sent' };
  }

  async verifyEmail(userId, code) {
    const user = await User.findById(userId).select('+emailVerificationCode +emailVerificationExpires');
    if (!user) throw new AppError('User not found', 404);

    if (user.emailVerified) {
      throw new AppError('Email is already verified', 400);
    }

    if (!user.emailVerificationCode || !user.emailVerificationExpires) {
      throw new AppError('No verification code found. Please request a new one.', 400);
    }

    if (Date.now() > user.emailVerificationExpires) {
      user.emailVerificationCode = undefined;
      user.emailVerificationExpires = undefined;
      await user.save({ validateBeforeSave: false });
      throw new AppError('Verification code has expired. Please request a new one.', 400);
    }

    const hashedCode = this.hashCode(code);
    if (hashedCode !== user.emailVerificationCode) {
      throw new AppError('Invalid verification code', 400);
    }

    user.emailVerified = true;
    user.emailVerificationCode = undefined;
    user.emailVerificationExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return { message: 'Email verified successfully' };
  }
}

export default new EmailVerificationService();
