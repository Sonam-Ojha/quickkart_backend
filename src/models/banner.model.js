const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Banner = sequelize.define('Banner', {
  id:          { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title:       { type: DataTypes.STRING(120), allowNull: false },
  subtitle:    { type: DataTypes.STRING(255), allowNull: true },
  bannerImage: { type: DataTypes.STRING(255), allowNull: false, field: 'banner_image' },
  bgType:      { type: DataTypes.ENUM('orange-tint', 'teal-tint'), defaultValue: 'orange-tint', field: 'bg_type' },
  deeplink:    { type: DataTypes.STRING(255), allowNull: true },
  sortOrder:   { type: DataTypes.INTEGER, defaultValue: 0, field: 'sort_order' },
  validTo:     { type: DataTypes.DATE, allowNull: true, field: 'valid_to' },
  isActive:    { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
}, {
  tableName: 'banners',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = Banner;
