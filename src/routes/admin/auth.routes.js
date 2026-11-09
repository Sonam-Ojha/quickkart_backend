const express = require('express');
const router = express.Router();
const { register, login } = require('../../controllers/admin/auth.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireSuperAdmin } = require('../../middlewares/admin.middleware');

router.post('/register', authenticate, requireSuperAdmin, register);
router.post('/login', login);

module.exports = router;
