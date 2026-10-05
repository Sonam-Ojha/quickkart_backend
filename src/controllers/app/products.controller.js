const Product       = require('../../models/product.model');
const Category      = require('../../models/category.model');
const Inventory     = require('../../models/inventory.model');
const ProductStoreVisibility = require('../../models/product-store-visibility.model');
const { findNearestStore } = require('../../services/darkstore.service');
const { Op, literal } = require('sequelize');

// Resolve the best store for a given customer location.
// Returns { storeId, serviceable } where serviceable=false means
// lat/lng were given but no store covers this area.
async function resolveStore(lat, lng) {
  const { store, fallback } = await findNearestStore(lat, lng);
  if (!store && !fallback) {
    // lat/lng given but no store in radius → not serviceable
    return { storeId: null, serviceable: false };
  }
  return { storeId: store?.id ?? null, serviceable: true };
}

// Returns productId filter: only products assigned to this store (have an inventory record).
// If storeId is null, returns {} (no filter — show all, e.g. admin preview).
async function buildStoreFilter(storeId) {
  if (!storeId) return {};
  const rows = await Inventory.findAll({
    where: { storeId },
    attributes: ['productId'],
  });
  if (!rows.length) return { id: { [Op.in]: [] } }; // store exists but no products assigned
  return { id: { [Op.in]: rows.map(r => r.productId) } };
}

// Build a productId → stockQty map for a list of products from the active store.
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

const formatProduct = (p, stockMap) => {
  const stock    = stockMap && p.id in stockMap ? stockMap[p.id] : 0;
  const inStock  = p.isActive && stock > 0;
  return {
    id:            p.id,
    name:          p.name,
    weight:        p.unit    ?? '',
    price:         Math.round(p.price / 100),
    originalPrice: Math.round(p.mrp   / 100),
    img:           p.imageUrl ?? '',
    badge:         p.tag      ?? null,
    category:      p.category?.name ?? '',
    inStock,
    stock,          // null = unlimited, 0 = out of stock, N = available qty
  };
};

// GET /api/app/products?tag=deal|bestseller|new&category_name=Fresh&category_id=1&section=fresh&limit=12&offset=0
const list = async (req, res) => {
  try {
    const { tag, category_id, category_name, section, q, limit = 20, offset = 0 } = req.query;
    const { storeId, serviceable } = await resolveStore(req.query.lat, req.query.lng);

    if (!serviceable) {
      return res.json({ products: [], total: 0, serviceable: false });
    }

    const visFilter = await buildStoreFilter(storeId);

    const where = { isActive: true, ...visFilter };
    if (tag)         where.tag        = tag;
    if (category_id) where.categoryId = category_id;
    if (q)           where.name       = { [Op.like]: `%${q}%` };

    const includeWhere = {};
    if (category_name) includeWhere.name = category_name;
    if (['grocery', 'fresh'].includes(section)) includeWhere.section = section;

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

    const stockMap = await buildStockMap(rows.map(p => p.id), storeId);
    return res.json({ products: rows.map(p => formatProduct(p, stockMap)), total: count, serviceable: true });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// GET /api/app/products/:id
const getById = async (req, res) => {
  try {
    const { storeId } = await resolveStore(req.query.lat, req.query.lng);
    const visFilter = await buildStoreFilter(storeId);

    const product = await Product.findOne({
      where: { id: req.params.id, isActive: true, ...visFilter },
      include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }],
    });
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const stockMap = await buildStockMap([product.id], storeId);
    return res.json(formatProduct(product, stockMap));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// GET /api/app/products/search?q=...
const search = async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;
    if (!q) return res.json([]);

    const { storeId } = await resolveStore(req.query.lat, req.query.lng);
    const visFilter = await buildStoreFilter(storeId);

    const products = await Product.findAll({
      where: { isActive: true, name: { [Op.like]: `%${q}%` }, ...visFilter },
      include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }],
      limit: Number(limit),
    });

    const stockMap = await buildStockMap(products.map(p => p.id), storeId);
    return res.json(products.map(p => formatProduct(p, stockMap)));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = { list, getById, search };
