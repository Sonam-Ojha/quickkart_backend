const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const OrderItem = sequelize.define('OrderItem', {
  id:        { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  orderId:   { type: DataTypes.INTEGER, allowNull: false, field: 'order_id', references: { model: 'orders', key: 'id' } },
  productId: { type: DataTypes.INTEGER, allowNull: false, field: 'product_id', references: { model: 'products', key: 'id' } },
  quantity:  { type: DataTypes.INTEGER, allowNull: false },
  unitPrice: { type: DataTypes.INTEGER, allowNull: false, field: 'unit_price' },
  total:     { type: DataTypes.INTEGER, allowNull: false },
}, {
  tableName: 'order_items',
  timestamps: false,
});

const Order   = require('./order.model');
const Product = require('./product.model');
Order.hasMany(OrderItem,    { foreignKey: 'orderId',   as: 'items' });
OrderItem.belongsTo(Order,   { foreignKey: 'orderId' });
OrderItem.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

module.exports = OrderItem;
