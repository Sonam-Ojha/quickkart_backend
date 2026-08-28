const express = require('express');
const router  = express.Router();
const { authenticateRider } = require('../../middlewares/rider.middleware');
const ctrl = require('../../controllers/rider/profile.controller');

router.use(authenticateRider);

router.get('/',           ctrl.getProfile);
router.put('/',           ctrl.updateProfile);
router.patch('/password', ctrl.changePassword);
router.patch('/location', ctrl.updateLocation);
router.put('/bank',       ctrl.updateBank);

// Explicit set: { online: true|false }. Both paths hit the same handler; the
// toggle name is kept so the existing client build doesn't break.
router.patch('/duty',          ctrl.setDuty);
router.patch('/toggle-online', ctrl.setDuty);

module.exports = router;
