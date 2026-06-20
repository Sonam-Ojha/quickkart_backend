const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const CouponUsage = sequelize.define('CouponUsage', {
  id:             { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  couponId:       { type: DataTypes.INTEGER, allowNull: false, field: 'coupon_id', references: { model: 'coupons', key: 'id' } },
  userId:         { type: DataTypes.INTEGER, allowNull: false, field: 'user_id', references: { model: 'users', key: 'id' } },
  orderId:        { type: DataTypes.INTEGER, allowNull: false, field: 'order_id', references: { model: 'orders', key: 'id' } },
  discountAmount: { type: DataTypes.INTEGER, allowNull: false, field: 'discount_amount' },
}, {
  tableName: 'coupon_usage',
  timestamps: false,
});

module.exports = CouponUsage;
