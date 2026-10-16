const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const AccountDeletion = sequelize.define('AccountDeletion', {
  id:         { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId:     { type: DataTypes.INTEGER, allowNull: false, field: 'user_id' },
  userType:   { type: DataTypes.ENUM('customer', 'rider'), allowNull: false, defaultValue: 'customer', field: 'user_type' },
  mobile:     { type: DataTypes.STRING(15), allowNull: true },
  name:       { type: DataTypes.STRING(100), allowNull: true },
  reason:     { type: DataTypes.TEXT, allowNull: true },
  status:     { type: DataTypes.ENUM('pending', 'processed'), allowNull: false, defaultValue: 'pending' },
}, {
  tableName: 'account_deletions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = AccountDeletion;
