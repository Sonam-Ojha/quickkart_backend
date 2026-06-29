const Product  = require('../../models/product.model');
const Category = require('../../models/category.model');
const { Op }   = require('sequelize');

const formatProduct = (p) => ({
  id:            p.id,
  name:          p.name,
  weight:        p.unit    ?? '',
  price:         Math.round(p.price / 100),
  originalPrice: Math.round(p.mrp   / 100),
  img:           p.imageUrl ?? '',
  badge:         p.tag      ?? null,
  category:      p.category?.name ?? '',
  inStock:       p.isActive,
});

// GET /api/app/products?tag=deal|bestseller|new&category_name=Fresh&category_id=1&limit=12&offset=0
const list = async (req, res) => {
  try {
    const { tag, category_id, category_name, q, limit = 20, offset = 0 } = req.query;
    const where = { isActive: true };
    if (tag)         where.tag        = tag;
    if (category_id) where.categoryId = category_id;
    if (q)           where.name       = { [Op.like]: `%${q}%` };

    const includeWhere = {};
    if (category_name) includeWhere.name = category_name;

    const { rows, count } = await Product.findAndCountAll({
      where,
      include: [{
        model: Category, as: 'category',
        attributes: ['id', 'name'],
        where: Object.keys(includeWhere).length ? includeWhere : undefined,
      }],
      limit:  Number(limit),
      offset: Number(offset),
      order:  [['created_at', 'DESC']],
    });

    return res.json({ products: rows.map(formatProduct), total: count });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// GET /api/app/products/:id
const getById = async (req, res) => {
  try {
    const product = await Product.findOne({
      where: { id: req.params.id, isActive: true },
      include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }],
    });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    return res.json(formatProduct(product));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// GET /api/app/products/search?q=...
const search = async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;
    if (!q) return res.json([]);

    const products = await Product.findAll({
      where: { isActive: true, name: { [Op.like]: `%${q}%` } },
      include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }],
      limit: Number(limit),
    });
    return res.json(products.map(formatProduct));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = { list, getById, search };
