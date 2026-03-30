import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import validate from '../middleware/validate.js';
import { exportRules } from '../validators/exportValidators.js';
import { exportExcel, exportPDF } from '../controllers/exportController.js';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Export
 *   description: Data export endpoints
 */

/**
 * @swagger
 * /export/xlsx:
 *   get:
 *     summary: Export habits data to Excel
 *     tags: [Export]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: start
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *           example: "2025-01-01"
 *         description: Start date (YYYY-MM-DD)
 *       - in: query
 *         name: end
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *           example: "2025-01-31"
 *         description: End date (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Excel file download
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/xlsx', exportRules, validate, exportExcel);

/**
 * @swagger
 * /export/pdf:
 *   get:
 *     summary: Export habits data to PDF
 *     tags: [Export]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: start
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *           example: "2025-01-01"
 *         description: Start date (YYYY-MM-DD)
 *       - in: query
 *         name: end
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *           example: "2025-01-31"
 *         description: End date (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: PDF file download
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/pdf', exportRules, validate, exportPDF);

export default router;
