const express = require('express');
const router  = express.Router();
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireAdmin }  = require('../../middlewares/admin.middleware');
const ctrl = require('../../controllers/admin/coupon.controller');

router.get('/',             authenticate, requireAdmin, ctrl.list);
router.post('/',            authenticate, requireAdmin, ctrl.create);
router.put('/:id',          authenticate, requireAdmin, ctrl.update);
router.patch('/:id/toggle', authenticate, requireAdmin, ctrl.toggle);
router.delete('/:id',       authenticate, requireAdmin, ctrl.remove);

module.exports = router;
