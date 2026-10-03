const { Op } = require('sequelize');
const Category = require('../models/category.model');
const Product = require('../models/product.model');

// ── Categories ────────────────────────────────────────────

const SECTIONS = ['grocery', 'fresh'];

const getAllCategories = async ({ section } = {}) => {
  const where = SECTIONS.includes(section) ? { section } : {};
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
  const childCount = await Category.count({ where: { parentId: id } });
  if (childCount > 0) throw new Error(`Cannot delete — ${childCount} sub-categories exist under this category. Delete sub-categories first.`);
  const productCount = await Product.count({ where: { categoryId: id } });
  if (productCount > 0) throw new Error(`Cannot delete — ${productCount} products use this category`);
  await cat.destroy();
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
    // Per-row update
    const results = await Promise.all(
      payload.updates.map(async ({ id, ...fields }) => {
        const cat = await Category.findByPk(id);
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

const bulkDeleteCategories = async (ids) => {
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw new Error('ids array is required');
  }
  // Block delete if any category has products
  const productCount = await Product.count({ where: { categoryId: { [Op.in]: ids } } });
  if (productCount > 0) {
    throw new Error(`Cannot delete — ${productCount} products exist in selected categories`);
  }
  const count = await Category.destroy({ where: { id: { [Op.in]: ids } } });
  return { deleted: count };
};

// ── Products ─────────────────────────────────────────────

const getAllProducts = async ({ categoryId, search, activeOnly, page = 1, limit = 20 }) => {
  page  = parseInt(page)  || 1;
  limit = parseInt(limit) || 20;
  const where = {};
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

const createProduct = async ({ name, categoryId, brand, unit, mrp, price, imageUrl, tag, isActive }) => {
  return Product.create({ name, categoryId, brand, unit, mrp, price, imageUrl, tag: tag || null, isActive });
};

const updateProduct = async (id, data) => {
  const product = await Product.findByPk(id);
  if (!product) throw new Error('Product not found');
  await product.update(data);
  return product;
};

const deleteProduct = async (id) => {
  const product = await Product.findByPk(id);
  if (!product) throw new Error('Product not found');
  await product.destroy();
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
    const results = await Promise.all(
      payload.updates.map(async ({ id, ...fields }) => {
        const p = await Product.findByPk(id);
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

const bulkDeleteProducts = async (ids) => {
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw new Error('ids array is required');
  }
  const count = await Product.destroy({ where: { id: { [Op.in]: ids } } });
  return { deleted: count };
};

module.exports = {
  getAllCategories, createCategory, updateCategory, deleteCategory, toggleCategory,
  bulkCreateCategories, bulkUpdateCategories, bulkDeleteCategories,
  getAllProducts, createProduct, updateProduct, deleteProduct, toggleProduct,
  bulkCreateProducts, bulkUpdateProducts, bulkDeleteProducts,
};
