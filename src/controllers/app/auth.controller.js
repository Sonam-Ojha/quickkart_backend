const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const User    = require('../../models/user.model');

const signToken = (user) =>
  jwt.sign(
    { id: user.id, role: user.role, mobile: user.mobile },
    process.env.JWT_SECRET || 'my-secret-key',
    { expiresIn: '30d' },
  );

const register = async (req, res) => {
  try {
    const { name, mobile, password } = req.body;
    if (!name || !mobile || !password) {
      return res.status(400).json({ message: 'Name, mobile and password are required' });
    }

    const exists = await User.findOne({ where: { mobile } });
    if (exists) return res.status(409).json({ message: 'Mobile number already registered' });

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      mobile,
      password: hash,
      role: 'user',
      walletBalance: 0,
    });

    return res.status(201).json({
      token: signToken(user),
      user: { id: user.id, name: user.name, mobile: user.mobile },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const login = async (req, res) => {
  try {
    const { mobile, password } = req.body;
    if (!mobile || !password) {
      return res.status(400).json({ message: 'Mobile and password are required' });
    }

    const user = await User.findOne({ where: { mobile, role: 'user' } });
    if (!user) return res.status(401).json({ message: 'Invalid mobile or password' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: 'Invalid mobile or password' });

    return res.json({
      token: signToken(user),
      user: { id: user.id, name: user.name, mobile: user.mobile, walletBalance: user.walletBalance },
    });
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
