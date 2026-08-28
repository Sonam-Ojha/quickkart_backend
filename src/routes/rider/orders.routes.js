const express = require('express');
const router  = express.Router();
const { authenticateRider } = require('../../middlewares/rider.middleware');
const ctrl = require('../../controllers/rider/orders.controller');

router.use(authenticateRider);

// Literal paths must stay above '/:id', otherwise Express matches them as ids.
router.get('/',         ctrl.myOrders);
router.get('/offers',   ctrl.offers);
router.get('/earnings', ctrl.earnings);
router.get('/:id',      ctrl.orderDetail);

// ── Dispatch ────────────────────────────────────────────────
router.post('/:id/accept', ctrl.acceptOffer);
router.post('/:id/reject', ctrl.rejectOffer);

// ── Delivery flow: accepted → at_store → to_customer → at_customer → delivered
router.post('/:id/reached-store',      ctrl.reachedStore);
router.patch('/:id/items/:itemId',     ctrl.pickItem);
router.post('/:id/pickup',             ctrl.confirmPickup);
router.post('/:id/arrived',            ctrl.arrived);
router.post('/:id/deliver',            ctrl.deliver);
router.post('/:id/cancel',             ctrl.cancel);   // { reason }

module.exports = router;
