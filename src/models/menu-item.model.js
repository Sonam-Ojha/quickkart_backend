const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// A dish on a restaurant's menu. Prices are whole rupees, like products.
const MenuItem = sequelize.define('MenuItem', {
  id:             { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  restaurantId:   { type: DataTypes.INTEGER, allowNull: false, field: 'restaurant_id', references: { model: 'restaurants', key: 'id' } },
  menuCategoryId: { type: DataTypes.INTEGER, allowNull: true, field: 'menu_category_id', references: { model: 'menu_categories', key: 'id' } },
  name:           { type: DataTypes.STRING(120), allowNull: false },
  description:    { type: DataTypes.STRING(255), allowNull: true },
  imageUrl:       { type: DataTypes.STRING(500), allowNull: true, field: 'image_url' },
  price:          { type: DataTypes.INTEGER, allowNull: false },
  mrp:            { type: DataTypes.INTEGER, allowNull: true },   // struck-through price, optional
  unit:           { type: DataTypes.STRING(40), allowNull: true }, // "250 g", "1 plate"
  isVeg:          { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_veg' },
  // Sold out for now — hidden from ordering, kept on the menu.
  isAvailable:    { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_available' },
  isActive:       { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
  sortOrder:      { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'sort_order' },
}, {
  tableName: 'menu_items',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [{ fields: ['restaurant_id'] }, { fields: ['menu_category_id'] }],
});

const Restaurant   = require('./restaurant.model');
const MenuCategory = require('./menu-category.model');
MenuItem.belongsTo(Restaurant,   { foreignKey: 'restaurantId',   as: 'restaurant' });
Restaurant.hasMany(MenuItem,     { foreignKey: 'restaurantId',   as: 'menuItems' });
MenuItem.belongsTo(MenuCategory, { foreignKey: 'menuCategoryId', as: 'menuCategory' });
MenuCategory.hasMany(MenuItem,   { foreignKey: 'menuCategoryId', as: 'items' });

module.exports = MenuItem;
