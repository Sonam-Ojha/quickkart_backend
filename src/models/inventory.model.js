const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Inventory = sequelize.define('Inventory', {
  id:        { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  productId: { type: DataTypes.INTEGER, allowNull: false, field: 'product_id', references: { model: 'products', key: 'id' } },
  storeId:   { type: DataTypes.INTEGER, allowNull: false, field: 'store_id', references: { model: 'dark_stores', key: 'id' } },
  stockQty:  { type: DataTypes.INTEGER, defaultValue: 0, field: 'stock_qty' },
}, {
  tableName: 'inventory',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [{ unique: true, fields: ['product_id', 'store_id'] }],
});

const Product   = require('./product.model');
const DarkStore = require('./darkstore.model');
Inventory.belongsTo(Product,   { foreignKey: 'productId',  as: 'product' });
Inventory.belongsTo(DarkStore, { foreignKey: 'storeId',    as: 'store' });

module.exports = Inventory;
