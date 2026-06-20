const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const User = require('../models/user.model');

const ADMIN_ROLES = ['super_admin', 'ops_manager', 'catalog_mgr', 'marketing', 'support', 'finance'];

const listAdminUsers = () =>
  User.findAll({
    where: { role: { [Op.in]: ADMIN_ROLES } },
    attributes: ['id', 'name', 'email', 'role', 'isActive', 'created_at', 'updated_at'],
    order: [['created_at', 'DESC']],
  });

const inviteAdmin = async ({ name, email, role }) => {
  if (!name || !email || !role) throw new Error('name, email and role are required');
  if (!ADMIN_ROLES.includes(role)) throw new Error('Invalid role');

  const existing = await User.findOne({ where: { email } });
  if (existing) throw new Error('Email already registered');

  const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase();
  const hashed = await bcrypt.hash(tempPassword, 10);

  const user = await User.create({ name, email, password: hashed, role });
  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    tempPassword,
  };
};

const updateAdminUser = async (id, { role, isActive }) => {
  const user = await User.findOne({ where: { id, role: { [Op.in]: ADMIN_ROLES } } });
  if (!user) throw new Error('Admin user not found');

  const updates = {};
  if (role !== undefined) {
    if (!ADMIN_ROLES.includes(role)) throw new Error('Invalid role');
    updates.role = role;
  }
  if (isActive !== undefined) updates.isActive = isActive;

  await user.update(updates);
  return { id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive };
};

module.exports = { listAdminUsers, inviteAdmin, updateAdminUser };
