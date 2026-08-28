const express = require('express');
const router  = express.Router();
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireAdmin } = require('../../middlewares/admin.middleware');
const ctrl = require('../../controllers/admin/rider-ops.controller');

router.use(authenticate, requireAdmin);

// Payouts
router.get('/payouts',       ctrl.listPayouts);    // ?state=processing|paid|failed&riderId=
router.patch('/payouts/:id', ctrl.updatePayout);   // { state, reference | failureReason }

// Support
router.get('/support',                 ctrl.supportThreads);
router.get('/support/:riderId',        ctrl.supportThread);
router.post('/support/:riderId',       ctrl.supportReply);   // { message }

// Money + notifications
router.post('/riders/:riderId/earnings', ctrl.addEarning);   // { amount, type, note }
router.post('/notify',                   ctrl.notify);       // { title, body, type?, riderIds? }

module.exports = router;
