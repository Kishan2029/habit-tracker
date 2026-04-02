import nodemailer from 'nodemailer';

export default class SmtpProvider {
  constructor({ host, port, user, pass }) {
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      family: 4,
    });

    this.transporter.verify()
      .then(() => console.log('[Email] SMTP connection verified — ready to send'))
      .catch((err) => console.error('[Email] SMTP connection verification FAILED:', err.message));
  }

  get name() {
    return 'smtp';
  }

  async send(message) {
    const info = await this.transporter.sendMail(message);
    return { messageId: info.messageId };
  }
}
