const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireSuperAdmin } = require('../../middlewares/admin.middleware');
const ctrl = require('../../controllers/admin/users.controller');

router.use(authenticate, requireSuperAdmin);

router.get('/', ctrl.list);
router.post('/invite', ctrl.invite);
router.put('/:id', ctrl.update);

module.exports = router;
