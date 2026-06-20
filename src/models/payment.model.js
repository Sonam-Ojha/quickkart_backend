const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Payment = sequelize.define('Payment', {
  id:         { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  orderId:    { type: DataTypes.INTEGER, allowNull: false, field: 'order_id', references: { model: 'orders', key: 'id' } },
  gateway:    { type: DataTypes.ENUM('razorpay','paytm','phonepe','upi','wallet','cod'), allowNull: false },
  txnId:      { type: DataTypes.STRING(100), allowNull: true, field: 'txn_id' },
  amount:     { type: DataTypes.INTEGER, allowNull: false },
  status:     { type: DataTypes.ENUM('pending','paid','failed','refunded'), defaultValue: 'pending' },
  refundedAt: { type: DataTypes.DATE, allowNull: true, field: 'refunded_at' },
}, {
  tableName: 'payments',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

const Order = require('./order.model');
const User  = require('./user.model');
Payment.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });
Order.hasOne(Payment,    { foreignKey: 'orderId', as: 'payment' });

module.exports = Payment;
