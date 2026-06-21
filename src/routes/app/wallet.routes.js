const router = require('express').Router();
const ctrl   = require('../../controllers/app/wallet.controller');
const { authenticateCustomer } = require('../../middlewares/customer.middleware');

router.use(authenticateCustomer);

// GET /api/app/wallet            — balance + recent transactions
// GET /api/app/wallet/history    — full transaction history

router.get('/',        ctrl.getBalance);
router.get('/history', ctrl.getHistory);

module.exports = router;
