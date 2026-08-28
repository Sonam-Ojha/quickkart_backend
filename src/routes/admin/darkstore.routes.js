const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireAdmin }  = require('../../middlewares/admin.middleware');
const ctrl = require('../../controllers/admin/darkstore.controller');

router.get('/',               authenticate, requireAdmin, ctrl.list);
router.get('/:id',            authenticate, requireAdmin, ctrl.detail);
router.get('/:id/stats',      authenticate, requireAdmin, ctrl.stats);
router.post('/',              authenticate, requireAdmin, ctrl.add);
router.put('/:id',            authenticate, requireAdmin, ctrl.edit);
router.patch('/:id/toggle',   authenticate, requireAdmin, ctrl.toggle);
router.delete('/:id',         authenticate, requireAdmin, ctrl.remove);

module.exports = router;
