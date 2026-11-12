const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// A restaurant / sweet shop listed in the Food tab. It belongs to one dark
// store's area: customers served by that store (and only when the store has
// foodEnabled) see it. Orders are relayed to it by the ops team (phase 1).
const Restaurant = sequelize.define('Restaurant', {
  id:            { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  storeId:       { type: DataTypes.INTEGER, allowNull: false, field: 'store_id', references: { model: 'dark_stores', key: 'id' } },
  name:          { type: DataTypes.STRING(120), allowNull: false },
  description:   { type: DataTypes.STRING(255), allowNull: true },
  cuisines:      { type: DataTypes.STRING(160), allowNull: true },   // "Mithai, North Indian"
  imageUrl:      { type: DataTypes.STRING(500), allowNull: true, field: 'image_url' },
  address:       { type: DataTypes.TEXT, allowNull: false },
  lat:           { type: DataTypes.DECIMAL(9, 6), allowNull: true },  // rider pickup point
  lng:           { type: DataTypes.DECIMAL(9, 6), allowNull: true },
  phone:         { type: DataTypes.STRING(20), allowNull: true },     // ops calls this to relay orders
  isPureVeg:     { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_pure_veg' },
  commissionPct: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0, field: 'commission_pct' },
  prepTimeMins:  { type: DataTypes.INTEGER, allowNull: false, defaultValue: 20, field: 'prep_time_mins' },
  // Daily hours in IST, "HH:MM". Null → open all day. closeTime < openTime → past midnight.
  openTime:      { type: DataTypes.STRING(5), allowNull: true, field: 'open_time' },
  closeTime:     { type: DataTypes.STRING(5), allowNull: true, field: 'close_time' },
  // Manual switch for "closed right now" without touching the hours.
  isOpen:        { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_open' },
  isActive:      { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
  sortOrder:     { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'sort_order' },
}, {
  tableName: 'restaurants',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [{ fields: ['store_id'] }],
});

const DarkStore = require('./darkstore.model');
Restaurant.belongsTo(DarkStore, { foreignKey: 'storeId', as: 'store' });
DarkStore.hasMany(Restaurant,   { foreignKey: 'storeId', as: 'restaurants' });

module.exports = Restaurant;
