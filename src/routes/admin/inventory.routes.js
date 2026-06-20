const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middlewares/auth.middleware');
const ctrl = require('../../controllers/admin/inventory.controller');

router.get('/store/:storeId',                    authenticate, ctrl.listByStore);
router.post('/store/:storeId',                   authenticate, ctrl.setStock);
router.patch('/store/:storeId/adjust',           authenticate, ctrl.adjustStock);
router.delete('/store/:storeId/product/:productId', authenticate, ctrl.removeStock);

module.exports = router;
