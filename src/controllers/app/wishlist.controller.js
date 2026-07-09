const Wishlist = require('../../models/wishlist.model');
const Product  = require('../../models/product.model');
const Category = require('../../models/category.model');

const formatProduct = (p) => ({
  id:            p.id,
  name:          p.name,
  weight:        p.unit      ?? '',
  price:         Math.round(p.price / 100),
  originalPrice: Math.round(p.mrp   / 100),
  img:           p.imageUrl  ?? '',
  badge:         p.tag       ?? null,
  category:      p.category?.name ?? '',
  inStock:       p.isActive,
});

// GET /api/app/wishlist  — list hearted products
const list = async (req, res) => {
  try {
    const rows = await Wishlist.findAll({
      where: { userId: req.user.id },
      include: [{
        model: Product, as: 'product',
        include: [{ model: Category, as: 'category', attributes: ['name'] }],
      }],
      order: [['created_at', 'DESC']],
    });
    return res.json(rows.filter(r => r.product).map(r => formatProduct(r.product)));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// POST /api/app/wishlist/:productId  — toggle (add if absent, remove if present)
const toggle = async (req, res) => {
  const productId = parseInt(req.params.productId, 10);
  if (!productId) return res.status(400).json({ message: 'Invalid product id' });

  try {
    const existing = await Wishlist.findOne({
      where: { userId: req.user.id, productId },
    });
    if (existing) {
      await existing.destroy();
      return res.json({ wishlisted: false });
    }
    await Wishlist.create({ userId: req.user.id, productId });
    return res.json({ wishlisted: true });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// GET /api/app/wishlist/:productId/status  — check single product
const status = async (req, res) => {
  const productId = parseInt(req.params.productId, 10);
  try {
    const row = await Wishlist.findOne({
      where: { userId: req.user.id, productId },
    });
    return res.json({ wishlisted: !!row });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = { list, toggle, status };
