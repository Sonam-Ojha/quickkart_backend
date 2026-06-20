const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const DarkStore = sequelize.define('DarkStore', {
  id:        { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name:      { type: DataTypes.STRING(100), allowNull: false },
  address:   { type: DataTypes.TEXT, allowNull: false },
  city:      { type: DataTypes.STRING(80), allowNull: false },
  lat:       { type: DataTypes.DECIMAL(9, 6), allowNull: true },
  lng:       { type: DataTypes.DECIMAL(9, 6), allowNull: true },
  isActive:  { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
}, {
  tableName: 'dark_stores',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = DarkStore;
