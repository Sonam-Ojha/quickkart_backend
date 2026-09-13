const Product   = require('../../models/product.model');
const Category  = require('../../models/category.model');
const Inventory = require('../../models/inventory.model');
const DarkStore = require('../../models/darkstore.model');
const { Op }    = require('sequelize');

// Cache the first active store ID to avoid a DB call on every request.
// Refreshes every 5 minutes in case a store is activated/deactivated.
let _cachedStoreId  = null;
let _cacheExpiresAt = 0;

async function getActiveStoreId() {
  if (_cachedStoreId && Date.now() < _cacheExpiresAt) return _cachedStoreId;
  const store = await DarkStore.findOne({ where: { is_active: true } });
  _cachedStoreId  = store?.id ?? null;
  _cacheExpiresAt = Date.now() + 5 * 60 * 1000;
  return _cachedStoreId;
}

// Build a productId → stockQty map for a list of products from the active store.
// Products with no inventory record are treated as unlimited (inStock: true).
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
  // null = no inventory record → treat as unlimited
  const stock    = stockMap && p.id in stockMap ? stockMap[p.id] : null;
  const inStock  = p.isActive && (stock === null || stock > 0);
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

    const storeId  = await getActiveStoreId();
    const stockMap = await buildStockMap(rows.map(p => p.id), storeId);

    return res.json({ products: rows.map(p => formatProduct(p, stockMap)), total: count });
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

    const storeId  = await getActiveStoreId();
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

    const products = await Product.findAll({
      where: { isActive: true, name: { [Op.like]: `%${q}%` } },
      include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }],
      limit: Number(limit),
    });

    const storeId  = await getActiveStoreId();
    const stockMap = await buildStockMap(products.map(p => p.id), storeId);
    return res.json(products.map(p => formatProduct(p, stockMap)));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = { list, getById, search };
