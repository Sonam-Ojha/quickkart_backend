const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Rider = sequelize.define('Rider', {
  id:               { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name:             { type: DataTypes.STRING(100), allowNull: false },
  mobile:           { type: DataTypes.STRING(15), allowNull: false, unique: true },
  storeId:          { type: DataTypes.INTEGER, allowNull: false, field: 'store_id', references: { model: 'dark_stores', key: 'id' } },
  rating:           { type: DataTypes.DECIMAL(3, 2), defaultValue: 5.00 },
  totalDeliveries:  { type: DataTypes.INTEGER, defaultValue: 0, field: 'total_deliveries' },
  status:           { type: DataTypes.ENUM('active', 'inactive', 'suspended'), defaultValue: 'active' },
}, {
  tableName: 'riders',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

const DarkStore = require('./darkstore.model');
Rider.belongsTo(DarkStore, { foreignKey: 'storeId', as: 'store' });
DarkStore.hasMany(Rider, { foreignKey: 'storeId', as: 'riders' });

module.exports = Rider;
