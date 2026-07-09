const router = require('express').Router();
const ctrl   = require('../../controllers/app/cart.controller');
const { authenticateCustomer } = require('../../middlewares/customer.middleware');

router.use(authenticateCustomer);

// GET    /api/app/cart  — fetch saved cart
// PUT    /api/app/cart  — full sync (replace all items)
// DELETE /api/app/cart  — clear cart

router.get('/',    ctrl.get);
router.put('/',    ctrl.sync);
router.delete('/', ctrl.clear);

module.exports = router;
