const router = require('express').Router();
const ctrl   = require('../../controllers/app/membership.controller');
const { authenticateCustomer } = require('../../middlewares/customer.middleware');

router.use(authenticateCustomer);

// GET  /api/app/membership           — check active membership
// POST /api/app/membership/subscribe — create / renew membership

router.get('/',          ctrl.get);
router.post('/subscribe', ctrl.subscribe);

module.exports = router;
