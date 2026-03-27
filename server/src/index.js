import app from './app.js';
import connectDB from './config/db.js';
import env from './config/env.js';
import { startWeeklySummaryJob } from './jobs/weeklySummary.js';

const start = async () => {
  await connectDB();
  startWeeklySummaryJob();
  app.listen(env.port, () => {
    console.log(`Server running in ${env.nodeEnv} mode on port ${env.port}`);
  });
};

start();
