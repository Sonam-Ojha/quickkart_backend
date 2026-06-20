const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Coupon = sequelize.define('Coupon', {
  id:           { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  code:         { type: DataTypes.STRING(30), allowNull: false, unique: true },
  type:         { type: DataTypes.ENUM('flat', 'percent'), allowNull: false },
  value:        { type: DataTypes.INTEGER, allowNull: false },
  maxDiscount:  { type: DataTypes.INTEGER, allowNull: true, field: 'max_discount' },
  minOrder:     { type: DataTypes.INTEGER, defaultValue: 0, field: 'min_order' },
  usageLimit:   { type: DataTypes.INTEGER, allowNull: true, field: 'usage_limit' },
  perUserLimit: { type: DataTypes.INTEGER, defaultValue: 1, field: 'per_user_limit' },
  usedCount:    { type: DataTypes.INTEGER, defaultValue: 0, field: 'used_count' },
  validFrom:    { type: DataTypes.DATE, allowNull: false, field: 'valid_from' },
  validTo:      { type: DataTypes.DATE, allowNull: false, field: 'valid_to' },
  isActive:     { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
}, {
  tableName: 'coupons',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = Coupon;
