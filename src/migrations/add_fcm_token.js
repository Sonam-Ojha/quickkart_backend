/**
 * Run once: node src/migrations/add_fcm_token.js
 * Adds fcm_token VARCHAR(500) to users and riders tables.
 */
const sequelize = require('../config/db');

(async () => {
  const q = sequelize.getQueryInterface();

  for (const table of ['users', 'riders']) {
    try {
      await q.addColumn(table, 'fcm_token', {
        type:      require('sequelize').DataTypes.STRING(500),
        allowNull: true,
        defaultValue: null,
      });
      console.log(`✅  Added fcm_token to ${table}`);
    } catch (e) {
      if (e.original?.code === 'ER_DUP_FIELDNAME') {
        console.log(`⚠️   fcm_token already exists in ${table} — skipped`);
      } else {
        console.error(`❌  ${table}:`, e.message);
      }
    }
  }

  await sequelize.close();
})();
