const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middlewares/auth.middleware');
const ctrl = require('../../controllers/admin/address.controller');

router.get('/serviceability', authenticate, ctrl.checkServiceability);
router.get('/', authenticate, ctrl.getAll);
router.post('/', authenticate, ctrl.add);
router.put('/:id', authenticate, ctrl.edit);
router.delete('/:id', authenticate, ctrl.remove);

module.exports = router;
