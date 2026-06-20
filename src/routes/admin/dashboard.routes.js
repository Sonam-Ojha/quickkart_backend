const express = require('express');
const router  = express.Router();
const { authenticate } = require('../../middlewares/auth.middleware');
const ctrl = require('../../controllers/admin/dashboard.controller');
router.get('/', authenticate, ctrl.getData);
module.exports = router;
