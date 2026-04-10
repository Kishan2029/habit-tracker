export const createNoopEmailProvider = ({ reason = 'Email service not configured' } = {}) => ({
  key: 'none',
  isConfigured: false,
  async send(message) {
    console.log(`[Email:none] Fallback "${message.label}" -> ${message.to}${reason ? ` (${reason})` : ''}`);

    if (message.requireDelivery) {
      throw new Error(reason);
    }

    return { provider: 'none' };
  },
});
