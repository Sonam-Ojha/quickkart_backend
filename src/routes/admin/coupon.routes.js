const express = require('express');
const router  = express.Router();
const { authenticate } = require('../../middlewares/auth.middleware');
const ctrl = require('../../controllers/admin/coupon.controller');

router.get('/',             authenticate, ctrl.list);
router.post('/',            authenticate, ctrl.create);
router.put('/:id',          authenticate, ctrl.update);
router.patch('/:id/toggle', authenticate, ctrl.toggle);
router.delete('/:id',       authenticate, ctrl.remove);

module.exports = router;
