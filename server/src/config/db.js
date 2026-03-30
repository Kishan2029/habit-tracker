import mongoose from 'mongoose';
import env from './env.js';

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.mongodbUri);
    console.log(`MongoDB connected: ${conn.connection.host}`);

    // Sync indexes: drops stale indexes and creates missing ones
    const HabitLog = (await import('../models/HabitLog.js')).default;
    const SharedHabit = (await import('../models/SharedHabit.js')).default;
    await HabitLog.syncIndexes();
    await SharedHabit.syncIndexes();
    console.log('Database indexes synced');
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
