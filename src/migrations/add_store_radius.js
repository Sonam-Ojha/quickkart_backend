/**
 * Run once: node src/migrations/add_store_radius.js
 * Adds radius column to dark_stores table.
 */
const sequelize = require('../config/db');
const { DataTypes } = require('sequelize');

(async () => {
  const qi = sequelize.getQueryInterface();
  try {
    await qi.addColumn('dark_stores', 'radius', {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: false,
      defaultValue: 5.00,
    });
    console.log('✅  radius column added to dark_stores (default 5 km)');
  } catch (e) {
    if (e.original?.code === 'ER_DUP_FIELDNAME') console.log('⚠️   radius already exists — skipped');
    else console.error('❌', e.message);
  }
  await sequelize.close();
})();
