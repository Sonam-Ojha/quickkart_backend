const { Op } = require('sequelize');
const Category = require('../models/category.model');
const Product = require('../models/product.model');

// ── Categories ────────────────────────────────────────────

const SECTIONS = ['grocery', 'fresh'];

const getAllCategories = async ({ section } = {}) => {
  const where = SECTIONS.includes(section) ? { section, isArchived: false } : { isArchived: false };
  return Category.findAll({ where, order: [['sort_order', 'ASC'], ['id', 'ASC']] });
};

// A sub-category always lives in its parent's section; a main category uses
// the requested one (default grocery).
const resolveSection = async (parentId, section) => {
  if (parentId) {
    const parent = await Category.findByPk(parentId);
    if (!parent) throw new Error('Parent category not found');
    return parent.section;
  }
  return SECTIONS.includes(section) ? section : 'grocery';
};

const createCategory = async ({ name, parentId, icon, imageUrl, sortOrder, isActive, showInFilter, showInGrid, section }) => {
  const resolved = await resolveSection(parentId, section);
  return Category.create({ name, parentId, icon, imageUrl, sortOrder, isActive, showInFilter, showInGrid, section: resolved });
};

const updateCategory = async (id, data) => {
  const cat = await Category.findByPk(id);
  if (!cat) throw new Error('Category not found');
  const parentId = data.parentId !== undefined ? data.parentId : cat.parentId;
  const section = await resolveSection(parentId, data.section ?? cat.section);
  await cat.update({ ...data, section });
  // Keep the subtree in the same section when a main category moves.
  if (!parentId) await Category.update({ section }, { where: { parentId: cat.id } });
  return cat;
};

const deleteCategory = async (id) => {
  const cat = await Category.findByPk(id);
  if (!cat) throw new Error('Category not found');
  const { skipped } = await bulkDeleteCategories([cat.id]);
  if (skipped.length) throw new Error(`Cannot delete — ${skipped[0].reason}`);
};

const toggleCategory = async (id) => {
  const cat = await Category.findByPk(id);
  if (!cat) throw new Error('Category not found');
  await cat.update({ isActive: !cat.isActive });
  return cat;
};

// Bulk update: { ids, data } → same fields for all, OR { updates: [{id, ...fields}] } → per-row
const bulkCreateCategories = async (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('rows array is required');
  const created = await Promise.all(
    rows.map(async ({ name, parentId, icon, imageUrl, sortOrder, isActive, showInFilter, showInGrid, section }) =>
      Category.create({
        name, parentId: parentId || null, icon: icon || null, imageUrl: imageUrl || null, sortOrder: sortOrder || 0, isActive: isActive !== false,
        showInFilter: showInFilter !== false, showInGrid: showInGrid !== false,
        section: await resolveSection(parentId, section),
      }),
    ),
  );
  return { created: created.length, categories: created };
};

const bulkUpdateCategories = async (payload) => {
  const sequelize = Category.sequelize;

  if (payload.updates && Array.isArray(payload.updates)) {
    // Pre-fetch all in one query, then update — eliminates N findByPk round-trips
    const updateIds = payload.updates.map(u => u.id);
    const existing  = await Category.findAll({ where: { id: { [Op.in]: updateIds } } });
    const catMap    = new Map(existing.map(c => [c.id, c]));
    const results   = await Promise.all(
      payload.updates.map(async ({ id, ...fields }) => {
        const cat = catMap.get(id);
        if (!cat) return null;
        await cat.update(fields);
        return cat;
      }),
    );
    return { updated: results.filter(Boolean).length };
  }

  const { ids, data } = payload;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw new Error('ids array is required');
  }
  if (!data || Object.keys(data).length === 0) {
    throw new Error('data object with fields to update is required');
  }
  const [count] = await Category.update(data, { where: { id: { [Op.in]: ids } } });
  return { updated: count };
};

