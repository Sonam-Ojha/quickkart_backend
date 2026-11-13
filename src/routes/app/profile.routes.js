const router = require('express').Router();
const ctrl   = require('../../controllers/app/profile.controller');
const { authenticateCustomer } = require('../../middlewares/customer.middleware');

router.use(authenticateCustomer);

// GET   /api/app/profile  — get customer profile
// PUT   /api/app/profile  — update name / email

router.get('/',         ctrl.get);
router.put('/',         ctrl.update);
router.post('/fcm-token', ctrl.saveFcmToken);
// User opts in to reopen notification — FCM token already saved, just acknowledge
router.post('/notify-reopen', (_req, res) => res.json({ ok: true }));

module.exports = router;
