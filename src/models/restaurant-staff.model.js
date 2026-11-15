const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// A restaurant partner's login (owner, counter staff…). Kept apart from
// `users` because that table's mobile is unique across customers — the owner
// may already shop on Jhatpats with the same number. Several staff per
// restaurant; each sees and runs only that restaurant (partner API).
const RestaurantStaff = sequelize.define('RestaurantStaff', {
  id:           { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  restaurantId: { type: DataTypes.INTEGER, allowNull: false, field: 'restaurant_id', references: { model: 'restaurants', key: 'id' } },
  name:         { type: DataTypes.STRING(100), allowNull: false },
  mobile:       { type: DataTypes.STRING(15), allowNull: false, unique: true },
  password:     { type: DataTypes.STRING(255), allowNull: false },
  isActive:     { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
  lastLoginAt:  { type: DataTypes.DATE, allowNull: true, field: 'last_login_at' },
}, {
  tableName: 'restaurant_staff',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [{ fields: ['restaurant_id'] }],
  defaultScope: { attributes: { exclude: ['password'] } },
  scopes: { withPassword: { attributes: { include: ['password'] } } },
});

const Restaurant = require('./restaurant.model');
RestaurantStaff.belongsTo(Restaurant, { foreignKey: 'restaurantId', as: 'restaurant' });
Restaurant.hasMany(RestaurantStaff,   { foreignKey: 'restaurantId', as: 'staff' });

module.exports = RestaurantStaff;
