const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Order = sequelize.define('Order', {
  id:           { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  customerId:   { type: DataTypes.INTEGER, allowNull: false, field: 'customer_id', references: { model: 'users', key: 'id' } },
  storeId:      { type: DataTypes.INTEGER, allowNull: false, field: 'store_id', references: { model: 'dark_stores', key: 'id' } },
  riderId:      { type: DataTypes.INTEGER, allowNull: true, field: 'rider_id', references: { model: 'riders', key: 'id' } },
  addressId:    { type: DataTypes.INTEGER, allowNull: false, field: 'address_id', references: { model: 'addresses', key: 'id' } },
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
}, {
  tableName: 'orders',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

const User      = require('./user.model');
const DarkStore = require('./darkstore.model');
const Rider     = require('./rider.model');
Order.belongsTo(User,      { foreignKey: 'customerId', as: 'customer' });
Order.belongsTo(DarkStore, { foreignKey: 'storeId',    as: 'store' });
Order.belongsTo(Rider,     { foreignKey: 'riderId',    as: 'rider' });

module.exports = Order;
