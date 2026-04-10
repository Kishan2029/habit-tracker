import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockCreateTransport = jest.fn(() => ({
  verify: jest.fn().mockResolvedValue(true),
  sendMail: jest.fn(),
}));

jest.unstable_mockModule('nodemailer', () => ({
  default: {
    createTransport: mockCreateTransport,
  },
}));

jest.unstable_mockModule('../../../config/env.js', () => ({
  default: {
    email: {
      provider: 'none',
      from: 'Habit Tracker <noreply@test.com>',
      replyTo: '',
      requestTimeoutMs: 10000,
      resendApiKey: '',
      brevoApiKey: '',
    },
    smtp: { host: '', port: 587, user: '', pass: '' },
    emailFrom: 'Habit Tracker <noreply@test.com>',
    emailReplyTo: '',
    emailRequestTimeoutMs: 10000,
  },
}));

const { createEmailProvider, resolveEmailProviderKey } = await import('../../../services/email/providerFactory.js');

const createConfig = (overrides = {}) => ({
  email: {
    provider: '',
    from: 'Habit Tracker <noreply@test.com>',
    replyTo: '',
    requestTimeoutMs: 10000,
    resendApiKey: '',
    brevoApiKey: '',
    ...overrides.email,
  },
  smtp: {
    host: '',
    port: 587,
    user: '',
    pass: '',
    ...overrides.smtp,
  },
  emailFrom: 'Habit Tracker <noreply@test.com>',
  emailReplyTo: '',
  emailRequestTimeoutMs: 10000,
});

describe('email provider factory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should resolve the explicit resend provider', () => {
    const provider = createEmailProvider(createConfig({
      email: { provider: 'resend', resendApiKey: 're_123' },
    }));

    expect(resolveEmailProviderKey(createConfig({
      email: { provider: 'resend' },
    }))).toBe('resend');
    expect(provider.key).toBe('resend');
    expect(provider.isConfigured).toBe(true);
  });

  it('should resolve the explicit brevo provider', () => {
    const provider = createEmailProvider(createConfig({
      email: { provider: 'brevo', brevoApiKey: 'br_123' },
    }));

    expect(provider.key).toBe('brevo');
    expect(provider.isConfigured).toBe(true);
  });

  it('should resolve the explicit smtp provider', () => {
    const provider = createEmailProvider(createConfig({
      email: { provider: 'smtp' },
      smtp: { host: 'smtp.test.com', user: 'user', pass: 'pass' },
    }));

    expect(provider.key).toBe('smtp');
    expect(provider.isConfigured).toBe(true);
    expect(mockCreateTransport).toHaveBeenCalled();
  });

  it('should default to smtp when EMAIL_PROVIDER is unset and smtp credentials exist', () => {
    const key = resolveEmailProviderKey(createConfig({
      smtp: { host: 'smtp.test.com', user: 'user', pass: 'pass' },
    }));

    expect(key).toBe('smtp');
  });

  it('should fall back to noop when the selected provider is missing config', () => {
    const provider = createEmailProvider(createConfig({
      email: { provider: 'resend', resendApiKey: '' },
    }));

    expect(provider.key).toBe('none');
    expect(provider.isConfigured).toBe(false);
  });

  it('should fall back to noop when EMAIL_FROM is invalid', () => {
    const provider = createEmailProvider(createConfig({
      email: { provider: 'brevo', from: 'not-an-email', brevoApiKey: 'br_123' },
      emailFrom: 'not-an-email',
    }));

    expect(provider.key).toBe('none');
    expect(provider.isConfigured).toBe(false);
  });
});
