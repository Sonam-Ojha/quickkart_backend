const Category  = require('../../models/category.model');
const Product   = require('../../models/product.model');
const Inventory = require('../../models/inventory.model');
const { findNearestStore } = require('../../services/darkstore.service');
const { Op } = require('sequelize');

const formatProduct = (p, stockMap) => {
  const stock   = stockMap && p.id in stockMap ? stockMap[p.id] : 0;
  const inStock = p.isActive && stock > 0;
  return {
    id:            p.id,
    name:          p.name,
    weight:        p.unit      ?? '',
    price:         Math.round(p.price / 100),
    originalPrice: Math.round(p.mrp   / 100),
    img:           p.imageUrl  ?? '',
    badge:         p.tag       ?? null,
    category:      p.category?.name ?? '',
    inStock,
    stock,
  };
};

// Returns productIds assigned to a store (have inventory record).
async function getAssignedProductIds(storeId) {
  if (!storeId) return null; // null = no filter
  const rows = await Inventory.findAll({ where: { storeId }, attributes: ['productId'] });
  return rows.map(r => r.productId);
}

async function buildStockMap(productIds, storeId) {
  if (!storeId || !productIds.length) return {};
  const rows = await Inventory.findAll({
    where: { storeId, productId: { [Op.in]: productIds } },
    attributes: ['productId', 'stockQty'],
  });
  const map = {};
  for (const r of rows) map[r.productId] = r.stockQty;
  return map;
}

async function resolveStore(lat, lng) {
  const { store } = await findNearestStore(lat, lng);
  return store?.id ?? null;
}

// GET /api/app/categories?section=grocery|fresh  (no section → all)
const list = async (req, res) => {
  try {
    const where = { is_active: true };
    if (['grocery', 'fresh'].includes(req.query.section)) where.section = req.query.section;
    const categories = await Category.findAll({ where, order: [['name', 'ASC']] });

    const storeId    = await resolveStore(req.query.lat, req.query.lng);
    const assignedIds = await getAssignedProductIds(storeId);

    const productWhere = { isActive: true };
    if (assignedIds !== null) productWhere.id = { [Op.in]: assignedIds };

    const products = await Product.findAll({
      where: productWhere,
      attributes: ['id', 'categoryId', 'imageUrl'],
      order: [['created_at', 'DESC']],
    });

    const byCategory = {};
    for (const p of products) {
      if (!byCategory[p.categoryId]) byCategory[p.categoryId] = [];
      byCategory[p.categoryId].push(p);
    }

    const childrenOf = {};
    for (const c of categories) {
      if (c.parentId == null) continue;
      if (!childrenOf[c.parentId]) childrenOf[c.parentId] = [];
      childrenOf[c.parentId].push(c.id);
    }
    const subtreeIds = (id) => [id, ...(childrenOf[id] || []).flatMap(subtreeIds)];

    const result = categories.map((c) => {
      const items = subtreeIds(c.id).flatMap((id) => byCategory[id] || []);
      return {
        ...c.toJSON(),
        productCount:  items.length,
        previewImages: items.slice(0, 4).map((p) => p.imageUrl).filter(Boolean),
      };
    });

    return res.json(result);
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

    const storeId     = await resolveStore(req.query.lat, req.query.lng);
    const assignedIds = await getAssignedProductIds(storeId);

    const where = { category_id: id, is_active: true };
    if (assignedIds !== null) where.id = { [Op.in]: assignedIds };

    const { rows, count } = await Product.findAndCountAll({
      where,
      include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }],
      limit: Number(limit),
      offset: Number(offset),
      order: [['created_at', 'DESC']],
    });

    const stockMap = await buildStockMap(rows.map(p => p.id), storeId);
    return res.json({ category, products: rows.map(p => formatProduct(p, stockMap)), total: count });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// GET /api/app/categories/:id/all-products
const allProducts = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const category = await Category.findByPk(id);
    if (!category) return res.status(404).json({ message: 'Category not found' });

    const children = await Category.findAll({ where: { parent_id: id, is_active: true } });
    const catIds   = [Number(id), ...children.map((c) => c.id)];

    const storeId     = await resolveStore(req.query.lat, req.query.lng);
    const assignedIds = await getAssignedProductIds(storeId);

    const where = { categoryId: { [Op.in]: catIds }, isActive: true };
    if (assignedIds !== null) where.id = { [Op.in]: assignedIds };

    const { rows, count } = await Product.findAndCountAll({
      where,
      include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }],
      limit:  Number(limit),
      offset: Number(offset),
      order:  [['created_at', 'DESC']],
    });

    const stockMap = await buildStockMap(rows.map(p => p.id), storeId);
    return res.json({ category, subcategories: children, products: rows.map(p => formatProduct(p, stockMap)), total: count });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = { list, products, allProducts };
