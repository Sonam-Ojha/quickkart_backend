const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const InfoPage = sequelize.define('InfoPage', {
  id:       { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  slug:     { type: DataTypes.STRING(100), allowNull: false, unique: true }, // privacy-policy | terms-of-service | about-us
  title:    { type: DataTypes.STRING(200), allowNull: false },
  subtitle: { type: DataTypes.STRING(500), defaultValue: '' },
  sections: { type: DataTypes.JSON, defaultValue: [] }, // [{heading, body}]
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
}, {
  tableName: 'info_pages',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = InfoPage;
