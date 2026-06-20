const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Category = sequelize.define('Category', {
  id:        { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name:      { type: DataTypes.STRING(80), allowNull: false },
  parentId:  { type: DataTypes.INTEGER, allowNull: true, field: 'parent_id', references: { model: 'categories', key: 'id' } },
  icon:      { type: DataTypes.STRING(255), allowNull: true },
  sortOrder: { type: DataTypes.INTEGER, defaultValue: 0, field: 'sort_order' },
  isActive:  { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
}, {
  tableName: 'categories',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = Category;
