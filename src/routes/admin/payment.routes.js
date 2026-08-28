const express = require('express');
const router  = express.Router();
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireAdmin }  = require('../../middlewares/admin.middleware');
const ctrl = require('../../controllers/admin/payment.controller');
router.get('/stats', authenticate, requireAdmin, ctrl.stats);
router.get('/',      authenticate, requireAdmin, ctrl.list);
module.exports = router;
