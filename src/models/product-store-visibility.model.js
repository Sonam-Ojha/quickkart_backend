const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const ProductStoreVisibility = sequelize.define('ProductStoreVisibility', {
  id:        { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  productId: { type: DataTypes.INTEGER, allowNull: false, field: 'product_id' },
  storeId:   { type: DataTypes.INTEGER, allowNull: false, field: 'store_id' },
  isEnabled: { type: DataTypes.BOOLEAN, defaultValue: true, allowNull: false, field: 'is_enabled' },
}, {
  tableName: 'product_store_visibility',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [{ unique: true, fields: ['product_id', 'store_id'] }],
});

const Product   = require('./product.model');
const DarkStore = require('./darkstore.model');

ProductStoreVisibility.belongsTo(Product,   { foreignKey: 'productId', as: 'product' });
ProductStoreVisibility.belongsTo(DarkStore, { foreignKey: 'storeId',   as: 'store' });
Product.hasMany(ProductStoreVisibility,   { foreignKey: 'productId', as: 'storeVisibility' });
DarkStore.hasMany(ProductStoreVisibility, { foreignKey: 'storeId',   as: 'productVisibility' });

module.exports = ProductStoreVisibility;
