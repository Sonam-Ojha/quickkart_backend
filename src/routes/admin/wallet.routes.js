const express = require('express');
const router  = express.Router();
const { authenticate } = require('../../middlewares/auth.middleware');
const ctrl = require('../../controllers/admin/wallet.controller');
router.get('/stats', authenticate, ctrl.stats);
router.get('/',      authenticate, ctrl.list);
module.exports = router;
