const router = require('express').Router();
const { listTasks, createTask, getTask, updateTask, updateStatus, deleteTask } = require('../controllers/task.controller');
const { authenticate } = require('../middleware/auth');
const { managerOrAbove, allRoles } = require('../middleware/rbac');
const { createTaskValidator, updateTaskValidator, statusTransitionValidator, listTaskValidator } = require('../validators/task.validator');
const { validate } = require('../middleware/validate');

router.use(authenticate);

router.get('/', allRoles, listTaskValidator, validate, listTasks);
router.post('/', managerOrAbove, createTaskValidator, validate, createTask);
router.get('/:id', allRoles, getTask);
router.patch('/:id', allRoles, updateTaskValidator, validate, updateTask);
router.patch('/:id/status', allRoles, statusTransitionValidator, validate, updateStatus);
router.delete('/:id', managerOrAbove, deleteTask);

module.exports = router;
