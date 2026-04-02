import { Resend } from 'resend';

export default class ResendProvider {
  constructor(apiKey) {
    this.client = new Resend(apiKey);
  }

  get name() {
    return 'resend';
  }

  async send({ from, to, subject, html }) {
    const { data, error } = await this.client.emails.send({
      from,
      to,
      subject,
      html,
    });

    if (error) {
      throw new Error(error.message);
    }

    return { messageId: data.id };
  }
}
