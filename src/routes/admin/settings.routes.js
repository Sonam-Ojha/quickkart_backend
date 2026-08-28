const router = require('express').Router();
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireAdmin }  = require('../../middlewares/admin.middleware');
const ctrl = require('../../controllers/admin/settings.controller');

router.get('/',  authenticate, requireAdmin, ctrl.getAll);
router.post('/', authenticate, requireAdmin, ctrl.upsertMany);

module.exports = router;
