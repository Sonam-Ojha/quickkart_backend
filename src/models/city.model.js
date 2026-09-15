const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const City = sequelize.define('City', {
  id:       { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  stateId:  { type: DataTypes.INTEGER, allowNull: false, field: 'state_id', references: { model: 'states', key: 'id' } },
  name:     { type: DataTypes.STRING(100), allowNull: false },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
}, {
  tableName: 'cities',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [{ unique: true, fields: ['state_id', 'name'] }],
});

const State = require('./state.model');
City.belongsTo(State, { foreignKey: 'stateId', as: 'state' });
State.hasMany(City,   { foreignKey: 'stateId', as: 'cities' });

module.exports = City;
