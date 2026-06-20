const { Op } = require('sequelize');
const Inventory = require('../models/inventory.model');
const Product   = require('../models/product.model');
const Category  = require('../models/category.model');

const getByStore = async (storeId, { search, lowStock } = {}) => {
  const productWhere = {};
  if (search) productWhere.name = { [Op.like]: `%${search}%` };

  const rows = await Inventory.findAll({
    where: { storeId },
    include: [{
      model: Product,
      as: 'product',
      where: productWhere,
      include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }],
    }],
    order: [[{ model: Product, as: 'product' }, 'name', 'ASC']],
  });

  if (lowStock === 'true') return rows.filter(r => r.stockQty < 10);
  return rows;
};

const upsert = async (storeId, productId, stockQty) => {
  const [row, created] = await Inventory.findOrCreate({
    where: { storeId, productId },
    defaults: { stockQty },
  });
  if (!created) await row.update({ stockQty });
  return row;
};

const adjust = async (storeId, productId, delta) => {
  const row = await Inventory.findOne({ where: { storeId, productId } });
  if (!row) throw new Error('Inventory entry not found');
  const newQty = Math.max(0, row.stockQty + delta);
  await row.update({ stockQty: newQty });
  return row;
};

const remove = async (storeId, productId) => {
  const row = await Inventory.findOne({ where: { storeId, productId } });
  if (!row) throw new Error('Inventory entry not found');
  await row.destroy();
};

module.exports = { getByStore, upsert, adjust, remove };
