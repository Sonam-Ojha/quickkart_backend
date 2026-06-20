const svc = require('../../services/order.service');

const stats = async (req, res) => {
  try { res.json(await svc.getStats()); }
  catch (err) { res.status(500).json({ message: err.message }); }
};

const list = async (req, res) => {
  try { res.json(await svc.list(req.query)); }
  catch (err) { res.status(500).json({ message: err.message }); }
};

const detail = async (req, res) => {
  try { res.json({ order: await svc.getById(req.params.id) }); }
  catch (err) { res.status(404).json({ message: err.message }); }
};

const updateStatus = async (req, res) => {
  try {
    const order = await svc.updateStatus(req.params.id, req.body.status, req.body.note);
    res.json({ order });
  } catch (err) { res.status(400).json({ message: err.message }); }
};

module.exports = { stats, list, detail, updateStatus };