// Deletes each selected category it safely can and reports the rest:
//  • a category with live products, or live sub-categories that aren't also
//    selected, is skipped with the reason;
//  • one only referenced by archived products/sub-categories is archived
//    (inactive + hidden from the admin) since those rows still point at it;
//  • everything else is deleted. Sub-categories go first so their parents free up.
const bulkDeleteCategories = async (ids) => {
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw new Error('ids array is required');
  }
  const cats = await Category.findAll({ where: { id: { [Op.in]: ids }, isArchived: false } });
  cats.sort((a, b) => (b.parentId ? 1 : 0) - (a.parentId ? 1 : 0));

  // Pre-aggregate all counts in 4 queries instead of 4 per category
  const [liveProductRows, liveChildRows, allProductRows, allChildRows] = await Promise.all([
    Product.count({ where: { categoryId: { [Op.in]: ids }, isArchived: false }, group: ['category_id'] }),
    Category.count({ where: { parentId: { [Op.in]: ids }, isArchived: false }, group: ['parent_id'] }),
    Product.count({ where: { categoryId: { [Op.in]: ids } }, group: ['category_id'] }),
    Category.count({ where: { parentId: { [Op.in]: ids } }, group: ['parent_id'] }),
  ]);
  const liveProductMap = new Map(liveProductRows.map(r => [r.category_id, Number(r.count)]));
  const liveChildMap   = new Map(liveChildRows.map(r =>   [r.parent_id,   Number(r.count)]));
  const allProductMap  = new Map(allProductRows.map(r =>  [r.category_id, Number(r.count)]));
  const allChildMap    = new Map(allChildRows.map(r =>    [r.parent_id,   Number(r.count)]));

  let deleted = 0, archived = 0;
  const skipped = [];
  for (const cat of cats) {
    const liveProducts = liveProductMap.get(cat.id) ?? 0;
    if (liveProducts > 0) {
      skipped.push({ id: cat.id, name: cat.name, reason: `${liveProducts} product${liveProducts === 1 ? '' : 's'} still in "${cat.name}" — delete or move them first` });
      continue;
    }
    const liveChildren = liveChildMap.get(cat.id) ?? 0;
    if (liveChildren > 0) {
      skipped.push({ id: cat.id, name: cat.name, reason: `"${cat.name}" still has ${liveChildren} sub-categor${liveChildren === 1 ? 'y' : 'ies'} — delete them first` });
      continue;
    }
    const stillReferenced = (allProductMap.get(cat.id) ?? 0) + (allChildMap.get(cat.id) ?? 0);
    if (stillReferenced > 0) {
      await cat.update({ isActive: false, isArchived: true });
      archived++;
    } else {
      await cat.destroy();
      deleted++;
    }
  }
  return { deleted, archived, skipped };
};

// ── Products ─────────────────────────────────────────────

const getAllProducts = async ({ categoryId, search, activeOnly, page = 1, limit = 20 }) => {
  page  = parseInt(page)  || 1;
  limit = parseInt(limit) || 20;
  const where = { isArchived: false };
  if (categoryId) where.categoryId = categoryId;
  if (search) where.name = { [Op.like]: `%${search}%` };
  if (activeOnly === 'true') where.isActive = true;

  const offset = (page - 1) * limit;
  const { count, rows } = await Product.findAndCountAll({
    where,
    include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }],
    order: [['id', 'DESC']],
    limit,
    offset: (page - 1) * limit,
  });

  return { total: count, page: Number(page), limit: Number(limit), products: rows };
};

// Admin sends the whole gallery as `images`; keep it clean (non-empty, unique,
// at most MAX_IMAGES) and make imageUrl follow the first one — that's the
// cover every list and card already reads.
const MAX_IMAGES = 8;
const withGallery = (data) => {
  if (!('images' in data)) return data;
  const images = [...new Set((Array.isArray(data.images) ? data.images : [])
    .map(u => String(u || '').trim()).filter(Boolean))].slice(0, MAX_IMAGES);
  return { ...data, images, imageUrl: images[0] ?? null };
};

const createProduct = async ({ name, categoryId, brand, unit, mrp, price, imageUrl, images, tag, isActive }) => {
  const gallery = withGallery(images !== undefined ? { images } : { images: imageUrl ? [imageUrl] : [] });
  return Product.create({ name, categoryId, brand, unit, mrp, price, ...gallery, tag: tag || null, isActive });
};

