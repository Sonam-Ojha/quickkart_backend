const svc = require('../../services/darkstore.service');

const list = async (req, res) => {
  try {
    const stores = await svc.getAll();
    res.json({ stores });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const detail = async (req, res) => {
  try {
    const store = await svc.getById(req.params.id);
    res.json({ store });
  } catch (err) { res.status(404).json({ message: err.message }); }
};

const stats = async (req, res) => {
  try {
    const data = await svc.getStats(req.params.id);
    res.json(data);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const add = async (req, res) => {
  try {
    const { name, address, city, lat, lng, isActive } = req.body;
    if (!name || !address || !city) return res.status(400).json({ message: 'name, address, city are required' });
    const store = await svc.create({ name, address, city, lat, lng, isActive });
    res.status(201).json({ message: 'Store created', store });
  } catch (err) { res.status(400).json({ message: err.message }); }
};

const edit = async (req, res) => {
  try {
    const store = await svc.update(req.params.id, req.body);
    res.json({ message: 'Store updated', store });
  } catch (err) { res.status(400).json({ message: err.message }); }
};

const toggle = async (req, res) => {
  try {
    const store = await svc.toggle(req.params.id);
    res.json({ message: 'Store status toggled', store });
  } catch (err) { res.status(400).json({ message: err.message }); }
};

const remove = async (req, res) => {
  try {
    await svc.remove(req.params.id);
    res.json({ message: 'Store deleted' });
  } catch (err) { res.status(400).json({ message: err.message }); }
};

module.exports = { list, detail, stats, add, edit, toggle, remove };
