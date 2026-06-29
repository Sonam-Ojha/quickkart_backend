const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Product = sequelize.define('Product', {
  id:         { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name:       { type: DataTypes.STRING(150), allowNull: false },
  categoryId: { type: DataTypes.INTEGER, allowNull: false, field: 'category_id', references: { model: 'categories', key: 'id' } },
  brand:      { type: DataTypes.STRING(80), allowNull: true },
  unit:       { type: DataTypes.STRING(30), allowNull: true },
  mrp:        { type: DataTypes.INTEGER, allowNull: false },
  price:      { type: DataTypes.INTEGER, allowNull: false },
  imageUrl:   { type: DataTypes.STRING(500), allowNull: true, field: 'image_url' },
  tag:        { type: DataTypes.ENUM('deal', 'bestseller', 'new'), allowNull: true },
  isActive:   { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
}, {
  tableName: 'products',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

// Association — loaded after both models are defined
const Category = require('./category.model');
Product.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });
Category.hasMany(Product, { foreignKey: 'categoryId', as: 'products' });

module.exports = Product;
