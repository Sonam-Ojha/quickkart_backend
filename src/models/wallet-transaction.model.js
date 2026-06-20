const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const WalletTransaction = sequelize.define('WalletTransaction', {
  id:            { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId:        { type: DataTypes.INTEGER, allowNull: false, field: 'user_id', references: { model: 'users', key: 'id' } },
  type:          { type: DataTypes.ENUM('credit', 'debit'), allowNull: false },
  amount:        { type: DataTypes.INTEGER, allowNull: false },
  source:        { type: DataTypes.ENUM('refund','referral','manual','order_payment','cashback'), allowNull: false },
  balanceAfter:  { type: DataTypes.INTEGER, allowNull: false, field: 'balance_after' },
  referenceId:   { type: DataTypes.INTEGER, allowNull: true, field: 'reference_id' },
  referenceType: { type: DataTypes.STRING(50), allowNull: true, field: 'reference_type' },
  note:          { type: DataTypes.STRING(255), allowNull: true },
  createdAt:     { type: DataTypes.DATE, field: 'created_at' },
}, {
  tableName: 'wallet_transactions',
  timestamps: false,
});

const User = require('./user.model');
WalletTransaction.belongsTo(User, { foreignKey: 'userId', as: 'user' });

module.exports = WalletTransaction;
