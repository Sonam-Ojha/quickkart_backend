const router = require('express').Router();
const ctrl   = require('../../controllers/app/coupons.controller');
const { authenticateCustomer } = require('../../middlewares/customer.middleware');

router.use(authenticateCustomer);

// POST /api/app/coupons/validate  — check if coupon is valid + return discount
router.post('/validate', ctrl.validate);

module.exports = router;
