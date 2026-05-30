const { body } = require('express-validator');

const registerValidator = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }).withMessage('Name cannot exceed 100 characters'),
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('organizationName').trim().notEmpty().withMessage('Organization name is required'),
];

const loginValidator = [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

const refreshValidator = [
  body('refreshToken').notEmpty().withMessage('Refresh token is required'),
];

module.exports = { registerValidator, loginValidator, refreshValidator };
