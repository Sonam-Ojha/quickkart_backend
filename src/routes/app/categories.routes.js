const router = require('express').Router();
const ctrl   = require('../../controllers/app/categories.controller');
const { optionalAuth } = require('../../middlewares/customer.middleware');

// GET /api/app/categories                    — all categories
// GET /api/app/categories/:id/products       — products in a category

router.get('/',                  optionalAuth, ctrl.list);
router.get('/:id/products',      optionalAuth, ctrl.products);

module.exports = router;
