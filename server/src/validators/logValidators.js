import { body, query } from 'express-validator';

export const createLogRules = [
  body('habitId')
    .notEmpty()
    .withMessage('Habit ID is required')
    .isMongoId()
    .withMessage('Invalid habit ID'),
  body('date')
    .notEmpty()
    .withMessage('Date is required')
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('Date must be in YYYY-MM-DD format'),
  body('value')
    .notEmpty()
    .withMessage('Value is required')
    .custom((value) => {
      if (typeof value !== 'boolean' && (typeof value !== 'number' || value < 0)) {
        throw new Error('Value must be a boolean or a non-negative number');
      }
      return true;
    }),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes must be at most 500 characters'),
];

export const dailyQueryRules = [
  query('date')
    .notEmpty()
    .withMessage('Date is required')
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('Date must be in YYYY-MM-DD format'),
];

export const monthlyQueryRules = [
  query('month')
    .notEmpty()
    .withMessage('Month is required')
    .isInt({ min: 1, max: 12 })
    .withMessage('Month must be between 1 and 12'),
  query('year')
    .notEmpty()
    .withMessage('Year is required')
    .isInt({ min: 2020, max: 2100 })
    .withMessage('Year must be between 2020 and 2100'),
];

export const yearlyQueryRules = [
  query('year')
    .notEmpty()
    .withMessage('Year is required')
    .isInt({ min: 2020, max: 2100 })
    .withMessage('Year must be between 2020 and 2100'),
];

export const rangeQueryRules = [
  query('start')
    .notEmpty()
    .withMessage('Start date is required')
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('Start date must be in YYYY-MM-DD format'),
  query('end')
    .notEmpty()
    .withMessage('End date is required')
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('End date must be in YYYY-MM-DD format'),
];
