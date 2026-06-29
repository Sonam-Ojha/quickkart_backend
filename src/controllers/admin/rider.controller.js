const bcrypt = require('bcryptjs');
const svc    = require('../../services/rider.service');
const Rider  = require('../../models/rider.model');

const list = async (req, res) => {
  try {
    const { storeId, status, search } = req.query;
    const riders = await svc.getAll({ storeId, status, search });
    res.json({ riders });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const add = async (req, res) => {
  try {
    const { name, mobile, storeId, rating, status, password, vehicleType, vehicleNumber } = req.body;
    if (!name || !mobile || !storeId) return res.status(400).json({ message: 'name, mobile, storeId are required' });
    const hashed = password ? await bcrypt.hash(password, 10) : null;
    const rider  = await svc.create({ name, mobile, storeId, rating, status, vehicleType, vehicleNumber, password: hashed });
    res.status(201).json({ message: 'Rider added', rider });
  } catch (err) { res.status(400).json({ message: err.message }); }
};

const edit = async (req, res) => {
  try {
    const rider = await svc.update(req.params.id, req.body);
    res.json({ message: 'Rider updated', rider });
  } catch (err) { res.status(400).json({ message: err.message }); }
};

const toggle = async (req, res) => {
  try {
    const rider = await svc.toggle(req.params.id);
    res.json({ message: 'Rider status toggled', rider });
  } catch (err) { res.status(400).json({ message: err.message }); }
};

const remove = async (req, res) => {
  try {
    await svc.remove(req.params.id);
    res.json({ message: 'Rider deleted' });
  } catch (err) { res.status(400).json({ message: err.message }); }
};

const setPassword = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
    const rider = await Rider.findByPk(req.params.id);
    if (!rider) return res.status(404).json({ message: 'Rider not found' });
    await rider.update({ password: await bcrypt.hash(password, 10) });
    res.json({ message: 'Password set successfully' });
  } catch (err) { res.status(400).json({ message: err.message }); }
};

module.exports = { list, add, edit, toggle, remove, setPassword };
