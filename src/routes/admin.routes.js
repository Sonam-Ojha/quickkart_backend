const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const { requireSuperAdmin } = require('../middlewares/admin.middleware');
const ctrl = require('../controllers/admin-users.controller');

router.use(authenticate, requireSuperAdmin);

router.get('/users', ctrl.list);
router.post('/users/invite', ctrl.invite);
router.put('/users/:id', ctrl.update);

module.exports = router;
