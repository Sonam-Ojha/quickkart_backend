const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const User    = require('../../models/user.model');

const signToken = (user) =>
  jwt.sign(
    { id: user.id, role: user.role, phone: user.phone },
    process.env.JWT_SECRET || 'my-secret-key',
    { expiresIn: '30d' },
  );

const register = async (req, res) => {
  try {
    const { name, phone, email, password } = req.body;

    const exists = await User.findOne({ where: { phone } });
    if (exists) return res.status(409).json({ message: 'Phone already registered' });

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, phone, email, password: hash, role: 'user', wallet_balance: 0 });

    return res.status(201).json({ token: signToken(user), user: { id: user.id, name: user.name, phone: user.phone } });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const login = async (req, res) => {
  try {
    const { phone, password } = req.body;

    const user = await User.findOne({ where: { phone, role: 'user' } });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });

    return res.json({ token: signToken(user), user: { id: user.id, name: user.name, phone: user.phone, walletBalance: user.wallet_balance } });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const refresh = async (req, res) => {
  try {
    const user = await User.findByPk(req.body.userId);
    if (!user || user.role !== 'user') return res.status(401).json({ message: 'Invalid' });
    return res.json({ token: signToken(user) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = { register, login, refresh };
