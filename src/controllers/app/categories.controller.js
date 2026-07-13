const Category = require('../../models/category.model');
const Product  = require('../../models/product.model');
const { Op }   = require('sequelize');

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

const list = async (req, res) => {
  try {
    const categories = await Category.findAll({ where: { is_active: true }, order: [['name', 'ASC']] });
    return res.json(categories);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const products = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const category = await Category.findByPk(id);
    if (!category) return res.status(404).json({ message: 'Category not found' });

    const { rows, count } = await Product.findAndCountAll({
      where: { category_id: id, is_active: true },
      include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }],
      limit: Number(limit),
      offset: Number(offset),
      order: [['created_at', 'DESC']],
    });

    return res.json({ category, products: rows.map(formatProduct), total: count });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// Returns products from this category AND all its direct sub-categories
// GET /api/app/categories/:id/all-products
const allProducts = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const category = await Category.findByPk(id);
    if (!category) return res.status(404).json({ message: 'Category not found' });

    // get all sub-category ids + the parent itself
    const children = await Category.findAll({ where: { parent_id: id, is_active: true } });
    const catIds   = [Number(id), ...children.map((c) => c.id)];

    const { rows, count } = await Product.findAndCountAll({
      where:   { categoryId: { [Op.in]: catIds }, isActive: true },
      include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }],
      limit:   Number(limit),
      offset:  Number(offset),
      order:   [['created_at', 'DESC']],
    });

    return res.json({ category, subcategories: children, products: rows.map(formatProduct), total: count });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = { list, products, allProducts };
