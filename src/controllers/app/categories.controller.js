const Category  = require('../../models/category.model');
const Product   = require('../../models/product.model');
const { resolveStorefront, storeCatalog, scopeToStore, formatProduct } = require('../../services/storefront.service');
const { Op } = require('sequelize');

// GET /api/app/categories?section=grocery|fresh  (no section → all)
const list = async (req, res) => {
  try {
    const where = { is_active: true };
    if (['grocery', 'fresh'].includes(req.query.section)) where.section = req.query.section;
    const categories = await Category.findAll({ where, order: [['name', 'ASC']] });

    const { storeId } = await resolveStorefront(req.query.lat, req.query.lng);
    const catalog = await storeCatalog(storeId);

    const products = await Product.findAll({
      where: scopeToStore({ isActive: true }, catalog),
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

    const { storeId } = await resolveStorefront(req.query.lat, req.query.lng);
    const catalog = await storeCatalog(storeId);

    const where = scopeToStore({ categoryId: id, isActive: true }, catalog);

    const { rows } = await Product.findAndCountAll({
      where,
      include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }],
      limit: Number(limit),
      offset: Number(offset),
      order: [['created_at', 'DESC']],
    });

    const visible = rows.map(p => formatProduct(p, catalog));
    return res.json({ category, products: visible, total: visible.length });
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

    const { storeId } = await resolveStorefront(req.query.lat, req.query.lng);
    const catalog = await storeCatalog(storeId);

    const where = scopeToStore({ categoryId: { [Op.in]: catIds }, isActive: true }, catalog);

    const { rows } = await Product.findAndCountAll({
      where,
      include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }],
      limit:  Number(limit),
      offset: Number(offset),
      order:  [['created_at', 'DESC']],
    });

    const visible = rows.map(p => formatProduct(p, catalog));
    return res.json({ category, subcategories: children, products: visible, total: visible.length });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = { list, products, allProducts };
