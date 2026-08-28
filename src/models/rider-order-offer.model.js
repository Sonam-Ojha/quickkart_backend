const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// One dispatch offer: "order X was shown to rider Y until Z".
// The rider app polls GET /api/rider/orders/offers for its pending rows; the
// first rider to accept wins and every sibling row flips to 'lost'.
const RiderOrderOffer = sequelize.define('RiderOrderOffer', {
  id:          { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  riderId:     { type: DataTypes.INTEGER, allowNull: false, field: 'rider_id', references: { model: 'riders', key: 'id' } },
  orderId:     { type: DataTypes.INTEGER, allowNull: false, field: 'order_id', references: { model: 'orders', key: 'id' } },
  state:       { type: DataTypes.ENUM('pending','accepted','rejected','expired','lost'), defaultValue: 'pending' },
  // Countdown the app renders on the incoming-order card.
  expiresAt:   { type: DataTypes.DATE, allowNull: false, field: 'expires_at' },
  respondedAt: { type: DataTypes.DATE, allowNull: true, field: 'responded_at' },
}, {
  tableName: 'rider_order_offers',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { unique: true, fields: ['rider_id', 'order_id'] },
    { fields: ['rider_id', 'state'] },
  ],
});

const Rider = require('./rider.model');
const Order = require('./order.model');
RiderOrderOffer.belongsTo(Rider, { foreignKey: 'riderId', as: 'rider' });
RiderOrderOffer.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });
Rider.hasMany(RiderOrderOffer,   { foreignKey: 'riderId', as: 'offers' });
Order.hasMany(RiderOrderOffer,   { foreignKey: 'orderId', as: 'offers' });

module.exports = RiderOrderOffer;
