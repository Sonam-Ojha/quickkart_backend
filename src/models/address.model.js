const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Address = sequelize.define('Address', {
  id:         { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId:     { type: DataTypes.INTEGER, allowNull: false, field: 'user_id', references: { model: 'users', key: 'id' } },
  label:      { type: DataTypes.STRING(50), defaultValue: 'Home' },
  line1:      { type: DataTypes.STRING(255), allowNull: false },
  line2:      { type: DataTypes.STRING(255), allowNull: true },
  city:       { type: DataTypes.STRING(80), allowNull: false },
  pincode:    { type: DataTypes.STRING(10), allowNull: false },
  lat:        { type: DataTypes.DECIMAL(9, 6), allowNull: true },
  lng:        { type: DataTypes.DECIMAL(9, 6), allowNull: true },
  isDefault:  { type: DataTypes.BOOLEAN, defaultValue: false, field: 'is_default' },
}, {
  tableName: 'addresses',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = Address;
