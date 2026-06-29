const express = require('express');
const router  = express.Router();
const { authenticateRider } = require('../../middlewares/rider.middleware');
const ctrl = require('../../controllers/rider/profile.controller');

router.get('/',                 authenticateRider, ctrl.getProfile);
router.put('/',                 authenticateRider, ctrl.updateProfile);
router.patch('/password',       authenticateRider, ctrl.changePassword);
router.patch('/toggle-online',  authenticateRider, ctrl.toggleOnline);

module.exports = router;
