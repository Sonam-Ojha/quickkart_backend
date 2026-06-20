const express = require('express');
const router  = express.Router();
const { authenticate } = require('../../middlewares/auth.middleware');
const ctrl = require('../../controllers/admin/order.controller');

router.get('/stats',          authenticate, ctrl.stats);
router.get('/',               authenticate, ctrl.list);
router.get('/:id',            authenticate, ctrl.detail);
router.patch('/:id/status',   authenticate, ctrl.updateStatus);

module.exports = router;
