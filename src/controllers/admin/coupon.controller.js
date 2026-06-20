const svc = require('../../services/coupon.service');

const list   = async (req, res) => {
  try { res.json({ coupons: await svc.list(req.query) }); }
  catch (err) { res.status(500).json({ message: err.message }); }
};
const create = async (req, res) => {
  try { res.status(201).json({ coupon: await svc.create(req.body) }); }
  catch (err) { res.status(400).json({ message: err.message }); }
};
const update = async (req, res) => {
  try { res.json({ coupon: await svc.update(req.params.id, req.body) }); }
  catch (err) { res.status(400).json({ message: err.message }); }
};
const toggle = async (req, res) => {
  try { res.json({ coupon: await svc.toggle(req.params.id) }); }
  catch (err) { res.status(404).json({ message: err.message }); }
};
const remove = async (req, res) => {
  try { await svc.remove(req.params.id); res.json({ message: 'Coupon deleted' }); }
  catch (err) { res.status(404).json({ message: err.message }); }
};

module.exports = { list, create, update, toggle, remove };
