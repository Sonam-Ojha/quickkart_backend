const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME || 'u427661378_jhatpaths',
  process.env.DB_USER || 'u427661378_jhatpaths',
  process.env.DB_PASSWORD || 'Jhatpaths@123',
  {
    host:    process.env.DB_HOST || 'auth-db674.hstgr.io',
    port:    Number(process.env.DB_PORT) || 3306,
    dialect: 'mysql',
    logging: false,
    dialectOptions: { connectTimeout: 30000, ssl: false },
    pool: {
      max:     2,      // max 2 connections — well under Hostinger's limit
      min:     0,      // release connections when idle instead of keeping one open
      acquire: 30000,
      idle:    30000,  // release after 30s idle (was 10min — was wasting quota)
      evict:   10000,  // check for stale connections every 10s
    },
  }
);

module.exports = sequelize;
