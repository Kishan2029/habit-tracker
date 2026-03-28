import { body, param } from 'express-validator';

export const shareHabitRules = [
  body('habitId')
    .notEmpty()
    .withMessage('habitId is required')
    .isMongoId()
    .withMessage('Invalid habit ID'),
];

export const joinByCodeRules = [
  body('inviteCode')
    .trim()
    .notEmpty()
    .withMessage('Invite code is required')
    .isAlphanumeric()
    .withMessage('Invalid invite code format'),
];

export const inviteMemberRules = [
  body('habitId')
    .notEmpty()
    .withMessage('habitId is required')
    .isMongoId()
    .withMessage('Invalid habit ID'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('role')
    .optional()
    .isIn(['admin', 'member', 'viewer'])
    .withMessage('Role must be admin, member, or viewer'),
];

export const respondToInviteRules = [
  body('habitId')
    .notEmpty()
    .withMessage('habitId is required')
    .isMongoId()
    .withMessage('Invalid habit ID'),
  body('accept')
    .notEmpty()
    .withMessage('accept is required')
    .isBoolean()
    .withMessage('accept must be a boolean'),
];

export const updateRoleRules = [
  param('habitId')
    .isMongoId()
    .withMessage('Invalid habit ID'),
  param('userId')
    .isMongoId()
    .withMessage('Invalid user ID'),
  body('role')
    .notEmpty()
    .withMessage('Role is required')
    .isIn(['admin', 'member', 'viewer'])
    .withMessage('Role must be admin, member, or viewer'),
];

export const transferOwnershipRules = [
  param('habitId')
    .isMongoId()
    .withMessage('Invalid habit ID'),
  body('newOwnerId')
    .notEmpty()
    .withMessage('newOwnerId is required')
    .isMongoId()
    .withMessage('Invalid user ID'),
];

export const habitIdParamRules = [
  param('habitId')
    .isMongoId()
    .withMessage('Invalid habit ID'),
];

export const removeMemberRules = [
  param('habitId')
    .isMongoId()
    .withMessage('Invalid habit ID'),
  param('userId')
    .isMongoId()
    .withMessage('Invalid user ID'),
];
