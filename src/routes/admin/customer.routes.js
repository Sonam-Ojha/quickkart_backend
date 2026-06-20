const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middlewares/auth.middleware');
const ctrl = require('../../controllers/admin/customer.controller');

router.get('/',                  authenticate, ctrl.list);
router.get('/:id',               authenticate, ctrl.detail);
router.patch('/:id/toggle-block', authenticate, ctrl.toggleBlock);

module.exports = router;
