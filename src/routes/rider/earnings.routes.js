const express = require('express');
const router  = express.Router();
const { authenticateRider } = require('../../middlewares/rider.middleware');
const ctrl = require('../../controllers/rider/earnings.controller');

router.use(authenticateRider);

router.get('/',        ctrl.list);      // ?range=today|week|month|all
router.get('/summary', ctrl.summary);

module.exports = router;
