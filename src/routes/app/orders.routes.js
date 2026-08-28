const router = require('express').Router();
const ctrl   = require('../../controllers/app/orders.controller');
const { authenticateCustomer } = require('../../middlewares/customer.middleware');

router.use(authenticateCustomer);

router.get('/',          ctrl.list);
router.post('/',         ctrl.place);
router.get('/:id',       ctrl.getById);
router.patch('/:id/cancel', ctrl.cancel);

module.exports = router;
