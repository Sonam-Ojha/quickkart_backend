const Banner   = require('../../models/banner.model');
const Category = require('../../models/category.model');
const Product  = require('../../models/product.model');
const { Op }   = require('sequelize');

const getFeed = async (req, res) => {
  try {
    const [banners, categories, featured] = await Promise.all([
      Banner.findAll({ where: { is_active: true }, order: [['display_order', 'ASC']], limit: 5 }),
      Category.findAll({ where: { is_active: true }, limit: 8 }),
      Product.findAll({ where: { is_active: true }, order: [['created_at', 'DESC']], limit: 20 }),
    ]);

    return res.json({ banners, categories, featured });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = { getFeed };
