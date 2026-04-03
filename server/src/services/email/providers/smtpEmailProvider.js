import nodemailer from 'nodemailer';

export const createSmtpEmailProvider = ({
  smtp = {},
  from,
  replyTo = '',
} = {}) => {
  const isConfigured = Boolean(smtp.host && smtp.user && smtp.pass && from?.raw);

  if (!isConfigured) {
    return {
      key: 'smtp',
      isConfigured: false,
      async send() {
        throw new Error('SMTP provider is not configured');
      },
    };
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
    family: 4,
  });

  if (typeof transporter.verify === 'function') {
    transporter.verify()
      .then(() => console.log('[Email:smtp] Connection verified'))
      .catch((err) => console.error('[Email:smtp] Connection verification failed:', err.message));
  }

  return {
    key: 'smtp',
    isConfigured: true,
    async send(message) {
      try {
        const info = await transporter.sendMail({
          from: from.raw,
          to: message.to,
          subject: message.subject,
          html: message.html,
          text: message.text,
          replyTo: message.replyTo || replyTo || undefined,
        });

        console.log(`[Email:smtp] Sent "${message.label}" to ${message.to}${info?.messageId ? ` — messageId: ${info.messageId}` : ''}`);
        return { provider: 'smtp', externalId: info?.messageId };
      } catch (err) {
        console.error(`[Email:smtp] Failed to send "${message.label}" to ${message.to}:`, err.message);
        throw err;
      }
    },
  };
};
