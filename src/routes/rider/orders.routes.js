const express = require('express');
const router  = express.Router();
const { authenticateRider } = require('../../middlewares/rider.middleware');
const ctrl = require('../../controllers/rider/orders.controller');

router.get('/',              authenticateRider, ctrl.myOrders);
router.get('/earnings',      authenticateRider, ctrl.earnings);
router.get('/:id',           authenticateRider, ctrl.orderDetail);
router.patch('/:id/status',  authenticateRider, ctrl.updateStatus);

module.exports = router;
