const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// One flat chat thread per rider. Deliberately not reusing support_tickets:
// that table's customer_id is NOT NULL and points at users, and the rider app
// shows a single ongoing conversation rather than a list of tickets.
const RiderSupportMessage = sequelize.define('RiderSupportMessage', {
  id:        { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  riderId:   { type: DataTypes.INTEGER, allowNull: false, field: 'rider_id', references: { model: 'riders', key: 'id' } },
  // Mirrors SupportSender in the app (rider | agentBot).
  sender:    { type: DataTypes.ENUM('rider', 'agent'), allowNull: false },
  message:   { type: DataTypes.TEXT, allowNull: false },
}, {
  tableName: 'rider_support_messages',
  timestamps: true,
  updatedAt: false,
  createdAt: 'created_at',
  indexes: [{ fields: ['rider_id', 'created_at'] }],
});

const Rider = require('./rider.model');
RiderSupportMessage.belongsTo(Rider, { foreignKey: 'riderId', as: 'rider' });
Rider.hasMany(RiderSupportMessage,   { foreignKey: 'riderId', as: 'supportMessages' });

module.exports = RiderSupportMessage;
