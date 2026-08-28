const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Order = sequelize.define('Order', {
  id:           { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  customerId:   { type: DataTypes.INTEGER, allowNull: false, field: 'customer_id', references: { model: 'users', key: 'id' } },
  storeId:      { type: DataTypes.INTEGER, allowNull: true, field: 'store_id', references: { model: 'dark_stores', key: 'id' } },
  riderId:      { type: DataTypes.INTEGER, allowNull: true, field: 'rider_id', references: { model: 'riders', key: 'id' } },
  addressId:    { type: DataTypes.INTEGER, allowNull: true, field: 'address_id', references: { model: 'addresses', key: 'id' } },
  couponId:     { type: DataTypes.INTEGER, allowNull: true, field: 'coupon_id', references: { model: 'coupons', key: 'id' } },
  status: {
    type: DataTypes.ENUM('pending','confirmed','preparing','out_for_delivery','delivered','cancelled'),
    defaultValue: 'pending',
  },
  subtotal:     { type: DataTypes.INTEGER, allowNull: false },
  deliveryFee:  { type: DataTypes.INTEGER, defaultValue: 0, field: 'delivery_fee' },
  discount:     { type: DataTypes.INTEGER, defaultValue: 0 },
  total:        { type: DataTypes.INTEGER, allowNull: false },
  cancelReason: { type: DataTypes.STRING(255), allowNull: true, field: 'cancel_reason' },

  // ── Rider delivery flow ───────────────────────────────────────────────
  // `status` above stays the shared lifecycle (customer app + admin panel
  // both read it). The rider app's finer steps live here so widening the
  // rider flow never breaks those two.
  //   null        -> no rider involved yet
  //   offered     -> pushed to one or more riders, nobody accepted
  //   accepted    -> rider on the way to the store
  //   at_store    -> rider picking items (order_items.picked)
  //   to_customer -> picked up, heading to the drop
  //   at_customer -> arrived, OTP / COD pending
  //   delivered   -> handed over
  riderStage:     { type: DataTypes.ENUM('offered','accepted','at_store','to_customer','at_customer','delivered'), allowNull: true, field: 'rider_stage' },

  // 6-digit code the customer reads out; rider submits it to close the order.
  deliveryOtp:    { type: DataTypes.STRING(6), allowNull: true, field: 'delivery_otp' },
  codCollected:   { type: DataTypes.BOOLEAN, defaultValue: false, field: 'cod_collected' },

  // Rider payout split, frozen onto the order at assignment time so later
  // fee-config changes never rewrite historical earnings.
  riderBaseFee:   { type: DataTypes.INTEGER, defaultValue: 0, field: 'rider_base_fee' },
  riderIncentive: { type: DataTypes.INTEGER, defaultValue: 0, field: 'rider_incentive' },
  riderTip:       { type: DataTypes.INTEGER, defaultValue: 0, field: 'rider_tip' },

  // Stage timestamps — drive delivery-time metrics on the performance screen.
  assignedAt:     { type: DataTypes.DATE, allowNull: true, field: 'assigned_at' },
  acceptedAt:     { type: DataTypes.DATE, allowNull: true, field: 'accepted_at' },
  pickedAt:       { type: DataTypes.DATE, allowNull: true, field: 'picked_at' },
  deliveredAt:    { type: DataTypes.DATE, allowNull: true, field: 'delivered_at' },
}, {
  tableName: 'orders',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

const User      = require('./user.model');
const DarkStore = require('./darkstore.model');
const Rider     = require('./rider.model');
const Address   = require('./address.model');
Order.belongsTo(User,      { foreignKey: 'customerId', as: 'customer' });
Order.belongsTo(DarkStore, { foreignKey: 'storeId',    as: 'store' });
Order.belongsTo(Rider,     { foreignKey: 'riderId',    as: 'rider' });
Order.belongsTo(Address,   { foreignKey: 'addressId',  as: 'address' });

module.exports = Order;
