/**
 * Run once on production, after deploying the food code:
 *   node src/migrations/add_food_orders.js
 * Locally (env comes from .env):  node -r dotenv/config src/migrations/add_food_orders.js
 * Dev's sync({ alter }) adds the new columns but does not change existing ones,
 * so local databases need this too.
 *
 * Production boots with ensure-schema, which creates the new restaurants /
 * menu_* tables and adds missing columns, but never alters existing ones. The
 * food order flow also needs these existing columns changed:
 *   1. orders.order_type ENUM gains 'food'
 *   2. order_items.product_id becomes nullable (food lines have no product)
 * and these columns added (idempotent — skipped when already present):
 *   orders.restaurant_id, order_items.menu_item_id, order_items.item_name,
 *   dark_stores.food_enabled
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const addColumn = async (q, table, name, spec) => {
  try {
    await q.addColumn(table, name, spec);
    console.log(`✅  Added ${table}.${name}`);
  } catch (e) {
    if (e.original?.code === 'ER_DUP_FIELDNAME') console.log(`⚠️   ${table}.${name} already exists — skipped`);
    else throw e;
  }
};

(async () => {
  const q = sequelize.getQueryInterface();
  try {
    await q.changeColumn('orders', 'order_type', {
      type: DataTypes.ENUM('grocery', 'print', 'food'), allowNull: false, defaultValue: 'grocery',
    });
    console.log("✅  orders.order_type now allows 'food'");

    await q.changeColumn('order_items', 'product_id', { type: DataTypes.INTEGER, allowNull: true });
    console.log('✅  order_items.product_id is now nullable');

    await addColumn(q, 'orders', 'restaurant_id', { type: DataTypes.INTEGER, allowNull: true });
    await addColumn(q, 'order_items', 'menu_item_id', { type: DataTypes.INTEGER, allowNull: true });
    await addColumn(q, 'order_items', 'item_name', { type: DataTypes.STRING(120), allowNull: true });
    await addColumn(q, 'dark_stores', 'food_enabled', { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false });
  } catch (e) {
    console.error('❌  Migration failed:', e.message);
    process.exitCode = 1;
  }
  await sequelize.close();
})();
