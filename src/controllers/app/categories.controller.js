const Category = require('../../models/category.model');
const Product  = require('../../models/product.model');

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
      limit: Number(limit),
      offset: Number(offset),
    });

    return res.json({ category, products: rows, total: count });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = { list, products };
