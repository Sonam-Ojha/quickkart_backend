const express = require('express');
const router  = express.Router();
const { authenticateRider } = require('../../middlewares/rider.middleware');
const ctrl = require('../../controllers/rider/profile.controller');

router.get('/',                 authenticateRider, ctrl.getProfile);
router.put('/',                 authenticateRider, ctrl.updateProfile);
router.patch('/password',       authenticateRider, ctrl.changePassword);
router.patch('/toggle-online',  authenticateRider, ctrl.toggleOnline);
router.patch('/duty',           authenticateRider, ctrl.toggleOnline);
router.patch('/location',       authenticateRider, ctrl.updateLocation);

module.exports = router;
