const RESEND_URL = 'https://api.resend.com/emails';

const withTimeout = async (requestTimeoutMs, callback) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    return await callback(controller.signal);
  } finally {
    clearTimeout(timer);
  }
};

export const createResendEmailProvider = ({
  apiKey,
  from,
  replyTo = '',
  requestTimeoutMs = 10000,
} = {}) => ({
  key: 'resend',
  isConfigured: Boolean(apiKey && from?.raw),
  async send(message) {
    if (!(apiKey && from?.raw)) {
      throw new Error('Resend provider is not configured');
    }

    const payload = {
      from: from.raw,
      to: [message.to],
      subject: message.subject,
      html: message.html,
    };

    if (message.text) payload.text = message.text;

    const effectiveReplyTo = message.replyTo || replyTo;
    if (effectiveReplyTo) payload.reply_to = effectiveReplyTo;

    let response;
    try {
      response = await withTimeout(requestTimeoutMs, (signal) => fetch(RESEND_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal,
      }));
    } catch (err) {
      if (err.name === 'AbortError') {
        const timeoutError = new Error(`Resend request timed out after ${requestTimeoutMs}ms`);
        console.error(`[Email:resend] Failed to send "${message.label}" to ${message.to}:`, timeoutError.message);
        throw timeoutError;
      }

      console.error(`[Email:resend] Failed to send "${message.label}" to ${message.to}:`, err.message);
      throw err;
    }

    if (!response.ok) {
      const body = await response.text();
      const snippet = body.slice(0, 300);
      const error = new Error(`Resend send failed with status ${response.status}: ${snippet}`);
      console.error(`[Email:resend] Failed to send "${message.label}" to ${message.to}:`, error.message);
      throw error;
    }

    const data = await response.json().catch(() => ({}));
    const externalId = data?.id;
    console.log(`[Email:resend] Sent "${message.label}" to ${message.to}${externalId ? ` — id: ${externalId}` : ''}`);
    return { provider: 'resend', externalId };
  },
});
