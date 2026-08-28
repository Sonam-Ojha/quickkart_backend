const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireAdmin }  = require('../../middlewares/admin.middleware');
const ctrl = require('../../controllers/admin/address.controller');

router.get('/serviceability', authenticate, requireAdmin, ctrl.checkServiceability);
router.get('/', authenticate, requireAdmin, ctrl.getAll);
router.post('/', authenticate, requireAdmin, ctrl.add);
router.put('/:id', authenticate, requireAdmin, ctrl.edit);
router.delete('/:id', authenticate, requireAdmin, ctrl.remove);

module.exports = router;
