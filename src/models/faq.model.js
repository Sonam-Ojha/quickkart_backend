const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Faq = sequelize.define('Faq', {
  id:         { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  question:   { type: DataTypes.STRING(500), allowNull: false },
  answer:     { type: DataTypes.TEXT, allowNull: false },
  page:       { type: DataTypes.STRING(50), defaultValue: 'print' }, // print | general | orders
  sortOrder:  { type: DataTypes.INTEGER, defaultValue: 0, field: 'sort_order' },
  isActive:   { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
}, {
  tableName: 'faqs',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = Faq;
