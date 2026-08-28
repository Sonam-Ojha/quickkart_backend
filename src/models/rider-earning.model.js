const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// Append-only earnings ledger. One row per delivery (type 'delivery'), plus
// standalone 'bonus' / 'adjustment' rows admin can push. The rider app's
// Earnings screen reads these directly — riders.total_earnings is just a
// cached roll-up of amount.
const RiderEarning = sequelize.define('RiderEarning', {
  id:        { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  riderId:   { type: DataTypes.INTEGER, allowNull: false, field: 'rider_id', references: { model: 'riders', key: 'id' } },
  // null for bonuses / manual adjustments that aren't tied to an order.
  orderId:   { type: DataTypes.INTEGER, allowNull: true, field: 'order_id', references: { model: 'orders', key: 'id' } },
  type:      { type: DataTypes.ENUM('delivery','bonus','adjustment'), defaultValue: 'delivery' },
  fee:       { type: DataTypes.INTEGER, defaultValue: 0 },
  incentive: { type: DataTypes.INTEGER, defaultValue: 0 },
  tip:       { type: DataTypes.INTEGER, defaultValue: 0 },
  // fee + incentive + tip for deliveries; the bonus value otherwise. Can be
  // negative for a clawback adjustment.
  amount:    { type: DataTypes.INTEGER, allowNull: false },
  // Denormalised so the earnings list needs no order join.
  dropArea:  { type: DataTypes.STRING(120), allowNull: true, field: 'drop_area' },
  note:      { type: DataTypes.STRING(255), allowNull: true },
}, {
  tableName: 'rider_earnings',
  timestamps: true,
  updatedAt: false,
  createdAt: 'created_at',
  indexes: [{ fields: ['rider_id', 'created_at'] }],
});

const Rider = require('./rider.model');
const Order = require('./order.model');
RiderEarning.belongsTo(Rider, { foreignKey: 'riderId', as: 'rider' });
RiderEarning.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });
Rider.hasMany(RiderEarning,   { foreignKey: 'riderId', as: 'earnings' });

module.exports = RiderEarning;
