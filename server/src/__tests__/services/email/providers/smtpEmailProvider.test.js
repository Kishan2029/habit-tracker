import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockSendMail = jest.fn();
const mockVerify = jest.fn().mockResolvedValue(true);
const mockCreateTransport = jest.fn(() => ({
  verify: mockVerify,
  sendMail: mockSendMail,
}));

jest.unstable_mockModule('nodemailer', () => ({
  default: {
    createTransport: mockCreateTransport,
  },
}));

const { createSmtpEmailProvider } = await import('../../../../services/email/providers/smtpEmailProvider.js');

describe('smtpEmailProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should use nodemailer with the existing smtp config', async () => {
    mockSendMail.mockResolvedValue({ messageId: 'smtp-123' });
    const provider = createSmtpEmailProvider({
      smtp: {
        host: 'smtp.test.com',
        port: 587,
        user: 'user',
        pass: 'pass',
      },
      from: {
        raw: 'Habit Tracker <noreply@test.com>',
      },
      replyTo: 'support@test.com',
    });

    const result = await provider.send({
      to: 'user@test.com',
      subject: 'Subject',
      html: '<p>Body</p>',
      text: 'Body',
      label: 'Test label',
    });

    expect(mockCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.test.com',
        port: 587,
        secure: false,
      })
    );
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Habit Tracker <noreply@test.com>',
        to: 'user@test.com',
        replyTo: 'support@test.com',
      })
    );
    expect(result).toEqual({ provider: 'smtp', externalId: 'smtp-123' });
  });
});
