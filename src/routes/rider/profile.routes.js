const express = require('express');
const router  = express.Router();
const { authenticateRider } = require('../../middlewares/rider.middleware');
const ctrl = require('../../controllers/rider/profile.controller');

router.get('/',                 authenticateRider, ctrl.getProfile);
router.put('/',                 authenticateRider, ctrl.updateProfile);
router.patch('/password',       authenticateRider, ctrl.changePassword);
router.patch('/toggle-online',  authenticateRider, ctrl.toggleOnline);
router.patch('/location',       authenticateRider, ctrl.updateLocation);
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
