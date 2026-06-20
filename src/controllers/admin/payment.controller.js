const svc = require('../../services/payment.service');
const stats = async (req, res) => {
  try { res.json(await svc.getStats()); } catch (e) { res.status(500).json({ message: e.message }); }
};
const list = async (req, res) => {
  try { res.json(await svc.list(req.query)); } catch (e) { res.status(500).json({ message: e.message }); }
};
module.exports = { stats, list };
