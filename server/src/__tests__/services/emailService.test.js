import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockSend = jest.fn();

jest.unstable_mockModule('../../services/email/createEmailProvider.js', () => ({
  default: jest.fn(async () => ({
    name: 'mock',
    send: mockSend,
  })),
}));

jest.unstable_mockModule('../../config/env.js', () => ({
  default: {
    smtp: { host: 'smtp.test.com', port: 587, user: 'user', pass: 'pass' },
    email: { provider: 'smtp', resendApiKey: '', brevoApiKey: '' },
    emailFrom: 'noreply@test.com',
    clientUrl: 'http://localhost:5173',
    adminEmail: 'admin@test.com',
  },
}));

const { default: emailService } = await import('../../services/emailService.js');

describe('EmailService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('init', () => {
    it('should have a provider after initialization', () => {
      expect(emailService.provider).toBeDefined();
      expect(emailService.provider.name).toBe('mock');
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
    it('should wrap content in email template', () => {
      const result = emailService._wrap('<p>Hello</p>');
      expect(result).toContain('Habit Tracker');
      expect(result).toContain('<p>Hello</p>');
    });
  });

  describe('_send', () => {
    it('should call provider.send with correct args', async () => {
      mockSend.mockResolvedValue({ messageId: 'msg-123' });
      await emailService._send('user@test.com', 'Subject', '<p>Body</p>', 'Test');

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'noreply@test.com',
          to: 'user@test.com',
          subject: 'Subject',
        })
      );
    });

    it('should throw when provider.send fails', async () => {
      mockSend.mockRejectedValue(new Error('Send failed'));
      await expect(
        emailService._send('user@test.com', 'Subject', '<p>Body</p>', 'Test')
      ).rejects.toThrow('Send failed');
    });
  });

  describe('sendWelcomeEmail', () => {
    it('should send welcome email with correct content', async () => {
      mockSend.mockResolvedValue({});
      await emailService.sendWelcomeEmail('user@test.com', 'Alice');

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@test.com',
          subject: 'Welcome to Habit Tracker!',
        })
      );
      const html = mockSend.mock.calls[0][0].html;
      expect(html).toContain('Alice');
      expect(html).toContain('Get Started');
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send reset email via provider', async () => {
      mockSend.mockResolvedValue({});
      await emailService.sendPasswordResetEmail('user@test.com', 'reset123');

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Reset your Habit Tracker password',
        })
      );
      const html = mockSend.mock.calls[0][0].html;
      expect(html).toContain('reset123');
    });
  });

  describe('sendPasswordResetConfirmationEmail', () => {
    it('should send confirmation email', async () => {
      mockSend.mockResolvedValue({});
      await emailService.sendPasswordResetConfirmationEmail('user@test.com', 'Alice');

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Your password has been reset',
        })
      );
      const html = mockSend.mock.calls[0][0].html;
      expect(html).toContain('Alice');
    });
  });

  describe('sendHabitInviteEmail', () => {
    it('should send invite email with all details', async () => {
      mockSend.mockResolvedValue({});
      await emailService.sendHabitInviteEmail('bob@test.com', 'Bob', 'Alice', 'Exercise', 'code123');

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'bob@test.com',
        })
      );
      const html = mockSend.mock.calls[0][0].html;
      expect(html).toContain('Bob');
      expect(html).toContain('Alice');
      expect(html).toContain('Exercise');
      expect(html).toContain('code123');
    });
  });

  describe('sendFeedbackNotification', () => {
    it('should send feedback notification to admin', async () => {
      mockSend.mockResolvedValue({});
      await emailService.sendFeedbackNotification('Alice', 'alice@test.com', 'happy', 'Great!', 'dashboard');

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'admin@test.com',
        })
      );
    });

    it('should include mood emoji', async () => {
      mockSend.mockResolvedValue({});
      await emailService.sendFeedbackNotification('Alice', 'alice@test.com', 'loved', 'Awesome', null);

      const html = mockSend.mock.calls[0][0].html;
      expect(html).toContain('\u{1F60D}');
    });

    it('should skip if admin email not configured', async () => {
      const { default: env } = await import('../../config/env.js');
      const originalAdminEmail = env.adminEmail;
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      try {
        env.adminEmail = '';
        await emailService.sendFeedbackNotification('Alice', 'alice@test.com', 'happy', 'test', null);

        expect(mockSend).not.toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('ADMIN_EMAIL not configured'));
      } finally {
        env.adminEmail = originalAdminEmail;
        consoleSpy.mockRestore();
      }
    });
  });

  describe('sendPasswordChangedEmail', () => {
    it('should send password changed email', async () => {
      mockSend.mockResolvedValue({});
      await emailService.sendPasswordChangedEmail('user@test.com', 'Alice');

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Your Habit Tracker password was changed',
        })
      );
      const html = mockSend.mock.calls[0][0].html;
      expect(html).toContain('Alice');
    });
  });
});
