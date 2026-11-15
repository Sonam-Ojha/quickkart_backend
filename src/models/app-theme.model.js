const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const parse = (raw, fallback) => {
  if (raw == null || raw === '') return fallback;
  if (typeof raw !== 'string') return raw;
  try { return JSON.parse(raw); } catch { return fallback; }
};

// A festival / seasonal look for the customer app + website (Diwali, Holi,
// New Year…). Live when switched on AND now is inside [startsAt, endsAt).
// storeIds = null → every area; otherwise only those dark stores.
// `config` holds what the apps are built to change — see theme.service.js.
const AppTheme = sequelize.define('AppTheme', {
  id:        { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name:      { type: DataTypes.STRING(80), allowNull: false },
  isActive:  { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_active' },
  startsAt:  { type: DataTypes.DATE, allowNull: true, field: 'starts_at' },
  endsAt:    { type: DataTypes.DATE, allowNull: true, field: 'ends_at' },
  // TEXT holding JSON (Hostinger's MariaDB hands JSON columns back as strings).
  storeIds: {
    type: DataTypes.TEXT, allowNull: true, field: 'store_ids',
    get() { return parse(this.getDataValue('storeIds'), null); },
    set(v) { this.setDataValue('storeIds', Array.isArray(v) && v.length ? JSON.stringify(v.map(Number)) : null); },
  },
  priority:  { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  config: {
    type: DataTypes.TEXT('long'), allowNull: false,
    get() { return parse(this.getDataValue('config'), {}); },
    set(v) { this.setDataValue('config', JSON.stringify(v ?? {})); },
  },
}, {
  tableName: 'app_themes',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = AppTheme;
