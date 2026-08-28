const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireAdmin }  = require('../../middlewares/admin.middleware');
const ctrl = require('../../controllers/admin/catalog.controller');

// Categories
router.get('/categories',                authenticate, requireAdmin, ctrl.listCategories);
router.post('/categories',               authenticate, requireAdmin, ctrl.addCategory);
router.post('/categories/bulk-create',   authenticate, requireAdmin, ctrl.bulkCreateCategories);
router.patch('/categories/bulk',         authenticate, requireAdmin, ctrl.bulkUpdateCategories);
router.delete('/categories/bulk',        authenticate, requireAdmin, ctrl.bulkDeleteCategories);
router.put('/categories/:id',            authenticate, requireAdmin, ctrl.editCategory);
router.delete('/categories/:id',         authenticate, requireAdmin, ctrl.removeCategory);
router.patch('/categories/:id/toggle',   authenticate, requireAdmin, ctrl.toggleCategory);

// Products
router.get('/products',                authenticate, requireAdmin, ctrl.listProducts);
router.post('/products',               authenticate, requireAdmin, ctrl.addProduct);
router.post('/products/bulk-create',   authenticate, requireAdmin, ctrl.bulkCreateProducts);
router.patch('/products/bulk',         authenticate, requireAdmin, ctrl.bulkUpdateProducts);
router.delete('/products/bulk',        authenticate, requireAdmin, ctrl.bulkDeleteProducts);
router.put('/products/:id',            authenticate, requireAdmin, ctrl.editProduct);
router.delete('/products/:id',         authenticate, requireAdmin, ctrl.removeProduct);
router.patch('/products/:id/toggle',   authenticate, requireAdmin, ctrl.toggleProduct);

module.exports = router;
