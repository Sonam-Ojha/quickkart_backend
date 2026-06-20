const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middlewares/auth.middleware');
const ctrl = require('../../controllers/admin/darkstore.controller');

router.get('/',               authenticate, ctrl.list);
router.get('/:id',            authenticate, ctrl.detail);
router.get('/:id/stats',      authenticate, ctrl.stats);
router.post('/',              authenticate, ctrl.add);
router.put('/:id',            authenticate, ctrl.edit);
router.patch('/:id/toggle',   authenticate, ctrl.toggle);
router.delete('/:id',         authenticate, ctrl.remove);

module.exports = router;
