const User = require('../../models/user.model');

const get = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'name', 'phone', 'email', 'wallet_balance', 'referral_code', 'created_at'],
    });
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json(user);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const update = async (req, res) => {
  try {
    const { name, email } = req.body;
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    await user.update({ name, email });
    return res.json({ id: user.id, name: user.name, email: user.email });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = { get, update };
