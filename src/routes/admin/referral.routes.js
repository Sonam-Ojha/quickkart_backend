const express = require('express');
const router  = express.Router();
const { authenticate } = require('../../middlewares/auth.middleware');
const ctrl = require('../../controllers/admin/referral.controller');

router.get('/stats',    authenticate, ctrl.stats);
router.get('/',         authenticate, ctrl.list);
router.patch('/:id',    authenticate, ctrl.updateStatus);

module.exports = router;
