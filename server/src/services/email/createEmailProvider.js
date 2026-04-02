import env from '../../config/env.js';
import ConsoleProvider from './providers/ConsoleProvider.js';

export default async function createEmailProvider() {
  const provider = env.email?.provider || 'smtp';

  switch (provider) {
    case 'resend': {
      if (!env.email.resendApiKey) {
        console.warn('[Email] RESEND_API_KEY not set, falling back to console provider');
        return new ConsoleProvider();
      }
      const { default: ResendProvider } = await import('./providers/ResendProvider.js');
      return new ResendProvider(env.email.resendApiKey);
    }

    case 'brevo': {
      if (!env.email.brevoApiKey) {
        console.warn('[Email] BREVO_API_KEY not set, falling back to console provider');
        return new ConsoleProvider();
      }
      const { default: BrevoProvider } = await import('./providers/BrevoProvider.js');
      return new BrevoProvider(env.email.brevoApiKey);
    }

    case 'smtp': {
      if (!(env.smtp.host && env.smtp.user && env.smtp.pass)) {
        console.warn('[Email] SMTP not configured, falling back to console provider');
        return new ConsoleProvider();
      }
      const { default: SmtpProvider } = await import('./providers/SmtpProvider.js');
      return new SmtpProvider(env.smtp);
    }

    case 'console':
      return new ConsoleProvider();

    default:
      console.warn(`[Email] Unknown provider "${provider}", falling back to console`);
      return new ConsoleProvider();
  }
}
