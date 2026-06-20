const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middlewares/auth.middleware');
const ctrl = require('../../controllers/admin/catalog.controller');

// Categories
router.get('/categories',              authenticate, ctrl.listCategories);
router.post('/categories',             authenticate, ctrl.addCategory);
router.put('/categories/:id',          authenticate, ctrl.editCategory);
router.delete('/categories/:id',       authenticate, ctrl.removeCategory);
router.patch('/categories/:id/toggle', authenticate, ctrl.toggleCategory);

// Products
router.get('/products',              authenticate, ctrl.listProducts);
router.post('/products',             authenticate, ctrl.addProduct);
router.put('/products/:id',          authenticate, ctrl.editProduct);
router.delete('/products/:id',       authenticate, ctrl.removeProduct);
router.patch('/products/:id/toggle', authenticate, ctrl.toggleProduct);

module.exports = router;
