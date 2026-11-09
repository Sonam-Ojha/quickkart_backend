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

  // Apply indexes declared on models but missing from the DB
  for (const model of Object.values(sequelize.models)) {
    const rawIndexes = model.options?.indexes;
    if (!rawIndexes || rawIndexes.length === 0) continue;
    const table = model.getTableName();
    const tableName = typeof table === 'string' ? table : table.tableName;

    let existing;
    try {
      existing = await qi.showIndex(table);
    } catch { continue; }

    // Signature: sorted DB column names joined — matches regardless of index name
    const existingSigs = new Set(
      existing.map(idx => idx.fields.map(f => f.attribute).sort().join(','))
    );

    for (const indexDef of rawIndexes) {
      const fields = indexDef.fields;
      if (!fields || fields.length === 0) continue;
      const sig = [...fields].sort().join(',');
      if (existingSigs.has(sig)) continue;
      const name = `idx_${tableName}_${fields.join('_')}`;
      try {
        await qi.addIndex(table, fields, { name, unique: indexDef.unique || false });
        added.push(`${tableName} index(${fields.join(',')})`);
      } catch (err) {
        console.warn(`[schema] skipped index ${name}:`, err.message);
      }
    }
  }

  if (added.length) console.log('[schema] added:', added.join(', '));
  return added;
}

module.exports = ensureSchema;
