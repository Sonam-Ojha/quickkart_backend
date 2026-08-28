const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireAdmin }  = require('../../middlewares/admin.middleware');
const ctrl = require('../../controllers/admin/customer.controller');

router.get('/',                  authenticate, requireAdmin, ctrl.list);
router.get('/:id',               authenticate, requireAdmin, ctrl.detail);
router.patch('/:id/toggle-block', authenticate, requireAdmin, ctrl.toggleBlock);

module.exports = router;
