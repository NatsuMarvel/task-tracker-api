const router = require('express').Router();
const { register, login, refresh, logout, me } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const { registerValidator, loginValidator, refreshValidator } = require('../validators/auth.validator');
const { validate } = require('../middleware/validate');

router.post('/register', registerValidator, validate, register);
router.post('/login', loginValidator, validate, login);
router.post('/refresh', refreshValidator, validate, refresh);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, me);

module.exports = router;
