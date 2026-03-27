import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import validate from '../middleware/validate.js';
import { exportRules } from '../validators/exportValidators.js';
import { exportExcel, exportPDF } from '../controllers/exportController.js';

const router = Router();

router.use(authenticate);

router.get('/xlsx', exportRules, validate, exportExcel);
router.get('/pdf', exportRules, validate, exportPDF);

export default router;
