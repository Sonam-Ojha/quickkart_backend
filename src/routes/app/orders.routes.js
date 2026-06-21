const router = require('express').Router();
const ctrl   = require('../../controllers/app/orders.controller');
const { authenticateCustomer } = require('../../middlewares/customer.middleware');

router.use(authenticateCustomer);

// GET  /api/app/orders       — order history
// POST /api/app/orders       — place new order
// GET  /api/app/orders/:id   — order detail + tracking

router.get('/',    ctrl.list);
router.post('/',   ctrl.place);
router.get('/:id', ctrl.getById);

module.exports = router;
