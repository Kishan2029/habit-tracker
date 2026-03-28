import mongoose from 'mongoose';
import app from './app.js';
import connectDB from './config/db.js';
import env from './config/env.js';
import { startWeeklySummaryJob } from './jobs/weeklySummary.js';

const start = async () => {
  await connectDB();
  startWeeklySummaryJob();
  const server = app.listen(env.port, () => {
    console.log(`Server running in ${env.nodeEnv} mode on port ${env.port}`);
  });

  const shutdown = async (signal) => {
    console.log(`${signal} received. Shutting down gracefully...`);
    server.close(async () => {
      await mongoose.connection.close();
      console.log('Server and database connections closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

start();
