const router = require('express').Router();
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireAdmin }  = require('../../middlewares/admin.middleware');
const ctrl = require('../../controllers/admin/info-page.controller');

router.get('/',     authenticate, requireAdmin, ctrl.list);
router.get('/:id',  authenticate, requireAdmin, ctrl.get);
router.post('/',    authenticate, requireAdmin, ctrl.create);
router.put('/:id',  authenticate, requireAdmin, ctrl.update);
router.delete('/:id', authenticate, requireAdmin, ctrl.remove);

module.exports = router;
