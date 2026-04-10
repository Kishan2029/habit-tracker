import env from '../../config/env.js';
import { parseEmailAddress } from './address.js';
import { createNoopEmailProvider } from './providers/noopEmailProvider.js';
import { createSmtpEmailProvider } from './providers/smtpEmailProvider.js';
import { createResendEmailProvider } from './providers/resendEmailProvider.js';
import { createBrevoEmailProvider } from './providers/brevoEmailProvider.js';

const SUPPORTED_PROVIDER_KEYS = new Set(['smtp', 'resend', 'brevo', 'none']);

export const resolveEmailProviderKey = (config = env) => {
  const explicitProvider = (config.email?.provider || '').trim().toLowerCase();
  if (explicitProvider) return explicitProvider;

  if (config.smtp?.host && config.smtp?.user && config.smtp?.pass) {
    return 'smtp';
  }

  return 'none';
};

const createFallbackProvider = (reason) => {
  console.log('[Email:none] Provider selected: none');
  return createNoopEmailProvider({ reason });
};

export const createEmailProvider = (config = env) => {
  const requestedKey = resolveEmailProviderKey(config);

  if (!SUPPORTED_PROVIDER_KEYS.has(requestedKey)) {
    console.warn(`[Email] Unknown EMAIL_PROVIDER "${requestedKey}". Falling back to noop provider.`);
    return createFallbackProvider(`Unknown email provider "${requestedKey}"`);
  }

  if (requestedKey === 'none') {
    return createFallbackProvider('Email service not configured');
  }

  const from = parseEmailAddress(config.email?.from || config.emailFrom);
  if (!from) {
    console.warn('[Email] Invalid EMAIL_FROM value. Falling back to noop provider.');
    return createFallbackProvider('Invalid EMAIL_FROM');
  }

  const rawReplyTo = config.email?.replyTo || config.emailReplyTo || '';
  const parsedReplyTo = rawReplyTo ? parseEmailAddress(rawReplyTo) : null;
  if (rawReplyTo && !parsedReplyTo) {
    console.warn('[Email] Invalid EMAIL_REPLY_TO value. Ignoring reply-to header.');
  }

  const baseConfig = {
    from,
    replyTo: parsedReplyTo?.raw || '',
    requestTimeoutMs: config.email?.requestTimeoutMs || config.emailRequestTimeoutMs || 10000,
  };

  let provider;
  switch (requestedKey) {
    case 'smtp':
      provider = createSmtpEmailProvider({
        ...baseConfig,
        smtp: config.smtp,
      });
      break;
    case 'resend':
      provider = createResendEmailProvider({
        ...baseConfig,
        apiKey: config.email?.resendApiKey,
      });
      break;
    case 'brevo':
      provider = createBrevoEmailProvider({
        ...baseConfig,
        apiKey: config.email?.brevoApiKey,
      });
      break;
    default:
      provider = createNoopEmailProvider();
      break;
  }

  if (!provider?.isConfigured) {
    console.warn(`[Email] Selected provider "${requestedKey}" is not fully configured. Falling back to noop provider.`);
    return createFallbackProvider(`Email provider "${requestedKey}" is not configured`);
  }

  console.log(`[Email:${provider.key}] Provider selected: ${provider.key}`);
  return provider;
};
