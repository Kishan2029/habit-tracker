import nodemailer from 'nodemailer';
import env from '../config/env.js';

class EmailService {
  constructor() {
    this.isConfigured = !!(env.smtp.host && env.smtp.user && env.smtp.pass);

    if (this.isConfigured) {
      this.transporter = nodemailer.createTransport({
        host: env.smtp.host,
        port: env.smtp.port,
        secure: env.smtp.port === 465,
        auth: {
          user: env.smtp.user,
          pass: env.smtp.pass,
        },
      });
    }
  }

  async sendPasswordResetEmail(email, resetToken) {
    const resetUrl = `${env.clientUrl}/reset-password?token=${resetToken}`;

    if (!this.isConfigured) {
      console.log(`[Email Fallback] Password reset for ${email}`);
      console.log(`[Email Fallback] Reset URL: ${resetUrl}`);
      console.log(`[Email Fallback] Token: ${resetToken}`);
      return;
    }

    const html = `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #6366f1;">Habit Tracker</h2>
        <p>You requested a password reset. Click the button below to set a new password:</p>
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 16px 0;">
          Reset Password
        </a>
        <p style="color: #6b7280; font-size: 14px;">This link expires in 30 minutes. If you didn't request this, ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">Habit Tracker</p>
      </div>
    `;

    await this.transporter.sendMail({
      from: env.emailFrom,
      to: email,
      subject: 'Reset your Habit Tracker password',
      html,
    });
  }
}

export default new EmailService();
