const router = require('express').Router();
const ctrl   = require('../../controllers/app/wishlist.controller');
const { authenticateCustomer } = require('../../middlewares/customer.middleware');

router.use(authenticateCustomer);

// GET  /api/app/wishlist                      — list all wishlisted products
// POST /api/app/wishlist/:productId           — toggle (add / remove)
// GET  /api/app/wishlist/:productId/status    — check if wishlisted

router.get('/',                     ctrl.list);
router.post('/:productId',          ctrl.toggle);
router.get('/:productId/status',    ctrl.status);

module.exports = router;
