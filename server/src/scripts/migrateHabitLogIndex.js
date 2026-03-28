/**
 * Migration: Update HabitLog unique index
 *
 * Changes the unique index from { habitId, date } to { habitId, userId, date }
 * to support shared habits where multiple users can log the same habit on the same date.
 *
 * Run once: node server/src/scripts/migrateHabitLogIndex.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI not set in environment');
  process.exit(1);
}

async function migrate() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const collection = mongoose.connection.collection('habitlogs');

    // List existing indexes
    const indexes = await collection.indexes();
    console.log('Current indexes:', indexes.map((i) => i.name));

    // Drop old unique index if it exists
    const oldIndex = indexes.find(
      (i) => i.name === 'habitId_1_date_1' && i.unique
    );

    if (oldIndex) {
      console.log('Dropping old index: habitId_1_date_1');
      await collection.dropIndex('habitId_1_date_1');
      console.log('Old index dropped');
    } else {
      console.log('Old index habitId_1_date_1 not found (may already be migrated)');
    }

    // Create new unique index
    const newIndexExists = indexes.find((i) => i.name === 'habitId_1_userId_1_date_1');
    if (!newIndexExists) {
      console.log('Creating new index: habitId_1_userId_1_date_1');
      await collection.createIndex(
        { habitId: 1, userId: 1, date: 1 },
        { unique: true }
      );
      console.log('New index created');
    } else {
      console.log('New index already exists');
    }

    // Verify
    const finalIndexes = await collection.indexes();
    console.log('Final indexes:', finalIndexes.map((i) => i.name));

    console.log('Migration complete!');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

migrate();
