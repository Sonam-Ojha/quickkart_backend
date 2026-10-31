const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const AdminNotification = sequelize.define('AdminNotification', {
  id:       { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title:    { type: DataTypes.STRING(200), allowNull: false },
  body:     { type: DataTypes.TEXT, allowNull: false },
  type:     { type: DataTypes.ENUM('order', 'kyc_document', 'rider', 'system'), defaultValue: 'system' },
  sourceId: { type: DataTypes.INTEGER, allowNull: true, field: 'source_id' },
  isRead:   { type: DataTypes.BOOLEAN, defaultValue: false, field: 'is_read' },
  icon:     { type: DataTypes.STRING(10), allowNull: true },
}, {
  tableName: 'admin_notifications',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = AdminNotification;
