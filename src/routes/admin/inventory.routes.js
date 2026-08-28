const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireAdmin }  = require('../../middlewares/admin.middleware');
const ctrl = require('../../controllers/admin/inventory.controller');

router.get('/store/:storeId',                    authenticate, requireAdmin, ctrl.listByStore);
router.post('/store/:storeId',                   authenticate, requireAdmin, ctrl.setStock);
router.patch('/store/:storeId/adjust',           authenticate, requireAdmin, ctrl.adjustStock);
router.delete('/store/:storeId/product/:productId', authenticate, requireAdmin, ctrl.removeStock);

module.exports = router;
