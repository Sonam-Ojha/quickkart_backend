const { Sequelize } = require('sequelize');

if (!process.env.DB_NAME || !process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_HOST) {
  throw new Error('Missing required DB environment variables: DB_NAME, DB_USER, DB_PASSWORD, DB_HOST');
}

// Observe physical connections, not queries. No credentials or SQL are logged.
// Counts are per process/boot, not the hosting provider's shared-user counter.
const bootId = `${process.pid}-${Date.now().toString(36)}`;
const openedAt = new WeakMap();
let recentOpens = [];
let totalOpens = 0;

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host:    process.env.DB_HOST,
    port:    Number(process.env.DB_PORT) || 3306,
    dialect: 'mysql',
    logging: false,
    hooks: {
      afterConnect(connection) {
        const now = Date.now();
        openedAt.set(connection, now);
        recentOpens = recentOpens.filter(at => at > now - 3600000);
        recentOpens.push(now);
        totalOpens++;
        console.info('[db-connection]', JSON.stringify({
          event: 'opened', bootId, pid: process.pid,
          last60Minutes: recentOpens.length, totalSinceBoot: totalOpens,
        }));
      },
      afterDisconnect(connection) {
        const since = openedAt.get(connection);
        if (since == null) return;
        openedAt.delete(connection);
        console.info('[db-connection]', JSON.stringify({
          event: 'disposed', bootId, pid: process.pid, lifetimeMs: Date.now() - since,
        }));
      },
    },
    dialectOptions: {
      connectTimeout: 30000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      ssl: { rejectUnauthorized: false },
    },
    pool: {
      max:     5,
      min:     1,
      acquire: 10000,  // fail fast — 10s max wait instead of 30s
      // Hostinger limits NEW connections/hour, not just concurrent connections.
      // Reuse burst connections between polls instead of retiring them after 20s.
      // Server-side wait_timeout still applies; TCP keepalive does not extend it.
      idle:    300000,
      evict:   30000,
    },
  }
);

module.exports = sequelize;
