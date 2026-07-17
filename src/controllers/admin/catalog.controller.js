const svc = require('../../services/catalog.service');

// ── Categories ────────────────────────────────────────────

const listCategories = async (req, res) => {
  try {
    const categories = await svc.getAllCategories();
    res.json({ categories });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const addCategory = async (req, res) => {
  try {
    const { name, parentId, icon, imageUrl, sortOrder, isActive } = req.body;
    if (!name) return res.status(400).json({ message: 'name is required' });
    const category = await svc.createCategory({ name, parentId, icon, imageUrl, sortOrder, isActive });
    res.status(201).json({ message: 'Category created', category });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const editCategory = async (req, res) => {
  try {
    const category = await svc.updateCategory(req.params.id, req.body);
    res.json({ message: 'Category updated', category });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const removeCategory = async (req, res) => {
  try {
    await svc.deleteCategory(req.params.id);
    res.json({ message: 'Category deleted' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const toggleCategory = async (req, res) => {
  try {
    const category = await svc.toggleCategory(req.params.id);
    res.json({ message: 'Category status toggled', category });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const bulkCreateCategories = async (req, res) => {
  try {
    const { rows } = req.body;
    if (!rows || !rows.length) return res.status(400).json({ message: 'rows array is required' });
    const result = await svc.bulkCreateCategories(rows);
    res.status(201).json({ message: `${result.created} categories created`, ...result });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const bulkUpdateCategories = async (req, res) => {
  try {
    const result = await svc.bulkUpdateCategories(req.body);
    res.json({ message: `${result.updated} categories updated`, ...result });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const bulkDeleteCategories = async (req, res) => {
  try {
    const { ids } = req.body;
    const result = await svc.bulkDeleteCategories(ids);
    res.json({ message: `${result.deleted} categories deleted`, ...result });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// ── Products ─────────────────────────────────────────────

const listProducts = async (req, res) => {
  try {
    const { categoryId, search, activeOnly, page, limit } = req.query;
    const result = await svc.getAllProducts({ categoryId, search, activeOnly, page, limit });
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const addProduct = async (req, res) => {
  try {
    const { name, categoryId, brand, unit, mrp, price, imageUrl, isActive } = req.body;
    if (!name || !categoryId || !mrp || !price) {
      return res.status(400).json({ message: 'name, categoryId, mrp, price are required' });
    }
    const product = await svc.createProduct({ name, categoryId, brand, unit, mrp, price, imageUrl, isActive });
    res.status(201).json({ message: 'Product created', product });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const editProduct = async (req, res) => {
  try {
    const product = await svc.updateProduct(req.params.id, req.body);
    res.json({ message: 'Product updated', product });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const removeProduct = async (req, res) => {
  try {
    await svc.deleteProduct(req.params.id);
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const toggleProduct = async (req, res) => {
  try {
    const product = await svc.toggleProduct(req.params.id);
    res.json({ message: 'Product status toggled', product });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const bulkUpdateProducts = async (req, res) => {
  try {
    const result = await svc.bulkUpdateProducts(req.body);
    res.json({ message: `${result.updated} products updated`, ...result });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const bulkDeleteProducts = async (req, res) => {
  try {
    const { ids } = req.body;
    const result = await svc.bulkDeleteProducts(ids);
    res.json({ message: `${result.deleted} products deleted`, ...result });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

module.exports = {
  listCategories, addCategory, editCategory, removeCategory, toggleCategory,
  bulkCreateCategories, bulkUpdateCategories, bulkDeleteCategories,
  listProducts, addProduct, editProduct, removeProduct, toggleProduct,
  bulkUpdateProducts, bulkDeleteProducts,
};
