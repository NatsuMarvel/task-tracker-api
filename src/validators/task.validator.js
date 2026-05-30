const { body, query, param } = require('express-validator');

const createTaskValidator = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }).withMessage('Title cannot exceed 200 characters'),
  body('description').optional().trim().isLength({ max: 2000 }).withMessage('Description cannot exceed 2000 characters'),
  body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH']).withMessage('Priority must be LOW, MEDIUM, or HIGH'),
  body('assignee').optional().isMongoId().withMessage('assignee must be a valid user ID'),
  body('due_date')
    .optional()
    .isISO8601()
    .withMessage('due_date must be a valid ISO date')
    .custom((val) => {
      if (new Date(val) <= new Date()) throw new Error('due_date must be a future date');
      return true;
    }),
  body('project').optional().isMongoId().withMessage('project must be a valid project ID'),
];

const updateTaskValidator = [
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty').isLength({ max: 200 }).withMessage('Title cannot exceed 200 characters'),
  body('description').optional().trim().isLength({ max: 2000 }).withMessage('Description cannot exceed 2000 characters'),
  body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH']).withMessage('Priority must be LOW, MEDIUM, or HIGH'),
  body('assignee').optional().isMongoId().withMessage('assignee must be a valid user ID'),
  body('due_date')
    .optional()
    .isISO8601()
    .withMessage('due_date must be a valid ISO date')
    .custom((val) => {
      if (new Date(val) <= new Date()) throw new Error('due_date must be a future date');
      return true;
    }),
];

const statusTransitionValidator = [
  body('status')
    .notEmpty().withMessage('status is required')
    .isIn(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED'])
    .withMessage('status must be one of: TODO, IN_PROGRESS, IN_REVIEW, DONE, BLOCKED'),
];

const listTaskValidator = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer').toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100').toInt(),
  query('status').optional().isIn(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED']).withMessage('Invalid status filter'),
  query('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH']).withMessage('Invalid priority filter'),
  query('assignee').optional().isMongoId().withMessage('assignee must be a valid user ID'),
];

module.exports = { createTaskValidator, updateTaskValidator, statusTransitionValidator, listTaskValidator };
