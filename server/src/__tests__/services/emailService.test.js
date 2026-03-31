import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockSendMail = jest.fn();

jest.unstable_mockModule('nodemailer', () => ({
  default: {
    createTransport: jest.fn(() => ({
      sendMail: mockSendMail,
    })),
  },
}));

jest.unstable_mockModule('../../config/env.js', () => ({
  default: {
    smtp: { host: 'smtp.test.com', port: 587, user: 'user', pass: 'pass' },
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

  describe('constructor', () => {
    it('should be configured when SMTP credentials are present', () => {
      expect(emailService.isConfigured).toBe(true);
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
    it('should send email when configured', async () => {
      mockSendMail.mockResolvedValue({});
      await emailService._send('user@test.com', 'Subject', '<p>Body</p>', 'Test');

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'noreply@test.com',
          to: 'user@test.com',
          subject: 'Subject',
        })
      );
    });

    it('should log fallback when not configured', async () => {
      const originalConfigured = emailService.isConfigured;
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      try {
        emailService.isConfigured = false;
        await emailService._send('user@test.com', 'Subject', '<p>Body</p>', 'Test label');

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[Email Fallback]'));
        expect(mockSendMail).not.toHaveBeenCalled();
      } finally {
        emailService.isConfigured = originalConfigured;
        consoleSpy.mockRestore();
      }
    });
  });

  describe('sendWelcomeEmail', () => {
    it('should send welcome email with correct content', async () => {
      mockSendMail.mockResolvedValue({});
      await emailService.sendWelcomeEmail('user@test.com', 'Alice');

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@test.com',
          subject: 'Welcome to Habit Tracker!',
        })
      );
      const html = mockSendMail.mock.calls[0][0].html;
      expect(html).toContain('Alice');
      expect(html).toContain('Get Started');
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send reset email when configured', async () => {
      mockSendMail.mockResolvedValue({});
      await emailService.sendPasswordResetEmail('user@test.com', 'reset123');

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Reset your Habit Tracker password',
        })
      );
      const html = mockSendMail.mock.calls[0][0].html;
      expect(html).toContain('reset123');
    });

    it('should log fallback when not configured', async () => {
      const originalConfigured = emailService.isConfigured;
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      try {
        emailService.isConfigured = false;
        await emailService.sendPasswordResetEmail('user@test.com', 'reset123');

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Password reset email')
        );
        expect(mockSendMail).not.toHaveBeenCalled();
      } finally {
        emailService.isConfigured = originalConfigured;
        consoleSpy.mockRestore();
      }
    });
  });

  describe('sendPasswordResetConfirmationEmail', () => {
    it('should send confirmation email', async () => {
      mockSendMail.mockResolvedValue({});
      await emailService.sendPasswordResetConfirmationEmail('user@test.com', 'Alice');

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Your password has been reset',
        })
      );
      const html = mockSendMail.mock.calls[0][0].html;
      expect(html).toContain('Alice');
    });
  });

  describe('sendHabitInviteEmail', () => {
    it('should send invite email with all details', async () => {
      mockSendMail.mockResolvedValue({});
      await emailService.sendHabitInviteEmail('bob@test.com', 'Bob', 'Alice', 'Exercise', 'code123');

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'bob@test.com',
        })
      );
      const html = mockSendMail.mock.calls[0][0].html;
      expect(html).toContain('Bob');
      expect(html).toContain('Alice');
      expect(html).toContain('Exercise');
      expect(html).toContain('code123');
    });
  });

  describe('sendFeedbackNotification', () => {
    it('should send feedback notification to admin', async () => {
      mockSendMail.mockResolvedValue({});
      await emailService.sendFeedbackNotification('Alice', 'alice@test.com', 'happy', 'Great!', 'dashboard');

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'admin@test.com',
        })
      );
    });

    it('should include mood emoji', async () => {
      mockSendMail.mockResolvedValue({});
      await emailService.sendFeedbackNotification('Alice', 'alice@test.com', 'loved', 'Awesome', null);

      const html = mockSendMail.mock.calls[0][0].html;
      expect(html).toContain('\u{1F60D}');
    });

    it('should skip if admin email not configured', async () => {
      const { default: env } = await import('../../config/env.js');
      const originalAdminEmail = env.adminEmail;
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      try {
        env.adminEmail = '';
        await emailService.sendFeedbackNotification('Alice', 'alice@test.com', 'happy', 'test', null);

        expect(mockSendMail).not.toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('ADMIN_EMAIL not configured'));
      } finally {
        env.adminEmail = originalAdminEmail;
        consoleSpy.mockRestore();
      }
    });
  });

  describe('sendPasswordChangedEmail', () => {
    it('should send password changed email', async () => {
      mockSendMail.mockResolvedValue({});
      await emailService.sendPasswordChangedEmail('user@test.com', 'Alice');

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Your Habit Tracker password was changed',
        })
      );
      const html = mockSendMail.mock.calls[0][0].html;
      expect(html).toContain('Alice');
    });
  });
});
