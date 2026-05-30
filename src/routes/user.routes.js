const router = require('express').Router();
const { listUsers, getUser, updateUser, deleteUser } = require('../controllers/user.controller');
const { authenticate } = require('../middleware/auth');
const { adminOnly } = require('../middleware/rbac');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');

const updateUserValidator = [
  body('role').optional().isIn(['ADMIN', 'MANAGER', 'MEMBER']).withMessage('Invalid role'),
  body('isActive').optional().isBoolean().withMessage('isActive must be boolean'),
];

router.use(authenticate, adminOnly);

router.get('/', listUsers);
router.get('/:id', getUser);
router.patch('/:id', updateUserValidator, validate, updateUser);
router.delete('/:id', deleteUser);

module.exports = router;
