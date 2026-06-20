const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const OrderTimeline = sequelize.define('OrderTimeline', {
  id:        { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  orderId:   { type: DataTypes.INTEGER, allowNull: false, field: 'order_id', references: { model: 'orders', key: 'id' } },
  status: {
    type: DataTypes.ENUM('pending','confirmed','preparing','out_for_delivery','delivered','cancelled'),
    allowNull: false,
  },
  note:      { type: DataTypes.STRING(255), allowNull: true },
  createdAt: { type: DataTypes.DATE, field: 'created_at' },
}, {
  tableName: 'order_timeline',
  timestamps: false,
});

const Order = require('./order.model');
Order.hasMany(OrderTimeline,    { foreignKey: 'orderId', as: 'timeline' });
OrderTimeline.belongsTo(Order,  { foreignKey: 'orderId' });

module.exports = OrderTimeline;
