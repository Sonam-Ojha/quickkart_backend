const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const User = sequelize.define('User', {
  id:       { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name:     { type: DataTypes.STRING(100), allowNull: false },
  email:    { type: DataTypes.STRING(150), allowNull: false, unique: true },
  password: { type: DataTypes.STRING(255), allowNull: false },
  mobile:   { type: DataTypes.STRING(15), allowNull: true, unique: true },
  avatar:   { type: DataTypes.STRING(255), allowNull: true },
  dob:      { type: DataTypes.DATEONLY, allowNull: true },
  role: {
    type: DataTypes.ENUM('super_admin','ops_manager','catalog_mgr','marketing','support','finance','user'),
    allowNull: false,
    defaultValue: 'user',
  },
  walletBalance: { type: DataTypes.INTEGER, defaultValue: 0, field: 'wallet_balance' },
  referralCode:  { type: DataTypes.STRING(20), allowNull: true, unique: true, field: 'referral_code' },
  isActive:      { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
}, {
  tableName: 'users',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = User;
