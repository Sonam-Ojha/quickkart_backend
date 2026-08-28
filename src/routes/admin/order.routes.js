const express = require('express');
const router  = express.Router();
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireAdmin }  = require('../../middlewares/admin.middleware');
const ctrl = require('../../controllers/admin/order.controller');

router.get('/stats',               authenticate, requireAdmin, ctrl.stats);
router.get('/',                    authenticate, requireAdmin, ctrl.list);
router.get('/:id',                 authenticate, requireAdmin, ctrl.detail);
router.patch('/:id/status',        authenticate, requireAdmin, ctrl.updateStatus);
router.patch('/:id/assign-rider',  authenticate, requireAdmin, ctrl.assignRider);
router.post('/:id/dispatch',       authenticate, requireAdmin, ctrl.redispatch);

module.exports = router;
