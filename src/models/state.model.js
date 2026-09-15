const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const State = sequelize.define('State', {
  id:        { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  countryId: { type: DataTypes.INTEGER, allowNull: false, field: 'country_id', references: { model: 'countries', key: 'id' } },
  name:      { type: DataTypes.STRING(100), allowNull: false },
  code:      { type: DataTypes.STRING(10), allowNull: true },  // e.g. HR, UP, DL
  isActive:  { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
}, {
  tableName: 'states',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [{ unique: true, fields: ['country_id', 'name'] }],
});

const Country = require('./country.model');
State.belongsTo(Country, { foreignKey: 'countryId', as: 'country' });
Country.hasMany(State,   { foreignKey: 'countryId', as: 'states' });

module.exports = State;
