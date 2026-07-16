const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { Op }  = require('sequelize');
const User    = require('../../models/user.model');

const signToken = (user) =>
  jwt.sign(
    { id: user.id, role: user.role, mobile: user.mobile },
    process.env.JWT_SECRET || 'my-secret-key',
    { expiresIn: '30d' },
  );

// Detect whether input looks like an email
const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const register = async (req, res) => {
  try {
    const { name, mobile, email, password } = req.body;
    if (!name || (!mobile && !email) || !password) {
      return res.status(400).json({ message: 'Name, mobile or email, and password are required' });
    }

    // Check duplicate
    const whereClause = mobile ? { mobile } : { email };
    const exists = await User.findOne({ where: whereClause });
    if (exists) {
      return res.status(409).json({
        message: mobile ? 'Mobile number already registered' : 'Email already registered',
      });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      mobile: mobile || null,
      email:  email  || null,
      password: hash,
      role: 'user',
      walletBalance: 0,
    });

    return res.status(201).json({
      token: signToken(user),
      user: { id: user.id, name: user.name, mobile: user.mobile, email: user.email },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const login = async (req, res) => {
  try {
    // Accept either `mobile` or `email` or a generic `identifier` field
    const { mobile, email, identifier, password } = req.body;
    const loginValue = identifier || mobile || email;

    if (!loginValue || !password) {
      return res.status(400).json({ message: 'Mobile/email and password are required' });
    }

    // Find by mobile OR email depending on what was provided
    const where = isEmail(loginValue)
      ? { email: loginValue, role: 'user' }
      : { mobile: loginValue, role: 'user' };

    const user = await User.findOne({ where });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });

    return res.json({
      token: signToken(user),
      user: {
        id: user.id,
        name: user.name,
        mobile: user.mobile,
        email: user.email,
        walletBalance: user.walletBalance,
      },
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
