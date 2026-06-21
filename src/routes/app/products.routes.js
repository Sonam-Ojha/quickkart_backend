const router = require('express').Router();
const ctrl   = require('../../controllers/app/products.controller');
const { optionalAuth } = require('../../middlewares/customer.middleware');

// GET /api/app/products         — list / search
// GET /api/app/products/:id     — product detail
// GET /api/app/products/search  — search by query

router.get('/search', optionalAuth, ctrl.search);
router.get('/',       optionalAuth, ctrl.list);
router.get('/:id',    optionalAuth, ctrl.getById);

module.exports = router;