const updateProduct = async (id, data) => {
  const product = await Product.findByPk(id);
  if (!product) throw new Error('Product not found');
  await product.update(withGallery(data));
  return product;
};

const deleteProduct = async (id) => {
  const product = await Product.findByPk(id);
  if (!product) throw new Error('Product not found');
  await bulkDeleteProducts([product.id]);
};

const toggleProduct = async (id) => {
  const product = await Product.findByPk(id);
  if (!product) throw new Error('Product not found');
  await product.update({ isActive: !product.isActive });
  return product;
};

// Bulk update: { ids, data } → same fields for all, OR { updates: [{id, ...fields}] } → per-row
const bulkCreateProducts = async (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('rows array is required');
  const created = await Promise.all(
    rows.map(({ name, categoryId, brand, unit, mrp, price, imageUrl, tag, isActive }) =>
      Product.create({
        name, categoryId, brand: brand || null, unit: unit || null,
        mrp: Math.round(Number(mrp)), price: Math.round(Number(price)),
        imageUrl: imageUrl || null, tag: tag || null, isActive: isActive !== false,
      }),
    ),
  );
  return { created: created.length, products: created };
};

const bulkUpdateProducts = async (payload) => {
  if (payload.updates && Array.isArray(payload.updates)) {
    // Pre-fetch all in one query, then update — eliminates N findByPk round-trips
    const updateIds = payload.updates.map(u => u.id);
    const existing  = await Product.findAll({ where: { id: { [Op.in]: updateIds } } });
    const prodMap   = new Map(existing.map(p => [p.id, p]));
    const results   = await Promise.all(
      payload.updates.map(async ({ id, ...fields }) => {
        const p = prodMap.get(id);
        if (!p) return null;
        await p.update(fields);
        return p;
      }),
    );
    return { updated: results.filter(Boolean).length };
  }

  const { ids, data } = payload;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw new Error('ids array is required');
  }
  if (!data || Object.keys(data).length === 0) {
    throw new Error('data object with fields to update is required');
  }
  const [count] = await Product.update(data, { where: { id: { [Op.in]: ids } } });
  return { updated: count };
};

// Products that appear in past orders can't be removed — order history reads
// the product row for its name. Those are archived instead: deactivated
// (hidden from customers) and dropped from the admin list. Everything else goes, together with its stock, store-visibility,
// cart and wishlist rows, which would otherwise block the delete.
const bulkDeleteProducts = async (ids) => {
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw new Error('ids array is required');
  }
  const numericIds = ids.map(Number);
  const OrderItem              = require('../models/order-item.model');
  const Inventory              = require('../models/inventory.model');
  const ProductStoreVisibility = require('../models/product-store-visibility.model');
  const CartItem               = require('../models/cart-item.model');
  const Wishlist               = require('../models/wishlist.model');

  const ordered = await OrderItem.findAll({ attributes: ['productId'], where: { productId: { [Op.in]: numericIds } }, group: ['productId'], raw: true });
  const orderedIds = new Set(ordered.map(r => Number(r.product_id ?? r.productId)));
  const deletableIds = numericIds.filter(id => !orderedIds.has(id));
  const keptIds = numericIds.filter(id => orderedIds.has(id));

  let deleted = 0;
  if (deletableIds.length) {
    deleted = await Product.sequelize.transaction(async (transaction) => {
      const where = { productId: { [Op.in]: deletableIds } };
      for (const M of [Inventory, ProductStoreVisibility, CartItem, Wishlist]) {
        await M.destroy({ where, transaction });
      }
      return Product.destroy({ where: { id: { [Op.in]: deletableIds } }, transaction });
    });
  }

  let archived = 0;
  if (keptIds.length) {
    [archived] = await Product.update({ isActive: false, isArchived: true }, { where: { id: { [Op.in]: keptIds } } });
  }

  return { deleted, archived };
};

module.exports = {
  getAllCategories, createCategory, updateCategory, deleteCategory, toggleCategory,
  bulkCreateCategories, bulkUpdateCategories, bulkDeleteCategories,
  getAllProducts, createProduct, updateProduct, deleteProduct, toggleProduct,
  bulkCreateProducts, bulkUpdateProducts, bulkDeleteProducts,
};
