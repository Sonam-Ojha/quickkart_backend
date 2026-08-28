const express = require('express');
const router  = express.Router();
const { authenticateRider } = require('../../middlewares/rider.middleware');
const ctrl = require('../../controllers/rider/support.controller');

router.use(authenticateRider);

router.get('/messages',  ctrl.list);
router.post('/messages', ctrl.send);   // { message }

module.exports = router;
