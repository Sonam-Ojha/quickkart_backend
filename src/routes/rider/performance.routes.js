const express = require('express');
const router  = express.Router();
const { authenticateRider } = require('../../middlewares/rider.middleware');
const ctrl = require('../../controllers/rider/earnings.controller');

router.use(authenticateRider);

router.get('/', ctrl.performance);

module.exports = router;
