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
      console.log('[Email] SMTP configured successfully');
    } else {
      console.log('[Email] SMTP not configured — emails will be logged to console only. Set SMTP_HOST, SMTP_USER, SMTP_PASS to enable.');
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

  // ─── Shared Habit Invite ─────────────────────────────────────────

  async sendHabitInviteEmail(email, inviteeName, inviterName, habitName, inviteCode) {
    const joinUrl = `${env.clientUrl}/join/${inviteCode}`;
    const html = `
      <h3 style="color: #111827; margin-top: 0;">You're Invited!</h3>
      <p style="color: #374151; line-height: 1.6;">
        Hi ${this._escapeHtml(inviteeName)}, <strong>${this._escapeHtml(inviterName)}</strong> has invited you to join the shared habit
        <strong>"${this._escapeHtml(habitName)}"</strong> on Habit Tracker.
      </p>
      <p style="color: #374151; line-height: 1.6;">
        Track this habit together, stay accountable, and see each other's progress!
      </p>
      <a href="${joinUrl}" style="display: inline-block; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 16px 0;">
        Accept Invite
      </a>
      <p style="color: #6b7280; font-size: 14px;">
        Or log into your account and check the Shared Habits page to accept the invite.
      </p>
    `;
    await this._send(email, `${this._escapeHtml(inviterName)} invited you to "${this._escapeHtml(habitName)}" on Habit Tracker`, html, 'Habit invite');
  }

  // ─── Feedback Notification (to admin) ────────────────────────────────

  async sendFeedbackNotification(userName, userEmail, mood, message, page) {
    const adminEmail = env.adminEmail;
    if (!adminEmail) {
      console.log(`[Email Fallback] Feedback notification skipped — ADMIN_EMAIL not configured. Feedback from ${userName} (${mood}) saved to database.`);
      return;
    }

    const safeName = this._escapeHtml(userName);
    const safeEmail = this._escapeHtml(userEmail);
    const safePage = this._escapeHtml(page);
    const safeMessage = this._escapeHtml(message);

    const moodEmojis = { loved: '\u{1F60D}', happy: '\u{1F60A}', neutral: '\u{1F610}', confused: '\u{1F615}', sad: '\u{1F622}' };
    const moodEmoji = moodEmojis[mood] || mood;

    const html = `
      <h3 style="color: #111827; margin-top: 0;">New Feedback Received</h3>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr>
          <td style="padding: 8px 12px; color: #6b7280; font-size: 14px; width: 80px;">From</td>
          <td style="padding: 8px 12px; color: #374151; font-weight: 600;">${safeName} (${safeEmail})</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; color: #6b7280; font-size: 14px;">Mood</td>
          <td style="padding: 8px 12px; font-size: 20px;">${moodEmoji} ${mood}</td>
        </tr>
        ${page ? `<tr><td style="padding: 8px 12px; color: #6b7280; font-size: 14px;">Page</td><td style="padding: 8px 12px; color: #374151;">${safePage}</td></tr>` : ''}
        ${message ? `<tr><td style="padding: 8px 12px; color: #6b7280; font-size: 14px; vertical-align: top;">Message</td><td style="padding: 8px 12px; color: #374151; line-height: 1.6;">${safeMessage}</td></tr>` : ''}
      </table>
      <p style="color: #9ca3af; font-size: 12px;">
        Submitted at ${new Date().toUTCString()}
      </p>
    `;

    await this._send(adminEmail, `Feedback: ${moodEmoji} from ${safeName}`, html, 'Feedback notification');
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
