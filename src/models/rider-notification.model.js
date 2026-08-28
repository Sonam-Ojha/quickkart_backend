const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// Per-rider inbox. Distinct from the `notifications` table, which is the
// admin's broadcast composer (segments, scheduling) — these are the delivered
// rows one rider actually sees.
const RiderNotification = sequelize.define('RiderNotification', {
  id:        { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  riderId:   { type: DataTypes.INTEGER, allowNull: false, field: 'rider_id', references: { model: 'riders', key: 'id' } },
  // Mirrors NotificationType in the app (newOrder | payout | announcement).
  type:      { type: DataTypes.ENUM('new_order','payout','announcement'), allowNull: false },
  title:     { type: DataTypes.STRING(120), allowNull: false },
  body:      { type: DataTypes.TEXT, allowNull: false },
  deeplink:  { type: DataTypes.STRING(255), allowNull: true },
  // Attribute stays `read` (that's the JSON key the app's NotificationItem
  // expects); the column is `is_read` because READ is reserved in MySQL.
  read:      { type: DataTypes.BOOLEAN, defaultValue: false, field: 'is_read' },
  readAt:    { type: DataTypes.DATE, allowNull: true, field: 'read_at' },
}, {
  tableName: 'rider_notifications',
  timestamps: true,
  updatedAt: false,
  createdAt: 'created_at',
  indexes: [{ fields: ['rider_id', 'is_read'] }],
});

const Rider = require('./rider.model');
RiderNotification.belongsTo(Rider, { foreignKey: 'riderId', as: 'rider' });
Rider.hasMany(RiderNotification,   { foreignKey: 'riderId', as: 'notifications' });

module.exports = RiderNotification;
