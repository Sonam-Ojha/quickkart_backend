const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middlewares/auth.middleware');
const ctrl = require('../../controllers/admin/rider.controller');

router.get('/',                    authenticate, ctrl.list);
router.post('/',                   authenticate, ctrl.add);
router.put('/:id',                 authenticate, ctrl.edit);
router.patch('/:id/toggle',        authenticate, ctrl.toggle);
router.patch('/:id/set-password',  authenticate, ctrl.setPassword);
router.delete('/:id',              authenticate, ctrl.remove);

module.exports = router;
