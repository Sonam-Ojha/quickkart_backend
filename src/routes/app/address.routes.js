const router = require('express').Router();
const ctrl   = require('../../controllers/app/address.controller');
const { authenticateCustomer } = require('../../middlewares/customer.middleware');

router.use(authenticateCustomer);

// GET    /api/app/addresses       — list saved addresses
// POST   /api/app/addresses       — add new address
// PUT    /api/app/addresses/:id   — update address
// DELETE /api/app/addresses/:id   — delete address

router.get('/',      ctrl.list);
router.post('/',     ctrl.create);
router.put('/:id',   ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
