const Product  = require('../../models/product.model');
const Category = require('../../models/category.model');
const { Op }   = require('sequelize');

const list = async (req, res) => {
  try {
    const { category_id, limit = 20, offset = 0 } = req.query;
    const where = { is_active: true };
    if (category_id) where.category_id = category_id;

    const { rows, count } = await Product.findAndCountAll({
      where,
      include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }],
      limit: Number(limit),
      offset: Number(offset),
      order: [['created_at', 'DESC']],
    });

    return res.json({ products: rows, total: count });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const getById = async (req, res) => {
  try {
    const product = await Product.findOne({
      where: { id: req.params.id, is_active: true },
      include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }],
    });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    return res.json(product);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const search = async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;
    if (!q) return res.json([]);

    const products = await Product.findAll({
      where: {
        is_active: true,
        name: { [Op.like]: `%${q}%` },
      },
      limit: Number(limit),
    });
    return res.json(products);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = { list, getById, search };
