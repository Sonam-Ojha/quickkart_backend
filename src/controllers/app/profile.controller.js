const User = require('../../models/user.model');

const get = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'name', 'mobile', 'email', 'wallet_balance', 'referral_code', 'created_at'],
    });
    if (!user) return res.status(404).json({ message: 'User not found' });
    // Expose mobile as "phone" so the frontend field name is consistent
    const data = user.toJSON();
    data.phone = data.mobile;
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const update = async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'Name is required' });
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    // Pass fields array so Sequelize only validates name & email,
    // not password (OTP users have password: null)
    await user.update(
      { name: name.trim(), email: email?.trim() || null },
      { fields: ['name', 'email'], validate: false },
    );
    return res.json({ id: user.id, name: user.name, email: user.email, phone: user.mobile });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'This email is already used by another account' });
    }
    return res.status(500).json({ message: err.message });
  }
};

const saveFcmToken = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: 'token is required' });
    await User.update({ fcm_token: token }, { where: { id: req.user.id } });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = { get, update, saveFcmToken };
