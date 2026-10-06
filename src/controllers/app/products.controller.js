const Product       = require('../../models/product.model');
const Category      = require('../../models/category.model');
const ProductStoreVisibility = require('../../models/product-store-visibility.model');
const { resolveStorefront, storeCatalog, scopeToStore, formatProduct } = require('../../services/storefront.service');
const { Op, literal } = require('sequelize');

// GET /api/app/products?tag=deal|bestseller|new&category_name=Fresh&category_id=1&section=fresh&limit=12&offset=0
const list = async (req, res) => {
  try {
    const { tag, category_id, category_name, section, q, limit = 20, offset = 0 } = req.query;
    const { storeId, serviceable } = await resolveStorefront(req.query.lat, req.query.lng);
    const catalog = await storeCatalog(storeId);

    const where = { isActive: true };
    if (tag)         where.tag        = tag;
    if (category_id) where.categoryId = category_id;
    if (q)           where.name       = { [Op.like]: `%${q}%` };

    const includeWhere = {};
    if (category_name) includeWhere.name = category_name;
    if (['grocery', 'fresh'].includes(section)) includeWhere.section = section;

    const rows = await Product.findAll({
      where: scopeToStore(where, catalog),
      include: [{
        model: Category, as: 'category',
        attributes: ['id', 'name'],
        where: Object.keys(includeWhere).length ? includeWhere : undefined,
      }],
      limit:  Number(limit),
      offset: Number(offset),
      order:  [['created_at', 'DESC']],
    });

    const visible = rows.map(p => formatProduct(p, catalog));
    return res.json({ products: visible, total: visible.length, serviceable });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// GET /api/app/products/:id
const getById = async (req, res) => {
  try {
    const { storeId } = await resolveStorefront(req.query.lat, req.query.lng);

    const product = await Product.findOne({
      where: { id: req.params.id, isActive: true },
      include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }],
    });
    if (!product) return res.status(404).json({ message: 'Product not found' });

    return res.json(formatProduct(product, await storeCatalog(storeId)));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// GET /api/app/products/search?q=...
const search = async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;
    if (!q) return res.json([]);

    const { storeId } = await resolveStorefront(req.query.lat, req.query.lng);
    const catalog = await storeCatalog(storeId);

    const products = await Product.findAll({
      where: scopeToStore({ isActive: true, name: { [Op.like]: `%${q}%` } }, catalog),
      include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }],
      limit: Number(limit),
    });

    return res.json(products.map(p => formatProduct(p, catalog)));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = { list, getById, search };
