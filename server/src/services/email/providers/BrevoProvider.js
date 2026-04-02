import { BrevoClient } from '@getbrevo/brevo';

export default class BrevoProvider {
  constructor(apiKey) {
    this.client = new BrevoClient({ token: apiKey });
  }

  get name() {
    return 'brevo';
  }

  _parseSender(from) {
    const match = from.match(/^(.+?)\s*<(.+?)>$/);
    if (match) {
      return { name: match[1].trim(), email: match[2].trim() };
    }
    return { email: from };
  }

  async send({ from, to, subject, html }) {
    const sender = this._parseSender(from);
    const result = await this.client.transactionalEmails.sendTransacEmail({
      sender,
      to: [{ email: to }],
      subject,
      htmlContent: html,
    });

    return { messageId: result.messageId };
  }
}
