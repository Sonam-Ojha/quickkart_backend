const svc = require('../../services/referral.service');

const stats = async (req, res) => {
  try { res.json(await svc.getStats()); }
  catch (err) { res.status(500).json({ message: err.message }); }
};

const list = async (req, res) => {
  try { res.json(await svc.list(req.query)); }
  catch (err) { res.status(500).json({ message: err.message }); }
};

const updateStatus = async (req, res) => {
  try {
    const { status, rewardAmount } = req.body;
    const referral = await svc.updateStatus(req.params.id, status, rewardAmount);
    res.json({ referral });
  } catch (err) { res.status(400).json({ message: err.message }); }
};

module.exports = { stats, list, updateStatus };
