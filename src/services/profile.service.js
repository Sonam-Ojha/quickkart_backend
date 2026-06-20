const User = require('../models/user.model');

const getProfile = async (userId) => {
  const user = await User.findByPk(userId, {
    attributes: ['id', 'name', 'email', 'mobile', 'avatar', 'dob', 'role', 'walletBalance', 'referralCode', 'isActive', 'created_at'],
  });
  if (!user) throw new Error('User not found');
  return user;
};

const updateProfile = async (userId, { name, email, mobile, avatar, dob }) => {
  const user = await User.findByPk(userId);
  if (!user) throw new Error('User not found');

  if (email && email !== user.email) {
    const existing = await User.findOne({ where: { email } });
    if (existing) throw new Error('Email already in use');
  }

  await user.update({ name, email, mobile, avatar, dob });
  return { id: user.id, name: user.name, email: user.email, mobile: user.mobile, avatar: user.avatar, dob: user.dob };
};

const changePassword = async (userId, { oldPassword, newPassword }) => {
  const bcrypt = require('bcryptjs');
  const user = await User.findByPk(userId);
  if (!user) throw new Error('User not found');
  const match = await bcrypt.compare(oldPassword, user.password);
  if (!match) throw new Error('Current password is incorrect');
  if (newPassword.length < 6) throw new Error('New password must be at least 6 characters');
  const hash = await bcrypt.hash(newPassword, 10);
  await user.update({ password: hash });
};

module.exports = { getProfile, updateProfile, changePassword };
