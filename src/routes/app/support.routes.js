const express = require('express');
const router  = express.Router();
const { authenticate } = require('../../middlewares/auth.middleware');
const ctrl = require('../../controllers/app/support.controller');

router.post('/',               authenticate, ctrl.createTicket);
router.get('/',                authenticate, ctrl.listTickets);
router.get('/:id',             authenticate, ctrl.getTicket);
router.post('/:id/messages',   authenticate, ctrl.sendMessage);

module.exports = router;
