const router = require('express').Router();
const { authenticate } = require('../../middlewares/auth.middleware');
const ctrl = require('../../controllers/admin/settings.controller');

router.get('/',  authenticate, ctrl.getAll);
router.post('/', authenticate, ctrl.upsertMany);

module.exports = router;
