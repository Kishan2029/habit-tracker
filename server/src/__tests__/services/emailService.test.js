import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../../config/env.js', () => ({
  default: {
    clientUrl: 'http://localhost:5173',
    adminEmail: 'admin@test.com',
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

const { EmailService } = await import('../../services/emailService.js');
const { createNoopEmailProvider } = await import('../../services/email/providers/noopEmailProvider.js');

const createMockProvider = (overrides = {}) => ({
  key: 'mock',
  isConfigured: true,
  send: jest.fn().mockResolvedValue({ provider: 'mock', externalId: 'msg_123' }),
  ...overrides,
});

const createEnvConfig = (overrides = {}) => ({
  clientUrl: 'http://localhost:5173',
  adminEmail: 'admin@test.com',
  ...overrides,
});

describe('EmailService', () => {
  let provider;
  let emailService;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = createMockProvider();
    emailService = new EmailService({
      envConfig: createEnvConfig(),
      provider,
    });
  });

  describe('getters', () => {
    it('should expose provider configuration state', () => {
      expect(emailService.isConfigured).toBe(true);
      expect(emailService.providerKey).toBe('mock');
    });
  });

  describe('_escapeHtml', () => {
    it('should escape HTML special characters', () => {
      expect(emailService._escapeHtml('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
      );
    });

    it('should escape ampersands and quotes', () => {
      expect(emailService._escapeHtml("Tom & Jerry's")).toBe('Tom &amp; Jerry&#039;s');
    });
  });

  describe('_wrap', () => {
    it('should wrap content in the shared email layout', () => {
      const result = emailService._wrap('<p>Hello</p>');

      expect(result).toContain('Habit Tracker');
      expect(result).toContain('<p>Hello</p>');
    });
  });

  describe('_send', () => {
    it('should wrap HTML and add plain-text fallback', async () => {
      await emailService._send('user@test.com', 'Subject', '<p>Body</p>', 'Test label');

      expect(provider.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@test.com',
          subject: 'Subject',
          label: 'Test label',
          text: 'Body',
        })
      );
      expect(provider.send.mock.calls[0][0].html).toContain('Habit Tracker');
      expect(provider.send.mock.calls[0][0].html).toContain('<p>Body</p>');
    });
  });

  describe('sendWelcomeEmail', () => {
    it('should send welcome email with the expected content', async () => {
      await emailService.sendWelcomeEmail('user@test.com', 'Alice');

      expect(provider.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@test.com',
          subject: 'Welcome to Habit Tracker!',
          label: 'Welcome email',
        })
      );
      const html = provider.send.mock.calls[0][0].html;
      expect(html).toContain('Alice');
      expect(html).toContain('Get Started');
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should require delivery for password reset emails', async () => {
      await emailService.sendPasswordResetEmail('user@test.com', 'reset123');

      expect(provider.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@test.com',
          subject: 'Reset your Habit Tracker password',
          label: 'Password reset email',
          requireDelivery: true,
        })
      );
      expect(provider.send.mock.calls[0][0].html).toContain('reset123');
    });

    it('should throw when no provider is configured', async () => {
      const noopService = new EmailService({
        envConfig: createEnvConfig(),
        provider: createNoopEmailProvider(),
      });

      await expect(
        noopService.sendPasswordResetEmail('user@test.com', 'reset123')
      ).rejects.toThrow('Email service not configured');
    });
  });

  describe('sendPasswordResetConfirmationEmail', () => {
    it('should send confirmation email', async () => {
      await emailService.sendPasswordResetConfirmationEmail('user@test.com', 'Alice');

      expect(provider.send).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Your password has been reset',
          label: 'Password reset confirmation',
        })
      );
      expect(provider.send.mock.calls[0][0].html).toContain('Alice');
    });
  });

  describe('sendHabitInviteEmail', () => {
    it('should send invite email with all details', async () => {
      await emailService.sendHabitInviteEmail('bob@test.com', 'Bob', 'Alice', 'Exercise', 'code123');

      expect(provider.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'bob@test.com',
          label: 'Habit invite',
        })
      );
      const html = provider.send.mock.calls[0][0].html;
      expect(html).toContain('Bob');
      expect(html).toContain('Alice');
      expect(html).toContain('Exercise');
      expect(html).toContain('code123');
    });
  });

  describe('sendFeedbackNotification', () => {
    it('should send feedback notification to admin', async () => {
      await emailService.sendFeedbackNotification('Alice', 'alice@test.com', 'happy', 'Great!', 'dashboard');

      expect(provider.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'admin@test.com',
          label: 'Feedback notification',
        })
      );
    });

    it('should include mood emoji in the HTML body', async () => {
      await emailService.sendFeedbackNotification('Alice', 'alice@test.com', 'loved', 'Awesome', null);

      expect(provider.send.mock.calls[0][0].html).toContain('\u{1F60D}');
    });

    it('should skip if admin email is not configured', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const noAdminService = new EmailService({
        envConfig: createEnvConfig({ adminEmail: '' }),
        provider,
      });

      try {
        await noAdminService.sendFeedbackNotification('Alice', 'alice@test.com', 'happy', 'test', null);

        expect(provider.send).not.toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('ADMIN_EMAIL not configured'));
      } finally {
        consoleSpy.mockRestore();
      }
    });
  });

  describe('sendPasswordChangedEmail', () => {
    it('should send password changed email', async () => {
      await emailService.sendPasswordChangedEmail('user@test.com', 'Alice');

      expect(provider.send).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Your Habit Tracker password was changed',
          label: 'Password changed',
        })
      );
      expect(provider.send.mock.calls[0][0].html).toContain('Alice');
    });
  });
});
