const svc = require('../../services/inventory.service');

const listByStore = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { search, lowStock } = req.query;
    const rows = await svc.getByStore(storeId, { search, lowStock });
    res.json({ inventory: rows });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const setStock = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { productId, stockQty } = req.body;
    if (productId == null || stockQty == null) {
      return res.status(400).json({ message: 'productId and stockQty are required' });
    }
    const row = await svc.upsert(storeId, productId, stockQty);
    res.json({ message: 'Stock updated', inventory: row });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const adjustStock = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { productId, delta } = req.body;
    if (productId == null || delta == null) {
      return res.status(400).json({ message: 'productId and delta are required' });
    }
    const row = await svc.adjust(storeId, productId, delta);
    res.json({ message: 'Stock adjusted', inventory: row });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const removeStock = async (req, res) => {
  try {
    const { storeId, productId } = req.params;
    await svc.remove(storeId, productId);
    res.json({ message: 'Inventory entry removed' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

module.exports = { listByStore, setStock, adjustStock, removeStock };
