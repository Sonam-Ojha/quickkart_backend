const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Otp = sequelize.define('Otp', {
  id:        { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  key:       { type: DataTypes.STRING(150), allowNull: false },
  otp:       { type: DataTypes.STRING(6), allowNull: false },
  expiresAt: { type: DataTypes.DATE, allowNull: false, field: 'expires_at' },
}, {
  tableName: 'otps',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  indexes: [{ fields: ['key'] }],
});

module.exports = Otp;
