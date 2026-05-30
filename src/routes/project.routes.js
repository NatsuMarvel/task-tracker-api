const router = require('express').Router();
const { listProjects, createProject, getProject, updateProject, deleteProject } = require('../controllers/project.controller');
const { authenticate } = require('../middleware/auth');
const { managerOrAbove, allRoles } = require('../middleware/rbac');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');

const projectValidator = [
  body('name').optional().trim().notEmpty().withMessage('Project name cannot be empty').isLength({ max: 150 }),
  body('description').optional().trim().isLength({ max: 1000 }),
  body('members').optional().isArray().withMessage('members must be an array'),
  body('members.*').optional().isMongoId().withMessage('Each member must be a valid user ID'),
];

const createProjectValidator = [
  body('name').trim().notEmpty().withMessage('Project name is required').isLength({ max: 150 }),
  ...projectValidator.slice(1),
];

router.use(authenticate);

router.get('/', allRoles, listProjects);
router.post('/', managerOrAbove, createProjectValidator, validate, createProject);
router.get('/:id', allRoles, getProject);
router.patch('/:id', managerOrAbove, projectValidator, validate, updateProject);
router.delete('/:id', managerOrAbove, deleteProject);

module.exports = router;
