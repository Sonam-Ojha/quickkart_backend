const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Wishlist = sequelize.define('Wishlist', {
  id:        { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId:    { type: DataTypes.INTEGER, allowNull: false, field: 'user_id' },
  productId: { type: DataTypes.INTEGER, allowNull: false, field: 'product_id' },
}, {
  tableName: 'wishlists',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [{ unique: true, fields: ['user_id', 'product_id'] }],
});

const Product = require('./product.model');
Wishlist.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

module.exports = Wishlist;
