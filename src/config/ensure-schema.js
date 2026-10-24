const sequelize = require('./db');

// Production-safe schema top-up: creates tables that don't exist yet and adds
// columns a model declares but the table lacks (e.g. a newly added
// `orders.order_type`). It never drops, renames or alters existing columns.
//
// Why not sync({ alter }) in production: it inspects and rewrites every table
// and opened 50-100+ connections per boot, exhausting Hostinger's
// 500-connections/hour limit. This runs one DESCRIBE per table over the
// normal 2-connection pool.
async function ensureSchema() {
  const qi = sequelize.getQueryInterface();
  const added = [];

  for (const model of Object.values(sequelize.models)) {
    const table = model.getTableName();
    let columns;
    try {
      columns = await qi.describeTable(table);
    } catch {
      await model.sync(); // table missing — create it as declared
      added.push(`${typeof table === 'string' ? table : table.tableName} (table)`);
      continue;
    }

    for (const attr of Object.values(model.rawAttributes)) {
      const field = attr.field || attr.fieldName;
      if (columns[field]) continue;
      // Primary keys/auto-increment can't be bolted onto an existing table.
      if (attr.primaryKey || attr.autoIncrement) continue;
      const { references, onUpdate, onDelete, ...definition } = attr;
      await qi.addColumn(table, field, definition);
      added.push(`${typeof table === 'string' ? table : table.tableName}.${field}`);
    }
  }

  if (added.length) console.log('[schema] added:', added.join(', '));
  return added;
}

module.exports = ensureSchema;
