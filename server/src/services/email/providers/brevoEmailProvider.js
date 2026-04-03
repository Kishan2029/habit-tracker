import { parseEmailAddress } from '../address.js';

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

const withTimeout = async (requestTimeoutMs, callback) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    return await callback(controller.signal);
  } finally {
    clearTimeout(timer);
  }
};

const toBrevoAddress = (address) => (
  address?.name
    ? { name: address.name, email: address.email }
    : { email: address?.email }
);

export const createBrevoEmailProvider = ({
  apiKey,
  from,
  replyTo = '',
  requestTimeoutMs = 10000,
} = {}) => ({
  key: 'brevo',
  isConfigured: Boolean(apiKey && from?.email),
  async send(message) {
    if (!(apiKey && from?.email)) {
      throw new Error('Brevo provider is not configured');
    }

    const effectiveReplyTo = message.replyTo || replyTo;
    const parsedReplyTo = effectiveReplyTo ? parseEmailAddress(effectiveReplyTo) : null;

    const payload = {
      sender: toBrevoAddress(from),
      to: [{ email: message.to }],
      subject: message.subject,
      htmlContent: message.html,
    };

    if (message.text) payload.textContent = message.text;
    if (parsedReplyTo) payload.replyTo = toBrevoAddress(parsedReplyTo);

    let response;
    try {
      response = await withTimeout(requestTimeoutMs, (signal) => fetch(BREVO_URL, {
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
        signal,
      }));
    } catch (err) {
      if (err.name === 'AbortError') {
        const timeoutError = new Error(`Brevo request timed out after ${requestTimeoutMs}ms`);
        console.error(`[Email:brevo] Failed to send "${message.label}" to ${message.to}:`, timeoutError.message);
        throw timeoutError;
      }

      console.error(`[Email:brevo] Failed to send "${message.label}" to ${message.to}:`, err.message);
      throw err;
    }

    if (!response.ok) {
      const body = await response.text();
      const snippet = body.slice(0, 300);
      const error = new Error(`Brevo send failed with status ${response.status}: ${snippet}`);
      console.error(`[Email:brevo] Failed to send "${message.label}" to ${message.to}:`, error.message);
      throw error;
    }

    const data = await response.json().catch(() => ({}));
    const externalId = data?.messageId;
    console.log(`[Email:brevo] Sent "${message.label}" to ${message.to}${externalId ? ` — messageId: ${externalId}` : ''}`);
    return { provider: 'brevo', externalId };
  },
});
