const express = require('express');
const multer  = require('multer');
const router = express.Router();
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireAdmin }  = require('../../middlewares/admin.middleware');
const ctrl = require('../../controllers/admin/catalog.controller');
const { Op } = require('sequelize');
const Product = require('../../models/product.model');
const s3 = require('../../services/s3.service');

const bulkUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    if (!['image/jpeg','image/jpg','image/png','image/webp'].includes(file.mimetype))
      return cb(new Error('Only JPG, PNG, WebP allowed'));
    cb(null, true);
  },
});

// POST /api/admin/catalog/products/bulk-upload-images
router.post('/products/bulk-upload-images', authenticate, requireAdmin,
  (req, res, next) => bulkUpload.array('images', 100)(req, res, next),
  async (req, res) => {
    if (!req.files?.length) return res.status(400).json({ message: 'No files uploaded' });

    const results = [];
    for (const file of req.files) {
      const originalName = file.originalname;
      const baseName = originalName.replace(/\.[^.]+$/, '').trim(); // strip extension

      let product = null;

      // 1. Try match by numeric ID
      if (/^\d+$/.test(baseName)) {
        product = await Product.findByPk(Number(baseName));
      }

      // 2. Try exact name match (case-insensitive)
      if (!product) {
        product = await Product.findOne({ where: { name: { [Op.like]: baseName } } });
      }

      // 3. Try partial name match
      if (!product) {
        product = await Product.findOne({ where: { name: { [Op.like]: `%${baseName}%` } } });
      }

      if (!product) {
        results.push({ file: originalName, status: 'no_match', message: 'No product found' });
        continue;
      }

      try {
        const { url } = await s3.uploadImage(file.buffer, String(product.id));
        await product.update({ imageUrl: url });
        results.push({ file: originalName, status: 'ok', productId: product.id, productName: product.name, imageUrl: url });
      } catch (err) {
        results.push({ file: originalName, status: 'error', productId: product.id, productName: product.name, message: err.message });
      }
    }

    return res.json({ results });
  }
);

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
router.get('/products/:id/store-visibility',  authenticate, requireAdmin, ctrl.getProductStoreVisibility);
router.put('/products/:id/store-visibility',  authenticate, requireAdmin, ctrl.setProductStoreVisibility);

module.exports = router;
