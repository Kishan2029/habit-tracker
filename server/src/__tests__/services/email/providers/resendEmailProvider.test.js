import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { createResendEmailProvider } from '../../../../services/email/providers/resendEmailProvider.js';

describe('resendEmailProvider', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn();
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should send the expected HTTP payload', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ id: 're_123' }),
    });

    const provider = createResendEmailProvider({
      apiKey: 're_api_key',
      from: { raw: 'Habit Tracker <noreply@test.com>' },
      replyTo: 'support@test.com',
      requestTimeoutMs: 1000,
    });

    const result = await provider.send({
      to: 'user@test.com',
      subject: 'Subject',
      html: '<p>Body</p>',
      text: 'Body',
      label: 'Test label',
    });

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(options.headers.Authorization).toBe('Bearer re_api_key');
    expect(JSON.parse(options.body)).toEqual({
      from: 'Habit Tracker <noreply@test.com>',
      to: ['user@test.com'],
      subject: 'Subject',
      html: '<p>Body</p>',
      text: 'Body',
      reply_to: 'support@test.com',
    });
    expect(result).toEqual({ provider: 'resend', externalId: 're_123' });
  });

  it('should throw on non-2xx responses', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 422,
      text: jest.fn().mockResolvedValue('invalid sender'),
    });

    const provider = createResendEmailProvider({
      apiKey: 're_api_key',
      from: { raw: 'Habit Tracker <noreply@test.com>' },
    });

    await expect(provider.send({
      to: 'user@test.com',
      subject: 'Subject',
      html: '<p>Body</p>',
      label: 'Test label',
    })).rejects.toThrow('Resend send failed with status 422');
  });

  it('should throw on timeout', async () => {
    global.fetch.mockRejectedValue({ name: 'AbortError' });

    const provider = createResendEmailProvider({
      apiKey: 're_api_key',
      from: { raw: 'Habit Tracker <noreply@test.com>' },
      requestTimeoutMs: 5,
    });

    await expect(provider.send({
      to: 'user@test.com',
      subject: 'Subject',
      html: '<p>Body</p>',
      label: 'Test label',
    })).rejects.toThrow('Resend request timed out after 5ms');
  });
});
