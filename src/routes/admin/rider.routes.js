const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireAdmin }  = require('../../middlewares/admin.middleware');
const ctrl = require('../../controllers/admin/rider.controller');

router.get('/',                    authenticate, requireAdmin, ctrl.list);
router.post('/',                   authenticate, requireAdmin, ctrl.add);
router.put('/:id',                 authenticate, requireAdmin, ctrl.edit);
router.patch('/:id/toggle',        authenticate, requireAdmin, ctrl.toggle);
router.patch('/:id/set-password',  authenticate, requireAdmin, ctrl.setPassword);
router.get('/:id/documents',              authenticate, requireAdmin, ctrl.listDocuments);
router.patch('/:id/documents/:docId',     authenticate, requireAdmin, ctrl.reviewDocument);
router.delete('/:id',              authenticate, requireAdmin, ctrl.remove);

module.exports = router;
