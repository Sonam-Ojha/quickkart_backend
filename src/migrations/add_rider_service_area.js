/**
 * Run once: node src/migrations/add_rider_service_area.js
 * Adds service_lat / service_lng / service_radius to riders — the circle a
 * rider takes orders from (an order is offered when its store is inside it).
 */
const sequelize = require('../config/db');
const { DataTypes } = require('sequelize');

const COLUMNS = {
  service_lat:    { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  service_lng:    { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  service_radius: { type: DataTypes.DECIMAL(6, 2), allowNull: false, defaultValue: 5.00 },
};

(async () => {
  const qi = sequelize.getQueryInterface();
  for (const [name, spec] of Object.entries(COLUMNS)) {
    try {
      await qi.addColumn('riders', name, spec);
      console.log(`✅  ${name} column added to riders`);
    } catch (e) {
      if (e.original?.code === 'ER_DUP_FIELDNAME') console.log(`⚠️   ${name} already exists — skipped`);
      else console.error('❌', e.message);
    }
  }
  await sequelize.close();
})();
