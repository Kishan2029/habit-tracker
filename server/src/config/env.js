import { resolve } from 'path';
import dotenv from 'dotenv';

const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';

// Load the environment-specific file for the current runtime.
dotenv.config({ path: resolve(process.cwd(), envFile) });

const required = ['MONGODB_URI', 'JWT_SECRET'];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const parseNumber = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const email = {
  provider: (process.env.EMAIL_PROVIDER || '').trim().toLowerCase(),
  from: process.env.EMAIL_FROM || 'Habit Tracker <noreply@habit-tracker.com>',
  replyTo: process.env.EMAIL_REPLY_TO || '',
  requestTimeoutMs: parseNumber(process.env.EMAIL_REQUEST_TIMEOUT_MS, 10000),
  resendApiKey: process.env.RESEND_API_KEY || '',
  brevoApiKey: process.env.BREVO_API_KEY || '',
};

export default {
  port: parseNumber(process.env.PORT, 5000),
  mongodbUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  corsOrigin: process.env.CORS_ORIGIN || process.env.CLIENT_URL || 'http://localhost:5173',
  email,
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseNumber(process.env.SMTP_PORT, 587),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  emailFrom: email.from,
  emailReplyTo: email.replyTo,
  emailRequestTimeoutMs: email.requestTimeoutMs,
  adminEmail: process.env.ADMIN_EMAIL || '',
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
  vapid: {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
    email: process.env.VAPID_EMAIL || 'mailto:admin@habit-tracker.com',
  },
};
