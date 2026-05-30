const router = require('express').Router();
const { taskAnalytics } = require('../controllers/analytics.controller');
const { authenticate } = require('../middleware/auth');
const { managerOrAbove } = require('../middleware/rbac');

router.get('/tasks', authenticate, managerOrAbove, taskAnalytics);

module.exports = router;
