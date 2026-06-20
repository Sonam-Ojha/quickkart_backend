const { Op } = require('sequelize');
const Category = require('../models/category.model');
const Product = require('../models/product.model');

// ── Categories ────────────────────────────────────────────

const getAllCategories = async () => {
  return Category.findAll({ order: [['sort_order', 'ASC'], ['id', 'ASC']] });
};

const createCategory = async ({ name, parentId, icon, sortOrder, isActive }) => {
  return Category.create({ name, parentId, icon, sortOrder, isActive });
};

const updateCategory = async (id, data) => {
  const cat = await Category.findByPk(id);
  if (!cat) throw new Error('Category not found');
  await cat.update(data);
  return cat;
};

const deleteCategory = async (id) => {
  const cat = await Category.findByPk(id);
  if (!cat) throw new Error('Category not found');
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

const createProduct = async ({ name, categoryId, brand, unit, mrp, price, imageUrl, isActive }) => {
  return Product.create({ name, categoryId, brand, unit, mrp, price, imageUrl, isActive });
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

module.exports = {
  getAllCategories, createCategory, updateCategory, deleteCategory, toggleCategory,
  getAllProducts, createProduct, updateProduct, deleteProduct, toggleProduct,
};
