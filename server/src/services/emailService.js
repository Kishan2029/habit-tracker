import env from '../config/env.js';
import { createEmailProvider } from './email/providerFactory.js';
import {
  buildFeedbackNotificationEmail,
  buildHabitInviteEmail,
  buildPasswordChangedEmail,
  buildPasswordResetConfirmationEmail,
  buildPasswordResetEmail,
  buildWelcomeEmail,
  escapeHtml,
  htmlToText,
  wrapEmailContent,
} from './email/templates.js';

class EmailService {
  constructor({ envConfig = env, provider = createEmailProvider(envConfig) } = {}) {
    this.env = envConfig;
    this.provider = provider;
  }

  get isConfigured() {
    return this.provider.isConfigured;
  }

  get providerKey() {
    return this.provider.key;
  }

  _escapeHtml(str) {
    return escapeHtml(str);
  }

  _wrap(content) {
    return wrapEmailContent(content);
  }

  async _send(to, subject, html, fallbackLabel, options = {}) {
    return this.provider.send({
      to,
      subject,
      html: this._wrap(html),
      text: options.text || htmlToText(html),
      replyTo: options.replyTo,
      label: fallbackLabel,
      requireDelivery: options.requireDelivery || false,
    });
  }

  async sendWelcomeEmail(email, name) {
    const template = buildWelcomeEmail({
      name,
      clientUrl: this.env.clientUrl,
    });
    await this._send(email, template.subject, template.html, template.label);
  }

  async sendPasswordResetEmail(email, resetToken) {
    const template = buildPasswordResetEmail({
      resetToken,
      clientUrl: this.env.clientUrl,
    });
    await this._send(email, template.subject, template.html, template.label, {
      requireDelivery: true,
    });
  }

  async sendPasswordResetConfirmationEmail(email, name) {
    const template = buildPasswordResetConfirmationEmail({
      name,
      clientUrl: this.env.clientUrl,
    });
    await this._send(email, template.subject, template.html, template.label);
  }

  async sendHabitInviteEmail(email, inviteeName, inviterName, habitName, inviteCode) {
    const template = buildHabitInviteEmail({
      inviteeName,
      inviterName,
      habitName,
      inviteCode,
      clientUrl: this.env.clientUrl,
    });
    await this._send(email, template.subject, template.html, template.label);
  }

  async sendFeedbackNotification(userName, userEmail, mood, message, page) {
    const adminEmail = this.env.adminEmail;
    if (!adminEmail) {
      console.log(`[Email:none] Feedback notification skipped — ADMIN_EMAIL not configured. Feedback from ${userName} (${mood}) saved to database.`);
      return;
    }

    const template = buildFeedbackNotificationEmail({
      userName,
      userEmail,
      mood,
      message,
      page,
    });
    await this._send(adminEmail, template.subject, template.html, template.label);
  }

  async sendPasswordChangedEmail(email, name) {
    const template = buildPasswordChangedEmail({ name });
    await this._send(email, template.subject, template.html, template.label);
  }
}

export { EmailService };
export default new EmailService();
