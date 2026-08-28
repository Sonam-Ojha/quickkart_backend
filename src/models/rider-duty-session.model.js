const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// One online stretch. Opened when the rider goes online, closed when they go
// offline. Summing duration_mins is how the Performance screen gets
// "online hours today / this week" — riders.is_online alone can't tell you that.
const RiderDutySession = sequelize.define('RiderDutySession', {
  id:           { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  riderId:      { type: DataTypes.INTEGER, allowNull: false, field: 'rider_id', references: { model: 'riders', key: 'id' } },
  startedAt:    { type: DataTypes.DATE, allowNull: false, field: 'started_at' },
  // null while the session is still open.
  endedAt:      { type: DataTypes.DATE, allowNull: true, field: 'ended_at' },
  durationMins: { type: DataTypes.INTEGER, allowNull: true, field: 'duration_mins' },
}, {
  tableName: 'rider_duty_sessions',
  timestamps: false,
  indexes: [{ fields: ['rider_id', 'started_at'] }],
});

const Rider = require('./rider.model');
RiderDutySession.belongsTo(Rider, { foreignKey: 'riderId', as: 'rider' });
Rider.hasMany(RiderDutySession,   { foreignKey: 'riderId', as: 'dutySessions' });

module.exports = RiderDutySession;
