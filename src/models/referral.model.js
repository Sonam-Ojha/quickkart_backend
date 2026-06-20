const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Referral = sequelize.define('Referral', {
  id:           { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  referrerId:   { type: DataTypes.INTEGER, allowNull: false, field: 'referrer_id', references: { model: 'users', key: 'id' } },
  refereeId:    { type: DataTypes.INTEGER, allowNull: false, field: 'referee_id', references: { model: 'users', key: 'id' } },
  referralCode: { type: DataTypes.STRING(20), allowNull: false, field: 'referral_code' },
  status:       { type: DataTypes.ENUM('pending', 'approved', 'rejected'), defaultValue: 'pending' },
  rewardAmount: { type: DataTypes.INTEGER, defaultValue: 0, field: 'reward_amount' },
}, {
  tableName: 'referrals',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [{ unique: true, fields: ['referrer_id', 'referee_id'] }],
});

const User = require('./user.model');
Referral.belongsTo(User, { foreignKey: 'referrerId', as: 'referrer' });
Referral.belongsTo(User, { foreignKey: 'refereeId',  as: 'referee' });

module.exports = Referral;
