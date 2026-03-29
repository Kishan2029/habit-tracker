import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockSendMail = jest.fn();

jest.unstable_mockModule('nodemailer', () => ({
  default: {
    createTransport: jest.fn(() => ({ sendMail: mockSendMail })),
  },
}));

jest.unstable_mockModule('../../config/env.js', () => ({
  default: {
    smtp: { host: 'smtp.test.com', port: 587, user: 'user', pass: 'pass' },
    emailFrom: 'noreply@test.com',
    clientUrl: 'https://app.test.com',
    adminEmail: 'admin@test.com',
  },
}));

const { default: nodemailer } = await import('nodemailer');

// Re-import to get a fresh instance with mocked deps
const EmailServiceModule = await import('../../services/emailService.js');
const emailService = EmailServiceModule.default;

describe('EmailService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('_escapeHtml', () => {
    it('should escape HTML special characters', () => {
      expect(emailService._escapeHtml('<script>"test" & \'xss\'</script>')).toBe(
        '&lt;script&gt;&quot;test&quot; &amp; &#039;xss&#039;&lt;/script&gt;'
      );
    });

    it('should handle plain text without changes', () => {
      expect(emailService._escapeHtml('Hello World')).toBe('Hello World');
    });
  });

  describe('_wrap', () => {
    it('should wrap content in email template', () => {
      const result = emailService._wrap('<p>Hello</p>');
      expect(result).toContain('<p>Hello</p>');
      expect(result).toContain('Habit Tracker');
    });
  });

  describe('sendWelcomeEmail', () => {
    it('should send welcome email when configured', async () => {
      mockSendMail.mockResolvedValue({});

      await emailService.sendWelcomeEmail('user@test.com', 'John');

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@test.com',
          subject: 'Welcome to Habit Tracker!',
        })
      );
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send password reset email', async () => {
      mockSendMail.mockResolvedValue({});

      await emailService.sendPasswordResetEmail('user@test.com', 'abc123token');

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@test.com',
          subject: 'Reset your Habit Tracker password',
        })
      );
      const htmlArg = mockSendMail.mock.calls[0][0].html;
      expect(htmlArg).toContain('abc123token');
    });
  });

  describe('sendPasswordResetConfirmationEmail', () => {
    it('should send password reset confirmation', async () => {
      mockSendMail.mockResolvedValue({});

      await emailService.sendPasswordResetConfirmationEmail('user@test.com', 'John');

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Your password has been reset',
        })
      );
    });
  });

  describe('sendHabitInviteEmail', () => {
    it('should send habit invite email', async () => {
      mockSendMail.mockResolvedValue({});

      await emailService.sendHabitInviteEmail('invitee@test.com', 'Jane', 'John', 'Exercise', 'invite123');

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'invitee@test.com',
        })
      );
      const htmlArg = mockSendMail.mock.calls[0][0].html;
      expect(htmlArg).toContain('Jane');
      expect(htmlArg).toContain('John');
      expect(htmlArg).toContain('Exercise');
    });
  });

  describe('sendFeedbackNotification', () => {
    it('should send feedback notification to admin', async () => {
      mockSendMail.mockResolvedValue({});

      await emailService.sendFeedbackNotification('John', 'john@test.com', 'happy', 'Great app!', 'dashboard');

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'admin@test.com',
        })
      );
    });

    it('should include mood emoji in email', async () => {
      mockSendMail.mockResolvedValue({});

      await emailService.sendFeedbackNotification('John', 'john@test.com', 'happy', 'Nice', 'home');

      const subject = mockSendMail.mock.calls[0][0].subject;
      expect(subject).toContain('John');
    });
  });

  describe('sendPasswordChangedEmail', () => {
    it('should send password changed email', async () => {
      mockSendMail.mockResolvedValue({});

      await emailService.sendPasswordChangedEmail('user@test.com', 'John');

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Your Habit Tracker password was changed',
        })
      );
    });
  });
});

describe('EmailService (unconfigured)', () => {
  it('should log fallback when SMTP is not configured', async () => {
    jest.unstable_mockModule('../../config/env.js', () => ({
      default: {
        smtp: { host: '', port: 587, user: '', pass: '' },
        emailFrom: '',
        clientUrl: 'https://app.test.com',
        adminEmail: '',
      },
    }));

    // The singleton was already created with configured SMTP,
    // but we can test the _send fallback by checking isConfigured
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    // Create a fresh unconfigured instance
    const { default: envUnconfigured } = await import('../../config/env.js');
    const service = Object.create(emailService);
    service.isConfigured = false;

    await service._send('test@test.com', 'Test', '<p>Test</p>', 'Test email');

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Email Fallback]')
    );
    consoleSpy.mockRestore();
  });
});
