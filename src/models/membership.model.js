const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Membership = sequelize.define('Membership', {
  id:       { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId:   { type: DataTypes.INTEGER, allowNull: false, field: 'user_id' },
  plan:     { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'plus_3month' },
  status:   {
    type: DataTypes.ENUM('active', 'expired', 'cancelled'),
    defaultValue: 'active',
  },
  startsAt: { type: DataTypes.DATE, allowNull: false, field: 'starts_at' },
  endsAt:   { type: DataTypes.DATE, allowNull: false, field: 'ends_at' },
}, {
  tableName: 'memberships',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = Membership;
