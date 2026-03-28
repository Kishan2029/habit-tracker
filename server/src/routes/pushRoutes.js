import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import catchAsync from '../utils/catchAsync.js';
import { subscribe, unsubscribe } from '../controllers/pushController.js';
import pushService from '../services/pushService.js';
import env from '../config/env.js';

const router = Router();

router.use(authenticate);

router.post('/subscribe', subscribe);
router.delete('/unsubscribe', unsubscribe);

// Dev-only: trigger a test push notification to the logged-in user
if (env.nodeEnv !== 'production') {
  router.post('/test', catchAsync(async (req, res) => {
    await pushService.sendNotification(req.user._id, {
      title: '🔔 Habit Tracker',
      body: "Don't forget to log your habits today!",
      url: '/',
      tag: 'test',
    });
    res.json({ success: true, message: 'Test notification sent' });
  }));
}

export default router;
