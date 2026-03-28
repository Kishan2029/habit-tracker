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

  _escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ─── Shared email wrapper ─────────────────────────────────────────────

  _wrap(content) {
    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #6366f1; margin: 0;">Habit Tracker</h2>
        </div>
        ${content}
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
          You received this email because you have an account on Habit Tracker.<br/>
          If you didn't perform this action, please secure your account immediately.
        </p>
      </div>
    `;
  }

  async _send(to, subject, html, fallbackLabel) {
    if (!this.isConfigured) {
      console.log(`[Email Fallback] ${fallbackLabel} → ${to}`);
      return;
    }
    await this.transporter.sendMail({
      from: env.emailFrom,
      to,
      subject,
      html: this._wrap(html),
    });
  }

  // ─── Welcome Email (on registration) ─────────────────────────────────

  async sendWelcomeEmail(email, name) {
    const loginUrl = `${env.clientUrl}/login`;
    const html = `
      <h3 style="color: #111827; margin-top: 0;">Welcome, ${this._escapeHtml(name)}!</h3>
      <p style="color: #374151; line-height: 1.6;">
        Your Habit Tracker account has been created successfully. Start building
        positive habits and track your daily progress.
      </p>
      <p style="color: #374151; line-height: 1.6;">Here are some tips to get started:</p>
      <ul style="color: #374151; line-height: 1.8; padding-left: 20px;">
        <li>Create your first habit from the Habits page</li>
        <li>Log your progress daily from the Today view</li>
        <li>Check your streaks and analytics to stay motivated</li>
      </ul>
      <a href="${loginUrl}" style="display: inline-block; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 16px 0;">
        Get Started
      </a>
    `;
    await this._send(email, 'Welcome to Habit Tracker!', html, 'Welcome email');
  }

  // ─── Password Reset Request ───────────────────────────────────────────

  async sendPasswordResetEmail(email, resetToken) {
    const resetUrl = `${env.clientUrl}/reset-password?token=${resetToken}`;
    const html = `
      <h3 style="color: #111827; margin-top: 0;">Password Reset Request</h3>
      <p style="color: #374151; line-height: 1.6;">
        We received a request to reset your password. Click the button below to set a new password:
      </p>
      <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 16px 0;">
        Reset Password
      </a>
      <p style="color: #6b7280; font-size: 14px;">
        This link expires in <strong>30 minutes</strong>. If you didn't request this, you can safely ignore this email.
      </p>
    `;

    if (!this.isConfigured) {
      console.log(`[Email Fallback] Password reset email for ${email} (token not logged for security)`);
      return;
    }

    await this.transporter.sendMail({
      from: env.emailFrom,
      to: email,
      subject: 'Reset your Habit Tracker password',
      html: this._wrap(html),
    });
  }

  // ─── Password Reset Confirmation ─────────────────────────────────────

  async sendPasswordResetConfirmationEmail(email, name) {
    const html = `
      <h3 style="color: #111827; margin-top: 0;">Password Reset Successful</h3>
      <p style="color: #374151; line-height: 1.6;">
        Hi ${this._escapeHtml(name)}, your password has been successfully reset. You can now log in with your new password.
      </p>
      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
        <p style="color: #92400e; font-size: 14px; margin: 0;">
          <strong>Didn't reset your password?</strong> If you didn't make this change, your account may be compromised. Please reset your password immediately or contact support.
        </p>
      </div>
      <a href="${env.clientUrl}/login" style="display: inline-block; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 16px 0;">
        Log In
      </a>
    `;
    await this._send(email, 'Your password has been reset', html, 'Password reset confirmation');
  }

  // ─── Password Changed (from Settings) ────────────────────────────────

  async sendPasswordChangedEmail(email, name) {
    const html = `
      <h3 style="color: #111827; margin-top: 0;">Password Changed</h3>
      <p style="color: #374151; line-height: 1.6;">
        Hi ${this._escapeHtml(name)}, your Habit Tracker password was changed successfully from your account settings.
      </p>
      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
        <p style="color: #92400e; font-size: 14px; margin: 0;">
          <strong>Didn't change your password?</strong> If you didn't make this change, please reset your password immediately using the forgot password flow.
        </p>
      </div>
      <p style="color: #6b7280; font-size: 14px;">
        Time: ${new Date().toUTCString()}
      </p>
    `;
    await this._send(email, 'Your Habit Tracker password was changed', html, 'Password changed');
  }
}

export default new EmailService();
