const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const SupportTicket = sequelize.define('SupportTicket', {
  id:         { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  customerId: { type: DataTypes.INTEGER, allowNull: false, field: 'customer_id', references: { model: 'users', key: 'id' } },
  orderId:    { type: DataTypes.INTEGER, allowNull: true, field: 'order_id', references: { model: 'orders', key: 'id' } },
  category:   { type: DataTypes.ENUM('delivery','payment','product','account','other'), allowNull: false, defaultValue: 'other' },
  status:     { type: DataTypes.ENUM('open','in_progress','resolved'), defaultValue: 'open' },
}, {
  tableName: 'support_tickets',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

const User  = require('./user.model');
const Order = require('./order.model');
SupportTicket.belongsTo(User,  { foreignKey: 'customerId', as: 'customer' });
SupportTicket.belongsTo(Order, { foreignKey: 'orderId',    as: 'order', required: false });

module.exports = SupportTicket;
