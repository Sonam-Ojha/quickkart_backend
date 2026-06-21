const router  = require('express').Router();
const ctrl    = require('../../controllers/app/auth.controller');

// POST /api/app/auth/register
router.post('/register', ctrl.register);

// POST /api/app/auth/login
router.post('/login', ctrl.login);

// POST /api/app/auth/refresh
router.post('/refresh', ctrl.refresh);

module.exports = router;
