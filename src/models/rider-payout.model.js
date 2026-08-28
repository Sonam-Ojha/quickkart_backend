const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// A withdrawal from the rider's earned balance to their bank / UPI.
// Balance = SUM(rider_earnings.amount) - SUM(rider_payouts.amount WHERE state != 'failed').
const RiderPayout = sequelize.define('RiderPayout', {
  id:            { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  riderId:       { type: DataTypes.INTEGER, allowNull: false, field: 'rider_id', references: { model: 'riders', key: 'id' } },
  amount:        { type: DataTypes.INTEGER, allowNull: false },
  method:        { type: DataTypes.ENUM('bank','upi'), allowNull: false },
  // Masked label the app shows, e.g. "Bank ****4321" — snapshot at request
  // time so changing bank details later doesn't rewrite old payouts.
  destination:   { type: DataTypes.STRING(100), allowNull: true },
  state:         { type: DataTypes.ENUM('processing','paid','failed'), defaultValue: 'processing' },
  reference:     { type: DataTypes.STRING(100), allowNull: true },
  processedAt:   { type: DataTypes.DATE, allowNull: true, field: 'processed_at' },
  failureReason: { type: DataTypes.STRING(255), allowNull: true, field: 'failure_reason' },
}, {
  tableName: 'rider_payouts',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [{ fields: ['rider_id', 'state'] }],
});

const Rider = require('./rider.model');
RiderPayout.belongsTo(Rider, { foreignKey: 'riderId', as: 'rider' });
Rider.hasMany(RiderPayout,   { foreignKey: 'riderId', as: 'payouts' });

module.exports = RiderPayout;
