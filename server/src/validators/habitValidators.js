import { body } from 'express-validator';
import { HABIT_TYPES, HABIT_CATEGORIES } from '../config/constants.js';

export const createHabitRules = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Habit name is required')
    .isLength({ max: 100 })
    .withMessage('Name must be at most 100 characters'),
  body('type')
    .optional()
    .isIn(Object.values(HABIT_TYPES))
    .withMessage('Type must be boolean or count'),
  body('unit')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Unit must be at most 50 characters'),
  body('target')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Target must be a positive integer'),
  body('color')
    .optional()
    .matches(/^#[0-9a-fA-F]{6}$/)
    .withMessage('Color must be a valid hex color'),
  body('icon')
    .optional()
    .isLength({ max: 10 })
    .withMessage('Icon must be at most 10 characters'),
  body('frequency')
    .optional()
    .isArray({ min: 1 })
    .withMessage('Frequency must be a non-empty array'),
  body('frequency.*')
    .optional()
    .isInt({ min: 0, max: 6 })
    .withMessage('Each frequency day must be 0-6'),
  body('category')
    .optional()
    .isIn(Object.values(HABIT_CATEGORIES))
    .withMessage('Invalid category'),
];

export const updateHabitRules = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Name cannot be empty')
    .isLength({ max: 100 })
    .withMessage('Name must be at most 100 characters'),
  body('type')
    .optional()
    .isIn(Object.values(HABIT_TYPES))
    .withMessage('Type must be boolean or count'),
  body('unit')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Unit must be at most 50 characters'),
  body('target')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Target must be a positive integer'),
  body('color')
    .optional()
    .matches(/^#[0-9a-fA-F]{6}$/)
    .withMessage('Color must be a valid hex color'),
  body('icon')
    .optional()
    .isLength({ max: 10 })
    .withMessage('Icon must be at most 10 characters'),
  body('frequency')
    .optional()
    .isArray({ min: 1 })
    .withMessage('Frequency must be a non-empty array'),
  body('frequency.*')
    .optional()
    .isInt({ min: 0, max: 6 })
    .withMessage('Each frequency day must be 0-6'),
  body('category')
    .optional()
    .isIn(Object.values(HABIT_CATEGORIES))
    .withMessage('Invalid category'),
];

export const reorderHabitRules = [
  body('items')
    .isArray({ min: 1 })
    .withMessage('Items must be a non-empty array'),
  body('items.*.id')
    .isMongoId()
    .withMessage('Each item must have a valid habit ID'),
  body('items.*.sortOrder')
    .isInt({ min: 0 })
    .withMessage('Each item must have a non-negative sortOrder'),
];
