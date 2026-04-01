import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import AppError from '../utils/AppError.js';
import env from '../config/env.js';
import emailService from './emailService.js';

class AuthService {
  generateToken(userId) {
    return jwt.sign({ id: userId }, env.jwtSecret, {
      expiresIn: env.jwtExpiresIn,
    });
  }

  async register({ name, email, password }) {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new AppError('Email already in use', 400);
    }

    const user = await User.create({
      name,
      email,
      passwordHash: password,
    });

    const token = this.generateToken(user._id);

    // Send welcome email (non-blocking)
    emailService.sendWelcomeEmail(user.email, user.name).catch((err) => {
      console.error('[Email] Failed to send welcome email:', err.message);
    });

    const userObj = user.toJSON();
    return {
      user: {
        _id: userObj._id,
        name: userObj.name,
        email: userObj.email,
        role: userObj.role,
        avatar: userObj.avatar,
        settings: userObj.settings,
        createdAt: userObj.createdAt,
      },
      token,
    };
  }

  async login({ email, password }) {
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new AppError('Invalid email or password', 401);
    }

    const token = this.generateToken(user._id);

    const userObj = user.toJSON();
    return {
      user: {
        _id: userObj._id,
        name: userObj.name,
        email: userObj.email,
        role: userObj.role,
        avatar: userObj.avatar,
        settings: userObj.settings,
        createdAt: userObj.createdAt,
      },
      token,
    };
  }
  async forgotPassword(email) {
    const user = await User.findOne({ email });
    if (!user) {
      return { resetToken: null };
    }

    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    try {
      await emailService.sendPasswordResetEmail(email, resetToken);
    } catch (err) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save({ validateBeforeSave: false });
      throw new AppError('There was an error sending the email. Try again later.', 500);
    }

    return { resetToken };
  }

  async resetPassword(token, newPassword) {
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      throw new AppError('Token is invalid or has expired', 400);
    }

    user.passwordHash = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.passwordChangedAt = new Date();
    await user.save();

    // Send password reset confirmation email (non-blocking)
    emailService.sendPasswordResetConfirmationEmail(user.email, user.name).catch((err) => {
      console.error('[Email] Failed to send reset confirmation email:', err.message);
    });

    return { message: 'Password reset successful' };
  }

  async changePassword(userId, { currentPassword, newPassword }) {
    const user = await User.findById(userId).select('+passwordHash');
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      throw new AppError('Current password is incorrect', 401);
    }

    if (currentPassword === newPassword) {
      throw new AppError('New password must be different from current password', 400);
    }

    user.passwordHash = newPassword;
    user.passwordChangedAt = new Date();
    await user.save();

    // Send password changed notification email (non-blocking)
    emailService.sendPasswordChangedEmail(user.email, user.name).catch((err) => {
      console.error('[Email] Failed to send password changed email:', err.message);
    });

    return { message: 'Password changed successfully', token: this.generateToken(user._id) };
  }
}

export default new AuthService();
