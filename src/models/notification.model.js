const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Notification = sequelize.define('Notification', {
  id:          { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title:       { type: DataTypes.STRING(120), allowNull: false },
  body:        { type: DataTypes.TEXT, allowNull: false },
  segment:     { type: DataTypes.ENUM('all', 'active', 'inactive'), defaultValue: 'all' },
  deeplink:    { type: DataTypes.STRING(255), allowNull: true },
  status:      { type: DataTypes.ENUM('draft', 'scheduled', 'sent', 'failed'), defaultValue: 'draft' },
  scheduledAt: { type: DataTypes.DATE, allowNull: true, field: 'scheduled_at' },
  sentAt:      { type: DataTypes.DATE, allowNull: true, field: 'sent_at' },
  sentCount:   { type: DataTypes.INTEGER, defaultValue: 0, field: 'sent_count' },
}, {
  tableName: 'notifications',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = Notification;
