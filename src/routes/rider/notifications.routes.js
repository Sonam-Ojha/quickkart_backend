const express = require('express');
const router  = express.Router();
const { authenticateRider } = require('../../middlewares/rider.middleware');
const ctrl = require('../../controllers/rider/notifications.controller');

router.use(authenticateRider);

router.get('/',            ctrl.list);
router.patch('/read-all',  ctrl.markAllRead);   // above '/:id' so it isn't read as an id
router.patch('/:id/read',  ctrl.markRead);

module.exports = router;
