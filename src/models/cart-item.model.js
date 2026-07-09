const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// Stores the user's server-side cart so it survives app restarts and
// multiple devices. product_id is stored but NOT enforced as a FK so
// that locally-created items (productId = 0) can also be persisted.
const CartItem = sequelize.define('CartItem', {
  id:            { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId:        { type: DataTypes.INTEGER, allowNull: false, field: 'user_id' },
  productId:     { type: DataTypes.INTEGER, defaultValue: 0, field: 'product_id' },
  name:          { type: DataTypes.STRING(150), allowNull: false },
  weight:        { type: DataTypes.STRING(50), defaultValue: '' },
  price:         { type: DataTypes.INTEGER, allowNull: false },
  originalPrice: { type: DataTypes.INTEGER, allowNull: false, field: 'original_price' },
  img:           { type: DataTypes.STRING(500), defaultValue: '' },
  qty:           { type: DataTypes.INTEGER, defaultValue: 1 },
}, {
  tableName: 'cart_items',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = CartItem;
