const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const OtpLog = sequelize.define('OtpLog', {
  id:       { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  mobile:   { type: DataTypes.STRING(15), allowNull: true },
  email:    { type: DataTypes.STRING(150), allowNull: true },
  channel:  { type: DataTypes.ENUM('sms', 'email'), allowNull: false },
  status:   { type: DataTypes.ENUM('sent', 'failed', 'dev'), allowNull: false, defaultValue: 'sent' },
  platform: { type: DataTypes.ENUM('web', 'app', 'rider'), allowNull: true },
}, {
  tableName:  'otp_logs',
  timestamps: true,
  createdAt:  'created_at',
  updatedAt:  false,
  indexes: [{ fields: ['created_at'] }, { fields: ['mobile'] }],
});

module.exports = OtpLog;
