const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// Section of a restaurant's menu, e.g. "Mithai", "Thali", "Chaat".
const MenuCategory = sequelize.define('MenuCategory', {
  id:           { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  restaurantId: { type: DataTypes.INTEGER, allowNull: false, field: 'restaurant_id', references: { model: 'restaurants', key: 'id' } },
  name:         { type: DataTypes.STRING(80), allowNull: false },
  sortOrder:    { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'sort_order' },
  isActive:     { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
}, {
  tableName: 'menu_categories',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [{ fields: ['restaurant_id'] }],
});

const Restaurant = require('./restaurant.model');
MenuCategory.belongsTo(Restaurant, { foreignKey: 'restaurantId', as: 'restaurant' });
Restaurant.hasMany(MenuCategory,   { foreignKey: 'restaurantId', as: 'menuCategories' });

module.exports = MenuCategory;
