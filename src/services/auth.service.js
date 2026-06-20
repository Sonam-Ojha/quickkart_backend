const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

const VALID_ADMIN_ROLES = ['super_admin','ops_manager','catalog_mgr','marketing','support','finance'];

const register = async ({ name, email, password, role }) => {
  const existing = await User.findOne({ where: { email } });
  if (existing) throw new Error('Email already registered');

  const assignedRole = VALID_ADMIN_ROLES.includes(role) ? role : 'super_admin';
  const hash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, password: hash, role: assignedRole });
  return { id: user.id, name: user.name, email: user.email, role: user.role };
};

const login = async ({ email, password }) => {
  const user = await User.findOne({ where: { email } });
  if (!user) throw new Error('Invalid email or password');

  const match = await bcrypt.compare(password, user.password);
  if (!match) throw new Error('Invalid email or password');

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET || 'my-secret-key',
    { expiresIn: '7d' }
  );

  return { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
};

module.exports = { register, login };
