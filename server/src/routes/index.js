import { Router } from 'express';
import env from '../config/env.js';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import habitRoutes from './habitRoutes.js';
import logRoutes from './logRoutes.js';
import exportRoutes from './exportRoutes.js';
import pushRoutes from './pushRoutes.js';
import sharedHabitRoutes from './sharedHabitRoutes.js';

const router = Router();

router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'OK',
    data: {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: env.nodeEnv,
    },
  });
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/habits', habitRoutes);
router.use('/logs', logRoutes);
router.use('/export', exportRoutes);
router.use('/push', pushRoutes);
router.use('/shared', sharedHabitRoutes);

export default router;
