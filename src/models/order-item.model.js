const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const OrderItem = sequelize.define('OrderItem', {
  id:        { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  orderId:   { type: DataTypes.INTEGER, allowNull: false, field: 'order_id', references: { model: 'orders', key: 'id' } },
  // Grocery lines point at a product; food lines at a menu item instead.
  productId: { type: DataTypes.INTEGER, allowNull: true, field: 'product_id', references: { model: 'products', key: 'id' } },
  menuItemId: { type: DataTypes.INTEGER, allowNull: true, field: 'menu_item_id', references: { model: 'menu_items', key: 'id' } },
  // Name at order time, so later menu edits don't rewrite past orders.
  itemName:  { type: DataTypes.STRING(120), allowNull: true, field: 'item_name' },
  quantity:  { type: DataTypes.INTEGER, allowNull: false },
  unitPrice: { type: DataTypes.INTEGER, allowNull: false, field: 'unit_price' },
  total:     { type: DataTypes.INTEGER, allowNull: false },
  // Rider's pickup checklist at the store — flipped via the rider app.
  picked:    { type: DataTypes.BOOLEAN, defaultValue: false },
}, {
  tableName: 'order_items',
  timestamps: false,
  indexes: [
    { fields: ['order_id'] },
    { fields: ['product_id'] },
  ],
});

const Order   = require('./order.model');
const Product = require('./product.model');
Order.hasMany(OrderItem,    { foreignKey: 'orderId',   as: 'items' });
OrderItem.belongsTo(Order,   { foreignKey: 'orderId' });
OrderItem.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

module.exports = OrderItem;
