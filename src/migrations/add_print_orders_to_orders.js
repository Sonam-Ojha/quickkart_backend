/**
 * Run once: node src/migrations/add_print_orders_to_orders.js
 * Adds order_type + print_job to orders so print orders flow through the
 * normal order pipeline (rider dispatch, admin, tracking).
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

(async () => {
  const q = sequelize.getQueryInterface();
  const columns = {
    order_type: { type: DataTypes.ENUM('grocery', 'print'), allowNull: false, defaultValue: 'grocery' },
    print_job:  { type: DataTypes.JSON, allowNull: true },
  };
  for (const [name, spec] of Object.entries(columns)) {
    try {
      await q.addColumn('orders', name, spec);
      console.log(`✅  Added orders.${name}`);
    } catch (e) {
      if (e.original?.code === 'ER_DUP_FIELDNAME') console.log(`⚠️   orders.${name} already exists — skipped`);
      else console.error(`❌  orders.${name}:`, e.message);
    }
  }
  await sequelize.close();
})();
