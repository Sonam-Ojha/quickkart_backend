const { DataTypes } = require('sequelize');
const sequelize     = require('../config/db');
const User          = require('./user.model');

const PrintOrder = sequelize.define('PrintOrder', {
  id:          { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  customerId:  { type: DataTypes.INTEGER, allowNull: false, field: 'customer_id' },
  files:       { type: DataTypes.JSON,    allowNull: false },
  color:       { type: DataTypes.ENUM('bw', 'color'), defaultValue: 'bw' },
  paper:       { type: DataTypes.ENUM('A4', 'A3', 'Letter'), defaultValue: 'A4' },
  sides:       { type: DataTypes.ENUM('single', 'double'), defaultValue: 'single' },
  copies:      { type: DataTypes.INTEGER, defaultValue: 1 },
  totalPages:  { type: DataTypes.INTEGER, defaultValue: 0, field: 'total_pages' },
  printCost:   { type: DataTypes.DECIMAL(10, 2), defaultValue: 0, field: 'print_cost' },
  deliveryFee: { type: DataTypes.DECIMAL(10, 2), defaultValue: 25, field: 'delivery_fee' },
  grandTotal:  { type: DataTypes.DECIMAL(10, 2), defaultValue: 0, field: 'grand_total' },
  status:      { type: DataTypes.ENUM('pending', 'confirmed', 'printing', 'delivered', 'cancelled'), defaultValue: 'pending' },
  addressId:   { type: DataTypes.INTEGER, allowNull: true, field: 'address_id' },
}, {
  tableName:   'print_orders',
  underscored: true,
  createdAt:   'created_at',
  updatedAt:   'updated_at',
});

PrintOrder.belongsTo(User, { foreignKey: 'customer_id', as: 'customer' });

module.exports = PrintOrder;
