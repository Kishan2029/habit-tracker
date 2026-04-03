import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { createBrevoEmailProvider } from '../../../../services/email/providers/brevoEmailProvider.js';

describe('brevoEmailProvider', () => {
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
      json: jest.fn().mockResolvedValue({ messageId: '<brevo-123@test.com>' }),
    });

    const provider = createBrevoEmailProvider({
      apiKey: 'brevo_api_key',
      from: { name: 'Habit Tracker', email: 'noreply@test.com' },
      replyTo: 'Support <support@test.com>',
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
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(options.headers['api-key']).toBe('brevo_api_key');
    expect(JSON.parse(options.body)).toEqual({
      sender: { name: 'Habit Tracker', email: 'noreply@test.com' },
      to: [{ email: 'user@test.com' }],
      subject: 'Subject',
      htmlContent: '<p>Body</p>',
      textContent: 'Body',
      replyTo: { name: 'Support', email: 'support@test.com' },
    });
    expect(result).toEqual({ provider: 'brevo', externalId: '<brevo-123@test.com>' });
  });

  it('should throw on non-2xx responses', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 400,
      text: jest.fn().mockResolvedValue('bad request'),
    });

    const provider = createBrevoEmailProvider({
      apiKey: 'brevo_api_key',
      from: { email: 'noreply@test.com' },
    });

    await expect(provider.send({
      to: 'user@test.com',
      subject: 'Subject',
      html: '<p>Body</p>',
      label: 'Test label',
    })).rejects.toThrow('Brevo send failed with status 400');
  });

  it('should throw on timeout', async () => {
    global.fetch.mockRejectedValue({ name: 'AbortError' });

    const provider = createBrevoEmailProvider({
      apiKey: 'brevo_api_key',
      from: { email: 'noreply@test.com' },
      requestTimeoutMs: 5,
    });

    await expect(provider.send({
      to: 'user@test.com',
      subject: 'Subject',
      html: '<p>Body</p>',
      label: 'Test label',
    })).rejects.toThrow('Brevo request timed out after 5ms');
  });
});
