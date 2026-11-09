const { Op } = require('sequelize');
const Inventory = require('../models/inventory.model');
const Product   = require('../models/product.model');
const Category  = require('../models/category.model');
const { invalidateCatalogCache } = require('./storefront.service');

const getByStore = async (storeId, { search, lowStock } = {}) => {
  const productWhere = {};
  if (search) productWhere.name = { [Op.like]: `%${search}%` };

  // Push lowStock filter into SQL — avoids loading full store inventory into JS
  const inventoryWhere = { storeId };
  if (lowStock === 'true') inventoryWhere.stockQty = { [Op.lt]: 10 };

  return Inventory.findAll({
    where: inventoryWhere,
    include: [{
      model: Product,
      as: 'product',
      where: productWhere,
      include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }],
    }],
    order: [[{ model: Product, as: 'product' }, 'name', 'ASC']],
  });
};

const upsert = async (storeId, productId, stockQty) => {
  const [row, created] = await Inventory.findOrCreate({
    where: { storeId, productId },
    defaults: { stockQty },
  });
  if (!created) await row.update({ stockQty });
  invalidateCatalogCache(storeId);
  return row;
};

const adjust = async (storeId, productId, delta) => {
  const row = await Inventory.findOne({ where: { storeId, productId } });
  if (!row) throw new Error('Inventory entry not found');
  const newQty = Math.max(0, row.stockQty + delta);
  await row.update({ stockQty: newQty });
  invalidateCatalogCache(storeId);
  return row;
};

const remove = async (storeId, productId) => {
  const row = await Inventory.findOne({ where: { storeId, productId } });
  if (!row) throw new Error('Inventory entry not found');
  await row.destroy();
  invalidateCatalogCache(storeId);
};

const getByProduct = async (productId) => {
  const DarkStore = require('../models/darkstore.model');
  return Inventory.findAll({
    where: { productId },
    include: [{ model: DarkStore, as: 'store', attributes: ['id', 'name'] }],
  });
};

module.exports = { getByStore, getByProduct, upsert, adjust, remove };
