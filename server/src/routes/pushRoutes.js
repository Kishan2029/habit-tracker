import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import { subscribe, unsubscribe } from '../controllers/pushController.js';

const router = Router();

router.use(authenticate);

router.post('/subscribe', subscribe);
router.delete('/unsubscribe', unsubscribe);

export default router;
